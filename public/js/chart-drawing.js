(function (global) {
  'use strict';

  var WD_VERSION = '3.0.0';
  var LS_KEY = 'wa_draw_settings_v2';
  var OVERLAY_ID_PREFIX = 'wadr_';

  var TOOL_GROUPS = [
    { id: 'cursor', label: 'Cursor', icon: 'PTR', tools: [
      { id: 'pointer', name: 'Pointer', overlay: null, icon: 'PTR', key: 'Escape', desc: 'Select mode', points: 0 },
      { id: 'eraser', name: 'Eraser', overlay: '__erase__', icon: 'DEL', key: 'E', desc: 'Click overlay to remove', points: 0 }
    ] },
    { id: 'lines', label: 'Lines', icon: 'LIN', tools: [
      { id: 'segment', name: 'Trend Line', overlay: 'segment', icon: 'SEG', key: 'L', desc: '2 points', points: 2 },
      { id: 'ray', name: 'Ray', overlay: 'ray', icon: 'RAY', desc: '2 points', points: 2 },
      { id: 'straightLine', name: 'Straight Line', overlay: 'straightLine', icon: 'INF', desc: '2 points', points: 2 },
      { id: 'horizontalStraightLine', name: 'Horizontal Line', overlay: 'horizontalStraightLine', icon: 'H-L', key: 'H', desc: '1 point', points: 1 },
      { id: 'horizontalRayLine', name: 'Horizontal Ray', overlay: 'horizontalRayLine', icon: 'H-R', desc: '2 points', points: 2 },
      { id: 'horizontalSegment', name: 'Horizontal Segment', overlay: 'horizontalSegment', icon: 'H-S', desc: '2 points', points: 2 },
      { id: 'verticalStraightLine', name: 'Vertical Line', overlay: 'verticalStraightLine', icon: 'V-L', key: 'V', desc: '1 point', points: 1 },
      { id: 'verticalRayLine', name: 'Vertical Ray', overlay: 'verticalRayLine', icon: 'V-R', desc: '2 points', points: 2 },
      { id: 'verticalSegment', name: 'Vertical Segment', overlay: 'verticalSegment', icon: 'V-S', desc: '2 points', points: 2 },
      { id: 'priceLine', name: 'Price Line', overlay: 'priceLine', icon: 'P-L', desc: '1 point', points: 1 },
      { id: 'arrow', name: 'Arrow', overlay: 'arrow', icon: 'ARR', desc: '2 points', points: 2 }
    ] },
    { id: 'channels', label: 'Channels', icon: 'CHN', tools: [
      { id: 'priceChannelLine', name: 'Price Channel', overlay: 'priceChannelLine', icon: 'PCH', desc: '3 points', points: 3 },
      { id: 'parallelStraightLine', name: 'Parallel Line', overlay: 'parallelStraightLine', icon: 'PAR', desc: '3 points', points: 3 }
    ] },
    { id: 'fibonacci', label: 'Fibonacci', icon: 'FIB', tools: [
      { id: 'fibonacciLine', name: 'Fib Retracement', overlay: 'fibonacciLine', icon: 'FR', key: 'F', desc: '2 points', points: 2 },
      { id: 'fibonacciSegment', name: 'Fib Segment', overlay: 'fibonacciSegment', icon: 'FS', desc: '2 points', points: 2 },
      { id: 'fibonacciExtension', name: 'Fib Extension', overlay: 'fibonacciExtension', icon: 'FE', desc: '3 points', points: 3 },
      { id: 'fibonacciSpiral', name: 'Fib Spiral', overlay: 'fibonacciSpiral', icon: 'FSP', desc: '2 points', points: 2 },
      { id: 'fibonacciSpeedResistanceFan', name: 'Fib Fan', overlay: 'fibonacciSpeedResistanceFan', icon: 'FF', desc: '2 points', points: 2 },
      { id: 'fibTrendExtension', name: 'Fib Trend Ext', overlay: 'fibonacciExtension', icon: 'FTE', desc: '3 points', points: 3 }
    ] },
    { id: 'gann', label: 'Gann', icon: 'GAN', tools: [
      { id: 'gannBox', name: 'Gann Box', overlay: 'gannBox', icon: 'GB', desc: '2 points', points: 2 },
      { id: 'gannFan', name: 'Gann Fan', overlay: 'gannFan', icon: 'GF', desc: '2 points', points: 2 },
      { id: 'gannSquare', name: 'Gann Square', overlay: 'gannSquare', icon: 'GS', desc: '2 points', points: 2 }
    ] },
    { id: 'elliott', label: 'Elliott', icon: 'EWT', tools: [
      { id: 'elliottImpulseWave', name: 'Impulse Wave', overlay: 'elliottImpulseWave', icon: 'E15', desc: '6 points', points: 6 },
      { id: 'elliottCorrectiveWave', name: 'Corrective Wave', overlay: 'elliottCorrectiveWave', icon: 'EAB', desc: '4 points', points: 4 },
      { id: 'elliottTriangleWave', name: 'Triangle Wave', overlay: 'elliottTriangleWave', icon: 'ETR', desc: '5 points', points: 5 },
      { id: 'elliottDoubleComboWave', name: 'Double Combo', overlay: 'elliottDoubleComboWave', icon: 'EDC', desc: '7 points', points: 7 },
      { id: 'elliottTripleComboWave', name: 'Triple Combo', overlay: 'elliottTripleComboWave', icon: 'ETC', desc: '9 points', points: 9 }
    ] },
    { id: 'shapes', label: 'Shapes', icon: 'SHP', tools: [
      { id: 'rect', name: 'Rectangle', overlay: 'rect', icon: 'REC', key: 'R', desc: '2 points', points: 2, isShape: true },
      { id: 'circle', name: 'Circle', overlay: 'circle', icon: 'CIR', desc: '2 points', points: 2, isShape: true },
      { id: 'triangle', name: 'Triangle', overlay: 'triangle', icon: 'TRI', desc: '3 points', points: 3, isShape: true },
      { id: 'parallelogram', name: 'Parallelogram', overlay: 'parallelogram', icon: 'PLG', desc: '3 points', points: 3, isShape: true }
    ] },
    { id: 'patterns', label: 'Patterns', icon: 'PAT', tools: [
      { id: 'xabcd', name: 'XABCD', overlay: 'xabcd', icon: 'XAB', desc: '5 points', points: 5 },
      { id: 'abcd', name: 'ABCD', overlay: 'abcd', icon: 'ABCD', desc: '4 points', points: 4 },
      { id: 'threedrives', name: 'Three Drives', overlay: 'threedrives', icon: '3DRV', desc: '7 points', points: 7 }
    ] },
    { id: 'projections', label: 'Risk', icon: 'RR', tools: [
      { id: 'longPosition', name: 'Long Position', overlay: 'longPosition', icon: 'LONG', desc: '3 points', points: 3 },
      { id: 'shortPosition', name: 'Short Position', overlay: 'shortPosition', icon: 'SHRT', desc: '3 points', points: 3 },
      { id: 'priceRange', name: 'Price Range', overlay: 'priceRange', icon: 'PRG', desc: '2 points', points: 2 },
      { id: 'dateRangeNote', name: 'Date Range', overlay: 'dateRangeNote', icon: 'DRG', desc: '2 points', points: 2 }
    ] },
    { id: 'text', label: 'Text', icon: 'TXT', tools: [
      { id: 'text', name: 'Text', overlay: 'text', icon: 'TXT', key: 'T', desc: '1 point', points: 1 },
      { id: 'callout', name: 'Callout', overlay: 'callout', icon: 'CAL', desc: '2 points', points: 2 },
      { id: 'note', name: 'Note', overlay: 'note', icon: 'NOTE', desc: '1 point', points: 1 }
    ] }
  ];

  var TOOL_MAP = {};
  var PRESET_COLORS = ['#00F0FF', '#F0B90B', '#0ECB81', '#F6465D', '#EAECEF', '#848e9c', '#cb55e3', '#FF8C00'];
  var KNOWN_NATIVE_OVERLAYS = new Set([
    'segment', 'ray', 'straightLine', 'horizontalStraightLine', 'horizontalRayLine', 'horizontalSegment',
    'verticalStraightLine', 'verticalRayLine', 'verticalSegment', 'priceLine', 'arrow',
    'priceChannelLine', 'parallelStraightLine', 'fibonacciLine', 'fibonacciSegment', 'fibonacciExtension',
    'fibonacciSpiral', 'fibonacciSpeedResistanceFan', 'gannBox', 'gannFan', 'gannSquare',
    'elliottImpulseWave', 'elliottCorrectiveWave', 'elliottTriangleWave', 'elliottDoubleComboWave',
    'elliottTripleComboWave', 'rect', 'circle', 'triangle', 'parallelogram',
    'xabcd', 'abcd', 'threedrives', 'longPosition', 'shortPosition', 'priceRange',
    'dateRangeNote', 'text', 'callout', 'note'
  ]);

  var STATE = {
    activeTool: 'pointer',
    color: '#00F0FF',
    fillColor: 'rgba(0,240,255,0.12)',
    lineSize: 2,
    lineStyle: 'solid',
    textSize: 13,
    allVisible: true,
    drawCount: 0,
    isDrawing: false,
    pendingOverlayId: null,
    idCounter: 1,
    historyStack: [],
    flyoutOpenId: null,
    initialized: false,
    registeredFallbacks: {},
    overlayIdSet: {},
    undoStack: [],
    refs: {
      container: null,
      toolbar: null,
      props: null,
      badge: null,
      visBtn: null,
      strokeInput: null,
      fillInput: null,
      strokeSwatch: null,
      fillSwatch: null,
      sizeSel: null,
      styleSel: null,
      cancelBtn: null,
      toolName: null
    },
    observer: null,
    openWrapTimer: null,
    syncTimer: null,
    keyHandlerBound: false,
    docClickBound: false,
    containerObserver: null
  };

  TOOL_GROUPS.forEach(function (group) {
    group.tools.forEach(function (tool) {
      TOOL_MAP[tool.id] = tool;
      tool.groupId = group.id;
    });
  });

  function safeGetChart() { return global.tvChart || null; }
  function isInputLike(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }
  function normalizeHex(color) {
    if (!color || typeof color !== 'string') return '00f0ff';
    var c = color.trim().replace('#', '');
    if (/^[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    if (/^[0-9a-f]{3}$/i.test(c)) return (c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toLowerCase();
    return '00f0ff';
  }
  function rgbaFromHex(hex, alpha) {
    var h = normalizeHex(hex);
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function injectCSS() {
    if (document.getElementById('wa-drawing-css')) return;
    var css = '' +
      '#sc-chart-container{position:relative!important;}' +
      '#wa-drawing-toolbar{position:absolute;left:0;top:0;width:36px;height:100%;z-index:300;display:flex;flex-direction:column;align-items:center;padding:6px 0;gap:1px;background:rgba(14,18,24,.96);border-right:1px solid rgba(255,255,255,.07);backdrop-filter:blur(8px);overflow:hidden;overflow-y:auto;box-sizing:border-box;}' +
      '#wa-drawing-toolbar::-webkit-scrollbar{display:none;}' +
      '.wa-dt-group{position:relative;width:100%;display:flex;justify-content:center;flex-shrink:0;}' +
      '.wa-dt-sep{width:22px;height:1px;background:rgba(255,255,255,.07);margin:3px 0;flex-shrink:0;}' +
      '.wa-dt-spacer{flex:1;}' +
      '.wa-dt-btn{width:30px;height:30px;border:1px solid transparent;border-radius:6px;background:transparent;color:#5a6475;font-family:"Segoe UI","Segoe UI Symbol",Arial,sans-serif;font-size:9px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;position:relative;padding:0;}' +
      '.wa-dt-btn:hover{background:rgba(255,255,255,.07);color:#c8cdd4;border-color:rgba(255,255,255,.1);}' +
      '.wa-dt-btn.active{background:rgba(0,240,255,.14);color:#00F0FF;border-color:rgba(0,240,255,.35);}' +
      '.wa-dt-btn.has-flyout:after{content:"";position:absolute;right:2px;bottom:2px;width:4px;height:4px;border-right:1px solid currentColor;border-bottom:1px solid currentColor;opacity:.6;}' +
      '.wa-dt-tip{position:absolute;left:38px;top:50%;transform:translateY(-50%);background:rgba(10,14,20,.97);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:4px 10px;font-size:11px;color:#c8cdd4;white-space:nowrap;pointer-events:none;z-index:10000;opacity:0;}' +
      '.wa-dt-btn:hover .wa-dt-tip{opacity:1;}' +
      '.wa-dt-badge{position:absolute;top:1px;right:1px;background:#00F0FF;color:#000;font-size:7px;font-weight:900;min-width:11px;height:11px;border-radius:5px;padding:0 2px;display:none;align-items:center;justify-content:center;line-height:1;}' +
      '.wa-flyout{position:absolute;left:38px;top:-2px;display:none;flex-direction:column;gap:1px;min-width:240px;z-index:9999;background:#0d1117;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:6px 5px;box-shadow:0 14px 44px rgba(0,0,0,.75);}' +
      '.wa-flyout.open{display:flex;}' +
      '.wa-flyout-header{font-size:9px;font-weight:800;color:#3a434f;letter-spacing:1.2px;padding:4px 10px 7px;border-bottom:1px solid rgba(255,255,255,.05);}' +
      '.wa-flyout-item{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px;cursor:pointer;color:#7a8694;font-size:11.5px;}' +
      '.wa-flyout-item:hover{background:rgba(255,255,255,.06);color:#d4dae2;}' +
      '.wa-flyout-item.active{background:rgba(0,240,255,.09);color:#00F0FF;}' +
      '.wa-flyout-icon{font-size:10px;font-weight:700;width:34px;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:4px;padding:2px 0;background:rgba(255,255,255,.05);}' +
      '.wa-flyout-desc{font-size:9.5px;color:#3a434f;}' +
      '#wa-drawing-props{position:absolute;top:8px;left:44px;right:8px;height:36px;display:none;align-items:center;gap:6px;padding:0 12px;z-index:295;background:rgba(10,14,20,.97);border:1px solid rgba(255,255,255,.1);border-radius:9px;box-shadow:0 6px 22px rgba(0,0,0,.6);}' +
      '#wa-drawing-props.show{display:flex;}' +
      '.wa-dp-tool-name{font-size:11px;font-weight:700;color:#00F0FF;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.wa-dp-sep{width:1px;height:20px;background:rgba(255,255,255,.08);}' +
      '.wa-dp-lbl{font-size:10px;color:#4a5460;}' +
      '.wa-dp-color-box{position:relative;width:22px;height:22px;border-radius:5px;border:1.5px solid rgba(255,255,255,.15);overflow:hidden;}' +
      '.wa-dp-color-box input{position:absolute;opacity:0;inset:-50%;cursor:pointer;}' +
      '.wa-dp-preset{width:14px;height:14px;border-radius:3px;cursor:pointer;border:1px solid rgba(255,255,255,.12);}' +
      '.wa-dp-sel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:5px;color:#c8cdd4;font-size:11px;padding:3px 5px;}' +
      '.wa-dp-btn{padding:3px 10px;border-radius:5px;border:1px solid rgba(255,255,255,.08);background:transparent;color:#7a8694;font-size:10.5px;cursor:pointer;}' +
      '.wa-dp-btn.accent{background:rgba(0,240,255,.1);border-color:rgba(0,240,255,.3);color:#00F0FF;}' +
      '.wa-dp-btn.red:hover{border-color:rgba(246,70,93,.4);color:#F6465D;}' +
      '.wa-chart-drawing-mode canvas{cursor:crosshair!important;}';
    var style = document.createElement('style');
    style.id = 'wa-drawing-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildFlyout(group) {
    var html = '<div class="wa-flyout" id="wa-flyout-' + group.id + '"><div class="wa-flyout-header">' + group.label + '</div>';
    for (var i = 0; i < group.tools.length; i++) {
      var tool = group.tools[i];
      html += '<div class="wa-flyout-item" data-tool="' + tool.id + '">' +
        '<span class="wa-flyout-icon">' + tool.icon + '</span>' +
        '<span class="wa-flyout-info"><span class="wa-flyout-name">' + tool.name + '</span><span class="wa-flyout-desc">' + tool.desc + '</span></span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildToolbarHTML() {
    var html = '';
    for (var i = 0; i < TOOL_GROUPS.length; i++) {
      var group = TOOL_GROUPS[i];
      if (i > 0) html += '<div class="wa-dt-sep"></div>';
      var rep = group.tools[0];
      html += '<div class="wa-dt-group" data-group="' + group.id + '">' +
        '<button class="wa-dt-btn' + (group.tools.length > 1 ? ' has-flyout' : '') + '" id="wa-dtg-' + group.id + '" data-action="group" data-group="' + group.id + '" data-tool="' + rep.id + '" title="' + group.label + '">' +
        '<span class="wa-dt-icon">' + rep.icon + '</span><span class="wa-dt-tip">' + group.label + '</span></button>' +
        (group.tools.length > 1 ? buildFlyout(group) : '') +
        '</div>';
    }
    html += '<div class="wa-dt-spacer"></div><div class="wa-dt-sep"></div>' +
      '<div class="wa-dt-group"><button class="wa-dt-btn" data-action="undo" title="Undo Ctrl+Z"><span class="wa-dt-icon">UND</span><span class="wa-dt-tip">Undo</span></button></div>' +
      '<div class="wa-dt-group"><button class="wa-dt-btn" data-action="redo" title="Redo Ctrl+Y"><span class="wa-dt-icon">RED</span><span class="wa-dt-tip">Redo</span></button></div>' +
      '<div class="wa-dt-sep"></div>' +
      '<div class="wa-dt-group"><button class="wa-dt-btn" id="wa-dt-vis-btn" data-action="visibility" title="Toggle Visibility"><span class="wa-dt-icon">VIS</span><span class="wa-dt-tip">Hide/Show Drawings</span></button></div>' +
      '<div class="wa-dt-group"><button class="wa-dt-btn" id="wa-dt-del-btn" data-action="delete-all" title="Delete All"><span class="wa-dt-badge" id="wa-dt-badge">0</span><span class="wa-dt-icon">CLR</span><span class="wa-dt-tip">Delete All</span></button></div>';
    return html;
  }

  function buildPropsHTML() {
    var swatches = '';
    for (var i = 0; i < PRESET_COLORS.length; i++) {
      swatches += '<div class="wa-dp-preset" data-action="preset" data-color="' + PRESET_COLORS[i] + '" title="' + PRESET_COLORS[i] + '" style="background:' + PRESET_COLORS[i] + '"></div>';
    }
    return '<div id="wa-drawing-props">' +
      '<span class="wa-dp-tool-name" id="wa-dp-toolname">Drawing Tool</span>' +
      '<div class="wa-dp-sep"></div><span class="wa-dp-lbl">Stroke</span>' +
      '<div class="wa-dp-color-box"><div class="wa-dp-swatch" id="wa-dp-stroke-swatch" style="background:#00F0FF;width:100%;height:100%"></div><input id="wa-dp-stroke-color" data-action="stroke" type="color" value="#00f0ff"></div>' +
      '<span class="wa-dp-lbl">Fill</span>' +
      '<div class="wa-dp-color-box"><div class="wa-dp-swatch" id="wa-dp-fill-swatch" style="background:rgba(0,240,255,0.12);width:100%;height:100%"></div><input id="wa-dp-fill-color" data-action="fill" type="color" value="#00f0ff"></div>' +
      '<div class="wa-dp-sep"></div>' +
      '<select id="wa-dp-size" class="wa-dp-sel" data-action="size"><option value="1">1px</option><option value="2" selected>2px</option><option value="3">3px</option><option value="4">4px</option><option value="5">5px</option></select>' +
      '<select id="wa-dp-linestyle" class="wa-dp-sel" data-action="style"><option value="solid">solid</option><option value="dashed">dashed</option><option value="dotted">dotted</option></select>' +
      '<div class="wa-dp-sep"></div>' + swatches +
      '<div class="wa-dp-sep"></div>' +
      '<button class="wa-dp-btn accent" data-action="apply-all">Apply All</button>' +
      '<button class="wa-dp-btn red" data-action="delete-all">Delete All</button>' +
      '<button class="wa-dp-btn" id="wa-dp-cancel-btn" data-action="cancel" style="display:none">Cancel Draw</button>' +
      '</div>';
  }

  function cacheRefs() {
    STATE.refs.container = document.getElementById('sc-chart-container');
    STATE.refs.toolbar = document.getElementById('wa-drawing-toolbar');
    STATE.refs.props = document.getElementById('wa-drawing-props');
    STATE.refs.badge = document.getElementById('wa-dt-badge');
    STATE.refs.visBtn = document.getElementById('wa-dt-vis-btn');
    STATE.refs.strokeInput = document.getElementById('wa-dp-stroke-color');
    STATE.refs.fillInput = document.getElementById('wa-dp-fill-color');
    STATE.refs.strokeSwatch = document.getElementById('wa-dp-stroke-swatch');
    STATE.refs.fillSwatch = document.getElementById('wa-dp-fill-swatch');
    STATE.refs.sizeSel = document.getElementById('wa-dp-size');
    STATE.refs.styleSel = document.getElementById('wa-dp-linestyle');
    STATE.refs.cancelBtn = document.getElementById('wa-dp-cancel-btn');
    STATE.refs.toolName = document.getElementById('wa-dp-toolname');
  }

  function updateBadge() {
    if (!STATE.refs.badge) return;
    STATE.refs.badge.textContent = String(Math.max(0, STATE.drawCount));
    STATE.refs.badge.style.display = STATE.drawCount > 0 ? 'flex' : 'none';
  }

  function syncProps() {
    if (STATE.refs.strokeInput) STATE.refs.strokeInput.value = '#' + normalizeHex(STATE.color);
    if (STATE.refs.fillInput) STATE.refs.fillInput.value = '#' + normalizeHex(STATE.color);
    if (STATE.refs.strokeSwatch) STATE.refs.strokeSwatch.style.background = STATE.color;
    if (STATE.refs.fillSwatch) STATE.refs.fillSwatch.style.background = STATE.fillColor;
    if (STATE.refs.sizeSel) STATE.refs.sizeSel.value = String(STATE.lineSize);
    if (STATE.refs.styleSel) STATE.refs.styleSel.value = STATE.lineStyle;
  }

  function showProps(visible, toolName) {
    if (!STATE.refs.props) return;
    STATE.refs.props.classList.toggle('show', !!visible);
    if (STATE.refs.toolName) STATE.refs.toolName.textContent = toolName || 'Drawing Tool';
  }

  function closeFlyouts() {
    var toolbar = STATE.refs.toolbar;
    if (!toolbar) return;
    var open = toolbar.querySelectorAll('.wa-flyout.open');
    for (var i = 0; i < open.length; i++) open[i].classList.remove('open');
    STATE.flyoutOpenId = null;
  }

  function openFlyout(groupId) {
    closeFlyouts();
    var fly = document.getElementById('wa-flyout-' + groupId);
    var btn = document.getElementById('wa-dtg-' + groupId);
    var container = STATE.refs.container;
    if (!fly || !btn || !container) return;
    var relTop = btn.getBoundingClientRect().top - container.getBoundingClientRect().top;
    var maxTop = Math.max(4, container.clientHeight - fly.offsetHeight - 8);
    fly.style.top = Math.max(4, Math.min(relTop, maxTop)) + 'px';
    fly.classList.add('open');
    STATE.flyoutOpenId = groupId;
  }

  function getOverlayStyles(tool) {
    var isShape = !!(tool && tool.isShape);
    return {
      line: { color: STATE.color, size: STATE.lineSize, style: STATE.lineStyle },
      polygon: { color: isShape ? STATE.fillColor : 'transparent', borderColor: STATE.color, borderSize: STATE.lineSize, borderStyle: STATE.lineStyle },
      rect: { color: isShape ? STATE.fillColor : 'transparent', borderColor: STATE.color, borderSize: STATE.lineSize, borderStyle: STATE.lineStyle },
      text: { color: STATE.color, size: STATE.textSize, family: 'Segoe UI, Arial, sans-serif', weight: 'normal' },
      arc: { color: STATE.color, size: STATE.lineSize, style: STATE.lineStyle }
    };
  }

  function setDrawingCursor(enabled) {
    if (!STATE.refs.container) return;
    STATE.refs.container.classList.toggle('wa-chart-drawing-mode', !!enabled);
  }

  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        color: STATE.color,
        fillColor: STATE.fillColor,
        lineSize: STATE.lineSize,
        lineStyle: STATE.lineStyle,
        textSize: STATE.textSize,
        idCounter: STATE.idCounter
      }));
    } catch (e) {}
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.color) STATE.color = parsed.color;
      if (parsed && parsed.fillColor) STATE.fillColor = parsed.fillColor;
      if (parsed && parsed.lineSize) STATE.lineSize = parseInt(parsed.lineSize, 10) || 2;
      if (parsed && parsed.lineStyle) STATE.lineStyle = parsed.lineStyle;
      if (parsed && parsed.textSize) STATE.textSize = parseInt(parsed.textSize, 10) || 13;
      if (parsed && parsed.idCounter) STATE.idCounter = Math.max(1, parseInt(parsed.idCounter, 10) || 1);
    } catch (e) {}
  }

  function ensureOverlayName(name, tool) {
    if (!name) return null;
    if (KNOWN_NATIVE_OVERLAYS.has(name)) return name;
    if (STATE.registeredFallbacks[name]) return STATE.registeredFallbacks[name];
    var kc = global.klinecharts;
    if (kc && typeof kc.registerOverlay === 'function') {
      try {
        kc.registerOverlay({
          name: name,
          totalStep: (tool && tool.points ? tool.points : 2) + 1,
          createPointFigures: function (ctx) {
            var out = [];
            var coordinates = (ctx && ctx.coordinates) || [];
            for (var i = 0; i < coordinates.length - 1; i++) {
              out.push({ type: 'line', attrs: { coordinates: [coordinates[i], coordinates[i + 1]] } });
            }
            return out;
          }
        });
        STATE.registeredFallbacks[name] = name;
        return name;
      } catch (e) {}
    }
    STATE.registeredFallbacks[name] = 'segment';
    return 'segment';
  }

  function syncFromChart() {
    var chart = safeGetChart();
    if (!chart || typeof chart.getOverlays !== 'function') return;
    try {
      var overlays = chart.getOverlays() || [];
      var count = 0;
      for (var i = 0; i < overlays.length; i++) {
        var id = overlays[i] && overlays[i].id ? String(overlays[i].id) : '';
        if (id.indexOf(OVERLAY_ID_PREFIX) === 0) count++;
      }
      STATE.drawCount = count;
      updateBadge();
    } catch (e) {}
  }

  function activateTool(toolId) {
    var tool = TOOL_MAP[toolId];
    if (!tool) return;

    if (STATE.pendingOverlayId) {
      var pendingChart = safeGetChart();
      if (pendingChart && typeof pendingChart.removeOverlay === 'function') {
        try { pendingChart.removeOverlay({ id: STATE.pendingOverlayId }); } catch (e) {}
      }
      STATE.pendingOverlayId = null;
    }

    STATE.activeTool = toolId;
    STATE.isDrawing = toolId !== 'pointer' && toolId !== 'eraser' && !!tool.overlay;

    if (STATE.refs.toolbar) {
      var btns = STATE.refs.toolbar.querySelectorAll('.wa-dt-btn[data-group]');
      for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
      var items = STATE.refs.toolbar.querySelectorAll('.wa-flyout-item');
      for (var j = 0; j < items.length; j++) items[j].classList.toggle('active', items[j].getAttribute('data-tool') === toolId);
      var groupBtn = document.getElementById('wa-dtg-' + tool.groupId);
      if (groupBtn) {
        groupBtn.classList.add('active');
        groupBtn.setAttribute('data-tool', tool.id);
        var icon = groupBtn.querySelector('.wa-dt-icon');
        if (icon) icon.textContent = tool.icon;
      }
    }

    setDrawingCursor(STATE.isDrawing || toolId === 'eraser');
    showProps(toolId !== 'pointer' && toolId !== 'eraser', tool.name);
    if (STATE.refs.cancelBtn) STATE.refs.cancelBtn.style.display = 'none';

    if (toolId === 'pointer' || toolId === 'eraser' || !tool.overlay) return;

    var chart = safeGetChart();
    if (!chart || typeof chart.createOverlay !== 'function') return;

    var overlayName = ensureOverlayName(tool.overlay, tool);
    var overlayId = OVERLAY_ID_PREFIX + STATE.idCounter;
    STATE.idCounter += 1;
    STATE.pendingOverlayId = overlayId;
    saveSettings();

    try {
      chart.createOverlay({
        id: overlayId,
        name: overlayName,
        lock: false,
        visible: true,
        mode: 'normal',
        styles: getOverlayStyles(tool),
        onDrawEnd: function () {
          STATE.pendingOverlayId = null;
          STATE.historyStack.push(overlayId);
          STATE.overlayIdSet[overlayId] = true;
          STATE.undoStack = [];
          STATE.drawCount += 1;
          STATE.isDrawing = false;
          updateBadge();
          if (STATE.refs.cancelBtn) STATE.refs.cancelBtn.style.display = 'none';
          activateTool('pointer');
          return false;
        },
        onRemoved: function () {
          delete STATE.overlayIdSet[overlayId];
          var idx = STATE.historyStack.indexOf(overlayId);
          if (idx >= 0) STATE.historyStack.splice(idx, 1);
          if (STATE.drawCount > 0) STATE.drawCount -= 1;
          updateBadge();
          if (STATE.pendingOverlayId === overlayId) STATE.pendingOverlayId = null;
          return false;
        },
        onClick: function (evt) {
          if (STATE.activeTool !== 'eraser') return false;
          var id = evt && evt.overlay && evt.overlay.id;
          if (!id) return false;
          var c = safeGetChart();
          if (c && typeof c.removeOverlay === 'function') {
            try { c.removeOverlay({ id: id }); } catch (e) {}
          }
          return true;
        }
      });
      if (STATE.refs.cancelBtn) STATE.refs.cancelBtn.style.display = '';
    } catch (e) {
      STATE.pendingOverlayId = null;
      STATE.isDrawing = false;
      activateTool('pointer');
    }
  }

  function handleToolbarClick(e) {
    var node = e.target && e.target.closest ? e.target.closest('[data-action], .wa-flyout-item') : null;
    if (!node || !STATE.refs.toolbar || !STATE.refs.toolbar.contains(node)) return;
    e.preventDefault();
    e.stopPropagation();

    if (node.classList.contains('wa-flyout-item')) {
      closeFlyouts();
      activateTool(node.getAttribute('data-tool'));
      return;
    }

    var action = node.getAttribute('data-action');
    if (action === 'group') { WaveDrawingAPI.groupClick(e, node.getAttribute('data-group')); return; }
    if (action === 'undo') { WaveDrawingAPI.undo(); return; }
    if (action === 'redo') { WaveDrawingAPI.redo(); return; }
    if (action === 'visibility') { WaveDrawingAPI.toggleVisibility(); return; }
    if (action === 'delete-all') { WaveDrawingAPI.deleteAll(); return; }
  }

  function handleToolbarMouseOver(e) {
    var btn = e.target && e.target.closest ? e.target.closest('.wa-dt-btn[data-group]') : null;
    if (!btn || !STATE.refs.toolbar || !STATE.refs.toolbar.contains(btn)) return;
    var gid = btn.getAttribute('data-group');
    if (gid) WaveDrawingAPI.groupHover(e, gid);
  }

  function handlePropsClick(e) {
    var node = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!node || !STATE.refs.props || !STATE.refs.props.contains(node)) return;
    var action = node.getAttribute('data-action');
    if (action === 'preset') { WaveDrawingAPI.setColor(node.getAttribute('data-color')); return; }
    if (action === 'apply-all') { WaveDrawingAPI.applyAll(); return; }
    if (action === 'delete-all') { WaveDrawingAPI.deleteAll(); return; }
    if (action === 'cancel') { WaveDrawingAPI.cancelDraw(); return; }
  }

  function handlePropsInput(e) {
    var target = e.target;
    if (!target || !STATE.refs.props || !STATE.refs.props.contains(target)) return;
    var action = target.getAttribute('data-action');
    if (action === 'stroke') WaveDrawingAPI.onStrokeColor(target.value);
    else if (action === 'fill') WaveDrawingAPI.onFillColor(target.value);
    else if (action === 'size') WaveDrawingAPI.onLineSize(target.value);
    else if (action === 'style') WaveDrawingAPI.onLineStyle(target.value);
  }

  function handleDocClick(e) {
    if (!STATE.refs.toolbar) return;
    if (STATE.refs.toolbar.contains(e.target)) return;
    closeFlyouts();
  }

  function handleKeydown(e) {
    if (isInputLike(e.target)) return;
    var overlay = document.getElementById('super-chart-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;

    var k = (e.key || '').toLowerCase();
    if (e.ctrlKey && !e.shiftKey && k === 'z') { e.preventDefault(); WaveDrawingAPI.undo(); return; }
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); WaveDrawingAPI.redo(); return; }
    if (k === 'escape') { e.preventDefault(); WaveDrawingAPI.cancelDraw(); return; }

    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      for (var id in TOOL_MAP) {
        if (!Object.prototype.hasOwnProperty.call(TOOL_MAP, id)) continue;
        var t = TOOL_MAP[id];
        if (t.key && t.key.toLowerCase() === e.key.toLowerCase()) {
          e.preventDefault();
          activateTool(t.id);
          break;
        }
      }
    }
  }

  function bindEvents() {
    if (STATE.refs.toolbar && !STATE.refs.toolbar._waBound) {
      STATE.refs.toolbar.addEventListener('click', handleToolbarClick);
      STATE.refs.toolbar.addEventListener('mouseover', handleToolbarMouseOver);
      STATE.refs.toolbar._waBound = true;
    }
    if (STATE.refs.props && !STATE.refs.props._waBound) {
      STATE.refs.props.addEventListener('click', handlePropsClick);
      STATE.refs.props.addEventListener('input', handlePropsInput);
      STATE.refs.props.addEventListener('change', handlePropsInput);
      STATE.refs.props._waBound = true;
    }
    if (!STATE.docClickBound) {
      document.addEventListener('click', handleDocClick, true);
      STATE.docClickBound = true;
    }
    if (!STATE.keyHandlerBound) {
      document.addEventListener('keydown', handleKeydown);
      STATE.keyHandlerBound = true;
    }
  }

  function injectToolbar() {
    var container = document.getElementById('sc-chart-container');
    if (!container) return false;
    STATE.refs.container = container;

    if (!document.getElementById('wa-drawing-toolbar')) {
      var toolbar = document.createElement('div');
      toolbar.id = 'wa-drawing-toolbar';
      toolbar.innerHTML = buildToolbarHTML();
      container.appendChild(toolbar);
    }
    if (!document.getElementById('wa-drawing-props')) {
      var wrap = document.createElement('div');
      wrap.innerHTML = buildPropsHTML();
      if (wrap.firstElementChild) container.appendChild(wrap.firstElementChild);
    }

    cacheRefs();
    bindEvents();
    syncProps();
    showProps(false);
    updateBadge();
    return true;
  }

  function setupObservers() {
    var root = document.getElementById('super-chart-overlay') || document.body;
    if (!root) return;
    if (STATE.observer) STATE.observer.disconnect();
    STATE.observer = new MutationObserver(function () {
      var c = document.getElementById('sc-chart-container');
      if (!c) return;
      if (!document.getElementById('wa-drawing-toolbar') || !document.getElementById('wa-drawing-props')) {
        injectToolbar();
      }
      cacheRefs();
      syncFromChart();
    });
    STATE.observer.observe(root, { childList: true, subtree: true });
  }

  function wrapOpenProChart() {
    var fn = global.openProChart;
    if (typeof fn !== 'function' || fn.__waDrawingWrapped) return;
    var wrapped = function () {
      var out;
      try { out = fn.apply(this, arguments); } finally {
        setTimeout(function () { WaveDrawingAPI.reinject(); syncFromChart(); }, 450);
      }
      return out;
    };
    wrapped.__waDrawingWrapped = true;
    wrapped.__waDrawingOriginal = fn;
    global.openProChart = wrapped;
  }

  var WaveDrawingAPI = {
    version: WD_VERSION,

    init: function () {
      injectCSS();
      loadSettings();
      injectToolbar();
      setupObservers();
      wrapOpenProChart();
      if (STATE.openWrapTimer) clearInterval(STATE.openWrapTimer);
      STATE.openWrapTimer = setInterval(wrapOpenProChart, 1200);
      if (STATE.syncTimer) clearInterval(STATE.syncTimer);
      STATE.syncTimer = setInterval(syncFromChart, 1500);
      STATE.initialized = true;
      syncProps();
      updateBadge();
      activateTool('pointer');
    },

    reinject: function () {
      var tb = document.getElementById('wa-drawing-toolbar');
      var pb = document.getElementById('wa-drawing-props');
      if (tb && tb.parentNode) tb.parentNode.removeChild(tb);
      if (pb && pb.parentNode) pb.parentNode.removeChild(pb);
      injectToolbar();
      activateTool(STATE.activeTool || 'pointer');
    },

    groupClick: function (event, groupId) {
      if (event && event.stopPropagation) event.stopPropagation();
      var group = null;
      for (var i = 0; i < TOOL_GROUPS.length; i++) {
        if (TOOL_GROUPS[i].id === groupId) { group = TOOL_GROUPS[i]; break; }
      }
      if (!group) return;
      if (group.tools.length === 1) {
        closeFlyouts();
        activateTool(group.tools[0].id);
        return;
      }
      var fly = document.getElementById('wa-flyout-' + groupId);
      if (fly && fly.classList.contains('open')) closeFlyouts();
      else openFlyout(groupId);
    },

    groupHover: function (event, groupId) {
      if (STATE.flyoutOpenId && STATE.flyoutOpenId !== groupId) openFlyout(groupId);
    },

    toolClick: function (toolId, event) {
      if (event && event.stopPropagation) event.stopPropagation();
      closeFlyouts();
      activateTool(toolId);
    },

    cancelDraw: function () {
      var chart = safeGetChart();
      if (chart && STATE.pendingOverlayId && typeof chart.removeOverlay === 'function') {
        try { chart.removeOverlay({ id: STATE.pendingOverlayId }); } catch (e) {}
      }
      STATE.pendingOverlayId = null;
      STATE.isDrawing = false;
      if (STATE.refs.cancelBtn) STATE.refs.cancelBtn.style.display = 'none';
      activateTool('pointer');
    },

    undo: function () {
      var chart = safeGetChart();
      if (!chart) return;
      if (typeof chart.undoOverlay === 'function') {
        try { chart.undoOverlay(); syncFromChart(); return; } catch (e) {}
      }
      var lastId = STATE.historyStack.pop();
      if (!lastId) return;
      STATE.undoStack.push(lastId);
      if (typeof chart.removeOverlay === 'function') {
        try { chart.removeOverlay({ id: lastId }); } catch (e) {}
      }
      syncFromChart();
    },

    redo: function () {
      var chart = safeGetChart();
      if (!chart) return;
      if (typeof chart.redoOverlay === 'function') {
        try { chart.redoOverlay(); syncFromChart(); return; } catch (e) {}
      }
    },

    toggleVisibility: function () {
      var chart = safeGetChart();
      if (!chart || typeof chart.overrideOverlay !== 'function') return;
      STATE.allVisible = !STATE.allVisible;
      try { chart.overrideOverlay({ visible: STATE.allVisible }); } catch (e) {}
      if (STATE.refs.visBtn) {
        var icon = STATE.refs.visBtn.querySelector('.wa-dt-icon');
        var tip = STATE.refs.visBtn.querySelector('.wa-dt-tip');
        if (icon) icon.textContent = STATE.allVisible ? 'VIS' : 'HID';
        if (tip) tip.textContent = STATE.allVisible ? 'Hide/Show Drawings' : 'Show All Drawings';
      }
    },

    deleteAll: function () {
      var chart = safeGetChart();
      if (!chart || typeof chart.removeOverlay !== 'function') return;
      if (!global.confirm('Delete all drawings from the chart?')) return;
      try { chart.removeOverlay(); } catch (e) {}
      STATE.historyStack = [];
      STATE.undoStack = [];
      STATE.overlayIdSet = {};
      STATE.pendingOverlayId = null;
      STATE.drawCount = 0;
      updateBadge();
      if (typeof global.applyFishFilter === 'function') {
        setTimeout(function () { try { global.applyFishFilter(); } catch (e) {} }, 100);
      }
    },

    applyAll: function () {
      var chart = safeGetChart();
      if (!chart || typeof chart.overrideOverlay !== 'function') return;
      var overlays = [];
      if (typeof chart.getOverlays === 'function') {
        try { overlays = chart.getOverlays() || []; } catch (e) {}
      }
      var styles = getOverlayStyles({ isShape: true });
      if (overlays.length > 0) {
        for (var i = 0; i < overlays.length; i++) {
          var ov = overlays[i];
          if (!ov || !ov.id) continue;
          if (String(ov.id).indexOf(OVERLAY_ID_PREFIX) !== 0) continue;
          try { chart.overrideOverlay({ id: ov.id, styles: styles }); } catch (e) {}
        }
      } else {
        try { chart.overrideOverlay({ styles: styles }); } catch (e) {}
      }
    },

    setColor: function (color) {
      STATE.color = color || '#00F0FF';
      STATE.fillColor = rgbaFromHex(STATE.color, 0.12);
      syncProps();
      saveSettings();
    },

    onStrokeColor: function (val) {
      STATE.color = val || STATE.color;
      if (STATE.refs.strokeSwatch) STATE.refs.strokeSwatch.style.background = STATE.color;
      saveSettings();
    },

    onFillColor: function (val) {
      STATE.fillColor = rgbaFromHex(val || STATE.color, 0.15);
      if (STATE.refs.fillSwatch) STATE.refs.fillSwatch.style.background = STATE.fillColor;
      saveSettings();
    },

    onLineSize: function (val) {
      STATE.lineSize = parseInt(val, 10) || 2;
      saveSettings();
    },

    onLineStyle: function (val) {
      STATE.lineStyle = val || 'solid';
      saveSettings();
    },

    getState: function () {
      return {
        activeTool: STATE.activeTool,
        color: STATE.color,
        fillColor: STATE.fillColor,
        lineSize: STATE.lineSize,
        lineStyle: STATE.lineStyle,
        textSize: STATE.textSize,
        allVisible: STATE.allVisible,
        drawCount: STATE.drawCount,
        isDrawing: STATE.isDrawing,
        pendingOverlayId: STATE.pendingOverlayId,
        idCounter: STATE.idCounter,
        historyStack: STATE.historyStack.slice(),
        flyoutOpenId: STATE.flyoutOpenId,
        initialized: STATE.initialized
      };
    },

    getTools: function () { return TOOL_GROUPS; }
  };

  WaveDrawingAPI.toggleAll = WaveDrawingAPI.toggleVisibility;
  WaveDrawingAPI.removeAll = WaveDrawingAPI.deleteAll;

  global.WaveDrawingAPI = WaveDrawingAPI;

  function autoInit() {
    if (!global.WaveDrawingAPI) return;
    global.WaveDrawingAPI.init();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(autoInit, 350); });
  } else {
    setTimeout(autoInit, 350);
  }
})(window);