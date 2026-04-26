// ==========================================
// 🚀 FILE: chart-indicators.js
// 📦 WAVE ALPHA — THƯ VIỆN CHỈ BÁO & UI PRO
// Version: 2.0.0 | KLineCharts Compatible
// ==========================================
// ── SECTION 1: CONSTANTS & CONFIG ─────────
// ── SECTION 2: MATH HELPERS ───────────────
// ── SECTION 3: INDICATOR REGISTRY ─────────
// ── SECTION 4: REGISTER INDICATORS ────────
// ── SECTION 5: UI COMPONENTS ──────────────
// ── SECTION 6: EVENT HANDLERS & MEMORY ────
// ── SECTION 7: PUBLIC API ─────────────────
// ==========================================

(function (global) {
  'use strict';

  // ══════════════════════════════════════════════════════
  // SECTION 1: CONSTANTS & CONFIG
  // ══════════════════════════════════════════════════════

  const WAVE_ALPHA_VERSION = '2.0.0';

  /** Color palette — Wave Alpha dark theme */
  const COLOR = {
    cyan:        '#00F0FF',
    cyanFaint:   'rgba(0,240,255,0.05)',
    cyanMid:     'rgba(0,240,255,0.15)',
    gold:        '#F0B90B',
    green:       '#0ECB81',
    red:         '#F6465D',
    white:       '#EAECEF',
    muted:       '#848e9c',
    bg:          '#1e2329',
    bgDark:      '#161a1e',
    border:      'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.15)',
  };

  /** LocalStorage key for persisting active indicators */
  const LS_KEY = 'wave_alpha_indicators_state';

  /** How long (ms) to wait before retrying createIndicator on failure */
  const RETRY_DELAY_MS = 300;

  // ══════════════════════════════════════════════════════
  // SECTION 2: MATH HELPERS
  // Pure functions — no side effects, safe to call in calc()
  // ══════════════════════════════════════════════════════

  /**
   * Wilder's Exponential Moving Average (used by ATR, RSI internals)
   * @param {number[]} data
   * @param {number} period
   * @returns {number[]}
   */
  function calcRMA(data, period) {
    const result = new Array(data.length).fill(NaN);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    result[period - 1] = sum / period;
    for (let i = period; i < data.length; i++) {
      result[i] = (result[i - 1] * (period - 1) + data[i]) / period;
    }
    return result;
  }

  /**
   * Standard Exponential Moving Average
   * @param {number[]} data
   * @param {number} period
   * @returns {number[]}
   */
  function calcEMA(data, period) {
    const result = new Array(data.length).fill(NaN);
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    result[period - 1] = sum / period;
    for (let i = period; i < data.length; i++) {
      result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  }

  /**
   * Simple Moving Average
   * @param {number[]} data
   * @param {number} period
   * @returns {number[]}
   */
  function calcSMA(data, period) {
    const result = new Array(data.length).fill(NaN);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (i >= period) sum -= data[i - period];
      if (i >= period - 1) result[i] = sum / period;
    }
    return result;
  }

  /**
   * Average True Range
   * @param {Object[]} dataList  — array of {high, low, close}
   * @param {number} period
   * @returns {number[]}
   */
  function calcATR(dataList, period) {
    const tr = dataList.map((d, i) => {
      if (i === 0) return d.high - d.low;
      const prev = dataList[i - 1].close;
      return Math.max(d.high - d.low, Math.abs(d.high - prev), Math.abs(d.low - prev));
    });
    return calcRMA(tr, period);
  }

  /**
   * Stochastic %K and %D
   * @param {Object[]} dataList  — {high, low, close}
   * @param {number} kPeriod
   * @param {number} dPeriod
   * @param {number} smooth      — smoothing for raw %K before becoming %K
   * @returns {{ k: number[], d: number[] }}
   */
  function calcStoch(dataList, kPeriod, dPeriod, smooth) {
    const rawK = dataList.map((d, i) => {
      if (i < kPeriod - 1) return NaN;
      let hh = -Infinity, ll = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        hh = Math.max(hh, dataList[j].high);
        ll = Math.min(ll, dataList[j].low);
      }
      return hh === ll ? 50 : ((d.close - ll) / (hh - ll)) * 100;
    });
    // Smooth rawK → %K using SMA
    const kArr = calcSMA(rawK.map(v => isNaN(v) ? 0 : v), smooth);
    // %D = SMA of %K
    const dArr = calcSMA(kArr.map(v => isNaN(v) ? 0 : v), dPeriod);
    return { k: kArr, d: dArr };
  }

  /**
   * Pivot Points (Classic)
   * @param {number} h  — previous high
   * @param {number} l  — previous low
   * @param {number} c  — previous close
   * @returns {{pp,r1,r2,r3,s1,s2,s3}}
   */
  function calcPivotPoints(h, l, c) {
    const pp = (h + l + c) / 3;
    const r1 = 2 * pp - l;
    const s1 = 2 * pp - h;
    const r2 = pp + (h - l);
    const s2 = pp - (h - l);
    const r3 = h + 2 * (pp - l);
    const s3 = l - 2 * (h - pp);
    return { pp, r1, r2, r3, s1, s2, s3 };
  }

  /**
   * UTC day index (absolute days since epoch) — fixes VWAP reset bug
   * @param {number} timestamp  — Unix ms
   * @returns {number}
   */
  function utcDayIndex(timestamp) {
    return Math.floor(timestamp / 86400000);
  }

  /**
   * UTC week index (Monday-anchored)
   * @param {number} timestamp
   * @returns {number}
   */
  function utcWeekIndex(timestamp) {
    // Shift so Monday = day 0, then floor to weeks
    return Math.floor((timestamp / 86400000 + 3) / 7);
  }

  /**
   * UTC month index (year*12 + month)
   * @param {number} timestamp
   * @returns {number}
   */
  function utcMonthIndex(timestamp) {
    const d = new Date(timestamp);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  }

  /**
   * Decide session index for VWAP anchor mode
   * @param {number} ts
   * @param {number} mode  0=Daily, 1=Weekly, 2=Monthly
   */
  function sessionIndex(ts, mode) {
    if (mode === 1) return utcWeekIndex(ts);
    if (mode === 2) return utcMonthIndex(ts);
    return utcDayIndex(ts);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 3: INDICATOR REGISTRY
  // Central metadata store — UI auto-renders from this
  // ══════════════════════════════════════════════════════

  /**
   * @typedef {Object} IndicatorMeta
   * @property {string}   name
   * @property {string}   shortName
   * @property {string}   description
   * @property {string}   category   — 'trend'|'oscillator'|'volume'|'volatility'|'wave_alpha'
   * @property {boolean}  isStack    — true = overlay on price pane
   * @property {number[]} defaultParams
   * @property {string[]} paramLabels
   * @property {boolean}  builtIn    — true = KLineCharts built-in, no register needed
   */

  /** @type {IndicatorMeta[]} */
  const INDICATOR_REGISTRY = [
    // ── Wave Alpha Exclusives ──────────────────────────
    {
      name: 'VWAP_BANDS',
      shortName: 'VWAP',
      description: 'Đường trung bình giá theo khối lượng (VWAP) neo theo phiên kèm các Dải độ lệch',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [1, 2, 0],
      paramLabels: ['Hệ số Dải 1', 'Hệ số Dải 2', 'Neo (0=Ngày/1=Tuần/2=Tháng)'],
      builtIn: false,
    },
    {
      name: 'ANCHORED_VWAP',
      shortName: 'AVWAP',
      description: 'VWAP được neo từ một mốc thời gian cố định — hữu ích cho các điểm xoay chiều lớn',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [0],
      paramLabels: ['Thời điểm Neo (ms, 0=Tự động)'],
      builtIn: false,
    },
    {
      name: 'WAVE_PAC',
      shortName: 'Wave PAC',
      description: 'Hệ thống Kênh giá Wave (PAC & các đường MA)',
      category: 'wave_alpha',
      isStack: true, // Hiển thị đè lên nến (overlay)
      defaultParams: [34, 89, 200, 610],
      paramLabels: ['Chu kỳ PAC', 'Đường tín hiệu', 'EMA Chậm 1', 'EMA Chậm 2'],
      builtIn: false,
    },
    {
      name: 'WAVE_BOOKMAP',
      shortName: 'HEATMAP',
      description: 'Bản Đồ Nhiệt Thanh Khoản Lịch Sử',
      category: 'wave_alpha',
      isStack: true, 
      defaultParams: [0, 30, 0, 500, 0], 
      paramLabels: [
        'Lọc Rác (USD) [0 = Tự động AI]', 
        'Độ Mờ Nền (%)', 
        'Ngưỡng Đỏ Rực (USD) [0 = Tự động AI]',
        'Giới Hạn Lịch Sử (Tránh Lag)',
        'Độ Cao 1 Nấc Giá [0 = Tự động]'
      ],
      builtIn: false,
    },
    {
      name: 'WAVE_COB',
      shortName: 'COB',
      description: 'Tháp Thanh Khoản DOM v9.0 — Smart Liquidity (Cluster, Void, CVD)',
      category: 'wave_alpha',
      isStack: true,
      builtIn: false,
      // 19 Params: [Core 0-4], [UI/UX 5-9], [Colors 10-18]
      defaultParams: [
        120, 0, 4, 9995, 500,
        1, 1, 0, 2, 1,
        "#26A69A", "#EF5350",
        60, 75,
        "#FFF176", "#FF7043", "#26A69A", "#EF5350", "#FFD600"
      ],
      paramLabels: [
        'Độ Rộng Cột (px)',
        'Lọc Rác USD (0=Auto AI)',
        'Cao 1 Nấc Giá (px)',
        'Độ Lỳ (x/10000)',
        'Tốc Độ Vẽ (ms)',
        'Hiện CVD (0=Tắt,1=Bật)',
        'Highlight Cụm (0=Tắt,1=Bật)',
        'Highlight Vùng Void (0=Tắt,1=Bật)',
        'Vị Trí Panel (0=Trên,1=Dưới,2=Auto)',
        'Độ Chi Tiết (0=Gọn,1=Vừa,2=Đầy)',
        'Màu Lực Mua (Bid)',
        'Màu Lực Bán (Ask)',
        'Độ Mờ Nền Panel (0–90)',
        'Độ Mờ Glow S-Tier (60–100)',
        'Màu Highlight Cụm Tường',
        'Màu Vùng Trống (Void)',
        'Màu CVD Bull',
        'Màu CVD Bear',
        'Màu Absorption (Hấp thụ)',
      ],
    },
    
    {
      name: 'WAVE_VPVR',
      shortName: 'VPVR',
      description: 'Hồ Sơ Khối Lượng Giao Dịch (Volume Profile)',
      category: 'wave_alpha',
      isStack: true,
      builtIn: false,
      // Đã dời 2 tham số mới (10 và 1) xuống cuối cùng để không làm lệch UI Sub-text cũ
      defaultParams: [
        60, 70, 30, 0, 0, 0,
        "#26A69A", "#EF5350", "#F0B90B", "#9575CD",
        "#FFFFFF", "#FF9800", "#F0B90B", "#26A69A",
        80, 25, 2, 1, 0, 0, 10, 1,
        10, 1 // <-- (22) Số Phiên Lịch Sử, (23) Hiện Box
      ],
      paramLabels: [
        'Số Hàng - Bins (10–200)', 'Vùng Giá Trị VA % (10–100)', 'Độ Rộng % (10–80)',
        'Vị Trí (0=Phải, 1=Trái)', 'Chế Độ Phiên (0=Toàn màn, 1=Ngày, 2=Tuần)', 'VPVR Tổng Background (0=Tắt, 1=Bật)',
        'Màu Lực Mua', 'Màu Lực Bán', 'Màu Đường POC',
        'Màu Viền VAH/VAL', 'Màu Viền HVN', 'Màu Nền LVN',
        'Màu Đường nPOC', 'Màu Icon Mua (▲)',
        'Độ Mờ Vùng VA (%)', 'Độ Mờ Ngoài VA (%)',
        'Độ Dày POC (1-5)', 'Độ Dày VAH/VAL (1-4)',
        'Nét VA (0=Đứt, 1=Chấm, 2=Liền)', 'Nét nPOC (0=Đứt, 1=Chấm, 2=Dài)',
        'Cỡ Chữ (8-16)', 'Hiện Giá (0=Tắt, 1=Bật)',
        'Số Phiên Lịch Sử (1-50)', 'Hiển thị Viền/Nền Box (0=Tắt, 1=Bật)' // <-- Dời nhãn xuống cuối
      ],
    },

    {
      name: 'WAVE_TPO',
      shortName: 'TPO',
      description: 'Hồ Sơ Thời Giá SMART v5.1 (Khớp nối hoàn hảo)',
      category: 'wave_alpha',
      isStack: true,
      builtIn: false,
      // Đã nới rộng mảng thành 32 tham số (thêm số 50 ở cuối)
      defaultParams: [
        60, 70, 1, 0, 1, 0, 1, 1, 
        "#9C27B0", "#7B1FA2", "#F0B90B", "#FF9800", "#F0B90B",
        "#BA68C8", "#FFD600", "#FFD600", "#26A69A", "#EF5350",
        "#42A5F5", "#FF7043",
        85, 20, 2, 1, 0, 10, 1, 70, 8, 1, 30,
        50 
      ],
      paramLabels: [
        'Số Bins (10–200)', 'Value Area % (10–100)', 'Chế Độ Gộp (0=Cả Chart, 1=Ngày, 2=Tuần)', 
        'Vị Trí Neo (0=Trái, 1=Phải)', 
        'Hiển Thị (0=Block, 1=Letter)', 'Màu Phiên (0=Đơn,1=Đa,2=Nhiệt)', 'Mật Độ (0=Gọn,1=Cân Bằng)', 'Smart Labels (0=Tắt,1=Bật)',
        'Màu Block Trong VA', 'Màu Block Ngoài VA', 'Màu TPO POC', 'Màu Naked POC', 'Màu Super POC', 
        'Màu VAH / VAL', 'Màu IB High', 'Màu IB Low', 'Màu Lực Mua Áp Đảo', 'Màu Lực Bán Áp Đảo', 
        'Màu Acceptance', 'Màu Rejection',
        'Độ Mờ Trong VA (0-100)', 'Độ Mờ Ngoài VA (0-100)', 'Độ Dày POC (1-5)', 'Độ Dày VA (1-4)', 
        'Kiểu Nét VA (0=Đứt,1=Chấm,2=Liền)', 'Cỡ Chữ (8-16)', 'Hiện Nhãn TPO (0=Tắt,1=Bật)', 
        'Độ Mờ Phiên Cũ (0-100)', 'Kích Thước Chữ Min (6-12px)', 'Độ Chi Tiết Nhãn (0-2)', 'Số Phiên Tối Đa (1-100)',
        'Độ Rộng Khối % (10-100)' 
      ],
    },

    {
      name: 'SUPERTREND',
      shortName: 'ST',
      description: 'Chỉ báo xu hướng Supertrend dựa trên ATR — đổi màu theo xu hướng',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [10, 3.0],
      paramLabels: ['Chu kỳ ATR', 'Hệ số nhân'],
      builtIn: false,
    },
    {
      name: 'PIVOT_POINTS',
      shortName: 'PP',
      description: 'Các Điểm Xoay Cổ Điển — PP, R1/R2/R3, S1/S2/S3',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [0],
      paramLabels: ['Neo (0=Ngày/1=Tuần/2=Tháng)'],
      builtIn: false,
    },
    // ── Trend (Built-in) ──────────────────────────────
    {
      name: 'MA',
      shortName: 'MA',
      description: 'Đường Trung Bình Động Đơn Giản (SMA)',
      category: 'trend',
      isStack: true,
      defaultParams: [5, 10, 30],
      paramLabels: ['Chu kỳ 1', 'Chu kỳ 2', 'Chu kỳ 3'],
      builtIn: true,
    },
    {
      name: 'EMA',
      shortName: 'EMA',
      description: 'Đường Trung Bình Động Lũy Thừa — phản ứng với giá nhanh hơn SMA',
      category: 'trend',
      isStack: true,
      defaultParams: [9, 21, 55],
      paramLabels: ['Chu kỳ 1', 'Chu kỳ 2', 'Chu kỳ 3'],
      builtIn: true,
    },
    {
      name: 'BOLL',
      shortName: 'BOLL',
      description: 'Dải Bollinger (Bollinger Bands) — đo lường kênh giá và dải biến động',
      category: 'trend',
      isStack: true,
      defaultParams: [20, 2],
      paramLabels: ['Chu kỳ', 'Hệ số nhân'],
      builtIn: true,
    },
    // ── Oscillators ───────────────────────────────────
    {
      name: 'RSI',
      shortName: 'RSI',
      description: 'Chỉ số Sức mạnh Tương đối (RSI) — hiển thị 3 đường Nhanh/Vừa/Chậm',
      category: 'oscillator',
      isStack: false,
      defaultParams: [6, 12, 24], 
      paramLabels: ['RSI Nhanh', 'RSI Vừa', 'RSI Chậm'],
      builtIn: true,
    },
    {
      name: 'WAVE_ADVANCED_RSI',
      shortName: 'WAVE RSI',
      description: 'Chỉ số RSI Nâng cao (Có tích hợp Đường MA và Dải Bollinger)',
      category: 'wave_alpha',
      isStack: false,
      defaultParams: [14, 0, 14, 2.0, 1],
      paramLabels: ['Chu kỳ RSI', 'Loại MA (0=SMA,1=BB,2=EMA,3=RMA,4=WMA,5=VWMA)', 'Chu kỳ MA', 'Hệ số BB (StdDev)', 'Hiện Phân kỳ (1=Có, 0=Không)'],
      builtIn: false,
    },
    {
      name: 'MACD',
      shortName: 'MACD',
      description: 'Trung bình động Hội tụ Phân kỳ (MACD)',
      category: 'oscillator',
      isStack: false,
      defaultParams: [12, 26, 9],
      paramLabels: ['Chu kỳ Nhanh', 'Chu kỳ Chậm', 'Chu kỳ Tín hiệu'],
      builtIn: true,
    },
    {
      name: 'STOCH',
      shortName: 'STOCH',
      description: 'Dao động ngẫu nhiên (Stochastic) — %K và %D trong vùng 0-100',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14, 3, 3],
      paramLabels: ['Chu kỳ K', 'Chu kỳ D', 'Làm mượt'],
      builtIn: false,
    },
    {
      name: 'STOCH_RSI',
      shortName: 'StochRSI',
      description: 'Stochastic RSI — sự kết hợp giữa RSI và Stochastic',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14, 14, 3, 3],
      paramLabels: ['Độ dài RSI', 'Độ dài Stoch', 'K', 'D'],
      builtIn: false,
    },
    {
      name: 'CCI',
      shortName: 'CCI',
      description: 'Chỉ số Kênh Hàng hóa (CCI) — dùng để xác định điểm đảo chiều',
      category: 'oscillator',
      isStack: false,
      defaultParams: [20],
      paramLabels: ['Chu kỳ'],
      builtIn: false,
    },
    {
      name: 'WILLIAMS_R',
      shortName: '%R',
      description: 'Williams %R — đo lường mức độ quá mua/quá bán (thang đo từ -100 đến 0)',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14],
      paramLabels: ['Chu kỳ'],
      builtIn: false,
    },
    {
      name: 'MFI',
      shortName: 'MFI',
      description: 'Chỉ báo Dòng tiền (MFI) — tương tự RSI nhưng có tích hợp thêm khối lượng',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14],
      paramLabels: ['Chu kỳ'],
      builtIn: false,
    },
    {
      name: 'DPO',
      shortName: 'DPO',
      description: 'Dao động giá phi xu hướng (DPO) — loại bỏ xu hướng dài hạn để thấy chu kỳ ngắn',
      category: 'oscillator',
      isStack: false,
      defaultParams: [20],
      paramLabels: ['Chu kỳ'],
      builtIn: false,
    },
    // ── Volatility ────────────────────────────────────
    {
      name: 'ATR',
      shortName: 'ATR',
      description: 'Khoảng dao động thực tế trung bình (ATR) — dùng để đo lường biên độ biến động',
      category: 'volatility',
      isStack: false,
      defaultParams: [14],
      paramLabels: ['Chu kỳ'],
      builtIn: false,
    },
    {
      name: 'CHAIKIN_VOL',
      shortName: 'ChVol',
      description: 'Biến động Chaikin — đo lường tốc độ thay đổi của độ thu hẹp/mở rộng giá',
      category: 'volatility',
      isStack: false,
      defaultParams: [10, 10],
      paramLabels: ['Chu kỳ EMA', 'Chu kỳ Tốc độ thay đổi'],
      builtIn: false,
    },
    // ── Volume ────────────────────────────────────────
    {
      name: 'VOL',
      shortName: 'VOL',
      description: 'Thanh Khối lượng — thể hiện khối lượng giao dịch qua từng nến',
      category: 'volume',
      isStack: false,
      defaultParams: [],
      paramLabels: [],
      builtIn: true,
    },
    {
      name: 'OBV',
      shortName: 'OBV',
      description: 'Khối lượng Cân bằng (OBV) — giúp xác định xu hướng của dòng tiền',
      category: 'volume',
      isStack: false,
      defaultParams: [],
      paramLabels: [],
      builtIn: false,
    },
    {
      name: 'CMF',
      shortName: 'CMF',
      description: 'Dòng tiền Chaikin (CMF) — đo cường độ dòng tiền mua/bán dựa trên khối lượng',
      category: 'volume',
      isStack: false,
      defaultParams: [20],
      paramLabels: ['Chu kỳ'],
      builtIn: false,
    },
    {
      name: 'FORCE_INDEX',
      shortName: 'FI',
      description: 'Chỉ số Sức mạnh (Force Index) — xác định sức mạnh xu hướng dựa trên Giá × Khối lượng',
      category: 'volume',
      isStack: false,
      defaultParams: [13],
      paramLabels: ['Chu kỳ EMA'],
      builtIn: false,
    },
  ];

  // ══════════════════════════════════════════════════════
  // SECTION 4: REGISTER ALL INDICATORS
  // Only registers custom indicators (builtIn: false)
  // ══════════════════════════════════════════════════════

  global.registerWaveIndicators = function () {
    const kc = global.klinecharts;
    if (!kc || typeof kc.registerIndicator !== 'function') {
      console.warn('[Wave Alpha] klinecharts not ready — indicators not registered');
      return;
    }

    

// ─────────────────────────────────────────────────────────────────────────────
// ĐĂNG KÝ CHỈ BÁO WAVE_BOOKMAP (MASTER PRO)
// ─────────────────────────────────────────────────────────────────────────────
kc.registerIndicator({
  name: 'WAVE_BOOKMAP',
  shortName: 'HEATMAP',
  description: 'Bản đồ nhiệt lịch sử thanh khoản (Production Grade)',
  category: 'wave_alpha',
  series: 'price',
  isStack: true,
  builtIn: false,

  calcParams: [0, 30, 0, 500, 0],
  paramLabels: [
    'Lọc Rác (USD) [0 = Auto AI]',
    'Độ Mờ Nền (%)',
    'Ngưỡng Đỏ Rực (USD) [0 = Auto AI]',
    'Giới Hạn Lịch Sử',
    'Độ Cao 1 Nấc Giá [0 = Auto]'
  ],
  figures: [],

  calc: function(dataList) { return dataList.map(function() { return {}; }); },

  draw: function(args) {
    var ctx = args.ctx; var bounding = args.bounding; var xAxis = args.xAxis; var yAxis = args.yAxis; var indicator = args.indicator;
    var H = window._waHmap; var hp = H.helpers; var t0 = hp.now();

    if (!ctx || !bounding || !indicator) return false;
    hp.ensureMouseListener();
    ctx.save();

    try {
      var history = Array.isArray(window.bookmapHistory) ? window.bookmapHistory : [];
      var params = Array.isArray(indicator.calcParams) ? indicator.calcParams : [];

      // Dùng fallback an toàn (đề phòng user chưa Update Menu)
      var rawMinVolUSD = Number(params[0] !== undefined ? params[0] : 0);
      var opacityPct = hp.clamp(Number(params[1] !== undefined ? params[1] : 30), 5, 100);
      var opacityMul = opacityPct / 100;
      var rawRedThresh = Number(params[2] !== undefined ? params[2] : 0);
      var maxSnaps = hp.clamp(Number(params[3] !== undefined ? params[3] : 500), 50, 2000);
      var barMode = [0, 1, 2].indexOf(Number(params[4])) >= 0 ? Number(params[4]) : 0;

      var width = Math.max(1, Math.floor(bounding.width || 0));
      var height = Math.max(1, Math.floor(bounding.height || 0));
      var barSpace = hp.getBarSpace();

      // Ép dải màu chìm ĐẰNG SAU cây nến (Yêu cầu thiết yếu của Heatmap)
      ctx.globalCompositeOperation = 'destination-over'; 
      ctx.filter = 'none'; ctx.shadowBlur = 0;

      // GUARD: Nếu chưa có Data Camera thu thập lịch sử
      if (!history.length) {
        ctx.globalCompositeOperation = 'source-over'; // Chữ phải nổi lên trên
        hp.drawCenteredText(ctx, bounding, '📊 Đang thu thập dữ liệu heatmap (Vui lòng chờ vài giây)...', 'rgba(255,255,255,0.40)');
        H.stats.lastFrameMs = hp.now() - t0; return false;
      }

      var truncatedTotal = history.length;
      var limitedHistory = history.length > maxSnaps ? history.slice(history.length - maxSnaps) : history;
      var visibleRange = hp.getVisibleTimeRange(bounding, xAxis);
      var visibleHistory = hp.sliceVisibleHistory(limitedHistory, visibleRange);

      // 🚀 AUTO-AI THRESHOLDS
      var currentScreenMax = 0;
      if (rawMinVolUSD === 0 || rawRedThresh === 0) {
        for (var idx = 0; idx < visibleHistory.length; idx++) {
          var s = visibleHistory[idx];
          hp.iterateBookSide(s.asks, function(pStr, v) { var usd = parseFloat(pStr) * v; if (usd > currentScreenMax) currentScreenMax = usd; });
          hp.iterateBookSide(s.bids, function(pStr, v) { var usd = parseFloat(pStr) * v; if (usd > currentScreenMax) currentScreenMax = usd; });
        }
      }

      var minVolUSD = rawMinVolUSD > 0 ? rawMinVolUSD : Math.max(500, currentScreenMax * 0.015);
      var redThreshold = rawRedThresh > 0 ? rawRedThresh : Math.max(10000, currentScreenMax * 0.8);

      hp.rebuildLut(opacityMul);

      var cacheKey = [
        limitedHistory.length,
        limitedHistory.length ? limitedHistory[0].t : 0,
        limitedHistory.length ? limitedHistory[limitedHistory.length - 1].t : 0,
        minVolUSD.toFixed(0), opacityPct, redThreshold.toFixed(0), maxSnaps, barMode,
        width + 'x' + height, visibleRange.key, barSpace.toFixed(2)
      ].join('_');

      var offscreen = hp.ensureOffscreen(width, height);
      var offctx = offscreen.getContext('2d');

      if (H.cache.valid && H.cache.key === cacheKey && H.cache.offscreen) {
        ctx.drawImage(H.cache.offscreen, 0, 0);
        H.stats.cacheHits += 1;
      } else {
        H.cache.key = cacheKey; H.cache.valid = true; H.cache.lastRender = Date.now();
        H.cache.meta.columns = []; H.cache.meta.truncatedTotal = truncatedTotal; H.cache.meta.showingCount = limitedHistory.length; H.cache.meta.warnings = [];

        offctx.save(); offctx.clearRect(0, 0, width, height);
        // Offscreen vẽ đè lên nhau bình thường, sau đó toàn bộ cục Offscreen sẽ chìm dưới nến trên Main ctx
        offctx.globalCompositeOperation = opacityPct > 50 ? 'screen' : 'source-over';
        offctx.filter = 'none'; offctx.shadowBlur = 0; offctx.imageSmoothingEnabled = false;

        if (barSpace < 2) {
          offctx.globalCompositeOperation = 'source-over';
          hp.drawCenteredText(offctx, bounding, 'Phóng to (Zoom In) để xem chi tiết Heatmap', 'rgba(255,255,255,0.42)');
          offctx.restore(); ctx.drawImage(H.cache.offscreen, 0, 0); return false;
        }

        var mergeCount = 1, barHeight = 4;
        if (barMode === 1) barHeight = 3; else if (barMode === 2) barHeight = 5;
        else {
          if (barSpace >= 2 && barSpace <= 5) { mergeCount = 3; barHeight = 3; } 
          else if (barSpace > 5 && barSpace <= 15) barHeight = 4; else if (barSpace > 15) barHeight = 6;
        }

        var renderGroups = hp.buildRenderGroups(visibleHistory, mergeCount);
        var rectCount = 0, majorWalls = [], clusterSeedLevels = [], verticalLines = [];

        hp.resetBuckets();

        for (var i = 0; i < renderGroups.length; i++) {
          var snap = renderGroups[i];
          var x = hp.getXForTimestamp(snap.t, xAxis);
          if (x == null || isNaN(x)) continue;

          var drawWidth = hp.clamp(barSpace * mergeCount - 1, 1, 40);
          if (x < -drawWidth || x > width + drawWidth) continue;
          if (barSpace > 8) verticalLines.push(x);

          H.cache.meta.columns.push({ x: x, w: drawWidth, snap: snap });

          function processSide(side, isAsk) {
            hp.iterateBookSide(side, function(priceStr, vol) {
              var price = parseFloat(priceStr), volume = Number(vol || 0);
              if (!isFinite(price) || !isFinite(volume) || volume <= 0) return;
              var valUSD = price * volume;
              if (valUSD < minVolUSD) return;
              var y = hp.getYForPrice(price, yAxis);
              if (y == null || y < -10 || y > height + 10) return;

              var idx = hp.getBucketIndex(valUSD, redThreshold);
              var bucket = idx >> 4;
              var x0 = x - drawWidth * 0.5, y0 = y - barHeight * 0.5;

              if (isAsk) H.pools.askBuckets[bucket].rect(x0, y0, drawWidth, barHeight);
              else H.pools.bidBuckets[bucket].rect(x0, y0, drawWidth, barHeight);

              rectCount++;
              if (valUSD > redThreshold) {
                clusterSeedLevels.push({ side: isAsk ? 'ask' : 'bid', x: x, w: drawWidth, y: y, h: barHeight, valUSD: valUSD });
                if (isAsk) H.pools.askGlowBuckets[bucket].rect(x0, y0, drawWidth, barHeight);
                else H.pools.bidGlowBuckets[bucket].rect(x0, y0, drawWidth, barHeight);
              }
              if (valUSD > redThreshold * 2) {
                majorWalls.push({ side: isAsk ? 'ask' : 'bid', x: x, y: y, w: drawWidth, h: barHeight, valUSD: valUSD });
              }
            });
          }
          processSide(snap.asks, true); processSide(snap.bids, false);
        }

        // BATCH DRAWING: Glow Layer First
        offctx.save(); offctx.filter = 'blur(2px)';
        for (var g1 = 0; g1 < 16; g1++) {
          offctx.fillStyle = H.lut.askGlowBuckets16[g1]; offctx.fill(H.pools.askGlowBuckets[g1]);
          offctx.fillStyle = H.lut.bidGlowBuckets16[g1]; offctx.fill(H.pools.bidGlowBuckets[g1]);
        }
        offctx.restore();

        // BATCH DRAWING: Main Heatmap Layer
        for (var g2 = 0; g2 < 16; g2++) {
          offctx.fillStyle = H.lut.askBuckets16[g2]; offctx.fill(H.pools.askBuckets[g2]);
          offctx.fillStyle = H.lut.bidBuckets16[g2]; offctx.fill(H.pools.bidBuckets[g2]);
        }

        if (barSpace > 8 && verticalLines.length) {
          offctx.save(); offctx.beginPath();
          for (var vl = 0; vl < verticalLines.length; vl++) {
            var xx = Math.round(verticalLines[vl]) + 0.5;
            offctx.moveTo(xx, 0); offctx.lineTo(xx, height);
          }
          offctx.strokeStyle = 'rgba(255,255,255,0.03)'; offctx.lineWidth = 1; offctx.stroke(); offctx.restore();
        }

        if (majorWalls.length) {
          offctx.save(); offctx.lineWidth = 1;
          for (var mw = 0; mw < majorWalls.length; mw++) {
            var wall = majorWalls[mw];
            offctx.strokeStyle = wall.side === 'ask' ? 'rgba(255,170,140,0.85)' : 'rgba(160,255,220,0.85)';
            offctx.beginPath(); offctx.moveTo(wall.x - wall.w * 0.5, wall.y + 0.5); offctx.lineTo(wall.x + wall.w * 0.5, wall.y + 0.5); offctx.stroke();
          }
          offctx.restore();
          hp.drawMajorWallClusters(offctx, majorWalls);
        }

        if (clusterSeedLevels.length) {
          var mergedClusters = hp.mergeLevelsIntoClusters(clusterSeedLevels, 5);
          hp.drawMergedClusters(offctx, mergedClusters, barSpace);
        }

        if (visibleHistory.length === 0) {
          offctx.globalCompositeOperation = 'source-over';
          hp.drawCenteredText(offctx, bounding, 'Không có dữ liệu trong khu vực hiển thị', 'rgba(255,255,255,0.32)');
        }

        offctx.restore();
        
        // 🚀 IN RA MÀN HÌNH CHÍNH (Sẽ bị ép chìm dưới nến nhờ destination-over ở trên)
        ctx.drawImage(H.cache.offscreen, 0, 0);
        H.stats.lastFrameRects = rectCount;
      }

      // VẼ HOVER TOOLTIP KHI RÀ CHUỘT
      var mouse = hp.getMouseLocal(ctx.canvas);
      if (mouse && mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height) {
        var col = hp.findNearestColumn(H.cache.meta.columns, mouse.x);
        if (col) {
          ctx.save();
          // Hover box và tooltip phải NỔI LÊN TRÊN cây nến
          ctx.globalCompositeOperation = 'source-over'; 
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(col.x - col.w * 0.5, 0, col.w, height);

          var info = hp.getNearestLevelInfo(col.snap, mouse.y, yAxis);
          hp.drawTooltip(ctx, bounding, mouse, info, redThreshold);
          ctx.restore();
        }
      }

      H.stats.lastFrameMs = hp.now() - t0;
      return false;
    } catch (err) {
      hp.safeWarn(err);
      return false;
    } finally {
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  },

  destroy: function() {
    if (window._waHmap && window._waHmap.helpers) window._waHmap.helpers.removeMouseListener();
    window._waHmap = null;
  }
});


// ── Global State (Khởi tạo 1 lần duy nhất) ──
if (!window._waCob9) {
  window._waCob9 = {
    // Data layer
    snapshot: { asks: new Map(), bids: new Map(), ts: 0 },
    barCache: new Map(), 
    
    // Memory Pools (Tránh GC Pause)
    pools: {
      yMapAsks: new Map(),
      yMapBids: new Map(),
      animAsks: new Map(),
      animBids: new Map(),
      toDelete: []
    },

    // Analytics
    scale: { maxVol: 0 },
    stats: { bidTotal: 0, askTotal: 0, ratio: 1 },
    absorption: new Map(),
    cvd: 0,
    cvdHistory: [],
    clusters: { bid: [], ask: [] },
    voids: { bid: [], ask: [] },

    // UX State
    hover: { y: -1 },
    _cleanup: null
  };
}

// ── Helpers nội bộ (Pure Functions) ──
const _waCobUtils = {
  roundRect: function(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    } else {
      r = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.arcTo(x, y + h, x, y + h - r, r); ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }
  },
  parseColor: function(val, alpha) {
    if (val === 'transparent') return 'rgba(0,0,0,0)';
    let hex = String(val).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  },
  fmt: function(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return Math.round(v / 1e3) + 'K';
    return Math.round(v).toString();
  },
  clamp: function(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); },
  
  detectClusters: function(map, barH, minVal) {
    const sorted = [];
    map.forEach((v, y) => { if (v >= minVal * 2) sorted.push({ y, v }); });
    sorted.sort((a, b) => a.y - b.y);
    const clusters = [];
    let cur = null;
    for (let i = 0; i < sorted.length; i++) {
      const bar = sorted[i];
      if (cur && bar.y - cur.yEnd <= barH * 2) {
        cur.yEnd = bar.y + barH; cur.total += bar.v; cur.count++;
      } else {
        if (cur) clusters.push(cur);
        cur = { yStart: bar.y, yEnd: bar.y + barH, total: bar.v, count: 1 };
      }
    }
    if (cur) clusters.push(cur);
    return clusters.filter(c => c.count >= 2);
  },

  detectVoids: function(map, barH, yMin, yMax) {
    const occupied = new Set();
    map.forEach((v, y) => occupied.add(Math.floor(y / barH)));
    const voids = [];
    let start = null;
    const binMin = Math.floor(yMin / barH);
    const binMax = Math.ceil(yMax / barH);
    for (let b = binMin; b <= binMax; b++) {
      if (!occupied.has(b)) { if (start == null) start = b; } 
      else {
        if (start != null && b - start >= 3) voids.push({ yStart: start * barH, yEnd: b * barH });
        start = null;
      }
    }
    return voids;
  },

  getTopTiers: function(map) {
    const arr = [];
    map.forEach((v, y) => arr.push([y, v]));
    arr.sort((a, b) => b[1] - a[1]);
    return {
      s: new Set(arr.slice(0, 1).map(x => x[0])),
      a: new Set(arr.slice(1, 3).map(x => x[0])),
      b: new Set(arr.slice(3, 6).map(x => x[0])),
    };
  }
};

// ── Bind Mouse Event (Chỉ gắn 1 lần) ──
(function _waCobBindMouse() {
  if (window._waCob9 && window._waCob9._cleanup) return; 
  const handler = (e) => {
    const canvas = document.querySelector('#tv-chart-container canvas') || document.querySelector('canvas');
    if (!canvas || !window._waCob9) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    window._waCob9.hover.y = (e.clientY - rect.top) * scaleY;
  };
  window.addEventListener('mousemove', handler, { passive: true });
  if (window._waCob9) window._waCob9._cleanup = () => window.removeEventListener('mousemove', handler);
})();

// ── Đăng Ký Indicator ──
kc.registerIndicator({
  name: 'WAVE_COB',
  shortName: 'COB',
  description: 'Tháp Thanh Khoản DOM v9.0',
  category: 'wave_alpha',
  series: 'price',
  isStack: true,

  calcParams: [
    120, 0, 4, 9995, 500,
    1, 1, 1, 2, 1,
    "#26A69A", "#EF5350",
    60, 75,
    "#FFF176", "#FF7043", "#26A69A", "#EF5350", "#FFD600"
  ],
  figures: [],

  calc: function(dataList) { return dataList.map(() => ({})); },

  draw: function({ ctx, bounding, yAxis, indicator }) {
    if (!window.scLocalOrderBook) return false;
    if (!bounding || bounding.width < 10) return false;

    const p = indicator.calcParams;
    const cob = window._waCob9;
    const U = _waCobUtils;
    const now = Date.now();

    // 1. Parsing Params
    const colWidth = U.clamp(+(p[0] ?? 120), 60, 400);
    let minValRaw = +(p[1] ?? 0); if (isNaN(minValRaw) || minValRaw < 0) minValRaw = 0;
    const barH = U.clamp(+(p[2] ?? 4), 2, 10);
    const decay = U.clamp(+(p[3] ?? 9995), 9900, 9999) / 10000;
    const refreshMs = U.clamp(+(p[4] ?? 500), 50, 2000);
    const showCVD = +(p[5] ?? 1) === 1;
    const showClusters = +(p[6] ?? 1) === 1;
    const showVoids = +(p[7] ?? 1) === 1;
    const panelPos = Math.round(U.clamp(+(p[8] ?? 2), 0, 2));
    const verbosity = Math.round(U.clamp(+(p[9] ?? 1), 0, 2));

    const bidClr = p[10] || "#26A69A";
    const askClr = p[11] || "#EF5350";
    const panelAlpha = U.clamp(+(p[12] ?? 60), 0, 90) / 100;
    const glowAlpha = U.clamp(+(p[13] ?? 75), 60, 100) / 100;
    const clusterClr = p[14] || "#FFF176";
    const voidClr = p[15] || "#FF7043";
    const cvdBullClr = p[16] || "#26A69A";
    const cvdBearClr = p[17] || "#EF5350";
    const absorpClr = p[18] || "#FFD600";

    // 2. Data Fetching & Throttling
    if (now - cob.snapshot.ts >= refreshMs) {
      const rawAsks = window.scLocalOrderBook.asks;
      const rawBids = window.scLocalOrderBook.bids;
      if ((rawAsks && rawAsks.size > 0) || (rawBids && rawBids.size > 0)) {
        cob.snapshot.asks = new Map(rawAsks || []);
        cob.snapshot.bids = new Map(rawBids || []);
        cob.snapshot.ts = now;
      } else if (now - cob.snapshot.ts > 2000) {
        cob.snapshot.ts = now;
      }
    }

    const asks = cob.snapshot.asks;
    const bids = cob.snapshot.bids;

    // 3. Geometry & Reset Pools
    const H = bounding.height;
    const W = bounding.width;
    const startX = W - colWidth;
    const OVERFLOW = Math.max(barH * 2, 20);

    const yMapAsks = cob.pools.yMapAsks; yMapAsks.clear();
    const yMapBids = cob.pools.yMapBids; yMapBids.clear();
    let currentMax = 0, bidTotal = 0, askTotal = 0;
    
    // Auto Filter
    const effectiveMin = minValRaw === 0 ? Math.max(500, cob.scale.maxVol * 0.015) : minValRaw;

    const processBook = (source, target, isAsk) => {
      source.forEach((vol, priceStr) => {
        const price = parseFloat(priceStr);
        const valUSD = price * vol;
        if (valUSD < effectiveMin) return;

        const exactY = yAxis.convertToPixel(price);
        if (exactY == null || isNaN(exactY) || exactY < -OVERFLOW || exactY > H + OVERFLOW) return;

        const snapY = Math.floor(exactY / barH) * barH;
        const merged = (target.get(snapY) || 0) + valUSD;
        target.set(snapY, merged);
        if (merged > currentMax) currentMax = merged;
        if (isAsk) askTotal += valUSD; else bidTotal += valUSD;
      });
    };

    if (asks) processBook(asks, yMapAsks, true);
    if (bids) processBook(bids, yMapBids, false);

    if (yMapAsks.size === 0 && yMapBids.size === 0 && cob.scale.maxVol === 0) return false;

    // 4. Scale Ratchet
    if (currentMax > 0) {
      if (currentMax > cob.scale.maxVol) cob.scale.maxVol = currentMax;
      else cob.scale.maxVol = cob.scale.maxVol * decay + currentMax * (1 - decay);
    }
    const renderMax = Math.max(cob.scale.maxVol || 10000, 10000);

    // 5. Animation Lerp
    cob.barCache.forEach(b => { b.tgt = 0; });
    
    const applyTgt = (val, y, type) => {
      const b = cob.barCache.get(y);
      if (!b) cob.barCache.set(y, { cur: 0, tgt: val, type: type });
      else { b.tgt = val; b.type = type; }
    };
    yMapAsks.forEach((v, y) => applyTgt(v, y, 'ask'));
    yMapBids.forEach((v, y) => applyTgt(v, y, 'bid'));

    const animAsks = cob.pools.animAsks; animAsks.clear();
    const animBids = cob.pools.animBids; animBids.clear();
    const toDel = cob.pools.toDelete; toDel.length = 0;

    cob.barCache.forEach((b, y) => {
      b.cur += (b.tgt - b.cur) * 0.22; // Lerp mượt
      if (b.tgt === 0 && b.cur < effectiveMin * 0.5) { toDel.push(y); return; }
      (b.type === 'ask' ? animAsks : animBids).set(y, b.cur);
    });
    for(let i = 0; i < toDel.length; i++) cob.barCache.delete(toDel[i]);

    // 6. Analytics (Stats, Absorption, Clusters)
    cob.stats.bidTotal = bidTotal;
    cob.stats.askTotal = askTotal;
    cob.stats.ratio = askTotal > 0 ? bidTotal / askTotal : 1;

    const delta = bidTotal - askTotal;
    cob.cvd = (cob.cvd || 0) * 0.95 + delta * 0.05;
    if (cob.cvdHistory.length > 60) cob.cvdHistory.shift();
    cob.cvdHistory.push(delta);

    if (showClusters) {
      cob.clusters.ask = U.detectClusters(yMapAsks, barH, effectiveMin);
      cob.clusters.bid = U.detectClusters(yMapBids, barH, effectiveMin);
    }
    if (showVoids && H > 0) {
      cob.voids.ask = U.detectVoids(yMapAsks, barH, 0, H);
      cob.voids.bid = U.detectVoids(yMapBids, barH, 0, H);
    }

    // Absorption Detection
    const processAbs = (map, type) => {
      map.forEach((vol, y) => {
        const key = type + '_' + y;
        const prev = cob.absorption.get(key);
        if (!prev) cob.absorption.set(key, { peak: vol, cur: vol, absorbing: false });
        else {
          prev.cur = vol;
          if (vol < prev.peak * 0.55 && vol >= effectiveMin) prev.absorbing = true;
          if (vol > prev.peak) prev.peak = vol;
        }
      });
    };
    processAbs(yMapAsks, 'ask');
    processAbs(yMapBids, 'bid');
    
    const absDel = [];
    cob.absorption.forEach((v, k) => { if (v.cur < effectiveMin) absDel.push(k); });
    for(let i=0; i<absDel.length; i++) cob.absorption.delete(absDel[i]);

    const imbalScore = (bidTotal + askTotal) === 0 ? 0 : ((bidTotal - askTotal) / (bidTotal + askTotal));
    const tiersAsk = U.getTopTiers(animAsks);
    const tiersBid = U.getTopTiers(animBids);

    // ==========================================
    // 7. RENDER LAYER
    // ==========================================
    try {
      ctx.save();
      
      // Separator
      const sep = ctx.createLinearGradient(startX, 0, startX + 1, H);
      sep.addColorStop(0, 'rgba(255,255,255,0.03)');
      sep.addColorStop(0.5, 'rgba(255,255,255,0.07)');
      sep.addColorStop(1, 'rgba(255,255,255,0.03)');
      ctx.fillStyle = sep;
      ctx.fillRect(startX, 0, 1, H);

      // Voids
      if (showVoids) {
        const drawVoids = (voids) => {
          voids.forEach(v => {
            ctx.fillStyle = U.parseColor(voidClr, 0.06);
            ctx.fillRect(startX, v.yStart, colWidth, v.yEnd - v.yStart);
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = U.parseColor(voidClr, 0.35);
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(startX, v.yStart); ctx.lineTo(W, v.yStart); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(startX, v.yEnd); ctx.lineTo(W, v.yEnd); ctx.stroke();
            ctx.setLineDash([]);
          });
        };
        drawVoids(cob.voids.ask); drawVoids(cob.voids.bid);
      }

      // Clusters
      if (showClusters) {
        const drawClusters = (clusters) => {
          clusters.forEach(c => {
            ctx.fillStyle = U.parseColor(clusterClr, 0.06);
            ctx.fillRect(startX, c.yStart, colWidth, c.yEnd - c.yStart);
          });
        };
        drawClusters(cob.clusters.ask); drawClusters(cob.clusters.bid);
      }

      // Bars
      const hoverY = cob.hover.y;
      const MAX_BARS = 600;
      
      const renderBars = (map, baseClr, tiers) => {
        let count = 0;
        map.forEach((valUSD, y) => {
          if (count++ >= MAX_BARS) return;
          const pct = valUSD / renderMax;
          const w = Math.round(pct * colWidth);
          if (w < 1) return;

          const x = W - w;
          const isS = tiers.s.has(y); const isA = tiers.a.has(y);
          const isHov = hoverY >= y && hoverY < y + barH;

          let alpha = 0.18 + pct * 0.67;
          if (isS) alpha = Math.min(1, glowAlpha + 0.08);
          else if (isA) alpha = Math.min(0.92, alpha + 0.10);
          if (isHov) alpha = Math.min(1, alpha + 0.18);

          if (w > 3) {
            const grad = ctx.createLinearGradient(x, 0, x + w, 0);
            grad.addColorStop(0, U.parseColor(baseClr, alpha * 0.3));
            grad.addColorStop(1, U.parseColor(baseClr, alpha));
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = U.parseColor(baseClr, alpha);
          }
          ctx.fillRect(x, y, w, barH - 1);

          if (isS) {
            const gx = ctx.createLinearGradient(W - 3, y, W, y + barH);
            gx.addColorStop(0, U.parseColor(baseClr, 0));
            gx.addColorStop(1, U.parseColor(baseClr, glowAlpha));
            ctx.fillStyle = gx;
            ctx.fillRect(W - 3, y, 3, barH - 1);
          }

          const absKey = (tiers === tiersAsk ? 'ask' : 'bid') + '_' + y;
          const absState = cob.absorption.get(absKey);
          if (absState && absState.absorbing) {
            ctx.fillStyle = U.parseColor(absorpClr, 0.65);
            ctx.fillRect(W - 4, y, 4, barH - 1);
          }
        });
      };

      renderBars(animAsks, askClr, tiersAsk);
      renderBars(animBids, bidClr, tiersBid);

      // Labels & Data
      if (verbosity >= 1) {
        ctx.font = `bold ${Math.max(8, barH + 2)}px system-ui,sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 3; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;

        const threshold = verbosity === 2 ? 0.18 : 0.30;
        const drawLabels = (map, baseClr, tiers) => {
          ctx.textAlign = 'right';
          map.forEach((valUSD, y) => {
            const pct = valUSD / renderMax;
            if (pct < threshold) return;
            const w = Math.round(pct * colWidth);
            ctx.fillStyle = tiers.s.has(y) ? '#FFFFFF' : U.parseColor(baseClr, 0.95);
            ctx.fillText(U.fmt(valUSD), W - w - 3, y + barH / 2);
          });
        };

        drawLabels(animAsks, askClr, tiersAsk);
        drawLabels(animBids, bidClr, tiersBid);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        
        if (showClusters) {
          ctx.textAlign = 'left';
          ctx.font = `bold ${Math.max(8, barH + 1)}px system-ui,sans-serif`;
          const drawClusterLabels = (clusters, clr) => {
            clusters.forEach(c => {
              ctx.fillStyle = U.parseColor(clusterClr, 0.9);
              ctx.fillText('▌' + U.fmt(c.total), startX + 2, (c.yStart + c.yEnd) / 2);
            });
          };
          drawClusterLabels(cob.clusters.ask, askClr);
          drawClusterLabels(cob.clusters.bid, bidClr);
        }
      }

      // 8. Info Panel
      {
        const panelW = colWidth - 4;
        const baseH = verbosity === 0 ? 36 : verbosity === 1 ? 52 : 68;
        const cvdH = showCVD ? 28 : 0;
        const panelH = baseH + cvdH;
        const panelX = startX + 2;

        let panelY = panelPos === 0 ? 6 : (panelPos === 1 ? H - panelH - 6 : ((H / 2 > panelH + 12) ? 6 : H - panelH - 6));

        ctx.fillStyle = `rgba(8,8,12,${panelAlpha})`;
        U.roundRect(ctx, panelX, panelY, panelW, panelH, 4);
        ctx.fill();

        const borderClr = imbalScore > 0.08 ? bidClr : imbalScore < -0.08 ? askClr : "#787878";
        ctx.strokeStyle = U.parseColor(borderClr, 0.25);
        ctx.lineWidth = 1;
        U.roundRect(ctx, panelX, panelY, panelW, panelH, 4);
        ctx.stroke();

        const lx = panelX + 5, lx2 = panelX + panelW * 0.52;
        const lh = verbosity === 0 ? 15 : 13;
        let ly = panelY + lh - 1;

        ctx.textBaseline = 'middle';
        ctx.font = `9px system-ui,sans-serif`;

        const ratio = cob.stats.ratio;
        const ratioClr = ratio > 1.2 ? U.parseColor(bidClr, 1) : ratio < 0.8 ? U.parseColor(askClr, 1) : '#9E9E9E';
        const ratioIcon = ratio > 1.2 ? '▲' : ratio < 0.8 ? '▼' : '─';

        if (verbosity >= 1) {
          ctx.textAlign = 'left';
          ctx.fillStyle = U.parseColor(bidClr, 0.9); ctx.fillText('LỰC MUA', lx, ly);
          ctx.fillStyle = '#E0E0E0'; ctx.fillText('$' + U.fmt(cob.stats.bidTotal), lx2, ly); ly += lh;
          ctx.fillStyle = U.parseColor(askClr, 0.9); ctx.fillText('LỰC BÁN', lx, ly);
          ctx.fillStyle = '#E0E0E0'; ctx.fillText('$' + U.fmt(cob.stats.askTotal), lx2, ly); ly += lh;
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = '#757575'; ctx.fillText('TỶ LỆ', lx, ly);
        ctx.fillStyle = ratioClr; ctx.fillText(ratio.toFixed(2) + ' ' + ratioIcon, lx2, ly); ly += lh;

        if (verbosity >= 2) {
          ctx.fillStyle = '#616161'; ctx.fillText('IMBLN', lx, ly);
          const scoreW = Math.round(Math.abs(imbalScore) * (panelW - 60));
          ctx.fillStyle = U.parseColor(imbalScore >= 0 ? bidClr : askClr, 0.75);
          ctx.fillRect(lx2, ly - 4, scoreW, 8); ly += lh;

          let absorpCount = 0;
          cob.absorption.forEach(v => { if (v.absorbing) absorpCount++; });
          if (absorpCount > 0) {
            ctx.fillStyle = U.parseColor(absorpClr, 0.9);
            ctx.fillText(`⟳ ABSORB ×${absorpCount}`, lx, ly); ly += lh;
          }
        }

        // CVD Sparkline
        if (showCVD && cob.cvdHistory.length > 1) {
          const cvdY0 = ly + 4, cvdH2 = cvdH - 6, cvdW = panelW - 10, cvdX0 = panelX + 5;
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(cvdX0, cvdY0 + cvdH2 / 2); ctx.lineTo(cvdX0 + cvdW, cvdY0 + cvdH2 / 2); ctx.stroke();
          ctx.setLineDash([]);

          const hist = cob.cvdHistory;
          const maxAbs = Math.max(...hist.map(Math.abs), 1);
          ctx.beginPath();
          hist.forEach((v, i) => {
            const hx = cvdX0 + (i / (hist.length - 1)) * cvdW;
            const hy = cvdY0 + cvdH2 / 2 - (v / maxAbs) * (cvdH2 / 2);
            if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
          });
          const lastDelta = hist[hist.length - 1];
          ctx.strokeStyle = lastDelta >= 0 ? U.parseColor(cvdBullClr, 0.8) : U.parseColor(cvdBearClr, 0.8);
          ctx.lineWidth = 1.5; ctx.stroke();

          if (verbosity >= 1) {
            ctx.font = `8px system-ui,sans-serif`; ctx.textAlign = 'right';
            ctx.fillStyle = lastDelta >= 0 ? U.parseColor(cvdBullClr, 0.9) : U.parseColor(cvdBearClr, 0.9);
            ctx.fillText('CVD ' + (lastDelta >= 0 ? '+' : '') + U.fmt(lastDelta), cvdX0 + cvdW, cvdY0 + 8);
          }
        }
      }

      // 9. Tooltip Hover
      if (hoverY >= 0 && hoverY <= H) {
        const snapY = Math.floor(hoverY / barH) * barH;
        const askVol = yMapAsks.get(snapY), bidVol = yMapBids.get(snapY);
        const vol = askVol || bidVol;
        
        if (vol) {
          const side = askVol ? 'TƯỜNG BÁN' : 'TƯỜNG MUA';
          const baseClr = askVol ? askClr : bidClr;
          const price = yAxis.convertFromPixel ? yAxis.convertFromPixel(snapY) : null;
          const pct = ((vol / renderMax) * 100).toFixed(1);
          const absState = cob.absorption.get((askVol ? 'ask' : 'bid') + '_' + snapY);

          const tipW = verbosity >= 2 ? 155 : 135;
          const tipH = verbosity >= 2 ? 56 : (verbosity === 1 ? 44 : 32);
          const tipX = startX - tipW - 8;
          const tipY = U.clamp(snapY - tipH / 2, 4, H - tipH - 4);

          ctx.fillStyle = 'rgba(0,0,0,0.82)';
          U.roundRect(ctx, tipX, tipY, tipW, tipH, 5); ctx.fill();
          ctx.strokeStyle = U.parseColor(baseClr, 0.55);
          ctx.lineWidth = 1;
          U.roundRect(ctx, tipX, tipY, tipW, tipH, 5); ctx.stroke();

          ctx.font = `bold 9px system-ui,sans-serif`;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          let ty = tipY + 11; const lh = 11;

          ctx.fillStyle = U.parseColor(baseClr, 1);
          ctx.fillText(side, tipX + 6, ty); ty += lh;

          if (verbosity >= 1 && price != null && !isNaN(price)) {
            ctx.fillStyle = '#BDBDBD';
            ctx.fillText('Giá: ' + price.toLocaleString('en-US', { maximumFractionDigits: 2 }), tipX + 6, ty); ty += lh;
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillText('$' + U.fmt(vol) + ' (' + pct + '%)', tipX + 6, ty);

          if (verbosity >= 2 && absState && absState.absorbing) {
            ty += lh;
            ctx.fillStyle = U.parseColor(absorpClr, 0.92);
            ctx.fillText('⟳ Đang bị hấp thụ', tipX + 6, ty);
          }
        }
      }

    } catch (err) {
      console.error('[WAVE_COB v9]', err);
    } finally {
      ctx.restore();
    }
    return false;
  },

  destroy: function() {
    if (window._waCob9 && window._waCob9._cleanup) {
      window._waCob9._cleanup();
      window._waCob9._cleanup = null;
    }
    window._waCob9 = null;
  }
});

// ── Preset API ──
window.WA_COB_PRESET = function(preset, chartInstance, paneId) {
  const PRESETS = {
    dark: [120,0,4,9995,500,1,1,0,2,1,"#26A69A","#EF5350",60,75,"#FFF176","#FF7043","#26A69A","#EF5350","#FFD600"],
    classic: [120,0,4,9995,500,1,1,0,2,1,"#1976D2","#F44336",65,80,"#FFEB3B","#FF5722","#1976D2","#F44336","#FFC107"],
    bookmap: [140,0,5,9990,250,1,1,0,0,2,"#00BFA5","#E53935",55,90,"#F9A825","#DD2C00","#00BFA5","#E53935","#FFEA00"],
    mono: [100,0,3,9998,500,0,0,0,2,0,"#90A4AE","#78909C",50,70,"#EEEEEE","#BDBDBD","#90A4AE","#78909C","#E0E0E0"],
  };
  const params = PRESETS[preset];
  if (!params) { console.warn('[WAVE_COB] Invalid preset. Use: dark | classic | bookmap | mono'); return; }
  
  if (window._waCob9) {
    window._waCob9.scale.maxVol = 0; window._waCob9.barCache.clear();
    window._waCob9.absorption.clear(); window._waCob9.cvdHistory = [];
  }
  
  if (chartInstance && paneId !== undefined) {
    try { chartInstance.overrideIndicator({ name: 'WAVE_COB', calcParams: params }, paneId); } 
    catch (e) { console.error(e); }
  }
};
console.log('%c[WAVE_COB v9.0]%c Loaded ✅ (Engine Optimized)', 'color:#26A69A;font-weight:bold', 'color:#ccc');


// ════════ BƯỚC 2: Thay thế toàn bộ cụm WAVE_VPVR ULTIMATE cũ bằng v3.5 này ════════
// ════════════════════════════════════════════════════════════════════════════════
//  WAVE_VPVR ULTIMATE v3.5 — CORE ENGINE (Fix UI Index Shift & Smart Anchoring)
// ════════════════════════════════════════════════════════════════════════════════
(function initWaveVpvrCore() {
  'use strict';

  if (!window._waVpvrCache) window._waVpvrCache = new Map();

  function _waVpvrCacheSet(key, value) {
    if (window._waVpvrCache.has(key)) window._waVpvrCache.delete(key);
    window._waVpvrCache.set(key, value);
    if (window._waVpvrCache.size > 10) window._waVpvrCache.delete(window._waVpvrCache.keys().next().value);
  }

  function _waHex2Rgba(val, alpha) {
    if (val === 'transparent') return 'rgba(0,0,0,0)';
    if (typeof val === 'number') {
      const h = Math.round(val) >>> 0;
      return `rgba(${(h >> 16) & 0xFF},${(h >> 8) & 0xFF},${h & 0xFF},${alpha.toFixed(3)})`;
    }
    let hex = String(val).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  function _waGetDash(styleIdx, type) {
    if (styleIdx === 1) return [2, 3];             
    if (styleIdx === 2) return type === 'va' ? [] : [12, 4];
    return [6, 4];                                 
  }

  function _waRoundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function _waGetXPixel(xAxis, dataIndex) {
    if (!xAxis) return 0;
    try {
        let val = null;
        if (typeof xAxis.convertToPixel === 'function') {
            try { val = xAxis.convertToPixel({ dataIndex: dataIndex }); } catch(e){}
            if (val == null || isNaN(val.x ?? val)) { try { val = xAxis.convertToPixel(dataIndex); } catch(e){} }
            if (val != null) return typeof val === 'number' ? val : (val.x ?? 0);
        }
        if (typeof xAxis.getCoordinate === 'function') {
            val = xAxis.getCoordinate(dataIndex);
            if (val != null && !isNaN(val)) return val;
        }
    } catch(e) {}
    return 0;
  }

  function _waCalcVpvrProfile(dataList, startIdx, endIdx, rowCount, vaPercent) {
    let maxP = -Infinity, minP = Infinity, totalVol = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const d = dataList[i]; if (!d) continue;
      if (d.high > maxP) maxP = d.high;
      if (d.low  < minP) minP = d.low;
      totalVol += (d.volume || 0);
    }
    if (maxP === -Infinity || maxP === minP || totalVol === 0) return null;

    const step = (maxP - minP) / rowCount;
    if (step <= 0) return null;

    const bins = Array.from({ length: rowCount }, (_, i) => ({
      idx: i, pLow: minP + i * step, pHigh: minP + (i + 1) * step,
      upVol: 0, downVol: 0, total: 0, inVA: false,
    }));

    for (let i = startIdx; i < endIdx; i++) {
        const d = dataList[i]; if (!d || !d.volume) continue;
        const isUp = d.close >= d.open;
        const bodyTop = Math.max(d.open, d.close);
        const bodyBot = Math.min(d.open, d.close);
        const cRange = d.high - d.low;
        const bodyRange = bodyTop - bodyBot;
        const s = Math.max(0, Math.floor((d.low - minP) / step));
        const e = Math.min(rowCount - 1, Math.floor((d.high - minP) / step));

        for (let j = s; j <= e; j++) {
            const bin = bins[j];
            const oL = Math.max(d.low, bin.pLow);
            const oH = Math.min(d.high, bin.pHigh);
            if (oH > oL) {
                let binVol = 0;
                const overlapRange = oH - oL;
                const overlapBody = Math.max(0, Math.min(oH, bodyTop) - Math.max(oL, bodyBot));
                const overlapWick = overlapRange - overlapBody;

                if (cRange === 0) { binVol = d.volume * (overlapRange / step); } 
                else {
                    const wBody = bodyRange > 0 ? (overlapBody / bodyRange) * 0.70 : 0;
                    const wWick = (cRange - bodyRange) > 0 ? (overlapWick / (cRange - bodyRange)) * 0.30 : 0;
                    binVol = d.volume * (wBody + wWick);
                }
                if (isNaN(binVol)) binVol = 0;
                if (isUp) { bin.upVol += binVol; } else { bin.downVol += binVol; }
                bin.total += binVol;
            }
        }
    }

    let pocBin = bins[0], maxBinVol = 0;
    bins.forEach(b => { if (b.total > maxBinVol) { maxBinVol = b.total; pocBin = b; } });
    if (maxBinVol === 0) return null;

    pocBin.inVA = true;
    let curVA = pocBin.total, tgt = totalVol * (vaPercent / 100);
    let ui = pocBin.idx + 1, di = pocBin.idx - 1;

    while (curVA < tgt && (ui < rowCount || di >= 0)) {
        let volUp = 0, volDown = 0;
        let u1 = ui < rowCount ? bins[ui].total : 0;
        let u2 = (ui + 1) < rowCount ? bins[ui + 1].total : 0;
        volUp = u1 + u2;

        let d1 = di >= 0 ? bins[di].total : 0;
        let d2 = (di - 1) >= 0 ? bins[di - 1].total : 0;
        volDown = d1 + d2;

        if (volUp === 0 && volDown === 0) break;

        if (volUp >= volDown) {
            if (ui < rowCount) { bins[ui].inVA = true; curVA += bins[ui].total; ui++; }
            if (ui < rowCount && curVA < tgt) { bins[ui].inVA = true; curVA += bins[ui].total; ui++; }
        } else {
            if (di >= 0) { bins[di].inVA = true; curVA += bins[di].total; di--; }
            if (di >= 0 && curVA < tgt) { bins[di].inVA = true; curVA += bins[di].total; di--; }
        }
    }

    let vahBin = null, valBin = null;
    for (let i = rowCount - 1; i >= 0; i--) if (bins[i].inVA && !vahBin) vahBin = bins[i];
    for (let i = 0; i < rowCount; i++)      if (bins[i].inVA && !valBin) valBin = bins[i];

    return {
      bins, maxVol: maxBinVol, poc: pocBin, vahBin, valBin,
      vah: vahBin ? (vahBin.pLow + vahBin.pHigh) / 2 : null,
      val: valBin ? (valBin.pLow + valBin.pHigh) / 2 : null,
      totalVol, minP, maxP, step, startIdx, endIdx
    };
  }

  function _waGroupBySession(dataList, from, to, sessionMode, sessionCount) {
    const groups = new Map();
    for (let i = from; i < to; i++) {
      const d = dataList[i]; if (!d || !d.timestamp) continue;
      const dt = new Date(d.timestamp); let key;
      if (sessionMode === 1) {
        key = dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
      } else {
        const dow = dt.getUTCDay() || 7, mon = new Date(dt);
        mon.setUTCDate(dt.getUTCDate() - dow + 1);
        key = mon.getUTCFullYear() * 10000 + (mon.getUTCMonth() + 1) * 100 + mon.getUTCDate();
      }
      if (!groups.has(key)) groups.set(key, { start: i, end: i + 1 });
      else groups.get(key).end = i + 1;
    }
    return Array.from(groups.values()).sort((a, b) => a.start - b.start).slice(-sessionCount); 
  }

  function _waDrawGradientBar(ctx, clrHex, x0, x1, rectY, rectH) {
    if (Math.abs(x1 - x0) <= 0 || rectH <= 0) return;
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, _waHex2Rgba(clrHex, 0.85));
    grad.addColorStop(1, _waHex2Rgba(clrHex, 0.15));
    ctx.fillStyle = grad;
    ctx.fillRect(Math.min(x0, x1), rectY, Math.abs(x1 - x0), rectH);
  }

  function _waRenderBins(ctx, profile, maxW, anchorX, dir, yAxis, C, showDelta) {
    profile.bins.forEach(bin => {
      if (bin.total <= 0) return;
      const yB = yAxis.convertToPixel(bin.pLow), yT = yAxis.convertToPixel(bin.pHigh);
      if (yB === null || yT === null) return;
      
      const rectY = Math.min(yT, yB), rectH = Math.max(1, Math.abs(yB - yT) - 1);
      const wUp = (bin.upVol / profile.maxVol) * maxW;
      const wDn = (bin.downVol / profile.maxVol) * maxW;

      ctx.save();
      ctx.globalAlpha = bin.inVA ? C.opacityVA : C.opacityOut;

      if (dir === 1) {
        _waDrawGradientBar(ctx, C.clrUp, anchorX, anchorX + wUp, rectY, rectH);
        _waDrawGradientBar(ctx, C.clrDn, anchorX + wUp, anchorX + wUp + wDn, rectY, rectH);
      } else {
        _waDrawGradientBar(ctx, C.clrDn, anchorX, anchorX - wDn, rectY, rectH);
        _waDrawGradientBar(ctx, C.clrUp, anchorX - wDn, anchorX - wDn - wUp, rectY, rectH);
      }
      ctx.restore();

      const totalW = wUp + wDn;
      const edgeX = anchorX + totalW * dir;

      if (C.showBoxes) {
        if (bin.total > profile.maxVol * 0.80) {
          ctx.save();
          ctx.strokeStyle = _waHex2Rgba(C.clrHvn, 0.40); ctx.lineWidth = 1;
          ctx.strokeRect(Math.min(anchorX, edgeX), rectY, totalW, rectH);
          ctx.restore();
        }

        if (bin.total > 0 && bin.total < profile.maxVol * 0.10) {
          ctx.save();
          ctx.fillStyle = _waHex2Rgba(C.clrLvn, 0.10); 
          ctx.fillRect(Math.min(anchorX, anchorX + maxW * dir), rectY, maxW, rectH);
          ctx.restore();
        }
      }

      if (showDelta && bin.inVA && (bin.upVol + bin.downVol > 0)) {
        const dr = bin.upVol / (bin.upVol + bin.downVol);
        const iconX = edgeX + (dir === 1 ? 6 : -6);
        if (dr > 0.75 || dr < 0.25) {
          ctx.save();
          ctx.font = `bold ${Math.max(8, C.fontSize - 2)}px system-ui,sans-serif`; 
          ctx.textBaseline = 'middle'; ctx.textAlign = dir === 1 ? 'left' : 'right';
          ctx.fillStyle = dr > 0.75 ? _waHex2Rgba(C.clrDeltaUp, 1) : _waHex2Rgba(C.clrDn, 1);
          ctx.fillText(dr > 0.75 ? '▲' : '▼', iconX, rectY + rectH / 2);
          ctx.restore();
        }
      }
    });
  }

  function _waRenderPOCLine(ctx, profile, maxW, anchorX, dir, bounding, yAxis, dataList, C) {
    if (!profile.poc) return;
    const pocMid = (profile.poc.pLow + profile.poc.pHigh) / 2;
    const pocY = yAxis.convertToPixel(pocMid);
    if (pocY === null) return;

    let isNaked = false;
    if (dataList && profile.endIdx < dataList.length) {
      isNaked = true;
      for (let i = profile.endIdx; i < dataList.length; i++) {
        const d = dataList[i]; if (d && d.low <= pocMid && pocMid <= d.high) { isNaked = false; break; }
      }
    }

    const endOfProfileX = anchorX + (maxW + 20) * dir; 

    ctx.save();
    ctx.shadowColor = _waHex2Rgba(C.clrPoc, 0.60); ctx.shadowBlur = 5;
    ctx.strokeStyle = _waHex2Rgba(C.clrPoc, 0.95); ctx.lineWidth = C.pocLineWidth;
    ctx.beginPath(); ctx.moveTo(anchorX, pocY); ctx.lineTo(endOfProfileX, pocY);
    ctx.stroke(); ctx.shadowBlur = 0;

    if (isNaked) {
      ctx.strokeStyle = _waHex2Rgba(C.clrNpoc, 0.55); ctx.lineWidth = Math.max(1, C.pocLineWidth - 1);
      ctx.setLineDash(_waGetDash(C.npocStyle, 'npoc')); ctx.beginPath();
      ctx.moveTo(endOfProfileX, pocY);
      
      const currentPriceX = bounding.width;
      ctx.lineTo(dir === 1 ? currentPriceX : 0, pocY); 
      
      ctx.stroke(); ctx.setLineDash([]);
      
      if (C.showLabels) {
        ctx.fillStyle = _waHex2Rgba(C.clrNpoc, 0.88); ctx.font = `bold ${C.fontSize - 1}px system-ui,sans-serif`; ctx.textBaseline = 'bottom';
        ctx.textAlign = dir === 1 ? 'right' : 'left'; 
        const lblX = dir === 1 ? currentPriceX - 4 : 4;
        ctx.fillText('nPOC', lblX, pocY - 2);
      }
    }

    if (C.showLabels) {
      const label = 'POC ' + pocMid.toLocaleString('en-US', { maximumFractionDigits: 2 });
      ctx.font = `bold ${C.fontSize}px system-ui,sans-serif`; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width, bW = tw + 10, bH = C.fontSize + 8;
      const bX = dir === 1 ? endOfProfileX + 5 : endOfProfileX - bW - 5;
      _waRoundRect(ctx, bX, pocY - bH / 2, bW, bH, 3);
      ctx.fillStyle = _waHex2Rgba(C.clrPoc, 1); ctx.fill();
      ctx.fillStyle = '#000000'; ctx.textAlign = 'left'; ctx.fillText(label, bX + 5, pocY);
    }
    ctx.restore();
  }

  function _waRenderVALines(ctx, profile, maxW, anchorX, dir, yAxis, C) {
    ctx.save();
    ctx.strokeStyle = _waHex2Rgba(C.clrVa, 0.88); ctx.lineWidth = C.vaLineWidth;
    const dashPat = _waGetDash(C.vaStyle, 'va');
    const endX = anchorX + maxW * dir;

    if (profile.vah !== null) {
      const vahY = yAxis.convertToPixel(profile.vah);
      if (vahY !== null) {
        ctx.setLineDash(dashPat); ctx.beginPath();
        ctx.moveTo(anchorX, vahY); ctx.lineTo(endX, vahY); ctx.stroke();
        if (C.showLabels) {
          ctx.setLineDash([]); ctx.fillStyle = _waHex2Rgba(C.clrVa, 0.95); ctx.font = `bold ${C.fontSize - 1}px system-ui,sans-serif`;
          ctx.textBaseline = 'bottom'; ctx.textAlign = dir === 1 ? 'left' : 'right';
          ctx.fillText('VAH ' + profile.vah.toLocaleString('en-US', { maximumFractionDigits: 2 }), dir === 1 ? anchorX + 4 : anchorX - 4, vahY - 2);
        }
      }
    }
    if (profile.val !== null) {
      const valY = yAxis.convertToPixel(profile.val);
      if (valY !== null) {
        ctx.setLineDash(dashPat); ctx.beginPath();
        ctx.moveTo(anchorX, valY); ctx.lineTo(endX, valY); ctx.stroke();
        if (C.showLabels) {
          ctx.setLineDash([]); ctx.fillStyle = _waHex2Rgba(C.clrVa, 0.95); ctx.font = `bold ${C.fontSize - 1}px system-ui,sans-serif`;
          ctx.textBaseline = 'top'; ctx.textAlign = dir === 1 ? 'left' : 'right';
          ctx.fillText('VAL ' + profile.val.toLocaleString('en-US', { maximumFractionDigits: 2 }), dir === 1 ? anchorX + 4 : anchorX - 4, valY + 2);
        }
      }
    }
    ctx.restore();
  }

  kc.registerIndicator({
    name: 'WAVE_VPVR',
    shortName: 'VPVR',
    description: 'Volume Profile Visible Range ULTIMATE v3.5',
    category: 'wave_alpha',
    series: 'price',
    isStack: true,
    createTooltipDataSource: function() { return { name: 'VPVR', calcParamsText: ' ', values: [] }; },
    
    // Đã dời 10 và 1 xuống cuối cùng
    calcParams: [
      60, 70, 30, 0, 0, 0,
      "#26A69A", "#EF5350", "#F0B90B", "#9575CD",
      "#FFFFFF", "#FF9800", "#F0B90B", "#26A69A",
      80, 25, 2, 1, 0, 0, 10, 1,
      10, 1
    ],
    figures: [],

    calc: function(dataList) { return dataList.map(() => ({})); },

    draw: function(args) {
      const dataList = args.kLineDataList || args.dataList || [];
      const visibleRange = args.visibleRange || { from: 0, to: dataList.length };
      const { ctx, bounding, xAxis, yAxis, indicator } = args;

      if (!dataList || dataList.length === 0 || !bounding) return false;

      const p = indicator.calcParams;
      const rowCount = Math.max(10, Math.min(200, +(p[0] ?? 60)));
      const vaPercent = Math.max(10, Math.min(100, +(p[1] ?? 70)));
      const widthPct = Math.max(10, Math.min(80, +(p[2] ?? 30)));
      const isLeft = +(p[3] ?? 0) === 1;
      const sessionMode = +(p[4] ?? 0);
      const compositeMode = +(p[5] ?? 0); 
      
      const C = {
        clrUp: p[6] || "#26A69A", clrDn: p[7] || "#EF5350", clrPoc: p[8] || "#F0B90B",
        clrVa: p[9] || "#9575CD", clrHvn: p[10] || "#FFFFFF", clrLvn: p[11] || "#FF9800",
        clrNpoc: p[12] || "#F0B90B", clrDeltaUp: p[13] || "#26A69A",
        opacityVA: Math.max(0, Math.min(100, +(p[14] ?? 80))) / 100,
        opacityOut: Math.max(0, Math.min(100, +(p[15] ?? 25))) / 100,
        pocLineWidth: Math.max(1, Math.min(5, +(p[16] ?? 2))),
        vaLineWidth: Math.max(1, Math.min(4, +(p[17] ?? 1))),
        vaStyle: Math.round(+(p[18] ?? 0)), npocStyle: Math.round(+(p[19] ?? 0)),
        fontSize: Math.max(8, Math.min(16, +(p[20] ?? 10))),
        showLabels: +(p[21] ?? 1) === 1,
        
        // 🚀 Đã map đúng index 22 và 23 ở cuối mảng
        sessionCount: Math.max(1, Math.min(50, +(p[22] ?? 10))),
        showBoxes: +(p[23] ?? 1) === 1,
      };

      const { from, to } = visibleRange;
      if (from == null || to == null || from >= to) return false;

      const maxWidthPx = bounding.width * (widthPct / 100);
      const liveVolume = dataList[to - 1] ? (dataList[to - 1].volume || 0) : 0;
      
      const cacheKey = `${from}_${to}_${rowCount}_${vaPercent}_${sessionMode}_${C.sessionCount}_${compositeMode}_${liveVolume}`;
      let cached = window._waVpvrCache.get(cacheKey);

      if (!cached) {
        let mainProfile = null, sessions = [], compProfile = null;
        if (sessionMode === 0) {
          mainProfile = _waCalcVpvrProfile(dataList, from, to, rowCount, vaPercent);
        } else {
          sessions = _waGroupBySession(dataList, from, to, sessionMode, C.sessionCount).map((g) => ({
            profile: _waCalcVpvrProfile(dataList, g.start, g.end, rowCount, vaPercent)
          })).filter(s => s.profile !== null);
        }
        if (compositeMode === 1) compProfile = _waCalcVpvrProfile(dataList, 0, dataList.length, rowCount, vaPercent);
        
        cached = { mainProfile, sessions, compProfile };
        _waVpvrCacheSet(cacheKey, cached);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      if (compositeMode === 1 && cached.compProfile) {
        ctx.save(); 
        ctx.globalAlpha = 0.20; 
        const compAnchorX = isLeft ? 0 : bounding.width;
        const compDir = isLeft ? 1 : -1;
        _waRenderBins(ctx, cached.compProfile, maxWidthPx, compAnchorX, compDir, yAxis, C, false);
        ctx.restore();
      }

      if (sessionMode > 0 && cached.sessions.length > 0) {
        cached.sessions.forEach(({ profile }) => {
          if (!profile) return;
          ctx.save(); 
          ctx.globalAlpha = 1; 
          
          const startX = _waGetXPixel(xAxis, profile.startIdx);
          let endX = _waGetXPixel(xAxis, profile.endIdx - 1);
          
          const pxPerCandle = xAxis.convertToPixel(1) - xAxis.convertToPixel(0);
          if (endX <= startX) endX = startX + Math.max(pxPerCandle, 5);
          
          const sessionWidth = Math.abs(endX - startX);
          const sessionMaxW = sessionWidth * (widthPct / 100);
          
          const anchorX = isLeft ? startX : endX;
          const dir = isLeft ? 1 : -1;

          _waRenderBins(ctx, profile, sessionMaxW, anchorX, dir, yAxis, C, true);
          ctx.restore();
          
          _waRenderPOCLine(ctx, profile, sessionMaxW, anchorX, dir, bounding, yAxis, dataList, C);
          _waRenderVALines(ctx, profile, sessionMaxW, anchorX, dir, yAxis, C);
        });
      } 
      else if (cached.mainProfile) {
        const anchorX = isLeft ? 0 : bounding.width;
        const dir = isLeft ? 1 : -1;
        _waRenderBins(ctx, cached.mainProfile, maxWidthPx, anchorX, dir, yAxis, C, true);
        _waRenderPOCLine(ctx, cached.mainProfile, maxWidthPx, anchorX, dir, bounding, yAxis, dataList, C);
        _waRenderVALines(ctx, cached.mainProfile, maxWidthPx, anchorX, dir, yAxis, C);
      }

      ctx.restore();
      return false;
    }
  });
})();

// ════════ BƯỚC 2: Thay thế toàn bộ cụm WAVE_TPO ULTIMATE cũ bằng v5.1 này ════════
// ════════════════════════════════════════════════════════════════════════════════
//  WAVE_TPO ULTIMATE v5.1 — SMART ENGINE (ANCHORING FIX & WIDTH SYNC)
// ════════════════════════════════════════════════════════════════════════════════
(function initWaveTpoSmart() {
  'use strict';

  if (!window._waTpoCache) window._waTpoCache = new Map();

  function _waTpoCacheSet(key, value) {
      if (window._waTpoCache.has(key)) window._waTpoCache.delete(key);
      window._waTpoCache.set(key, value);
      if (window._waTpoCache.size > 10) window._waTpoCache.delete(window._waTpoCache.keys().next().value);
  }

  function _waTpoHex2Rgba(val, alpha) {
      if (val === 'transparent') return 'rgba(0,0,0,0)';
      if (typeof val === 'number') {
          const h = Math.round(val) >>> 0;
          return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${alpha.toFixed(3)})`;
      }
      let hex = String(val).replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substring(0, 2), 16) || 0;
      const g = parseInt(hex.substring(2, 4), 16) || 0;
      const b = parseInt(hex.substring(4, 6), 16) || 0;
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  function _waTpoGetDash(styleIdx) { return styleIdx === 1 ? [2, 3] : styleIdx === 2 ? [] : [6, 4]; }

  function _waTpoGetLetter(n) {
      if (n < 26) return String.fromCharCode(65 + n);
      if (n < 52) return String.fromCharCode(97 + n - 26);
      return String.fromCharCode(65 + Math.floor((n - 52) / 26)) + String.fromCharCode(65 + ((n - 52) % 26));
  }

  const _WA_TPO_SESSION_PALETTE = ['#4A148C', '#6A1B9A', '#8E24AA', '#AB47BC', '#00BCD4'];

  // ─── AI MARKET PROFILE: VALLEY SCAN ──────────────────────────────
  function _waTpoClassifyProfileShape(bins) {
      const counts = bins.map(b => b.count);
      const total = counts.reduce((a, b) => a + b, 0);
      if (!total) return 'UNDEFINED';

      const midIdx = Math.floor(counts.length / 2);
      let topVol = 0, botVol = 0;
      for (let i = 0; i < counts.length; i++) {
          if (i >= midIdx) topVol += counts[i];
          else botVol += counts[i];
      }
      const skew = (topVol - botVol) / total;

      let maxCount = Math.max(...counts);
      let threshold = maxCount * 0.40; 
      let peaks = [];

      for (let i = 1; i < counts.length - 1; i++) {
          if (counts[i] >= threshold && counts[i] >= counts[i-1] && counts[i] >= counts[i+1]) {
              let right = i;
              while (right < counts.length - 1 && counts[right+1] === counts[i]) right++;
              let midPlateau = Math.floor((i + right) / 2);
              peaks.push({ idx: midPlateau, val: counts[i] });
              i = right; 
          }
      }

      let isBShape = false;
      for (let i = 0; i < peaks.length - 1; i++) {
          for (let j = i + 1; j < peaks.length; j++) {
              let p1 = peaks[i], p2 = peaks[j];
              if (Math.abs(p1.idx - p2.idx) < counts.length * 0.10) continue;
              let minValley = Infinity;
              for (let k = p1.idx + 1; k < p2.idx; k++) {
                  if (counts[k] < minValley) minValley = counts[k];
              }
              let smallerPeak = Math.min(p1.val, p2.val);
              if (minValley <= maxCount * 0.25 || minValley <= smallerPeak * 0.5) {
                  isBShape = true; break;
              }
          }
          if (isBShape) break;
      }

      if (isBShape) return 'B_SHAPE'; 
      if (skew > 0.16) return 'P_SHAPE';   
      if (skew < -0.16) return 'b_SHAPE';  
      return 'D_SHAPE'; 
  }

  function _waTpoDetectExcessTail(bins) {
      const nz = bins.filter(b => b.count > 0);
      if (!nz.length) return { top: false, bottom: false };
      const avg = nz.reduce((s, b) => s + b.count, 0) / nz.length;
      return {
          bottom: nz[0] && nz[0].count <= Math.max(2, avg * 0.25) && (!nz[1] || nz[1].count > nz[0].count),
          top: nz[nz.length - 1] && nz[nz.length - 1].count <= Math.max(2, avg * 0.25) && (!nz[nz.length - 2] || nz[nz.length - 2].count > nz[nz.length - 1].count)
      };
  }

  function _waTpoDetectPoorHighLow(bins) {
      const nz = bins.filter(b => b.count > 0);
      if (!nz.length) return { poorHigh: false, poorLow: false };
      return { poorHigh: nz[nz.length - 1].count >= 2, poorLow: nz[0].count >= 2 };
  }

  function _waTpoClassifyDayType(profile, dataList) {
      const { startIdx, endIdx, ibHigh, ibLow, maxP, minP } = profile;
      if (ibHigh == null || ibLow == null || endIdx - startIdx < 3) return 'OTHER';
      const ibRange = Math.max(1e-9, ibHigh - ibLow), dayRange = Math.max(1e-9, maxP - minP);
      const close = dataList[endIdx - 1]?.close ?? maxP;
      const pos = (close - minP) / dayRange, exp = dayRange / ibRange;
      if (exp >= 2.2 && (pos > 0.75 || pos < 0.25)) return 'TREND_DAY';
      if (exp >= 1.4) return 'NORMAL_VARIATION';
      if (pos > 0.40 && pos < 0.60) return 'NEUTRAL_DAY';
      return 'NORMAL_DAY';
  }

  function _waTpoAuctionState(profile) {
      const { closePos, inValueClose, shape } = profile;
      if (inValueClose && Math.abs(closePos - 0.5) < 0.22) return 'ACCEPTANCE';
      if (!inValueClose && (closePos < 0.18 || closePos > 0.82)) return 'REJECTION';
      if (shape === 'P_SHAPE' || shape === 'b_SHAPE') return 'ROTATIONAL_BIAS';
      return 'BALANCED_AUCTION';
  }

  function _waCheckSuperPoc(pocMid, step) {
      if (!window._waVpvrCache || window._waVpvrCache.size === 0) return false;
      for (const cached of window._waVpvrCache.values()) {
          const p = []; if (cached.mainProfile) p.push(cached.mainProfile);
          if (cached.sessions) cached.sessions.forEach(s => s.profile && p.push(s.profile));
          for (const vp of p) {
              if (!vp || !vp.poc) continue;
              if (Math.abs((vp.poc.pLow + vp.poc.pHigh) / 2 - pocMid) <= step * 2) return true;
          }
      }
      return false;
  }

  function _waTpoGroupData(dataList, from, to, mode, maxCount) {
      if (mode === 0) return [{ start: from, end: to }]; 
      const groups = new Map();
      for (let i = from; i < to; i++) {
          const d = dataList[i];
          const ts = d ? (d.timestamp ?? d.time ?? null) : null;
          if (!ts || isNaN(ts)) continue;
          const dt = new Date(ts);
          let key;
          if (mode === 1) { 
              key = dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
          } else { 
              const day = dt.getUTCDay();
              const diff = dt.getUTCDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(dt.getTime());
              monday.setUTCDate(diff);
              key = monday.getUTCFullYear() * 10000 + (monday.getUTCMonth() + 1) * 100 + monday.getUTCDate();
          }
          if (!groups.has(key)) groups.set(key, { start: i, end: i + 1 });
          else groups.get(key).end = i + 1;
      }
      return Array.from(groups.values()).sort((a, b) => a.start - b.start).slice(-maxCount);
  }

  function _getXPixel(xAxis, dataIndex) {
      if (!xAxis) return 0;
      try {
          let val = null;
          if (typeof xAxis.convertToPixel === 'function') {
              try { val = xAxis.convertToPixel({ dataIndex: dataIndex }); } catch(e){}
              if (val == null || isNaN(val.x ?? val)) { try { val = xAxis.convertToPixel(dataIndex); } catch(e){} }
              if (val != null) return typeof val === 'number' ? val : (val.x ?? 0);
          }
          if (typeof xAxis.getCoordinate === 'function') {
              val = xAxis.getCoordinate(dataIndex);
              if (val != null && !isNaN(val)) return val;
          }
      } catch(e) {}
      return 0;
  }

  function _getYPixel(yAxis, price) {
      if (!yAxis) return 0;
      try {
          let val = null;
          if (typeof yAxis.convertToPixel === 'function') {
              try { val = yAxis.convertToPixel({ value: price }); } catch(e){}
              if (val == null || isNaN(val.y ?? val)) { try { val = yAxis.convertToPixel(price); } catch(e){} }
              if (val != null) return typeof val === 'number' ? val : (val.y ?? 0);
          }
          if (typeof yAxis.getCoordinate === 'function') {
              val = yAxis.getCoordinate(price);
              if (val != null && !isNaN(val)) return val;
          }
      } catch(e) {}
      return 0;
  }

  kc.registerIndicator({
      name: 'WAVE_TPO', shortName: 'TPO', description: 'Time Price Opportunity SMART v5.1',
      category: 'wave_alpha', series: 'price', isStack: true,
      createTooltipDataSource: function() { return { name: 'TPO', calcParamsText: ' ', values: [] }; },
      
      calcParams: [
          60, 70, 1, 0, 1, 0, 1, 1, 
          "#9C27B0", "#7B1FA2", "#F0B90B", "#FF9800", "#F0B90B",
          "#BA68C8", "#FFD600", "#FFD600", "#26A69A", "#EF5350",
          "#42A5F5", "#FF7043",
          85, 20, 2, 1, 0, 10, 1, 70, 8, 1, 30, 50
      ],
      figures: [],
      calc: function(dataList) { return dataList.map(() => ({})); },
      
      draw: function(args) {
          const { ctx, bounding, xAxis, yAxis, indicator } = args;
          const dataList = args.kLineDataList || args.dataList || [];
          const visibleRange = args.visibleRange || { from: 0, to: dataList.length };

          if (!dataList || dataList.length === 0 || !bounding) return false;

          const p = indicator.calcParams;
          // Fallback array length check (lên 32 tham số)
          if (p && p.length < 32) { 
              const defaults = [
                  60, 70, 1, 0, 1, 0, 1, 1, "#9C27B0", "#7B1FA2", "#F0B90B", "#FF9800", "#F0B90B",
                  "#BA68C8", "#FFD600", "#FFD600", "#26A69A", "#EF5350", "#42A5F5", "#FF7043",
                  85, 20, 2, 1, 0, 10, 1, 70, 8, 1, 30, 50
              ];
              for (let i = 0; i < 32; i++) {
                  if (p[i] === undefined || (i >= 8 && i <= 19 && typeof p[i] !== 'string')) p[i] = defaults[i];
              }
          }

          const C = {
              rowCount: Math.max(10, Math.min(200, +(p[0] ?? 60))), vaPercent: Math.max(10, Math.min(100, +(p[1] ?? 70))),
              groupMode: +(p[2] ?? 1), isLeft: +(p[3] ?? 0) === 0, useLetter: +(p[4] ?? 1) === 1,
              colorMode: +(p[5] ?? 0), densityMode: +(p[6] ?? 1), smartLabels: +(p[7] ?? 1) === 1,
              clrVA: p[8], clrOut: p[9], clrPoc: p[10], clrNpoc: p[11], clrSuperPoc: p[12],
              clrVaLine: p[13], clrIbHigh: p[14], clrIbLow: p[15], clrImbalBuy: p[16], clrImbalSell: p[17], clrAccept: p[18], clrReject: p[19],
              opVA: Math.max(0, Math.min(100, +(p[20] ?? 85))) / 100, opOut: Math.max(0, Math.min(100, +(p[21] ?? 20))) / 100,
              pocW: Math.max(1, +(p[22] ?? 2)), vaW: Math.max(1, +(p[23] ?? 1)), vaStyle: Math.round(+(p[24] ?? 0)),
              fontSize: Math.max(8, +(p[25] ?? 10)), showLabels: +(p[26] ?? 1) === 1,
              fade: Math.max(0, +(p[27] ?? 70)) / 100, minLtrPx: Math.max(6, +(p[28] ?? 8)), verbosity: Math.round(+(p[29] ?? 1)),
              maxProfiles: Math.max(1, Math.min(100, +(p[30] ?? 30))), 
              widthPct: Math.max(10, Math.min(100, +(p[31] ?? 50))) // 🚀 Tích hợp biến Độ Rộng Mới
          };

          const { from, to } = visibleRange;
          if (from >= to) return false;

          const lastClose = dataList[to - 1]?.close ?? 0;
          const cacheKey = `${from}_${to}_${C.rowCount}_${C.vaPercent}_${C.groupMode}_${C.maxProfiles}_${lastClose}_${bounding.width}_${bounding.height}`;
          let profiles = window._waTpoCache.get(cacheKey);

          if (!profiles) {
              const sessions = _waTpoGroupData(dataList, from, to, C.groupMode, C.maxProfiles);

              profiles = sessions.map((s, idx) => {
                  if (s.end - s.start <= 0) return null;
                  let maxP = -Infinity, minP = Infinity;
                  for (let i = s.start; i < s.end; i++) {
                      if (!dataList[i]) continue;
                      if (dataList[i].high > maxP) maxP = dataList[i].high;
                      if (dataList[i].low  < minP) minP = dataList[i].low;
                  }
                  if (maxP === -Infinity || maxP === minP) return null;

                  const step = (maxP - minP) / C.rowCount;
                  let totalTPO = 0;
                  const bins = Array.from({ length: C.rowCount }, (_, i) => ({
                      idx: i, pLow: minP + i * step, pHigh: minP + (i + 1) * step, count: 0, letters: [], inVA: false
                  }));

                  for (let i = s.start; i < s.end; i++) {
                      if (!dataList[i]) continue;
                      const d = dataList[i], lIdx = i - s.start;
                      const sI = Math.max(0, Math.floor((d.low  - minP) / step));
                      const eI = Math.min(C.rowCount - 1, Math.floor((d.high - minP) / step));
                      for (let j = sI; j <= eI; j++) { bins[j].count++; bins[j].letters.push(lIdx); totalTPO++; }
                  }
                  if (totalTPO === 0) return null;

                  let pocBin = bins[0], maxTPO = 0;
                  bins.forEach(b => { if (b.count > maxTPO) { maxTPO = b.count; pocBin = b; } });

                  pocBin.inVA = true;
                  let curVA = pocBin.count, targetVA = totalTPO * (C.vaPercent / 100);
                  let ui = pocBin.idx + 1, di = pocBin.idx - 1;

                  while (curVA < targetVA && (ui < C.rowCount || di >= 0)) {
                      let volUp = 0, volDown = 0;
                      let u1 = ui < C.rowCount ? bins[ui].count : 0;
                      let u2 = (ui + 1) < C.rowCount ? bins[ui + 1].count : 0;
                      volUp = u1 + u2;

                      let d1 = di >= 0 ? bins[di].count : 0;
                      let d2 = (di - 1) >= 0 ? bins[di - 1].count : 0;
                      volDown = d1 + d2;

                      if (volUp === 0 && volDown === 0) break;

                      if (volUp >= volDown) {
                          if (ui < C.rowCount) { bins[ui].inVA = true; curVA += bins[ui].count; ui++; }
                          if (ui < C.rowCount && curVA < targetVA) { bins[ui].inVA = true; curVA += bins[ui].count; ui++; }
                      } else {
                          if (di >= 0) { bins[di].inVA = true; curVA += bins[di].count; di--; }
                          if (di >= 0 && curVA < targetVA) { bins[di].inVA = true; curVA += bins[di].count; di--; }
                      }
                  }

                  let vahBin = null, valBin = null;
                  for (let i = C.rowCount - 1; i >= 0; i--) if (bins[i].inVA && !vahBin) vahBin = bins[i];
                  for (let i = 0;              i <  C.rowCount; i++) if (bins[i].inVA && !valBin) valBin = bins[i];

                  let ibHigh = -Infinity, ibLow = Infinity;
                  let sessionStartTime = dataList[s.start].timestamp || dataList[s.start].time || 0;
                  for (let i = s.start; i < s.end; i++) {
                      let d = dataList[i];
                      let t = d.timestamp || d.time || 0;
                      if (t - sessionStartTime < 3600000) { 
                          if (d.high > ibHigh) ibHigh = d.high;
                          if (d.low < ibLow) ibLow = d.low;
                      } else {
                          break;
                      }
                  }
                  if (ibHigh === -Infinity) { ibHigh = null; ibLow = null; }

                  const pocMid = (pocBin.pLow + pocBin.pHigh) / 2;
                  let isNaked = true;
                  for (let i = s.end; i < dataList.length; i++) {
                      if (dataList[i] && dataList[i].low <= pocMid && dataList[i].high >= pocMid) { isNaked = false; break; }
                  }

                  let topC = 0, botC = 0;
                  bins.forEach(b => {
                      if (b.inVA) {
                          if (b.idx > pocBin.idx) topC += b.count;
                          else if (b.idx < pocBin.idx) botC += b.count;
                      }
                  });
                  let imb = 'BALANCED';
                  if (Math.abs(topC - botC) / Math.max(1, topC + botC) > 0.3) imb = topC > botC ? 'BUYING' : 'SELLING';

                  const closePrice = dataList[s.end - 1]?.close ?? pocMid;
                  const closePos   = (closePrice - minP) / Math.max(1e-9, maxP - minP);
                  const inValueClose = !!(valBin && vahBin && closePrice >= valBin.pLow && closePrice <= vahBin.pHigh);

                  const prof = {
                      bins, maxTPO, pocBin, pocMid, vahBin, valBin, ibHigh, ibLow, imbalance: imb, isNaked,
                      totalTPO, minP, maxP, step, startIdx: s.start, endIdx: s.end, close: closePrice, closePos, inValueClose,
                      sessionIdx: idx, sessionTotal: sessions.length
                  };

                  prof.shape        = _waTpoClassifyProfileShape(bins);
                  const exc         = _waTpoDetectExcessTail(bins); prof.excessTop = exc.top; prof.excessBottom = exc.bottom;
                  const poor        = _waTpoDetectPoorHighLow(bins); prof.poorHigh = poor.poorHigh; prof.poorLow = poor.poorLow;
                  prof.dayType      = _waTpoClassifyDayType(prof, dataList);
                  prof.auctionState = _waTpoAuctionState(prof);
                  prof.isSuperPoc   = _waCheckSuperPoc(pocMid, step);

                  return prof;
              }).filter(Boolean);

              _waTpoCacheSet(cacheKey, profiles);
          }

          if (!profiles.length) return false;

          try {
              ctx.save();
              ctx.globalCompositeOperation = 'source-over';

              const pxPerBar   = bounding.width / Math.max(1, to - from);
              const compactMode= C.densityMode === 0 || pxPerBar < 3;
              const isHeatmap = C.colorMode === 2;

              profiles.forEach((prof) => {
                  let anchorX, dir, sessionWidth;
                  
                  // 🚀 Lấy tọa độ an toàn cho Start và End của phiên
                  const startX = _getXPixel(xAxis, prof.startIdx);
                  let endX = _getXPixel(xAxis, prof.endIdx - 1);
                  let pxPerCandle = 5;
                  try { pxPerCandle = xAxis.convertToPixel(1) - xAxis.convertToPixel(0); } catch(e){}
                  if (isNaN(pxPerCandle) || pxPerCandle <= 0) pxPerCandle = 5;
                  if (endX <= startX) endX = startX + pxPerCandle;

                  // 🚀 CHỐT CHẶN ANCHORING MỚI: Tôn trọng tuyệt đối Vị Trí Trái/Phải
                  if (C.groupMode === 0) {
                      sessionWidth = bounding.width;
                      anchorX = C.isLeft ? 0 : bounding.width;
                      dir     = C.isLeft ? 1 : -1;
                  } else {
                      sessionWidth = Math.abs(endX - startX);
                      anchorX = C.isLeft ? startX : endX; // Nếu Trái neo vào Start, Nếu Phải neo vào End
                      dir     = C.isLeft ? 1 : -1;
                  }

                  let baseClr = C.clrVA, outClr = C.clrOut, alphaMul = 1;
                  if (C.colorMode === 1) { 
                      const ratio = prof.sessionTotal <= 1 ? 0 : prof.sessionIdx / (prof.sessionTotal - 1);
                      baseClr = outClr = _WA_TPO_SESSION_PALETTE[Math.min(4, Math.floor(ratio * 4))];
                      alphaMul = prof.sessionTotal <= 1 ? 1 : (1 - C.fade) + ratio * C.fade;
                  } else if (isHeatmap) { 
                      alphaMul = prof.sessionTotal <= 1 ? 1 : (1 - C.fade) + (prof.sessionIdx / (prof.sessionTotal - 1)) * C.fade;
                  }

                  // 🚀 ĐỘ RỘNG MỚI ĐÃ ĐƯỢC LINK VÀO BIẾN %
                  const maxBlocksPx = sessionWidth * (C.widthPct / 100);
                  const unitW    = maxBlocksPx / Math.max(1, prof.maxTPO);
                  const stepDraw = (compactMode && !C.useLetter) ? 2 : 1;

                  const rH_global = Math.max(1, Math.abs(_getYPixel(yAxis, prof.bins[0].pLow) - _getYPixel(yAxis, prof.bins[0].pHigh)));
                  const safeFontSize = Math.floor(Math.min(unitW, rH_global, C.fontSize)) || 1;
                  const canLetterGlobal = C.useLetter && rH_global >= 6 && unitW >= C.minLtrPx;

                  if (canLetterGlobal) {
                      ctx.font = `bold ${safeFontSize}px monospace`;
                      ctx.textBaseline = 'middle'; 
                      ctx.textAlign = 'center';
                  }

                  const pathInVA = typeof Path2D !== 'undefined' ? new Path2D() : null;
                  const pathOutVA = typeof Path2D !== 'undefined' ? new Path2D() : null;

                  prof.bins.forEach(bin => {
                      if (bin.count <= 0) return;

                      const yB = _getYPixel(yAxis, bin.pLow);
                      const yT = _getYPixel(yAxis, bin.pHigh);
                      if (yB === 0 && yT === 0) return;

                      const rY = Math.min(yT, yB), rH = Math.max(1, Math.abs(yB - yT)), blockW = Math.max(1, Math.min(rH, unitW));
                      
                      if (rY > bounding.height || rY + rH < 0) return;

                      let fAlpha = (bin.inVA ? C.opVA : C.opOut) * alphaMul;
                      if (isHeatmap) fAlpha = (0.12 + 0.75 * (bin.count / prof.maxTPO)) * alphaMul;

                      const fillStyle = _waTpoHex2Rgba(bin.inVA ? baseClr : outClr, Math.min(1, Math.max(0, fAlpha)));

                      if (canLetterGlobal) {
                          ctx.fillStyle = fillStyle;
                          bin.letters.forEach((lIdx, pos) => {
                              if (pos % stepDraw === 0) {
                                  const lx = dir > 0 ? anchorX + pos * blockW + blockW / 2 : anchorX - pos * blockW - blockW / 2;
                                  if (lx > 0 && lx < bounding.width) {
                                      ctx.fillText(_waTpoGetLetter(lIdx), lx, rY + rH / 2);
                                  }
                              }
                          });
                      } else {
                          if (isHeatmap || !pathInVA) {
                              ctx.fillStyle = fillStyle;
                              ctx.beginPath();
                              bin.letters.forEach((lIdx, pos) => {
                                  if (pos % stepDraw === 0) {
                                      const bx = dir > 0 ? anchorX + pos * blockW : anchorX - (pos + 1) * blockW;
                                      if (bx + blockW > 0 && bx < bounding.width) {
                                          ctx.rect(bx, rY, Math.max(1, blockW - 1), Math.max(1, rH - 1));
                                      }
                                  }
                              });
                              ctx.fill();
                          } else {
                              const targetPath = bin.inVA ? pathInVA : pathOutVA;
                              bin.letters.forEach((lIdx, pos) => {
                                  if (pos % stepDraw === 0) {
                                      const bx = dir > 0 ? anchorX + pos * blockW : anchorX - (pos + 1) * blockW;
                                      if (bx + blockW > 0 && bx < bounding.width) {
                                          targetPath.rect(bx, rY, Math.max(1, blockW - 1), Math.max(1, rH - 1));
                                      }
                                  }
                              });
                          }
                      }
                  });

                  if (!canLetterGlobal && !isHeatmap && pathInVA) {
                      if (C.opVA > 0) {
                          ctx.fillStyle = _waTpoHex2Rgba(baseClr, Math.min(1, Math.max(0, C.opVA * alphaMul)));
                          ctx.fill(pathInVA);
                      }
                      if (C.opOut > 0) {
                          ctx.fillStyle = _waTpoHex2Rgba(outClr, Math.min(1, Math.max(0, C.opOut * alphaMul)));
                          ctx.fill(pathOutVA);
                      }
                  }

                  // 🚀 CÂN CHỈNH LẠI DRAW LINES CHO KHỚP VỚI HƯỚNG VẼ
                  const lineStart = C.groupMode === 0 ? 0 : startX;
                  const lineEnd   = C.groupMode === 0 ? bounding.width : endX;
                  
                  const drawLvl = (price, clr, w, dash, txt, isIB = false) => {
                      const y = _getYPixel(yAxis, price); if (y === 0) return;
                      ctx.strokeStyle = _waTpoHex2Rgba(clr, isIB ? 0.6 : 0.85); ctx.lineWidth = w; ctx.setLineDash(dash);
                      ctx.beginPath();
                      ctx.moveTo(lineStart, y); ctx.lineTo(lineEnd, y); ctx.stroke(); ctx.setLineDash([]);

                      if (C.showLabels && !compactMode) {
                          ctx.fillStyle  = _waTpoHex2Rgba(clr, 0.95); ctx.font = `bold ${Math.max(8, C.fontSize - 1)}px sans-serif`;
                          ctx.textAlign  = C.isLeft ? 'left' : 'right';
                          const textX    = C.isLeft ? lineStart + 4 : lineEnd - 4;
                          ctx.fillText(`${txt} ${price.toFixed(2)}`, textX, y - 4);
                      }
                  };

                  if (prof.vahBin) drawLvl(prof.vahBin.pHigh, C.clrVaLine, C.vaW, _waTpoGetDash(C.vaStyle), 'VAH');
                  if (prof.valBin) drawLvl(prof.valBin.pLow,  C.clrVaLine, C.vaW, _waTpoGetDash(C.vaStyle), 'VAL');
                  if (prof.ibHigh && C.groupMode !== 0) drawLvl(prof.ibHigh, C.clrIbHigh, 1, [2, 2], 'IBH', true);
                  if (prof.ibLow  && C.groupMode !== 0) drawLvl(prof.ibLow,  C.clrIbLow,  1, [2, 2], 'IBL', true);

                  const pocY = _getYPixel(yAxis, prof.pocMid);
                  if (pocY !== 0) {
                      const isSuper = prof.isSuperPoc;
                      const clrPoc  = isSuper ? C.clrSuperPoc : (prof.isNaked ? C.clrNpoc : C.clrPoc);
                      ctx.strokeStyle = _waTpoHex2Rgba(clrPoc, 0.9);
                      ctx.lineWidth   = isSuper ? C.pocW + 1 : (prof.isNaked ? Math.max(1, C.pocW - 1) : C.pocW);
                      if (prof.isNaked && !isSuper) ctx.setLineDash([5, 4]);

                      ctx.beginPath();
                      ctx.moveTo(lineStart, pocY); ctx.lineTo(lineEnd, pocY);
                      
                      // 🚀 FIX LỖI TRÀN VIỀN NAKED POC: Kéo về đúng cạnh màn hình theo hướng neo
                      if (prof.isNaked && C.groupMode !== 0) {
                          const screenEdge = dir === 1 ? bounding.width : 0;
                          ctx.lineTo(screenEdge, pocY);
                      }
                      
                      ctx.stroke(); ctx.setLineDash([]);

                      if (C.showLabels && !compactMode) {
                          ctx.fillStyle = _waTpoHex2Rgba(clrPoc, 0.95); ctx.font = `bold ${C.fontSize}px sans-serif`;
                          ctx.textAlign = C.isLeft ? 'left' : 'right';
                          const textX   = C.isLeft ? lineStart + 4 : lineEnd - 4;
                          ctx.fillText(`POC ${prof.pocMid.toFixed(2)}`, textX, pocY - 4);
                      }
                  }

                  if (C.smartLabels && C.groupMode !== 0 && !compactMode) {
                      const lblY = _getYPixel(yAxis, prof.maxP);
                      if (lblY !== 0) {
                          const ly = lblY - 15;
                          ctx.textAlign = C.isLeft ? 'left' : 'right'; 
                          ctx.font = `bold ${Math.max(8, C.fontSize - 1)}px sans-serif`;
                          const lblAnchor = C.isLeft ? anchorX : anchorX; // Anchor cho text
                          
                          ctx.fillStyle = _waTpoHex2Rgba('#FFFFFF', 0.8);
                          ctx.fillText(`[${prof.shape}]`, lblAnchor, ly);

                          if (C.verbosity > 0) {
                              const imbClr = prof.imbalance === 'BUYING'  ? C.clrImbalBuy : prof.imbalance === 'SELLING' ? C.clrImbalSell : '#888888';
                              ctx.fillStyle = _waTpoHex2Rgba(imbClr, 0.8); 
                              const imbX = C.isLeft ? lblAnchor + 60 : lblAnchor - 60;
                              ctx.fillText(` Imb: ${prof.imbalance}`, imbX, ly);
                          }
                          if (C.verbosity > 1) {
                              const aucClr = prof.auctionState === 'ACCEPTANCE' ? C.clrAccept : prof.auctionState === 'REJECTION'  ? C.clrReject : '#888888';
                              ctx.fillStyle = _waTpoHex2Rgba(aucClr, 0.8); ctx.fillText(` | ${prof.auctionState}`, lblAnchor, ly - 14);
                          }
                      }
                  }
              });
          } catch (e) {
              console.error('[WAVE_TPO v5.1]', e);
          } finally {
              ctx.restore();
          }
          return false;
      }
  });
})();
    
// ── 1. VWAP_BANDS ─────────────────────────────────
    // Fix: uses utcDayIndex() instead of getUTCDate()
    // Formula: Volume-Weighted Standard Deviation (TradingView standard)
    kc.registerIndicator({
      name: 'VWAP_BANDS',
      shortName: 'VWAP',
      series: 'price',
      calcParams: [1, 2, 0], // mult1, mult2, anchorMode
      figures: [
        { key: 'upper2', title: 'UB2: ', type: 'line' },
        { key: 'upper1', title: 'UB1: ', type: 'line' },
        { key: 'vwap',   title: 'VWAP: ', type: 'line' },
        { key: 'lower1', title: 'LB1: ', type: 'line' },
        { key: 'lower2', title: 'LB2: ', type: 'line' },
      ],
      styles: {
        lines: [
          { color: COLOR.gold,  size: 1, style: 'dashed' }, // UB2
          { color: COLOR.cyan,  size: 1, style: 'solid'  }, // UB1
          { color: COLOR.white, size: 2, style: 'solid'  }, // VWAP
          { color: COLOR.cyan,  size: 1, style: 'solid'  }, // LB1
          { color: COLOR.gold,  size: 1, style: 'dashed' }, // LB2
        ],
      },
      calc: function (dataList, indicator) {
        const p = indicator.calcParams || [1, 2, 0];
        const mult1     = p[0] || 1;
        const mult2     = p[1] || 2;
        const anchorMode = p[2] || 0;

        let cumVol = 0, cumTP_Vol = 0, cumTP2_Vol = 0;
        let prevSession = -1;

        return dataList.map(function (d, i) {
          const curSession = sessionIndex(d.timestamp, anchorMode);

          // RESET on new session boundary — correct UTC day comparison
          if (curSession !== prevSession) {
            cumVol = 0; cumTP_Vol = 0; cumTP2_Vol = 0;
            prevSession = curSession;
          }

          const tp  = (d.high + d.low + d.close) / 3;
          const vol = d.volume || 0;

          cumVol    += vol;
          cumTP_Vol += tp * vol;
          cumTP2_Vol += vol * tp * tp; // for volume-weighted variance

          if (cumVol === 0) return {};

          const vwap = cumTP_Vol / cumVol;

          // Volume-Weighted Variance = Σ(vol*(tp-vwap)²) / Σvol
          // Equivalent: cumTP2_Vol/cumVol - vwap²  (algebraically identical, numerically stable)
          const variance = Math.max(0, (cumTP2_Vol / cumVol) - vwap * vwap);
          const sd       = Math.sqrt(variance);

          return {
            upper2: vwap + sd * mult2,
            upper1: vwap + sd * mult1,
            vwap:   vwap,
            lower1: vwap - sd * mult1,
            lower2: vwap - sd * mult2,
          };
        });
      },
    });
    // ── 2. ANCHORED_VWAP ──────────────────────────────
    kc.registerIndicator({
      name: 'ANCHORED_VWAP',
      shortName: 'AVWAP',
      series: 'price',
      calcParams: [0], // anchorTimestamp in ms (0 = use first bar)
      figures: [
        { key: 'avwap', title: 'AVWAP: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.gold, size: 2, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const anchorTs = indicator.calcParams[0] || 0;
        let started = anchorTs === 0; // if no anchor, start from first bar
        let cumVol = 0, cumTP_Vol = 0;

        return dataList.map(function (d) {
          if (!started) {
            if (d.timestamp >= anchorTs) started = true;
            else return {};
          }
          const tp  = (d.high + d.low + d.close) / 3;
          const vol = d.volume || 0;
          cumVol    += vol;
          cumTP_Vol += tp * vol;
          if (cumVol === 0) return {};
          return { avwap: cumTP_Vol / cumVol };
        });
      },
    });
    klinecharts.registerIndicator({
      name: 'WAVE_PAC',
      shortName: 'Wave PAC',
      series: 'price',
      calcParams: [34, 89, 200, 610],
      figures: [
        { key: 'pacH', title: 'PAC High: ', type: 'line' },
        { key: 'pacL', title: 'PAC Low: ', type: 'line' },
        { key: 'pacC', title: 'PAC Close: ', type: 'line' },
        { key: 'signal', title: 'Signal EMA: ', type: 'line' },
        { key: 'ema200', title: 'EMA 200: ', type: 'line' },
        { key: 'ema610', title: 'EMA 610: ', type: 'line' }
      ],
      styles: {
        lines: [
          { color: COLOR.muted, size: 1, style: 'dashed' },   // pacH - viền trên đứt nét
          { color: COLOR.muted, size: 1, style: 'dashed' },   // pacL - viền dưới đứt nét
          { color: COLOR.white, size: 2, style: 'solid' },    // pacC - trục chính nổi bật
          { color: COLOR.cyan, size: 2, style: 'solid' },     // signal - đường tín hiệu chính (Cyan của Wave Alpha)
          { color: COLOR.gold, size: 1, style: 'solid' },     // ema200 - dài hạn
          { color: COLOR.red, size: 1, style: 'solid' }       // ema610 - cực hạn
        ]
      },
      calc: function(dataList, indicator) {
        const [pacLen, sigLen, ema1Len, ema2Len] = indicator.calcParams;
        
        // Extract array data for math helpers
        const highs = dataList.map(d => d.high);
        const lows = dataList.map(d => d.low);
        const closes = dataList.map(d => d.close);
        
        // Calculate values using standard helpers
        const pacH_Arr = calcEMA(highs, pacLen);
        const pacL_Arr = calcEMA(lows, pacLen);
        const pacC_Arr = calcEMA(closes, pacLen);
        const sig_Arr = calcEMA(closes, sigLen);
        const ema200_Arr = calcEMA(closes, ema1Len);
        const ema610_Arr = calcEMA(closes, ema2Len);
    
        return dataList.map((d, i) => {
          const res = {};
          
          // Avoid returning NaN or undefined for early values
          if (pacH_Arr[i] !== undefined && !isNaN(pacH_Arr[i])) res.pacH = pacH_Arr[i];
          if (pacL_Arr[i] !== undefined && !isNaN(pacL_Arr[i])) res.pacL = pacL_Arr[i];
          if (pacC_Arr[i] !== undefined && !isNaN(pacC_Arr[i])) res.pacC = pacC_Arr[i];
          if (sig_Arr[i] !== undefined && !isNaN(sig_Arr[i])) res.signal = sig_Arr[i];
          if (ema200_Arr[i] !== undefined && !isNaN(ema200_Arr[i])) res.ema200 = ema200_Arr[i];
          if (ema610_Arr[i] !== undefined && !isNaN(ema610_Arr[i])) res.ema610 = ema610_Arr[i];
          
          return res;
        });
      }
    });// ── WAVE_BOOKMAP (BẢN ĐỒ NHIỆT THANH KHOẢN) ─────────────────
    kc.registerIndicator({
      name: 'WAVE_BOOKMAP',
      shortName: 'HMAP',
      series: 'price',
      calcParams: [5000], 
      figures: [],
      calc: function(dataList, indicator) {
        return dataList.map(() => ({}));
      },
      draw: function({ ctx, bounding, xAxis, yAxis, indicator }) {
        if (!window.bookmapHistory || !window.bookmapHistory.length || !window.tvChart) return false;

        const minValUSD = indicator.calcParams[0] || 5000; 
        
        // Lấy độ rộng thân nến an toàn
        let barSpace = 5;
        try {
            if (typeof window.tvChart.getBarSpace === 'function') {
                let bs = window.tvChart.getBarSpace();
                barSpace = (typeof bs === 'number') ? bs : (bs?.bar || 5);
            }
        } catch(e) {}

        try {
          ctx.save();
          ctx.globalCompositeOperation = 'screen'; 

          window.bookmapHistory.forEach(snap => {
            // ✅ FIX 1: Thêm { paneId: 'candle_pane' } để KLineCharts biết vẽ ở đâu
            let basePoint = window.tvChart.convertToPixel({ timestamp: snap.t }, { paneId: 'candle_pane' });
            if (!basePoint) return;
            let x = basePoint.x;

            if (x < -10 || x > bounding.width + 10) return;

            const drawList = (map, isAsk) => {
              map.forEach((vol, priceStr) => {
                const p = parseFloat(priceStr);
                const valUSD = p * vol;
                
                if (valUSD < minValUSD) return;

                // ✅ FIX 2: Dùng yAxis có sẵn để chuyển đổi Giá thành Tọa độ Y siêu mượt
                let y = yAxis.convertToPixel(p);
                if (y === null || y === undefined) return;

                const ratio = Math.min(1, valUSD / 500000); 
                ctx.fillStyle = isAsk 
                  ? `rgba(255, 80, 0, ${0.1 + ratio * 0.7})`  // Bán: Cam/Đỏ
                  : `rgba(0, 255, 150, ${0.1 + ratio * 0.7})`; // Mua: Xanh lá
                
                ctx.fillRect(x - barSpace/2, y - 2, barSpace, 4);
              });
            };
            
            drawList(snap.asks, true);
            drawList(snap.bids, false);
          });
        } catch(e) {
          // Bắt lỗi im lặng để không làm sập các chỉ báo khác
        } finally {
          ctx.restore();
        }
        return false;
      }
    });
    
    // ── 3. SUPERTREND ─────────────────────────────────
    kc.registerIndicator({
      name: 'SUPERTREND',
      shortName: 'ST',
      series: 'price',
      calcParams: [10, 3.0],
      figures: [
        { key: 'supertrend', title: 'ST: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.green, size: 2, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 10;
        const mult   = indicator.calcParams[1] || 3.0;
        const atr    = calcATR(dataList, period);
        const result = new Array(dataList.length).fill({});
        let trend = 1; // 1 = up, -1 = down
        let prevUpper = 0, prevLower = 0;

        for (let i = period; i < dataList.length; i++) {
          const d  = dataList[i];
          const hl2 = (d.high + d.low) / 2;
          let upperBand = hl2 + mult * atr[i];
          let lowerBand = hl2 - mult * atr[i];

          // Adjust bands
          if (lowerBand < prevLower || dataList[i - 1].close < prevLower) lowerBand = lowerBand;
          else lowerBand = Math.max(lowerBand, prevLower);

          if (upperBand > prevUpper || dataList[i - 1].close > prevUpper) upperBand = upperBand;
          else upperBand = Math.min(upperBand, prevUpper);

          if (trend === 1 && d.close < lowerBand) trend = -1;
          else if (trend === -1 && d.close > upperBand) trend = 1;

          const stValue = trend === 1 ? lowerBand : upperBand;
          // Encode color via value sign trick — draw engine picks color from styles
          result[i] = {
            supertrend: stValue,
            // We use a secondary key to convey direction for color override
            _trend: trend,
          };

          prevUpper = upperBand;
          prevLower = lowerBand;
        }
        return result;
      },
    });

    // ── 4. PIVOT_POINTS ───────────────────────────────
    kc.registerIndicator({
      name: 'PIVOT_POINTS',
      shortName: 'PP',
      series: 'price',
      calcParams: [0], // 0=Daily,1=Weekly,2=Monthly
      figures: [
        { key: 'pp', title: 'PP: ', type: 'line' },
        { key: 'r1', title: 'R1: ', type: 'line' },
        { key: 'r2', title: 'R2: ', type: 'line' },
        { key: 'r3', title: 'R3: ', type: 'line' },
        { key: 's1', title: 'S1: ', type: 'line' },
        { key: 's2', title: 'S2: ', type: 'line' },
        { key: 's3', title: 'S3: ', type: 'line' },
      ],
      styles: {
        lines: [
          { color: COLOR.white, size: 1, style: 'dashed' }, // PP
          { color: COLOR.red,   size: 1, style: 'dashed' }, // R1
          { color: COLOR.red,   size: 1, style: 'dotted' }, // R2
          { color: COLOR.red,   size: 1, style: 'dotted' }, // R3
          { color: COLOR.green, size: 1, style: 'dashed' }, // S1
          { color: COLOR.green, size: 1, style: 'dotted' }, // S2
          { color: COLOR.green, size: 1, style: 'dotted' }, // S3
        ],
      },
      calc: function (dataList, indicator) {
        const mode = indicator.calcParams[0] || 0;
        const result = new Array(dataList.length).fill({});
        let prevHigh = 0, prevLow = 0, prevClose = 0;
        let curSessionH = -Infinity, curSessionL = Infinity, curSessionC = 0;
        let prevSession = -1;
        let currentPivot = null;

        for (let i = 0; i < dataList.length; i++) {
          const d = dataList[i];
          const curSession = sessionIndex(d.timestamp, mode);

          if (curSession !== prevSession) {
            if (prevSession !== -1) {
              // Calculate pivot from previous session's OHLC
              currentPivot = calcPivotPoints(curSessionH, curSessionL, prevClose);
            }
            curSessionH = d.high;
            curSessionL = d.low;
            prevSession = curSession;
          } else {
            curSessionH = Math.max(curSessionH, d.high);
            curSessionL = Math.min(curSessionL, d.low);
          }
          prevClose = d.close;

          result[i] = currentPivot ? Object.assign({}, currentPivot) : {};
        }
        return result;
      },
    });

    // ── 5. STOCH ──────────────────────────────────────
    kc.registerIndicator({
      name: 'STOCH',
      shortName: 'STOCH',
      series: 'normal',
      calcParams: [14, 3, 3],
      figures: [
        { key: 'k', title: '%K: ', type: 'line' },
        { key: 'd', title: '%D: ', type: 'line' },
      ],
      styles: {
        lines: [
          { color: COLOR.cyan, size: 1, style: 'solid' },
          { color: COLOR.red,  size: 1, style: 'solid' },
        ],
      },
      calc: function (dataList, indicator) {
        const p = indicator.calcParams;
        const stoch = calcStoch(dataList, p[0] || 14, p[1] || 3, p[2] || 3);
        return dataList.map(function (_, i) {
          return { k: stoch.k[i], d: stoch.d[i] };
        });
      },
    });

    // ── 6. STOCH_RSI ──────────────────────────────────
    kc.registerIndicator({
      name: 'STOCH_RSI',
      shortName: 'StochRSI',
      series: 'normal',
      calcParams: [14, 14, 3, 3],
      figures: [
        { key: 'k', title: 'K: ', type: 'line' },
        { key: 'd', title: 'D: ', type: 'line' },
      ],
      styles: {
        lines: [
          { color: COLOR.cyan, size: 1, style: 'solid' },
          { color: COLOR.gold, size: 1, style: 'solid' },
        ],
      },
      calc: function (dataList, indicator) {
        const rsiLen   = indicator.calcParams[0] || 14;
        const stochLen = indicator.calcParams[1] || 14;
        const kSmooth  = indicator.calcParams[2] || 3;
        const dSmooth  = indicator.calcParams[3] || 3;

        // Step 1: compute RSI values
        const gains = [], losses = [];
        for (let i = 0; i < dataList.length; i++) {
          const diff = i > 0 ? dataList[i].close - dataList[i - 1].close : 0;
          gains.push(Math.max(0, diff));
          losses.push(Math.max(0, -diff));
        }
        const avgGain = calcRMA(gains, rsiLen);
        const avgLoss = calcRMA(losses, rsiLen);
        const rsiArr  = avgGain.map(function (g, i) {
          const l = avgLoss[i];
          return l === 0 ? 100 : 100 - 100 / (1 + g / l);
        });

        // Step 2: Stochastic on RSI
        const stochRsi = rsiArr.map(function (_, i) {
          if (i < stochLen - 1) return NaN;
          let hh = -Infinity, ll = Infinity;
          for (let j = i - stochLen + 1; j <= i; j++) {
            if (isNaN(rsiArr[j])) continue;
            hh = Math.max(hh, rsiArr[j]);
            ll = Math.min(ll, rsiArr[j]);
          }
          return hh === ll ? 50 : ((rsiArr[i] - ll) / (hh - ll)) * 100;
        });

        const kArr = calcSMA(stochRsi.map(function (v) { return isNaN(v) ? 0 : v; }), kSmooth);
        const dArr = calcSMA(kArr, dSmooth);

        return dataList.map(function (_, i) {
          return { k: kArr[i], d: dArr[i] };
        });
      },
    });

    // ── 7. CCI ────────────────────────────────────────
    kc.registerIndicator({
      name: 'CCI',
      shortName: 'CCI',
      series: 'normal',
      calcParams: [20],
      figures: [
        { key: 'cci', title: 'CCI: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.cyan, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 20;
        return dataList.map(function (d, i) {
          if (i < period - 1) return {};
          const slice = dataList.slice(i - period + 1, i + 1);
          const tps   = slice.map(function (x) { return (x.high + x.low + x.close) / 3; });
          const tp    = tps[tps.length - 1];
          const mean  = tps.reduce(function (s, v) { return s + v; }, 0) / period;
          const md    = tps.reduce(function (s, v) { return s + Math.abs(v - mean); }, 0) / period;
          return { cci: md === 0 ? 0 : (tp - mean) / (0.015 * md) };
        });
      },
    });

    // ── 8. WILLIAMS_R ─────────────────────────────────
    kc.registerIndicator({
      name: 'WILLIAMS_R',
      shortName: '%R',
      series: 'normal',
      calcParams: [14],
      figures: [
        { key: 'wr', title: '%R: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.cyan, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 14;
        return dataList.map(function (d, i) {
          if (i < period - 1) return {};
          let hh = -Infinity, ll = Infinity;
          for (let j = i - period + 1; j <= i; j++) {
            hh = Math.max(hh, dataList[j].high);
            ll = Math.min(ll, dataList[j].low);
          }
          return { wr: hh === ll ? -50 : ((hh - d.close) / (hh - ll)) * -100 };
        });
      },
    });

    // ── 9. MFI ────────────────────────────────────────
    kc.registerIndicator({
      name: 'MFI',
      shortName: 'MFI',
      series: 'normal',
      calcParams: [14],
      figures: [
        { key: 'mfi', title: 'MFI: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.gold, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 14;
        return dataList.map(function (d, i) {
          if (i < period) return {};
          let posFlow = 0, negFlow = 0;
          for (let j = i - period + 1; j <= i; j++) {
            const tp   = (dataList[j].high + dataList[j].low + dataList[j].close) / 3;
            const vol  = dataList[j].volume || 0;
            const mf   = tp * vol;
            const ptp  = j > 0 ? (dataList[j - 1].high + dataList[j - 1].low + dataList[j - 1].close) / 3 : tp;
            if (tp >= ptp) posFlow += mf;
            else negFlow += mf;
          }
          return { mfi: negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow) };
        });
      },
    });

    // ── 10. DPO ───────────────────────────────────────
    kc.registerIndicator({
      name: 'DPO',
      shortName: 'DPO',
      series: 'normal',
      calcParams: [20],
      figures: [
        { key: 'dpo', title: 'DPO: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.cyan, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period   = indicator.calcParams[0] || 20;
        const closes   = dataList.map(function (d) { return d.close; });
        const smaArr   = calcSMA(closes, period);
        const shift    = Math.floor(period / 2) + 1;
        return dataList.map(function (d, i) {
          const idx = i - shift;
          if (idx < 0 || isNaN(smaArr[idx])) return {};
          return { dpo: d.close - smaArr[idx] };
        });
      },
    });

    // ── 11. ATR ───────────────────────────────────────
    kc.registerIndicator({
      name: 'ATR',
      shortName: 'ATR',
      series: 'normal',
      calcParams: [14],
      figures: [
        { key: 'atr', title: 'ATR: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.gold, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 14;
        const atr    = calcATR(dataList, period);
        return dataList.map(function (_, i) {
          return isNaN(atr[i]) ? {} : { atr: atr[i] };
        });
      },
    });

    // ── 12. CHAIKIN_VOL ───────────────────────────────
    kc.registerIndicator({
      name: 'CHAIKIN_VOL',
      shortName: 'ChVol',
      series: 'normal',
      calcParams: [10, 10],
      figures: [
        { key: 'cv', title: 'ChVol: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.cyan, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const emaPeriod = indicator.calcParams[0] || 10;
        const rocPeriod = indicator.calcParams[1] || 10;
        const hl        = dataList.map(function (d) { return d.high - d.low; });
        const emaHL     = calcEMA(hl, emaPeriod);
        return dataList.map(function (_, i) {
          const prev = i - rocPeriod;
          if (prev < 0 || isNaN(emaHL[i]) || isNaN(emaHL[prev])) return {};
          return { cv: emaHL[prev] === 0 ? 0 : ((emaHL[i] - emaHL[prev]) / emaHL[prev]) * 100 };
        });
      },
    });

    // ── 13. OBV ───────────────────────────────────────
    kc.registerIndicator({
      name: 'OBV',
      shortName: 'OBV',
      series: 'normal',
      calcParams: [],
      figures: [
        { key: 'obv', title: 'OBV: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.green, size: 1, style: 'solid' }],
      },
      calc: function (dataList) {
        let obv = 0;
        return dataList.map(function (d, i) {
          if (i === 0) { obv = d.volume || 0; return { obv: obv }; }
          const prev = dataList[i - 1];
          if (d.close > prev.close)      obv += d.volume || 0;
          else if (d.close < prev.close) obv -= d.volume || 0;
          return { obv: obv };
        });
      },
    });

    // ── 14. CMF ───────────────────────────────────────
    kc.registerIndicator({
      name: 'CMF',
      shortName: 'CMF',
      series: 'normal',
      calcParams: [20],
      figures: [
        { key: 'cmf', title: 'CMF: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.cyan, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 20;
        return dataList.map(function (d, i) {
          if (i < period - 1) return {};
          let mfvSum = 0, volSum = 0;
          for (let j = i - period + 1; j <= i; j++) {
            const x = dataList[j];
            const hl = x.high - x.low;
            const mfm = hl === 0 ? 0 : ((x.close - x.low) - (x.high - x.close)) / hl;
            mfvSum += mfm * (x.volume || 0);
            volSum += x.volume || 0;
          }
          return { cmf: volSum === 0 ? 0 : mfvSum / volSum };
        });
      },
    });

    // ── 15. FORCE_INDEX ───────────────────────────────
    kc.registerIndicator({
      name: 'FORCE_INDEX',
      shortName: 'FI',
      series: 'normal',
      calcParams: [13],
      figures: [
        { key: 'fi', title: 'FI: ', type: 'line' },
      ],
      styles: {
        lines: [{ color: COLOR.green, size: 1, style: 'solid' }],
      },
      calc: function (dataList, indicator) {
        const period = indicator.calcParams[0] || 13;
        const raw    = dataList.map(function (d, i) {
          if (i === 0) return 0;
          return (d.close - dataList[i - 1].close) * (d.volume || 0);
        });
        const emaFI  = calcEMA(raw, period);
        return dataList.map(function (_, i) {
          return isNaN(emaFI[i]) ? {} : { fi: emaFI[i] };
        });
      },
    });
    klinecharts.registerIndicator({
      name: 'WAVE_ADVANCED_RSI',
      shortName: 'RSI',
      series: 'normal',
      calcParams: [14, 0, 14, 2.0, 1],
      figures: [
        { key: 'rsi', title: 'RSI: ', type: 'line' },
        { key: 'rsiMA', title: 'MA: ', type: 'line' }
      ],
      styles: {
        // Bật nhãn Realtime Native (Gắn trên cột số Y-Axis) cho riêng chỉ báo này
        indicator: {
          lastValueMark: {
            show: true
          }
        },
        lines: [
          { color: '#00E5FF', size: 1.4, style: 'solid' },   // RSI - Electric Cyan (nổi bật)
          { color: '#FFD166', size: 1.2, style: 'solid' }    // MA - Soft Gold (premium)
        ]
      },
      calc: function(dataList, indicator) {
        const rsiLen = indicator.calcParams[0];
        const maType = indicator.calcParams[1]; 
        const maLen = indicator.calcParams[2];
        const bbMult = indicator.calcParams[3];
        const showDiv = indicator.calcParams[4];
        const dataSize = dataList.length;
  
        const gains = new Array(dataSize).fill(0);
        const losses = new Array(dataSize).fill(0);
        for (let i = 1; i < dataSize; i++) {
          let diff = dataList[i].close - dataList[i-1].close;
          if (diff > 0) gains[i] = diff;
          else losses[i] = -diff;
        }
        
        const avgGains = calcRMA(gains, rsiLen);
        const avgLosses = calcRMA(losses, rsiLen);
        
        const rsiData = new Array(dataSize).fill(0);
        for (let i = 1; i < dataSize; i++) {
          const g = avgGains[i] || 0;
          const l = avgLosses[i] || 0;
          if (l === 0) rsiData[i] = 100;
          else if (g === 0) rsiData[i] = 0;
          else rsiData[i] = 100 - (100 / (1 + (g / l)));
        }
  
        let rsiMA = [];
        if (maType === 0 || maType === 1) rsiMA = calcSMA(rsiData, maLen);
        else if (maType === 2) rsiMA = calcEMA(rsiData, maLen);
        else if (maType === 3) rsiMA = calcRMA(rsiData, maLen);
        else if (maType === 4) { 
          let norm = 0; for(let j=1; j<=maLen; j++) norm += j;
          for (let i = 0; i < dataSize; i++) {
            if (i < maLen - 1) { rsiMA.push(0); continue; }
            let sum = 0;
            for(let j=0; j<maLen; j++) sum += rsiData[i - j] * (maLen - j);
            rsiMA.push(sum / norm);
          }
        } else if (maType === 5) { 
          for (let i = 0; i < dataSize; i++) {
            if (i < maLen - 1) { rsiMA.push(0); continue; }
            let sumPV = 0, sumV = 0;
            for(let j=0; j<maLen; j++) {
              let v = dataList[i-j].volume || 0;
              sumPV += rsiData[i-j] * v;
              sumV += v;
            }
            rsiMA.push(sumV === 0 ? 0 : sumPV / sumV);
          }
        }
  
        const results = new Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
          let res = {
            rsi: rsiData[i],
            rsiMA: rsiMA[i] || 0
          };
  
          if (maType === 1 && i >= maLen - 1) {
            let mean = rsiMA[i];
            let sumSq = 0;
            for(let j=0; j<maLen; j++) sumSq += Math.pow(rsiData[i-j] - mean, 2);
            let stdDev = Math.sqrt(sumSq / maLen);
            res.bbUpper = mean + stdDev * bbMult;
            res.bbLower = mean - stdDev * bbMult;
          }
          results[i] = res;
        }
  
        if (showDiv === 1) {
          let lastPL = null, lastPH = null;
          for (let i = 10; i < dataSize; i++) {
            let p = i - 5; 
            let isPL = true, isPH = true;
            for (let j = 1; j <= 5; j++) {
              if (rsiData[p] >= rsiData[p-j] || rsiData[p] > rsiData[p+j]) isPL = false;
              if (rsiData[p] <= rsiData[p-j] || rsiData[p] < rsiData[p+j]) isPH = false;
            }
            
            if (isPL) {
              if (lastPL) {
                let bars = p - lastPL.idx;
                if (bars >= 5 && bars <= 60 && rsiData[p] > lastPL.rsi && dataList[p].low < lastPL.low) {
                  results[p].bullDiv = { startI: lastPL.idx, startRSI: lastPL.rsi, endRSI: rsiData[p] };
                }
              }
              lastPL = { idx: p, rsi: rsiData[p], low: dataList[p].low };
            }
            
            if (isPH) {
              if (lastPH) {
                let bars = p - lastPH.idx;
                if (bars >= 5 && bars <= 60 && rsiData[p] < lastPH.rsi && dataList[p].high > lastPH.high) {
                  results[p].bearDiv = { startI: lastPH.idx, startRSI: lastPH.rsi, endRSI: rsiData[p] };
                }
              }
              lastPH = { idx: p, rsi: rsiData[p], high: dataList[p].high };
            }
          }
        }
        return results;
      },
  
      draw: function({ ctx, visibleRange, indicator, xAxis, yAxis, bounding }) {
        const { from, to } = visibleRange;
        const res = indicator.result;
        
        const startX = xAxis.convertToPixel(from);
        const endX = xAxis.convertToPixel(to - 1);
        
        const y70 = yAxis.convertToPixel(70);
        const y50 = yAxis.convertToPixel(50);
        const y30 = yAxis.convertToPixel(30);
  
        const fullWidth = bounding.width; 
  
        // ==========================================
        // 1. VẼ CON ĐƯỜNG VÔ CỰC (FULL SPAN)
        // ==========================================
        ctx.save();
        
        // Nền tím 
        ctx.fillStyle = 'rgba(20, 24, 35, 0.65)'; // deep glass dark (pro chart feel)
        ctx.fillRect(0, y70, fullWidth, y30 - y70);
  
        // Đường 30 và 70 (Nét đứt, mỏng 1px)
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(160, 174, 192, 0.35)'; // neutral institutional gray
        ctx.setLineDash([10, 8]); 
        ctx.beginPath(); ctx.moveTo(0, y70); ctx.lineTo(fullWidth, y70); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y30); ctx.lineTo(fullWidth, y30); ctx.stroke();
  
        // Đường 50 (Nét đứt thưa, dày 2px và màu trắng)
        ctx.lineWidth = 2; // Dày hơn đường 30/70
        ctx.strokeStyle = COLOR.white;
        ctx.setLineDash([15, 10]);
        ctx.beginPath(); ctx.moveTo(0, y50); ctx.lineTo(fullWidth, y50); ctx.stroke();
        
        ctx.restore();
  
        // ==========================================
        // 2. VẼ BOLLINGER BANDS
        // ==========================================
        if (indicator.calcParams[1] === 1) {
          ctx.save();
          ctx.lineWidth = 1;
          ctx.strokeStyle = '#00FFA3'; // neon mint - pro
          
          ctx.beginPath();
          let hasUp = false;
          for (let i = from; i < to; i++) {
            if (res[i] && res[i].bbUpper !== undefined) {
              let x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(res[i].bbUpper);
              if (!hasUp) { ctx.moveTo(x, y); hasUp = true; } else ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
  
          ctx.beginPath();
          let hasLow = false;
          for (let i = from; i < to; i++) {
            if (res[i] && res[i].bbLower !== undefined) {
              let x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(res[i].bbLower);
              if (!hasLow) { ctx.moveTo(x, y); hasLow = true; } else ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
  
          ctx.fillStyle = 'rgba(0, 255, 163, 0.08)'; // mượt hơn, ít gắt
          ctx.beginPath();
          hasUp = false;
          for (let i = from; i < to; i++) {
            if (res[i] && res[i].bbUpper !== undefined) {
              let x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(res[i].bbUpper);
              if (!hasUp) { ctx.moveTo(x, y); hasUp = true; } else ctx.lineTo(x, y);
            }
          }
          if (hasUp) {
            for (let i = to - 1; i >= from; i--) {
              if (res[i] && res[i].bbLower !== undefined) {
                ctx.lineTo(xAxis.convertToPixel(i), yAxis.convertToPixel(res[i].bbLower));
              }
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
  
        // ==========================================
        // 3. VẼ GRADIENTS QUÁ MUA / QUÁ BÁN
        // ==========================================
        let y100 = yAxis.convertToPixel(100);
        let y0 = yAxis.convertToPixel(0);
        
        let gradOB = Math.abs(y70 - y100) > 1 ? ctx.createLinearGradient(0, y100, 0, y70) : 'rgba(14, 203, 129, 0.5)';
        if (typeof gradOB !== 'string') {
          gradOB.addColorStop(0, 'rgba(0, 255, 163, 0.55)');
gradOB.addColorStop(0.5, 'rgba(0, 255, 163, 0.25)');
gradOB.addColorStop(1, 'rgba(0, 255, 163, 0)');
        }
  
        let gradOS = Math.abs(y0 - y30) > 1 ? ctx.createLinearGradient(0, y30, 0, y0) : 'rgba(246, 70, 93, 0.5)';
        if (typeof gradOS !== 'string') {
          gradOS.addColorStop(0, 'rgba(255, 82, 82, 0)');
gradOS.addColorStop(0.5, 'rgba(255, 82, 82, 0.25)');
gradOS.addColorStop(1, 'rgba(255, 82, 82, 0.55)');
        }
  
        ctx.fillStyle = gradOB;
        ctx.beginPath();
        let inOB = false;
        for (let i = from; i < to; i++) {
          if (!res[i] || res[i].rsi === undefined) continue;
          let rsi = res[i].rsi;
          let currX = xAxis.convertToPixel(i);
          let currY = yAxis.convertToPixel(rsi);
          
          if (rsi > 70) {
            if (!inOB) {
              inOB = true;
              let prevRsi = res[i-1]?.rsi;
              if (prevRsi !== undefined && prevRsi <= 70) {
                let prevX = xAxis.convertToPixel(i-1), prevY = yAxis.convertToPixel(prevRsi);
                let interX = prevX + (currX - prevX) * ((y70 - prevY) / (currY - prevY));
                ctx.moveTo(interX, y70);
              } else ctx.moveTo(currX, y70);
            }
            ctx.lineTo(currX, currY);
          } else if (inOB) {
            inOB = false;
            let prevRsi = res[i-1]?.rsi;
            if (prevRsi !== undefined && prevRsi > 70) {
              let prevX = xAxis.convertToPixel(i-1), prevY = yAxis.convertToPixel(prevRsi);
              let interX = prevX + (currX - prevX) * ((y70 - prevY) / (currY - prevY));
              ctx.lineTo(interX, y70);
            } else ctx.lineTo(currX, y70);
          }
        }
        if (inOB) ctx.lineTo(xAxis.convertToPixel(to - 1), y70);
        ctx.fill();
  
        ctx.fillStyle = gradOS;
        ctx.beginPath();
        let inOS = false;
        for (let i = from; i < to; i++) {
          if (!res[i] || res[i].rsi === undefined) continue;
          let rsi = res[i].rsi;
          let currX = xAxis.convertToPixel(i);
          let currY = yAxis.convertToPixel(rsi);
          
          if (rsi < 30) {
            if (!inOS) {
              inOS = true;
              let prevRsi = res[i-1]?.rsi;
              if (prevRsi !== undefined && prevRsi >= 30) {
                let prevX = xAxis.convertToPixel(i-1), prevY = yAxis.convertToPixel(prevRsi);
                let interX = prevX + (currX - prevX) * ((y30 - prevY) / (currY - prevY));
                ctx.moveTo(interX, y30);
              } else ctx.moveTo(currX, y30);
            }
            ctx.lineTo(currX, currY);
          } else if (inOS) {
            inOS = false;
            let prevRsi = res[i-1]?.rsi;
            if (prevRsi !== undefined && prevRsi < 30) {
              let prevX = xAxis.convertToPixel(i-1), prevY = yAxis.convertToPixel(prevRsi);
              let interX = prevX + (currX - prevX) * ((y30 - prevY) / (currY - prevY));
              ctx.lineTo(interX, y30);
            } else ctx.lineTo(currX, y30);
          }
        }
        if (inOS) ctx.lineTo(xAxis.convertToPixel(to - 1), y30);
        ctx.fill();
  
        // ==========================================
        // 4. VẼ PHÂN KỲ (DIVERGENCE LABELS & LINES)
        // ==========================================
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; 
  
        const boxW = 32;
        const boxH = 16;
        const radius = 3;
  
        for (let i = from; i < to; i++) {
          if (res[i]) {
            let x = xAxis.convertToPixel(i);
  
            if (res[i].bullDiv !== undefined) {
              let y = yAxis.convertToPixel(res[i].bullDiv.endRSI);
              
              ctx.beginPath();
              ctx.moveTo(xAxis.convertToPixel(res[i].bullDiv.startI), yAxis.convertToPixel(res[i].bullDiv.startRSI));
              ctx.lineTo(x, y);
              ctx.strokeStyle = '#00FFA3';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 4]); 
              ctx.stroke();
              ctx.setLineDash([]); 
              
              let labelY = y + 5;
              if (labelY + boxH > bounding.height - 2) labelY = bounding.height - boxH - 2;
  
              ctx.fillStyle = '#00C897';
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(x - boxW/2, labelY, boxW, boxH, radius);
              else ctx.rect(x - boxW/2, labelY, boxW, boxH); 
              ctx.fill();
  
              ctx.fillStyle = COLOR.white;
              ctx.fillText('Bull', x, labelY + boxH/2);
            }
  
            if (res[i].bearDiv !== undefined) {
              let y = yAxis.convertToPixel(res[i].bearDiv.endRSI);
              
              ctx.beginPath();
              ctx.moveTo(xAxis.convertToPixel(res[i].bearDiv.startI), yAxis.convertToPixel(res[i].bearDiv.startRSI));
              ctx.lineTo(x, y);
              ctx.strokeStyle = '#FF5252';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 4]);
              ctx.stroke();
              ctx.setLineDash([]);
  
              let labelY = y - 5 - boxH;
              if (labelY < 2) labelY = 2;
  
              ctx.fillStyle = '#D63031';
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(x - boxW/2, labelY, boxW, boxH, radius);
              else ctx.rect(x - boxW/2, labelY, boxW, boxH);
              ctx.fill();
  
              ctx.fillStyle = COLOR.white;
              ctx.fillText('Bear', x, labelY + boxH/2);
            }
          }
        }
        ctx.restore();
  
        return false; // KLineCharts tự vẽ đè tiếp đường Line RSI và Line MA lên trên
      }
    });
    console.log('[Wave Alpha v' + WAVE_ALPHA_VERSION + '] ✅ Đã đăng ký ' +
      INDICATOR_REGISTRY.filter(function (x) { return !x.builtIn; }).length +
      ' custom indicators');
  };

  // ══════════════════════════════════════════════════════
  // SECTION 5: UI COMPONENTS
  // Modals, topbar buttons — auto-rendered from INDICATOR_REGISTRY
  // ══════════════════════════════════════════════════════

  /**
   * Category definitions for tab rendering
   */
  const CATEGORIES = [
    { key: 'all',        label: 'TẤT CẢ'   },
    { key: 'wave_alpha', label: '⚡ WAVE ALPHA' },
    { key: 'trend',      label: 'XU HƯỚNG'  },
    { key: 'oscillator', label: 'DAO ĐỘNG'  },
    { key: 'volume',     label: 'KHỐI LƯỢNG'},
    { key: 'volatility', label: 'BIẾN ĐỘNG' },
  ];

  const SVG_ICONS = {
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>',
    gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
  };

  function buildIndicatorModalHTML() {
    const catTabsHTML = CATEGORIES.map((cat, i) => `<button class="wa-cat-tab ${i === 0 ? 'active' : ''}" data-cat="${cat.key}">${cat.label}</button>`).join('');
    
    return `
      <div id="sc-indicator-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999999; background:transparent; justify-content:center; align-items:center; opacity:0; visibility:hidden; transition:all 0.15s ease;">
        <div id="wa-ind-modal-box" class="wa-imm-box">
          
          <div class="wa-imm-header" style="cursor: grab; user-select: none;">
            <div style="font-size:16px; font-weight:700; color:#EAECEF;">Chỉ Báo Kỹ Thuật</div>
            <button id="wa-ind-modal-close" style="background:transparent; border:none; color:#848e9c; cursor:pointer; display:flex; padding:4px; margin:-4px; transition:0.2s;" onmouseover="this.style.color='#f6465d'" onmouseout="this.style.color='#848e9c'">${SVG_ICONS.close}</button>
          </div>

          <div style="padding:16px 24px; background:#131722; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="position:relative; display:flex; align-items:center;">
              <span style="position:absolute; left:12px; color:#848e9c; display:flex;">${SVG_ICONS.search}</span>
              <input id="wa-ind-search" type="text" placeholder="Tìm kiếm chỉ báo..." autocomplete="off" style="width:100%; background:#1e222d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:10px 12px 10px 36px; color:#EAECEF; font-size:13px; outline:none; transition:0.2s;">
            </div>
          </div>

          <div style="display:flex; padding:0 24px; background:#131722; gap:20px; border-bottom:1px solid rgba(255,255,255,0.02);">
            <div class="wa-imm-main-tab active" data-maintab="library">THƯ VIỆN</div>
            <div class="wa-imm-main-tab" data-maintab="active">ĐANG HOẠT ĐỘNG <span id="wa-ind-active-count" style="background:rgba(38,166,154,0.2); color:#26a69a; padding:2px 6px; border-radius:10px; font-size:10px; margin-left:4px;">0</span></div>
          </div>

          <div id="wa-ind-cat-tabs" style="display:flex; gap:6px; padding:12px 24px 0; overflow-x:auto; scrollbar-width:none; background:#1e222d;">
            ${catTabsHTML}
          </div>

          <div id="wa-ind-list" class="wa-imm-content"></div>
          
          <div id="wa-ind-empty" style="display:none; flex:1; align-items:center; justify-content:center; color:#527c82; font-size:13px;">Không tìm thấy chỉ báo phù hợp</div>
        </div>
      </div>
    `;
  }

  let currentMainTab = 'library';
  let currentCategory = 'all';

  function renderIndicatorList(query) {
    const list = document.getElementById('wa-ind-list');
    const empty = document.getElementById('wa-ind-empty');
    const catTabs = document.getElementById('wa-ind-cat-tabs');
    if (!list) return;

    list.innerHTML = '';
    const activeCount = global.scActiveIndicators ? global.scActiveIndicators.length : 0;
    const countBadge = document.getElementById('wa-ind-active-count');
    if (countBadge) countBadge.innerText = activeCount;

    if (currentMainTab === 'library') {
      catTabs.style.display = 'flex';
      const q = (query || '').toLowerCase().trim();
      const filtered = INDICATOR_REGISTRY.filter(ind => {
        const matchCat = currentCategory === 'all' || ind.category === currentCategory;
        const matchQ = !q || ind.name.toLowerCase().includes(q) || ind.shortName.toLowerCase().includes(q) || ind.description.toLowerCase().includes(q);
        return matchCat && matchQ;
      });

      if (filtered.length === 0) {
        list.style.display = 'none'; empty.style.display = 'flex'; empty.innerText = 'Không tìm thấy chỉ báo phù hợp'; return;
      }
      list.style.display = 'block'; empty.style.display = 'none';

      filtered.forEach(ind => {
        const isActive = global.scActiveIndicators && global.scActiveIndicators.some(x => x.name === ind.name);
        const isWave = ind.category === 'wave_alpha';

        const item = document.createElement('div');
        item.className = 'wa-imm-item';
        item.innerHTML = `
          <div class="wa-imm-item-info">
            <div class="wa-imm-item-name" style="color: ${isWave ? COLOR.cyan : COLOR.white};">${ind.shortName} ${isWave ? '<span style="color:#F0B90B;font-size:10px;">★</span>' : ''}</div>
            <div class="wa-imm-item-desc">${ind.description}</div>
          </div>
          ${isActive 
            ? '<span style="font-size:10px; background:rgba(0,240,255,0.1); color:#00F0FF; padding:4px 8px; border-radius:4px; border:1px solid rgba(0,240,255,0.2); flex-shrink:0;">Đang dùng</span>'
            : '<button class="wa-imm-add-btn" style="display:flex; align-items:center; gap:4px;">+ Thêm</button>'
          }
        `;

        if (!isActive) {
          item.onclick = () => {
            global.addIndicatorToChart(ind.name);
            renderIndicatorList(document.getElementById('wa-ind-search').value);
          };
        }
        list.appendChild(item);
      });
    } else {
      catTabs.style.display = 'none';
      if (activeCount === 0) {
        list.style.display = 'none'; empty.style.display = 'flex'; empty.innerText = 'Không có chỉ báo nào đang hoạt động'; return;
      }
      list.style.display = 'block'; empty.style.display = 'none';

      global.scActiveIndicators.forEach(ind => {
        const meta = INDICATOR_REGISTRY.find(x => x.name === ind.name);
        const isVisible = ind.visible !== false;
        const item = document.createElement('div');
        item.className = 'wa-imm-item';
        item.innerHTML = `
          <div class="wa-imm-item-info">
            <div class="wa-imm-item-name">${meta ? meta.shortName : ind.name}</div>
            <div class="wa-imm-item-desc">Đang chạy trên biểu đồ</div>
          </div>
          <div class="wa-imm-actions">
            <button class="wa-imm-action-btn toggle-vis" title="Ẩn/Hiện" style="color: ${isVisible ? '#848e9c' : '#f6465d'}; display:flex; padding:6px;">${isVisible ? SVG_ICONS.eye : SVG_ICONS.eyeOff}</button>
            <button class="wa-imm-action-btn open-set" title="Cài đặt" style="display:flex; padding:6px;">${SVG_ICONS.gear}</button>
            <button class="wa-imm-action-btn remove" title="Xóa" style="display:flex; padding:6px;">${SVG_ICONS.trash}</button>
          </div>
        `;

        item.querySelector('.toggle-vis').onclick = (e) => {
          e.stopPropagation();
          ind.visible = !isVisible;
          if (window.tvChart) window.tvChart.overrideIndicator({ name: ind.name, visible: ind.visible }, ind.paneId);
          renderIndicatorList(document.getElementById('wa-ind-search').value);
        };
        item.querySelector('.open-set').onclick = (e) => {
          e.stopPropagation();
          document.getElementById('wa-ind-modal-close').click();
          if (typeof global.openIndicatorSettings === 'function') global.openIndicatorSettings({ name: ind.name, calcParams: ind.params }, ind.paneId);
        };
        item.querySelector('.remove').onclick = (e) => {
          e.stopPropagation();
          if (typeof global.removeIndicatorFromChart === 'function') global.removeIndicatorFromChart(ind.name);
          renderIndicatorList(document.getElementById('wa-ind-search').value);
        };
        list.appendChild(item);
      });
    }
  }

  function injectStyles() {
    if (document.getElementById('wa-ind-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-ind-styles';
    style.textContent = `
      #sc-indicator-modal.show { background: rgba(0,0,0,0.55) !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
      
      .wa-imm-box { position: absolute; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background: #1e222d; width: 560px; height: 600px; max-height: 85vh; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; font-family: 'Inter', sans-serif; pointer-events: auto; }
      
      .wa-imm-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
      #wa-ind-modal-close:hover { color: #f6465d !important; }
      
      #wa-ind-search:focus { border-color: #26a69a !important; }

      .wa-imm-main-tab { padding: 12px 0; font-size: 12px; font-weight: 700; color: #848e9c; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
      .wa-imm-main-tab.active { color: #26a69a; border-bottom-color: #26a69a; }

      .wa-cat-tab { background: transparent; border: 1px solid transparent; border-radius: 6px; color: #848e9c; cursor: pointer; font-size: 11px; font-weight: 600; padding: 6px 12px; white-space: nowrap; transition: 0.2s; flex-shrink: 0; }
      .wa-cat-tab:hover { color: #EAECEF; background: rgba(255,255,255,0.06); }
      .wa-cat-tab.active { color: #00F0FF; border-color: rgba(0,240,255,0.3); background: rgba(0,240,255,0.05); }
      
      #wa-ind-cat-tabs::-webkit-scrollbar { display: none; }

      .wa-imm-content::-webkit-scrollbar { width: 4px; }
      .wa-imm-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

      .wa-imm-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; transition: 0.2s; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.02); }
      .wa-imm-item:last-child { border-bottom: none; }
      .wa-imm-item:hover { background: rgba(255,255,255,0.03); }
      
      .wa-imm-item-info { display: flex; flex-direction: column; gap: 4px; }
      .wa-imm-item-name { font-size: 13px; font-weight: 600; }
      .wa-imm-item-desc { font-size: 11px; color: #527c82; }

      .wa-imm-add-btn { background: transparent; border: none; color: #26a69a; font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: 0.2s; }
      .wa-imm-item:hover .wa-imm-add-btn { background: rgba(38,166,154,0.1); }

      .wa-imm-actions { display: flex; gap: 8px; }
      .wa-imm-action-btn { background: transparent; border: none; color: #848e9c; cursor: pointer; padding: 6px; font-size: 14px; transition: 0.2s; border-radius: 4px; }
      .wa-imm-action-btn:hover { background: rgba(255,255,255,0.08); color: #EAECEF; }
      .wa-imm-action-btn.remove:hover { color: #f6465d !important; background: rgba(246,70,93,0.1) !important; }

      /* MOBILE BOTTOM SHEET */
      @media (max-width: 768px) {
        .wa-imm-box {
          top: auto !important; bottom: 0 !important; left: 50% !important;
          transform: translate3d(-50%, 100%, 0) !important;
          width: 92vw !important; height: 85vh !important;
          border-radius: 24px 24px 0 0 !important;
          transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        }
        #sc-indicator-modal.show .wa-imm-box { transform: translate3d(-50%, 0, 0) !important; }
        .wa-imm-header { padding-top: 24px; position: relative; border-bottom: none; }
        .wa-imm-header::before { content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; }
      }
    `;
    document.head.appendChild(style);
  }

  global.initExpertUI = function () {
    injectStyles();

    if (!document.getElementById('sc-indicator-modal')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = buildIndicatorModalHTML();
      document.body.appendChild(wrap.firstElementChild);

      const modal = document.getElementById('sc-indicator-modal');
      const searchInp = document.getElementById('wa-ind-search');

      // Main Tabs Click
      document.querySelectorAll('.wa-imm-main-tab').forEach(tab => {
        tab.onclick = () => {
          document.querySelectorAll('.wa-imm-main-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentMainTab = tab.dataset.maintab;
          renderIndicatorList(searchInp.value);
        };
      });

      // Category Tabs Click
      document.getElementById('wa-ind-cat-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('.wa-cat-tab');
        if (!btn) return;
        document.querySelectorAll('.wa-cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.cat;
        renderIndicatorList(searchInp.value);
      });

      searchInp.addEventListener('input', (e) => renderIndicatorList(e.target.value));

      // Đóng Mượt
      const closeBox = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 150);
      };

      document.getElementById('wa-ind-modal-close').onclick = closeBox;
      modal.addEventListener('mousedown', (e) => { if (e.target === modal) closeBox(); });

      // Override global func để gán lại logic bật
      global.openIndicatorModal = function () {
        currentMainTab = 'library';
        currentCategory = 'all';
        document.querySelectorAll('.wa-imm-main-tab').forEach(t => t.classList.toggle('active', t.dataset.maintab === 'library'));
        document.querySelectorAll('.wa-cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === 'all'));
        searchInp.value = '';
        
        renderIndicatorList('');
        
        // Đặt lại tọa độ tâm hoàn hảo bằng 3D
        const modalBox = document.getElementById('wa-ind-modal-box');
        if (modalBox) {
            modalBox.style.transition = 'none'; // Tạm tắt hiệu ứng để ném box vào giữa màn hình tức thì
            modalBox.style.transform = 'translate3d(-50%, -50%, 0)'; 
            modalBox.style.left = '50%'; 
            modalBox.style.top = '50%';
            setTimeout(() => { modalBox.style.transition = ''; }, 50);
        }

        modal.style.display = 'flex';
        void modal.offsetWidth; // Ép reflow để CSS kịp áp dụng
        modal.classList.add('show');
      };

      // --- BỔ SUNG DRAG LOGIC (KÉO THẢ TRÊN MÁY TÍNH) ---
      const modalBox = document.getElementById('wa-ind-modal-box');
      const header = modalBox.querySelector('.wa-imm-header');
      let isDragging = false, startX, startY, initLeft, initTop;

      header.addEventListener('mousedown', (e) => {
        if (window.innerWidth <= 768) return; // Khóa kéo thả khi ở trên điện thoại
        isDragging = true; 
        startX = e.clientX; startY = e.clientY;
        const rect = modalBox.getBoundingClientRect();
        initLeft = rect.left; initTop = rect.top;
        modalBox.style.transform = 'translate3d(0, 0, 0)';
        modalBox.style.left = initLeft + 'px'; 
        modalBox.style.top = initTop + 'px';
        modalBox.style.transition = 'none'; // Tắt hiệu ứng trượt để chuột không bị trễ nhịp
        document.body.style.userSelect = 'none'; 
      });
      
      window.addEventListener('mousemove', (e) => { 
        if (!isDragging) return; 
        modalBox.style.left = (initLeft + e.clientX - startX) + 'px'; 
        modalBox.style.top = (initTop + e.clientY - startY) + 'px'; 
      });
      
      window.addEventListener('mouseup', () => { 
        if (isDragging) {
          isDragging = false; 
          modalBox.style.transition = ''; // Trả lại hiệu ứng mượt
          document.body.style.userSelect = ''; 
        }
      });
    }

    // ── Topbar Buttons ──
    if (!document.getElementById('btn-fx-indicator')) {
      const timeBtns = document.querySelectorAll('.sc-time-btn');
      if (timeBtns.length > 0) {
          
          // 1. STYLE TỐI GIẢN & CSS TOOLTIP MƯỢT MÀ (TÍCH HỢP FLEX ORDER SẮP XẾP TỰ ĐỘNG)
          if (!document.getElementById('wa-topbar-minimal-style')) {
              const style = document.createElement('style');
              style.id = 'wa-topbar-minimal-style';
              style.textContent = `
      /* FIX LỖI 3: Bỏ nền mờ đen (Vẫn cho phép click ra ngoài để đóng) */
      #sc-indicator-modal.show { background: transparent !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
      
      .wa-imm-box { position: absolute; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background: #1e222d; width: 560px; height: 600px; max-height: 85vh; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; font-family: 'Inter', sans-serif; pointer-events: auto; }
      
      .wa-imm-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
      #wa-ind-modal-close:hover { color: #f6465d !important; }
      
      #wa-ind-search:focus { border-color: #26a69a !important; }

      .wa-imm-main-tab { padding: 12px 0; font-size: 12px; font-weight: 700; color: #848e9c; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
      .wa-imm-main-tab.active { color: #26a69a; border-bottom-color: #26a69a; }

      .wa-cat-tab { background: transparent; border: 1px solid transparent; border-radius: 6px; color: #848e9c; cursor: pointer; font-size: 11px; font-weight: 600; padding: 6px 12px; white-space: nowrap; transition: 0.2s; flex-shrink: 0; }
      .wa-cat-tab:hover { color: #EAECEF; background: rgba(255,255,255,0.06); }
      .wa-cat-tab.active { color: #00F0FF; border-color: rgba(0,240,255,0.3); background: rgba(0,240,255,0.05); }
      
      #wa-ind-cat-tabs::-webkit-scrollbar { display: none; }

      /* FIX LỖI 2: Cho phép cuộn danh sách (overflow-y: auto) */
      .wa-imm-content { flex: 1; overflow-y: auto; }
      .wa-imm-content::-webkit-scrollbar { width: 4px; }
      .wa-imm-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

      .wa-imm-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; transition: 0.2s; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.02); }
      .wa-imm-item:last-child { border-bottom: none; }
      .wa-imm-item:hover { background: rgba(255,255,255,0.03); }
      
      /* FIX LỖI 1: Cắt bớt chữ (ellipsis) nếu tên chỉ báo quá dài, không cho đẩy nút xuống hàng */
      .wa-imm-item-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; padding-right: 12px; }
      .wa-imm-item-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .wa-imm-item-desc { font-size: 11px; color: #527c82; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .wa-imm-add-btn { background: transparent; border: none; color: #26a69a; font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: 0.2s; flex-shrink: 0; }
      .wa-imm-item:hover .wa-imm-add-btn { background: rgba(38,166,154,0.1); }

      .wa-imm-actions { display: flex; gap: 8px; flex-shrink: 0; }
      .wa-imm-action-btn { background: transparent; border: none; color: #848e9c; cursor: pointer; padding: 6px; font-size: 14px; transition: 0.2s; border-radius: 4px; }
      .wa-imm-action-btn:hover { background: rgba(255,255,255,0.08); color: #EAECEF; }
      .wa-imm-action-btn.remove:hover { color: #f6465d !important; background: rgba(246,70,93,0.1) !important; }

      /* MOBILE BOTTOM SHEET */
      @media (max-width: 768px) {
        .wa-imm-box {
          top: auto !important; bottom: 0 !important; left: 50% !important;
          transform: translate3d(-50%, 100%, 0) !important;
          width: 92vw !important; height: 85vh !important;
          border-radius: 24px 24px 0 0 !important;
          transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
        }
        #sc-indicator-modal.show .wa-imm-box { transform: translate3d(-50%, 0, 0) !important; }
        .wa-imm-header { padding-top: 24px; position: relative; border-bottom: none; }
        .wa-imm-header::before { content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; }
      }
    `;
              document.head.appendChild(style);
          }

          // 2. ÉP THANH CÔNG CỤ VUỐT NGANG
          const container = timeBtns[0].parentElement;
          container.classList.add('wa-topbar-container');
          if (container.parentElement) container.parentElement.classList.add('wa-topbar-container');

          // 3. SVG ICONS CHUẨN MINIMALIST & NÚT BẤM (ĐÃ ĐỒNG BỘ CSS)
          const TOP_ICONS = {
            addInd: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg><span style="font-size: 11px; font-weight: 600; padding-top: 1px;">CHỈ BÁO</span>`,
            manageInd: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>`,
            fullscreen: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>`
        };

        // 4. KHUNG CHỨA NÚT MỚI
        const tbWrap = document.createElement('div');
        tbWrap.id = 'wa-toolbar-right'; 
        tbWrap.style.cssText = 'display:flex; align-items:center; gap:6px; flex-shrink:0; margin-left:8px;';
        
        const btnStyle = "background: rgba(255,255,255,0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 0 8px; height: 26px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: 0.2s; outline: none; font-family: 'Inter', sans-serif;";

        tbWrap.innerHTML = `
            <button id="btn-fx-indicator" data-tip="Thêm chỉ báo mới" style="${btnStyle}" onmouseover="this.style.color='#EAECEF'; this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='#848e9c'; this.style.background='rgba(255,255,255,0.05)'">${TOP_ICONS.addInd}</button>
            <button id="btn-wa-manage-ind" data-tip="Cài đặt & Quản lý chỉ báo" style="${btnStyle}" onmouseover="this.style.color='#EAECEF'; this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='#848e9c'; this.style.background='rgba(255,255,255,0.05)'">${TOP_ICONS.manageInd}</button>
            <button id="btn-wa-fs" data-tip="Toàn màn hình" style="${btnStyle}" onmouseover="this.style.color='#EAECEF'; this.style.background='rgba(255,255,255,0.08)'" onmouseout="this.style.color='#848e9c'; this.style.background='rgba(255,255,255,0.05)'">${TOP_ICONS.fullscreen}</button>
        `;
        container.appendChild(tbWrap);

          // 5. GẮN SỰ KIỆN CHO CÁC NÚT
          document.getElementById('btn-fx-indicator').addEventListener('click', function (e) {
              e.stopPropagation();
              if (typeof global.openIndicatorModal === 'function') global.openIndicatorModal();
          });

          document.getElementById('btn-wa-manage-ind').addEventListener('click', function (e) {
              e.stopPropagation();
              if (typeof global.openIndicatorSettings === 'function') global.openIndicatorSettings();
          });

          document.getElementById('btn-wa-fs').addEventListener('click', function () {
              const el = document.getElementById('tv-chart-container') || document.documentElement;
              if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
              else document.exitFullscreen && document.exitFullscreen();
          });
      } 
    } 

    // =========================================================================
    // NÚT TAM GIÁC ẨN/HIỆN TEXT CHỈ BÁO (AUTO-TRACKING V5 - ZERO LAG)
    // =========================================================================
    setTimeout(() => {
        const chartDom = document.getElementById('sc-chart-container') || 
                         document.getElementById('tv-chart-container') || 
                         document.querySelector('.klinecharts-pro');
                         
        if (chartDom && !document.getElementById('wa-legend-toggle')) {
            if (window.getComputedStyle(chartDom).position === 'static') {
                chartDom.style.position = 'relative';
            }

            if (window.tvChart) {
                window.tvChart.setStyles({
                    indicator: { tooltip: { text: { marginLeft: 8 } } }
                });
            }

            const toggleBtn = document.createElement('div');
            toggleBtn.id = 'wa-legend-toggle';
            toggleBtn.title = "Thu gọn/Mở rộng danh sách chỉ báo";
            toggleBtn.dataset.hidden = "false"; 
            
            toggleBtn.style.cssText = `
                position: absolute;
                left: 12px;
                top: 36px;
                z-index: 999;
                width: 20px;
                height: 20px;
                background: rgba(30, 35, 41, 0.4);
                border: 1px solid rgba(255,255,255,0.05);
                color: #848e9c;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                border-radius: 4px;
                backdrop-filter: blur(4px);
                transition: top 0.25s cubic-bezier(0.25, 0.8, 0.25, 1), background 0.2s, transform 0.2s;
            `;
            
            toggleBtn.innerHTML = `
                <svg id="wa-legend-icon" style="transition: transform 0.25s ease;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            `;

            toggleBtn.onmouseover = () => { toggleBtn.style.background = 'rgba(255,255,255,0.1)'; toggleBtn.style.color = '#fff'; };
            toggleBtn.onmouseout = () => { toggleBtn.style.background = 'rgba(30, 35, 41, 0.4)'; toggleBtn.style.color = '#848e9c'; };

            let isLegendVisible = true;
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                isLegendVisible = !isLegendVisible;
                toggleBtn.dataset.hidden = (!isLegendVisible).toString(); 
                
                document.getElementById('wa-legend-icon').style.transform = isLegendVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                
                if (window.tvChart) {
                    window.tvChart.setStyles({
                        indicator: { tooltip: { showRule: isLegendVisible ? 'always' : 'none' } }
                    });
                }
            };

            chartDom.appendChild(toggleBtn);

            let lastState = null; 
            setInterval(() => {
                if (!window.tvChart || !document.getElementById('wa-legend-toggle')) return;
                let count = 0;
                try {
                    const inds = window.tvChart.getIndicatorByPaneId('candle_pane');
                    if (inds) {
                        if (inds instanceof Map) count = inds.size;
                        else count = Object.keys(inds).length;
                    }
                } catch(e) {}

                if (count === 0 && global.scActiveIndicators) {
                    count = global.scActiveIndicators.filter(i => i.isStack).length;
                }

                const isHidden = toggleBtn.dataset.hidden === 'true';
                const currentState = count + "_" + isHidden;
                
                if (lastState !== currentState) {
                    const baseTop = 34; 
                    const lineHeight = 24; 
                    const targetTop = isHidden ? baseTop : baseTop + (count * lineHeight);
                    toggleBtn.style.top = targetTop + 'px';
                    lastState = currentState; 
                }
            }, 150); 
        }
    }, 800);
  };

    
  // ══════════════════════════════════════════════════════
  // SECTION 6: EVENT HANDLERS & STATE MANAGEMENT
  // ══════════════════════════════════════════════════════

  /** @type {Array<{name:string, isStack:boolean, paneId:string, params:number[]}>} */
  if (!global.scActiveIndicators) global.scActiveIndicators = [];

  /**
   * Open indicator library modal and render the default list
   */
  global.openIndicatorModal = function () {
    const modal = document.getElementById('sc-indicator-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    // Reset to 'all' tab and render
    document.querySelectorAll('.wa-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.cat === 'all');
    });
    const searchEl = document.getElementById('wa-ind-search');
    if (searchEl) searchEl.value = '';
    renderIndicatorList('', 'all');
  };

  /**
   * Add an indicator to the chart with retry on failure
   * Persists to localStorage
   * @param {string} indName
   * @param {Object} [options]  — optional overrides: { params, paneId }
   */
  global.addIndicatorToChart = function (indName, options) {
    if (!global.tvChart) return;
    
    // [FIX 1] Mình đã xóa lệnh tắt modal ở đây để người dùng chọn nhiều chỉ báo không bị tắt bảng

    const meta    = INDICATOR_REGISTRY.find(function (x) { return x.name === indName; });
    const isStack = meta ? meta.isStack : false;
    const paneId  = (options && options.paneId) || (isStack ? 'candle_pane' : 'pane_' + indName.toLowerCase());
    const params  = (options && options.params) || (meta ? meta.defaultParams.slice() : []);

    try {
        global.tvChart.createIndicator({
            name: indName,
            // 🚀 FIX: Kết hợp logic đổi icon Mắt VÀ giấu các tham số thừa thãi
            createTooltipDataSource: function({ indicator, defaultStyles }) {
                const icons = defaultStyles.tooltip.icons;
                const eyeIcon = indicator.visible ? icons[1] : icons[0];
                
                // Các chỉ báo Pro có quá nhiều tham số cần giấu đi cho sạch Chart
                const hideParamsList = ['WAVE_VPVR', 'WAVE_TPO', 'WAVE_COB', 'WAVE_BOOKMAP'];
                
                if (hideParamsList.includes(indicator.name)) {
                    return { 
                        icons: [eyeIcon, icons[2], icons[3]],
                        name: indicator.shortName || indicator.name,
                        calcParamsText: ' ', // Khoảng trắng để chặn KLineCharts in số
                        values: []           // Dọn sạch mảng giá trị hiển thị
                    };
                }
                
                // Các chỉ báo bình thường (như RSI, MA) vẫn hiển thị tham số như cũ
                return { icons: [eyeIcon, icons[2], icons[3]] };
            }
        }, isStack, { id: paneId });
        
        if (!global.scActiveIndicators.find(function (x) { return x.name === indName; })) {
            global.scActiveIndicators.push({ name: indName, isStack: isStack, paneId: paneId, params: params, visible: true });
            if(typeof saveIndicatorState === 'function') saveIndicatorState();
        }
    } catch (err) { console.error('[Wave Alpha] createIndicator error:', err); }

    // [FIX 2] Tự động load lại bảng để chuyển thẻ thành màu xanh & hiện bánh răng cài đặt ngay lập tức
    const modalEl = document.getElementById('sc-indicator-modal');
    if (modalEl && modalEl.style.display !== 'none') {
        const activeTab = document.querySelector('.wa-tab.active');
        const q = (document.getElementById('wa-ind-search') || {}).value || '';
        if (typeof renderIndicatorList === 'function') {
            renderIndicatorList(q, activeTab ? activeTab.dataset.cat : 'all');
        }
    }
  };

  /**
   * Remove an indicator from the chart and state
   * @param {string} indName
   */
  global.removeIndicatorFromChart = function (indName) {
    if (!global.tvChart) return;
    const entry = global.scActiveIndicators.find(function (x) { return x.name === indName; });
    if (!entry) return;

    try {
      global.tvChart.removeIndicator(entry.paneId, indName);
    } catch (e) {
      console.warn('[Wave Alpha] removeIndicator error', e);
    }

    global.scActiveIndicators = global.scActiveIndicators.filter(function (x) { return x.name !== indName; });
    saveIndicatorState();

    // Re-render modal list if open
    const modal = document.getElementById('sc-indicator-modal');
    if (modal && modal.style.display !== 'none') {
      const activeTab = document.querySelector('.wa-tab.active');
      const q = (document.getElementById('wa-ind-search') || {}).value || '';
      renderIndicatorList(q, activeTab ? activeTab.dataset.cat : 'all');
    }
  };

  /**
   * Open indicator settings modal (FLOATING PANEL & LIVE PREVIEW)
   * @param {Object} indicator  — indicator instance from KLineCharts
   * @param {string} paneId
   */
  

  // =========================================================================
  // ⚙️ BƯỚC 5: QUẢN LÝ CÀI ĐẶT CHỈ BÁO NÂNG CAO (MINIMALIST UI PRO - CLEAN DOM)
  // =========================================================================
  global.openIndicatorSettings = function (indicatorObj, paneId) {
    let targetName = null;
    if (typeof indicatorObj === 'string') targetName = indicatorObj;
    else if (indicatorObj && indicatorObj.name) targetName = indicatorObj.name;

    if (!global.scActiveIndicators) global.scActiveIndicators = [];
    
    if (targetName && !global.scActiveIndicators.find(i => i.name === targetName)) {
        global.scActiveIndicators.push({
            name: targetName,
            isStack: true,
            paneId: paneId || 'candle_pane',
            params: (indicatorObj && indicatorObj.calcParams) ? indicatorObj.calcParams : [],
            visible: true
        });
    }

    if (global.scActiveIndicators.length === 0) {
        alert('Chưa có chỉ báo nào đang hoạt động trên biểu đồ.');
        return;
    }

    // 1. XÓA BẢN SAO CŨ CHO SẠCH DOM
    const oldModal = document.getElementById('wa-ind-settings-modal');
    if (oldModal) oldModal.remove();

    const ICONS = {
        gear: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        eyeOff: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
        trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
    };

    // 2. CSS SẠCH (ĐÃ XÓA MÃ CSS CỦA COLOR PICKER CŨ)
    const style = document.createElement('style');
    style.textContent = `
        #wa-ind-settings-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999; pointer-events: none; opacity: 0; visibility: hidden; transition: all 0.15s ease; transform: translateZ(0); }
        #wa-ind-settings-modal.show { opacity: 1; visibility: visible; pointer-events: auto; }
        .wa-ism-box { position: absolute; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background: #1e222d; width: 680px; height: 500px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; overflow: hidden; font-family: 'Inter', sans-serif; pointer-events: auto; }
        .wa-ism-box.is-dragging { transition: none !important; will-change: left, top; }
        
        .wa-ism-sidebar { width: 220px; background: #131722; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 20px 0 0 0; overflow-y: auto; flex-shrink: 0; }
        .wa-ism-sidebar::-webkit-scrollbar { width: 4px; }
        .wa-ism-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .wa-ism-tab { padding: 12px 20px; color: #848e9c; font-size: 13px; font-weight: 500; cursor: pointer; border-left: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; justify-content: space-between; }
        .wa-ism-tab-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px; }
        .wa-ism-tab:hover { background: rgba(255,255,255,0.03); color: #EAECEF; }
        .wa-ism-tab.active { background: rgba(38,166,154,0.1); color: #26a69a; border-left-color: #26a69a; font-weight: 700; }
        
        .wa-ism-actions { display: none; gap: 6px; align-items: center; flex-shrink: 0; }
        .wa-ism-tab:hover .wa-ism-actions, .wa-ism-tab.active .wa-ism-actions { display: flex; }
        .wa-ism-btn { background: transparent; border: none; color: #848e9c; cursor: pointer; padding: 4px; border-radius: 4px; display: flex; transition: 0.2s; }
        .wa-ism-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .wa-ism-btn.delete:hover { color: #f6465d; background: rgba(246,70,93,0.1); }

        .wa-ism-content { flex: 1; display: flex; flex-direction: column; background: #1e222d; min-width: 0; min-height: 0; overflow: hidden; }
        .wa-ism-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none; flex-shrink: 0; }
        .wa-ism-header:active { cursor: grabbing; }
        .wa-ism-title { font-size: 16px; font-weight: 700; color: #EAECEF; display: flex; align-items: center; gap: 8px; pointer-events: none; text-transform: uppercase; letter-spacing: 0.5px; }
        .wa-ism-close { color: #848e9c; cursor: pointer; display: flex; padding: 4px; margin: -4px; transition: 0.2s; }
        .wa-ism-close:hover { color: #F6465D; }
        
        .wa-ism-panels { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; -webkit-overflow-scrolling: touch; }
        .wa-ism-panels::-webkit-scrollbar { width: 4px; }
        .wa-ism-panels::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        
        .wa-ism-group-title { font-size: 11px; font-weight: 800; color: #527c82; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; margin-top: 4px; margin-bottom: 8px; }
        .wa-ism-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; gap: 16px; }
        .wa-ism-label { font-size: 13px; color: #b7bdc6; display: flex; flex-direction: column; flex: 1; min-width: 0; }
        .wa-ism-desc { font-size: 10px; color: #527c82; margin-top: 4px; }
        .wa-ism-control { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        
        .wa-ism-input { background: #131722; color: #EAECEF; border: 1px solid rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 4px; font-size: 12px; outline: none; transition: 0.2s; width: 100px; text-align: center; }
        .wa-ism-input:focus { border-color: #26a69a; }
        .wa-ism-select { background: #131722; color: #EAECEF; border: 1px solid rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 4px; font-size: 12px; outline: none; cursor: pointer; width: 140px; }
        .wa-ism-swatch { width: 28px; height: 28px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: 0.2s; background: transparent; }
        .wa-ism-swatch:hover { border-color: #00F0FF; box-shadow: 0 0 5px rgba(0,240,255,0.3); }
        .wa-is-transparent { background-image: conic-gradient(#333 0.25turn, #444 0.25turn 0.5turn, #333 0.5turn 0.75turn, #444 0.75turn); background-size: 8px 8px; }
        
        .wa-ism-reset { background: rgba(246, 70, 93, 0.05); color: #F6465D; border: 1px dashed rgba(246, 70, 93, 0.3); padding: 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; text-align: center; margin-top: 10px; width: 100%; display: flex; justify-content: center; align-items: center; letter-spacing: 0.5px; }
        .wa-ism-reset:hover { background: rgba(246, 70, 93, 0.15); border-color: rgba(246, 70, 93, 0.6); }

        @media (max-width: 768px) {
            .wa-ism-box { top: auto !important; bottom: 0 !important; left: 50% !important; transform: translate3d(-50%, 100%, 0) !important; width: 92vw !important; height: 85vh !important; border-radius: 24px 24px 0 0 !important; flex-direction: column !important; transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) !important; }
            #wa-ind-settings-modal.show .wa-ism-box { transform: translate3d(-50%, 0, 0) !important; }
            .wa-ism-header { padding-top: 24px; position: relative; border-bottom: none; }
            .wa-ism-header::before { content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; }
            .wa-ism-sidebar { width: 100% !important; flex-direction: row; padding: 10px 16px 0; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); overflow-x: auto; white-space: nowrap; flex-shrink: 0; }
            .wa-ism-tab { padding: 10px 16px; border-left: none; border-bottom: 2px solid transparent; border-radius: 4px 4px 0 0; font-size: 14px; }
            .wa-ism-tab.active { border-bottom-color: #26a69a; background: transparent; }
            .wa-ism-actions { display: none !important; }
        }
    `;
    document.head.appendChild(style);

    // 3. HTML SẠCH (KHÔNG CÒN POPUP BẢNG MÀU NỮA)
    const modalHTML = `
        <div id="wa-ind-settings-modal">
            <div class="wa-ism-box" id="wa-ism-box">
                <div class="wa-ism-sidebar" id="wa-ism-sidebar"></div>
                <div class="wa-ism-content">
                    <div class="wa-ism-header" id="wa-ism-header">
                        <div class="wa-ism-title">${ICONS.gear} CÀI ĐẶT CHỈ BÁO</div>
                        <div class="wa-ism-close" id="btn-wa-ism-close">${ICONS.close}</div>
                    </div>
                    <div class="wa-ism-panels" id="wa-ism-panels"></div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('wa-ind-settings-modal');
    const modalBox = document.getElementById('wa-ism-box');
    const sidebar = document.getElementById('wa-ism-sidebar');
    const panels = document.getElementById('wa-ism-panels');
    let currentActiveIndName = null;

    // 4. DATA ENGINE
    const vpvrDescriptions = ["Thanh ngang (10-200)", "Lõi Volume (70%)", "Chiều ngang (%)", "0: Phải, 1: Trái", "0: Toàn, 1: Ngày, 2: Tuần", "0: Tắt, 1: Bật", "Lực Mua", "Lực Bán", "Point of Control", "Viền Giá Trị", "HVN Dày", "LVN Mỏng", "nPOC Chưa Test", "Icon Phe Áp Đảo", "Mờ trong VA", "Mờ ngoài VA", "Dày nét (1-5)", "Dày nét (1-4)", "0:Đứt 1:Chấm 2:Liền", "0:Đứt 1:Chấm 2:Dài", "Cỡ chữ (8-16)", "0:Ẩn 1:Hiện"];

    const liveUpdateChart = () => {
        if (!currentActiveIndName) return;
        const indState = global.scActiveIndicators.find(x => x.name === currentActiveIndName);
        if (!indState) return;

        const newParams = indState.params.map((val, idx) => {
            const inp = document.getElementById('wa-param-' + idx);
            if (inp) {
                if (inp.classList.contains('wa-ism-swatch')) return inp.style.backgroundColor || val;
                return parseFloat(inp.value) || 0;
            }
            return val;
        });
        indState.params = newParams;
        try { global.tvChart.overrideIndicator({ name: currentActiveIndName, calcParams: newParams }, indState.paneId); } catch (e) {}
    };

    function renderSidebar() {
        sidebar.innerHTML = '';
        global.scActiveIndicators.forEach(ind => {
            const meta = INDICATOR_REGISTRY.find(x => x.name === ind.name);
            const item = document.createElement('div');
            item.className = 'wa-ism-tab' + (currentActiveIndName === ind.name ? ' active' : '');
            const isVisible = ind.visible !== false;

            item.innerHTML = `
                <div class="wa-ism-tab-name" style="${!isVisible ? 'opacity:0.4;' : ''}">${meta ? (meta.shortName || meta.name) : ind.name}</div>
                <div class="wa-ism-actions">
                    <div class="wa-ism-btn toggle-vis" title="Ẩn/Hiện">${isVisible ? ICONS.eye : ICONS.eyeOff}</div>
                    <div class="wa-ism-btn delete" title="Xóa">${ICONS.trash}</div>
                </div>
            `;
            
            item.onclick = (e) => {
                if (e.target.closest('.wa-ism-actions')) return;
                sidebar.querySelectorAll('.wa-ism-tab').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                renderContent(ind.name);
            };

            item.querySelector('.toggle-vis').onclick = (e) => {
                e.stopPropagation();
                ind.visible = !isVisible;
                if (window.tvChart) window.tvChart.overrideIndicator({ name: ind.name, visible: ind.visible }, ind.paneId);
                renderSidebar();
            };

            item.querySelector('.delete').onclick = (e) => {
                e.stopPropagation();
                if (typeof global.removeIndicatorFromChart === 'function') global.removeIndicatorFromChart(ind.name);
                if (currentActiveIndName === ind.name) {
                    currentActiveIndName = null;
                    panels.innerHTML = '';
                }
                if (global.scActiveIndicators.length === 0) {
                    window.closeIndicatorSettings();
                } else renderSidebar();
            };
            sidebar.appendChild(item);
        });
    }

    function renderContent(indName) {
        currentActiveIndName = indName;
        panels.innerHTML = '';
        const meta = INDICATOR_REGISTRY.find(x => x.name === indName);
        const indState = global.scActiveIndicators.find(x => x.name === indName);
        if (!meta || !indState) return;

        const currentParams = (indState.params && indState.params.length > 0) ? indState.params : [...meta.defaultParams];
        const labels = meta.paramLabels || [];
        const isVPVR = indName === 'WAVE_VPVR', isTPO = indName === 'WAVE_TPO';

        let groups = isVPVR ? [
            { title: 'Cấu Hình Lõi', keys: [0, 1, 2, 3, 4, 5, 21, 22, 23] },
            { title: 'Bảng Màu', keys: [6, 7, 8, 9, 10, 11, 12, 13] },
            { title: 'Đồ Họa & Nét Vẽ', keys: [14, 15, 16, 17, 18, 19, 20] }
        ] : isTPO ? [
            { title: 'Thuật Toán Động', keys: [0, 1, 2, 3, 4, 5, 6, 7, 27, 28, 29, 30, 31] },
            { title: 'Thiết Lập Màu Sắc', keys: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
            { title: 'Giao Diện Phụ', keys: [20, 21, 22, 23, 24, 25, 26] }
        ] : [{ title: 'THÔNG SỐ CHUNG', keys: currentParams.map((_, i) => i) }];

        groups.forEach(g => {
            const grpDiv = document.createElement('div');
            grpDiv.innerHTML = `<div class="wa-ism-group-title">${g.title}</div>`;
            
            g.keys.forEach(idx => {
                const val = currentParams[idx]; if (val === undefined) return;
                let lbl = labels[idx] || 'Thông số ' + (idx + 1);
                const isColor = (lbl.toLowerCase().includes('màu') && !lbl.toLowerCase().includes('phiên')) || (typeof val === 'string' && val.startsWith('#') || val === 'transparent');
                
                const row = document.createElement('div');
                row.className = 'wa-ism-row';
                let descHTML = (isVPVR && vpvrDescriptions[idx]) ? `<div class="wa-ism-desc">${vpvrDescriptions[idx]}</div>` : '';

                if (isColor) {
                    let dVal = val;
                    if (typeof val === 'number') {
                        let hStr = Math.round(val).toString(16).toUpperCase();
                        while(hStr.length < 6) hStr = '0' + hStr;
                        dVal = '#' + hStr;
                    }
                    row.innerHTML = `<div class="wa-ism-label">${lbl}${descHTML}</div>
                                     <div class="wa-ism-control"><div id="wa-param-${idx}" class="wa-ism-swatch ${dVal==='transparent'?'wa-is-transparent':''}" style="background-color:${dVal}"></div></div>`;
                    
                    const swatch = row.querySelector('.wa-ism-swatch');
                    swatch.onclick = (e) => {
                        e.stopPropagation();
                        if (window.WaveColorPicker) {
                            window.WaveColorPicker.open(swatch, dVal, (newColor) => {
                                swatch.style.backgroundColor = newColor;
                                if (newColor === 'transparent') swatch.classList.add('wa-is-transparent');
                                else swatch.classList.remove('wa-is-transparent');
                                indState.params[idx] = newColor;
                                try { global.tvChart.overrideIndicator({ name: indName, calcParams: indState.params }, indState.paneId); } catch (err) {}
                            });
                        }
                    };
                } else {
                    let options = [];
                    let cleanLbl = lbl;
                    const match = lbl.match(/\((.*?=\s*.*?)\)/); 
                    if (match) {
                        const parts = match[1].split(',');
                        parts.forEach(p => {
                            const kv = p.split('=');
                            if (kv.length === 2 && !isNaN(parseInt(kv[0]))) options.push({ val: parseInt(kv[0].trim()), text: kv[1].trim() });
                        });
                        if (options.length > 0) cleanLbl = lbl.replace(match[0], '').trim(); 
                    }

                    if (options.length > 1) {
                        let optsHTML = options.map(o => `<option value="${o.val}" ${val === o.val ? 'selected' : ''}>${o.text}</option>`).join('');
                        row.innerHTML = `<div class="wa-ism-label">${cleanLbl}${descHTML}</div>
                                         <div class="wa-ism-control"><select id="wa-param-${idx}" class="wa-ism-select">${optsHTML}</select></div>`;
                        row.querySelector('select').onchange = liveUpdateChart;
                    } else {
                        row.innerHTML = `<div class="wa-ism-label">${lbl}${descHTML}</div>
                                         <div class="wa-ism-control"><input type="number" id="wa-param-${idx}" class="wa-ism-input" value="${val}" step="any"></div>`;
                        row.querySelector('input').oninput = liveUpdateChart;
                    }
                }
                grpDiv.appendChild(row);
            });
            panels.appendChild(grpDiv);
        });

        const resetBtn = document.createElement('button');
        resetBtn.className = 'wa-ism-reset';
        resetBtn.innerHTML = `KHÔI PHỤC MẶC ĐỊNH`;
        resetBtn.onclick = () => { indState.params = [...meta.defaultParams]; renderContent(indName); liveUpdateChart(); };
        panels.appendChild(resetBtn);
    }

    renderSidebar();
    if (targetName) renderContent(targetName); else if (global.scActiveIndicators.length > 0) renderContent(global.scActiveIndicators[0].name);

    // 5. EVENT BẬT/TẮT & DRAG MƯỢT
    window.closeIndicatorSettings = function() {
        if (window.WaveColorPicker) window.WaveColorPicker.close(); // Đóng picker toàn cục nếu đang mở
        modal.classList.remove('show');
        setTimeout(() => {
            modalBox.classList.remove('is-dragging');
            modalBox.style.transform = 'translate3d(-50%, -50%, 0)';
            modalBox.style.left = '50%';
            modalBox.style.top = '50%';
        }, 150);
        if (typeof global.saveIndicatorState === 'function') global.saveIndicatorState();
    };

    modalBox.classList.remove('is-dragging');
    modalBox.style.transform = 'translate3d(-50%, -50%, 0)'; 
    modalBox.style.left = '50%'; modalBox.style.top = '50%';
    modal.classList.add('show');

    document.getElementById('btn-wa-ism-close').onclick = window.closeIndicatorSettings;
    modal.addEventListener('mousedown', (e) => { if (e.target === modal) window.closeIndicatorSettings(); });
    panels.addEventListener('scroll', () => { if (window.WaveColorPicker) window.WaveColorPicker.close(); });

    const header = document.getElementById('wa-ism-header');
    let isDragging = false, startX, startY, initLeft, initTop;
    header.addEventListener('mousedown', (e) => {
        if (window.innerWidth <= 768) return; 
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = modalBox.getBoundingClientRect();
        initLeft = rect.left; initTop = rect.top;
        modalBox.style.transform = 'translate3d(0, 0, 0)'; 
        modalBox.style.left = initLeft + 'px'; 
        modalBox.style.top = initTop + 'px';
        modalBox.classList.add('is-dragging');
        document.body.style.userSelect = 'none'; 
    });
    window.addEventListener('mousemove', (e) => { if (!isDragging) return; modalBox.style.left = (initLeft + e.clientX - startX) + 'px'; modalBox.style.top = (initTop + e.clientY - startY) + 'px'; });
    window.addEventListener('mouseup', () => { isDragging = false; modalBox.classList.remove('is-dragging'); document.body.style.userSelect = ''; });
};

  /**
   * Restore all active indicators after chart reload
   */
  global.restoreIndicators = function () {
    const saved = loadIndicatorState();
    if (!saved || saved.length === 0) return;
    saved.forEach(function (entry) {
      global.addIndicatorToChart(entry.name, { paneId: entry.paneId, params: entry.params });
    });

    // 🚀 NHÁT 2: BẮT BUỘC GỌI HÀM VẼ GIAO DIỆN HTML SAU KHI KHÔI PHỤC
    setTimeout(function() {
        if (global.WaveIndicatorAPI && typeof global.WaveIndicatorAPI.renderLegend === 'function') {
            global.WaveIndicatorAPI.renderLegend();
        }
    }, 300);

    console.log('[Wave Alpha] ✅ Restored', saved.length, 'indicators from storage');
  };

  /**
   * Clear all user overlay drawings
   */
  global.clearUserDrawings = function () {
    if (global.tvChart && typeof global.tvChart.removeAllOverlay === 'function') {
      global.tvChart.removeAllOverlay();
    }
  };

  // ── State persistence ──────────────────────────────

  function saveIndicatorState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(global.scActiveIndicators));
    } catch (e) {
      console.warn('[Wave Alpha] localStorage save failed', e);
    }
  }

  function loadIndicatorState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // ══════════════════════════════════════════════════════
  // SECTION 7: PUBLIC API (BẢN FIX TÀNG HÌNH NÚT BUTTON + UNICODE)
  // ══════════════════════════════════════════════════════

  const LEGEND_LABELS = {
    VWAP_BANDS: { vwap: 'V', upper1: 'U1', upper2: 'U2', lower1: 'L1', lower2: 'L2' },
    EMA: { ema1: 'E1', ema2: 'E2', ema3: 'E3' },
    BOLL: { mid: 'MB', upper: 'UB', lower: 'LB' }
  };

  global.WaveIndicatorAPI = {
    version:  WAVE_ALPHA_VERSION,
    registry: INDICATOR_REGISTRY,
    register: global.registerWaveIndicators,
    
    initUI: function() {
        if (typeof global.initExpertUI === 'function') global.initExpertUI();
    },

    add: function(name) {
        if (typeof global.addIndicatorToChart === 'function') global.addIndicatorToChart(name);
        setTimeout(() => global.WaveIndicatorAPI.renderLegend(), 200);
    },

    remove: function(name) {
        if (typeof global.removeIndicatorFromChart === 'function') global.removeIndicatorFromChart(name);
        setTimeout(() => global.WaveIndicatorAPI.renderLegend(), 200);
    },

    openSettings: global.openIndicatorSettings,
    restore: global.restoreIndicators,
    
    openSettingsByName: function(name) {
        const ind = global.scActiveIndicators.find(i => i.name === name);
        if (ind && typeof global.openIndicatorSettings === 'function') {
            global.openIndicatorSettings({ name: ind.name, calcParams: ind.params }, ind.paneId);
        }
    },

    toggleVisible: function(name) {
        if (!window.tvChart) return;
        const ind = global.scActiveIndicators.find(i => i.name === name);
        if (ind) {
            ind.visible = ind.visible === false ? true : false;
            window.tvChart.overrideIndicator({ name: ind.name, visible: ind.visible }, ind.paneId);
            if(typeof global.saveIndicatorState === 'function') global.saveIndicatorState();
            global.WaveIndicatorAPI.renderLegend();
        }
    },

    renderLegend: function() {
        // Đã chuyển sang dùng Native Tooltip của KLineCharts, không cần DOM render nữa.
        return; 
    },

    updateLegendValues: function(dataIndex) {
        // KLineCharts Native tự động cập nhật số liệu khi crosshair change.
        return;
    }
  };

  console.log('[Wave Alpha v' + WAVE_ALPHA_VERSION + '] Indicator Core initialized with Button/Unicode Fix.');
})(window);


// =========================================================================
// 🎨 BỘ CÔNG CỤ: WAVE ALPHA UNIVERSAL HSV COLOR PICKER PRO (ĐỒNG BỘ TOÀN WEB)
// =========================================================================
(function initUniversalColorPicker() {
  if (window.WaveColorPicker) return;

  const style = document.createElement('style');
  style.textContent = `
      #wa-ucp-overlay { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999998; }
      #wa-ucp { display: none; position: fixed; background: #1e222d; border: 1px solid #363c4e; border-radius: 8px; padding: 12px; width: 220px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); z-index: 99999999; font-family: 'Inter', sans-serif; }
      #wa-ucp.show { display: block; animation: waFadeIn 0.15s ease; }
      @keyframes waFadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      
      .wa-ucp-sv { position: relative; width: 100%; height: 130px; border-radius: 4px; overflow: hidden; cursor: crosshair; background-color: #ff0000; }
      .wa-ucp-sv-w { position: absolute; width: 100%; height: 100%; background: linear-gradient(to right, #fff, rgba(255,255,255,0)); pointer-events: none; }
      .wa-ucp-sv-b { position: absolute; width: 100%; height: 100%; background: linear-gradient(to top, #000, rgba(0,0,0,0)); pointer-events: none; }
      .wa-ucp-thumb { position: absolute; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.6); pointer-events: none; }
      
      .wa-ucp-ctrls { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
      .wa-ucp-preview { width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.1); background-image: conic-gradient(#333 0.25turn, #444 0.25turn 0.5turn, #333 0.5turn 0.75turn, #444 0.75turn); background-size: 8px 8px; position: relative; overflow: hidden; flex-shrink: 0; }
      #wa-ucp-color { position: absolute; width: 100%; height: 100%; background: #ff0000; }
      
      .wa-ucp-sliders { flex: 1; display: flex; flex-direction: column; gap: 8px; }
      .wa-ucp-range { -webkit-appearance: none; width: 100%; height: 8px; border-radius: 4px; outline: none; background: transparent; margin: 0; }
      .wa-ucp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 1px solid #ccc; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
      #wa-ucp-hue { background: linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%); }
      
      .wa-ucp-alpha-bg { background-image: conic-gradient(#333 0.25turn, #444 0.25turn 0.5turn, #333 0.5turn 0.75turn, #444 0.75turn); background-size: 8px 8px; border-radius: 4px; height: 8px; }
      #wa-ucp-alpha { width: 100%; background: linear-gradient(to right, transparent, #ff0000); display: block; border-radius: 4px; height: 100%; }
      
      .wa-ucp-hex { margin-top: 12px; display: flex; align-items: center; background: #131722; border: 1px solid #363c4e; border-radius: 4px; padding: 4px 8px; }
      .wa-ucp-hex span { font-size: 11px; color: #848e9c; font-weight: 600; margin-right: 8px; }
      #wa-ucp-hex-inp { background: transparent; border: none; color: #EAECEF; font-family: monospace; font-size: 13px; width: 100%; outline: none; text-transform: uppercase; }
      
      @media (max-width: 768px) {
          #wa-ucp { position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 280px; }
          .wa-ucp-sv { height: 180px; }
      }
  `;
  document.head.appendChild(style);

  const html = `
      <div id="wa-ucp-overlay"></div>
      <div id="wa-ucp">
          <div class="wa-ucp-sv" id="wa-ucp-sv">
              <div class="wa-ucp-sv-w"></div><div class="wa-ucp-sv-b"></div>
              <div class="wa-ucp-thumb" id="wa-ucp-thumb"></div>
          </div>
          <div class="wa-ucp-ctrls">
              <div class="wa-ucp-preview"><div id="wa-ucp-color"></div></div>
              <div class="wa-ucp-sliders">
                  <input type="range" id="wa-ucp-hue" class="wa-ucp-range" min="0" max="360" value="0">
                  <div class="wa-ucp-alpha-bg"><input type="range" id="wa-ucp-alpha" class="wa-ucp-range" min="0" max="1" step="0.01" value="1"></div>
              </div>
          </div>
          <div class="wa-ucp-hex">
              <span>HEX</span><input type="text" id="wa-ucp-hex-inp" maxlength="9">
          </div>
      </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);

  const overlay = document.getElementById('wa-ucp-overlay');
  const picker = document.getElementById('wa-ucp');
  const svArea = document.getElementById('wa-ucp-sv');
  const thumb = document.getElementById('wa-ucp-thumb');
  const hueInp = document.getElementById('wa-ucp-hue');
  const alphaInp = document.getElementById('wa-ucp-alpha');
  const hexInp = document.getElementById('wa-ucp-hex-inp');
  const colorPreview = document.getElementById('wa-ucp-color');

  let h = 0, s = 1, v = 1, a = 1;
  let onChangeCb = null;

  function hsv2rgb(h, s, v) {
      let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
      return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
  }

  function rgb2hsv(r, g, b) {
      let v = Math.max(r, g, b), c = v - Math.min(r, g, b);
      let h = c && ((v == r) ? (g - b) / c : ((v == g) ? 2 + (b - r) / c : 4 + (r - g) / c));
      return [60 * (h < 0 ? h + 6 : h), v && c / v, v / 255];
  }

  function rgb2hex(r, g, b) {
      return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
  }
  
  function hexToRgba(hex) {
      let r=0, g=0, b=0, al=1;
      if(hex.length===4) { r=parseInt(hex[1]+hex[1],16); g=parseInt(hex[2]+hex[2],16); b=parseInt(hex[3]+hex[3],16); }
      else if(hex.length===7) { r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16); }
      else if(hex.length===9) { r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16); al=parseInt(hex.slice(7,9),16)/255; }
      return [r,g,b,al];
  }

  function updateUI(fromHex = false) {
      const rgb = hsv2rgb(h, s, v);
      const pureRgb = hsv2rgb(h, 1, 1);
      
      svArea.style.backgroundColor = `rgb(${pureRgb[0]}, ${pureRgb[1]}, ${pureRgb[2]})`;
      thumb.style.left = (s * 100) + '%';
      thumb.style.top = ((1 - v) * 100) + '%';
      hueInp.value = h;
      alphaInp.value = a;
      
      alphaInp.style.background = `linear-gradient(to right, transparent, rgb(${rgb[0]},${rgb[1]},${rgb[2]}))`;
      
      const colorStr = a < 1 ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})` : rgb2hex(rgb[0], rgb[1], rgb[2]);
      colorPreview.style.background = colorStr;
      
      if (!fromHex) {
          let hexCode = rgb2hex(rgb[0], rgb[1], rgb[2]);
          if (a < 1) {
              let alphaHex = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
              hexCode += alphaHex;
          }
          hexInp.value = hexCode;
      }

      if (onChangeCb) onChangeCb(colorStr);
  }

  // Xử lý kéo thả chấm tròn trên màn hình máy tính và chạm cảm ứng trên điện thoại
  let isDragging = false;
  const updateSV = (e) => {
      const rect = svArea.getBoundingClientRect();
      let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      let y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      s = x / rect.width;
      v = 1 - (y / rect.height);
      updateUI();
  };
  svArea.onmousedown = (e) => { isDragging = true; updateSV(e); };
  window.addEventListener('mousemove', (e) => { if (isDragging) updateSV(e); });
  window.addEventListener('mouseup', () => { isDragging = false; });
  
  svArea.addEventListener('touchstart', (e) => { isDragging = true; updateSV(e.touches[0]); }, {passive:true});
  window.addEventListener('touchmove', (e) => { if (isDragging) updateSV(e.touches[0]); }, {passive:true});
  window.addEventListener('touchend', () => { isDragging = false; });

  hueInp.oninput = () => { h = parseFloat(hueInp.value); updateUI(); };
  alphaInp.oninput = () => { a = parseFloat(alphaInp.value); updateUI(); };
  
  hexInp.oninput = () => {
      let val = hexInp.value.trim();
      if(!val.startsWith('#')) val = '#' + val;
      if(val.length===4 || val.length===7 || val.length===9) {
          let [r,g,b,al] = hexToRgba(val);
          let hsv = rgb2hsv(r,g,b);
          h = hsv[0]; s = hsv[1]; v = hsv[2]; a = al;
          updateUI(true);
      }
  };

  // Đăng ký API để dùng cho mọi Bảng cài đặt trên web (Cài đặt nến, Cài đặt nền...)
  window.WaveColorPicker = {
      open: function(anchorEl, initColor, callback) {
          onChangeCb = callback;
          
          // Phân tích màu gốc để thiết lập vị trí chấm tròn
          if (initColor && initColor !== 'transparent') {
              if (initColor.startsWith('rgba')) {
                  let m = initColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                  if(m) {
                      let hsv = rgb2hsv(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]));
                      h = hsv[0]; s = hsv[1]; v = hsv[2]; a = m[4] ? parseFloat(m[4]) : 1;
                  }
              } else if (initColor.startsWith('#')) {
                  let [r,g,b,al] = hexToRgba(initColor);
                  let hsv = rgb2hsv(r,g,b);
                  h = hsv[0]; s = hsv[1]; v = hsv[2]; a = al;
              }
          }
          updateUI();

          // Hiển thị ở vị trí thông minh
          picker.classList.add('show');
          overlay.style.display = 'block';
          if (window.innerWidth > 768 && anchorEl) {
              const rect = anchorEl.getBoundingClientRect();
              picker.style.left = Math.max(10, rect.left - 200) + 'px';
              picker.style.top = (rect.bottom + 10) + 'px';
          }
      },
      close: function() {
          picker.classList.remove('show');
          overlay.style.display = 'none';
          onChangeCb = null;
      }
  };

  overlay.onmousedown = window.WaveColorPicker.close;
  overlay.ontouchstart = window.WaveColorPicker.close;
})();
