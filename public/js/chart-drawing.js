// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026 (MASTERPIECE EDITION)
// Tech: Vanilla JS, KLineChart v9 API
// Tối ưu UI/UX mượt mà, Fix Hover Trap, Fix Realtime Text
// TÍCH HỢP BATCH 1: Lines Nâng Cao (Extended, Info, TrendAngle...)
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
  // 2. KLINECHART EXTENSIONS (CÔNG CỤ VẼ)
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
        return [{ coordinates: [c[0], coord] }];
      } return [];
    }

    

    const extensions = [
      // --- BATCH 1: LINES NÂNG CAO ---
      {
        name: 'extendedLine', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding;
          if (c.length < 2) return [];
          var c0 = c[0], c1 = c[1], W = b.width, H = b.height, pts = [];
          var dx = c1.x - c0.x, dy = c1.y - c0.y;
          if (Math.abs(dx) < 0.001) {
            pts = [{ x: c0.x, y: 0 }, { x: c0.x, y: H }];
          } else if (Math.abs(dy) < 0.001) {
            pts = [{ x: 0, y: c0.y }, { x: W, y: c0.y }];
          } else {
            var m = dy / dx, bi = c0.y - m * c0.x;
            [{ x: 0, y: bi }, { x: W, y: m * W + bi },
             { x: -bi / m, y: 0 }, { x: (H - bi) / m, y: H }]
              .forEach(function(p) {
                if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) pts.push(p);
              });
          }
          if (pts.length < 2) return [];
          return [{ type: 'line', attrs: { coordinates: [pts[0], pts[pts.length - 1]] } }];
        }
      },
      {
        name: 'horizontalRay', totalStep: 2,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding;
          if (!c.length) return [];
          return [{ type: 'line', attrs: { coordinates: [c[0], { x: b.width, y: c[0].y }] } }];
        }
      },
      {
        name: 'trendAngle', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [];
          if (c.length < 2) return [];
          var c0 = c[0], c1 = c[1], figs = [];
          figs.push({ type: 'line', attrs: { coordinates: [c0, c1] } });
          var dx = c1.x - c0.x, dy = c1.y - c0.y;
          if (Math.sqrt(dx * dx + dy * dy) < 4) return figs;
          // canvas angle (y down); chart angle (y up = price up)
          var canvasRad = Math.atan2(dy, dx);
          var chartDeg  = (Math.atan2(-dy, dx) * 180 / Math.PI).toFixed(1);
          var r = 22, startA = Math.min(0, canvasRad), endA = Math.max(0, canvasRad);
          figs.push({
            type: 'arc',
            attrs: { x: c0.x, y: c0.y, r: r, startAngle: startA, endAngle: endA },
            ignoreEvent: true
          });
          var midA = (startA + endA) / 2;
          var sign = parseFloat(chartDeg) >= 0 ? '+' : '';
          figs.push({
            type: 'text',
            attrs: {
              x: c0.x + (r + 12) * Math.cos(midA),
              y: c0.y + (r + 12) * Math.sin(midA),
              text: sign + chartDeg + '°',
              align: 'center', baseline: 'middle'
            },
            ignoreEvent: true
          });
          return figs;
        }
      },
      {
        name: 'infoLine', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], ov = ref.overlay, prec = ref.precision;
          if (c.length < 2) return [];
          var figs = [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var pts = (ov && ov.points) ? ov.points : [];
          if (pts.length >= 2 && pts[0].value != null && pts[1].value != null) {
            var delta = pts[1].value - pts[0].value;
            var pct   = pts[0].value !== 0 ? (delta / Math.abs(pts[0].value) * 100).toFixed(2) : '0.00';
            var dp    = (prec && prec.price != null) ? prec.price : 4;
            var sign  = delta >= 0 ? '+' : '';
            figs.push({
              type: 'text',
              attrs: {
                x: (c[0].x + c[1].x) / 2,
                y: Math.min(c[0].y, c[1].y) - 10,
                text: sign + delta.toFixed(dp) + '  (' + sign + pct + '%)',
                align: 'center', baseline: 'bottom'
              },
              ignoreEvent: true
            });
          }
          return figs;
        }
      },
      {
        name: 'crossLine', totalStep: 2,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding;
          if (!c.length) return [];
          var p = c[0], W = b.width, H = b.height;
          return [
            { type: 'line', attrs: { coordinates: [{ x: 0, y: p.y }, { x: W, y: p.y }] } },
            { type: 'line', attrs: { coordinates: [{ x: p.x, y: 0 }, { x: p.x, y: H }] } }
          ];
        }
      },
      {
        name: 'curvedLine', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [];
          if (c.length < 2) return [];
          if (c.length === 2) { return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }]; }
          // Quadratic Bézier: c[0]=start, c[1]=control point, c[2]=end
          var pts = [], N = 40;
          for (var i = 0; i <= N; i++) {
            var t = i / N, mt = 1 - t;
            pts.push({
              x: mt * mt * c[0].x + 2 * mt * t * c[1].x + t * t * c[2].x,
              y: mt * mt * c[0].y + 2 * mt * t * c[1].y + t * t * c[2].y
            });
          }
          return [{ type: 'line', attrs: { coordinates: pts } }];
        }
      },
      
// --- BATCH 2: PITCHFORK FAMILY (ĐÃ FIX TOÁN HỌC) ---
      {
        name: 'andrewsPitchfork', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, figs = [];
          if (c.length < 2) return figs;
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1], P2 = c[2];
          var M = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
          var dx = M.x - P0.x, dy = M.y - P0.y;
          function rayEnd(p) {
            var ts = [];
            if (dx > 0.001) ts.push((W - p.x) / dx);
            if (dx < -0.001) ts.push((0 - p.x) / dx);
            if (dy > 0.001) ts.push((H - p.y) / dy);
            if (dy < -0.001) ts.push((0 - p.y) / dy);
            var t = Math.min.apply(null, ts.filter(function(v) { return v > 0; }));
            return isFinite(t) ? { x: p.x + dx * t, y: p.y + dy * t } : p;
          }
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] } });           
          figs.push({ type: 'line', attrs: { coordinates: [P0, M] } });            
          figs.push({ type: 'line', attrs: { coordinates: [P0, rayEnd(P0)] } });   
          figs.push({ type: 'line', attrs: { coordinates: [P1, rayEnd(P1)] } });   
          figs.push({ type: 'line', attrs: { coordinates: [P2, rayEnd(P2)] } });   
          return figs;
        }
      },
      {
        name: 'schiffPitchfork', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, figs = [];
          if (c.length < 2) return figs;
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1], P2 = c[2];
          var M  = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
          // SỬA LỖI: Schiff dịch gốc đến trung điểm của P0 và P1
          var HS = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
          var dx = M.x - HS.x, dy = M.y - HS.y;
          function rayEnd(p) {
            var ts = [];
            if (dx > 0.001) ts.push((W - p.x) / dx);
            if (dx < -0.001) ts.push((0 - p.x) / dx);
            if (dy > 0.001) ts.push((H - p.y) / dy);
            if (dy < -0.001) ts.push((0 - p.y) / dy);
            var t = Math.min.apply(null, ts.filter(function(v) { return v > 0; }));
            return isFinite(t) ? { x: p.x + dx * t, y: p.y + dy * t } : p;
          }
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] } });
          figs.push({ type: 'line', attrs: { coordinates: [HS, M] } });
          figs.push({ type: 'line', attrs: { coordinates: [HS, rayEnd(HS)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P1, rayEnd(P1)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P2, rayEnd(P2)] } });
          return figs;
        }
      },
      {
        name: 'modifiedSchiffPitchfork', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, figs = [];
          if (c.length < 2) return figs;
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1], P2 = c[2];
          var M  = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
          // SỬA LỖI: Modified Schiff dịch Y xuống giữa P0 và P1, giữ X = P0.x
          var HM = { x: P0.x, y: (P0.y + P1.y) / 2 };
          var dx = M.x - HM.x, dy = M.y - HM.y;
          function rayEnd(p) {
            var ts = [];
            if (dx > 0.001) ts.push((W - p.x) / dx);
            if (dx < -0.001) ts.push((0 - p.x) / dx);
            if (dy > 0.001) ts.push((H - p.y) / dy);
            if (dy < -0.001) ts.push((0 - p.y) / dy);
            var t = Math.min.apply(null, ts.filter(function(v) { return v > 0; }));
            return isFinite(t) ? { x: p.x + dx * t, y: p.y + dy * t } : p;
          }
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] } });
          figs.push({ type: 'line', attrs: { coordinates: [HM, M] } });
          figs.push({ type: 'line', attrs: { coordinates: [HM, rayEnd(HM)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P1, rayEnd(P1)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P2, rayEnd(P2)] } });
          return figs;
        }
      },
      {
        name: 'insidePitchfork', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, figs = [];
          if (c.length < 2) return figs;
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1], P2 = c[2];
          // Inside: Thu nhỏ bằng cách vẽ từ trung điểm
          var IP1 = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
          var IP2 = { x: (P0.x + P2.x) / 2, y: (P0.y + P2.y) / 2 };
          var MI  = { x: (IP1.x + IP2.x) / 2, y: (IP1.y + IP2.y) / 2 };
          var dx = MI.x - P0.x, dy = MI.y - P0.y;
          function rayEnd(p) {
            var ts = [];
            if (dx > 0.001) ts.push((W - p.x) / dx);
            if (dx < -0.001) ts.push((0 - p.x) / dx);
            if (dy > 0.001) ts.push((H - p.y) / dy);
            if (dy < -0.001) ts.push((0 - p.y) / dy);
            var t = Math.min.apply(null, ts.filter(function(v) { return v > 0; }));
            return isFinite(t) ? { x: p.x + dx * t, y: p.y + dy * t } : p;
          }
          figs.push({ type: 'line', attrs: { coordinates: [IP1, IP2] } });          
          figs.push({ type: 'line', attrs: { coordinates: [P0, MI] } });            
          figs.push({ type: 'line', attrs: { coordinates: [P0, rayEnd(P0)] } });    
          figs.push({ type: 'line', attrs: { coordinates: [IP1, rayEnd(IP1)] } });  
          figs.push({ type: 'line', attrs: { coordinates: [IP2, rayEnd(IP2)] } });  
          return figs;
        }
      },
      {
        name: 'insidePitchfork', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, figs = [];
          if (c.length < 2) return figs;
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1], P2 = c[2];
          // Inside: các tine bắt đầu từ midpoint(P0,P1) và midpoint(P0,P2)
          var IP1 = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
          var IP2 = { x: (P0.x + P2.x) / 2, y: (P0.y + P2.y) / 2 };
          var MI  = { x: (IP1.x + IP2.x) / 2, y: (IP1.y + IP2.y) / 2 };
          var dx = MI.x - P0.x, dy = MI.y - P0.y;
          function rayEnd(p) {
            var ts = [];
            if (dx > 0.001) ts.push((W - p.x) / dx);
            if (dx < -0.001) ts.push((0 - p.x) / dx);
            if (dy > 0.001) ts.push((H - p.y) / dy);
            if (dy < -0.001) ts.push((0 - p.y) / dy);
            var t = Math.min.apply(null, ts.filter(function(v) { return v > 0; }));
            return isFinite(t) ? { x: p.x + dx * t, y: p.y + dy * t } : p;
          }
          figs.push({ type: 'line', attrs: { coordinates: [IP1, IP2] } });          // base thu hẹp
          figs.push({ type: 'line', attrs: { coordinates: [P0, MI] } });            // handle
          figs.push({ type: 'line', attrs: { coordinates: [P0, rayEnd(P0)] } });    // median
          figs.push({ type: 'line', attrs: { coordinates: [IP1, rayEnd(IP1)] } });  // upper tine
          figs.push({ type: 'line', attrs: { coordinates: [IP2, rayEnd(IP2)] } });  // lower tine
          return figs;
        }
      },

      // --- BATCH 6: ELLIOTT WAVE FAMILY (Tự động vẽ kênh & lật label thông minh) ---
      {
        name: 'elliottImpulse', totalStep: 7,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding;
          if (c.length < 2) return [];
          var W = b.width, H = b.height;
          var LABELS = ['(0)', '①', '②', '③', '④', '⑤'];
          var figs = [];

          for (var i = 0; i < c.length - 1; i++) {
            figs.push({ type: 'line', attrs: { coordinates: [c[i], c[i + 1]] } });
          }

          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var p = c[j];
            var pPrev = j > 0 ? c[j - 1] : c[Math.min(j + 1, c.length - 1)];
            var pNext = j < c.length - 1 ? c[j + 1] : c[Math.max(j - 1, 0)];
            var above = p.y <= (pPrev.y + pNext.y) / 2;
            figs.push({
              type: 'text',
              attrs: { x: p.x, y: above ? p.y - 10 : p.y + 10, text: LABELS[j], align: 'center', baseline: above ? 'bottom' : 'top' },
              ignoreEvent: true
            });
          }

          function extendRay(from, dx, dy) {
            var ts = [];
            if (dx >  0.001) ts.push((W - from.x) / dx);
            if (dx < -0.001) ts.push((0 - from.x) / dx);
            if (dy >  0.001) ts.push((H - from.y) / dy);
            if (dy < -0.001) ts.push((0 - from.y) / dy);
            var tPos = ts.filter(function(v) { return v > 0; });
            if (!tPos.length) return null;
            var t = Math.min.apply(null, tPos);
            return { x: from.x + dx * t, y: from.y + dy * t };
          }

          // Base channel (Vẽ nét đứt)
          if (c.length >= 3) {
            var dx02 = c[2].x - c[0].x, dy02 = c[2].y - c[0].y;
            var e02 = extendRay(c[0], dx02, dy02);
            if (e02) figs.push({ type: 'line', attrs: { coordinates: [c[0], e02] }, styles: { style: 'dashed' } });
            var e1p = extendRay(c[1], dx02, dy02);
            if (e1p) figs.push({ type: 'line', attrs: { coordinates: [c[1], e1p] }, styles: { style: 'dashed' } });
          }

          // Acceleration channel (Vẽ nét đứt)
          if (c.length >= 5) {
            var dx24 = c[4].x - c[2].x, dy24 = c[4].y - c[2].y;
            var e24 = extendRay(c[2], dx24, dy24);
            if (e24) figs.push({ type: 'line', attrs: { coordinates: [c[2], e24] }, styles: { style: 'dashed' } });
            var e3p = extendRay(c[3], dx24, dy24);
            if (e3p) figs.push({ type: 'line', attrs: { coordinates: [c[3], e3p] }, styles: { style: 'dashed' } });
          }
          return figs;
        }
      },
      {
        name: 'elliottCorrection', totalStep: 5,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var LABELS = ['', 'A', 'B', 'C']; var figs = [];
          for (var i = 0; i < c.length - 1; i++) figs.push({ type: 'line', attrs: { coordinates: [c[i], c[i + 1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var p = c[j], pPrev = j > 0 ? c[j - 1] : c[Math.min(j + 1, c.length - 1)], pNext = j < c.length - 1 ? c[j + 1] : c[Math.max(j - 1, 0)];
            var above = p.y <= (pPrev.y + pNext.y) / 2;
            figs.push({ type: 'text', attrs: { x: p.x, y: above ? p.y - 10 : p.y + 10, text: LABELS[j], align: 'center', baseline: above ? 'bottom' : 'top' }, ignoreEvent: true });
          }
          return figs;
        }
      },
      {
        name: 'elliottTriangle', totalStep: 7,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var LABELS = ['', 'A', 'B', 'C', 'D', 'E']; var figs = [];
          for (var i = 0; i < c.length - 1; i++) figs.push({ type: 'line', attrs: { coordinates: [c[i], c[i + 1]] } });
          
          // Đường biên tam giác (Vẽ nét đứt)
          if (c.length >= 4) figs.push({ type: 'line', attrs: { coordinates: [c[1], c[3]] }, styles: { style: 'dashed' } });
          if (c.length >= 5) figs.push({ type: 'line', attrs: { coordinates: [c[2], c[4]] }, styles: { style: 'dashed' } });
          
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var p = c[j], pPrev = j > 0 ? c[j - 1] : c[Math.min(j + 1, c.length - 1)], pNext = j < c.length - 1 ? c[j + 1] : c[Math.max(j - 1, 0)];
            var above = p.y <= (pPrev.y + pNext.y) / 2;
            figs.push({ type: 'text', attrs: { x: p.x, y: above ? p.y - 10 : p.y + 10, text: LABELS[j], align: 'center', baseline: above ? 'bottom' : 'top' }, ignoreEvent: true });
          }
          return figs;
        }
      },
      {
        name: 'elliottDouble', totalStep: 5,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var LABELS = ['', 'W', 'X', 'Y']; var figs = [];
          for (var i = 0; i < c.length - 1; i++) figs.push({ type: 'line', attrs: { coordinates: [c[i], c[i + 1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var p = c[j], pPrev = j > 0 ? c[j - 1] : c[Math.min(j + 1, c.length - 1)], pNext = j < c.length - 1 ? c[j + 1] : c[Math.max(j - 1, 0)];
            var above = p.y <= (pPrev.y + pNext.y) / 2;
            figs.push({ type: 'text', attrs: { x: p.x, y: above ? p.y - 10 : p.y + 10, text: LABELS[j], align: 'center', baseline: above ? 'bottom' : 'top' }, ignoreEvent: true });
          }
          return figs;
        }
      },
      {
        name: 'elliottTriple', totalStep: 7,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var LABELS = ['', 'W', 'X', 'Y', 'X', 'Z']; var figs = [];
          for (var i = 0; i < c.length - 1; i++) figs.push({ type: 'line', attrs: { coordinates: [c[i], c[i + 1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var p = c[j], pPrev = j > 0 ? c[j - 1] : c[Math.min(j + 1, c.length - 1)], pNext = j < c.length - 1 ? c[j + 1] : c[Math.max(j - 1, 0)];
            var above = p.y <= (pPrev.y + pNext.y) / 2;
            figs.push({ type: 'text', attrs: { x: p.x, y: above ? p.y - 10 : p.y + 10, text: LABELS[j], align: 'center', baseline: above ? 'bottom' : 'top' }, ignoreEvent: true });
          }
          return figs;
        }
      },

      // --- BATCH 5: SHAPES & ARROWS (Đã tối ưu Fill Color & Vô hạn điểm neo) ---
      {
        name: 'highlighter', totalStep: Number.MAX_SAFE_INTEGER, // Vẽ vô hạn điểm
        needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          function smooth(points, seg) {
            if (points.length < 3) return points.slice();
            var out = [];
            for (var i = 0; i < points.length - 1; i++) {
              var p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
              for (var j = 0; j < seg; j++) {
                var t = j / seg, t2 = t * t, t3 = t2 * t;
                out.push({
                  x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                  y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
                });
              }
            }
            out.push(points[points.length - 1]); return out;
          }
          var pts = smooth(c, 8); var a = pts[0], z = pts[pts.length - 1];
          var dx = z.x - a.x, dy = z.y - a.y; var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var px = -dy / len, py = dx / len; var offs = [-3, -1.5, 0, 1.5, 3]; var figs = [];
          offs.forEach(function(o) {
            figs.push({ type: 'line', attrs: { coordinates: pts.map(function(p) { return { x: p.x + px * o, y: p.y + py * o }; }) } });
          });
          return figs;
        }
      },
      {
        name: 'arrow', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var s = c[0], e = c[1]; var dx = e.x - s.x, dy = e.y - s.y;
          var len = Math.sqrt(dx * dx + dy * dy); if (len < 2) return [];
          var ux = dx / len, uy = dy / len; var px = -uy, py = ux;
          var head = Math.max(8, Math.min(18, len * 0.25)); var wing = head * 0.55;
          var h1 = { x: e.x - ux * head + px * wing, y: e.y - uy * head + py * wing };
          var h2 = { x: e.x - ux * head - px * wing, y: e.y - uy * head - py * wing };
          return [ { type: 'line', attrs: { coordinates: [s, e] } }, { type: 'line', attrs: { coordinates: [h1, e, h2] } } ];
        }
      },
      {
        name: 'arrowMarker', totalStep: 3, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var s = c[0], e = c[1]; var dx = e.x - s.x, dy = e.y - s.y;
          var len = Math.sqrt(dx * dx + dy * dy); if (len < 2) return [];
          var ux = dx / len, uy = dy / len; var px = -uy, py = ux;
          var head = Math.max(9, Math.min(20, len * 0.28)); var wing = head * 0.65; var shaftOff = 2.5;
          var h1 = { x: e.x - ux * head + px * wing, y: e.y - uy * head + py * wing };
          var h2 = { x: e.x - ux * head - px * wing, y: e.y - uy * head - py * wing };
          function shift(p, o) { return { x: p.x + px * o, y: p.y + py * o }; }
          return [ { type: 'line', attrs: { coordinates: [shift(s, -shaftOff), shift(e, -shaftOff)] } }, { type: 'line', attrs: { coordinates: [s, e] } }, { type: 'line', attrs: { coordinates: [shift(s, shaftOff), shift(e, shaftOff)] } }, { type: 'line', attrs: { coordinates: [h1, e, h2] } } ];
        }
      },
      {
        name: 'arrowUp', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
          var y0 = Math.min(c[0].y, c[1].y), y1 = Math.max(c[0].y, c[1].y);
          var mid = (x0 + x1) / 2, w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return [];
          var shaftW = w * 0.34, shoulderY = y0 + h * 0.40;
          var pts = [ { x: mid, y: y0 }, { x: x1, y: shoulderY }, { x: mid + shaftW / 2, y: shoulderY }, { x: mid + shaftW / 2, y: y1 }, { x: mid - shaftW / 2, y: y1 }, { x: mid - shaftW / 2, y: shoulderY }, { x: x0, y: shoulderY }, { x: mid, y: y0 } ];
          return [{ type: 'polygon', attrs: { coordinates: pts }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'arrowDown', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
          var y0 = Math.min(c[0].y, c[1].y), y1 = Math.max(c[0].y, c[1].y);
          var mid = (x0 + x1) / 2, w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return [];
          var shaftW = w * 0.34, shoulderY = y1 - h * 0.40;
          var pts = [ { x: x0, y: shoulderY }, { x: mid - shaftW / 2, y: shoulderY }, { x: mid - shaftW / 2, y: y0 }, { x: mid + shaftW / 2, y: y0 }, { x: mid + shaftW / 2, y: shoulderY }, { x: x1, y: shoulderY }, { x: mid, y: y1 }, { x: x0, y: shoulderY } ];
          return [{ type: 'polygon', attrs: { coordinates: pts }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'rectangle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var x0 = c[0].x, y0 = c[0].y, x1 = c[1].x, y1 = c[1].y;
          return [{ type: 'polygon', attrs: { coordinates: [ { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 } ] }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'rotatedRectangle', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var A = c[0], B = c[1], P = c[2];
          var dx = B.x - A.x, dy = B.y - A.y; var len = Math.sqrt(dx * dx + dy * dy); if (len < 2) return [];
          var ux = dx / len, uy = dy / len; var px = -uy, py = ux;
          var w = (P.x - A.x) * px + (P.y - A.y) * py;
          var D = { x: A.x + px * w, y: A.y + py * w }, C = { x: B.x + px * w, y: B.y + py * w };
          return [{ type: 'polygon', attrs: { coordinates: [A, B, C, D] }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'pathShape', totalStep: Number.MAX_SAFE_INTEGER, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          function smooth(points, seg) {
            if (points.length < 3) return points.slice();
            var out = [];
            for (var i = 0; i < points.length - 1; i++) {
              var p0 = points[i - 1] || points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] || p2;
              for (var j = 0; j < seg; j++) {
                var t = j / seg, t2 = t * t, t3 = t2 * t;
                out.push({
                  x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
                  y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
                });
              }
            }
            out.push(points[points.length - 1]); return out;
          }
          return [{ type: 'line', attrs: { coordinates: smooth(c, 10) } }];
        }
      },
      {
        name: 'circle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var ctr = c[0], p = c[1];
          var r = Math.sqrt(Math.pow(p.x - ctr.x, 2) + Math.pow(p.y - ctr.y, 2)); if (r < 2) return [];
          var pts = [], N = 64;
          for (var i = 0; i < N; i++) { var a = i / N * Math.PI * 2; pts.push({ x: ctr.x + r * Math.cos(a), y: ctr.y + r * Math.sin(a) }); }
          return [{ type: 'polygon', attrs: { coordinates: pts }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'ellipse', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
          var y0 = Math.min(c[0].y, c[1].y), y1 = Math.max(c[0].y, c[1].y);
          var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2; if (rx < 2 || ry < 2) return [];
          var pts = [], N = 64;
          for (var i = 0; i < N; i++) { var a = i / N * Math.PI * 2; pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }); }
          return [{ type: 'polygon', attrs: { coordinates: pts }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'polyline', totalStep: Number.MAX_SAFE_INTEGER, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) { var c = ref.coordinates || []; if (c.length < 2) return []; return [{ type: 'line', attrs: { coordinates: c } }]; }
      },
      {
        name: 'triangle', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          return [{ type: 'polygon', attrs: { coordinates: [c[0], c[1], c[2]] }, styles: { style: 'stroke_fill' } }];
        }
      },
      {
        name: 'arcShape', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var A = c[0], B = c[1], C = c[2];
          var d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
          if (Math.abs(d) < 0.001) return [{ type: 'line', attrs: { coordinates: [A, B, C] } }];
          var ux = ((A.x * A.x + A.y * A.y) * (B.y - C.y) + (B.x * B.x + B.y * B.y) * (C.y - A.y) + (C.x * C.x + C.y * C.y) * (A.y - B.y)) / d;
          var uy = ((A.x * A.x + A.y * A.y) * (C.x - B.x) + (B.x * B.x + B.y * B.y) * (A.x - C.x) + (C.x * C.x + C.y * C.y) * (B.x - A.x)) / d;
          var O = { x: ux, y: uy }; var r = Math.sqrt(Math.pow(A.x - O.x, 2) + Math.pow(A.y - O.y, 2));
          function norm(a) { while (a < 0) a += Math.PI * 2; while (a >= Math.PI * 2) a -= Math.PI * 2; return a; }
          function betweenCCW(x, a, b) { if (b < a) b += Math.PI * 2; if (x < a) x += Math.PI * 2; return x >= a && x <= b; }
          var a0 = norm(Math.atan2(A.y - O.y, A.x - O.x)), a1 = norm(Math.atan2(B.y - O.y, B.x - O.x)), a2 = norm(Math.atan2(C.y - O.y, C.x - O.x));
          var ccw = betweenCCW(a1, a0, a2); if (ccw && a2 < a0) a2 += Math.PI * 2; if (!ccw && a2 > a0) a2 -= Math.PI * 2;
          var pts = [], N = 48;
          for (var i = 0; i <= N; i++) { var t = i / N; var ang = a0 + (a2 - a0) * t; pts.push({ x: O.x + r * Math.cos(ang), y: O.y + r * Math.sin(ang) }); }
          return [{ type: 'line', attrs: { coordinates: pts } }];
        }
      },
      {
        name: 'curveShape', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var pts = [], N = 48;
          for (var i = 0; i <= N; i++) { var t = i / N, mt = 1 - t; pts.push({ x: mt * mt * c[0].x + 2 * mt * t * c[1].x + t * t * c[2].x, y: mt * mt * c[0].y + 2 * mt * t * c[1].y + t * t * c[2].y }); }
          return [{ type: 'line', attrs: { coordinates: pts } }];
        }
      },
      {
        name: 'doubleCurveShape', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var P0 = c[0], P1 = c[1], P2 = c[2];
          function sample(A, B, C) {
            var pts = [], N = 48;
            for (var i = 0; i <= N; i++) { var t = i / N, mt = 1 - t; pts.push({ x: mt * mt * A.x + 2 * mt * t * B.x + t * t * C.x, y: mt * mt * A.y + 2 * mt * t * B.y + t * t * C.y }); }
            return pts;
          }
          var main = sample(P0, P1, P2);
          if (c.length < 4) return [{ type: 'line', attrs: { coordinates: main } }];
          var mid = { x: 0.25 * P0.x + 0.5 * P1.x + 0.25 * P2.x, y: 0.25 * P0.y + 0.5 * P1.y + 0.25 * P2.y };
          var v = { x: c[3].x - mid.x, y: c[3].y - mid.y };
          var second = main.map(function(p) { return { x: p.x + v.x, y: p.y + v.y }; });
          return [ { type: 'line', attrs: { coordinates: main } }, { type: 'line', attrs: { coordinates: second } }, { type: 'line', attrs: { coordinates: [main[0], second[0]] } }, { type: 'line', attrs: { coordinates: [main[main.length - 1], second[second.length - 1]] } } ];
        }
      },
      {
        name: 'parallelogram', totalStep: 4, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function({ coordinates }) {
          if (coordinates.length === 2) return [{ type: 'line', ignoreEvent: true, attrs: { coordinates } }];
          if (coordinates.length === 3) { const coordinate = { x: coordinates[0].x + (coordinates[2].x - coordinates[1].x), y: coordinates[2].y }; return [{ type: 'polygon', attrs: { coordinates: [coordinates[0], coordinates[1], coordinates[2], coordinate] } }]; } return [];
        },
        performEventPressedMove: function({ points, performPointIndex, performPoint }) { if (performPointIndex < 2) { points[0].price = performPoint.price; points[1].price = performPoint.price; } },
        performEventMoveForDrawing: function({ currentStep, points, performPoint }) { if (currentStep === 2) points[0].price = performPoint.price; }
      },

      // --- BATCH 3: FIBONACCI FAMILY (TOÁN HỌC CHUẨN + RAINBOW FILL) ---
      {
        name: 'fibRetracement', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, ov = ref.overlay, prec = ref.precision;
          var pts = ov?.points;
          if (c.length < 2 || !pts || pts.length < 2) return [];
          var P0 = c[0], P1 = c[1];
          var vDif = (pts[1].value || 0) - (pts[0].value || 0);
          var yDif = P1.y - P0.y;
          var LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
          var rainbow = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)'];
          var figs = [], polygons = [], lines = [], texts = [];
          let ext = ov.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
          let prevY = null; var endX = P1.x; // Giới hạn chiều dài đến điểm P1

          LEVELS.forEach(function(lv, i) {
            var y = P0.y + lv * yDif;
            var price = ((pts[0].value || 0) + lv * vDif).toFixed(prec?.price || 2);
            lines.push({ coordinates: [{ x: P0.x, y: y }, { x: endX, y: y }] });
            texts.push({ x: P0.x, y: y - 4, text: `${lv} (${price})`, align: 'left', baseline: 'bottom' });
            if (prevY !== null && i > 0 && alpha > 0) {
              polygons.push({
                type: 'polygon', ignoreEvent: true,
                attrs: { coordinates: [{x: P0.x, y: prevY}, {x: endX, y: prevY}, {x: endX, y: y}, {x: P0.x, y: y}] },
                styles: { style: 'fill', color: rainbow[(i-1)%6].replace('0.15', alpha) }
              });
            }
            prevY = y;
          });
          return [...polygons, { type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
        }
      },
      {
        name: 'fibExtension', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, ov = ref.overlay, prec = ref.precision;
          var pts = ov?.points;
          if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          if (!pts || pts.length < 3) return [];
          var P0 = c[0], P1 = c[1], P2 = c[2];
          var swingY = P1.y - P0.y, swingV = (pts[1].value || 0) - (pts[0].value || 0);
          var endX = P2.x; // Giới hạn chiều dài đến điểm P2
          var LEVELS = [0.618, 1.0, 1.272, 1.414, 1.618, 2.0, 2.618];
          var rainbow = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)', 'rgba(156,39,176,0.15)'];
          var figs = [], polygons = [], lines = [], texts = [];
          let ext = ov.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
          let prevY = null;

          figs.push({ type: 'line', attrs: { coordinates: [P0, P1] }, styles: { style: 'dashed' } });
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] }, styles: { style: 'dashed' } });

          LEVELS.forEach(function(lv, i) {
            var y = P2.y + lv * swingY;
            var price = ((pts[2].value || 0) + lv * swingV).toFixed(prec?.price || 2);
            lines.push({ coordinates: [{ x: P1.x, y: y }, { x: endX, y: y }] });
            texts.push({ x: P1.x, y: y - 4, text: `${lv} (${price})`, align: 'left', baseline: 'bottom' });
            if (prevY !== null && i > 0 && alpha > 0) {
              polygons.push({
                type: 'polygon', ignoreEvent: true,
                attrs: { coordinates: [{x: P1.x, y: prevY}, {x: endX, y: prevY}, {x: endX, y: y}, {x: P1.x, y: y}] },
                styles: { style: 'fill', color: rainbow[(i-1)%7].replace('0.15', alpha) }
              });
            }
            prevY = y;
          });
          return [...polygons, { type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }, ...figs];
        }
      },
      {
        name: 'fibFan', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, ov = ref.overlay;
          if (c.length < 2) return [];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1];
          var LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786];
          var rainbow = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)'];
          var figs = [], polygons = [];
          let ext = ov.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
          let prevEnd = null;

          figs.push({ type: 'line', attrs: { coordinates: [P0, P1] } });
          figs.push({ type: 'line', attrs: { coordinates: [{ x: P1.x, y: 0 }, { x: P1.x, y: H }] }, styles: { style: 'dashed' } });

          LEVELS.forEach(function(lv, i) {
            var fy = P0.y + lv * (P1.y - P0.y);
            var dx = P1.x - P0.x, dy = fy - P0.y;
            var ts = [];
            if (dx > 0.001) ts.push((W - P0.x) / dx);
            if (dx < -0.001) ts.push((0 - P0.x) / dx);
            if (dy > 0.001) ts.push((H - P0.y) / dy);
            if (dy < -0.001) ts.push((0 - P0.y) / dy);
            var tMin = ts.length ? Math.min.apply(null, ts.filter(function(v) { return v > 0; })) : 1;
            var end = isFinite(tMin) ? { x: P0.x + dx * tMin, y: P0.y + dy * tMin } : { x: P0.x + dx, y: P0.y + dy };
            
            figs.push({ type: 'line', attrs: { coordinates: [P0, end] } });
            figs.push({ type: 'text', attrs: { x: end.x - 4, y: end.y - 4, text: `${lv}`, align: 'right', baseline: 'bottom' }, ignoreEvent: true });
            
            if (prevEnd !== null && i > 0 && alpha > 0) {
              polygons.push({
                type: 'polygon', ignoreEvent: true,
                attrs: { coordinates: [P0, prevEnd, end] },
                styles: { style: 'fill', color: rainbow[(i-1)%5].replace('0.15', alpha) }
              });
            }
            prevEnd = end;
          });
          return [...polygons, ...figs];
        }
      },
      {
        name: 'fibArc', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [];
          if (c.length < 2) return [];
          var P0 = c[0], P1 = c[1];
          var rBase = Math.sqrt(Math.pow(P1.x - P0.x, 2) + Math.pow(P1.y - P0.y, 2));
          var LEVELS = [0.382, 0.5, 0.618, 1.0, 1.618];
          var figs = [];
          figs.push({ type: 'line', attrs: { coordinates: [P0, P1] }, styles: { style: 'dashed' } });
          LEVELS.forEach(function(lv) {
            var r = rBase * lv;
            figs.push({ type: 'arc', attrs: { x: P0.x, y: P0.y, r: r, startAngle: 0, endAngle: Math.PI * 2 }, ignoreEvent: true });
            figs.push({ type: 'text', attrs: { x: P0.x + r + 3, y: P0.y, text: `${lv}`, align: 'left', baseline: 'middle' }, ignoreEvent: true });
          });
          return figs;
        }
      },
      {
        name: 'fibTimeZone', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, ov = ref.overlay;
          if (c.length < 2) return [];
          var H = b.height, W = b.width;
          var unit = c[1].x - c[0].x;
          if (Math.abs(unit) < 1) return [];
          var FIB_SEQ = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];
          var figs = [], polygons = [];
          let ext = ov.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.05;
          let prevX = null;
          
          FIB_SEQ.forEach(function(n, i) {
            var x = c[0].x + n * unit;
            if (x < 0 || x > W) return;
            figs.push({ type: 'line', attrs: { coordinates: [{ x: x, y: 0 }, { x: x, y: H }] } });
            figs.push({ type: 'text', attrs: { x: x + 3, y: 6, text: String(n), align: 'left', baseline: 'top' }, ignoreEvent: true });
            
            // Highlight nền xen kẽ cho TimeZone
            if (prevX !== null && i % 2 === 1 && alpha > 0) {
              polygons.push({
                type: 'polygon', ignoreEvent: true,
                attrs: { coordinates: [{x: prevX, y: 0}, {x: x, y: 0}, {x: x, y: H}, {x: prevX, y: H}] },
                styles: { style: 'fill', color: `rgba(0, 240, 255, ${alpha})` }
              });
            }
            prevX = x;
          });
          return [...polygons, ...figs];
        }
      },

      // --- MÔ HÌNH PHỨC TẠP ---
      // --- BATCH 4: GANN FAMILY (Đã tối ưu Rainbow Fill & Background) ---
      {
        name: 'gannFan', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, ov = ref.overlay;
          if (c.length < 2) return [];
          var W = b.width, H = b.height;
          var P0 = c[0], P1 = c[1];
          var unitX = Math.abs(P1.x - P0.x), unitY = Math.abs(P1.y - P0.y);
          if (unitX < 1 || unitY < 1) return [];
          var signX = P1.x >= P0.x ? 1 : -1, signY = P1.y >= P0.y ? 1 : -1;
          var RATIOS = [[1, 8, '1×8'], [1, 4, '1×4'], [1, 3, '1×3'], [1, 2, '1×2'], [1, 1, '1×1'], [2, 1, '2×1'], [3, 1, '3×1'], [4, 1, '4×1'], [8, 1, '8×1']];
          var rainbow = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)', 'rgba(156,39,176,0.15)', 'rgba(103,58,183,0.15)'];
          
          var figs = [], polygons = [];
          let ext = ov.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
          let prevEnd = null;

          RATIOS.forEach(function(r, i) {
            var dx = signX * r[0] * unitX, dy = signY * r[1] * unitY;
            var ts = [];
            if (dx > 0.001) ts.push((W - P0.x) / dx); if (dx < -0.001) ts.push((0 - P0.x) / dx);
            if (dy > 0.001) ts.push((H - P0.y) / dy); if (dy < -0.001) ts.push((0 - P0.y) / dy);
            var tPos = ts.filter(v => v > 0);
            if (!tPos.length) return;
            var tMin = Math.min(...tPos);
            var end = { x: P0.x + dx * tMin, y: P0.y + dy * tMin };
            
            figs.push({ type: 'line', attrs: { coordinates: [P0, end] } });
            figs.push({ type: 'text', attrs: { x: end.x + (signX > 0 ? -4 : 4), y: end.y + (signY > 0 ? -4 : 4), text: r[2], align: signX > 0 ? 'right' : 'left', baseline: signY > 0 ? 'bottom' : 'top' }, ignoreEvent: true });
            
            // Đổ màu Rainbow giữa các góc Gann
            if (prevEnd !== null && alpha > 0) {
              polygons.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [P0, prevEnd, end] }, styles: { style: 'fill', color: rainbow[(i-1)%8].replace('0.15', alpha) } });
            }
            prevEnd = end;
          });
          return [...polygons, ...figs];
        }
      },
      {
        name: 'gannBox', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], ov = ref.overlay;
          if (c.length < 2) return [];
          var x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
          var y0 = Math.min(c[0].y, c[1].y), y1 = Math.max(c[0].y, c[1].y);
          if ((x1 - x0) < 2 || (y1 - y0) < 2) return [];
          var figs = [];
          
          // Đổ màu nền Box
          figs.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{x:x0, y:y0}, {x:x1, y:y0}, {x:x1, y:y1}, {x:x0, y:y1}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:x0, y:y0}, {x:x1, y:y0}, {x:x1, y:y1}, {x:x0, y:y1}, {x:x0, y:y0}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:x0, y:y0}, {x:x1, y:y1}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:x1, y:y0}, {x:x0, y:y1}] } });

          for (var i = 1; i <= 7; i++) {
            var hy = y0 + (i / 8) * (y1 - y0), vx = x0 + (i / 8) * (x1 - x0);
            var isMid = (i === 4); // Highlight mức 0.5 (4/8)
            var styleObj = isMid ? { style: 'solid', size: 2 } : { style: 'dashed', size: 1 };
            figs.push({ type: 'line', attrs: { coordinates: [{x:x0, y:hy}, {x:x1, y:hy}] }, styles: styleObj });
            figs.push({ type: 'line', attrs: { coordinates: [{x:vx, y:y0}, {x:vx, y:y1}] }, styles: styleObj });
            figs.push({ type: 'text', attrs: { x: x0 - 3, y: hy, text: i + '/8', align: 'right', baseline: 'middle' }, ignoreEvent: true });
          }
          return figs;
        }
      },
      {
        name: 'gannSquare', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding;
          if (c.length < 2) return [];
          var W = b.width, H = b.height, P0 = c[0], P1 = c[1];
          var rawDx = P1.x - P0.x, rawDy = P1.y - P0.y;
          var size = Math.max(Math.abs(rawDx), Math.abs(rawDy));
          if (size < 2) return [];
          var signX = rawDx >= 0 ? 1 : -1, signY = rawDy >= 0 ? 1 : -1;
          var x0 = P0.x, y0 = P0.y, x1 = P0.x + signX * size, y1 = P0.y + signY * size;
          var xMin = Math.min(x0, x1), xMax = Math.max(x0, x1), yMin = Math.min(y0, y1), yMax = Math.max(y0, y1);
          var figs = [];
          
          figs.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{x:xMin, y:yMin}, {x:xMax, y:yMin}, {x:xMax, y:yMax}, {x:xMin, y:yMax}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:xMin, y:yMin}, {x:xMax, y:yMin}, {x:xMax, y:yMax}, {x:xMin, y:yMax}, {x:xMin, y:yMin}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:xMin, y:yMin}, {x:xMax, y:yMax}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:xMax, y:yMin}, {x:xMin, y:yMax}] } });

          for (var i = 1; i <= 3; i++) {
            var hy = yMin + (i / 4) * size, vx = xMin + (i / 4) * size;
            var styleObj = (i === 2) ? { style: 'solid', size: 2 } : { style: 'dashed', size: 1 };
            figs.push({ type: 'line', attrs: { coordinates: [{x:xMin, y:hy}, {x:xMax, y:hy}] }, styles: styleObj });
            figs.push({ type: 'line', attrs: { coordinates: [{x:vx, y:yMin}, {x:vx, y:yMax}] }, styles: styleObj });
          }

          var RATIOS = [[1, 8, '1×8'], [1, 4, '1×4'], [1, 3, '1×3'], [1, 2, '1×2'], [1, 1, '1×1'], [2, 1, '2×1'], [3, 1, '3×1'], [4, 1, '4×1'], [8, 1, '8×1']];
          RATIOS.forEach(function(r) {
            var dx = signX * r[0] * size, dy = signY * r[1] * size;
            var ts = [];
            if (dx > 0.001) ts.push((W - P0.x) / dx); if (dx < -0.001) ts.push((0 - P0.x) / dx);
            if (dy > 0.001) ts.push((H - P0.y) / dy); if (dy < -0.001) ts.push((0 - P0.y) / dy);
            var tPos = ts.filter(v => v > 0);
            if (!tPos.length) return;
            var tMin = Math.min(...tPos);
            var end = { x: P0.x + dx * tMin, y: P0.y + dy * tMin };
            figs.push({ type: 'line', attrs: { coordinates: [P0, end] }, styles: { style: 'dashed' } });
          });
          return figs;
        }
      },
      { name: 'abcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { let acLineCoordinates = [], bdLineCoordinates = []; const tags = ['A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` })); if (coordinates.length > 2) { acLineCoordinates = [coordinates[0], coordinates[2]]; if (coordinates.length > 3) bdLineCoordinates = [coordinates[1], coordinates[3]]; } return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: [{ coordinates: acLineCoordinates }, { coordinates: bdLineCoordinates }], styles: { style: 'dashed' } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'xabcd', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const dashedLines = [], polygons = []; const tags = ['X', 'A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` })); if (coordinates.length > 2) { dashedLines.push({ coordinates: [coordinates[0], coordinates[2]] }); polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] }); if (coordinates.length > 3) { dashedLines.push({ coordinates: [coordinates[1], coordinates[3]] }); if (coordinates.length > 4) { dashedLines.push({ coordinates: [coordinates[2], coordinates[4]] }); polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] }); } } } return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } }, { type: 'polygon', ignoreEvent: true, attrs: polygons }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      // --- BATCH 7: CHART PATTERNS (Đã fix lỗi cú pháp mảng c[i] & Tối ưu UI/UX) ---
      {
        name: 'headAndShoulders', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, LABELS = ['', 'LS', '', 'Head', '', 'RS', ''];
          function el(A, B) {
            var dx = B.x-A.x, dy = B.y-A.y;
            function r(ox, oy, vx, vy) {
              var ts = [];
              if (vx > 0.001) ts.push((W-ox)/vx); if (vx < -0.001) ts.push((0-ox)/vx);
              if (vy > 0.001) ts.push((H-oy)/vy); if (vy < -0.001) ts.push((0-oy)/vy);
              var t = ts.filter(v => v >= 0).length ? Math.min(...ts.filter(v => v >= 0)) : 0;
              return { x: ox+vx*t, y: oy+vy*t };
            }
            return [r(A.x,A.y,-dx,-dy), r(A.x,A.y,dx,dy)];
          }
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = el(c[2], c[4]);
            figs.push({ type:'line', attrs:{ coordinates:nl }, styles: { style: 'dashed' } }); // Neckline nét đứt
            figs.push({ type:'text', attrs:{ x:nl[1].x-4, y:nl[1].y-4, text:'Neckline', align:'right', baseline:'bottom' }, ignoreEvent:true });
          }
          return figs;
        }
      },
      {
        name: 'inverseHeadAndShoulders', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, LABELS = ['', 'LS', '', 'Head', '', 'RS', ''];
          function el(A, B) {
            var dx = B.x-A.x, dy = B.y-A.y;
            function r(ox, oy, vx, vy) {
              var ts = [];
              if (vx > 0.001) ts.push((W-ox)/vx); if (vx < -0.001) ts.push((0-ox)/vx);
              if (vy > 0.001) ts.push((H-oy)/vy); if (vy < -0.001) ts.push((0-oy)/vy);
              var t = ts.filter(v => v >= 0).length ? Math.min(...ts.filter(v => v >= 0)) : 0;
              return { x: ox+vx*t, y: oy+vy*t };
            }
            return [r(A.x,A.y,-dx,-dy), r(A.x,A.y,dx,dy)];
          }
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = el(c[2], c[4]);
            figs.push({ type:'line', attrs:{ coordinates:nl }, styles: { style: 'dashed' } });
            figs.push({ type:'text', attrs:{ x:nl[1].x-4, y:nl[1].y-4, text:'Neckline', align:'right', baseline:'bottom' }, ignoreEvent:true });
          }
          return figs;
        }
      },
      {
        name: 'tripleTop', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, LABELS = ['', 'T1', '', 'T2', '', 'T3', ''];
          function el(A, B) {
            var dx = B.x-A.x, dy = B.y-A.y;
            function r(ox, oy, vx, vy) {
              var ts = [];
              if (vx > 0.001) ts.push((W-ox)/vx); if (vx < -0.001) ts.push((0-ox)/vx);
              if (vy > 0.001) ts.push((H-oy)/vy); if (vy < -0.001) ts.push((0-oy)/vy);
              var t = ts.filter(v => v >= 0).length ? Math.min(...ts.filter(v => v >= 0)) : 0;
              return { x: ox+vx*t, y: oy+vy*t };
            }
            return [r(A.x,A.y,-dx,-dy), r(A.x,A.y,dx,dy)];
          }
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = el(c[2], c[4]);
            figs.push({ type:'line', attrs:{ coordinates:nl }, styles: { style: 'dashed' } });
            figs.push({ type:'text', attrs:{ x:nl[1].x-4, y:nl[1].y-4, text:'Neckline', align:'right', baseline:'bottom' }, ignoreEvent:true });
          }
          return figs;
        }
      },
      {
        name: 'tripleBottom', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, LABELS = ['', 'B1', '', 'B2', '', 'B3', ''];
          function el(A, B) {
            var dx = B.x-A.x, dy = B.y-A.y;
            function r(ox, oy, vx, vy) {
              var ts = [];
              if (vx > 0.001) ts.push((W-ox)/vx); if (vx < -0.001) ts.push((0-ox)/vx);
              if (vy > 0.001) ts.push((H-oy)/vy); if (vy < -0.001) ts.push((0-oy)/vy);
              var t = ts.filter(v => v >= 0).length ? Math.min(...ts.filter(v => v >= 0)) : 0;
              return { x: ox+vx*t, y: oy+vy*t };
            }
            return [r(A.x,A.y,-dx,-dy), r(A.x,A.y,dx,dy)];
          }
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = el(c[2], c[4]);
            figs.push({ type:'line', attrs:{ coordinates:nl }, styles: { style: 'dashed' } });
            figs.push({ type:'text', attrs:{ x:nl[1].x-4, y:nl[1].y-4, text:'Neckline', align:'right', baseline:'bottom' }, ignoreEvent:true });
          }
          return figs;
        }
      },
      {
        name: 'doubleTop', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, LABELS = ['', 'Top 1', '', 'Top 2', ''];
          var figs = [];
          for(var i=0; i<c.length-1; i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          for(var j=0; j<c.length; j++){
            if(!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({type:'text',attrs:{x:c[j].x,y:above?c[j].y-10:c[j].y+10,text:LABELS[j],align:'center',baseline:above?'bottom':'top'},ignoreEvent:true});
          }
          if (c.length >= 3) {
            figs.push({ type:'line', attrs:{ coordinates:[{x:0,y:c[2].y},{x:W,y:c[2].y}] }, styles: { style: 'dashed' } });
            figs.push({ type:'text', attrs:{ x:W-4, y:c[2].y-4, text:'Neckline', align:'right', baseline:'bottom' }, ignoreEvent:true });
            if (c.length >= 4) {
              var peakAvg = (c[1].y + c[3].y) / 2;
              var targetY = c[2].y + (c[2].y - peakAvg);
              figs.push({ type:'line', attrs:{ coordinates:[{x:0,y:targetY},{x:W,y:targetY}] }, styles: { style: 'dashed', color: 'rgba(246, 70, 93, 1)' } });
              figs.push({ type:'text', attrs:{ x:4, y:targetY+4, text:'Target', align:'left', baseline:'top' }, ignoreEvent:true });
            }
          }
          return figs;
        }
      },
      {
        name: 'doubleBottom', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, LABELS = ['', 'Bot 1', '', 'Bot 2', ''];
          var figs = [];
          for(var i=0; i<c.length-1; i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          for(var j=0; j<c.length; j++){
            if(!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({type:'text',attrs:{x:c[j].x,y:above?c[j].y-10:c[j].y+10,text:LABELS[j],align:'center',baseline:above?'bottom':'top'},ignoreEvent:true});
          }
          if (c.length >= 3) {
            figs.push({ type:'line', attrs:{ coordinates:[{x:0,y:c[2].y},{x:W,y:c[2].y}] }, styles: { style: 'dashed' } });
            figs.push({ type:'text', attrs:{ x:W-4, y:c[2].y+4, text:'Neckline', align:'right', baseline:'top' }, ignoreEvent:true });
            if (c.length >= 4) {
              var valleyAvg = (c[1].y + c[3].y) / 2;
              var targetY = c[2].y - (valleyAvg - c[2].y);
              figs.push({ type:'line', attrs:{ coordinates:[{x:0,y:targetY},{x:W,y:targetY}] }, styles: { style: 'dashed', color: 'rgba(14, 203, 129, 1)' } });
              figs.push({ type:'text', attrs:{ x:4, y:targetY-4, text:'Target', align:'left', baseline:'bottom' }, ignoreEvent:true });
            }
          }
          return figs;
        }
      },
      {
        name: 'threeDrives', totalStep: 7, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var LABELS = ['', 'D1', 'C1', 'D2', 'C2', 'D3'];
          var figs = [];
          for(var i=0; i<c.length-1; i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          for(var j=0; j<c.length; j++){
            if(!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({type:'text',attrs:{x:c[j].x,y:above?c[j].y-10:c[j].y+10,text:LABELS[j],align:'center',baseline:above?'bottom':'top'},ignoreEvent:true});
          }
          if (c.length >= 6) {
            figs.push({ type:'line', attrs:{ coordinates:[c[1],c[3],c[5]] }, styles: { style: 'dashed' } });
            figs.push({ type:'line', attrs:{ coordinates:[c[2],c[4]] }, styles: { style: 'dashed' } });
          }
          return figs;
        }
      },
      {
        name: 'symmetricalTriangle', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = 'Sym △';
          function el(A,B){var dx=B.x-A.x,dy=B.y-A.y;function r(ox,oy,vx,vy){var ts=[];if(vx>0.001)ts.push((W-ox)/vx);if(vx<-0.001)ts.push((0-ox)/vx);if(vy>0.001)ts.push((H-oy)/vy);if(vy<-0.001)ts.push((0-oy)/vy);var t=ts.filter(v=>v>=0).length?Math.min(...ts.filter(v=>v>=0)):0;return{x:ox+vx*t,y:oy+vy*t};}return[r(A.x,A.y,-dx,-dy),r(A.x,A.y,dx,dy)];}
          var figs = [];
          if(c.length === 4) { // Tô màu mờ lòng tam giác khi đủ 4 điểm
            figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          }
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:el(c[0],c[2])}, styles: { style: 'dashed' } });
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:el(c[1],c[3])}, styles: { style: 'dashed' } });
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'ascendingTriangle', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = 'Asc △';
          function el(A,B){var dx=B.x-A.x,dy=B.y-A.y;function r(ox,oy,vx,vy){var ts=[];if(vx>0.001)ts.push((W-ox)/vx);if(vx<-0.001)ts.push((0-ox)/vx);if(vy>0.001)ts.push((H-oy)/vy);if(vy<-0.001)ts.push((0-oy)/vy);var t=ts.filter(v=>v>=0).length?Math.min(...ts.filter(v=>v>=0)):0;return{x:ox+vx*t,y:oy+vy*t};}return[r(A.x,A.y,-dx,-dy),r(A.x,A.y,dx,dy)];}
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:el(c[0],c[2])}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:el(c[1],c[3])}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'descendingTriangle', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = 'Desc △';
          function el(A,B){var dx=B.x-A.x,dy=B.y-A.y;function r(ox,oy,vx,vy){var ts=[];if(vx>0.001)ts.push((W-ox)/vx);if(vx<-0.001)ts.push((0-ox)/vx);if(vy>0.001)ts.push((H-oy)/vy);if(vy<-0.001)ts.push((0-oy)/vy);var t=ts.filter(v=>v>=0).length?Math.min(...ts.filter(v=>v>=0)):0;return{x:ox+vx*t,y:oy+vy*t};}return[r(A.x,A.y,-dx,-dy),r(A.x,A.y,dx,dy)];}
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:el(c[0],c[2])}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:el(c[1],c[3])}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'risingWedge', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = '↑ Wedge';
          function el(A,B){var dx=B.x-A.x,dy=B.y-A.y;function r(ox,oy,vx,vy){var ts=[];if(vx>0.001)ts.push((W-ox)/vx);if(vx<-0.001)ts.push((0-ox)/vx);if(vy>0.001)ts.push((H-oy)/vy);if(vy<-0.001)ts.push((0-oy)/vy);var t=ts.filter(v=>v>=0).length?Math.min(...ts.filter(v=>v>=0)):0;return{x:ox+vx*t,y:oy+vy*t};}return[r(A.x,A.y,-dx,-dy),r(A.x,A.y,dx,dy)];}
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:el(c[0],c[2])}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:el(c[1],c[3])}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'fallingWedge', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = '↓ Wedge';
          function el(A,B){var dx=B.x-A.x,dy=B.y-A.y;function r(ox,oy,vx,vy){var ts=[];if(vx>0.001)ts.push((W-ox)/vx);if(vx<-0.001)ts.push((0-ox)/vx);if(vy>0.001)ts.push((H-oy)/vy);if(vy<-0.001)ts.push((0-oy)/vy);var t=ts.filter(v=>v>=0).length?Math.min(...ts.filter(v=>v>=0)):0;return{x:ox+vx*t,y:oy+vy*t};}return[r(A.x,A.y,-dx,-dy),r(A.x,A.y,dx,dy)];}
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:el(c[0],c[2])}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:el(c[1],c[3])}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'flagPattern', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var figs = [];
          figs.push({ type:'line', attrs:{ coordinates:[c[0],c[1]] } }); // Cán cờ
          if (c.length < 4) {
            if (c.length >= 3) figs.push({ type:'line', attrs:{ coordinates:[c[1],c[2]] } });
            return figs;
          }
          var P1 = c[1], P2 = c[2], P3 = c[3];
          var P4 = { x: P1.x + P3.x - P2.x, y: P1.y + P3.y - P2.y };
          // Lá cờ có nền mờ
          figs.push({ type:'polygon', attrs:{ coordinates:[P1, P2, P3, P4] }, styles: { style: 'stroke_fill', color: 'rgba(0, 240, 255, 0.08)' } });
          var cx = (P1.x+P2.x+P3.x+P4.x)/4, cy = (P1.y+P2.y+P3.y+P4.y)/4;
          figs.push({ type:'text', attrs:{ x:cx, y:cy, text:'Flag', align:'center', baseline:'middle' }, ignoreEvent:true });
          return figs;
        }
      },
      {
        name: 'pennantPattern', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, figs = [];
          figs.push({ type:'line', attrs:{ coordinates:[c[0],c[1]] } }); // Cán cờ
          if (c.length < 4) {
            if (c.length >= 3) figs.push({ type:'line', attrs:{ coordinates:[c[1],c[2]] } });
            return figs;
          }
          var P1 = c[1], P2 = c[2], P3 = c[3];
          function rayFwd(from, to) {
            var dx = to.x-from.x, dy = to.y-from.y, ts = [];
            if(dx>0.001) ts.push((W-from.x)/dx); if(dx<-0.001) ts.push((0-from.x)/dx);
            if(dy>0.001) ts.push((H-from.y)/dy); if(dy<-0.001) ts.push((0-from.y)/dy);
            var t = ts.filter(v => v>0).length ? Math.min(...ts.filter(v => v>0)) : 1;
            return {x:from.x+dx*t, y:from.y+dy*t};
          }
          // Hình tam giác cờ đuôi nheo có màu nền mờ
          figs.push({ type:'polygon', attrs:{ coordinates:[P1, rayFwd(P1,P2), rayFwd(P1,P3)] }, styles: { style: 'stroke_fill', color: 'rgba(0, 240, 255, 0.08)' } });
          var cx=(P1.x+P2.x+P3.x)/3, cy=(P1.y+P2.y+P3.y)/3;
          figs.push({ type:'text', attrs:{ x:cx, y:cy, text:'Pennant', align:'center', baseline:'middle' }, ignoreEvent:true });
          return figs;
        }
      },

      // --- BATCH 8: Text Annotation Tools ---
      { name: 'plainText', totalStep: 2, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || '...'; var os = ref.overlay.styles || {}; var tS = os.text || {}; return [{ type: 'text', attrs: { x: c[0].x, y: c[0].y, text: txt, align: 'left', baseline: 'top' }, styles: { color: tS.color || '#EAECEF', size: tS.size || 14, family: tS.family || 'Rajdhani, sans-serif', weight: '600' } }]; } },
      { name: 'anchoredText', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || '...'; var figs = []; var os = ref.overlay.styles || {}; var tS = os.text || {}; if (c.length >= 2) { figs.push({ type: 'line', attrs: { coordinates: [c[0], c[1]] }, styles: { color: 'rgba(0,240,255,0.4)', size: 1, style: 'dashed' } }); } var tx = c.length >= 2 ? c[1].x : c[0].x; var ty = c.length >= 2 ? c[1].y : c[0].y; figs.push({ type: 'text', attrs: { x: tx, y: ty, text: txt, align: 'left', baseline: 'bottom' }, styles: { color: tS.color || '#00F0FF', size: tS.size || 13, family: tS.family || 'Rajdhani, sans-serif', weight: '700' } }); return figs; } },
      { name: 'note', totalStep: 2, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || '...'; var x = c[0].x, y = c[0].y; var lines = txt.split('\n'); var lh = 16, pd = 8; var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); var bw = Math.max(60, maxLen * 7.5 + pd * 2); var bh = lines.length * lh + pd * 2; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; return [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y }, { x: x + bw, y: y }, { x: x + bw, y: y + bh }, { x: x, y: y + bh } ]}, styles: { style: 'fill', color: pS.color || 'rgba(240,185,11,0.15)', borderColor: pS.borderColor || '#F0B90B', borderSize: 1 }, ignoreEvent: true }, { type: 'text', attrs: { x: x + pd, y: y + pd, text: lines[0], align: 'left', baseline: 'top' }, styles: { color: tS.color || '#EAECEF', size: tS.size || 12, family: tS.family || 'sans-serif' } } ]; } },
      { name: 'priceNote', totalStep: 2, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: true, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var pts = (ref.overlay && ref.overlay.points) ? ref.overlay.points : []; var priceVal = (pts[0] && pts[0].value != null) ? pts[0].value : null; var dp = (ref.precision && ref.precision.price != null) ? ref.precision.price : 4; var custom = ref.overlay.extendData || ''; var priceStr = priceVal != null ? priceVal.toFixed(dp) : ''; var label = custom ? (priceStr ? priceStr + '  ' + custom : custom) : (priceStr || '...'); var x = c[0].x, y = c[0].y; var bw = label.length * 7 + 16, bh = 22; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; return [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - bh / 2 }, { x: x + bw, y: y - bh / 2 }, { x: x + bw, y: y + bh / 2 }, { x: x, y: y + bh / 2 } ]}, styles: { style: 'fill', color: pS.color || 'rgba(14,203,129,0.2)', borderColor: pS.borderColor || '#0ECB81', borderSize: 1 }, ignoreEvent: true }, { type: 'text', attrs: { x: x + 8, y: y, text: label, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#0ECB81', size: tS.size || 12, family: tS.family || 'Rajdhani, sans-serif', weight: '700' } } ]; } },
      { name: 'pin', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || ''; var x = c[0].x, y = c[0].y, r = 10; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; var figs = [ { type: 'circle', attrs: { x: x, y: y - r - 10, r: r }, styles: { style: 'fill', color: pS.color || '#F0B90B', borderColor: pS.borderColor || '#fff', borderSize: 1.5 } }, { type: 'line', attrs: { coordinates: [{ x: x, y: y - 10 }, { x: x, y: y }] }, styles: { color: pS.color || '#F0B90B', size: 2 } } ]; if (txt) { figs.push({ type: 'text', attrs: { x: x + r + 4, y: y - r - 10, text: txt, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#EAECEF', size: tS.size || 12, family: tS.family || 'sans-serif' } }); } return figs; } },
      { name: 'tableAnnotation', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var x0 = c[0].x, y0 = c[0].y; var x1 = c.length >= 2 ? c[1].x : x0 + 160; var y1 = c.length >= 2 ? c[1].y : y0 + 80; var W = Math.abs(x1 - x0) || 160, H = Math.abs(y1 - y0) || 80; var lx = Math.min(x0, x1), ly = Math.min(y0, y1); var cols = 2, rows = 3, cw = W / cols, ch = H / rows; var os = ref.overlay.styles || {}; var pS = os.polygon || {}; var figs = [{ type: 'polygon', attrs: { coordinates: [ { x: lx, y: ly }, { x: lx + W, y: ly }, { x: lx + W, y: ly + H }, { x: lx, y: ly + H } ]}, styles: { style: 'fill', color: pS.color || 'rgba(22,26,30,0.9)', borderColor: pS.borderColor || '#2b3139', borderSize: 1 }, ignoreEvent: true }]; for (var ci = 1; ci < cols; ci++) { figs.push({ type: 'line', attrs: { coordinates: [ { x: lx + ci * cw, y: ly }, { x: lx + ci * cw, y: ly + H } ]}, styles: { color: '#2b3139', size: 1 }, ignoreEvent: true }); } for (var ri = 1; ri < rows; ri++) { figs.push({ type: 'line', attrs: { coordinates: [ { x: lx, y: ly + ri * ch }, { x: lx + W, y: ly + ri * ch } ]}, styles: { color: '#2b3139', size: 1 }, ignoreEvent: true }); } return figs; } },
      { name: 'annotation', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || '...'; var figs = []; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; if (c.length >= 2) { figs.push({ type: 'line', attrs: { coordinates: [c[0], c[1]] }, styles: { color: pS.borderColor || '#00F0FF', size: 1 } }); var tx = c[1].x, ty = c[1].y; var bw = txt.length * 7.5 + 16, bh = 22; figs.push({ type: 'polygon', attrs: { coordinates: [ { x: tx, y: ty - bh / 2 }, { x: tx + bw, y: ty - bh / 2 }, { x: tx + bw, y: ty + bh / 2 }, { x: tx, y: ty + bh / 2 } ]}, styles: { style: 'stroke_fill', color: pS.color || 'rgba(0,240,255,0.1)', borderColor: pS.borderColor || '#00F0FF', borderSize: 1 }, ignoreEvent: true }); figs.push({ type: 'text', attrs: { x: tx + 8, y: ty, text: txt, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#00F0FF', size: tS.size || 12, family: tS.family || 'Rajdhani, sans-serif', weight: '600' } }); } else { figs.push({ type: 'text', attrs: { x: c[0].x + 8, y: c[0].y, text: txt, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#00F0FF', size: tS.size || 12, family: tS.family || 'Rajdhani, sans-serif', weight: '600' } }); } return figs; } },
      { name: 'comment', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || '...'; var x = c[0].x, y = c[0].y; var bw = Math.max(80, txt.length * 7 + 20), bh = 30, tail = 8; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; return [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - bh - tail }, { x: x + bw, y: y - bh - tail }, { x: x + bw, y: y - tail }, { x: x + 18, y: y - tail }, { x: x + 10, y: y }, { x: x + 6, y: y - tail }, { x: x, y: y - tail } ]}, styles: { style: 'stroke_fill', color: pS.color || 'rgba(30,35,42,0.95)', borderColor: pS.borderColor || '#474d57', borderSize: 1 }, ignoreEvent: true }, { type: 'text', attrs: { x: x + 10, y: y - bh / 2 - tail, text: txt, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#EAECEF', size: tS.size || 12, family: tS.family || 'sans-serif' } } ]; } },
      { name: 'priceLabel', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: true, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var pts = (ref.overlay && ref.overlay.points) ? ref.overlay.points : []; var priceVal = (pts[0] && pts[0].value != null) ? pts[0].value : null; var dp = (ref.precision && ref.precision.price != null) ? ref.precision.price : 4; var custom = ref.overlay.extendData || ''; var priceStr = priceVal != null ? priceVal.toFixed(dp) : ''; var label = custom ? (priceStr ? priceStr + '  ' + custom : custom) : (priceStr || '...'); var x = c[0].x, y = c[0].y; var bw = label.length * 7 + 16, bh = 22; var arr = 6; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; return [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - bh / 2 }, { x: x + arr, y: y - bh / 2 }, { x: x + arr + bw, y: y - bh / 2 }, { x: x + arr + bw, y: y + bh / 2 }, { x: x + arr, y: y + bh / 2 } ]}, styles: { style: 'fill', color: pS.color || '#F6465D' }, ignoreEvent: true }, { type: 'text', attrs: { x: x + arr + 6, y: y, text: label, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#fff', size: tS.size || 11, family: tS.family || 'Rajdhani, sans-serif', weight: '700' } } ]; } },
      { name: 'signpost', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || '...'; var tx = c.length >= 2 ? c[1].x : c[0].x; var ty = c.length >= 2 ? c[1].y : c[0].y - 40; var figs = []; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; if (c.length >= 2) { figs.push({ type: 'line', attrs: { coordinates: [c[0], { x: tx, y: ty }] }, styles: { color: pS.borderColor || '#848e9c', size: 1, style: 'dashed' } }); } var bw = txt.length * 7.5 + 24, bh = 24, notch = 10; var isRight = tx >= c[0].x; var coords = isRight ? [{ x: tx, y: ty }, { x: tx + notch, y: ty - bh / 2 }, { x: tx + notch + bw, y: ty - bh / 2 }, { x: tx + notch + bw, y: ty + bh / 2 }, { x: tx + notch, y: ty + bh / 2 }] : [{ x: tx, y: ty }, { x: tx - notch, y: ty - bh / 2 }, { x: tx - notch - bw, y: ty - bh / 2 }, { x: tx - notch - bw, y: ty + bh / 2 }, { x: tx - notch, y: ty + bh / 2 }]; figs.push({ type: 'polygon', attrs: { coordinates: coords }, styles: { style: 'fill', color: pS.color || 'rgba(153,69,255,0.25)', borderColor: pS.borderColor || '#9945FF', borderSize: 1 }, ignoreEvent: true }); figs.push({ type: 'text', attrs: { x: isRight ? tx + notch + 8 : tx - notch - 8, y: ty, text: txt, align: isRight ? 'left' : 'right', baseline: 'middle' }, styles: { color: tS.color || '#d0aaff', size: tS.size || 12, family: tS.family || 'Rajdhani, sans-serif', weight: '700' } }); return figs; } },
      { name: 'flagMarker', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var txt = ref.overlay.extendData || ''; var x = c[0].x, y = c[0].y, pw = 3, ph = 30, fw = 22, fh = 14; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; return [ { type: 'line', attrs: { coordinates: [{ x: x, y: y }, { x: x, y: y - ph }] }, styles: { color: pS.color || '#F0B90B', size: pw } }, { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - ph }, { x: x + fw, y: y - ph + fh / 2 }, { x: x, y: y - ph + fh } ]}, styles: { style: 'fill', color: pS.color || '#F0B90B' }, ignoreEvent: true }, ...(txt ? [{ type: 'text', attrs: { x: x + fw + 4, y: y - ph + fh / 2, text: txt, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#F0B90B', size: tS.size || 11, family: tS.family || 'sans-serif' } }] : []) ]; } },
      { name: 'insertImage', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var url = ref.overlay.extendData || ''; var x0 = c[0].x, y0 = c[0].y; var x1 = c.length >= 2 ? c[1].x : x0 + 120; var y1 = c.length >= 2 ? c[1].y : y0 + 80; var lx = Math.min(x0, x1), ly = Math.min(y0, y1); var W = Math.abs(x1 - x0) || 120, H = Math.abs(y1 - y0) || 80; var label = url ? '🖼 ' + url.split('/').pop().slice(0, 20) : '🖼 Double-click to set URL'; return [ { type: 'polygon', attrs: { coordinates: [ { x: lx, y: ly }, { x: lx + W, y: ly }, { x: lx + W, y: ly + H }, { x: lx, y: ly + H } ]}, styles: { style: 'stroke_fill', color: 'rgba(0,240,255,0.05)', borderColor: '#2b3139', borderSize: 1, borderStyle: 'dashed' }, ignoreEvent: true }, { type: 'line', attrs: { coordinates: [{ x: lx, y: ly }, { x: lx + W, y: ly + H }] }, styles: { color: '#2b3139', size: 1 }, ignoreEvent: true }, { type: 'line', attrs: { coordinates: [{ x: lx + W, y: ly }, { x: lx, y: ly + H }] }, styles: { color: '#2b3139', size: 1 }, ignoreEvent: true }, { type: 'text', attrs: { x: lx + W / 2, y: ly + H / 2, text: label, align: 'center', baseline: 'middle' }, styles: { color: '#5E6673', size: 11 } } ]; } },
      { name: 'insertIcon', totalStep: 2, needDefaultPointFigure: false, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: function(ref) { var c = ref.coordinates || []; if (!c.length) return []; var icon = ref.overlay.extendData || '★'; var x = c[0].x, y = c[0].y; var os = ref.overlay.styles || {}; var tS = os.text || {}; return [{ type: 'text', attrs: { x: x, y: y, text: icon, align: 'center', baseline: 'middle' }, styles: { color: tS.color || '#F0B90B', size: tS.size || 22, family: tS.family || 'sans-serif' } }]; } }
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
      
      .wa-tb-btn::after { content: attr(data-tooltip); position: absolute; left: 48px; top: 50%; transform: translateY(-50%); background: #1E2329; color: #EAECEF; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; pointer-events: none; opacity: 0; transition: 0.2s; border: 1px solid #2b3139; z-index: 1000; }
      .wa-tb-btn:hover::after { opacity: 1; }

      .wa-tb-group { position: relative; width: 100%; display: flex; justify-content: center; }
      .wa-tb-group::after { content: ''; position: absolute; right: 4px; bottom: 6px; border: solid #848E9C; border-width: 0 1.5px 1.5px 0; padding: 1.5px; transform: rotate(-45deg); pointer-events: none; }
      .wa-tb-menu { position: absolute; left: 100%; top: -6px; padding-left: 8px; display: none; z-index: 1000; }
      .wa-tb-group:hover .wa-tb-menu { display: block; }
      .wa-tb-menu-inner { 
          background: #161A1E; border: 1px solid #2b3139; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); 
          width: 230px; padding: 6px 0; display: flex; flex-direction: column; 
          max-height: 55vh; overflow-y: auto; overflow-x: hidden;
      }
      .wa-tb-menu-inner::-webkit-scrollbar { width: 4px; }
      .wa-tb-menu-inner::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 4px; }
      .wa-tb-menu-inner::-webkit-scrollbar-track { background: transparent; }

      /* Giao diện cho Tiêu đề và Phân cách */
      .wa-menu-header { padding: 12px 16px 4px 16px; color: #848E9C; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; pointer-events: none; }
      .wa-menu-divider { width: 100%; height: 1px; background: #2b3139; margin: 4px 0; }

      /* Thu gọn 2 nút Magnet và Trash */
      .wa-bot-actions { display: flex; width: 100%; justify-content: space-evenly; padding: 4px 0; }
      .wa-bot-actions .wa-tb-btn { width: 20px; height: 24px; margin: 0; }
      .wa-bot-actions .wa-tb-btn svg { width: 15px; height: 15px; }
      
      /* Thêm padding-left (24px) để menu item lùi vào một chút cho đẹp so với tiêu đề */
      .wa-menu-item { padding: 8px 16px 8px 24px; color: #EAECEF; font-size: 13px; cursor: pointer; transition: 0.1s; }
      .wa-menu-item:hover { background: #2b3139; color: #00F0FF; }

      .wa-props-panel { position: absolute; right: 0; top: 0; bottom: 0; width: 260px; background: rgba(22, 26, 30, 0.95); border-left: 1px solid #2b3139; box-shadow: -4px 0 24px rgba(0,0,0,0.5); backdrop-filter: blur(10px); z-index: 999; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; }
      .wa-props-panel.show { transform: translateX(0); }
      .wa-icon-picker { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; background: #0B0E11; border: 1px solid #2b3139; border-radius: 4px; max-height: 120px; overflow-y: auto; }
      .wa-icon-picker::-webkit-scrollbar { width: 4px; }
      .wa-icon-picker::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 4px; }
      .wa-emo { cursor: pointer; font-size: 20px; transition: transform 0.1s; user-select: none; }
      .wa-emo:hover { transform: scale(1.3); }
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
    linesAdv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="17" x2="22" y2="7"/><polyline points="2,17 6,13"/><polyline points="22,7 18,11"/><line x1="2" y1="22" x2="22" y2="22" stroke-dasharray="3 2"/></svg>`,
    fibo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
    shape: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M12 4v16"/><path d="M9 20h6"/></svg>`,
    magnet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9a8 8 0 0 1 16 0v4a8 8 0 0 1-16 0V9z"/><path d="M4 13v-2"/><path d="M20 13v-2"/><path d="M8 21v-4"/><path d="M16 21v-4"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

 // Đã gộp thông minh: Lines chung, Fibo chung Gann, Shapes chung Arrows
  const MENUS = [
    { 
      icon: SVG.line, 
      tools: [ 
        {id: 'header', n: 'Đường Cơ Bản'},
        {id: 'segment', n: 'Đường xu hướng'}, {id: 'rayLine', n: 'Tia'}, {id: 'extendedLine', n: 'Đường thẳng 2 chiều'}, {id: 'trendAngle', n: 'Góc xu hướng'}, {id: 'horizontalStraightLine', n: 'Đường ngang'}, {id: 'verticalStraightLine', n: 'Đường dọc'}, {id: 'crossLine', n: 'Đường chữ thập'},
        {id: 'divider'},
        {id: 'header', n: 'Kênh & Nâng Cao'},
        {id: 'infoLine', n: 'Đường thông tin'}, {id: 'priceChannelLine', n: 'Kênh song song'}, {id: 'curvedLine', n: 'Đường cong'} 
      ]
    },
    { 
      icon: SVG.fibo, 
      tools: [ 
        {id: 'header', n: 'Fibonacci'},
        {id: 'fibRetracement', n: 'Fibonacci Retracement'}, {id: 'fibExtension', n: 'Fibonacci Extension'}, {id: 'fibFan', n: 'Fibonacci Fan'}, {id: 'fibArc', n: 'Fibonacci Arc'}, {id: 'fibTimeZone', n: 'Fibo Time Zone'}, 
        {id: 'divider'},
        {id: 'header', n: 'Gann'},
        {id: 'gannFan', n: 'Gann Fan'}, {id: 'gannBox', n: 'Gann Box'}, {id: 'gannSquare', n: 'Gann Square'} 
      ]
    },
    { 
      icon: SVG.shape, 
      tools: [ 
        {id: 'header', n: 'Hình Khối'},
        {id: 'rectangle', n: 'Hình chữ nhật'}, {id: 'rotatedRectangle', n: 'Chữ nhật xoay'}, {id: 'circle', n: 'Vòng tròn'}, {id: 'ellipse', n: 'Hình ellipse'}, {id: 'triangle', n: 'Tam giác'}, {id: 'parallelogram', n: 'Hình bình hành'}, 
        {id: 'divider'},
        {id: 'header', n: 'Mũi Tên & Đường Dẫn'},
        {id: 'polyline', n: 'Đường đa đoạn'}, {id: 'pathShape', n: 'Đường dẫn'}, {id: 'arcShape', n: 'Hình vòng cung'}, {id: 'doubleCurveShape', n: 'Đường cong đôi'}, {id: 'arrow', n: 'Mũi tên'}, {id: 'arrowUp', n: 'Mũi tên chỉ lên'}, {id: 'arrowDown', n: 'Mũi tên chỉ xuống'} 
      ]
    },
    {
      id: 'textAnnotations',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
      tools: [
        { id: 'header', n: 'Văn Bản & Ghi Chú' },
        { id: 'plainText', name: 'Văn bản', n: 'Văn bản' },
        { id: 'anchoredText', name: 'Văn bản được neo', n: 'Văn bản được neo' },
        { id: 'note', name: 'Ghi chú', n: 'Ghi chú' },
        { id: 'priceNote', name: 'Ghi chú giá', n: 'Ghi chú giá' },
        { id: 'pin', name: 'Ghim', n: 'Ghim' },
        { id: 'annotation', name: 'Chú thích', n: 'Chú thích' },
        { id: 'comment', name: 'Bình luận', n: 'Bình luận' },
        { id: 'priceLabel', name: 'Nhãn giá', n: 'Nhãn giá' },
        { id: 'signpost', name: 'Biển chỉ dẫn', n: 'Biển chỉ dẫn' },
        { id: 'flagMarker', name: 'Cờ đánh dấu', n: 'Cờ đánh dấu' },
        { id: 'tableAnnotation', name: 'Bảng', n: 'Bảng' }
      ]
    },
    {
      id: 'contentTools',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      tools: [
        { id: 'header', n: 'Nội Dung' },
        { id: 'insertImage', name: 'Chèn ảnh', n: 'Chèn ảnh' },
        { id: 'insertIcon', name: 'Chèn icon', n: 'Chèn icon' }
      ]
    },
    { 
      id: 'elliottWave',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12l5-8 6 16 5-12 4 4"/></svg>`, 
      tools: [ 
        {id: 'header', n: 'Sóng Elliott'},
        {id: 'elliottImpulse', n: 'Sóng Đẩy Elliott (12345)'}, {id: 'elliottCorrection', n: 'Sóng Điều Chỉnh (ABC)'}, {id: 'elliottTriangle', n: 'Sóng Tam Giác (ABCDE)'}, {id: 'elliottDouble', n: 'Sóng Đôi (WXY)'}, {id: 'elliottTriple', n: 'Sóng Ba (WXYXZ)'}, 
        {id: 'divider'},
        {id: 'header', n: 'Mô Hình Harmonic'},
        {id: 'abcd', n: 'Mô hình ABCD'}, {id: 'xabcd', n: 'Mô hình XABCD'} 
      ]
    },
    { 
      id: 'pitchforkFamily',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="3" x2="12" y2="21"/><line x1="12" y1="8" x2="4" y2="21"/><line x1="12" y1="8" x2="20" y2="21"/><line x1="4" y1="8" x2="20" y2="8"/></svg>`, 
      tools: [ 
        {id: 'header', n: 'Pitchfork'},
        {id: 'andrewsPitchfork', n: 'Andrews Pitchfork'}, {id: 'schiffPitchfork', n: 'Schiff Pitchfork'}, {id: 'modifiedSchiffPitchfork', n: 'Modified Schiff'}, {id: 'insidePitchfork', n: 'Inside Pitchfork'} 
      ]
    },
    { 
      id: 'chartPatterns',
      icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2,18 5,10 8,14 12,6 16,14 19,10 22,18"/><line x1="5" y1="18" x2="19" y2="18"/></svg>`, 
      tools: [ 
        {id: 'header', n: 'Mô Hình Kinh Điển'},
        { id: 'headAndShoulders', n: 'Vai Đầu Vai' }, { id: 'inverseHeadAndShoulders', n: 'Vai Đầu Vai Ngược' }, { id: 'tripleTop', n: 'Ba Đỉnh' }, { id: 'tripleBottom', n: 'Ba Đáy' }, { id: 'doubleTop', n: 'Hai Đỉnh (Chữ M)' }, { id: 'doubleBottom', n: 'Hai Đáy (Chữ W)' }, 
        {id: 'divider'},
        {id: 'header', n: 'Mô Hình Nêm & Cờ'},
        { id: 'threeDrives', n: 'Three Drives' }, { id: 'symmetricalTriangle', n: 'Tam Giác Cân' }, { id: 'ascendingTriangle', n: 'Tam Giác Tăng' }, { id: 'descendingTriangle', n: 'Tam Giác Giảm' }, { id: 'risingWedge', n: 'Nêm Tăng' }, { id: 'fallingWedge', n: 'Nêm Giảm' }, { id: 'flagPattern', n: 'Mô hình Cờ (Flag)' }, { id: 'pennantPattern', n: 'Mô hình Pennant' } 
      ]
    }
  ];

  function buildToolbar() {
    let html = `<div class="wa-drag-grip" title="Kéo để di chuyển | Double-click để thu gọn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
                <button class="wa-tb-btn active" data-tool="pointer" data-tooltip="Con trỏ chuột (Esc)">${SVG.ptr}</button>`;
    MENUS.forEach(m => {
      html += `<div class="wa-tb-group"><button class="wa-tb-btn">${m.icon}</button>
                <div class="wa-tb-menu"><div class="wa-tb-menu-inner">`;
      m.tools.forEach(t => {
        if (t.id === 'header') {
          html += `<div class="wa-menu-header">${t.n}</div>`;
        } else if (t.id === 'divider') {
          html += `<div class="wa-menu-divider"></div>`;
        } else {
          html += `<div class="wa-menu-item" data-tool="${t.id}">${t.n}</div>`;
        }
      });
      html += `</div></div></div>`;
    });
    html += `<div style="width:24px; height:1px; background:#2b3139; margin:4px 0;"></div>
             <div class="wa-bot-actions">
               <button class="wa-tb-btn" id="wa-btn-magnet" data-tooltip="Bắt điểm (Magnet)">${SVG.magnet}</button>
               <button class="wa-tb-btn" id="wa-btn-clear" data-tooltip="Xóa tất cả">${SVG.trash}</button>
             </div>`;
    return html;
  }

  function showToast(msg) {
    let t = document.getElementById('wa-toast');
    if(!t) { t = document.createElement('div'); t.id = 'wa-toast'; t.className = 'wa-toast'; document.getElementById('sc-chart-container').appendChild(t); }
    t.innerText = msg; t.style.opacity = 1; setTimeout(() => t.style.opacity = 0, 2000);
  }

  function createConfirmModal(msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    const box = document.createElement('div');
    box.style.cssText = 'background:#161A1E;border:1px solid #2b3139;padding:24px;border-radius:8px;color:#EAECEF;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.8);';
    box.innerHTML = `<div style="margin-bottom:20px;font-size:15px;">${msg}</div><div style="display:flex;gap:12px;justify-content:center;"><button id="wa-btn-c-cancel" style="padding:8px 20px;background:#2b3139;border:none;color:#EAECEF;border-radius:4px;cursor:pointer;">Hủy</button><button id="wa-btn-c-ok" style="padding:8px 20px;background:#F6465D;border:none;color:#FFF;border-radius:4px;cursor:pointer;font-weight:bold;">Đồng ý</button></div>`;
    overlay.appendChild(box);
    
    document.getElementById('sc-chart-container').appendChild(overlay);

    setTimeout(() => {
      box.querySelector('#wa-btn-c-cancel').onclick = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      };
      box.querySelector('#wa-btn-c-ok').onclick = () => { 
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        setTimeout(() => onConfirm(), 50); 
      };
    }, 0);
  }

// ─────────────────────────────────────────────
  // TEXT EDITOR & WRAPPER (BATCH 8 ARCHITECTURE)
  // ─────────────────────────────────────────────
  var USE_NATIVE_PROMPT = false;

  function openTextEditor(currentText, currentStyles, toolId, onConfirm) {
    if (USE_NATIVE_PROMPT) {
      var result = window.prompt('Nhập nội dung:', currentText || '');
      if (result !== null) onConfirm(result, currentStyles);
      return;
    }
    var existing = document.getElementById('wa-text-editor');
    if (existing) existing.remove();

    // Map màu mặc định gốc theo từng công cụ để Popup không bị ngu ngơ
    var defBg = 'rgba(22, 26, 30, 0.9)';
    if (toolId === 'note') defBg = 'rgba(240,185,11,0.15)';
    else if (toolId === 'priceNote') defBg = 'rgba(14,203,129,0.2)';
    else if (toolId === 'pin' || toolId === 'flagMarker') defBg = '#F0B90B';
    else if (toolId === 'priceLabel') defBg = '#F6465D';
    else if (toolId === 'signpost') defBg = 'rgba(153,69,255,0.25)';
    else if (toolId === 'annotation') defBg = 'rgba(0,240,255,0.1)';

    var tStyles = (currentStyles && currentStyles.text) ? currentStyles.text : {};
    var pStyles = (currentStyles && currentStyles.polygon) ? currentStyles.polygon : {};

    var curColor = colorToHex(tStyles.color || (toolId === 'priceLabel' ? '#fff' : '#EAECEF'));
    var curBg = colorToHex(pStyles.color || defBg); 
    var curSize = tStyles.size || (toolId === 'priceLabel' ? 11 : 12);
    var curFont = tStyles.family || 'Rajdhani, sans-serif';

    var backdrop = document.createElement('div');
    backdrop.id = 'wa-text-editor';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
    backdrop.innerHTML = `
      <div style="background:#1e2329;border:1px solid #2b3139;border-radius:10px;padding:20px;width:380px;box-shadow:0 20px 40px rgba(0,0,0,0.7);font-family:Rajdhani,sans-serif;">
        <div style="font-size:11px;font-weight:700;color:#848e9c;text-transform:uppercase;margin-bottom:12px;">Định dạng: ${toolId}</div>
        
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;">
            <label style="display:block; font-size:11px; color:#848e9c; margin-bottom:4px;">Màu chữ</label>
            <input type="color" id="wa-te-color" value="${curColor}" style="width:100%; height:32px; border:1px solid #2b3139; border-radius:4px; background:#111418; cursor:pointer; padding:0;">
          </div>
          <div style="flex:1;">
            <label style="display:block; font-size:11px; color:#848e9c; margin-bottom:4px;">Màu nền</label>
            <input type="color" id="wa-te-bg" value="${curBg}" style="width:100%; height:32px; border:1px solid #2b3139; border-radius:4px; background:#111418; cursor:pointer; padding:0;">
          </div>
          <div style="flex:1;">
            <label style="display:block; font-size:11px; color:#848e9c; margin-bottom:4px;">Cỡ chữ</label>
            <input type="number" id="wa-te-size" value="${curSize}" style="width:100%; height:32px; border:1px solid #2b3139; border-radius:4px; background:#111418; color:#eaecef; padding:0 8px; box-sizing:border-box; outline:none;">
          </div>
        </div>

        <div style="margin-bottom:14px;">
           <label style="display:block; font-size:11px; color:#848e9c; margin-bottom:4px;">Font chữ</label>
           <select id="wa-te-font" style="width:100%; height:32px; border:1px solid #2b3139; border-radius:4px; background:#111418; color:#eaecef; padding:0 8px; outline:none; cursor:pointer;">
              <option value="Rajdhani, sans-serif" ${curFont.includes('Rajdhani')?'selected':''}>Rajdhani (Mặc định)</option>
              <option value="sans-serif" ${curFont==='sans-serif'?'selected':''}>Sans-serif</option>
              <option value="Arial" ${curFont==='Arial'?'selected':''}>Arial</option>
           </select>
        </div>

        <label style="display:block; font-size:11px; color:#848e9c; margin-bottom:4px;">Nội dung</label>
        <textarea id="wa-te-input" rows="3" style="width:100%;box-sizing:border-box;background:#111418;border:1px solid #2b3139;border-radius:6px;color:#eaecef;font-size:14px;font-family:inherit;padding:8px 10px;resize:vertical;outline:none;" placeholder="Nhập text..."></textarea>
        
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
          <button id="wa-te-cancel" style="background:transparent;border:1px solid #2b3139;color:#848e9c;padding:6px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;">Hủy</button>
          <button id="wa-te-confirm" style="background:#00F0FF;border:none;color:#000;padding:6px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:800;">Xác nhận</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    var textarea = document.getElementById('wa-te-input');
    textarea.value = currentText || '';
    requestAnimationFrame(function() { textarea.focus(); textarea.select(); });

    function confirm() { 
      var val = textarea.value; 
      var updatedStyles = JSON.parse(JSON.stringify(currentStyles || {}));
      if (!updatedStyles.text) updatedStyles.text = {};
      if (!updatedStyles.polygon) updatedStyles.polygon = {};

      updatedStyles.text.color = document.getElementById('wa-te-color').value;
      updatedStyles.text.size = parseInt(document.getElementById('wa-te-size').value) || 14;
      updatedStyles.text.family = document.getElementById('wa-te-font').value;
      updatedStyles.polygon.color = hexToRgba(document.getElementById('wa-te-bg').value, 0.8);
      
      backdrop.remove(); 
      onConfirm(val, updatedStyles); 
    }
    function cancel() { backdrop.remove(); }

    document.getElementById('wa-te-confirm').addEventListener('click', confirm);
    document.getElementById('wa-te-cancel').addEventListener('click', cancel);
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); confirm(); }
      if (e.key === 'Escape') cancel();
    });
  }

  var NON_EDITABLE_TOOLS = ['tableAnnotation'];
  var URL_TOOLS = ['insertImage'];

  function createTextOverlay(chart, toolId, initialData) {
    if (!chart) return null;
    var overlayId = null;
    var isEditable = NON_EDITABLE_TOOLS.indexOf(toolId) === -1;
    var isUrlTool = URL_TOOLS.indexOf(toolId) !== -1;

    function openEditor(currentText, currentStyles) {
      if (isUrlTool) {
        var result = window.prompt('Nhập URL hình ảnh:', currentText || '');
        if (result !== null && overlayId) chart.overrideOverlay({ id: overlayId, extendData: result });
        return;
      }
      openTextEditor(currentText, currentStyles, toolId, function(newText, newStyles) {
        if (overlayId) chart.overrideOverlay({ id: overlayId, extendData: newText, styles: newStyles });
      });
    }

    var config = {
      name: toolId, extendData: initialData || '',
      onDrawEnd: isEditable ? function(event) {
        if (!overlayId && event && event.overlay) overlayId = event.overlay.id;
        openEditor((event && event.overlay) ? event.overlay.extendData : '', (event && event.overlay) ? event.overlay.styles : {});
        return false;
      } : undefined,
      onDoubleClick: isEditable ? function(event) {
        if (!overlayId && event && event.overlay) overlayId = event.overlay.id;
        openEditor((event && event.overlay) ? event.overlay.extendData : '', (event && event.overlay) ? event.overlay.styles : {});
        return false;
      } : undefined
    };

    var id = chart.createOverlay(config);
    if (id) overlayId = id;
    return id;
  }

  // ==========================================
  // 4. EVENTS ENGINE (KEYBOARD, TOOLS)
  // ==========================================
  function bindCoreEvents(toolbar, panel) {
    const container = document.getElementById('sc-chart-container');
    
    let handle = toolbar.querySelector('.wa-drag-grip');
    let isDragging = false, startX, startY, initialX, initialY;
    
    if (handle) {
      handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initialX = toolbar.offsetLeft; initialY = toolbar.offsetTop;
        document.body.style.userSelect = 'none'; 
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let dx = e.clientX - startX; let dy = e.clientY - startY;
        toolbar.style.left = Math.max(0, initialX + dx) + 'px';
        toolbar.style.top = Math.max(0, initialY + dy) + 'px';
      });
      document.addEventListener('mouseup', () => { isDragging = false; document.body.style.userSelect = ''; });
      handle.addEventListener('dblclick', () => { toolbar.classList.toggle('collapsed'); });
    }

    function saveHistory() {} 

    toolbar.querySelector('#wa-btn-magnet').onclick = function() {
      isMagnetMode = !isMagnetMode; this.classList.toggle('active', isMagnetMode);
      showToast(isMagnetMode ? 'Đã bật chế độ Bắt điểm' : 'Đã tắt Bắt điểm');
    };
    
    toolbar.querySelector('#wa-btn-clear').onclick = function() {
      createConfirmModal('Bạn có chắc muốn xóa toàn bộ bản vẽ?', () => {
        if (global.tvChart) {
          global.tvChart.removeOverlay(); 
          global.tvChart.cancelDrawing(); 
          undoStack = []; redoStack = []; 
          hidePanel();
          
          toolbar.querySelectorAll('.wa-tb-btn').forEach(b => b.classList.remove('active'));
          toolbar.querySelector('[data-tool="pointer"]').classList.add('active');
          container.classList.remove('wa-drawing-mode');
          
          showToast('Đã xóa sạch bản vẽ');
        }
      });
    };

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

      const TEXT_TOOLS = ['plainText','anchoredText','note','priceNote','pin','tableAnnotation','annotation','comment','priceLabel','signpost','flagMarker','insertImage','insertIcon'];

      // ROUTE RIÊNG CHO TEXT & ANNOTATION (Chạy qua kiến trúc Modal mới)
      if (TEXT_TOOLS.includes(toolId)) {
        createTextOverlay(global.tvChart, toolId);
        return;
      }

      // ROUTE CHO CÁC CÔNG CỤ VẼ THÔNG THƯỜNG CÒN LẠI
      try {
        let tType = getToolCategory(toolId); let s = toolStyles[tType] || {};
        let config = { name: toolId, lock: false, styles: {} };
        
        if(tType === 'lines' || tType === 'waves') {
          config.styles.line = { color: s.lineColor || '#00F0FF', size: s.lineWidth || 1, style: s.lineStyle || 'solid' };
        } else if (tType === 'shapes') {
          config.styles.polygon = { style: 'stroke_fill', color: hexToRgba(s.fillColor, s.fillOpacity), borderColor: s.borderColor, borderSize: s.borderWidth };
        } else if (tType === 'fibo') {
          config.styles.line = { color: s.lineColor, size: 1 }; config.extendData = { showLabels: s.showLabels, fillOpacity: s.fillOpacity };
        } else if (tType === 'text') {
          // Khởi tạo dữ liệu mặc định để kích hoạt khả năng edit cho 13 công cụ Text
          if (toolId === 'insertIcon') config.extendData = '⭐';
          else if (toolId === 'insertImage') config.extendData = '';
          else config.extendData = toolStyles.text.textInput || 'Văn bản...';
          config.styles.text = { color: s.textColor || '#EAECEF', size: s.textSize || 14, weight: 'normal', family: 'sans-serif' };
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
        }
      });
    }
  }

  // ==========================================
  // 5. PROPS PANEL (WYSIWYG TÙY BIẾN CHO TỪNG LOẠI)
  // ==========================================
  function getToolCategory(name) {
    const shapes = ['rectangle', 'rotatedRectangle', 'circle', 'ellipse', 'triangle', 'parallelogram', 'gannBox', 'gannSquare', 'arrowUp', 'arrowDown', 'symmetricalTriangle', 'ascendingTriangle', 'descendingTriangle', 'risingWedge', 'fallingWedge', 'flagPattern', 'pennantPattern'];
    if (shapes.includes(name)) return 'shapes';
    
    if (name.startsWith('fibR') || name.startsWith('fibE') || name.startsWith('fibF') || name.startsWith('fibA') || name.startsWith('fibT') || name === 'gannFan') return 'fibo';
    const textTools = ['plainText', 'anchoredText', 'note', 'priceNote', 'pin', 'tableAnnotation', 'annotation', 'comment', 'priceLabel', 'signpost', 'flagMarker', 'insertImage', 'insertIcon', 'customText'];
    if (textTools.includes(name)) return 'text';
    if (name.startsWith('wave') || name.startsWith('elliott') || name.includes('abcd') || name.includes('HeadAndShoulders') || name.includes('Top') || name.includes('Bottom') || name === 'threeDrives') return 'waves';
    
    return 'lines'; 
  }

  function renderPanel(overlay) {
    const panel = document.getElementById('wa-props-panel');
    if(!panel || !overlay) return;
    
    const cat = getToolCategory(overlay.name); const body = panel.querySelector('.wa-panel-body');
    let html = ''; let s = overlay.styles || {}; let ext = overlay.extendData || {};

    if (cat === 'text') {
      let txt = typeof ext === 'string' ? ext : (ext.text || '');
      if (!txt && overlay.name !== 'insertImage' && overlay.name !== 'insertIcon') txt = 'Văn bản...';
      let c = (s.text && s.text.color) ? colorToHex(s.text.color) : toolStyles.text.textColor;
      let sz = (s.text && s.text.size) ? s.text.size : toolStyles.text.textSize;

      if (overlay.name === 'insertIcon') {
         html += `
         <style>
           .wa-icon-picker { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; background: #0B0E11; border: 1px solid #2b3139; border-radius: 4px; max-height: 120px; overflow-y: auto; }
           .wa-icon-picker::-webkit-scrollbar { width: 4px; } .wa-icon-picker::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 4px; }
           .wa-emo { cursor: pointer; font-size: 20px; transition: transform 0.1s; user-select: none; } .wa-emo:hover { transform: scale(1.3); }
         </style>
         <div class="wa-control-row"><label>Click để chọn Icon mới:</label>
           <div class="wa-icon-picker">
             ${['⭐','🔥','🚀','💎','🐂','🐻','📌','⚡','✅','❌','💰','📈','📉','🔔','💡','🎯','🏆','⚠️','💀','👽'].map(e=>`<span class="wa-emo">${e}</span>`).join('')}
           </div>
           <input type="hidden" id="wa-prop-txt" value="${txt}">
         </div>`;
      } else if (overlay.name === 'insertImage') {
         html += `
         <div class="wa-control-row"><label>Đường dẫn ảnh trực tuyến (URL):</label>
           <input type="text" id="wa-prop-txt" class="wa-input" placeholder="https://..." value="${txt}">
           <div style="font-size:11px;color:#848E9C;margin-top:4px;">Dán link ảnh (.png, .jpg) vào ô trên. Nhấn ra ngoài hoặc Enter để ảnh hiện lên chart.</div>
         </div>`;
      } else {
         html += `
         <div class="wa-control-row"><label>Nội dung ghi chú:</label>
           <textarea id="wa-prop-txt" class="wa-input wa-textarea">${txt}</textarea>
         </div>`;
      }
      
      if (overlay.name !== 'insertImage') {
        html += `
        <div style="display:flex; gap:8px; margin-top:8px;">
          <div class="wa-control-row" style="flex:1"><label>Màu sắc</label><input type="color" id="wa-prop-c1" class="wa-color-picker" value="${c}"></div>
          <div class="wa-control-row" style="flex:1"><label>Kích cỡ</label><select id="wa-prop-s1" class="wa-select">
            <option value="12" ${sz==12?'selected':''}>12px</option><option value="16" ${sz==16?'selected':''}>16px</option>
            <option value="20" ${sz==20?'selected':''}>20px</option><option value="24" ${sz==24?'selected':''}>24px</option>
            <option value="32" ${sz==32?'selected':''}>32px</option><option value="48" ${sz==48?'selected':''}>48px</option>
          </select></div>
        </div>`;
      }
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
body.innerHTML = html;
    panel.classList.add('show');

    // Bắt sự kiện click cho Emoji Picker
    body.querySelectorAll('.wa-emo').forEach(el => {
       el.onclick = function() {
          document.getElementById('wa-prop-txt').value = this.innerText;
          updateEngine(); // Tự động load lên chart
       };
    });
    body.innerHTML = html;
    panel.classList.add('show');

    // Bắt sự kiện click cho Bảng Emoji
    body.querySelectorAll('.wa-emo').forEach(el => {
       el.onclick = function() {
          document.getElementById('wa-prop-txt').value = this.innerText;
          updateEngine(); // Click Icon là tự đổi trên chart luôn
       };
    });
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