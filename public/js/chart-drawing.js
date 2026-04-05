// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026
// Fix: Lag Observer, Text Realtime Edit, Wave Steps
// ==========================================

(function (global) {
  'use strict';

  let currentSelectedOverlay = null;

  // 1. CẤU HÌNH MẶC ĐỊNH CHO HÌNH VẼ MỚI
  let globalStyles = {
    lineColor: '#00F0FF',
    fillColor: 'rgba(0, 240, 255, 0.15)',
    textColor: '#EAECEF',
    lineWidth: 2,
    lineStyle: 'solid',
    textSize: 16,
    textInput: 'Wave Alpha'
  };

  // ======================================================
  // 2. BỨNG 100% THUẬT TOÁN TỪ REPO PRO
  // ======================================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc || kc.__wa_extensions_registered) return;
    kc.__wa_extensions_registered = true;

    // --- CÁC HÀM TIỆN ÍCH (UTILS) ---
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

    // --- HÀM TẠO SÓNG (ĐÃ FIX BUG totalStep = points + 1) ---
    function createWave(name, totalStep, labels) {
      return {
        name: name, totalStep: totalStep, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function (ref) {
          var c = ref.coordinates || []; var figs = [];
          if (c.length > 1) figs.push({ type: 'line', attrs: { coordinates: c } });
          labels.forEach((l, i) => {
            if (c[i]) figs.push({ type: 'text', attrs: { x: c[i].x, y: c[i].y - 8, text: l, align: 'center', baseline: 'bottom' }, ignoreEvent: true });
          });
          return figs;
        }
      };
    }

    var extensions = [
      // Sóng Custom Wave Alpha (Đã fix cộng thêm 1 step)
      createWave('waveElliott', 7, ['0', '1', '2', '3', '4', '5']), 
      createWave('waveABC', 5, ['0', 'A', 'B', 'C']),                   
      createWave('waveTriangle', 7, ['0', 'A', 'B', 'C', 'D', 'E']),
      createWave('waveWXY', 5, ['0', 'W', 'X', 'Y']),

      // 1. ARROW
      {
        name: 'arrow', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          if (coordinates.length > 1) {
            const flag = coordinates[1].x > coordinates[0].x ? 0 : 1;
            const kb = kc.utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]);
            let offsetAngle = kb ? Math.atan(kb[0]) + Math.PI * flag : (coordinates[1].y > coordinates[0].y ? Math.PI / 2 : Math.PI / 2 * 3);
            const rotateCoordinate1 = getRotateCoordinate({ x: coordinates[1].x - 8, y: coordinates[1].y + 4 }, coordinates[1], offsetAngle);
            const rotateCoordinate2 = getRotateCoordinate({ x: coordinates[1].x - 8, y: coordinates[1].y - 4 }, coordinates[1], offsetAngle);
            return [{ type: 'line', attrs: { coordinates } }, { type: 'line', ignoreEvent: true, attrs: { coordinates: [rotateCoordinate1, coordinates[1], rotateCoordinate2] } }];
          }
          return [];
        }
      },

      // 2. CIRCLE
      {
        name: 'circle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        styles: { circle: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          if (coordinates.length > 1) {
            return { type: 'circle', attrs: { ...coordinates[0], r: getDistance(coordinates[0], coordinates[1]) }, styles: { style: 'stroke_fill' } };
          }
          return [];
        }
      },

      // 3. RECT
      {
        name: 'rect', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          if (coordinates.length > 1) {
            return [{ type: 'polygon', attrs: { coordinates: [ coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y } ] }, styles: { style: 'stroke_fill' } }];
          }
          return [];
        }
      },

      // 4. PARALLELOGRAM
      {
        name: 'parallelogram', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          if (coordinates.length === 2) return [{ type: 'line', ignoreEvent: true, attrs: { coordinates } }];
          if (coordinates.length === 3) {
            const coordinate = { x: coordinates[0].x + (coordinates[2].x - coordinates[1].x), y: coordinates[2].y };
            return [{ type: 'polygon', attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2], coordinate] }, styles: { style: 'stroke_fill' } }];
          }
          return [];
        },
        performEventPressedMove: function({ points, performPointIndex, performPoint }) {
          if (performPointIndex < 2) { points[0].price = performPoint.price; points[1].price = performPoint.price; }
        },
        performEventMoveForDrawing: function({ currentStep, points, performPoint }) {
          if (currentStep === 2) points[0].price = performPoint.price;
        }
      },

      // 5. TRIANGLE
      {
        name: 'triangle', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) { return [{ type: 'polygon', attrs: { coordinates }, styles: { style: 'stroke_fill' } }]; }
      },

      // 6. FIBONACCI CIRCLE
      {
        name: 'fibonacciCircle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          if (coordinates.length > 1) {
            const radius = getDistance(coordinates[0], coordinates[1]);
            const circles = [], texts = [];
            [0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(percent => {
              const r = radius * percent;
              circles.push({ ...coordinates[0], r });
              texts.push({ x: coordinates[0].x, y: coordinates[0].y + r + 6, text: `${(percent * 100).toFixed(1)}%` });
            });
            return [{ type: 'circle', attrs: circles, styles: { style: 'stroke' } }, { type: 'text', ignoreEvent: true, attrs: texts }];
          }
          return [];
        }
      },

      // 7. FIBONACCI SEGMENT
      {
        name: 'fibonacciSegment', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, overlay, precision }) {
          const lines = [], texts = [];
          if (coordinates.length > 1) {
            const textX = coordinates[1].x > coordinates[0].x ? coordinates[0].x : coordinates[1].x;
            const yDif = coordinates[0].y - coordinates[1].y;
            const points = overlay.points;
            const valueDif = points[0].value - points[1].value;
            [1, 0.786, 0.618, 0.5, 0.382, 0.236, 0].forEach(percent => {
              const y = coordinates[1].y + yDif * percent;
              const price = (points[1].value + valueDif * percent).toFixed(precision.price);
              lines.push({ coordinates: [{ x: coordinates[0].x, y }, { x: coordinates[1].x, y }] });
              texts.push({ x: textX, y, text: `${price} (${(percent * 100).toFixed(1)}%)`, baseline: 'bottom' });
            });
          }
          return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // 8. FIBONACCI SPIRAL
      {
        name: 'fibonacciSpiral', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, bounding }) {
          if (coordinates.length > 1) {
            const startRadius = getDistance(coordinates[0], coordinates[1]) / Math.sqrt(24);
            const flag = coordinates[1].x > coordinates[0].x ? 0 : 1;
            const kb = kc.utils.getLinearSlopeIntercept(coordinates[0], coordinates[1]);
            let offsetAngle = kb ? Math.atan(kb[0]) + Math.PI * flag : (coordinates[1].y > coordinates[0].y ? Math.PI / 2 : Math.PI / 2 * 3);
            const rotateCoordinate1 = getRotateCoordinate({ x: coordinates[0].x - startRadius, y: coordinates[0].y }, coordinates[0], offsetAngle);
            const rotateCoordinate2 = getRotateCoordinate({ x: coordinates[0].x - startRadius, y: coordinates[0].y - startRadius }, coordinates[0], offsetAngle);
            const arcs = [
              { ...rotateCoordinate1, r: startRadius, startAngle: offsetAngle, endAngle: offsetAngle + Math.PI / 2 },
              { ...rotateCoordinate2, r: startRadius * 2, startAngle: offsetAngle + Math.PI / 2, endAngle: offsetAngle + Math.PI }
            ];
            let x = coordinates[0].x - startRadius, y = coordinates[0].y - startRadius;
            for (let i = 2; i < 9; i++) {
              const r = arcs[i - 2].r + arcs[i - 1].r;
              let startAngle = 0;
              switch (i % 4) {
                case 0: startAngle = offsetAngle; x -= arcs[i - 2].r; break;
                case 1: startAngle = offsetAngle + Math.PI / 2; y -= arcs[i - 2].r; break;
                case 2: startAngle = offsetAngle + Math.PI; x += arcs[i - 2].r; break;
                case 3: startAngle = offsetAngle + Math.PI / 2 * 3; y += arcs[i - 2].r; break;
              }
              const rotateCoordinate = getRotateCoordinate({ x, y }, coordinates[0], offsetAngle);
              arcs.push({ ...rotateCoordinate, r, startAngle, endAngle: startAngle + Math.PI / 2 });
            }
            return [{ type: 'arc', attrs: arcs }, { type: 'line', attrs: getRayLine(coordinates, bounding) }];
          }
          return [];
        }
      },

      // 9. FIBONACCI FAN
      {
        name: 'fibonacciSpeedResistanceFan', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, bounding }) {
          const lines1 = [], texts = [];
          let lines2 = [];
          if (coordinates.length > 1) {
            const xOffset = coordinates[1].x > coordinates[0].x ? -38 : 4;
            const yOffset = coordinates[1].y > coordinates[0].y ? -2 : 20;
            const xDistance = coordinates[1].x - coordinates[0].x, yDistance = coordinates[1].y - coordinates[0].y;
            [1, 0.75, 0.618, 0.5, 0.382, 0.25, 0].forEach(percent => {
              const x = coordinates[1].x - xDistance * percent, y = coordinates[1].y - yDistance * percent;
              lines1.push({ coordinates: [{ x, y: coordinates[0].y }, { x, y: coordinates[1].y }] });
              lines1.push({ coordinates: [{ x: coordinates[0].x, y }, { x: coordinates[1].x, y }] });
              lines2 = lines2.concat(getRayLine([coordinates[0], { x, y: coordinates[1].y }], bounding));
              lines2 = lines2.concat(getRayLine([coordinates[0], { x: coordinates[1].x, y }], bounding));
              texts.unshift({ x: coordinates[0].x + xOffset, y: y + 10, text: `${percent.toFixed(3)}` });
              texts.unshift({ x: x - 18, y: coordinates[0].y + yOffset, text: `${percent.toFixed(3)}` });
            });
          }
          return [{ type: 'line', attrs: lines1 }, { type: 'line', attrs: lines2 }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // 10. FIBONACCI EXTENSION
      {
        name: 'fibonacciExtension', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates, overlay, precision }) {
          const fbLines = [], texts = [];
          if (coordinates.length > 2) {
            const points = overlay.points;
            const valueDif = points[1].value - points[0].value, yDif = coordinates[1].y - coordinates[0].y;
            const textX = coordinates[2].x > coordinates[1].x ? coordinates[1].x : coordinates[2].x;
            [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(percent => {
              const y = coordinates[2].y + yDif * percent;
              const price = (points[2].value + valueDif * percent).toFixed(precision.price);
              fbLines.push({ coordinates: [{ x: coordinates[1].x, y }, { x: coordinates[2].x, y }] });
              texts.push({ x: textX, y, text: `${price} (${(percent * 100).toFixed(1)}%)`, baseline: 'bottom' });
            });
          }
          return [{ type: 'line', attrs: { coordinates }, styles: { style: 'dashed' } }, { type: 'line', attrs: fbLines }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // 11. GANN BOX
      {
        name: 'gannBox', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          if (coordinates.length > 1) {
            const quarterYDis = (coordinates[1].y - coordinates[0].y) / 4;
            const xDis = coordinates[1].x - coordinates[0].x;
            const dashedLines = [
              { coordinates: [coordinates[0], { x: coordinates[1].x, y: coordinates[1].y - quarterYDis }] },
              { coordinates: [coordinates[0], { x: coordinates[1].x, y: coordinates[1].y - quarterYDis * 2 }] },
              { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[1].x, y: coordinates[0].y + quarterYDis }] },
              { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[1].x, y: coordinates[0].y + quarterYDis * 2 }] },
              { coordinates: [{ ...coordinates[0] }, { x: coordinates[0].x + xDis * 0.236, y: coordinates[1].y }] },
              { coordinates: [{ ...coordinates[0] }, { x: coordinates[0].x + xDis * 0.5, y: coordinates[1].y }] },
              { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[0].x + xDis * 0.236, y: coordinates[0].y }] },
              { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[0].x + xDis * 0.5, y: coordinates[0].y }] }
            ];
            const solidLines = [
              { coordinates: [coordinates[0], coordinates[1]] },
              { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, { x: coordinates[1].x, y: coordinates[0].y }] }
            ];
            return [
              { type: 'line', attrs: [{ coordinates: [coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }] }, { coordinates: [{ x: coordinates[1].x, y: coordinates[0].y }, coordinates[1]] }, { coordinates: [coordinates[1], { x: coordinates[0].x, y: coordinates[1].y }] }, { coordinates: [{ x: coordinates[0].x, y: coordinates[1].y }, coordinates[0]] }] },
              { type: 'polygon', ignoreEvent: true, attrs: { coordinates: [ coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y } ] }, styles: { style: 'fill' } },
              { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } },
              { type: 'line', attrs: solidLines }
            ];
          }
          return [];
        }
      },

      // 12. THREE WAVES
      { name: 'threeWaves', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      
      // 13. FIVE WAVES
      { name: 'fiveWaves', totalStep: 7, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },

      // 14. EIGHT WAVES
      { name: 'eightWaves', totalStep: 10, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },

      // 15. ANY WAVES
      { name: 'anyWaves', totalStep: Number.MAX_SAFE_INTEGER, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const texts = coordinates.map((coordinate, i) => ({ ...coordinate, text: `(${i})`, baseline: 'bottom' })); return [{ type: 'line', attrs: { coordinates } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },

      // 16. ABCD
      {
        name: 'abcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          let acLineCoordinates = [], bdLineCoordinates = [];
          const tags = ['A', 'B', 'C', 'D'];
          const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` }));
          if (coordinates.length > 2) {
            acLineCoordinates = [coordinates[0], coordinates[2]];
            if (coordinates.length > 3) bdLineCoordinates = [coordinates[1], coordinates[3]];
          }
          return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: [{ coordinates: acLineCoordinates }, { coordinates: bdLineCoordinates }], styles: { style: 'dashed' } }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // 17. XABCD
      {
        name: 'xabcd', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        styles: { polygon: { color: 'rgba(22, 119, 255, 0.15)' } },
        createPointFigures: function({ coordinates }) {
          const dashedLines = [], polygons = [];
          const tags = ['X', 'A', 'B', 'C', 'D'];
          const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` }));
          if (coordinates.length > 2) {
            dashedLines.push({ coordinates: [coordinates[0], coordinates[2]] });
            polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] });
            if (coordinates.length > 3) {
              dashedLines.push({ coordinates: [coordinates[1], coordinates[3]] });
              if (coordinates.length > 4) {
                dashedLines.push({ coordinates: [coordinates[2], coordinates[4]] });
                polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] });
              }
            }
          }
          return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } }, { type: 'polygon', ignoreEvent: true, attrs: polygons }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },

      // 18. CUSTOM TEXT (Đã Fix Thành Công)
      {
        name: 'customText', totalStep: 2, 
        needDefaultPointFigure: false, 
        needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function (ref) {
          if (!ref.coordinates || !ref.coordinates.length) return [];
          let t = ref.overlay.extendData;
          if (t === undefined || t === null) t = window.__WA_TEMP_TEXT__ || 'Văn bản...';
          return [{ type: 'text', attrs: { x: ref.coordinates[0].x, y: ref.coordinates[0].y, text: t, baseline: 'bottom', align: 'center' }, ignoreEvent: false }];
        }
      },

      // 19. HEAD & SHOULDERS (Đã fix 8 steps)
      {
        name: 'headAndShoulders', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
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
    style.textContent = `
      #sc-chart-container { position: relative !important; overflow: hidden !important; }
      .wa-floating-sidebar { position: absolute; top: 60px; left: 16px; z-index: 9999; width: 46px; background-color: rgba(22, 26, 30, 0.95); border: 1px solid #2b3139; border-radius: 8px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(8px); user-select: none; }
      .wa-drag-grip { width: 100%; height: 24px; display: flex; align-items: center; justify-content: center; cursor: grab; border-bottom: 1px solid #2b3139; opacity: 0.7; }
      .wa-drag-grip:active { cursor: grabbing; }
      .wa-drag-grip svg { width: 16px; height: 16px; }
      .wa-tools-wrapper { padding: 8px 0; width: 100%; display: flex; flex-direction: column; align-items: center;}
      .wa-group { position: relative; width: 100%; display: flex; justify-content: center; margin-bottom: 6px; }
      .wa-btn { width: 34px; height: 34px; border-radius: 6px; border: none; background: transparent; color: #848E9C; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; position: relative; }
      .wa-btn svg { width: 20px; height: 20px; }
      .wa-btn:hover { background-color: #2b3139; color: #EAECEF; }
      .wa-btn.active { background-color: rgba(0, 240, 255, 0.15); color: #00F0FF; }
      .wa-has-menu::after { content: ''; position: absolute; right: 3px; bottom: 4px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); }
      .wa-menu { position: absolute; left: 48px; top: 0; background-color: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); display: none; flex-direction: column; width: 220px; padding: 6px 0; z-index: 10000; }
      .wa-group:hover .wa-menu { display: flex; }
      .wa-menu-item { padding: 10px 16px; color: #EAECEF; font-size: 13px; font-weight: 500; font-family: sans-serif; cursor: pointer; transition: 0.15s; }
      .wa-menu-item:hover { background-color: #2b3139; color: #00F0FF; }
      .wa-menu-item.active { color: #00F0FF; }
      .wa-divider { width: 24px; height: 1px; background-color: #2b3139; margin: 6px 0; }
      .wa-drawing-mode canvas { cursor: crosshair !important; }
      .wa-floating-props { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(18, 20, 24, 0.95); border: 1px solid #2b3139; border-radius: 8px; padding: 8px 12px; display: none; align-items: center; gap: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.8); backdrop-filter: blur(12px); z-index: 10001; }
      .wa-floating-props.show { display: flex; }
      .wa-prop-group { display: flex; align-items: center; gap: 6px; }
      .wa-prop-color { width: 26px; height: 26px; border-radius: 6px; border: 1px solid #2b3139; cursor: pointer; padding: 0; background: transparent; }
      .wa-prop-color::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-prop-color::-webkit-color-swatch { border: none; border-radius: 4px; }
      .wa-prop-select, .wa-prop-input { background: #161A1E; color: #EAECEF; border: 1px solid #2b3139; padding: 4px 6px; border-radius: 6px; font-size: 13px; outline: none; }
      .wa-prop-input { width: 140px; font-weight: 500; }
      .wa-prop-input:focus { border-color: #00F0FF; }
      .wa-prop-btn { background: transparent; border: none; color: #848E9C; cursor: pointer; display:flex; align-items:center; justify-content:center; transition: 0.2s; width: 26px; height: 26px; border-radius: 6px;}
      .wa-prop-btn svg { width: 18px; height: 18px; }
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
      <div class="wa-prop-group" title="Màu nền (Trong suốt tự động 15%)"><input type="color" id="wa-prop-fill-color" class="wa-prop-color" value="#00F0FF"></div>
      <div class="wa-prop-group" title="Độ dày nét"><select id="wa-prop-line-size" class="wa-prop-select"><option value="1">1px</option><option value="2">2px</option><option value="3">3px</option></select></div>
      <div class="wa-prop-group" title="Kiểu nét"><select id="wa-prop-line-style" class="wa-prop-select"><option value="solid">▬▬</option><option value="dashed">- - -</option><option value="dotted">. . .</option></select></div>
      <div class="wa-divider" style="width:1px; height:20px; margin:0; background:#2b3139;"></div>
      <div class="wa-prop-group" title="Màu chữ"><input type="color" id="wa-prop-text-color" class="wa-prop-color" value="#EAECEF"></div>
      <div class="wa-prop-group" title="Cỡ chữ"><select id="wa-prop-text-size" class="wa-prop-select"><option value="12">12px</option><option value="14">14px</option><option value="16">16px</option><option value="18">18px</option><option value="24">24px</option></select></div>
      <div class="wa-prop-group" id="wa-prop-text-wrapper" style="display:none;" title="Nội dung"><input type="text" id="wa-prop-text-input" class="wa-prop-input" placeholder="Nhập văn bản..."></div>
      <div class="wa-divider" style="width:1px; height:20px; margin:0; background:#2b3139;"></div>
      <button class="wa-prop-btn" id="wa-prop-delete" title="Xóa hình này (Phím Delete/Backspace)">${ICONS.trash}</button>
    `;
  }

  // ======================================================
  // 4. XỬ LÝ SỰ KIỆN LÕI
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
      if (toolId === 'customText') window.__WA_TEMP_TEXT__ = "Văn bản...";

      try {
        global.tvChart.createOverlay({
          name: toolId, lock: false,
          extendData: globalStyles.textInput,
          styles: { 
            line: { color: globalStyles.lineColor, size: globalStyles.lineWidth, style: globalStyles.lineStyle }, 
            text: { color: globalStyles.textColor, size: globalStyles.textSize, weight: 'bold' }, 
            polygon: { color: hexToRgba(globalStyles.fillColor, 0.15), style: 'fill', borderColor: globalStyles.lineColor } 
          }
        });
      } catch (err) {}
    }

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
                  if (isEraserMode) { global.tvChart.removeOverlay({ id: params.overlay.id }); return; }
                  currentSelectedOverlay = params.overlay;
                  showFloatingProps();
                });
            }
            clearInterval(waitChart);
        }
    }, 500);

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

    const elLineColor = document.getElementById('wa-prop-line-color'), elFillColor = document.getElementById('wa-prop-fill-color');
    const elTextColor = document.getElementById('wa-prop-text-color'), elLineSize = document.getElementById('wa-prop-line-size');
    const elLineStyle = document.getElementById('wa-prop-line-style'), elTextSize = document.getElementById('wa-prop-text-size');
    const elTextInput = document.getElementById('wa-prop-text-input'), elTextWrapper = document.getElementById('wa-prop-text-wrapper');

    function updateSelectedOverlay() {
        if (!currentSelectedOverlay || !global.tvChart) return;
        
        globalStyles.lineColor = elLineColor.value;
        globalStyles.fillColor = elFillColor.value;
        globalStyles.textColor = elTextColor.value;
        globalStyles.lineWidth = parseInt(elLineSize.value);
        globalStyles.lineStyle = elLineStyle.value;
        globalStyles.textSize = parseInt(elTextSize.value);
        
        // Cập nhật giá trị văn bản realtime
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
                text: { color: globalStyles.textColor, size: globalStyles.textSize, family: 'sans-serif', weight: 'bold' },
                polygon: { color: hexToRgba(globalStyles.fillColor, 0.15), borderColor: globalStyles.lineColor, borderSize: globalStyles.lineWidth, borderStyle: globalStyles.lineStyle }
            }
        });
    }

    [elLineColor, elFillColor, elTextColor, elLineSize, elLineStyle, elTextSize, elTextInput].forEach(el => {
        el.addEventListener('input', updateSelectedOverlay);
        el.addEventListener('change', updateSelectedOverlay);
    });

    document.getElementById('wa-prop-delete').addEventListener('click', () => {
        if (currentSelectedOverlay && global.tvChart) {
            global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
            hideFloatingProps();
        }
    });

    function showFloatingProps() {
        if (!currentSelectedOverlay) return;
        let s = currentSelectedOverlay.styles || {};
        elLineColor.value = colorToHex((s.line && s.line.color) ? s.line.color : globalStyles.lineColor);
        elFillColor.value = colorToHex((s.polygon && s.polygon.color) ? s.polygon.color : globalStyles.fillColor);
        elTextColor.value = colorToHex((s.text && s.text.color) ? s.text.color : globalStyles.textColor);
        elLineSize.value = (s.line && s.line.size) ? s.line.size : 2;
        elLineStyle.value = (s.line && s.line.style) ? s.line.style : 'solid';
        elTextSize.value = (s.text && s.text.size) ? s.text.size : 16;

        // Render dữ liệu Text
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
  // 5. AUTO-INJECTOR
  // ======================================================
  function autoInjectSystem() {
    if (global.__wa_observer_started) return;
    global.__wa_observer_started = true;

    var observer = new MutationObserver(function(mutations, obs) {
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
            
            // CỰC KỲ QUAN TRỌNG: Ngắt theo dõi ngầm để trị dứt điểm tình trạng giật lag FPS khi vẽ
            obs.disconnect(); 
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoInjectSystem);
  else autoInjectSystem();

})(window);