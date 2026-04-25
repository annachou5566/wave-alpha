// ==========================================
// 🚀 FILE: chart-engine.js - LÕI XỬ LÝ DỮ LIỆU & WEBSOCKET (V5 - FINAL CSP BYPASS)
// ==========================================

window.chartWs = null;
window.liquidationWs = null;
window.futuresDataInterval = null;
window.isReconnecting = false;
window.currentChartToken = null; 

// Đổi Base URL về thẳng Render để không bị CSP chặn và không bị 404 Proxy
const RENDER_BASE_URL = "";

window.quantStats = {
    whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0,
    priceTrend: 0, trend: 0, drop: 0, spread: 0,
    ofi: 0, zScore: 0, buyDominance: 50,
    longLiq: 0, shortLiq: 0, fundingRateObj: null, hftVerdict: null
};
// 🟢 [THÊM MỚI] Khởi tạo bộ nhớ lưu vết Bookmap
window.bookmapHistory = [];
window.isHeatmapOn = true; 

// =========================================================================
// 🧠 BƯỚC 1: WAVE CHART ENGINE (BỔ SUNG BIỂU ĐỒ BẬC THANG - STEP LINE)
// =========================================================================
const DEFAULT_CHART_CONFIG = {
    chartType: 1, upColor: '#0ECB81', downColor: '#F6465D',
    showWick: true, wickIndependent: false, wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
    showBorder: true, borderIndependent: false, borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
    abnormalVolColoring: false, yAxisMode: 'normal',
    showOHLC: true, showCountdown: true, showLastPriceLine: true, showHighLowTags: true, showWatermark: true, watermarkOpacity: 0.05,
    bgType: 'solid', bgColor: '#131722', bgColor2: '#000000',
    gridVertical: true, gridHorizontal: true, gridColor: 'rgba(255,255,255,0.06)',
    sessionBreaks: false, crosshairMode: 'normal', rightMargin: 10, timezone: 'Asia/Ho_Chi_Minh',
    pacColoring: false, wickDimmer: false, volumeOverlay: false, baselineValue: 0, rangeTicks: 10, renkoSize: 10
};

const LS_CONFIG_KEY = 'wave_alpha_chart_config';

// 🚀 Danh sách các Custom Chart để tự động dọn dẹp khi chuyển đổi
const CUSTOM_CHART_IDS = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE'];

window.WaveChartEngine = {
    chartInstance: null, config: { ...DEFAULT_CHART_CONFIG }, _debounceTimer: null,

    init: function (chart) {
        this.chartInstance = chart; 
        this._registerCustomIndicators(); 
        this.loadConfig(); 
        this.applyNow();
        window.__wa_onChartReady = () => this.applyNow();
    },

    _registerCustomIndicators: function() {
        if (!window.klinecharts || !window.klinecharts.registerIndicator) return;
        try {
            // 1. CHỈ BÁO VẼ CỘT (COLUMNS - ID 4)
            window.klinecharts.registerIndicator({
                name: 'WA_COL_CHART',
                shortName: ' ', 
                series: 'price',
                calc: (dataList) => dataList,
                draw: ({ ctx, indicator, visibleRange, bounding, barSpace, xAxis, yAxis }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const bottomY = bounding.height;
                    const dataList = indicator.result; 

                    ctx.save(); 
                    const bSpace = barSpace.gapBar || barSpace.bar || 6;
                    const colWidth = Math.max(1, bSpace * 0.6);

                    for (let i = from; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.close === undefined) continue;

                        ctx.fillStyle = kd.close >= kd.open ? c.upColor : c.downColor;
                        const x = xAxis.convertToPixel(i);
                        const closeY = yAxis.convertToPixel(kd.close);
                        ctx.fillRect(x - colWidth / 2, closeY, colWidth, bottomY - closeY);
                    }
                    ctx.restore(); 
                    return true; 
                }
            });

            // 2. CHỈ BÁO VẼ ĐỈNH-ĐÁY (HIGH-LOW - ID 5)
            window.klinecharts.registerIndicator({
                name: 'WA_HL_CHART',
                shortName: ' ',
                series: 'price',
                calc: (dataList) => dataList,
                draw: ({ ctx, indicator, visibleRange, barSpace, xAxis, yAxis }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = indicator.result;

                    ctx.save(); 
                    const bSpace = barSpace.gapBar || barSpace.bar || 6;
                    const colWidth = Math.max(1, bSpace * 0.6);
                    const isTextVisible = bSpace > 30; 

                    for (let i = from; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.high === undefined || kd.low === undefined) continue;

                        ctx.fillStyle = kd.close >= kd.open ? c.upColor : c.downColor;
                        
                        const x = xAxis.convertToPixel(i);
                        const highY = yAxis.convertToPixel(kd.high);
                        const lowY = yAxis.convertToPixel(kd.low);
                        
                        const rectY = Math.min(highY, lowY);
                        const rectH = Math.max(1, Math.abs(highY - lowY));

                        ctx.fillRect(x - colWidth / 2, rectY, colWidth, rectH);

                        if (isTextVisible) {
                            ctx.font = '10px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillStyle = '#848e9c';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(kd.high.toString(), x, rectY - 3); 
                            ctx.textBaseline = 'top';
                            ctx.fillText(kd.low.toString(), x, rectY + rectH + 3); 
                        }
                    }
                    ctx.restore(); 
                    return true; 
                }
            });

            // 3. CHỈ BÁO VẼ ĐƯỜNG BẬC THANG (STEP LINE - ID 8) 🚀 [FIX NÉT LIỀN TUYỆT ĐỐI]
            window.klinecharts.registerIndicator({
                name: 'WA_STEP_LINE',
                shortName: ' ',
                series: 'price',
                calc: (dataList) => dataList,
                draw: ({ ctx, indicator, visibleRange, xAxis, yAxis }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = indicator.result;
                    
                    ctx.save();
                    // 🚀 BẮT BUỘC: Xóa mọi trạng thái nét đứt bị "dính" từ Grid/Crosshair
                    ctx.setLineDash([]); 
                    
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = c.upColor; // Line mặc định lấy màu Nến Tăng
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    
                    // 🚀 Kéo lùi lại 1 nến (from - 1) để nối liền mạch với phần bị khuất ngoài màn hình
                    const start = Math.max(0, from - 1);
                    
                    let isFirst = true;
                    for (let i = start; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.close === undefined) continue;
                        
                        const x = xAxis.convertToPixel(i);
                        const y = yAxis.convertToPixel(kd.close);
                        
                        if (isFirst) {
                            ctx.moveTo(x, y); 
                            isFirst = false;
                        } else {
                            // Lấy tọa độ Y của nến trước đó để vẽ bậc thang đi ngang
                            const prevKd = dataList[i - 1];
                            if (prevKd && prevKd.close !== undefined) {
                                const prevY = yAxis.convertToPixel(prevKd.close);
                                ctx.lineTo(x, prevY); // Kéo ngang sang phải
                                ctx.lineTo(x, y);     // Kéo dọc chốt giá
                            } else {
                                ctx.moveTo(x, y); // Đề phòng mất data thì nhấc bút vẽ lại
                            }
                        }
                    }
                    ctx.stroke();
                    ctx.restore(); 
                    return true;
                }
            });


// 4. CHỈ BÁO VẼ ĐƯỜNG + ĐIỂM (LINE + MARKERS - ID 7)
window.klinecharts.registerIndicator({
    name: 'WA_LINE_MARKER',
    shortName: ' ',
    series: 'price',
    calc: (dataList) => dataList,
    draw: ({ ctx, indicator, visibleRange, xAxis, yAxis }) => {
        const c = window.WaveChartEngine.config;
        const { from, to } = visibleRange;
        const dataList = indicator.result;
        
        ctx.save();
        ctx.setLineDash([]); 
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.upColor; // Mặc định lấy màu tăng
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        // Vẽ đường nối liền mạch
        ctx.beginPath();
        const start = Math.max(0, from - 1);
        let isFirst = true;
        for (let i = start; i < to; i++) {
            const kd = dataList[i];
            if (!kd || kd.close === undefined) continue;
            const x = xAxis.convertToPixel(i);
            const y = yAxis.convertToPixel(kd.close);
            if (isFirst) { ctx.moveTo(x, y); isFirst = false; }
            else { ctx.lineTo(x, y); }
        }
        ctx.stroke();

        // Vẽ các điểm (Markers) hình tròn rỗng
        for (let i = from; i < to; i++) {
            const kd = dataList[i];
            if (!kd || kd.close === undefined) continue;
            const x = xAxis.convertToPixel(i);
            const y = yAxis.convertToPixel(kd.close);
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = c.bgColor; // Lõi màu nền tạo hiệu ứng rỗng
            ctx.fill();
            ctx.stroke(); 
        }
        ctx.restore();
        return true;
    }
});

// 5. CHỈ BÁO VẼ VÙNG HLC (HIGH-LOW-CLOSE AREA - ID 10) 🚀 [CẬP NHẬT CHUẨN TRADINGVIEW]
window.klinecharts.registerIndicator({
    name: 'WA_HLC_AREA',
    shortName: ' ',
    series: 'price',
    calc: (dataList) => dataList,
    draw: ({ ctx, indicator, visibleRange, xAxis, yAxis }) => {
        const c = window.WaveChartEngine.config;
        const { from, to } = visibleRange;
        const dataList = indicator.result;
        
        ctx.save();
        ctx.setLineDash([]); 

        // 🚀 BƯỚC 1: TÔ MÀU VÙNG KHOẢNG CÁCH GIỮA HIGH VÀ LOW
        ctx.beginPath(); 
        ctx.fillStyle = window.WaveChartEngine._dimColor(c.upColor, 0.15); // Độ mờ 15%
        
        const start = Math.max(0, from - 1);
        
        // Nối các đỉnh High
        for (let i = start; i < to; i++) {
            const kd = dataList[i];
            if (!kd || kd.high === undefined) continue;
            const x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(kd.high);
            if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        // Vòng về nối các đáy Low
        for (let i = to - 1; i >= start; i--) {
            const kd = dataList[i];
            if (!kd || kd.low === undefined) continue;
            const x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(kd.low);
            ctx.lineTo(x, y);
        }
        ctx.closePath(); 
        ctx.fill();

        // 🚀 BƯỚC 2: VẼ 2 ĐƯỜNG BIÊN HIGH & LOW (Mỏng & mờ để làm nền)
        ctx.lineWidth = 1;
        ctx.strokeStyle = window.WaveChartEngine._dimColor(c.upColor, 0.35); // Đường biên mờ 35%
        
        // Vẽ đường High
        ctx.beginPath();
        for (let i = start; i < to; i++) {
            const kd = dataList[i]; if (!kd || kd.high === undefined) continue;
            const x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(kd.high);
            if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Vẽ đường Low
        ctx.beginPath();
        for (let i = start; i < to; i++) {
            const kd = dataList[i]; if (!kd || kd.low === undefined) continue;
            const x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(kd.low);
            if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 🚀 BƯỚC 3: VẼ ĐƯỜNG ĐÓNG CỬA (CLOSE) - DÀY VÀ SẮC NÉT NHẤT
        ctx.beginPath(); 
        ctx.strokeStyle = c.upColor; 
        ctx.lineWidth = 2; // Dày gấp đôi đường biên
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        
        let isFirst = true;
        for (let i = start; i < to; i++) {
            const kd = dataList[i];
            if (!kd || kd.close === undefined) continue;
            const x = xAxis.convertToPixel(i); 
            const y = yAxis.convertToPixel(kd.close);
            if (isFirst) { ctx.moveTo(x, y); isFirst = false; } else { ctx.lineTo(x, y); }
        }
        ctx.stroke(); 
        ctx.restore(); 
        return true;
    }
});

// 6. CHỈ BÁO VẼ ĐƯỜNG CƠ SỞ (BASELINE - ID 11) 🚀 [DÙNG KỸ THUẬT CLIPPING]
window.klinecharts.registerIndicator({
    name: 'WA_BASELINE',
    shortName: ' ',
    series: 'price',
    calc: (dataList) => dataList,
    draw: ({ ctx, indicator, visibleRange, bounding, xAxis, yAxis }) => {
        const c = window.WaveChartEngine.config;
        const { from, to } = visibleRange;
        const dataList = indicator.result;
        
        if (!dataList[from]) return true;

        // 1. Xác định mức giá Cơ sở (Lấy giá Close của cây nến đầu tiên bên trái màn hình làm mốc)
        const basePrice = dataList[from].close;
        const baseY = yAxis.convertToPixel(basePrice);

        ctx.save();
        ctx.setLineDash([]); 

        // Hàm phụ: Vẽ đường Line nối giá Close và Khép góc để tô màu Area
        const drawPath = (isArea) => {
            ctx.beginPath();
            const start = Math.max(0, from - 1);
            for (let i = start; i < to; i++) {
                const kd = dataList[i];
                if (!kd || kd.close === undefined) continue;
                const x = xAxis.convertToPixel(i), y = yAxis.convertToPixel(kd.close);
                if (i === start) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            if (isArea) {
                ctx.lineTo(xAxis.convertToPixel(to - 1), baseY);
                ctx.lineTo(xAxis.convertToPixel(start), baseY);
                ctx.closePath();
            }
        };

        // 🚀 NỬA TRÊN: Cắt cúp màn hình và vẽ MÀU TĂNG (Xanh)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, bounding.width, baseY); // Chỉ cho phép vẽ từ mép trên xuống đến đường mốc
        ctx.clip();
        
        drawPath(true); // Đổ màu vùng
        ctx.fillStyle = window.WaveChartEngine._dimColor(c.upColor, 0.2); ctx.fill();
        
        drawPath(false); // Vẽ viền đậm
        ctx.lineWidth = 2; ctx.strokeStyle = c.upColor; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();

        // 🚀 NỬA DƯỚI: Cắt cúp màn hình và vẽ MÀU GIẢM (Đỏ)
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, baseY, bounding.width, bounding.height - baseY); // Chỉ cho phép vẽ từ đường mốc xuống đáy
        ctx.clip();
        
        drawPath(true); // Đổ màu vùng
        ctx.fillStyle = window.WaveChartEngine._dimColor(c.downColor, 0.2); ctx.fill();
        
        drawPath(false); // Vẽ viền đậm
        ctx.lineWidth = 2; ctx.strokeStyle = c.downColor; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();

        // 🚀 VẼ ĐƯỜNG CƠ SỞ (Đường đứt nét tàng hình đứt đoạn ở giữa)
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.moveTo(0, baseY);
        ctx.lineTo(bounding.width, baseY);
        ctx.stroke();

        ctx.restore(); 
        return true;
    }
});


            console.log('[WaveChartEngine] Đã nạp Custom Chart V5 (Columns, High-Low, Step-Line) ✅');
        } catch(e) { console.error("Lỗi nạp Custom Indicator:", e); }
    },

    update: function (newProps, instant = false) {
        this.config = { ...this.config, ...newProps }; this.saveConfig();
        if (instant) this.applyNow();
        else { clearTimeout(this._debounceTimer); this._debounceTimer = setTimeout(() => this.applyNow(), 50); }
    },

    getConfig: function () { return this.config; },
    saveConfig: function () { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(this.config)); },
    loadConfig: function () { try { const saved = JSON.parse(localStorage.getItem(LS_CONFIG_KEY)); if (saved) this.config = { ...this.config, ...saved }; } catch (e) {} },

    applyNow: function () {
        if (!this.chartInstance) return;
        const c = this.config;

        let kcChartType = 'candle_solid'; 
        let isLine = false; 
        let hideCandle = false;

        // 🚀 DỌN RÁC: Xóa sạch các chart custom trước khi vẽ cái mới
        CUSTOM_CHART_IDS.forEach(id => this.chartInstance.removeIndicator('candle_pane', id));

        // Nến mặc định hoặc Line Native
        if (c.chartType === 2) kcChartType = 'candle_stroke';
        else if (c.chartType === 3) kcChartType = 'ohlc';     
        else if (c.chartType === 6 || c.chartType === 9) { kcChartType = 'area'; isLine = (c.chartType === 6); }

        // 🚀 CHIA ĐƯỜNG ĐẾN CUSTOM CHART
        if (c.chartType === 4) { 
            this.chartInstance.createIndicator('WA_COL_CHART', false, { id: 'candle_pane' });
            hideCandle = true;
        } 
        else if (c.chartType === 5) { 
            this.chartInstance.createIndicator('WA_HL_CHART', false, { id: 'candle_pane' });
            hideCandle = true;
        }
        else if (c.chartType === 8) { // Biểu đồ Bậc thang (ID = 8)
            this.chartInstance.createIndicator('WA_STEP_LINE', false, { id: 'candle_pane' });
            hideCandle = true;
        }
        else if (c.chartType === 7) { // 🚀 Router đến Đường + Điểm (ID 7)
            this.chartInstance.createIndicator('WA_LINE_MARKER', false, { id: 'candle_pane' });
            hideCandle = true;
        }

        else if (c.chartType === 10) { // 🚀 Router đến Vùng HLC (ID 10)
            this.chartInstance.createIndicator('WA_HLC_AREA', false, { id: 'candle_pane' });
            hideCandle = true;
        }

        else if (c.chartType === 11) { // 🚀 Router đến Đường Cơ Sở (Baseline - ID 11)
            this.chartInstance.createIndicator('WA_BASELINE', false, { id: 'candle_pane' });
            hideCandle = true;
        }

        const isHollow = (c.chartType === 2);
        
        const finalUpColor = hideCandle ? 'transparent' : c.upColor;
        const finalDownColor = hideCandle ? 'transparent' : c.downColor;
        const finalNoChange = hideCandle ? 'transparent' : '#787b86';

        const finalUpBorder = hideCandle ? 'transparent' : (c.showBorder ? (c.borderIndependent ? c.borderUpColor : c.upColor) : (isHollow ? c.upColor : 'transparent'));
        const finalDownBorder = hideCandle ? 'transparent' : (c.showBorder ? (c.borderIndependent ? c.borderDownColor : c.downColor) : (isHollow ? c.downColor : 'transparent'));
        const finalUpWick = hideCandle ? 'transparent' : (c.showWick ? (c.wickIndependent ? c.wickUpColor : c.upColor) : 'transparent');
        const finalDownWick = hideCandle ? 'transparent' : (c.showWick ? (c.wickIndependent ? c.wickDownColor : c.downColor) : 'transparent');

        const styles = {
            grid: { horizontal: { show: c.gridHorizontal, color: c.gridColor, style: 'dashed' }, vertical: { show: c.gridVertical, color: c.gridColor, style: 'dashed' } },
            candle: {
                type: kcChartType,
                tooltip: { showRule: c.showOHLC ? 'always' : 'none' },
                bar: {
                    upColor: finalUpColor, downColor: finalDownColor, noChangeColor: finalNoChange,
                    upBorderColor: finalUpBorder, downBorderColor: finalDownBorder,
                    upWickColor: finalUpWick, downWickColor: finalDownWick,
                },
                area: { 
                    lineSize: 2, lineColor: hideCandle ? 'transparent' : c.upColor, 
                    backgroundColor: (isLine || hideCandle) ? 'transparent' : [{ offset: 0, color: this._dimColor(c.upColor, 0.25) }, { offset: 1, color: 'transparent' }] 
                },
                priceMark: { show: c.showLastPriceLine, high: { show: false }, low: { show: false } }
            },
            crosshair: { show: c.crosshairMode !== 'hidden' }, indicator: { lastValueMark: { show: true } }
        };

        try {
            this.chartInstance.setStyles(styles); this.chartInstance.setOffsetRightDistance(c.rightMargin);
            this.chartInstance.setPaneOptions({ id: 'candle_pane', axisOptions: { type: c.yAxisMode } });
        } catch(e) {}

        const container = document.getElementById('sc-chart-container');
        if (container) container.style.background = c.bgType === 'solid' ? c.bgColor : `linear-gradient(to bottom, ${c.bgColor} 0%, ${c.bgColor2} 100%)`; 
        
        window.dispatchEvent(new CustomEvent('wa_chart_config_updated', { detail: c }));
    },

    _dimColor: function(hex, opacity) {
        if (!hex) return 'transparent'; if (hex.startsWith('rgba')) return hex;
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) { r = parseInt(hex[1]+hex[1], 16); g = parseInt(hex[2]+hex[2], 16); b = parseInt(hex[3]+hex[3], 16); } 
        else if (hex.length === 7) { r = parseInt(hex.substring(1,3), 16); g = parseInt(hex.substring(3,5), 16); b = parseInt(hex.substring(5,7), 16); }
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
};


// ==========================================
// 🌊 ĐỘNG CƠ WATERFALL (NỘI SUY TUYẾN TÍNH HFT KLINECHART)
// ==========================================
window._waTargetCandle = null;
window._waCurrentCandle = null;
window._waRafRunning = false;

// ==========================================
// 🚀 TRẠM ĐÁNH CHẶN REALTIME (HOOK) CHO DATA ENGINE
// ==========================================
window.safeUpdateChartData = function(candleObj) {
    if (!window.tvChart) return;
    let finalCandle = candleObj;
    if (window.WaveDataEngine) {
        let dataList = window.tvChart.getDataList();
        finalCandle = window.WaveDataEngine.processTick(candleObj, dataList);
    }
    window.tvChart.updateData(finalCandle);
};

window.startWaterfallEngine = function() {
    if (window._waRafRunning || !window.tvChart) return;
    window._waRafRunning = true;
    let lastDraw = 0;

    function renderLoop(time) {
        // 💡 VÁ LỖI: Trả lại trạng thái false để lần sau mở Chart động cơ còn biết đường chạy lại
        if (!window.tvChart || !window._waTargetCandle) {
            window._waRafRunning = false; 
            return; 
        }
        
        requestAnimationFrame(renderLoop);
        
        // 💡 BẢO VỆ GPU: Nếu tab đang bị ẩn/thu nhỏ, tạm ngưng vẽ nến để tiết kiệm 100% tài nguyên Card Màn Hình
        if (document.hidden) return;
        
        // 🛡️ BẢO VỆ CPU: Khóa render ở mức 30 FPS (khoảng 30-33ms). 
        if (time - lastDraw < 30) return;

        let t = window._waTargetCandle;
        let c = window._waCurrentCandle;

        if (!c || c.timestamp !== t.timestamp) {
            window._waCurrentCandle = { ...t };
            window.safeUpdateChartData(window._waCurrentCandle);
            lastDraw = time;
            return;
        }

        let diff = t.close - c.close;
        
        if (diff !== 0) {
            c.close += diff * 0.35; // Trượt 35% quãng đường (Tạo cảm giác Waterfall)
            
            c.high = Math.max(c.high, t.high, c.close);
            c.low = Math.min(c.low, t.low, c.close);
            c.volume = t.volume;

            if (Math.abs(t.close - c.close) < (t.close * 0.000001)) {
                c.close = t.close;
            }

            window.safeUpdateChartData(c);
            lastDraw = time;
        }
    }
    requestAnimationFrame(renderLoop);
};

// 🧠 BỘ NÃO DYNAMIC: LẤY MASTER LIST TỪ RENDER (LÁCH LUẬT CSP TRÌNH DUYỆT)
window._binanceTokenListCache = null;
window.getSmartTokenContext = async function(t) {
    let alphaId = (t.alphaId || t.id || '').toUpperCase();
    let contract = t.contractAddress || t.contract || '';
    let chainId = t.chainId || t.chain_id;

    if (!chainId || !contract) {
        if (!window._binanceTokenListCache) {
            try {
                // 👉 GỌI VỀ RENDER ĐỂ BYPASS CSP CỦA BINANCE
                let res = await fetch("/api/token-list");
                let json = await res.json();
                if (json.success) window._binanceTokenListCache = json.data;
            } catch(e) {}
        }
        if (window._binanceTokenListCache) {
            let found = window._binanceTokenListCache.find(x => 
                (x.alphaId && x.alphaId.toUpperCase() === alphaId) || 
                (x.symbol && t.symbol && x.symbol.toUpperCase() === t.symbol.toUpperCase())
            );
            if (found) {
                if (!contract) contract = found.contractAddress;
                if (!chainId) chainId = found.chainId;
            }
        }
    }

    t.contractAddress = contract;
    t.chainId = chainId;

    let finalChainId = String(chainId || "56"); 
    let cleanAddr = String(contract || '');
    
    // Thuật toán Case-sensitive bảo vệ TRON/SOLANA (Python Match)
    const no_lower_chains = ["CT_501", "CT_784", "501", "784", "CT_195", "195"];
    if (!no_lower_chains.includes(finalChainId)) {
        cleanAddr = cleanAddr.toLowerCase(); 
    }

    return { contract: cleanAddr, chainId: finalChainId };
};

// chart-engine.js — đầu hàm connectRealtimeChart
window.connectRealtimeChart = async function(t, isTimeSwitch = false) {
    // ✅ THÊM: Luôn dừng sạch waterfall trước
    window._waRafRunning = false;
    window._waTargetCandle = null;
    window._waCurrentCandle = null;
    
    let rawId = (t.alphaId || t.id || '').toLowerCase().replace('alpha_', ''); 
    let sysSymbol = (t.symbol || '').toLowerCase() + 'usdt';
    let streamPrefix = rawId ? `alpha_${rawId}usdt` : sysSymbol;

    let smartCtx = await window.getSmartTokenContext(t);
    let contract = smartCtx.contract;
    let chainId = smartCtx.chainId;

    if (isTimeSwitch && window.chartWs && window.chartWs.readyState === 1) { 
        if (window.oldChartInterval && window.oldChartInterval !== 'tick') {
            let oldK = contract ? `came@${contract}@${chainId}@kline_${window.oldChartInterval}` : `${streamPrefix}@kline_${window.oldChartInterval}`;
            window.chartWs.send(JSON.stringify({ "method": "UNSUBSCRIBE", "params": [oldK], "id": Date.now() }));
        }
        if (window.currentChartInterval !== 'tick') {
            let newK = contract ? `came@${contract}@${chainId}@kline_${window.currentChartInterval}` : `${streamPrefix}@kline_${window.currentChartInterval}`;
            window.chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": [newK], "id": Date.now() + 1 }));
        }
        return; 
    }

    if (window.chartWs) window.chartWs.close();

    // 💡 VÁ LỖI: Terminate worker cũ nếu đây là mở chart mới (đổi coin) để tránh Zombie Worker
    if (!isTimeSwitch) {
        if (window.quantWorker) {
            window.quantWorker.terminate();
            window.quantWorker = null;
        }
        window.quantWorker = new Worker('public/js/quant-worker.js');
        window.quantWorker.onmessage = function(e) {
            if (e.data.cmd === 'STATS_UPDATE') {
                Object.assign(window.quantStats, e.data.stats);
            }
        };
    }
    
    // Nếu là đổi khung giờ (isTimeSwitch) hoặc vừa tạo xong, thì reset data
    if (window.quantWorker) {
        window.quantWorker.postMessage({ cmd: 'INIT' });
    }
    window.activeChartSessionId = Date.now() + '_' + t.symbol;
    let currentSession = window.activeChartSessionId;

    if (!window.AlphaChartState) window.AlphaChartState = {};
    let sym = t.symbol || 'UNKNOWN';

    if (!window.AlphaChartState[sym]) {
        window.AlphaChartState[sym] = {
            speedWindow: [], netFlow: 0, whaleCount: 0, totalVol: 0, tradeCount: 0,
            tickHistory: [], chartMarkers: [], lastPrice: parseFloat(t.price) || 0, lastTradeDir: undefined,
            cWhale: 0, cShark: 0, cDolphin: 0, cSweep: 0
        };
    }

    let cache = window.AlphaChartState[sym];
    window.scSpeedWindow = cache.speedWindow; window.scNetFlow = cache.netFlow; 
    window.scWhaleCount = cache.whaleCount; window.scTotalVol = cache.totalVol; 
    window.scTradeCount = cache.tradeCount; window.scLastPrice = cache.lastPrice; 
    window.scLastTradeDir = cache.lastTradeDir; window.scTickHistory = cache.tickHistory; 
    window.scChartMarkers = cache.chartMarkers;
    window.scCWhale = cache.cWhale || 0; window.scCShark = cache.cShark || 0;
    window.scCDolphin = cache.cDolphin || 0; window.scCSweep = cache.cSweep || 0;
    window.quantStats = cache.quantStats || { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };
    window.scCurrentCluster = null;
    window.scActivePriceLines = []; 
// 🚀 BƯỚC 1: LẤY SNAPSHOT FULL DEPTH TỪ RENDER TRƯỚC KHI MỞ WEBSOCKET
let targetSymbol = rawId ? `ALPHA_${rawId.toUpperCase()}USDT` : sysSymbol.toUpperCase();
    
// LOG 1: Báo hiệu bắt đầu gọi
console.log(`🌊 [DEPTH SNAPSHOT] Đang lấy sổ lệnh 50 nấc cho ${targetSymbol}...`);

fetch(`${RENDER_BASE_URL}/api/full-depth?symbol=${targetSymbol}&limit=50`)
    .then(res => res.json())
    .then(json => {
        if (window.activeChartSessionId !== currentSession) return; 

        if (json.success && json.data) {
            // LOG 2: Báo hiệu lấy data thành công
            console.log(`✅ [DEPTH SNAPSHOT] Lấy thành công! Bids: ${json.data.bids.length} | Asks: ${json.data.asks.length}`);
            
            let currentSym = json.data.symbol || targetSymbol;
            
            if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                window.scLocalOrderBook = { sym: currentSym, asks: new Map(), bids: new Map() };
            }
            
            (json.data.bids || []).forEach(item => {
                let p = item[0], q = parseFloat(item[1]);
                if (q > 0) window.scLocalOrderBook.bids.set(p, q);
            });
            
            (json.data.asks || []).forEach(item => {
                let p = item[0], q = parseFloat(item[1]);
                if (q > 0) window.scLocalOrderBook.asks.set(p, q);
            });

            // ÉP BUỘC BẬT HEATMAP ĐỂ TEST 
            window.isHeatmapOn = true;
            
        } else {
            console.error(`❌ [DEPTH SNAPSHOT] Render trả về lỗi:`, json);
        }
    }).catch(e => {
        console.error("🔥 [DEPTH SNAPSHOT] Lỗi mạng hoặc Render chưa được Deploy:", e);
    });

// 🚀 BƯỚC 2: MỞ WEBSOCKET ĐỂ HỨNG DELTA...
try { window.chartWs = new WebSocket('wss://nbstream.binance.com/w3w/wsa/stream'); } catch(e) { return; }

    let params = [];
    if (contract) {
        let targetInterval = window.currentChartInterval === 'tick' ? '1s' : window.currentChartInterval;
        
        // 💡 VÁ LỖI: Chỉ subscribe luồng dữ liệu của khung giờ hiện tại
        params.push(`came@${contract}@${chainId}@kline_${targetInterval}`);
        
        // Nếu UI của bạn có tính năng Candle Volume Widget buộc phải dùng khung 1m, thì mới mở dòng dưới đây:
        if (targetInterval !== '1m') {
            params.push(`came@${contract}@${chainId}@kline_1m`); 
        }
    }

    params.push('came@allTokens@ticker24');

    if (rawId) {
        // Quét cả USDT và USDC cho hàng DEX
        const possibleQuotes = ['usdt', 'usdc'];
        possibleQuotes.forEach(quote => {
            let dexStream = `alpha_${rawId}${quote}`;
            params.push(`${dexStream}@aggTrade`, `${dexStream}@bookTicker`, `${dexStream}@fulldepth@500ms`);
            if (!contract) {
                params.push(`${dexStream}@kline_1m`, `${dexStream}@kline_5m`, `${dexStream}@kline_15m`, `${dexStream}@kline_1h`);
                let targetInterval = window.currentChartInterval === 'tick' ? '1s' : window.currentChartInterval;
                let tk = `${dexStream}@kline_${targetInterval}`;
                if (!params.includes(tk)) params.push(tk);
            }
        });
    } else {
        // Hàng CEX bình thường
        params.push(`${streamPrefix}@aggTrade`, `${streamPrefix}@bookTicker`, `${streamPrefix}@fulldepth@500ms`);
        if (!contract) {
            params.push(`${streamPrefix}@kline_1m`, `${streamPrefix}@kline_5m`, `${streamPrefix}@kline_15m`, `${streamPrefix}@kline_1h`);
            if (window.currentChartInterval !== 'tick') {
                let tk = `${streamPrefix}@kline_${window.currentChartInterval}`;
                if (!params.includes(tk)) params.push(tk);
            }
        }
    }

    window._lastMarkerCount = 0; // 💡 Khởi tạo biến đếm marker

    if (window.scCalcInterval) clearInterval(window.scCalcInterval);
    window.scCalcInterval = setInterval(() => {
        if (document.hidden) return; // 💡 VÁ LỖI: Đóng băng tính toán nếu tab bị ẩn
        if (window.activeChartSessionId !== currentSession) return;
        if (!window.scTickHistory || window.scTickHistory.length === 0) return;
        
        // (Trong file chart-engine.js, hàm setInterval 1000ms)
        const now = Date.now();
        if (!window.bookmapHistory) window.bookmapHistory = [];
        if (window.scLocalOrderBook) {
            window.bookmapHistory.push({
                t: now,
                asks: new Map(window.scLocalOrderBook.asks),
                bids: new Map(window.scLocalOrderBook.bids)
            });
            if (window.bookmapHistory.length > 600) window.bookmapHistory.shift();
        }
        window.scTickHistory = window.scTickHistory.filter(x => now - x.t <= 300000);
        if (window.scTickHistory.length > 3000) window.scTickHistory = window.scTickHistory.slice(-3000);

        // Xóa bỏ tàn tích activeSeries của TradingView, thay bằng window.tvChart của KLineChart
        if (window.tvChart && window.quantStats.flags && window.scTickHistory.length > 0) {
            let flags = window.quantStats.flags;
            let timeSec = Math.floor(Date.now() / 1000);
            let lastMarker = window.scChartMarkers[window.scChartMarkers.length - 1];
            let canDraw = !lastMarker || (timeSec - lastMarker.time > 5);

            if (canDraw) {
                if (flags.stopHunt) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#00F0FF', shape: 'arrowUp', text: '🪝 STOP-HUNT', fishType: 'bot' }); }
                else if (flags.exhausted) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: flags.wallHit ? '#F0B90B' : '#848e9c', shape: 'arrowUp', text: flags.wallHit ? '🛡️ WALL HIT' : '🪫 EXHAUSTED', fishType: 'bot' }); }
                else if (flags.bullishIceberg || flags.icebergAbsorption) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#0ECB81', shape: 'arrowUp', text: '🧊 ĐỠ', fishType: 'bot' }); }
                else if (flags.bearishIceberg) { window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F6465D', shape: 'arrowDown', text: '🧊 ĐÈ', fishType: 'bot' }); }
                else if (flags.spoofingBuyWall) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#F0B90B', shape: 'arrowUp', text: '⚠️ TƯỜNG MUA ẢO', fishType: 'bot' }); }
                else if (flags.spoofingSellWall) { window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F0B90B', shape: 'arrowDown', text: '⚠️ TƯỜNG BÁN ẢO', fishType: 'bot' }); }
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
        }

        let algoEl = document.getElementById('sc-algo-limit');
        if (algoEl && window.quantStats.algoLimit !== undefined) {
            let algoLmt = window.quantStats.algoLimit;
            let limitText = `< $${window.formatCompactUSD(algoLmt)}`;
            let limitColor = '#0ECB81'; let bgColor = 'rgba(14,203,129,0.1)'; let bdColor = 'rgba(14,203,129,0.3)';
            if (algoLmt < 10 || algoLmt < 50) { 
                limitColor = '#F6465D'; limitText = algoLmt < 10 ? '💀 DEAD' : limitText; bgColor = 'rgba(246,70,93,0.1)'; bdColor = 'rgba(246,70,93,0.3)';
            } else if (algoLmt <= 200) { 
                limitColor = '#F0B90B'; bgColor = 'rgba(240,185,11,0.1)'; bdColor = 'rgba(240,185,11,0.3)';
            }
            algoEl.innerHTML = `ALGO LIMIT: ${limitText}`;
            algoEl.style.color = limitColor; algoEl.style.background = bgColor; algoEl.style.borderColor = bdColor;
        }


        
        

        let sym = window.currentChartToken ? window.currentChartToken.symbol : 'UNKNOWN';
        if (window.AlphaChartState && window.AlphaChartState[sym]) {
            Object.assign(window.AlphaChartState[sym], {
                netFlow: window.scNetFlow, whaleCount: window.scWhaleCount, totalVol: window.scTotalVol,
                tradeCount: window.scTradeCount, lastPrice: window.scLastPrice, lastTradeDir: window.scLastTradeDir,
                speedWindow: window.scSpeedWindow, tickHistory: window.scTickHistory, chartMarkers: window.scChartMarkers,
                cWhale: window.scCWhale, cShark: window.scCShark, cDolphin: window.scCDolphin, cSweep: window.scCSweep, quantStats: window.quantStats
            });
        }

        window.scSpeedWindow = window.scSpeedWindow.filter(x => now - x.t <= 5000);

        // 💡 VÁ LỖI: Chỉ chạy vòng lặp Fish Filter NẾU THỰC SỰ có marker mới được thêm vào
        if (typeof window.applyFishFilter === 'function') {
            let currentMarkerCount = (window.scChartMarkers || []).length;
            if (currentMarkerCount !== window._lastMarkerCount) {
                window.applyFishFilter();
                window._lastMarkerCount = currentMarkerCount;
            }
        }
        if (typeof window.updateCommandCenterUI === 'function') window.updateCommandCenterUI();
        
    }, 1000);

    if (window.scTapeInterval) clearInterval(window.scTapeInterval);
    window.scTapeInterval = setInterval(() => {
        if (!window.scCurrentCluster) return;
        const nowMs = Date.now();
        if (nowMs - window.scCurrentCluster.startT >= 150) {
            window.flushSmartTape(window.scCurrentCluster);
            window.scCurrentCluster = null;
        }
    }, 150);

    window.chartWsReconnectDelay = window.chartWsReconnectDelay || 1000;
    window.chartWs.onopen = () => {
        window.chartWsReconnectDelay = 1000; 
        window.chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": params, "id": 1 }));
    };

    window.chartWs.onmessage = (event) => {
        if (window.activeChartSessionId !== currentSession) return;
        const data = JSON.parse(event.data);
        if (!data.stream) return;

        // --- 💡 BẮT ĐẦU: TỰ ĐỘNG CẬP NHẬT ĐÚNG CẶP USDT/USDC ---
        if (window.currentChartToken) {
            let actualStream = data.stream.toUpperCase();
            
            // Binance trả về luồng nào (USDC/USDT), ta lấy luồng đó
            if (actualStream.includes("USDC@") || actualStream.includes("USDT@")) {
                let quote = actualStream.includes("USDC@") ? "USDC" : "USDT";
                let symbolEl = document.getElementById('sc-coin-symbol');
                let realPairName = `${window.currentChartToken.symbol.toUpperCase()}/${quote}`;
                
                // Nếu tên trên web đang bị sai, lập tức sửa lại cho đúng
                if (symbolEl && symbolEl.innerText !== realPairName) {
                    symbolEl.innerText = realPairName;
                    symbolEl.style.color = "#0ECB81"; // Đổi màu xanh nhẹ báo hiệu đã nhận chuẩn cặp
                    setTimeout(() => symbolEl.style.color = "", 1000); 
                }
            }
        }
        // --- KẾT THÚC ĐOẠN TỰ ĐỘNG ĐỔI TÊN ---

        if (data.stream.endsWith('@bookTicker')) {
            if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'BOOK_TICKER', data: data.data });
        }

        if (data.e === 'kline' || data.stream.includes('kline_')) {
            let k = data.data.k || data.data; 
            if (!k) return; 
            
            let streamParts = data.stream.split('kline_');
            let klineInterval = k.i || streamParts[streamParts.length - 1];
            let currentClose = parseFloat(k.c);
            let currentVol = parseFloat(k.q !== undefined ? k.q : (k.v || 0));

            window.scLastPrice = currentClose;
            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl && typeof window.formatPrice === 'function') {
                        let isUp = currentClose >= parseFloat(k.o);
                        priceEl.innerText = '$' + window.formatPrice(currentClose);
                        priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
                    }
                    window.isRenderingPrice = false;
                });
            }

            if (['1m', '5m', '15m', '1h'].includes(klineInterval)) {
                let totalQuote = parseFloat(k.q !== undefined ? k.q : (k.v || 0)); 
                if (isNaN(totalQuote)) totalQuote = 0; 
                let isUpCandle = currentClose >= parseFloat(k.o);
                let nfEl = document.getElementById(`cc-cex-nf-${klineInterval}`);
                if (nfEl && typeof window.formatCompactUSD === 'function') {
                    let color = isUpCandle ? 'var(--term-up)' : 'var(--term-down)';
                    let icon = isUpCandle ? '▲' : '▼';
                    nfEl.innerHTML = `<span style="color:${color}">${icon} $${window.formatCompactUSD(totalQuote)}</span>`;
                }
            }

            // --- BẮT ĐẦU ĐOẠN FAKE TICK CHO DEX ---
            let isTickFallback = (window.currentChartInterval === 'tick' && klineInterval === '1s');
            
            if (klineInterval !== window.currentChartInterval && !isTickFallback) return; 

            if (isTickFallback) {
                let nowT = Date.now();
                if (nowT - (window.lastChartRender || 0) > 150) {
                    window.lastChartRender = nowT;
                    let timeSec = Math.floor(nowT / 1000);
                    
                    if (window.tvChart && typeof window.tvChart.updateData === 'function') {
                        window.tvChart.updateData({
                            timestamp: timeSec * 1000,
                            open: currentClose, high: currentClose, low: currentClose, close: currentClose,
                            volume: currentVol
                        });
                    }
                }
                return; 
            }
            
            if (window.currentChartInterval === 'tick') return; 
            // --- KẾT THÚC ĐOẠN FAKE TICK ---

            let rawTime = k.t || k.ot;
            if (rawTime) {
                let candleTime = Math.floor(rawTime / 1000);
                let isUpCandle = currentClose >= parseFloat(k.o);
                let isTrad = window.currentTheme === 'trad';
                let volColor = isUpCandle ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)');

                // Cập nhật nến cho khung 1m trở lên
                // Cập nhật nến cho khung 1m trở lên bằng WATERFALL
                if (window.tvChart && typeof window.tvChart.updateData === 'function' && window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s') {
                    
                    let rawTk = parseInt(k.t || k.ot);
                    let correctTk = rawTk < 100000000000 ? rawTk * 1000 : rawTk;

                    let dataList = window.tvChart.getDataList();
                    let lastCandle = (dataList && dataList.length > 0) ? dataList[dataList.length - 1] : null;

                    if (lastCandle && lastCandle.timestamp === correctTk && k.x !== true) {
                        // Nếu nến đang chạy, chỉ chốt Volume, giữ nguyên giá Realtime đang trượt
                        if (window._waTargetCandle) {
                            window._waTargetCandle.volume = isNaN(currentVol) ? 0 : currentVol; 
                        }
                    } else {
                        // Khi sang nến mới hoặc chốt sổ: Đẩy thẳng vào KLineChart và Reset Target
                        window._waTargetCandle = {
                            timestamp: correctTk, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentClose, volume: isNaN(currentVol) ? 0 : currentVol
                        };
                        window.safeUpdateChartData(window._waTargetCandle); // 🚀 Dùng hàm đánh chặn an toàn
                    }
                }
            }
        }
        
        if (data.stream && data.stream.includes('@fulldepth') && data.data) {
            let currentSym = data.data.s || 'UNKNOWN';
            if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                window.scLocalOrderBook = { sym: currentSym, asks: new Map(), bids: new Map() };
            }
            (data.data.a || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.asks.delete(p); else window.scLocalOrderBook.asks.set(p, q); 
            });
            (data.data.b || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.bids.delete(p); else window.scLocalOrderBook.bids.set(p, q); 
            });
        }
        
        if (data.stream.endsWith('@aggTrade') || data.stream.endsWith('@trade')) {
            let p = parseFloat(data.data.p), q = parseFloat(data.data.q);
            let isUp = p > window.scLastPrice ? true : (p < window.scLastPrice ? false : (window.scLastTradeDir ?? true));
            
            window.scLastTradeDir = isUp; window.scLastPrice = p;
            let valUSD = p * q, timeSec = Math.floor(data.data.T / 1000);
            let nowT = Date.now();

            window.scTickHistory.push({ t: nowT, p: p, q: q, v: valUSD, dir: isUp });
            if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'TICK', data: { t: nowT, p: p, q: q, v: valUSD, dir: isUp } });

            if (window.currentChartInterval === '1s') {
                if (!window.liveCandle1s || window.liveCandle1s.time !== timeSec) {
                    window.liveCandle1s = { time: timeSec, open: p, high: p, low: p, close: p, vol: valUSD };
                } else {
                    window.liveCandle1s.high = Math.max(window.liveCandle1s.high, p);
                    window.liveCandle1s.low = Math.min(window.liveCandle1s.low, p);
                    window.liveCandle1s.close = p;
                    window.liveCandle1s.vol += valUSD;
                }
            }

            // 🌊 ĐẨY DATA VÀO ĐỘNG CƠ WATERFALL THAY VÌ ÉP CHART VẼ TRỰC TIẾP
            if (window.currentChartInterval === 'tick') {
                window._waTargetCandle = { timestamp: timeSec * 1000, open: parseFloat(p), high: parseFloat(p), low: parseFloat(p), close: parseFloat(p), volume: parseFloat(valUSD || 0) };
            } else if (window.currentChartInterval === '1s' && window.liveCandle1s) {
                window._waTargetCandle = { timestamp: timeSec * 1000, open: window.liveCandle1s.open, high: window.liveCandle1s.high, low: window.liveCandle1s.low, close: window.liveCandle1s.close, volume: window.liveCandle1s.vol };
            } else {
                let dataList = window.tvChart ? window.tvChart.getDataList() : [];
                if (dataList && dataList.length > 0) {
                    let lastCandle = dataList[dataList.length - 1];
                    if (!window._waTargetCandle || window._waTargetCandle.timestamp !== lastCandle.timestamp) {
                        window._waTargetCandle = { ...lastCandle };
                    }
                    window._waTargetCandle.high = Math.max(window._waTargetCandle.high, p);
                    window._waTargetCandle.low = Math.min(window._waTargetCandle.low, p);
                    window._waTargetCandle.close = p; // Chỉ gán mục tiêu, không vẽ ngay lập tức
                }
            }
            
            // Kích hoạt động cơ chạy ngầm (Nó sẽ tự động trượt nến cực mượt)
            if (typeof window.startWaterfallEngine === 'function') window.startWaterfallEngine();

            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl && typeof window.formatPrice === 'function') {
                        priceEl.innerText = '$' + window.formatPrice(p);
                        priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
                    }
                    window.isRenderingPrice = false;
                });
            }

            if (!window.scCurrentCluster) {
                window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
            } else {
                if (window.scCurrentCluster.dir === isUp && (nowT - window.scCurrentCluster.startT < 1000)) {
                    window.scCurrentCluster.vol += valUSD; window.scCurrentCluster.count += 1; window.scCurrentCluster.p = p; 
                } else {
                    if (typeof window.flushSmartTape === 'function') window.flushSmartTape(window.scCurrentCluster);
                    window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
                }
            }

            window.scTradeCount++; window.scTotalVol += valUSD; window.scNetFlow += isUp ? valUSD : -valUSD;
            if (window.scSpeedWindow.length > 500) window.scSpeedWindow.shift(); 
            window.scSpeedWindow.push({ t: nowT, v: valUSD });
        }
    };
            
    window.chartWs.onclose = () => { 
        let overlay = document.getElementById('super-chart-overlay');
        if (overlay && overlay.classList.contains('active')) { 
            const jitter = Math.random() * 1000;
            setTimeout(() => window.connectRealtimeChart(window.currentChartToken), window.chartWsReconnectDelay + jitter);
            window.chartWsReconnectDelay = Math.min(window.chartWsReconnectDelay * 2, 30000);
        } 
    };
};

window.fetchBinanceHistory = async function(t, interval, isArea = false) {
    try {
        let limit = isArea ? 100 : 300; 
        let smartCtx = await window.getSmartTokenContext(t);
        let contract = smartCtx.contract;
        let chainId = smartCtx.chainId;
        if (!contract) return []; 
        
        let apiInterval = interval === 'tick' ? '1s' : interval;
        let apiUrl = `/api/klines?contract=${contract}&chainId=${chainId}&interval=${apiInterval}&limit=${limit}`;
        
        const res = await fetch(apiUrl);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || data.length === 0) return [];

        return data.map(d => {
            // 🛑 FIX LỖI 1970 TẠI ĐÂY: Nếu là giây (10 số) thì nhân 1000 thành mili-giây
            let rawTs = parseInt(d.time || d.t || d[0]);
            let correctTs = rawTs < 100000000000 ? rawTs * 1000 : rawTs;

            return {
                timestamp: correctTs, 
                open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close),
                volume: parseFloat(d.volume)
            };
        });
    } catch (e) { return []; }
};

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('/api/smart-money')) {
        if (window.currentChartToken) {
            let smartCtx = await window.getSmartTokenContext(window.currentChartToken);
            // CẬP NHẬT RENDER URL ĐỂ VƯỢT CSP
            args[0] = `/api/smart-money?contractAddress=${smartCtx.contract}&chainId=${smartCtx.chainId}`;
        }
    }
    return originalFetch.apply(this, args);
};

window.startFuturesEngine = async function(symbol) {
    window.stopFuturesEngine();
    if (!symbol) return;
    window.activeFuturesSession = symbol.toUpperCase();
    let currentSession = window.activeFuturesSession;
    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    let fSymbol = cleanSymbol + 'USDT';
    let streamSymbol = fSymbol.toLowerCase();

    if (!window.quantStats) window.quantStats = {};
    window.quantStats.longLiq = 0; window.quantStats.shortLiq = 0; 
    window.quantStats.fundingRateObj = null; window.quantStats.fundingInterval = null;

    // =========================================================
    // 1. KẾT NỐI WEBSOCKET THANH LÝ NGAY LẬP TỨC (REALTIME)
    // =========================================================
    let liqReconnectDelay = 1000; const MAX_LIQ_DELAY = 30000; 

    const connectForceOrderWS = () => {
        if (window.activeFuturesSession !== currentSession) return;
        window.liquidationWs = new WebSocket(`wss://fstream.binance.com/ws/${streamSymbol}@forceOrder`);
        window.liquidationWs.onopen = () => { liqReconnectDelay = 1000; };
        
        window.liquidationWs.onmessage = (event) => {
            if (window.activeFuturesSession !== currentSession) return;
            const data = JSON.parse(event.data);
            if (data.e === 'forceOrder' && data.o) {
                let order = data.o; 
                let valUSD = parseFloat(order.p) * parseFloat(order.q); 
                let isLongLiq = (order.S === 'SELL'); // SELL = Long bị cháy
                
                // 🛑 CHẶN LỖI LẶP LỆNH NGAY TỪ CỬA NGÕ WEBSOCKET
                let liqSig = `${order.S}_${order.p}_${order.q}`;
                let nowMs = Date.now();
                if (!window.lastRootLiqEvent) window.lastRootLiqEvent = { sig: '', time: 0 };
                if (window.lastRootLiqEvent.sig === liqSig && (nowMs - window.lastRootLiqEvent.time < 2000)) {
                    return; // Bị trùng -> Chặn đứng luôn, không cho vẽ chart hay cộng tiền
                }
                window.lastRootLiqEvent = { sig: liqSig, time: nowMs };

                if (isLongLiq) { window.quantStats.longLiq += valUSD; } else { window.quantStats.shortLiq += valUSD; }
                if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'LIQ_EVENT', data: { v: valUSD, dir: order.S, p: parseFloat(order.p) } });
                
                if (typeof window.logToSniperTape === 'function') {
                    window.logToSniperTape(!isLongLiq, valUSD, isLongLiq ? '🩸 CHÁY LONG' : '🔥 CHÁY SHORT', parseFloat(order.p));
                }

                // TÍCH HỢP MỚI: BẮN MARKER THANH LÝ LÊN CHART TRADINGVIEW
                if (window.scChartMarkers) {
                    let markerTime = Math.floor(Date.now() / 1000);
                    
                    let shortVol = valUSD >= 1e9 ? (valUSD/1e9).toFixed(1) + 'B' : (valUSD >= 1e6 ? (valUSD/1e6).toFixed(1) + 'M' : (valUSD >= 1e3 ? (valUSD/1e3).toFixed(1) + 'K' : valUSD.toFixed(0)));
                    
                    let textMsg = (isLongLiq ? '🩸 L $' : '💥 S $') + shortVol;
                    
                    window.scChartMarkers.push({
                        time: markerTime,
                        position: isLongLiq ? 'belowBar' : 'aboveBar',
                        color: isLongLiq ? '#FF007F' : '#00F0FF',
                        shape: isLongLiq ? 'arrowUp' : 'arrowDown',
                        text: textMsg,
                        fishType: 'liq' 
                    });
                    
                    if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                    if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
                }
            }
        };
        
        window.liquidationWs.onclose = () => { 
            if (window.activeFuturesSession === currentSession) {
                const jitter = Math.random() * 1000; 
                setTimeout(() => connectForceOrderWS(), liqReconnectDelay + jitter);
                liqReconnectDelay = Math.min(liqReconnectDelay * 2, MAX_LIQ_DELAY); 
            } 
        };
    };
    
    connectForceOrderWS();

    // =========================================================
    // 2. CHẠY API LẤY DỮ LIỆU TĨNH (VỐN MỒI + FUNDING/OI)
    // =========================================================
    const fetchWithTimeout = async (url) => {
        const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 4000);
        try { const response = await fetch(url, { signal: controller.signal }); clearTimeout(id); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); } catch (err) { clearTimeout(id); throw err; }
    };

    const fetchRestData = async () => {
        if (window.activeFuturesSession !== currentSession) return false;
        try {
            // Đã xóa bỏ phần gọi API allForceOrders vì Binance đã khai tử tính năng này từ 2021.
            // Số liệu thanh lý giờ đây sẽ chỉ được đếm Realtime thông qua Websocket.

            if (!window.quantStats.fundingInterval) {
                try { 
                    let fInfo = await fetchWithTimeout(`${RENDER_BASE_URL}/api/binance-fapi?endpoint=/fapi/v1/fundingInfo`); 
                    let sInfo = fInfo.find(x => x.symbol === fSymbol); 
                    window.quantStats.fundingInterval = sInfo ? sInfo.fundingIntervalHours : 8; 
                } catch(e) { window.quantStats.fundingInterval = 8; }
            }
            
            let fundData = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${fSymbol}`);
            if (window.activeFuturesSession !== currentSession) return false;
            if (fundData && fundData.lastFundingRate) {
                window.quantStats.fundingRateObj = { rate: parseFloat(fundData.lastFundingRate) * 100, nextTime: fundData.nextFundingTime, interval: window.quantStats.fundingInterval };
            }
            
            try {
                let oiData = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${fSymbol}`);
                if (window.activeFuturesSession === currentSession && oiData && oiData.openInterest) {
                    window.quantStats.openInterest = parseFloat(oiData.openInterest);
                }
            } catch(e) {}

            return true;
        } catch (err) { return false; }
    };

    // Gọi lần đầu để lấy Funding/OI, sau đó lặp lại ngầm mỗi 15s
    fetchRestData().then(hasFutures => {
        if (hasFutures && window.activeFuturesSession === currentSession) {
            window.futuresDataInterval = setInterval(() => { if (window.activeFuturesSession === currentSession) fetchRestData(); }, 120000);
        }
    });
};

window.stopFuturesEngine = function() {
    window.activeFuturesSession = null;
    if (window.futuresDataInterval) { clearInterval(window.futuresDataInterval); window.futuresDataInterval = null; }
    if (window.liquidationWs) { window.liquidationWs.close(); window.liquidationWs = null; }
};

window.computeSqueezeZone = function() {
    if (!window.quantStats) return { confirmed: false };
    const liqLong  = window.quantStats.longLiq  || 0;
    const liqShort = window.quantStats.shortLiq || 0;
    const flags    = window.quantStats.flags    || {};
    const ofi      = window.quantStats.ofi      || 0;
    const zScore   = window.quantStats.zScore   || 0;
    const SQUEEZE_LIQ_THRESHOLD = 10000;
    let confirmed = false; let side = null; let strength = 0;

    if (liqLong > SQUEEZE_LIQ_THRESHOLD && flags.stopHunt && ofi > 0.2) {
        confirmed = true; side = 'short'; strength = Math.min(1, (liqLong / (SQUEEZE_LIQ_THRESHOLD * 5)) * (ofi + 0.2) * (zScore > 1.5 ? 1.3 : 1));
    } else if (liqShort > SQUEEZE_LIQ_THRESHOLD && flags.exhausted && ofi < -0.2) {
        confirmed = true; side = 'long'; strength = Math.min(1, (liqShort / (SQUEEZE_LIQ_THRESHOLD * 5)) * (Math.abs(ofi) + 0.2));
    }
    window.quantStats.squeezeZone = { confirmed, side, strength };
    return window.quantStats.squeezeZone;
};

const _verdictCache = { hft_html: null, hft_css: null, mft_html: null, mft_css: null, lft_html: null, lft_css: null };
let _verdictRafPending = false; let _legacyFlagsBitmaskCache = -1;

function encodeFlagsBitmask(flags) {
    if (!flags) return 0;
    return (flags.liquidityVacuum ? 1 : 0) | (flags.spoofingBuyWall ? 2 : 0) | (flags.spoofingSellWall ? 4 : 0) | (flags.bullishIceberg ? 8 : 0) | (flags.bearishIceberg ? 16 : 0) | (flags.icebergAbsorption ? 32 : 0) | (flags.exhausted ? 64 : 0) | (flags.stopHunt ? 128 : 0) | (flags.wallHit ? 256 : 0) | (flags.washTrading ? 512 : 0) | (flags.zoneAbsorptionBottom ? 1024 : 0) | (flags.zoneDistributionTop ? 2048 : 0) | (flags.spotTop ? 4096 : 0);
}

function scheduleVerdictRender(hft, mft, lft, flags) {
    const hftChanged = hft && (hft.html !== _verdictCache.hft_html || hft.css !== _verdictCache.hft_css);
    const mftChanged = mft && (mft.html !== _verdictCache.mft_html || mft.css !== _verdictCache.mft_css);
    const lftChanged = lft && (lft.html !== _verdictCache.lft_html || lft.css !== _verdictCache.lft_css);
    const newBitmask = encodeFlagsBitmask(flags); const flagsChanged = newBitmask !== _legacyFlagsBitmaskCache;

    if (!hftChanged && !mftChanged && !lftChanged && !flagsChanged) return;
    if (_verdictRafPending) return;
    _verdictRafPending = true;
    requestAnimationFrame(() => {
        _verdictRafPending = false;
        if (flagsChanged) _legacyFlagsBitmaskCache = newBitmask;
        if (hftChanged && hft) { let el = document.getElementById('verdict-hft'); if (el) { el.innerHTML = hft.html; el.style.cssText = hft.css; } _verdictCache.hft_html = hft.html; _verdictCache.hft_css = hft.css; }
        if (mftChanged && mft) { let el = document.getElementById('verdict-mft'); if (el) { el.innerHTML = mft.html; el.style.cssText = mft.css; } _verdictCache.mft_html = mft.html; _verdictCache.mft_css = mft.css; }
        if (lftChanged && lft) { let el = document.getElementById('verdict-lft'); if (el) { el.innerHTML = lft.html; el.style.cssText = lft.css; } _verdictCache.lft_html = lft.html; _verdictCache.lft_css = lft.css; }
    });
}

window.evaluateQuantVerdict = function() {
    if (!window.quantStats) return;
    let q = window.quantStats; let flags = q.flags || {};
    if (q.hftVerdict) {
        let wBuy = q.whaleBuyVol || 0; let wSell = q.whaleSellVol || 0; let ofi = q.ofi || 0; let trend = q.trend || 0;
        if ((flags.spoofingSellWall || flags.bearishIceberg) && ofi > 0.2 && wBuy > wSell && trend > 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[⚡ ĐẨY]</b> 🚀 MM MARKUP`; q.hftVerdict.color = '#00F0FF'; q.hftVerdict.bg = 'rgba(0, 240, 255, 0.15)';
        } else if (flags.spoofingBuyWall && ofi < -0.2 && wSell > wBuy && trend < 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[🩸 XẢ]</b> 🩸 MM MARKDOWN`; q.hftVerdict.color = '#FF007F'; q.hftVerdict.bg = 'rgba(255, 0, 127, 0.15)';
        }
    }
    let hftObj = { html: "⚡ ĐANG KHỞI ĐỘNG TICK...", css: "font-size: 9.5px; background: rgba(0, 240, 255, 0.1); padding: 3px 6px; border-radius: 3px; color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.2); white-space: nowrap;" };
    if (q.hftVerdict) { let v = q.hftVerdict; hftObj.html = v.html; hftObj.css = `font-size: 9.5px; background: ${v.bg}; padding: 3px 6px; border-radius: 3px; color: ${v.color}; border: 1px solid ${v.color}; white-space: nowrap;`; }
    
    let cvd1hTag = document.getElementById('sm-tag-1h') ? document.getElementById('sm-tag-1h').innerText.toUpperCase() : '';
    let cvd4hTag = document.getElementById('sm-tag-4h') ? document.getElementById('sm-tag-4h').innerText.toUpperCase() : '';
    let fFunding = q.fundingRateObj ? q.fundingRateObj.rate : (q.fundingRate || 0);
    let liqLong = q.longLiq || 0; let liqShort = q.shortLiq || 0; let totalLiq = liqLong + liqShort;

    let spotScore = 0;
    if (cvd1hTag.includes('BULLISH')) spotScore += 0.5; else if (cvd1hTag.includes('BEARISH')) spotScore -= 0.5;
    if (cvd4hTag.includes('BULLISH')) spotScore += 0.5; else if (cvd4hTag.includes('BEARISH')) spotScore -= 0.5;

    let futuresScore = 0; let hasFutures = Math.abs(fFunding) > 0 || totalLiq > 0;
    if (hasFutures) {
        if (fFunding < -0.005) futuresScore += 0.5; else if (fFunding > 0.005) futuresScore -= 0.5;
        if (totalLiq > 5000) { let liqRatio = liqShort / totalLiq; if (liqRatio > 0.65) futuresScore += 0.5; else if (liqRatio < 0.35) futuresScore -= 0.5; }
    }

    let finalMftScore = hasFutures ? (spotScore * 0.4) + (futuresScore * 0.6) : (spotScore * 1.0);
    let mftMsg = '⚖️ ĐI NGANG TRUNG HẠN'; let mftColor = '#848e9c'; let mftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalMftScore >= 0.6) { mftMsg = hasFutures ? '🔥 SHORT SQUEEZE (STRONG BUY)' : '🔥 LỰC MUA CỰC MẠNH'; mftColor = '#00F0FF'; mftBg = 'rgba(0, 240, 255, 0.1)'; } 
    else if (finalMftScore >= 0.25) { mftMsg = '📈 ĐỘNG LƯỢNG TĂNG (BUY)'; mftColor = '#0ECB81'; mftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalMftScore <= -0.6) { mftMsg = hasFutures ? '🩸 LONG CASCADE (STRONG SELL)' : '🩸 LỰC XẢ CỰC MẠNH'; mftColor = '#FF007F'; mftBg = 'rgba(255, 0, 127, 0.1)'; } 
    else if (finalMftScore <= -0.25) { mftMsg = '📉 ÁP LỰC GIẢM (SELL)'; mftColor = '#F6465D'; mftBg = 'rgba(246, 70, 93, 0.1)'; }
    let mftObj = { html: mftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${mftColor}; background: ${mftBg}; white-space: nowrap;` };

    let smBadge = document.getElementById('sm-verdict-badge'); let smTag = smBadge ? smBadge.innerText.toUpperCase() : '';
    let unlockStr = document.getElementById('sm-unlock-pct') ? document.getElementById('sm-unlock-pct').innerText : '100%'; let unlockPct = parseFloat(unlockStr) || 100;
    let smScore = 0; if (smTag.includes('CÁ MẬP GOM') || smTag.includes('BULLISH')) smScore = 1.0; else if (smTag.includes('BOT KIỂM SOÁT') || smTag.includes('BEARISH') || smTag.includes('XẢ')) smScore = -1.0;
    let tokenomicsScore = 0; if (unlockPct < 30) tokenomicsScore = -1.0; else if (unlockPct >= 50) tokenomicsScore = 0.5; else if (unlockPct >= 80) tokenomicsScore = 1.0;
    let finalLftScore = (smScore * 0.75) + (tokenomicsScore * 0.25);
    let lftMsg = '⚖️ TRUNG LẬP VĨ MÔ'; let lftColor = '#848e9c'; let lftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalLftScore >= 0.5) { lftMsg = '💎 TÍCH LŨY VĨ MÔ (MACRO BULL)'; lftColor = '#0ECB81'; lftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalLftScore <= -0.5) { lftMsg = '⚠️ RỦI RO PHÂN PHỐI (MACRO BEAR)'; lftColor = '#FF007F'; lftBg = 'rgba(255, 0, 127, 0.1)'; }
    let lftObj = { html: lftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${lftColor}; background: ${lftBg}; white-space: nowrap;` };

    scheduleVerdictRender(hftObj, mftObj, lftObj, q.flags);
};
