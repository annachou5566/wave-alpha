// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026 (V9 - FLOATING PRO)
// Floating UI | Draggable | Zero DOM Destruction | Full Toolset
// ==========================================

(function (global) {
  'use strict';

  let currentSelectedOverlay = null;

  // 1. CẤU HÌNH STYLE MẶC ĐỊNH
  let globalStyles = {
    lineColor: '#00F0FF',
    fillColor: 'rgba(0, 240, 255, 0.15)',
    lineWidth: 2,
    lineStyle: 'solid',
    textInput: 'Wave Alpha'
  };

  // ======================================================
  // 2. ĐĂNG KÝ THUẬT TOÁN (Sóng Elliott, Harmonic, Text...)
  // ======================================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc || kc.__wa_extensions_registered) return;
    kc.__wa_extensions_registered = true;

    function createWave(name, totalStep, labels) {
      return {
        name: name, totalStep: totalStep, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          labels.forEach((l, i) => {
            if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 15, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true });
          });
          return figs;
        }
      };
    }

    var extensions = [
      createWave('waveElliott', 6, ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)']), 
      createWave('waveABC', 4, ['(0)', '(A)', '(B)', '(C)']),                   
      createWave('waveTriangle', 6, ['(0)', '(A)', '(B)', '(C)', '(D)', '(E)']),
      createWave('waveWXY', 4, ['(0)', '(W)', '(X)', '(Y)']),                   
      
      {
        name: 'xabcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length >= 3) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2]] }, styles: { style: 'fill' } });
          if (c.length >= 5) figs.push({ type: 'polygon', attrs: { coordinates: [c[2], c[3], c[4]] }, styles: { style: 'fill' } });
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          ['X', 'A', 'B', 'C', 'D'].forEach((l, i) => { if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 10, text: l, align: 'center' }, ignoreEvent: true }); });
          return figs;
        }
      },
      {
        name: 'abcd', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length >= 3) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2]] }, styles: { style: 'fill' } });
          if (c.length >= 4) figs.push({ type: 'polygon', attrs: { coordinates: [c[1], c[2], c[3]] }, styles: { style: 'fill' } });
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          ['A', 'B', 'C', 'D'].forEach((l, i) => { if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 10, text: l, align: 'center' }, ignoreEvent: true }); });
          return figs;
        }
      },
      {
        name: 'headAndShoulders', totalStep: 7, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length >= 4) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2], c[3]] }, styles: { style: 'fill' } });
          if (c.length >= 7) figs.push({ type: 'polygon', attrs: { coordinates: [c[3], c[4], c[5], c[6]] }, styles: { style: 'fill' } });
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          ['Left', 'Head', 'Right'].forEach((l, i) => { 
            let idx = (i===0)?1 : (i===1)?3 : 5;
            if (c[idx]) figs.push({ type: 'text', attrs: { x: c[idx].x, y: c[idx].y - 15, text: l, align: 'center' }, ignoreEvent: true }); 
          });
          return figs;
        }
      },
      {
        name: 'customText', totalStep: 1, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          if (ref.overlay.extendData === undefined || ref.overlay.extendData === null) ref.overlay.extendData = window.__WA_TEMP_TEXT__ || 'Văn bản...';
          return [{ type: 'text', attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y, text: ref.overlay.extendData, baseline: 'bottom', size: 16, weight: 'bold' } }];
        }
      },
      {
        name: 'fibExtension', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: [c[0], c[1]] } });
          if (c.length > 2) figs.push({ type: 'line', attrs: { coordinates: [c[1], c[2]] }, styles: { style: 'dashed' } });
          if (c.length === 3) {
            var diffY = c[0].y - c[1].y, startY = c[2].y;
            [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236].forEach(l => {
              var y = startY - (diffY * l);
              figs.push({ type: 'line', attrs: { coordinates: [{ x: c[2].x, y: y }, { x: ref.bounding.width, y: y }] } });
              figs.push({ type: 'text', attrs: { x: c[2].x + 5, y: y - 5, text: 'Fib ' + l, baseline: 'bottom' }, ignoreEvent: true });
            });
          }
          return figs;
        }
      }
    ];

    extensions.forEach(e => { try { kc.registerOverlay(e); } catch(err){} });
  }

  // ======================================================
  // 3. ICON MINIMALIST VÀ MENU DATA
  // ======================================================
  const ICONS = {
    drag: '<svg viewBox="0 0 24 24" fill="none" stroke="#5e6673" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
    pointer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>',
    lines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/></svg>',
    fibonacci: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 7 4 13 20 18 8 22 12"/></svg>',
    shapes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-1.5-1.5-1.5-3.5 0-5l7-7c1.5-1.5 3.5-1.5 5 0l5 5c1.5 1.5 1.5 3.5 0 5l-7 7z"/><path d="M15 9l-4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };

  const MENU_MAP = [
    { id: 'lines', icon: ICONS.lines, tools: [ { id: 'segment', name: 'Đường xu hướng (Trendline)' }, { id: 'rayLine', name: 'Tia (Ray)' }, { id: 'straightLine', name: 'Đường mở rộng' }, { id: 'horizontalStraightLine', name: 'Đường ngang' }, { id: 'verticalStraightLine', name: 'Đường dọc' } ]},
    { id: 'fibonacci', icon: ICONS.fibonacci, tools: [ { id: 'fibonacciLine', name: 'Fibonacci Retracement' }, { id: 'fibExtension', name: 'Fibonacci Extension' }, { id: 'fibonacciCircle', name: 'Vòng tròn Fibonacci' } ]},
    { id: 'waves', icon: ICONS.waves, tools: [ { id: 'waveElliott', name: 'Sóng Elliott (12345)' }, { id: 'waveABC', name: 'Sóng điều chỉnh (ABC)' }, { id: 'waveTriangle', name: 'Sóng tam giác (ABCDE)' }, { id: 'waveWXY', name: 'Sóng WXY' }, { id: 'xabcd', name: 'Mô hình XABCD' }, { id: 'abcd', name: 'Mô hình ABCD' }, { id: 'headAndShoulders', name: 'Vai Đầu Vai' } ]},
    { id: 'shapes', icon: ICONS.shapes, tools: [ { id: 'rect', name: 'Hình chữ nhật' }, { id: 'triangle', name: 'Tam giác' }, { id: 'circle', name: 'Hình tròn' } ]}
  ];

  // ======================================================
  // 4. CSS INJECTION (FLOATING & DRAGGABLE)
  // ======================================================
  function injectCSS() {
    if (document.getElementById('wa-floating-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-floating-css';
    style.textContent = `
      #sc-chart-container { position: relative !important; overflow: hidden !important; }
      
      /* THANH CÔNG CỤ NỔI (FLOATING TOOLBAR) */
      .wa-floating-sidebar { 
          position: absolute; top: 60px; left: 20px; z-index: 9999;
          width: 46px; background-color: rgba(22, 26, 30, 0.95); 
          border: 1px solid #2b3139; border-radius: 8px; 
          display: flex; flex-direction: column; align-items: center; 
          box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(8px);
          user-select: none;
      }
      
      /* Tay cầm để kéo thả */
      .wa-drag-grip {
          width: 100%; height: 24px; display: flex; align-items: center; justify-content: center;
          cursor: grab; border-bottom: 1px solid #2b3139; opacity: 0.7;
      }
      .wa-drag-grip:active { cursor: grabbing; }
      .wa-drag-grip svg { width: 16px; height: 16px; }

      .wa-tools-wrapper { padding: 8px 0; width: 100%; display: flex; flex-direction: column; align-items: center;}
      .wa-group { position: relative; width: 100%; display: flex; justify-content: center; margin-bottom: 6px; }
      .wa-btn { width: 34px; height: 34px; border-radius: 6px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; position: relative; }
      .wa-btn svg { width: 20px; height: 20px; }
      .wa-btn:hover { background-color: #2b3139; color: #EAECEF; }
      .wa-btn.active { background-color: rgba(0, 240, 255, 0.15); color: #00F0FF; }
      .wa-has-menu::after { content: ''; position: absolute; right: 3px; bottom: 4px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); }
      
      /* Menu Hover xổ ngang */
      .wa-menu { position: absolute; left: 48px; top: 0; background-color: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); display: none; flex-direction: column; width: 200px; padding: 6px 0; z-index: 10000; }
      .wa-group:hover .wa-menu { display: flex; }
      .wa-menu-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; font-weight: 500; font-family: sans-serif; cursor: pointer; transition: 0.15s; }
      .wa-menu-item:hover { background-color: #2b3139; color: #00F0FF; }
      .wa-menu-item.active { color: #00F0FF; }
      .wa-divider { width: 24px; height: 1px; background-color: #2b3139; margin: 6px 0; }
      
      .wa-drawing-mode canvas { cursor: crosshair !important; }

      /* THANH TÙY BIẾN NỔI KHI CHỌN HÌNH (FLOATING PROPERTIES) */
      .wa-floating-props {
          position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
          background: rgba(18, 20, 24, 0.95); border: 1px solid #2b3139; border-radius: 8px;
          padding: 8px 14px; display: none; align-items: center; gap: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.8); backdrop-filter: blur(12px); z-index: 10001;
      }
      .wa-floating-props.show { display: flex; }
      .wa-prop-item { display: flex; align-items: center; gap: 8px; }
      .wa-prop-color { width: 24px; height: 24px; border-radius: 6px; border: 1px solid #2b3139; cursor: pointer; padding: 0; background: transparent;}
      .wa-prop-color::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-prop-color::-webkit-color-swatch { border: none; border-radius: 4px; }
      .wa-prop-select { background: #0B0E11; color: #EAECEF; border: 1px solid #2b3139; padding: 6px 8px; border-radius: 6px; font-size: 13px; outline: none; cursor: pointer; }
      .wa-prop-input { background: #0B0E11; color: #00F0FF; border: 1px solid #2b3139; padding: 6px 12px; border-radius: 6px; font-size: 14px; outline: none; width: 140px; font-weight: bold;}
      .wa-prop-input:focus { border-color: #00F0FF; }
      .wa-prop-btn { background: transparent; border: none; color: #848E9C; cursor: pointer; display:flex; align-items:center; justify-content:center; transition: 0.2s; width: 28px; height: 28px; border-radius: 6px;}
      .wa-prop-btn svg { width: 18px; height: 18px; }
      .wa-prop-btn:hover { background: #2b3139; color: #F6465D; }
    `;
    document.head.appendChild(style);
  }

  // ======================================================
  // 5. GIAO DIỆN HTML VÀ LOGIC KÉO THẢ (DRAG)
  // ======================================================
  function buildHTML() {
    let html = `<div class="wa-drag-grip">${ICONS.drag}</div><div class="wa-tools-wrapper">`;
    html += '<div class="wa-group"><button class="wa-btn active" data-tool="pointer" title="Con trỏ chuột">' + ICONS.pointer + '</button></div>';
    
    MENU_MAP.forEach(g => {
      html += `<div class="wa-group"><button class="wa-btn wa-has-menu">${g.icon}</button><div class="wa-menu">`;
      g.tools.forEach(t => { html += `<div class="wa-menu-item" data-tool="${t.id}">${t.name}</div>`; });
      html += `</div></div>`;
    });
    
    html += `<div class="wa-group"><button class="wa-btn" data-tool="customText" title="Viết chữ (Text)">${ICONS.text}</button></div>`;
    html += `<div class="wa-divider"></div>`;
    html += `<div class="wa-group"><button class="wa-btn" data-tool="eraser" title="Cục tẩy (Click vào hình để xóa)">${ICONS.eraser}</button></div>`;
    html += `<div class="wa-group"><button class="wa-btn" data-tool="trash" title="Xóa toàn bộ bản vẽ">${ICONS.trash}</button></div>`;
    html += `</div>`;
    return html;
  }

  function buildFloatingPropsHTML() {
    return `
      <div class="wa-prop-item" title="Màu viền & chữ"><input type="color" id="wa-prop-line-color" class="wa-prop-color" value="#00F0FF"></div>
      <div class="wa-prop-item" title="Màu nền"><input type="color" id="wa-prop-fill-color" class="wa-prop-color" value="#00F0FF"></div>
      <div class="wa-prop-item" title="Độ dày nét">
          <select id="wa-prop-line-size" class="wa-prop-select"><option value="1">1px</option><option value="2" selected>2px</option><option value="3">3px</option></select>
      </div>
      <div class="wa-prop-item" title="Kiểu nét">
          <select id="wa-prop-line-style" class="wa-prop-select"><option value="solid">▬▬</option><option value="dashed">- - -</option><option value="dotted">. . .</option></select>
      </div>
      <div class="wa-prop-item" id="wa-prop-text-wrapper" style="display:none;">
          <input type="text" id="wa-prop-text-input" class="wa-prop-input" placeholder="Nhập văn bản...">
      </div>
      <div class="wa-divider" style="width:1px; height:20px; margin:0; background:#2b3139;"></div>
      <button class="wa-prop-btn" id="wa-prop-delete" title="Xóa hình này (Phím Delete)">${ICONS.trash}</button>
    `;
  }

  // Hàm kích hoạt kéo thả (Drag and Drop)
  function makeDraggable(element, handle) {
    let isDragging = false, offsetX = 0, offsetY = 0;
    handle.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - element.offsetLeft;
      offsetY = e.clientY - element.offsetTop;
      element.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      element.style.left = (e.clientX - offsetX) + 'px';
      element.style.top = (e.clientY - offsetY) + 'px';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  // ======================================================
  // 6. XỬ LÝ LÕI SỰ KIỆN: VẼ, SỬA, XÓA, PHÍM TẮT
  // ======================================================
  function bindEvents(sidebar, propsBar) {
    let isEraserMode = false;

    // Kéo thả thanh Toolbar
    makeDraggable(sidebar, sidebar.querySelector('.wa-drag-grip'));

    // --- CLICK CÔNG CỤ TRÊN SIDEBAR ---
    sidebar.addEventListener('click', function(e) {
      let targetBtn = e.target.closest('.wa-btn'), targetMenuItem = e.target.closest('.wa-menu-item'), toolId = null;
      if (targetMenuItem) {
        toolId = targetMenuItem.getAttribute('data-tool');
        document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
        targetMenuItem.closest('.wa-group').querySelector('.wa-btn').classList.add('active');
        targetMenuItem.classList.add('active');
      } else if (targetBtn) {
        toolId = targetBtn.getAttribute('data-tool');
        if(toolId !== 'trash') {
            document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
            targetBtn.classList.add('active');
        }
      }
      if (toolId) executeTool(toolId);
    });

    function executeTool(toolId) {
      if (!global.tvChart) return;
      var c = document.getElementById('sc-chart-container');
      
      try { global.tvChart.cancelDrawing(); } catch(e) {}
      hideFloatingProps(); 

      if (toolId === 'trash') {
        if (confirm("Thao tác này sẽ xóa toàn bộ hình vẽ. Bạn có chắc chắn?")) {
          global.tvChart.removeOverlay();
          executeTool('pointer');
        }
        return;
      }

      if (toolId === 'pointer') { c.classList.remove('wa-drawing-mode'); isEraserMode = false; return; }
      if (toolId === 'eraser') { c.classList.remove('wa-drawing-mode'); isEraserMode = true; return; }

      c.classList.add('wa-drawing-mode');
      isEraserMode = false;

      if (toolId === 'customText') window.__WA_TEMP_TEXT__ = "Văn bản...";

      try {
        global.tvChart.createOverlay({
          name: toolId, lock: false,
          extendData: globalStyles.textInput,
          styles: { 
            line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle }, 
            text: { color: globalStyles.lineColor, size: 16, weight: 'bold' }, 
            polygon: { color: hexToRgba(globalStyles.fillColor, 0.15), style: 'fill', borderColor: globalStyles.lineColor } 
          }
        });
      } catch (err) {}
    }

    // --- BẮT SỰ KIỆN KLINECHARTS AN TOÀN ---
    let waitChart = setInterval(() => {
        if (global.tvChart && typeof global.tvChart.subscribeAction === 'function') {
            if (!global.tvChart.__wa_event_bound) {
                global.tvChart.__wa_event_bound = true;
                
                global.tvChart.subscribeAction('onDrawEnd', function() {
                  executeTool('pointer'); 
                  document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
                  document.querySelector('[data-tool="pointer"]').classList.add('active');
                });

                global.tvChart.subscribeAction('onOverlayClick', function(params) {
                  if (!params || !params.overlay) { hideFloatingProps(); return; }
                  if (isEraserMode) {
                    global.tvChart.removeOverlay({ id: params.overlay.id });
                    return;
                  }
                  currentSelectedOverlay = params.overlay;
                  showFloatingProps();
                });
            }
            clearInterval(waitChart);
        }
    }, 500);

    // --- PHÍM TẮT XÓA HÌNH VẼ ---
    if (!global.__wa_keyboard_bound) {
        global.__wa_keyboard_bound = true;
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (currentSelectedOverlay && global.tvChart) {
                    global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
                    hideFloatingProps();
                }
            }
        });
    }

    // --- THANH TÙY BIẾN THỜI GIAN THỰC ---
    const elLineColor = document.getElementById('wa-prop-line-color');
    const elFillColor = document.getElementById('wa-prop-fill-color');
    const elLineSize = document.getElementById('wa-prop-line-size');
    const elLineStyle = document.getElementById('wa-prop-line-style');
    const elTextInput = document.getElementById('wa-prop-text-input');
    const elTextWrapper = document.getElementById('wa-prop-text-wrapper');

    function hexToRgba(hex, alpha) {
        let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function updateSelectedOverlay() {
        if (!currentSelectedOverlay || !global.tvChart) return;
        globalStyles.lineColor = elLineColor.value;
        globalStyles.fillColor = elFillColor.value;
        globalStyles.lineWidth = parseInt(elLineSize.value);
        globalStyles.lineStyle = elLineStyle.value;
        if(currentSelectedOverlay.name === 'customText') globalStyles.textInput = elTextInput.value;

        global.tvChart.overrideOverlay({
            id: currentSelectedOverlay.id,
            extendData: globalStyles.textInput,
            styles: {
                line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle },
                text: { color: globalStyles.lineColor },
                polygon: { color: hexToRgba(globalStyles.fillColor, 0.15), borderColor: globalStyles.lineColor }
            }
        });
    }

    elLineColor.addEventListener('input', updateSelectedOverlay);
    elFillColor.addEventListener('input', updateSelectedOverlay);
    elLineSize.addEventListener('change', updateSelectedOverlay);
    elLineStyle.addEventListener('change', updateSelectedOverlay);
    elTextInput.addEventListener('input', updateSelectedOverlay);

    document.getElementById('wa-prop-delete').addEventListener('click', () => {
        if (currentSelectedOverlay && global.tvChart) {
            global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
            hideFloatingProps();
        }
    });

    function showFloatingProps() {
        if (!currentSelectedOverlay) return;
        propsBar.classList.add('show');
        if (currentSelectedOverlay.name === 'customText') {
            elTextWrapper.style.display = 'flex';
            elTextInput.value = currentSelectedOverlay.extendData || '';
        } else {
            elTextWrapper.style.display = 'none';
        }
    }

    function hideFloatingProps() {
        propsBar.classList.remove('show');
        currentSelectedOverlay = null;
    }
  }

  // ======================================================
  // 7. AUTO-INJECTOR: MẮT THẦN (CHỈ BƠM UI NỔI, KHÔNG ĐỤNG DOM CHART)
  // ======================================================
  function autoInjectSystem() {
    if (global.__wa_observer_started) return;
    global.__wa_observer_started = true;

    var observer = new MutationObserver(function() {
        var container = document.getElementById('sc-chart-container');
        if (!container) return;

        var hasCanvas = container.querySelector('canvas');
        var hasSidebar = container.querySelector('.wa-floating-sidebar');

        // Bơm thanh công cụ nổi đè lên khi Chart vừa xuất hiện
        if (hasCanvas && !hasSidebar) {
            injectCSS();
            registerProExtensions();

            // Thanh công cụ chính nổi (Floating)
            var sidebar = document.createElement('div');
            sidebar.className = 'wa-floating-sidebar';
            sidebar.innerHTML = buildHTML();
            container.appendChild(sidebar); // Append thẳng vào cuối, nằm đè lên mọi thứ vì absolute

            // Thanh tuỳ biến nổi
            var propsBar = document.createElement('div');
            propsBar.className = 'wa-floating-props';
            propsBar.id = 'wa-props-bar';
            propsBar.innerHTML = buildFloatingPropsHTML();
            container.appendChild(propsBar);

            bindEvents(sidebar, propsBar);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInjectSystem);
  else autoInjectSystem();

})(window);