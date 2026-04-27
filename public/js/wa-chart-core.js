// ==========================================
// 🚀 FILE: public/js/wa-chart-core.js
// 🛡️ WAVE ALPHA CHART FIREWALL (GLOBAL WRAPPER)
// ==========================================

(function() {
    // Private variables - Không lộ ra window
    let _chartInstance = null;
    let _resizeObserver = null;

    window.WA_Chart = {
        init: function(containerId) {
            try {
                if (_chartInstance) {
                    this.destroy();
                }
                
                // Khởi tạo KLineChart instance ẩn bên trong
                if (!window.klinecharts) {
                    throw new Error("KLineCharts library is not loaded!");
                }
                _chartInstance = window.klinecharts.init(containerId);
                
                // Tắt mặc định Tooltip/Legend Canvas của KLC (Chuẩn bị cho Task 2)
                _chartInstance.setStyles({
                    crosshair: { show: true },
                    indicator: { tooltip: { showRule: 'none' } },
                    candle: { tooltip: { showRule: 'none' } }
                });

                // Quản lý Resize tự động không rò rỉ bộ nhớ
                const container = document.getElementById(containerId);
                if (container) {
                    _resizeObserver = new ResizeObserver(() => {
                        try {
                            if (_chartInstance) _chartInstance.resize();
                        } catch (e) {
                            console.error('[WA_Chart] Resize Error:', e);
                        }
                    });
                    _resizeObserver.observe(container);
                }

                console.log('[WA_Chart] Firewall Initialized successfully.');
                return true;
            } catch (error) {
                console.error('[WA_Chart] Init Error:', error);
                return false;
            }
        },

        destroy: function() {
            try {
                if (_resizeObserver) {
                    _resizeObserver.disconnect();
                    _resizeObserver = null;
                }
                if (_chartInstance) {
                    window.klinecharts.dispose(_chartInstance);
                    _chartInstance = null;
                }
                console.log('[WA_Chart] Instance destroyed cleanly.');
            } catch (error) {
                console.error('[WA_Chart] Destroy Error:', error);
            }
        },

        updateData: function(data, isAppend = false) {
            try {
                if (!_chartInstance) return;
                if (isAppend) {
                    _chartInstance.updateData(data);
                } else {
                    _chartInstance.applyNewData(data);
                }
            } catch (error) {
                console.error('[WA_Chart] UpdateData Error:', error);
            }
        },

        getDataList: function() {
            try {
                if (!_chartInstance) return [];
                return _chartInstance.getDataList();
            } catch (error) {
                console.error('[WA_Chart] getDataList Error:', error);
                return [];
            }
        },

        setMainSeries: function(config) {
            try {
                if (!_chartInstance) return;

                // [KLC-BUG] Workaround: Lỗi Deep Merge của KLineCharts khi thay đổi thuộc tính nến.
                // Giải pháp: Dọn dẹp sạch sẽ các Custom Indicator cũ trên pane chính trước khi vẽ lại.
                const CUSTOM_CHART_IDS = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE'];
                CUSTOM_CHART_IDS.forEach(id => { 
                    try { 
                        _chartInstance.removeIndicator('candle_pane', id); 
                    } catch (e) {} 
                });

                let kcChartType = 'candle_solid';
                let isLine = false;
                let hideCandle = false;

                // Xử lý Native Chart
                if (config.chartType === 2) kcChartType = 'candle_stroke';
                else if (config.chartType === 3) kcChartType = 'ohlc';
                else if (config.chartType === 6 || config.chartType === 9) { 
                    kcChartType = 'area'; 
                    isLine = (config.chartType === 6); 
                }

                // Xử lý Custom Chart (Gắn vào candle_pane và ẩn nến gốc)
                if (config.chartType === 4)  { _chartInstance.createIndicator('WA_COL_CHART',   true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 5)  { _chartInstance.createIndicator('WA_HL_CHART',    true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 7)  { _chartInstance.createIndicator('WA_LINE_MARKER', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 8)  { _chartInstance.createIndicator('WA_STEP_LINE',   true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 10) { _chartInstance.createIndicator('WA_HLC_AREA',    true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 11) { _chartInstance.createIndicator('WA_BASELINE',    true, {id: 'candle_pane'}); hideCandle = true; }

                const isHollow = (config.chartType === 2);
                const finalUpColor = hideCandle ? 'transparent' : config.upColor;
                const finalDownColor = hideCandle ? 'transparent' : config.downColor;
                const finalNoChange = hideCandle ? 'transparent' : '#787b86';
                const finalUpBorder = hideCandle ? 'transparent' : (config.showBorder ? (config.borderIndependent ? config.borderUpColor : config.upColor) : (isHollow ? config.upColor : 'transparent'));
                const finalDownBorder = hideCandle ? 'transparent' : (config.showBorder ? (config.borderIndependent ? config.borderDownColor : config.downColor) : (isHollow ? config.downColor : 'transparent'));
                const finalUpWick = hideCandle ? 'transparent' : (config.showWick ? (config.wickIndependent ? config.wickUpColor : config.upColor) : 'transparent');
                const finalDownWick = hideCandle ? 'transparent' : (config.showWick ? (config.wickIndependent ? config.wickDownColor : config.downColor) : 'transparent');

                const areaBgColor = (isLine || hideCandle) 
                    ? 'transparent' 
                    : [{offset: 0, color: config.upColor.replace(')', ', 0.25)').replace('rgb', 'rgba')}, {offset: 1, color: 'transparent'}]; // Tạm xử lý màu gradient đơn giản ở wrapper

                const styles = {
                    candle: {
                        zLevel: 1,
                        type: kcChartType,
                        bar: {
                            upColor: finalUpColor,   
                            downColor: finalDownColor,
                            noChangeColor: finalNoChange,
                            upBorderColor: finalUpBorder,  
                            downBorderColor: finalDownBorder,
                            upWickColor: finalUpWick,    
                            downWickColor: finalDownWick
                        },
                        area: {
                            lineSize: 2,
                            lineColor: hideCandle ? 'transparent' : config.upColor,
                            backgroundColor: areaBgColor
                        }
                    },
                    yAxis: {
                        type: config.yAxisMode || 'normal'
                    }
                };

                _chartInstance.setStyles(styles);
                _chartInstance.setPaneOptions({ id: 'candle_pane', axisOptions: { type: config.yAxisMode } });

            } catch (error) {
                console.error('[WA_Chart] setMainSeries Error:', error);
            }
        }
    };
})();