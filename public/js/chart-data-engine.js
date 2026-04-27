// =========================================================================
// 🧮 BƯỚC 6: WAVE DATA ENGINE (TỰ ĐỘNG RE-RENDER KHI ĐỔI LOẠI NẾN)
// File: public/js/chart-data-engine.js
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
            
            // 🚀 KÍCH HOẠT ĐỘNG CƠ SMART NINZARENKO (ID 14)
            if (cType === 14) return this._toRenko(this.rawHistory, config);
            
            return JSON.parse(JSON.stringify(this.rawHistory)); 
        },

        processTick: function (rawTick, currentChartData) {
            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config || !currentChartData || currentChartData.length === 0) return rawTick;

            const cType = parseInt(config.chartType);
            if (cType === 12) return this._updateHeikinAshiTick(rawTick, currentChartData);
            
            // 🚀 ÉP KHUÔN REALTIME CHO NINZARENKO
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
            let prevHA;
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
        },

        // ==========================================
        // 🧱 THUẬT TOÁN SMART NINZARENKO
        // ==========================================
        _toRenko: function(data, config) {
            let renkoData = [];
            if (!data || data.length === 0) return renkoData;

            // 1. TÍNH KÍCH THƯỚC GẠCH (Brick Size)
            let method = config.renkoMethod || 'atr';
            let brickSize = 1;

            if (method === 'atr') {
                brickSize = this._calculateATR(data, config.renkoAtrLength || 14);
            } else if (method === 'percentage') {
                brickSize = data[0].close * ((config.renkoPercentage || 1.0) / 100);
            } else {
                brickSize = config.renkoBoxSize || 10;
            }
            if (brickSize <= 0) brickSize = data[0].close * 0.001;

            // 2. TÍNH NGƯỠNG ĐẢO CHIỀU BẰNG PHẦN TRĂM (%) 
            // Giải quyết triệt để lỗi khác biệt Token
            let pct = parseFloat(config.renkoTrendPct);
            if (isNaN(pct) || pct <= 0) pct = 50; // Mặc định chuẩn 50%
            
            // Tính ra Trend Threshold thực tế dựa trên phần trăm của Brick Size
            let trendThreshold = brickSize * (pct / 100);
            let openOffset = brickSize - trendThreshold;

            // 3. Khởi tạo
            let lastBrickClose = data[0].close;
            let lastBrickOpen  = lastBrickClose - brickSize;
            let lastDir        = 1; 

            let runningHigh = data[0].high;
            let runningLow  = data[0].low;

            renkoData.push({
                ...data[0],
                open:  lastBrickOpen,
                close: lastBrickClose,
                high:  Math.max(lastBrickOpen, lastBrickClose, runningHigh),
                low:   Math.min(lastBrickOpen, lastBrickClose, runningLow),
            });

            // 4. Vòng lặp đúc gạch
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
                        if (price >= lastBrickClose + trendThreshold) { // Lên tiếp
                            lastBrickOpen  = lastBrickClose - openOffset;
                            lastBrickClose = lastBrickOpen  + brickSize; 
                            lastDir = 1;
                            brickAdded = true;
                        } else if (price <= lastBrickClose - trendThreshold) { // Đảo chiều xuống
                            lastBrickOpen  = lastBrickClose + openOffset;
                            lastBrickClose = lastBrickOpen  - brickSize; 
                            lastDir = -1;
                            brickAdded = true;
                        }
                    } else {
                        if (price <= lastBrickClose - trendThreshold) { // Xuống tiếp
                            lastBrickOpen  = lastBrickClose + openOffset;
                            lastBrickClose = lastBrickOpen  - brickSize;
                            lastDir = -1;
                            brickAdded = true;
                        } else if (price >= lastBrickClose + trendThreshold) { // Đảo chiều lên
                            lastBrickOpen  = lastBrickClose - openOffset;
                            lastBrickClose = lastBrickOpen  + brickSize;
                            lastDir = 1;
                            brickAdded = true;
                        }
                    }

                    if (brickAdded) {
                        renkoData.push({
                            ...curr,
                            timestamp: curr.timestamp + renkoData.length * 100, 
                            open:   lastBrickOpen,
                            close:  lastBrickClose,
                            high:   Math.max(lastBrickOpen, lastBrickClose, runningHigh),
                            low:    Math.min(lastBrickOpen, lastBrickClose, runningLow),
                            volume: curr.volume,
                        });
                        runningHigh = Math.max(lastBrickOpen, lastBrickClose);
                        runningLow  = Math.min(lastBrickOpen, lastBrickClose);
                    }
                } while (brickAdded); 
            }

            // 5. CẤT VÀO BỘ NHỚ
            this._renkoState = {
                brickSize: brickSize,
                trendThreshold: trendThreshold,
                openOffset: openOffset,
                lastBrickClose: lastBrickClose,
                lastDir: lastDir,
                lastTimestamp: renkoData[renkoData.length - 1].timestamp
            };

            return renkoData.length > 1 ? renkoData : data;
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
        // 🚀 CƠ CHẾ AUTO-BAKE CHỐT NẾN
        // ==========================================
        _updateRenkoTick: function(curr, chartData, config) {
            const state = this._renkoState;
            if (!state) return curr; 

            const price = curr.close;
            const ghost = { ...curr };

            ghost.timestamp = state.lastTimestamp + 100;

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
            ghost.high = Math.max(ghost.open, ghost.close, curr.high);
            ghost.low  = Math.min(ghost.open, ghost.close, curr.low);

            let shouldBake = false;
            if (state.lastDir === 1) {
                if (price >= state.lastBrickClose + state.trendThreshold || price <= state.lastBrickClose - state.trendThreshold) shouldBake = true;
            } else {
                if (price <= state.lastBrickClose - state.trendThreshold || price >= state.lastBrickClose + state.trendThreshold) shouldBake = true;
            }

            if (shouldBake) {
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