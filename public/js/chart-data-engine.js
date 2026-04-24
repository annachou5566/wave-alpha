// =========================================================================
// 🧮 BƯỚC 6: WAVE DATA ENGINE (ĐỘNG CƠ BIẾN ĐỔI DỮ LIỆU PHA 2)
// File: public/js/chart-data-engine.js
// =========================================================================
(function (global) {
    'use strict';

    global.WaveDataEngine = {
        rawHistory: [],

        processHistory: function (rawData) {
            if (!rawData || rawData.length === 0) return [];
            this.rawHistory = JSON.parse(JSON.stringify(rawData)); 

            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config) return rawData;

            if (config.chartType === 12) {
                console.log('[WaveDataEngine] 🪄 Biến đổi Lịch sử -> Heikin Ashi');
                return this._toHeikinAshi(rawData);
            }
            return rawData; 
        },

        processTick: function (rawTick, currentChartData) {
            const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
            if (!config || !currentChartData || currentChartData.length === 0) return rawTick;

            if (config.chartType === 12) {
                return this._updateHeikinAshiTick(rawTick, currentChartData);
            }
            return rawTick;
        },

        // 🧪 THUẬT TOÁN HEIKIN ASHI
        _toHeikinAshi: function (data) {
            let haData = [];
            for (let i = 0; i < data.length; i++) {
                let curr = data[i];
                let ha = { ...curr };
                ha.close = (curr.open + curr.high + curr.low + curr.close) / 4;

                if (i === 0) {
                    ha.open = (curr.open + curr.close) / 2;
                    ha.high = curr.high; ha.low = curr.low;
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

            // 🚀 Thuật toán thông minh: Nhận biết nến mới hay update nến hiện tại
            if (curr.timestamp === lastRendered.timestamp) {
                prevHA = chartData.length > 1 ? chartData[chartData.length - 2] : lastRendered;
            } else {
                prevHA = lastRendered; // Đã sang nến mới
            }

            let ha = { ...curr };
            ha.close = (curr.open + curr.high + curr.low + curr.close) / 4;
            ha.open = (prevHA.open + prevHA.close) / 2;
            ha.high = Math.max(curr.high, ha.open, ha.close);
            ha.low = Math.min(curr.low, ha.open, ha.close);
            
            return ha;
        }
    };
})(window);