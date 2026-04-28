// =========================================================================
// 🧮 BƯỚC 6: WAVE DATA ENGINE (TỰ ĐỘNG RE-RENDER KHI ĐỔI LOẠI NẾN)
// File: public/js/chart-data-engine.js
// Phiên bản: Smart Dual-Core (Cạo râu chuẩn Quant & Fix Realtime Bake)
// =========================================================================
(function (global) {
    'use strict';

    global.WaveDataEngine = {
        rawHistory: [],
        lastChartType: 1, 
        _renkoState: null, // Bộ nhớ đệm cho Nến ma Realtime

        processHistory: function (rawData, isReapply = false) {
            if (!rawData || rawData.length === 0) return [];
            
            if (!isReapply) {
                this.rawHistory = JSON.parse(JSON.stringify(rawData)); 
            }

            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config) return JSON.parse(JSON.stringify(this.rawHistory));

            const cType = parseInt(config.chartType);
            this.lastChartType = cType;

            if (cType === 12) return this._toHeikinAshi(this.rawHistory);
            if (cType === 14) return this._toRenko(this.rawHistory, config);
            
            return JSON.parse(JSON.stringify(this.rawHistory)); 
        },

        processTick: function (rawTick, currentChartData) {
            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config || !currentChartData || currentChartData.length === 0) return rawTick;

            const cType = parseInt(config.chartType);
            if (cType === 12) return this._updateHeikinAshiTick(rawTick, currentChartData);
            if (cType === 14) return this._updateRenkoTick(rawTick, currentChartData, config);

            return rawTick;
        },

        // ==========================================
        // 🧪 THUẬT TOÁN HEIKIN ASHI
        // ==========================================
        _toHeikinAshi: function (data) {
            let haData = [];
            for (let i = 0; i < data.length; i++) {
                let curr = data[i];
                let ha = { ...curr }; 
                ha.close = (curr.open + curr.high + curr.low + curr.close) / 4;
                if (i === 0) {
                    ha.open = (curr.open + curr.close) / 2;
                    ha.high = curr.high; 
                    ha.low = curr.low;
                } else {
                    let prevHA = haData[i - 1];
                    ha.open = (prevHA.open + prevHA.close) / 2;
                    ha.high = Math.max(curr.high, ha.open, ha.close);
                    ha.low = Math.min(curr.low, ha.open, ha.close);
                }
                haData.push(ha);
            }
            return haData;
        },

        _updateHeikinAshiTick: function (curr, chartData) {
            let lastRendered = chartData[chartData.length - 1];
            let prevHA = (curr.timestamp === lastRendered.timestamp && chartData.length > 1) 
                            ? chartData[chartData.length - 2] : lastRendered;

            let ha = { ...curr };
            ha.close = (curr.open + curr.high + curr.low + curr.close) / 4;
            ha.open = (prevHA.open + prevHA.close) / 2;
            ha.high = Math.max(curr.high, ha.open, ha.close);
            ha.low = Math.min(curr.low, ha.open, ha.close);
            return ha;
        },

        // ======================================================
        // 🧱 ĐỘNG CƠ RENKO DUAL-CORE (CLASSIC & NINZA PRO)
        // ======================================================
        _toRenko: function(data, config) {
            let renkoData = [];
            if (!data || data.length === 0) return renkoData;

            // 1. Tính toán Kích thước Gạch (Smart Brick Size)
            let method = config.renkoMethod || 'atr';
            let brickSize = 1;
            if (method === 'atr') brickSize = this._calculateATR(data, config.renkoAtrLength || 14);
            else if (method === 'percentage') brickSize = data[0].close * ((config.renkoPercentage || 1.0) / 100);
            else brickSize = config.renkoBoxSize || 10;
            if (brickSize <= 0) brickSize = data[0].close * 0.001;

            const isClassic = (config.renkoStyle === 'classic'); 
            
            // 2. Tính toán Ngưỡng Đảo chiều
            let pct = parseFloat(config.renkoTrendPct) || 50;
            let trendThreshold = isClassic ? brickSize : brickSize * (pct / 100);
            let openOffset = brickSize - trendThreshold;

            // 3. Khởi tạo Thông số Vòng lặp
            let lastBrickClose = data[0].close;
            let lastBrickOpen  = lastBrickClose - brickSize;
            let lastDir        = 1; 
            let runningHigh    = data[0].high;
            let runningLow     = data[0].low;

            renkoData.push({
                ...data[0], open: lastBrickOpen, close: lastBrickClose,
                high: Math.max(lastBrickOpen, lastBrickClose, runningHigh),
                low: Math.min(lastBrickOpen, lastBrickClose, runningLow)
            });

            // 4. Vòng lặp Nấu Gạch
            for (let i = 1; i < data.length; i++) {
                const curr = data[i];
                const price = (config.renkoSource === 'ohlc') ? (curr.high + curr.low + curr.close) / 3 : curr.close;
                
                runningHigh = Math.max(runningHigh, curr.high);
                runningLow  = Math.min(runningLow, curr.low);

                let brickAdded;
                do {
                    brickAdded = false;
                    if (lastDir === 1) { // ĐANG TĂNG
                        if (price >= lastBrickClose + trendThreshold) { // Tiếp diễn Tăng
                            lastBrickOpen  = lastBrickClose - (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  + brickSize; 
                            lastDir = 1; brickAdded = true;
                        } else if (price <= (isClassic ? lastBrickOpen - brickSize : lastBrickClose - trendThreshold)) { // Đảo chiều Giảm
                            lastBrickOpen  = lastBrickClose + (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  - brickSize; 
                            lastDir = -1; brickAdded = true;
                        }
                    } else { // ĐANG GIẢM
                        if (price <= lastBrickClose - trendThreshold) { // Tiếp diễn Giảm
                            lastBrickOpen  = lastBrickClose + (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  - brickSize;
                            lastDir = -1; brickAdded = true;
                        } else if (price >= (isClassic ? lastBrickOpen + brickSize : lastBrickClose + trendThreshold)) { // Đảo chiều Tăng
                            lastBrickOpen  = lastBrickClose - (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  + brickSize;
                            lastDir = 1; brickAdded = true;
                        }
                    }

                    if (brickAdded) {
                        // 🚀 LOGIC CẠO RÂU SIÊU CHUẨN XÁC
                        let bHigh, bLow;
                        if (isClassic) {
                            // Classic: Gạch vuông vức 100%, cắt bỏ mọi râu
                            bHigh = Math.max(lastBrickOpen, lastBrickClose);
                            bLow  = Math.min(lastBrickOpen, lastBrickClose);
                        } else {
                            // NinZa: Cắt râu thuận xu hướng, giữ râu ngược xu hướng
                            if (lastDir === 1) { // Tăng (Xanh) -> Phẳng đỉnh
                                bHigh = lastBrickClose; 
                                bLow  = Math.min(lastBrickOpen, runningLow); 
                            } else {             // Giảm (Đỏ) -> Phẳng đáy
                                bHigh = Math.max(lastBrickOpen, runningHigh); 
                                bLow  = lastBrickClose; 
                            }
                        }

                        renkoData.push({
                            ...curr,
                            timestamp: curr.timestamp + renkoData.length * 100, 
                            open:   lastBrickOpen,
                            close:  lastBrickClose,
                            high:   bHigh,
                            low:    bLow,
                            volume: curr.volume,
                        });

                        // Reset râu nến cho chu kỳ đo tiếp theo
                        runningHigh = lastBrickClose;
                        runningLow  = lastBrickClose;
                    }
                } while (brickAdded);
            }

            // Lưu lại state chuẩn xác cho Nến Realtime
            this._renkoState = { 
                brickSize, trendThreshold, openOffset, 
                lastBrickClose, lastBrickOpen, lastDir, 
                lastTimestamp: renkoData[renkoData.length-1].timestamp, 
                isClassic 
            };
            return renkoData;
        },

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

        // ==========================================
        // 🚀 CƠ CHẾ AUTO-BAKE REALTIME (FIX BUG GIẬT NẾN)
        // ==========================================
        _updateRenkoTick: function(curr, chartData, config) {
            const state = this._renkoState;
            if (!state) return curr; 

            const price = curr.close;
            const ghost = { ...curr };

            // Tránh đè timestamp
            ghost.timestamp = state.lastTimestamp + 100;

            // Xác định điểm mở cửa của nến ảo
            if (state.lastDir === 1) {
                ghost.open = (price >= state.lastBrickClose)
                    ? state.lastBrickClose - state.openOffset   
                    : state.lastBrickClose + state.openOffset;  
            } else {
                ghost.open = (price <= state.lastBrickClose)
                    ? state.lastBrickClose + state.openOffset   
                    : state.lastBrickClose - state.openOffset;  
            }

            ghost.close = price;

            // 🚀 ÁP DỤNG LUẬT CẠO RÂU LÊN NẾN ẢO (GHOST)
            if (state.isClassic) {
                ghost.high = Math.max(ghost.open, ghost.close);
                ghost.low  = Math.min(ghost.open, ghost.close);
            } else {
                let ghostDir = ghost.close >= ghost.open ? 1 : -1;
                if (ghostDir === 1) { // Tăng
                    ghost.high = Math.max(ghost.open, ghost.close); // Phẳng đỉnh
                    ghost.low  = Math.min(ghost.open, ghost.close, curr.low);
                } else {              // Giảm
                    ghost.high = Math.max(ghost.open, ghost.close, curr.high);
                    ghost.low  = Math.min(ghost.open, ghost.close); // Phẳng đáy
                }
            }

            // 🎯 LOGIC TỰ ĐỘNG CHỐT SỔ (PHÂN BIỆT RÕ CLASSIC VÀ NINZA)
            let shouldBake = false;
            
            if (state.isClassic) {
                // Classic: Đảo chiều cần biên độ gấp đôi (2x BrickSize)
                if (state.lastDir === 1) {
                    if (price >= state.lastBrickClose + state.brickSize || price <= state.lastBrickOpen - state.brickSize) shouldBake = true;
                } else {
                    if (price <= state.lastBrickClose - state.brickSize || price >= state.lastBrickOpen + state.brickSize) shouldBake = true;
                }
            } else {
                // Ninza: Đối xứng 2 chiều (Chỉ cần 1x Threshold)
                if (price >= state.lastBrickClose + state.trendThreshold || price <= state.lastBrickClose - state.trendThreshold) shouldBake = true;
            }

            if (shouldBake) {
                // Ép hệ thống ghi nhận tick gây đảo chiều/tiếp diễn vĩnh viễn
                this.rawHistory.push({
                    timestamp: curr.timestamp + this.rawHistory.length, 
                    open: price, high: price, low: price, close: price, volume: curr.volume || 0
                });

                if (window._renkoBakeTimeout) clearTimeout(window._renkoBakeTimeout);
                window._renkoBakeTimeout = setTimeout(() => {
                    if (window.WaveChartEngine && window.WA_Chart) {
                        let reprocessed = this.processHistory(this.rawHistory, true);
                        window.WA_Chart.applyNewData(reprocessed);
                    }
                }, 5); 
            }

            return ghost;
        }
    };

    // Lắng nghe thay đổi Cài đặt để kích hoạt vẽ lại
    window.addEventListener('wa_chart_config_updated', (e) => {
        const config = e.detail;
        if (global.WaveDataEngine && config.chartType !== global.WaveDataEngine.lastChartType) {
            global.WaveDataEngine.lastChartType = config.chartType;
            if (window.WA_Chart && global.WaveDataEngine.rawHistory.length > 0) {
                window._waTargetCandle = null;
                window._waCurrentCandle = null;
                let reCookedData = global.WaveDataEngine.processHistory(global.WaveDataEngine.rawHistory, true);
                window.WA_Chart.applyNewData(reCookedData);
            }
        }
    });

})(window);