// ==========================================
// 🚀 FILE: public/js/wa-chart-core.js
// 🛡️ WAVE ALPHA CHART FIREWALL (GLOBAL WRAPPER) - TẮT OHLC MẶC ĐỊNH
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

    let _instances = {}; let _activeId = null; let _resizeObserver = null; let _isSyncingCrosshair = false; 

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

                _resizeObserver = new ResizeObserver(() => { Object.values(_instances).forEach(chart => { try { chart.resize(); } catch(e){} }); });
                _resizeObserver.observe(mainContainer);

                for (let i = 0; i < cellCount; i++) {
                    const cellId = `wa-chart-cell-${i}`;
                    const cell = document.createElement('div');
                    cell.id = cellId; cell.className = `wa-chart-cell ${i === 0 ? 'active-cell' : ''}`;
                    
                    cell.addEventListener('mousedown', () => this.setActiveChart(cellId));
                    gridWrapper.appendChild(cell);
                    
                    const uiLayer = document.createElement('div');
                    uiLayer.className = 'wa-custom-ui-layer';
                    uiLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: calc(100% - 65px); height: 100%; pointer-events: none; z-index: 50; display: flex; flex-direction: column; justify-content: space-between; padding: 6px 10px; overflow: hidden;';
                    
                    uiLayer.innerHTML = `
                        <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 600; display: flex; gap: 8px; flex-wrap: nowrap; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); pointer-events: auto; overflow: hidden; align-items: center;">
                            <div id="wa-toggle-${cellId}" title="Ẩn/Hiện Danh sách Chỉ báo" style="cursor:pointer; color:#848e9c; padding: 2px 6px; margin-left: -4px; border-radius: 4px; display:inline-flex; align-items:center; transition:0.2s;">▼</div>
                            <span id="wa-sym-${cellId}" style="color: #EAECEF; margin-right: 4px; white-space: nowrap;">---</span>
                            <span style="white-space: nowrap;"><span style="color: #848e9c;">O</span> <span id="wa-o-${cellId}" style="color: #848e9c;">---</span></span>
                            <span style="white-space: nowrap;"><span style="color: #848e9c;">H</span> <span id="wa-h-${cellId}" style="color: #0ECB81;">---</span></span>
                            <span style="white-space: nowrap;"><span style="color: #848e9c;">L</span> <span id="wa-l-${cellId}" style="color: #F6465D;">---</span></span>
                            <span style="white-space: nowrap;"><span style="color: #848e9c;">C</span> <span id="wa-c-${cellId}" style="color: #848e9c;">---</span></span>
                            <span style="white-space: nowrap;"><span style="color: #848e9c;">V</span> <span id="wa-v-${cellId}" style="color: #848e9c;">---</span></span>
                        </div>
                        <div id="wa-wm-${cellId}" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Inter', sans-serif; font-weight: 800; font-size: clamp(20px, 4vw, 60px); color: rgba(255,255,255,0.05); letter-spacing: 2px; white-space: nowrap;">WAVE ALPHA</div>
                    `;
                    cell.appendChild(uiLayer);

                    const legendHtml = document.createElement('div');
                    legendHtml.id = `wa-ind-legend-${cellId}`;
                    legendHtml.style.cssText = 'position: absolute; top: 28px; left: 10px; z-index: 51; display: flex; flex-direction: column; gap: 2px; pointer-events: none; max-width: calc(100% - 65px); overflow: hidden;';
                    cell.appendChild(legendHtml);

                    setTimeout(() => {
                        const toggleBtn = document.getElementById(`wa-toggle-${cellId}`);
                        if (toggleBtn) {
                            toggleBtn.onmouseover = () => { toggleBtn.style.color = '#EAECEF'; toggleBtn.style.background = 'rgba(255,255,255,0.1)'; };
                            toggleBtn.onmouseout = () => { toggleBtn.style.color = '#848e9c'; toggleBtn.style.background = 'transparent'; };
                            toggleBtn.onmousedown = (e) => e.stopPropagation(); 
                            toggleBtn.ontouchstart = (e) => e.stopPropagation();

                            toggleBtn.onclick = (e) => {
                                e.stopPropagation();
                                const leg = document.getElementById(`wa-ind-legend-${cellId}`);
                                if (leg) {
                                    const isHidden = leg.style.display === 'none';
                                    leg.style.display = isHidden ? 'flex' : 'none';
                                    toggleBtn.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
                                }
                            };
                        }
                    }, 50);

                    const chart = window.klinecharts.init(cell);
                    if (chart) {
                        this._applyDefaultStyles(chart); 
                        _instances[cellId] = chart;
                        if (i === 0) _activeId = cellId; 
                        chart._waIsHovering = false; 

                        chart.subscribeAction('onCrosshairChange', (param) => {
                            let dataIndex = (param && param.dataIndex !== undefined) ? param.dataIndex : -1;
                            if (dataIndex < 0) {
                                chart._waIsHovering = false;
                                const dataList = chart.getDataList();
                                if (dataList && dataList.length > 0) this.updateLegendSpecific(cellId, dataList[dataList.length - 1], dataList.length - 1);
                            } else {
                                chart._waIsHovering = true;
                                const dataList = chart.getDataList();
                                this.updateLegendSpecific(cellId, dataList[dataIndex], dataIndex);
                            }

                            if (_isSyncingCrosshair) return; 
                            _isSyncingCrosshair = true;
                            const targetTs = (dataIndex >= 0) ? chart.getDataList()[dataIndex]?.timestamp : null;
                            Object.keys(_instances).forEach(targetId => {
                                if (cellId === targetId) return;
                                if (!targetTs) { _instances[targetId].setCrosshair(undefined); } 
                                else {
                                    const tData = _instances[targetId].getDataList();
                                    const tIndex = tData.findIndex(d => d.timestamp === targetTs);
                                    if (tIndex !== -1) _instances[targetId].setCrosshair({ paneId: param.paneId, dataIndex: tIndex });
                                }
                            });
                            _isSyncingCrosshair = false;
                        });
                    }
                }
                if (cellCount > 1) this._enableCrosshairSync();
                return true;
            } catch(e) { console.error('[WA_Chart] Init Multi Error', e); return false; }
        },

        updateLegendSpecific: function(cellId, ohlc, dataIndex = -1) {
            if (!ohlc) return;
            const fmt = (v) => v >= 1 ? v.toFixed(2) : v.toFixed(6);
            const fmtVol = (v) => v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(2)+'K' : (v || 0).toFixed(0);
            
            const barColor = ohlc.close >= ohlc.open ? '#0ECB81' : '#F6465D';
            const setTxt = (idSuffix, txt, color) => { const el = document.getElementById(`wa-${idSuffix}-${cellId}`); if (el) { el.innerText = txt; if (color) el.style.color = color; } };

            setTxt('o', fmt(ohlc.open), '#848e9c'); setTxt('h', fmt(ohlc.high), '#0ECB81');
            setTxt('l', fmt(ohlc.low), '#F6465D'); setTxt('c', fmt(ohlc.close), barColor);
            setTxt('v', fmtVol(ohlc.volume || 0), '#848e9c');

            let tObj = (window.waCellTokens && window.waCellTokens[cellId]) ? window.waCellTokens[cellId] : window.currentChartToken;
            let tf = (window.waCellIntervals && window.waCellIntervals[cellId]) ? window.waCellIntervals[cellId] : window.currentChartInterval;
            let sym = tObj ? tObj.symbol : 'WAVE'; let tfStr = (tf || '1D').toUpperCase();
            if (window.WaveChartEngine && parseInt(window.WaveChartEngine.getConfig().chartType) === 14) tfStr = 'RENKO';

            let pct = ohlc.open > 0 ? ((ohlc.close - ohlc.open) / ohlc.open) * 100 : 0;
            let sign = pct >= 0 ? '+' : '';
            setTxt('sym', `${sym} ${tfStr} (${sign}${pct.toFixed(2)}%)`, barColor);

            const wmEl = document.getElementById(`wa-wm-${cellId}`);
            if (wmEl) {
                wmEl.innerText = `${sym} • ${tfStr}`;
                if (window.WaveChartEngine) {
                    const cfg = window.WaveChartEngine.getConfig();
                    wmEl.style.display = cfg.showWatermark === false ? 'none' : 'block';
                    wmEl.style.color = `rgba(255,255,255, ${cfg.watermarkOpacity || 0.05})`;
                    const ohlcWrap = document.getElementById(`wa-sym-${cellId}`)?.parentNode;
                    if (ohlcWrap) ohlcWrap.style.display = cfg.showOHLC === false ? 'none' : 'flex';
                }
            }

            if (dataIndex >= 0) {
                const chart = _instances[cellId];
                if (!chart) return;
                try {
                    const pane = chart.getIndicatorByPaneId('candle_pane');
                    if (pane) {
                        let inds = pane instanceof Map ? Array.from(pane.values()) : Object.values(pane);
                        inds.forEach(ind => {
                            const valEl = document.getElementById(`wa-val-${cellId}-${ind.name}`);
                            if (valEl && ind.result && ind.result[dataIndex]) {
                                const res = ind.result[dataIndex];
                                let valStr = '';
                                Object.keys(res).forEach(k => {
                                    if (typeof res[k] === 'number') valStr += '  ' + (Math.abs(res[k]) > 1000 ? res[k].toFixed(2) : res[k].toFixed(4));
                                });
                                valEl.innerText = valStr;
                            }
                        });
                    }
                } catch(e) {}
            }
        },

        renderHtmlLegend: function(cellId) {
            const chart = _instances[cellId];
            if (!chart) return;
            const container = document.getElementById(`wa-ind-legend-${cellId}`);
            if (!container) return;

            let inds = [];
            try {
                const pane = chart.getIndicatorByPaneId('candle_pane');
                if (pane) { if (pane instanceof Map) inds = Array.from(pane.values()); else inds = Object.values(pane); }
            } catch(e) {}

            const hidden = ['WA_COL_CHART', 'WA_HL_CHART', 'WA_STEP_LINE', 'WA_LINE_MARKER', 'WA_HLC_AREA', 'WA_BASELINE', 'WA_VOL_CANDLE', 'WA_LINE_BREAK'];
            inds = inds.filter(i => !hidden.includes(i.name));

            const SVG = {
                eye: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
                eyeOff: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`,
                gear: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
                close: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
            };

            let html = '';
            inds.forEach(ind => {
                const params = ind.calcParams ? ind.calcParams.join(', ') : '';
                const isVis = ind.visible !== false;
                const eyeColor = isVis ? '#848e9c' : '#F6465D'; 
                const eyeIcon = isVis ? SVG.eye : SVG.eyeOff;
                
                html += `
                <div class="wa-leg-item" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" style="display:inline-flex; align-self:flex-start; max-width:100%; align-items:center; gap:8px; font-size:11.5px; font-weight:500; color:#848e9c; pointer-events:auto; padding:3px 6px; border-radius:4px; transition:0.2s; background: transparent;">
                    <span style="color:${isVis?'#EAECEF':'#5e6673'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight:600;">${ind.name} <span style="font-size:10px; font-weight:400; opacity:0.7;">(${params})</span></span>
                    <span id="wa-val-${cellId}-${ind.name}" style="color:#EAECEF; font-family:var(--font-num); flex-shrink: 0; font-size:11px;"></span>
                    <div class="wa-leg-icons" style="display:none; gap:2px; cursor:pointer; margin-left: 4px; flex-shrink: 0; align-items: center;">
                        <div title="Ẩn/Hiện" style="display:flex; padding:5px; border-radius:4px; color:${eyeColor}; transition:0.2s" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.color='#EAECEF'" onmouseout="this.style.background='transparent'; this.style.color='${eyeColor}'" onclick="window.WA_Chart.toggleInd('${cellId}', '${ind.name}', ${isVis})">${eyeIcon}</div>
                        <div title="Cài đặt" style="display:flex; padding:5px; border-radius:4px; color:#848e9c; transition:0.2s" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.color='#F0B90B'" onmouseout="this.style.background='transparent'; this.style.color='#848e9c'" onclick="window.WA_Chart.settingInd('${cellId}', '${ind.name}')">${SVG.gear}</div>
                        <div title="Xóa" style="display:flex; padding:5px; border-radius:4px; color:#848e9c; transition:0.2s" onmouseover="this.style.background='rgba(246,70,93,0.15)'; this.style.color='#F6465D'" onmouseout="this.style.background='transparent'; this.style.color='#848e9c'" onclick="window.WA_Chart.removeInd('${cellId}', '${ind.name}')">${SVG.close}</div>
                    </div>
                </div>`;
            });
            container.innerHTML = html;

            container.querySelectorAll('.wa-leg-item').forEach(el => {
                el.onmouseenter = () => { el.style.background = 'rgba(255,255,255,0.03)'; el.querySelector('.wa-leg-icons').style.display = 'flex'; };
                el.onmouseleave = () => { el.style.background = 'transparent'; el.querySelector('.wa-leg-icons').style.display = 'none'; };
            });
        },

        toggleInd: function(cellId, name, currentVis) { 
            if (window.scActiveIndicators) {
                let ind = window.scActiveIndicators.find(x => x.name === name && x.cellId === cellId);
                if (ind) ind.visible = !currentVis;
            }
            _instances[cellId].overrideIndicator({ name: name, visible: !currentVis }, 'candle_pane'); 
            this.renderHtmlLegend(cellId); 
            if(typeof window.saveIndicatorState === 'function') window.saveIndicatorState();
            
            const modal = document.getElementById('sc-indicator-modal');
            if (modal && modal.style.display !== 'none' && typeof window.renderIndicatorList === 'function') {
                window.renderIndicatorList(document.getElementById('wa-ind-search')?.value);
            }
        },
        settingInd: function(cellId, name) {
            let calcParams;
            try { const inds = _instances[cellId].getIndicators({ name: name, paneId: 'candle_pane' }); if (inds && inds.length > 0) calcParams = inds[0].calcParams; } catch(e) {}
            if (typeof window.openIndicatorSettings === 'function') window.openIndicatorSettings({ name: name, shortName: name, calcParams: calcParams }, 'candle_pane');
        },
        removeInd: function(cellId, name) { 
            if (typeof window.removeIndicatorFromChart === 'function') {
                window.removeIndicatorFromChart(name, cellId);
            } else {
                _instances[cellId].removeIndicator('candle_pane', name); 
                this.renderHtmlLegend(cellId); 
            }
        },

        setActiveChart: function(cellId) {
            if (!_instances[cellId]) return;
            _activeId = cellId;
            document.querySelectorAll('.wa-chart-cell').forEach(el => el.classList.remove('active-cell'));
            document.getElementById(cellId).classList.add('active-cell');
            window.dispatchEvent(new CustomEvent('WA_ACTIVE_CHART_CHANGED', { detail: { cellId: cellId } }));
        },

        // 🚀 VŨ KHÍ TỐI THƯỢNG ĐỂ BỊT MỒM HOÀN TOÀN OHLC MẶC ĐỊNH CỦA THƯ VIỆN
        _applyDefaultStyles: function(chart) {
            chart.setStyles({
                layout: { backgroundColor: 'transparent' },
                grid: { show: false, horizontal: { show: false }, vertical: { show: false } },
                crosshair: { show: true },
                candle: { 
                    type: 'candle_solid', 
                    tooltip: { 
                        showRule: 'none', 
                        custom: function() { return []; }, 
                        text: { size: 0, color: 'transparent' } 
                    } 
                },
                indicator: { tooltip: { showRule: 'none' } }
            });
        },
        
        destroy: function() {
            if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
            Object.values(_instances).forEach(chart => { window.klinecharts.dispose(chart); });
            _instances = {}; _activeId = null;
        },

        applyNewData: function(data) { try { if(this.active) { this.active.applyNewData(data); this.updateLegendSpecific(this.activeId, data[data.length-1], data.length-1); } } catch(e){} },
        updateData: function(data) { try { if(this.active) { this.active.updateData(data); if (!this.active._waIsHovering) { const dl = this.active.getDataList(); this.updateLegendSpecific(this.activeId, data, dl.length-1); } } } catch(e){} }, 
        getDataList: function() { try { return this.active ? this.active.getDataList() : []; } catch(e){ return []; } },
        setStyles: function(styles) { try { Object.values(_instances).forEach(chart => chart.setStyles(styles)); } catch(e){} },
        subscribeAction: function(type, cb) { try { if(this.active) this.active.subscribeAction(type, cb); } catch(e){} },
        removeIndicator: function(paneId, name) { try { if(this.active) { this.active.removeIndicator(paneId, name); this.renderHtmlLegend(this.activeId); } } catch(e){} },
        overrideIndicator: function(override, paneId) { try { if(this.active) { this.active.overrideIndicator(override, paneId); this.renderHtmlLegend(this.activeId); } } catch(e){} },
        
        createIndicator: function(name, isStack, options) { 
            try { 
                if(this.active) { 
                    this.active.createIndicator(name, isStack, options); 
                    this.renderHtmlLegend(this.activeId); 
                } 
            } catch(e){} 
        },

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

        applyNewDataSpecific: function(cellId, data) { try { if(_instances[cellId]) { _instances[cellId].applyNewData(data); this.updateLegendSpecific(cellId, data[data.length-1], data.length-1); } } catch(e){} },
        updateDataSpecific: function(cellId, data) { try { if(_instances[cellId]) { _instances[cellId].updateData(data); if (!_instances[cellId]._waIsHovering) { const dl = _instances[cellId].getDataList(); this.updateLegendSpecific(cellId, data, dl.length-1); } } } catch(e){} },
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
                    
                    // 🚀 CHẶN LUÔN KHI NÓ ĐỔI LOẠI BIỂU ĐỒ NÓ CŨNG KHÔNG HỒI SINH ĐƯỢC OHLC
                    chart.setStyles({
                        candle: {
                            zLevel: 1, type: kcChartType,
                            bar: { upColor: fUp, downColor: fDown, noChangeColor: fNo, upBorderColor: fUpBd, downBorderColor: fDnBd, upWickColor: fUpW, downWickColor: fDnW },
                            area: { lineSize: 2, lineColor: hideCandle ? 'transparent' : config.upColor, backgroundColor: areaBgColor },
                            tooltip: { showRule: 'none', custom: function() { return []; }, text: { size: 0, color: 'transparent' } }
                        },
                        yAxis: { type: config.yAxisMode || 'normal' }
                    });
                    chart.setPaneOptions({ id: 'candle_pane', axisOptions: { type: config.yAxisMode } });
                });
            } catch(error) { console.error('[WA_Chart] setMainSeries Error:', error); }
        }
    };
})();