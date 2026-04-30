// ==========================================
// 🚀 FILE: public/js/wa-chart-core.js
// 🛡️ WAVE ALPHA CHART FIREWALL (GLOBAL WRAPPER) - GIAI ĐOẠN 2
// ==========================================

(function() {
    if (!document.getElementById('wa-multi-grid-css')) {
        const style = document.createElement('style');
        style.id = 'wa-multi-grid-css';
        style.innerHTML = `
            .wa-multi-grid-wrapper { display: grid; width: 100%; height: 100%; gap: 2px; background: #000; }
            .wa-layout-1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }
            .wa-layout-2-h { grid-template-columns: 1fr 1fr; }
            .wa-layout-2-v { grid-template-rows: 1fr 1fr; }
            .wa-layout-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
            .wa-layout-3 > div:first-child { grid-column: 1 / span 2; }
            .wa-layout-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
            .wa-layout-6 { grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr; }
            .wa-layout-8 { grid-template-columns: repeat(4, 1fr); grid-template-rows: 1fr 1fr; }
            .wa-layout-9 { grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); }
            .wa-chart-cell { position: relative; width: 100%; height: 100%; background: #131722; border: 1px solid transparent; }
            .wa-chart-cell.active-cell { border-color: #00F0FF; z-index: 5; }
        `;
        document.head.appendChild(style);
    }

    let _instances = {}; 
    let _activeId = null; 
    let _resizeObserver = null;
    let _isSyncingCrosshair = false; 

    window.WA_Chart = {
        get active() { return _instances[_activeId] || Object.values(_instances)[0] || null; },
        get instances() { return _instances; }, 
        get activeId() { return _activeId; },

        init: function(containerId) { return this.initMultiLayout(containerId, '1', 1); },

        initMultiLayout: function(mainContainerId, layoutType = '1', cellCount = 1) {
            try {
                this.destroy(); 
                if (!window.klinecharts) throw new Error("KLineCharts is missing!");

                const mainContainer = document.getElementById(mainContainerId);
                if (!mainContainer) return false;

                mainContainer.innerHTML = '';
                const gridWrapper = document.createElement('div');
                gridWrapper.className = `wa-multi-grid-wrapper wa-layout-${layoutType}`;
                mainContainer.appendChild(gridWrapper);

                _resizeObserver = new ResizeObserver(() => {
                    Object.values(_instances).forEach(chart => { try { chart.resize(); } catch(e){} });
                });
                _resizeObserver.observe(mainContainer);

                for (let i = 0; i < cellCount; i++) {
                    const cellId = `wa-chart-cell-${i}`;
                    const cell = document.createElement('div');
                    cell.id = cellId;
                    cell.className = `wa-chart-cell ${i === 0 ? 'active-cell' : ''}`;
                    
                    cell.addEventListener('mousedown', () => this.setActiveChart(cellId));
                    gridWrapper.appendChild(cell);
                    
                    // 🚀 PHÉP MÀU NẰM Ở ĐÂY: BƠM OHLC & WATERMARK VÀO TỪNG Ô ĐỘC LẬP
                    const uiLayer = document.createElement('div');
                    uiLayer.className = 'wa-custom-ui-layer';
                    uiLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; display: flex; flex-direction: column; justify-content: space-between; padding: 6px 10px;';
                    
                    uiLayer.innerHTML = `
                        <div style="font-family: Arial, sans-serif; font-size: 12px; font-weight: 600; display: flex; gap: 8px; flex-wrap: wrap; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                            <span id="wa-sym-${cellId}" style="color: #EAECEF; margin-right: 4px;">---</span>
                            <span><span style="color: #848e9c;">O</span> <span id="wa-o-${cellId}" style="color: #848e9c;">---</span></span>
                            <span><span style="color: #848e9c;">H</span> <span id="wa-h-${cellId}" style="color: #0ECB81;">---</span></span>
                            <span><span style="color: #848e9c;">L</span> <span id="wa-l-${cellId}" style="color: #F6465D;">---</span></span>
                            <span><span style="color: #848e9c;">C</span> <span id="wa-c-${cellId}" style="color: #848e9c;">---</span></span>
                            <span><span style="color: #848e9c;">V</span> <span id="wa-v-${cellId}" style="color: #848e9c;">---</span></span>
                        </div>
                        <div id="wa-wm-${cellId}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Inter', sans-serif; font-weight: 800; font-size: clamp(20px, 4vw, 60px); color: rgba(255,255,255,0.05); letter-spacing: 2px; white-space: nowrap;">WAVE ALPHA</div>
                    `;
                    cell.appendChild(uiLayer);

                    const chart = window.klinecharts.init(cell);
                    if (chart) {
                        this._applyDefaultStyles(chart); 
                        _instances[cellId] = chart;
                        if (i === 0) _activeId = cellId; 
                        
                        chart._waIsHovering = false; // Phân biệt rê chuột độc lập

                        // 🚀 FIX LỖI LIỆT NÚT CHỈ BÁO TRÊN TỪNG Ô
                        chart.subscribeAction('onTooltipIconClick', function(data) {
                            if (!data.indicatorName) return;
                            const indName = data.indicatorName; const paneId = data.paneId;
                            if (data.iconId === 'visible') chart.overrideIndicator({ name: indName, visible: true }, paneId);
                            else if (data.iconId === 'invisible') chart.overrideIndicator({ name: indName, visible: false }, paneId);
                            else if (data.iconId === 'close') chart.removeIndicator(paneId, indName);
                            else if (data.iconId === 'setting') {
                                if (typeof window.openIndicatorSettings === 'function') {
                                    let calcParams;
                                    try {
                                        const inds = chart.getIndicators({ name: indName, paneId: paneId });
                                        if (inds && inds.length > 0) calcParams = inds[0].calcParams;
                                    } catch(e) {}
                                    window.openIndicatorSettings({ name: indName, shortName: indName, calcParams: calcParams }, paneId);
                                }
                            }
                        });

                        // 🚀 ĐỒNG BỘ CROSSHAIR LÊN ĐÚNG Ô CỦA NÓ
                        chart.subscribeAction('onCrosshairChange', (param) => {
                            if (!param || param.dataIndex === undefined || param.dataIndex < 0) {
                                chart._waIsHovering = false;
                                const dataList = chart.getDataList();
                                if (dataList && dataList.length > 0) {
                                    window.WA_Chart.updateLegendSpecific(cellId, dataList[dataList.length - 1]);
                                }
                            } else {
                                chart._waIsHovering = true;
                                const dataList = chart.getDataList();
                                window.WA_Chart.updateLegendSpecific(cellId, dataList[param.dataIndex]);
                            }

                            // Đồng bộ cái tâm ngắm chạy theo sang các ô khác (Crosshair Sync)
                            if (_isSyncingCrosshair) return; 
                            _isSyncingCrosshair = true;
                            const targetTs = (param && param.dataIndex >= 0) ? chart.getDataList()[param.dataIndex]?.timestamp : null;
                            
                            Object.keys(_instances).forEach(targetId => {
                                if (cellId === targetId) return;
                                if (!targetTs) {
                                    _instances[targetId].setCrosshair(undefined);
                                } else {
                                    const tData = _instances[targetId].getDataList();
                                    const tIndex = tData.findIndex(d => d.timestamp === targetTs);
                                    if (tIndex !== -1) _instances[targetId].setCrosshair({ paneId: param.paneId, dataIndex: tIndex });
                                }
                            });
                            _isSyncingCrosshair = false;
                        });
                    }
                }
                return true;
            } catch(e) { console.error('[WA_Chart] Init Multi Error', e); return false; }
        },

        // 🚀 CỖ MÁY IN VĂN BẢN LÊN TỪNG Ô ĐỘC LẬP
        updateLegendSpecific: function(cellId, ohlc) {
            if (!ohlc) return;
            const fmt = (v) => v >= 1 ? v.toFixed(2) : v.toFixed(6);
            const fmtVol = (v) => v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(2)+'K' : (v || 0).toFixed(0);
            
            const barColor = ohlc.close >= ohlc.open ? '#0ECB81' : '#F6465D';
            const setTxt = (idSuffix, txt, color) => {
                const el = document.getElementById(`wa-${idSuffix}-${cellId}`);
                if (el) { el.innerText = txt; if (color) el.style.color = color; }
            };

            setTxt('o', fmt(ohlc.open), '#848e9c'); setTxt('h', fmt(ohlc.high), '#0ECB81');
            setTxt('l', fmt(ohlc.low), '#F6465D'); setTxt('c', fmt(ohlc.close), barColor);
            setTxt('v', fmtVol(ohlc.volume || 0), '#848e9c');

            // Lấy thông tin Tên Token từ Data Router
            let tObj = (window.waCellTokens && window.waCellTokens[cellId]) ? window.waCellTokens[cellId] : window.currentChartToken;
            let tf = (window.waCellIntervals && window.waCellIntervals[cellId]) ? window.waCellIntervals[cellId] : window.currentChartInterval;
            
            let sym = tObj ? tObj.symbol : 'WAVE';
            let tfStr = (tf || '1D').toUpperCase();
            if (window.WaveChartEngine && parseInt(window.WaveChartEngine.getConfig().chartType) === 14) tfStr = 'RENKO';

            let pct = ohlc.open > 0 ? ((ohlc.close - ohlc.open) / ohlc.open) * 100 : 0;
            let sign = pct >= 0 ? '+' : '';
            setTxt('sym', `${sym} ${tfStr} (${sign}${pct.toFixed(2)}%)`, barColor);

            const wmEl = document.getElementById(`wa-wm-${cellId}`);
            if (wmEl) {
                wmEl.innerText = `${sym} • ${tfStr}`;
                // Liên kết với Settings tắt mở của người dùng
                if (window.WaveChartEngine) {
                    const cfg = window.WaveChartEngine.getConfig();
                    wmEl.style.display = cfg.showWatermark === false ? 'none' : 'block';
                    wmEl.style.color = `rgba(255,255,255, ${cfg.watermarkOpacity || 0.05})`;
                    const ohlcWrap = document.getElementById(`wa-sym-${cellId}`)?.parentNode;
                    if (ohlcWrap) ohlcWrap.style.display = cfg.showOHLC === false ? 'none' : 'flex';
                }
            }
        },

        setActiveChart: function(cellId) {
            if (!_instances[cellId]) return;
            _activeId = cellId;
            document.querySelectorAll('.wa-chart-cell').forEach(el => el.classList.remove('active-cell'));
            document.getElementById(cellId).classList.add('active-cell');
            window.dispatchEvent(new CustomEvent('WA_ACTIVE_CHART_CHANGED', { detail: { cellId: cellId } }));
        },

        _applyDefaultStyles: function(chart) {
            chart.setStyles({
                layout: { backgroundColor: 'transparent' },
                grid: { show: false, horizontal: { show: false }, vertical: { show: false } },
                crosshair: { show: true },
                // Ẩn các text mặc định xấu xí của thư viện để nhường chỗ cho UI của WAVE ALPHA
                candle: { type: 'candle_solid', tooltip: { showRule: 'always', showType: 'standard', custom: function() { return [{ title: { text: ' ', color: 'transparent' }, value: { text: ' ', color: 'transparent' } }]; }, text: { size: 12, color: 'transparent' } } },
                indicator: {
                    tooltip: { 
                        showRule: 'always', showType: 'standard',
                        text: { size: 12, family: 'Arial, sans-serif', weight: 600, color: '#848e9c', marginLeft: 8, marginTop: 8 },
                        icons: [
                            { id: 'visible', position: 'middle', marginLeft: 8, marginTop: 8, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf070', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 11, color: '#848e9c', activeColor: '#00F0FF', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(0,240,255,0.1)' },
                            { id: 'invisible', position: 'middle', marginLeft: 8, marginTop: 8, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf06e', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 11, color: '#848e9c', activeColor: '#00F0FF', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(0,240,255,0.1)' },
                            { id: 'setting', position: 'middle', marginLeft: 6, marginTop: 8, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf013', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 11, color: '#848e9c', activeColor: '#F0B90B', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(240,185,11,0.1)' },
                            { id: 'close', position: 'middle', marginLeft: 6, marginTop: 8, paddingLeft: 3, paddingTop: 2, paddingRight: 3, paddingBottom: 2, icon: '\uf00d', fontFamily: '"Font Awesome 6 Free", FontAwesome, sans-serif', weight: 900, size: 12, color: '#848e9c', activeColor: '#F6465D', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(246,70,93,0.1)' }
                        ]
                    } 
                }
            });
        },
        
        destroy: function() {
            if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
            Object.values(_instances).forEach(chart => { window.klinecharts.dispose(chart); });
            _instances = {}; _activeId = null;
        },

        // 🚀 CÁC CỔNG GIAO TIẾP ĐÃ ĐƯỢC ĐỊNH TUYẾN ĐỂ VỪA VẼ NẾN, VỪA NHẢY GIÁ TRÊN OHLC
        applyNewData: function(data) { try { if(this.active) { this.active.applyNewData(data); this.updateLegendSpecific(this.activeId, data[data.length-1]); } } catch(e){} },
        updateData: function(data) { try { if(this.active) { this.active.updateData(data); if (!this.active._waIsHovering) this.updateLegendSpecific(this.activeId, data); } } catch(e){} }, 
        getDataList: function() { try { return this.active ? this.active.getDataList() : []; } catch(e){ return []; } },
        setStyles: function(styles) { try { Object.values(_instances).forEach(chart => chart.setStyles(styles)); } catch(e){} },
        subscribeAction: function(type, cb) { try { if(this.active) this.active.subscribeAction(type, cb); } catch(e){} },
        createIndicator: function(name, isStack, options) { try { if(this.active) this.active.createIndicator(name, isStack, options); } catch(e){} },
        removeIndicator: function(paneId, name) { try { if(this.active) this.active.removeIndicator(paneId, name); } catch(e){} },
        overrideIndicator: function(override, paneId) { try { if(this.active) this.active.overrideIndicator(override, paneId); } catch(e){} },
        getIndicators: function(options) { try { return this.active ? this.active.getIndicators(options) : []; } catch(e){ return []; } },
        createOverlay: function(options) { try { if(this.active) return this.active.createOverlay(options); return null; } catch(e){ return null; } },
        removeOverlay: function(id) { try { if(this.active) this.active.removeOverlay(id); } catch(e){} },
        resize: function() { try { Object.values(_instances).forEach(chart => chart.resize()); } catch(e){} },
        setPriceVolumePrecision: function(p, v) { try { if(this.active) this.active.setPriceVolumePrecision(p, v); } catch(e){} },
        convertToPixel: function(val, finder) { try { return this.active ? this.active.convertToPixel(val, finder) : null; } catch(e){ return null; } },
        cancelDrawing: function() { try { if(this.active) this.active.cancelDrawing(); } catch(e){} },
        overrideOverlay: function(override) { try { if(this.active) this.active.overrideOverlay(override); } catch(e){} },
        getOverlayById: function(id) { try { return this.active ? this.active.getOverlayById(id) : null; } catch(e){ return null; } },
        convertFromPixel: function(coordinate, finder) { try { return this.active ? this.active.convertFromPixel(coordinate, finder) : null; } catch(e){ return null; } },
        getChartStore: function() { try { return this.active ? this.active.getChartStore() : null; } catch(e){ return null; } },
        getOffsetRightDistance: function() { try { return this.active ? this.active.getOffsetRightDistance() : 0; } catch(e){ return 0; } },
        setOffsetRightDistance: function(distance) { try { Object.values(_instances).forEach(chart => chart.setOffsetRightDistance(distance)); } catch(e){} },
        setTimezone: function(tz) { try { Object.values(_instances).forEach(chart => chart.setTimezone(tz)); } catch(e){} },

        applyNewDataSpecific: function(cellId, data) { try { if(_instances[cellId]) { _instances[cellId].applyNewData(data); this.updateLegendSpecific(cellId, data[data.length-1]); } } catch(e){} },
        updateDataSpecific: function(cellId, data) { try { if(_instances[cellId]) { _instances[cellId].updateData(data); if (!_instances[cellId]._waIsHovering) this.updateLegendSpecific(cellId, data); } } catch(e){} },
        getChartSpecific: function(cellId) { return _instances[cellId] || null; },

        setMainSeries: function(config) {
            try {
                if (Object.keys(_instances).length === 0) return;
                const CUSTOM_CHART_IDS = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE', 'WA_VOL_CANDLE', 'WA_LINE_BREAK'];
                Object.values(_instances).forEach(chart => {
                    CUSTOM_CHART_IDS.forEach(id => { try { chart.removeIndicator('candle_pane', id); } catch(e){} });

                    let kcChartType = 'candle_solid', isLine = false, hideCandle = false;
                    if (config.chartType === 2) kcChartType = 'candle_stroke';
                    else if (config.chartType === 3) kcChartType = 'ohlc';
                    else if (config.chartType === 6 || config.chartType === 9) { kcChartType = 'area'; isLine = (config.chartType === 6); }
                    else if (config.chartType === 14 || config.chartType === 15) kcChartType = 'candle_solid';

                    if (config.chartType === 4) { chart.createIndicator('WA_COL_CHART', true, {id: 'candle_pane'}); hideCandle = true; }
                    else if (config.chartType === 5) { chart.createIndicator('WA_HL_CHART', true, {id: 'candle_pane'}); hideCandle = true; }
                    else if (config.chartType === 7) { chart.createIndicator('WA_LINE_MARKER', true, {id: 'candle_pane'}); hideCandle = true; }
                    else if (config.chartType === 8) { chart.createIndicator('WA_STEP_LINE', true, {id: 'candle_pane'}); hideCandle = true; }
                    else if (config.chartType === 10) { chart.createIndicator('WA_HLC_AREA', true, {id: 'candle_pane'}); hideCandle = true; }
                    else if (config.chartType === 11) { chart.createIndicator('WA_BASELINE', true, {id: 'candle_pane'}); hideCandle = true; }
                    else if (config.chartType === 13) { chart.createIndicator('WA_VOL_CANDLE', true, {id: 'candle_pane'}); hideCandle = true; }
                    
                    const isHollow = (config.chartType === 2); const isRenko = (config.chartType === 14);
                    const rUp = config.renkoUpColor || '#FFFFFF'; const rDn = config.renkoDownColor || '#B250FF'; const rBd = config.renkoBorderColor || '#787B86';
                    const fUp = hideCandle ? 'transparent' : (isRenko ? rUp : config.upColor);
                    const fDown = hideCandle ? 'transparent' : (isRenko ? rDn : config.downColor);
                    const fNo = hideCandle ? 'transparent' : '#787b86';
                    const fUpBd = hideCandle ? 'transparent' : (isRenko ? rBd : (config.showBorder ? (config.borderIndependent ? config.borderUpColor : config.upColor) : (isHollow ? config.upColor : 'transparent')));
                    const fDnBd = hideCandle ? 'transparent' : (isRenko ? rBd : (config.showBorder ? (config.borderIndependent ? config.borderDownColor : config.downColor) : (isHollow ? config.downColor : 'transparent')));
                    const fUpW = hideCandle ? 'transparent' : (isRenko ? rBd : (config.showWick ? (config.wickIndependent ? config.wickUpColor : config.upColor) : 'transparent'));
                    const fDnW = hideCandle ? 'transparent' : (isRenko ? rBd : (config.showWick ? (config.wickIndependent ? config.wickDownColor : config.downColor) : 'transparent'));

                    let areaTopColor = 'rgba(0, 240, 255, 0.25)';
                    if (window.WaveChartEngine && typeof window.WaveChartEngine._dimColor === 'function') areaTopColor = window.WaveChartEngine._dimColor(config.upColor, 0.25); 

                    const areaBgColor = (isLine || hideCandle) ? 'transparent' : [{offset: 0, color: areaTopColor}, {offset: 1, color: 'transparent'}];
                    chart.setStyles({
                        candle: {
                            zLevel: 1, type: kcChartType,
                            bar: { upColor: fUp, downColor: fDown, noChangeColor: fNo, upBorderColor: fUpBd, downBorderColor: fDnBd, upWickColor: fUpW, downWickColor: fDnW },
                            area: { lineSize: 2, lineColor: hideCandle ? 'transparent' : config.upColor, backgroundColor: areaBgColor }
                        },
                        yAxis: { type: config.yAxisMode || 'normal' }
                    });
                    chart.setPaneOptions({ id: 'candle_pane', axisOptions: { type: config.yAxisMode } });
                });
            } catch(error) { console.error('[WA_Chart] setMainSeries Error:', error); }
        }
    };
})();