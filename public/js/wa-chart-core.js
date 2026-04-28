// ==========================================
// 🚀 FILE: public/js/wa-chart-core.js
// 🛡️ WAVE ALPHA CHART FIREWALL (GLOBAL WRAPPER)
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

                // 🛡️ BẮT CẦU TƯƠNG THÍCH NGƯỢC (Lừa các file cũ không bị crash)
                //window.tvChart = this;

                // 🛡️ CẤU HÌNH LEGEND TÁCH BIỆT: Tắt nến (Dùng HTML) - Bật Indicator (Đẩy margin xuống 26px)
                // 🛡️ CẤU HÌNH LEGEND TÁCH BIỆT: Nến tàng hình giữ chỗ - Indicator hiện chuẩn khít rịt
                _chartInstance.setStyles({
                    crosshair: { show: true },
                    indicator: { 
                        tooltip: { 
                            showRule: 'always',
                            showType: 'standard',
                            text: { 
                                size: 12, family: 'Arial, sans-serif', weight: 600, color: '#848e9c', 
                                // 🚀 Căn lề Text chuẩn
                                marginLeft: 8, marginTop: 8, marginRight: 0, marginBottom: 0 
                            },
                            icons: [
                                // Hiện khi đang TẮT (Click để Mở) -> Dùng Mắt Nhắm có gạch (\uf070)
                                { id: 'visible', position: 'middle', marginLeft: 8, marginTop: 8, marginRight: 0, marginBottom: 0, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf070', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 11, color: '#848e9c', activeColor: '#00F0FF', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(0,240,255,0.1)' },
                                
                                // Hiện khi đang MỞ (Click để Tắt) -> Dùng Mắt Mở không gạch (\uf06e)
                                { id: 'invisible', position: 'middle', marginLeft: 8, marginTop: 8, marginRight: 0, marginBottom: 0, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf06e', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 11, color: '#848e9c', activeColor: '#00F0FF', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(0,240,255,0.1)' },
                                
                                { id: 'setting', position: 'middle', marginLeft: 6, marginTop: 8, marginRight: 0, marginBottom: 0, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf013', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 11, color: '#848e9c', activeColor: '#F0B90B', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(240,185,11,0.1)' },
                                
                                { id: 'close', position: 'middle', marginLeft: 6, marginTop: 8, marginRight: 0, marginBottom: 0, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf00d', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 12, color: '#848e9c', activeColor: '#F6465D', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(246,70,93,0.1)' }
                            ]
                        } 
                    },
                    candle: { 
                        type: 'candle_solid', 
                        tooltip: { 
                            showRule: 'always',
                            showType: 'standard',
                            custom: function() {
                                return [{ title: { text: ' ', color: 'transparent' }, value: { text: ' ', color: 'transparent' } }];
                            },
                            text: { 
                                size: 12, family: 'Arial, sans-serif', weight: 600, color: 'transparent',
                                marginLeft: 10, marginTop: 8, marginRight: 0, marginBottom: 0 
                            }
                        } 
                    }
                });

                const container = document.getElementById(containerId);
                if (container) {
                    _resizeObserver = new ResizeObserver(() => {
                        try { if (_chartInstance) _chartInstance.resize(); } catch(e){}
                    });
                    _resizeObserver.observe(container);
                }
                console.log('[WA_Chart] Firewall Active. Backward compatibility ON.');
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
        
        // Đã xóa tham số append=false gây lỗi zoom 1 nến
        updateData: function(data) { try { if(_chartInstance) _chartInstance.updateData(data); } catch(e){} }, 
        
        getDataList: function() { try { return _chartInstance ? _chartInstance.getDataList() : []; } catch(e){ return []; } },
        setStyles: function(styles) { try { if(_chartInstance) _chartInstance.setStyles(styles); } catch(e){} },
        subscribeAction: function(type, cb) { try { if(_chartInstance) _chartInstance.subscribeAction(type, cb); } catch(e){} },
        createIndicator: function(name, isStack, options) { try { if(_chartInstance) _chartInstance.createIndicator(name, isStack, options); } catch(e){} },
        removeIndicator: function(paneId, name) { try { if(_chartInstance) _chartInstance.removeIndicator(paneId, name); } catch(e){} },
        overrideIndicator: function(override, paneId) { try { if(_chartInstance) _chartInstance.overrideIndicator(override, paneId); } catch(e){} },
        getIndicators: function(options) { try { return _chartInstance ? _chartInstance.getIndicators(options) : []; } catch(e){ return []; } },
        createOverlay: function(options) { try { if(_chartInstance) return _chartInstance.createOverlay(options); return null; } catch(e){ return null; } },
        removeOverlay: function(id) { try { if(_chartInstance) _chartInstance.removeOverlay(id); } catch(e){} },
        resize: function() { try { if(_chartInstance) _chartInstance.resize(); } catch(e){} },
        setPriceVolumePrecision: function(p, v) { try { if(_chartInstance) _chartInstance.setPriceVolumePrecision(p, v); } catch(e){} },
        convertToPixel: function(val, finder) { try { return _chartInstance ? _chartInstance.convertToPixel(val, finder) : null; } catch(e){ return null; } },

        // 🚀 BỔ SUNG 5 API CÒN THIẾU ĐỂ HỆ THỐNG VẼ DRAWING HOẠT ĐỘNG
        cancelDrawing: function() { try { if(_chartInstance) _chartInstance.cancelDrawing(); } catch(e){} },
        overrideOverlay: function(override) { try { if(_chartInstance) _chartInstance.overrideOverlay(override); } catch(e){} },
        getOverlayById: function(id) { try { return _chartInstance ? _chartInstance.getOverlayById(id) : null; } catch(e){ return null; } },
        convertFromPixel: function(coordinate, finder) { try { return _chartInstance ? _chartInstance.convertFromPixel(coordinate, finder) : null; } catch(e){ return null; } },
        getChartStore: function() { try { return _chartInstance ? _chartInstance.getChartStore() : null; } catch(e){ return null; } },
// 🚀 BỔ SUNG CÁC API BỊ THIẾU GÂY LỖI NGẦM (GIẬT CHART, LỖI TIMEZONE)
getOffsetRightDistance: function() { try { return _chartInstance ? _chartInstance.getOffsetRightDistance() : 0; } catch(e){ return 0; } },
setOffsetRightDistance: function(distance) { try { if(_chartInstance) _chartInstance.setOffsetRightDistance(distance); } catch(e){} },
setTimezone: function(tz) { try { if(_chartInstance) _chartInstance.setTimezone(tz); } catch(e){} },
        // ========================================================
        // 🛡️ LÕI KIỂM SOÁT GIAO DIỆN NẾN
        // ========================================================
        setMainSeries: function(config) {
            try {
                if (!_chartInstance) return;
                
                const CUSTOM_CHART_IDS = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE'];
                CUSTOM_CHART_IDS.forEach(id => { try { _chartInstance.removeIndicator('candle_pane', id); } catch(e){} });

                let kcChartType = 'candle_solid', isLine = false, hideCandle = false;

                if (config.chartType === 2) kcChartType = 'candle_stroke';
                else if (config.chartType === 3) kcChartType = 'ohlc';
                else if (config.chartType === 6 || config.chartType === 9) { kcChartType = 'area'; isLine = (config.chartType === 6); }
                else if (config.chartType === 14) kcChartType = 'candle_solid'; // Kích hoạt nến đặc cho Renko

                if (config.chartType === 4) { _chartInstance.createIndicator('WA_COL_CHART', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 5) { _chartInstance.createIndicator('WA_HL_CHART', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 7) { _chartInstance.createIndicator('WA_LINE_MARKER', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 8) { _chartInstance.createIndicator('WA_STEP_LINE', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 10) { _chartInstance.createIndicator('WA_HLC_AREA', true, {id: 'candle_pane'}); hideCandle = true; }
                else if (config.chartType === 11) { _chartInstance.createIndicator('WA_BASELINE', true, {id: 'candle_pane'}); hideCandle = true; }

                const isHollow = (config.chartType === 2);
                const forceHideWick = false; // 🚀 TRẢ LẠI RÂU NẾN CHO RENKO NINJATRADER

                const fUp = hideCandle ? 'transparent' : config.upColor;
                const fDown = hideCandle ? 'transparent' : config.downColor;
                const fNo = hideCandle ? 'transparent' : '#787b86';
                const fUpBd = hideCandle ? 'transparent' : (config.showBorder ? (config.borderIndependent ? config.borderUpColor : config.upColor) : (isHollow ? config.upColor : 'transparent'));
                const fDnBd = hideCandle ? 'transparent' : (config.showBorder ? (config.borderIndependent ? config.borderDownColor : config.downColor) : (isHollow ? config.downColor : 'transparent'));
                
                // Ép transparent râu nến nếu là Renko
                const fUpW = (hideCandle || forceHideWick) ? 'transparent' : (config.showWick ? (config.wickIndependent ? config.wickUpColor : config.upColor) : 'transparent');
                const fDnW = (hideCandle || forceHideWick) ? 'transparent' : (config.showWick ? (config.wickIndependent ? config.wickDownColor : config.downColor) : 'transparent');

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