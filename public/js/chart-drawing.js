// =========================================================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — ADVANCED FLOATING TOOLBAR (PRO VERSION)
// Date: 2026-04-04 | Version: 4.0.0
// Description: Drawing toolbar chuyên nghiệp cho KLineCharts v9
// =========================================================================

(function (global) {
    'use strict';
  
    const VERSION = '4.0.0';
    const LS_KEY  = 'wa_drawing_v3';
  
    // ======================================================
    // 🧠 TRẠNG THÁI (STATE)
    // ======================================================
    const DS = {
      stroke: '#00F0FF',
      fill: 'rgba(0,240,255,0.12)',
      lineSize: 2,
      lineStyle: 'solid',
      text: 'Gõ chú thích...',
      active: 'pointer',
      panelVis: true,
      collapsed: false,
      panelX: 20,
      panelY: 80,
      selectedOverlayId: null,
      allVis: true,
      allLocked: false,
      drawingStep: 0,
      drawingTotalStep: 0
    };
  
    const PRESETS = ['#00F0FF', '#F0B90B', '#0ECB81', '#F6465D', '#EAECEF', '#848e9c', '#cb55e3', '#FF8C00'];
  
    // ======================================================
    // 🧮 BỘ NÃO: ĐĂNG KÝ CÔNG CỤ VẼ CHUYÊN NGHIỆP
    // ======================================================
    function registerProTools() {
        const kc = global.klinecharts;
        if (!kc || typeof kc.registerOverlay !== 'function') return;
  
        // 1. VĂN BẢN (TEXT)
        kc.registerOverlay({
            name: 'customText', totalStep: 2,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates, overlay }) {
                if (coordinates.length === 0) return [];
                const txt = (overlay.extendData && overlay.extendData.text) ? overlay.extendData.text : DS.text;
                return [{ type: 'text', attrs: { x: coordinates[0].x, y: coordinates[0].y, text: txt, baseline: 'bottom' }, ignoreEvent: false }];
            }
        });
  
        // 2. SÓNG ELLIOTT (5 Bước - 6 Điểm)
        kc.registerOverlay({
            name: 'elliottImpulseWave', totalStep: 6,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let figures = [];
                let tags = ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'];
                
                // Vẽ đoạn thẳng với màu độc lập
                for (let i = 0; i < coordinates.length - 1; i++) { 
                    const isImpulse = (i % 2 === 0); // 0->1, 2->3, 4->5
                    figures.push({ 
                        type: 'line', 
                        attrs: { coordinates: [coordinates[i], coordinates[i + 1]] },
                        styles: { color: isImpulse ? '#0ECB81' : '#F6465D' }
                    });
                }
                // Text label
                coordinates.forEach((c, i) => { 
                    figures.push({ type: 'text', ignoreEvent: true, attrs: { x: c.x, y: c.y - 10, text: tags[i], baseline: 'bottom' }}); 
                });
                return figures;
            }
        });
  
        // 3. SÓNG ĐIỀU CHỈNH ABC (4 Điểm)
        kc.registerOverlay({
            name: 'elliottCorrectiveWave', totalStep: 4,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let figures = [];
                let tags = ['(0)', '(A)', '(B)', '(C)'];
                let colors = ['#F0B90B', 'rgba(255,255,255,0.4)', '#F0B90B']; // A, B, C
                
                for (let i = 0; i < coordinates.length - 1; i++) { 
                    figures.push({ 
                        type: 'line', 
                        attrs: { coordinates: [coordinates[i], coordinates[i + 1]] },
                        styles: { color: colors[i] }
                    }); 
                }
                coordinates.forEach((c, i) => { 
                    figures.push({ type: 'text', ignoreEvent: true, attrs: { x: c.x, y: c.y - 10, text: tags[i], baseline: 'bottom' }}); 
                });
                return figures;
            }
        });
  
        // 4. MẪU HÌNH XABCD (Harmonic - 5 Điểm)
        kc.registerOverlay({
            name: 'xabcd', totalStep: 5,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let figures = [];
                let tags = ['X', 'A', 'B', 'C', 'D'];
                
                // Lines
                for (let i = 0; i < coordinates.length - 1; i++) { 
                    figures.push({ type: 'line', attrs: { coordinates: [coordinates[i], coordinates[i + 1]] }}); 
                }
                // Polygons (Tô nền 2 tam giác)
                if (coordinates.length >= 3) figures.push({ type: 'polygon', attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2]] }, styles: { style: 'fill' }});
                if (coordinates.length >= 4) figures.push({ type: 'polygon', attrs: { coordinates: [coordinates[1], coordinates[2], coordinates[3]] }, styles: { style: 'fill' }});
                if (coordinates.length >= 5) figures.push({ type: 'polygon', attrs: { coordinates: [coordinates[2], coordinates[3], coordinates[4]] }, styles: { style: 'fill' }});
                
                // Labels & Text (Với Fibonacci Ratio)
                coordinates.forEach((c, i) => { 
                    figures.push({ type: 'text', ignoreEvent: true, attrs: { x: c.x, y: c.y - 10, text: tags[i], baseline: 'bottom' }, styles: { weight: 'bold' }}); 
                });
                return figures;
            }
        });
  
        // 5. FIBONACCI MỞ RỘNG (Extension - 3 Điểm)
        kc.registerOverlay({
            name: 'fibonacciExtension', totalStep: 4,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates, bounding }) {
                if (coordinates.length < 3) return [];
                const p1 = coordinates[0], p2 = coordinates[1], p3 = coordinates[2];
                const diff = p1.y - p2.y; 
                const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
                let figures = [];
                
                ratios.forEach(r => {
                    const y = p3.y - (diff * r);
                    const isGolden = (r === 0.618 || r === 1 || r === 1.618);
                    
                    figures.push({ 
                        type: 'line', 
                        attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] },
                        styles: { style: isGolden ? 'dashed' : 'solid', size: isGolden ? DS.lineSize + 1 : DS.lineSize }
                    });
                    figures.push({ type: 'text', ignoreEvent: true, attrs: { x: bounding.width - 50, y: y - 4, text: `${(r*100).toFixed(1)}%`, baseline: 'bottom' }});
                });
                
                figures.push({ type: 'line', attrs: { coordinates: [p1, p2] }, styles: { style: 'dashed', color: 'rgba(255,255,255,0.5)' } });
                figures.push({ type: 'line', attrs: { coordinates: [p2, p3] }, styles: { style: 'dashed', color: 'rgba(255,255,255,0.5)' } });
                return figures;
            }
        });
    }
  
    // ======================================================
    // 📚 DANH MỤC CÔNG CỤ VẼ
    // ======================================================
    const GROUPS = [
      {
        id: 'cursor', label: 'Con Trỏ', icon: '⬡',
        tools: [
          { id:'pointer', name:'Chọn / Di chuyển', shortcut: 'V', overlay:null, icon:'↖', pts:0, desc:'Chọn và di chuyển hình vẽ trên biểu đồ' },
          { id:'eraser',  name:'Xóa hình vẽ', shortcut: 'E', overlay:null, icon:'⌫', pts:0, desc:'Nhấp vào hình vẽ để xóa nhanh' },
        ]
      },
      {
        id: 'lines', label: 'Đường Kẻ', icon: '╱',
        tools: [
          { id:'segment',                name:'Đường xu hướng', shortcut: 'T', overlay:'segment',                icon:'╱', pts:2, desc:'Đoạn thẳng 2 điểm cơ bản' },
          { id:'horizontalStraightLine', name:'Đường ngang', shortcut: 'H', overlay:'horizontalStraightLine', icon:'─', pts:1, desc:'Xác định vùng hỗ trợ/kháng cự' },
          { id:'rayLine',                name:'Tia 1 chiều (Ray)', overlay:'rayLine', icon:'→', pts:2, desc:'Bắt đầu từ điểm A, kéo dài vô hạn' },
          { id:'arrow',                  name:'Mũi tên (Arrow)', overlay:'arrow', icon:'↗', pts:2, desc:'Đoạn thẳng có mũi tên chỉ hướng' },
        ]
      },
      {
        id: 'fibonacci', label: 'Fibonacci', icon: '⚏',
        tools: [
          { id:'fibonacciLine',      name:'Fib Thoái lui', shortcut: 'F', overlay:'fibonacciLine', icon:'⚏', pts:2, desc:'Các mức 23.6 / 38.2 / 50 / 61.8%' },
          { id:'fibonacciExtension', name:'Fib Mở rộng', overlay:'fibonacciExtension', icon:'📈', pts:3, desc:'3 điểm — Mức 127.2 / 161.8 / 261.8%' },
        ]
      },
      {
        id: 'patterns', label: 'Mẫu Hình', icon: '〰',
        tools: [
          { id:'elliottImpulseWave',    name:'Sóng Elliott (5 Bước)', overlay:'elliottImpulseWave', icon:'〰', pts:6, desc:'6 điểm — Sóng đẩy 1-2-3-4-5' },
          { id:'elliottCorrectiveWave', name:'Sóng Điều chỉnh (A-B-C)', overlay:'elliottCorrectiveWave', icon:'∿', pts:4, desc:'4 điểm — Sóng điều chỉnh A-B-C' },
          { id:'xabcd',                 name:'Mẫu hình XABCD Harmonic', overlay:'xabcd', icon:'X', pts:5, desc:'5 điểm — Bat / Gartley / Crab' },
        ]
      },
      {
        id: 'shapes', label: 'Hình Khối & Chữ', icon: '▭',
        tools: [
          { id:'rect',       name:'Hình chữ nhật', overlay:'rect', icon:'▭', pts:2, fill:true, desc:'Đánh dấu vùng Cung/Cầu' },
          { id:'circle',     name:'Hình tròn', overlay:'circle', icon:'○', pts:2, fill:true, desc:'Vòng tròn khoanh vùng giá' },
          { id:'customText', name:'Văn bản (Text)', overlay:'customText', icon:'T', pts:2, fill:false, desc:'Viết chữ và ghi chú lên biểu đồ' },
        ]
      },
    ];
  
    const TOOL_MAP = Object.create(null);
    GROUPS.forEach(g => g.tools.forEach(t => TOOL_MAP[t.id] = Object.assign({ groupId: g.id }, t)));
  
    // ======================================================
    // 🎨 CSS CHO GIAO DIỆN VÀ CON TRỎ CHUỘT
    // ======================================================
    function injectCSS() {
      if (document.getElementById('wa-draw-css')) return;
      const s = document.createElement('style');
      s.id = 'wa-draw-css';
      s.textContent = `
        :root { --wa-bg: rgba(18, 22, 28, 0.97); --wa-brd: rgba(255,255,255,0.08); --wa-cyan: #00F0FF; --wa-text: #EAECEF; --wa-gray: #848e9c; }
        #wa-ft { position:absolute; top:80px; left:20px; z-index:9000; display:flex; font-family: 'Inter', system-ui, sans-serif; transition:opacity .2s, transform .2s; }
        #wa-ft.wa-hidden { opacity:0; pointer-events:none; transform:scale(0.9); }
        
        /* Toolbar chính */
        #wa-tb { width: 44px; display:flex; flex-direction:column; border-radius:14px; background:var(--wa-bg); border:1px solid var(--wa-brd); box-shadow:0 16px 56px rgba(0,0,0,0.8); backdrop-filter:blur(18px); user-select:none; }
        #wa-ft.wa-collapsed #wa-tb-body, #wa-ft.wa-collapsed #wa-tb-actions { display:none!important; }
        #wa-ft.wa-collapsed #wa-tb { border-radius:30px; }
        
        #wa-ft-grip { display:flex; align-items:center; justify-content:center; padding:8px 0; cursor:move; border-bottom:1px solid var(--wa-brd); }
        #wa-ft-collapse { background:transparent; color:var(--wa-gray); border:none; cursor:pointer; font-size:16px; transition:0.2s; }
        #wa-ft-collapse:hover { color:#fff; }
        
        #wa-tb-body { display:flex; flex-direction:column; padding:6px; gap:4px; }
        .wa-btn { width:32px; height:32px; border-radius:8px; background:transparent; color:var(--wa-gray); border:1px solid transparent; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.15s; position:relative; }
        .wa-btn:hover { background:rgba(255,255,255,0.08); color:var(--wa-text); }
        .wa-btn.wa-act { background:rgba(0,240,255,0.15); color:var(--wa-cyan); border-color:rgba(0,240,255,0.4); box-shadow: 0 0 10px rgba(0,240,255,0.2); }
        
        /* Sub-panel (Thay cho hover menu) */
        #wa-subpanel { position:absolute; left:50px; top:0; background:var(--wa-bg); border:1px solid var(--wa-brd); border-radius:12px; padding:8px; display:none; flex-direction:column; gap:4px; width: max-content; box-shadow:0 8px 32px rgba(0,0,0,0.8); }
        #wa-subpanel.wa-open { display:flex; }
        .wa-sub-item { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; cursor:pointer; color:var(--wa-text); transition:0.15s; }
        .wa-sub-item:hover { background:rgba(255,255,255,0.08); }
        .wa-sub-icon { width:20px; text-align:center; font-size:14px; }
        .wa-sub-text { display:flex; flex-direction:column; }
        .wa-sub-name { font-size:11px; font-weight:600; }
        .wa-sub-desc { font-size:10px; color:var(--wa-gray); margin-top:2px; }
        .wa-pts-badge { position:absolute; bottom:2px; right:2px; font-size:8px; background:var(--wa-gray); color:#000; padding:0 3px; border-radius:4px; font-weight:bold; }
        .wa-key-badge { margin-left:auto; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-size:9px; color:var(--wa-gray); }
  
        /* Properties Panel */
        #wa-props { position:absolute; left:50px; top:50px; background:var(--wa-bg); border:1px solid var(--wa-brd); border-radius:12px; padding:12px; display:none; flex-direction:column; gap:10px; width: 220px; box-shadow:0 8px 32px rgba(0,0,0,0.8); }
        #wa-props.wa-show { display:flex; }
        .wa-row { display:flex; align-items:center; gap:8px; justify-content:space-between; }
        .wa-lbl { font-size:11px; color:var(--wa-gray); }
        .wa-picker { position:relative; width:24px; height:24px; border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.2); }
        .wa-picker input { position:absolute; width:200%; height:200%; top:-50%; left:-50%; cursor:pointer; }
        .wa-picker div { width:100%; height:100%; pointer-events:none; }
        .wa-dot { width:16px; height:16px; border-radius:4px; cursor:pointer; border:1px solid rgba(255,255,255,0.2); }
        .wa-input { flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; padding:6px; font-size:11px; outline:none; }
        
        #wa-tb-actions { display:flex; flex-direction:column; padding:6px; border-top:1px solid var(--wa-brd); gap:4px; }
        
        /* Trạng thái Canvas & Toast */
        .wa-drawing-mode canvas { cursor: crosshair !important; }
        .wa-eraser-mode canvas { cursor: cell !important; }
        
        #wa-toast { position:fixed; bottom:20px; right:20px; background:rgba(14,203,129,0.2); border:1px solid #0ECB81; color:#fff; padding:8px 16px; border-radius:8px; font-size:12px; transform:translateX(150%); transition:0.3s ease; z-index:9999; }
        #wa-toast.wa-show { transform:translateX(0); }
      `;
      document.head.appendChild(s);
    }
  
    // ======================================================
    // 🏗️ XÂY DỰNG GIAO DIỆN HTML
    // ======================================================
    function buildHTML() {
      // Toolbar chính
      let h = `<div id="wa-tb">
                <div id="wa-ft-grip"><button id="wa-ft-collapse" onclick="WaveDrawingAPI._collapse()">≡</button></div>
                <div id="wa-tb-body">`;
      
      GROUPS.forEach(g => {
        const isMulti = g.tools.length > 1;
        const mainTool = g.tools[0];
        h += `<button class="wa-btn" id="wa-grp-${g.id}" onclick="WaveDrawingAPI._openSubPanel('${g.id}', event)">
                ${mainTool.icon}
                ${isMulti ? `<span style="position:absolute; bottom:2px; right:2px; font-size:6px;">▶</span>` : ''}
              </button>`;
      });
  
      h += `</div><div id="wa-tb-actions">
              <button class="wa-btn" onclick="WaveDrawingAPI.undo()" title="Undo (Ctrl+Z)">↩</button>
              <button class="wa-btn" onclick="WaveDrawingAPI.toggleVis()" title="Ẩn/Hiện">👁</button>
              <button class="wa-btn" onclick="WaveDrawingAPI.toggleLock()" title="Khóa/Mở Khóa">🔒</button>
              <button class="wa-btn" style="color:#F6465D" onclick="WaveDrawingAPI.deleteAll()" title="Xóa tất cả">🗑</button>
            </div></div>`;
  
      // Sub-Panel động
      h += `<div id="wa-subpanel"></div>`;
  
      // Properties Panel
      const dots = PRESETS.map(c => `<div class="wa-dot" style="background:${c};" onclick="WaveDrawingAPI._preset('${c}')"></div>`).join('');
      h += `<div id="wa-props">
              <div class="wa-row" style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
                <span id="wa-prop-title" style="font-weight:bold; font-size:12px; color:#00F0FF;">Thuộc tính</span>
                <span id="wa-prop-step" style="font-size:10px; color:#F0B90B;"></span>
              </div>
              <input type="text" id="wa-prop-txt" class="wa-input" placeholder="Nhập văn bản..." oninput="WaveDrawingAPI._textIn(this.value)" style="display:none;">
              <div class="wa-row">
                <span class="wa-lbl">Nét:</span><div class="wa-picker"><div id="wa-sw-str"></div><input type="color" oninput="WaveDrawingAPI._strokeIn(this.value)"></div>
                <span class="wa-lbl">Nền:</span><div class="wa-picker"><div id="wa-sw-fil"></div><input type="color" oninput="WaveDrawingAPI._fillIn(this.value)"></div>
              </div>
              <div class="wa-row" style="gap:4px;">${dots}</div>
              <div class="wa-row">
                <select class="wa-input" id="wa-sel-sz" onchange="WaveDrawingAPI._szIn(this.value)"><option value="1">1px</option><option value="2">2px</option><option value="3">3px</option></select>
                <select class="wa-input" id="wa-sel-ls" onchange="WaveDrawingAPI._lsIn(this.value)"><option value="solid">Liền</option><option value="dashed">Đứt</option><option value="dotted">Chấm</option></select>
              </div>
              <div class="wa-row">
                <button class="wa-input" style="background:rgba(0,240,255,0.1); color:#00F0FF;" onclick="WaveDrawingAPI._applyToSelected()">Áp dụng</button>
                <button class="wa-input" style="background:rgba(255,255,255,0.1);" onclick="WaveDrawingAPI._cloneSelected()">Nhân bản</button>
              </div>
            </div>`;
  
      h += `<div id="wa-toast"></div>`;
      return h;
    }
  
    // ======================================================
    // 🎮 KÍCH HOẠT CÔNG CỤ (0ms DELAY)
    // ======================================================
    function activate(toolId) {
      const tool = TOOL_MAP[toolId];
      if (!tool) return;
      DS.active = toolId;
      DS.drawingStep = 0;
      DS.drawingTotalStep = tool.pts;
      
      const isAction = (toolId === 'pointer' || toolId === 'eraser');
  
      // UI Update
      document.querySelectorAll('.wa-btn[id^="wa-grp-"]').forEach(b => b.classList.remove('wa-act'));
      const grpBtn = document.getElementById('wa-grp-' + tool.groupId);
      if (grpBtn) { 
          grpBtn.classList.add('wa-act');
          grpBtn.innerHTML = `${tool.icon} ${GROUPS.find(g=>g.id===tool.groupId).tools.length>1 ? '<span style="position:absolute; bottom:2px; right:2px; font-size:6px;">▶</span>' : ''}`;
      }
      document.getElementById('wa-subpanel').classList.remove('wa-open');
  
      const props = document.getElementById('wa-props');
      const chartContainer = document.getElementById('sc-chart-container');
      
      if (chartContainer) {
          chartContainer.classList.remove('wa-drawing-mode', 'wa-eraser-mode');
          if (toolId === 'eraser') chartContainer.classList.add('wa-eraser-mode');
          else if (!isAction) chartContainer.classList.add('wa-drawing-mode');
      }
  
      if (isAction) {
          props.classList.remove('wa-show');
          if (global.tvChart) global.tvChart.cancelDrawing();
      } else {
          props.classList.add('wa-show');
          document.getElementById('wa-prop-title').innerText = tool.name;
          document.getElementById('wa-prop-step').innerText = `Click để vẽ (0/${tool.pts})`;
          document.getElementById('wa-prop-txt').style.display = (toolId === 'customText') ? 'block' : 'none';
          document.getElementById('wa-prop-txt').value = DS.text;
  
          // Gửi lệnh vẽ tới KLineCharts
          if (global.tvChart) {
              global.tvChart.cancelDrawing();
              const styles = {
                  line: { color: DS.stroke, size: DS.lineSize, style: DS.lineStyle },
                  polygon: { color: tool.fill ? DS.fill : 'transparent', style: 'fill', borderColor: DS.stroke, borderSize: DS.lineSize },
                  text: { color: DS.stroke, size: 12, family: 'Inter' }
              };
              global.tvChart.createOverlay({ name: tool.overlay, lock: false, visible: true, styles, extendData: { text: DS.text } });
          }
      }
    }
  
    // ======================================================
    // 🎯 EVENTS & UX (KLineCharts, Keyboard, Drag)
    // ======================================================
    function subscribeEvents() {
      let poll = setInterval(() => {
        if (!global.tvChart) return;
        clearInterval(poll);
  
        // Tiến trình vẽ
        global.tvChart.subscribeAction('onDrawing', (params) => {
            DS.drawingStep++;
            const stepTxt = document.getElementById('wa-prop-step');
            if (stepTxt) stepTxt.innerText = `Bước ${DS.drawingStep}/${DS.drawingTotalStep}`;
        });
  
        // Vẽ xong
        global.tvChart.subscribeAction('onDrawEnd', (params) => { 
            const chartContainer = document.getElementById('sc-chart-container');
            if (chartContainer) chartContainer.classList.remove('wa-drawing-mode');
            showToast(`✓ Đã vẽ ${TOOL_MAP[DS.active].name}`);
            setTimeout(() => activate('pointer'), 50); 
        });
  
        // Tương tác Overlay (Click)
        global.tvChart.subscribeAction('onOverlayClick', (params) => {
            if (DS.active === 'eraser') {
                global.tvChart.removeOverlay({ id: params.overlay.id });
                showToast(`Đã xóa hình vẽ`);
                activate('pointer');
            } else {
                DS.selectedOverlayId = params.overlay.id;
                document.getElementById('wa-props').classList.add('wa-show');
                document.getElementById('wa-prop-title').innerText = 'Chỉnh sửa Hình';
                document.getElementById('wa-prop-step').innerText = '';
                
                if (params.overlay.name === 'customText') {
                    document.getElementById('wa-prop-txt').style.display = 'block';
                    document.getElementById('wa-prop-txt').value = params.overlay.extendData?.text || '';
                } else {
                    document.getElementById('wa-prop-txt').style.display = 'none';
                }
            }
        });
      }, 500);
  
      // Drag UI (Giới hạn trong viewport)
      const ft = document.getElementById('wa-ft');
      const grip = document.getElementById('wa-ft-grip');
      let drag = false, ox = 0, oy = 0;
      
      grip.onmousedown = (e) => { 
          if(e.target.id!=='wa-ft-collapse') { drag = true; ox = e.clientX - ft.offsetLeft; oy = e.clientY - ft.offsetTop; } 
      };
      document.onmousemove = (e) => { 
          if(drag) { 
              let nx = e.clientX - ox, ny = e.clientY - oy;
              // Snap to edge
              if(nx < 20) nx = 20; if(ny < 20) ny = 20;
              if(nx > window.innerWidth - 60) nx = window.innerWidth - 60;
              if(ny > window.innerHeight - 200) ny = window.innerHeight - 200;
              
              ft.style.left = nx + 'px'; ft.style.top = ny + 'px'; 
              DS.panelX = nx; DS.panelY = ny; 
          }
      };
      document.onmouseup = () => { if(drag){ drag = false; localStorage.setItem(LS_KEY, JSON.stringify(DS)); }};
  
      // Đóng subpanel khi click ngoài
      document.addEventListener('click', e => { 
          if (!e.target.closest('#wa-tb') && !e.target.closest('#wa-subpanel')) {
              document.getElementById('wa-subpanel').classList.remove('wa-open');
          }
      });
  
      // Phím tắt (Keyboard Shortcuts)
      document.addEventListener('keydown', (e) => {
          // Bỏ qua nếu đang gõ text input
          if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          
          if (e.key === 'v' || e.key === 'V' || e.key === 'Escape') activate('pointer');
          if (e.key === 'e' || e.key === 'E') activate('eraser');
          if (e.key === 't' || e.key === 'T') activate('segment');
          if (e.key === 'h' || e.key === 'H') activate('horizontalStraightLine');
          if (e.key === 'f' || e.key === 'F') activate('fibonacciLine');
          if ((e.key === 'Delete' || e.key === 'Backspace') && DS.selectedOverlayId && DS.active === 'pointer') {
              global.tvChart.removeOverlay({ id: DS.selectedOverlayId });
              document.getElementById('wa-props').classList.remove('wa-show');
              DS.selectedOverlayId = null;
              showToast('Đã xóa hình được chọn');
          }
          if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) WaveDrawingAPI.undo();
      });
    }
  
    function syncPropsUI() {
      document.getElementById('wa-sw-str').style.background = DS.stroke;
      document.getElementById('wa-sw-fil').style.background = DS.fill;
      document.getElementById('wa-sel-sz').value = DS.lineSize;
      document.getElementById('wa-sel-ls').value = DS.lineStyle;
    }
  
    function showToast(msg) {
        const toast = document.getElementById('wa-toast');
        if(!toast) return;
        toast.innerText = msg;
        toast.classList.add('wa-show');
        setTimeout(() => toast.classList.remove('wa-show'), 1500);
    }
  
    // ======================================================
    // 🔌 PUBLIC API
    // ======================================================
    global.WaveDrawingAPI = {
      init: function() { 
          injectCSS(); 
          Object.assign(DS, JSON.parse(localStorage.getItem(LS_KEY)||'{}')); 
          
          if (!document.getElementById('wa-ft')) {
              registerProTools();
              const container = document.getElementById('sc-chart-container');
              if (!container) { setTimeout(WaveDrawingAPI.init, 500); return; }
  
              const div = document.createElement('div');
              div.id = 'wa-ft';
              div.innerHTML = buildHTML();
              container.appendChild(div);
  
              div.style.left = DS.panelX + 'px'; div.style.top = DS.panelY + 'px';
              if (!DS.panelVis) div.classList.add('wa-hidden');
  
              syncPropsUI();
              subscribeEvents();
          }
      },
      
      _collapse: function() { 
          DS.collapsed = !DS.collapsed; 
          document.getElementById('wa-ft').classList.toggle('wa-collapsed', DS.collapsed); 
      },
      
      _openSubPanel: function(groupId, e) {
          e.stopPropagation();
          const g = GROUPS.find(x => x.id === groupId);
          const panel = document.getElementById('wa-subpanel');
          
          if(g.tools.length === 1) {
              panel.classList.remove('wa-open');
              activate(g.tools[0].id);
              return;
          }
  
          let html = '';
          g.tools.forEach(t => {
              html += `<div class="wa-sub-item" onclick="WaveDrawingAPI.setTool('${t.id}')">
                          <span class="wa-sub-icon">${t.icon}</span>
                          <div class="wa-sub-text">
                              <span class="wa-sub-name">${t.name}</span>
                              <span class="wa-sub-desc">${t.desc}</span>
                          </div>
                          ${t.shortcut ? `<span class="wa-key-badge">${t.shortcut}</span>` : ''}
                       </div>`;
          });
          panel.innerHTML = html;
          panel.style.top = document.getElementById('wa-grp-' + groupId).offsetTop + 'px';
          panel.classList.add('wa-open');
      },
  
      setTool: function(toolId) { activate(toolId); },
      
      _strokeIn: function(v) { DS.stroke = v; syncPropsUI(); },
      _fillIn: function(v) { 
          DS.fill = v.replace('#',''); 
          DS.fill = `rgba(${parseInt(DS.fill.slice(0,2),16)},${parseInt(DS.fill.slice(2,4),16)},${parseInt(DS.fill.slice(4,6),16)},0.15)`; 
          syncPropsUI(); 
      },
      _textIn: function(v) { DS.text = v; },
      _preset: function(v) { this._strokeIn(v); this._fillIn(v); },
      _szIn: function(v) { DS.lineSize = parseInt(v); },
      _lsIn: function(v) { DS.lineStyle = v; },
      
      _applyToSelected: function() {
          if (!global.tvChart || !DS.selectedOverlayId) return;
          global.tvChart.overrideOverlay({
              id: DS.selectedOverlayId,
              extendData: { text: DS.text },
              styles: {
                  line: { color: DS.stroke, size: DS.lineSize, style: DS.lineStyle },
                  polygon: { color: DS.fill, style: 'fill', borderColor: DS.stroke, borderSize: DS.lineSize },
                  text: { color: DS.stroke, size: 12, family: 'Inter' }
              }
          });
          showToast('Đã cập nhật hình vẽ');
      },
  
      _cloneSelected: function() { /* Logic clone tùy vào klinecharts version, hiện cần lấy thông tin data từ getOverlayById */ showToast('Tính năng nhân bản đang cập nhật'); },
  
      undo: function() { if(global.tvChart && global.tvChart.undoOverlay) { global.tvChart.undoOverlay(); showToast('Đã hoàn tác'); } },
      toggleVis: function() { DS.allVis = !DS.allVis; if(global.tvChart) global.tvChart.overrideOverlay({visible: DS.allVis}); },
      toggleLock: function() { DS.allLocked = !DS.allLocked; if(global.tvChart) global.tvChart.overrideOverlay({lock: DS.allLocked}); showToast(DS.allLocked ? 'Đã khóa tất cả' : 'Đã mở khóa'); },
      deleteAll: function() { if(global.tvChart && confirm('Bạn có chắc chắn muốn xóa tất cả hình vẽ?')) { global.tvChart.removeAllOverlay(); showToast('Đã xóa toàn bộ'); document.getElementById('wa-props').classList.remove('wa-show'); } }
    };
  
    // Khởi tạo tự động
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(WaveDrawingAPI.init, 500));
    else setTimeout(WaveDrawingAPI.init, 500);
  
  })(window);