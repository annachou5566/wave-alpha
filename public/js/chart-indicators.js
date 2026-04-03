// ============================================================================
// 🚀 FILE: chart-indicators.js - HỆ THỐNG CHỈ BÁO & UI ĐỘC QUYỀN (WAVE ALPHA)
// 🎯 VERSION: 2.0.0 PRO (TradingView Standard)
// ============================================================================

// ── SECTION 1: CONSTANTS & CONFIG ───────────────────────────────────────────
const WA_CONFIG = {
    STORAGE_KEY: 'wave_alpha_indicators_state',
    COLORS: {
        bg: '#1e2329', accent: '#00F0FF', danger: '#F6465D', 
        success: '#0ECB81', warning: '#F0B90B', text: '#EAECEF', muted: '#848e9c'
    },
    CATEGORIES: [
        { id: 'all', name: 'Tất cả' },
        { id: 'wave_alpha', name: 'Độc quyền Wave Alpha 👑' },
        { id: 'trend', name: 'Xu hướng (Trend)' },
        { id: 'oscillator', name: 'Dao động (Oscillator)' },
        { id: 'volume', name: 'Khối lượng (Volume)' },
        { id: 'volatility', name: 'Biến động (Volatility)' }
    ]
};

if (!window.scActiveIndicators) window.scActiveIndicators = [];

// ── SECTION 2: MATH HELPERS (PURE FUNCTIONS) ────────────────────────────────
const WAMath = {
    // Typical Price: (H+L+C)/3
    tp: (k) => (k.high + k.low + k.close) / 3,
    
    // True Range
    tr: (current, prev) => Math.max(
        current.high - current.low,
        Math.abs(current.high - (prev ? prev.close : current.open)),
        Math.abs(current.low - (prev ? prev.close : current.open))
    ),
    
    // RMA (Wilder's Smoothing) - Dùng cho ATR, RSI
    rma: (dataList, period, valueKey) => {
        let result = [];
        let sum = 0;
        for (let i = 0; i < dataList.length; i++) {
            let val = typeof valueKey === 'function' ? valueKey(dataList[i], i>0?dataList[i-1]:null) : dataList[i][valueKey];
            if (i < period) {
                sum += val;
                result.push(i === period - 1 ? sum / period : null);
            } else {
                result.push((result[i - 1] * (period - 1) + val) / period);
            }
        }
        return result;
    },

    // SMA (Simple Moving Average)
    sma: (dataList, period, valueKey) => {
        let result = [];
        let sum = 0;
        for (let i = 0; i < dataList.length; i++) {
            let val = typeof valueKey === 'function' ? valueKey(dataList[i]) : dataList[i][valueKey];
            sum += val;
            if (i >= period) sum -= (typeof valueKey === 'function' ? valueKey(dataList[i-period]) : dataList[i-period][valueKey]);
            result.push(i >= period - 1 ? sum / period : null);
        }
        return result;
    }
};

// ── SECTION 3: INDICATOR DEFINITIONS (REGISTRY) ─────────────────────────────
const INDICATOR_REGISTRY = [
    {
        name: 'VWAP_BANDS', shortName: 'Wave VWAP Pro',
        description: 'Anchored VWAP kèm Standard Deviation Bands chuẩn Volume-Weighted',
        category: 'wave_alpha', isStack: true, builtIn: false,
        defaultParams: [1, 2, 0], // SD1, SD2, Anchor(0=Day, 1=Week, 2=Month)
        paramLabels: ['Hệ số Band 1 (Lõi)', 'Hệ số Band 2 (Ngoài)', 'Anchor (0=D/1=W/2=M)'],
        colors: [WA_CONFIG.COLORS.warning, WA_CONFIG.COLORS.accent, '#FFFFFF', WA_CONFIG.COLORS.accent, WA_CONFIG.COLORS.warning]
    },
    {
        name: 'SUPERTREND', shortName: 'SuperTrend',
        description: 'Chỉ báo theo xu hướng dựa trên ATR, tự động đổi màu khi đảo chiều',
        category: 'trend', isStack: true, builtIn: false,
        defaultParams: [10, 3], paramLabels: ['ATR Period', 'Multiplier'],
        colors: [WA_CONFIG.COLORS.success, WA_CONFIG.COLORS.danger]
    },
    {
        name: 'PIVOT_POINTS', shortName: 'Pivot Points (Classic)',
        description: 'Các mức hỗ trợ & kháng cự tự động (Daily)',
        category: 'trend', isStack: true, builtIn: false,
        defaultParams: [], paramLabels: [],
        colors: ['#FFFFFF', '#FF5252', '#FF5252', '#FF5252', '#4CAF50', '#4CAF50', '#4CAF50']
    },
    {
        name: 'STOCH', shortName: 'Stochastic',
        description: 'Chỉ báo động lượng quá mua/quá bán (0-100)',
        category: 'oscillator', isStack: false, builtIn: false,
        defaultParams: [14, 3, 3], paramLabels: ['%K Length', '%D Length', 'Smooth'],
        colors: [WA_CONFIG.COLORS.accent, WA_CONFIG.COLORS.danger]
    },
    {
        name: 'CCI', shortName: 'CCI',
        description: 'Commodity Channel Index đo lường chu kỳ giá',
        category: 'oscillator', isStack: false, builtIn: false,
        defaultParams: [20], paramLabels: ['Length'],
        colors: [WA_CONFIG.COLORS.warning]
    },
    {
        name: 'MFI', shortName: 'Money Flow Index',
        description: 'Chỉ báo RSI tích hợp thêm sức mạnh khối lượng (Volume)',
        category: 'volume', isStack: false, builtIn: false,
        defaultParams: [14], paramLabels: ['Length'],
        colors: [WA_CONFIG.COLORS.success]
    },
    {
        name: 'WILLIAMS_R', shortName: 'Williams %R',
        description: 'Đo mức đóng cửa tương đối so với đỉnh cao nhất',
        category: 'oscillator', isStack: false, builtIn: false,
        defaultParams: [14], paramLabels: ['Length'],
        colors: ['#BA68C8']
    },
    {
        name: 'ATR', shortName: 'Average True Range',
        description: 'Đo lường mức độ biến động tuyệt đối của thị trường',
        category: 'volatility', isStack: false, builtIn: false,
        defaultParams: [14], paramLabels: ['Length'],
        colors: [WA_CONFIG.COLORS.danger]
    },
    {
        name: 'OBV', shortName: 'On Balance Volume',
        description: 'Dòng tiền tích lũy dựa trên khối lượng mua/bán',
        category: 'volume', isStack: false, builtIn: false,
        defaultParams: [], paramLabels: [],
        colors: ['#2196F3']
    },
    // Các chỉ báo Built-in của KLineChart
    { name: 'MACD', shortName: 'MACD', description: 'Đường trung bình động hội tụ phân kỳ', category: 'oscillator', isStack: false, builtIn: true, defaultParams: [12, 26, 9], paramLabels: ['Fast', 'Slow', 'Signal'] },
    { name: 'RSI', shortName: 'RSI', description: 'Chỉ số sức mạnh tương đối', category: 'oscillator', isStack: false, builtIn: true, defaultParams: [14], paramLabels: ['Length'] },
    { name: 'EMA', shortName: 'EMA', description: 'Đường trung bình động hàm mũ', category: 'trend', isStack: true, builtIn: true, defaultParams: [9, 21, 50], paramLabels: ['EMA 1', 'EMA 2', 'EMA 3'] },
    { name: 'BOLL', shortName: 'Bollinger Bands', description: 'Dải Bollinger đo biến động giá', category: 'volatility', isStack: true, builtIn: true, defaultParams: [20, 2], paramLabels: ['Length', 'Multiplier'] }
];

// ── SECTION 4: REGISTER CUSTOM INDICATORS ───────────────────────────────────
window.registerWaveIndicators = function() {
    if (!window.klinecharts) return;
    const kc = window.klinecharts;

    // 1. VWAP_BANDS (FIXED CRITICAL BUG)
    kc.registerIndicator({
        name: 'VWAP_BANDS', shortName: 'VWAP', series: 'price',
        calcParams: [1, 2, 0],
        figures: [
            { key: 'upper2', title: 'UB2: ', type: 'line' },
            { key: 'upper1', title: 'UB1: ', type: 'line' },
            { key: 'vwap', title: 'VWAP: ', type: 'line' },
            { key: 'lower1', title: 'LB1: ', type: 'line' },
            { key: 'lower2', title: 'LB2: ', type: 'line' }
        ],
        styles: {
            lines: [
                { color: WA_CONFIG.COLORS.warning, size: 1, style: 'dashed' },
                { color: WA_CONFIG.COLORS.accent, size: 1, style: 'solid' },
                { color: '#FFFFFF', size: 2.5, style: 'solid' },
                { color: WA_CONFIG.COLORS.accent, size: 1, style: 'solid' },
                { color: WA_CONFIG.COLORS.warning, size: 1, style: 'dashed' }
            ]
        },
        calc: (dataList, indicator) => {
            const [mult1, mult2, anchorType] = indicator.calcParams;
            let cumVol = 0, cumVolPrice = 0, cumVolPriceSq = 0;

            return dataList.map((k, i) => {
                let isReset = false;
                const d = new Date(k.timestamp);
                
                // BUG 1 FIXED: UTC absolute day index
                if (i === 0) {
                    isReset = true;
                } else {
                    const prevD = new Date(dataList[i - 1].timestamp);
                    if (anchorType === 0) { // Daily
                        isReset = Math.floor(k.timestamp / 86400000) !== Math.floor(dataList[i-1].timestamp / 86400000);
                    } else if (anchorType === 1) { // Weekly (Monday start UTC)
                        isReset = (d.getUTCDay() === 1 && prevD.getUTCDay() !== 1) || (k.timestamp - dataList[i-1].timestamp > 604800000);
                    } else { // Monthly
                        isReset = d.getUTCMonth() !== prevD.getUTCMonth();
                    }
                }

                if (isReset) { cumVol = 0; cumVolPrice = 0; cumVolPriceSq = 0; }

                const tp = WAMath.tp(k);
                const vol = k.volume || 0;

                cumVol += vol;
                cumVolPrice += tp * vol;
                // BUG 1 FIXED: Volume-Weighted standard deviation equation prep
                cumVolPriceSq += vol * tp * tp; 

                if (cumVol === 0) return {};

                const vwap = cumVolPrice / cumVol;
                // Volume-Weighted Variance = (Σ(vol*tp^2)/Σvol) - VWAP^2
                const variance = Math.max(0, (cumVolPriceSq / cumVol) - (vwap * vwap));
                const sd = Math.sqrt(variance);

                return {
                    upper2: vwap + sd * mult2, upper1: vwap + sd * mult1, vwap: vwap,
                    lower1: vwap - sd * mult1, lower2: vwap - sd * mult2
                };
            });
        }
    });

    // 2. SUPERTREND
    kc.registerIndicator({
        name: 'SUPERTREND', shortName: 'SuperTrend', series: 'price',
        calcParams: [10, 3],
        figures: [ { key: 'trendLine', title: 'ST: ', type: 'line' } ],
        calc: (dataList, indicator) => {
            const [period, multiplier] = indicator.calcParams;
            const atr = WAMath.rma(dataList, period, WAMath.tr);
            let prevFinalUpper = 0, prevFinalLower = 0, prevTrend = 1;
            
            return dataList.map((k, i) => {
                if (i < period || !atr[i]) return {};
                const hl2 = (k.high + k.low) / 2;
                const basicUpper = hl2 + multiplier * atr[i];
                const basicLower = hl2 - multiplier * atr[i];
                const prevClose = dataList[i-1].close;

                let finalUpper = (basicUpper < prevFinalUpper || prevClose > prevFinalUpper) ? basicUpper : prevFinalUpper;
                let finalLower = (basicLower > prevFinalLower || prevClose < prevFinalLower) ? basicLower : prevFinalLower;
                
                let trend = prevTrend;
                if (trend === 1 && k.close < finalLower) trend = -1;
                else if (trend === -1 && k.close > finalUpper) trend = 1;

                prevFinalUpper = finalUpper; prevFinalLower = finalLower; prevTrend = trend;
                
                // Thay đổi màu sắc tùy biến dựa vào giá trị (Line color function trong v9)
                return { trendLine: trend === 1 ? finalLower : finalUpper, _trend: trend };
            });
        }
    });

    // 3. ATR
    kc.registerIndicator({
        name: 'ATR', shortName: 'ATR', series: 'normal',
        calcParams: [14], figures: [{ key: 'atr', title: 'ATR: ', type: 'line' }],
        calc: (dataList, indicator) => {
            const atrVals = WAMath.rma(dataList, indicator.calcParams[0], WAMath.tr);
            return dataList.map((k, i) => ({ atr: atrVals[i] }));
        }
    });

    // 4. MFI (Money Flow Index)
    kc.registerIndicator({
        name: 'MFI', shortName: 'MFI', series: 'normal', calcParams: [14],
        figures: [{ key: 'mfi', title: 'MFI: ', type: 'line' }],
        calc: (dataList, indicator) => {
            const period = indicator.calcParams[0];
            return dataList.map((k, i) => {
                if (i < period) return {};
                let posMF = 0, negMF = 0;
                for(let j = i - period + 1; j <= i; j++) {
                    const tp = WAMath.tp(dataList[j]);
                    const prevTp = WAMath.tp(dataList[j-1]);
                    const mf = tp * (dataList[j].volume || 0);
                    if (tp > prevTp) posMF += mf; else if (tp < prevTp) negMF += mf;
                }
                const mfi = negMF === 0 ? 100 : 100 - (100 / (1 + (posMF / negMF)));
                return { mfi };
            });
        }
    });

    console.log("🟢 [Wave Alpha] Custom Indicators Registered Successfully.");
};

// ── SECTION 5: UI COMPONENTS ────────────────────────────────────────────────
window.initExpertUI = function() {
    // Inject Indicator Modal (Thư viện)
    if (!document.getElementById('sc-indicator-modal')) {
        const catHtml = WA_CONFIG.CATEGORIES.map((c, i) => 
            `<div class="wa-ind-cat ${i===0?'active':''}" data-cat="${c.id}" onclick="window.WaveIndicatorAPI.filterCat('${c.id}', this)" style="padding: 10px 20px; color: ${i===0?WA_CONFIG.COLORS.text:WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 13px; font-weight: 600; border-left: 3px solid ${i===0?WA_CONFIG.COLORS.accent:'transparent'}; background: ${i===0?'rgba(0,240,255,0.05)':'transparent'}; transition: 0.2s;">${c.name}</div>`
        ).join('');

        const modalHtml = `
        <div id="sc-indicator-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 99999; backdrop-filter: blur(5px); justify-content: center; align-items: center;">
            <div style="background: ${WA_CONFIG.COLORS.bg}; width: 650px; max-width: 95%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.9); display: flex; flex-direction: column; overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <h5 style="margin: 0; color: ${WA_CONFIG.COLORS.text}; font-size: 16px; font-weight: 700;"><i class="fas fa-wave-square" style="color: ${WA_CONFIG.COLORS.accent}; margin-right: 8px;"></i> Thư viện Chỉ báo</h5>
                    <button onclick="document.getElementById('sc-indicator-modal').style.display='none'" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 16px;"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: ${WA_CONFIG.COLORS.muted};"></i>
                        <input type="text" id="wa-ind-search" placeholder="Tìm kiếm chỉ báo..." onkeyup="window.WaveIndicatorAPI.searchInd(this.value)" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px 8px 35px; color: ${WA_CONFIG.COLORS.text}; outline: none; font-size: 13px;">
                    </div>
                </div>
                <div style="display: flex; height: 380px;">
                    <div style="width: 200px; background: rgba(0,0,0,0.15); border-right: 1px solid rgba(255,255,255,0.05); padding: 10px 0; overflow-y: auto;">
                        ${catHtml}
                    </div>
                    <div id="wa-ind-list" style="flex: 1; padding: 10px 20px; overflow-y: auto;">
                        </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    // Inject Settings Modal
    if (!document.getElementById('sc-ind-settings-modal')) {
        const setHtml = `
        <div id="sc-ind-settings-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); z-index: 999999; backdrop-filter: blur(5px); justify-content: center; align-items: center;">
            <div style="background: ${WA_CONFIG.COLORS.bg}; width: 350px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.9); overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <h5 id="sc-ind-settings-title" style="margin: 0; color: ${WA_CONFIG.COLORS.text}; font-size: 15px; font-weight: 700;">⚙️ Cài đặt</h5>
                    <button onclick="document.getElementById('sc-ind-settings-modal').style.display='none'" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer;"><i class="fas fa-times"></i></button>
                </div>
                <div id="sc-ind-settings-body" style="padding: 20px; display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
                </div>
                <div style="padding: 15px 20px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                    <button id="sc-ind-btn-reset" style="background: transparent; color: ${WA_CONFIG.COLORS.muted}; border: 1px solid rgba(255,255,255,0.1); padding: 6px 15px; border-radius: 4px; font-size: 12px; cursor: pointer;">MẶC ĐỊNH</button>
                    <button id="sc-ind-btn-save" style="background: ${WA_CONFIG.COLORS.accent}; color: #000; border: none; padding: 6px 20px; border-radius: 4px; font-weight: 800; font-size: 13px; cursor: pointer;">LƯU LẠI</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', setHtml);
    }

    // Inject Topbar Tools (Screenshot, Fullscreen, Drawing Dropdown)
    if (!document.getElementById('wa-topbar-tools')) {
        let timeBtnLists = document.querySelectorAll('.sc-time-btn');
        if (timeBtnLists.length > 0) {
            let topbarContainer = timeBtnLists[0].parentElement;
            let fxBtnHtml = `
                <div id="wa-topbar-tools" style="display: flex; align-items: center; gap: 5px;">
                    <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 5px;"></div>
                    <button class="btn btn-sm" onclick="window.WaveIndicatorAPI.openModal()" style="background: transparent; color: ${WA_CONFIG.COLORS.muted}; border: none; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;" title="Thư viện chỉ báo"><i class="fas fa-wave-square"></i> ƒx</button>
                    <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 5px;"></div>
                    
                    <button onclick="window.WaveIndicatorAPI.toggleDraw('trendLine')" title="Trendline" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 13px;"><i class="fas fa-chart-line"></i></button>
                    <button onclick="window.WaveIndicatorAPI.toggleDraw('horizontalRayLine')" title="Tia ngang" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 13px;"><i class="fas fa-arrows-alt-h"></i></button>
                    <button onclick="window.WaveIndicatorAPI.toggleDraw('fibonacciLine')" title="Fibonacci" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 13px;"><i class="fas fa-align-center"></i></button>
                    <button onclick="window.clearUserDrawings()" title="Xóa hình vẽ" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.danger}; cursor: pointer; font-size: 13px;"><i class="fas fa-trash-alt"></i></button>
                    
                    <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 5px;"></div>
                    <button onclick="window.WaveIndicatorAPI.takeScreenshot()" title="Chụp biểu đồ" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 13px;"><i class="fas fa-camera"></i></button>
                    <button onclick="window.WaveIndicatorAPI.toggleFullscreen()" title="Toàn màn hình" style="background: transparent; border: none; color: ${WA_CONFIG.COLORS.muted}; cursor: pointer; font-size: 13px;"><i class="fas fa-expand"></i></button>
                </div>
            `;
            topbarContainer.insertAdjacentHTML('beforeend', fxBtnHtml);
        }
    }

    // Auto-restore indicators
    window.WaveIndicatorAPI.restoreState();
};

// ── SECTION 6: EVENT HANDLERS & MEMORY ──────────────────────────────────────
window.WaveIndicatorAPI = {
    openModal: () => {
        document.getElementById('sc-indicator-modal').style.display = 'flex';
        window.WaveIndicatorAPI.renderList();
    },

    filterCat: (catId, el) => {
        document.querySelectorAll('.wa-ind-cat').forEach(e => {
            e.style.color = WA_CONFIG.COLORS.muted;
            e.style.borderLeft = '3px solid transparent';
            e.style.background = 'transparent';
        });
        el.style.color = WA_CONFIG.COLORS.text;
        el.style.borderLeft = `3px solid ${WA_CONFIG.COLORS.accent}`;
        el.style.background = 'rgba(0,240,255,0.05)';
        
        document.getElementById('wa-ind-search').value = '';
        window.WaveIndicatorAPI.renderList(catId, '');
    },

    searchInd: (keyword) => {
        window.WaveIndicatorAPI.renderList('all', keyword.toLowerCase());
    },

    renderList: (catId = 'all', keyword = '') => {
        const listDiv = document.getElementById('wa-ind-list');
        listDiv.innerHTML = '';

        INDICATOR_REGISTRY.forEach(ind => {
            if (catId !== 'all' && ind.category !== catId) return;
            if (keyword && !ind.shortName.toLowerCase().includes(keyword) && !ind.description.toLowerCase().includes(keyword)) return;

            const isActive = window.scActiveIndicators.some(x => x.name === ind.name);
            const badge = isActive ? `<span style="font-size: 9px; background: rgba(14,203,129,0.2); color: ${WA_CONFIG.COLORS.success}; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">Đang dùng</span>` : '';
            const actionBtn = isActive 
                ? `<i class="fas fa-times-circle" title="Xóa" onclick="event.stopPropagation(); window.WaveIndicatorAPI.removeInd('${ind.name}')" style="color: ${WA_CONFIG.COLORS.danger}; font-size: 14px;"></i>` 
                : `<i class="fas fa-plus-circle" style="color: ${WA_CONFIG.COLORS.muted}; font-size: 14px;"></i>`;

            listDiv.innerHTML += `
                <div onclick="window.WaveIndicatorAPI.addInd('${ind.name}')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <div>
                        <div style="color: ${ind.category==='wave_alpha'?WA_CONFIG.COLORS.accent:WA_CONFIG.COLORS.text}; font-size: 14px; font-weight: 700;">${ind.shortName} ${badge}</div>
                        <div style="color: ${WA_CONFIG.COLORS.muted}; font-size: 11px; margin-top: 4px;">${ind.description}</div>
                    </div>
                    ${actionBtn}
                </div>
            `;
        });
    },

    addInd: (name, retryCount = 0) => {
        if (!window.tvChart) return;
        const indMeta = INDICATOR_REGISTRY.find(i => i.name === name);
        if (!indMeta) return;

        document.getElementById('sc-indicator-modal').style.display = 'none';
        let paneId = indMeta.isStack ? 'candle_pane' : 'pane_' + name.toLowerCase();

        try {
            // BUG 2 FIXED: Stack Retry Logic cho candle_pane
            window.tvChart.createIndicator(name, indMeta.isStack, { id: paneId });
            
            if (!window.scActiveIndicators.some(x => x.name === name)) {
                window.scActiveIndicators.push({ name, isStack: indMeta.isStack, paneId, params: indMeta.defaultParams });
                window.WaveIndicatorAPI.saveState();
            }
        } catch (e) {
            if (retryCount < 3) {
                setTimeout(() => window.WaveIndicatorAPI.addInd(name, retryCount + 1), 300);
            } else {
                console.error("🔴 [Wave Alpha] Error stacking indicator:", e);
            }
        }
    },

    removeInd: (name) => {
        if (!window.tvChart) return;
        const target = window.scActiveIndicators.find(x => x.name === name);
        if (target) {
            window.tvChart.removeIndicator(target.paneId, name);
            window.scActiveIndicators = window.scActiveIndicators.filter(x => x.name !== name);
            window.WaveIndicatorAPI.saveState();
            window.WaveIndicatorAPI.renderList(); // Refresh modal
        }
    },

    openSettings: (indicatorObj, paneId) => {
        const indMeta = INDICATOR_REGISTRY.find(i => i.name === indicatorObj.name);
        if (!indMeta) return;

        const body = document.getElementById('sc-ind-settings-body');
        document.getElementById('sc-ind-settings-title').innerText = "⚙️ " + indMeta.shortName;
        body.innerHTML = '';

        let currentParams = indicatorObj.calcParams || indMeta.defaultParams;
        
        // Render inputs with Smart Labels
        currentParams.forEach((val, idx) => {
            const label = indMeta.paramLabels[idx] || `Thông số ${idx + 1}`;
            body.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: ${WA_CONFIG.COLORS.muted}; font-size: 13px; font-weight: 600;">${label}:</span>
                    <input type="number" step="any" id="wa-param-${idx}" value="${val}" style="width: 100px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 5px 10px; color: ${WA_CONFIG.COLORS.text}; font-family: var(--font-num); text-align: center; outline: none;">
                </div>
            `;
        });

        // Event: Save
        document.getElementById('sc-ind-btn-save').onclick = () => {
            let newParams = [];
            currentParams.forEach((_, idx) => {
                let el = document.getElementById(`wa-param-${idx}`);
                if (el) newParams.push(parseFloat(el.value) || 0);
            });

            window.tvChart.overrideIndicator({ name: indicatorObj.name, calcParams: newParams }, paneId);
            
            // Update memory
            let mem = window.scActiveIndicators.find(x => x.name === indicatorObj.name);
            if(mem) mem.params = newParams;
            window.WaveIndicatorAPI.saveState();
            
            document.getElementById('sc-ind-settings-modal').style.display = 'none';
        };

        // Event: Reset
        document.getElementById('sc-ind-btn-reset').onclick = () => {
            indMeta.defaultParams.forEach((val, idx) => {
                let el = document.getElementById(`wa-param-${idx}`);
                if (el) el.value = val;
            });
        };

        document.getElementById('sc-ind-settings-modal').style.display = 'flex';
    },

    saveState: () => {
        localStorage.setItem(WA_CONFIG.STORAGE_KEY, JSON.stringify(window.scActiveIndicators));
    },

    restoreState: () => {
        try {
            const saved = JSON.parse(localStorage.getItem(WA_CONFIG.STORAGE_KEY) || '[]');
            if (saved.length > 0 && window.tvChart) {
                window.scActiveIndicators = []; // Clear current, addInd will refill
                saved.forEach(ind => window.WaveIndicatorAPI.addInd(ind.name));
            }
        } catch(e){}
    },

    toggleDraw: (type) => {
        if(window.tvChart) window.tvChart.createOverlay(type);
    },

    takeScreenshot: () => {
        if(window.tvChart) {
            const url = window.tvChart.getConvertPictureUrl(true, 'jpeg', '#1e2329');
            const a = document.createElement('a');
            a.download = `WaveAlpha_Chart_${new Date().getTime()}.jpeg`;
            a.href = url;
            a.click();
        }
    },

    toggleFullscreen: () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(()=>{});
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    }
};

// ── SECTION 7: CORE OVERRIDES & INIT ────────────────────────────────────────

// Chèn lén (Intercept) sự kiện Click icon Settings/Close của thư viện
if (!window.tvChartInterceptorApplied) {
    const originalOpenChart = window.openProChart;
    window.openProChart = function(t, isTimeSwitch = false) {
        if(originalOpenChart) originalOpenChart(t, isTimeSwitch);
        
        setTimeout(() => {
            if (window.tvChart) {
                window.tvChart.subscribeAction('onTooltipIconClick', (params) => {
                    if (params.iconId === 'setting') {
                        window.WaveIndicatorAPI.openSettings(params.indicator, params.paneId);
                    } else if (params.iconId === 'close') {
                        window.WaveIndicatorAPI.removeInd(params.indicator.name);
                    }
                });
            }
            window.initExpertUI();
        }, 500);
    };
    window.tvChartInterceptorApplied = true;
}