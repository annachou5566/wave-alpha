// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026
// Fix: UI Gọn Gàng, Text Realtime 100%, Fibo Đổ Màu
// ==========================================

(function (global) {
  'use strict';

  let currentSelectedOverlay = null;

  // 1. CẤU HÌNH MẶC ĐỊNH MỎNG & GỌN CHUẨN PRO
  let globalStyles = {
    lineColor: '#00F0FF',
    fillColor: 'rgba(0, 240, 255, 0.15)',
    textColor: '#EAECEF',
    lineWidth: 1,       // Nét thanh mỏng 1px
    lineStyle: 'solid',
    textSize: 12,       // Chữ nhỏ gọn 12px
    textInput: 'Văn bản...'
  };

  // ======================================================
  // 2. BỨNG 100% THUẬT TOÁN TỪ REPO PRO
  // ======================================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc || kc.__wa_extensions_registered) return;
    kc.__wa_extensions_registered = true;

    function getRotateCoordinate(coordinate, targetCoordinate, angle) {
      const x = (coordinate.x - targetCoordinate.x) * Math.cos(angle) - (coordinate.y - targetCoordinate.y) * Math.sin(angle) + targetCoordinate.x;
      const y = (coordinate.x - targetCoordinate.x) * Math.sin(angle) + (coordinate.y - targetCoordinate.y) * Math.cos(angle) + targetCoordinate.y;
      return { x, y };
    }

    function getDistance(c1, c2) {
      const xDis = Math.abs(c1.x - c2.x);
      const yDis = Math.abs(c1.y - c2.y);
      return Math.sqrt(xDis * xDis + yDis * yDis);
    }

    function getRayLine(coordinates, bounding) {
      if (coordinates.length > 1) {
        let coordinate;
        if (coordinates[0].x === coordinates[1].x && coordinates[0].y !== coordinates[1].y) {
          coordinate = coordinates[0].y < coordinates[1].y ? { x: coordinates[0].x, y: bounding.height } : { x: coordinates[0].x, y: 0 };
        } else if (coordinates[0].x > coordinates[1].x) {
          coordinate = { x: 0, y: kc.utils.getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: 0, y: coordinates[0].y }) };
        } else {
          coordinate = { x: bounding.width, y: kc.utils.getLinearYFromCoordinates(coordinates[0], coordinates[1], { x: bounding.width, y: coordinates[0].y }) };
        }
        return { coordinates: [coordinates[0], coordinate] };
      }
      return [];
    }

    function createWave(name, totalStep, labels) {
      return {
        name: name, totalStep: totalStep, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          labels.forEach((l, i) => {
            if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 6, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true });
          });
          return figs;
        }
      };
    }

    var extensions = [
      createWave('waveElliott', 7, ['0', '1', '2', '3', '4', '5']), 
      createWave('waveABC', 5, ['0', 'A', 'B', 'C']),                   
      createWave('waveTriangle', 7, ['0', 'A', 'B', 'C', 'D', 'E']),
      createWave('waveWXY', 5, ['0', 'W', 'X', 'Y']),

      // 🔥 NÂNG CẤP: FIBONACCI ĐỔ MÀU CHUYÊN NGHIỆP
      {
        name: 'fibonacciLine',
        totalStep: 3,
        needDefaultPointFigure: true,
        needDefaultXAxisFigure: true,
        needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, bounding, overlay, precision }) {
          const points = overlay.points;
          if (coordinates.length === 0) return [];
          const lines = [], polygons = [], texts = [];

          if (coordinates.length > 1) {
            const valueDif = points[0].value - points[1].value;
            const yDif = coordinates[0].y - coordinates[1].y;
            const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
            
            // Dải màu Fibo chuyên nghiệp
            const colors = [
              'rgba(242, 54, 69, 0.15)',   // Đỏ
              'rgba(255, 152, 0, 0.15)',   // Cam
              'rgba(255, 235, 59, 0.15)',  // Vàng
              'rgba(76, 175, 80, 0.15)',   // Xanh lá
              'rgba(0, 188, 212, 0.15)',   // Xanh dương nhạt
              'rgba(41, 98, 255, 0.15)'    // Xanh dương đậm
            ];

            let prevY = null;

            percents.forEach((percent, i) => {
              const y = coordinates[1].y + yDif * percent;
              const price = (points[1].value + valueDif * percent).toFixed(precision.price);

              // Đường line chạy ngang toàn màn hình
              lines.push({ coordinates: [{ x: coordinates[0].x, y }, { x: bounding.width, y }] });

              // Text hiển thị % và Giá trị
              texts.push({
                x: coordinates[0].x, 
                y: y - 2,
                text: `${percent} (${price})`,
                baseline: 'bottom'
              });

              // Vẽ hình chữ nhật tô màu giữa các mức Fibo
              if (prevY !== null && i > 0) {
                polygons.push({
                  type: 'polygon',
                  ignoreEvent: true,
                  attrs: {
                    coordinates: [
                      { x: coordinates[0].x, y: prevY },
                      { x: bounding.width, y: prevY },
                      { x: bounding.width, y },
                      { x: coordinates[0].x, y }
                    ]
                  },
                  styles: { style: 'fill', color: colors[i-1] }
                });
              }
              prevY = y;
            });

            return [
              ...polygons, // Render màu nền trước
              { type: 'line', attrs: lines }, // Line đè lên nền
              { type: 'text', ignoreEvent: true, attrs: texts } // Text trên cùng
            ];
          }
          return [];
        }
      },

      { name: 'circle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, styles: { circle: { color: 'rgba(22, 119, 255, 0.15)' } }, createPointFigures: function({ coordinates }) { if (coordinates.length > 1) { return { type: 'circle', attrs: { ...coordinates[0], r: getDistance(coordinates[0], coordinates[1]) }, styles: { style: 'stroke_fill' } }; } return []; } },
      { name: 'rect', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } }, createPointFigures: function({ coordinates }) { if (coordinates.length > 1) { return [{ type: 'polygon', attrs: { coordinates: [ coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y } ] }, styles: { style: 'stroke_fill' } }]; } return []; } },
      {
        name: 'parallelogram', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          if (coordinates.length === 2) return [{ type: 'line', ignoreEvent: true, attrs: { coordinates } }];
          if (coordinates.length === 3) { const coordinate = { x: coordinates[0].x + (coordinates[2].x - coordinates[1].x), y: coordinates[2].y }; return [{ type: 'polygon', attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2], coordinate] }, styles: { style: 'stroke_fill' } }]; } return [];
        },
        performEventPressedMove: function({ points, performPointIndex, performPoint }) { if (performPointIndex < 2) { points[0].price = performPoint.price; points[1].price = performPoint.price; } },
        performEventMoveForDrawing: function({ currentStep, points, performPoint }) { if (currentStep === 2) points[0].price = performPoint.price; }
      },
      { name: 'triangle', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } }, createPointFigures: function({ coordinates }) { return [{ type: 'polygon', attrs: { coordinates }, styles: { style: 'stroke_fill' } }]; } },
      
      { name: 'threeWaves', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'fiveWaves', totalStep: 7, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'eightWaves', totalStep: 10, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'anyWaves', totalStep: Number.MAX_SAFE_INTEGER, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },

      {
        name: 'abcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          let acLineCoordinates = [], bdLineCoordinates = []; const tags = ['A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` }));
          if (coordinates.length > 2) { acLineCoordinates = [coordinates[0], coordinates[2]]; if (coordinates.length > 3) bdLineCoordinates = [coordinates[1], coordinates[3]]; }
          return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: [{ coordinates: acLineCoordinates }, { coordinates: bdLineCoordinates }], styles: { style: 'dashed' } }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },
      {
        name: 'xabcd', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          const dashedLines = [], polygons = []; const tags = ['X', 'A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` }));
          if (coordinates.length > 2) { dashedLines.push({ coordinates: [coordinates[0], coordinates[2]] }); polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] }); if (coordinates.length > 3) { dashedLines.push({ coordinates: [coordinates[1], coordinates[3]] }); if (coordinates.length > 4) { dashedLines.push({ coordinates: [coordinates[2], coordinates[4]] }); polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] }); } } }
          return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } }, { type: 'polygon', ignoreEvent: true, attrs: polygons }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // 🔥 NÂNG CẤP: TEXT REAL-TIME HOÀN HẢO
      {
        name: 'customText', 
        totalStep: 1, 
        needDefaultPointFigure: false, 
        needDefaultXAxisFigure: false, 
        needDefaultYAxisFigure: false,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          let t = ref.overlay.extendData;
          if (t === undefined || t === null || t === '') t = 'Văn bản...';
          return [{ 
            type: 'text', 
            attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y, text: t, baseline: 'bottom', align: 'center' }, 
            ignoreEvent: false 
          }];
        }
      },

      {
        name: 'headAndShoulders', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length >= 4) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2], c[3]] }, styles: { style: 'fill' } });
          if (c.length >= 7) figs.push({ type: 'polygon', attrs: { coordinates: [c[3], c[4], c[5], c[6]] }, styles: { style: 'fill' } });
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          ['Left', 'Head', 'Right'].forEach((l, i) => { let idx = (i===0)?1 : (i===1)?3 : 5; if (c[idx]) figs.push({ type: 'text', attrs: { x: c[idx].x, y: c[idx].y - 15, text: l, align: 'center' }, ignoreEvent: true }); });
          return figs;
        }
      }
    ];

    extensions.forEach(e => { try { kc.registerOverlay(e); } catch(err){} });
  }

  // ======================================================
  // 3. GIAO DIỆN & DANH SÁCH MENU ĐẦY ĐỦ
  // ======================================================
  const ICONS = {
    drag: '<svg viewBox="0 0 24 24" fill="none" stroke="#5e6673" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>',
    pointer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>',
    lines: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/></svg>',
    fibonacci: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
    waves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l5-8 6 16 5-12 4 4"/></svg>',
    shapes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/></svg>',
    eraser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20H7L3 16c-1.5-1.5-1.5-3.5 0-5l7-7c1.5-1.5 3.5-1.5 5 0l5 5c1.5 1.5 1.5 3.5 0 5l-7 7z"/><path d="M15 9l-4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
  };

  const MENU_MAP = [
    { id: 'lines', icon: ICONS.lines, tools: [ { id: 'segment', name: 'Đường xu hướng' }, { id: 'rayLine', name: 'Tia (Ray)' }, { id: 'straightLine', name: 'Đường mở rộng' }, { id: 'horizontalStraightLine', name: 'Đường ngang' }, { id: 'verticalStraightLine', name: 'Đường dọc' }, { id: 'priceChannelLine', name: 'Kênh song song' }, { id: 'parallelStraightLine', name: 'Pitchfork' }, { id: 'arrow', name: 'Mũi tên (Arrow)' } ]},
    { id: 'fibonacci', icon: ICONS.fibonacci, tools: [ { id: 'fibonacciLine', name: 'Fibonacci Retracement' }, { id: 'fibonacciExtension', name: 'Fibonacci Extension' }, { id: 'fibonacciSpeedResistanceFan', name: 'Fibonacci Quạt' }, { id: 'fibonacciCircle', name: 'Fibonacci Vòng tròn' }, { id: 'fibonacciSpiral', name: 'Fibonacci Xoắn ốc' }, { id: 'fibonacciSegment', name: 'Fibonacci Phân đoạn' } ]},
    { id: 'waves', icon: ICONS.waves, tools: [ { id: 'waveElliott', name: 'Sóng đẩy Elliott (12345)' }, { id: 'waveABC', name: 'Sóng điều chỉnh (ABC)' }, { id: 'waveTriangle', name: 'Sóng tam giác (ABCDE)' }, { id: 'waveWXY', name: 'Sóng WXY' }, { id: 'threeWaves', name: 'Sóng 3' }, { id: 'fiveWaves', name: 'Sóng 5' }, { id: 'eightWaves', name: 'Sóng 8' }, { id: 'anyWaves', name: 'Vẽ Polyline (Tự do)' }, { id: 'xabcd', name: 'Mô hình XABCD' }, { id: 'abcd', name: 'Mô hình ABCD' }, { id: 'headAndShoulders', name: 'Vai Đầu Vai' } ]},
    { id: 'shapes', icon: ICONS.shapes, tools: [ { id: 'rect', name: 'Hình chữ nhật' }, { id: 'triangle', name: 'Tam giác' }, { id: 'circle', name: 'Hình tròn' }, { id: 'parallelogram', name: 'Hình bình hành' }, { id: 'gannBox', name: 'Hộp Gann (Gann Box)' } ]}
  ];

  function injectCSS() {
    if (document.getElementById('wa-pro-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-pro-css';
    // Đã tùy chỉnh CSS mỏng, gọn, tinh tế hơn
    style.textContent = `
      #sc-chart-container { position: relative !important; overflow: hidden !important; }
      .wa-floating-sidebar { position: absolute; top: 60px; left: 16px; z-index: 9999; width: 40px; background-color: rgba(22, 26, 30, 0.85); border: 1px solid #2b3139; border-radius: 6px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 16px rgba(0,0,0,0.4); backdrop-filter: blur(8px); user-select: none; }
      .wa-drag-grip { width: 100%; height: 20px; display: flex; align-items: center; justify-content: center; cursor: grab; border-bottom: 1px solid #2b3139; opacity: 0.5; }
      .wa-drag-grip:active { cursor: grabbing; }
      .wa-drag-grip svg { width: 14px; height: 14px; }
      .wa-tools-wrapper { padding: 4px 0; width: 100%; display: flex; flex-direction: column; align-items: center;}
      .wa-group { position: relative; width: 100%; display: flex; justify-content: center; margin-bottom: 4px; }
      .wa-btn { width: 30px; height: 30px; border-radius: 4px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; position: relative; }
      .wa-btn svg { width: 18px; height: 18px; }
      .wa-btn:hover { background-color: #2b3139; color: #EAECEF; }
      .wa-btn.active { background-color: rgba(0, 240, 255, 0.15); color: #00F0FF; }
      .wa-has-menu::after { content: ''; position: absolute; right: 2px; bottom: 3px; border: solid currentColor; border-width: 0 1px 1px 0; padding: 1px; transform: rotate(-45deg); }
      .wa-menu { position: absolute; left: 42px; top: 0; background-color: rgba(22, 26, 30, 0.95); border: 1px solid #2b3139; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); display: none; flex-direction: column; width: 190px; padding: 4px 0; z-index: 10000; backdrop-filter: blur(8px); }
      .wa-group:hover .wa-menu { display: flex; }
      .wa-menu-item { padding: 8px 12px; color: #EAECEF; font-size: 12px; font-weight: 400; cursor: pointer; transition: 0.15s; }
      .wa-menu-item:hover { background-color: #2b3139; color: #00F0FF; }
      .wa-menu-item.active { color: #00F0FF; }
      .wa-divider { width: 20px; height: 1px; background-color: #2b3139; margin: 4px 0; }
      .wa-drawing-mode canvas { cursor: crosshair !important; }
      .wa-floating-props { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(18, 20, 24, 0.9); border: 1px solid #2b3139; border-radius: 6px; padding: 6px 10px; display: none; align-items: center; gap: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 10001; }
      .wa-floating-props.show { display: flex; }
      .wa-prop-group { display: flex; align-items: center; gap: 4px; }
      .wa-prop-color { width: 22px; height: 22px; border-radius: 4px; border: 1px solid #2b3139; cursor: pointer; padding: 0; background: transparent; }
      .wa-prop-color::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-prop-color::-webkit-color-swatch { border: none; border-radius: 3px; }
      .wa-prop-select, .wa-prop-input { background: #161A1E; color: #EAECEF; border: 1px solid #2b3139; padding: 2px 4px; border-radius: 4px; font-size: 12px; outline: none; }
      .wa-prop-input { width: 160px; font-weight: 400; padding: 4px 8px;}
      .wa-prop-input:focus { border-color: #00F0FF; }
      .wa-prop-btn { background: transparent; border: none; color: #848E9C; cursor: pointer; display:flex; align-items:center; justify-content:center; transition: 0.2s; width: 22px; height: 22px; border-radius: 4px;}
      .wa-prop-btn svg { width: 16px; height: 16px; }
      .wa-prop-btn:hover { background: #2b3139; color: #F6465D; }
    `;
    document.head.appendChild(style);
  }

  function buildHTML() {
    let html = `<div class="wa-drag-grip">${ICONS.drag}</div><div class="wa-tools-wrapper"><div class="wa-group"><button class="wa-btn active" data-tool="pointer" title="Con trỏ chuột">${ICONS.pointer}</button></div>`;
    MENU_MAP.forEach(g => {
      html += `<div class="wa-group"><button class="wa-btn wa-has-menu">${g.icon}</button><div class="wa-menu">`;
      g.tools.forEach(t => { html += `<div class="wa-menu-item" data-tool="${t.id}">${t.name}</div>`; });
      html += `</div></div>`;
    });
    html += `<div class="wa-group"><button class="wa-btn" data-tool="customText" title="Viết chữ (Text)">${ICONS.text}</button></div><div class="wa-divider"></div>`;
    html += `<div class="wa-group"><button class="wa-btn" data-tool="eraser" title="Cục tẩy (Click vào hình để xóa)">${ICONS.eraser}</button></div>`;
    html += `<div class="wa-group"><button class="wa-btn" data-tool="trash" title="Xóa toàn bộ bản vẽ">${ICONS.trash}</button></div></div>`;
    return html;
  }

  function buildFloatingPropsHTML() {
    return `
      <div class="wa-prop-group" title="Màu nét vẽ"><input type="color" id="wa-prop-line-color" class="wa-prop-color" value="#00F0FF"></div>
      <div class="wa-prop-group" title="Màu nền"><input type="color" id="wa-prop-fill-color" class="wa-prop-color" value="#00F0FF"></div>
      <div class="wa-prop-group" title="Độ dày nét"><select id="wa-prop-line-size" class="wa-prop-select"><option value="1">1px</option><option value="2">2px</option><option value="3">3px</option></select></div>
      <div class="wa-prop-group" title="Kiểu nét"><select id="wa-prop-line-style" class="wa-prop-select"><option value="solid">▬▬</option><option value="dashed">- - -</option><option value="dotted">. . .</option></select></div>
      <div class="wa-divider" style="width:1px; height:16px; margin:0; background:#2b3139;"></div>
      <div class="wa-prop-group" title="Màu chữ"><input type="color" id="wa-prop-text-color" class="wa-prop-color" value="#EAECEF"></div>
      <div class="wa-prop-group" title="Cỡ chữ"><select id="wa-prop-text-size" class="wa-prop-select"><option value="10">10px</option><option value="12">12px</option><option value="14">14px</option><option value="16">16px</option><option value="20">20px</option></select></div>
      <div class="wa-prop-group" id="wa-prop-text-wrapper" style="display:none;" title="Nội dung"><input type="text" id="wa-prop-text-input" class="wa-prop-input" placeholder="Nhập văn bản..."></div>
      <div class="wa-divider" style="width:1px; height:16px; margin:0; background:#2b3139;"></div>
      <button class="wa-prop-btn" id="wa-prop-delete" title="Xóa hình này">${ICONS.trash}</button>
    `;
  }

  // ======================================================
  // 4. XỬ LÝ SỰ KIỆN LÕI & REAL-TIME
  // ======================================================
  function colorToHex(color) {
      if (!color) return '#00F0FF';
      if (color.startsWith('#')) return color.substring(0, 7);
      let match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) return `#${parseInt(match[1]).toString(16).padStart(2,'0')}${parseInt(match[2]).toString(16).padStart(2,'0')}${parseInt(match[3]).toString(16).padStart(2,'0')}`;
      return '#00F0FF';
  }

  function hexToRgba(hex, alpha) {
      return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha})`;
  }

  function bindEvents(sidebar, propsBar) {
    let isEraserMode = false;
    let handle = sidebar.querySelector('.wa-drag-grip'), isDragging = false, oX = 0, oY = 0;
    
    handle.addEventListener('mousedown', (e) => { isDragging = true; oX = e.clientX - sidebar.offsetLeft; oY = e.clientY - sidebar.offsetTop; });
    document.addEventListener('mousemove', (e) => { if (isDragging) { sidebar.style.left = Math.max(0, e.clientX - oX) + 'px'; sidebar.style.top = Math.max(0, e.clientY - oY) + 'px'; }});
    document.addEventListener('mouseup', () => { isDragging = false; });

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
        if (confirm("Thao tác này sẽ xóa toàn bộ hình vẽ trên biểu đồ?")) {
          global.tvChart.removeOverlay();
          executeTool('pointer');
        }
        return;
      }
      if (toolId === 'pointer') { c.classList.remove('wa-drawing-mode'); isEraserMode = false; return; }
      if (toolId === 'eraser') { c.classList.remove('wa-drawing-mode'); isEraserMode = true; return; }

      c.classList.add('wa-drawing-mode');
      isEraserMode = false;

      try {
        global.tvChart.createOverlay({
          name: toolId, lock: false,
          extendData: globalStyles.textInput,
          styles: { 
            line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle }, 
            text: { color: globalStyles.textColor, size: globalStyles.textSize, weight: 'normal' }, // Font normal nhẹ nhàng hơn
            polygon: { color: hexToRgba(globalStyles.fillColor, 0.15), style: 'fill', borderColor: globalStyles.lineColor } 
          }
        });
      } catch (err) {}
    }

    if (global.tvChart && typeof global.tvChart.subscribeAction === 'function' && !global.tvChart.__wa_event_bound) {
        global.tvChart.__wa_event_bound = true;
        
        global.tvChart.subscribeAction('onDrawEnd', function(evt) {
          executeTool('pointer'); 
          document.querySelectorAll('.wa-btn, .wa-menu-item').forEach(el => el.classList.remove('active'));
          document.querySelector('[data-tool="pointer"]').classList.add('active');

          // TỰ ĐỘNG FOCUS KHI VỪA VẼ TEXT XONG
          if (evt && evt.name === 'customText') {
              currentSelectedOverlay = global.tvChart.getOverlayById(evt.id);
              if (currentSelectedOverlay) {
                  showFloatingProps();
                  setTimeout(() => {
                      let inputEl = propsBar.querySelector('#wa-prop-text-input');
                      if (inputEl) {
                          inputEl.focus();
                          inputEl.select(); // Bôi đen sẵn, gõ là ăn ngay
                      }
                  }, 50);
              }
          }
        });

        global.tvChart.subscribeAction('onOverlayClick', function(params) {
          if (!params || !params.overlay) { hideFloatingProps(); return; }
          if (isEraserMode) { global.tvChart.removeOverlay({ id: params.overlay.id }); return; }
          currentSelectedOverlay = params.overlay;
          showFloatingProps();
        });
    }

    if (!global.__wa_keyboard_bound) {
        global.__wa_keyboard_bound = true;
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if ((e.key === 'Delete' || e.key === 'Backspace') && currentSelectedOverlay && global.tvChart) {
                global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
                hideFloatingProps();
            }
        });
    }

    const elLineColor = propsBar.querySelector('#wa-prop-line-color'), elFillColor = propsBar.querySelector('#wa-prop-fill-color');
    const elTextColor = propsBar.querySelector('#wa-prop-text-color'), elLineSize = propsBar.querySelector('#wa-prop-line-size');
    const elLineStyle = propsBar.querySelector('#wa-prop-line-style'), elTextSize = propsBar.querySelector('#wa-prop-text-size');
    const elTextInput = propsBar.querySelector('#wa-prop-text-input'), elTextWrapper = propsBar.querySelector('#wa-prop-text-wrapper');

    // HÀM UPDATE REALTIME TẤT CẢ CÁC SỰ KIỆN GÕ PHÍM / ĐỔI MÀU
    function updateSelectedOverlay(e) {
        if (!currentSelectedOverlay || !global.tvChart) return;
        
        globalStyles.lineColor = elLineColor.value;
        globalStyles.fillColor = elFillColor.value;
        globalStyles.textColor = elTextColor.value;
        globalStyles.lineWidth = parseInt(elLineSize.value);
        globalStyles.lineStyle = elLineStyle.value;
        globalStyles.textSize = parseInt(elTextSize.value);
        
        let newExtendData = currentSelectedOverlay.extendData;
        if(currentSelectedOverlay.name === 'customText') {
            globalStyles.textInput = elTextInput.value;
            newExtendData = globalStyles.textInput;
        }

        global.tvChart.overrideOverlay({
            id: currentSelectedOverlay.id,
            extendData: newExtendData,
            styles: {
                line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle },
                text: { color: globalStyles.textColor, size: globalStyles.textSize, family: 'sans-serif', weight: 'normal' },
                polygon: { color: hexToRgba(globalStyles.fillColor, 0.15), borderColor: globalStyles.lineColor, borderSize: globalStyles.lineWidth, borderStyle: globalStyles.lineStyle }
            }
        });
    }

    [elLineColor, elFillColor, elTextColor, elLineSize, elLineStyle, elTextSize].forEach(el => {
        if(el) {
            el.addEventListener('input', updateSelectedOverlay);
            el.addEventListener('change', updateSelectedOverlay);
        }
    });

    // LẮNG NGHE SỰ KIỆN GÕ PHÍM TRỰC TIẾP TRÊN Ô TEXT ĐỂ UPDATE REALTIME
    if(elTextInput) {
        elTextInput.addEventListener('input', updateSelectedOverlay);
    }

    let btnDelete = propsBar.querySelector('#wa-prop-delete');
    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            if (currentSelectedOverlay && global.tvChart) {
                global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
                hideFloatingProps();
            }
        });
    }

    function showFloatingProps() {
        if (!currentSelectedOverlay) return;
        let s = currentSelectedOverlay.styles || {};
        elLineColor.value = colorToHex((s.line && s.line.color) ? s.line.color : globalStyles.lineColor);
        elFillColor.value = colorToHex((s.polygon && s.polygon.color) ? s.polygon.color : globalStyles.fillColor);
        elTextColor.value = colorToHex((s.text && s.text.color) ? s.text.color : globalStyles.textColor);
        elLineSize.value = (s.line && s.line.size) ? s.line.size : 1;
        elLineStyle.value = (s.line && s.line.style) ? s.line.style : 'solid';
        elTextSize.value = (s.text && s.text.size) ? s.text.size : 12;

        if (currentSelectedOverlay.name === 'customText') {
            elTextWrapper.style.display = 'flex';
            elTextInput.value = typeof currentSelectedOverlay.extendData === 'string' ? currentSelectedOverlay.extendData : 'Văn bản...';
        } else {
            elTextWrapper.style.display = 'none';
        }
        propsBar.classList.add('show');
    }

    function hideFloatingProps() {
        propsBar.classList.remove('show');
        currentSelectedOverlay = null;
    }

    document.getElementById('sc-chart-container').addEventListener('mousedown', (e) => {
        if (!e.target.closest('.wa-floating-props') && !e.target.closest('.wa-floating-sidebar')) hideFloatingProps();
    });
  }

  // ======================================================
  // 5. HỆ THỐNG AUTO-HEAL (CHỐNG MẤT UI KHI ĐỔI TIMEFRAME)
  // ======================================================
  function ensureUI() {
    var container = document.getElementById('sc-chart-container');
    if (!container) return;

    var hasCanvas = container.querySelector('canvas');
    var hasSidebar = container.querySelector('.wa-floating-sidebar');

    if (hasCanvas && !hasSidebar) {
        injectCSS();
        registerProExtensions();

        var sidebar = document.createElement('div');
        sidebar.className = 'wa-floating-sidebar';
        sidebar.innerHTML = buildHTML();
        container.appendChild(sidebar);

        var propsBar = document.createElement('div');
        propsBar.className = 'wa-floating-props';
        propsBar.id = 'wa-props-bar';
        propsBar.innerHTML = buildFloatingPropsHTML();
        container.appendChild(propsBar);

        bindEvents(sidebar, propsBar);
    }
  }

  if (!global.__wa_auto_heal_started) {
      global.__wa_auto_heal_started = true;
      setInterval(ensureUI, 500);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI);
      else ensureUI();
  }

})(window);