// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — FLOATING DRAWING TOOLBAR
// Version: 2.0.0 | KLineCharts Native-Only
// ==========================================
// ── SECTION 1: NATIVE OVERLAY REGISTRY ────
// ── SECTION 2: DRAWING STATE ──────────────
// ── SECTION 3: CSS ────────────────────────
// ── SECTION 4: HTML BUILDER ───────────────
// ── SECTION 5: INJECT & DRAG ──────────────
// ── SECTION 6: TOOL ACTIVATION ────────────
// ── SECTION 7: PROPERTIES BAR ─────────────
// ── SECTION 8: CHART EVENTS ───────────────
// ── SECTION 9: KEYBOARD ───────────────────
// ── SECTION 10: PERSISTENCE ───────────────
// ── SECTION 11: PUBLIC API ────────────────
// ==========================================

(function (global) {
  'use strict';

  const VERSION = '2.0.0';
  const LS_KEY  = 'wa_drawing_v2';

  // ======================================================
  // SECTION 1: NATIVE OVERLAY REGISTRY
  // CHI dung cac overlay KLineCharts ho tro 100% native.
  // Khong co overlay ao — khong bao gio bi loi.
  // ======================================================

  const GROUPS = [
    {
      id: 'cursor', label: 'Con Tro', icon: '\u2B21',
      tools: [
        { id:'pointer', name:'Chon / Di chuyen', overlay:null,     icon:'\u2196', key:'V',  pts:0, desc:'Chon va di chuyen hinh ve' },
        { id:'eraser',  name:'Xoa hinh ve',       overlay:null,     icon:'\u232B', key:'E',  pts:0, desc:'Nhap len hinh ve de xoa' },
      ]
    },
    {
      id: 'lines', label: 'Duong Ke', icon: '\u2571',
      tools: [
        { id:'segment',                name:'Xu huong (Trend Line)',   overlay:'segment',                icon:'\u2571', key:'L', pts:2, desc:'Doan thang 2 diem — cong cu ve co ban nhat' },
        { id:'ray',                    name:'Tia 1 chieu (Ray)',        overlay:'ray',                    icon:'\u2192',         pts:2, desc:'Bat dau tu diem A, keo dai vo han ve 1 phia' },
        { id:'straightLine',           name:'Duong thang 2 chieu',     overlay:'straightLine',           icon:'\u2194',         pts:2, desc:'Keo dai vo han ca 2 phia' },
        { id:'arrow',                  name:'Mui ten (Arrow)',          overlay:'arrow',                  icon:'\u2197',         pts:2, desc:'Doan thang co dau mui ten' },
        { id:'horizontalStraightLine', name:'Ngang vo han (H-Line)',    overlay:'horizontalStraightLine', icon:'\u2500', key:'H', pts:1, desc:'Duong ngang keo dai vo han — xac dinh vung ho tro/khang cu' },
        { id:'horizontalRayLine',      name:'Tia ngang 1 chieu',        overlay:'horizontalRayLine',      icon:'\u27F6',         pts:2, desc:'Duong ngang keo dai ve 1 phia' },
        { id:'horizontalSegment',      name:'Doan ngang (H-Segment)',   overlay:'horizontalSegment',      icon:'\u22A2',         pts:2, desc:'Doan ngang co gioi han 2 dau' },
        { id:'verticalStraightLine',   name:'Doc vo han (V-Line)',      overlay:'verticalStraightLine',   icon:'\u2502', key:'/', pts:1, desc:'Duong doc vo han — danh dau thoi diem quan trong' },
        { id:'verticalRayLine',        name:'Tia doc 1 chieu',          overlay:'verticalRayLine',        icon:'\u2191',         pts:2, desc:'Duong doc keo dai 1 chieu' },
        { id:'verticalSegment',        name:'Doan doc (V-Segment)',     overlay:'verticalSegment',        icon:'\u22A5',         pts:2, desc:'Doan doc co gioi han 2 dau' },
        { id:'priceLine',              name:'Nhan gia (Price Line)',    overlay:'priceLine',              icon:'$',              pts:1, desc:'Duong ngang co gan nhan gia cu the' },
      ]
    },
    {
      id: 'channels', label: 'Kenh Gia', icon: '\u27F0',
      tools: [
        { id:'priceChannelLine',     name:'Kenh xu huong (Channel)',      overlay:'priceChannelLine',     icon:'\u27F0', pts:3, desc:'3 diem — kenh song song theo xu huong' },
        { id:'parallelStraightLine', name:'Song song vo han (Pitchfork)', overlay:'parallelStraightLine', icon:'\u2BFF', pts:3, desc:'3 diem — 2 duong song song keo dai vo han' },
      ]
    },
    {
      id: 'fibonacci', label: 'Fibonacci', icon: '\u03D5',
      tools: [
        { id:'fibonacciLine',               name:'Fib Retracement (Hoi quy)',       overlay:'fibonacciLine',               icon:'\u2131', key:'F', pts:2, desc:'2 diem — cac muc 23.6 / 38.2 / 50 / 61.8 / 78.6%' },
        { id:'fibonacciSegment',            name:'Fib Segment',                      overlay:'fibonacciSegment',            icon:'Fs',              pts:2, desc:'2 diem — Fibonacci tinh tren doan thang' },
        { id:'fibonacciExtension',          name:'Fib Extension (Mo rong)',          overlay:'fibonacciExtension',          icon:'Fe',              pts:3, desc:'3 diem — muc 127.2 / 161.8 / 200 / 261.8%' },
        { id:'fibonacciSpiral',             name:'Fib Spiral (Xoan oc phi)',         overlay:'fibonacciSpiral',             icon:'\uD83C\uDF00',    pts:2, desc:'2 diem — xoan oc dua tren ty le vang 1.618' },
        { id:'fibonacciSpeedResistanceFan', name:'Fib Speed & Resistance Fan',       overlay:'fibonacciSpeedResistanceFan', icon:'Ff',              pts:2, desc:'2 diem — quat khang cu / ho tro Fibonacci' },
        { id:'fibonacciCircle',             name:'Fib Circle (Vong tron)',           overlay:'fibonacciCircle',             icon:'\u25C9',          pts:2, desc:'2 diem — cac vong tron theo ty le Fibonacci' },
        { id:'fibonacciTimeZone',           name:'Fib Time Zone (Vung thoi gian)',   overlay:'fibonacciTimeZone',           icon:'\u23F1',          pts:2, desc:'2 diem — phan chia vung thoi gian theo Fibonacci' },
      ]
    },
    {
      id: 'gann', label: 'Gann', icon: '\u210A',
      tools: [
        { id:'gannBox',    name:'Gann Box (Hop)',  overlay:'gannBox',    icon:'\u229E', pts:2, desc:'2 diem — hop Gann voi cac goc 1x1, 2x1, 1x2...' },
        { id:'gannFan',    name:'Gann Fan (Quat)', overlay:'gannFan',    icon:'\u22A0', pts:2, desc:'2 diem — quat 8 goc co dien cua W.D. Gann' },
        { id:'gannSquare', name:'Gann Square',     overlay:'gannSquare', icon:'\u229F', pts:2, desc:'2 diem — hinh vuong Gann voi luoi noi tam' },
      ]
    },
    {
      id: 'elliott', label: 'Song Elliott', icon:'\u301C',
      tools: [
        { id:'elliottImpulseWave',     name:'Impulse 1-2-3-4-5 (Song day)',       overlay:'elliottImpulseWave',     icon:'\u301C',  pts:6, desc:'6 diem — motive wave 5 buoc theo ly thuyet Elliott' },
        { id:'elliottCorrectiveWave',  name:'Corrective A-B-C (Song dieu chinh)',  overlay:'elliottCorrectiveWave',  icon:'\u223F',  pts:4, desc:'4 diem — song zigzag 3 buoc dieu chinh' },
        { id:'elliottTriangleWave',    name:'Triangle A-B-C-D-E (Tam giac)',       overlay:'elliottTriangleWave',    icon:'\u25B3',  pts:5, desc:'5 diem — song tam giac Elliott 5 canh' },
        { id:'elliottDoubleComboWave', name:'Double Combo W-X-Y',                  overlay:'elliottDoubleComboWave', icon:'\u223F\u223F', pts:7, desc:'7 diem — song kep phuc tap W-X-Y' },
        { id:'elliottTripleComboWave', name:'Triple Combo W-X-Y-X-Z',              overlay:'elliottTripleComboWave', icon:'\u2261',  pts:9, desc:'9 diem — song ba W-X-Y-X-Z' },
      ]
    },
    {
      id: 'harmonic', label: 'Harmonic', icon: 'X',
      tools: [
        { id:'xabcd',       name:'XABCD Harmonic (Gartley/Bat/Crab)', overlay:'xabcd',       icon:'XABCD', pts:5, desc:'5 diem — Gartley / Butterfly / Bat / Crab pattern' },
        { id:'abcd',        name:'ABCD Pattern',                        overlay:'abcd',        icon:'ABCD',  pts:4, desc:'4 diem — AB=CD harmonic pattern' },
        { id:'threedrives', name:'Three Drives Pattern',                overlay:'threedrives', icon:'3D',    pts:7, desc:'7 diem — Three Drives reversal (3 dinh/day dong bien)' },
      ]
    },
    {
      id: 'shapes', label: 'Hinh Ve', icon: '\u25A1',
      tools: [
        { id:'rect',         name:'Hinh chu nhat (Rectangle)', overlay:'rect',         icon:'\u25AD', key:'R', pts:2, fill:true, desc:'2 diem — vung to mau, dung de danh dau vung cung/cau' },
        { id:'circle',       name:'Hinh tron (Circle)',         overlay:'circle',       icon:'\u25CB',         pts:2, fill:true, desc:'2 diem — hinh tron to mau' },
        { id:'triangle',     name:'Tam giac (Triangle)',        overlay:'triangle',     icon:'\u25B3',         pts:3, fill:true, desc:'3 diem — tam giac to mau' },
        { id:'parallelogram',name:'Binh hanh (Parallelogram)',  overlay:'parallelogram',icon:'\u25B1',         pts:3, fill:true, desc:'3 diem — hinh binh hanh to mau' },
      ]
    },
    {
      id: 'text', label: 'Chu Thich', icon: 'T',
      tools: [
        { id:'text', name:'Van ban (Text Label)', overlay:'text', icon:'T', key:'T', pts:1, desc:'1 diem — them chu thich van ban tuy y len chart' },
        { id:'note', name:'Ghi chu (Note)',        overlay:'note', icon:'\uD83D\uDCDD',   pts:1, desc:'1 diem — ghi chu co nen mau va vien' },
      ]
    },
  ];

  // Flat map toolId -> tool (kem groupId)
  const TOOL_MAP = Object.create(null);
  GROUPS.forEach(function (g) {
    g.tools.forEach(function (t) {
      TOOL_MAP[t.id] = Object.assign({ groupId: g.id }, t);
    });
  });

  // ======================================================
  // SECTION 2: DRAWING STATE
  // ======================================================

  const PRESETS = [
    '#00F0FF','#F0B90B','#0ECB81','#F6465D',
    '#EAECEF','#848e9c','#cb55e3','#FF8C00',
  ];

  const DS = {
    stroke:    '#00F0FF',
    fill:      'rgba(0,240,255,0.12)',
    lineSize:  2,
    lineStyle: 'solid',
    textSize:  13,
    active:    'pointer',
    allVis:    true,
    count:     0,
    panelVis:  true,
    collapsed: false,
    panelX:    20,
    panelY:    80,
    inited:    false,
  };

  // ======================================================
  // SECTION 3: CSS
  // ======================================================

  function injectCSS() {
    if (document.getElementById('wa-draw-css')) return;
    const s = document.createElement('style');
    s.id = 'wa-draw-css';
    s.textContent = [
      '#sc-chart-container{position:relative!important;overflow:hidden;}',

      // Floating toolbar
      '#wa-ft{',
        'position:absolute;top:80px;left:20px;z-index:9000;',
        'display:flex;flex-direction:column;',
        'border-radius:14px;',
        'background:rgba(10,14,20,0.96);',
        'border:1px solid rgba(255,255,255,0.09);',
        'box-shadow:0 16px 56px rgba(0,0,0,0.8),0 2px 8px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.06);',
        'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);',
        'user-select:none;',
        'transition:opacity .2s ease,transform .2s ease;',
        'max-height:calc(100% - 32px);overflow:hidden;',
      '}',
      '#wa-ft.wa-hidden{opacity:0;pointer-events:none;transform:scale(0.88);}',
      '#wa-ft.wa-collapsed{border-radius:50px;}',
      '#wa-ft.wa-collapsed #wa-ft-body,#wa-ft.wa-collapsed #wa-ft-props{display:none!important;}',
      '#wa-ft.wa-collapsed #wa-ft-grip{border-radius:50px;padding:7px 12px;}',

      // Grip
      '#wa-ft-grip{display:flex;align-items:center;gap:5px;padding:7px 8px 6px;cursor:move;border-radius:14px 14px 0 0;background:rgba(255,255,255,0.025);border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;}',
      '#wa-ft-grip-dots{display:flex;flex-direction:column;gap:2.5px;flex-shrink:0;padding:0 1px;}',
      '#wa-ft-grip-dots span{display:flex;gap:2.5px;}',
      '#wa-ft-grip-dots i{width:2.5px;height:2.5px;border-radius:50%;background:rgba(255,255,255,0.18);display:block;}',
      '#wa-ft-grip-label{font-size:9px;font-weight:800;color:rgba(255,255,255,0.18);letter-spacing:1.8px;text-transform:uppercase;flex:1;pointer-events:none;}',
      '#wa-ft-collapse{width:20px;height:20px;border:none;background:transparent;color:rgba(255,255,255,0.2);cursor:pointer;border-radius:5px;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s;flex-shrink:0;padding:0;outline:none;line-height:1;}',
      '#wa-ft-collapse:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);}',

      // Body
      '#wa-ft-body{display:flex;flex-direction:column;padding:6px 5px 4px;gap:1px;overflow-y:auto;overflow-x:visible;scrollbar-width:none;min-width:40px;}',
      '#wa-ft-body::-webkit-scrollbar{display:none;}',

      // Group
      '.wa-fg{position:relative;display:flex;justify-content:center;}',
      '.wa-fsep{height:1px;background:rgba(255,255,255,0.06);margin:3px 4px;}',

      // Tool button
      '.wa-fb{width:30px;height:30px;border:1px solid transparent;border-radius:8px;background:transparent;color:rgba(255,255,255,0.28);font-size:11.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s,color .1s,border-color .1s;flex-shrink:0;position:relative;outline:none;padding:0;line-height:1;white-space:nowrap;}',
      '.wa-fb:hover{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.8);border-color:rgba(255,255,255,0.1);}',
      '.wa-fb.wa-act{background:rgba(0,240,255,0.14);color:#00F0FF;border-color:rgba(0,240,255,0.4);}',
      '.wa-fb.wa-hafly::after{content:"";position:absolute;bottom:3px;right:3px;width:3px;height:3px;border-right:1.5px solid rgba(255,255,255,0.22);border-bottom:1.5px solid rgba(255,255,255,0.22);pointer-events:none;}',
      '.wa-fb.wa-act.wa-hafly::after{border-color:rgba(0,240,255,0.45);}',

      // Tooltip
      '.wa-ftip{position:absolute;left:38px;top:50%;transform:translateY(-50%);background:rgba(7,10,15,0.97);border:1px solid rgba(255,255,255,0.12);border-radius:7px;padding:5px 10px;font-size:11px;color:#c8cdd4;white-space:nowrap;pointer-events:none;z-index:10000;opacity:0;transition:opacity .15s .2s;box-shadow:0 4px 16px rgba(0,0,0,0.6);}',
      '.wa-fb:hover .wa-ftip{opacity:1;}',

      // Flyout
      '.wa-fly{position:absolute;left:38px;top:-4px;background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px 5px;min-width:240px;z-index:10001;box-shadow:0 16px 48px rgba(0,0,0,0.85);display:none;flex-direction:column;gap:1px;pointer-events:all;}',
      '.wa-fly.wa-open{display:flex;}',
      '.wa-fly-hd{font-size:9px;font-weight:800;color:rgba(255,255,255,0.16);text-transform:uppercase;letter-spacing:1.3px;padding:3px 8px 7px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:2px;}',
      '.wa-fi{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;cursor:pointer;color:rgba(255,255,255,0.44);font-size:11.5px;transition:background .1s,color .1s;}',
      '.wa-fi:hover{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.88);}',
      '.wa-fi.wa-act{background:rgba(0,240,255,0.09);color:#00F0FF;}',
      '.wa-fi-ic{font-size:13px;width:20px;text-align:center;flex-shrink:0;}',
      '.wa-fi-info{flex:1;min-width:0;}',
      '.wa-fi-nm{display:block;}',
      '.wa-fi-ds{display:block;font-size:9.5px;color:rgba(255,255,255,0.18);margin-top:1.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.wa-fi-pts{font-size:9px;color:rgba(255,255,255,0.18);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);border-radius:4px;padding:1px 5px;flex-shrink:0;font-family:monospace;}',
      '.wa-fi-key{font-size:9px;color:rgba(0,240,255,0.6);background:rgba(0,240,255,0.07);border:1px solid rgba(0,240,255,0.15);border-radius:4px;padding:1px 5px;flex-shrink:0;font-family:monospace;}',

      // Bottom actions
      '#wa-ft-actions{display:flex;align-items:center;justify-content:center;gap:3px;padding:5px 5px 7px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;}',
      '.wa-fa{width:26px;height:26px;border:1px solid transparent;border-radius:7px;background:transparent;color:rgba(255,255,255,0.28);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s;outline:none;padding:0;position:relative;}',
      '.wa-fa:hover{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.75);}',
      '.wa-fa.wa-red:hover{background:rgba(246,70,93,0.1);color:#F6465D;border-color:rgba(246,70,93,0.3);}',
      '.wa-fa.wa-cyan:hover{background:rgba(0,240,255,0.1);color:#00F0FF;border-color:rgba(0,240,255,0.3);}',
      '.wa-fa-badge{position:absolute;top:-2px;right:-2px;background:#F6465D;color:#fff;font-size:7px;font-weight:900;min-width:12px;height:12px;border-radius:6px;display:none;align-items:center;justify-content:center;padding:0 2px;line-height:1;pointer-events:none;}',

      // Properties strip
      '#wa-ft-props{display:none;flex-direction:column;gap:8px;padding:9px 10px 10px;border-top:1px solid rgba(255,255,255,0.06);min-width:205px;flex-shrink:0;}',
      '#wa-ft-props.wa-show{display:flex;}',
      '.wa-pp-nm{font-size:11px;font-weight:800;color:#00F0FF;letter-spacing:.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.wa-pp-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}',
      '.wa-pp-lbl{font-size:10px;color:rgba(255,255,255,0.24);flex-shrink:0;}',
      '.wa-pp-clr{position:relative;width:20px;height:20px;border-radius:5px;border:1.5px solid rgba(255,255,255,0.18);cursor:pointer;overflow:hidden;flex-shrink:0;transition:border-color .12s;}',
      '.wa-pp-clr:hover{border-color:rgba(255,255,255,0.5);}',
      '.wa-pp-sw{width:100%;height:100%;border-radius:3px;}',
      '.wa-pp-clr input[type=color]{position:absolute;opacity:0;width:200%;height:200%;top:-50%;left:-50%;cursor:pointer;border:none;padding:0;}',
      '.wa-pp-dot{width:14px;height:14px;border-radius:3.5px;cursor:pointer;flex-shrink:0;border:1px solid rgba(255,255,255,0.1);transition:transform .1s,box-shadow .1s;}',
      '.wa-pp-dot:hover{transform:scale(1.3);}',
      '.wa-pp-sel{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:rgba(255,255,255,0.7);font-size:11px;padding:4px 6px;cursor:pointer;outline:none;transition:border-color .12s;min-width:60px;}',
      '.wa-pp-sel:hover,.wa-pp-sel:focus{border-color:rgba(0,240,255,0.4);}',
      '.wa-pp-btn{flex:1;padding:5px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:rgba(255,255,255,0.45);font-size:10px;cursor:pointer;transition:all .12s;white-space:nowrap;text-align:center;}',
      '.wa-pp-btn:hover{border-color:rgba(0,240,255,0.4);color:#00F0FF;background:rgba(0,240,255,0.06);}',
      '.wa-pp-cancel{display:none;}',
      '.wa-pp-cancel.wa-show{display:block;}',
      '.wa-pp-cancel:hover{border-color:rgba(246,70,93,0.4)!important;color:#F6465D!important;background:rgba(246,70,93,0.06)!important;}',

      // Drawing cursor
      '.wa-drawing-mode canvas{cursor:crosshair!important;}',
    ].join('');

    document.head.appendChild(s);
  }

  // ======================================================
  // SECTION 4: HTML BUILDER
  // ======================================================

  function buildHTML() {
    // Grip
    let h = '<div id="wa-ft-grip">';
    h += '<div id="wa-ft-grip-dots"><span><i></i><i></i></span><span><i></i><i></i></span><span><i></i><i></i></span></div>';
    h += '<span id="wa-ft-grip-label">DRAW</span>';
    h += '<button id="wa-ft-collapse" onclick="WaveDrawingAPI._collapse()">&#8212;</button>';
    h += '</div>';

    // Body
    h += '<div id="wa-ft-body">';
    GROUPS.forEach(function (g, gi) {
      if (gi > 0) h += '<div class="wa-fsep"></div>';
      var rep = g.tools[0];
      var hasFly = g.tools.length > 1;
      h += '<div class="wa-fg" data-grp="' + g.id + '">';
      h += '<button class="wa-fb' + (hasFly ? ' wa-hafly' : '') + '"';
      h += ' id="wa-fg-' + g.id + '"';
      h += ' data-grp="' + g.id + '" data-tool="' + rep.id + '"';
      h += ' onclick="WaveDrawingAPI._grpClick(event,\'' + g.id + '\')"';
      h += ' onmouseenter="WaveDrawingAPI._grpHover(event,\'' + g.id + '\')">';
      h += rep.icon;
      h += '<span class="wa-ftip">' + g.label + '</span>';
      h += '</button>';
      if (hasFly) h += buildFlyHTML(g);
      h += '</div>';
    });
    h += '</div>'; // #wa-ft-body

    // Properties strip
    h += buildPropsHTML();

    // Bottom actions
    h += '<div id="wa-ft-actions">';
    h += '<button class="wa-fa" onclick="WaveDrawingAPI.undo()" title="Undo (Ctrl+Z)">\u21A9</button>';
    h += '<button class="wa-fa" onclick="WaveDrawingAPI.redo()" title="Redo (Ctrl+Y)">\u21AA</button>';
    h += '<button class="wa-fa wa-cyan" id="wa-fa-vis" onclick="WaveDrawingAPI.toggleVis()" title="An/Hien hinh ve">\uD83D\uDC41</button>';
    h += '<button class="wa-fa wa-red" id="wa-fa-del" onclick="WaveDrawingAPI.deleteAll()" title="Xoa tat ca">\uD83D\uDDD1<span class="wa-fa-badge" id="wa-fa-badge"></span></button>';
    h += '</div>';

    return h;
  }

  function buildFlyHTML(g) {
    var h = '<div class="wa-fly" id="wa-fly-' + g.id + '">';
    h += '<div class="wa-fly-hd">' + g.label + '</div>';
    g.tools.forEach(function (t) {
      var pts = t.pts  ? '<span class="wa-fi-pts">' + t.pts + 'pt</span>' : '';
      var key = t.key  ? '<span class="wa-fi-key">' + t.key + '</span>' : '';
      h += '<div class="wa-fi" data-tool="' + t.id + '"';
      h += ' onclick="WaveDrawingAPI._toolClick(\'' + t.id + '\',event)">';
      h += '<span class="wa-fi-ic">' + t.icon + '</span>';
      h += '<span class="wa-fi-info">';
      h += '<span class="wa-fi-nm">' + t.name + '</span>';
      h += '<span class="wa-fi-ds">' + (t.desc || '') + '</span>';
      h += '</span>' + pts + key + '</div>';
    });
    h += '</div>';
    return h;
  }

  function buildPropsHTML() {
    var dots = PRESETS.map(function (c) {
      return '<div class="wa-pp-dot" style="background:' + c + ';" onclick="WaveDrawingAPI._preset(\'' + c + '\')" title="' + c + '"></div>';
    }).join('');

    var h = '<div id="wa-ft-props">';
    h += '<div class="wa-pp-nm" id="wa-pp-nm">—</div>';

    // Color row
    h += '<div class="wa-pp-row">';
    h += '<span class="wa-pp-lbl">Mau:</span>';
    h += '<div class="wa-pp-clr" title="Mau duong / vien">';
    h += '<div class="wa-pp-sw" id="wa-sw-stroke" style="background:#00F0FF;"></div>';
    h += '<input type="color" id="wa-ci-stroke" value="#00F0FF" oninput="WaveDrawingAPI._strokeIn(this.value)">';
    h += '</div>';
    h += '<span class="wa-pp-lbl">Nen:</span>';
    h += '<div class="wa-pp-clr" title="Mau nen (fill)">';
    h += '<div class="wa-pp-sw" id="wa-sw-fill" style="background:rgba(0,240,255,.12);"></div>';
    h += '<input type="color" id="wa-ci-fill" value="#00f0ff" oninput="WaveDrawingAPI._fillIn(this.value)">';
    h += '</div>';
    h += '</div>';

    // Presets
    h += '<div class="wa-pp-row">' + dots + '</div>';

    // Line settings
    h += '<div class="wa-pp-row">';
    h += '<span class="wa-pp-lbl">Net:</span>';
    h += '<select class="wa-pp-sel" id="wa-sel-sz" onchange="WaveDrawingAPI._szIn(this.value)">';
    h += '<option value="1">1px</option><option value="2" selected>2px</option><option value="3">3px</option><option value="4">4px</option><option value="5">5px</option>';
    h += '</select>';
    h += '<select class="wa-pp-sel" id="wa-sel-ls" onchange="WaveDrawingAPI._lsIn(this.value)">';
    h += '<option value="solid">\u2500\u2500\u2500</option><option value="dashed">- - -</option><option value="dotted">\u00B7\u00B7\u00B7</option>';
    h += '</select>';
    h += '</div>';

    // Buttons
    h += '<div class="wa-pp-row">';
    h += '<button class="wa-pp-btn" style="flex:1.5" onclick="WaveDrawingAPI._applyAll()">\u2726 Ap dung tat ca</button>';
    h += '<button class="wa-pp-btn wa-pp-cancel" id="wa-pp-cancel" onclick="WaveDrawingAPI._cancelDraw()">\u2715 Huy ve</button>';
    h += '</div>';

    h += '</div>'; // #wa-ft-props
    return h;
  }

  // ======================================================
  // SECTION 5: INJECT & DRAG
  // ======================================================

  var _reinjectTimer = null;

  function inject() {
    clearTimeout(_reinjectTimer);
    _reinjectTimer = null;

    var container = document.getElementById('sc-chart-container');
    if (!container) { _reinjectTimer = setTimeout(inject, 600); return; }
    if (document.getElementById('wa-ft')) return;

    container.style.position = 'relative';

    var div = document.createElement('div');
    div.id = 'wa-ft';
    div.innerHTML = buildHTML();
    container.appendChild(div);

    div.style.left = DS.panelX + 'px';
    div.style.top  = DS.panelY + 'px';

    if (!DS.panelVis) div.classList.add('wa-hidden');
    if (DS.collapsed) {
      div.classList.add('wa-collapsed');
      var cb = document.getElementById('wa-ft-collapse');
      if (cb) cb.innerHTML = '&#9635;';
    }

    syncPropsUI();
    showProps(TOOL_MAP[DS.active]);
    updateBadge();
    setupDrag(div, document.getElementById('wa-ft-grip'));

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#wa-ft')) closeFlyouts();
    }, true);

    subscribeChartEvents();
    DS.inited = true;
  }

  function setupDrag(panel, grip) {
    if (!grip) return;
    var ox = 0, oy = 0, dragging = false;

    grip.addEventListener('mousedown', function (e) {
      if (e.target.id === 'wa-ft-collapse') return;
      dragging = true;
      ox = e.clientX - panel.offsetLeft;
      oy = e.clientY - panel.offsetTop;
      panel.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var c = document.getElementById('sc-chart-container');
      if (!c) return;
      var nx = Math.max(0, Math.min(e.clientX - ox, c.clientWidth  - (panel.offsetWidth  || 40)));
      var ny = Math.max(0, Math.min(e.clientY - oy, c.clientHeight - (panel.offsetHeight || 200)));
      panel.style.left = nx + 'px';
      panel.style.top  = ny + 'px';
      DS.panelX = nx; DS.panelY = ny;
    });

    document.addEventListener('mouseup', function () {
      if (dragging) { dragging = false; panel.style.transition = ''; saveSettings(); }
    });
  }

  // ======================================================
  // SECTION 6: TOOL ACTIVATION
  // ======================================================

  function activate(toolId) {
    var tool = TOOL_MAP[toolId];
    if (!tool) return;
    DS.active = toolId;
    var isAction = (!tool.overlay || toolId === 'pointer' || toolId === 'eraser');

    // Highlight
    document.querySelectorAll('.wa-fb[data-grp]').forEach(function (b) { b.classList.remove('wa-act'); });
    document.querySelectorAll('.wa-fi').forEach(function (i) { i.classList.toggle('wa-act', i.dataset.tool === toolId); });
    var grpBtn = document.getElementById('wa-fg-' + tool.groupId);
    if (grpBtn) {
      grpBtn.classList.add('wa-act');
      if (grpBtn.childNodes[0]) grpBtn.childNodes[0].textContent = tool.icon;
    }

    // Cursor
    var c = document.getElementById('sc-chart-container');
    if (c) c.classList.toggle('wa-drawing-mode', !isAction);

    showProps(tool);
    _cancelPending();

    if (toolId === 'eraser') { _eraserMode = true; hideCancelBtn(); return; }
    _eraserMode = false;
    if (isAction) { hideCancelBtn(); return; }

    // Start drawing overlay
    setTimeout(function () {
      if (!global.tvChart) return;
      try {
        global.tvChart.createOverlay({ name: tool.overlay, lock: false, visible: true, styles: buildStyles(tool) });
        showCancelBtn();
      } catch (err) {
        _tryRegister(tool);
      }
    }, 50);
  }

  var _registered = {};
  function _tryRegister(tool) {
    var kc = global.klinecharts;
    if (!kc || typeof kc.registerOverlay !== 'function') return;
    var name = tool.overlay;
    if (!_registered[name]) {
      _registered[name] = true;
      try {
        kc.registerOverlay({
          name: name,
          totalStep: tool.pts || 2,
          createPointFigures: function (ref) {
            var coords = ref.coordinates || [];
            if (coords.length < 2) return [];
            var figs = [];
            for (var i = 0; i < coords.length - 1; i++) {
              figs.push({ type: 'line', attrs: { coordinates: [coords[i], coords[i+1]] } });
            }
            return figs;
          }
        });
      } catch (e) {}
    }
    try {
      global.tvChart.createOverlay({ name: name, lock: false, visible: true, styles: buildStyles(tool) });
      showCancelBtn();
    } catch (e2) {
      // Final fallback: segment
      try { global.tvChart.createOverlay({ name: 'segment', lock: false, visible: true, styles: buildStyles(tool) }); showCancelBtn(); } catch (e3) {}
    }
  }

  function _cancelPending() {
    if (!global.tvChart) return;
    try { if (typeof global.tvChart.cancelDrawing === 'function') global.tvChart.cancelDrawing(); } catch (e) {}
  }

  var _eraserMode = false;

  // ======================================================
  // SECTION 7: PROPERTIES BAR
  // ======================================================

  function showProps(tool) {
    var bar = document.getElementById('wa-ft-props');
    if (!bar) return;
    var show = !!(tool && tool.id !== 'pointer' && tool.id !== 'eraser');
    bar.classList.toggle('wa-show', show);
    var nm = document.getElementById('wa-pp-nm');
    if (nm) nm.textContent = tool ? tool.name : '\u2014';
  }

  function syncPropsUI() {
    var ci = document.getElementById('wa-ci-stroke');
    var sw = document.getElementById('wa-sw-stroke');
    var fs = document.getElementById('wa-sw-fill');
    var sz = document.getElementById('wa-sel-sz');
    var ls = document.getElementById('wa-sel-ls');
    if (ci) ci.value = toHex6(DS.stroke);
    if (sw) sw.style.background = DS.stroke;
    if (fs) fs.style.background = DS.fill;
    if (sz) sz.value = DS.lineSize;
    if (ls) ls.value = DS.lineStyle;
  }

  function showCancelBtn() { var b = document.getElementById('wa-pp-cancel'); if (b) b.classList.add('wa-show'); }
  function hideCancelBtn()  { var b = document.getElementById('wa-pp-cancel'); if (b) b.classList.remove('wa-show'); }

  function updateBadge() {
    var badge = document.getElementById('wa-fa-badge');
    if (!badge) return;
    badge.textContent = DS.count;
    badge.style.display = DS.count > 0 ? 'flex' : 'none';
  }

  // ======================================================
  // SECTION 8: CHART EVENTS
  // ======================================================

  function subscribeChartEvents() {
    var attempts = 0;
    var poll = setInterval(function () {
      if (!global.tvChart || ++attempts > 30) { clearInterval(poll); return; }
      clearInterval(poll);

      try { global.tvChart.subscribeAction('onDrawEnd', function () {
        DS.count++; updateBadge(); hideCancelBtn();
        setTimeout(function () { activate('pointer'); }, 0);
      }); } catch (e) {}

      try { global.tvChart.subscribeAction('onOverlayRemove', function () {
        if (DS.count > 0) DS.count--; updateBadge();
      }); } catch (e) {}

      try { global.tvChart.subscribeAction('onOverlayClick', function (params) {
        if (_eraserMode && params && params.overlay) {
          try { global.tvChart.removeOverlay({ id: params.overlay.id }); } catch (e) {}
          _eraserMode = false;
          activate('pointer');
        }
      }); } catch (e) {}
    }, 400);
  }

  // ======================================================
  // SECTION 9: KEYBOARD
  // ======================================================

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    var ov = document.getElementById('super-chart-overlay');
    if (!ov || !ov.classList.contains('active')) return;

    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); WaveDrawingAPI.undo(); return; }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); WaveDrawingAPI.redo(); return; }
    if (e.key === 'Escape') { WaveDrawingAPI._cancelDraw(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && DS.active === 'pointer') {
      if (global.tvChart) { try { global.tvChart.removeOverlay(); } catch (ex) {} } return;
    }
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      Object.values(TOOL_MAP).forEach(function (t) {
        if (t.key && e.key.toUpperCase() === t.key.toUpperCase()) { e.preventDefault(); activate(t.id); }
      });
    }
  }

  // ======================================================
  // FLYOUT
  // ======================================================

  var _flyOpen = null;

  function closeFlyouts() {
    document.querySelectorAll('.wa-fly.wa-open').forEach(function (f) { f.classList.remove('wa-open'); });
    _flyOpen = null;
  }

  function openFlyout(groupId) {
    closeFlyouts();
    var fly = document.getElementById('wa-fly-' + groupId);
    if (!fly) return;
    var grpBtn = document.getElementById('wa-fg-' + groupId);
    var container = document.getElementById('sc-chart-container');
    if (grpBtn && container) {
      var btnTop = grpBtn.getBoundingClientRect().top - container.getBoundingClientRect().top;
      var flyH   = fly.offsetHeight || 200;
      var maxTop = container.clientHeight - flyH - 8;
      fly.style.top = Math.max(4, Math.min(btnTop, maxTop)) + 'px';
    }
    fly.classList.add('wa-open');
    _flyOpen = groupId;
  }

  // ======================================================
  // SECTION 10: PERSISTENCE
  // ======================================================

  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        stroke: DS.stroke, fill: DS.fill,
        lineSize: DS.lineSize, lineStyle: DS.lineStyle,
        panelX: DS.panelX, panelY: DS.panelY,
        collapsed: DS.collapsed, panelVis: DS.panelVis,
      }));
    } catch (e) {}
  }

  function loadSettings() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (s.stroke)    DS.stroke    = s.stroke;
      if (s.fill)      DS.fill      = s.fill;
      if (s.lineSize)  DS.lineSize  = +s.lineSize || 2;
      if (s.lineStyle) DS.lineStyle = s.lineStyle;
      if (s.panelX !== undefined) DS.panelX = +s.panelX;
      if (s.panelY !== undefined) DS.panelY = +s.panelY;
      if (s.collapsed !== undefined) DS.collapsed = !!s.collapsed;
      if (s.panelVis  !== undefined) DS.panelVis  = !!s.panelVis;
    } catch (e) {}
  }

  // ======================================================
  // STYLE HELPERS
  // ======================================================

  function buildStyles(tool) {
    var fill = !!(tool && tool.fill);
    return {
      line:    { color: DS.stroke, size: DS.lineSize, style: DS.lineStyle },
      text:    { color: DS.stroke, size: DS.textSize, family: '"Segoe UI",Arial,sans-serif', weight: '600' },
      polygon: { color: fill ? DS.fill : 'transparent', style: 'fill', borderColor: DS.stroke, borderSize: DS.lineSize, borderStyle: DS.lineStyle },
      arc:     { color: DS.stroke, size: DS.lineSize, style: DS.lineStyle },
    };
  }

  function toHex6(c) {
    if (!c) return '#00F0FF';
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
    if (/^#[0-9a-fA-F]{3}$/.test(c)) { var s = c.slice(1); return '#'+s[0]+s[0]+s[1]+s[1]+s[2]+s[2]; }
    var cv = document.createElement('canvas'); cv.width = cv.height = 1;
    var cx = cv.getContext('2d'); cx.fillStyle = c; cx.fillRect(0,0,1,1);
    var d = cx.getImageData(0,0,1,1).data;
    return '#' + [d[0],d[1],d[2]].map(function(x){return x.toString(16).padStart(2,'0');}).join('');
  }

  function hexAlpha(h, a) {
    h = h.replace('#','');
    if (h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return 'rgba('+parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16)+','+a+')';
  }
// ======================================================
  // BỘ NÃO TOÁN HỌC: ĐĂNG KÝ CÁC CÔNG CỤ PRO
  // ======================================================
  function registerProTools() {
      const kc = global.klinecharts;
      if (!kc || typeof kc.registerOverlay !== 'function') return;

      // 🌊 1. SÓNG ELLIOTT (5 Bước)
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

      // 🦇 2. MẪU HÌNH XABCD (Harmonic)
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

      // ⚡ 3. MẪU HÌNH ABCD
      kc.registerOverlay({
          name: 'abcd', totalStep: 4,
          needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function({ coordinates }) {
              let lines = [], texts = [], polygons = [];
              let tags = ['A', 'B', 'C', 'D'];
              for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
              if (coordinates.length >= 3) polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] });
              if (coordinates.length >= 4) polygons.push({ coordinates: [coordinates[1], coordinates[2], coordinates[3]] });
              coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
              return [
                  { type: 'polygon', attrs: polygons, styles: { style: 'fill' } },
                  { type: 'line', attrs: lines },
                  { type: 'text', ignoreEvent: true, attrs: texts }
              ];
          }
      });

      // 📈 4. FIBONACCI MỞ RỘNG (Extension)
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
                  texts.push({ x: 0, y: y - 2, text: `Fib ${r}`, baseline: 'bottom' });
              });
              lines.push({ coordinates: [p1, p2] });
              lines.push({ coordinates: [p2, p3] });
              return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
          }
      });

      // 🔲 5. GANN BOX
      kc.registerOverlay({
          name: 'gannBox', totalStep: 3,
          needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
          createPointFigures: function({ coordinates }) {
              if (coordinates.length < 2) return [];
              const p1 = coordinates[0], p2 = coordinates[1];
              let lines = [], polygons = [];
              polygons.push({ coordinates: [p1, {x: p2.x, y: p1.y}, p2, {x: p1.x, y: p2.y}] });
              lines.push({ coordinates: [p1, p2] });
              lines.push({ coordinates: [{x: p2.x, y: p1.y}, {x: p1.x, y: p2.y}] });
              const midX = (p1.x + p2.x)/2; const midY = (p1.y + p2.y)/2;
              lines.push({ coordinates: [{x: midX, y: p1.y}, {x: midX, y: p2.y}] });
              lines.push({ coordinates: [{x: p1.x, y: midY}, {x: p2.x, y: midY}] });
              return [
                  { type: 'polygon', attrs: polygons, styles: { style: 'fill' } },
                  { type: 'line', attrs: lines }
              ];
          }
      });
  }
  // ======================================================
  // SECTION 11: PUBLIC API
  // ======================================================

  global.WaveDrawingAPI = {
    version: VERSION,

    init: function () {
      injectCSS();
      loadSettings();
      registerProTools(); // <--- ĐÁNH THỨC BỘ NÃO Ở ĐÂY
      inject();
      document.addEventListener('keydown', onKey);
      _watchReinit();
    },

    reinject: function () {
      var el = document.getElementById('wa-ft');
      if (el) el.remove();
      DS.inited = false;
      setTimeout(inject, 350);
    },

    /** Goi tu nut bam tren Topbar — bat/tat floating panel */
    toggle: function () {
      var panel = document.getElementById('wa-ft');
      if (!panel) { inject(); DS.panelVis = true; saveSettings(); return; }
      DS.panelVis = !DS.panelVis;
      panel.classList.toggle('wa-hidden', !DS.panelVis);
      saveSettings();
      // Sync topbar button
      var btn = document.getElementById('sc-draw-toggle-btn');
      if (btn) btn.classList.toggle('active', DS.panelVis);
    },

    // HTML onclick handlers
    _collapse: function () {
      var panel = document.getElementById('wa-ft');
      var btn   = document.getElementById('wa-ft-collapse');
      if (!panel) return;
      DS.collapsed = !DS.collapsed;
      panel.classList.toggle('wa-collapsed', DS.collapsed);
      if (btn) btn.innerHTML = DS.collapsed ? '&#9635;' : '&#8212;';
      saveSettings();
    },

    _grpClick: function (event, groupId) {
      event.stopPropagation();
      var g = GROUPS.find(function (x) { return x.id === groupId; });
      if (!g) return;
      if (g.tools.length === 1) { closeFlyouts(); activate(g.tools[0].id); return; }
      var fly = document.getElementById('wa-fly-' + groupId);
      if (fly && fly.classList.contains('wa-open')) { closeFlyouts(); activate(g.tools[0].id); }
      else { openFlyout(groupId); }
    },

    _grpHover: function (event, groupId) {
      if (_flyOpen && _flyOpen !== groupId) openFlyout(groupId);
    },

    _toolClick: function (toolId, event) {
      if (event) event.stopPropagation();
      closeFlyouts();
      activate(toolId);
    },

    _cancelDraw: function () {
      _cancelPending();
      hideCancelBtn();
      activate('pointer');
    },

    _strokeIn: function (val) {
      DS.stroke = val;
      var sw = document.getElementById('wa-sw-stroke');
      if (sw) sw.style.background = val;
      saveSettings();
    },

    _fillIn: function (val) {
      DS.fill = hexAlpha(val, 0.15);
      var sw = document.getElementById('wa-sw-fill');
      if (sw) sw.style.background = DS.fill;
      saveSettings();
    },

    _preset: function (hex) {
      DS.stroke = hex;
      DS.fill   = hexAlpha(hex, 0.12);
      var ci = document.getElementById('wa-ci-stroke');
      var sw = document.getElementById('wa-sw-stroke');
      var fs = document.getElementById('wa-sw-fill');
      if (ci) ci.value = toHex6(hex);
      if (sw) sw.style.background = hex;
      if (fs) fs.style.background = DS.fill;
      saveSettings();
    },

    _szIn: function (val) { DS.lineSize = parseInt(val) || 2; saveSettings(); },
    _lsIn: function (val) { DS.lineStyle = val; saveSettings(); },

    _applyAll: function () {
      if (!global.tvChart) return;
      try { global.tvChart.overrideOverlay({ styles: buildStyles({ fill: true }) }); } catch (e) {}
    },

    undo: function () {
      if (!global.tvChart) return;
      try {
        if (typeof global.tvChart.undoOverlay === 'function') global.tvChart.undoOverlay();
        else global.tvChart.removeOverlay();
        if (DS.count > 0) DS.count--;
        updateBadge();
      } catch (e) {}
    },

    redo: function () {
      if (!global.tvChart) return;
      try {
        if (typeof global.tvChart.redoOverlay === 'function') { global.tvChart.redoOverlay(); DS.count++; updateBadge(); }
      } catch (e) {}
    },

    toggleVis: function () {
      if (!global.tvChart) return;
      DS.allVis = !DS.allVis;
      try { global.tvChart.overrideOverlay({ visible: DS.allVis }); } catch (e) {}
      var btn = document.getElementById('wa-fa-vis');
      if (btn) { btn.title = DS.allVis ? 'An tat ca hinh ve' : 'Hien tat ca hinh ve'; btn.innerHTML = DS.allVis ? '\uD83D\uDC41' : '\uD83D\uDEAB'; }
    },

    deleteAll: function () {
      if (!global.tvChart) return;
      if (!confirm('Xoa tat ca hinh ve tren chart?\n(Khong the hoan tac)')) return;
      try {
        if (typeof global.tvChart.removeAllOverlay === 'function') global.tvChart.removeAllOverlay();
        else global.tvChart.removeOverlay();
      } catch (e) {}
      DS.count = 0; updateBadge();
      if (typeof global.applyFishFilter === 'function') setTimeout(global.applyFishFilter, 100);
    },

    getState:  function () { return Object.assign({}, DS); },
    getGroups: function () { return GROUPS; },
  };

  // ======================================================
  // REINIT WATCHER
  // ======================================================

  function _watchReinit() {
    new MutationObserver(function () {
      var c = document.getElementById('sc-chart-container');
      if (c && !document.getElementById('wa-ft') && DS.panelVis) {
        clearTimeout(_reinjectTimer);
        _reinjectTimer = setTimeout(inject, 420);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // AUTO-INIT
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(WaveDrawingAPI.init, 500); });
  } else {
    setTimeout(WaveDrawingAPI.init, 500);
  }

  console.log('[Wave Alpha Drawing v' + VERSION + '] Floating toolbar module loaded.');

})(window);