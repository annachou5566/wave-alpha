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
        _renkoState: null,
        _isBaking: false, // Cờ chặn việc nấu gạch chồng chéo gây lag

        processHistory: function (rawData, isReapply = false) {
            if (!rawData || rawData.length === 0) return [];
            
            // 1. Cập nhật lịch sử và ép kiểu dữ liệu
            if (!isReapply) {
                this.rawHistory = JSON.parse(JSON.stringify(rawData)); 
            }

            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config) return JSON.parse(JSON.stringify(this.rawHistory));

            const cType = parseInt(config.chartType);
            this.lastChartType = cType;

            // 2. Dọn dẹp trạng thái cũ nếu không phải nến Renko
            if (cType !== 14) {
                this._renkoState = null;
            }

            if (cType === 12) return this._toHeikinAshi(this.rawHistory);
            if (cType === 14) return this._toRenko(this.rawHistory, config);
            
            return JSON.parse(JSON.stringify(this.rawHistory)); 
        },

        processTick: function (rawTick, currentChartData) {
            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config || !currentChartData || currentChartData.length === 0) return rawTick;

            const cType = parseInt(config.chartType);
            
            // TRỐNG LỖI: Nếu không ở chế độ nến đặc biệt, trả về tick gốc ngay lập tức
            if (cType === 12) return this._updateHeikinAshiTick(rawTick, currentChartData);
            if (cType === 14) return this._updateRenkoTick(rawTick, currentChartData, config);

            return rawTick;
        },

        // ... (Giữ nguyên hàm _toHeikinAshi và _updateHeikinAshiTick của bạn) ...

        _toRenko: function(data, config) {
            let renkoData = [];
            if (!data || data.length === 0) return renkoData;

            // 1. ÉP KIỂU TUYỆT ĐỐI: Chống lỗi cộng chuỗi gây sập web
            let method = config.renkoMethod || 'atr';
            let brickSize = 1;
            if (method === 'atr') {
                brickSize = this._calculateATR(data, parseInt(config.renkoAtrLength) || 14);
            } else if (method === 'percentage') {
                brickSize = data[0].close * ((parseFloat(config.renkoPercentage) || 1.0) / 100);
            } else {
                brickSize = parseFloat(config.renkoBoxSize) || 10;
            }

            // 2. TỰ ĐỘNG CÂN CHỈNH QUY MÔ (Auto-Scale)
            let maxHigh = data[0].high, minLow = data[0].low;
            for (let i = 1; i < data.length; i++) {
                if (data[i].high > maxHigh) maxHigh = data[i].high;
                if (data[i].low < minLow) minLow = data[i].low;
            }
            let priceRange = maxHigh - minLow;
            let minSafeSize = priceRange > 0 ? (priceRange / 5000) : (data[0].close * 0.0001);
            
            if (brickSize < minSafeSize) brickSize = minSafeSize;

            const isClassic = (config.renkoStyle === 'classic'); 
            let pct = parseFloat(config.renkoTrendPct) || 50;
            let trendThreshold = isClassic ? brickSize : brickSize * (pct / 100);
            let openOffset = brickSize - trendThreshold;

            // 3. KHỞI TẠO VÒNG LẶP
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

            for (let i = 1; i < data.length; i++) {
                const curr = data[i];
                const price = (config.renkoSource === 'ohlc') ? (curr.high + curr.low + curr.close) / 3 : curr.close;
                
                // 🛡️ BỘ LỌC RÂU MA (SCAM WICK FILTER): Cắt râu tối đa 5 lần gạch
                const maxWick = brickSize * 5;
                const safeHigh = Math.min(curr.high, price + maxWick);
                const safeLow  = Math.max(curr.low, price - maxWick);

                runningHigh = Math.max(runningHigh, safeHigh);
                runningLow  = Math.min(runningLow, safeLow);

                let brickAdded;
                let loopGuard = 0; 
                do {
                    brickAdded = false;
                    loopGuard++;
                    if (loopGuard > 1000) {
                        // 🛡️ TELEPORT: Ép neo gạch về giá hiện tại để tránh nến khổng lồ kéo sập UI
                        lastBrickClose = price;
                        lastBrickOpen = lastDir === 1 ? price - brickSize : price + brickSize;
                        
                        // 🚀 FIX LỖI NÁ CAO SU: Phải dịch chuyển luôn cả Râu Nến (Wick)
                        // Nếu không, viên gạch tiếp theo sẽ có cái râu nối ngược lên tận đỉnh cũ (0.5)!
                        runningHigh = lastBrickClose;
                        runningLow  = lastBrickClose;
                        
                        break; 
                    }

                    if (lastDir === 1) { 
                        if (price >= lastBrickClose + trendThreshold) {
                            lastBrickOpen  = lastBrickClose - (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  + brickSize; 
                            lastDir = 1; brickAdded = true;
                        } else if (price <= (isClassic ? lastBrickOpen - brickSize : lastBrickClose - trendThreshold)) {
                            lastBrickOpen  = lastBrickClose + (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  - brickSize; 
                            lastDir = -1; brickAdded = true;
                        }
                    } else { 
                        if (price <= lastBrickClose - trendThreshold) {
                            lastBrickOpen  = lastBrickClose + (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  - brickSize;
                            lastDir = -1; brickAdded = true;
                        } else if (price >= (isClassic ? lastBrickOpen + brickSize : lastBrickClose + trendThreshold)) {
                            lastBrickOpen  = lastBrickClose - (isClassic ? 0 : openOffset);
                            lastBrickClose = lastBrickOpen  + brickSize;
                            lastDir = 1; brickAdded = true;
                        }
                    }

                    if (brickAdded) {
                        let bHigh, bLow;
                        if (isClassic) {
                            bHigh = Math.max(lastBrickOpen, lastBrickClose);
                            bLow  = Math.min(lastBrickOpen, lastBrickClose);
                        } else {
                            if (lastDir === 1) { bHigh = lastBrickClose; bLow  = Math.min(lastBrickOpen, runningLow); }
                            else { bHigh = Math.max(lastBrickOpen, runningHigh); bLow  = lastBrickClose; }
                        }
                        renkoData.push({
                            ...curr,
                            timestamp: curr.timestamp + renkoData.length * 100, 
                            open: lastBrickOpen, close: lastBrickClose, high: bHigh, low: bLow, volume: curr.volume,
                        });
                        runningHigh = lastBrickClose; runningLow = lastBrickClose;
                    }
                } while (brickAdded);
            }

            // Lưu lại state mới để realtime sử dụng
            this._renkoState = { brickSize, trendThreshold, openOffset, lastBrickClose, lastBrickOpen, lastDir, lastTimestamp: renkoData[renkoData.length-1].timestamp, isClassic };
            return renkoData;
        },

        _updateRenkoTick: function(curr, chartData, config) {
            // CHỐT CHẶN 1: Nếu không phải nến Renko, thoát ngay
            if (parseInt(config.chartType) !== 14) return curr;

            const state = this._renkoState;
            if (!state) return curr; 

            const price = curr.close;
            const ghost = { ...curr, timestamp: state.lastTimestamp + 100 };

            // Tính toán nến ảo (Ghost candle)
            if (state.lastDir === 1) {
                ghost.open = (price >= state.lastBrickClose) ? state.lastBrickClose - state.openOffset : state.lastBrickClose + state.openOffset;  
            } else {
                ghost.open = (price <= state.lastBrickClose) ? state.lastBrickClose + state.openOffset : state.lastBrickClose - state.lastBrickClose - state.openOffset;  
            }
            ghost.close = price;

            // 🛡️ LỌC RÂU MA REALTIME
            const maxWick = state.brickSize * 5;
            const safeHigh = Math.min(curr.high, price + maxWick);
            const safeLow  = Math.max(curr.low, price - maxWick);

            // Áp dụng râu nến ảo (Đã tích hợp bộ lọc)
            if (state.isClassic) { 
                ghost.high = Math.max(ghost.open, ghost.close); 
                ghost.low = Math.min(ghost.open, ghost.close); 
            }
            else {
                let ghostDir = ghost.close >= ghost.open ? 1 : -1;
                if (ghostDir === 1) { 
                    ghost.high = Math.max(ghost.open, ghost.close); 
                    ghost.low = Math.min(ghost.open, ghost.close, safeLow); // 🛡️ Dùng safeLow thay cho curr.low
                }
                else { 
                    ghost.high = Math.max(ghost.open, ghost.close, safeHigh); // 🛡️ Dùng safeHigh thay cho curr.high
                    ghost.low = Math.min(ghost.open, ghost.close); 
                }
            }

            // KIỂM TRA ĐIỀU KIỆN CHỐT GẠCH
            let shouldBake = false;
            if (state.isClassic) {
                if (state.lastDir === 1) { if (price >= state.lastBrickClose + state.brickSize || price <= state.lastBrickOpen - state.brickSize) shouldBake = true; }
                else { if (price <= state.lastBrickClose - state.brickSize || price >= state.lastBrickOpen + state.brickSize) shouldBake = true; }
            } else {
                if (Math.abs(price - state.lastBrickClose) >= state.trendThreshold) shouldBake = true;
            }

            if (shouldBake && !this._isBaking) {
                this._isBaking = true; // Khóa bake
                this.rawHistory.push({ timestamp: curr.timestamp, open: price, high: price, low: price, close: price, volume: curr.volume || 0 });
                
                // GIỚI HẠN LỊCH SỬ: Tránh phình to khi test size nhỏ (tối đa 1000 nến gốc)
                if (this.rawHistory.length > 1000) this.rawHistory.shift();

                if (window._renkoBakeTimeout) clearTimeout(window._renkoBakeTimeout);
                window._renkoBakeTimeout = setTimeout(() => {
                    if (window.WA_Chart) {
                        let reprocessed = this.processHistory(this.rawHistory, true);
                        let currentList = window.WA_Chart.getDataList();
                        if (currentList && currentList.length > 0) {
                            let lastTime = currentList[currentList.length - 1].timestamp;
                            let newBricks = reprocessed.filter(c => c.timestamp >= lastTime);
                            for (let b of newBricks) window.WA_Chart.updateData(b);
                        } else {
                            window.WA_Chart.applyNewData(reprocessed);
                        }
                    }
                    this._isBaking = false; // Mở khóa
                }, 10); 
            }
            return ghost;
        },

        _calculateATR: function(data, length) {
            if (!data || data.length <= length) return (data?.[0]?.close ?? 1) * 0.005;
            let sumTR = 0;
            for (let i = 1; i <= length; i++) {
                const curr = data[data.length - i];
                const prev = data[data.length - i - 1];
                const tr = Math.max(curr.high - curr.low, Math.abs(curr.high - prev.close), Math.abs(curr.low - prev.close));
                sumTR += tr;
            }
            return sumTR / length;
        }
    };

    // Cập nhật Listener an toàn hơn (Cuối file)
    window.addEventListener('wa_chart_config_updated', (e) => {
        const config = e.detail;
        if (global.WaveDataEngine) {
            const isRenkoMode = (parseInt(config.chartType) === 14);
            const isTypeChanged = (config.chartType !== global.WaveDataEngine.lastChartType);

            if (isTypeChanged || isRenkoMode) {
                global.WaveDataEngine.lastChartType = config.chartType;
                if (window.WA_Chart && global.WaveDataEngine.rawHistory.length > 0) {
                    let reCookedData = global.WaveDataEngine.processHistory(global.WaveDataEngine.rawHistory, true);
                    window.WA_Chart.applyNewData(reCookedData);
                }
            }
        }
    });

})(window);