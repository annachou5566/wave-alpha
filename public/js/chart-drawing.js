// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — AUTO-INJECT PRO TOOLBAR (BẢN CUỐI CÙNG)
// ==========================================

(function (global) {
  'use strict';

  // 1. ĐĂNG KÝ THUẬT TOÁN VẼ PRO
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc) return;
    try {
      var exts = [
        {
          name: 'customText', totalStep: 1, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function (ref) {
            if (!ref.coordinates || !ref.coordinates.length) return [];
            if (ref.overlay.extendData === undefined) ref.overlay.extendData = window.__WA_TEMP_TEXT__ || 'Văn bản...';
            return [{ type: 'text', attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y, text: ref.overlay.extendData, baseline: 'bottom', size: 14 } }];
          }
        },
        {
          name: 'waveElliott', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function (ref) {
            var c = ref.coordinates || []; var figs = [];
            if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
            ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'].forEach((l, i) => {
              if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 15, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true });
            });
            return figs;
          }
        },
        {
          name: 'waveABC', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function (ref) {
            var c = ref.coordinates || []; var figs = [];
            if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
            ['(0)', '(A)', '(B)', '(C)'].forEach((l, i) => {
              if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 15, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true });
            });
            return figs;
          }
        },
        {
          name: 'xabcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function (ref) {
            var c = ref.coordinates || []; var figs = [];
            if (c.length >= 3) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2]] }, styles: { style: 'fill' } });
            if (c.length >= 5) figs.push({ type: 'polygon', attrs: { coordinates: [c[2], c[3], c[4]] }, styles: { style: 'fill' } });
            if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
            ['X', 'A', 'B', 'C', 'D'].forEach((l, i) => {
              if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 10, text: l, align: 'center' }, ignoreEvent: true });
            });
            return figs;
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
              [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618].forEach(l => {
                var y = startY - (diffY * l);
                figs.push({ type: 'line', attrs: { coordinates: [{ x: c[2].x, y: y }, { x: ref.bounding.width, y: y }] } });
                figs.push({ type: 'text', attrs: { x: c[2].x + 5, y: y - 5, text: 'Fib ' + l, baseline: 'bottom' }, ignoreEvent: true });
              });
            }
            return figs;
          }
        }
      ];
      exts.forEach(e => kc.registerOverlay(e));
    } catch(e) { console.log('WaveAlpha Drawing: Khởi tạo overlay đợi KLineCharts...'); }
  }

  // 2. ICON VÀ MENU
  const ICONS = {
    pointer: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>',
    lines: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/></svg>',
    fibonacci: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    waves: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 12 7 4 13 20 18 8 21 12"/></svg>',
    shapes: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></svg>',
    text: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    eraser: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16l9-9 7 7-3 3z"/></svg>',
    trash: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };

  const MENU_MAP = [
    { id: 'lines', icon: ICONS.lines, tools: [ { id: 'segment', name: 'Đường xu hướng' }, { id: 'ray', name: 'Tia' }, { id: 'straightLine', name: 'Đường thẳng mở rộng' }, { id: 'horizontalStraightLine', name: 'Đường ngang' }, { id: 'verticalStraightLine', name: 'Đường dọc' } ] },
    { id: 'fibonacci', icon: ICONS.fibonacci, tools: [ { id: 'fibonacciLine', name: 'Fibonacci Retracement' }, { id: 'fibExtension', name: 'Fibonacci Extension' }, { id: 'fibonacciCircle', name: 'Vòng tròn Fibonacci' } ] },
    { id: 'waves', icon: ICONS.waves, tools: [ { id: 'waveElliott', name: 'Sóng Elliott (12345)' }, { id: 'waveABC', name: 'Sóng điều chỉnh (ABC)' }, { id: 'xabcd', name: 'Mô hình XABCD' }, { id: 'abcd', name: 'Mô hình ABCD' } ] },
    { id: 'shapes', icon: ICONS.shapes, tools: [ { id: 'rect', name: 'Hình chữ nhật' }, { id: 'triangle', name: 'Tam giác' }, { id: 'circle', name: 'Hình tròn' } ] }
  ];

  // 3. TỰ ĐỘNG BƠM CSS ÉP BUỘC (FORCED CSS)
  function injectCSS() {
    if (document.getElementById('wa-pro-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-pro-css';
    style.textContent = `
      #sc-chart-container {
          display: flex !important;
          flex-direction: row !important;
          overflow: visible !important;
      }
      /* Quan trọng: Ép lõi KLineCharts phải nhường chỗ 52px cho thanh công cụ */
      #sc-chart-container > div:not(.wa-pro-sidebar) {
          flex: 1 !important;
          width: calc(100% - 52px) !important;
          min-width: 0 !important;
      }
      .wa-pro-sidebar {
          width: 52px; min-width: 52px; height: 100%;
          background-color: #161A1E; border-right: 1px solid #2b3139;
          display: flex; flex-direction: column; align-items: center; padding: 10px 0; z-index: 100;
      }
      .wa-group { position: relative; width: 100%; display: flex; justify-content: center; margin-bottom: 6px; }
      .wa-btn { width: 36px; height: 36px; border-radius: 6px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; position: relative; }
      .wa-btn:hover { background-color: #2b3139; color: #EAECEF; }
      .wa-btn.active { background-color: rgba(0, 240, 255, 0.15); color: #00F0FF; }
      .wa-has-menu::after { content: ''; position: absolute; right: 4px; bottom: 4px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); }
      .wa-menu { position: absolute; left: 50px; top: 0; background-color: #161A1E; border: 1px solid #2b3139; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); display: none; flex-direction: column; width: 210px; padding: 6px 0; z-index: 9999; }
      .wa-group:hover .wa-menu { display: flex; }
      .wa-menu-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; font-family: sans-serif; cursor: pointer; display: flex; align-items: center; }
      .wa-menu-item:hover { background-color: #2b3139; color: #00F0FF; }
      .wa-menu-item.active { color: #00F0FF; }
      .wa-divider { width: 24px; height: 1px; background-color: #2b3139; margin: 10px 0; }
      .wa-drawing-mode canvas { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  // 4. XÂY DỰNG GIAO DIỆN HTML SIDEBAR
  function buildSidebarHTML() {
    let html = '<div class="wa-group"><button class="wa-btn active" data-tool="pointer" title="Chọn / Di chuyển">' + ICONS.pointer + '</button></div>';
    MENU_MAP.forEach(group => {
      html += '<div class="wa-group"><button class="wa-btn wa-has-menu" id="wa-btn-' + group.id + '">' + group.icon + '</button><div class="wa-menu">';
      group.tools.forEach(t => { html += '<div class="wa-menu-item" data-tool="' + t.id + '">' + t.name + '</div>'; });
      html += '</div></div>';
    });
    html += '<div class="wa-group"><button class="wa-btn" data-tool="customText" title="Viết Ghi chú (Text)">' + ICONS.text + '</button></div>';
    html += '<div class="wa-divider"></div>';
    html += '<div class="wa-group"><button class="wa-btn" data-tool="eraser" title="Cục tẩy (Click để xóa)">' + ICONS.eraser + '</button></div>';
    html += '<div class="wa-group"><button class="wa-btn" data-tool="trash" title="Xóa toàn bộ biểu đồ">' + ICONS.trash + '</button></div>';
    return html;
  }

  // 5. GẮN SỰ KIỆN CLICK VÀO LÕI KLINECHARTS
  function bindSidebarEvents(sidebar) {
    let isEraserMode = false;

    sidebar.addEventListener('click', function(e) {
      let targetBtn = e.target.closest('.wa-btn'), targetMenuItem = e.target.closest('.wa-menu-item'), toolId = null;
      if (targetMenuItem) {
        toolId = targetMenuItem.getAttribute('data-tool');
        activateUI(toolId, targetMenuItem.closest('.wa-group').querySelector('.wa-btn'), targetMenuItem);
      } else if (targetBtn) {
        toolId = targetBtn.getAttribute('data-tool');
        if (toolId) activateUI(toolId, targetBtn, null);
      }
      if (toolId) executeTool(toolId);
    });

    function activateUI(toolId, btnNode, menuItemNode) {
      if (toolId === 'trash') return;
      document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
      if (btnNode) btnNode.classList.add('active');
      if (menuItemNode) menuItemNode.classList.add('active');
    }

    function executeTool(toolId) {
      if (!global.tvChart) return;
      var c = document.getElementById('sc-chart-container');
      try { global.tvChart.cancelDrawing(); } catch(e) {}

      if (toolId === 'trash') {
        if (confirm("Xóa toàn bộ hình vẽ?")) {
          global.tvChart.removeOverlay();
          executeTool('pointer');
          activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
        }
        return;
      }

      if (toolId === 'pointer') { c.classList.remove('wa-drawing-mode'); isEraserMode = false; return; }
      if (toolId === 'eraser') { c.classList.remove('wa-drawing-mode'); isEraserMode = true; return; }

      if (toolId === 'customText') {
        let userInput = prompt("Nhập nội dung bạn muốn viết lên biểu đồ:", "Wave Alpha");
        if (!userInput || userInput.trim() === '') {
          executeTool('pointer'); activateUI('pointer', document.querySelector('[data-tool="pointer"]')); return;
        }
        window.__WA_TEMP_TEXT__ = userInput;
      }

      c.classList.add('wa-drawing-mode');
      isEraserMode = false;

      try {
        global.tvChart.createOverlay({
          name: toolId, lock: false,
          styles: { line: { color: '#00F0FF', size: 2 }, text: { color: '#EAECEF', size: 14 }, polygon: { color: 'rgba(0, 240, 255, 0.15)', style: 'fill', borderColor: '#00F0FF' } }
        });
      } catch (err) {}
    }

    if (!global.__wa_event_bound) {
        global.__wa_event_bound = true;
        
        // Vòng lặp chờ Chart khởi tạo xong để gắn Event
        let waitChart = setInterval(() => {
            if (global.tvChart && typeof global.tvChart.subscribeAction === 'function') {
                clearInterval(waitChart);
                global.tvChart.subscribeAction('onDrawEnd', function() {
                  executeTool('pointer'); activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
                });
                global.tvChart.subscribeAction('onOverlayClick', function(params) {
                  if (isEraserMode && params && params.overlay) {
                    global.tvChart.removeOverlay({ id: params.overlay.id });
                    executeTool('pointer'); activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
                  }
                });
            }
        }, 500);
    }
  }

  // ======================================================
  // 6. TRÁI TIM CỦA HỆ THỐNG: MUTATION OBSERVER (MẮT THẦN)
  // Bắt lỗi tự động chèn Toolbar vào mà không cần sửa pro-mode.js
  // ======================================================
  function autoInjectSidebar() {
    var container = document.getElementById('sc-chart-container');
    if (!container) {
        // Đợi đến khi container xuất hiện trong HTML
        setTimeout(autoInjectSidebar, 500);
        return;
    }

    // Hàm thực thi việc nhét Toolbar vào
    function checkAndInject() {
        // Đảm bảo CSS được nhúng
        injectCSS();
        // Đăng ký thuật toán vẽ
        registerProExtensions();

        // 1. Kiểm tra xem Chart đã được klinecharts vẽ ra chưa (tìm thẻ canvas)
        var hasCanvas = container.querySelector('canvas');
        // 2. Kiểm tra xem Sidebar của ta đã tồn tại chưa
        var hasSidebar = container.querySelector('.wa-pro-sidebar');

        if (hasCanvas && !hasSidebar) {
            console.log('[Wave Alpha Drawing] Phát hiện Chart mới. Tự động gắn Toolbar!');
            var sidebar = document.createElement('div');
            sidebar.className = 'wa-pro-sidebar';
            sidebar.innerHTML = buildSidebarHTML();
            
            // Chèn Toolbar lên đầu container, KLineCharts sẽ bị đẩy sang phải tự động nhờ Flexbox
            container.insertBefore(sidebar, container.firstChild);
            bindSidebarEvents(sidebar);
        }
    }

    // Chạy kiểm tra lần đầu
    checkAndInject();

    // Giám sát mọi thay đổi bên trong #sc-chart-container. 
    // Nếu hàm openProChart xóa HTML và tạo lại Chart mới, Mắt thần này sẽ phát hiện và chèn lại Toolbar ngay tắp lự!
    var observer = new MutationObserver(function() {
        checkAndInject();
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  // Kích hoạt ngay khi tải file
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInjectSidebar);
  } else {
    autoInjectSidebar();
  }

  console.log('[Wave Alpha Drawing v5] Auto-Injector Started. Không cần sửa pro-mode.js.');

})(window);