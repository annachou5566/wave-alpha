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
    const tabsHTML = CATEGORIES.map(function (cat, i) {
      return '<button class="wa-tab' + (i === 0 ? ' active' : '') + '" data-cat="' + cat.key + '">' + cat.label + '</button>';
    }).join('');

    return `
    <div id="sc-indicator-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.82);
         z-index:99999; backdrop-filter:blur(6px); justify-content:center; align-items:center;">
      <div id="wa-ind-modal-box" style="background:${COLOR.bg}; width:640px; height:520px; max-width:92vw;
           max-height:86vh; border-radius:14px; border:1px solid ${COLOR.border};
           box-shadow:0 20px 60px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden;">

        <!-- Header -->
        <div style="padding:14px 20px; border-bottom:1px solid ${COLOR.border};
             display:flex; justify-content:space-between; align-items:center; gap:12px; flex-shrink:0;">
          <h5 style="margin:0; color:${COLOR.white}; font-size:15px; font-weight:700; display:flex; align-items:center; gap:8px;">
            <span style="color:${COLOR.cyan}; font-size:18px;">⚡</span> Thư viện Chỉ báo
          </h5>
          <button id="wa-ind-modal-close" aria-label="Đóng" style="background:transparent; border:none;
              color:${COLOR.muted}; cursor:pointer; font-size:18px; line-height:1; padding:2px 6px;
              border-radius:4px; transition:color .15s;">✕</button>
        </div>

        <!-- Search -->
        <div style="padding:12px 20px; border-bottom:1px solid ${COLOR.border}; flex-shrink:0;">
          <div style="position:relative;">
            <span style="position:absolute; left:11px; top:50%; transform:translateY(-50%);
                  color:${COLOR.muted}; font-size:13px; pointer-events:none;">🔍</span>
            <input id="wa-ind-search" type="text" placeholder="Tìm kiếm chỉ báo..."
              autocomplete="off"
              style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.35);
                     border:1px solid ${COLOR.border}; border-radius:8px;
                     padding:8px 12px 8px 34px; color:${COLOR.white};
                     outline:none; font-size:13px; transition:border-color .15s;">
          </div>
        </div>

        <!-- Tabs -->
        <div id="wa-ind-tabs" style="display:flex; gap:4px; padding:10px 20px 0;
             overflow-x:auto; flex-shrink:0; scrollbar-width:none;">
          ${tabsHTML}
        </div>

        <!-- List -->
        <div id="wa-ind-list" style="flex:1; overflow-y:auto; padding:10px 14px 14px;
             display:grid; grid-template-columns:1fr 1fr; gap:6px; align-content: start;"></div>

        <!-- Empty state -->
        <div id="wa-ind-empty" style="display:none; flex:1; align-items:center;
             justify-content:center; padding:30px; color:${COLOR.muted}; font-size:13px;
             text-align:center;">
          Không tìm thấy chỉ báo phù hợp
        </div>
      </div>
    </div>`;
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

      // Close
      document.getElementById('wa-ind-modal-close').addEventListener('click', function () {
        document.getElementById('sc-indicator-modal').style.display = 'none';
      });

      // Close on backdrop
      document.getElementById('sc-indicator-modal').addEventListener('click', function (e) {
        if (e.target === this) this.style.display = 'none';
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

          <!-- Indicators button -->
          <button id="btn-fx-indicator" title="Thư viện chỉ báo"
            style="background:transparent; color:${COLOR.muted}; border:none; cursor:pointer;
                   font-size:13px; display:flex; align-items:center; gap:5px; padding:4px 8px;
                   border-radius:6px; font-weight:600; transition:.15s;"
            onmouseover="this.style.color='${COLOR.cyan}'; this.style.background='${COLOR.cyanFaint}'"
            onmouseout="this.style.color='${COLOR.muted}'; this.style.background='transparent'">
            ⚡ <span class="wa-label">Chỉ báo</span>
          </button>

          <div style="width:1px; height:18px; background:${COLOR.border}; margin:0 4px;"></div>

          <!-- Drawing tools dropdown -->
          <div style="position:relative; display:inline-flex; align-items:center;">
            <button id="btn-wa-draw" title="Công cụ vẽ"
              style="background:transparent; color:${COLOR.muted}; border:none; cursor:pointer;
                     font-size:13px; display:flex; align-items:center; gap:5px; padding:4px 6px;
                     border-radius:6px; font-weight:600; transition:.15s;"
              onmouseover="this.style.color='${COLOR.cyan}'; this.style.background='rgba(0,240,255,0.07)'"
              onmouseout="this.style.color='${COLOR.muted}'; this.style.background='transparent'">
              ✏️ <span class="wa-label" style="font-size:11px; margin-left:3px;">Vẽ</span>
            </button>
            
            <div id="wa-draw-menu" style="display:none; position:absolute; top:calc(100% + 6px); left:0;
                 background:${COLOR.bg}; border:1px solid ${COLOR.border}; border-radius:10px;
                 padding:8px; min-width:165px; z-index:20000; box-shadow:0 12px 32px rgba(0,0,0,0.8);">
                 
                <div style="font-size:10px; font-weight:800; color:${COLOR.muted}; letter-spacing:1px; margin:4px 8px 8px;">CÔNG CỤ VẼ</div>
                
                ${[
                    ['segment', '📉 Đường xu hướng (Trend)'],
                    ['horizontalLine', '➖ Đường ngang'],
                    ['verticalLine', '│ Đường dọc'],
                    ['rayLine', '↗️ Tia (Ray)'],
                    ['fibonacciLine', '📐 Fibonacci']
                ].map(t => `
                    <div onclick="if(window.tvChart){window.tvChart.createOverlay('${t[0]}');} document.getElementById('wa-draw-menu').style.display='none';" 
                         style="padding:8px 10px; color:${COLOR.white}; font-size:12px; cursor:pointer; border-radius:5px; transition:0.15s; display:flex; align-items:center; gap:6px;"
                         onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                         ${t[1]}
                    </div>
                `).join('')}
                
                <div style="height:1px; background:${COLOR.border}; margin:6px 0;"></div>
                
                <div onclick="if(window.tvChart){window.tvChart.removeOverlay();} document.getElementById('wa-draw-menu').style.display='none';" 
                     style="padding:8px 10px; color:${COLOR.red}; font-size:12px; cursor:pointer; border-radius:5px; transition:0.15s; display:flex; align-items:center; gap:6px;"
                     onmouseover="this.style.background='rgba(246,70,93,0.1)'" onmouseout="this.style.background='transparent'">
                     🗑️ Xóa tất cả hình vẽ
                </div>
            </div>
          </div>

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
                 padding:14px 16px; min-width:230px; z-index:20000; box-shadow:0 12px 32px rgba(0,0,0,0.8);">
                <div style="font-size:10px; font-weight:800; color:${COLOR.muted}; letter-spacing:1.2px; margin-bottom:12px;">CÀI ĐẶT BIỂU ĐỒ</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="color:${COLOR.white}; font-size:12px;">Đường Grid</span>
                    <div id="wa-grid-toggle" onclick="window.waCsToggleGrid()" data-on="1" style="width:36px; height:20px; background:#00F0FF; border-radius:34px; cursor:pointer; position:relative; transition:.2s;">
                        <div id="wa-grid-knob" style="position:absolute; right:2px; top:2px; width:16px; height:16px; background:#fff; border-radius:50%; transition:.2s;"></div>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="color:${COLOR.white};font-size:12px;">🕯️ Nến Tăng</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="text" id="wa-hex-up" value="#0ECB81" maxlength="7" style="width:60px; height:24px; background:rgba(0,0,0,0.4); border:1px solid ${COLOR.border}; border-radius:4px; color:${COLOR.white}; font-size:11px; text-align:center; outline:none; font-family:monospace;" onchange="document.getElementById('wa-color-up').value = this.value.length === 7 ? this.value : '#0ECB81'; window.waCsApply()">
                    <input type="color" id="wa-color-up" value="#0ECB81" style="width:28px;height:24px;border:1px solid ${COLOR.border};border-radius:5px;cursor:pointer;background:transparent;padding:1px;" oninput="document.getElementById('wa-hex-up').value = this.value; window.waCsApply()">
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span style="color:${COLOR.white};font-size:12px;">🕯️ Nến Giảm</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="text" id="wa-hex-down" value="#F6465D" maxlength="7" style="width:60px; height:24px; background:rgba(0,0,0,0.4); border:1px solid ${COLOR.border}; border-radius:4px; color:${COLOR.white}; font-size:11px; text-align:center; outline:none; font-family:monospace;" onchange="document.getElementById('wa-color-down').value = this.value.length === 7 ? this.value : '#F6465D'; window.waCsApply()">
                    <input type="color" id="wa-color-down" value="#F6465D" style="width:28px;height:24px;border:1px solid ${COLOR.border};border-radius:5px;cursor:pointer;background:transparent;padding:1px;" oninput="document.getElementById('wa-hex-down').value = this.value; window.waCsApply()">
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <span style="color:${COLOR.white};font-size:12px;">🖼️ Màu Nền</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="text" id="wa-hex-bg" value="#161a1e" maxlength="7" style="width:60px; height:24px; background:rgba(0,0,0,0.4); border:1px solid ${COLOR.border}; border-radius:4px; color:${COLOR.white}; font-size:11px; text-align:center; outline:none; font-family:monospace;" onchange="document.getElementById('wa-color-bg').value = this.value.length === 7 ? this.value : '#161a1e'; window.waCsApply()">
                    <input type="color" id="wa-color-bg" value="#161a1e" style="width:28px;height:24px;border:1px solid ${COLOR.border};border-radius:5px;cursor:pointer;background:transparent;padding:1px;" oninput="document.getElementById('wa-hex-bg').value = this.value; window.waCsApply()">
                </div>
            </div>
                <div style="font-size:10px; color:${COLOR.muted}; margin-bottom:7px; font-weight:600;">Nền có sẵn:</div>
                <div style="display:flex; gap:7px; flex-wrap:wrap;">
                    ${[
                        ['#161a1e','Wave Alpha'],['#131722','TradingView'],
                        ['#0d1117','GitHub Dark'],['#1a1a2e','Navy'],
                        ['#0f0f0f','Pure Black'],['#FFFFFF','Sáng']
                    ].map(c => `<div title="${c[1]}" onclick="window.waCsSetBg('${c[0]}')" style="width:24px; height:24px; background:${c[0]}; border-radius:5px; cursor:pointer; border:1px solid rgba(255,255,255,0.18); transition:transform .15s; flex-shrink:0;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>`).join('')}
                </div>
            </div>
          </div>

          <div style="width:1px; height:18px; background:${COLOR.border}; margin:0 4px;"></div>
          <button id="btn-wa-screenshot" title="Chụp ảnh chart"
            style="background:transparent; color:${COLOR.muted}; border:none; cursor:pointer;
                   font-size:13px; padding:4px 8px; border-radius:6px; transition:.15s;"
            onmouseover="this.style.color='${COLOR.gold}'; this.style.background='rgba(240,185,11,0.07)'"
            onmouseout="this.style.color='${COLOR.muted}'; this.style.background='transparent'">📷</button>
        `;
        container.appendChild(tbWrap);

        // Indicator button click
        document.getElementById('btn-fx-indicator').addEventListener('click', global.openIndicatorModal);

        // Xử lý mở/đóng menu Vẽ (Cập nhật mới)
        const btnDraw = document.getElementById('btn-wa-draw');
        const menuDraw = document.getElementById('wa-draw-menu');
        if (btnDraw && menuDraw) {
            btnDraw.addEventListener('click', function(e) {
                e.stopPropagation();
                // Đóng menu Cài đặt Chart nếu nó đang mở
                const menuCfg = document.getElementById('wa-chart-cfg-menu');
                if (menuCfg) menuCfg.style.display = 'none';
                
                menuDraw.style.display = menuDraw.style.display === 'none' ? 'block' : 'none';
            });
            menuDraw.addEventListener('click', function(e) { e.stopPropagation(); });
            document.addEventListener('click', function() { menuDraw.style.display = 'none'; });
        }

        // Fullscreen
        document.getElementById('btn-wa-fs').addEventListener('click', function () {
          const el = document.getElementById('tv-chart-container') || document.documentElement;
          if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
          else document.exitFullscreen && document.exitFullscreen();
        });

        // Screenshot
        document.getElementById('btn-wa-screenshot').addEventListener('click', function () {
          if (global.tvChart && typeof global.tvChart.getConvertPictureUrl === 'function') {
            const savedSettings = JSON.parse(localStorage.getItem('wa_chart_settings') || '{}');
            const currentBgColor = savedSettings.colBg || '#1e2329';
            
            const url = global.tvChart.getConvertPictureUrl(true, 'jpeg', currentBgColor);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = 'wave-alpha-chart-' + Date.now() + '.jpg';
            a.click();
          }
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

            // Load setting cũ nếu có (Đồng bộ cả Color Picker và Text Hex)
            const saved = JSON.parse(localStorage.getItem('wa_chart_settings') || '{}');
            
            const cUp = saved.colUp || COLOR.green;
            document.getElementById('wa-color-up').value = cUp;
            document.getElementById('wa-hex-up').value = cUp;
            
            const cDown = saved.colDown || COLOR.red;
            document.getElementById('wa-color-down').value = cDown;
            document.getElementById('wa-hex-down').value = cDown;
            
            const cBg = saved.colBg || COLOR.bgDark;
            document.getElementById('wa-color-bg').value = cBg;
            document.getElementById('wa-hex-bg').value = cBg;
            
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

        window.waCsApply = function() {
            // [FIX] Lấy màu từ ô Text thay vì bảng màu, cho phép nhập tự do
            const up   = document.getElementById('wa-hex-up').value;
            const down = document.getElementById('wa-hex-down').value;
            const bg   = document.getElementById('wa-hex-bg').value;
            const showGrid = document.getElementById('wa-grid-toggle').dataset.on === '1';

            localStorage.setItem('wa_chart_settings', JSON.stringify({ showGrid, colUp: up, colDown: down, colBg: bg }));

            const chartContainer = document.getElementById('sc-chart-container');
            if (chartContainer) chartContainer.style.background = bg;

            if (window.tvChart) {
                window.tvChart.setStyles({
                  watermark: {
                        show: true, text: 'WAVE ALPHA', color: 'rgba(255, 255, 255, 0.05)', size: 48, weight: '800'
                    },
                    grid: {
                        horizontal: { show: showGrid, color: 'rgba(255,255,255,0.05)', style: 'dashed' },
                        vertical:   { show: showGrid, color: 'rgba(255,255,255,0.05)', style: 'dashed' }
                    },
                    candle: { bar: {
                        upColor: up, downColor: down, noChangeColor: '#848e9c',
                        upBorderColor: up, downBorderColor: down,
                        upWickColor: up, downWickColor: down
                    }}
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