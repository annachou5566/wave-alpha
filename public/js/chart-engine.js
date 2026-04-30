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
// 🧠 BƯỚC 1: WAVE CHART ENGINE (BẢN V8.1 - FINAL PRODUCTION)
// ✅ All 4 remaining bugs patched
// =========================================================================
const DEFAULT_CHART_CONFIG = {
    chartType: 1, upColor: '#0ECB81', downColor: '#F6465D',
    showWick: true, wickIndependent: false, wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
    showBorder: true, borderIndependent: false, borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
    abnormalVolColoring: false, yAxisMode: 'normal',
    showOHLC: true, showCountdown: true, showLastPriceLine: true, showHighLowTags: true, showWatermark: true, watermarkOpacity: 0.05,
    bgType: 'gradient', 
    bgColor: '#131722', // Màu xám đen sáng hơn ở trên
    bgColor2: '#000000', // Đen sâu ở dưới
    gridVertical: false, 
    gridHorizontal: false, 
    gridColor: 'rgba(255,255,255,0.06)',
    gridVertical: false, gridHorizontal: false, gridColor: 'rgba(255,255,255,0.06)',
    sessionBreaks: false, crosshairMode: 'normal', rightMargin: 10, timezone: 'Asia/Ho_Chi_Minh',

    // 🧱 RENKO FULL SETTINGS (Mặc định chuẩn ATR 14)
    renkoMethod: 'atr',         // 'atr', 'traditional', 'percentage'
    renkoAtrLength: 14,         // Độ dài ATR mặc định
    renkoBoxSize: 10,           // Kích thước gạch cho phương pháp Truyền thống
    renkoPercentage: 1,         // 1% cho phương pháp LTP
    renkoSource: 'close',       // Nguồn giá: close hoặc ohlc
    renkoUpColor: '#FFFFFF',       // 🚀 THÊM MỚI: Màu gạch tăng
    renkoDownColor: '#B250FF',     // 🚀 THÊM MỚI: Màu gạch giảm (Tím sáng rực rỡ)
    renkoBorderColor: '#787B86',   // 🚀 THÊM MỚI: Màu râu/viền

    // 🚀 STEP LINE & OTHERS
    stepLineSingleColor: false,
    hlcCloseColor: '#00F0FF', hlcHighColor: '#0ECB81', hlcLowColor: '#F6465D',
    hlcUpFillColor: '#0ECB81', hlcDownFillColor: '#F6465D',
    hlcHighLowOpacity: 0.35, hlcFillOpacity: 0.15, hlcShowHighLow: true,
    baselineUpColor: '#0ECB81', baselineDownColor: '#F6465D',
    baselineUpFill: '#0ECB81', baselineDownFill: '#F6465D',
    baselineFillOpacity: 0.2, baselineValue: 50, baselinePriceSource: 'close'
};

const LS_CONFIG_KEY = 'wave_alpha_chart_config';
const CUSTOM_CHART_IDS = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE', 'WA_VOL_CANDLE'];
const _WA_COLOR_CACHE = {};

window.WaveChartEngine = {
    chartInstance: null, config: { ...DEFAULT_CHART_CONFIG }, _debounceTimer: null,

    init: function () {
        // [REFACTOR] Không lưu trữ chartInstance nữa, ngắt liên kết chặt
        this._registerCustomIndicators();
        this.loadConfig();
        this.applyNow();
        window.__wa_onChartReady = () => this.applyNow();
    },

    _registerCustomIndicators: function () {
        if (window.__wa_indicators_registered) return;
        window.__wa_indicators_registered = true;
        if (!window.klinecharts || !window.klinecharts.registerIndicator) return;

        try {
            // =====================================================================
            // 🚀 GIẢI PHÁP CHUYÊN NGHIỆP: WRAPPER FUNCTION
            // Tự động "tiêm" logic chém bay nút Xóa/Cài đặt cho MỌI chart đi qua nó.
            // =====================================================================
            const registerWaveChart = (config) => {
                if (!config.createTooltipDataSource) {
                    config.createTooltipDataSource = function({ indicator, defaultStyles }) {
                        const icons = defaultStyles.tooltip.icons || [];
                        return {
                            name: indicator.shortName || config.shortName || ' ',
                            calcParamsText: '',
                            // Chỉ lấy duy nhất icon con mắt (visible/invisible)
                            icons: [indicator.visible ? icons[1] : icons[0]].filter(Boolean) 
                        };
                    };
                }
                
                // 🚀 FIX LỖI DẸP LÉP TRỤC GIÁ (ANTI-SQUASH Y-AXIS)
                // Ép mảng figures rỗng để thư viện KHÔNG quét nhầm Volume và Timestamp 
                // vào việc tính toán Auto-Scale của trục giá (Y-Axis).
                if (!config.figures) {
                    config.figures = [];
                }
                
                window.klinecharts.registerIndicator(config);
            };

            // ─────────────────────────────────────────────────────────────
            // 1. CỘT (COLUMNS - ID 4)
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_COL_CHART', shortName: 'BIỂU ĐỒ CỘT', series: 'price', 
                calc: (dataList) => dataList.map(() => ({})), // 🚀 Chặn ngộ độc Auto-Scale
                draw: ({ ctx, indicator, visibleRange, bounding, barSpace, xAxis, yAxis, kLineDataList }) => { 
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const bottomY = bounding.height;
                    const dataList = kLineDataList || []; // 🚀 Lấy data gốc trực tiếp từ kLineDataList
                    if (!dataList || dataList.length === 0) return true;

                    ctx.save();
                    const bSpace = barSpace.gapBar || barSpace.bar || 6;
                    const colWidth = Math.max(1, bSpace * 0.6);

                    for (let i = from; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.close === undefined) continue;
                        // ✅ FIX #1: Cache pixel coords, tránh gọi convertToPixel 2 lần
                        const x      = xAxis.convertToPixel(i);
                        const closeY = yAxis.convertToPixel(kd.close);
                        ctx.fillStyle = kd.close >= kd.open ? c.upColor : c.downColor;
                        ctx.fillRect(x - colWidth / 2, closeY, colWidth, bottomY - closeY);
                    }

                    ctx.restore();
                    return true;
                }
            });

            // ─────────────────────────────────────────────────────────────
            // 2. ĐỈNH-ĐÁY (HIGH-LOW - ID 5)
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_HL_CHART', shortName: 'ĐỈNH - ĐÁY', series: 'price', 
                calc: (dataList) => dataList.map(() => ({})), 
                draw: ({ ctx, indicator, visibleRange, barSpace, xAxis, yAxis, kLineDataList }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = kLineDataList || []; 
                    if (!dataList || dataList.length === 0) return true;

                    ctx.save();
                    const bSpace = barSpace.gapBar || barSpace.bar || 6;
                    const colWidth    = Math.max(1, bSpace * 0.6);
                    const isTextVisible = bSpace > 30;

                    for (let i = from; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.high === undefined || kd.low === undefined) continue;

                        const x     = xAxis.convertToPixel(i);
                        const highY = yAxis.convertToPixel(kd.high);
                        const lowY  = yAxis.convertToPixel(kd.low);
                        const rectY = Math.min(highY, lowY);
                        const rectH = Math.max(1, Math.abs(highY - lowY));

                        ctx.fillStyle = kd.close >= kd.open ? c.upColor : c.downColor;
                        ctx.fillRect(x - colWidth / 2, rectY, colWidth, rectH);

                        if (isTextVisible) {
                            ctx.font         = '10px Arial';
                            ctx.textAlign    = 'center';
                            ctx.fillStyle    = '#848e9c';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(kd.high.toString(), x, rectY - 3);
                            ctx.textBaseline = 'top';
                            ctx.fillText(kd.low.toString(),  x, rectY + rectH + 3);
                        }
                    }

                    ctx.restore();
                    return true;
                }
            });

            // ─────────────────────────────────────────────────────────────
            // 3. BẬC THANG (STEP LINE - ID 8)
            //    Hỗ trợ 1 màu tĩnh (stepLineSingleColor=true) hoặc 2 màu động
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_STEP_LINE', shortName: 'BẬC THANG', series: 'price',
                calc: (dataList) => dataList.map(() => ({})), // Chặn Auto-Scale rác
                draw: ({ ctx, indicator, visibleRange, xAxis, yAxis, kLineDataList }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = kLineDataList || [];
                    if (!dataList || dataList.length === 0) return true;

                    ctx.save();
                    ctx.setLineDash([]);
                    ctx.lineWidth  = 2;
                    ctx.lineCap    = 'round';
                    ctx.lineJoin   = 'round';

                    const start = Math.max(0, from - 1);
                    let lastDrawnX = null, lastDrawnY = null, lastClose = null;

                    for (let i = start; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.close === undefined) continue;

                        const x = xAxis.convertToPixel(i);
                        const y = yAxis.convertToPixel(kd.close);

                        if (lastDrawnX === null) {
                            // Điểm đầu: ghi nhớ, chưa vẽ
                            lastDrawnX = x; lastDrawnY = y; lastClose = kd.close;
                            continue;
                        }

                        // Màu đoạn theo chiều giá (hoặc màu cố định nếu bật single color)
                        ctx.strokeStyle = c.stepLineSingleColor
                            ? c.upColor
                            : (kd.close >= lastClose ? c.upColor : c.downColor);

                        ctx.beginPath();
                        ctx.moveTo(lastDrawnX, lastDrawnY); // điểm đầu đoạn
                        ctx.lineTo(x, lastDrawnY);           // ngang (giữ Y cũ)
                        ctx.lineTo(x, y);                    // dọc chốt giá mới
                        ctx.stroke();

                        lastDrawnX = x; lastDrawnY = y; lastClose = kd.close;
                    }

                    ctx.restore();
                    return true;
                }
            });

            // ─────────────────────────────────────────────────────────────
            // 4. ĐƯỜNG + ĐIỂM MARKER (LINE MARKER - ID 7)
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_LINE_MARKER', shortName: 'ĐƯỜNG ĐIỂM', series: 'price',
                calc: (dataList) => dataList.map(() => ({})),
                draw: ({ ctx, indicator, visibleRange, xAxis, yAxis, kLineDataList }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = kLineDataList || [];
                    if (!dataList || dataList.length === 0) return true;

                    ctx.save();
                    ctx.setLineDash([]);
                    ctx.lineWidth   = 2;
                    ctx.strokeStyle = c.upColor;
                    ctx.lineCap     = 'round';
                    ctx.lineJoin    = 'round';

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
                        else         { ctx.lineTo(x, y); }
                    }
                    ctx.stroke();

                    // Vẽ marker hình tròn rỗng, màu theo chiều nến
                    for (let i = from; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.close === undefined) continue;
                        const x = xAxis.convertToPixel(i);
                        const y = yAxis.convertToPixel(kd.close);

                        ctx.strokeStyle = kd.close >= kd.open ? c.upColor : c.downColor;
                        ctx.beginPath();
                        ctx.arc(x, y, 3, 0, Math.PI * 2);
                        ctx.fillStyle = c.bgColor; // lõi nền tạo hiệu ứng rỗng
                        ctx.fill();
                        ctx.stroke();
                    }

                    ctx.restore();
                    return true;
                }
            });

            // ─────────────────────────────────────────────────────────────
            // 5. VÙNG HLC AREA (ID 10) — Tách nền trên & dưới đường Close
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_HLC_AREA', shortName: 'VÙNG HLC', series: 'price',
                calc: (dataList) => dataList.map(() => ({})),
                draw: ({ ctx, indicator, visibleRange, xAxis, yAxis, kLineDataList }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = kLineDataList || [];
                    if (!dataList || dataList.length === 0) return true;

                    ctx.save();
                    ctx.setLineDash([]);
                    const start = Math.max(0, from - 1);

                    // Pre-build 3 mảng điểm — tránh polygon lệch khi data gap
                    const highPts = [], lowPts = [], closePts = [];
                    for (let i = start; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.high === undefined || kd.low === undefined || kd.close === undefined) continue;
                        const x = xAxis.convertToPixel(i);
                        highPts.push ({x, y: yAxis.convertToPixel(kd.high)});
                        lowPts.push  ({x, y: yAxis.convertToPixel(kd.low)});
                        closePts.push({x, y: yAxis.convertToPixel(kd.close)});
                    }
                    if (highPts.length < 2) { ctx.restore(); return true; }

                    // Nền nửa trên: High → Close
                    ctx.beginPath();
                    ctx.fillStyle = window.WaveChartEngine._dimColor(c.hlcUpFillColor, c.hlcFillOpacity);
                    highPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                    [...closePts].reverse().forEach(p => ctx.lineTo(p.x, p.y));
                    ctx.closePath();
                    ctx.fill();

                    // Nền nửa dưới: Close → Low
                    ctx.beginPath();
                    ctx.fillStyle = window.WaveChartEngine._dimColor(c.hlcDownFillColor, c.hlcFillOpacity);
                    closePts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                    [...lowPts].reverse().forEach(p => ctx.lineTo(p.x, p.y));
                    ctx.closePath();
                    ctx.fill();

                    // Viền High & Low (nếu bật)
                    if (c.hlcShowHighLow) {
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = window.WaveChartEngine._dimColor(c.hlcHighColor, c.hlcHighLowOpacity);
                        ctx.beginPath();
                        highPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                        ctx.stroke();

                        ctx.strokeStyle = window.WaveChartEngine._dimColor(c.hlcLowColor, c.hlcHighLowOpacity);
                        ctx.beginPath();
                        lowPts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                        ctx.stroke();
                    }

                    // Đường Close — dày & sắc nét nhất
                    ctx.beginPath();
                    ctx.strokeStyle = c.hlcCloseColor;
                    ctx.lineWidth   = 2;
                    ctx.lineCap     = 'round';
                    ctx.lineJoin    = 'round';
                    closePts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                    ctx.stroke();

                    ctx.restore();
                    return true;
                }
            });

            // ─────────────────────────────────────────────────────────────
            // 6. ĐƯỜNG CƠ SỞ (BASELINE - ID 11)
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_BASELINE', shortName: 'ĐƯỜNG CƠ SỞ', series: 'price',
                calc: (dataList) => dataList.map(() => ({})),
                draw: ({ ctx, indicator, visibleRange, bounding, xAxis, yAxis, kLineDataList }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = kLineDataList || [];
                    if (!dataList || dataList.length === 0) return true;

                    // ✅ baselineValue = 0 không bị override thành 50
                    const basePercent = (c.baselineValue !== null && c.baselineValue !== undefined) ? c.baselineValue : 50;
                    // Canvas Y đảo ngược: 0 ở trên, height ở dưới
                    const baseY = bounding.height * (1 - basePercent / 100);

                    // 🚀 Price source linh hoạt
                    const getPrice = (kd) => {
                        switch (c.baselinePriceSource) {
                            case 'hl2':   return (kd.high + kd.low) / 2;
                            case 'ohlc4': return (kd.open + kd.high + kd.low + kd.close) / 4;
                            default:      return kd.close;
                        }
                    };

                    ctx.save();
                    ctx.setLineDash([]);

                    // Hàm vẽ path — track firstValidX / lastValidX để đóng vùng đúng
                    const drawPath = (isArea) => {
                        ctx.beginPath();
                        const startIdx = Math.max(0, from - 1);
                        let firstValidX = null, lastValidX = null;

                        for (let i = startIdx; i < to; i++) {
                            const kd = dataList[i];
                            // ✅ FIX #3: Guard đủ cho cả 3 price source (close / hl2 / ohlc4)
                            if (!kd || kd.close === undefined || kd.high === undefined || kd.low === undefined) continue;
                            const x = xAxis.convertToPixel(i);
                            const y = yAxis.convertToPixel(getPrice(kd));
                            if (firstValidX === null) { ctx.moveTo(x, y); firstValidX = x; }
                            else                      { ctx.lineTo(x, y); }
                            lastValidX = x;
                        }

                        if (isArea && firstValidX !== null && lastValidX !== null) {
                            // ✅ Dùng toạ độ X thực, không dùng index to-1
                            ctx.lineTo(lastValidX,  baseY);
                            ctx.lineTo(firstValidX, baseY);
                            ctx.closePath();
                        }
                    };

                    // Nửa trên baseline — màu tăng
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, bounding.width, baseY);
                    ctx.clip();
                    drawPath(true);
                    ctx.fillStyle = window.WaveChartEngine._dimColor(c.baselineUpFill, c.baselineFillOpacity);
                    ctx.fill();
                    drawPath(false);
                    ctx.lineWidth = 2; ctx.strokeStyle = c.baselineUpColor;
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.stroke();
                    ctx.restore();

                    // Nửa dưới baseline — màu giảm
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, baseY, bounding.width, bounding.height - baseY);
                    ctx.clip();
                    drawPath(true);
                    ctx.fillStyle = window.WaveChartEngine._dimColor(c.baselineDownFill, c.baselineFillOpacity);
                    ctx.fill();
                    drawPath(false);
                    ctx.lineWidth = 2; ctx.strokeStyle = c.baselineDownColor;
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.stroke();
                    ctx.restore();

                    // Đường ranh giới (nét đứt nằm ngang)
                    ctx.beginPath();
                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.lineWidth   = 1;
                    ctx.moveTo(0,              baseY);
                    ctx.lineTo(bounding.width, baseY);
                    ctx.stroke();

                    ctx.restore();
                    return true;
                }
            });

// ─────────────────────────────────────────────────────────────
            // 7. NẾN KHỐI LƯỢNG (CANDLE VOLUME) - ID 13
            // ─────────────────────────────────────────────────────────────
            registerWaveChart({
                name: 'WA_VOL_CANDLE', shortName: 'NẾN KHỐI LƯỢNG', series: 'price',
                calc: (dataList) => dataList.map(() => ({})),
                draw: ({ ctx, indicator, visibleRange, barSpace, xAxis, yAxis, kLineDataList }) => {
                    const c = window.WaveChartEngine.config;
                    const { from, to } = visibleRange;
                    const dataList = kLineDataList || [];
                    if (!dataList || dataList.length === 0) return true;

                    // 1. Quét tìm Volume lớn nhất trong khung hình
                    let maxVol = 0;
                    for (let i = from; i < to; i++) {
                        if (dataList[i] && dataList[i].volume > maxVol) maxVol = dataList[i].volume;
                    }

                    ctx.save();
                    ctx.setLineDash([]); // Rửa cọ

                    const maxBarWidth = Math.max(1, (barSpace.gapBar || barSpace.bar || 6) * 0.95);
                    const minBarWidth = 1; 

                    for (let i = from; i < to; i++) {
                        const kd = dataList[i];
                        if (!kd || kd.close === undefined || kd.volume === undefined) continue;

                        const rawX = xAxis.convertToPixel(i);

                        // 🚀 BÍ QUYẾT 1: Chốt Pixel Trung Tâm tuyệt đối (Mốc để cắm râu nến)
                        const cx = Math.round(rawX); 

                        // 2. Tính bề ngang lý thuyết theo Volume
                        let volRatio = maxVol > 0 ? (kd.volume / maxVol) : 0.1;
                        let rawWidth = Math.max(minBarWidth, maxBarWidth * volRatio);
                        
                        // 🚀 BÍ QUYẾT 2: ÉP THÂN NẾN LÀ SỐ LẺ (Odd Width Trick)
                        let w = Math.max(1, Math.round(rawWidth));
                        if (w % 2 === 0) {
                            w += 1; // Nếu là số chẵn (2, 4, 6), biến thành số lẻ (3, 5, 7)
                        }

                        // Tính mép trái của thân nến dựa trên tâm cx
                        const leftX = cx - Math.floor(w / 2);

                        // 🚀 BÍ QUYẾT 3: Làm tròn tất cả trục Y để chống mờ nét (Anti-aliasing)
                        const openY = Math.round(yAxis.convertToPixel(kd.open));
                        const closeY = Math.round(yAxis.convertToPixel(kd.close));
                        const highY = Math.round(yAxis.convertToPixel(kd.high));
                        const lowY = Math.round(yAxis.convertToPixel(kd.low));

                        const isUp = kd.close >= kd.open;
                        const bodyTop = Math.min(openY, closeY);
                        const bodyBottom = Math.max(openY, closeY);
                        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

                        const fBody = isUp ? c.upColor : c.downColor;
                        const fBorder = isUp ? (c.showBorder ? (c.borderIndependent ? c.borderUpColor : c.upColor) : fBody) 
                                             : (c.showBorder ? (c.borderIndependent ? c.borderDownColor : c.downColor) : fBody);
                        const fWick = isUp ? (c.showWick ? (c.wickIndependent ? c.wickUpColor : c.upColor) : fBody) 
                                           : (c.showWick ? (c.wickIndependent ? c.wickDownColor : c.downColor) : fBody);

                        // VẼ RÂU NẾN (Cắm thẳng vào pixel trung tâm cx)
                        if (c.showWick) {
                            ctx.fillStyle = fWick;
                            ctx.fillRect(cx, highY, 1, bodyTop - highY);     // Râu trên
                            ctx.fillRect(cx, bodyBottom, 1, lowY - bodyBottom); // Râu dưới
                        }

                        // VẼ THÂN NẾN (Bọc đều 2 bên râu nến)
                        ctx.fillStyle = fBody;
                        ctx.fillRect(leftX, bodyTop, w, bodyHeight);

                        // VẼ VIỀN (Chỉ vẽ viền khi nến đủ béo, width > 3)
                        if (c.showBorder && w > 3) {
                            ctx.strokeStyle = fBorder;
                            ctx.lineWidth = 1;
                            ctx.strokeRect(leftX - 0.5, bodyTop - 0.5, w + 1, bodyHeight + 1);
                        }
                    }
                    ctx.restore();
                    return true;
                }
            });


// ─────────────────────────────────────────────────────────────
// 8. LINE BREAK (BIỂU ĐỒ 3 ĐƯỜNG NGẮT) - CHUẨN GỐC KÈM STEP-LINE
// ─────────────────────────────────────────────────────────────
registerWaveChart({
    name: 'WA_LINE_BREAK', shortName: 'LINE BREAK', series: 'price',
    
    // 🧠 THUẬT TOÁN BẢN THỂ GỐC (Giữ nguyên kích thước chuẩn, lưu trạng thái liên tục)
    calc: (dataList) => {
        const results = [];
        let blocks = []; 

        for(let i = 0; i < dataList.length; i++) {
            const kd = dataList[i];
            if(!kd || kd.close === undefined) { 
                results.push(results.length > 0 ? { ...results[results.length - 1], isNew: false, isProjected: false } : null); 
                continue; 
            }
            const close = kd.close;

            if(blocks.length === 0) {
                let dir = close >= kd.open ? 1 : -1;
                let high = Math.max(kd.open, close);
                let low = Math.min(kd.open, close);
                if(high === low) { high = close + 0.0001; low = close - 0.0001; }
                let initBlock = { high, low, dir, isProjected: false, isNew: true };
                blocks.push(initBlock);
                results.push(initBlock);
                continue;
            }

            let lastBlock = blocks[blocks.length - 1];
            let newBlock = null;
            const LINE_COUNT = 3; 

            if (lastBlock.dir === 1) { 
                if (close > lastBlock.high) {
                    newBlock = { high: close, low: lastBlock.high, dir: 1, isProjected: false, isNew: true };
                } else {
                    let lookback = Math.min(LINE_COUNT, blocks.length);
                    let minLow = lastBlock.low;
                    for(let b = 1; b <= lookback; b++) { minLow = Math.min(minLow, blocks[blocks.length - b].low); }
                    if (close < minLow) {
                        newBlock = { high: lastBlock.low, low: close, dir: -1, isProjected: false, isNew: true };
                    }
                }
            } else { 
                if (close < lastBlock.low) {
                    newBlock = { high: lastBlock.low, low: close, dir: -1, isProjected: false, isNew: true };
                } else {
                    let lookback = Math.min(LINE_COUNT, blocks.length);
                    let maxHigh = lastBlock.high;
                    for(let b = 1; b <= lookback; b++) { maxHigh = Math.max(maxHigh, blocks[blocks.length - b].high); }
                    if (close > maxHigh) {
                        newBlock = { high: close, low: lastBlock.high, dir: 1, isProjected: false, isNew: true };
                    }
                }
            }

            if (newBlock) {
                blocks.push(newBlock);
                results.push(newBlock); 
            } else {
                if (i === dataList.length - 1) {
                    let projBlock = null;
                    if (lastBlock.dir === 1 && close < lastBlock.high && close > lastBlock.low) {
                        projBlock = { high: lastBlock.high, low: close, dir: -1, isProjected: true, isNew: true }; 
                    } else if (lastBlock.dir === -1 && close > lastBlock.low && close < lastBlock.high) {
                        projBlock = { high: close, low: lastBlock.low, dir: 1, isProjected: true, isNew: true }; 
                    }
                    results.push(projBlock ? projBlock : { ...lastBlock, isNew: false, isProjected: false }); 
                } else {
                    // Trạng thái Đi Ngang (Sideway)
                    results.push({ ...lastBlock, isNew: false, isProjected: false });
                }
            }
        }
        return results;
    },

    // 🎨 RENDER GIAO DIỆN (Nến chuẩn kết hợp dải Step-Line mờ)
    draw: ({ ctx, indicator, visibleRange, barSpace, xAxis, yAxis }) => {
        const c = window.WaveChartEngine.config;
        const { from, to } = visibleRange;
        const dataList = indicator.result;
        if (!dataList || dataList.length === 0) return true;

        ctx.save();
        ctx.setLineDash([]);

        const colWidth = Math.max(2, (barSpace.gapBar || barSpace.bar || 6) * 0.85);
        const w = Math.max(1, Math.round(colWidth));

        // 🚀 BƯỚC 1: VẼ ĐƯỜNG CẦU THANG LIÊN KẾT (Chìm phía dưới khối)
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); // Nét đứt siêu mảnh, sang trọng
        let lastX = null, lastY = null, lastDir = null;

        for (let i = Math.max(0, from - 1); i <= to; i++) {
            const block = dataList[i];
            if (!block) continue;
            
            const x = xAxis.convertToPixel(i);
            // Tâm điểm nối cầu thang là gốc xuất phát của xu hướng hiện tại
            const y = block.dir === 1 ? yAxis.convertToPixel(block.low) : yAxis.convertToPixel(block.high);

            if (lastX !== null) {
                ctx.beginPath();
                ctx.strokeStyle = lastDir === 1 ? c.upColor : c.downColor;
                ctx.globalAlpha = 0.25; // Đổ mờ 25% cực kỳ tinh tế
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(x, lastY); // Kéo ngang vượt qua gap
                ctx.lineTo(x, y);     // Giật dọc xuống nếu có đảo chiều
                ctx.stroke();
            }
            lastX = x;
            lastY = block.dir === 1 ? yAxis.convertToPixel(block.high) : yAxis.convertToPixel(block.low);
            lastDir = block.dir;
        }

        ctx.globalAlpha = 1.0;
        ctx.setLineDash([]); 

        // 🚀 BƯỚC 2: VẼ CÁC KHỐI NẾN CHUẨN XÁC
        for (let i = from; i < to; i++) {
            const block = dataList[i];
            // Chỉ vẽ nến khi thật sự có Breakout (isNew) hoặc là nến dự kiến (isProjected)
            if (!block || (!block.isNew && !block.isProjected)) continue; 
            
            const x = xAxis.convertToPixel(i);
            const highY = Math.round(yAxis.convertToPixel(block.high));
            const lowY = Math.round(yAxis.convertToPixel(block.low));
            
            const isUp = block.dir === 1;
            const bodyTop = Math.min(highY, lowY);
            const bodyHeight = Math.max(1, Math.abs(highY - lowY));
            const leftX = Math.round(x - w / 2); 

            const fBody = isUp ? c.upColor : c.downColor;
            const fBorder = isUp ? (c.showBorder ? (c.borderIndependent ? c.borderUpColor : c.upColor) : fBody) 
                                 : (c.showBorder ? (c.borderIndependent ? c.borderDownColor : c.downColor) : fBody);

            if (block.isProjected) {
                // Đường dự kiến: Nét đứt rỗng lõi
                ctx.fillStyle = 'transparent';
                ctx.strokeStyle = fBody;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]); 
                ctx.strokeRect(leftX - 0.5, bodyTop - 0.5, w + 1, bodyHeight + 1);
                ctx.setLineDash([]); 
            } else {
                // Khối thật: Đổ khối đặc
                ctx.fillStyle = fBody;
                ctx.fillRect(leftX, bodyTop, w, bodyHeight);

                if (c.showBorder && w > 2) {
                    ctx.strokeStyle = fBorder;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(leftX - 0.5, bodyTop - 0.5, w + 1, bodyHeight + 1);
                }
            }
        }

        ctx.restore();
        return true;
    }
});
            
            console.log('[WaveChartEngine] Custom Chart V8.1 loaded ✅');
        } catch (e) { console.error('Lỗi nạp Custom Indicator:', e); }
    },

    update: function (newProps, instant = false) {
        this.config = { ...this.config, ...newProps };
        this.saveConfig();
        if (instant) this.applyNow();
        else { clearTimeout(this._debounceTimer); this._debounceTimer = setTimeout(() => this.applyNow(), 50); }
    },

    getConfig:  function () { return this.config; },
    saveConfig: function () { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(this.config)); },
    loadConfig: function () {
        try { const saved = JSON.parse(localStorage.getItem(LS_CONFIG_KEY)); if (saved) this.config = { ...this.config, ...saved }; }
        catch (e) {}
    },

    applyNow: function () {
        if (!window.WA_Chart) return;

        // 1. ÁP DỤNG CẤU HÌNH NẾN & MÀU SẮC
        window.WA_Chart.setMainSeries(this.config);

        // 2. ÁP DỤNG KIỂU DÁNG CHO LÕI KLINECHART (Lưới, Giá, Trục Y, Tâm Ngắm)
        if (typeof window.WA_Chart.setStyles === 'function') {
            window.WA_Chart.setStyles({
                grid: {
                    show: true,
                    horizontal: { show: this.config.gridHorizontal, size: 1, color: this.config.gridColor, style: 'dashed', dashValue: [2, 2] },
                    vertical: { show: this.config.gridVertical, size: 1, color: this.config.gridColor, style: 'dashed', dashValue: [2, 2] }
                },
                yAxis: {
                    type: this.config.yAxisMode || 'normal'
                },
                candle: {
                    priceMark: {
                        show: true,
                        high: { show: this.config.showHighLowTags !== false },
                        low: { show: this.config.showHighLowTags !== false },
                        last: { show: this.config.showLastPriceLine !== false }
                    }
                },
                crosshair: {
                    show: this.config.crosshairMode !== 'none' && this.config.crosshairMode !== 'hidden'
                }
            });
        }

        // 3. ÁP DỤNG KHOẢNG CÁCH LỀ & MÚI GIỜ
        if (typeof window.WA_Chart.setOffsetRightDistance === 'function') {
            window.WA_Chart.setOffsetRightDistance(this.config.rightMargin !== undefined ? this.config.rightMargin : 10);
        }
        if (typeof window.WA_Chart.setTimezone === 'function') {
            window.WA_Chart.setTimezone(this.config.timezone || 'Asia/Ho_Chi_Minh');
        }

        // 4. ÁP DỤNG NỀN BIỂU ĐỒ (BACKGROUND DOM)
        const container = document.getElementById('sc-chart-container');
        if (container) {
            container.style.background = this.config.bgType === 'solid'
                ? this.config.bgColor
                : `linear-gradient(to bottom, ${this.config.bgColor} 0%, ${this.config.bgColor2 || '#000000'} 100%)`;
        }

        // 5. ĐỒNG BỘ CÔNG TẮC GIAO DIỆN HTML NÂNG CAO
        // Bật tắt thanh Legend OHLC góc trái
        const ohlcEl = document.getElementById('cc-legend') || document.querySelector('.sc-legend');
        if (ohlcEl) ohlcEl.style.display = this.config.showOHLC === false ? 'none' : 'flex';

        // Bật tắt Chữ chìm (Watermark) & Độ mờ
        const watermarkEl = document.getElementById('sc-watermark') || document.querySelector('.sc-watermark');
        if (watermarkEl) {
            watermarkEl.style.display = this.config.showWatermark === false ? 'none' : 'flex';
            watermarkEl.style.opacity = this.config.watermarkOpacity || 0.05;

            // 🚀 BỔ SUNG: DÙNG RADAR MUTATION OBSERVER KHÓA CHẶT CHỮ RENKO
            // Ép kiểu chartType về số nguyên để tránh lỗi string '14'
            let isRenko = parseInt(this.config.chartType) === 14; 
            
            const forceWatermarkText = () => {
                let sym = window.currentChartToken ? window.currentChartToken.symbol.toUpperCase() : '';
                let targetText = isRenko 
                    ? (sym ? `${sym} RENKO` : 'RENKO') 
                    : (sym ? `${sym} ${window.currentChartInterval === 'tick' ? 'TICK' : (window.currentChartInterval || '').toUpperCase()}` : '');
                
                // Cập nhật nếu text đang bị sai
                if (watermarkEl.innerText !== targetText) {
                    watermarkEl.innerText = targetText;
                }
            };

            // 1. Ép đổi chữ ngay lập tức
            forceWatermarkText();

            // 2. Kích hoạt Radar: Bất kỳ file nào cố ghi đè, ta bẻ lái lại ngay!
            if (!window._waWatermarkObserver) {
                window._waWatermarkObserver = new MutationObserver(() => {
                    // Tạm ngắt Radar để tự đổi chữ mà không bị lặp vô hạn
                    window._waWatermarkObserver.disconnect(); 
                    
                    // Kiểm tra lại cấu hình xem có đang bật Renko không
                    isRenko = parseInt(window.WaveChartEngine.config.chartType) === 14;
                    forceWatermarkText(); 
                    
                    // Bật Radar lại
                    window._waWatermarkObserver.observe(watermarkEl, { childList: true, characterData: true, subtree: true });
                });
                
                // Lần đầu khởi động Radar
                window._waWatermarkObserver.observe(watermarkEl, { childList: true, characterData: true, subtree: true });
            }
        }

        // Bật tắt Đồng hồ đếm ngược (Countdown)
        const countdownEl = document.getElementById('sc-countdown') || document.querySelector('.sc-countdown-timer');
        if (countdownEl) {
            countdownEl.style.display = this.config.showCountdown === false ? 'none' : 'block';
        }

        // 6. PHÁT TÍN HIỆU ĐỂ CÁC COMPONENT KHÁC CÙNG CẬP NHẬT
        // Phát cả 2 sự kiện chữ Hoa và chữ Thường để đảm bảo file chart-ui.js luôn bắt được lệnh
        window.dispatchEvent(new CustomEvent('WA_CHART_CONFIG_UPDATED', { detail: this.config }));
        window.dispatchEvent(new CustomEvent('wa_chart_config_updated', { detail: this.config }));
    },

    // 🚀 CACHE & PARSER MÀU SẮC CHUYÊN NGHIỆP (ĐÃ FIX LỖI ĐEN MÀU RGBA)
    _dimColor: function(hex, opacity) {
        if (!hex) return 'transparent';
        const cacheKey = hex + '_' + opacity; 
        if (_WA_COLOR_CACHE[cacheKey]) return _WA_COLOR_CACHE[cacheKey];
        
        let r = 0, g = 0, b = 0, result;
        let localOpacity = 1; // Thêm biến lưu độ mờ riêng của bảng màu
        
        // Cải tiến: Đọc được cả màu RGBA để lấy đúng R, G, B gốc và áp dụng Opacity mới
        if (hex.startsWith('rgba')) {
            const m = hex.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/);
            if (m) { 
                r = +m[1]; g = +m[2]; b = +m[3]; 
                localOpacity = parseFloat(m[4]); // Lấy độ mờ riêng từ bảng màu
            }
        }
        else if (hex.startsWith('rgb(')) { 
            const m = hex.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/); 
            if (m) { r = +m[1]; g = +m[2]; b = +m[3]; } 
        } 
        else if (hex.length === 4) { 
            r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16); 
        } 
        else if (hex.length >= 7) { 
            r = parseInt(hex.substring(1, 3), 16); g = parseInt(hex.substring(3, 5), 16); b = parseInt(hex.substring(5, 7), 16); 
        }
        
        // LOGIC MỚI: Nhân độ mờ riêng của màu (Color Picker) với độ mờ chung (Global Slider)
        // Nhờ vậy cả 2 thanh trượt đều có tác dụng và hoạt động đồng bộ với nhau
        let finalOpacity = localOpacity * (opacity !== undefined ? opacity : 1);
        finalOpacity = Math.round(finalOpacity * 1000) / 1000; // Làm tròn tránh số quá dài

        result = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`; 
        _WA_COLOR_CACHE[cacheKey] = result; 
        return result;
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
    let finalCandle = candleObj;
    if (window.WaveDataEngine) {
        let dataList = window.WA_Chart ? window.WA_Chart.getDataList() : [];
        finalCandle = window.WaveDataEngine.processTick(candleObj, dataList);
    }
    if (window.WA_Chart) window.WA_Chart.updateData(finalCandle); 
    
    // 🛡️ Bắn dữ liệu Realtime lên Legend HTML nếu chuột không soi vào nến cũ
    if (!window._isCrosshairActive && typeof window.updateLegendUI === 'function') {
        window.updateLegendUI(finalCandle);
    }
};

window.startWaterfallEngine = function() {
    if (window._waRafRunning) return;
    window._waRafRunning = true;
    let lastDraw = 0;

    function renderLoop(time) {
        // 💡 VÁ LỖI: Trả lại trạng thái false để lần sau mở Chart động cơ còn biết đường chạy lại
        if (!window._waTargetCandle) {
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

        // Xóa bỏ tàn tích activeSeries của TradingView, thay bằng window.WA_Chart
        if (window.WA_Chart && window.quantStats.flags && window.scTickHistory.length > 0) {
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

        // 💡 VÁ LỖI CỰC MẠNH: Dùng ID tín hiệu cuối thay vì đếm độ dài mảng (tránh lỗi kẹt ở 50 do hàm shift)
        if (typeof window.applyFishFilter === 'function') {
            let markers = window.scChartMarkers || [];
            let latestMarker = markers.length > 0 ? markers[markers.length - 1] : null;
            
            // Tạo tem định danh duy nhất cho marker cuối (Thời gian + Tên)
            let latestMarkerId = latestMarker ? (latestMarker.time + '_' + latestMarker.text) : null;
            
            // Nếu có tín hiệu mới khác với tín hiệu cũ -> Vẽ ngay lập tức
            if (latestMarkerId !== window._lastRenderedMarkerId) {
                window.applyFishFilter();
                window._lastRenderedMarkerId = latestMarkerId;
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
                    
                    if (window.WA_Chart) {
                        window.WA_Chart.updateData({
                            timestamp: timeSec * 1000,
                            open: currentClose, high: currentClose, low: currentClose, close: currentClose,
                            volume: currentVol
                        }); // 🛡️ Xóa tham số false
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
                if (window.WA_Chart && window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s') {
                    
                    let rawTk = parseInt(k.t || k.ot);
                    let correctTk = rawTk < 100000000000 ? rawTk * 1000 : rawTk;

                    let dataList = window.WA_Chart.getDataList();
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
                let dataList = window.WA_Chart ? window.WA_Chart.getDataList() : [];
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
        let limit = isArea ? 100 : 1000; 
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
    else if (finalMftScore >= 0.25) { mftMsg = 'ĐỘNG LƯỢNG TĂNG'; mftColor = '#0ECB81'; mftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalMftScore <= -0.6) { mftMsg = hasFutures ? '🩸 LONG CASCADE (STRONG SELL)' : '🩸 LỰC XẢ CỰC MẠNH'; mftColor = '#FF007F'; mftBg = 'rgba(255, 0, 127, 0.1)'; } 
    else if (finalMftScore <= -0.25) { mftMsg = 'ÁP LỰC GIẢM'; mftColor = '#F6465D'; mftBg = 'rgba(246, 70, 93, 0.1)'; }
    let mftObj = { html: mftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${mftColor}; background: ${mftBg}; white-space: nowrap;` };

    let smBadge = document.getElementById('sm-verdict-badge'); let smTag = smBadge ? smBadge.innerText.toUpperCase() : '';
    let unlockStr = document.getElementById('sm-unlock-pct') ? document.getElementById('sm-unlock-pct').innerText : '100%'; let unlockPct = parseFloat(unlockStr) || 100;
    let smScore = 0; if (smTag.includes('CÁ MẬP GOM') || smTag.includes('BULLISH')) smScore = 1.0; else if (smTag.includes('BOT KIỂM SOÁT') || smTag.includes('BEARISH') || smTag.includes('XẢ')) smScore = -1.0;
    let tokenomicsScore = 0; if (unlockPct < 30) tokenomicsScore = -1.0; else if (unlockPct >= 50) tokenomicsScore = 0.5; else if (unlockPct >= 80) tokenomicsScore = 1.0;
    let finalLftScore = (smScore * 0.75) + (tokenomicsScore * 0.25);
    let lftMsg = '⚖️ TRUNG LẬP VĨ MÔ'; let lftColor = '#848e9c'; let lftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalLftScore >= 0.5) { lftMsg = '💎 TÍCH LŨY VĨ MÔ'; lftColor = '#0ECB81'; lftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalLftScore <= -0.5) { lftMsg = '⚠️ RỦI RO PHÂN PHỐI'; lftColor = '#FF007F'; lftBg = 'rgba(255, 0, 127, 0.1)'; }
    let lftObj = { html: lftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${lftColor}; background: ${lftBg}; white-space: nowrap;` };

    scheduleVerdictRender(hftObj, mftObj, lftObj, q.flags);
};

// ==========================================
// 🛡️ BƯỚC 1: WAVE ALPHA EVENT HUB (ĐA LUỒNG - MULTI-STREAM ROUTER)
// Phân luồng WebSocket & Klines cho 9 ô độc lập (Chuẩn TradingView)
// ==========================================

window.waSubWebSockets = window.waSubWebSockets || {};
window.waCellTokens = window.waCellTokens || {}; 
window.waCellIntervals = window.waCellIntervals || {}; 

// 🚀 ĐỘNG CƠ WS SIÊU NHẸ DÀNH RIÊNG TỪNG Ô (CHỈ KÉO NẾN VẼ CHART)
window.connectLightweightStream = async function(t, interval, cellId) {
    if (window.waSubWebSockets[cellId]) { 
        window.waSubWebSockets[cellId].close(); 
        delete window.waSubWebSockets[cellId]; 
    }

    let smartCtx = await window.getSmartTokenContext(t);
    let contract = smartCtx.contract;
    let chainId = smartCtx.chainId;
    let rawId = (t.alphaId || t.id || '').toLowerCase().replace('alpha_', '');
    let streamPrefix = rawId ? `alpha_${rawId}usdt` : (t.symbol || '').toLowerCase() + 'usdt';

    let targetInterval = interval === 'tick' ? '1s' : interval;
    let streamName = contract ? `came@${contract}@${chainId}@kline_${targetInterval}` : `${streamPrefix}@kline_${targetInterval}`;

    let ws = new WebSocket('wss://nbstream.binance.com/w3w/wsa/stream');
    window.waSubWebSockets[cellId] = ws;

    ws.onopen = () => {
        ws.send(JSON.stringify({ "method": "SUBSCRIBE", "params": [streamName], "id": Date.now() }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.e === 'kline' || (data.stream && data.stream.includes('kline_'))) {
            let k = data.data.k || data.data;
            if (!k) return;
            
            let rawTk = parseInt(k.t || k.ot);
            let correctTk = rawTk < 100000000000 ? rawTk * 1000 : rawTk;
            let c = parseFloat(k.c);
            
            let candle = {
                timestamp: correctTk, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: c, volume: parseFloat(k.q !== undefined ? k.q : (k.v || 0))
            };
            
            // Xử lý nến qua bộ lọc Renko/Heikin Ashi nếu có
            let finalCandle = candle;
            if (window.WaveDataEngine) {
                let chartInstance = window.WA_Chart.getChartSpecific(cellId);
                let dataList = chartInstance ? chartInstance.getDataList() : [];
                finalCandle = window.WaveDataEngine.processTick(candle, dataList);
            }

            // 🚀 BƠM DATA VÀO CHÍNH XÁC Ô ĐÃ GỌI
            if (window.WA_Chart) window.WA_Chart.updateDataSpecific(cellId, finalCandle);

            // Cập nhật giá trên thanh Toolbar nếu ô này đang là ô chính (Active)
            if (cellId === window.WA_Chart.activeId && !window._isCrosshairActive && typeof window.updateLegendUI === 'function') {
                window.updateLegendUI(finalCandle);
            }
        }
    };

    ws.onclose = () => {
        // Tự động kết nối lại nếu bị đứt mạng
        if (window.waSubWebSockets[cellId] === ws) {
            setTimeout(() => window.connectLightweightStream(t, interval, cellId), 2000);
        }
    };
};

window.addEventListener('WA_TOKEN_SWITCHED', function(e) {
    const t = e.detail.token;
    const interval = e.detail.interval;
    const cellId = window.WA_Chart.activeId; 
    const isMainChart = (cellId === 'wa-chart-cell-0'); // Nếu UI chưa kịp update activeId

    console.log(`📡 [Router] Ô [${cellId}] load Token: ${t.symbol}`);
    window.waCellTokens[cellId] = t;
    window.waCellIntervals[cellId] = interval;

    window.fetchBinanceHistory(t, interval, interval === 'tick').then(histData => {
        if (histData && histData.length > 0) {
            let finalData = window.WaveDataEngine ? window.WaveDataEngine.processHistory(histData) : histData;
            // 🚀 ĐỔ LỊCH SỬ VÀO ĐÚNG Ô
            if (window.WA_Chart) window.WA_Chart.applyNewDataSpecific(cellId, finalData);
        }
        
        // Khởi động WS vệ tinh siêu nhẹ cho ô này
        window.connectLightweightStream(t, interval, cellId);

        // 🚀 NẾU Ô NÀY ĐANG ĐƯỢC CHỌN (ACTIVE), DỒN TOÀN BỘ SỨC MẠNH QUANT VÀO NÓ
        if (cellId === window.WA_Chart.activeId) {
            window._waRafRunning = false; window._waTargetCandle = null; window._waCurrentCandle = null;
            if (window.chartWs) { window.chartWs.close(); window.chartWs = null; }
            if (window.liquidationWs) { window.liquidationWs.close(); window.liquidationWs = null; }

            if (window.WaveIndicatorAPI) {
                if (typeof window.WaveIndicatorAPI.initUI === 'function') window.WaveIndicatorAPI.initUI();
                if (typeof window.WaveIndicatorAPI.restore === 'function') window.WaveIndicatorAPI.restore();
            }
            if (typeof window.__wa_onChartReady === 'function') window.__wa_onChartReady();
            if (typeof window.connectRealtimeChart === 'function') window.connectRealtimeChart(t, false);
            if (typeof window.startFuturesEngine === 'function') window.startFuturesEngine(t.symbol);
        }
    });
});

window.addEventListener('WA_TIMEFRAME_CHANGED', function(e) {
    const t = e.detail.token;
    const interval = e.detail.interval;
    const cellId = window.WA_Chart.activeId;

    console.log(`📡 [Router] Ô [${cellId}] đổi Timeframe: ${interval}`);
    window.waCellTokens[cellId] = t;
    window.waCellIntervals[cellId] = interval;

    if (cellId === window.WA_Chart.activeId) {
        window._waRafRunning = false; window._waTargetCandle = null; window._waCurrentCandle = null;
        if (window.WaveChartEngine) {
            if (interval === 'tick') window.WaveChartEngine.update({ chartType: 9 }, true);
            else window.WaveChartEngine.applyNow();
        }
    }

    window.fetchBinanceHistory(t, interval, interval === 'tick').then(histData => {
        if (histData && histData.length > 0) {
            let finalData = window.WaveDataEngine ? window.WaveDataEngine.processHistory(histData) : histData;
            // 🚀 ĐỔ LỊCH SỬ VÀO ĐÚNG Ô
            if (window.WA_Chart) window.WA_Chart.applyNewDataSpecific(cellId, finalData);
        }
        
        window.connectLightweightStream(t, interval, cellId);

        if (cellId === window.WA_Chart.activeId) {
            if (window.WaveIndicatorAPI && typeof window.WaveIndicatorAPI.restore === 'function') window.WaveIndicatorAPI.restore();
            if (typeof window.__wa_onChartReady === 'function') window.__wa_onChartReady();
            if (typeof window.connectRealtimeChart === 'function') window.connectRealtimeChart(t, true);
        }
    });
});

// 🚀 LẮNG NGHE SỰ KIỆN CLICK ĐỂ "CHUYỂN NHÀ" ĐỘNG CƠ QUANT SANG Ô MỚI
window.addEventListener('WA_ACTIVE_CHART_CHANGED', function(e) {
    const cellId = e.detail.cellId;
    const t = window.waCellTokens ? window.waCellTokens[cellId] : null;
    
    if (t && typeof window.connectRealtimeChart === 'function') {
        console.log(`🔄 [Shift] Chuyển đổi Quant Engine sang ô: ${cellId} (${t.symbol})`);
        
        // 1. DỌN RÁC BỘ NHỚ VÀ NGẮT LUỒNG CŨ (Chống đơ Tape)
        if (window.chartWs) { window.chartWs.close(); window.chartWs = null; }
        if (window.liquidationWs) { window.liquidationWs.close(); window.liquidationWs = null; }
        if (window.scCalcInterval) { clearInterval(window.scCalcInterval); window.scCalcInterval = null; }

        window._tapeBuffer = [];
        window._tradesBuffer = [];
        window._highlightQueue = [];
        window.scCurrentCluster = null;
        window.quantStats = { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };
        window.scCWhale = 0; window.scCShark = 0; window.scCDolphin = 0; window.scCSweep = 0;
        
        if (document.getElementById('sc-stat-whale')) document.getElementById('sc-stat-whale').innerText = '0';
        if (document.getElementById('sc-stat-shark')) document.getElementById('sc-stat-shark').innerText = '0';
        if (document.getElementById('sc-stat-dolphin')) document.getElementById('sc-stat-dolphin').innerText = '0';
        if (document.getElementById('sc-stat-sweep')) document.getElementById('sc-stat-sweep').innerText = '0';

        // 2. CẬP NHẬT GIAO DIỆN HEADER CHO ĐÚNG COIN ĐANG CHỌN
        window.currentChartToken = t;
        window.currentChartInterval = window.waCellIntervals ? (window.waCellIntervals[cellId] || '15m') : '15m';
        
        let symEl = document.getElementById('sc-coin-symbol'); if(symEl) symEl.innerText = (t.symbol || 'UNKNOWN') + '/USDT';
        let nameEl = document.getElementById('sc-coin-name'); if(nameEl) nameEl.innerText = t.name || t.symbol; 
        let logoEl = document.getElementById('sc-coin-logo'); if(logoEl) logoEl.src = t.icon || 'assets/tokens/default.png';
        let priceEl = document.getElementById('sc-live-price'); if(priceEl) priceEl.innerText = '$' + window.formatPrice(t.price);
        
        let chg = parseFloat(t.change_24h) || 0; let chgEl = document.getElementById('sc-change-24h');
        if (chgEl) { chgEl.innerText = `(${(chg >= 0 ? '+' : '')}${chg.toFixed(2)}%)`; chgEl.style.color = chg >= 0 ? '#00F0FF' : '#FF007F'; }

        let mcEl = document.getElementById('sc-top-mc'); if(mcEl) mcEl.innerText = '$' + window.formatCompactNum(t.market_cap || 0);
        let liqEl = document.getElementById('sc-top-liq'); if(liqEl) liqEl.innerText = '$' + window.formatCompactNum(t.liquidity || 0);
        let volEl = document.getElementById('sc-top-vol'); if(volEl) volEl.innerText = '$' + window.formatCompactNum(t.volume?.daily_total || 0);

        // 3. XÓA BẢNG TAPE CŨ CHUẨN BỊ ĐÓN DATA MỚI
        let tape = document.getElementById('cc-sniper-tape');
        if(tape) tape.innerHTML = '<div style="font-size: 11px; color: #527c82; text-align: center; margin-top: 50px; font-style:italic;">Đang phân luồng dữ liệu...</div>';
        
        let liqTape = document.getElementById('fut-liq-tape');
        if(liqTape) liqTape.innerHTML = '<div style="font-size: 10px; color: #527c82; text-align: center; margin-top: 45px; font-style:italic;">Đang rình cá mập...</div>';

        let tradesBox = document.getElementById('sc-live-trades');
        if (tradesBox) tradesBox.innerHTML = '<div style="text-align:center; margin-top:20px; color:#5e6673; font-style:italic;">Đang kết nối...</div>';

        // 4. KHỞI ĐỘNG LẠI ĐỘNG CƠ (QUANT ENGINE)
        setTimeout(() => {
            if (typeof window.fetchSmartMoneyData === 'function') window.fetchSmartMoneyData(t.contract, t.chainId || 56);
            if (typeof window.fetchFuturesSentiment === 'function') window.fetchFuturesSentiment(t.symbol);
            if (typeof window.fetchCommandCenterFutures === 'function') window.fetchCommandCenterFutures(t.symbol);

            window.connectRealtimeChart(t, false);
            if (typeof window.startFuturesEngine === 'function') window.startFuturesEngine(t.symbol);
        }, 100);
    }
});