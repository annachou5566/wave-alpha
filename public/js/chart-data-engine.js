// =========================================================================
// 🧮 BƯỚC 6: WAVE DATA ENGINE (TỰ ĐỘNG RE-RENDER KHI ĐỔI LOẠI NẾN)
// File: public/js/chart-data-engine.js
// =========================================================================
(function (global) {
    'use strict';

    global.WaveDataEngine = {
        rawHistory: [],
        lastChartType: 1, // Biến theo dõi sự thay đổi của loại biểu đồ

        /**
         * Chế biến toàn bộ lịch sử nến
         */
        processHistory: function (rawData, isReapply = false) {
            if (!rawData || rawData.length === 0) return [];
            
            if (!isReapply) {
                this.rawHistory = JSON.parse(JSON.stringify(rawData)); 
            }

            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config) return JSON.parse(JSON.stringify(this.rawHistory));

            this.lastChartType = config.chartType;

            if (config.chartType === 12) {
                console.log('[WaveDataEngine] 🪄 Biến đổi Lịch sử -> Heikin Ashi');
                return this._toHeikinAshi(this.rawHistory);
            }
            // 🚀 KÍCH HOẠT ĐỘNG CƠ RENKO (ID 14)
            if (config.chartType === 14) {
                console.log('[WaveDataEngine] 🧱 Ép khuôn Lịch sử -> Renko Bricks');
                let pct = config.renkoBrickPct || 0.5; 
                return this._toRenko(this.rawHistory, pct);
            }
            
            return JSON.parse(JSON.stringify(this.rawHistory)); 
        },

        processTick: function (rawTick, currentChartData) {
            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config || !currentChartData || currentChartData.length === 0) return rawTick;

            if (config.chartType === 12) return this._updateHeikinAshiTick(rawTick, currentChartData);
            
            // 🚀 ÉP KHUÔN REALTIME CHO RENKO
            if (config.chartType === 14) {
                let pct = config.renkoBrickPct || 0.5;
                return this._updateRenkoTick(rawTick, currentChartData, pct);
            }

            return rawTick;
        },

        // ==========================================
// 🧱 THUẬT TOÁN NINZARENKO CHUẨN
//    Brick Size / Trend Threshold
//    Open Offset = Brick Size – Trend Threshold
//    Reversal Threshold = Trend Threshold (auto, đối xứng)
// ==========================================

_toRenko: function(data, config) {
    let renkoData = [];
    if (!data || data.length === 0) return renkoData;

    // ── 1. Tính BrickSize ──────────────────────────────────────
    let method = config.renkoMethod || 'atr';
    let brickSize = 1;

    if (method === 'atr') {
        brickSize = this._calculateATR(data, config.renkoAtrLength || 14);
    } else if (method === 'percentage') {
        brickSize = data[0].close * ((config.renkoPercentage || 0.5) / 100);
    } else {
        brickSize = config.renkoBoxSize || 10;
    }

    if (brickSize <= 0) brickSize = data[0].close * 0.001;

    // ── 2. NinZaRenko Parameters ───────────────────────────────
    //   trendThreshold : khoảng cách từ lastClose để tạo brick mới
    //   openOffset     : độ lệch visual của open (= brickSize - trendThreshold)
    //   reversalThreshold = trendThreshold (đối xứng, tự động)
    //
    //   Ví dụ chuẩn: brickSize=8, trendThreshold=4 → openOffset=4 (kiểu 8/4)
    //   Để giống Renko thường: trendThreshold = brickSize → openOffset = 0
    let trendThreshold = (config.renkoTrendThreshold != null && config.renkoTrendThreshold > 0)
        ? Math.min(config.renkoTrendThreshold, brickSize)  // clamp: không vượt brickSize
        : brickSize;  // default: Standard Renko behavior

    let openOffset = brickSize - trendThreshold;

    // ── 3. Khởi tạo viên gạch đầu tiên ────────────────────────
    // Brick đầu tiên: close = data[0].close, open = close - brickSize (giả sử uptrend)
    let lastBrickClose = data[0].close;
    let lastBrickOpen  = lastBrickClose - brickSize;
    let lastDir        = 1; // 1=up, -1=down

    let runningHigh = data[0].high;
    let runningLow  = data[0].low;

    renkoData.push({
        ...data[0],
        open:  lastBrickOpen,
        close: lastBrickClose,
        high:  Math.max(lastBrickOpen, lastBrickClose, runningHigh),
        low:   Math.min(lastBrickOpen, lastBrickClose, runningLow),
    });

    // ── 4. Vòng lặp chính ──────────────────────────────────────
    for (let i = 1; i < data.length; i++) {
        const curr  = data[i];
        const price = (config.renkoSource === 'ohlc')
            ? (curr.high + curr.low + curr.close) / 3
            : curr.close;

        runningHigh = Math.max(runningHigh, curr.high);
        runningLow  = Math.min(runningLow,  curr.low);

        let brickAdded;
        do {
            brickAdded = false;

            if (lastDir === 1) {
                // ▲ Brick trước là UP
                if (price >= lastBrickClose + trendThreshold) {
                    // 🟢 Tiếp diễn UP
                    // NinZaRenko: open offset lùi về phía sau lastClose
                    lastBrickOpen  = lastBrickClose - openOffset;
                    lastBrickClose = lastBrickOpen  + brickSize; // = lastBrickClose + trendThreshold
                    lastDir = 1;
                    brickAdded = true;

                } else if (price <= lastBrickClose - trendThreshold) {
                    // 🔴 Đảo chiều DOWN
                    // NinZaRenko: open offset tiến về phía trên lastClose
                    lastBrickOpen  = lastBrickClose + openOffset;
                    lastBrickClose = lastBrickOpen  - brickSize; // = lastBrickClose - trendThreshold
                    lastDir = -1;
                    brickAdded = true;
                }

            } else {
                // ▼ Brick trước là DOWN
                if (price <= lastBrickClose - trendThreshold) {
                    // 🔴 Tiếp diễn DOWN
                    lastBrickOpen  = lastBrickClose + openOffset;
                    lastBrickClose = lastBrickOpen  - brickSize;
                    lastDir = -1;
                    brickAdded = true;

                } else if (price >= lastBrickClose + trendThreshold) {
                    // 🟢 Đảo chiều UP
                    lastBrickOpen  = lastBrickClose - openOffset;
                    lastBrickClose = lastBrickOpen  + brickSize;
                    lastDir = 1;
                    brickAdded = true;
                }
            }

            if (brickAdded) {
                renkoData.push({
                    ...curr,
                    // Offset timestamp để chart không bị chồng trục X
                    timestamp: curr.timestamp + renkoData.length * 100,
                    open:   lastBrickOpen,
                    close:  lastBrickClose,
                    // 🚀 Wick thực tế: kéo dài theo đỉnh/đáy thị trường tích lũy
                    high:   Math.max(lastBrickOpen, lastBrickClose, runningHigh),
                    low:    Math.min(lastBrickOpen, lastBrickClose, runningLow),
                    volume: curr.volume,
                });

                // Reset bộ nhớ wick cho brick kế tiếp
                runningHigh = Math.max(lastBrickOpen, lastBrickClose);
                runningLow  = Math.min(lastBrickOpen, lastBrickClose);
            }

        } while (brickAdded); // Xử lý nhiều brick trong cùng 1 nến nếu giá nhảy mạnh
    }

    return renkoData.length > 1 ? renkoData : data;
},

// ──────────────────────────────────────────────────────────────
// Tính ATR chuẩn (Wilder's ATR – Simple Average)
// ──────────────────────────────────────────────────────────────
_calculateATR: function(data, length) {
    if (!data || data.length <= length) return (data?.[0]?.close ?? 1) * 0.005;

    let sumTR = 0;
    for (let i = 1; i <= length; i++) {
        const curr = data[data.length - i];
        const prev = data[data.length - i - 1];
        const tr   = Math.max(
            curr.high - curr.low,
            Math.abs(curr.high - prev.close),
            Math.abs(curr.low  - prev.close)
        );
        sumTR += tr;
    }
    return sumTR / length;
},

// ──────────────────────────────────────────────────────────────
// Ghost Bar (Realtime Tick) – Chuẩn NinZaRenko
// Open được neo đúng vị trí NinZaRenko (không dùng lastBrick.open nữa)
// ──────────────────────────────────────────────────────────────
_updateRenkoTick: function(curr, chartData, config) {
    const lastBrick = chartData[chartData.length - 1];
    const lastDir   = lastBrick.close > lastBrick.open ? 1 : -1;
    const price     = curr.close;

    // Lấy lại brickSize từ body của brick cuối (body = brickSize theo chuẩn NinZaRenko)
    const brickSize = Math.abs(lastBrick.close - lastBrick.open);

    // Tính lại trendThreshold và openOffset (đồng bộ với _toRenko)
    const trendThreshold = (config.renkoTrendThreshold != null && config.renkoTrendThreshold > 0)
        ? Math.min(config.renkoTrendThreshold, brickSize)
        : brickSize;
    const openOffset = brickSize - trendThreshold;

    const ghost = { ...curr };

    // ── Neo Open theo chiều giá đang đi so với lastClose ──────
    // Nếu giá hướng tiếp diễn → open lùi (- openOffset)
    // Nếu giá hướng đảo chiều → open tiến (+ openOffset)
    if (lastDir === 1) {
        // Brick cuối là UP
        ghost.open = (price >= lastBrick.close)
            ? lastBrick.close - openOffset   // tiếp diễn up
            : lastBrick.close + openOffset;  // hướng đảo chiều
    } else {
        // Brick cuối là DOWN
        ghost.open = (price <= lastBrick.close)
            ? lastBrick.close + openOffset   // tiếp diễn down
            : lastBrick.close - openOffset;  // hướng đảo chiều
    }

    ghost.close = price;

    // 🚀 Realtime Wick: kéo râu theo đỉnh/đáy tick hiện tại
    ghost.high = Math.max(ghost.open, ghost.close, curr.high);
    ghost.low  = Math.min(ghost.open, ghost.close, curr.low);

    return ghost;
},
       
        

        // Tính ATR an toàn
        _calculateATR: function(data, length) {
            if (data.length < length) return data[0].close * 0.005;
            let sumTR = 0;
            for (let i = 1; i <= length; i++) {
                let curr = data[data.length - i];
                let prev = data[data.length - i - 1];
                let tr = Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close));
                sumTR += tr;
            }
            return sumTR / length;
        },

        // Tạo nến Ghost (Realtime Tick) kiểu NinjaTrader
        _updateRenkoTick: function(curr, chartData, config) {
            let lastBrick = chartData[chartData.length - 1];
            let lastDir = lastBrick.close > lastBrick.open ? 1 : -1;
            let price = curr.close;

            let ghost = { ...curr };
            
            // Vẽ "bóng ma" đúng điểm neo theo hướng giá đang chạy
            if (lastDir === 1) {
                ghost.open = price < lastBrick.open ? lastBrick.open : lastBrick.close;
            } else {
                ghost.open = price > lastBrick.open ? lastBrick.open : lastBrick.close;
            }
            
            ghost.close = price;
            ghost.high = Math.max(ghost.open, ghost.close);
            ghost.low = Math.min(ghost.open, ghost.close);

            return ghost;
        },

        // ==========================================
        // 🧪 THUẬT TOÁN HEIKIN ASHI CHUẨN XÁC
        // ==========================================
        _toHeikinAshi: function (data) {
            let haData = [];
            for (let i = 0; i < data.length; i++) {
                let curr = data[i];
                let ha = { ...curr }; // Clone object để an toàn
                
                // HA Close = Average of Open, High, Low, Close
                ha.close = (curr.open + curr.high + curr.low + curr.close) / 4;

                if (i === 0) {
                    ha.open = (curr.open + curr.close) / 2;
                    ha.high = curr.high; 
                    ha.low = curr.low;
                } else {
                    let prevHA = haData[i - 1];
                    // HA Open = Average of Previous HA Open & Previous HA Close
                    ha.open = (prevHA.open + prevHA.close) / 2;
                    // HA High/Low = Max/Min of Real High/Low and HA Open/Close
                    ha.high = Math.max(curr.high, ha.open, ha.close);
                    ha.low = Math.min(curr.low, ha.open, ha.close);
                }
                haData.push(ha);
            }
            return haData;
        },

        _updateHeikinAshiTick: function (curr, chartData) {
            let lastRendered = chartData[chartData.length - 1];
            let prevHA;

            // 🚀 Thuật toán thông minh: Phân biệt tick là của nến đang chạy hay đã chốt nến sang cây mới
            if (curr.timestamp === lastRendered.timestamp) {
                prevHA = chartData.length > 1 ? chartData[chartData.length - 2] : lastRendered;
            } else {
                prevHA = lastRendered; 
            }

            let ha = { ...curr };
            ha.close = (curr.open + curr.high + curr.low + curr.close) / 4;
            ha.open = (prevHA.open + prevHA.close) / 2;
            ha.high = Math.max(curr.high, ha.open, ha.close);
            ha.low = Math.min(curr.low, ha.open, ha.close);
            
            return ha;
        }
    };

    // ==========================================
    // 🎯 TRẠM LẮNG NGHE: ÉP CHART VẼ LẠI KHI USER CLICK MENU ĐỔI NẾN
    // ==========================================
    window.addEventListener('wa_chart_config_updated', (e) => {
        const config = e.detail;
        if (global.WaveDataEngine && config.chartType !== global.WaveDataEngine.lastChartType) {
            global.WaveDataEngine.lastChartType = config.chartType;
            
            // Kích hoạt re-apply nếu chart đang tồn tại và có data gốc trong két sắt
            if (window.tvChart && global.WaveDataEngine.rawHistory.length > 0) {
                console.log('[WaveDataEngine] 🔄 Đổi Chart Type -> Ra lệnh vẽ lại Data!');
                
                // Bắt buộc phải tắt bóng ma Waterfall để không bị khựng hình
                window._waTargetCandle = null;
                window._waCurrentCandle = null;
                
                // Gọi hàm chế biến lại từ Bản Gốc
                let reCookedData = global.WaveDataEngine.processHistory(global.WaveDataEngine.rawHistory, true);
                window.tvChart.applyNewData(reCookedData);
            }
        }
    });

})(window);