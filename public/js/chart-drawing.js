// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — ADVANCED FLOATING TOOLBAR
// Version: 3.0.0 | Perfect Pro UI/UX + Extensions
// ==========================================

(function (global) {
  'use strict';

  const VERSION = '3.0.0';
  const LS_KEY  = 'wa_drawing_v3';

  // ======================================================
  // 🧠 BỘ NÃO: ĐĂNG KÝ CÔNG CỤ VẼ CHUYÊN NGHIỆP
  // ======================================================
  function registerProTools() {
      const kc = global.klinecharts;
      if (!kc || typeof kc.registerOverlay !== 'function') return;

      // 1. VĂN BẢN (TEXT) - Hỗ trợ sửa chữ qua extendData
      kc.registerOverlay({
          name: 'customText', totalStep: 2,
          needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function({ coordinates, overlay }) {
              if (coordinates.length === 0) return [];
              const txt = (overlay.extendData && overlay.extendData.text) ? overlay.extendData.text : 'Gõ chữ vào đây...';
              return [{
                  type: 'text',
                  attrs: { x: coordinates[0].x, y: coordinates[0].y, text: txt, baseline: 'bottom' },
                  ignoreEvent: false
              }];
          }
      });

      // 2. SÓNG ELLIOTT (5 Bước - 6 Điểm)
      kc.registerOverlay({
          name: 'elliottImpulseWave', totalStep: 6,
          needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function({ coordinates }) {
              let lines = [], texts = [];
              let tags = ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'];
              for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
              coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
              return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
          }
      });

      // 3. SÓNG ĐIỀU CHỈNH ABC (4 Điểm)
      kc.registerOverlay({
          name: 'elliottCorrectiveWave', totalStep: 4,
          needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function({ coordinates }) {
              let lines = [], texts = [];
              let tags = ['(0)', '(A)', '(B)', '(C)'];
              for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
              coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
              return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
          }
      });

      // 4. MẪU HÌNH XABCD (Harmonic - 5 Điểm)
      kc.registerOverlay({
          name: 'xabcd', totalStep: 5,
          needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function({ coordinates }) {
              let lines = [], texts = [], polygons = [];
              let tags = ['X', 'A', 'B', 'C', 'D'];
              for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
              if (coordinates.length >= 3) polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] });
              if (coordinates.length >= 4) polygons.push({ coordinates: [coordinates[1], coordinates[2], coordinates[3]] });
              if (coordinates.length >= 5) polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] });
              coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
              return [
                  { type: 'polygon', attrs: polygons, styles: { style: 'fill' } },
                  { type: 'line', attrs: lines },
                  { type: 'text', ignoreEvent: true, attrs: texts }
              ];
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
              let lines = [], texts = [];
              ratios.forEach(r => {
                  const y = p3.y - (diff * r);
                  lines.push({ coordinates: [{ x: 0, y }, { x: bounding.width, y }] });
                  texts.push({ x: 0, y: y - 2, text: `Fib Ext ${r}`, baseline: 'bottom' });
              });
              lines.push({ coordinates: [p1, p2] });
              lines.push({ coordinates: [p2, p3] });
              return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
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
        { id:'pointer', name:'Chọn / Di chuyển', overlay:null, icon:'↖', pts:0, desc:'Chọn và di chuyển hình vẽ trên biểu đồ' },
        { id:'eraser',  name:'Xóa hình vẽ',      overlay:null, icon:'⌫', pts:0, desc:'Nhấp vào hình vẽ để xóa nhanh' },
      ]
    },
    {
      id: 'lines', label: 'Đường Kẻ', icon: '╱',
      tools: [
        { id:'segment',                name:'Đường xu hướng (Trendline)', overlay:'segment',                icon:'╱', pts:2, desc:'Đoạn thẳng 2 điểm cơ bản' },
        { id:'rayLine',                name:'Tia 1 chiều (Ray)',          overlay:'rayLine',                icon:'→', pts:2, desc:'Bắt đầu từ điểm A, kéo dài vô hạn' },
        { id:'horizontalStraightLine', name:'Đường ngang vô hạn',         overlay:'horizontalStraightLine', icon:'─', pts:1, desc:'Xác định vùng hỗ trợ/kháng cự' },
        { id:'horizontalRayLine',      name:'Tia ngang 1 chiều',          overlay:'horizontalRayLine',      icon:'⟶', pts:2, desc:'Đường ngang kéo dài về 1 phía' },
        { id:'verticalStraightLine',   name:'Đường dọc vô hạn',           overlay:'verticalStraightLine',   icon:'│', pts:1, desc:'Đánh dấu mốc thời gian quan trọng' },
        { id:'arrow',                  name:'Mũi tên (Arrow)',            overlay:'arrow',                  icon:'↗', pts:2, desc:'Đoạn thẳng có mũi tên chỉ hướng' },
      ]
    },
    {
      id: 'fibonacci', label: 'Fibonacci', icon: '⚏',
      tools: [
        { id:'fibonacciLine',      name:'Fib Thoái lui (Retracement)', overlay:'fibonacciLine',      icon:'⚏', pts:2, desc:'Các mức 23.6 / 38.2 / 50 / 61.8%' },
        { id:'fibonacciExtension', name:'Fib Mở rộng (Extension)',     overlay:'fibonacciExtension', icon:'📈', pts:3, desc:'3 điểm — Mức 127.2 / 161.8 / 261.8%' },
      ]
    },
    {
      id: 'patterns', label: 'Mẫu Hình', icon: '〰',
      tools: [
        { id:'elliottImpulseWave',    name:'Sóng Elliott (5 Bước)',   overlay:'elliottImpulseWave',    icon:'〰', pts:6, desc:'6 điểm — Sóng đẩy 1-2-3-4-5' },
        { id:'elliottCorrectiveWave', name:'Sóng Điều chỉnh (A-B-C)', overlay:'elliottCorrectiveWave', icon:'∿',  pts:4, desc:'4 điểm — Sóng điều chỉnh A-B-C' },
        { id:'xabcd',                 name:'Mẫu hình XABCD Harmonic', overlay:'xabcd',                 icon:'X',  pts:5, desc:'5 điểm — Bat / Gartley / Crab' },
        { id:'priceChannelLine',      name:'Kênh song song',          overlay:'priceChannelLine',      icon:'⇋', pts:3, desc:'Kênh xu hướng song song' },
      ]
    },
    {
      id: 'shapes', label: 'Hình Khối & Chữ', icon: '▭',
      tools: [
        { id:'rect',       name:'Hình chữ nhật (Rectangle)', overlay:'rect',       icon:'▭', pts:2, fill:true, desc:'Đánh dấu vùng Cung/Cầu (Supply/Demand)' },
        { id:'circle',     name:'Hình tròn (Circle)',        overlay:'circle',     icon:'○', pts:2, fill:true, desc:'Vòng tròn khoanh vùng giá' },
        { id:'triangle',   name:'Hình tam giác (Triangle)',  overlay:'triangle',   icon:'△', pts:3, fill:true, desc:'Mẫu hình tam giác' },
        { id:'customText', name:'Văn bản (Text)',            overlay:'customText', icon:'T', pts:2, fill:false,desc:'Viết chữ và ghi chú lên biểu đồ' },
      ]
    },
  ];

  const TOOL_MAP = Object.create(null);
  GROUPS.forEach(g => g.tools.forEach(t => TOOL_MAP[t.id] = Object.assign({ groupId: g.id }, t)));

  // ======================================================
  // ⚙️ TRẠNG THÁI HIỆN TẠI
  // ======================================================
  const PRESETS = ['#00F0FF','#F0B90B','#0ECB81','#F6465D','#EAECEF','#848e9c','#cb55e3','#FF8C00'];
  const DS = {
    stroke: '#00F0FF', fill: 'rgba(0,240,255,0.12)',
    lineSize: 2, lineStyle: 'solid', text: 'Gõ chữ...',
    active: 'pointer', count: 0,
    panelVis: true, collapsed: false, panelX: 20, panelY: 80, inited: false,
    selectedOverlayId: null 
  };

  // ======================================================
  // 🎨 CSS CHO GIAO DIỆN
  // ======================================================
  function injectCSS() {
    if (document.getElementById('wa-draw-css')) return;
    const s = document.createElement('style');
    s.id = 'wa-draw-css';
    s.textContent = `
      #wa-ft { position:absolute; top:80px; left:20px; z-index:9000; display:flex; flex-direction:column; border-radius:14px; background:rgba(18, 22, 28, 0.96); border:1px solid rgba(255,255,255,0.09); box-shadow:0 16px 56px rgba(0,0,0,0.8); backdrop-filter:blur(18px); user-select:none; transition:opacity .2s, transform .2s; }
      #wa-ft.wa-hidden { opacity:0; pointer-events:none; transform:scale(0.9); }
      #wa-ft.wa-collapsed #wa-ft-body, #wa-ft.wa-collapsed #wa-ft-props { display:none!important; }
      #wa-ft.wa-collapsed { border-radius:30px; }
      #wa-ft-grip { display:flex; align-items:center; padding:8px; cursor:move; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.06); border-radius:14px 14px 0 0; }
      #wa-ft-grip-label { font-size:10px; font-weight:800; color:rgba(255,255,255,0.3); flex:1; pointer-events:none; padding-left:4px; letter-spacing: 1px; }
      #wa-ft-collapse { width:24px; height:24px; background:transparent; color:#848e9c; border:none; cursor:pointer; border-radius:6px; transition:0.2s; }
      #wa-ft-collapse:hover { background:rgba(255,255,255,0.1); color:#fff; }
      #wa-ft-body { display:flex; flex-direction:column; padding:6px; gap:4px; }
      .wa-fg { position:relative; display:flex; justify-content:center; }
      .wa-fb { width:34px; height:34px; border-radius:8px; background:transparent; color:#848e9c; border:1px solid transparent; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.15s; position:relative; }
      .wa-fb:hover { background:rgba(255,255,255,0.08); color:#fff; }
      .wa-fb.wa-act { background:rgba(0,240,255,0.15); color:#00F0FF; border-color:rgba(0,240,255,0.4); }
      .wa-hafly::after { content:""; position:absolute; bottom:4px; right:4px; width:4px; height:4px; border-right:1.5px solid #848e9c; border-bottom:1.5px solid #848e9c; pointer-events:none; }
      .wa-ftip { position:absolute; left:44px; top:50%; transform:translateY(-50%); background:#000; border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:6px 10px; font-size:11px; color:#fff; white-space:nowrap; opacity:0; pointer-events:none; transition:0.2s; z-index:100; }
      .wa-fb:hover .wa-ftip { opacity:1; }
      .wa-fly { position:absolute; left:44px; top:-4px; background:#12161c; border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px; min-width:260px; z-index:10001; box-shadow:0 16px 40px rgba(0,0,0,0.9); display:none; flex-direction:column; gap:2px; }
      .wa-fly.wa-open { display:flex; }
      .wa-fly-hd { font-size:10px; font-weight:800; color:#848e9c; margin-bottom:6px; text-transform:uppercase; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; }
      .wa-fi { display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; cursor:pointer; color:#c8cdd4; transition:0.15s; }
      .wa-fi:hover { background:rgba(255,255,255,0.06); color:#fff; }
      .wa-fi.wa-act { background:rgba(0,240,255,0.1); color:#00F0FF; }
      .wa-fi-ic { font-size:14px; width:24px; text-align:center; }
      .wa-fi-nm { display:block; font-size:12px; font-weight:600; }
      .wa-fi-ds { display:block; font-size:10px; color:#848e9c; margin-top:2px; }
      #wa-ft-actions { display:flex; padding:6px; border-top:1px solid rgba(255,255,255,0.06); gap:4px; justify-content:space-between; }
      .wa-fa { flex:1; height:28px; border-radius:6px; background:transparent; color:#848e9c; border:none; cursor:pointer; font-size:14px; transition:0.15s; }
      .wa-fa:hover { background:rgba(255,255,255,0.1); color:#fff; }
      .wa-fa.wa-red:hover { background:rgba(246,70,93,0.15); color:#F6465D; }
      #wa-ft-props { display:none; flex-direction:column; padding:12px; border-top:1px solid rgba(255,255,255,0.06); gap:10px; width: 220px; }
      #wa-ft-props.wa-show { display:flex; }
      .wa-pp-row { display:flex; align-items:center; gap:8px; justify-content:space-between;}
      .wa-pp-lbl { font-size:11px; color:#848e9c; width:36px;}
      .wa-pp-clr { position:relative; width:24px; height:24px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); overflow:hidden; cursor:pointer; }
      .wa-pp-clr input { position:absolute; width:200%; height:200%; top:-50%; left:-50%; cursor:pointer; }
      .wa-pp-sw { width:100%; height:100%; }
      .wa-pp-dot { width:16px; height:16px; border-radius:4px; cursor:pointer; border:1px solid rgba(255,255,255,0.2); transition:0.15s; }
      .wa-pp-dot:hover { transform:scale(1.2); }
      .wa-pp-sel { flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; padding:6px; font-size:11px; outline:none; }
      .wa-pp-text { width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#fff; padding:6px 8px; font-size:12px; outline:none; }
      .wa-pp-btn { flex:1; padding:6px; background:rgba(0,240,255,0.1); color:#00F0FF; border:1px solid rgba(0,240,255,0.3); border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer; }
    `;
    document.head.appendChild(s);
  }

  // ======================================================
  // 🏗️ XÂY DỰNG GIAO DIỆN HTML
  // ======================================================
  function buildHTML() {
    let h = '<div id="wa-ft-grip"><span id="wa-ft-grip-label">CÔNG CỤ</span><button id="wa-ft-collapse" onclick="WaveDrawingAPI._collapse()">—</button></div>';
    h += '<div id="wa-ft-body">';
    GROUPS.forEach(g => {
      h += `<div class="wa-fg" data-grp="${g.id}">
              <button class="wa-fb ${g.tools.length>1 ? 'wa-hafly':''}" id="wa-fg-${g.id}" data-tool="${g.tools[0].id}" onclick="WaveDrawingAPI._grpClick(event,'${g.id}')" onmouseenter="WaveDrawingAPI._grpHover(event,'${g.id}')">
                ${g.tools[0].icon}<span class="wa-ftip">${g.label}</span>
              </button>
              ${g.tools.length>1 ? buildFlyHTML(g) : ''}
            </div>`;
    });
    h += '</div>' + buildPropsHTML() + '<div id="wa-ft-actions"><button class="wa-fa" onclick="WaveDrawingAPI.undo()" title="Hoàn tác">↩</button><button class="wa-fa" onclick="WaveDrawingAPI.toggleVis()" title="Ẩn/Hiện">👁</button><button class="wa-fa wa-red" onclick="WaveDrawingAPI.deleteAll()" title="Xóa tất cả">🗑</button></div>';
    return h;
  }

  function buildFlyHTML(g) {
    let h = `<div class="wa-fly" id="wa-fly-${g.id}"><div class="wa-fly-hd">${g.label}</div>`;
    g.tools.forEach(t => {
      h += `<div class="wa-fi" data-tool="${t.id}" onclick="WaveDrawingAPI._toolClick('${t.id}',event)">
              <span class="wa-fi-ic">${t.icon}</span>
              <span class="wa-fi-info"><span class="wa-fi-nm">${t.name}</span><span class="wa-fi-ds">${t.desc}</span></span>
            </div>`;
    });
    return h += '</div>';
  }

  function buildPropsHTML() {
    const dots = PRESETS.map(c => `<div class="wa-pp-dot" style="background:${c};" onclick="WaveDrawingAPI._preset('${c}')"></div>`).join('');
    return `
      <div id="wa-ft-props">
        <div style="font-size:12px; font-weight:bold; color:#00F0FF; margin-bottom:4px;" id="wa-pp-nm">—</div>
        
        <input type="text" id="wa-pp-textinput" class="wa-pp-text" placeholder="Nhập văn bản hiển thị..." oninput="WaveDrawingAPI._textIn(this.value)" style="display:none;">

        <div class="wa-pp-row">
          <span class="wa-pp-lbl">Màu:</span>
          <div class="wa-pp-clr"><div class="wa-pp-sw" id="wa-sw-stroke"></div><input type="color" id="wa-ci-stroke" oninput="WaveDrawingAPI._strokeIn(this.value)"></div>
          <span class="wa-pp-lbl">Nền:</span>
          <div class="wa-pp-clr"><div class="wa-pp-sw" id="wa-sw-fill"></div><input type="color" id="wa-ci-fill" oninput="WaveDrawingAPI._fillIn(this.value)"></div>
        </div>
        <div class="wa-pp-row" style="gap:4px;">${dots}</div>
        <div class="wa-pp-row">
          <select class="wa-pp-sel" id="wa-sel-sz" onchange="WaveDrawingAPI._szIn(this.value)">
            <option value="1">Nét 1px</option><option value="2">Nét 2px</option><option value="3">Nét 3px</option>
          </select>
          <select class="wa-pp-sel" id="wa-sel-ls" onchange="WaveDrawingAPI._lsIn(this.value)">
            <option value="solid">Liền ──</option><option value="dashed">Đứt - - -</option>
          </select>
        </div>
        <button class="wa-pp-btn" onclick="WaveDrawingAPI._applyToSelected()">Cập nhật Hình đang chọn</button>
      </div>`;
  }

  // ======================================================
  // 🎮 CHỨC NĂNG HOẠT ĐỘNG CHÍNH
  // ======================================================
  function activate(toolId) {
    const tool = TOOL_MAP[toolId];
    if (!tool) return;
    DS.active = toolId;
    const isAction = (toolId === 'pointer' || toolId === 'eraser');

    document.querySelectorAll('.wa-fb[data-grp]').forEach(b => b.classList.remove('wa-act'));
    document.querySelectorAll('.wa-fi').forEach(i => i.classList.toggle('wa-act', i.dataset.tool === toolId));
    
    const grpBtn = document.getElementById('wa-fg-' + tool.groupId);
    if (grpBtn) { grpBtn.classList.add('wa-act'); grpBtn.childNodes[0].textContent = tool.icon; }

    const props = document.getElementById('wa-ft-props');
    const txtInput = document.getElementById('wa-pp-textinput');
    
    if (isAction) {
        props.classList.remove('wa-show');
    } else {
        props.classList.add('wa-show');
        document.getElementById('wa-pp-nm').textContent = tool.name;
        // Hiện ô nhập Text nếu chọn công cụ Văn bản
        if (toolId === 'customText') {
            txtInput.style.display = 'block';
            txtInput.value = DS.text;
        } else {
            txtInput.style.display = 'none';
        }
    }

    if (global.tvChart) global.tvChart.cancelDrawing();

    if (!isAction) {
      setTimeout(() => {
        if (!global.tvChart) return;
        const styles = {
            line: { color: DS.stroke, size: DS.lineSize, style: DS.lineStyle },
            polygon: { color: tool.fill ? DS.fill : 'transparent', style: 'fill', borderColor: DS.stroke, borderSize: DS.lineSize },
            text: { color: DS.stroke, size: 14 }
        };
        // Đính kèm text vào extendData để customText overlay có thể đọc được
        global.tvChart.createOverlay({ name: tool.overlay, lock: false, visible: true, styles: styles, extendData: { text: DS.text } });
      }, 50);
    }
  }

  function subscribeChartEvents() {
    let poll = setInterval(() => {
      if (!global.tvChart) return;
      clearInterval(poll);

      // Khi vẽ xong 1 hình, tự động trả về con trỏ chuột
      global.tvChart.subscribeAction('onDrawEnd', () => { setTimeout(() => activate('pointer'), 100); });

      // Khi Click vào 1 hình đã vẽ -> Load thông số lên bảng Properties
      global.tvChart.subscribeAction('onOverlayClick', (params) => {
          if (DS.active === 'eraser') {
              global.tvChart.removeOverlay({ id: params.overlay.id });
              activate('pointer');
          } else {
              DS.selectedOverlayId = params.overlay.id;
              const props = document.getElementById('wa-ft-props');
              props.classList.add('wa-show');
              document.getElementById('wa-pp-nm').textContent = "Đang chọn Hình vẽ";
              
              if (params.overlay.name === 'customText') {
                  document.getElementById('wa-pp-textinput').style.display = 'block';
                  document.getElementById('wa-pp-textinput').value = params.overlay.extendData?.text || '';
              } else {
                  document.getElementById('wa-pp-textinput').style.display = 'none';
              }
          }
      });
    }, 500);
  }

  function inject() {
    if (document.getElementById('wa-ft')) return;
    registerProTools();

    const container = document.getElementById('sc-chart-container');
    if (!container) { setTimeout(inject, 500); return; }

    const div = document.createElement('div');
    div.id = 'wa-ft';
    div.innerHTML = buildHTML();
    container.appendChild(div);

    div.style.left = DS.panelX + 'px'; div.style.top = DS.panelY + 'px';
    if (!DS.panelVis) div.classList.add('wa-hidden');

    syncPropsUI();
    
    // Kéo thả
    let ox=0, oy=0, drag=false;
    const grip = document.getElementById('wa-ft-grip');
    grip.onmousedown = (e) => { if(e.target.id!=='wa-ft-collapse') { drag=true; ox=e.clientX-div.offsetLeft; oy=e.clientY-div.offsetTop; } };
    document.onmousemove = (e) => { if(drag) { div.style.left = (e.clientX-ox)+'px'; div.style.top = (e.clientY-oy)+'px'; DS.panelX=div.offsetLeft; DS.panelY=div.offsetTop; }};
    document.onmouseup = () => { if(drag){ drag=false; localStorage.setItem(LS_KEY, JSON.stringify(DS)); }};

    document.addEventListener('click', e => { if (!e.target.closest('#wa-ft')) document.querySelectorAll('.wa-fly').forEach(f=>f.classList.remove('wa-open')); });
    subscribeChartEvents();
  }

  function syncPropsUI() {
    document.getElementById('wa-sw-stroke').style.background = DS.stroke;
    document.getElementById('wa-sw-fill').style.background = DS.fill;
    document.getElementById('wa-sel-sz').value = DS.lineSize;
    document.getElementById('wa-sel-ls').value = DS.lineStyle;
  }

  // ======================================================
  // 🔌 PUBLIC API CHO HTML GỌI
  // ======================================================
  let _flyOpen = null;
  global.WaveDrawingAPI = {
    init: function() { injectCSS(); Object.assign(DS, JSON.parse(localStorage.getItem(LS_KEY)||'{}')); inject(); },
    reinject: function() { const el = document.getElementById('wa-ft'); if(el) el.remove(); setTimeout(inject, 300); },
    toggle: function() {
        const p = document.getElementById('wa-ft'); 
        if(!p) { inject(); DS.panelVis = true; return; }
        DS.panelVis = !DS.panelVis; p.classList.toggle('wa-hidden', !DS.panelVis);
        localStorage.setItem(LS_KEY, JSON.stringify(DS));
    },
    _collapse: function() { DS.collapsed = !DS.collapsed; document.getElementById('wa-ft').classList.toggle('wa-collapsed', DS.collapsed); document.getElementById('wa-ft-collapse').innerHTML = DS.collapsed ? '□' : '—'; },
    _grpClick: function(e, id) { e.stopPropagation(); const g = GROUPS.find(x=>x.id===id); if(g.tools.length===1) { activate(g.tools[0].id); return; } const fly=document.getElementById('wa-fly-'+id); if(fly.classList.contains('wa-open')){fly.classList.remove('wa-open');activate(g.tools[0].id);}else{document.querySelectorAll('.wa-fly').forEach(f=>f.classList.remove('wa-open'));fly.classList.add('wa-open');_flyOpen=id;} },
    _grpHover: function(e, id) { if(_flyOpen && _flyOpen!==id) { document.querySelectorAll('.wa-fly').forEach(f=>f.classList.remove('wa-open')); document.getElementById('wa-fly-'+id).classList.add('wa-open'); _flyOpen=id; } },
    _toolClick: function(id, e) { e.stopPropagation(); document.querySelectorAll('.wa-fly').forEach(f=>f.classList.remove('wa-open')); _flyOpen=null; activate(id); },
    _strokeIn: function(v) { DS.stroke=v; syncPropsUI(); },
    _fillIn: function(v) { DS.fill = v.replace('#',''); DS.fill='rgba('+parseInt(DS.fill.slice(0,2),16)+','+parseInt(DS.fill.slice(2,4),16)+','+parseInt(DS.fill.slice(4,6),16)+',0.15)'; syncPropsUI(); },
    _textIn: function(v) { DS.text = v; },
    _preset: function(v) { DS.stroke=v; this._fillIn(v); },
    _szIn: function(v) { DS.lineSize = parseInt(v); },
    _lsIn: function(v) { DS.lineStyle = v; },
    
    // Cập nhật lại hình đang được chọn trên chart
    _applyToSelected: function() {
        if (!global.tvChart || !DS.selectedOverlayId) return;
        global.tvChart.overrideOverlay({
            id: DS.selectedOverlayId,
            extendData: { text: DS.text },
            styles: {
                line: { color: DS.stroke, size: DS.lineSize, style: DS.lineStyle },
                polygon: { color: DS.fill, style: 'fill', borderColor: DS.stroke, borderSize: DS.lineSize },
                text: { color: DS.stroke, size: 14 }
            }
        });
        activate('pointer'); // Trả về con trỏ
    },

    undo: function() { if(global.tvChart && global.tvChart.undoOverlay) global.tvChart.undoOverlay(); },
    toggleVis: function() { DS.allVis = !DS.allVis; if(global.tvChart) global.tvChart.overrideOverlay({visible: DS.allVis}); },
    deleteAll: function() { if(global.tvChart && confirm('Xóa tất cả hình vẽ?')) global.tvChart.removeAllOverlay(); }
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(WaveDrawingAPI.init, 500));
  else setTimeout(WaveDrawingAPI.init, 500);

  // Hook để vẽ lại thanh công cụ mỗi khi đổi token
  const origOpen = global.openProChart;
  if (origOpen) {
      global.openProChart = function() {
          origOpen.apply(this, arguments);
          setTimeout(WaveDrawingAPI.reinject, 800);
      };
  }

})(window);