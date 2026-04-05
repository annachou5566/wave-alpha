// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026 (MASTERPIECE EDITION)
// Tech: Vanilla JS, KLineChart v9 API
// Tối ưu UI/UX mượt mà, Fix Hover Trap, Fix Realtime Text
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
  
  // Debounce (16ms = ~60FPS) để cập nhật Real-time không lag
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Khởi tạo LocalStorage với đầy đủ các thuộc tính để KHÔNG BAO GIỜ CRASH
  const defaultStyles = {
    lines: { lineColor: '#00F0FF', lineWidth: 1, lineStyle: 'solid' },
    shapes: { borderColor: '#00F0FF', borderWidth: 1, fillColor: '#00F0FF', fillOpacity: 0.15 }, // Hình khối mặc định trong suốt 15%
    fibo: { lineColor: '#EAECEF', showLabels: true, fillOpacity: 0.15 },
    text: { textColor: '#EAECEF', textSize: 14, textInput: 'Văn bản...' },
    waves: { lineColor: '#00F0FF', lineWidth: 1, textColor: '#EAECEF', textSize: 12 } // Fix lỗi sập Sóng Elliott
  };
  
  // Đồng bộ Storage an toàn
  let storedStyles = {};
  try { storedStyles = JSON.parse(localStorage.getItem('wa_drawing_styles')) || {}; } catch(e){}
  let toolStyles = { ...defaultStyles, ...storedStyles };
  
  // Đảm bảo các node con không bị mất nếu Storage cũ thiếu
  Object.keys(defaultStyles).forEach(k => { if(!toolStyles[k]) toolStyles[k] = defaultStyles[k]; });

  function saveStyles() { localStorage.setItem('wa_drawing_styles', JSON.stringify(toolStyles)); }

  function hexToRgba(hex, alpha) {
    if(!hex) return `rgba(0,240,255,${alpha})`;
    let r = parseInt(hex.slice(1, 3), 16) || 0, g = parseInt(hex.slice(3, 5), 16) || 0, b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function colorToHex(color) {
    if (!color) return '#00F0FF';
    if (color.startsWith('#')) return color.substring(0, 7);
    let match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) return `#${parseInt(match[1]).toString(16).padStart(2,'0')}${parseInt(match[2]).toString(16).padStart(2,'0')}${parseInt(match[3]).toString(16).padStart(2,'0')}`;
    return '#00F0FF';
  }

  // ==========================================
  // 2. KLINECHART EXTENSIONS (17+ CÔNG CỤ VẼ)
  // ==========================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc || kc.__wa_extensions_registered) return;
    kc.__wa_extensions_registered = true;

    function getDistance(c1, c2) { return Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2)); }
    function getRotateCoordinate(c, tc, angle) { return { x: (c.x - tc.x) * Math.cos(angle) - (c.y - tc.y) * Math.sin(angle) + tc.x, y: (c.x - tc.x) * Math.sin(angle) + (c.y - tc.y) * Math.cos(angle) + tc.y }; }
    function getRayLine(c, b) {
      if (c.length > 1) {
        let coord;
        if (c[0].x === c[1].x && c[0].y !== c[1].y) coord = c[0].y < c[1].y ? { x: c[0].x, y: b.height } : { x: c[0].x, y: 0 };
        else if (c[0].x > c[1].x) coord = { x: 0, y: kc.utils.getLinearYFromCoordinates(c[0], c[1], { x: 0, y: c[0].y }) };
        else coord = { x: b.width, y: kc.utils.getLinearYFromCoordinates(c[0], c[1], { x: b.width, y: c[0].y }) };
        return [{ coordinates: [c[0], coord] }]; // Đã fix: Bọc mảng [] để KLineChart không bị crash
      } return [];
    }

    function createWave(name, step, labels) {
      return {
        name, totalStep: step, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: (ref) => {
          let c = ref.coordinates || []; let figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          labels.forEach((l, i) => { if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 8, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true }); });
          return figs;
        }
      };
    }

    const extensions = [
      createWave('waveElliott', 7, ['0', '1', '2', '3', '4', '5']), createWave('waveABC', 5, ['0', 'A', 'B', 'C']),
      createWave('waveTriangle', 7, ['0', 'A', 'B', 'C', 'D', 'E']), createWave('waveWXY', 5, ['0', 'W', 'X', 'Y']),
      { name: 'threeWaves', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'fiveWaves', totalStep: 7, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'eightWaves', totalStep: 10, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'anyWaves', totalStep: Number.MAX_SAFE_INTEGER, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },

      {
        name: 'arrow', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          if (coordinates.length > 1) {
            const flag = coordinates[1].x > coordinates[0].x ? 0 : 1; const kb = kc.utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]);
            let offsetAngle = kb ? Math.atan(kb[0]) + Math.PI * flag : (coordinates[1].y > coordinates[0].y ? Math.PI / 2 : Math.PI / 2 * 3);
            const rotateCoordinate1 = getRotateCoordinate({ x: coordinates[1].x - 8, y: coordinates[1].y + 4 }, coordinates[1], offsetAngle);
            const rotateCoordinate2 = getRotateCoordinate({ x: coordinates[1].x - 8, y: coordinates[1].y - 4 }, coordinates[1], offsetAngle);
            return [{ type: 'line', attrs: { coordinates } }, { type: 'line', ignoreEvent: true, attrs: { coordinates: [rotateCoordinate1, coordinates[1], rotateCoordinate2] } }];
          } return [];
        }
      },

      // SHAPES: Đã fix tô màu, viền mỏng
      { name: 'circle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { if (coordinates.length > 1) return { type: 'circle', attrs: { ...coordinates[0], r: getDistance(coordinates[0], coordinates[1]) } }; return []; } },
      { name: 'rect', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { if (coordinates.length > 1) return [{ type: 'polygon', attrs: { coordinates: [ coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y } ] } }]; return []; } },
      { name: 'triangle', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { return [{ type: 'polygon', attrs: { coordinates } }]; } },
      {
        name: 'parallelogram', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          if (coordinates.length === 2) return [{ type: 'line', ignoreEvent: true, attrs: { coordinates } }];
          if (coordinates.length === 3) { const coordinate = { x: coordinates[0].x + (coordinates[2].x - coordinates[1].x), y: coordinates[2].y }; return [{ type: 'polygon', attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2], coordinate] } }]; } return [];
        },
        performEventPressedMove: function({ points, performPointIndex, performPoint }) { if (performPointIndex < 2) { points[0].price = performPoint.price; points[1].price = performPoint.price; } },
        performEventMoveForDrawing: function({ currentStep, points, performPoint }) { if (currentStep === 2) points[0].price = performPoint.price; }
      },

      // FIBONACCI: Trả lại dải màu chuyên nghiệp
      {
        name: 'fibonacciLine', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, bounding, overlay, precision }) {
          // Fix triệt để lỗi crash do KLineChart trả về undefined
          const points = overlay?.points; 
          if (!coordinates || coordinates.length < 2 || !points || points.length < 2) return [];
          
          const lines = [], polygons = [], texts = [];
          const vDif = (points[0].value || 0) - (points[1].value || 0);
          const yDif = (coordinates[0].y || 0) - (coordinates[1].y || 0);
          const percents = [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0];
          
          const rainbow = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)'];
          let prevY = null;
          let ext = overlay.extendData || {};
          let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
          const pricePrec = (precision && precision.price !== undefined) ? precision.price : 2;

          percents.forEach((p, i) => {
            const y = coordinates[1].y + yDif * p;
            const price = ((points[1].value || 0) + vDif * p).toFixed(pricePrec);
            
            // Giới hạn chiều ngang chính xác tới điểm thứ 2, không full màn hình
            const endX = coordinates[1].x; 
            
            lines.push({ coordinates: [{ x: coordinates[0].x, y }, { x: endX, y }] });
            texts.push({ x: coordinates[0].x, y: y - 4, text: `${p} (${price})`, baseline: 'bottom' });
            
            if (prevY !== null && i > 0 && alpha > 0) {
              polygons.push({
                type: 'polygon', ignoreEvent: true,
                attrs: { coordinates: [{x:coordinates[0].x, y:prevY}, {x:endX, y:prevY}, {x:endX, y:y}, {x:coordinates[0].x, y:y}] },
                styles: { style: 'fill', color: rainbow[i-1].replace('0.15', alpha) }
              });
            }
            prevY = y;
          });
          return [...polygons, { type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },
      { name: 'fibonacciSegment', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates, overlay, precision }) { const lines = [], texts = []; if (coordinates.length > 1) { const textX = coordinates[1].x > coordinates[0].x ? coordinates[0].x : coordinates[1].x; const yDif = coordinates[0].y - coordinates[1].y; const points = overlay.points; const valueDif = points[0].value - points[1].value; [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0].forEach(percent => { const y = coordinates[1].y + yDif * percent; const price = (points[1].value + valueDif * percent).toFixed(precision.price); lines.push({ coordinates: [{ x: coordinates[0].x, y }, { x: coordinates[1].x, y }] }); texts.push({ x: textX, y: y - 4, text: `${price} (${(percent * 100).toFixed(1)}%)`, baseline: 'bottom' }); }); } return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'fibonacciCircle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { if (coordinates.length > 1) { const radius = getDistance(coordinates[0], coordinates[1]); const circles = [], texts = []; [0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(percent => { const r = radius * percent; circles.push({ ...coordinates[0], r }); texts.push({ x: coordinates[0].x, y: coordinates[0].y + r + 6, text: `${(percent * 100).toFixed(1)}%` }); }); return [{ type: 'circle', attrs: circles, styles: { style: 'stroke' } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } return []; } },
      { name: 'fibonacciSpiral', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates, bounding }) { if (coordinates.length > 1) { const startRadius = getDistance(coordinates[0], coordinates[1]) / Math.sqrt(24); const flag = coordinates[1].x > coordinates[0].x ? 0 : 1; const kb = kc.utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]); let offsetAngle = kb ? Math.atan(kb[0]) + Math.PI * flag : (coordinates[1].y > coordinates[0].y ? Math.PI / 2 : Math.PI / 2 * 3); const rotateCoordinate1 = getRotateCoordinate({ x: coordinates[0].x - startRadius, y: coordinates[0].y }, coordinates[0], offsetAngle); const rotateCoordinate2 = getRotateCoordinate({ x: coordinates[0].x - startRadius, y: coordinates[0].y - startRadius }, coordinates[0], offsetAngle); const arcs = [ { ...rotateCoordinate1, r: startRadius, startAngle: offsetAngle, endAngle: offsetAngle + Math.PI / 2 }, { ...rotateCoordinate2, r: startRadius * 2, startAngle: offsetAngle + Math.PI / 2, endAngle: offsetAngle + Math.PI } ]; let x = coordinates[0].x - startRadius, y = coordinates[0].y - startRadius; for (let i = 2; i < 9; i++) { const r = arcs[i - 2].r + arcs[i - 1].r; let startAngle = 0; switch (i % 4) { case 0: startAngle = offsetAngle; x -= arcs[i - 2].r; break; case 1: startAngle = offsetAngle + Math.PI / 2; y -= arcs[i - 2].r; break; case 2: startAngle = offsetAngle + Math.PI; x += arcs[i - 2].r; break; case 3: startAngle = offsetAngle + Math.PI / 2 * 3; y += arcs[i - 2].r; break; } const rotateCoordinate = getRotateCoordinate({ x, y }, coordinates[0], offsetAngle); arcs.push({ ...rotateCoordinate, r, startAngle, endAngle: startAngle + Math.PI / 2 }); } return [{ type: 'arc', attrs: arcs }, { type: 'line', attrs: getRayLine(coordinates, bounding) }]; } return []; } },
      {
        name: 'fibonacciSpeedResistanceFan', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, bounding, overlay }) {
          const lines1 = [], texts = [], polygons = []; let lines2 = [];
          if (coordinates.length > 1) {
            const xOffset = coordinates[1].x > coordinates[0].x ? -38 : 4; const yOffset = coordinates[1].y > coordinates[0].y ? -2 : 20;
            const xDis = coordinates[1].x - coordinates[0].x, yDis = coordinates[1].y - coordinates[0].y;
            const percents = [1, 0.75, 0.618, 0.5, 0.382, 0.25, 0];
            const colors = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)'];
            let ext = overlay.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
            let prevCoord = null;

            percents.forEach((p, i) => {
              const x = coordinates[1].x - xDis * p, y = coordinates[1].y - yDis * p;
              lines1.push({ coordinates: [{ x, y: coordinates[0].y }, { x, y: coordinates[1].y }] });
              lines1.push({ coordinates: [{ x: coordinates[0].x, y }, { x: coordinates[1].x, y }] });
              lines2 = lines2.concat(getRayLine([coordinates[0], { x, y: coordinates[1].y }], bounding));
              lines2 = lines2.concat(getRayLine([coordinates[0], { x: coordinates[1].x, y }], bounding));
              texts.unshift({ x: coordinates[0].x + xOffset, y: y + 10, text: `${p.toFixed(3)}` });
              texts.unshift({ x: x - 18, y: coordinates[0].y + yOffset, text: `${p.toFixed(3)}` });
              
              // Tô màu mảng quạt Fibo
              let endRay = getRayLine([coordinates[0], { x: coordinates[1].x, y }], bounding)[0];
              if(endRay && prevCoord && i > 0 && alpha > 0) {
                 polygons.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [coordinates[0], endRay.coordinates[1], prevCoord] }, styles: { style: 'fill', color: colors[i-1].replace('0.15', alpha) } });
              }
              if(endRay) prevCoord = endRay.coordinates[1];
            });
          } return [...polygons, { type: 'line', attrs: lines1 }, { type: 'line', attrs: lines2 }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },
      {
        name: 'fibonacciExtension', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, overlay, precision, bounding }) {
          const fbLines = [], texts = [], polygons = [];
          if (!coordinates || coordinates.length < 2 || !overlay?.points || overlay.points.length < 2) return [];
          
          // Chỉ vẽ các mốc Fibo khi đã click đủ 3 điểm
          if (coordinates.length > 2 && overlay.points.length > 2) {
            const points = overlay.points; 
            const valueDif = (points[1].value || 0) - (points[0].value || 0);
            const yDif = (coordinates[1].y || 0) - (coordinates[0].y || 0); 
            const textX = coordinates[2].x > coordinates[1].x ? coordinates[1].x : coordinates[2].x;
            const percents = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)'];
            let prevY = null; let ext = overlay.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
            const pricePrec = (precision && precision.price !== undefined) ? precision.price : 2;

            percents.forEach((p, i) => {
              const y = coordinates[2].y + yDif * p; 
              const price = ((points[2].value || 0) + valueDif * p).toFixed(pricePrec);
              
              // Giới hạn chiều dài khung Fibo phụ thuộc đúng vào điểm thứ 3
              const endX = coordinates[2].x;

              fbLines.push({ coordinates: [{ x: coordinates[1].x, y }, { x: endX, y }] });
              texts.push({ x: textX, y: y - 4, text: `${p} (${price})`, baseline: 'bottom' });
              
              if (prevY !== null && i > 0 && alpha > 0) {
                polygons.push({ 
                  type: 'polygon', ignoreEvent: true, 
                  attrs: { coordinates: [{x:coordinates[1].x, y:prevY}, {x:endX, y:prevY}, {x:endX, y:y}, {x:coordinates[1].x, y:y}] }, 
                  styles: { style: 'fill', color: colors[i-1].replace('0.15', alpha) } 
                });
              }
              prevY = y;
            });
          } 
          return [{ type: 'line', attrs: { coordinates }, styles: { style: 'dashed' } }, ...polygons, { type: 'line', attrs: fbLines }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // CÁC MÔ HÌNH PHỨC TẠP
      { name: 'gannBox', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { if (coordinates.length > 1) { const quarterYDis = (coordinates[1].y - coordinates[0].y) / 4; const xDis = coordinates[1].x - coordinates[0].x; const dashedLines = [ { coordinates: [coordinates[0], { x: coordinates[1].x, y: coordinates[1].y - quarterYDis }] }, { coordinates: [coordinates[0], { x: coordinates[1].x, y: coordinates[1].y - quarterYDis * 2 }] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[1].x, y: coordinates[0].y + quarterYDis }] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[1].x, y: coordinates[0].y + quarterYDis * 2 }] }, { coordinates: [{ ...coordinates[0] }, { x: coordinates[0].x + xDis * 0.236, y: coordinates[1].y }] }, { coordinates: [{ ...coordinates[0] }, { x: coordinates[0].x + xDis * 0.5, y: coordinates[1].y }] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[0].x + xDis * 0.236, y: coordinates[0].y }] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[0].x + xDis * 0.5, y: coordinates[0].y }] } ]; const solidLines = [ { coordinates: [coordinates[0], coordinates[1]] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[1].x, y: coordinates[0].y }] } ]; return [ { type: 'line', attrs: [{ coordinates: [coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }] }, { coordinates: [{ x: coordinates[1].x, y: coordinates[0].y }, coordinates[1]] }, { coordinates: [coordinates[1], { x: coordinates[0].x, y: coordinates[1].y }] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, coordinates[0]] }] }, { type: 'polygon', ignoreEvent: true, attrs: { coordinates: [ coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y } ] } }, { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } }, { type: 'line', attrs: solidLines } ]; } return []; } },
      { name: 'abcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { let acLineCoordinates = [], bdLineCoordinates = []; const tags = ['A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` })); if (coordinates.length > 2) { acLineCoordinates = [coordinates[0], coordinates[2]]; if (coordinates.length > 3) bdLineCoordinates = [coordinates[1], coordinates[3]]; } return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: [{ coordinates: acLineCoordinates }, { coordinates: bdLineCoordinates }], styles: { style: 'dashed' } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'xabcd', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const dashedLines = [], polygons = []; const tags = ['X', 'A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` })); if (coordinates.length > 2) { dashedLines.push({ coordinates: [coordinates[0], coordinates[2]] }); polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] }); if (coordinates.length > 3) { dashedLines.push({ coordinates: [coordinates[1], coordinates[3]] }); if (coordinates.length > 4) { dashedLines.push({ coordinates: [coordinates[2], coordinates[4]] }); polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] }); } } } return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } }, { type: 'polygon', ignoreEvent: true, attrs: polygons }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
     {
        name: 'headAndShoulders', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          // Nền mờ 8% để nhìn xuyên thấu nến
          const faintStyle = { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' }; 
          if (c.length >= 4) figs.push({ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2], c[3]] }, styles: faintStyle });
          if (c.length >= 7) figs.push({ type: 'polygon', attrs: { coordinates: [c[3], c[4], c[5], c[6]] }, styles: faintStyle });
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          ['Left', 'Head', 'Right'].forEach((l, i) => { let idx = (i===0)?1 : (i===1)?3 : 5; if (c[idx]) figs.push({ type: 'text', attrs: { x: c[idx].x, y: c[idx].y - 15, text: l, align: 'center' }, ignoreEvent: true }); });
          return figs;
        }
      },

      // FIX TRIỆT ĐỂ: TEXT REAL-TIME 1 CLICK
      {
        name: 'customText', totalStep: 1, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          // Phải luôn là String và có độ dài để kích hoạt Bounding Box (click vào hình để edit)
          let t = ref.overlay.extendData; 
          if (typeof t !== 'string' || t.trim() === '') t = 'Văn bản...';
          
          let lines = t.split('\n');
          let figs = [];
          lines.forEach((line, idx) => {
            figs.push({ 
              type: 'text', 
              attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y + (idx * 16), text: line, baseline: 'bottom', align: 'left' }, 
              ignoreEvent: false 
            });
          });
          return figs;
        }
      }
    ];

    extensions.forEach(e => { try { kc.registerOverlay(e); } catch(err){} });
  }

  // ======================================================
  // 3. UI GENERATION (SIDEBAR BÊN TRÁI & PANEL BÊN PHẢI)
  // ======================================================
  function injectCSS() {
    if (document.getElementById('wa-pro-css-v4')) return;
    const style = document.createElement('style'); style.id = 'wa-pro-css-v4';
    style.textContent = `
      #sc-chart-container { position: relative !important; overflow: hidden !important; }
      
      /* TOOLBAR BÊN TRÁI */
      .wa-toolbar { position: absolute; top: 60px; left: 16px; z-index: 999; width: 44px; background: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; padding: 0 0 6px 0; transition: height 0.2s, overflow 0.2s; }
      .wa-toolbar.collapsed { height: 24px; overflow: hidden; }
      .wa-drag-grip { width: 100%; height: 24px; display: flex; align-items: center; justify-content: center; cursor: grab; border-bottom: 1px solid transparent; opacity: 0.6; margin-bottom: 4px; background: #2b3139; border-radius: 8px 8px 0 0; }
      .wa-drag-grip:active { cursor: grabbing; }
      .wa-drag-grip svg { width: 14px; height: 14px; color: #848E9C; }
      .wa-drag-grip:hover { opacity: 1; color: #EAECEF; }
      
      .wa-tb-btn { width: 34px; height: 34px; border-radius: 6px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; margin: 2px 0; position: relative; transition: 0.15s; }
      .wa-tb-btn svg { width: 20px; height: 20px; }
      .wa-tb-btn:hover { background: #2b3139; color: #EAECEF; }
      .wa-tb-btn.active { background: rgba(0, 240, 255, 0.15); color: #00F0FF; box-shadow: 0 0 8px rgba(0, 240, 255, 0.2); }
      
      /* TOOLTIP KHI HOVER */
      .wa-tb-btn::after { content: attr(data-tooltip); position: absolute; left: 48px; top: 50%; transform: translateY(-50%); background: #1E2329; color: #EAECEF; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; pointer-events: none; opacity: 0; transition: 0.2s; border: 1px solid #2b3139; z-index: 1000; }
      .wa-tb-btn:hover::after { opacity: 1; }

      /* MENU CON - FIX LỖI HOVER TRAP (KHE HỞ BỊ CHẾT) */
      .wa-tb-group { position: relative; width: 100%; display: flex; justify-content: center; }
      .wa-tb-group::after { content: ''; position: absolute; right: 4px; bottom: 6px; border: solid #848E9C; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); pointer-events: none; }
      .wa-tb-menu { 
         position: absolute; left: 100%; top: -6px; 
         padding-left: 8px; /* Đây là cây cầu tàng hình giúp chuột đi ngang không bị sập menu */
         display: none; z-index: 1000; 
      }
      .wa-tb-group:hover .wa-tb-menu { display: block; }
      .wa-tb-menu-inner { background: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); width: 230px; padding: 6px 0; display: flex; flex-direction: column; }
      .wa-menu-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; cursor: pointer; transition: 0.1s; }
      .wa-menu-item:hover { background: #2b3139; color: #00F0FF; }

      /* PROPS PANEL BÊN PHẢI (SLIDE IN) */
      .wa-props-panel { position: absolute; right: 0; top: 0; bottom: 0; width: 260px; background: rgba(22, 26, 30, 0.95); border-left: 1px solid #2b3139; box-shadow: -4px 0 24px rgba(0,0,0,0.5); backdrop-filter: blur(10px); z-index: 999; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; }
      .wa-props-panel.show { transform: translateX(0); }
      .wa-panel-header { padding: 16px; border-bottom: 1px solid #2b3139; display: flex; justify-content: space-between; align-items: center; color: #EAECEF; font-weight: bold; font-size: 14px; }
      .wa-close-btn { background: none; border: none; color: #848E9C; cursor: pointer; padding: 4px; border-radius: 4px; display:flex; align-items:center; }
      .wa-close-btn:hover { background: #2b3139; color: #F6465D; }
      .wa-panel-body { padding: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
      
      .wa-control-row { display: flex; flex-direction: column; gap: 6px; }
      .wa-control-row label { color: #848E9C; font-size: 12px; }
      .wa-input, .wa-select { background: #0B0E11; border: 1px solid #2b3139; color: #EAECEF; padding: 8px 10px; border-radius: 4px; outline: none; font-size: 13px; width: 100%; box-sizing: border-box; }
      .wa-input:focus, .wa-select:focus { border-color: #00F0FF; }
      .wa-textarea { height: 80px; resize: none; font-family: sans-serif; }
      .wa-color-picker { width: 100%; height: 34px; padding: 0; border: 1px solid #2b3139; border-radius: 4px; cursor: pointer; background: #0B0E11; }
      .wa-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-color-picker::-webkit-color-swatch { border: none; border-radius: 3px; }
      
      .wa-panel-footer { padding: 12px 16px; border-top: 1px solid #2b3139; display: flex; gap: 8px; justify-content: space-between; }
      .wa-action-btn { flex: 1; background: #2b3139; border: none; color: #EAECEF; padding: 10px; border-radius: 4px; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; }
      .wa-action-btn:hover { background: #3c4450; }
      .wa-action-btn.delete:hover { background: rgba(246, 70, 93, 0.2); color: #F6465D; }

      /* CONTEXT MENU & TOAST */
      .wa-context-menu { position: fixed; background: #161A1E; border: 1px solid #2b3139; border-radius: 6px; padding: 4px 0; min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 10000; display: none; }
      .wa-cm-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; cursor: pointer; transition: 0.1s; }
      .wa-cm-item:hover { background: #2b3139; color: #00F0FF; }
      .wa-toast { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(22, 26, 30, 0.9); border: 1px solid #2b3139; color: #EAECEF; padding: 8px 16px; border-radius: 20px; font-size: 13px; opacity: 0; transition: opacity 0.3s; z-index: 9999; pointer-events: none; }
      
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
    { icon: SVG.line, tools: [ {id: 'segment', n: 'Đường xu hướng'}, {id: 'rayLine', n: 'Tia'}, {id: 'horizontalStraightLine', n: 'Đường ngang'}, {id: 'verticalStraightLine', n: 'Đường dọc'}, {id: 'priceChannelLine', n: 'Kênh song song'}, {id: 'arrow', n: 'Mũi tên'} ]},
    { icon: SVG.fibo, tools: [ {id: 'fibonacciLine', n: 'Fibonacci Retracement'}, {id: 'fibonacciExtension', n: 'Fibo Extension'}, {id: 'fibonacciSpeedResistanceFan', n: 'Fibo Fan'}, {id: 'fibonacciCircle', n: 'Fibo Circle'}, {id: 'fibonacciSpiral', n: 'Fibo Spiral'}, {id: 'fibonacciSegment', n: 'Fibo Segment'} ]},
    { icon: SVG.shape, tools: [ {id: 'rect', n: 'Hình chữ nhật'}, {id: 'circle', n: 'Hình tròn'}, {id: 'triangle', n: 'Tam giác'}, {id: 'parallelogram', n: 'Hình bình hành'}, {id: 'gannBox', n: 'Hộp Gann'} ]},
    { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12l5-8 6 16 5-12 4 4"/></svg>`, tools: [ {id: 'waveElliott', n: 'Sóng Elliott (12345)'}, {id: 'waveABC', n: 'Sóng ABC'}, {id: 'waveTriangle', n: 'Tam giác (ABCDE)'}, {id: 'abcd', n: 'Mô hình ABCD'}, {id: 'xabcd', n: 'Mô hình XABCD'}, {id: 'headAndShoulders', n: 'Vai Đầu Vai'} ]}
  ];

  function buildToolbar() {
    let html = `<div class="wa-drag-grip" title="Kéo để di chuyển | Double-click để thu gọn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
                <button class="wa-tb-btn active" data-tool="pointer" data-tooltip="Con trỏ chuột (Esc)">${SVG.ptr}</button>`;
    MENUS.forEach(m => {
      html += `<div class="wa-tb-group"><button class="wa-tb-btn">${m.icon}</button>
                <div class="wa-tb-menu"><div class="wa-tb-menu-inner">`;
      m.tools.forEach(t => html += `<div class="wa-menu-item" data-tool="${t.id}">${t.n}</div>`);
      html += `</div></div></div>`;
    });
    html += `<div style="width:20px; height:1px; background:#2b3139; margin:8px 0;"></div>
             <button class="wa-tb-btn" id="wa-btn-magnet" data-tooltip="Bắt điểm (Magnet)">${SVG.magnet}</button>
             <button class="wa-tb-btn" id="wa-btn-clear" data-tooltip="Xóa tất cả">${SVG.trash}</button>`;
    return html;
  }

  function showToast(msg) {
    let t = document.getElementById('wa-toast');
    if(!t) { t = document.createElement('div'); t.id = 'wa-toast'; t.className = 'wa-toast'; document.getElementById('sc-chart-container').appendChild(t); }
    t.innerText = msg; t.style.opacity = 1; setTimeout(() => t.style.opacity = 0, 2000);
  }

  // --- THAY THẾ HÀM NÀY ---
  function createConfirmModal(msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    const box = document.createElement('div');
    box.style.cssText = 'background:#161A1E;border:1px solid #2b3139;padding:24px;border-radius:8px;color:#EAECEF;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.8);';
    box.innerHTML = `<div style="margin-bottom:20px;font-size:15px;">${msg}</div><div style="display:flex;gap:12px;justify-content:center;"><button id="wa-btn-c-cancel" style="padding:8px 20px;background:#2b3139;border:none;color:#EAECEF;border-radius:4px;cursor:pointer;">Hủy</button><button id="wa-btn-c-ok" style="padding:8px 20px;background:#F6465D;border:none;color:#FFF;border-radius:4px;cursor:pointer;font-weight:bold;">Đồng ý</button></div>`;
    overlay.appendChild(box);
    
    // LỖI Ở ĐÂY: Quên chèn modal vào giao diện. Đã bổ sung dòng dưới!
    document.getElementById('sc-chart-container').appendChild(overlay);

    setTimeout(() => {
      box.querySelector('#wa-btn-c-cancel').onclick = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      };
      box.querySelector('#wa-btn-c-ok').onclick = () => { 
        // Bắt buộc xóa bảng ngay lập tức khỏi màn hình trước
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // Delay nhẹ 50ms rồi mới bắt đầu xóa hình để không bị kẹt UI
        setTimeout(() => onConfirm(), 50); 
      };
    }, 0);
  }
  // ==========================================
  // 4. EVENTS ENGINE (UNDO, REDO, KEYBOARD)
  // ==========================================
  function bindCoreEvents(toolbar, panel) {
    const container = document.getElementById('sc-chart-container');
    
    // --- 1. Tính năng Kéo thả & Thu gọn (Double Click) ---
    let handle = toolbar.querySelector('.wa-drag-grip');
    let isDragging = false, startX, startY, initialX, initialY;
    
    if (handle) {
      handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initialX = toolbar.offsetLeft; initialY = toolbar.offsetTop;
        document.body.style.userSelect = 'none'; // Chống bôi đen văn bản khi kéo
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let dx = e.clientX - startX; let dy = e.clientY - startY;
        toolbar.style.left = Math.max(0, initialX + dx) + 'px';
        toolbar.style.top = Math.max(0, initialY + dy) + 'px';
      });
      document.addEventListener('mouseup', () => { isDragging = false; document.body.style.userSelect = ''; });
      
      // Double click để ẩn/hiện công cụ
      handle.addEventListener('dblclick', () => { toolbar.classList.toggle('collapsed'); });
    }

    // --- Đã gỡ bỏ tính năng Hoàn tác / Làm lại cho nhẹ mượt ---
    function saveHistory() {} // Giữ lại hàm rỗng để các sự kiện vẽ không bị crash

    // --- 3. Gắn sự kiện bằng querySelector ---
    toolbar.querySelector('#wa-btn-magnet').onclick = function() {
      isMagnetMode = !isMagnetMode; this.classList.toggle('active', isMagnetMode);
      showToast(isMagnetMode ? 'Đã bật chế độ Bắt điểm' : 'Đã tắt Bắt điểm');
    };
    
    // --- THAY THẾ SỰ KIỆN NÚT THÙNG RÁC ---
    toolbar.querySelector('#wa-btn-clear').onclick = function() {
      createConfirmModal('Bạn có chắc muốn xóa toàn bộ bản vẽ?', () => {
        if (global.tvChart) {
          global.tvChart.removeOverlay(); // KLineChart v9 chỉ cần gọi hàm rỗng là xóa tất cả
          global.tvChart.cancelDrawing(); 
          undoStack = []; redoStack = []; 
          hidePanel();
          
          // Trả lại trạng thái con trỏ chuột
          toolbar.querySelectorAll('.wa-tb-btn').forEach(b => b.classList.remove('active'));
          toolbar.querySelector('[data-tool="pointer"]').classList.add('active');
          container.classList.remove('wa-drawing-mode');
          
          showToast('Đã xóa sạch bản vẽ');
        }
      });
    };

    // --- 4. Sự kiện click chọn công cụ vẽ ---
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

      if (toolId === 'pointer') { container.classList.remove('wa-drawing-mode'); return; }
      container.classList.add('wa-drawing-mode');

      try {
        let tType = getToolCategory(toolId); let s = toolStyles[tType] || {};
        let config = { name: toolId, lock: false, styles: {} };
        
        if(tType === 'lines' || tType === 'waves') {
          config.styles.line = { color: s.lineColor || '#00F0FF', size: s.lineWidth || 1, style: s.lineStyle || 'solid' };
        } else if (tType === 'shapes') {
          config.styles.polygon = { style: 'stroke_fill', color: hexToRgba(s.fillColor, s.fillOpacity), borderColor: s.borderColor, borderSize: s.borderWidth };
        } else if (tType === 'fibo') {
          config.styles.line = { color: s.lineColor, size: 1 }; config.extendData = { showLabels: s.showLabels, fillOpacity: s.fillOpacity };
        } else if (toolId === 'customText') {
          config.extendData = toolStyles.text.textInput || 'Văn bản...'; // Ép kiểu chuỗi để fix lỗi bounding box
          config.styles.text = { color: s.textColor, size: s.textSize, weight: 'normal', family: 'sans-serif' };
        }

        global.tvChart.createOverlay(config);
      } catch (err) { showToast('Lỗi khởi tạo. Hệ thống sẽ khôi phục về mặc định.'); }
    }

    let waitChart = setInterval(() => {
      if (global.tvChart && typeof global.tvChart.subscribeAction === 'function') {
        if (!global.tvChart.__wa_event_bound) {
          global.tvChart.__wa_event_bound = true;
          
          global.tvChart.subscribeAction('onDrawEnd', function(data) {
            activateTool('pointer');
            toolbar.querySelector('[data-tool="pointer"]').classList.add('active');
            let overlayObj = Array.isArray(data) ? data[0] : data;
            if(!overlayObj) return;
            saveHistory('add', overlayObj); currentSelectedOverlay = overlayObj; renderPanel(currentSelectedOverlay);
          });

          global.tvChart.subscribeAction('onOverlayClick', function(data) {
            let overlayObj = (data && data.overlay) ? data.overlay : (Array.isArray(data) ? data[0] : data);
            if(!overlayObj) { hidePanel(); return; }
            let now = Date.now(); let isDoubleClick = (now - lastClickTime < 300); lastClickTime = now;
            currentSelectedOverlay = overlayObj; renderPanel(currentSelectedOverlay);

            if(isDoubleClick && overlayObj.name === 'customText') {
               setTimeout(() => { let t = document.getElementById('wa-prop-txt'); if(t) { t.focus(); t.select(); } }, 50);
            }
          });
        }
        clearInterval(waitChart);
      }
    }, 500);

    if(!global.__wa_kb_bound) {
      global.__wa_kb_bound = true;
      document.addEventListener('keydown', (e) => {
        let isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        if(e.key === 'Escape') {
          if(global.tvChart) global.tvChart.cancelDrawing();
          activateTool('pointer'); hidePanel(); if(isInput) e.target.blur();
        }
        if(!isInput) {
          if (e.key === 'Delete' || e.key === 'Backspace') {
            if (currentSelectedOverlay && global.tvChart) { saveHistory('delete', currentSelectedOverlay); global.tvChart.removeOverlay({ id: currentSelectedOverlay.id }); hidePanel(); }
          }
          if (e.ctrlKey && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
          if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); }
        }
      });
    }
  }

  // ==========================================
  // 5. PROPS PANEL (WYSIWYG TÙY BIẾN CHO TỪNG LOẠI)
  // ==========================================
  function getToolCategory(name) {
    if(['rect','circle','triangle','parallelogram','gannBox'].includes(name)) return 'shapes';
    if(name.startsWith('fibo')) return 'fibo';
    if(name === 'customText') return 'text';
    if(name.startsWith('wave') || name.includes('abcd') || name === 'headAndShoulders') return 'waves';
    return 'lines';
  }

  function renderPanel(overlay) {
    const panel = document.getElementById('wa-props-panel');
    if(!panel || !overlay) return;
    
    const cat = getToolCategory(overlay.name); const body = panel.querySelector('.wa-panel-body');
    let html = ''; let s = overlay.styles || {}; let ext = overlay.extendData || {};

    if (cat === 'text') {
      let txt = typeof ext === 'string' ? ext : (ext.text || 'Văn bản...');
      let c = (s.text && s.text.color) ? colorToHex(s.text.color) : toolStyles.text.textColor;
      let sz = (s.text && s.text.size) ? s.text.size : toolStyles.text.textSize;
      html += `
        <div class="wa-control-row"><label>Nội dung (Xuống dòng thoải mái)</label>
          <textarea id="wa-prop-txt" class="wa-input wa-textarea">${txt}</textarea></div>
        <div style="display:flex; gap:8px;">
          <div class="wa-control-row" style="flex:1"><label>Màu chữ</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${c}"></div>
          <div class="wa-control-row" style="flex:1"><label>Cỡ chữ</label><select id="wa-prop-s1" class="wa-select">
            <option value="12" ${sz==12?'selected':''}>12px</option><option value="14" ${sz==14?'selected':''}>14px</option>
            <option value="16" ${sz==16?'selected':''}>16px</option><option value="20" ${sz==20?'selected':''}>20px</option>
          </select></div>
        </div>`;
    } else if (cat === 'shapes') {
      let bc = (s.polygon && s.polygon.borderColor) ? colorToHex(s.polygon.borderColor) : toolStyles.shapes.borderColor;
      let fc = (s.polygon && s.polygon.color) ? colorToHex(s.polygon.color) : toolStyles.shapes.fillColor;
      html += `
        <div style="display:flex; gap:8px;">
          <div class="wa-control-row" style="flex:1"><label>Màu Viền</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${bc}"></div>
          <div class="wa-control-row" style="flex:1"><label>Màu Nền</label><input type="color" id="wa-prop-c2" class="wa-color-picker" value="${fc}"></div>
        </div>`;
    } else if (cat === 'fibo') {
      let lc = (s.line && s.line.color) ? colorToHex(s.line.color) : toolStyles.fibo.lineColor;
      let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : toolStyles.fibo.fillOpacity;
      html += `
        <div class="wa-control-row"><label>Màu vạch & Chữ</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${lc}"></div>
        <div class="wa-control-row"><label>Độ đậm nền (0 = Tắt màu)</label>
          <input type="number" id="wa-prop-a1" class="wa-input" step="0.05" min="0" max="1" value="${alpha}">
        </div>`;
    } else { 
      let lc = (s.line && s.line.color) ? colorToHex(s.line.color) : (toolStyles[cat] ? toolStyles[cat].lineColor : '#00F0FF');
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

    const updateEngine = debounce(() => {
      if(!currentSelectedOverlay || !global.tvChart) return;
      let newStyles = { ...currentSelectedOverlay.styles };
      let newExt = currentSelectedOverlay.extendData;
      
      const v_txt = document.getElementById('wa-prop-txt'); const v_c1 = document.getElementById('wa-prop-c1');
      const v_c2 = document.getElementById('wa-prop-c2'); const v_s1 = document.getElementById('wa-prop-s1');
      const v_a1 = document.getElementById('wa-prop-a1');

      if(cat === 'text') {
        newExt = v_txt ? v_txt.value : ''; toolStyles.text.textInput = newExt;
        if(v_c1) { newStyles.text = { ...newStyles.text, color: v_c1.value }; toolStyles.text.textColor = v_c1.value; }
        if(v_s1) { newStyles.text = { ...newStyles.text, size: parseInt(v_s1.value) }; toolStyles.text.textSize = parseInt(v_s1.value); }
      } 
      else if (cat === 'shapes') {
        if(v_c1) { newStyles.polygon = { ...newStyles.polygon, borderColor: v_c1.value }; toolStyles.shapes.borderColor = v_c1.value; }
        if(v_c2) { newStyles.polygon = { ...newStyles.polygon, color: hexToRgba(v_c2.value, 0.15), style: 'stroke_fill' }; toolStyles.shapes.fillColor = v_c2.value; }
      }
      else if (cat === 'fibo') {
        if(typeof newExt !== 'object') newExt = {};
        if(v_c1) { newStyles.line = { ...newStyles.line, color: v_c1.value }; newStyles.text = { ...newStyles.text, color: v_c1.value }; toolStyles.fibo.lineColor = v_c1.value; }
        if(v_a1) { newExt.fillOpacity = parseFloat(v_a1.value); toolStyles.fibo.fillOpacity = newExt.fillOpacity; }
      }
      else {
        if(v_c1) { newStyles.line = { ...newStyles.line, color: v_c1.value }; toolStyles[cat].lineColor = v_c1.value; }
        if(v_s1) { newStyles.line = { ...newStyles.line, size: parseInt(v_s1.value) }; toolStyles[cat].lineWidth = parseInt(v_s1.value); }
      }

      saveStyles();
      try { global.tvChart.overrideOverlay({ id: currentSelectedOverlay.id, styles: newStyles, extendData: newExt }); } catch(e){}
    }, 16);

    body.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('input', updateEngine); el.addEventListener('change', updateEngine); el.addEventListener('compositionend', updateEngine);
    });
  }

  function hidePanel() {
    const p = document.getElementById('wa-props-panel');
    if(p) p.classList.remove('show');
    currentSelectedOverlay = null;
  }

  // ==========================================
  // 6. RIGHT CLICK CONTEXT MENU 
  // ==========================================
  function bindContextMenu(panel) {
    const container = document.getElementById('sc-chart-container');
    const cm = document.createElement('div'); cm.className = 'wa-context-menu';
    cm.innerHTML = `<div class="wa-cm-item" id="wa-cm-edit">Chỉnh sửa</div><div class="wa-cm-item" id="wa-cm-clone">Nhân bản</div><div class="wa-cm-item" id="wa-cm-lock">Khóa / Mở khóa</div><div class="wa-cm-item" id="wa-cm-del" style="color:#F6465D;border-top:1px solid #2b3139;padding-top:12px;margin-top:4px;">Xóa hình</div>`;
    container.appendChild(cm);

    container.addEventListener('contextmenu', (e) => {
      if(!currentSelectedOverlay) return; e.preventDefault();
      cm.style.left = e.clientX + 'px'; cm.style.top = e.clientY + 'px'; cm.style.display = 'block';
    });

    document.addEventListener('click', (e) => { if(!e.target.closest('.wa-context-menu')) cm.style.display = 'none'; });

    function act(type) {
      if(currentSelectedOverlay && global.tvChart) {
        if (type==='del') { global.tvChart.removeOverlay({ id: currentSelectedOverlay.id }); hidePanel(); }
        if (type==='clone') { let cl = JSON.parse(JSON.stringify(currentSelectedOverlay)); delete cl.id; if (cl.points) cl.points = cl.points.map(p => ({ timestamp: p.timestamp, value: p.value * 1.001 })); global.tvChart.createOverlay(cl); showToast('Đã nhân bản'); }
        if (type==='lock') { global.tvChart.overrideOverlay({ id: currentSelectedOverlay.id, lock: !currentSelectedOverlay.lock }); showToast('Đã đổi trạng thái khóa'); }
        cm.style.display = 'none';
      }
    }

    cm.querySelector('#wa-cm-edit').onclick = () => { renderPanel(currentSelectedOverlay); cm.style.display = 'none'; };
    cm.querySelector('#wa-cm-clone').onclick = () => act('clone'); cm.querySelector('#wa-cm-lock').onclick = () => act('lock'); cm.querySelector('#wa-cm-del').onclick = () => act('del');
    panel.querySelector('.wa-close-btn').onclick = hidePanel; panel.querySelector('#wa-btn-p-lock').onclick = () => act('lock'); panel.querySelector('#wa-btn-p-del').onclick = () => act('del');
  }

  // ==========================================
  // 7. AUTO-HEAL SYSTEM (MutationObserver Siêu mượt)
  // ==========================================
  function mountUI() {
    var container = document.getElementById('sc-chart-container');
    if (!container || container.querySelector('.wa-toolbar')) return;

    injectCSS(); registerProExtensions();

    var sidebar = document.createElement('div'); sidebar.className = 'wa-toolbar'; sidebar.innerHTML = buildToolbar();
    container.appendChild(sidebar);

    var panel = document.createElement('div'); panel.className = 'wa-props-panel'; panel.id = 'wa-props-panel';
    panel.innerHTML = `<div class="wa-panel-header">Cài đặt công cụ <button class="wa-close-btn" title="Đóng (Esc)">${SVG.close}</button></div><div class="wa-panel-body"></div><div class="wa-panel-footer"><button class="wa-action-btn" id="wa-btn-p-lock" title="Khóa hình">${SVG.magnet}</button><button class="wa-action-btn delete" id="wa-btn-p-del" title="Xóa hình">${SVG.trash}</button></div>`;
    container.appendChild(panel);

    bindCoreEvents(sidebar, panel); bindContextMenu(panel);
  }

  if (!global.__wa_auto_heal_started) {
    global.__wa_auto_heal_started = true;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountUI); else mountUI();
    const domObserver = new MutationObserver(() => {
      if (document.getElementById('sc-chart-container') && !document.querySelector('.wa-toolbar')) mountUI();
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

})(window);