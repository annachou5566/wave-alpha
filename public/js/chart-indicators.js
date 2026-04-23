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
      description: 'Tháp Thanh Khoản DOM (Dữ liệu Sổ lệnh theo thời gian thực)',
      category: 'wave_alpha',
      isStack: true, 
      // Mặc định: [Rộng 120, Auto 0 (hoặc 50000), Dày 4, Lỳ 9995, Tốc độ 500ms]
      // Khuyên dùng mặc định là 0 để tính năng Tự Động làm việc!
      defaultParams: [120, 0, 4, 9995, 500], 
      paramLabels: [
        'Độ Rộng Cột COB (px)', 
        'Lọc Rác (USD) [Nhập 0 để Tự động]',
        'Độ Dày 1 Nấc Giá (px)',
        'Độ Lỳ Của Khung (x/10000)',
        'Tốc Độ Vẽ - FPS (ms)'
      ],
      builtIn: false,
    },
    
    {
      name: 'WAVE_VPVR',
      shortName: 'VPVR',
      description: 'Hồ Sơ Khối Lượng Giao Dịch (Volume Profile)',
      category: 'wave_alpha',
      isStack: true,
      builtIn: false,
      // Đã đổi màu sang dạng String (#HEX) để kích hoạt Bảng chọn màu
      defaultParams: [
        60, 70, 30, 0, 0, 0,
        "#26A69A", "#EF5350", "#F0B90B", "#9575CD",
        "#FFFFFF", "#FF9800", "#F0B90B", "#26A69A",
        80, 25, 2, 1, 0, 0, 10, 1
      ],
      paramLabels: [
        'Số Hàng - Bins (10–200)', 'Vùng Giá Trị VA % (10–100)', 'Độ Rộng % (10–80)',
        'Vị Trí (0=Phải, 1=Trái)', 'Chế Độ Phiên (0=Toàn màn, 1=Ngày, 2=Tuần)', 'Lớp Nền Mờ (0=Tắt, 1=Bật)',
        'Màu Lực Mua', 'Màu Lực Bán', 'Màu Đường POC',
        'Màu Viền VAH/VAL', 'Màu Viền HVN', 'Màu Nền LVN',
        'Màu Đường nPOC', 'Màu Icon Mua (▲)',
        'Độ Mờ Vùng VA (%)', 'Độ Mờ Ngoài VA (%)',
        'Độ Dày POC (1-5)', 'Độ Dày VAH/VAL (1-4)',
        'Nét VA (0=Đứt, 1=Chấm, 2=Liền)', 'Nét nPOC (0=Đứt, 1=Chấm, 2=Dài)',
        'Cỡ Chữ (8-16)', 'Hiện Giá (0=Tắt, 1=Bật)',
      ],
    },

    {
      name: 'WAVE_TPO',
      shortName: 'TPO',
      description: 'Hồ Sơ Thời Gian SMART v4.1 (AI & Custom Colors)',
      category: 'wave_alpha',
      isStack: true,
      builtIn: false,
      // 29 Thông số: Core [0-6] | Colors [7-18] | Styles [19-28]
      defaultParams: [
        60, 70, 0, 0, 0, 1, 1,
        "#9C27B0", "#7B1FA2", "#F0B90B", "#FF9800", "#F0B90B",
        "#BA68C8", "#FFD600", "#FFD600", "#26A69A", "#EF5350",
        "#42A5F5", "#FF7043",
        85, 20, 2, 1, 0, 10, 1, 70, 8, 1
      ],
      paramLabels: [
        'Số Bins (10–200)', 'Value Area % (10–100)', 'Vị Trí (0=Trái, 1=Phải)', 'Hiển Thị (0=Block, 1=Letter)', 
        'Màu Phiên (0=Đơn,1=Đa,2=Nhiệt)', 'Mật Độ (0=Gọn,1=Cân Bằng,2=Chi Tiết)', 'Smart Labels (0=Tắt,1=Bật)',
        'Màu Block Trong VA', 'Màu Block Ngoài VA', 'Màu TPO POC', 'Màu Naked POC', 'Màu Super POC', 
        'Màu VAH / VAL', 'Màu IB High', 'Màu IB Low', 'Màu Lực Mua Áp Đảo', 'Màu Lực Bán Áp Đảo', 
        'Màu Acceptance', 'Màu Rejection',
        'Độ Mờ Trong VA (0-100)', 'Độ Mờ Ngoài VA (0-100)', 'Độ Dày POC (1-5)', 'Độ Dày VA (1-4)', 
        'Kiểu Nét VA (0=Đứt,1=Chấm,2=Liền)', 'Cỡ Chữ (8-16)', 'Hiện Nhãn TPO (0=Tắt,1=Bật)', 
        'Độ Mờ Phiên Cũ (0-100)', 'Kích Thước Chữ Min (6-12px)', 'Độ Chi Tiết Nhãn (0-2)'
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

    // ════════════════════════════════════════════════════════════════════════════════
//  WAVE_TPO ULTIMATE v4.2 — SMART ENGINE (FIXED: API + GEAR PANEL + RENDERING)
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

  function _waTpoGetDash(styleIdx) {
      return styleIdx === 1 ? [2, 3] : styleIdx === 2 ? [] : [6, 4];
  }

  function _waTpoGetLetter(n) {
      if (n < 26) return String.fromCharCode(65 + n);
      if (n < 52) return String.fromCharCode(97 + n - 26);
      return String.fromCharCode(65 + Math.floor((n - 52) / 26)) + String.fromCharCode(65 + ((n - 52) % 26));
  }

  const _WA_TPO_SESSION_PALETTE = ['#4A148C', '#6A1B9A', '#8E24AA', '#AB47BC', '#00BCD4'];

  // ─── DEFAULT COLORS (tách ra khỏi calcParams để gear panel không bị vỡ) ────
  const _WA_DEFAULTS = {
      clrVA:       "#9C27B0", clrOut:     "#7B1FA2", clrPoc:       "#F0B90B",
      clrNpoc:     "#FF9800", clrSuperPoc:"#F0B90B", clrVaLine:    "#BA68C8",
      clrIbHigh:   "#FFD600", clrIbLow:   "#FFD600", clrImbalBuy:  "#26A69A",
      clrImbalSell:"#EF5350", clrAccept:  "#42A5F5", clrReject:    "#FF7043"
  };

  // ─── LÕI AI MARKET PROFILE ──────────────────────────────────────────────────
  function _waTpoClassifyProfileShape(bins, pocIdx) {
      const counts = bins.map(b => b.count), total = counts.reduce((a, b) => a + b, 0);
      if (!total) return 'UNDEFINED';
      let top = 0, bot = 0;
      for (let i = 0; i < counts.length; i++) {
          if (i > pocIdx) top += counts[i]; else if (i < pocIdx) bot += counts[i];
      }
      const skew = (top - bot) / Math.max(1, top + bot);
      let peaks = 0;
      for (let i = 1; i < counts.length - 1; i++)
          if (counts[i] >= counts[i - 1] && counts[i] >= counts[i + 1] && counts[i] > 0) peaks++;
      if (peaks >= 2) return 'B_SHAPE';
      if (skew > 0.18) return 'P_SHAPE';
      if (skew < -0.18) return 'b_SHAPE';
      return 'D_SHAPE';
  }

  function _waTpoDetectExcessTail(bins) {
      const nz = bins.filter(b => b.count > 0);
      if (!nz.length) return { top: false, bottom: false };
      const avg = nz.reduce((s, b) => s + b.count, 0) / nz.length;
      return {
          bottom: nz[0] && nz[0].count <= Math.max(2, avg * 0.25) && (!nz[1] || nz[1].count > nz[0].count),
          top:    nz[nz.length - 1] && nz[nz.length - 1].count <= Math.max(2, avg * 0.25) &&
                  (!nz[nz.length - 2] || nz[nz.length - 2].count > nz[nz.length - 1].count)
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

  function _waTpoGroupByDay(dataList, from, to) {
      const groups = new Map();
      for (let i = from; i < to; i++) {
          const d = dataList[i];
          // FIX: KLineChart dùng 'timestamp' (ms). Bỏ fallback d.date tránh NaN.
          const ts = d ? (d.timestamp ?? d.time ?? null) : null;
          if (!ts || isNaN(ts)) continue;
          const dt = new Date(ts);
          const key = dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
          if (!groups.has(key)) groups.set(key, { start: i, end: i + 1 });
          else groups.get(key).end = i + 1;
      }
      return Array.from(groups.values()).sort((a, b) => a.start - b.start).slice(-10);
  }

  function _waCheckSuperPoc(pocMid, step) {
      if (!window._waVpvrCache || window._waVpvrCache.size === 0) return false;
      for (const cached of window._waVpvrCache.values()) {
          const p = [];
          if (cached.mainProfile) p.push(cached.mainProfile);
          if (cached.sessions) cached.sessions.forEach(s => s.profile && p.push(s.profile));
          for (const vp of p) {
              if (!vp || !vp.poc) continue;
              if (Math.abs((vp.poc.pLow + vp.poc.pHigh) / 2 - pocMid) <= step * 2) return true;
          }
      }
      return false;
  }

  // ─── HELPER: Chuyển đổi pixel đúng API KLineChart ─────────────────────────
  // FIX CHÍNH: yAxis.convertToPixel(price) → KHÔNG TỒN TẠI trong draw callback.
  // Phải dùng helper function bắt yAxis object để tìm đúng method.
  function _getYPixel(yAxis, price) {
      if (!yAxis) return null;
      // KLineChart v9: yAxis có method convertToPixel nhận object
      if (typeof yAxis.convertToPixel === 'function') {
          const result = yAxis.convertToPixel(price);
          // Trả về số trực tiếp hoặc object {y}
          if (typeof result === 'number') return result;
          if (result && typeof result.y === 'number') return result.y;
      }
      // Fallback: thử method getCoordinate (một số build dùng tên này)
      if (typeof yAxis.getCoordinate === 'function') {
          return yAxis.getCoordinate(price);
      }
      return null;
  }

  function _getXPixel(xAxis, dataIndex) {
      if (!xAxis) return null;
      // FIX: Truyền object {dataIndex} thay vì số raw
      if (typeof xAxis.convertToPixel === 'function') {
          const result = xAxis.convertToPixel({ dataIndex });
          if (typeof result === 'number') return result;
          if (result && typeof result.x === 'number') return result.x;
      }
      if (typeof xAxis.getCoordinate === 'function') {
          return xAxis.getCoordinate(dataIndex);
      }
      return null;
  }

  // ─── ĐĂNG KÝ VÀ VẼ ──────────────────────────────────────────────────────────
  kc.registerIndicator({
      name: 'WAVE_TPO',
      shortName: 'TPO',
      description: 'Time Price Opportunity SMART v4.2',
      category: 'wave_alpha',
      series: 'price',
      isStack: true,

      createTooltipDataSource: function() {
          return { name: 'TPO', calcParamsText: ' ', values: [] };
      },

      // FIX QUAN TRỌNG: calcParams chỉ chứa SỐ để gear panel hoạt động.
      // Màu hex được tách ra khỏi đây, lưu trong _WA_DEFAULTS.
      // Bố cục 16 params số (index 0-15):
      //  0: rowCount         1: vaPercent        2: isLeft (0/1)
      //  3: useLetter (0/1)  4: colorMode (0-2)  5: densityMode (0/1)
      //  6: smartLabels      7: opVA (0-100)      8: opOut (0-100)
      //  9: pocW             10: vaW             11: vaStyle (0-2)
      // 12: fontSize        13: showLabels       14: fade (0-100)
      // 15: minLtrPx        16: verbosity
      calcParams: [60, 70, 0, 0, 0, 1, 1, 85, 20, 2, 1, 0, 10, 1, 70, 8, 1],

      figures: [],

      calc: function(dataList) {
          return dataList.map(() => ({}));
      },

      draw: function({ ctx, bounding, xAxis, yAxis, visibleRange, indicator, dataList }) {
          if (!dataList || dataList.length === 0 || !bounding) return false;

          const p = indicator.calcParams;
          // FIX: Đọc params theo index mới (chỉ số, không có màu)
          const C = {
              rowCount:    Math.max(10, Math.min(200, +(p[0]  ?? 60))),
              vaPercent:   Math.max(10, Math.min(100, +(p[1]  ?? 70))),
              isLeft:      +(p[2]  ?? 0) === 0,
              useLetter:   +(p[3]  ?? 0) === 1,
              colorMode:   +(p[4]  ?? 0),
              densityMode: +(p[5]  ?? 1),
              smartLabels: +(p[6]  ?? 1) === 1,
              opVA:        Math.max(0, Math.min(100, +(p[7]  ?? 85))) / 100,
              opOut:       Math.max(0, Math.min(100, +(p[8]  ?? 20))) / 100,
              pocW:        Math.max(1, +(p[9]  ?? 2)),
              vaW:         Math.max(1, +(p[10] ?? 1)),
              vaStyle:     Math.round(+(p[11] ?? 0)),
              fontSize:    Math.max(8, +(p[12] ?? 10)),
              showLabels:  +(p[13] ?? 1) === 1,
              fade:        Math.max(0, +(p[14] ?? 70)) / 100,
              minLtrPx:    Math.max(6, +(p[15] ?? 8)),
              verbosity:   Math.round(+(p[16] ?? 1)),
              // Màu lấy từ defaults (không thay đổi qua calcParams)
              ..._WA_DEFAULTS
          };

          const { from, to } = visibleRange || { from: 0, to: dataList.length };
          if (from >= to) return false;

          // FIX: Thêm bounding.height vào cache key để invalidate khi resize
          const lastClose = dataList[to - 1]?.close ?? 0;
          const cacheKey = `${from}_${to}_${C.rowCount}_${C.vaPercent}_${C.colorMode}_${lastClose}_${bounding.width}_${bounding.height}`;
          let profiles = window._waTpoCache.get(cacheKey);

          if (!profiles) {
              const sessions = C.colorMode === 0
                  ? [{ start: from, end: to }]
                  : _waTpoGroupByDay(dataList, from, to);

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
                      idx: i,
                      pLow:  minP + i * step,
                      pHigh: minP + (i + 1) * step,
                      count: 0, letters: [], inVA: false
                  }));

                  for (let i = s.start; i < s.end; i++) {
                      if (!dataList[i]) continue;
                      const d = dataList[i], lIdx = i - s.start;
                      const sI = Math.max(0, Math.floor((d.low  - minP) / step));
                      const eI = Math.min(C.rowCount - 1, Math.floor((d.high - minP) / step));
                      for (let j = sI; j <= eI; j++) {
                          bins[j].count++;
                          bins[j].letters.push(lIdx);
                          totalTPO++;
                      }
                  }
                  if (totalTPO === 0) return null;

                  let pocBin = bins[0], maxTPO = 0;
                  bins.forEach(b => { if (b.count > maxTPO) { maxTPO = b.count; pocBin = b; } });

                  pocBin.inVA = true;
                  let curVA = pocBin.count, ui = pocBin.idx + 1, di = pocBin.idx - 1;
                  while (curVA < totalTPO * (C.vaPercent / 100) && (ui < C.rowCount || di >= 0)) {
                      let vu = 0, vd = 0;
                      if (ui < C.rowCount) vu += bins[ui].count;
                      if (ui + 1 < C.rowCount) vu += bins[ui + 1].count;
                      if (di >= 0) vd += bins[di].count;
                      if (di - 1 >= 0) vd += bins[di - 1].count;
                      if (vu >= vd && ui < C.rowCount) {
                          bins[ui].inVA = true; curVA += bins[ui].count; ui++;
                      } else if (di >= 0) {
                          bins[di].inVA = true; curVA += bins[di].count; di--;
                      } else if (ui < C.rowCount) {
                          bins[ui].inVA = true; curVA += bins[ui].count; ui++;
                      } else break;
                  }

                  let vahBin = null, valBin = null;
                  for (let i = C.rowCount - 1; i >= 0; i--) if (bins[i].inVA && !vahBin) vahBin = bins[i];
                  for (let i = 0;               i <  C.rowCount; i++) if (bins[i].inVA && !valBin) valBin = bins[i];

                  let ibHigh = null, ibLow = null;
                  if (s.end - s.start >= 2) {
                      ibHigh = Math.max(dataList[s.start].high, dataList[s.start + 1].high);
                      ibLow  = Math.min(dataList[s.start].low,  dataList[s.start + 1].low);
                  }

                  const pocMid = (pocBin.pLow + pocBin.pHigh) / 2;
                  let isNaked = true;
                  for (let i = s.end; i < dataList.length; i++) {
                      if (dataList[i] && dataList[i].low <= pocMid && dataList[i].high >= pocMid) {
                          isNaked = false; break;
                      }
                  }

                  let topC = 0, botC = 0;
                  bins.forEach(b => {
                      if (b.inVA) {
                          if (b.idx > pocBin.idx) topC += b.count;
                          else if (b.idx < pocBin.idx) botC += b.count;
                      }
                  });
                  let imb = 'BALANCED';
                  if (Math.abs(topC - botC) / Math.max(1, topC + botC) > 0.3)
                      imb = topC > botC ? 'BUYING' : 'SELLING';

                  const closePrice = dataList[s.end - 1]?.close ?? pocMid;
                  const closePos   = (closePrice - minP) / Math.max(1e-9, maxP - minP);
                  const inValueClose = !!(valBin && vahBin && closePrice >= valBin.pLow && closePrice <= vahBin.pHigh);

                  const prof = {
                      bins, maxTPO, pocBin, pocMid, vahBin, valBin,
                      ibHigh, ibLow, imbalance: imb, isNaked,
                      totalTPO, minP, maxP, step,
                      startIdx: s.start, endIdx: s.end,
                      close: closePrice, closePos, inValueClose,
                      sessionIdx: idx, sessionTotal: sessions.length
                  };

                  prof.shape       = _waTpoClassifyProfileShape(bins, pocBin.idx);
                  const exc        = _waTpoDetectExcessTail(bins);
                  prof.excessTop   = exc.top;
                  prof.excessBottom= exc.bottom;
                  const poor       = _waTpoDetectPoorHighLow(bins);
                  prof.poorHigh    = poor.poorHigh;
                  prof.poorLow     = poor.poorLow;
                  prof.dayType     = _waTpoClassifyDayType(prof, dataList);
                  prof.auctionState= _waTpoAuctionState(prof);
                  prof.isSuperPoc  = _waCheckSuperPoc(pocMid, step);

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

              profiles.forEach((prof) => {
                  // ── TÍNH anchorX và maxBlocksPx ──────────────────────────────
                  let anchorX, dir, maxBlocksPx;
                  if (C.colorMode === 0) {
                      anchorX     = C.isLeft ? 0 : bounding.width;
                      dir         = C.isLeft ? 1 : -1;
                      maxBlocksPx = bounding.width * (compactMode ? 0.28 : 0.35);
                  } else {
                      // FIX: Dùng _getXPixel với object {dataIndex} thay vì số raw
                      anchorX     = _getXPixel(xAxis, prof.startIdx) ?? 0;
                      dir         = 1;
                      maxBlocksPx = bounding.width * (compactMode ? 0.16 : 0.22);
                  }

                  // ── MÀU & ALPHA THEO PHIÊN ───────────────────────────────────
                  let baseClr = C.clrVA, outClr = C.clrOut, alphaMul = 1;
                  if (C.colorMode === 1) {
                      const ratio = prof.sessionTotal <= 1 ? 0 : prof.sessionIdx / (prof.sessionTotal - 1);
                      baseClr = outClr = _WA_TPO_SESSION_PALETTE[Math.min(4, Math.floor(ratio * 4))];
                      alphaMul = prof.sessionTotal <= 1 ? 1 : (1 - C.fade) + ratio * C.fade;
                  } else if (C.colorMode === 2) {
                      const ratio = prof.sessionTotal <= 1 ? 1 : (1 - C.fade) + (prof.sessionIdx / (prof.sessionTotal - 1)) * C.fade;
                      alphaMul = ratio;
                  }

                  const unitW    = maxBlocksPx / Math.max(1, prof.maxTPO);
                  const stepDraw = (compactMode && !C.useLetter) ? 2 : 1;

                  // ── VẼ BINS ──────────────────────────────────────────────────
                  prof.bins.forEach(bin => {
                      if (bin.count <= 0) return;

                      // FIX: Dùng _getYPixel helper thay vì yAxis.convertToPixel(val) trực tiếp
                      const yB = _getYPixel(yAxis, bin.pLow);
                      const yT = _getYPixel(yAxis, bin.pHigh);
                      if (yB == null || yT == null) return;

                      const rY = Math.min(yT, yB);
                      const rH = Math.max(1, Math.abs(yB - yT));
                      const blockW = Math.max(1, Math.min(rH, unitW));
                      const safeFontSize = Math.floor(Math.min(blockW, rH, C.fontSize));
                      const canLetter = C.useLetter && rH >= 6 && blockW >= C.minLtrPx;

                      let fAlpha = (bin.inVA ? C.opVA : C.opOut) * alphaMul;
                      if (C.colorMode === 2) fAlpha = (0.12 + 0.75 * (bin.count / prof.maxTPO)) * alphaMul;

                      ctx.fillStyle = _waTpoHex2Rgba(bin.inVA ? baseClr : outClr, Math.min(1, Math.max(0, fAlpha)));

                      if (canLetter) {
                          ctx.font        = `bold ${safeFontSize}px monospace`;
                          ctx.textBaseline= 'middle';
                          ctx.textAlign   = 'center';
                          bin.letters.forEach((lIdx, pos) => {
                              if (pos % stepDraw === 0) {
                                  const lx = dir > 0
                                      ? anchorX + pos * blockW + blockW / 2
                                      : anchorX + dir * (pos * blockW) + blockW / 2;
                                  ctx.fillText(_waTpoGetLetter(lIdx), lx, rY + rH / 2);
                              }
                          });
                      } else {
                          ctx.beginPath();
                          bin.letters.forEach((lIdx, pos) => {
                              if (pos % stepDraw === 0) {
                                  const bx = dir > 0
                                      ? anchorX + pos * blockW
                                      : anchorX + dir * (pos * blockW);
                                  ctx.rect(bx, rY, Math.max(1, blockW - 1), Math.max(1, rH - 1));
                              }
                          });
                          ctx.fill();
                      }
                  });

                  // ── VẼ ĐƯỜNG MỨC & NHÃN ─────────────────────────────────────
                  const drawLvl = (price, clr, w, dash, txt, isIB = false) => {
                      // FIX: Dùng _getYPixel
                      const y = _getYPixel(yAxis, price);
                      if (y == null) return;

                      ctx.strokeStyle = _waTpoHex2Rgba(clr, isIB ? 0.6 : 0.85);
                      ctx.lineWidth   = w;
                      ctx.setLineDash(dash);
                      ctx.beginPath();

                      const lineStart = C.colorMode === 0 ? 0 : anchorX;
                      const lineEnd   = C.colorMode === 0 ? bounding.width : anchorX + maxBlocksPx * 1.5;
                      ctx.moveTo(lineStart, y);
                      ctx.lineTo(lineEnd, y);
                      ctx.stroke();
                      ctx.setLineDash([]);

                      if (C.showLabels && !compactMode) {
                          ctx.fillStyle  = _waTpoHex2Rgba(clr, 0.95);
                          ctx.font       = `bold ${Math.max(8, C.fontSize - 1)}px sans-serif`;
                          ctx.textAlign  = (C.colorMode === 0 && C.isLeft) ? 'left' : 'right';
                          const textX    = (C.colorMode === 0 && C.isLeft) ? 4 : (C.colorMode === 0 ? bounding.width - 4 : lineEnd);
                          ctx.fillText(`${txt} ${price.toFixed(2)}`, textX, y - 4);
                      }
                  };

                  if (prof.vahBin) drawLvl(prof.vahBin.pHigh, C.clrVaLine, C.vaW, _waTpoGetDash(C.vaStyle), 'VAH');
                  if (prof.valBin) drawLvl(prof.valBin.pLow,  C.clrVaLine, C.vaW, _waTpoGetDash(C.vaStyle), 'VAL');
                  if (prof.ibHigh && C.colorMode !== 0) drawLvl(prof.ibHigh, C.clrIbHigh, 1, [2, 2], 'IBH', true);
                  if (prof.ibLow  && C.colorMode !== 0) drawLvl(prof.ibLow,  C.clrIbLow,  1, [2, 2], 'IBL', true);

                  // ── VẼ POC ───────────────────────────────────────────────────
                  const pocY = _getYPixel(yAxis, prof.pocMid);
                  if (pocY != null) {
                      const isSuper = prof.isSuperPoc;
                      const clrPoc  = isSuper ? C.clrSuperPoc : (prof.isNaked ? C.clrNpoc : C.clrPoc);

                      ctx.strokeStyle = _waTpoHex2Rgba(clrPoc, 0.9);
                      ctx.lineWidth   = isSuper ? C.pocW + 1 : (prof.isNaked ? Math.max(1, C.pocW - 1) : C.pocW);
                      if (prof.isNaked && !isSuper) ctx.setLineDash([5, 4]);

                      ctx.beginPath();
                      const pocStart = (C.colorMode === 0 && C.isLeft) ? 0 : anchorX;
                      const pocEnd   = (C.colorMode === 0 && C.isLeft) ? bounding.width : anchorX + maxBlocksPx * 1.5;
                      ctx.moveTo(pocStart, pocY);
                      ctx.lineTo(pocEnd, pocY);
                      // Kéo dài Naked POC tới cuối chart (chỉ multi-session mode)
                      if (prof.isNaked && C.colorMode !== 0) ctx.lineTo(bounding.width, pocY);
                      ctx.stroke();
                      ctx.setLineDash([]);

                      if (C.showLabels && !compactMode) {
                          ctx.fillStyle = _waTpoHex2Rgba(clrPoc, 0.95);
                          ctx.font      = `bold ${C.fontSize}px sans-serif`;
                          ctx.textAlign = (C.colorMode === 0 && C.isLeft) ? 'left' : 'right';
                          const textX   = (C.colorMode === 0 && C.isLeft) ? 4 : (C.colorMode === 0 ? bounding.width - 4 : pocEnd);
                          ctx.fillText(`POC ${prof.pocMid.toFixed(2)}`, textX, pocY - 4);
                      }
                  }

                  // ── SMART LABELS (AI Analysis) ───────────────────────────────
                  if (C.smartLabels && C.colorMode !== 0 && !compactMode) {
                      const lblY = _getYPixel(yAxis, prof.maxP);
                      if (lblY != null) {
                          const ly = lblY - 15;
                          ctx.textAlign = 'left';
                          ctx.font      = `bold ${Math.max(8, C.fontSize - 1)}px sans-serif`;
                          ctx.fillStyle = _waTpoHex2Rgba('#FFFFFF', 0.8);
                          ctx.fillText(`[${prof.shape}]`, anchorX, ly);

                          if (C.verbosity > 0) {
                              const imbClr = prof.imbalance === 'BUYING'  ? C.clrImbalBuy
                                           : prof.imbalance === 'SELLING' ? C.clrImbalSell
                                           : '#888888';
                              ctx.fillStyle = _waTpoHex2Rgba(imbClr, 0.8);
                              ctx.fillText(` Imb: ${prof.imbalance}`, anchorX + 60, ly);
                          }
                          if (C.verbosity > 1) {
                              const aucClr = prof.auctionState === 'ACCEPTANCE' ? C.clrAccept
                                           : prof.auctionState === 'REJECTION'  ? C.clrReject
                                           : '#888888';
                              ctx.fillStyle = _waTpoHex2Rgba(aucClr, 0.8);
                              ctx.fillText(` | ${prof.auctionState}`, anchorX, ly - 14);
                          }
                      }
                  }
              }); // end profiles.forEach

          } catch (e) {
              console.error('[WAVE_TPO v4.2]', e);
          } finally {
              ctx.restore();
          }
          return false;
      }
  });
})();

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



// ─────────────────────────────────────────────────
// INDICATOR: WAVE_COB (Version 7.1 - Tiếng Việt & Auto Filter)
// ─────────────────────────────────────────────────
kc.registerIndicator({
  name:        'WAVE_COB',
  shortName:   'COB',
  description: 'Tháp Thanh Khoản DOM',
  category:    'wave_alpha',
  series:      'price',
  isStack:     true,    

  calcParams:  [120, 0, 4, 9995, 500],
  paramLabels: [
    'Độ Rộng Cột COB (px)',
    'Lọc Rác (USD) [Nhập 0 để Auto]',
    'Độ Dày 1 Nấc Giá (px)',
    'Độ Lỳ Của Khung (x/10000)',
    'Tốc Độ Vẽ - FPS (ms)'
  ],

  figures: [],

  calc: function(dataList) { return dataList.map(() => ({})); },

  draw: function({ ctx, bounding, yAxis, indicator }) {
    if (!window.scLocalOrderBook)              return false;
    if (!bounding || bounding.width < 10)      return false;

    const p = indicator.calcParams;
    const colWidth   = Math.max(60,   Math.min(300,   +p[0] || 120));
    let   minVal     = +p[1]; // Cho phép lấy số 0
    if (isNaN(minVal) || minVal < 0) minVal = 0; // Guard lỗi nhập
    
    const barH       = Math.max(3,    Math.min(8,     +p[2] || 4));
    const decayRaw   = Math.max(9900, Math.min(9999,  +p[3] || 9995));
    const decay      = decayRaw / 10000;
    const refreshMs  = Math.max(50,   Math.min(2000,  +p[4] || 500)); // Mặc định 500ms

    if (!window._waCob) {
      window._waCob = {
        snapshot: { asks: new Map(), bids: new Map(), ts: 0 },
        scale:    { maxVol: 0, floor: 0 },
        stats:    { bidTotal: 0, askTotal: 0, ratio: 1 },
        barCache: new Map(), 
        hover:    { y: -1, side: null },
        debug:    false
      };

      window._waCob._onMouseMove = function(e) {
        const canvas = ctx.canvas;
        if (!canvas) return;
        const rect  = canvas.getBoundingClientRect();
        const scaleY = canvas.height / rect.height;
        window._waCob.hover.y = (e.clientY - rect.top) * scaleY;
      };
      window.addEventListener('mousemove', window._waCob._onMouseMove, { passive: true });
    }

    const cob = window._waCob;
    const now = Date.now();
    
    // 🚀 CHẾ ĐỘ AUTO FILTER (Nếu User nhập 0)
    // Tự động tìm ngưỡng lọc: Lọc bỏ các lệnh rác có Volume bé hơn 1.5% so với tường to nhất
    if (minVal === 0) {
        minVal = cob.scale.maxVol * 0.015; 
        if (minVal < 500) minVal = 500; // Sàn tối thiểu là 500$
    }

    if (now - cob.snapshot.ts >= refreshMs) {
      const rawAsks = window.scLocalOrderBook.asks;
      const rawBids = window.scLocalOrderBook.bids;
      if ((rawAsks && rawAsks.size > 0) || (rawBids && rawBids.size > 0)) {
        cob.snapshot.asks = new Map(rawAsks || []);
        cob.snapshot.bids = new Map(rawBids || []);
        cob.snapshot.ts   = now;
      } else if (now - cob.snapshot.ts > 2000) {
        cob.snapshot.ts = now; 
      }
    }

    const asks = cob.snapshot.asks;
    const bids = cob.snapshot.bids;
    const yMapAsks = new Map(); 
    const yMapBids = new Map();
    let currentFrameMax = 0;
    let bidTotal = 0;
    let askTotal = 0;
    const H = bounding.height;
    const OVERFLOW = 20;

    const processBook = (source, target, isAsk) => {
      source.forEach((vol, priceStr) => {
        const price  = parseFloat(priceStr);
        const valUSD = price * vol;
        if (valUSD < minVal) return; // Đã áp dụng Auto Filter hoặc số User nhập

        const exactY = yAxis.convertToPixel(price);
        if (exactY == null || isNaN(exactY) || exactY < -OVERFLOW || exactY > H + OVERFLOW) return; 

        const snappedY = Math.floor(exactY / barH) * barH;
        const existing = target.get(snappedY) || 0;
        const merged   = existing + valUSD;
        
        target.set(snappedY, merged);
        if (merged > currentFrameMax) currentFrameMax = merged;
        if (isAsk) askTotal += valUSD; else bidTotal += valUSD;
      });
    };

    if (asks) processBook(asks, yMapAsks, true);
    if (bids) processBook(bids, yMapBids, false);

    if (yMapAsks.size === 0 && yMapBids.size === 0 && cob.scale.maxVol === 0) return false;

    // SCALE RATCHET
    if (currentFrameMax > 0) {
      if (currentFrameMax > cob.scale.maxVol) cob.scale.maxVol = currentFrameMax; 
      else cob.scale.maxVol = cob.scale.maxVol * decay + currentFrameMax * (1 - decay);
      cob.scale.floor = cob.scale.maxVol * 0.10;
    }
    const renderMax = Math.max(cob.scale.maxVol || 10000, cob.scale.floor || 1000, 10000);

    cob.barCache.forEach(b => b.target = 0);

    yMapAsks.forEach((val, y) => {
        if (!cob.barCache.has(y)) cob.barCache.set(y, { current: 0, target: val, type: 'ask' });
        else cob.barCache.get(y).target = val;
    });
    yMapBids.forEach((val, y) => {
        if (!cob.barCache.has(y)) cob.barCache.set(y, { current: 0, target: val, type: 'bid' });
        else cob.barCache.get(y).target = val;
    });

    const animAsks = new Map();
    const animBids = new Map();

    cob.barCache.forEach((b, y) => {
        b.current += (b.target - b.current) * 0.25;
        if (b.target === 0 && b.current < minVal) {
            cob.barCache.delete(y);
            return;
        }
        if (b.type === 'ask') animAsks.set(y, b.current);
        else animBids.set(y, b.current);
    });

    cob.stats.bidTotal = bidTotal;
    cob.stats.askTotal = askTotal;
    cob.stats.ratio    = askTotal > 0 ? bidTotal / askTotal : 1;

    try {
      ctx.save();
      const startX = Math.round(bounding.width - colWidth); 
      const ASK_BASE_RGB  = '239, 83, 80';   
      const BID_BASE_RGB  = '38, 166, 154';  
      const ASK_GLOW      = `rgba(${ASK_BASE_RGB}, 0.85)`;
      const BID_GLOW      = `rgba(${BID_BASE_RGB}, 0.85)`;
      const ASK_TEXT      = '#FF8A80';
      const BID_TEXT      = '#80CBC4';
      const GAP           = 1;  

      const sep = ctx.createLinearGradient(startX, 0, startX + 1, H);
      sep.addColorStop(0,   'rgba(255,255,255,0.04)');
      sep.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      sep.addColorStop(1,   'rgba(255,255,255,0.04)');
      ctx.fillStyle = sep;
      ctx.fillRect(startX, 0, 1, H);

      const getTop3 = (map) => {
        const arr = [];
        map.forEach((v, y) => arr.push({ y, v }));
        arr.sort((a, b) => b.v - a.v);
        return arr.slice(0, 3);
      };
      
      const top3Asks = getTop3(yMapAsks);
      const top3Bids = getTop3(yMapBids);
      const top3AskSet = new Set(top3Asks.map(x => x.y));
      const top3BidSet = new Set(top3Bids.map(x => x.y));

      const hoverY = cob.hover.y;
      const MAX_BARS = 500; 

      const renderBars = (map, baseRgb, glowColor, topSet) => {
        let count = 0;
        map.forEach((valUSD, y) => {
          if (count++ >= MAX_BARS) return;

          const w    = Math.round((valUSD / renderMax) * colWidth);
          if (w < 1) return;

          const x    = bounding.width - w;
          const barY = y;

          let opacity = 0.20 + (valUSD / renderMax) * 0.65;
          opacity = Math.min(0.85, opacity);

          const isHovered = hoverY >= barY && hoverY < barY + barH;
          if (isHovered) opacity = Math.min(1.0, opacity + 0.25);

          ctx.fillStyle = `rgba(${baseRgb}, ${opacity.toFixed(3)})`;
          ctx.fillRect(x, barY, w, barH - GAP);

          if (topSet.has(y)) {
            ctx.fillStyle = glowColor;
            ctx.fillRect(bounding.width - 1, barY, 1, barH - GAP);
          }
        });
      };

      renderBars(animAsks, ASK_BASE_RGB, ASK_GLOW, top3AskSet);
      renderBars(animBids, BID_BASE_RGB, BID_GLOW, top3BidSet);

      ctx.font         = "bold 9px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur   = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const fmtVol = (v) => {
        if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
        if (v >= 1_000)     return Math.round(v / 1_000) + 'K';
        return Math.round(v).toString();
      };

      const drawLabels = (map, textColor, topSet) => {
        map.forEach((valUSD, y) => {
          const w = Math.round((valUSD / renderMax) * colWidth);
          if (w < colWidth * 0.30) return; 

          const isTop = topSet.has(y);
          ctx.fillStyle = isTop ? '#FFFFFF' : textColor;

          const label = fmtVol(valUSD);
          ctx.fillText(label, bounding.width - w - 4, y + barH / 2);
        });
      };

      drawLabels(animAsks, ASK_TEXT, top3AskSet);
      drawLabels(animBids, BID_TEXT, top3BidSet);

      ctx.shadowColor   = 'transparent';
      ctx.shadowBlur    = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // KHUNG TỔNG QUAN (ĐÃ VIỆT HÓA)
      {
        const panelW  = colWidth - 4;
        const panelH  = 46;
        const panelX  = startX + 2;
        const panelY  = 6;
        const padX    = 5;
        const lineH   = 13;

        const ratio   = cob.stats.ratio;
        const ratioColor = ratio > 1.2 ? '#26A69A' : ratio < 0.8 ? '#EF5350' : '#9E9E9E';
        const ratioIcon  = ratio > 1.2 ? '▲' : ratio < 0.8 ? '▼' : '─';

        ctx.fillStyle = 'rgba(0, 0, 0, 0.60)';
        roundRect(ctx, panelX, panelY, panelW, panelH, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth   = 1;
        roundRect(ctx, panelX, panelY, panelW, panelH, 3);
        ctx.stroke();

        ctx.font      = "9px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = 'left';
        
        ctx.fillStyle = BID_TEXT;
        ctx.fillText('LỰC MUA', panelX + padX, panelY + lineH * 1 - 1);
        ctx.fillStyle = '#E0E0E0';
        ctx.fillText('$' + fmtVol(cob.stats.bidTotal), panelX + padX + 42, panelY + lineH * 1 - 1); // Xích qua phải 1 tí
        
        ctx.fillStyle = ASK_TEXT;
        ctx.fillText('LỰC BÁN', panelX + padX, panelY + lineH * 2 - 1);
        ctx.fillStyle = '#E0E0E0';
        ctx.fillText('$' + fmtVol(cob.stats.askTotal), panelX + padX + 42, panelY + lineH * 2 - 1);
        
        ctx.fillStyle = '#757575';
        ctx.fillText('TỶ LỆ', panelX + padX, panelY + lineH * 3 - 1);
        ctx.fillStyle = ratioColor;
        ctx.fillText(ratio.toFixed(2) + ' ' + ratioIcon, panelX + padX + 42, panelY + lineH * 3 - 1);
      }

      // TOOLTIP KHI RÀ CHUỘT (ĐÃ VIỆT HÓA)
      {
        const hy = cob.hover.y;
        if (hy >= 0 && hy <= H) {
          const snapY = Math.floor(hy / barH) * barH;
          const askVol = yMapAsks.get(snapY);
          const bidVol = yMapBids.get(snapY);
          const vol    = askVol || bidVol;
          const side   = askVol ? 'TƯỜNG BÁN' : bidVol ? 'TƯỜNG MUA' : null;

          if (vol && side) {
            const price = yAxis.convertFromPixel ? yAxis.convertFromPixel(snapY) : null;
            const tipW  = 135;
            const tipH  = 38;
            const tipX  = startX - tipW - 6;
            const tipY  = Math.min(snapY - 4, H - tipH - 4);

            ctx.fillStyle = 'rgba(0,0,0,0.80)';
            roundRect(ctx, tipX, tipY, tipW, tipH, 4);
            ctx.fill();
            ctx.strokeStyle = side === 'TƯỜNG BÁN' ? ASK_GLOW : BID_GLOW;
            ctx.lineWidth = 1;
            roundRect(ctx, tipX, tipY, tipW, tipH, 4);
            ctx.stroke();

            ctx.font      = "bold 9px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
            ctx.textAlign = 'left';
            ctx.fillStyle = side === 'TƯỜNG BÁN' ? ASK_TEXT : BID_TEXT;
            ctx.fillText(side, tipX + 5, tipY + 11);

            if (price !== null && !isNaN(price)) {
              ctx.fillStyle = '#BDBDBD';
              ctx.fillText('Giá: ' + price.toFixed(2), tipX + 5, tipY + 22);
            }
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('$' + fmtVol(vol) + '  (' + ((vol / renderMax) * 100).toFixed(1) + '%)', tipX + 5, tipY + 33);
          }
        }
      }

    } catch (err) {
      if (window._waCob && window._waCob.debug) console.error('[WAVE_COB] draw error:', err);
    } finally {
      ctx.restore();
    }
    return false; 
  },

  destroy: function() {
    if (window._waCob && window._waCob._onMouseMove) {
      window.removeEventListener('mousemove', window._waCob._onMouseMove);
      delete window._waCob._onMouseMove;
    }
    window._waCob = null;
  }
});

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); } else {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
}

// ════════════════════════════════════════════════════════════════════════════════
//  WAVE_VPVR ULTIMATE v3.2 — CORE ENGINE (Fix Color & Clean UI)
// ════════════════════════════════════════════════════════════════════════════════
(function initWaveVpvrCore() {
  'use strict';

  if (!window._waVpvrCache) window._waVpvrCache = new Map();

  function _waVpvrCacheSet(key, value) {
    if (window._waVpvrCache.has(key)) window._waVpvrCache.delete(key);
    window._waVpvrCache.set(key, value);
    if (window._waVpvrCache.size > 10) {
      window._waVpvrCache.delete(window._waVpvrCache.keys().next().value);
    }
  }

  function _waHex2Rgba(val, alpha) {
    // 🚀 FIX: Dạy cho Canvas hiểu màu Trong Suốt
    if (val === 'transparent') return 'rgba(0,0,0,0)';
    
    if (typeof val === 'number') {
      const h = Math.round(val) >>> 0;
      const r = (h >> 16) & 0xFF;
      const g = (h >>  8) & 0xFF;
      const b =  h        & 0xFF;
      return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
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
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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
      const cRange = d.high - d.low;
      let upV = cRange === 0 ? (d.close >= d.open ? d.volume : 0) : d.volume * ((d.close - d.low) / cRange);
      let dnV = d.volume - upV;

      const s = Math.max(0, Math.floor((d.low - minP) / step));
      const e = Math.min(rowCount - 1, Math.floor((d.high - minP) / step));

      for (let j = s; j <= e; j++) {
        const bin = bins[j], oL = Math.max(d.low, bin.pLow), oH = Math.min(d.high, bin.pHigh);
        if (oH > oL) {
          const ratio = (oH - oL) / (cRange || step);
          bin.upVol += upV * ratio; bin.downVol += dnV * ratio; bin.total += d.volume * ratio;
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
      let vu = 0, vd = 0;
      if (ui < rowCount) vu += bins[ui].total; if (ui + 1 < rowCount) vu += bins[ui + 1].total;
      if (di >= 0) vd += bins[di].total; if (di - 1 >= 0) vd += bins[di - 1].total;

      if (vu >= vd && ui < rowCount) { bins[ui].inVA = true; curVA += bins[ui].total; ui++; } 
      else if (di >= 0) { bins[di].inVA = true; curVA += bins[di].total; di--; } 
      else if (ui < rowCount) { bins[ui].inVA = true; curVA += bins[ui].total; ui++; } 
      else break;
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

  function _waGroupBySession(dataList, from, to, sessionMode) {
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
    return Array.from(groups.values()).sort((a, b) => a.start - b.start).slice(-5);
  }

  function _waDrawGradientBar(ctx, clrHex, startX, rectY, w, rectH, isLeft) {
    if (w <= 0 || rectH <= 0) return;
    const x0 = isLeft ? startX : startX + w;
    const x1 = isLeft ? startX + w : startX;
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, _waHex2Rgba(clrHex, 0.85));
    grad.addColorStop(1, _waHex2Rgba(clrHex, 0.15));
    ctx.fillStyle = grad;
    ctx.fillRect(startX, rectY, w, rectH);
  }

  function _waRenderBins(ctx, profile, maxWidthPx, isLeft, bounding, yAxis, C, showDelta) {
    profile.bins.forEach(bin => {
      if (bin.total <= 0) return;
      const yB = yAxis.convertToPixel(bin.pLow), yT = yAxis.convertToPixel(bin.pHigh);
      if (yB === null || yT === null) return;
      
      const rectY = Math.min(yT, yB), rectH = Math.max(1, Math.abs(yB - yT) - 1);
      const wUp = (bin.upVol / profile.maxVol) * maxWidthPx;
      const wDn = (bin.downVol / profile.maxVol) * maxWidthPx;

      ctx.save();
      ctx.globalAlpha = bin.inVA ? C.opacityVA : C.opacityOut;

      if (isLeft) {
        _waDrawGradientBar(ctx, C.clrUp, 0, rectY, wUp, rectH, true);
        _waDrawGradientBar(ctx, C.clrDn, wUp, rectY, wDn, rectH, true);
      } else {
        _waDrawGradientBar(ctx, C.clrDn, bounding.width - wDn, rectY, wDn, rectH, false);
        _waDrawGradientBar(ctx, C.clrUp, bounding.width - wDn - wUp, rectY, wUp, rectH, false);
      }
      ctx.restore();

      // 🚀 FIX: XÓA text "HVN" gây rối, chỉ giữ lại một viền mờ ranh giới mỏng
      if (bin.total > profile.maxVol * 0.80) {
        const totalW = wUp + wDn;
        const hvnX = isLeft ? 0 : bounding.width - totalW;
        ctx.save();
        ctx.strokeStyle = _waHex2Rgba(C.clrHvn, 0.40); ctx.lineWidth = 1;
        ctx.strokeRect(hvnX, rectY, totalW, rectH);
        ctx.restore();
      }

      // 🚀 FIX: XÓA hoàn toàn text "LVN", chỉ giữ lại fill mờ đánh dấu vùng rỗng thanh khoản
      if (bin.total > 0 && bin.total < profile.maxVol * 0.10) {
        const lvnX = isLeft ? 0 : bounding.width - maxWidthPx;
        ctx.save();
        ctx.fillStyle = _waHex2Rgba(C.clrLvn, 0.10); ctx.fillRect(lvnX, rectY, maxWidthPx, rectH);
        ctx.restore();
      }

      if (showDelta && bin.inVA && (bin.upVol + bin.downVol > 0)) {
        const dr = bin.upVol / (bin.upVol + bin.downVol);
        const iconX = isLeft ? wUp + wDn + 6 : bounding.width - wUp - wDn - 6;
        if (dr > 0.75 || dr < 0.25) {
          ctx.save();
          ctx.font = `bold ${Math.max(8, C.fontSize - 2)}px system-ui,sans-serif`; 
          ctx.textBaseline = 'middle'; ctx.textAlign = isLeft ? 'left' : 'right';
          ctx.fillStyle = dr > 0.75 ? _waHex2Rgba(C.clrDeltaUp, 1) : _waHex2Rgba(C.clrDn, 1);
          ctx.fillText(dr > 0.75 ? '▲' : '▼', iconX, rectY + rectH / 2);
          ctx.restore();
        }
      }
    });
  }

  function _waRenderPOCLine(ctx, profile, maxWidthPx, isLeft, bounding, yAxis, dataList, C) {
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

    ctx.save();
    ctx.shadowColor = _waHex2Rgba(C.clrPoc, 0.60); ctx.shadowBlur = 5;
    ctx.strokeStyle = _waHex2Rgba(C.clrPoc, 0.95); ctx.lineWidth = C.pocLineWidth;
    ctx.beginPath();
    if (isLeft) { ctx.moveTo(0, pocY); ctx.lineTo(maxWidthPx + 20, pocY); }
    else        { ctx.moveTo(bounding.width, pocY); ctx.lineTo(bounding.width - maxWidthPx - 20, pocY); }
    ctx.stroke(); ctx.shadowBlur = 0;

    if (isNaked) {
      ctx.strokeStyle = _waHex2Rgba(C.clrNpoc, 0.55); ctx.lineWidth = Math.max(1, C.pocLineWidth - 1);
      ctx.setLineDash(_waGetDash(C.npocStyle, 'npoc')); ctx.beginPath();
      if (isLeft) { ctx.moveTo(maxWidthPx + 20, pocY); ctx.lineTo(bounding.width, pocY); }
      else        { ctx.moveTo(bounding.width - maxWidthPx - 20, pocY); ctx.lineTo(0, pocY); }
      ctx.stroke(); ctx.setLineDash([]);
      
      if (C.showLabels) {
        ctx.fillStyle = _waHex2Rgba(C.clrNpoc, 0.88); ctx.font = `bold ${C.fontSize - 1}px system-ui,sans-serif`; ctx.textBaseline = 'bottom';
        if (isLeft) { ctx.textAlign = 'right'; ctx.fillText('nPOC', bounding.width - 4, pocY - 2); }
        else        { ctx.textAlign = 'left';  ctx.fillText('nPOC', 4, pocY - 2); }
      }
    }

    if (C.showLabels) {
      const label = 'POC ' + pocMid.toLocaleString('en-US', { maximumFractionDigits: 2 });
      ctx.font = `bold ${C.fontSize}px system-ui,sans-serif`; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width, bW = tw + 10, bH = C.fontSize + 8;
      const bX = isLeft ? maxWidthPx + 25 : bounding.width - maxWidthPx - 25 - bW;
      _waRoundRect(ctx, bX, pocY - bH / 2, bW, bH, 3);
      ctx.fillStyle = _waHex2Rgba(C.clrPoc, 1); ctx.fill();
      ctx.fillStyle = '#000000'; ctx.textAlign = 'left'; ctx.fillText(label, bX + 5, pocY);
    }
    ctx.restore();
  }

  function _waRenderVALines(ctx, profile, maxWidthPx, isLeft, bounding, yAxis, C) {
    ctx.save();
    ctx.strokeStyle = _waHex2Rgba(C.clrVa, 0.88); ctx.lineWidth = C.vaLineWidth;
    const dashPat = _waGetDash(C.vaStyle, 'va');

    if (profile.vah !== null) {
      const vahY = yAxis.convertToPixel(profile.vah);
      if (vahY !== null) {
        ctx.setLineDash(dashPat); ctx.beginPath();
        ctx.moveTo(isLeft ? 0 : bounding.width, vahY); ctx.lineTo(isLeft ? bounding.width : 0, vahY); ctx.stroke();
        if (C.showLabels) {
          ctx.setLineDash([]); ctx.fillStyle = _waHex2Rgba(C.clrVa, 0.95); ctx.font = `bold ${C.fontSize - 1}px system-ui,sans-serif`;
          ctx.textBaseline = 'bottom'; ctx.textAlign = isLeft ? 'left' : 'right';
          ctx.fillText('VAH ' + profile.vah.toLocaleString('en-US', { maximumFractionDigits: 2 }), isLeft ? 4 : bounding.width - 4, vahY - 2);
        }
      }
    }
    if (profile.val !== null) {
      const valY = yAxis.convertToPixel(profile.val);
      if (valY !== null) {
        ctx.setLineDash(dashPat); ctx.beginPath();
        ctx.moveTo(isLeft ? 0 : bounding.width, valY); ctx.lineTo(isLeft ? bounding.width : 0, valY); ctx.stroke();
        if (C.showLabels) {
          ctx.setLineDash([]); ctx.fillStyle = _waHex2Rgba(C.clrVa, 0.95); ctx.font = `bold ${C.fontSize - 1}px system-ui,sans-serif`;
          ctx.textBaseline = 'top'; ctx.textAlign = isLeft ? 'left' : 'right';
          ctx.fillText('VAL ' + profile.val.toLocaleString('en-US', { maximumFractionDigits: 2 }), isLeft ? 4 : bounding.width - 4, valY + 2);
        }
      }
    }
    ctx.restore();
  }

  kc.registerIndicator({
    name: 'WAVE_VPVR',
    shortName: 'VPVR',
    description: 'Volume Profile Visible Range ULTIMATE v3.2',
    category: 'wave_alpha',
    series: 'price',
    isStack: true,
    createTooltipDataSource: function(args) {
      return {
          name: 'VPVR', 
          calcParamsText: ' ', 
          values: []
      };
  },
    calcParams: [
      60, 70, 30, 0, 0, 0,
      "#26A69A", "#EF5350", "#F0B90B", "#9575CD",
      "#FFFFFF", "#FF9800", "#F0B90B", "#26A69A",
      80, 25, 2, 1, 0, 0, 10, 1,
    ],
    figures: [],

    calc: function(dataList) { return dataList.map(() => ({})); },

    draw: function(args) {
      const dataList = args.kLineDataList || args.dataList || [];
      const visibleRange = args.visibleRange || { from: 0, to: dataList.length };
      const { ctx, bounding, yAxis, indicator } = args;

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
      };

      const { from, to } = visibleRange;
      if (from == null || to == null || from >= to) return false;

      const maxWidthPx = bounding.width * (widthPct / 100);
      const GAP = 1;
      const liveVolume = dataList[to - 1] ? (dataList[to - 1].volume || 0) : 0;
      
      const cacheKey = `${from}_${to}_${rowCount}_${vaPercent}_${sessionMode}_${compositeMode}_${liveVolume}`;
      let cached = window._waVpvrCache.get(cacheKey);

      if (!cached) {
        let mainProfile = null, sessions = [], compProfile = null;
        if (sessionMode === 0) {
          mainProfile = _waCalcVpvrProfile(dataList, from, to, rowCount, vaPercent);
        } else {
          sessions = _waGroupBySession(dataList, from, to, sessionMode).map((g, idx, arr) => ({
            profile: _waCalcVpvrProfile(dataList, g.start, g.end, rowCount, vaPercent),
            layerIdx: idx, total: arr.length
          })).filter(s => s.profile !== null);
        }
        if (compositeMode === 1) compProfile = _waCalcVpvrProfile(dataList, 0, dataList.length, rowCount, vaPercent);
        
        cached = { mainProfile, sessions, compProfile };
        _waVpvrCacheSet(cacheKey, cached);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      if (compositeMode === 1 && cached.compProfile) {
        ctx.save(); ctx.globalAlpha = 0.25;
        _waRenderBins(ctx, cached.compProfile, maxWidthPx, isLeft, bounding, yAxis, C, false);
        ctx.restore();
      }

      if (sessionMode > 0 && cached.sessions.length > 0) {
        cached.sessions.forEach(({ profile, layerIdx, total }) => {
          if (!profile) return;
          ctx.save(); ctx.globalAlpha = total <= 1 ? 0.85 : 0.20 + (layerIdx / (total - 1)) * 0.65;
          _waRenderBins(ctx, profile, maxWidthPx, isLeft, bounding, yAxis, C, true);
          ctx.restore();
          _waRenderPOCLine(ctx, profile, maxWidthPx, isLeft, bounding, yAxis, dataList, C);
          _waRenderVALines(ctx, profile, maxWidthPx, isLeft, bounding, yAxis, C);
        });
      } else if (cached.mainProfile) {
        _waRenderBins(ctx, cached.mainProfile, maxWidthPx, isLeft, bounding, yAxis, C, true);
        _waRenderPOCLine(ctx, cached.mainProfile, maxWidthPx, isLeft, bounding, yAxis, dataList, C);
        _waRenderVALines(ctx, cached.mainProfile, maxWidthPx, isLeft, bounding, yAxis, C);
      }

      ctx.restore();
      return false;
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════════════
//  WAVE_TPO ULTIMATE v3.1 — CORE ENGINE (ĐÃ FIX LỖI CRASH CHỮ + TỐI ƯU 100x FPS)
// ════════════════════════════════════════════════════════════════════════════════
(function initWaveTpoCore() {
  'use strict';

  if (!window._waTpoCache) window._waTpoCache = new Map();

  function _waTpoCacheSet(key, value) {
      if (window._waTpoCache.has(key)) window._waTpoCache.delete(key);
      window._waTpoCache.set(key, value);
      if (window._waTpoCache.size > 10) {
          window._waTpoCache.delete(window._waTpoCache.keys().next().value);
      }
  }

  function _waHex2Rgba(val, alpha) {
      if (val === 'transparent') return 'rgba(0,0,0,0)';
      if (typeof val === 'number') {
          const h = Math.round(val) >>> 0;
          const r = (h >> 16) & 0xFF, g = (h >> 8) & 0xFF, b = h & 0xFF;
          return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
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
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
  }

  kc.registerIndicator({
      name: 'WAVE_TPO',
      shortName: 'TPO',
      description: 'Time Price Opportunity (Market Profile) ULTIMATE v3.1',
      category: 'wave_alpha',
      series: 'price',
      isStack: true,

      createTooltipDataSource: function(args) {
          return { name: 'TPO', calcParamsText: ' ', values: [] };
      },

      calcParams: [
          60, 70, 35, 0, 0, 0,
          "#9C27B0", "#9C27B0", "#141822", "#F0B90B",
          "#BA68C8", "#FFD600", "#FF9800", "#2196F3",
          75, 15, 0, 2, 1, 0, 0, 9, 1
      ],
      figures: [],

      calc: function (dataList) { return dataList.map(() => ({})); },

      draw: function (args) {
          const { ctx, bounding, xAxis, yAxis, indicator } = args;
          const dataList = args.kLineDataList || args.dataList || [];
          const visibleRange = args.visibleRange || { from: 0, to: dataList.length };

          if (!dataList || dataList.length === 0 || !bounding) return false;

          const p = indicator.calcParams;
          
          const rowCount = Math.max(10, Math.min(200, +(p[0] ?? 60)));
          const vaPercent = Math.max(10, Math.min(100, +(p[1] ?? 70)));
          const widthPct = Math.max(10, Math.min(100, +(p[2] ?? 35)));
          const isLeft = +(p[3] ?? 0) === 0;
          const useLetter = +(p[4] ?? 0) === 1;
          const colorMode = +(p[5] ?? 0); 

          const C = {
              clrVa: p[6] || "#9C27B0",
              clrOut: p[7] || "#9C27B0",
              clrBg: p[8] || "#141822",
              clrPoc: p[9] || "#F0B90B",
              clrVahVal: p[10] || "#BA68C8",
              clrIb: p[11] || "#FFD600",
              clrNpoc: p[12] || "#FF9800",
              clrImb: p[13] || "#2196F3",
              opVa: Math.max(0, Math.min(100, +(p[14] ?? 75))) / 100,
              opOut: Math.max(0, Math.min(100, +(p[15] ?? 15))) / 100,
              opBg: Math.max(0, Math.min(100, +(p[16] ?? 0))) / 100, 
              pocWidth: Math.max(1, Math.min(5, +(p[17] ?? 2))),
              vaWidth: Math.max(1, Math.min(4, +(p[18] ?? 1))),
              vaStyle: Math.round(+(p[19] ?? 0)),
              npocStyle: Math.round(+(p[20] ?? 0)),
              fontSize: Math.max(8, Math.min(16, +(p[21] ?? 9))),
              showLabels: +(p[22] ?? 1) === 1
          };

          let from = Math.max(0, visibleRange.from !== undefined ? visibleRange.from : 0);
          let to = Math.min(dataList.length, visibleRange.to !== undefined ? visibleRange.to : dataList.length);
          if (from >= to) return false;

          let sessions = [];
          if (colorMode === 0 || colorMode === 2) {
              sessions.push({ start: from, end: to });
          } else {
              let curDay = -1, startIdx = from;
              for (let i = from; i < to; i++) {
                  const dt = new Date(dataList[i].timestamp);
                  const day = dt.getUTCDate();
                  if (curDay === -1) curDay = day;
                  else if (day !== curDay) {
                      sessions.push({ start: startIdx, end: i });
                      startIdx = i; curDay = day;
                  }
              }
              sessions.push({ start: startIdx, end: to });
              if (sessions.length > 5) sessions = sessions.slice(-5);
          }

          // 🚀 FIX CACHE 1: Cấu trúc CacheKey an toàn
          const lastClose = dataList[to - 1] ? (dataList[to - 1].close || 0) : 0;
          const cacheKey = `${from}_${to}_${rowCount}_${vaPercent}_${colorMode}_${lastClose}`;

          let profilesToRender = [];

          if (window._waTpoCache.has(cacheKey)) {
              profilesToRender = window._waTpoCache.get(cacheKey);
          } else {
              for (let s of sessions) {
                  if (s.end - s.start <= 0) continue;
                  
                  let maxP = -Infinity, minP = Infinity, totalTPO = 0;
                  for (let i = s.start; i < s.end; i++) {
                      const d = dataList[i]; if (!d) continue;
                      if (d.high > maxP) maxP = d.high;
                      if (d.low < minP) minP = d.low;
                  }
                  if (maxP === -Infinity || maxP === minP) continue;

                  const step = (maxP - minP) / rowCount;
                  const bins = new Array(rowCount).fill(0).map((_, i) => ({
                      idx: i, pLow: minP + i * step, pHigh: minP + (i + 1) * step,
                      count: 0, letters: [], inVA: false
                  }));

                  for (let i = s.start; i < s.end; i++) {
                      const d = dataList[i]; if (!d) continue;
                      const sIdx = Math.max(0, Math.floor((d.low - minP) / step));
                      const eIdx = Math.min(rowCount - 1, Math.floor((d.high - minP) / step));
                      const letterIdx = i - s.start; 
                      for (let j = sIdx; j <= eIdx; j++) {
                          bins[j].count += 1;
                          bins[j].letters.push(letterIdx);
                          totalTPO += 1;
                      }
                  }

                  if (totalTPO === 0) continue;

                  let pocBin = bins[0], maxTPO = 0;
                  bins.forEach(b => { if (b.count > maxTPO) { maxTPO = b.count; pocBin = b; } });

                  pocBin.inVA = true;
                  let cVA = pocBin.count, tVA = totalTPO * (vaPercent / 100);
                  let uI = pocBin.idx + 1, dI = pocBin.idx - 1;

                  while (cVA < tVA && (uI < rowCount || dI >= 0)) {
                      let vU = 0, vD = 0;
                      if (uI < rowCount) vU += bins[uI].count; if (uI + 1 < rowCount) vU += bins[uI + 1].count;
                      if (dI >= 0) vD += bins[dI].count; if (dI - 1 >= 0) vD += bins[dI - 1].count;

                      if (vU >= vD && uI < rowCount) { bins[uI].inVA = true; cVA += bins[uI].count; uI++; }
                      else if (dI >= 0) { bins[dI].inVA = true; cVA += bins[dI].count; dI--; }
                      else if (uI < rowCount) { bins[uI].inVA = true; cVA += bins[uI].count; uI++; }
                      else break;
                  }

                  let vah = null, val = null;
                  for (let i = rowCount - 1; i >= 0; i--) { if (bins[i].inVA && !vah) vah = bins[i]; }
                  for (let i = 0; i < rowCount; i++) { if (bins[i].inVA && !val) val = bins[i]; }

                  let ibHigh = null, ibLow = null;
                  if (s.end - s.start >= 2) {
                      ibHigh = Math.max(dataList[s.start].high, dataList[s.start + 1].high);
                      ibLow = Math.min(dataList[s.start].low, dataList[s.start + 1].low);
                  }

                  let topCount = 0, botCount = 0;
                  for (let b of bins) {
                      if (b.inVA) {
                          if (b.idx > pocBin.idx) topCount += b.count;
                          else if (b.idx < pocBin.idx) botCount += b.count;
                      }
                  }
                  let imbalance = 'BALANCE';
                  const diff = Math.abs(topCount - botCount) / (topCount + botCount || 1);
                  if (diff > 0.3) imbalance = topCount > botCount ? 'BUYING IMBALANCE' : 'SELLING IMBALANCE';

                  let isNaked = true;
                  const pocMid = (pocBin.pLow + pocBin.pHigh) / 2;
                  for (let i = s.end; i < dataList.length; i++) {
                      const d = dataList[i];
                      if (d && d.low <= pocMid && d.high >= pocMid) { isNaked = false; break; }
                  }

                  let isSuperPoc = false;
                  if (window._waVpvrCache) {
                      for (const vCache of window._waVpvrCache.values()) {
                          if (vCache.mainProfile && vCache.mainProfile.poc) {
                              const vMid = (vCache.mainProfile.poc.pLow + vCache.mainProfile.poc.pHigh) / 2;
                              if (Math.abs(vMid - pocMid) <= step * 2) { isSuperPoc = true; break; }
                          }
                      }
                  }

                  profilesToRender.push({ bins, maxTPO, pocMid, vah, val, ibHigh, ibLow, imbalance, isNaked, isSuperPoc, startIdx: s.start });
              }
              
              // 🚀 FIX CACHE 2: Đã xóa phần gọi sai tên hàm (lưu cache thành công)
              _waTpoCacheSet(cacheKey, profilesToRender);
          }

          // ─────────────────────────────────────────────────────────────
          // RENDER ENGINE (ĐÃ TỐI ƯU HÓA 100x)
          // ─────────────────────────────────────────────────────────────
          try {
              ctx.save();
              ctx.globalCompositeOperation = 'source-over';
              ctx.textBaseline = 'middle';

              const getLetter = (n) => {
                  if (n < 26) return String.fromCharCode(65 + n);
                  if (n < 52) return String.fromCharCode(97 + n - 26);
                  return String.fromCharCode(65 + Math.floor(n / 26) - 2) + String.fromCharCode(65 + (n % 26));
              };

              const PALETTE = ['#00BCD4', '#2196F3', '#3F51B5', '#673AB7', '#9C27B0'];

              profilesToRender.forEach((prof, pIndex) => {
                  let anchorX = 0, dir = 1;
                  let maxScreenPx = bounding.width * (widthPct / 100);

                  if (colorMode === 1) { 
                      anchorX = xAxis.convertToPixel(prof.startIdx) || xAxis.convertToPixel({ index: prof.startIdx });
                      dir = 1;
                      maxScreenPx = maxScreenPx * 0.7; 
                  } else { 
                      anchorX = isLeft ? 0 : bounding.width;
                      dir = isLeft ? 1 : -1;
                  }

                  if (C.opBg > 0 && prof.vah && prof.val) {
                      const yVAH = yAxis.convertToPixel(prof.vah.pHigh);
                      const yVAL = yAxis.convertToPixel(prof.val.pLow);
                      if (yVAH !== null && yVAL !== null) {
                          ctx.fillStyle = _waHex2Rgba(C.clrBg, C.opBg);
                          ctx.fillRect(colorMode === 1 ? anchorX : 0, Math.min(yVAH, yVAL), 
                                       colorMode === 1 ? maxScreenPx * 1.5 : bounding.width, Math.abs(yVAH - yVAL));
                      }
                  }

                  prof.bins.forEach(bin => {
                      if (bin.count <= 0) return;
                      let yB = yAxis.convertToPixel(bin.pLow), yT = yAxis.convertToPixel(bin.pHigh);
                      if (yB === null || yT === null) return;

                      const rY = Math.min(yT, yB), rH = Math.max(1, Math.abs(yB - yT));
                      let blockW = Math.min(rH, maxScreenPx / prof.maxTPO);
                      
                      // 🚀 FIX 3: Ép hiển thị chữ an toàn. Nếu zoom quá nhỏ (<6px) tự động biến thành khối
                      const canDrawLetter = useLetter && rH >= 6 && blockW >= 6;

                      let fillClr = bin.inVA ? _waHex2Rgba(C.clrVa, C.opVa) : _waHex2Rgba(C.clrOut, C.opOut);
                      let textClr = bin.inVA ? _waHex2Rgba(C.clrVa, 1) : _waHex2Rgba(C.clrOut, 0.8);
                      
                      if (colorMode === 1) { 
                          const palHex = PALETTE[pIndex % 5];
                          fillClr = bin.inVA ? _waHex2Rgba(palHex, C.opVa) : _waHex2Rgba(palHex, C.opOut);
                          textClr = bin.inVA ? _waHex2Rgba(palHex, 1) : _waHex2Rgba(palHex, 0.8);
                      } else if (colorMode === 2) { 
                          const heatOp = 0.15 + 0.85 * (bin.count / prof.maxTPO);
                          fillClr = _waHex2Rgba(C.clrVa, heatOp);
                          textClr = _waHex2Rgba(C.clrVa, Math.min(1, heatOp + 0.5));
                      }

                      // 🚀 FIX 4: BATCH RENDERING (Gom tất cả khối vào 1 nét vẽ duy nhất)
                      if (!canDrawLetter) {
                          ctx.fillStyle = fillClr;
                          ctx.beginPath();
                          bin.letters.forEach((lIdx, pos) => {
                              const x = anchorX + dir * (pos * blockW);
                              // Frustum Culling: Bỏ qua nếu vẽ ngoài rìa màn hình
                              if (dir === 1 && x > bounding.width) return;
                              if (dir === -1 && x < 0) return;
                              ctx.rect(x, rY, Math.max(1, blockW - 1), Math.max(1, rH - 1));
                          });
                          ctx.fill(); // Vẽ tất cả trong 1 lần gọi (Cứu cánh cho RAM)
                      } else {
                          ctx.fillStyle = textClr;
                          const dynamicFontSize = Math.round(Math.max(6, Math.min(C.fontSize, rH * 1.2)));
                          ctx.font = `bold ${dynamicFontSize}px monospace`;
                          ctx.textAlign = 'center';
                          bin.letters.forEach((lIdx, pos) => {
                              const x = anchorX + dir * (pos * blockW);
                              if (dir === 1 && x > bounding.width) return;
                              if (dir === -1 && x < 0) return;
                              ctx.fillText(getLetter(lIdx), x + blockW/2, rY + rH/2 + 1);
                          });
                      }
                  });

                  const drawLineLabel = (pLevel, text) => {
                      const y = yAxis.convertToPixel(pLevel);
                      if (y === null) return;
                      ctx.setLineDash(_waGetDash(C.vaStyle, 'va'));
                      ctx.strokeStyle = _waHex2Rgba(C.clrVahVal, 0.88);
                      ctx.lineWidth = C.vaLineWidth;
                      ctx.beginPath(); ctx.moveTo(anchorX, y); 
                      ctx.lineTo(colorMode === 1 ? anchorX + maxScreenPx : bounding.width, y); 
                      ctx.stroke(); ctx.setLineDash([]);
                      
                      if (C.showLabels) {
                          ctx.fillStyle = _waHex2Rgba(C.clrVahVal, 0.95);
                          ctx.font = `bold ${Math.max(8, C.fontSize - 1)}px sans-serif`;
                          ctx.textAlign = dir === 1 ? 'right' : 'left';
                          const tx = dir === 1 ? anchorX + maxScreenPx : anchorX - maxScreenPx;
                          ctx.fillText(`${text} ${pLevel.toFixed(2)}`, tx, y - 4);
                      }
                  };
                  if (prof.vah) drawLineLabel(prof.vah.pHigh, 'VAH');
                  if (prof.val) drawLineLabel(prof.val.pLow, 'VAL');

                  if (C.opBg > 0) {
                      const drawIbLine = (pLevel, text) => {
                          const y = yAxis.convertToPixel(pLevel);
                          if (y === null) return;
                          ctx.setLineDash([2, 4]);
                          ctx.strokeStyle = _waHex2Rgba(C.clrIb, 0.6);
                          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bounding.width, y); ctx.stroke(); ctx.setLineDash([]);
                          if (C.showLabels) {
                              ctx.fillStyle = _waHex2Rgba(C.clrIb, 0.9); ctx.font = `bold ${Math.max(8, C.fontSize - 2)}px sans-serif`; 
                              ctx.textAlign = 'left'; ctx.fillText(text, 10, y - 4);
                          }
                      };
                      if (prof.ibHigh !== null) drawIbLine(prof.ibHigh, 'IB High');
                      if (prof.ibLow !== null) drawIbLine(prof.ibLow, 'IB Low');
                  }

                  const pocY = yAxis.convertToPixel(prof.pocMid);
                  if (pocY !== null) {
                      ctx.beginPath();
                      if (prof.isSuperPoc) {
                          ctx.shadowColor = _waHex2Rgba(C.clrPoc, 0.6); ctx.shadowBlur = 8;
                          ctx.strokeStyle = _waHex2Rgba(C.clrPoc, 1); ctx.lineWidth = C.pocLineWidth + 1;
                      } else {
                          ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
                          ctx.strokeStyle = prof.isNaked ? _waHex2Rgba(C.clrNpoc, 0.8) : _waHex2Rgba(C.clrPoc, 0.9);
                          ctx.lineWidth = prof.isNaked ? Math.max(1, C.pocLineWidth - 1) : C.pocLineWidth;
                          if (prof.isNaked) ctx.setLineDash(_waGetDash(C.npocStyle, 'npoc'));
                      }
                      
                      const pEndX = prof.isNaked ? bounding.width : (anchorX + dir * maxScreenPx);
                      ctx.moveTo(anchorX, pocY); ctx.lineTo(pEndX, pocY); ctx.stroke();
                      ctx.setLineDash([]); ctx.shadowBlur = 0;
                      
                      if (C.showLabels) {
                          let lblText = prof.isSuperPoc ? '⚡ SUPER POC' : (prof.isNaked ? 'nTPO' : 'TPO POC');
                          lblText += ' ' + prof.pocMid.toLocaleString('en-US', { maximumFractionDigits: 2 });
                          ctx.font = `bold ${C.fontSize}px system-ui,sans-serif`;
                          const tw = ctx.measureText(lblText).width, bW = tw + 10, bH = C.fontSize + 8;
                          const bX = dir === 1 ? pEndX - bW - 10 : pEndX + 10;
                          
                          _waRoundRect(ctx, bX, pocY - bH / 2, bW, bH, 3);
                          ctx.fillStyle = prof.isSuperPoc ? _waHex2Rgba(C.clrPoc, 1) : (prof.isNaked ? _waHex2Rgba(C.clrNpoc, 1) : _waHex2Rgba(C.clrPoc, 1));
                          ctx.fill();
                          ctx.fillStyle = '#000000'; ctx.textAlign = 'left'; ctx.fillText(lblText, bX + 5, pocY);
                      }
                  }

                  if (C.showLabels && prof.vah) {
                      ctx.font = `bold ${C.fontSize}px sans-serif`;
                      ctx.textAlign = dir === 1 ? 'left' : 'right';
                      const imbClr = prof.imbalance === 'BALANCE' ? _waHex2Rgba(C.clrImb, 0.7) : (prof.imbalance.includes('BUYING') ? '#0ECB81' : '#F6465D');
                      ctx.fillStyle = imbClr;
                      const topY = yAxis.convertToPixel(prof.vah.pHigh) - 15;
                      ctx.fillText(prof.imbalance, anchorX + dir * 10, topY);
                  }
              });

          } catch (e) {
              console.error('[WAVE_TPO]', e);
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
    { key: 'all',        label: 'Tất cả'   },
    { key: 'wave_alpha', label: '⚡ Wave Alpha' },
    { key: 'trend',      label: 'Xu hướng'  },
    { key: 'oscillator', label: 'Dao động'  },
    { key: 'volume',     label: 'Khối lượng'},
    { key: 'volatility', label: 'Biến động' },
  ];

  /**
   * Build the indicator library modal HTML
   */
  function buildIndicatorModalHTML() {
    const tabsHTML = CATEGORIES.map((cat, i) => {
      return `<button class="wa-tab ${i === 0 ? 'active' : ''}" data-cat="${cat.key}">${cat.label}</button>`;
    }).join('');
  
    return `
      <!-- Đã bỏ lớp mờ đen (backdrop-filter/rgba), chỉ giữ lại đúng cái khung nội dung -->
      <div id="sc-indicator-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:${COLOR.bg}; width:640px; height:520px; max-width:92vw; max-height:86vh; border-radius:14px; border:1px solid ${COLOR.border}; box-shadow:0 20px 60px rgba(0,0,0,0.6); z-index:99999; flex-direction:column; overflow:hidden;">
        
        <!-- Header -->
        <div style="padding:14px 20px; border-bottom:1px solid ${COLOR.border}; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
          <h5 style="margin:0; color:${COLOR.white}; font-size:15px; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span style="color:${COLOR.cyan}; font-size:18px;">∿</span> Thư viện Chỉ báo
          </h5>
          <button id="wa-ind-modal-close" aria-label="Đóng" style="background:transparent; border:none; color:${COLOR.muted}; cursor:pointer; font-size:18px; line-height:1; padding:2px 6px; border-radius:4px; transition:color .15s;">✕</button>
        </div>
  
        <!-- Search -->
        <div style="padding:12px 20px; border-bottom:1px solid ${COLOR.border}; flex-shrink:0;">
          <div style="position:relative;">
            <span style="position:absolute; left:11px; top:50%; transform:translateY(-50%); color:${COLOR.muted}; font-size:13px; pointer-events:none;">🔍</span>
            <input id="wa-ind-search" type="text" placeholder="Tìm kiếm chỉ báo..." autocomplete="off" style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.35); border:1px solid ${COLOR.border}; border-radius:8px; padding:8px 12px 8px 34px; color:${COLOR.white}; outline:none; font-size:13px; transition:border-color .15s;">
          </div>
        </div>
  
        <!-- Tabs -->
        <div id="wa-ind-tabs" style="display:flex; gap:4px; padding:10px 20px 0; overflow-x:auto; flex-shrink:0; scrollbar-width:none;">
          ${tabsHTML}
        </div>
  
        <!-- List -->
        <div id="wa-ind-list" style="flex:1; overflow-y:auto; padding:10px 14px 14px; display:grid; grid-template-columns:1fr 1fr; gap:6px; align-content: start;"></div>
        
        <!-- Empty state -->
        <div id="wa-ind-empty" style="display:none; flex:1; align-items:center; justify-content:center; padding:30px; color:${COLOR.muted}; font-size:13px; text-align:center;">
          Không tìm thấy chỉ báo phù hợp
        </div>
      </div>
    `;
  }

  /**
   * Build the settings modal HTML
   */
  function buildSettingsModalHTML() {
    return `
    <div id="sc-ind-settings-modal" style="display:none; position:fixed; inset:0;
         background:rgba(0,0,0,0.75); z-index:999999; backdrop-filter:blur(6px);
         justify-content:center; align-items:center;">
      <div style="background:${COLOR.bg}; width:340px; max-width:90vw; border-radius:14px;
           border:1px solid ${COLOR.border}; box-shadow:0 16px 50px rgba(0,0,0,0.9);
           overflow:hidden; display:flex; flex-direction:column;">

        <!-- Header -->
        <div style="padding:14px 20px; border-bottom:1px solid ${COLOR.border};
             display:flex; justify-content:space-between; align-items:center;">
          <h5 id="sc-ind-settings-title" style="margin:0; color:${COLOR.white}; font-size:15px; font-weight:700;">⚙️ Cài đặt</h5>
          <button id="wa-settings-close" style="background:transparent; border:none;
              color:${COLOR.muted}; cursor:pointer; font-size:18px; line-height:1; padding:2px 6px;">✕</button>
        </div>

        <!-- Body -->
        <div id="sc-ind-settings-body" style="padding:18px 20px; display:flex;
             flex-direction:column; gap:13px; overflow-y:auto; max-height:60vh;"></div>

        <!-- Footer -->
        <div style="padding:13px 20px; background:rgba(0,0,0,0.2);
             border-top:1px solid ${COLOR.border};
             display:flex; justify-content:space-between; align-items:center;">
          <button id="sc-ind-btn-reset" style="background:transparent; border:1px solid ${COLOR.border};
              color:${COLOR.muted}; padding:6px 14px; border-radius:6px; font-size:12px;
              cursor:pointer; transition:.15s;">↩ Mặc định</button>
          <button id="sc-ind-btn-save" style="background:${COLOR.cyan}; color:#000;
              border:none; padding:6px 22px; border-radius:6px; font-weight:800;
              font-size:13px; cursor:pointer; transition:opacity .15s;">LƯU</button>
        </div>
      </div>
    </div>`;
  }

  /**
   * Render indicator cards into #wa-ind-list based on filter
   * @param {string} query
   * @param {string} category
   */
  function renderIndicatorList(query, category) {
    const list    = document.getElementById('wa-ind-list');
    const empty   = document.getElementById('wa-ind-empty');
    if (!list) return;

    const q = (query || '').toLowerCase().trim();
    const filtered = INDICATOR_REGISTRY.filter(function (ind) {
      const matchCat = category === 'all' || ind.category === category;
      const matchQ   = !q ||
        ind.name.toLowerCase().includes(q) ||
        ind.shortName.toLowerCase().includes(q) ||
        ind.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    list.innerHTML = '';

    if (filtered.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }
    list.style.display = 'grid';
    empty.style.display = 'none';

    filtered.forEach(function (ind) {
      const isActive = global.scActiveIndicators &&
        global.scActiveIndicators.some(function (x) { return x.name === ind.name; });
      const isWave   = ind.category === 'wave_alpha';

      const card = document.createElement('div');
      card.className = 'wa-ind-card';
      card.dataset.name = ind.name;
      card.style.cssText = [
        'padding:11px 13px',
        'border-radius:9px',
        'cursor:pointer',
        'border:1px solid ' + (isActive ? COLOR.cyanMid : COLOR.border),
        'background:' + (isActive ? COLOR.cyanFaint : 'rgba(255,255,255,0.02)'),
        'transition:border-color .15s, background .15s',
        'position:relative',
        'display:flex',
        'flex-direction:column',
        'gap:4px',
      ].join(';');

      const badge = isActive
        ? '<span style="font-size:10px; background:' + COLOR.cyan + '; color:#000;' +
          ' border-radius:4px; padding:1px 6px; font-weight:700; margin-left:6px;">Đang dùng</span>'
        : '';
      const waveTag = isWave
        ? '<span style="font-size:10px; color:' + COLOR.gold + '; margin-left:4px;">★</span>'
        : '';

      card.innerHTML = [
        '<div style="display:flex; justify-content:space-between; align-items:flex-start;">',
          '<span style="color:' + (isWave ? COLOR.cyan : COLOR.white) + '; font-size:13px; font-weight:700; display:flex; align-items:center;">',
            ind.shortName, waveTag, badge,
          '</span>',
          isActive
            ? '<div style="display:flex; gap:14px; align-items:center;">' +
              '<button class="wa-settings-btn" data-name="' + ind.name + '" ' +
              'title="Cài đặt" style="background:transparent; border:none; ' +
              'color:' + COLOR.muted + '; cursor:pointer; font-size:15px; padding:4px; margin:-4px; ' +
              'line-height:1; transition:color .15s; touch-action:manipulation;" onmouseover="this.style.color=\'' + COLOR.gold + '\'" ' +
              'onmouseout="this.style.color=\'' + COLOR.muted + '\'">⚙</button>' +
              '<button class="wa-remove-btn" data-name="' + ind.name + '" ' +
              'title="Xóa khỏi chart" style="background:transparent; border:none; ' +
              'color:' + COLOR.muted + '; cursor:pointer; font-size:14px; padding:4px; margin:-4px; ' +
              'line-height:1; transition:color .15s; touch-action:manipulation;" onmouseover="this.style.color=\'' + COLOR.red + '\'" ' +
              'onmouseout="this.style.color=\'' + COLOR.muted + '\'">✕</button>' +
              '</div>'
            : '',
        '</div>',
        '<div style="color:' + COLOR.muted + '; font-size:11px; line-height:1.4;">' + ind.description + '</div>',
      ].join('');

      // Ngăn ấn nhầm khi bấm nút Setting/Delete
      card.addEventListener('click', function (e) {
        if (e.target.closest('.wa-remove-btn') || e.target.closest('.wa-settings-btn')) return;
        global.addIndicatorToChart(ind.name);
      });

      card.addEventListener('mouseenter', function () {
        if (!isActive) card.style.borderColor = COLOR.borderHover;
        card.style.background = isActive ? COLOR.cyanMid : 'rgba(255,255,255,0.05)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.borderColor = isActive ? COLOR.cyanMid : COLOR.border;
        card.style.background  = isActive ? COLOR.cyanFaint : 'rgba(255,255,255,0.02)';
      });

      list.appendChild(card);
    });

    // ==========================================
    // LẮNG NGHE SỰ KIỆN: XÓA CHỈ BÁO
    // ==========================================
    list.querySelectorAll('.wa-remove-btn').forEach(function (btn) {
      const removeInd = function(e) {
        e.stopPropagation(); e.preventDefault();
        const name = btn.dataset.name;
        global.removeIndicatorFromChart(name);
      };
      btn.addEventListener('click', removeInd);
      btn.addEventListener('touchend', removeInd, { passive: false });
    });

    // ==========================================
    // LẮNG NGHE SỰ KIỆN: MỞ CÀI ĐẶT
    // ==========================================
    list.querySelectorAll('.wa-settings-btn').forEach(function (btn) {
      const openSettings = function(e) {
        e.stopPropagation(); e.preventDefault();
        const name = btn.dataset.name;
        
        
        if (global.WaveIndicatorAPI && typeof global.WaveIndicatorAPI.openSettingsByName === 'function') {
            global.WaveIndicatorAPI.openSettingsByName(name);
        } else {
            const ind = global.scActiveIndicators.find(i => i.name === name);
            if (ind && typeof global.openIndicatorSettings === 'function') {
                global.openIndicatorSettings({ name: ind.name, calcParams: ind.params }, ind.paneId);
            }
        }
      };
      btn.addEventListener('click', openSettings);
      btn.addEventListener('touchend', openSettings, { passive: false });
    });
  }

  /**
   * Inject shared CSS for tabs and other reusable styles
   */
  function injectStyles() {
    if (document.getElementById('wa-ind-styles')) return;
    const style = document.createElement('style');
    style.id = 'wa-ind-styles';
    style.textContent = `
      .wa-tab {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        color: ${COLOR.muted};
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        padding: 5px 12px;
        white-space: nowrap;
        transition: color .15s, background .15s, border-color .15s;
        flex-shrink: 0;
      }
      .wa-tab:hover { color: ${COLOR.white}; background: rgba(255,255,255,0.06); }
      .wa-tab.active { color: ${COLOR.cyan}; border-color: ${COLOR.cyanMid}; background: ${COLOR.cyanFaint}; }
      #wa-ind-search:focus { border-color: ${COLOR.cyan} !important; }
      #wa-ind-tabs::-webkit-scrollbar { display: none; }
      #wa-ind-list::-webkit-scrollbar { width: 4px; }
      #wa-ind-list::-webkit-scrollbar-track { background: transparent; }
      #wa-ind-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      #sc-ind-settings-modal input[type=number]:focus {
        border-color: ${COLOR.cyan} !important;
        outline: none;
      }
      @media (max-width: 850px) {
        #wa-ind-modal-box { width: 96vw !important; max-height: 92vh !important; }
        #wa-ind-list { grid-template-columns: 1fr !important; }
        .wa-label { display: none !important; }
        /* Thu nhỏ paddings của nút thời gian để vừa vặn hơn khi rớt dòng */
        .sc-time-btn { padding: 4px 6px !important; font-size: 11px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize and inject all UI components into the DOM
   */
  global.initExpertUI = function () {
    injectStyles();

    // ── Indicator Library Modal ──
    if (!document.getElementById('sc-indicator-modal')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = buildIndicatorModalHTML();
      document.body.appendChild(wrap.firstElementChild);

      // Tab click
      document.getElementById('wa-ind-tabs').addEventListener('click', function (e) {
        const btn = e.target.closest('.wa-tab');
        if (!btn) return;
        document.querySelectorAll('.wa-tab').forEach(function (t) { t.classList.remove('active'); });
        btn.classList.add('active');
        const q = (document.getElementById('wa-ind-search') || {}).value || '';
        renderIndicatorList(q, btn.dataset.cat);
      });

      // Search
      document.getElementById('wa-ind-search').addEventListener('input', function (e) {
        const activeTab = document.querySelector('.wa-tab.active');
        renderIndicatorList(e.target.value, activeTab ? activeTab.dataset.cat : 'all');
      });

          // Search
    document.getElementById('wa-ind-search').addEventListener('input', function(e) {
      const activeTab = document.querySelector('.wa-tab.active');
      renderIndicatorList(e.target.value, activeTab ? activeTab.dataset.cat : 'all');
    });

    /* ====== BẠN DÁN CODE VÀO ĐÂY ====== */
    const indModal = document.getElementById('sc-indicator-modal');
    
    // Nút X để đóng
    const closeBtn = document.getElementById('wa-ind-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        if (indModal) indModal.style.display = 'none';
      });
    }

        // Click chuột ra ngoài giao diện thì tắt (phiên bản chống lỗi tải lại DOM)
        document.addEventListener('click', function(e) {
          // Nhớ thay 'btn-fx-indicator' bằng ID nút mở popup của bạn nếu có
          const btnInd = document.getElementById('btn-fx-indicator'); 
          
          if (indModal && indModal.style.display === 'flex') {
            // Sử dụng e.composedPath() để truy vết luồng click chuột
            // Giúp nhận diện chuẩn xác bạn đang click bên trong popup kể cả khi thẻ vừa bị đổi màu
            const path = e.composedPath ? e.composedPath() : [];
            const isClickInsideModal = path.includes(indModal);
            const isClickOnButton = btnInd && path.includes(btnInd);
    
            // Chỉ ẩn popup khi vị trí click KHÔNG nằm trong popup VÀ KHÔNG nằm trên nút bật
            if (!isClickInsideModal && !isClickOnButton) {
              indModal.style.display = 'none';
            }
          }
        });

    
    }

    // ── Settings Modal ──
    if (!document.getElementById('sc-ind-settings-modal')) {
      const wrap2 = document.createElement('div');
      wrap2.innerHTML = buildSettingsModalHTML();
      document.body.appendChild(wrap2.firstElementChild);

      document.getElementById('wa-settings-close').addEventListener('click', function () {
        document.getElementById('sc-ind-settings-modal').style.display = 'none';
      });
      document.getElementById('sc-ind-settings-modal').addEventListener('click', function (e) {
        if (e.target === this) this.style.display = 'none';
      });
    }

    // ── Topbar Buttons ──
    if (!document.getElementById('btn-fx-indicator')) {
      const timeBtns = document.querySelectorAll('.sc-time-btn');
      if (timeBtns.length > 0) {
        // [FIX BƯỚC 1] Ép toàn bộ nút trên Topbar nằm sát nhau, xóa khoảng trống thừa
        if (!document.getElementById('wa-topbar-spacing-fix')) {
            const style = document.createElement('style');
            style.id = 'wa-topbar-spacing-fix';
            style.textContent = `
                .sc-time-btn { padding: 4px 5px !important; margin: 0 !important; min-width: unset !important; }
                #btn-fx-indicator, #btn-wa-draw, #btn-wa-fs, #btn-wa-screenshot, #btn-wa-chart-cfg { padding: 4px 6px !important; margin: 0 !important; }
            `;
            document.head.appendChild(style);
        }

        const container = timeBtns[0].parentElement;
        
        // Cấu hình Flexbox bóp sát khoảng cách (gap: 2px)
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '2px'; 
        container.style.overflow = 'visible'; 
        
        if (container.parentElement) {
            container.parentElement.style.display = 'flex';
            container.parentElement.style.flexWrap = 'wrap';
            container.parentElement.style.gap = '4px';
            container.parentElement.style.alignItems = 'center';
        }
        // Chuyển sang dùng flex-wrap để các cụm rớt dòng thông minh, gọn gàng.
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.overflow = 'visible'; 
        
        // Tác động lên cả thẻ cha (Chứa cả Lọc Marker) để gom nhóm gọn gàng
        if (container.parentElement) {
            container.parentElement.style.display = 'flex';
            container.parentElement.style.flexWrap = 'wrap';
            container.parentElement.style.gap = '6px';
            container.parentElement.style.alignItems = 'center';
        }

        const tbWrap = document.createElement('div');
        tbWrap.style.cssText = 'display:flex; align-items:center; gap:2px; flex-shrink:0;';
        tbWrap.innerHTML = `
          <div style="width:1px; height:18px; background:${COLOR.border}; margin:0 8px;"></div>

          <button id="btn-fx-indicator" title="Thư viện chỉ báo"
            style="background:transparent; color:${COLOR.muted}; border:none; cursor:pointer;
                   font-size:13px; display:flex; align-items:center; gap:5px; padding:4px 8px;
                   border-radius:6px; font-weight:600; transition:.15s;"
            onmouseover="this.style.color='${COLOR.cyan}'; this.style.background='${COLOR.cyanFaint}'"
            onmouseout="this.style.color='${COLOR.muted}'; this.style.background='transparent'">
            ⚡ <span class="wa-label">Chỉ báo</span>
          </button>

          <div style="width:1px; height:18px; background:${COLOR.border}; margin:0 4px;"></div>

          

          <!-- Fullscreen -->
          <button id="btn-wa-fs" title="Toàn màn hình"
            style="background:transparent; color:${COLOR.muted}; border:none; cursor:pointer;
                   font-size:13px; padding:4px 8px; border-radius:6px; transition:.15s;"
            onmouseover="this.style.color='${COLOR.white}'; this.style.background='rgba(255,255,255,0.05)'"
            onmouseout="this.style.color='${COLOR.muted}'; this.style.background='transparent'">⛶</button>

          <!-- Screenshot -->
          <div style="width:1px; height:18px; background:${COLOR.border}; margin:0 4px;"></div>
          <div style="position:relative;">
            <button id="btn-wa-chart-cfg" title="Cài đặt biểu đồ"
            style="background:transparent;color:${COLOR.muted};border:none;cursor:pointer;
                   font-size:13px;padding:4px 8px;border-radius:6px;
                   display:flex;align-items:center;gap:4px;transition:.15s;font-weight:600;"
            onmouseover="this.style.color='${COLOR.gold}';this.style.background='rgba(240,185,11,0.08)'"
            onmouseout="this.style.color='${COLOR.muted}';this.style.background='transparent'">
            ⚙ <span class="wa-label" style="font-size:11px; margin-left:3px;">Chart</span>
        </button>
            <div id="wa-chart-cfg-menu" style="display:none; position:absolute; top:calc(100% + 6px); right:0;
                 background:${COLOR.bg}; border:1px solid ${COLOR.border}; border-radius:10px;
                 padding:16px; min-width:270px; z-index:20000; box-shadow:0 16px 40px rgba(0,0,0,0.9);">
                
                <div style="font-size:10px; font-weight:800; color:${COLOR.muted}; letter-spacing:1.2px; margin-bottom:14px;">⚙️ TÙY CHỈNH MÀU SẮC</div>
                
                <div style="display:grid; grid-template-columns: 80px 75px 26px 26px; align-items:center; gap:8px; margin-bottom:16px;">
                    <span style="color:${COLOR.muted}; font-size:10px; text-align:right; grid-column:3" title="Màu Thân Nến">THÂN</span>
                    <span style="color:${COLOR.muted}; font-size:10px; text-align:right; grid-column:4" title="Màu Viền Nến">VIỀN</span>

                    <span style="color:${COLOR.white};font-size:12px;">📈 Nến Tăng</span>
                    <input type="text" id="wa-hex-up" maxlength="11" style="width:100%; height:24px; background:rgba(0,0,0,0.4); border:1px solid ${COLOR.border}; border-radius:4px; color:${COLOR.white}; font-size:11px; text-align:center; outline:none;" onchange="window.waCsSync('up', this.value); window.waCsApply()">
                    <input type="color" id="wa-color-up" title="Màu Thân" style="width:26px;height:24px;border:1px solid ${COLOR.border};border-radius:4px;cursor:pointer;background:transparent;padding:1px;" oninput="document.getElementById('wa-hex-up').value=this.value; window.waCsApply()">
                    <input type="color" id="wa-color-up-bd" title="Màu Viền" style="width:26px;height:24px;border:1px solid ${COLOR.border};border-radius:4px;cursor:pointer;background:transparent;padding:1px;" oninput="window.waCsApply()">

                    <span style="color:${COLOR.white};font-size:12px;">📉 Nến Giảm</span>
                    <input type="text" id="wa-hex-down" maxlength="11" style="width:100%; height:24px; background:rgba(0,0,0,0.4); border:1px solid ${COLOR.border}; border-radius:4px; color:${COLOR.white}; font-size:11px; text-align:center; outline:none;" onchange="window.waCsSync('down', this.value); window.waCsApply()">
                    <input type="color" id="wa-color-down" title="Màu Thân" style="width:26px;height:24px;border:1px solid ${COLOR.border};border-radius:4px;cursor:pointer;background:transparent;padding:1px;" oninput="document.getElementById('wa-hex-down').value=this.value; window.waCsApply()">
                    <input type="color" id="wa-color-down-bd" title="Màu Viền" style="width:26px;height:24px;border:1px solid ${COLOR.border};border-radius:4px;cursor:pointer;background:transparent;padding:1px;" oninput="window.waCsApply()">

                    <span style="color:${COLOR.white};font-size:12px;">🖼️ Màu Nền</span>
                    <input type="text" id="wa-hex-bg" maxlength="11" style="width:100%; height:24px; background:rgba(0,0,0,0.4); border:1px solid ${COLOR.border}; border-radius:4px; color:${COLOR.white}; font-size:11px; text-align:center; outline:none;" onchange="window.waCsSync('bg', this.value); window.waCsApply()">
                    <input type="color" id="wa-color-bg" title="Màu Nền" style="width:26px;height:24px;border:1px solid ${COLOR.border};border-radius:4px;cursor:pointer;background:transparent;padding:1px; grid-column: 3 / span 2;" oninput="document.getElementById('wa-hex-bg').value=this.value; window.waCsApply()">
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid ${COLOR.border};">
                    <span style="color:${COLOR.white}; font-size:12px;">Đường Lưới (Grid)</span>
                    <div id="wa-grid-toggle" onclick="window.waCsToggleGrid()" data-on="1" style="width:36px; height:20px; background:#00F0FF; border-radius:34px; cursor:pointer; position:relative; transition:.2s;">
                        <div id="wa-grid-knob" style="position:absolute; right:2px; top:2px; width:16px; height:16px; background:#fff; border-radius:50%; transition:.2s;"></div>
                    </div>
                </div>

                <div style="font-size:10px; color:${COLOR.muted}; margin-bottom:8px; font-weight:600;">🎨 BỘ MÀU:</div>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
    <button onclick="window.waCsSetTheme('#2af592','#2af592','#eb367f','#eb367f','#0f1a1c')" 
        style="background:rgba(42,245,146,0.1); border:1px solid rgba(42,245,146,0.3); border-radius:6px; padding:6px; color:#2af592; font-size:11px; font-weight:700; cursor:pointer; text-align:center; transition:0.2s;">
        Wave Alpha
    </button>

    <button onclick="window.waCsSetTheme('#089981','#089981','#f23645','#f23645','#161a1e')" 
        style="background:rgba(255,255,255,0.05); border:1px solid ${COLOR.border}; border-radius:6px; padding:6px; color:#0ECB81; font-size:11px; font-weight:700; cursor:pointer; text-align:center; transition:0.2s;">
        Truyền Thống
    </button>

    <button onclick="window.waCsSetTheme('transparent','#eceef2','#eceef2','#eceef2','#131722')" 
        style="background:rgba(255,255,255,0.05); border:1px solid ${COLOR.border}; border-radius:6px; padding:6px; color:#FFFFFF; font-size:11px; font-weight:700; cursor:pointer; text-align:center; transition:0.2s;">
        Zen (Hollow)
    </button>

    <button onclick="window.waCsSetTheme('#26A69A','#26A69A','#EF5350','#EF5350','#131722')" 
        style="background:rgba(38,166,154,0.1); border:1px solid rgba(38,166,154,0.3); border-radius:6px; padding:6px; color:#26A69A; font-size:11px; font-weight:700; cursor:pointer; text-align:center; transition:0.2s;">
        Pro Trader
    </button>
</div>

                <button onclick="window.waCsSetTheme('#2af592','#2af592','#cb55e3','#cb55e3','#0f1a1c', true)" style="width:100%; background:transparent; border:1px dashed ${COLOR.muted}; color:${COLOR.muted}; border-radius:6px; padding:8px; font-size:11px; font-weight:700; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.color='${COLOR.white}'" onmouseout="this.style.background='transparent'; this.style.color='${COLOR.muted}'">↩ KHÔI PHỤC MẶC ĐỊNH</button>
            </div>
          </div>

          `;
        container.appendChild(tbWrap);

        document.getElementById('btn-fx-indicator').addEventListener('click', function (e) {
            e.stopPropagation();
            if (typeof global.openIndicatorModal === 'function') {
                global.openIndicatorModal();
            }
        });

        // Fullscreen
        document.getElementById('btn-wa-fs').addEventListener('click', function () {
          const el = document.getElementById('tv-chart-container') || document.documentElement;
          if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
          else document.exitFullscreen && document.exitFullscreen();
        });

        

        // Xử lý mở/đóng menu Cài đặt Chart
        const btnCfg = document.getElementById('btn-wa-chart-cfg');
        const menuCfg = document.getElementById('wa-chart-cfg-menu');
        if (btnCfg && menuCfg) {
            btnCfg.addEventListener('click', function(e) {
                e.stopPropagation();
                menuCfg.style.display = menuCfg.style.display === 'none' ? 'block' : 'none';
            });
            menuCfg.addEventListener('click', function(e) { e.stopPropagation(); });
            document.addEventListener('click', function() { menuCfg.style.display = 'none'; });

            // Load setting cũ (Có thêm màu Viền) - Mặc định là Wave Alpha
            const saved = JSON.parse(localStorage.getItem('wa_chart_settings') || '{}');
            
            const ub = saved.colUp || '#2af592';
            const ubd = saved.colUpBd || ub;
            document.getElementById('wa-hex-up').value = ub;
            if(ub !== 'transparent') document.getElementById('wa-color-up').value = ub;
            document.getElementById('wa-color-up-bd').value = ubd;
            
            const db = saved.colDown || '#cb55e3';
            const dbd = saved.colDownBd || db;
            document.getElementById('wa-hex-down').value = db;
            if(db !== 'transparent') document.getElementById('wa-color-down').value = db;
            document.getElementById('wa-color-down-bd').value = dbd;
            
            const bg = saved.colBg || '#0f1a1c';
            document.getElementById('wa-hex-bg').value = bg;
            document.getElementById('wa-color-bg').value = bg;
            
            if (saved.showGrid === false) {
                document.getElementById('wa-grid-toggle').dataset.on = '0';
                document.getElementById('wa-grid-toggle').style.background = '#374151';
                document.getElementById('wa-grid-knob').style.right = 'auto';
                document.getElementById('wa-grid-knob').style.left = '2px';
            }
        }

        window.waCsToggleGrid = function() {
            const tog = document.getElementById('wa-grid-toggle');
            const knob = document.getElementById('wa-grid-knob');
            if (!tog) return;
            const nowOn = tog.dataset.on !== '1';
            tog.dataset.on = nowOn ? '1' : '0';
            tog.style.background = nowOn ? '#00F0FF' : '#374151';
            if (knob) { knob.style.right = nowOn ? '2px' : 'auto'; knob.style.left = nowOn ? 'auto' : '2px'; }
            window.waCsApply();
        };

        // Hàm thay đổi các bộ chủ đề (Themes)
        window.waCsSetTheme = function(ub, ubd, db, dbd, bg, isReset = false) {
            // Chuẩn hóa: thêm # nếu thiếu (bỏ qua transparent)
            var norm = function(c) {
                return (c && c !== 'transparent' && c !== 'rgba(0,0,0,0)' && c.charAt(0) !== '#') ? '#' + c : c;
            };
            ub = norm(ub); ubd = norm(ubd); db = norm(db); dbd = norm(dbd); bg = norm(bg);

            document.getElementById('wa-hex-up').value = ub;
            if(ub !== 'transparent') document.getElementById('wa-color-up').value = ub;
            document.getElementById('wa-color-up-bd').value = ubd;
            
            document.getElementById('wa-hex-down').value = db;
            if(db !== 'transparent') document.getElementById('wa-color-down').value = db;
            document.getElementById('wa-color-down-bd').value = dbd;

            document.getElementById('wa-hex-bg').value = bg;
            document.getElementById('wa-color-bg').value = bg;

            window.waCsApply();
        };

        // Hàm đồng bộ text hex với bảng màu
        window.waCsSync = function(type, val) {
            // Thêm # nếu thiếu để color input nhận được
            var norm = function(c) {
                return (c && c !== 'transparent' && c !== 'rgba(0,0,0,0)' && c.charAt(0) !== '#') ? '#' + c : c;
            };
            var nVal = norm(val);

            if (type === 'up') {
                if (val !== 'transparent') document.getElementById('wa-color-up').value = nVal;
                document.getElementById('wa-color-up-bd').value = nVal;
            } else if (type === 'down') {
                if (val !== 'transparent') document.getElementById('wa-color-down').value = nVal;
                document.getElementById('wa-color-down-bd').value = nVal;
            } else if (type === 'bg') {
                document.getElementById('wa-color-bg').value = nVal;
            }
        };

        // Hàm Apply: Lưu và Vẽ lại biểu đồ với Viền nến
        window.waCsApply = function() {
          const ub   = document.getElementById('wa-hex-up').value;
          const ubd  = document.getElementById('wa-color-up-bd').value;
          const db   = document.getElementById('wa-hex-down').value;
          const dbd  = document.getElementById('wa-color-down-bd').value;
          const bg   = document.getElementById('wa-hex-bg').value;
          const showGrid = document.getElementById('wa-grid-toggle').dataset.on === '1';
      
          localStorage.setItem('wa_chart_settings', JSON.stringify({ showGrid, colUp: ub, colUpBd: ubd, colDown: db, colDownBd: dbd, colBg: bg }));
      
          const chartContainer = document.getElementById('sc-chart-container');
          if (chartContainer) chartContainer.style.background = bg;
      
          // Helper: Chuyển Hex sang RGBA với độ mờ 70% cho Volume
          const getVolColor = (hex, fallbackHex) => {
              let target = (hex === 'transparent' || hex === 'rgba(0,0,0,0)') ? fallbackHex : hex;
              if (!target.startsWith('#')) return target;
              let r = parseInt(target.slice(1, 3), 16),
                  g = parseInt(target.slice(3, 5), 16),
                  b = parseInt(target.slice(5, 7), 16);
              return `rgba(${r}, ${g}, ${b}, 0.7)`;
          };
      
          const volUpColor = getVolColor(ub, ubd);
          const volDownColor = getVolColor(db, dbd);
      
          if (window.tvChart) {
              const cType = (ub === 'transparent' || ub === 'rgba(0,0,0,0)') ? 'candle_up_stroke' : 'candle_solid';
      
              // 1. Cập nhật màu Nến & Grid
              window.tvChart.setStyles({
                  grid: {
                      horizontal: { show: showGrid, color: 'rgba(255,255,255,0.05)', style: 'dashed' },
                      vertical:   { show: showGrid, color: 'rgba(255,255,255,0.05)', style: 'dashed' }
                  },
                  candle: { 
                      type: window.currentChartInterval === 'tick' ? 'area' : cType,
                      bar: {
                          upColor: ub, downColor: db, noChangeColor: '#848e9c',
                          upBorderColor: ubd, downBorderColor: dbd,
                          upWickColor: ubd, downWickColor: dbd
                      }
                  }
              });
      
              // 2. Cập nhật màu Volume đồng bộ (Opacity 70%)
              window.tvChart.overrideIndicator({
                  name: 'VOL',
                  styles: {
                      bars: [{
                          upColor: volUpColor,
                          downColor: volDownColor,
                          noChangeColor: '#848e9c'
                      }]
                  }
              });
          }
      };
      

        

        window.waCsSetBg = function(color) {
            // [FIX] Đồng bộ cả 2 ô khi chọn preset nền có sẵn
            document.getElementById('wa-color-bg').value = color;
            document.getElementById('wa-hex-bg').value = color;
            window.waCsApply();
        };

      } 
    } 
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
  // HỆ THỐNG FLOATING SETTINGS V6.0 (TRANSPARENT, RESET & AUTO-HEX)
  // =========================================================================
  global.openIndicatorSettings = function (indicator, paneId) {
    const meta = INDICATOR_REGISTRY.find(function (x) { return x.name === indicator.name; });
    const rawParams = indicator.calcParams;
    const currentParams = (rawParams && rawParams.length > 0) 
        ? rawParams 
        : (meta && meta.defaultParams ? [...meta.defaultParams] : []);
    const labels = meta && meta.paramLabels ? meta.paramLabels : [];
    const isVPVR = indicator.name === 'WAVE_VPVR';

    if (currentParams.length === 0) {
        alert('Chỉ báo này không có thông số để cài đặt.');
        return; 
    }

    const oldPanel = document.getElementById('wa-floating-settings');
    if (oldPanel) oldPanel.remove();
    const oldPopover = document.getElementById('wa-color-popover');
    if (oldPopover) oldPopover.remove();

    const panel = document.createElement('div');
    panel.id = 'wa-floating-settings';
    panel.style.cssText = `
        position: fixed; top: 80px; right: 50px; width: 350px;
        background: rgba(18, 19, 23, 0.95); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.8);
        z-index: 99998; color: #EAECEF; display: flex; flex-direction: column;
        backdrop-filter: blur(8px); font-family: sans-serif; user-select: none;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.1); 
        cursor: move; display: flex; justify-content: space-between; align-items: center;
        background: rgba(0,0,0,0.2); border-top-left-radius: 8px; border-top-right-radius: 8px;
    `;
    header.innerHTML = `
        <span style="font-size:13px; font-weight:bold; color:#F0B90B;">⚙️ ${indicator.shortName || indicator.name}</span>
        <span id="wa-close-btn" style="cursor:pointer; font-size:16px; opacity:0.6;">&times;</span>
    `;
    panel.appendChild(header);

    const body = document.createElement('div');
    body.style.cssText = `
        padding: 16px; max-height: calc(100vh - 200px); overflow-y: auto;
        display: flex; flex-direction: column; gap: 12px;
    `;
    panel.appendChild(body);

    const style = document.createElement('style');
    style.innerHTML = `
        #wa-floating-settings ::-webkit-scrollbar { width: 4px; }
        #wa-floating-settings ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        .wa-group-box { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; }
        .wa-group-title { color:#848E9C; font-size:11px; font-weight:bold; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px; }
        .wa-inp-row { display: flex; justify-content: space-between; align-items: center; gap:10px; margin-bottom:10px; }
        
        .wa-inp-num { width: 60px; height: 26px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #FFF; text-align: center; font-size: 12px; outline: none; transition: border 0.2s;}
        .wa-inp-num:focus { border-color: #F0B90B; }
        
        .wa-inp-hex { width: 75px; height: 26px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; color: #FFF; text-align: center; font-size: 11px; font-family: monospace; outline: none; text-transform: uppercase;}
        .wa-inp-hex:focus { border-color: #F0B90B; }
        
        .wa-color-swatch-btn { width: 26px; height: 26px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); cursor: pointer; transition: transform 0.1s; }
        .wa-color-swatch-btn:hover { border-color: #FFF; transform: scale(1.05); }

        /* 🚀 Hiệu ứng Caro cho màu Transparent */
        .wa-is-transparent {
            background-color: #2b2b2b !important;
            background-image: linear-gradient(45deg, #1f1f1f 25%, transparent 25%), linear-gradient(-45deg, #1f1f1f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f1f1f 75%), linear-gradient(-45deg, transparent 75%, #1f1f1f 75%) !important;
            background-size: 10px 10px !important;
            background-position: 0 0, 0 5px, 5px -5px, -5px 0px !important;
        }

        #wa-color-popover {
            position: fixed; background: #1E222D; border: 1px solid #434651; border-radius: 6px;
            padding: 8px; display: none; grid-template-columns: repeat(6, 20px); gap: 4px;
            z-index: 999999; box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        }
        .wa-mini-color { width: 20px; height: 20px; border-radius: 3px; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); }
        .wa-mini-color:hover { border-color: #FFF; transform: scale(1.1); box-shadow: 0 0 4px rgba(255,255,255,0.5); }
    `;
    panel.appendChild(style);

    // ── 36 MÀU TRADING CÓ KÈM TRANSPARENT ──
    const TRADING_PALETTE = [
        'transparent', '#FFFFFF', '#D1D4DC', '#B2B5BE', '#787B86', '#000000',
        '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#E65100', '#F0B90B',
        '#F44336', '#EF5350', '#E53935', '#D32F2F', '#C62828', '#B71C1C',
        '#4CAF50', '#66BB6A', '#26A69A', '#00897B', '#009688', '#0ECB81',
        '#2196F3', '#2962FF', '#00BCD4', '#9C27B0', '#673AB7', '#9575CD',
        '#E91E63', '#D50000', '#AA00FF', '#6200EA', '#304FFE', '#00B8D4'
    ];

    const colorPopover = document.createElement('div');
    colorPopover.id = 'wa-color-popover';
    TRADING_PALETTE.forEach(hex => {
        const cDiv = document.createElement('div');
        cDiv.className = 'wa-mini-color';
        if (hex === 'transparent') cDiv.classList.add('wa-is-transparent');
        else cDiv.style.background = hex;
        cDiv.dataset.hex = hex;
        cDiv.title = hex === 'transparent' ? 'Trong Suốt' : hex;
        colorPopover.appendChild(cDiv);
    });
    document.body.appendChild(colorPopover);

    const liveUpdateChart = () => {
        const newParams = currentParams.map((_, idx) => {
            const inpNum = document.getElementById('wa-param-num-' + idx);
            const inpHex = document.getElementById('wa-param-hex-' + idx);
            if (inpHex) return inpHex.value; 
            if (inpNum) return parseFloat(inpNum.value) || 0; 
            return currentParams[idx];
        });
        try { global.tvChart.overrideIndicator({ name: indicator.name, calcParams: newParams }, paneId); } catch (e) {}
        return newParams;
    };

    const vpvrDescriptions = [
        "Thanh ngang (10-200)", "Lõi Volume (70%)", "Chiều ngang (%)",
        "0: Phải, 1: Trái", "0: Toàn, 1: Ngày, 2: Tuần", "0: Tắt, 1: Nền mờ",
        "Lực Mua", "Lực Bán", "Point of Control", "Viền Giá Trị",
        "HVN Dày", "LVN Mỏng", "nPOC Chưa Test", "Icon Phe Áp Đảo",
        "Mờ trong VA (0-100)", "Mờ ngoài VA", "Dày nét (1-5px)", "Dày nét (1-4px)",
        "0:Đứt 1:Chấm 2:Liền", "0:Đứt 1:Chấm 2:Dài", "Cỡ chữ (8-16)", "0:Ẩn 1:Hiện"
    ];

    // Chia nhóm cấu hình thông minh cho VPVR và TPO
    const isTPO = indicator.name === 'WAVE_TPO';
    let groups = [];
    if (isVPVR) {
        groups = [
            { title: 'Cấu Hình Lõi', keys: [0, 1, 2, 3, 4, 5, 21] },
            { title: 'Bảng Màu Hiển Thị', keys: [6, 7, 8, 9, 10, 11, 12, 13] },
            { title: 'Kiểu Dáng & Nét Vẽ', keys: [14, 15, 16, 17, 18, 19, 20] }
        ];
    } else if (isTPO) {
        groups = [
            { title: '⚙️ Cấu Hình Thuật Toán', keys: [0, 1, 2, 3, 4, 5, 6, 26, 27, 28] },
            { title: '🎨 Bảng Màu (Trong / Ngoài VA / Khác)', keys: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
            { title: '📏 Kiểu Nét & Độ Mờ', keys: [19, 20, 21, 22, 23, 24, 25] }
        ];
    } else {
        groups = [ { title: 'Cài Đặt', keys: currentParams.map((_, i) => i) } ];
    }

    let activeHexInputId = null, activeBtnId = null;

    groups.forEach(g => {
        const box = document.createElement('div');
        box.className = 'wa-group-box';
        box.innerHTML = `<div class="wa-group-title">${g.title}</div>`;
        
        g.keys.forEach(idx => {
            const val = currentParams[idx];
            if (val === undefined) return;
            
            // 🚀 Tự động nhận diện trường màu sắc thông minh
            const isColorField = (labels[idx] && labels[idx].toLowerCase().includes('màu')) || 
                                 (typeof val === 'string' && (val.startsWith('#') || val === 'transparent'));
            
            let displayVal = val;
            // Nếu mặc định là số nguyên (0x26A69A) thì convert sang #HEX
            if (isColorField && typeof val === 'number') {
                let hStr = Math.round(val).toString(16).toUpperCase();
                while (hStr.length < 6) hStr = '0' + hStr;
                displayVal = '#' + hStr;
            }

            const desc = (isVPVR && vpvrDescriptions[idx]) ? vpvrDescriptions[idx] : '';
            const row = document.createElement('div');
            row.className = 'wa-inp-row';
            
            let controlHTML = '';
            if (isColorField) {
                const isTrans = displayVal === 'transparent';
                controlHTML = `
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="text" id="wa-param-hex-${idx}" class="wa-inp-hex" value="${displayVal}" autocomplete="off" maxlength="11" placeholder="Mã HEX">
                        <div id="wa-color-btn-${idx}" class="wa-color-swatch-btn ${isTrans ? 'wa-is-transparent' : ''}" style="background:${isTrans ? 'transparent' : displayVal};"></div>
                    </div>
                `;
            } else {
                controlHTML = `<input type="number" id="wa-param-num-${idx}" class="wa-inp-num" value="${displayVal}" step="any">`;
            }

            row.innerHTML = `
                <div style="display:flex; flex-direction:column; flex:1;">
                    <span style="color:#EAECEF; font-size:12px; font-weight:600;">${labels[idx] || 'Param ' + (idx + 1)}</span>
                    ${desc ? `<span style="color:#848E9C; font-size:10px; margin-top:2px;">${desc}</span>` : ''}
                </div>
                ${controlHTML}
            `;
            box.appendChild(row);

            if (isColorField) {
                const hexInp = row.querySelector(`#wa-param-hex-${idx}`);
                const colorBtn = row.querySelector(`#wa-color-btn-${idx}`);
                
                hexInp.addEventListener('input', (e) => {
                    const v = e.target.value.toLowerCase();
                    if (v === 'transparent' || /^#[0-9A-F]{6}$/i.test(v) || /^#[0-9A-F]{3}$/i.test(v)) {
                        if (v === 'transparent') {
                            colorBtn.style.background = 'transparent';
                            colorBtn.classList.add('wa-is-transparent');
                        } else {
                            colorBtn.style.background = v;
                            colorBtn.classList.remove('wa-is-transparent');
                        }
                        liveUpdateChart();
                    }
                });

                colorBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    activeHexInputId = `wa-param-hex-${idx}`;
                    activeBtnId = `wa-color-btn-${idx}`;
                    const rect = colorBtn.getBoundingClientRect();
                    colorPopover.style.display = 'grid';
                    let popX = rect.left - 140, popY = rect.bottom + 5;
                    if (popX < 10) popX = 10;
                    colorPopover.style.left = popX + 'px';
                    colorPopover.style.top = popY + 'px';
                });
            } else {
                row.querySelector('input').addEventListener('input', liveUpdateChart);
            }
        });
        body.appendChild(box);
    });

    colorPopover.addEventListener('click', (e) => {
        if (e.target.classList.contains('wa-mini-color')) {
            const chosenHex = e.target.dataset.hex;
            if (activeHexInputId && activeBtnId) {
                const hexInp = document.getElementById(activeHexInputId);
                const btn = document.getElementById(activeBtnId);
                hexInp.value = chosenHex;
                if (chosenHex === 'transparent') {
                    btn.style.background = 'transparent';
                    btn.classList.add('wa-is-transparent');
                } else {
                    btn.style.background = chosenHex;
                    btn.classList.remove('wa-is-transparent');
                }
                liveUpdateChart();
            }
            colorPopover.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (!colorPopover.contains(e.target)) colorPopover.style.display = 'none';
    });

    // 5. FOOTER (Reset & Save)
    const footer = document.createElement('div');
    footer.style.cssText = 'padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1); display:flex; gap:8px;';
    
    // 🚀 NÚT RESET MẶC ĐỊNH
    const btnReset = document.createElement('button');
    btnReset.innerText = '↺ Mặc Định';
    btnReset.style.cssText = 'flex:0.6; padding:8px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:#FFF; font-weight:bold; cursor:pointer;';
    btnReset.onclick = () => {
        const defaults = meta && meta.defaultParams ? meta.defaultParams : [];
        defaults.forEach((defVal, idx) => {
            const inpNum = document.getElementById('wa-param-num-' + idx);
            const inpHex = document.getElementById('wa-param-hex-' + idx);
            const colorBtn = document.getElementById('wa-color-btn-' + idx);
            
            if (inpHex && colorBtn) {
                let dVal = defVal;
                if (typeof defVal === 'number') {
                    let hStr = Math.round(defVal).toString(16).toUpperCase();
                    while (hStr.length < 6) hStr = '0' + hStr;
                    dVal = '#' + hStr;
                }
                inpHex.value = dVal;
                if (dVal === 'transparent') {
                    colorBtn.style.background = 'transparent';
                    colorBtn.classList.add('wa-is-transparent');
                } else {
                    colorBtn.style.background = dVal;
                    colorBtn.classList.remove('wa-is-transparent');
                }
            } else if (inpNum) {
                inpNum.value = defVal;
            }
        });
        liveUpdateChart();
    };

    const btnSave = document.createElement('button');
    btnSave.innerText = '✓ XONG & LƯU';
    btnSave.style.cssText = 'flex:1; padding:8px; background:#F0B90B; border:none; border-radius:6px; color:#000; font-weight:bold; cursor:pointer;';

    footer.appendChild(btnReset);
    footer.appendChild(btnSave);
    panel.appendChild(footer);

    document.body.appendChild(panel);

    // KÉO THẢ
    let isDragging = false, offset = { x: 0, y: 0 };
    header.onmousedown = (e) => {
        isDragging = true;
        offset.x = e.clientX - panel.offsetLeft;
        offset.y = e.clientY - panel.offsetTop;
    };
    window.onmousemove = (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - offset.x) + 'px';
        panel.style.top = (e.clientY - offset.y) + 'px';
        panel.style.right = 'auto'; 
    };
    window.onmouseup = () => isDragging = false;

    const closePanel = () => { panel.remove(); colorPopover.remove(); };
    document.getElementById('wa-close-btn').onclick = closePanel;
    
    btnSave.onclick = () => {
        const finalParams = liveUpdateChart();
        const entry = global.scActiveIndicators.find(x => x.name === indicator.name);
        if (entry) {
            entry.params = finalParams;
            if (typeof global.saveIndicatorState === 'function') global.saveIndicatorState();
        }
        closePanel();
    };
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