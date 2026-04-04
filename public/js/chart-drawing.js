// ==========================================
// FILE: chart-drawing.js
// WAVE ALPHA — DRAWING TOOLS ENGINE
// Version: 2.0.0 | KLineCharts v9 Compatible
// ==========================================
// SECTION 1:  TOOL REGISTRY
// SECTION 2:  DRAWING STATE
// SECTION 3:  CSS INJECTION
// SECTION 4:  TOOLBAR HTML BUILDER
// SECTION 5:  DOM INJECTION
// SECTION 6:  TOOL ACTIVATION
// SECTION 7:  OVERLAY STYLE BUILDER
// SECTION 8:  FLYOUT MANAGEMENT
// SECTION 9:  KEYBOARD SHORTCUTS
// SECTION 10: SETTINGS PERSISTENCE
// SECTION 11: PUBLIC API
// ==========================================

(function (global) {
  'use strict';

  const WD_VERSION = '2.0.0';
  const LS_KEY = 'wa_draw_settings_v2';

  // ════════════════════════════════════════
  // SECTION 1: TOOL REGISTRY
  // ════════════════════════════════════════

  const TOOL_GROUPS = [
    {
      id: 'cursor', label: 'Con Tro', icon: 'S',
      tools: [
        { id: 'pointer', name: 'Con tro / Chon',  overlay: null,        icon: 'S', key: 'Escape', desc: 'Chon, di chuyen, chinh sua hinh ve', points: 0 },
        { id: 'eraser',  name: 'Xoa nhanh',        overlay: '__erase__', icon: 'X', key: 'E',      desc: 'Click len hinh ve de xoa ngay',    points: 0 },
      ]
    },
    {
      id: 'lines', label: 'Duong & Tia', icon: '/',
      tools: [
        { id: 'segment',                name: 'Duong xu huong',      overlay: 'segment',                icon: '/',   key: 'L', desc: '2 diem - doan thang',               points: 2 },
        { id: 'ray',                    name: 'Tia mot chieu',        overlay: 'ray',                    icon: '->',            desc: '2 diem - keo dai 1 phia',           points: 2 },
        { id: 'straightLine',           name: 'Duong thang 2 chieu',  overlay: 'straightLine',           icon: '<->',           desc: '2 diem - vo han 2 chieu',           points: 2 },
        { id: 'horizontalStraightLine', name: 'Ngang vo han',         overlay: 'horizontalStraightLine', icon: '─',   key: 'H', desc: '1 diem - ngang vo han',             points: 1 },
        { id: 'horizontalRayLine',      name: 'Tia ngang 1 chieu',    overlay: 'horizontalRayLine',      icon: '→',             desc: '2 diem - ngang 1 chieu',            points: 2 },
        { id: 'horizontalSegment',      name: 'Doan nam ngang',       overlay: 'horizontalSegment',      icon: '|-',            desc: '2 diem - doan ngang co gioi han',   points: 2 },
        { id: 'verticalStraightLine',   name: 'Doc vo han',           overlay: 'verticalStraightLine',   icon: '│',   key: 'V', desc: '1 diem - doc vo han',               points: 1 },
        { id: 'verticalRayLine',        name: 'Tia doc 1 chieu',      overlay: 'verticalRayLine',        icon: '↑',             desc: '2 diem - doc 1 chieu',              points: 2 },
        { id: 'verticalSegment',        name: 'Doan thang dung',      overlay: 'verticalSegment',        icon: '⊥',             desc: '2 diem - doan doc co gioi han',     points: 2 },
        { id: 'priceLine',              name: 'Price Line',           overlay: 'priceLine',              icon: '$',             desc: '1 diem - duong gia co nhan so',     points: 1 },
        { id: 'arrow',                  name: 'Mui ten',              overlay: 'arrow',                  icon: '↗',             desc: '2 diem - mui ten co dau nhon',      points: 2 },
      ]
    },
    {
      id: 'channels', label: 'Kenh Gia', icon: '=',
      tools: [
        { id: 'priceChannelLine',    name: 'Price Channel',  overlay: 'priceChannelLine',    icon: '=',  desc: '3 diem - kenh song song',          points: 3 },
        { id: 'parallelStraightLine',name: 'Parallel Lines', overlay: 'parallelStraightLine',icon: '≡',  desc: '3 diem - 2 duong song song vo han', points: 3 },
      ]
    },
    {
      id: 'fibonacci', label: 'Fibonacci', icon: 'F',
      tools: [
        { id: 'fibonacciLine',              name: 'Fib Retracement', overlay: 'fibonacciLine',              icon: 'FR', key: 'F', desc: '2 diem - hoi quy 23.6% 38.2% 50% 61.8%', points: 2 },
        { id: 'fibonacciSegment',           name: 'Fib Segment',     overlay: 'fibonacciSegment',           icon: 'FS',           desc: '2 diem - Fib tren doan thang',           points: 2 },
        { id: 'fibonacciExtension',         name: 'Fib Extension',   overlay: 'fibonacciExtension',         icon: 'FE',           desc: '3 diem - mo rong 127% 161.8% 200%',      points: 3 },
        { id: 'fibonacciSpiral',            name: 'Fib Spiral',      overlay: 'fibonacciSpiral',            icon: 'F@',           desc: '2 diem - xoan oc Fibonacci',             points: 2 },
        { id: 'fibonacciSpeedResistanceFan',name: 'Fib Fan',         overlay: 'fibonacciSpeedResistanceFan',icon: 'FF',           desc: '2 diem - quat khang cu Fibonacci',       points: 2 },
        { id: 'fibTrendExtension',          name: 'Fib Trend Ext.',  overlay: 'fibonacciExtension',         icon: 'FT',           desc: '3 diem - mo rong Fib theo xu huong',     points: 3 },
      ]
    },
    {
      id: 'gann', label: 'Gann', icon: 'G',
      tools: [
        { id: 'gannBox',    name: 'Gann Box',    overlay: 'gannBox',    icon: 'GB', desc: '2 diem - hop Gann 1x1 2x1 1x2', points: 2 },
        { id: 'gannFan',    name: 'Gann Fan',    overlay: 'gannFan',    icon: 'GF', desc: '2 diem - quat Gann 8 goc',      points: 2 },
        { id: 'gannSquare', name: 'Gann Square', overlay: 'gannSquare', icon: 'GS', desc: '2 diem - hinh vuong Gann',       points: 2 },
      ]
    },
    {
      id: 'elliott', label: 'Song Elliott', icon: '~',
      tools: [
        { id: 'elliottImpulseWave',    name: 'Impulse Wave (1-5)',   overlay: 'elliottImpulseWave',    icon: '1-5',  desc: '6 diem - song day 5 buoc',       points: 6 },
        { id: 'elliottCorrectiveWave', name: 'Corrective Wave (ABC)',overlay: 'elliottCorrectiveWave', icon: 'ABC',  desc: '4 diem - song dieu chinh 3 buoc', points: 4 },
        { id: 'elliottTriangleWave',   name: 'Triangle Wave (A-E)',  overlay: 'elliottTriangleWave',   icon: '/\\/', desc: '5 diem - song tam giac Elliott',  points: 5 },
        { id: 'elliottDoubleComboWave',name: 'Double Combo (WXY)',   overlay: 'elliottDoubleComboWave',icon: 'WXY',  desc: '7 diem - song kep W-X-Y',         points: 7 },
        { id: 'elliottTripleComboWave',name: 'Triple Combo (WXYZ)',  overlay: 'elliottTripleComboWave',icon: 'WXYZ', desc: '9 diem - song ba W-X-Y-X-Z',      points: 9 },
      ]
    },
    {
      id: 'shapes', label: 'Hinh Ve', icon: '[]',
      tools: [
        { id: 'rect',         name: 'Rectangle',     overlay: 'rect',         icon: '[]', key: 'R', desc: '2 diem - vung to mau HCN',    points: 2, isShape: true },
        { id: 'circle',       name: 'Circle',        overlay: 'circle',       icon: '()',           desc: '2 diem - hinh tron',           points: 2, isShape: true },
        { id: 'triangle',     name: 'Triangle',      overlay: 'triangle',     icon: '/\\',           desc: '3 diem - tam giac bat ky',     points: 3, isShape: true },
        { id: 'parallelogram',name: 'Parallelogram', overlay: 'parallelogram',icon: '▱',            desc: '3 diem - hinh binh hanh',      points: 3, isShape: true },
      ]
    },
    {
      id: 'patterns', label: 'Harmonic', icon: 'P',
      tools: [
        { id: 'xabcd',       name: 'XABCD Pattern', overlay: 'xabcd',       icon: 'XAB', desc: '5 diem - Gartley/Butterfly/Bat/Crab', points: 5 },
        { id: 'abcd',        name: 'ABCD Pattern',  overlay: 'abcd',        icon: 'ABD', desc: '4 diem - AB=CD harmonic',             points: 4 },
        { id: 'threedrives', name: 'Three Drives',  overlay: 'threedrives', icon: '3D',  desc: '7 diem - Three Drives pattern',       points: 7 },
      ]
    },
    {
      id: 'projections', label: 'R/R & Vung', icon: 'R',
      tools: [
        { id: 'longPosition',  name: 'Long Position',overlay: 'longPosition',  icon: '↑L', desc: '3 diem - Entry/Stop/Target Long',  points: 3 },
        { id: 'shortPosition', name: 'Short Position',overlay: 'shortPosition', icon: '↓S', desc: '3 diem - Entry/Stop/Target Short', points: 3 },
        { id: 'priceRange',    name: 'Price Range',  overlay: 'priceRange',    icon: '↕',  desc: '2 diem - do khoang cach gia',      points: 2 },
        { id: 'dateRangeNote', name: 'Date Range',   overlay: 'dateRangeNote', icon: 'DT', desc: '2 diem - to vung theo thoi gian',  points: 2 },
      ]
    },
    {
      id: 'text', label: 'Chu Thich', icon: 'T',
      tools: [
        { id: 'text',    name: 'Text Label', overlay: 'text',    icon: 'T',  key: 'T', desc: '1 diem - text ghi chu tren chart', points: 1 },
        { id: 'callout', name: 'Callout',    overlay: 'callout', icon: 'CT',           desc: '2 diem - bong bong chu thich',     points: 2 },
        { id: 'note',    name: 'Note',       overlay: 'note',    icon: 'N',            desc: '1 diem - ghi chu co khung',        points: 1 },
      ]
    },
  ];

  // Flat lookup map: toolId => DrawTool
  const TOOL_MAP = {};
  TOOL_GROUPS.forEach(function (g) {
    g.tools.forEach(function (t) {
      TOOL_MAP[t.id] = Object.assign({ groupId: g.id }, t);
    });
  });

  // KLineCharts v9 built-in overlay names
  // FIX: them abcd, threedrives, longPosition, shortPosition, callout
  const KC_NATIVE = new Set([
    'segment', 'ray', 'straightLine',
    'horizontalStraightLine', 'horizontalRayLine', 'horizontalSegment',
    'verticalStraightLine', 'verticalRayLine', 'verticalSegment',
    'priceLine', 'arrow',
    'priceChannelLine', 'parallelStraightLine',
    'fibonacciLine', 'fibonacciSegment', 'fibonacciExtension',
    'fibonacciSpiral', 'fibonacciSpeedResistanceFan',
    'gannBox', 'gannFan', 'gannSquare',
    'elliottImpulseWave', 'elliottCorrectiveWave', 'elliottTriangleWave',
    'elliottDoubleComboWave', 'elliottTripleComboWave',
    'rect', 'circle', 'triangle', 'parallelogram',
    'xabcd', 'abcd', 'threedrives',
    'longPosition', 'shortPosition',
    'text', 'callout',
  ]);

  // ════════════════════════════════════════
  // SECTION 2: DRAWING STATE
  // ════════════════════════════════════════

  const DS = {
    activeTool:   'pointer',
    color:        '#00F0FF',
    fillColor:    'rgba(0,240,255,0.12)',
    lineSize:     2,
    lineStyle:    'solid',
    textSize:     13,
    allVisible:   true,
    drawCount:    0,
    isDrawing:    false,
    flyoutOpenId: null,
    initialized:  false,
    // FIX v2: state management fields bi thieu trong v1
    _history:     [],     // stack ID overlay da ve xong - dung cho undo
    _pendingId:   null,   // ID overlay dang ve do (chua onDrawEnd)
    _idCounter:   1,      // counter tao ID duy nhat cho moi overlay
  };

  // ════════════════════════════════════════
  // SECTION 3: CSS INJECTION
  // ════════════════════════════════════════

  function injectCSS() {
    if (document.getElementById('wa-drawing-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-drawing-css';
    style.textContent = [
      /* chart container */
      '#sc-chart-container{position:relative!important}',

      /* TOOLBAR */
      '#wa-drawing-toolbar{',
        'position:absolute;left:0;top:0;width:36px;height:100%;z-index:300;',
        'display:flex;flex-direction:column;align-items:center;',
        'padding:6px 0;gap:1px;',
        'background:rgba(14,18,24,0.97);',
        'border-right:1px solid rgba(255,255,255,0.07);',
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
        'overflow:hidden;overflow-y:auto;scrollbar-width:none;',
        'user-select:none;box-sizing:border-box;',
      '}',
      '#wa-drawing-toolbar::-webkit-scrollbar{display:none}',

      '.wa-dt-group{position:relative;width:100%;display:flex;justify-content:center;flex-shrink:0}',
      '.wa-dt-sep{width:22px;height:1px;background:rgba(255,255,255,0.07);margin:3px 0;flex-shrink:0;align-self:center}',
      '.wa-dt-spacer{flex:1}',

      /* TOOL BUTTON */
      /* FIX: them font-family, overflow, white-space de icon ASCII hien thi dung tren moi OS */
      '.wa-dt-btn{',
        'width:30px;height:30px;',
        'border:1px solid transparent;border-radius:6px;',
        'background:transparent;',
        'color:#5a6475;',
        "font-family:'Segoe UI','Segoe UI Symbol','Helvetica Neue',Arial,sans-serif;",
        'font-size:10px;font-weight:700;line-height:1;letter-spacing:-0.3px;',
        'cursor:pointer;display:flex;align-items:center;justify-content:center;',
        'transition:background .13s,color .13s,border-color .13s;',
        'flex-shrink:0;position:relative;outline:none;padding:0;',
        'overflow:hidden;white-space:nowrap;',
      '}',
      '.wa-dt-btn:hover{background:rgba(255,255,255,0.07);color:#c8cdd4;border-color:rgba(255,255,255,0.1)}',
      '.wa-dt-btn.active{background:rgba(0,240,255,0.14);color:#00F0FF;border-color:rgba(0,240,255,0.35)}',
      '.wa-dt-btn.has-flyout::after{',
        "content:'';position:absolute;bottom:3px;right:3px;",
        'width:3px;height:3px;',
        'border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;',
        'opacity:0.45;pointer-events:none;',
      '}',

      /* TOOLTIP */
      '.wa-dt-tip{',
        'position:absolute;left:38px;top:50%;transform:translateY(-50%);',
        'background:rgba(10,14,20,0.97);border:1px solid rgba(255,255,255,0.12);',
        'border-radius:6px;padding:4px 10px;font-size:11px;color:#c8cdd4;',
        'white-space:nowrap;pointer-events:none;z-index:10000;',
        'opacity:0;transition:opacity .15s;box-shadow:0 4px 14px rgba(0,0,0,0.55);',
      '}',
      '.wa-dt-btn:hover .wa-dt-tip{opacity:1}',

      /* BADGE */
      '.wa-dt-badge{',
        'position:absolute;top:1px;right:1px;',
        'background:#00F0FF;color:#000;font-size:7px;font-weight:900;',
        'min-width:11px;height:11px;border-radius:5px;padding:0 2px;',
        'display:none;align-items:center;justify-content:center;',
        'pointer-events:none;line-height:1;',
      '}',

      /* FLYOUT */
      '.wa-flyout{',
        'position:absolute;left:38px;top:-2px;',
        'background:#0d1117;border:1px solid rgba(255,255,255,0.1);',
        'border-radius:10px;padding:6px 5px;min-width:244px;z-index:9999;',
        'box-shadow:0 14px 44px rgba(0,0,0,0.75),0 2px 8px rgba(0,0,0,0.4);',
        'display:none;flex-direction:column;gap:1px;pointer-events:all;',
      '}',
      '.wa-flyout.open{display:flex}',
      '.wa-flyout-header{',
        'font-size:9px;font-weight:800;color:#3a434f;text-transform:uppercase;',
        'letter-spacing:1.2px;padding:4px 10px 7px;',
        'border-bottom:1px solid rgba(255,255,255,0.05);margin-bottom:2px;',
      '}',
      '.wa-flyout-item{',
        'display:flex;align-items:center;gap:10px;padding:6px 10px;',
        'border-radius:6px;cursor:pointer;transition:background .1s;',
        'color:#7a8694;font-size:11.5px;',
      '}',
      '.wa-flyout-item:hover{background:rgba(255,255,255,0.06);color:#d4dae2}',
      '.wa-flyout-item.active{background:rgba(0,240,255,0.09);color:#00F0FF}',
      '.wa-flyout-icon{',
        'font-size:10px;font-weight:700;width:28px;text-align:center;flex-shrink:0;',
        "font-family:'Segoe UI','Segoe UI Symbol',Arial,sans-serif;",
        'overflow:hidden;white-space:nowrap;',
        'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);',
        'border-radius:4px;padding:2px 3px;color:#9ba3af;',
      '}',
      '.wa-flyout-item.active .wa-flyout-icon{color:#00F0FF;border-color:rgba(0,240,255,0.25)}',
      '.wa-flyout-info{flex:1;min-width:0}',
      '.wa-flyout-name{display:block}',
      '.wa-flyout-desc{display:block;font-size:9.5px;color:#3a434f;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.wa-flyout-pts{font-size:9px;color:#3d4855;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:3px;padding:1px 5px;flex-shrink:0;font-family:monospace}',
      '.wa-flyout-key{font-size:9px;color:#3d4855;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:3px;padding:1px 5px;flex-shrink:0;font-family:monospace}',

      /* PROPS BAR */
      '#wa-drawing-props{',
        'position:absolute;top:8px;left:44px;right:8px;height:36px;',
        'background:rgba(10,14,20,0.97);border:1px solid rgba(255,255,255,0.1);',
        'border-radius:9px;display:none;align-items:center;gap:6px;',
        'padding:0 12px;z-index:295;',
        'box-shadow:0 6px 22px rgba(0,0,0,0.6);',
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
        'flex-wrap:nowrap;overflow:hidden;',
      '}',
      '#wa-drawing-props.show{display:flex}',
      '.wa-dp-tool-name{font-size:11px;font-weight:700;color:#00F0FF;flex-shrink:0;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.wa-dp-sep{width:1px;height:20px;background:rgba(255,255,255,0.08);flex-shrink:0;margin:0 1px}',
      '.wa-dp-lbl{font-size:10px;color:#4a5460;flex-shrink:0}',
      '.wa-dp-color-box{position:relative;width:22px;height:22px;border-radius:5px;border:1.5px solid rgba(255,255,255,0.15);cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .12s}',
      '.wa-dp-color-box:hover{border-color:rgba(255,255,255,0.4)}',
      '.wa-dp-color-box .wa-dp-swatch{width:100%;height:100%;border-radius:3px}',
      '.wa-dp-color-box input[type=color]{position:absolute;opacity:0;width:200%;height:200%;top:-50%;left:-50%;cursor:pointer;border:none;padding:0}',
      '.wa-dp-preset{width:14px;height:14px;border-radius:3px;cursor:pointer;flex-shrink:0;border:1px solid rgba(255,255,255,0.12);transition:transform .12s,border-color .12s}',
      '.wa-dp-preset:hover{transform:scale(1.3);border-color:rgba(255,255,255,0.5)}',
      '.wa-dp-sel{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;color:#c8cdd4;font-size:11px;padding:3px 5px;cursor:pointer;outline:none;transition:border-color .12s;flex-shrink:0}',
      '.wa-dp-sel:hover,.wa-dp-sel:focus{border-color:rgba(0,240,255,0.4)}',
      '.wa-dp-btn{padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#7a8694;font-size:10.5px;cursor:pointer;transition:all .12s;white-space:nowrap;flex-shrink:0}',
      '.wa-dp-btn:hover{border-color:rgba(0,240,255,0.4);color:#00F0FF;background:rgba(0,240,255,0.06)}',
      '.wa-dp-btn.red:hover{border-color:rgba(246,70,93,0.4);color:#F6465D;background:rgba(246,70,93,0.06)}',
      '.wa-dp-btn.accent{background:rgba(0,240,255,0.1);border-color:rgba(0,240,255,0.3);color:#00F0FF}',

      /* Crosshair cursor khi dang ve */
      '.wa-chart-drawing-mode canvas{cursor:crosshair!important}',
    ].join('');
    document.head.appendChild(style);
  }

  // ════════════════════════════════════════
  // SECTION 4: TOOLBAR HTML BUILDER
  // ════════════════════════════════════════

  const PRESET_COLORS = ['#00F0FF','#F0B90B','#0ECB81','#F6465D','#EAECEF','#848e9c','#cb55e3','#FF8C00'];

  function buildToolbarHTML() {
    var h = '';
    TOOL_GROUPS.forEach(function (group, gi) {
      if (gi > 0) h += '<div class="wa-dt-sep"></div>';
      var rep    = group.tools[0];
      var hasFly = group.tools.length > 1;
      h += '<div class="wa-dt-group" data-group="' + group.id + '">'
        +  '<button class="wa-dt-btn' + (hasFly ? ' has-flyout' : '') + '"'
        +  ' id="wa-dtg-' + group.id + '"'
        +  ' data-group="' + group.id + '"'
        +  ' data-tool="' + rep.id + '"'
        +  ' onclick="WaveDrawingAPI.groupClick(event,\'' + group.id + '\')"'
        +  ' onmouseenter="WaveDrawingAPI.groupHover(event,\'' + group.id + '\')">'
        +  '<span class="wa-dt-icon">' + rep.icon + '</span>'
        +  '<span class="wa-dt-tip">' + group.label + '</span>'
        +  '</button>'
        +  (hasFly ? buildFlyoutHTML(group) : '')
        +  '</div>';
    });

    h += '<div class="wa-dt-spacer"></div>'
      +  '<div class="wa-dt-sep"></div>'
      +  '<div class="wa-dt-group">'
      +  '<button class="wa-dt-btn" onclick="WaveDrawingAPI.undo()">'
      +  '<span class="wa-dt-icon" style="font-size:13px">&#8617;</span>'
      +  '<span class="wa-dt-tip">Undo (Ctrl+Z)</span></button></div>'
      +  '<div class="wa-dt-group">'
      +  '<button class="wa-dt-btn" onclick="WaveDrawingAPI.redo()">'
      +  '<span class="wa-dt-icon" style="font-size:13px">&#8618;</span>'
      +  '<span class="wa-dt-tip">Redo (Ctrl+Y)</span></button></div>'
      +  '<div class="wa-dt-sep"></div>'
      +  '<div class="wa-dt-group">'
      +  '<button class="wa-dt-btn" id="wa-dt-vis-btn" onclick="WaveDrawingAPI.toggleVisibility()">'
      +  '<span class="wa-dt-icon">o</span>'
      +  '<span class="wa-dt-tip">An/Hien hinh ve</span></button></div>'
      +  '<div class="wa-dt-group" style="position:relative">'
      +  '<button class="wa-dt-btn" id="wa-dt-del-btn" onclick="WaveDrawingAPI.deleteAll()">'
      +  '<span class="wa-dt-badge" id="wa-dt-badge">0</span>'
      +  '<span class="wa-dt-icon" style="font-size:11px">&#128465;</span>'
      +  '<span class="wa-dt-tip">Xoa tat ca hinh ve</span></button></div>';
    return h;
  }

  function buildFlyoutHTML(group) {
    var h = '<div class="wa-flyout" id="wa-flyout-' + group.id + '">'
          + '<div class="wa-flyout-header">' + group.label + '</div>';
    group.tools.forEach(function (tool) {
      var pts = tool.points ? '<span class="wa-flyout-pts">' + tool.points + 'pt</span>' : '';
      var key = tool.key    ? '<span class="wa-flyout-key">'  + tool.key   + '</span>'   : '';
      h += '<div class="wa-flyout-item" data-tool="' + tool.id + '"'
        +  ' onclick="WaveDrawingAPI.toolClick(\'' + tool.id + '\',event)">'
        +  '<span class="wa-flyout-icon">' + tool.icon + '</span>'
        +  '<span class="wa-flyout-info">'
        +  '<span class="wa-flyout-name">' + tool.name + '</span>'
        +  '<span class="wa-flyout-desc">' + tool.desc + '</span>'
        +  '</span>' + pts + key + '</div>';
    });
    return h + '</div>';
  }

  function buildPropsBarHTML() {
    var presets = PRESET_COLORS.map(function (c) {
      return '<div class="wa-dp-preset" style="background:' + c + '" title="' + c
           + '" onclick="WaveDrawingAPI.setColor(\'' + c + '\')"></div>';
    }).join('');

    return '<div id="wa-drawing-props">'
      + '<span class="wa-dp-tool-name" id="wa-dp-toolname">Cong cu ve</span>'
      + '<div class="wa-dp-sep"></div>'
      + '<span class="wa-dp-lbl">Net</span>'
      + '<div class="wa-dp-color-box" title="Mau duong/vien">'
      + '<div class="wa-dp-swatch" id="wa-dp-stroke-swatch" style="background:#00F0FF"></div>'
      + '<input type="color" id="wa-dp-stroke-color" value="#00f0ff" oninput="WaveDrawingAPI.onStrokeColor(this.value)">'
      + '</div>'
      + '<span class="wa-dp-lbl">Nen</span>'
      + '<div class="wa-dp-color-box" title="Mau nen fill">'
      + '<div class="wa-dp-swatch" id="wa-dp-fill-swatch" style="background:rgba(0,240,255,0.12)"></div>'
      + '<input type="color" id="wa-dp-fill-color" value="#00f0ff" oninput="WaveDrawingAPI.onFillColor(this.value)">'
      + '</div>'
      + '<div class="wa-dp-sep"></div>'
      + '<span class="wa-dp-lbl">Day</span>'
      + '<select class="wa-dp-sel" id="wa-dp-size" onchange="WaveDrawingAPI.onLineSize(this.value)">'
      + '<option value="1">1px</option><option value="2" selected>2px</option>'
      + '<option value="3">3px</option><option value="4">4px</option><option value="5">5px</option>'
      + '</select>'
      + '<select class="wa-dp-sel" id="wa-dp-linestyle" onchange="WaveDrawingAPI.onLineStyle(this.value)">'
      + '<option value="solid">&#9472;&#9472;</option>'
      + '<option value="dashed">- -</option>'
      + '<option value="dotted">&#183;&#183;&#183;</option>'
      + '</select>'
      + '<div class="wa-dp-sep"></div>'
      + presets
      + '<div class="wa-dp-sep"></div>'
      + '<button class="wa-dp-btn accent" onclick="WaveDrawingAPI.applyAll()" title="Ap dung mau/kieu nay cho TAT CA hinh ve">Ap dung tat ca</button>'
      + '<button class="wa-dp-btn red" onclick="WaveDrawingAPI.deleteAll()">Xoa tat</button>'
      + '<button class="wa-dp-btn" id="wa-dp-cancel-btn" style="display:none" onclick="WaveDrawingAPI.cancelDraw()">Huy ve</button>'
      + '</div>';
  }

  // ════════════════════════════════════════
  // SECTION 5: DOM INJECTION
  // ════════════════════════════════════════

  var _mutObs = null;

  function inject() {
    var container = document.getElementById('sc-chart-container');
    if (!container) { setTimeout(inject, 600); return; }
    if (document.getElementById('wa-drawing-toolbar')) return;
    container.style.position = 'relative';

    var tb = document.createElement('div');
    tb.id = 'wa-drawing-toolbar';
    tb.innerHTML = buildToolbarHTML();
    container.appendChild(tb);

    var pw = document.createElement('div');
    pw.innerHTML = buildPropsBarHTML();
    container.appendChild(pw.firstElementChild);

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.wa-dt-group') && !e.target.closest('.wa-flyout')) {
        closeFlyouts();
      }
    }, true);

    DS.initialized = true;
    updatePropsBar(null);
    console.log('WaveDrawing v' + WD_VERSION + ' — toolbar injected.');
  }

  function watchForReinit() {
    var root = document.getElementById('super-chart-overlay') || document.body;
    if (_mutObs) _mutObs.disconnect();
    _mutObs = new MutationObserver(function () {
      var c = document.getElementById('sc-chart-container');
      if (c && !document.getElementById('wa-drawing-toolbar')) {
        setTimeout(inject, 350);
      }
    });
    _mutObs.observe(root, { childList: true, subtree: true });
  }

  // ════════════════════════════════════════
  // SECTION 6: TOOL ACTIVATION
  // ════════════════════════════════════════

  function activateTool(toolId) {
    var tool = TOOL_MAP[toolId];
    if (!tool) return;

    // FIX: huy overlay dang ve do bang DS._pendingId, khong dung ID cung
    if (global.tvChart && DS._pendingId) {
      try { global.tvChart.removeOverlay({ id: DS._pendingId }); } catch (e) {}
      DS._pendingId = null;
    }

    DS.activeTool = toolId;
    DS.isDrawing  = (toolId !== 'pointer' && toolId !== 'eraser' && !!tool.overlay);

    // Cap nhat highlight toolbar
    document.querySelectorAll('.wa-dt-btn[data-group]').forEach(function (b) {
      b.classList.remove('active');
    });
    document.querySelectorAll('.wa-flyout-item').forEach(function (i) {
      i.classList.toggle('active', i.dataset.tool === toolId);
    });
    var grpBtn = document.getElementById('wa-dtg-' + tool.groupId);
    if (grpBtn) {
      grpBtn.classList.add('active');
      var iconEl = grpBtn.querySelector('.wa-dt-icon');
      if (iconEl) iconEl.textContent = tool.icon;
    }

    updatePropsBar(tool);

    var container = document.getElementById('sc-chart-container');
    if (container) {
      container.classList.toggle('wa-chart-drawing-mode', DS.isDrawing || toolId === 'eraser');
    }

    if (toolId === 'pointer' || toolId === 'eraser') { hideCancelBtn(); return; }
    if (!tool.overlay || tool.overlay === '__erase__') return;

    var overlayName = KC_NATIVE.has(tool.overlay) ? tool.overlay : null;
    var useName     = overlayName || 'segment';
    if (!overlayName) tryRegisterFallback(tool.overlay, tool);

    // FIX: ID duy nhat cho moi overlay, khong dung cung 'wadrawing'
    var oid = 'wadr_' + (DS._idCounter++);
    DS._pendingId = oid;

    setTimeout(function () {
      if (!global.tvChart) { DS._pendingId = null; return; }

      // ══════════════════════════════════════════════════════
      // FIX CHINH: KLineCharts KHONG co subscribeAction('onDrawEnd').
      // onDrawEnd / onRemoved / onClick PHAI truyen thang vao
      // object createOverlay. Day la cach DUNG DUY NHAT theo API chinh thuc.
      // Ref: https://klinecharts.com/en-US/api/instance/createOverlay
      // ══════════════════════════════════════════════════════

      function _onDrawEnd() {
        DS._history.push(oid);
        DS._pendingId = null;
        DS.drawCount++;
        updateBadge();
        hideCancelBtn();
        DS.isDrawing = false;
        setTimeout(function () { activateTool('pointer'); }, 0);
        return false;
      }

      function _onRemoved() {
        var idx = DS._history.indexOf(oid);
        if (idx !== -1) DS._history.splice(idx, 1);
        if (DS.drawCount > 0) DS.drawCount--;
        updateBadge();
        return false;
      }

      function _onClick(evt) {
        if (DS.activeTool === 'eraser' && evt && evt.overlay) {
          try { global.tvChart.removeOverlay({ id: evt.overlay.id }); } catch (e) {}
          return true;
        }
        return false;
      }

      try {
        global.tvChart.createOverlay({
          id:        oid,
          name:      useName,
          lock:      false,
          visible:   true,
          mode:      'normal',
          styles:    buildOverlayStyles(tool),
          onDrawEnd: _onDrawEnd,  // FIX: callback dung vi tri, khong phai subscribeAction
          onRemoved: _onRemoved,  // FIX: tu dong sync count khi overlay bi xoa
          onClick:   _onClick,    // FIX: ho tro eraser mode
        });
        showCancelBtn();          // FIX: goi rieng, khong phai property trong object
      } catch (err) {
        console.warn('WaveDrawing createOverlay [' + useName + '] failed:', err.message);
        DS._pendingId = null;
        hideCancelBtn();
        DS.isDrawing = false;
      }
    }, 60);
  }

  // ════════════════════════════════════════
  // SECTION 7: OVERLAY STYLE BUILDER
  // ════════════════════════════════════════

  function buildOverlayStyles(tool) {
    var isShape = !!(tool && tool.isShape);
    return {
      line:    { color: DS.color, size: DS.lineSize, style: DS.lineStyle },
      text:    { color: DS.color, size: DS.textSize, family: "'Segoe UI',Arial,sans-serif", weight: 'normal' },
      polygon: isShape
        ? { color: DS.fillColor, style: 'fill', borderColor: DS.color, borderSize: DS.lineSize, borderStyle: DS.lineStyle }
        : { color: 'transparent', style: 'fill', borderColor: DS.color, borderSize: DS.lineSize, borderStyle: DS.lineStyle },
      arc:  { color: DS.color, size: DS.lineSize, style: DS.lineStyle },
      rect: isShape
        ? { color: DS.fillColor, style: 'fill', borderColor: DS.color, borderSize: DS.lineSize }
        : { color: 'transparent', style: 'fill', borderColor: DS.color, borderSize: DS.lineSize },
    };
  }

  function hexColor(c) {
    if (!c) return '00F0FF';
    c = c.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(c)) return c.replace('#','');
    if (/^#?[0-9a-fA-F]{3}$/.test(c)) {
      var s = c.replace('#','');
      return s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
    }
    var cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
    var ctx = cv.getContext('2d'); ctx.fillStyle = c; ctx.fillRect(0,0,1,1);
    var d = ctx.getImageData(0,0,1,1).data;
    return [d[0],d[1],d[2]].map(function(x){return x.toString(16).padStart(2,'0');}).join('');
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#','');
    if (hex.length===3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return 'rgba('+parseInt(hex.slice(0,2),16)+','+parseInt(hex.slice(2,4),16)+','+parseInt(hex.slice(4,6),16)+','+alpha+')';
  }

  function updatePropsBar(tool) {
    var bar    = document.getElementById('wa-drawing-props');
    if (!bar) return;
    var nameEl = document.getElementById('wa-dp-toolname');
    if (nameEl) nameEl.textContent = tool ? tool.name : 'Cong cu ve';

    var si = document.getElementById('wa-dp-stroke-color');
    var ss = document.getElementById('wa-dp-stroke-swatch');
    var fs = document.getElementById('wa-dp-fill-swatch');
    if (si) si.value = '#' + hexColor(DS.color);
    if (ss) ss.style.background = DS.color;
    if (fs) fs.style.background = DS.fillColor;

    var szEl = document.getElementById('wa-dp-size');
    var stEl = document.getElementById('wa-dp-linestyle');
    if (szEl) szEl.value = DS.lineSize;
    if (stEl) stEl.value = DS.lineStyle;

    bar.classList.toggle('show', !!(tool && tool.id !== 'pointer'));
  }

  function showCancelBtn() { var b=document.getElementById('wa-dp-cancel-btn'); if(b) b.style.display=''; }
  function hideCancelBtn() { var b=document.getElementById('wa-dp-cancel-btn'); if(b) b.style.display='none'; }
  function updateBadge() {
    var b = document.getElementById('wa-dt-badge');
    if (!b) return;
    b.textContent    = DS.drawCount;
    b.style.display  = DS.drawCount > 0 ? 'flex' : 'none';
  }

  // ════════════════════════════════════════
  // SECTION 8: FLYOUT MANAGEMENT
  // ════════════════════════════════════════

  function closeFlyouts() {
    document.querySelectorAll('.wa-flyout.open').forEach(function (f) { f.classList.remove('open'); });
    DS.flyoutOpenId = null;
  }

  function openFlyout(groupId) {
    closeFlyouts();
    var flyout    = document.getElementById('wa-flyout-' + groupId);
    if (!flyout) return;
    var grpBtn    = document.getElementById('wa-dtg-' + groupId);
    var container = document.getElementById('sc-chart-container');
    if (grpBtn && container) {
      var btnTop = grpBtn.getBoundingClientRect().top;
      var cTop   = container.getBoundingClientRect().top;
      var relTop = btnTop - cTop;
      var maxTop = container.clientHeight - 220 - 8;
      flyout.style.top = Math.max(4, Math.min(relTop, maxTop)) + 'px';
    }
    flyout.classList.add('open');
    DS.flyoutOpenId = groupId;
  }

  // ════════════════════════════════════════
  // SECTION 9: KEYBOARD SHORTCUTS
  // ════════════════════════════════════════

  function handleKeydown(e) {
    if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable) return;
    var ov = document.getElementById('super-chart-overlay');
    if (!ov || !ov.classList.contains('active')) return;

    if (e.ctrlKey && !e.shiftKey && e.key==='z')                    { e.preventDefault(); WaveDrawingAPI.undo(); return; }
    if (e.ctrlKey && (e.key==='y'||(e.shiftKey&&e.key==='z')))      { e.preventDefault(); WaveDrawingAPI.redo(); return; }
    if ((e.key==='Delete'||e.key==='Backspace') && DS.activeTool==='pointer') {
      if (global.tvChart) { try { global.tvChart.removeOverlay(); } catch(err){} }
      return;
    }
    if (e.key==='Escape') { WaveDrawingAPI.cancelDraw(); return; }
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      Object.values(TOOL_MAP).forEach(function (t) {
        if (t.key && e.key.toUpperCase()===t.key.toUpperCase()) {
          e.preventDefault(); activateTool(t.id);
        }
      });
    }
  }

  // ════════════════════════════════════════
  // SECTION 10: SETTINGS PERSISTENCE
  // ════════════════════════════════════════

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY));
      if (!s) return;
      if (s.color)     DS.color     = s.color;
      if (s.fillColor) DS.fillColor = s.fillColor;
      if (s.lineSize)  DS.lineSize  = Number(s.lineSize)||2;
      if (s.lineStyle) DS.lineStyle = s.lineStyle;
    } catch(e) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        color: DS.color, fillColor: DS.fillColor,
        lineSize: DS.lineSize, lineStyle: DS.lineStyle,
      }));
    } catch(e) {}
  }

  // Custom overlay fallback registration
  var _regCustom = new Set();
  function tryRegisterFallback(name, tool) {
    if (_regCustom.has(name)) return;
    var kc = global.klinecharts;
    if (!kc || typeof kc.registerOverlay !== 'function') return;
    _regCustom.add(name);
    try {
      kc.registerOverlay({
        name: name,
        totalStep: (tool && tool.points) ? tool.points + 1 : 3,
        createPointFigures: function (ref) {
          var coords = ref.coordinates || [];
          if (coords.length < 2) return [];
          var figs = [];
          for (var i = 0; i < coords.length - 1; i++) {
            figs.push({ type: 'line', attrs: { coordinates: [coords[i], coords[i+1]] } });
          }
          return figs;
        },
      });
    } catch(e) {}
  }

  // ════════════════════════════════════════
  // SECTION 11: PUBLIC API
  // ════════════════════════════════════════

  global.WaveDrawingAPI = {

    version: WD_VERSION,

    init: function () {
      injectCSS();
      loadSettings();
      inject();
      document.addEventListener('keydown', handleKeydown);
      watchForReinit();
    },

    reinject: function () {
      ['wa-drawing-toolbar','wa-drawing-props'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.remove();
      });
      DS.initialized = false;
      setTimeout(inject, 300);
    },

    // FIX: groupClick chi toggle flyout, KHONG tu kich hoat tool khi dong
    groupClick: function (event, groupId) {
      event.stopPropagation();
      var group = TOOL_GROUPS.find(function(g){ return g.id===groupId; });
      if (!group) return;
      if (group.tools.length === 1) {
        closeFlyouts();
        activateTool(group.tools[0].id);
        return;
      }
      var flyout = document.getElementById('wa-flyout-' + groupId);
      if (flyout && flyout.classList.contains('open')) {
        closeFlyouts(); // FIX: chi dong, KHONG goi activateTool
      } else {
        openFlyout(groupId);
      }
    },

    groupHover: function (event, groupId) {
      if (DS.flyoutOpenId && DS.flyoutOpenId !== groupId) openFlyout(groupId);
    },

    toolClick: function (toolId, event) {
      if (event) event.stopPropagation();
      closeFlyouts();
      activateTool(toolId);
    },

    // FIX: dung DS._pendingId thay vi ID cung 'wadrawing'
    cancelDraw: function () {
      if (global.tvChart && DS._pendingId) {
        try { global.tvChart.removeOverlay({ id: DS._pendingId }); } catch(e) {}
      }
      DS._pendingId = null;
      DS.isDrawing  = false;
      hideCancelBtn();
      activateTool('pointer');
    },

    onStrokeColor: function (val) {
      DS.color = val;
      var sw = document.getElementById('wa-dp-stroke-swatch');
      if (sw) sw.style.background = val;
      saveSettings();
    },

    onFillColor: function (val) {
      DS.fillColor = hexToRgba(hexColor(val), 0.15);
      var sw = document.getElementById('wa-dp-fill-swatch');
      if (sw) sw.style.background = DS.fillColor;
      saveSettings();
    },

    setColor: function (colorHex) {
      DS.color     = colorHex;
      DS.fillColor = hexToRgba(hexColor(colorHex), 0.12);
      var sw  = document.getElementById('wa-dp-stroke-swatch');
      var inp = document.getElementById('wa-dp-stroke-color');
      var fsw = document.getElementById('wa-dp-fill-swatch');
      if (sw)  sw.style.background  = colorHex;
      if (inp) inp.value = '#' + hexColor(colorHex);
      if (fsw) fsw.style.background = DS.fillColor;
      saveSettings();
    },

    onLineSize: function (val) { DS.lineSize = parseInt(val,10)||2; saveSettings(); },
    onLineStyle: function (val) { DS.lineStyle = val; saveSettings(); },

    // FIX: dung getOverlays() de loop tung ID, tranh override sai
    applyAll: function () {
      if (!global.tvChart) return;
      var overlays = [];
      if (typeof global.tvChart.getOverlays === 'function') {
        try { overlays = global.tvChart.getOverlays() || []; } catch(e) {}
      }
      var styles = buildOverlayStyles({ isShape: true });
      if (overlays.length > 0) {
        overlays.forEach(function (ov) {
          try { global.tvChart.overrideOverlay({ id: ov.id, styles: styles }); } catch(e) {}
        });
      } else {
        try { global.tvChart.overrideOverlay({ styles: styles }); } catch(e) {}
      }
    },

    // FIX: undo dung history stack, khong goi removeOverlay() khong tham so
    undo: function () {
      if (!global.tvChart) return;
      if (typeof global.tvChart.undoOverlay === 'function') {
        try {
          global.tvChart.undoOverlay();
          if (DS.drawCount > 0) DS.drawCount--;
          updateBadge();
          return;
        } catch(e) {}
      }
      if (DS._history.length === 0) return;
      var lastId = DS._history.pop();
      try { global.tvChart.removeOverlay({ id: lastId }); } catch(e) {}
      if (DS.drawCount > 0) DS.drawCount--;
      updateBadge();
    },

    redo: function () {
      if (!global.tvChart) return;
      if (typeof global.tvChart.redoOverlay === 'function') {
        try { global.tvChart.redoOverlay(); DS.drawCount++; updateBadge(); } catch(e) {}
      }
    },

    toggleVisibility: function () {
      if (!global.tvChart) return;
      DS.allVisible = !DS.allVisible;
      try { global.tvChart.overrideOverlay({ visible: DS.allVisible }); } catch(e) {}
      var btn = document.getElementById('wa-dt-vis-btn');
      if (btn) {
        var icon = btn.querySelector('.wa-dt-icon');
        var tip  = btn.querySelector('.wa-dt-tip');
        if (icon) icon.textContent = DS.allVisible ? 'o' : '-';
        if (tip)  tip.textContent  = DS.allVisible ? 'An/Hien hinh ve' : 'Hien tat ca hinh ve';
      }
    },

    // FIX: reset _history va _pendingId sau khi xoa tat ca
    deleteAll: function () {
      if (!global.tvChart) return;
      if (!confirm('Xoa tat ca hinh ve tren chart?\nKhong the hoan tac!')) return;
      try { global.tvChart.removeOverlay(); } catch(e) {}
      DS.drawCount  = 0;
      DS._history   = [];
      DS._pendingId = null;
      updateBadge();
      if (typeof global.applyFishFilter === 'function') setTimeout(global.applyFishFilter, 100);
    },

    getState: function () { return Object.assign({}, DS); },
    getTools: function () { return TOOL_GROUPS; },
  };

  // ════════════════════════════════════════
  // AUTO-INIT
  // ════════════════════════════════════════

  function autoInit() { WaveDrawingAPI.init(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(autoInit,400); });
  } else {
    setTimeout(autoInit, 400);
  }

  // Hook vao openProChart de re-inject sau khi chart reinit
  var _origRef = global.openProChart;
  function _hookedOpen() {
    if (_origRef) _origRef.apply(this, arguments);
    setTimeout(function () {
      if (!document.getElementById('wa-drawing-toolbar')) WaveDrawingAPI.reinject();
    }, 500);
  }
  try {
    Object.defineProperty(global, 'openProChart', {
      configurable: true,
      get: function () { return _hookedOpen; },
      set: function (fn) { _origRef = fn; },
    });
  } catch(e) {}

  // Fallback patch
  setTimeout(function () {
    if (typeof global.openProChart === 'function' && global.openProChart !== _hookedOpen) {
      var orig = global.openProChart;
      global.openProChart = function () {
        orig.apply(this, arguments);
        setTimeout(function () {
          if (!document.getElementById('wa-drawing-toolbar')) WaveDrawingAPI.reinject();
        }, 500);
      };
    }
  }, 1200);

  console.log('Wave Alpha Drawing Tools v' + WD_VERSION + ' loaded.');

}(window));