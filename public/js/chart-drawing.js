// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE (V6 ULTIMATE)
// 100% TradingView Clone | Full Customization | Delete Key
// ==========================================

(function (global) {
  'use strict';

  let currentSelectedOverlay = null;

  // 1. CẤU HÌNH STYLE MẶC ĐỊNH CHO HÌNH VẼ MỚI
  let globalStyles = {
    lineColor: '#00F0FF',
    fillColor: 'rgba(0, 240, 255, 0.15)',
    lineWidth: 2,
    lineStyle: 'solid',
    textInput: 'Wave Alpha'
  };

  // ======================================================
  // 2. ĐĂNG KÝ TOÀN BỘ THUẬT TOÁN TỪ REPO PRO
  // ======================================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc) return;

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
      // BỘ SÓNG ELLIOTT CHUẨN TOÁN HỌC
      createWave('waveElliott', 6, ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)']), // Sóng đẩy 5
      createWave('waveABC', 4, ['(0)', '(A)', '(B)', '(C)']),                   // Sóng điều chỉnh ABC
      createWave('waveTriangle', 6, ['(0)', '(A)', '(B)', '(C)', '(D)', '(E)']),// Tam giác ABCDE
      createWave('waveWXY', 4, ['(0)', '(W)', '(X)', '(Y)']),                   // Sóng WXY
      
      // HARMONIC
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
      
      // TEXT TOOL PRO
      {
        name: 'customText', totalStep: 1, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          if (ref.overlay.extendData === undefined) ref.overlay.extendData = globalStyles.textInput;
          return [{ type: 'text', attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y, text: ref.overlay.extendData, baseline: 'bottom', size: 16, weight: 'bold' } }];
        }
      },

      // FIBONACCI EXTENSION
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
  // 3. DANH SÁCH MENU BÊN TRÁI
  // ======================================================
  const MENU_MAP = [
    { id: 'lines', icon: '📏', tools: [ 
        { id: 'segment', name: 'Đường xu hướng (Trendline)' }, { id: 'ray', name: 'Tia' }, { id: 'straightLine', name: 'Đường mở rộng' }, 
        { id: 'horizontalStraightLine', name: 'Đường ngang' }, { id: 'verticalStraightLine', name: 'Đường dọc' },
        { id: 'priceChannelLine', name: 'Kênh song song' }, { id: 'parallelStraightLine', name: 'Pitchfork' }
    ]},
    { id: 'fibonacci', icon: '🌈', tools: [ 
        { id: 'fibonacciLine', name: 'Fibonacci Retracement' }, { id: 'fibExtension', name: 'Fibonacci Extension' }, 
        { id: 'fibonacciSpeedResistanceFan', name: 'Fibonacci Quạt' }, { id: 'fibonacciCircle', name: 'Fibonacci Vòng tròn' }
    ]},
    { id: 'waves', icon: '🌊', tools: [ 
        { id: 'waveElliott', name: 'Sóng đẩy Elliott (12345)' }, { id: 'waveABC', name: 'Sóng điều chỉnh (ABC)' }, 
        { id: 'waveTriangle', name: 'Sóng tam giác (ABCDE)' }, { id: 'waveWXY', name: 'Sóng WXY' },
        { id: 'xabcd', name: 'Mô hình XABCD' }, { id: 'abcd', name: 'Mô hình ABCD' }, { id: 'headAndShoulders', name: 'Vai Đầu Vai' }
    ]},
    { id: 'shapes', icon: '🟥', tools: [ 
        { id: 'rect', name: 'Hình chữ nhật' }, { id: 'triangle', name: 'Tam giác' }, { id: 'circle', name: 'Hình tròn' }
    ]},
    { id: 'gann', icon: '🕸️', tools: [ 
        { id: 'gannBox', name: 'Hộp Gann' }, { id: 'gannFan', name: 'Quạt Gann' }
    ]}
  ];

  // ======================================================
  // 4. CSS: SIDEBAR + FLOATING PROPERTIES
  // ======================================================
  function injectCSS() {
    if (document.getElementById('wa-pro-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-pro-css';
    style.textContent = `
      #sc-chart-container { display: flex !important; flex-direction: row !important; overflow: hidden !important; position: relative; }
      #sc-chart-container > div:not(.wa-pro-sidebar):not(.wa-floating-props) { flex: 1 !important; width: calc(100% - 52px) !important; min-width: 0 !important; }
      
      /* Sidebar Trái */
      .wa-pro-sidebar { width: 52px; min-width: 52px; height: 100%; background-color: #161A1E; border-right: 1px solid #2b3139; display: flex; flex-direction: column; align-items: center; padding: 10px 0; z-index: 100; overflow-y:visible; }
      .wa-group { position: relative; width: 100%; display: flex; justify-content: center; margin-bottom: 6px; }
      .wa-btn { width: 36px; height: 36px; border-radius: 6px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; position: relative; font-size:16px;}
      .wa-btn:hover { background-color: #2b3139; color: #EAECEF; }
      .wa-btn.active { background-color: rgba(0, 240, 255, 0.15); color: #00F0FF; }
      .wa-has-menu::after { content: ''; position: absolute; right: 4px; bottom: 4px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); }
      .wa-menu { position: absolute; left: 50px; top: 0; background-color: #161A1E; border: 1px solid #2b3139; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); display: none; flex-direction: column; width: 220px; padding: 6px 0; z-index: 9999; }
      .wa-group:hover .wa-menu { display: flex; }
      .wa-menu-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; font-family: sans-serif; cursor: pointer; }
      .wa-menu-item:hover { background-color: #2b3139; color: #00F0FF; }
      .wa-menu-item.active { color: #00F0FF; }
      .wa-divider { width: 24px; height: 1px; background-color: #2b3139; margin: 10px 0; }
      .wa-drawing-mode canvas { cursor: crosshair !important; }

      /* Thanh Tùy Biến Nổi (Floating Properties Toolbar) */
      .wa-floating-props {
          position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
          background: rgba(22, 26, 30, 0.95); border: 1px solid #2b3139; border-radius: 8px;
          padding: 6px 12px; display: none; align-items: center; gap: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 9999;
      }
      .wa-floating-props.show { display: flex; }
      .wa-prop-item { display: flex; align-items: center; gap: 6px; }
      .wa-prop-label { color: #848E9C; font-size: 11px; }
      .wa-prop-color { width: 22px; height: 22px; border-radius: 4px; border: 1px solid #2b3139; cursor: pointer; padding: 0; overflow: hidden; }
      .wa-prop-color::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-prop-color::-webkit-color-swatch { border: none; }
      .wa-prop-select { background: #0B0E11; color: #EAECEF; border: 1px solid #2b3139; padding: 4px 6px; border-radius: 4px; font-size: 12px; outline: none; }
      .wa-prop-input { background: #0B0E11; color: #00F0FF; border: 1px solid #2b3139; padding: 4px 8px; border-radius: 4px; font-size: 13px; outline: none; width: 120px; font-weight: bold;}
      .wa-prop-btn { background: transparent; border: none; color: #848E9C; cursor: pointer; font-size: 14px; padding: 4px; transition: 0.2s; }
      .wa-prop-btn:hover { color: #F6465D; }
    `;
    document.head.appendChild(style);
  }

  // ======================================================
  // 5. GIAO DIỆN HTML CHO SIDEBAR VÀ FLOATING PROPS
  // ======================================================
  function buildHTML() {
    let html = '<div class="wa-group"><button class="wa-btn active" data-tool="pointer" title="Chọn / Di chuyển">🖱️</button></div>';
    MENU_MAP.forEach(g => {
      html += `<div class="wa-group"><button class="wa-btn wa-has-menu">${g.icon}</button><div class="wa-menu">`;
      g.tools.forEach(t => { html += `<div class="wa-menu-item" data-tool="${t.id}">${t.name}</div>`; });
      html += `</div></div>`;
    });
    html += `<div class="wa-group"><button class="wa-btn" data-tool="customText" title="Ghi chú (Text)">📝</button></div>`;
    html += `<div class="wa-divider"></div>`;
    html += `<div class="wa-group"><button class="wa-btn" data-tool="eraser" title="Cục tẩy (Click hình để xóa)">🧽</button></div>`;
    html += `<div class="wa-group"><button class="wa-btn" data-tool="trash" title="Xóa toàn bộ">🗑️</button></div>`;
    return html;
  }

  function buildFloatingPropsHTML() {
    return `
      <div class="wa-prop-item" title="Màu nét/chữ">
          <span class="wa-prop-label">Nét:</span>
          <input type="color" id="wa-prop-line-color" class="wa-prop-color" value="#00F0FF">
      </div>
      <div class="wa-prop-item" title="Màu nền">
          <span class="wa-prop-label">Nền:</span>
          <input type="color" id="wa-prop-fill-color" class="wa-prop-color" value="#000000">
      </div>
      <div class="wa-prop-item" title="Độ dày">
          <select id="wa-prop-line-size" class="wa-prop-select">
              <option value="1">1px</option><option value="2" selected>2px</option><option value="3">3px</option><option value="4">4px</option>
          </select>
      </div>
      <div class="wa-prop-item" title="Kiểu nét">
          <select id="wa-prop-line-style" class="wa-prop-select">
              <option value="solid">▬▬</option><option value="dashed">- - -</option><option value="dotted">. . .</option>
          </select>
      </div>
      <div class="wa-prop-item" id="wa-prop-text-wrapper" style="display:none;" title="Nhập chữ">
          <input type="text" id="wa-prop-text-input" class="wa-prop-input" placeholder="Nhập chữ...">
      </div>
      <div class="wa-divider" style="width:1px; height:16px; margin:0; background:#2b3139;"></div>
      <button class="wa-prop-btn" id="wa-prop-delete" title="Xóa hình này (Phím Delete)">🗑️</button>
      <button class="wa-prop-btn" id="wa-prop-close" title="Đóng" style="color:#848E9C;">✖</button>
    `;
  }

  // ======================================================
  // 6. XỬ LÝ LÕI SỰ KIỆN: VẼ, SỬA, XÓA
  // ======================================================
  function bindEvents(sidebar, propsBar) {
    let isEraserMode = false;

    // ----- BẮT SỰ KIỆN CLICK SIDEBAR -----
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
      hideFloatingProps(); // Ẩn thanh công cụ sửa khi chọn vẽ mới

      if (toolId === 'trash') {
        if (confirm("Xóa toàn bộ hình vẽ?")) {
          global.tvChart.removeOverlay();
          executeTool('pointer');
        }
        return;
      }

      if (toolId === 'pointer') { c.classList.remove('wa-drawing-mode'); isEraserMode = false; return; }
      if (toolId === 'eraser') { c.classList.remove('wa-drawing-mode'); isEraserMode = true; return; }

      c.classList.add('wa-drawing-mode');
      isEraserMode = false;

      // Tạo hình vẽ mới với Global Styles
      try {
        global.tvChart.createOverlay({
          name: toolId, lock: false,
          extendData: globalStyles.textInput,
          styles: { 
            line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle }, 
            text: { color: globalStyles.lineColor, size: 16 }, 
            polygon: { color: globalStyles.fillColor, style: 'fill', borderColor: globalStyles.lineColor } 
          }
        });
      } catch (err) {}
    }

    // ----- BẮT SỰ KIỆN TƯƠNG TÁC LÊN CHART -----
    if (!global.__wa_event_bound) {
        global.__wa_event_bound = true;
        
        let waitChart = setInterval(() => {
            if (global.tvChart && typeof global.tvChart.subscribeAction === 'function') {
                clearInterval(waitChart);
                
                // Vẽ xong tự về con trỏ chuột
                global.tvChart.subscribeAction('onDrawEnd', function() {
                  executeTool('pointer'); 
                  document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
                  document.querySelector('[data-tool="pointer"]').classList.add('active');
                });

                // KHI CLICK VÀO MỘT HÌNH VẼ ĐÃ CÓ
                global.tvChart.subscribeAction('onOverlayClick', function(params) {
                  if (!params || !params.overlay) return;
                  if (isEraserMode) {
                    global.tvChart.removeOverlay({ id: params.overlay.id });
                    return;
                  }
                  
                  // Bật chế độ Edit
                  currentSelectedOverlay = params.overlay;
                  showFloatingProps();
                });
            }
        }, 500);

        // PHÍM TẮT: DELETE VÀ BACKSPACE ĐỂ XÓA HÌNH ĐANG CHỌN
        document.addEventListener('keydown', function(e) {
            // Không xóa nếu đang gõ chữ trong ô input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (currentSelectedOverlay && global.tvChart) {
                    global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
                    hideFloatingProps();
                }
            }
        });
    }

    // ----- BẮT SỰ KIỆN THANH TUỲ BIẾN NỔI (PROPERTIES BAR) -----
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
        globalStyles.fillColor = hexToRgba(elFillColor.value, 0.15); // Luôn có độ trong suốt 15%
        globalStyles.lineWidth = parseInt(elLineSize.value);
        globalStyles.lineStyle = elLineStyle.value;
        if(currentSelectedOverlay.name === 'customText') globalStyles.textInput = elTextInput.value;

        global.tvChart.overrideOverlay({
            id: currentSelectedOverlay.id,
            extendData: globalStyles.textInput,
            styles: {
                line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle },
                text: { color: globalStyles.lineColor },
                polygon: { color: globalStyles.fillColor, borderColor: globalStyles.lineColor }
            }
        });
    }

    // Gắn event khi thay đổi giá trị
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

    document.getElementById('wa-prop-close').addEventListener('click', hideFloatingProps);

    function showFloatingProps() {
        if (!currentSelectedOverlay) return;
        propsBar.classList.add('show');
        
        // Hiện ô nhập chữ nếu là công cụ Custom Text
        if (currentSelectedOverlay.name === 'customText') {
            elTextWrapper.style.display = 'flex';
            elTextInput.value = currentSelectedOverlay.extendData || '';
            elTextInput.focus();
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
  // 7. AUTO-INJECTOR (MẮT THẦN GIÁM SÁT)
  // ======================================================
  function autoInjectSystem() {
    var container = document.getElementById('sc-chart-container');
    if (!container) return setTimeout(autoInjectSystem, 500);

    function checkAndInject() {
        injectCSS();
        registerProExtensions();

        var hasCanvas = container.querySelector('canvas');
        var hasSidebar = container.querySelector('.wa-pro-sidebar');

        if (hasCanvas && !hasSidebar) {
            // Tạo Wrapper bọc biểu đồ
            var chartWrapper = document.getElementById('sc-kline-wrapper');
            if (!chartWrapper) {
                chartWrapper = document.createElement('div');
                chartWrapper.id = 'sc-kline-wrapper';
                while (container.firstChild) chartWrapper.appendChild(container.firstChild);
                container.appendChild(chartWrapper);
            }

            // Chèn Sidebar
            var sidebar = document.createElement('div');
            sidebar.className = 'wa-pro-sidebar';
            sidebar.innerHTML = buildHTML();
            container.insertBefore(sidebar, chartWrapper);

            // Chèn Thanh Tuỳ biến nổi
            var propsBar = document.createElement('div');
            propsBar.className = 'wa-floating-props';
            propsBar.id = 'wa-props-bar';
            propsBar.innerHTML = buildFloatingPropsHTML();
            chartWrapper.appendChild(propsBar);

            bindSidebarEvents(sidebar, propsBar);
        }
    }

    checkAndInject();
    var observer = new MutationObserver(checkAndInject);
    observer.observe(container, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInjectSystem);
  else autoInjectSystem();

})(window);