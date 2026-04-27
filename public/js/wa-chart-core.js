// ==========================================
// 🚀 FILE: public/js/wa-chart-core.js
// 🛡️ WAVE ALPHA CHART FIREWALL (GLOBAL WRAPPER V2 - FULL API)
// ==========================================

(function() {
    let _chartInstance = null;
    let _resizeObserver = null;

    window.WA_Chart = {
        init: function(containerId) {
            try {
                if (_chartInstance) this.destroy();
                if (!window.klinecharts) throw new Error("KLineCharts is missing!");

                _chartInstance = window.klinecharts.init(containerId);

                // 🛡️ TẮT VĨNH VIỄN TOOLTIP/LEGEND CANVAS (Chuẩn bị Task 2)
                _chartInstance.setStyles({
                    crosshair: { show: true },
                    indicator: { tooltip: { showRule: 'none' } },
                    candle: { tooltip: { showRule: 'none' } }
                });

                const container = document.getElementById(containerId);
                if (container) {
                    _resizeObserver = new ResizeObserver(() => {
                        try { if (_chartInstance) _chartInstance.resize(); } catch(e){}
                    });
                    _resizeObserver.observe(container);
                }
                console.log('[WA_Chart] Firewall Active. No direct KLC allowed.');
                return true;
            } catch(e) {
                console.error('[WA_Chart] Init Error', e);
                return false;
            }
        },

        destroy: function() {
            if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
            if (_chartInstance) { window.klinecharts.dispose(_chartInstance); _chartInstance = null; }
        },

        // ========================================================
        // 🛡️ CÁC CỔNG GIAO TIẾP ĐÃ ĐƯỢC KIỂM SOÁT (SAFE API)
        // ========================================================
        applyNewData: function(data) { try { if(_chartInstance) _chartInstance.applyNewData(data); } catch(e){} },
        updateData: function(data, append = false) { try { if(_chartInstance) { if(append) _chartInstance.updateData(data); else _chartInstance.applyNewData(data); } } catch(e){} },
        getDataList: function() { try { return _chartInstance ? _chartInstance.getDataList() : []; } catch(e){ return []; } },
        setStyles: function(styles) { try { if(_chartInstance) _chartInstance.setStyles(styles); } catch(e){} },
        subscribeAction: function(type, cb) { try { if(_chartInstance) _chartInstance.subscribeAction(type, cb); } catch(e){} },
        createIndicator: function(name, isStack, options) { try { if(_chartInstance) _chartInstance.createIndicator(name, isStack, options); } catch(e){} },
        removeIndicator: function(paneId, name) { try { if(_chartInstance) _chartInstance.removeIndicator(paneId, name); } catch(e){} },
        createOverlay: function(options) { try { if(_chartInstance) return _chartInstance.createOverlay(options); return null; } catch(e){ return null; } },
        removeOverlay: function(id) { try { if(_chartInstance) _chartInstance.removeOverlay(id); } catch(e){} },
        resize: function() { try { if(_chartInstance) _chartInstance.resize(); } catch(e){} },
        setPriceVolumePrecision: function(p, v) { try { if(_chartInstance) _chartInstance.setPriceVolumePrecision(p, v); } catch(e){} },
        convertToPixel: function(val, finder) { try { return _chartInstance ? _chartInstance.convertToPixel(val, finder) : null; } catch(e){ return null; } },

        // ========================================================
        // 🛡️ LÕI KIỂM SOÁT GIAO DIỆN NẾN
        // ========================================================
        setMainSeries: function(config) {
            try {
                if (!_chartInstance) return;
                // Xóa Custom Cũ để lách lỗi Deep Merge
                const CUSTOM_CHART_IDS = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE'];
                CUSTOM_CHART_IDS.forEach(id => { try { _chartInstance.removeIndicator('candle_pane', id); } catch(e){} });

                let kcChartType = 'candle_solid', isLine = false, hideCandle = false;

                if (config.chartType === 2) kcChartType = 'candle_stroke';
                else if (config.chartType === 3) kcChartType = 'ohlc';
                else if (config.chartType === 6 || config.chartType === 9) { kcChartType = 'area'; isLine = (config.chartType === 6); }

                if (config.chartType === 4) { _chartInstance.createIndicator('WA_COL_CHART', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 5) { _chartInstance.createIndicator('WA_HL_CHART', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 7) { _chartInstance.createIndicator('WA_LINE_MARKER', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 8) { _chartInstance.createIndicator('WA_STEP_LINE', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 10) { _chartInstance.createIndicator('WA_HLC_AREA', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 11) { _chartInstance.createIndicator('WA_BASELINE', true, {id: 'candle_pane'}); hideCandle = true; }

                const isHollow = (config.chartType === 2);
                const fUp = hideCandle ? 'transparent' : config.upColor;
                const fDown = hideCandle ? 'transparent' : config.downColor;
                const fNo = hideCandle ? 'transparent' : '#787b86';
                const fUpBd = hideCandle ? 'transparent' : (config.showBorder ? (config.borderIndependent ? config.borderUpColor : config.upColor) : (isHollow ? config.upColor : 'transparent'));
                const fDnBd = hideCandle ? 'transparent' : (config.showBorder ? (config.borderIndependent ? config.borderDownColor : config.downColor) : (isHollow ? config.downColor : 'transparent'));
                const fUpW = hideCandle ? 'transparent' : (config.showWick ? (config.wickIndependent ? config.wickUpColor : config.upColor) : 'transparent');
                const fDnW = hideCandle ? 'transparent' : (config.showWick ? (config.wickIndependent ? config.wickDownColor : config.downColor) : 'transparent');

                // Xử lý màu Area mờ an toàn
                const areaColorObj = (window.WaveChartEngine && window.WaveChartEngine._dimColor) 
                                     ? window.WaveChartEngine._dimColor(config.upColor, 0.25) 
                                     : config.upColor.replace(')', ', 0.25)').replace('rgb', 'rgba');

                const areaBgColor = (isLine || hideCandle) 
                    ? 'transparent' 
                    : [{offset: 0, color: areaColorObj}, {offset: 1, color: 'transparent'}];

                _chartInstance.setStyles({
                    candle: {
                        zLevel: 1, type: kcChartType,
                        bar: { upColor: fUp, downColor: fDown, noChangeColor: fNo, upBorderColor: fUpBd, downBorderColor: fDnBd, upWickColor: fUpW, downWickColor: fDnW },
                        area: { lineSize: 2, lineColor: hideCandle ? 'transparent' : config.upColor, backgroundColor: areaBgColor }
                    },
                    yAxis: { type: config.yAxisMode || 'normal' }
                });
                _chartInstance.setPaneOptions({ id: 'candle_pane', axisOptions: { type: config.yAxisMode } });
            } catch(error) { console.error('[WA_Chart] setMainSeries Error:', error); }
        }
    };
})();