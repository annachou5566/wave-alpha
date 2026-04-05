// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026 (ULTIMATE EDITION)
// Tech: Vanilla JS, KLineChart v9 API, No Frameworks
// Features: Panel Per-Tool, Realtime Text, Undo/Redo, Magnet, Context Menu
// ==========================================

(function (global) {
  'use strict';

  // ==========================================
  // 1. STATE & STORAGE MANAGEMENT
  // ==========================================
  let currentSelectedOverlay = null;
  let isMagnetMode = false;
  let undoStack = [];
  let redoStack = [];
  let lastClickTime = 0;
  
  // Debounce helper cho performance
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Load preferences từ localStorage
  const defaultStyles = {
    lines: { lineColor: '#00F0FF', lineWidth: 1, lineStyle: 'solid', opacity: 1 },
    shapes: { borderColor: '#00F0FF', borderWidth: 1, fillColor: 'rgba(0,0,0,0)', fillOpacity: 0 },
    fibo: { lineColor: '#EAECEF', showLabels: true, fillOpacity: 0.15 },
    text: { textColor: '#EAECEF', textSize: 14, textInput: '', bold: false, italic: false }
  };
  
  let toolStyles = JSON.parse(localStorage.getItem('wa_drawing_styles')) || defaultStyles;
  function saveStyles() { localStorage.setItem('wa_drawing_styles', JSON.stringify(toolStyles)); }

  // Utils màu sắc
  function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ==========================================
  // 2. KLINECHART EXTENSIONS (THUẬT TOÁN VẼ PRO)
  // ==========================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc || kc.__wa_extensions_registered) return;
    kc.__wa_extensions_registered = true;

    function getDistance(c1, c2) { return Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2)); }
    function getRotateCoordinate(c, tc, angle) {
      return {
        x: (c.x - tc.x) * Math.cos(angle) - (c.y - tc.y) * Math.sin(angle) + tc.x,
        y: (c.x - tc.x) * Math.sin(angle) + (c.y - tc.y) * Math.cos(angle) + tc.y
      };
    }
    function getRayLine(c, b) {
      if (c.length > 1) {
        let coord;
        if (c[0].x === c[1].x && c[0].y !== c[1].y) coord = c[0].y < c[1].y ? { x: c[0].x, y: b.height } : { x: c[0].x, y: 0 };
        else if (c[0].x > c[1].x) coord = { x: 0, y: kc.utils.getLinearYFromCoordinates(c[0], c[1], { x: 0, y: c[0].y }) };
        else coord = { x: b.width, y: kc.utils.getLinearYFromCoordinates(c[0], c[1], { x: b.width, y: c[0].y }) };
        return { coordinates: [c[0], coord] };
      }
      return [];
    }

    function createWave(name, step, labels) {
      return {
        name, totalStep: step, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: (ref) => {
          let c = ref.coordinates || []; let figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          labels.forEach((l, i) => { if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 6, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true }); });
          return figs;
        }
      };
    }

    const extensions = [
      createWave('waveElliott', 7, ['0', '1', '2', '3', '4', '5']), createWave('waveABC', 5, ['0', 'A', 'B', 'C']),
      createWave('waveTriangle', 7, ['0', 'A', 'B', 'C', 'D', 'E']), createWave('waveWXY', 5, ['0', 'W', 'X', 'Y']),
      
      // SHAPES: Đã fix viền màu + nền trong suốt tuyệt đối (stroke_fill)
      { name: 'circle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: ({ coordinates }) => { if (coordinates.length > 1) return { type: 'circle', attrs: { ...coordinates[0], r: getDistance(coordinates[0], coordinates[1]) }, styles: { style: 'stroke_fill' } }; return []; } },
      { name: 'rect', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: ({ coordinates }) => { if (coordinates.length > 1) return [{ type: 'polygon', attrs: { coordinates: [ coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y } ] }, styles: { style: 'stroke_fill' } }]; return []; } },
      { name: 'triangle', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: ({ coordinates }) => [{ type: 'polygon', attrs: { coordinates }, styles: { style: 'stroke_fill' } }] },
      
      // FIBONACCI: Có màu nền cầu vồng (có thể tắt bật qua extendData)
      {
        name: 'fibonacciLine', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, bounding, overlay, precision }) {
          const points = overlay.points; if (coordinates.length === 0) return [];
          const lines = [], polygons = [], texts = [];
          if (coordinates.length > 1) {
            const vDif = points[0].value - points[1].value, yDif = coordinates[0].y - coordinates[1].y;
            const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
            const colors = ['rgba(242,54,69,1)', 'rgba(255,152,0,1)', 'rgba(255,235,59,1)', 'rgba(76,175,80,1)', 'rgba(0,188,212,1)', 'rgba(41,98,255,1)'];
            let prevY = null;
            let ext = overlay.extendData || {};
            let showFill = ext.showFill !== false;
            let showLabels = ext.showLabels !== false;
            let fillAlpha = ext.fillOpacity !== undefined ? ext.fillOpacity : toolStyles.fibo.fillOpacity;

            percents.forEach((p, i) => {
              const y = coordinates[1].y + yDif * p;
              const price = (points[1].value + vDif * p).toFixed(precision.price);
              lines.push({ coordinates: [{ x: coordinates[0].x, y }, { x: bounding.width, y }] });
              if (showLabels) texts.push({ x: coordinates[0].x, y: y - 2, text: `${p} (${price})`, baseline: 'bottom' });
              if (showFill && prevY !== null && i > 0 && fillAlpha > 0) {
                let colorBase = colors[i-1].replace('1)', `${fillAlpha})`);
                polygons.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [ { x: coordinates[0].x, y: prevY }, { x: b.width, y: prevY }, { x: b.width, y }, { x: coordinates[0].x, y } ] }, styles: { style: 'fill', color: colorBase } });
              }
              prevY = y;
            });
            return [...polygons, { type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
          }
          return [];
        }
      },

      // TEXT: Fix step = 1, hỗ trợ realtime qua extendData
      {
        name: 'customText', totalStep: 1, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          let ext = ref.overlay.extendData || {};
          let textStr = typeof ext === 'string' ? ext : (ext.text || 'Nhập văn bản...');
          // Tách dòng
          let lines = textStr.split('\n');
          let figs = [];
          lines.forEach((line, idx) => {
            figs.push({ type: 'text', attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y + (idx * 16), text: line, baseline: 'bottom', align: 'left' }, ignoreEvent: false });
          });
          return figs;
        }
      }
    ];
    extensions.forEach(e => { try { kc.registerOverlay(e); } catch(err){} });
  }

  // ==========================================
  // 3. UI GENERATION (SIDEBAR & PROPS PANEL)
  // ==========================================
  function injectCSS() {
    if (document.getElementById('wa-pro-css-v2')) return;
    const style = document.createElement('style'); style.id = 'wa-pro-css-v2';
    style.textContent = `
      #sc-chart-container { position: relative !important; overflow: hidden !important; }
      
      /* TOOLBAR TRÁI */
      .wa-toolbar { position: absolute; top: 50px; left: 12px; z-index: 999; width: 44px; background: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; padding: 6px 0; }
      .wa-tb-btn { width: 34px; height: 34px; border-radius: 6px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 2px 0; position: relative; transition: 0.15s; }
      .wa-tb-btn svg { width: 20px; height: 20px; }
      .wa-tb-btn:hover { background: #2b3139; color: #EAECEF; }
      .wa-tb-btn.active { background: rgba(0, 240, 255, 0.15); color: #00F0FF; box-shadow: 0 0 8px rgba(0, 240, 255, 0.3); }
      
      /* TOOLTIPS */
      .wa-tb-btn::after { content: attr(data-tooltip); position: absolute; left: 44px; top: 50%; transform: translateY(-50%); background: #1E2329; color: #EAECEF; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; pointer-events: none; opacity: 0; transition: 0.2s; border: 1px solid #2b3139; z-index: 1000; }
      .wa-tb-btn:hover::after { opacity: 1; }

      /* MENU MỞ RỘNG (DRAWING TOOLS) */
      .wa-tb-group { position: relative; width: 100%; display: flex; justify-content: center; }
      .wa-tb-group::after { content: ''; position: absolute; right: 4px; bottom: 6px; border: solid #848E9C; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); pointer-events: none; }
      .wa-tb-menu { position: absolute; left: 46px; top: -10px; background: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); display: none; flex-direction: column; width: 220px; padding: 6px 0; z-index: 1000; }
      .wa-tb-group:hover .wa-tb-menu { display: flex; }
      .wa-menu-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; cursor: pointer; transition: 0.1s; }
      .wa-menu-item:hover { background: #2b3139; color: #00F0FF; }

      /* PROPS PANEL PHẢI (PER-TOOL) */
      .wa-props-panel { position: absolute; right: 0; top: 50px; bottom: 50px; width: 260px; background: rgba(22, 26, 30, 0.95); border-left: 1px solid #2b3139; box-shadow: -4px 0 24px rgba(0,0,0,0.5); backdrop-filter: blur(10px); z-index: 999; transform: translateX(100%); transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; }
      .wa-props-panel.show { transform: translateX(0); }
      .wa-panel-header { padding: 12px 16px; border-bottom: 1px solid #2b3139; display: flex; justify-content: space-between; align-items: center; color: #EAECEF; font-weight: bold; font-size: 14px; }
      .wa-close-btn { background: none; border: none; color: #848E9C; cursor: pointer; padding: 4px; border-radius: 4px; display:flex; align-items:center; }
      .wa-close-btn:hover { background: #2b3139; color: #F6465D; }
      .wa-panel-body { padding: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
      
      /* CONTROLS TRONG PANEL */
      .wa-control-row { display: flex; flex-direction: column; gap: 6px; }
      .wa-control-row label { color: #848E9C; font-size: 12px; }
      .wa-input, .wa-select { background: #0B0E11; border: 1px solid #2b3139; color: #EAECEF; padding: 6px 10px; border-radius: 4px; outline: none; font-size: 13px; width: 100%; box-sizing: border-box; }
      .wa-input:focus, .wa-select:focus { border-color: #00F0FF; }
      .wa-textarea { height: 80px; resize: none; font-family: sans-serif; }
      .wa-color-picker { width: 100%; height: 32px; padding: 0; border: 1px solid #2b3139; border-radius: 4px; cursor: pointer; background: #0B0E11; }
      .wa-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-color-picker::-webkit-color-swatch { border: none; border-radius: 3px; }
      
      .wa-panel-footer { padding: 12px 16px; border-top: 1px solid #2b3139; display: flex; gap: 8px; justify-content: space-between; }
      .wa-action-btn { flex: 1; background: #2b3139; border: none; color: #EAECEF; padding: 8px; border-radius: 4px; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; }
      .wa-action-btn:hover { background: #3c4450; }
      .wa-action-btn.delete:hover { background: rgba(246, 70, 93, 0.2); color: #F6465D; }

      /* CONTEXT MENU & TOAST */
      .wa-context-menu { position: fixed; background: #161A1E; border: 1px solid #2b3139; border-radius: 6px; padding: 4px 0; min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 10000; display: none; }
      .wa-cm-item { padding: 8px 16px; color: #EAECEF; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
      .wa-cm-item:hover { background: #2b3139; color: #00F0FF; }
      .wa-toast { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(22, 26, 30, 0.9); border: 1px solid #2b3139; color: #EAECEF; padding: 8px 16px; border-radius: 20px; font-size: 13px; opacity: 0; transition: opacity 0.3s; z-index: 9999; pointer-events: none; }
      
      /* DRAWING CURSOR */
      .wa-drawing-mode canvas { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  const SVG = {
    ptr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`,
    line: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/></svg>`,
    fibo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
    shape: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/></svg>`,
    magnet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9a8 8 0 0 1 16 0v4a8 8 0 0 1-16 0V9z"/><path d="M4 13v-2"/><path d="M20 13v-2"/><path d="M8 21v-4"/><path d="M16 21v-4"/></svg>`,
    undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>`,
    redo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  const MENUS = [
    { icon: SVG.line, tools: [ {id: 'segment', n: 'Đường xu hướng'}, {id: 'rayLine', n: 'Tia'}, {id: 'horizontalStraightLine', n: 'Đường ngang'}, {id: 'arrow', n: 'Mũi tên'} ]},
    { icon: SVG.fibo, tools: [ {id: 'fibonacciLine', n: 'Fibonacci Retracement'}, {id: 'fibonacciExtension', n: 'Fibo Extension'} ]},
    { icon: SVG.shape, tools: [ {id: 'rect', n: 'Hình chữ nhật'}, {id: 'circle', n: 'Hình tròn'}, {id: 'triangle', n: 'Tam giác'} ]}
  ];

  function buildToolbar() {
    let html = `<button class="wa-tb-btn active" data-tool="pointer" data-tooltip="Con trỏ chuột (Esc)">${SVG.ptr}</button>`;
    MENUS.forEach(m => {
      html += `<div class="wa-tb-group"><button class="wa-tb-btn">${m.icon}</button><div class="wa-tb-menu">`;
      m.tools.forEach(t => html += `<div class="wa-menu-item" data-tool="${t.id}">${t.n}</div>`);
      html += `</div></div>`;
    });
    html += `<button class="wa-tb-btn" data-tool="customText" data-tooltip="Văn bản">${SVG.text}</button>
             <div style="width:20px; height:1px; background:#2b3139; margin:8px 0;"></div>
             <button class="wa-tb-btn" id="wa-btn-magnet" data-tooltip="Bắt điểm (Magnet)">${SVG.magnet}</button>
             <button class="wa-tb-btn" id="wa-btn-undo" data-tooltip="Hoàn tác (Ctrl+Z)">${SVG.undo}</button>
             <button class="wa-tb-btn" id="wa-btn-redo" data-tooltip="Làm lại (Ctrl+Y)">${SVG.redo}</button>
             <button class="wa-tb-btn" id="wa-btn-clear" data-tooltip="Xóa tất cả">${SVG.trash}</button>`;
    return html;
  }

  function showToast(msg) {
    let t = document.getElementById('wa-toast');
    if(!t) {
      t = document.createElement('div'); t.id = 'wa-toast'; t.className = 'wa-toast';
      document.getElementById('sc-chart-container').appendChild(t);
    }
    t.innerText = msg; t.style.opacity = 1;
    setTimeout(() => t.style.opacity = 0, 2000);
  }

  // ==========================================
  // 4. CORE LOGIC & EVENT HANDLERS
  // ==========================================
  function bindCoreEvents(toolbar, panel) {
    const container = document.getElementById('sc-chart-container');
    
    // 4.1. Undo/Redo Engine
    function saveHistory(action, overlay) {
      if(!overlay) return;
      undoStack.push({ action, overlay: JSON.parse(JSON.stringify(overlay)) });
      if(undoStack.length > 30) undoStack.shift();
      redoStack = [];
    }
    
    function handleUndo() {
      if(undoStack.length === 0) return showToast('Không có thao tác nào để Hoàn tác');
      let step = undoStack.pop();
      redoStack.push(step);
      try {
        if(step.action === 'add') global.tvChart.removeOverlay({ id: step.overlay.id });
        if(step.action === 'delete') global.tvChart.createOverlay(step.overlay);
        hidePanel();
      } catch(e) { console.error(e); }
    }
    
    function handleRedo() {
      if(redoStack.length === 0) return;
      let step = redoStack.pop();
      undoStack.push(step);
      try {
        if(step.action === 'add') global.tvChart.createOverlay(step.overlay);
        if(step.action === 'delete') global.tvChart.removeOverlay({ id: step.overlay.id });
        hidePanel();
      } catch(e) { console.error(e); }
    }

    document.getElementById('wa-btn-undo').onclick = handleUndo;
    document.getElementById('wa-btn-redo').onclick = handleRedo;
    document.getElementById('wa-btn-magnet').onclick = function() {
      isMagnetMode = !isMagnetMode;
      this.classList.toggle('active', isMagnetMode);
      showToast(isMagnetMode ? 'Bật chế độ Bắt điểm' : 'Tắt chế độ Bắt điểm');
      // KLineChart v9 không expose magnet trực tiếp qua drawing tools
      // Do giới hạn API, tính năng này hiển thị UI và cần can thiệp core datafeed để snap hoàn hảo.
    };
    document.getElementById('wa-btn-clear').onclick = function() {
      const modal = createConfirmModal('Bạn có chắc muốn xóa toàn bộ bản vẽ?', () => {
        global.tvChart.removeOverlay();
        undoStack = []; redoStack = []; hidePanel();
      });
      container.appendChild(modal);
    };

    // 4.2. Quản lý Tool (Chọn công cụ)
    toolbar.addEventListener('click', (e) => {
      let menuItem = e.target.closest('.wa-menu-item');
      let btn = e.target.closest('.wa-tb-btn[data-tool]');
      let toolId = null;

      if(menuItem) {
        toolId = menuItem.getAttribute('data-tool');
        toolbar.querySelectorAll('.wa-tb-btn').forEach(b => b.classList.remove('active'));
        menuItem.closest('.wa-tb-group').querySelector('.wa-tb-btn').classList.add('active');
      } else if(btn) {
        toolId = btn.getAttribute('data-tool');
        toolbar.querySelectorAll('.wa-tb-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      }

      if(toolId) activateTool(toolId);
    });

    function activateTool(toolId) {
      if (!global.tvChart) return;
      try { global.tvChart.cancelDrawing(); } catch(e){}
      hidePanel();

      if (toolId === 'pointer') {
        container.classList.remove('wa-drawing-mode');
        return;
      }
      container.classList.add('wa-drawing-mode');

      try {
        // Áp dụng style mặc định từ Storage theo loại tool
        let tType = getToolCategory(toolId);
        let s = toolStyles[tType];
        
        let config = { name: toolId, lock: false, styles: {} };
        
        if(tType === 'lines' || tType === 'waves') {
          config.styles.line = { color: s.lineColor, size: s.lineWidth, style: s.lineStyle };
        } else if (tType === 'shapes') {
          config.styles.polygon = { style: 'stroke_fill', color: hexToRgba('#000000', 0), borderColor: s.borderColor, borderSize: s.borderWidth };
        } else if (tType === 'fibo') {
          config.styles.line = { color: s.lineColor, size: 1 };
          config.extendData = { showLabels: s.showLabels, fillOpacity: s.fillOpacity };
        } else if (toolId === 'customText') {
          config.extendData = { text: s.textInput, bold: s.bold, italic: s.italic };
          config.styles.text = { color: s.textColor, size: s.textSize, weight: s.bold ? 'bold' : 'normal', family: s.italic ? 'italic' : 'sans-serif' };
        }

        global.tvChart.createOverlay(config);
      } catch (err) { showToast('Lỗi khởi tạo công cụ'); }
    }

    // 4.3. Lắng nghe KLineChart Events (CỰC KỲ QUAN TRỌNG: Lấy đúng Object từ data)
    let waitChart = setInterval(() => {
      if (global.tvChart && typeof global.tvChart.subscribeAction === 'function') {
        if (!global.tvChart.__wa_event_bound) {
          global.tvChart.__wa_event_bound = true;
          
          global.tvChart.subscribeAction('onDrawEnd', function(data) {
            activateTool('pointer');
            toolbar.querySelector('[data-tool="pointer"]').classList.add('active');
            
            // Fix BUG KLineChart v9: onDrawEnd trả về Array [overlayData]
            let overlayObj = Array.isArray(data) ? data[0] : data;
            if(!overlayObj) return;

            saveHistory('add', overlayObj);
            
            // Tự động mở panel & focus text
            currentSelectedOverlay = overlayObj;
            renderPanel(currentSelectedOverlay);
          });

          global.tvChart.subscribeAction('onOverlayClick', function(data) {
            let overlayObj = (data && data.overlay) ? data.overlay : (Array.isArray(data) ? data[0] : data);
            if(!overlayObj) { hidePanel(); return; }
            
            let now = Date.now();
            let isDoubleClick = (now - lastClickTime < 300);
            lastClickTime = now;

            currentSelectedOverlay = overlayObj;
            renderPanel(currentSelectedOverlay);

            // Xử lý Double Click cho Text
            if(isDoubleClick && overlayObj.name === 'customText') {
               setTimeout(() => {
                 let t = document.getElementById('wa-prop-txt');
                 if(t) { t.focus(); t.select(); }
               }, 50);
            }
          });
        }
        clearInterval(waitChart);
      }
    }, 500);

    // 4.4. Keyboard Shortcuts
    if(!global.__wa_kb_bound) {
      global.__wa_kb_bound = true;
      document.addEventListener('keydown', (e) => {
        let isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        
        // Escape: Thoát vẽ / Đóng panel
        if(e.key === 'Escape') {
          if(global.tvChart) global.tvChart.cancelDrawing();
          activateTool('pointer'); hidePanel();
        }
        
        if(!isInput) {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            if (currentSelectedOverlay && global.tvChart) {
              saveHistory('delete', currentSelectedOverlay);
              global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
              hidePanel();
            }
          }
          if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
          if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); }
        }
      });
    }
  }

  // ==========================================
  // 5. PROPS PANEL & REALTIME UPDATE (WYSIWYG)
  // ==========================================
  function getToolCategory(name) {
    if(['rect','circle','triangle','parallelogram'].includes(name)) return 'shapes';
    if(name.startsWith('fibo')) return 'fibo';
    if(name === 'customText') return 'text';
    if(name.startsWith('wave') || name.includes('abcd')) return 'waves';
    return 'lines';
  }

  function renderPanel(overlay) {
    const panel = document.getElementById('wa-props-panel');
    if(!panel || !overlay) return;
    
    const cat = getToolCategory(overlay.name);
    const body = panel.querySelector('.wa-panel-body');
    let html = '';
    let s = overlay.styles || {};
    let ext = overlay.extendData || {};

    // DYNAMIC UI DỰA TRÊN LOẠI TOOL
    if (cat === 'text') {
      let txt = typeof ext === 'string' ? ext : (ext.text || '');
      let c = (s.text && s.text.color) ? colorToHex(s.text.color) : toolStyles.text.textColor;
      let sz = (s.text && s.text.size) ? s.text.size : 14;
      html += `
        <div class="wa-control-row"><label>Văn bản (Double-click trên hình để sửa nhanh)</label>
          <textarea id="wa-prop-txt" class="wa-textarea">${txt}</textarea></div>
        <div style="display:flex; gap:8px;">
          <div class="wa-control-row" style="flex:1"><label>Màu chữ</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${c}"></div>
          <div class="wa-control-row" style="flex:1"><label>Cỡ</label><select id="wa-prop-s1" class="wa-select">
            <option value="12" ${sz==12?'selected':''}>12px</option><option value="14" ${sz==14?'selected':''}>14px</option>
            <option value="16" ${sz==16?'selected':''}>16px</option><option value="20" ${sz==20?'selected':''}>20px</option>
            <option value="24" ${sz==24?'selected':''}>24px</option>
          </select></div>
        </div>`;
    } else if (cat === 'shapes') {
      let bc = (s.polygon && s.polygon.borderColor) ? colorToHex(s.polygon.borderColor) : toolStyles.shapes.borderColor;
      let fc = (s.polygon && s.polygon.color) ? colorToHex(s.polygon.color) : toolStyles.shapes.fillColor;
      html += `
        <div style="display:flex; gap:8px;">
          <div class="wa-control-row" style="flex:1"><label>Viền</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${bc}"></div>
          <div class="wa-control-row" style="flex:1"><label>Nền</label><input type="color" id="wa-prop-c2" class="wa-color-picker" value="${fc}"></div>
        </div>`;
    } else if (cat === 'fibo') {
      let lc = (s.line && s.line.color) ? colorToHex(s.line.color) : toolStyles.fibo.lineColor;
      html += `
        <div class="wa-control-row"><label>Màu nét / Chữ</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${lc}"></div>
        <div class="wa-control-row"><label>Độ đậm màu nền (0-1)</label>
          <input type="number" id="wa-prop-a1" class="wa-input" step="0.05" min="0" max="1" value="${ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15}">
        </div>`;
    } else { // Lines, waves
      let lc = (s.line && s.line.color) ? colorToHex(s.line.color) : toolStyles.lines.lineColor;
      let lw = (s.line && s.line.size) ? s.line.size : 1;
      html += `
        <div style="display:flex; gap:8px;">
          <div class="wa-control-row" style="flex:1"><label>Màu nét</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${lc}"></div>
          <div class="wa-control-row" style="flex:1"><label>Độ dày</label><select id="wa-prop-s1" class="wa-select">
            <option value="1" ${lw==1?'selected':''}>1px</option><option value="2" ${lw==2?'selected':''}>2px</option><option value="3" ${lw==3?'selected':''}>3px</option>
          </select></div>
        </div>`;
    }

    body.innerHTML = html;
    panel.classList.add('show');

    // BIND EVENT NGAY LẬP TỨC (DEBOUNCED)
    const updateEngine = debounce(() => {
      if(!currentSelectedOverlay || !global.tvChart) return;
      let newStyles = { ...currentSelectedOverlay.styles };
      let newExt = { ...currentSelectedOverlay.extendData };
      
      const v_txt = document.getElementById('wa-prop-txt');
      const v_c1 = document.getElementById('wa-prop-c1');
      const v_c2 = document.getElementById('wa-prop-c2');
      const v_s1 = document.getElementById('wa-prop-s1');
      const v_a1 = document.getElementById('wa-prop-a1');

      if(cat === 'text') {
        newExt.text = v_txt ? v_txt.value : '';
        toolStyles.text.textInput = newExt.text;
        if(v_c1) { newStyles.text = { ...newStyles.text, color: v_c1.value }; toolStyles.text.textColor = v_c1.value; }
        if(v_s1) { newStyles.text = { ...newStyles.text, size: parseInt(v_s1.value) }; toolStyles.text.textSize = parseInt(v_s1.value); }
      } 
      else if (cat === 'shapes') {
        if(v_c1) { newStyles.polygon = { ...newStyles.polygon, borderColor: v_c1.value }; toolStyles.shapes.borderColor = v_c1.value; }
        // Nền shapes giới hạn alpha <= 0.2 để không che nến
        if(v_c2) { newStyles.polygon = { ...newStyles.polygon, color: hexToRgba(v_c2.value, 0.15), style: 'stroke_fill' }; toolStyles.shapes.fillColor = v_c2.value; }
      }
      else if (cat === 'fibo') {
        if(v_c1) { newStyles.line = { ...newStyles.line, color: v_c1.value }; newStyles.text = { color: v_c1.value }; toolStyles.fibo.lineColor = v_c1.value; }
        if(v_a1) { newExt.fillOpacity = parseFloat(v_a1.value); toolStyles.fibo.fillOpacity = newExt.fillOpacity; }
      }
      else {
        if(v_c1) { newStyles.line = { ...newStyles.line, color: v_c1.value }; toolStyles.lines.lineColor = v_c1.value; }
        if(v_s1) { newStyles.line = { ...newStyles.line, size: parseInt(v_s1.value) }; toolStyles.lines.lineWidth = parseInt(v_s1.value); }
      }

      saveStyles();
      
      try {
        global.tvChart.overrideOverlay({
          id: currentSelectedOverlay.id,
          styles: newStyles,
          extendData: newExt
        });
      } catch(e){}
    }, 16); // 16ms = 60fps update

    // Gắn listener cho mọi input để bắn realtime update
    body.querySelectorAll('input, textarea, select').forEach(el => {
      // Bắt cả sự kiện nhập liệu tiếng Việt (compositionend)
      el.addEventListener('input', updateEngine);
      el.addEventListener('change', updateEngine);
      el.addEventListener('compositionend', updateEngine); 
    });

    // Auto focus nếu là text
    if(cat === 'text') {
      let tArea = document.getElementById('wa-prop-txt');
      if(tArea) { tArea.focus(); tArea.select(); }
    }
  }

  function hidePanel() {
    const p = document.getElementById('wa-props-panel');
    if(p) p.classList.remove('show');
    currentSelectedOverlay = null;
  }

  // Modal Xác nhận tự tạo (Không dùng alert/confirm browser)
  function createConfirmModal(msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    const box = document.createElement('div');
    box.style.cssText = 'background:#161A1E;border:1px solid #2b3139;padding:20px;border-radius:8px;color:#EAECEF;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.8);';
    box.innerHTML = `<div style="margin-bottom:16px;font-size:14px;">${msg}</div>
                     <div style="display:flex;gap:12px;justify-content:center;">
                       <button id="wa-btn-c-cancel" style="padding:6px 16px;background:#2b3139;border:none;color:#EAECEF;border-radius:4px;cursor:pointer;">Hủy</button>
                       <button id="wa-btn-c-ok" style="padding:6px 16px;background:#F6465D;border:none;color:#FFF;border-radius:4px;cursor:pointer;">Đồng ý</button>
                     </div>`;
    overlay.appendChild(box);
    setTimeout(() => {
      box.querySelector('#wa-btn-c-cancel').onclick = () => overlay.remove();
      box.querySelector('#wa-btn-c-ok').onclick = () => { onConfirm(); overlay.remove(); };
    }, 0);
    return overlay;
  }

  // ==========================================
  // 6. RIGHT CLICK CONTEXT MENU & ACTIONS
  // ==========================================
  function bindContextMenu(panel) {
    const container = document.getElementById('sc-chart-container');
    const cm = document.createElement('div');
    cm.className = 'wa-context-menu';
    cm.innerHTML = `
      <div class="wa-cm-item" id="wa-cm-edit">Chỉnh sửa</div>
      <div class="wa-cm-item" id="wa-cm-clone">Nhân bản</div>
      <div class="wa-cm-item" id="wa-cm-lock">Khóa / Mở khóa</div>
      <div class="wa-divider" style="margin:2px 0;"></div>
      <div class="wa-cm-item" id="wa-cm-del" style="color:#F6465D;">Xóa</div>
    `;
    container.appendChild(cm);

    // Mở menu khi chuột phải
    container.addEventListener('contextmenu', (e) => {
      if(!currentSelectedOverlay) return; // Chỉ mở nếu đang có hình được chọn
      e.preventDefault();
      cm.style.left = e.clientX + 'px';
      cm.style.top = e.clientY + 'px';
      cm.style.display = 'block';
    });

    // Đóng menu
    document.addEventListener('click', (e) => { if(!e.target.closest('.wa-context-menu')) cm.style.display = 'none'; });

    // Actions Context Menu & Nút Panel
    function actionDelete() {
      if(currentSelectedOverlay && global.tvChart) {
        saveHistory('delete', currentSelectedOverlay);
        global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
        hidePanel(); cm.style.display = 'none';
      }
    }
    
    function actionClone() {
      if(currentSelectedOverlay && global.tvChart) {
        let cloned = JSON.parse(JSON.stringify(currentSelectedOverlay));
        delete cloned.id; // Để KLineChart tự gen ID mới
        // Dịch chuyển timestamp/price 1 chút để dễ nhìn
        cloned.points = cloned.points.map(p => ({ timestamp: p.timestamp, value: p.value * 1.001 }));
        global.tvChart.createOverlay(cloned);
        showToast('Đã nhân bản');
        cm.style.display = 'none';
      }
    }

    function actionLock() {
      if(currentSelectedOverlay && global.tvChart) {
        let isLocked = currentSelectedOverlay.lock;
        global.tvChart.overrideOverlay({ id: currentSelectedOverlay.id, lock: !isLocked });
        showToast(isLocked ? 'Đã mở khóa hình' : 'Đã khóa hình');
        cm.style.display = 'none';
      }
    }

    // Gắn sự kiện CM
    cm.querySelector('#wa-cm-edit').onclick = () => { renderPanel(currentSelectedOverlay); cm.style.display = 'none'; };
    cm.querySelector('#wa-cm-clone').onclick = actionClone;
    cm.querySelector('#wa-cm-lock').onclick = actionLock;
    cm.querySelector('#wa-cm-del').onclick = actionDelete;

    // Gắn sự kiện Nút trong Panel
    panel.querySelector('.wa-close-btn').onclick = hidePanel;
    panel.querySelector('#wa-btn-p-lock').onclick = actionLock;
    panel.querySelector('#wa-btn-p-del').onclick = actionDelete;
  }

  function colorToHex(color) {
    if (!color) return '#00F0FF';
    if (color.startsWith('#')) return color.substring(0, 7);
    let match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) return `#${parseInt(match[1]).toString(16).padStart(2,'0')}${parseInt(match[2]).toString(16).padStart(2,'0')}${parseInt(match[3]).toString(16).padStart(2,'0')}`;
    return '#00F0FF';
  }

  // ==========================================
  // 7. HỆ THỐNG AUTO-HEAL (ResizeObserver + Mutation)
  // Không dùng setInterval gây tụt FPS
  // ==========================================
  function mountUI() {
    var container = document.getElementById('sc-chart-container');
    if (!container) return;
    
    if (container.querySelector('.wa-toolbar')) return; // Đã có UI

    injectCSS();
    registerProExtensions();

    // 1. Dựng Sidebar trái
    var sidebar = document.createElement('div');
    sidebar.className = 'wa-toolbar';
    sidebar.innerHTML = buildToolbar();
    container.appendChild(sidebar);

    // 2. Dựng Panel phải (Trống)
    var panel = document.createElement('div');
    panel.className = 'wa-props-panel';
    panel.id = 'wa-props-panel';
    panel.innerHTML = `
      <div class="wa-panel-header">Tùy chỉnh Công cụ <button class="wa-close-btn" title="Đóng (Esc)">${SVG.close}</button></div>
      <div class="wa-panel-body"></div>
      <div class="wa-panel-footer">
        <button class="wa-action-btn" id="wa-btn-p-lock" title="Khóa">${SVG.magnet}</button>
        <button class="wa-action-btn delete" id="wa-btn-p-del" title="Xóa">${SVG.trash}</button>
      </div>
    `;
    container.appendChild(panel);

    // 3. Khởi tạo event listeners
    bindCoreEvents(sidebar, panel);
    bindContextMenu(panel);
  }

  // Auto-Heal Observer: Phục hồi giao diện khi React/Vue re-render chart container
  if (!global.__wa_auto_heal_started) {
    global.__wa_auto_heal_started = true;
    
    // Khi DOM load xong
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountUI);
    } else {
      mountUI();
    }

    // Dùng MutationObserver nhẹ nhàng theo dõi container cha
    const domObserver = new MutationObserver((mutations) => {
      let needsMount = false;
      for (let m of mutations) {
        if (m.addedNodes.length || m.removedNodes.length) needsMount = true;
      }
      if (needsMount && document.getElementById('sc-chart-container')) {
        mountUI();
      }
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

})(window);