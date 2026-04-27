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
        // 🧱 THUẬT TOÁN RENKO NÂNG CAO (ATR / TRAD / LTP)
        // ==========================================
        // ==========================================
        // 🧱 THUẬT TOÁN RENKO (CHUẨN NINJATRADER)
        // ==========================================
        _toRenko: function(data, config) {
            let renkoData = [];
            if (!data || data.length === 0) return renkoData;

            let method = config.renkoMethod || 'atr';
            let brickSize = 1;

            if (method === 'atr') {
                brickSize = this._calculateATR(data, config.renkoAtrLength || 14);
            } else if (method === 'percentage') {
                let pct = config.renkoPercentage || 0.5;
                brickSize = data[0].close * (pct / 100);
            } else {
                brickSize = config.renkoBoxSize || 10;
            }
            
            // Bảo vệ chống lỗi 1 Brick (Ép min 0.1% nếu giá trị tính ra quá nhỏ)
            if (brickSize <= 0) brickSize = data[0].close * 0.001; 

            // LOGIC NINJATRADER: Cố định điểm neo Open - Close chéo góc
            let lastBrickClose = data[0].close;
            let lastBrickOpen = lastBrickClose - brickSize; 
            let lastDir = 1; // 1 = UP, -1 = DOWN

            // Viên gạch đầu tiên
            renkoData.push({ 
                ...data[0], 
                open: lastBrickOpen, close: lastBrickClose, 
                high: lastBrickClose, low: lastBrickOpen 
            });

            for (let i = 1; i < data.length; i++) {
                let curr = data[i];
                let price = (config.renkoSource === 'ohlc') ? (curr.high + curr.low + curr.close) / 3 : curr.close;
                
                let brickAdded = false;
                do {
                    brickAdded = false;
                    if (lastDir === 1) { 
                        // ĐANG XU HƯỚNG TĂNG
                        if (price >= lastBrickClose + brickSize) {
                            // Đi tiếp (Cần 1x Size)
                            lastBrickOpen = lastBrickClose;
                            lastBrickClose += brickSize;
                            lastDir = 1;
                            brickAdded = true;
                        } else if (price <= lastBrickOpen - brickSize) {
                            // Đảo chiều GIẢM (Cần 2x Size)
                            lastBrickClose = lastBrickOpen - brickSize;
                            // lastBrickOpen giữ nguyên làm đỉnh của gạch đỏ
                            lastDir = -1;
                            brickAdded = true;
                        }
                    } else { 
                        // ĐANG XU HƯỚNG GIẢM
                        if (price <= lastBrickClose - brickSize) {
                            // Đi tiếp (Cần 1x Size)
                            lastBrickOpen = lastBrickClose;
                            lastBrickClose -= brickSize;
                            lastDir = -1;
                            brickAdded = true;
                        } else if (price >= lastBrickOpen + brickSize) {
                            // Đảo chiều TĂNG (Cần 2x Size)
                            lastBrickClose = lastBrickOpen + brickSize;
                            // lastBrickOpen giữ nguyên làm đáy của gạch xanh
                            lastDir = 1;
                            brickAdded = true;
                        }
                    }

                    if (brickAdded) {
                        renkoData.push({
                            ...curr, 
                            // Tịnh tiến thời gian siêu nhỏ để các gạch không đè lên nhau trên trục X
                            timestamp: curr.timestamp + renkoData.length * 100, 
                            open: lastBrickOpen, close: lastBrickClose,
                            high: Math.max(lastBrickOpen, lastBrickClose), low: Math.min(lastBrickOpen, lastBrickClose),
                            volume: curr.volume 
                        });
                    }
                } while(brickAdded); // Vòng lặp do-while đảm bảo cây nến xả mạnh sinh ra nhiều gạch cùng lúc
            }
            return renkoData.length > 1 ? renkoData : data; 
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