// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING TOOLBAR (V4)
// Kiến trúc sao chép 1:1 từ KLineChart Pro
// ==========================================

(function (global) {
  'use strict';

  // ======================================================
  // 1. ĐĂNG KÝ THUẬT TOÁN VẼ PRO (Sao chép từ thư mục src/extension/)
  // ======================================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc) return;

    var extensions = [
      {
        name: 'customText', totalStep: 1, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          // Khóa text vào extendData để không bị mất khi vẽ cái khác
          if (ref.overlay.extendData === undefined || ref.overlay.extendData === null) {
            ref.overlay.extendData = window.__WA_TEMP_TEXT__ || 'Văn bản...';
          }
          return [{ type: 'text', attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y, text: ref.overlay.extendData, baseline: 'bottom', size: 14 } }];
        }
      },
      {
        name: 'waveElliott', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || [];
          var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          var labels = ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'];
          c.forEach(function(pt, i) {
            if (labels[i]) figs.push({ type: 'text', attrs: { x: pt.x, y: pt.y - 15, text: labels[i], align: 'center', baseline: 'bottom' }, ignoreEvent: true });
          });
          return figs;
        }
      },
      {
        name: 'waveABC', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || [];
          var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          var labels = ['(0)', '(A)', '(B)', '(C)'];
          c.forEach(function(pt, i) {
            if (labels[i]) figs.push({ type: 'text', attrs: { x: pt.x, y: pt.y - 15, text: labels[i], align: 'center', baseline: 'bottom' }, ignoreEvent: true });
          });
          return figs;
        }
      },
      {
        name: 'xabcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || [];
          var figs = [];
          if (c.length >= 3) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2]] }, styles: { style: 'fill' } });
          if (c.length >= 5) figs.push({ type: 'polygon', attrs: { coordinates: [c[2], c[3], c[4]] }, styles: { style: 'fill' } });
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          var labels = ['X', 'A', 'B', 'C', 'D'];
          c.forEach(function(pt, i) {
            figs.push({ type: 'text', attrs: { x: pt.x, y: pt.y - 10, text: labels[i], align: 'center' }, ignoreEvent: true });
          });
          return figs;
        }
      },
      {
        name: 'fibExtension', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || [];
          var bounding = ref.bounding;
          var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: [c[0], c[1]] } });
          if (c.length > 2) figs.push({ type: 'line', attrs: { coordinates: [c[1], c[2]] }, styles: { style: 'dashed' } });
          if (c.length === 3) {
            var diffY = c[0].y - c[1].y;
            var startY = c[2].y;
            var levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618];
            levels.forEach(function(l) {
              var y = startY - (diffY * l);
              figs.push({ type: 'line', attrs: { coordinates: [{ x: c[2].x, y: y }, { x: bounding.width, y: y }] } });
              figs.push({ type: 'text', attrs: { x: c[2].x + 5, y: y - 5, text: 'Fib ' + l, baseline: 'bottom' }, ignoreEvent: true });
            });
          }
          return figs;
        }
      }
    ];

    extensions.forEach(function(ov) {
      try { kc.registerOverlay(ov); } catch(e) {}
    });
  }

  // ======================================================
  // 2. GIAO DIỆN & DỮ LIỆU CẤU TRÚC PRO
  // ======================================================

  // Bộ icon SVG chuẩn nét như KLineChart Pro
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
    {
      id: 'lines', icon: ICONS.lines,
      tools: [
        { id: 'segment', name: 'Đường xu hướng' },
        { id: 'ray', name: 'Tia' },
        { id: 'straightLine', name: 'Đường thẳng mở rộng' },
        { id: 'horizontalStraightLine', name: 'Đường ngang' },
        { id: 'verticalStraightLine', name: 'Đường dọc' }
      ]
    },
    {
      id: 'fibonacci', icon: ICONS.fibonacci,
      tools: [
        { id: 'fibonacciLine', name: 'Fibonacci Retracement' },
        { id: 'fibExtension', name: 'Fibonacci Extension' },
        { id: 'fibonacciCircle', name: 'Vòng tròn Fibonacci' }
      ]
    },
    {
      id: 'waves', icon: ICONS.waves,
      tools: [
        { id: 'waveElliott', name: 'Sóng Elliott (12345)' },
        { id: 'waveABC', name: 'Sóng điều chỉnh (ABC)' },
        { id: 'xabcd', name: 'Mô hình XABCD' },
        { id: 'abcd', name: 'Mô hình ABCD' }
      ]
    },
    {
      id: 'shapes', icon: ICONS.shapes,
      tools: [
        { id: 'rect', name: 'Hình chữ nhật' },
        { id: 'triangle', name: 'Tam giác' },
        { id: 'circle', name: 'Hình tròn' }
      ]
    }
  ];

  // ======================================================
  // 3. CSS INJECTION (Kiến trúc Left Sidebar CSS thuần Popover)
  // ======================================================
  function injectCSS() {
    if (document.getElementById('wa-pro-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-pro-css';
    style.textContent = `
      /* Bọc biểu đồ để nhường chỗ cho Toolbar bên trái */
      #sc-chart-container {
        position: relative !important;
        display: flex;
        width: 100%;
        height: 100%;
        background: #131722;
      }

      /* Wrapper chứa lõi biểu đồ thực sự bên trong */
      #sc-chart-container > div:not(.wa-pro-sidebar) {
        flex: 1;
        width: calc(100% - 52px) !important;
      }

      /* Thanh công cụ dính mép trái */
      .wa-pro-sidebar {
        width: 52px;
        min-width: 52px;
        height: 100%;
        background-color: #1e222d;
        border-right: 1px solid #2b2f3a;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 0;
        box-sizing: border-box;
        z-index: 100;
      }

      /* Nhóm nút bấm có Popover */
      .wa-group {
        position: relative;
        width: 100%;
        display: flex;
        justify-content: center;
        margin-bottom: 6px;
      }

      .wa-btn {
        width: 36px;
        height: 36px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: #787b86;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        position: relative;
      }
      .wa-btn:hover {
        background-color: #2b2f3a;
        color: #d1d4dc;
      }
      .wa-btn.active {
        background-color: rgba(41, 98, 255, 0.15);
        color: #2962FF;
      }

      /* Tam giác nhỏ báo hiệu có menu xổ */
      .wa-has-menu::after {
        content: '';
        position: absolute;
        right: 4px;
        bottom: 4px;
        border: solid currentColor;
        border-width: 0 1.5px 1.5px 0;
        padding: 1.5px;
        transform: rotate(-45deg);
      }

      /* Menu xổ ra (Flyout) dùng CSS thuần :hover siêu mượt */
      .wa-menu {
        position: absolute;
        left: 50px;
        top: 0;
        background-color: #1e222d;
        border: 1px solid #2b2f3a;
        border-radius: 6px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        display: none;
        flex-direction: column;
        width: 200px;
        padding: 6px 0;
        z-index: 9999;
      }
      
      /* Hiển thị menu khi hover vào group chứa nó */
      .wa-group:hover .wa-menu {
        display: flex;
      }

      .wa-menu-item {
        padding: 10px 16px;
        color: #d1d4dc;
        font-size: 13px;
        font-family: sans-serif;
        cursor: pointer;
        display: flex;
        align-items: center;
      }
      .wa-menu-item:hover {
        background-color: #2b2f3a;
        color: #fff;
      }
      .wa-menu-item.active {
        color: #2962FF;
      }

      /* Đường phân cách */
      .wa-divider {
        width: 24px;
        height: 1px;
        background-color: #2b2f3a;
        margin: 10px 0;
      }

      /* Trạng thái đổi con trỏ chuột thành dấu thập khi vẽ */
      .wa-drawing-mode canvas {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ======================================================
  // 4. HTML BUILDER & LOGIC CHÍNH
  // ======================================================
  
  function initProToolbar() {
    var container = document.getElementById('sc-chart-container');
    if (!container) return setTimeout(initProToolbar, 500);

    // Không render lại nếu đã có
    if (document.querySelector('.wa-pro-sidebar')) return;

    // Ép container thành Flexbox để Sidebar nằm bên trái, Chart nằm bên phải
    container.style.display = 'flex';

    // Tạo thanh Sidebar
    var sidebar = document.createElement('div');
    sidebar.className = 'wa-pro-sidebar';

    // --- Xây dựng HTML bên trong Sidebar ---
    let html = '';

    // 1. Nút trỏ chuột mặc định
    html += `
      <div class="wa-group">
        <button class="wa-btn active" data-tool="pointer" title="Chọn / Di chuyển">${ICONS.pointer}</button>
      </div>
    `;

    // 2. Vòng lặp sinh ra các nhóm Menu (Đường kẻ, Fibonacci, Sóng, Hình học)
    MENU_MAP.forEach(group => {
      html += `
        <div class="wa-group">
          <button class="wa-btn wa-has-menu" id="wa-btn-${group.id}">${group.icon}</button>
          <div class="wa-menu">
            ${group.tools.map(t => `<div class="wa-menu-item" data-tool="${t.id}">${t.name}</div>`).join('')}
          </div>
        </div>
      `;
    });

    // 3. Nút công cụ Text (Viết chữ)
    html += `
      <div class="wa-group">
        <button class="wa-btn" data-tool="customText" title="Viết Ghi chú (Text)">${ICONS.text}</button>
      </div>
    `;

    // Phân cách
    html += `<div class="wa-divider"></div>`;

    // 4. Cục tẩy và Thùng rác
    html += `
      <div class="wa-group">
        <button class="wa-btn" data-tool="eraser" title="Cục tẩy (Click để xóa)">${ICONS.eraser}</button>
      </div>
      <div class="wa-group">
        <button class="wa-btn" data-tool="trash" title="Xóa toàn bộ biểu đồ">${ICONS.trash}</button>
      </div>
    `;

    sidebar.innerHTML = html;
    
    // Chèn Sidebar vào đầu container (Bên trái)
    container.insertBefore(sidebar, container.firstChild);

    // ======================================================
    // 5. EVENT BẮT CLICK VÀ TƯƠNG TÁC VỚI KLINECHARTS
    // ======================================================
    let isEraserMode = false;

    sidebar.addEventListener('click', function(e) {
      let targetBtn = e.target.closest('.wa-btn');
      let targetMenuItem = e.target.closest('.wa-menu-item');
      
      let toolId = null;

      if (targetMenuItem) {
        toolId = targetMenuItem.getAttribute('data-tool');
        // Đổi icon của nút cha thành icon của group (để biết đang chọn nhóm nào)
        let parentBtn = targetMenuItem.closest('.wa-group').querySelector('.wa-btn');
        activateUI(toolId, parentBtn, targetMenuItem);
      } 
      else if (targetBtn) {
        toolId = targetBtn.getAttribute('data-tool');
        if (toolId) activateUI(toolId, targetBtn, null);
      }

      if (toolId) executeTool(toolId);
    });

    function activateUI(toolId, btnNode, menuItemNode) {
      if (toolId === 'trash') return; // Nút xóa không cần active state

      // Tắt active toàn bộ
      document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
      
      // Bật active cho nút được chọn
      if (btnNode) btnNode.classList.add('active');
      if (menuItemNode) menuItemNode.classList.add('active');
    }

    function executeTool(toolId) {
      if (!global.tvChart) return;
      
      var c = document.getElementById('sc-chart-container');

      // Hủy lệnh vẽ cũ
      try { global.tvChart.cancelDrawing(); } catch(e) {}

      if (toolId === 'trash') {
        if (confirm("Bạn có chắc chắn muốn xóa toàn bộ hình vẽ?")) {
          global.tvChart.removeOverlay();
          executeTool('pointer');
          activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
        }
        return;
      }

      if (toolId === 'pointer') {
        c.classList.remove('wa-drawing-mode');
        isEraserMode = false;
        return;
      }

      if (toolId === 'eraser') {
        c.classList.remove('wa-drawing-mode');
        isEraserMode = true;
        return;
      }

      // XỬ LÝ VIẾT CHỮ (TEXT) THÔNG MINH
      if (toolId === 'customText') {
        let userInput = prompt("Nhập nội dung bạn muốn viết lên biểu đồ:", "Wave Alpha");
        if (userInput === null || userInput.trim() === '') {
          // Trở về con trỏ nếu người dùng bấm Hủy
          executeTool('pointer');
          activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
          return;
        }
        // Lưu tạm vào biến window để hàm Overlay bên trên gọi lại
        window.__WA_TEMP_TEXT__ = userInput;
      }

      // Bật chế độ vẽ
      c.classList.add('wa-drawing-mode');
      isEraserMode = false;

      // Gọi lệnh vẽ của KLineCharts v9
      try {
        global.tvChart.createOverlay({
          name: toolId,
          lock: false,
          styles: {
            line: { color: '#2962FF', size: 2 },
            text: { color: '#FFFFFF', size: 14 },
            polygon: { color: 'rgba(41, 98, 255, 0.2)', style: 'fill', borderColor: '#2962FF' }
          }
        });
      } catch (err) {
        console.warn("Lỗi vẽ Overlay: ", err);
      }
    }

    // Xóa từng hình khi dùng Cục tẩy
    setInterval(function() {
      if (!global.tvChart) return;
      if (!global.__wa_event_bound) {
        global.__wa_event_bound = true;
        
        // Vẽ xong tự quay về con trỏ
        global.tvChart.subscribeAction('onDrawEnd', function() {
          executeTool('pointer');
          activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
        });

        // Bắt sự kiện click lên hình vẽ để xóa (Nếu đang chọn Cục Tẩy)
        global.tvChart.subscribeAction('onOverlayClick', function(params) {
          if (isEraserMode && params && params.overlay) {
            global.tvChart.removeOverlay({ id: params.overlay.id });
            executeTool('pointer');
            activateUI('pointer', document.querySelector('[data-tool="pointer"]'));
          }
        });
      }
    }, 1000);
  }

  // ======================================================
  // 6. KHỞI CHẠY HỆ THỐNG
  // ======================================================
  global.WaveDrawingAPI = {
    init: function() {
      injectCSS();
      registerProExtensions();
      initProToolbar();
    }
  };

  // Tự động chạy khi tải xong trang
  var _initAttempts = 0;
  function bootstrap() {
    if (global.klinecharts) {
      global.WaveDrawingAPI.init();
    } else if (_initAttempts < 50) {
      _initAttempts++;
      setTimeout(bootstrap, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  console.log('[Wave Alpha Drawing v4 PRO] Left Sidebar Initialized.');

})(window);