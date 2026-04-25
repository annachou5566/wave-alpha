// ==========================================
// 🚀 FILE: chart-engine.js - LÕI XỬ LÝ DỮ LIỆU & WEBSOCKET (V5 - FINAL CSP BYPASS)
// ==========================================

window.chartWs = null;
window.liquidationWs = null;
window.futuresDataInterval = null;
window.isReconnecting = false;
window.currentChartToken = null; 

// Đổi Base URL về thẳng Render để không bị CSP chặn và không bị 404 Proxy
const RENDER_BASE_URL = "";

window.quantStats = {
    whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0,
    priceTrend: 0, trend: 0, drop: 0, spread: 0,
    ofi: 0, zScore: 0, buyDominance: 50,
    longLiq: 0, shortLiq: 0, fundingRateObj: null, hftVerdict: null
};
// 🟢 [THÊM MỚI] Khởi tạo bộ nhớ lưu vết Bookmap
window.bookmapHistory = [];
window.isHeatmapOn = true; 

// =========================================================================
// ⚙️ BƯỚC 3: CHART SETTINGS MODAL (V9.1 - FULL PRODUCTION MASTER)
// ✅ Animation mượt | Backdrop click | Escape key | Export/Import JSON
// ✅ 8 Theme presets | Recent colors | Native color picker | Slider badges
// ✅ Smart picker positioning | Drag | Linked sliders | Dynamic UI
// =========================================================================
(function initChartSettingsModal() {
    'use strict';

    // ─── PALETTE & PRESETS ───────────────────────────────────────────────
    const PALETTE = [
        '#ffffff','#d1d4dc','#b2b5be','#848e9c','#5d606b','#363a45','#1e222d','#000000',
        '#f23645','#ff5252','#ff7043','#ff9800','#ffc107','#ffeb3b','#8bc34a','#4caf50',
        '#f7525f','#ff8a80','#ffccbc','#ffe0b2','#fff9c4','#f1f8e9','#b9f6ca','#ccff90',
        '#089981','#00bcd4','#03a9f4','#2196f3','#3f51b5','#673ab7','#9c27b0','#e91e63',
        '#26a69a','#00e5ff','#40c4ff','#448aff','#7c4dff','#e040fb','#f50057','#ff4081',
        '#0ECB81','#F6465D','#F0B90B','#00F0FF','#7B61FF','#FF6B35','#2af592','#131722',
    ];

    const THEMES = {
        'Binance':   { upColor:'#0ECB81', downColor:'#F6465D', bgColor:'#131722', gridColor:'rgba(255,255,255,0.06)' },
        'Dark Pro':  { upColor:'#26a69a', downColor:'#ef5350', bgColor:'#0d0d12', gridColor:'rgba(255,255,255,0.04)' },
        'Solarize':  { upColor:'#2af592', downColor:'#cb4335', bgColor:'#0a0e1a', gridColor:'rgba(42,245,146,0.06)' },
        'Classic':   { upColor:'#089981', downColor:'#F23645', bgColor:'#1e222d', gridColor:'rgba(255,255,255,0.06)' },
        'Mono':      { upColor:'#b2b5be', downColor:'#5d606b', bgColor:'#000000', gridColor:'rgba(255,255,255,0.05)' },
        'Neon':      { upColor:'#00F0FF', downColor:'#FF6B35', bgColor:'#080810', gridColor:'rgba(0,240,255,0.05)' },
        'Purple':    { upColor:'#7B61FF', downColor:'#F6465D', bgColor:'#0f0b1e', gridColor:'rgba(123,97,255,0.07)' },
        'TradFi':    { upColor:'#00897B', downColor:'#C62828', bgColor:'#0d0d0d', gridColor:'rgba(255,255,255,0.04)' },
    };

    // ─── STYLES ──────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        /* BACKDROP */
        #wa-csm-backdrop {
            display: none; position: fixed; inset: 0;
            background: rgba(0,0,0,0.55); z-index: 9999997;
            opacity: 0; transition: opacity 0.2s ease;
        }
        #wa-csm-backdrop.show { opacity: 1; }

        /* MODAL WRAPPER */
        #wa-chart-settings-modal {
            display: none; position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(0.96);
            z-index: 9999999; opacity: 0;
            transition: opacity 0.2s ease, transform 0.2s ease;
            pointer-events: none;
        }
        #wa-chart-settings-modal.show {
            opacity: 1; transform: translate(-50%, -50%) scale(1);
            pointer-events: auto;
        }

        /* BOX */
        .wa-csm-box {
            background: #1e222d; width: 740px; height: 540px;
            border-radius: 10px; border: 1px solid rgba(255,255,255,0.09);
            box-shadow: 0 28px 70px rgba(0,0,0,0.75);
            display: flex; overflow: hidden;
            font-family: 'Inter', system-ui, sans-serif;
            min-width: 520px; min-height: 400px;
        }

        /* SIDEBAR */
        .wa-csm-sidebar {
            width: 186px; flex-shrink: 0;
            background: #131722;
            border-right: 1px solid rgba(255,255,255,0.05);
            display: flex; flex-direction: column; padding: 14px 0;
        }
        .wa-csm-sidebar-lbl {
            font-size: 9.5px; font-weight: 800; color: #3d4450;
            text-transform: uppercase; letter-spacing: 0.09em;
            padding: 6px 18px 4px;
        }
        .wa-csm-tab {
            padding: 9px 18px; color: #848e9c;
            font-size: 12.5px; font-weight: 500; cursor: pointer;
            border-left: 2px solid transparent; transition: all 0.14s;
            display: flex; align-items: center; gap: 9px; user-select: none;
        }
        .wa-csm-tab:hover { background: rgba(255,255,255,0.03); color: #cdd2dc; }
        .wa-csm-tab.active {
            background: rgba(38,166,154,0.1); color: #26a69a;
            border-left-color: #26a69a; font-weight: 600;
        }
        .wa-csm-tab-sep { height: 1px; background: rgba(255,255,255,0.04); margin: 6px 0; }

        /* CONTENT */
        .wa-csm-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .wa-csm-header {
            padding: 13px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);
            display: flex; justify-content: space-between; align-items: center;
            cursor: grab; user-select: none; flex-shrink: 0;
        }
        .wa-csm-header:active { cursor: grabbing; }
        .wa-csm-title { font-size: 14px; font-weight: 700; color: #EAECEF; pointer-events: none; }
        .wa-csm-close {
            color: #5d606b; cursor: pointer; font-size: 15px;
            width: 26px; height: 26px; border-radius: 4px;
            display: flex; align-items: center; justify-content: center; transition: 0.14s;
        }
        .wa-csm-close:hover { color: #F6465D; background: rgba(246,70,93,0.1); }

        /* PANELS */
        .wa-csm-panels {
            flex: 1; overflow-y: auto; padding: 16px 20px;
            scrollbar-width: thin; scrollbar-color: #2a2e39 transparent;
        }
        .wa-csm-panels::-webkit-scrollbar { width: 4px; }
        .wa-csm-panels::-webkit-scrollbar-thumb { background: #2a2e39; border-radius: 2px; }
        .wa-csm-panel { display: none; flex-direction: column; gap: 13px; }
        .wa-csm-panel.active { display: flex; }

        /* ROW */
        .wa-csm-row {
            display: flex; justify-content: space-between;
            align-items: center; min-height: 30px;
        }
        .wa-csm-label {
            font-size: 12.5px; color: #b7bdc6;
            display: flex; align-items: center; gap: 7px; flex-shrink: 0;
        }
        .wa-hint {
            font-size: 10px; color: #4a5568;
            background: rgba(255,255,255,0.05);
            padding: 1px 5px; border-radius: 3px;
        }
        .wa-csm-control { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        /* DIVIDER */
        .wa-csm-divider {
            font-size: 10px; font-weight: 800; color: #3d6e73;
            text-transform: uppercase; letter-spacing: 0.06em;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            padding-bottom: 4px; margin-top: 2px;
        }

        /* GROUP BOX */
        .wa-csm-group {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 6px; padding: 10px 14px;
            display: flex; flex-direction: column; gap: 11px;
        }

        /* SELECT */
        .wa-csm-select {
            background: #131722; color: #EAECEF;
            border: 1px solid rgba(255,255,255,0.09);
            padding: 5px 9px; border-radius: 4px;
            font-size: 12px; outline: none; cursor: pointer; width: 148px;
            transition: border-color 0.14s;
        }
        .wa-csm-select:focus { border-color: #26a69a; }

        /* NUMBER INPUT */
        .wa-csm-input-num {
            background: #131722; color: #EAECEF;
            border: 1px solid rgba(255,255,255,0.09);
            padding: 5px 6px; border-radius: 4px;
            font-size: 12px; outline: none; width: 60px;
            text-align: center; transition: border-color 0.14s;
        }
        .wa-csm-input-num:focus { border-color: #26a69a; }

        /* SLIDER */
        .wa-slider-wrap { display: flex; align-items: center; gap: 7px; }
        .wa-csm-slider { width: 100px; accent-color: #26a69a; cursor: pointer; height: 3px; }
        .wa-slider-badge {
            font-size: 10.5px; color: #848e9c; min-width: 34px;
            text-align: right; font-variant-numeric: tabular-nums;
        }

        /* TOGGLE */
        .wa-switch { position: relative; display: inline-block; width: 34px; height: 18px; flex-shrink: 0; }
        .wa-switch input { opacity: 0; width: 0; height: 0; }
        .wa-slider {
            position: absolute; cursor: pointer; inset: 0;
            background: rgba(255,255,255,0.08); transition: .18s; border-radius: 18px;
        }
        .wa-slider:before {
            position: absolute; content: ""; height: 12px; width: 12px;
            left: 3px; bottom: 3px; background: #5d606b; transition: .18s; border-radius: 50%;
        }
        input:checked + .wa-slider { background: rgba(38,166,154,0.25); }
        input:checked + .wa-slider:before { transform: translateX(16px); background: #26a69a; }

        /* COLOR SWATCH */
        .wa-color-swatch {
            width: 24px; height: 24px; border-radius: 4px;
            border: 1.5px solid rgba(255,255,255,0.12);
            cursor: pointer; transition: 0.14s; flex-shrink: 0; position: relative;
        }
        .wa-color-swatch:hover {
            border-color: #00F0FF;
            box-shadow: 0 0 7px rgba(0,240,255,0.35);
            transform: scale(1.08);
        }
        .wa-swatch-group { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .wa-swatch-lbl { font-size: 9.5px; color: #5d606b; }

        /* PRESET */
        .wa-preset-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
        .wa-preset-btn {
            padding: 6px 4px; border-radius: 5px;
            border: 1px solid rgba(255,255,255,0.07);
            background: rgba(255,255,255,0.02);
            color: #848e9c; font-size: 11px; cursor: pointer; transition: 0.14s; text-align: center;
        }
        .wa-preset-btn:hover { border-color: #26a69a; color: #26a69a; background: rgba(38,166,154,0.1); }
        .wa-preset-btn.active-preset { border-color: #26a69a; color: #26a69a; background: rgba(38,166,154,0.15); }

        /* ACTION BUTTONS */
        .wa-action-row { display: flex; gap: 8px; }
        .wa-action-btn {
            flex: 1; padding: 8px 10px; border-radius: 5px;
            font-size: 12px; font-weight: 600; cursor: pointer; transition: 0.14s;
            display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .wa-btn-danger  { background:rgba(246,70,93,0.08);  color:#F6465D; border:1px solid rgba(246,70,93,0.2); }
        .wa-btn-danger:hover  { background:rgba(246,70,93,0.18); }
        .wa-btn-neutral { background:rgba(255,255,255,0.04); color:#b7bdc6; border:1px solid rgba(255,255,255,0.09); }
        .wa-btn-neutral:hover { background:rgba(255,255,255,0.09); color:#EAECEF; }
        .wa-btn-primary { background:rgba(38,166,154,0.1);  color:#26a69a; border:1px solid rgba(38,166,154,0.25); }
        .wa-btn-primary:hover { background:rgba(38,166,154,0.2); }

        /* INFO BOX */
        .wa-info-box {
            background: rgba(240,185,11,0.07); border: 1px dashed rgba(240,185,11,0.25);
            padding: 9px 12px; border-radius: 6px; font-size: 11px; color: #F0B90B; line-height: 1.6;
        }
        .wa-success-box {
            background: rgba(14,203,129,0.07); border: 1px dashed rgba(14,203,129,0.25);
            padding: 9px 12px; border-radius: 6px; font-size: 11px; color: #0ECB81; line-height: 1.6;
        }

        /* ── COLOR PICKER ── */
        #wa-color-picker {
            display: none; position: fixed;
            background: #1a1d29; border: 1px solid #2a2e3e;
            border-radius: 10px; padding: 13px;
            z-index: 99999999; box-shadow: 0 18px 50px rgba(0,0,0,0.85); width: 238px;
        }
        .wcp-preview {
            height: 26px; border-radius: 5px; margin-bottom: 10px;
            border: 1px solid rgba(255,255,255,0.08); transition: background 0.08s;
        }
        .wcp-section-lbl { font-size: 9.5px; font-weight: 800; color: #3d4450; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 5px; }
        .wcp-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 10px; }
        .wcp-cell {
            width: 20px; height: 20px; border-radius: 3px;
            cursor: pointer; border: 1.5px solid transparent; transition: 0.1s;
        }
        .wcp-cell:hover { border-color: rgba(255,255,255,0.6); transform: scale(1.12); }
        .wcp-cell.sel { border-color: #fff; }
        .wcp-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
        .wcp-lbl { font-size: 10px; color: #4a5568; font-weight: 700; min-width: 44px; }
        .wcp-hex {
            flex: 1; background: #0d1017; border: 1px solid #2a2e3e; color: #EAECEF;
            padding: 4px 8px; border-radius: 4px;
            font-family: 'JetBrains Mono', monospace; font-size: 11.5px; outline: none;
        }
        .wcp-hex:focus { border-color: #26a69a; }
        .wcp-native { width: 30px; height: 26px; padding: 0; border: none; border-radius: 3px; cursor: pointer; background: none; overflow: hidden; }
        .wcp-opacity { flex: 1; accent-color: #26a69a; height: 3px; }
        .wcp-op-val { font-size: 11px; color: #848e9c; min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
        .wcp-recent { display: flex; flex-wrap: wrap; gap: 3px; }
        .wcp-rcell { width: 17px; height: 17px; border-radius: 3px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); transition: 0.1s; }
        .wcp-rcell:hover { border-color: #fff; transform: scale(1.1); }
    `;
    document.head.appendChild(style);

    // ─── HTML ────────────────────────────────────────────────────────────
    document.body.insertAdjacentHTML('beforeend', `
        <div id="wa-csm-backdrop"></div>
        <div id="wa-chart-settings-modal">
        <div class="wa-csm-box" id="wa-csm-box">

            <div class="wa-csm-sidebar">
                <div class="wa-csm-sidebar-lbl">Biểu đồ</div>
                <div class="wa-csm-tab active" data-tab="csm-symbol">📊 Biểu Tượng</div>
                <div class="wa-csm-tab" data-tab="csm-status">🔖 Trạng Thái</div>
                <div class="wa-csm-tab-sep"></div>
                <div class="wa-csm-sidebar-lbl">Hiển thị</div>
                <div class="wa-csm-tab" data-tab="csm-appearance">🎨 Giao Diện</div>
                <div class="wa-csm-tab" data-tab="csm-themes">✨ Chủ Đề</div>
                <div class="wa-csm-tab-sep"></div>
                <div class="wa-csm-sidebar-lbl">Hệ thống</div>
                <div class="wa-csm-tab" data-tab="csm-pro">⚡ Nâng Cao</div>
            </div>

            <div class="wa-csm-content">
                <div class="wa-csm-header">
                    <div class="wa-csm-title">⚙️ Cài đặt Biểu đồ</div>
                    <div class="wa-csm-close" id="btn-wa-csm-close">✕</div>
                </div>
                <div class="wa-csm-panels">

                    <div id="csm-symbol" class="wa-csm-panel active">
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Loại biểu đồ</div>
                            <select class="wa-csm-select" data-bind="chartType" data-type="number">
                                <option value="1">🕯 Nến Nhật (Candle)</option>
                                <option value="2">🕯 Nến Rỗng (Hollow)</option>
                                <option value="3">▮ Thanh OHLC (Bars)</option>
                                <option value="4">▊ Cột (Columns)</option>
                                <option value="5">↕ Đỉnh-Đáy (H-L)</option>
                                <option value="6">╱ Đường (Line)</option>
                                <option value="7">╱● Đường + Điểm</option>
                                <option value="8">⌐ Bậc Thang (Step)</option>
                                <option value="9">◭ Vùng (Area)</option>
                                <option value="10">◬ Vùng HLC (Pro)</option>
                                <option value="11">≈ Đường Cơ Sở (Baseline)</option>
                            </select>
                        </div>

                        <div id="csm-ui-candles" style="display:flex; flex-direction:column; gap:13px;">
                            <div class="wa-csm-divider">Màu thân nến</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Tăng / Giảm</div>
                                <div class="wa-csm-control">
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="upColor"></div><div class="wa-swatch-lbl">Tăng</div></div>
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="downColor"></div><div class="wa-swatch-lbl">Giảm</div></div>
                                </div>
                            </div>
                            <div class="wa-csm-divider">Viền nến (Border)</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">
                                    <label class="wa-switch"><input type="checkbox" data-bind="showBorder"><span class="wa-slider"></span></label>
                                    Hiện viền
                                </div>
                                <div class="wa-csm-control">
                                    <span style="font-size:11px; color:#5d606b;">Màu riêng</span>
                                    <label class="wa-switch"><input type="checkbox" data-bind="borderIndependent"><span class="wa-slider"></span></label>
                                    <div id="csm-border-swatches" style="display:flex;gap:6px;opacity:0.35;pointer-events:none;transition:0.2s;">
                                        <div class="wa-color-swatch" data-color-bind="borderUpColor"></div>
                                        <div class="wa-color-swatch" data-color-bind="borderDownColor"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="wa-csm-divider">Bóng nến (Wick)</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">
                                    <label class="wa-switch"><input type="checkbox" data-bind="showWick"><span class="wa-slider"></span></label>
                                    Hiện bóng
                                </div>
                                <div class="wa-csm-control">
                                    <span style="font-size:11px; color:#5d606b;">Màu riêng</span>
                                    <label class="wa-switch"><input type="checkbox" data-bind="wickIndependent"><span class="wa-slider"></span></label>
                                    <div id="csm-wick-swatches" style="display:flex;gap:6px;opacity:0.35;pointer-events:none;transition:0.2s;">
                                        <div class="wa-color-swatch" data-color-bind="wickUpColor"></div>
                                        <div class="wa-color-swatch" data-color-bind="wickDownColor"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="csm-ui-lines" style="display:none; flex-direction:column; gap:13px;">
                            <div class="wa-csm-divider">Màu đường</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label" id="lbl-line-color">Màu đường</div>
                                <div class="wa-csm-control">
                                    <div class="wa-color-swatch" data-color-bind="upColor"></div>
                                    <div class="wa-color-swatch" id="swatch-line-down" data-color-bind="downColor" style="display:none;"></div>
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Độ dày <span class="wa-hint">1–5 px</span></div>
                                <div class="wa-csm-control">
                                    <div class="wa-slider-wrap">
                                        <input type="range" class="wa-csm-slider" min="1" max="5" step="0.5" data-bind="lineWidth" data-type="number">
                                        <span class="wa-slider-badge" data-val-key="lineWidth">2px</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="csm-ui-step" style="display:none; flex-direction:column; gap:13px;">
                            <div class="wa-csm-divider">Cài đặt bậc thang</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">
                                    <label class="wa-switch"><input type="checkbox" data-bind="stepLineSingleColor"><span class="wa-slider"></span></label>
                                    Dùng 1 màu liền mạch
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Màu tăng / 1 màu</div>
                                <div class="wa-csm-control"><div class="wa-color-swatch" data-color-bind="upColor"></div></div>
                            </div>
                            <div class="wa-csm-row" id="row-step-down">
                                <div class="wa-csm-label">Màu đoạn giảm</div>
                                <div class="wa-csm-control"><div class="wa-color-swatch" data-color-bind="downColor"></div></div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Độ dày <span class="wa-hint">1–5 px</span></div>
                                <div class="wa-csm-control">
                                    <div class="wa-slider-wrap">
                                        <input type="range" class="wa-csm-slider" min="1" max="5" step="0.5" data-bind="lineWidth" data-type="number">
                                        <span class="wa-slider-badge" data-val-key="lineWidth">2px</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="csm-ui-hlc" style="display:none; flex-direction:column; gap:13px;">
                            <div class="wa-csm-divider">Đường Close</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Màu đường Close</div>
                                <div class="wa-csm-control"><div class="wa-color-swatch" data-color-bind="hlcCloseColor"></div></div>
                            </div>
                            <div class="wa-csm-divider">Viền đỉnh / đáy</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">
                                    <label class="wa-switch"><input type="checkbox" data-bind="hlcShowHighLow"><span class="wa-slider"></span></label>
                                    Hiện viền H-L
                                </div>
                                <div class="wa-csm-control">
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="hlcHighColor"></div><div class="wa-swatch-lbl">High</div></div>
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="hlcLowColor"></div><div class="wa-swatch-lbl">Low</div></div>
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Độ mờ viền</div>
                                <div class="wa-csm-control"><div class="wa-slider-wrap">
                                    <input type="range" class="wa-csm-slider" min="0" max="1" step="0.05" data-bind="hlcHighLowOpacity" data-type="number">
                                    <span class="wa-slider-badge" data-val-key="hlcHighLowOpacity">0.35</span>
                                </div></div>
                            </div>
                            <div class="wa-csm-divider">Vùng nền</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Nền trên / dưới</div>
                                <div class="wa-csm-control">
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="hlcUpFillColor"></div><div class="wa-swatch-lbl">Trên</div></div>
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="hlcDownFillColor"></div><div class="wa-swatch-lbl">Dưới</div></div>
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Độ mờ nền</div>
                                <div class="wa-csm-control"><div class="wa-slider-wrap">
                                    <input type="range" class="wa-csm-slider" min="0" max="0.6" step="0.05" data-bind="hlcFillOpacity" data-type="number">
                                    <span class="wa-slider-badge" data-val-key="hlcFillOpacity">0.15</span>
                                </div></div>
                            </div>
                        </div>

                        <div id="csm-ui-baseline" style="display:none; flex-direction:column; gap:13px;">
                            <div class="wa-csm-divider">Màu đường & nền</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Nửa trên (Tăng)</div>
                                <div class="wa-csm-control">
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="baselineUpColor"></div><div class="wa-swatch-lbl">Đường</div></div>
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="baselineUpFill"></div><div class="wa-swatch-lbl">Nền</div></div>
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Nửa dưới (Giảm)</div>
                                <div class="wa-csm-control">
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="baselineDownColor"></div><div class="wa-swatch-lbl">Đường</div></div>
                                    <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="baselineDownFill"></div><div class="wa-swatch-lbl">Nền</div></div>
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Độ mờ nền chung</div>
                                <div class="wa-csm-control"><div class="wa-slider-wrap">
                                    <input type="range" class="wa-csm-slider" min="0" max="0.6" step="0.05" data-bind="baselineFillOpacity" data-type="number">
                                    <span class="wa-slider-badge" data-val-key="baselineFillOpacity">0.20</span>
                                </div></div>
                            </div>
                            <div class="wa-csm-divider">Thông số Baseline</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Mức cơ sở <span class="wa-hint">0–100%</span></div>
                                <div class="wa-csm-control">
                                    <div class="wa-slider-wrap">
                                        <input type="range" class="wa-csm-slider" min="0" max="100" step="1" data-bind="baselineValue" data-type="number">
                                        <span class="wa-slider-badge" data-val-key="baselineValue">50%</span>
                                    </div>
                                    <input type="number" class="wa-csm-input-num" min="0" max="100" data-bind="baselineValue" data-type="number">
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Nguồn giá</div>
                                <select class="wa-csm-select" data-bind="baselinePriceSource">
                                    <option value="close">Đóng cửa (Close)</option>
                                    <option value="hl2">TB High+Low ÷ 2</option>
                                    <option value="ohlc4">TB toàn phần OHLC÷4</option>
                                </select>
                            </div>
                        </div>

                        <div class="wa-csm-divider">Trục giá (Y-Axis)</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Thang đo</div>
                            <select class="wa-csm-select" data-bind="yAxisMode">
                                <option value="normal">Bình thường</option>
                                <option value="percentage">Phần trăm (%)</option>
                                <option value="log">Logarit (Log)</option>
                            </select>
                        </div>
                    </div>

                    <div id="csm-status" class="wa-csm-panel">
                        <div class="wa-csm-divider">Thông tin trên biểu đồ</div>
                        <div class="wa-csm-row"><div class="wa-csm-label">Dữ liệu OHLCV</div><label class="wa-switch"><input type="checkbox" data-bind="showOHLC"><span class="wa-slider"></span></label></div>
                        <div class="wa-csm-row"><div class="wa-csm-label">Đếm ngược (Countdown)</div><label class="wa-switch"><input type="checkbox" data-bind="showCountdown"><span class="wa-slider"></span></label></div>
                        <div class="wa-csm-row"><div class="wa-csm-label">Đường giá hiện tại</div><label class="wa-switch"><input type="checkbox" data-bind="showLastPriceLine"><span class="wa-slider"></span></label></div>
                        <div class="wa-csm-row"><div class="wa-csm-label">Nhãn High / Low</div><label class="wa-switch"><input type="checkbox" data-bind="showHighLowTags"><span class="wa-slider"></span></label></div>

                        <div class="wa-csm-divider">Watermark (Dấu chìm)</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">
                                <label class="wa-switch"><input type="checkbox" data-bind="showWatermark"><span class="wa-slider"></span></label>
                                Hiện watermark
                            </div>
                            <div class="wa-csm-control"><div class="wa-slider-wrap">
                                <input type="range" class="wa-csm-slider" min="0" max="0.3" step="0.01" data-bind="watermarkOpacity" data-type="number">
                                <span class="wa-slider-badge" data-val-key="watermarkOpacity">0.05</span>
                            </div></div>
                        </div>

                        <div class="wa-csm-divider">Crosshair</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Tâm ngắm</div>
                            <select class="wa-csm-select" data-bind="crosshairMode">
                                <option value="normal">Bình thường</option>
                                <option value="hidden">Ẩn hoàn toàn</option>
                            </select>
                        </div>

                        <div class="wa-csm-divider">Múi giờ</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Timezone</div>
                            <select class="wa-csm-select" data-bind="timezone">
                                <option value="Asia/Ho_Chi_Minh">🇻🇳 Hồ Chí Minh (UTC+7)</option>
                                <option value="Asia/Singapore">🇸🇬 Singapore (UTC+8)</option>
                                <option value="Asia/Tokyo">🇯🇵 Tokyo (UTC+9)</option>
                                <option value="Asia/Seoul">🇰🇷 Seoul (UTC+9)</option>
                                <option value="Asia/Shanghai">🇨🇳 Shanghai (UTC+8)</option>
                                <option value="Europe/London">🇬🇧 London (UTC+0)</option>
                                <option value="America/New_York">🇺🇸 New York (UTC-5)</option>
                                <option value="UTC">🌐 UTC</option>
                            </select>
                        </div>
                    </div>

                    <div id="csm-appearance" class="wa-csm-panel">
                        <div class="wa-csm-divider">Nền biểu đồ</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Kiểu nền</div>
                            <div class="wa-csm-control">
                                <select class="wa-csm-select" data-bind="bgType" id="csm-bg-type" style="width:110px;">
                                    <option value="solid">Đơn sắc</option>
                                    <option value="gradient">Gradient</option>
                                </select>
                                <div class="wa-swatch-group"><div class="wa-color-swatch" data-color-bind="bgColor"></div><div class="wa-swatch-lbl">Màu 1</div></div>
                                <div class="wa-swatch-group" id="csm-bg2-wrap" style="display:none;">
                                    <div class="wa-color-swatch" data-color-bind="bgColor2"></div>
                                    <div class="wa-swatch-lbl">Màu 2</div>
                                </div>
                            </div>
                        </div>

                        <div class="wa-csm-divider">Lưới (Grid)</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Lưới dọc</div>
                            <label class="wa-switch"><input type="checkbox" data-bind="gridVertical"><span class="wa-slider"></span></label>
                        </div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Lưới ngang</div>
                            <label class="wa-switch"><input type="checkbox" data-bind="gridHorizontal"><span class="wa-slider"></span></label>
                        </div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Màu lưới</div>
                            <div class="wa-color-swatch" data-color-bind="gridColor"></div>
                        </div>

                        <div class="wa-csm-divider">Không gian biểu đồ</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Lề phải <span class="wa-hint">nến</span></div>
                            <div class="wa-csm-control"><div class="wa-slider-wrap">
                                <input type="range" class="wa-csm-slider" min="0" max="50" step="1" data-bind="rightMargin" data-type="number">
                                <span class="wa-slider-badge" data-val-key="rightMargin">10</span>
                            </div></div>
                        </div>
                    </div>

                    <div id="csm-themes" class="wa-csm-panel">
                        <div class="wa-csm-divider">Chủ đề nhanh (1 click)</div>
                        <div class="wa-preset-grid" id="csm-preset-grid"></div>

                        <div class="wa-csm-divider" style="margin-top:4px;">Màu đang dùng</div>
                        <div class="wa-csm-group">
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Tăng (Up)</div>
                                <div class="wa-csm-control">
                                    <div class="wa-color-swatch" data-color-bind="upColor"></div>
                                    <code id="preview-upColor" style="font-size:11px;color:#26a69a;font-family:monospace;">#0ECB81</code>
                                </div>
                            </div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Giảm (Down)</div>
                                <div class="wa-csm-control">
                                    <div class="wa-color-swatch" data-color-bind="downColor"></div>
                                    <code id="preview-downColor" style="font-size:11px;color:#F6465D;font-family:monospace;">#F6465D</code>
                                </div>
                            </div>
                        </div>

                        <div class="wa-csm-divider">Sao lưu & khôi phục</div>
                        <div class="wa-action-row">
                            <button class="wa-action-btn wa-btn-neutral" id="wa-btn-export-cfg">📤 Xuất JSON</button>
                            <button class="wa-action-btn wa-btn-neutral" id="wa-btn-import-cfg">📥 Nhập JSON</button>
                        </div>
                        <input type="file" id="wa-import-file" accept=".json" style="display:none;">
                    </div>

                    <div id="csm-pro" class="wa-csm-panel">
                        <div class="wa-info-box">⚡ Tính năng thực nghiệm — dành cho người dùng chuyên nghiệp.</div>
                        <div class="wa-csm-divider">Màu sắc nâng cao</div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">PAC Coloring <span class="wa-hint">Beta</span></div>
                            <label class="wa-switch"><input type="checkbox" data-bind="pacColoring"><span class="wa-slider"></span></label>
                        </div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Volume Overlay <span class="wa-hint">Beta</span></div>
                            <label class="wa-switch"><input type="checkbox" data-bind="volumeOverlay"><span class="wa-slider"></span></label>
                        </div>
                        <div class="wa-csm-row">
                            <div class="wa-csm-label">Abnormal Vol Color</div>
                            <label class="wa-switch"><input type="checkbox" data-bind="abnormalVolColoring"><span class="wa-slider"></span></label>
                        </div>
                        <div class="wa-csm-divider" style="color:#F6465D; border-color:rgba(246,70,93,0.15);">⚠️ Nguy hiểm</div>
                        <div class="wa-action-row">
                            <button class="wa-action-btn wa-btn-danger" id="wa-btn-reset-cfg">🔄 Khôi phục mặc định</button>
                        </div>
                    </div>

                </div></div></div></div><div id="wa-color-picker">
            <div class="wcp-preview" id="wcp-preview"></div>
            <div class="wcp-section-lbl">Palette</div>
            <div class="wcp-grid" id="wcp-palette"></div>
            <div class="wcp-row">
                <span class="wcp-lbl">HEX</span>
                <input class="wcp-hex" id="wcp-hex" maxlength="7" placeholder="#000000">
                <input type="color" class="wcp-native" id="wcp-native">
            </div>
            <div class="wcp-row">
                <span class="wcp-lbl">Opacity</span>
                <input type="range" class="wcp-opacity" id="wcp-opacity" min="0" max="1" step="0.01" value="1">
                <span class="wcp-op-val" id="wcp-op-val">100%</span>
            </div>
            <div id="wcp-recent-section" style="display:none;">
                <div class="wcp-section-lbl" style="margin-top:6px;">Gần đây</div>
                <div class="wcp-recent" id="wcp-recent"></div>
            </div>
        </div>
    `);

    // ─── DOM refs ────────────────────────────────────────────────────────
    const backdrop    = document.getElementById('wa-csm-backdrop');
    const modal       = document.getElementById('wa-chart-settings-modal');
    const modalBox    = document.getElementById('wa-csm-box');
    const header      = modal.querySelector('.wa-csm-header');
    const cp          = document.getElementById('wa-color-picker');
    const cpPreview   = document.getElementById('wcp-preview');
    const hexInp      = document.getElementById('wcp-hex');
    const nativeInp   = document.getElementById('wcp-native');
    const opSlider    = document.getElementById('wcp-opacity');
    const opValEl     = document.getElementById('wcp-op-val');
    const palette     = document.getElementById('wcp-palette');

    let activeSwatch = null, activeKey = null;
    let recentColors = [];
    try { recentColors = JSON.parse(localStorage.getItem('_wa_rcols') || '[]'); } catch(e){}

    // ─── COLOR UTILS ─────────────────────────────────────────────────────
    const rgb2hex = (s) => {
        if (!s || (!s.startsWith('rgb') && !s.startsWith('rgba'))) return s || '#000000';
        const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return '#000000';
        return '#' + [m[1],m[2],m[3]].map(v => (+v).toString(16).padStart(2,'0')).join('');
    };
    const getAlpha = (s) => {
        if (!s) return 1;
        const m = s.match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
        return m ? Math.round(parseFloat(m[1]) * 100) / 100 : 1;
    };
    const buildColor = (hex, op) => {
        if (!hex || hex.length < 7) return hex || '#000000';
        if (op >= 0.999) return hex;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${op.toFixed(2)})`;
    };

    // ─── RECENT COLORS ───────────────────────────────────────────────────
    const syncRecent = () => {
        const sec = document.getElementById('wcp-recent-section');
        const el  = document.getElementById('wcp-recent');
        if (!recentColors.length) { sec.style.display='none'; return; }
        sec.style.display='block';
        el.innerHTML = '';
        recentColors.slice(0,12).forEach(c => {
            const d = document.createElement('div'); d.className='wcp-rcell'; d.style.background=c; d.title=c;
            d.onclick = () => { hexInp.value=c; nativeInp.value=c; applyColor(c, parseFloat(opSlider.value)); };
            el.appendChild(d);
        });
    };
    const addRecent = (hex) => {
        recentColors = [hex, ...recentColors.filter(c=>c!==hex)].slice(0,12);
        try { localStorage.setItem('_wa_rcols', JSON.stringify(recentColors)); } catch(e){}
        syncRecent();
    };

    // ─── PALETTE BUILD ───────────────────────────────────────────────────
    PALETTE.forEach(col => {
        const el = document.createElement('div'); el.className='wcp-cell'; el.style.background=col; el.title=col;
        el.onclick = () => {
            palette.querySelectorAll('.wcp-cell').forEach(c=>c.classList.remove('sel')); el.classList.add('sel');
            hexInp.value=col; nativeInp.value=col; applyColor(col, parseFloat(opSlider.value));
        };
        palette.appendChild(el);
    });
    syncRecent();

    // ─── APPLY COLOR ─────────────────────────────────────────────────────
    function applyColor(hex, opacity) {
        if (!activeSwatch) return;
        // Fix: chỉ lấy 7 ký tự đầu để bỏ qua alpha hex (nếu có) khi chuyển đổi màu
        const final = buildColor(hex.slice(0, 7), opacity);
        activeSwatch.style.background = final;
        cpPreview.style.background    = final;
        if (activeKey === 'upColor')   { const el=document.getElementById('preview-upColor');   if(el) el.textContent=final; }
        if (activeKey === 'downColor') { const el=document.getElementById('preview-downColor'); if(el) el.textContent=final; }
        modal.querySelectorAll(`.wa-color-swatch[data-color-bind="${activeKey}"]`).forEach(s => s.style.background=final);
        if (window.WaveChartEngine) window.WaveChartEngine.update({ [activeKey]: final });
    }

    // ─── OPEN PICKER ─────────────────────────────────────────────────────
    function openPicker(swatch, e) {
        activeSwatch = swatch; activeKey = swatch.dataset.colorBind;
        const cur = swatch.style.background || '#0ECB81';
        const hex = rgb2hex(cur); const op = getAlpha(cur);
        hexInp.value=hex; nativeInp.value=hex;
        opSlider.value=op; opValEl.textContent=Math.round(op*100)+'%';
        cpPreview.style.background = cur;
        palette.querySelectorAll('.wcp-cell.sel').forEach(c=>c.classList.remove('sel'));
        const match = palette.querySelector(`.wcp-cell[title="${hex}"]`);
        if (match) match.classList.add('sel');
        
        const r=swatch.getBoundingClientRect(), pw=242, ph=340;
        let left=r.left, top=r.bottom+8;
        if (left+pw > window.innerWidth-8)  left = window.innerWidth-pw-8;
        if (top+ph  > window.innerHeight-8) top  = r.top-ph-8;
        if (left < 8) left = 8;
        cp.style.left=left+'px'; cp.style.top=top+'px'; cp.style.display='block';
        e.stopPropagation();
    }

    modal.querySelectorAll('.wa-color-swatch').forEach(sw => sw.addEventListener('click', e=>openPicker(sw,e)));

    hexInp.addEventListener('input', e => {
        const v=e.target.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) { nativeInp.value=v; applyColor(v, parseFloat(opSlider.value)); }
    });
    hexInp.addEventListener('keydown', e => { if(e.key==='Enter'){ addRecent(hexInp.value); cp.style.display='none'; } });
    nativeInp.addEventListener('input', e => { hexInp.value=e.target.value; applyColor(e.target.value, parseFloat(opSlider.value)); });
    opSlider.addEventListener('input', e => {
        const op=parseFloat(e.target.value);
        opValEl.textContent = Math.round(op*100)+'%';
        applyColor(hexInp.value, op);
    });
    document.addEventListener('click', e => {
        if (!cp.contains(e.target) && !e.target.classList.contains('wa-color-swatch')) {
            if (cp.style.display!=='none' && activeSwatch) addRecent(hexInp.value);
            cp.style.display='none';
        }
    });

    // ─── SLIDER BADGES ───────────────────────────────────────────────────
    const BADGE_FMT = {
        lineWidth:           v => (+v).toFixed(1)+'px',
        watermarkOpacity:    v => (+v).toFixed(2),
        rightMargin:         v => v+' px',
        hlcHighLowOpacity:   v => (+v).toFixed(2),
        hlcFillOpacity:      v => (+v).toFixed(2),
        baselineFillOpacity: v => (+v).toFixed(2),
        baselineValue:       v => v+'%',
    };
    function syncBadges(key, value) {
        const fmt = BADGE_FMT[key]; if (!fmt) return;
        modal.querySelectorAll(`[data-val-key="${key}"]`).forEach(el => el.textContent=fmt(value));
    }

    // ─── DYNAMIC UI ──────────────────────────────────────────────────────
    function updateDynamicUI(cfg) {
        const t = parseInt(cfg.chartType);
        const show = (id, vis) => { const el=document.getElementById(id); if(el) el.style.display=vis?'flex':'none'; };
        show('csm-ui-candles',  [1,2,3,4,5].includes(t));
        show('csm-ui-lines',    [6,7,9].includes(t));
        show('csm-ui-step',     t===8);
        show('csm-ui-hlc',      t===10);
        show('csm-ui-baseline', t===11);

        const lds = document.getElementById('swatch-line-down');
        const lbl = document.getElementById('lbl-line-color');
        if (lds) lds.style.display = t===7 ? 'block' : 'none';
        if (lbl) lbl.textContent   = t===7 ? 'Đường / Điểm giảm' : 'Màu đường';

        const rsd = document.getElementById('row-step-down');
        if (rsd) rsd.style.display = cfg.stepLineSingleColor ? 'none' : 'flex';

        const bg2 = document.getElementById('csm-bg2-wrap');
        if (bg2) bg2.style.display = cfg.bgType==='gradient' ? 'flex' : 'none';

        ['border','wick'].forEach(k => {
            const el = document.getElementById(`csm-${k}-swatches`);
            if (!el) return;
            const on = cfg[k+'Independent'];
            el.style.opacity       = on ? '1' : '0.35';
            el.style.pointerEvents = on ? 'auto' : 'none';
        });
    }

    // ─── SYNC UI FROM CONFIG ─────────────────────────────────────────────
    function syncUI(cfg) {
        modal.querySelectorAll('[data-bind]').forEach(el => {
            const key=el.dataset.bind; if (cfg[key]===undefined) return;
            if (el.type==='checkbox') el.checked=!!cfg[key]; else el.value=cfg[key];
            syncBadges(key, cfg[key]);
        });
        modal.querySelectorAll('.wa-color-swatch').forEach(sw => {
            const key=sw.dataset.colorBind; if(cfg[key]) sw.style.background=cfg[key];
        });
        const pu=document.getElementById('preview-upColor'), pd=document.getElementById('preview-downColor');
        if(pu) pu.textContent=cfg.upColor; if(pd) pd.textContent=cfg.downColor;
    }

    // ─── DRAG ────────────────────────────────────────────────────────────
    let drag=false, dx=0, dy=0, ox=0, oy=0;
    header.addEventListener('mousedown', e => {
        if (e.target.id==='btn-wa-csm-close') return;
        drag=true; dx=e.clientX; dy=e.clientY;
        const r=modalBox.getBoundingClientRect(); ox=r.left; oy=r.top;
        modalBox.style.transform='none'; modalBox.style.left=ox+'px'; modalBox.style.top=oy+'px';
        document.body.style.userSelect='none';
    });
    window.addEventListener('mousemove', e => { if(!drag) return; modalBox.style.left=(ox+e.clientX-dx)+'px'; modalBox.style.top=(oy+e.clientY-dy)+'px'; });
    window.addEventListener('mouseup',   () => { drag=false; document.body.style.userSelect=''; });

    // ─── TABS ────────────────────────────────────────────────────────────
    modal.querySelectorAll('.wa-csm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.wa-csm-tab').forEach(t=>t.classList.remove('active'));
            modal.querySelectorAll('.wa-csm-panel').forEach(p=>p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // ─── OPEN / CLOSE ────────────────────────────────────────────────────
    window.openChartSettings = function() {
        if (!window.WaveChartEngine) return;
        const cfg = window.WaveChartEngine.getConfig();
        syncUI(cfg); updateDynamicUI(cfg);
        modalBox.style.transform='translate(-50%,-50%)'; modalBox.style.left='50%'; modalBox.style.top='50%';
        backdrop.style.display = 'block';
        modal.style.display    = 'block';
        
        requestAnimationFrame(() => requestAnimationFrame(() => {
            backdrop.classList.add('show');
            modal.classList.add('show');
        }));
    };

    function closeModal() {
        backdrop.classList.remove('show');
        modal.classList.remove('show');
        cp.style.display = 'none';
        setTimeout(() => { backdrop.style.display='none'; modal.style.display='none'; }, 210);
    }

    document.getElementById('btn-wa-csm-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if(e.key==='Escape' && modal.classList.contains('show')) closeModal(); });

    // ─── CHANGE EVENTS ───────────────────────────────────────────────────
    modal.querySelectorAll('[data-bind]').forEach(el => {
        el.addEventListener(el.type==='range' ? 'input' : 'change', () => {
            const key = el.dataset.bind;
            let val = el.type==='checkbox' ? el.checked : el.value;
            if (el.dataset.type==='number') val = parseFloat(val);
            if (window.WaveChartEngine) window.WaveChartEngine.update({ [key]: val });
            syncBadges(key, val);
            
            modal.querySelectorAll(`[data-bind="${key}"]`).forEach(linked => {
                if (linked===el) return;
                if (linked.type==='checkbox') linked.checked=el.checked;
                else linked.value=el.value;
            });
            updateDynamicUI(window.WaveChartEngine.getConfig());
        });
    });

    // ─── THEME PRESETS ───────────────────────────────────────────────────
    const pg = document.getElementById('csm-preset-grid');
    Object.entries(THEMES).forEach(([name, preset]) => {
        const btn = document.createElement('button'); btn.className='wa-preset-btn';
        btn.innerHTML=`<div style="display:flex;justify-content:center;gap:3px;margin-bottom:3px;">
            <div style="width:10px;height:10px;border-radius:2px;background:${preset.upColor};"></div>
            <div style="width:10px;height:10px;border-radius:2px;background:${preset.downColor};"></div>
        </div>${name}`;
        btn.title=`Áp dụng chủ đề: ${name}`;
        btn.onclick = () => {
            if (!window.WaveChartEngine) return;
            window.WaveChartEngine.update(preset, true);
            syncUI(window.WaveChartEngine.getConfig());
            pg.querySelectorAll('.wa-preset-btn').forEach(b=>b.classList.remove('active-preset'));
            btn.classList.add('active-preset');
        };
        pg.appendChild(btn);
    });

    // ─── EXPORT / IMPORT ────────────────────────────────────────────────
    document.getElementById('wa-btn-export-cfg').onclick = () => {
        if (!window.WaveChartEngine) return;
        const blob = new Blob([JSON.stringify(window.WaveChartEngine.getConfig(), null, 2)], {type:'application/json'});
        const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:'wave-chart-config.json' });
        a.click(); URL.revokeObjectURL(a.href);
    };
    
    document.getElementById('wa-btn-import-cfg').onclick = () => document.getElementById('wa-import-file').click();
    document.getElementById('wa-import-file').onchange = e => {
        const f = e.target.files[0]; 
        if(!f) return;
        const fr = new FileReader(); 
        fr.onload = ev => {
            try {
                const cfg = JSON.parse(ev.target.result);
                if(window.WaveChartEngine){ 
                    window.WaveChartEngine.update(cfg, true); 
                    syncUI(window.WaveChartEngine.getConfig()); 
                    updateDynamicUI(window.WaveChartEngine.getConfig()); 
                }
            } catch(err){ 
                alert('❌ File JSON không hợp lệ:\n' + err.message); 
            }
        }; 
        fr.readAsText(f); 
        e.target.value = '';
    };

    // ─── RESET ───────────────────────────────────────────────────────────
    document.getElementById('wa-btn-reset-cfg').onclick = () => {
        if (confirm('Bạn có chắc muốn khôi phục toàn bộ cài đặt biểu đồ về mặc định?\nHành động này không thể hoàn tác.')) {
            localStorage.removeItem('wave_alpha_chart_config');
            window.location.reload();
        }
    };

    // ─── GEAR BUTTON ────────────────────────────────────────────────────
    const timer = setInterval(() => {
        const typeBtn = document.getElementById('btn-wa-chart-type');
        if (!typeBtn || !typeBtn.parentNode) return;
        clearInterval(timer);
        if (document.getElementById('btn-wa-chart-settings')) return;
        typeBtn.insertAdjacentHTML('afterend', `
            <button id="btn-wa-chart-settings" title="Cài đặt biểu đồ  [Ctrl+,]"
                style="background:rgba(255,255,255,0.05);color:#848e9c;border:1px solid rgba(255,255,255,0.1);
                       border-radius:4px;width:26px;height:26px;display:flex;align-items:center;
                       justify-content:center;cursor:pointer;transition:0.18s;margin-left:6px;flex-shrink:0;"
                onmouseenter="this.style.background='rgba(38,166,154,0.15)';this.style.color='#26a69a';this.style.borderColor='rgba(38,166,154,0.3)';"
                onmouseleave="this.style.background='rgba(255,255,255,0.05)';this.style.color='#848e9c';this.style.borderColor='rgba(255,255,255,0.1)';">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 4.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
            </button>
        `);
        document.getElementById('btn-wa-chart-settings').onclick = e => { e.stopPropagation(); window.openChartSettings(); };
    }, 200);

    // Ctrl+, shortcut
    document.addEventListener('keydown', e => { if ((e.ctrlKey||e.metaKey) && e.key===',') { e.preventDefault(); window.openChartSettings?.(); } });

    // Listen for config updates from outside
    window.addEventListener('wa_chart_config_updated', e => {
        if (!modal.classList.contains('show')) return;
        syncUI(e.detail); updateDynamicUI(e.detail);
    });

})();

// ==========================================
// 🌊 ĐỘNG CƠ WATERFALL (NỘI SUY TUYẾN TÍNH HFT KLINECHART)
// ==========================================
window._waTargetCandle = null;
window._waCurrentCandle = null;
window._waRafRunning = false;

// ==========================================
// 🚀 TRẠM ĐÁNH CHẶN REALTIME (HOOK) CHO DATA ENGINE
// ==========================================
window.safeUpdateChartData = function(candleObj) {
    if (!window.tvChart) return;
    let finalCandle = candleObj;
    if (window.WaveDataEngine) {
        let dataList = window.tvChart.getDataList();
        finalCandle = window.WaveDataEngine.processTick(candleObj, dataList);
    }
    window.tvChart.updateData(finalCandle);
};

window.startWaterfallEngine = function() {
    if (window._waRafRunning || !window.tvChart) return;
    window._waRafRunning = true;
    let lastDraw = 0;

    function renderLoop(time) {
        // 💡 VÁ LỖI: Trả lại trạng thái false để lần sau mở Chart động cơ còn biết đường chạy lại
        if (!window.tvChart || !window._waTargetCandle) {
            window._waRafRunning = false; 
            return; 
        }
        
        requestAnimationFrame(renderLoop);
        
        // 💡 BẢO VỆ GPU: Nếu tab đang bị ẩn/thu nhỏ, tạm ngưng vẽ nến để tiết kiệm 100% tài nguyên Card Màn Hình
        if (document.hidden) return;
        
        // 🛡️ BẢO VỆ CPU: Khóa render ở mức 30 FPS (khoảng 30-33ms). 
        if (time - lastDraw < 30) return;

        let t = window._waTargetCandle;
        let c = window._waCurrentCandle;

        if (!c || c.timestamp !== t.timestamp) {
            window._waCurrentCandle = { ...t };
            window.safeUpdateChartData(window._waCurrentCandle);
            lastDraw = time;
            return;
        }

        let diff = t.close - c.close;
        
        if (diff !== 0) {
            c.close += diff * 0.35; // Trượt 35% quãng đường (Tạo cảm giác Waterfall)
            
            c.high = Math.max(c.high, t.high, c.close);
            c.low = Math.min(c.low, t.low, c.close);
            c.volume = t.volume;

            if (Math.abs(t.close - c.close) < (t.close * 0.000001)) {
                c.close = t.close;
            }

            window.safeUpdateChartData(c);
            lastDraw = time;
        }
    }
    requestAnimationFrame(renderLoop);
};

// 🧠 BỘ NÃO DYNAMIC: LẤY MASTER LIST TỪ RENDER (LÁCH LUẬT CSP TRÌNH DUYỆT)
window._binanceTokenListCache = null;
window.getSmartTokenContext = async function(t) {
    let alphaId = (t.alphaId || t.id || '').toUpperCase();
    let contract = t.contractAddress || t.contract || '';
    let chainId = t.chainId || t.chain_id;

    if (!chainId || !contract) {
        if (!window._binanceTokenListCache) {
            try {
                // 👉 GỌI VỀ RENDER ĐỂ BYPASS CSP CỦA BINANCE
                let res = await fetch("/api/token-list");
                let json = await res.json();
                if (json.success) window._binanceTokenListCache = json.data;
            } catch(e) {}
        }
        if (window._binanceTokenListCache) {
            let found = window._binanceTokenListCache.find(x => 
                (x.alphaId && x.alphaId.toUpperCase() === alphaId) || 
                (x.symbol && t.symbol && x.symbol.toUpperCase() === t.symbol.toUpperCase())
            );
            if (found) {
                if (!contract) contract = found.contractAddress;
                if (!chainId) chainId = found.chainId;
            }
        }
    }

    t.contractAddress = contract;
    t.chainId = chainId;

    let finalChainId = String(chainId || "56"); 
    let cleanAddr = String(contract || '');
    
    // Thuật toán Case-sensitive bảo vệ TRON/SOLANA (Python Match)
    const no_lower_chains = ["CT_501", "CT_784", "501", "784", "CT_195", "195"];
    if (!no_lower_chains.includes(finalChainId)) {
        cleanAddr = cleanAddr.toLowerCase(); 
    }

    return { contract: cleanAddr, chainId: finalChainId };
};

// chart-engine.js — đầu hàm connectRealtimeChart
window.connectRealtimeChart = async function(t, isTimeSwitch = false) {
    // ✅ THÊM: Luôn dừng sạch waterfall trước
    window._waRafRunning = false;
    window._waTargetCandle = null;
    window._waCurrentCandle = null;
    
    let rawId = (t.alphaId || t.id || '').toLowerCase().replace('alpha_', ''); 
    let sysSymbol = (t.symbol || '').toLowerCase() + 'usdt';
    let streamPrefix = rawId ? `alpha_${rawId}usdt` : sysSymbol;

    let smartCtx = await window.getSmartTokenContext(t);
    let contract = smartCtx.contract;
    let chainId = smartCtx.chainId;

    if (isTimeSwitch && window.chartWs && window.chartWs.readyState === 1) { 
        if (window.oldChartInterval && window.oldChartInterval !== 'tick') {
            let oldK = contract ? `came@${contract}@${chainId}@kline_${window.oldChartInterval}` : `${streamPrefix}@kline_${window.oldChartInterval}`;
            window.chartWs.send(JSON.stringify({ "method": "UNSUBSCRIBE", "params": [oldK], "id": Date.now() }));
        }
        if (window.currentChartInterval !== 'tick') {
            let newK = contract ? `came@${contract}@${chainId}@kline_${window.currentChartInterval}` : `${streamPrefix}@kline_${window.currentChartInterval}`;
            window.chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": [newK], "id": Date.now() + 1 }));
        }
        return; 
    }

    if (window.chartWs) window.chartWs.close();

    // 💡 VÁ LỖI: Terminate worker cũ nếu đây là mở chart mới (đổi coin) để tránh Zombie Worker
    if (!isTimeSwitch) {
        if (window.quantWorker) {
            window.quantWorker.terminate();
            window.quantWorker = null;
        }
        window.quantWorker = new Worker('public/js/quant-worker.js');
        window.quantWorker.onmessage = function(e) {
            if (e.data.cmd === 'STATS_UPDATE') {
                Object.assign(window.quantStats, e.data.stats);
            }
        };
    }
    
    // Nếu là đổi khung giờ (isTimeSwitch) hoặc vừa tạo xong, thì reset data
    if (window.quantWorker) {
        window.quantWorker.postMessage({ cmd: 'INIT' });
    }
    window.activeChartSessionId = Date.now() + '_' + t.symbol;
    let currentSession = window.activeChartSessionId;

    if (!window.AlphaChartState) window.AlphaChartState = {};
    let sym = t.symbol || 'UNKNOWN';

    if (!window.AlphaChartState[sym]) {
        window.AlphaChartState[sym] = {
            speedWindow: [], netFlow: 0, whaleCount: 0, totalVol: 0, tradeCount: 0,
            tickHistory: [], chartMarkers: [], lastPrice: parseFloat(t.price) || 0, lastTradeDir: undefined,
            cWhale: 0, cShark: 0, cDolphin: 0, cSweep: 0
        };
    }

    let cache = window.AlphaChartState[sym];
    window.scSpeedWindow = cache.speedWindow; window.scNetFlow = cache.netFlow; 
    window.scWhaleCount = cache.whaleCount; window.scTotalVol = cache.totalVol; 
    window.scTradeCount = cache.tradeCount; window.scLastPrice = cache.lastPrice; 
    window.scLastTradeDir = cache.lastTradeDir; window.scTickHistory = cache.tickHistory; 
    window.scChartMarkers = cache.chartMarkers;
    window.scCWhale = cache.cWhale || 0; window.scCShark = cache.cShark || 0;
    window.scCDolphin = cache.cDolphin || 0; window.scCSweep = cache.cSweep || 0;
    window.quantStats = cache.quantStats || { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };
    window.scCurrentCluster = null;
    window.scActivePriceLines = []; 
// 🚀 BƯỚC 1: LẤY SNAPSHOT FULL DEPTH TỪ RENDER TRƯỚC KHI MỞ WEBSOCKET
let targetSymbol = rawId ? `ALPHA_${rawId.toUpperCase()}USDT` : sysSymbol.toUpperCase();
    
// LOG 1: Báo hiệu bắt đầu gọi
console.log(`🌊 [DEPTH SNAPSHOT] Đang lấy sổ lệnh 50 nấc cho ${targetSymbol}...`);

fetch(`${RENDER_BASE_URL}/api/full-depth?symbol=${targetSymbol}&limit=50`)
    .then(res => res.json())
    .then(json => {
        if (window.activeChartSessionId !== currentSession) return; 

        if (json.success && json.data) {
            // LOG 2: Báo hiệu lấy data thành công
            console.log(`✅ [DEPTH SNAPSHOT] Lấy thành công! Bids: ${json.data.bids.length} | Asks: ${json.data.asks.length}`);
            
            let currentSym = json.data.symbol || targetSymbol;
            
            if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                window.scLocalOrderBook = { sym: currentSym, asks: new Map(), bids: new Map() };
            }
            
            (json.data.bids || []).forEach(item => {
                let p = item[0], q = parseFloat(item[1]);
                if (q > 0) window.scLocalOrderBook.bids.set(p, q);
            });
            
            (json.data.asks || []).forEach(item => {
                let p = item[0], q = parseFloat(item[1]);
                if (q > 0) window.scLocalOrderBook.asks.set(p, q);
            });

            // ÉP BUỘC BẬT HEATMAP ĐỂ TEST 
            window.isHeatmapOn = true;
            
        } else {
            console.error(`❌ [DEPTH SNAPSHOT] Render trả về lỗi:`, json);
        }
    }).catch(e => {
        console.error("🔥 [DEPTH SNAPSHOT] Lỗi mạng hoặc Render chưa được Deploy:", e);
    });

// 🚀 BƯỚC 2: MỞ WEBSOCKET ĐỂ HỨNG DELTA...
try { window.chartWs = new WebSocket('wss://nbstream.binance.com/w3w/wsa/stream'); } catch(e) { return; }

    let params = [];
    if (contract) {
        let targetInterval = window.currentChartInterval === 'tick' ? '1s' : window.currentChartInterval;
        
        // 💡 VÁ LỖI: Chỉ subscribe luồng dữ liệu của khung giờ hiện tại
        params.push(`came@${contract}@${chainId}@kline_${targetInterval}`);
        
        // Nếu UI của bạn có tính năng Candle Volume Widget buộc phải dùng khung 1m, thì mới mở dòng dưới đây:
        if (targetInterval !== '1m') {
            params.push(`came@${contract}@${chainId}@kline_1m`); 
        }
    }

    params.push('came@allTokens@ticker24');

    if (rawId) {
        // Quét cả USDT và USDC cho hàng DEX
        const possibleQuotes = ['usdt', 'usdc'];
        possibleQuotes.forEach(quote => {
            let dexStream = `alpha_${rawId}${quote}`;
            params.push(`${dexStream}@aggTrade`, `${dexStream}@bookTicker`, `${dexStream}@fulldepth@500ms`);
            if (!contract) {
                params.push(`${dexStream}@kline_1m`, `${dexStream}@kline_5m`, `${dexStream}@kline_15m`, `${dexStream}@kline_1h`);
                let targetInterval = window.currentChartInterval === 'tick' ? '1s' : window.currentChartInterval;
                let tk = `${dexStream}@kline_${targetInterval}`;
                if (!params.includes(tk)) params.push(tk);
            }
        });
    } else {
        // Hàng CEX bình thường
        params.push(`${streamPrefix}@aggTrade`, `${streamPrefix}@bookTicker`, `${streamPrefix}@fulldepth@500ms`);
        if (!contract) {
            params.push(`${streamPrefix}@kline_1m`, `${streamPrefix}@kline_5m`, `${streamPrefix}@kline_15m`, `${streamPrefix}@kline_1h`);
            if (window.currentChartInterval !== 'tick') {
                let tk = `${streamPrefix}@kline_${window.currentChartInterval}`;
                if (!params.includes(tk)) params.push(tk);
            }
        }
    }

    window._lastMarkerCount = 0; // 💡 Khởi tạo biến đếm marker

    if (window.scCalcInterval) clearInterval(window.scCalcInterval);
    window.scCalcInterval = setInterval(() => {
        if (document.hidden) return; // 💡 VÁ LỖI: Đóng băng tính toán nếu tab bị ẩn
        if (window.activeChartSessionId !== currentSession) return;
        if (!window.scTickHistory || window.scTickHistory.length === 0) return;
        
        // (Trong file chart-engine.js, hàm setInterval 1000ms)
        const now = Date.now();
        if (!window.bookmapHistory) window.bookmapHistory = [];
        if (window.scLocalOrderBook) {
            window.bookmapHistory.push({
                t: now,
                asks: new Map(window.scLocalOrderBook.asks),
                bids: new Map(window.scLocalOrderBook.bids)
            });
            if (window.bookmapHistory.length > 600) window.bookmapHistory.shift();
        }
        window.scTickHistory = window.scTickHistory.filter(x => now - x.t <= 300000);
        if (window.scTickHistory.length > 3000) window.scTickHistory = window.scTickHistory.slice(-3000);

        // Xóa bỏ tàn tích activeSeries của TradingView, thay bằng window.tvChart của KLineChart
        if (window.tvChart && window.quantStats.flags && window.scTickHistory.length > 0) {
            let flags = window.quantStats.flags;
            let timeSec = Math.floor(Date.now() / 1000);
            let lastMarker = window.scChartMarkers[window.scChartMarkers.length - 1];
            let canDraw = !lastMarker || (timeSec - lastMarker.time > 5);

            if (canDraw) {
                if (flags.stopHunt) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#00F0FF', shape: 'arrowUp', text: '🪝 STOP-HUNT', fishType: 'bot' }); }
                else if (flags.exhausted) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: flags.wallHit ? '#F0B90B' : '#848e9c', shape: 'arrowUp', text: flags.wallHit ? '🛡️ WALL HIT' : '🪫 EXHAUSTED', fishType: 'bot' }); }
                else if (flags.bullishIceberg || flags.icebergAbsorption) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#0ECB81', shape: 'arrowUp', text: '🧊 ĐỠ', fishType: 'bot' }); }
                else if (flags.bearishIceberg) { window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F6465D', shape: 'arrowDown', text: '🧊 ĐÈ', fishType: 'bot' }); }
                else if (flags.spoofingBuyWall) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#F0B90B', shape: 'arrowUp', text: '⚠️ TƯỜNG MUA ẢO', fishType: 'bot' }); }
                else if (flags.spoofingSellWall) { window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F0B90B', shape: 'arrowDown', text: '⚠️ TƯỜNG BÁN ẢO', fishType: 'bot' }); }
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
        }

        let algoEl = document.getElementById('sc-algo-limit');
        if (algoEl && window.quantStats.algoLimit !== undefined) {
            let algoLmt = window.quantStats.algoLimit;
            let limitText = `< $${window.formatCompactUSD(algoLmt)}`;
            let limitColor = '#0ECB81'; let bgColor = 'rgba(14,203,129,0.1)'; let bdColor = 'rgba(14,203,129,0.3)';
            if (algoLmt < 10 || algoLmt < 50) { 
                limitColor = '#F6465D'; limitText = algoLmt < 10 ? '💀 DEAD' : limitText; bgColor = 'rgba(246,70,93,0.1)'; bdColor = 'rgba(246,70,93,0.3)';
            } else if (algoLmt <= 200) { 
                limitColor = '#F0B90B'; bgColor = 'rgba(240,185,11,0.1)'; bdColor = 'rgba(240,185,11,0.3)';
            }
            algoEl.innerHTML = `ALGO LIMIT: ${limitText}`;
            algoEl.style.color = limitColor; algoEl.style.background = bgColor; algoEl.style.borderColor = bdColor;
        }


        
        

        let sym = window.currentChartToken ? window.currentChartToken.symbol : 'UNKNOWN';
        if (window.AlphaChartState && window.AlphaChartState[sym]) {
            Object.assign(window.AlphaChartState[sym], {
                netFlow: window.scNetFlow, whaleCount: window.scWhaleCount, totalVol: window.scTotalVol,
                tradeCount: window.scTradeCount, lastPrice: window.scLastPrice, lastTradeDir: window.scLastTradeDir,
                speedWindow: window.scSpeedWindow, tickHistory: window.scTickHistory, chartMarkers: window.scChartMarkers,
                cWhale: window.scCWhale, cShark: window.scCShark, cDolphin: window.scCDolphin, cSweep: window.scCSweep, quantStats: window.quantStats
            });
        }

        window.scSpeedWindow = window.scSpeedWindow.filter(x => now - x.t <= 5000);

        // 💡 VÁ LỖI: Chỉ chạy vòng lặp Fish Filter NẾU THỰC SỰ có marker mới được thêm vào
        if (typeof window.applyFishFilter === 'function') {
            let currentMarkerCount = (window.scChartMarkers || []).length;
            if (currentMarkerCount !== window._lastMarkerCount) {
                window.applyFishFilter();
                window._lastMarkerCount = currentMarkerCount;
            }
        }
        if (typeof window.updateCommandCenterUI === 'function') window.updateCommandCenterUI();
        
    }, 1000);

    if (window.scTapeInterval) clearInterval(window.scTapeInterval);
    window.scTapeInterval = setInterval(() => {
        if (!window.scCurrentCluster) return;
        const nowMs = Date.now();
        if (nowMs - window.scCurrentCluster.startT >= 150) {
            window.flushSmartTape(window.scCurrentCluster);
            window.scCurrentCluster = null;
        }
    }, 150);

    window.chartWsReconnectDelay = window.chartWsReconnectDelay || 1000;
    window.chartWs.onopen = () => {
        window.chartWsReconnectDelay = 1000; 
        window.chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": params, "id": 1 }));
    };

    window.chartWs.onmessage = (event) => {
        if (window.activeChartSessionId !== currentSession) return;
        const data = JSON.parse(event.data);
        if (!data.stream) return;

        // --- 💡 BẮT ĐẦU: TỰ ĐỘNG CẬP NHẬT ĐÚNG CẶP USDT/USDC ---
        if (window.currentChartToken) {
            let actualStream = data.stream.toUpperCase();
            
            // Binance trả về luồng nào (USDC/USDT), ta lấy luồng đó
            if (actualStream.includes("USDC@") || actualStream.includes("USDT@")) {
                let quote = actualStream.includes("USDC@") ? "USDC" : "USDT";
                let symbolEl = document.getElementById('sc-coin-symbol');
                let realPairName = `${window.currentChartToken.symbol.toUpperCase()}/${quote}`;
                
                // Nếu tên trên web đang bị sai, lập tức sửa lại cho đúng
                if (symbolEl && symbolEl.innerText !== realPairName) {
                    symbolEl.innerText = realPairName;
                    symbolEl.style.color = "#0ECB81"; // Đổi màu xanh nhẹ báo hiệu đã nhận chuẩn cặp
                    setTimeout(() => symbolEl.style.color = "", 1000); 
                }
            }
        }
        // --- KẾT THÚC ĐOẠN TỰ ĐỘNG ĐỔI TÊN ---

        if (data.stream.endsWith('@bookTicker')) {
            if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'BOOK_TICKER', data: data.data });
        }

        if (data.e === 'kline' || data.stream.includes('kline_')) {
            let k = data.data.k || data.data; 
            if (!k) return; 
            
            let streamParts = data.stream.split('kline_');
            let klineInterval = k.i || streamParts[streamParts.length - 1];
            let currentClose = parseFloat(k.c);
            let currentVol = parseFloat(k.q !== undefined ? k.q : (k.v || 0));

            window.scLastPrice = currentClose;
            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl && typeof window.formatPrice === 'function') {
                        let isUp = currentClose >= parseFloat(k.o);
                        priceEl.innerText = '$' + window.formatPrice(currentClose);
                        priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
                    }
                    window.isRenderingPrice = false;
                });
            }

            if (['1m', '5m', '15m', '1h'].includes(klineInterval)) {
                let totalQuote = parseFloat(k.q !== undefined ? k.q : (k.v || 0)); 
                if (isNaN(totalQuote)) totalQuote = 0; 
                let isUpCandle = currentClose >= parseFloat(k.o);
                let nfEl = document.getElementById(`cc-cex-nf-${klineInterval}`);
                if (nfEl && typeof window.formatCompactUSD === 'function') {
                    let color = isUpCandle ? 'var(--term-up)' : 'var(--term-down)';
                    let icon = isUpCandle ? '▲' : '▼';
                    nfEl.innerHTML = `<span style="color:${color}">${icon} $${window.formatCompactUSD(totalQuote)}</span>`;
                }
            }

            // --- BẮT ĐẦU ĐOẠN FAKE TICK CHO DEX ---
            let isTickFallback = (window.currentChartInterval === 'tick' && klineInterval === '1s');
            
            if (klineInterval !== window.currentChartInterval && !isTickFallback) return; 

            if (isTickFallback) {
                let nowT = Date.now();
                if (nowT - (window.lastChartRender || 0) > 150) {
                    window.lastChartRender = nowT;
                    let timeSec = Math.floor(nowT / 1000);
                    
                    if (window.tvChart && typeof window.tvChart.updateData === 'function') {
                        window.tvChart.updateData({
                            timestamp: timeSec * 1000,
                            open: currentClose, high: currentClose, low: currentClose, close: currentClose,
                            volume: currentVol
                        });
                    }
                }
                return; 
            }
            
            if (window.currentChartInterval === 'tick') return; 
            // --- KẾT THÚC ĐOẠN FAKE TICK ---

            let rawTime = k.t || k.ot;
            if (rawTime) {
                let candleTime = Math.floor(rawTime / 1000);
                let isUpCandle = currentClose >= parseFloat(k.o);
                let isTrad = window.currentTheme === 'trad';
                let volColor = isUpCandle ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)');

                // Cập nhật nến cho khung 1m trở lên
                // Cập nhật nến cho khung 1m trở lên bằng WATERFALL
                if (window.tvChart && typeof window.tvChart.updateData === 'function' && window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s') {
                    
                    let rawTk = parseInt(k.t || k.ot);
                    let correctTk = rawTk < 100000000000 ? rawTk * 1000 : rawTk;

                    let dataList = window.tvChart.getDataList();
                    let lastCandle = (dataList && dataList.length > 0) ? dataList[dataList.length - 1] : null;

                    if (lastCandle && lastCandle.timestamp === correctTk && k.x !== true) {
                        // Nếu nến đang chạy, chỉ chốt Volume, giữ nguyên giá Realtime đang trượt
                        if (window._waTargetCandle) {
                            window._waTargetCandle.volume = isNaN(currentVol) ? 0 : currentVol; 
                        }
                    } else {
                        // Khi sang nến mới hoặc chốt sổ: Đẩy thẳng vào KLineChart và Reset Target
                        window._waTargetCandle = {
                            timestamp: correctTk, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: currentClose, volume: isNaN(currentVol) ? 0 : currentVol
                        };
                        window.safeUpdateChartData(window._waTargetCandle); // 🚀 Dùng hàm đánh chặn an toàn
                    }
                }
            }
        }
        
        if (data.stream && data.stream.includes('@fulldepth') && data.data) {
            let currentSym = data.data.s || 'UNKNOWN';
            if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                window.scLocalOrderBook = { sym: currentSym, asks: new Map(), bids: new Map() };
            }
            (data.data.a || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.asks.delete(p); else window.scLocalOrderBook.asks.set(p, q); 
            });
            (data.data.b || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.bids.delete(p); else window.scLocalOrderBook.bids.set(p, q); 
            });
        }
        
        if (data.stream.endsWith('@aggTrade') || data.stream.endsWith('@trade')) {
            let p = parseFloat(data.data.p), q = parseFloat(data.data.q);
            let isUp = p > window.scLastPrice ? true : (p < window.scLastPrice ? false : (window.scLastTradeDir ?? true));
            
            window.scLastTradeDir = isUp; window.scLastPrice = p;
            let valUSD = p * q, timeSec = Math.floor(data.data.T / 1000);
            let nowT = Date.now();

            window.scTickHistory.push({ t: nowT, p: p, q: q, v: valUSD, dir: isUp });
            if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'TICK', data: { t: nowT, p: p, q: q, v: valUSD, dir: isUp } });

            if (window.currentChartInterval === '1s') {
                if (!window.liveCandle1s || window.liveCandle1s.time !== timeSec) {
                    window.liveCandle1s = { time: timeSec, open: p, high: p, low: p, close: p, vol: valUSD };
                } else {
                    window.liveCandle1s.high = Math.max(window.liveCandle1s.high, p);
                    window.liveCandle1s.low = Math.min(window.liveCandle1s.low, p);
                    window.liveCandle1s.close = p;
                    window.liveCandle1s.vol += valUSD;
                }
            }

            // 🌊 ĐẨY DATA VÀO ĐỘNG CƠ WATERFALL THAY VÌ ÉP CHART VẼ TRỰC TIẾP
            if (window.currentChartInterval === 'tick') {
                window._waTargetCandle = { timestamp: timeSec * 1000, open: parseFloat(p), high: parseFloat(p), low: parseFloat(p), close: parseFloat(p), volume: parseFloat(valUSD || 0) };
            } else if (window.currentChartInterval === '1s' && window.liveCandle1s) {
                window._waTargetCandle = { timestamp: timeSec * 1000, open: window.liveCandle1s.open, high: window.liveCandle1s.high, low: window.liveCandle1s.low, close: window.liveCandle1s.close, volume: window.liveCandle1s.vol };
            } else {
                let dataList = window.tvChart ? window.tvChart.getDataList() : [];
                if (dataList && dataList.length > 0) {
                    let lastCandle = dataList[dataList.length - 1];
                    if (!window._waTargetCandle || window._waTargetCandle.timestamp !== lastCandle.timestamp) {
                        window._waTargetCandle = { ...lastCandle };
                    }
                    window._waTargetCandle.high = Math.max(window._waTargetCandle.high, p);
                    window._waTargetCandle.low = Math.min(window._waTargetCandle.low, p);
                    window._waTargetCandle.close = p; // Chỉ gán mục tiêu, không vẽ ngay lập tức
                }
            }
            
            // Kích hoạt động cơ chạy ngầm (Nó sẽ tự động trượt nến cực mượt)
            if (typeof window.startWaterfallEngine === 'function') window.startWaterfallEngine();

            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl && typeof window.formatPrice === 'function') {
                        priceEl.innerText = '$' + window.formatPrice(p);
                        priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
                    }
                    window.isRenderingPrice = false;
                });
            }

            if (!window.scCurrentCluster) {
                window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
            } else {
                if (window.scCurrentCluster.dir === isUp && (nowT - window.scCurrentCluster.startT < 1000)) {
                    window.scCurrentCluster.vol += valUSD; window.scCurrentCluster.count += 1; window.scCurrentCluster.p = p; 
                } else {
                    if (typeof window.flushSmartTape === 'function') window.flushSmartTape(window.scCurrentCluster);
                    window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
                }
            }

            window.scTradeCount++; window.scTotalVol += valUSD; window.scNetFlow += isUp ? valUSD : -valUSD;
            if (window.scSpeedWindow.length > 500) window.scSpeedWindow.shift(); 
            window.scSpeedWindow.push({ t: nowT, v: valUSD });
        }
    };
            
    window.chartWs.onclose = () => { 
        let overlay = document.getElementById('super-chart-overlay');
        if (overlay && overlay.classList.contains('active')) { 
            const jitter = Math.random() * 1000;
            setTimeout(() => window.connectRealtimeChart(window.currentChartToken), window.chartWsReconnectDelay + jitter);
            window.chartWsReconnectDelay = Math.min(window.chartWsReconnectDelay * 2, 30000);
        } 
    };
};

window.fetchBinanceHistory = async function(t, interval, isArea = false) {
    try {
        let limit = isArea ? 100 : 300; 
        let smartCtx = await window.getSmartTokenContext(t);
        let contract = smartCtx.contract;
        let chainId = smartCtx.chainId;
        if (!contract) return []; 
        
        let apiInterval = interval === 'tick' ? '1s' : interval;
        let apiUrl = `/api/klines?contract=${contract}&chainId=${chainId}&interval=${apiInterval}&limit=${limit}`;
        
        const res = await fetch(apiUrl);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || data.length === 0) return [];

        return data.map(d => {
            // 🛑 FIX LỖI 1970 TẠI ĐÂY: Nếu là giây (10 số) thì nhân 1000 thành mili-giây
            let rawTs = parseInt(d.time || d.t || d[0]);
            let correctTs = rawTs < 100000000000 ? rawTs * 1000 : rawTs;

            return {
                timestamp: correctTs, 
                open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close),
                volume: parseFloat(d.volume)
            };
        });
    } catch (e) { return []; }
};

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('/api/smart-money')) {
        if (window.currentChartToken) {
            let smartCtx = await window.getSmartTokenContext(window.currentChartToken);
            // CẬP NHẬT RENDER URL ĐỂ VƯỢT CSP
            args[0] = `/api/smart-money?contractAddress=${smartCtx.contract}&chainId=${smartCtx.chainId}`;
        }
    }
    return originalFetch.apply(this, args);
};

window.startFuturesEngine = async function(symbol) {
    window.stopFuturesEngine();
    if (!symbol) return;
    window.activeFuturesSession = symbol.toUpperCase();
    let currentSession = window.activeFuturesSession;
    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    let fSymbol = cleanSymbol + 'USDT';
    let streamSymbol = fSymbol.toLowerCase();

    if (!window.quantStats) window.quantStats = {};
    window.quantStats.longLiq = 0; window.quantStats.shortLiq = 0; 
    window.quantStats.fundingRateObj = null; window.quantStats.fundingInterval = null;

    // =========================================================
    // 1. KẾT NỐI WEBSOCKET THANH LÝ NGAY LẬP TỨC (REALTIME)
    // =========================================================
    let liqReconnectDelay = 1000; const MAX_LIQ_DELAY = 30000; 

    const connectForceOrderWS = () => {
        if (window.activeFuturesSession !== currentSession) return;
        window.liquidationWs = new WebSocket(`wss://fstream.binance.com/ws/${streamSymbol}@forceOrder`);
        window.liquidationWs.onopen = () => { liqReconnectDelay = 1000; };
        
        window.liquidationWs.onmessage = (event) => {
            if (window.activeFuturesSession !== currentSession) return;
            const data = JSON.parse(event.data);
            if (data.e === 'forceOrder' && data.o) {
                let order = data.o; 
                let valUSD = parseFloat(order.p) * parseFloat(order.q); 
                let isLongLiq = (order.S === 'SELL'); // SELL = Long bị cháy
                
                // 🛑 CHẶN LỖI LẶP LỆNH NGAY TỪ CỬA NGÕ WEBSOCKET
                let liqSig = `${order.S}_${order.p}_${order.q}`;
                let nowMs = Date.now();
                if (!window.lastRootLiqEvent) window.lastRootLiqEvent = { sig: '', time: 0 };
                if (window.lastRootLiqEvent.sig === liqSig && (nowMs - window.lastRootLiqEvent.time < 2000)) {
                    return; // Bị trùng -> Chặn đứng luôn, không cho vẽ chart hay cộng tiền
                }
                window.lastRootLiqEvent = { sig: liqSig, time: nowMs };

                if (isLongLiq) { window.quantStats.longLiq += valUSD; } else { window.quantStats.shortLiq += valUSD; }
                if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'LIQ_EVENT', data: { v: valUSD, dir: order.S, p: parseFloat(order.p) } });
                
                if (typeof window.logToSniperTape === 'function') {
                    window.logToSniperTape(!isLongLiq, valUSD, isLongLiq ? '🩸 CHÁY LONG' : '🔥 CHÁY SHORT', parseFloat(order.p));
                }

                // TÍCH HỢP MỚI: BẮN MARKER THANH LÝ LÊN CHART TRADINGVIEW
                if (window.scChartMarkers) {
                    let markerTime = Math.floor(Date.now() / 1000);
                    
                    let shortVol = valUSD >= 1e9 ? (valUSD/1e9).toFixed(1) + 'B' : (valUSD >= 1e6 ? (valUSD/1e6).toFixed(1) + 'M' : (valUSD >= 1e3 ? (valUSD/1e3).toFixed(1) + 'K' : valUSD.toFixed(0)));
                    
                    let textMsg = (isLongLiq ? '🩸 L $' : '💥 S $') + shortVol;
                    
                    window.scChartMarkers.push({
                        time: markerTime,
                        position: isLongLiq ? 'belowBar' : 'aboveBar',
                        color: isLongLiq ? '#FF007F' : '#00F0FF',
                        shape: isLongLiq ? 'arrowUp' : 'arrowDown',
                        text: textMsg,
                        fishType: 'liq' 
                    });
                    
                    if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                    if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
                }
            }
        };
        
        window.liquidationWs.onclose = () => { 
            if (window.activeFuturesSession === currentSession) {
                const jitter = Math.random() * 1000; 
                setTimeout(() => connectForceOrderWS(), liqReconnectDelay + jitter);
                liqReconnectDelay = Math.min(liqReconnectDelay * 2, MAX_LIQ_DELAY); 
            } 
        };
    };
    
    connectForceOrderWS();

    // =========================================================
    // 2. CHẠY API LẤY DỮ LIỆU TĨNH (VỐN MỒI + FUNDING/OI)
    // =========================================================
    const fetchWithTimeout = async (url) => {
        const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 4000);
        try { const response = await fetch(url, { signal: controller.signal }); clearTimeout(id); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); } catch (err) { clearTimeout(id); throw err; }
    };

    const fetchRestData = async () => {
        if (window.activeFuturesSession !== currentSession) return false;
        try {
            // Đã xóa bỏ phần gọi API allForceOrders vì Binance đã khai tử tính năng này từ 2021.
            // Số liệu thanh lý giờ đây sẽ chỉ được đếm Realtime thông qua Websocket.

            if (!window.quantStats.fundingInterval) {
                try { 
                    let fInfo = await fetchWithTimeout(`${RENDER_BASE_URL}/api/binance-fapi?endpoint=/fapi/v1/fundingInfo`); 
                    let sInfo = fInfo.find(x => x.symbol === fSymbol); 
                    window.quantStats.fundingInterval = sInfo ? sInfo.fundingIntervalHours : 8; 
                } catch(e) { window.quantStats.fundingInterval = 8; }
            }
            
            let fundData = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${fSymbol}`);
            if (window.activeFuturesSession !== currentSession) return false;
            if (fundData && fundData.lastFundingRate) {
                window.quantStats.fundingRateObj = { rate: parseFloat(fundData.lastFundingRate) * 100, nextTime: fundData.nextFundingTime, interval: window.quantStats.fundingInterval };
            }
            
            try {
                let oiData = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${fSymbol}`);
                if (window.activeFuturesSession === currentSession && oiData && oiData.openInterest) {
                    window.quantStats.openInterest = parseFloat(oiData.openInterest);
                }
            } catch(e) {}

            return true;
        } catch (err) { return false; }
    };

    // Gọi lần đầu để lấy Funding/OI, sau đó lặp lại ngầm mỗi 15s
    fetchRestData().then(hasFutures => {
        if (hasFutures && window.activeFuturesSession === currentSession) {
            window.futuresDataInterval = setInterval(() => { if (window.activeFuturesSession === currentSession) fetchRestData(); }, 120000);
        }
    });
};

window.stopFuturesEngine = function() {
    window.activeFuturesSession = null;
    if (window.futuresDataInterval) { clearInterval(window.futuresDataInterval); window.futuresDataInterval = null; }
    if (window.liquidationWs) { window.liquidationWs.close(); window.liquidationWs = null; }
};

window.computeSqueezeZone = function() {
    if (!window.quantStats) return { confirmed: false };
    const liqLong  = window.quantStats.longLiq  || 0;
    const liqShort = window.quantStats.shortLiq || 0;
    const flags    = window.quantStats.flags    || {};
    const ofi      = window.quantStats.ofi      || 0;
    const zScore   = window.quantStats.zScore   || 0;
    const SQUEEZE_LIQ_THRESHOLD = 10000;
    let confirmed = false; let side = null; let strength = 0;

    if (liqLong > SQUEEZE_LIQ_THRESHOLD && flags.stopHunt && ofi > 0.2) {
        confirmed = true; side = 'short'; strength = Math.min(1, (liqLong / (SQUEEZE_LIQ_THRESHOLD * 5)) * (ofi + 0.2) * (zScore > 1.5 ? 1.3 : 1));
    } else if (liqShort > SQUEEZE_LIQ_THRESHOLD && flags.exhausted && ofi < -0.2) {
        confirmed = true; side = 'long'; strength = Math.min(1, (liqShort / (SQUEEZE_LIQ_THRESHOLD * 5)) * (Math.abs(ofi) + 0.2));
    }
    window.quantStats.squeezeZone = { confirmed, side, strength };
    return window.quantStats.squeezeZone;
};

const _verdictCache = { hft_html: null, hft_css: null, mft_html: null, mft_css: null, lft_html: null, lft_css: null };
let _verdictRafPending = false; let _legacyFlagsBitmaskCache = -1;

function encodeFlagsBitmask(flags) {
    if (!flags) return 0;
    return (flags.liquidityVacuum ? 1 : 0) | (flags.spoofingBuyWall ? 2 : 0) | (flags.spoofingSellWall ? 4 : 0) | (flags.bullishIceberg ? 8 : 0) | (flags.bearishIceberg ? 16 : 0) | (flags.icebergAbsorption ? 32 : 0) | (flags.exhausted ? 64 : 0) | (flags.stopHunt ? 128 : 0) | (flags.wallHit ? 256 : 0) | (flags.washTrading ? 512 : 0) | (flags.zoneAbsorptionBottom ? 1024 : 0) | (flags.zoneDistributionTop ? 2048 : 0) | (flags.spotTop ? 4096 : 0);
}

function scheduleVerdictRender(hft, mft, lft, flags) {
    const hftChanged = hft && (hft.html !== _verdictCache.hft_html || hft.css !== _verdictCache.hft_css);
    const mftChanged = mft && (mft.html !== _verdictCache.mft_html || mft.css !== _verdictCache.mft_css);
    const lftChanged = lft && (lft.html !== _verdictCache.lft_html || lft.css !== _verdictCache.lft_css);
    const newBitmask = encodeFlagsBitmask(flags); const flagsChanged = newBitmask !== _legacyFlagsBitmaskCache;

    if (!hftChanged && !mftChanged && !lftChanged && !flagsChanged) return;
    if (_verdictRafPending) return;
    _verdictRafPending = true;
    requestAnimationFrame(() => {
        _verdictRafPending = false;
        if (flagsChanged) _legacyFlagsBitmaskCache = newBitmask;
        if (hftChanged && hft) { let el = document.getElementById('verdict-hft'); if (el) { el.innerHTML = hft.html; el.style.cssText = hft.css; } _verdictCache.hft_html = hft.html; _verdictCache.hft_css = hft.css; }
        if (mftChanged && mft) { let el = document.getElementById('verdict-mft'); if (el) { el.innerHTML = mft.html; el.style.cssText = mft.css; } _verdictCache.mft_html = mft.html; _verdictCache.mft_css = mft.css; }
        if (lftChanged && lft) { let el = document.getElementById('verdict-lft'); if (el) { el.innerHTML = lft.html; el.style.cssText = lft.css; } _verdictCache.lft_html = lft.html; _verdictCache.lft_css = lft.css; }
    });
}

window.evaluateQuantVerdict = function() {
    if (!window.quantStats) return;
    let q = window.quantStats; let flags = q.flags || {};
    if (q.hftVerdict) {
        let wBuy = q.whaleBuyVol || 0; let wSell = q.whaleSellVol || 0; let ofi = q.ofi || 0; let trend = q.trend || 0;
        if ((flags.spoofingSellWall || flags.bearishIceberg) && ofi > 0.2 && wBuy > wSell && trend > 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[⚡ ĐẨY]</b> 🚀 MM MARKUP`; q.hftVerdict.color = '#00F0FF'; q.hftVerdict.bg = 'rgba(0, 240, 255, 0.15)';
        } else if (flags.spoofingBuyWall && ofi < -0.2 && wSell > wBuy && trend < 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[🩸 XẢ]</b> 🩸 MM MARKDOWN`; q.hftVerdict.color = '#FF007F'; q.hftVerdict.bg = 'rgba(255, 0, 127, 0.15)';
        }
    }
    let hftObj = { html: "⚡ ĐANG KHỞI ĐỘNG TICK...", css: "font-size: 9.5px; background: rgba(0, 240, 255, 0.1); padding: 3px 6px; border-radius: 3px; color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.2); white-space: nowrap;" };
    if (q.hftVerdict) { let v = q.hftVerdict; hftObj.html = v.html; hftObj.css = `font-size: 9.5px; background: ${v.bg}; padding: 3px 6px; border-radius: 3px; color: ${v.color}; border: 1px solid ${v.color}; white-space: nowrap;`; }
    
    let cvd1hTag = document.getElementById('sm-tag-1h') ? document.getElementById('sm-tag-1h').innerText.toUpperCase() : '';
    let cvd4hTag = document.getElementById('sm-tag-4h') ? document.getElementById('sm-tag-4h').innerText.toUpperCase() : '';
    let fFunding = q.fundingRateObj ? q.fundingRateObj.rate : (q.fundingRate || 0);
    let liqLong = q.longLiq || 0; let liqShort = q.shortLiq || 0; let totalLiq = liqLong + liqShort;

    let spotScore = 0;
    if (cvd1hTag.includes('BULLISH')) spotScore += 0.5; else if (cvd1hTag.includes('BEARISH')) spotScore -= 0.5;
    if (cvd4hTag.includes('BULLISH')) spotScore += 0.5; else if (cvd4hTag.includes('BEARISH')) spotScore -= 0.5;

    let futuresScore = 0; let hasFutures = Math.abs(fFunding) > 0 || totalLiq > 0;
    if (hasFutures) {
        if (fFunding < -0.005) futuresScore += 0.5; else if (fFunding > 0.005) futuresScore -= 0.5;
        if (totalLiq > 5000) { let liqRatio = liqShort / totalLiq; if (liqRatio > 0.65) futuresScore += 0.5; else if (liqRatio < 0.35) futuresScore -= 0.5; }
    }

    let finalMftScore = hasFutures ? (spotScore * 0.4) + (futuresScore * 0.6) : (spotScore * 1.0);
    let mftMsg = '⚖️ ĐI NGANG TRUNG HẠN'; let mftColor = '#848e9c'; let mftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalMftScore >= 0.6) { mftMsg = hasFutures ? '🔥 SHORT SQUEEZE (STRONG BUY)' : '🔥 LỰC MUA CỰC MẠNH'; mftColor = '#00F0FF'; mftBg = 'rgba(0, 240, 255, 0.1)'; } 
    else if (finalMftScore >= 0.25) { mftMsg = '📈 ĐỘNG LƯỢNG TĂNG (BUY)'; mftColor = '#0ECB81'; mftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalMftScore <= -0.6) { mftMsg = hasFutures ? '🩸 LONG CASCADE (STRONG SELL)' : '🩸 LỰC XẢ CỰC MẠNH'; mftColor = '#FF007F'; mftBg = 'rgba(255, 0, 127, 0.1)'; } 
    else if (finalMftScore <= -0.25) { mftMsg = '📉 ÁP LỰC GIẢM (SELL)'; mftColor = '#F6465D'; mftBg = 'rgba(246, 70, 93, 0.1)'; }
    let mftObj = { html: mftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${mftColor}; background: ${mftBg}; white-space: nowrap;` };

    let smBadge = document.getElementById('sm-verdict-badge'); let smTag = smBadge ? smBadge.innerText.toUpperCase() : '';
    let unlockStr = document.getElementById('sm-unlock-pct') ? document.getElementById('sm-unlock-pct').innerText : '100%'; let unlockPct = parseFloat(unlockStr) || 100;
    let smScore = 0; if (smTag.includes('CÁ MẬP GOM') || smTag.includes('BULLISH')) smScore = 1.0; else if (smTag.includes('BOT KIỂM SOÁT') || smTag.includes('BEARISH') || smTag.includes('XẢ')) smScore = -1.0;
    let tokenomicsScore = 0; if (unlockPct < 30) tokenomicsScore = -1.0; else if (unlockPct >= 50) tokenomicsScore = 0.5; else if (unlockPct >= 80) tokenomicsScore = 1.0;
    let finalLftScore = (smScore * 0.75) + (tokenomicsScore * 0.25);
    let lftMsg = '⚖️ TRUNG LẬP VĨ MÔ'; let lftColor = '#848e9c'; let lftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalLftScore >= 0.5) { lftMsg = '💎 TÍCH LŨY VĨ MÔ (MACRO BULL)'; lftColor = '#0ECB81'; lftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalLftScore <= -0.5) { lftMsg = '⚠️ RỦI RO PHÂN PHỐI (MACRO BEAR)'; lftColor = '#FF007F'; lftBg = 'rgba(255, 0, 127, 0.1)'; }
    let lftObj = { html: lftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${lftColor}; background: ${lftBg}; white-space: nowrap;` };

    scheduleVerdictRender(hftObj, mftObj, lftObj, q.flags);
};

