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
      description: 'Volume Weighted Average Price anchored by session with Deviation Bands',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [1, 2, 0],
      paramLabels: ['Hệ số Band 1', 'Hệ số Band 2', 'Anchor (0=Daily/1=Weekly/2=Monthly)'],
      builtIn: false,
    },
    {
      name: 'ANCHORED_VWAP',
      shortName: 'AVWAP',
      description: 'VWAP anchored from a fixed timestamp — useful for major pivots',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [0],
      paramLabels: ['Anchor Timestamp (ms, 0=auto)'],
      builtIn: false,
    },
    {
      name: 'WAVE_PAC',
      shortName: 'Wave PAC',
      description: 'Hệ thống Kênh giá Wave (PAC & MAs)',
      category: 'wave_alpha',
      isStack: true, // Hiển thị đè lên nến (overlay)
      defaultParams: [34, 89, 200, 610],
      paramLabels: ['Chu kỳ PAC', 'Đường tín hiệu', 'EMA Chậm 1', 'EMA Chậm 2'],
      builtIn: false,
    },
    {
      name: 'WAVE_BOOKMAP',
      shortName: 'HEATMAP',
      description: 'Bản Đồ Nhiệt Thanh Khoản Lịch Sử (Bookmap Pro)',
      category: 'wave_alpha',
      isStack: true, 
      defaultParams: [0, 30, 0, 500, 0], 
      paramLabels: [
        'Lọc Rác (USD) [0 = Auto AI]', 
        'Độ Mờ Nền (%)', 
        'Ngưỡng Đỏ Rực (USD) [0 = Auto AI]',
        'Giới Hạn Lịch Sử (Tránh Lag)',
        'Độ Cao 1 Nấc Giá [0 = Auto]'
      ],
      builtIn: false,
    },
    {
      name: 'WAVE_COB',
      shortName: 'COB',
      description: 'Tháp Thanh Khoản DOM (Dữ liệu Sổ lệnh Real-time)',
      category: 'wave_alpha',
      isStack: true, 
      // Mặc định: [Rộng 120, Auto 0 (hoặc 50000), Dày 4, Lỳ 9995, Tốc độ 500ms]
      // Tôi khuyên để mặc định là 0 để tính năng Tự Động làm việc của nó!
      defaultParams: [120, 0, 4, 9995, 500], 
      paramLabels: [
        'Độ Rộng Cột COB (px)', 
        'Lọc Rác (USD) [Nhập 0 để Auto]',
        'Độ Dày 1 Nấc Giá (px)',
        'Độ Lỳ Của Khung (x/10000)',
        'Tốc Độ Vẽ - FPS (ms)'
      ],
      builtIn: false,
    },
    {
      name: 'SUPERTREND',
      shortName: 'ST',
      description: 'ATR-based trend direction indicator — changes color with trend',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [10, 3.0],
      paramLabels: ['ATR Period', 'Multiplier'],
      builtIn: false,
    },
    {
      name: 'PIVOT_POINTS',
      shortName: 'PP',
      description: 'Classic Daily Pivot Points — PP, R1/R2/R3, S1/S2/S3',
      category: 'wave_alpha',
      isStack: true,
      defaultParams: [0],
      paramLabels: ['Anchor (0=Daily/1=Weekly/2=Monthly)'],
      builtIn: false,
    },
    // ── Trend (Built-in) ──────────────────────────────
    {
      name: 'MA',
      shortName: 'MA',
      description: 'Simple Moving Average',
      category: 'trend',
      isStack: true,
      defaultParams: [5, 10, 30],
      paramLabels: ['Period 1', 'Period 2', 'Period 3'],
      builtIn: true,
    },
    {
      name: 'EMA',
      shortName: 'EMA',
      description: 'Exponential Moving Average — phản ứng nhanh hơn SMA',
      category: 'trend',
      isStack: true,
      defaultParams: [9, 21, 55],
      paramLabels: ['Period 1', 'Period 2', 'Period 3'],
      builtIn: true,
    },
    {
      name: 'BOLL',
      shortName: 'BOLL',
      description: 'Bollinger Bands — đường giá và dải biến động',
      category: 'trend',
      isStack: true,
      defaultParams: [20, 2],
      paramLabels: ['Period', 'Multiplier'],
      builtIn: true,
    },
    // ── Oscillators ───────────────────────────────────
    {
      name: 'RSI',
      shortName: 'RSI',
      description: 'Relative Strength Index — hiển thị 3 đường Nhanh/Vừa/Chậm',
      category: 'oscillator',
      isStack: false,
      defaultParams: [6, 12, 24], 
      paramLabels: ['RSI Nhanh', 'RSI Vừa', 'RSI Chậm'],
      builtIn: true,
    },
    {
    name: 'WAVE_ADVANCED_RSI',
    shortName: 'WAVE RSI',
    description: 'RSI Advanced',
    category: 'wave_alpha',
    isStack: false,
    defaultParams: [14, 0, 14, 2.0, 1],
    paramLabels: ['Chu kỳ RSI', 'MA Type (0=SMA,1=BB,2=EMA,3=RMA,4=WMA,5=VWMA)', 'Chu kỳ MA', 'BB StdDev', 'Hiện Phân kỳ (1=Có, 0=Không)'],
    builtIn: false,
  },
    {
      name: 'MACD',
      shortName: 'MACD',
      description: 'Moving Average Convergence Divergence',
      category: 'oscillator',
      isStack: false,
      defaultParams: [12, 26, 9],
      paramLabels: ['Fast Period', 'Slow Period', 'Signal Period'],
      builtIn: true,
    },
    {
      name: 'STOCH',
      shortName: 'STOCH',
      description: 'Stochastic Oscillator — %K và %D trong vùng 0-100',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14, 3, 3],
      paramLabels: ['K Period', 'D Period', 'Smooth'],
      builtIn: false,
    },
    {
      name: 'STOCH_RSI',
      shortName: 'StochRSI',
      description: 'Stochastic RSI — kết hợp RSI và Stochastic',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14, 14, 3, 3],
      paramLabels: ['RSI Length', 'Stoch Length', 'K', 'D'],
      builtIn: false,
    },
    {
      name: 'CCI',
      shortName: 'CCI',
      description: 'Commodity Channel Index — xác định điểm đảo chiều',
      category: 'oscillator',
      isStack: false,
      defaultParams: [20],
      paramLabels: ['Period'],
      builtIn: false,
    },
    {
      name: 'WILLIAMS_R',
      shortName: '%R',
      description: 'Williams %R — scale từ -100 đến 0',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14],
      paramLabels: ['Period'],
      builtIn: false,
    },
    {
      name: 'MFI',
      shortName: 'MFI',
      description: 'Money Flow Index — RSI tích hợp volume',
      category: 'oscillator',
      isStack: false,
      defaultParams: [14],
      paramLabels: ['Period'],
      builtIn: false,
    },
    {
      name: 'DPO',
      shortName: 'DPO',
      description: 'Detrended Price Oscillator — loại bỏ xu hướng dài hạn',
      category: 'oscillator',
      isStack: false,
      defaultParams: [20],
      paramLabels: ['Period'],
      builtIn: false,
    },
    // ── Volatility ────────────────────────────────────
    {
      name: 'ATR',
      shortName: 'ATR',
      description: 'Average True Range — đo biên độ biến động',
      category: 'volatility',
      isStack: false,
      defaultParams: [14],
      paramLabels: ['Period'],
      builtIn: false,
    },
    {
      name: 'CHAIKIN_VOL',
      shortName: 'ChVol',
      description: 'Chaikin Volatility — tốc độ thay đổi của ATR',
      category: 'volatility',
      isStack: false,
      defaultParams: [10, 10],
      paramLabels: ['EMA Period', 'Rate of Change Period'],
      builtIn: false,
    },
    // ── Volume ────────────────────────────────────────
    {
      name: 'VOL',
      shortName: 'VOL',
      description: 'Volume Bars — khối lượng giao dịch',
      category: 'volume',
      isStack: false,
      defaultParams: [],
      paramLabels: [],
      builtIn: true,
    },
    {
      name: 'OBV',
      shortName: 'OBV',
      description: 'On Balance Volume — xu hướng dòng tiền',
      category: 'volume',
      isStack: false,
      defaultParams: [],
      paramLabels: [],
      builtIn: false,
    },
    {
      name: 'CMF',
      shortName: 'CMF',
      description: 'Chaikin Money Flow — cường độ mua/bán qua volume',
      category: 'volume',
      isStack: false,
      defaultParams: [20],
      paramLabels: ['Period'],
      builtIn: false,
    },
    {
      name: 'FORCE_INDEX',
      shortName: 'FI',
      description: 'Force Index — sức mạnh xu hướng dựa trên giá × volume',
      category: 'volume',
      isStack: false,
      defaultParams: [13],
      paramLabels: ['EMA Period'],
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

    /**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  WAVE_BOOKMAP — Production-Grade Historical Liquidity Heatmap (MASTER V9.0)  ║
 * ║  Tích hợp: Viewport Culling, Offscreen Cache, LUT Colors, Auto-AI Scale,     ║
 * ║            Cluster Detection, Hover Tooltips.                                ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

(function initWaveBookmapNamespace() {
  if (window._waHmap) return;

  var H = window._waHmap = {
    cache: {
      key: '', offscreen: null, valid: false, lastRender: 0,
      meta: { columns: [], truncatedTotal: 0, showingCount: 0, warnings: [] }
    },
    lut: {
      initialized: false, opacityKey: -1,
      asks256: [], bids256: [], askGlow256: [], bidGlow256: [],
      askBuckets16: [], bidBuckets16: [], askGlowBuckets16: [], bidGlowBuckets16: []
    },
    mouse: { x: -1, y: -1, lastUpdate: 0 },
    debug: false,
    stats: { lastFrameRects: 0, lastFrameMs: 0, cacheHits: 0 },
    pools: {
      askBuckets: new Array(16), bidBuckets: new Array(16),
      askGlowBuckets: new Array(16), bidGlowBuckets: new Array(16)
    },
    interaction: { mouseBound: false, onMouseMove: null, onMouseOut: null },
    helpers: {}
  };

  var hp = H.helpers;
  hp.clamp = function(v, min, max) { return Math.max(min, Math.min(max, v)); };
  hp.now = function() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); };
  
  hp.ensureMouseListener = function() {
    var state = window._waHmap;
    if (state.interaction.mouseBound) return;
    state.interaction.mouseBound = true;
    state.interaction.onMouseMove = function(ev) {
      var now = Date.now();
      if (now - state.mouse.lastUpdate < 50) return; 
      state.mouse.x = ev.clientX; state.mouse.y = ev.clientY; state.mouse.lastUpdate = now;
    };
    state.interaction.onMouseOut = function(ev) {
      if (!ev.relatedTarget) { state.mouse.x = -1; state.mouse.y = -1; }
    };
    window.addEventListener('mousemove', state.interaction.onMouseMove, { passive: true });
    window.addEventListener('mouseout', state.interaction.onMouseOut, { passive: true });
  };

  hp.removeMouseListener = function() {
    var state = window._waHmap;
    if (!state || !state.interaction.mouseBound) return;
    window.removeEventListener('mousemove', state.interaction.onMouseMove);
    window.removeEventListener('mouseout', state.interaction.onMouseOut);
    state.interaction.mouseBound = false;
  };

  hp.createCanvas = function(width, height) {
    var c;
    if (typeof OffscreenCanvas !== 'undefined') { c = new OffscreenCanvas(width, height); } 
    else { c = document.createElement('canvas'); c.width = width; c.height = height; c.style.display = 'none'; }
    return c;
  };

  hp.ensureOffscreen = function(width, height) {
    var cache = window._waHmap.cache;
    var c = cache.offscreen;
    if (!c || c.width !== width || c.height !== height) {
      c = hp.createCanvas(width, height);
      cache.offscreen = c;
      cache.valid = false;
    }
    return c;
  };

  hp.resetBuckets = function() {
    var pools = window._waHmap.pools;
    for (var i = 0; i < 16; i++) {
      pools.askBuckets[i] = new Path2D(); pools.bidBuckets[i] = new Path2D();
      pools.askGlowBuckets[i] = new Path2D(); pools.bidGlowBuckets[i] = new Path2D();
    }
  };

  hp.lerp = function(a, b, t) { return a + (b - a) * t; };
  hp.mixRgba = function(c1, c2, t, opacityMul) {
    var r = Math.round(hp.lerp(c1[0], c2[0], t)), g = Math.round(hp.lerp(c1[1], c2[1], t)), b = Math.round(hp.lerp(c1[2], c2[2], t)), a = hp.lerp(c1[3], c2[3], t) * opacityMul;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')';
  };

  hp.buildGradientLut = function(stops, opacityMul) {
    var arr256 = new Array(256);
    for (var i = 0; i < 256; i++) {
      var t = i / 255, color;
      if (t <= 0.35) color = hp.mixRgba(stops[0], stops[1], t / 0.35, opacityMul);
      else if (t <= 0.75) color = hp.mixRgba(stops[1], stops[2], (t - 0.35) / 0.40, opacityMul);
      else color = hp.mixRgba(stops[2], stops[3], (t - 0.75) / 0.25, opacityMul);
      arr256[i] = color;
    }
    var arr16 = new Array(16);
    for (var b = 0; b < 16; b++) arr16[b] = arr256[Math.min(255, b * 16 + 8)];
    return { arr256: arr256, arr16: arr16 };
  };

  hp.rebuildLut = function(opacityMul) {
    var lut = window._waHmap.lut;
    if (lut.initialized && lut.opacityKey === opacityMul) return;
    var askStops = [[180, 60, 0, 0.12], [220, 80, 0, 0.35], [255, 100, 0, 0.60], [255, 50, 50, 0.85]];
    var bidStops = [[0, 120, 80, 0.12], [0, 180, 100, 0.35], [0, 220, 140, 0.60], [50, 255, 160, 0.85]];
    var askGlowStops = [[180, 60, 0, 0.06], [220, 80, 0, 0.18], [255, 100, 0, 0.30], [255, 70, 70, 0.42]];
    var bidGlowStops = [[0, 120, 80, 0.06], [0, 180, 100, 0.18], [0, 220, 140, 0.30], [80, 255, 180, 0.42]];

    var ask = hp.buildGradientLut(askStops, opacityMul), bid = hp.buildGradientLut(bidStops, opacityMul);
    var askGlow = hp.buildGradientLut(askGlowStops, opacityMul), bidGlow = hp.buildGradientLut(bidGlowStops, opacityMul);

    lut.asks256 = ask.arr256; lut.bids256 = bid.arr256; lut.askGlow256 = askGlow.arr256; lut.bidGlow256 = bidGlow.arr256;
    lut.askBuckets16 = ask.arr16; lut.bidBuckets16 = bid.arr16; lut.askGlowBuckets16 = askGlow.arr16; lut.bidGlowBuckets16 = bidGlow.arr16;
    lut.opacityKey = opacityMul; lut.initialized = true;
  };

  hp.getBucketIndex = function(valUSD, redThreshold) {
    if (valUSD <= 0 || redThreshold <= 0) return 0;
    if (valUSD >= redThreshold) {
      var extra = Math.min(1, (valUSD - redThreshold) / Math.max(redThreshold, 1));
      return Math.min(255, 224 + Math.floor(extra * 31));
    }
    return Math.min(223, Math.floor((valUSD / redThreshold) * 223));
  };

  hp.getBarSpace = function() {
    var barSpace = 6;
    try {
      var bsValue = window.tvChart && typeof window.tvChart.getBarSpace === 'function' ? window.tvChart.getBarSpace() : null;
      if (typeof bsValue === 'number' && bsValue > 0) barSpace = bsValue;
      else if (bsValue && typeof bsValue.bar === 'number' && bsValue.bar > 0) barSpace = bsValue.bar;
      else if (bsValue && typeof bsValue.gapBar === 'number' && bsValue.gapBar > 0) barSpace = bsValue.gapBar;
    } catch (e) {}
    return hp.clamp(barSpace, 1, 50);
  };

  hp.getXForTimestamp = function(ts, xAxis) {
    var x = null;
    try {
      if (xAxis && typeof xAxis.convertToPixel === 'function') {
        var r1 = xAxis.convertToPixel({ timestamp: ts });
        if (typeof r1 === 'number') x = r1; else if (r1 && typeof r1.x === 'number') x = r1.x;
        else { var r2 = xAxis.convertToPixel(ts); if (typeof r2 === 'number') x = r2; else if (r2 && typeof r2.x === 'number') x = r2.x; }
      }
    } catch (e) {}
    if (x == null) {
      try {
        var pt = window.tvChart && typeof window.tvChart.convertToPixel === 'function' ? window.tvChart.convertToPixel({ timestamp: ts }, { paneId: 'candle_pane' }) : null;
        if (typeof pt === 'number') x = pt; else if (pt && typeof pt.x === 'number') x = pt.x;
      } catch (e2) {}
    }
    return (typeof x === 'number' && isFinite(x)) ? x : null;
  };

  hp.getYForPrice = function(price, yAxis) {
    var y = null;
    try { if (yAxis && typeof yAxis.convertToPixel === 'function') y = yAxis.convertToPixel(price); } catch (e) {}
    return (typeof y === 'number' && isFinite(y)) ? y : null;
  };

  hp.getVisibleTimeRange = function(bounding, xAxis) {
    var out = { from: null, to: null, key: 'na_na' };
    try {
      if (window.tvChart && typeof window.tvChart.convertFromPixel === 'function') {
        var left = window.tvChart.convertFromPixel({ x: 0 }, { paneId: 'candle_pane' });
        var right = window.tvChart.convertFromPixel({ x: bounding.width }, { paneId: 'candle_pane' });
        var lf = left && (left.timestamp != null ? left.timestamp : left.x);
        var rt = right && (right.timestamp != null ? right.timestamp : right.x);
        if (typeof lf === 'number' && typeof rt === 'number' && isFinite(lf) && isFinite(rt)) {
          out.from = Math.min(lf, rt); out.to = Math.max(lf, rt); out.key = String(out.from) + '_' + String(out.to);
          return out;
        }
      }
    } catch (e) {}
    return out; // Trả về rỗng nếu không lấy được (tránh crash)
  };

  hp.lowerBound = function(arr, target) {
    var lo = 0, hi = arr.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (arr[mid].t < target) lo = mid + 1; else hi = mid; }
    return lo;
  };
  hp.upperBound = function(arr, target) {
    var lo = 0, hi = arr.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (arr[mid].t <= target) lo = mid + 1; else hi = mid; }
    return lo;
  };

  hp.isSortedByTime = function(arr) {
    for (var i = 1; i < arr.length; i++) if ((arr[i - 1].t || 0) > (arr[i].t || 0)) return false;
    return true;
  };

  hp.sliceVisibleHistory = function(history, visibleRange) {
    if (!history.length || visibleRange.from == null || visibleRange.to == null || !hp.isSortedByTime(history)) return history;
    var start = Math.max(0, hp.lowerBound(history, visibleRange.from) - 2);
    var end = Math.min(history.length, hp.upperBound(history, visibleRange.to) + 2);
    return history.slice(start, end);
  };

  hp.iterateBookSide = function(side, fn) {
    if (!side) return;
    if (typeof side.forEach === 'function') { side.forEach(function(vol, priceStr) { fn(priceStr, vol); }); return; }
    if (typeof side[Symbol.iterator] === 'function') { for (var entry of side) fn(entry[0], entry[1]); return; }
    for (var k in side) if (Object.prototype.hasOwnProperty.call(side, k)) fn(k, side[k]);
  };

  hp.buildRenderGroups = function(snaps, mergeCount) {
    if (mergeCount <= 1) return snaps;
    var out = [];
    for (var i = 0; i < snaps.length; i += mergeCount) {
      var end = Math.min(snaps.length, i + mergeCount);
      var askAgg = new Map(), bidAgg = new Map(), tsSum = 0, count = 0;
      for (var j = i; j < end; j++) {
        var s = snaps[j]; if (!s) continue; count++; tsSum += Number(s.t || 0);
        hp.iterateBookSide(s.asks, function(pStr, vol) { askAgg.set(pStr, (askAgg.get(pStr) || 0) + Number(vol || 0)); });
        hp.iterateBookSide(s.bids, function(pStr, vol) { bidAgg.set(pStr, (bidAgg.get(pStr) || 0) + Number(vol || 0)); });
      }
      if (!count) continue;
      askAgg.forEach(function(v, k) { askAgg.set(k, v / count); });
      bidAgg.forEach(function(v, k) { bidAgg.set(k, v / count); });
      out.push({ t: Math.round(tsSum / count), asks: askAgg, bids: bidAgg, _merged: true, _count: count });
    }
    return out;
  };

  hp.formatUsd = function(v) {
    var n = Number(v || 0), abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  };
  hp.formatPrice = function(v) { return Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  hp.formatTime = function(ts) {
    var d = new Date(Number(ts || 0));
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  };

  hp.drawCenteredText = function(ctx, bounding, text, color, font) {
    ctx.save(); ctx.fillStyle = color; ctx.font = font || '11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bounding.width / 2, bounding.height / 2); ctx.restore();
  };

  hp.roundRect = function(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w * 0.5, h * 0.5); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr); ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr); ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath();
  };

  hp.getMouseLocal = function(canvas) {
    var state = window._waHmap;
    if (!canvas || state.mouse.x < 0 || state.mouse.y < 0) return null;
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    if (!rect) return null; return { x: state.mouse.x - rect.left, y: state.mouse.y - rect.top };
  };

  hp.findNearestColumn = function(columns, mouseX) {
    if (!columns || !columns.length) return null;
    var lo = 0, hi = columns.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (columns[mid].x < mouseX) lo = mid + 1; else hi = mid; }
    var a = columns[lo], b = columns[Math.max(0, lo - 1)];
    if (!b) return a; return Math.abs(a.x - mouseX) < Math.abs(b.x - mouseX) ? a : b;
  };

  hp.getNearestLevelInfo = function(snap, mouseY, yAxis) {
    if (!snap) return null;
    var nearest = null, nearestDy = Infinity;
    function scan(sideName, side) {
      hp.iterateBookSide(side, function(priceStr, vol) {
        var price = parseFloat(priceStr); if (!isFinite(price)) return;
        var y = hp.getYForPrice(price, yAxis); if (y == null) return;
        var dy = Math.abs(y - mouseY);
        if (dy < nearestDy) { nearestDy = dy; nearest = { side: sideName, price: price, y: y, vol: Number(vol || 0) }; }
      });
    }
    scan('ask', snap.asks); scan('bid', snap.bids);
    if (!nearest) return null;

    function nearestValueUsd(side, targetPrice) {
      var best = { usd: 0, diff: Infinity };
      hp.iterateBookSide(side, function(priceStr, vol) {
        var price = parseFloat(priceStr); if (!isFinite(price)) return;
        var d = Math.abs(price - targetPrice);
        if (d < best.diff) { best.diff = d; best.usd = price * Number(vol || 0); }
      });
      return best.usd;
    }
    var askUSD = nearestValueUsd(snap.asks, nearest.price);
    var bidUSD = nearestValueUsd(snap.bids, nearest.price);
    var ratio = askUSD > 0 ? (bidUSD / askUSD) : (bidUSD > 0 ? 9.99 : 1);
    var dominance = ratio < 0.85 ? 'Áp đảo Bán' : (ratio > 1.15 ? 'Áp đảo Mua' : 'Cân bằng');
    return { t: snap.t, price: nearest.price, askUSD: askUSD, bidUSD: bidUSD, ratio: ratio, dominance: dominance, topWall: Math.max(askUSD, bidUSD) };
  };

  hp.drawTooltip = function(ctx, bounding, mouse, info, redThreshold) {
    if (!info) return;
    var lines = [
      '⏱ ' + hp.formatTime(info.t) + '  |  $' + hp.formatPrice(info.price),
      '🔴 LỰC BÁN: ' + hp.formatUsd(info.askUSD) + (info.askUSD >= redThreshold ? ' (TOP WALL)' : ''),
      '🟢 LỰC MUA: ' + hp.formatUsd(info.bidUSD),
      '📊 Tỷ lệ: ' + info.ratio.toFixed(2) + ' (' + info.dominance + ')'
    ];
    var width = 208, height = 62;
    var x = hp.clamp(mouse.x + 12, 6, Math.max(6, bounding.width - width - 6));
    var y = hp.clamp(mouse.y - height - 8, 6, Math.max(6, bounding.height - height - 6));

    ctx.save();
    // Đảm bảo tooltip luôn nằm trên cùng (đè lên nến)
    ctx.globalCompositeOperation = 'source-over';
    hp.roundRect(ctx, x, y, width, height, 4); ctx.fillStyle = 'rgba(15,15,15,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = "9px system-ui, -apple-system, sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (var i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 1 ? 'rgba(255,110,90,0.95)' : (i === 2 ? 'rgba(100,255,180,0.95)' : 'rgba(245,245,245,0.95)');
      ctx.fillText(lines[i], x + 8, y + 7 + i * 13);
    }
    ctx.restore();
  };

  hp.sortByY = function(a, b) { return a.y - b.y; };

  hp.mergeLevelsIntoClusters = function(items, gapPx) {
    if (!items || !items.length) return [];
    items.sort(hp.sortByY);
    var out = [], cur = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!cur) { cur = { x: it.x, w: it.w, y1: it.y - it.h * 0.5, y2: it.y + it.h * 0.5, side: it.side, totalUsd: it.valUSD, levels: 1 }; continue; }
      var sameColumn = Math.abs(cur.x - it.x) <= 0.5 && cur.side === it.side;
      var nextY1 = it.y - it.h * 0.5, nextY2 = it.y + it.h * 0.5;
      if (sameColumn && nextY1 - cur.y2 <= gapPx) { cur.y2 = Math.max(cur.y2, nextY2); cur.totalUsd += it.valUSD; cur.levels += 1; } 
      else { out.push(cur); cur = { x: it.x, w: it.w, y1: nextY1, y2: nextY2, side: it.side, totalUsd: it.valUSD, levels: 1 }; }
    }
    if (cur) out.push(cur); return out;
  };

  hp.drawMergedClusters = function(ctx, clusters, barSpace) {
    if (!clusters || !clusters.length) return;
    ctx.save(); ctx.font = "9px system-ui, -apple-system, sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < clusters.length; i++) {
      var c = clusters[i], grad = ctx.createLinearGradient(0, c.y1, 0, c.y2);
      if (c.side === 'ask') { grad.addColorStop(0, 'rgba(255,120,80,0.12)'); grad.addColorStop(1, 'rgba(255,70,50,0.32)'); } 
      else { grad.addColorStop(0, 'rgba(80,255,180,0.12)'); grad.addColorStop(1, 'rgba(40,220,140,0.32)'); }
      ctx.fillStyle = grad; ctx.fillRect(c.x - c.w / 2, c.y1, c.w, Math.max(1, c.y2 - c.y1));
      ctx.strokeStyle = c.side === 'ask' ? 'rgba(255,120,80,0.42)' : 'rgba(80,255,180,0.42)';
      ctx.lineWidth = 1; ctx.strokeRect(c.x - c.w / 2, c.y1, c.w, Math.max(1, c.y2 - c.y1));
      if (barSpace > 10 && c.levels >= 2 && (c.y2 - c.y1) >= 12) {
        ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.fillText('CỤM ' + hp.formatUsd(c.totalUsd), c.x, (c.y1 + c.y2) * 0.5);
      }
    }
    ctx.restore();
  };

  hp.drawMajorWallClusters = function(ctx, majorWalls) {
    if (!majorWalls || !majorWalls.length) return;
    majorWalls.sort(function(a, b) { if (Math.abs(a.x - b.x) > 0.5) return a.x - b.x; if (a.side !== b.side) return a.side === 'ask' ? -1 : 1; return a.y - b.y; });
    var clusters = [], cur = null;
    for (var i = 0; i < majorWalls.length; i++) {
      var w = majorWalls[i], top = w.y - w.h * 0.5, bottom = w.y + w.h * 0.5;
      if (!cur) { cur = { side: w.side, x: w.x, w: w.w, y1: top, y2: bottom, val: w.valUSD }; continue; }
      var sameCol = Math.abs(cur.x - w.x) <= 0.5 && cur.side === w.side;
      if (sameCol && top - cur.y2 < 5) { cur.y2 = Math.max(cur.y2, bottom); cur.val += w.valUSD; } 
      else { clusters.push(cur); cur = { side: w.side, x: w.x, w: w.w, y1: top, y2: bottom, val: w.valUSD }; }
    }
    if (cur) clusters.push(cur);
    ctx.save(); ctx.lineWidth = 1;
    for (var j = 0; j < clusters.length; j++) {
      var c = clusters[j]; ctx.strokeStyle = c.side === 'ask' ? 'rgba(255,180,160,0.68)' : 'rgba(180,255,220,0.68)';
      ctx.strokeRect(c.x - c.w / 2, c.y1, c.w, Math.max(1, c.y2 - c.y1));
    }
    ctx.restore();
  };
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
// INDICATOR: WAVE_COB (Version 7.0 - Smooth Tweening)
// ─────────────────────────────────────────────────
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
            // Logic đổi icon Mắt mở / Mắt nhắm
            createTooltipDataSource: function({ indicator, defaultStyles }) {
                const icons = defaultStyles.tooltip.icons;
                const eyeIcon = indicator.visible ? icons[1] : icons[0];
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
   * Open indicator settings modal
   * @param {Object} indicator  — indicator instance from KLineCharts
   * @param {string} paneId
   */
  global.openIndicatorSettings = function (indicator, paneId) {
    const modal   = document.getElementById('sc-ind-settings-modal');
    const title   = document.getElementById('sc-ind-settings-title');
    const body    = document.getElementById('sc-ind-settings-body');
    const btnSave = document.getElementById('sc-ind-btn-save');
    const btnRst  = document.getElementById('sc-ind-btn-reset');
    if (!modal || !title || !body) return;

    const meta = INDICATOR_REGISTRY.find(function (x) { return x.name === indicator.name; });
    title.textContent = '⚙️ ' + (indicator.shortName || indicator.name);
    body.innerHTML = '';

    // [FIX] Fallback về registry defaults nếu undefined/rỗng
    const rawParams = indicator.calcParams;
    const currentParams = (rawParams && rawParams.length > 0) 
        ? rawParams 
        : (meta && meta.defaultParams ? [...meta.defaultParams] : []);
    const labels = meta && meta.paramLabels ? meta.paramLabels : [];
    const defaults = meta && meta.defaultParams ? meta.defaultParams : [];

    // [FIX] VOL và built-in không có params -> hiện thông báo thay vì crash
    if (currentParams.length === 0) {
        body.innerHTML = `<div style="color:${COLOR.muted}; font-size:13px; text-align:center; padding:20px 0;">Chỉ báo này không có thông số để cài đặt.</div>`;
        modal.style.display = 'flex';
        return; 
    }


    // Build param inputs
    currentParams.forEach(function (val, idx) {
      const label = labels[idx] || ('Thông số ' + (idx + 1));
      const row   = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:10px;';
      row.innerHTML = [
        '<label style="color:' + COLOR.muted + '; font-size:12px; font-weight:600; flex:1;">' + label + '</label>',
        '<input type="number" step="any" id="wa-param-' + idx + '" value="' + val + '"',
          'style="width:110px; background:rgba(0,0,0,0.5); border:1px solid ' + COLOR.border + ';',
          'border-radius:6px; padding:5px 10px; color:' + COLOR.white + '; font-size:13px;',
          'text-align:center; outline:none; transition:border-color .15s;">',
      ].join('');
      body.appendChild(row);
    });

    // Save
    if (btnSave._waHandler) btnSave.removeEventListener('click', btnSave._waHandler);
    btnSave._waHandler = function () {
      const newParams = currentParams.map(function (_, idx) {
        const inp = document.getElementById('wa-param-' + idx);
        return inp ? parseFloat(inp.value) || 0 : 0;
      });
      try {
        global.tvChart.overrideIndicator({ name: indicator.name, calcParams: newParams }, paneId);
        // Update stored params
        const entry = global.scActiveIndicators.find(function (x) { return x.name === indicator.name; });
        if (entry) { entry.params = newParams; saveIndicatorState(); }
      } catch (e) {
        console.error('[Wave Alpha] overrideIndicator error', e);
      }
      modal.style.display = 'none';
    };
    btnSave.addEventListener('click', btnSave._waHandler);

    // Reset defaults
    if (btnRst._waHandler) btnRst.removeEventListener('click', btnRst._waHandler);
    btnRst._waHandler = function () {
      defaults.forEach(function (val, idx) {
        const inp = document.getElementById('wa-param-' + idx);
        if (inp) inp.value = val;
      });
    };
    btnRst.addEventListener('click', btnRst._waHandler);

    modal.style.display = 'flex';
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