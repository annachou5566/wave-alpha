// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — PRO DRAWING ENGINE 2026 (MASTERPIECE EDITION)
// Tech: Vanilla JS, KLineChart v9 API
// Tối ưu UI/UX mượt mà, Fix Hover Trap, Fix Realtime Text, Zero-Allocation
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
  const MAX_HISTORY = 50;
  let lastClickTime = 0;
  let isDrawingSessionActive = false;
  let _fbX = 0, _fbY = 0;
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
    lines: { lineColor: '#3B82F6', lineWidth: 1, lineStyle: 'solid', lineOpacity: 1 },
    shapes: { borderColor: '#3B82F6', borderWidth: 1, borderStyle: 'solid', borderOpacity: 1, fillColor: '#3B82F6', fillOpacity: 0.15 }, 
    fibo: { lineColor: '#E8EDF2', lineStyle: 'solid', lineOpacity: 1, showLabels: true, fillOpacity: 0.15 },
    text: { textColor: '#E8EDF2', textSize: 14, textInput: 'Văn bản...' },
    waves: { lineColor: '#3B82F6', lineWidth: 1, lineStyle: 'solid', lineOpacity: 1, textColor: '#E8EDF2', textSize: 12 }
  };
  
  // BỔ SUNG BẢNG MÀU CHUẨN (Fix triệt để lỗi giật lag khi render Panel)
  const WA_SWATCHES = [
    '#E8EDF2', '#8896A7', '#4A5568', '#1C242E',
    '#22C55E', '#16A34A', '#86EFAC', '#052E16',
    '#EF4444', '#B91C1C', '#FCA5A5', '#450A0A',
    '#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4'
  ];

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
    if (!color) return '#3B82F6'; // Cập nhật màu fallback
    if (color.startsWith('#')) return color.substring(0, 7);
    let match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) return `#${parseInt(match[1]).toString(16).padStart(2,'0')}${parseInt(match[2]).toString(16).padStart(2,'0')}${parseInt(match[3]).toString(16).padStart(2,'0')}`;
    return '#3B82F6'; // Cập nhật màu fallback
  }

  // ==========================================
  // 2. KLINECHART EXTENSIONS (CÔNG CỤ VẼ)
  // ==========================================
  function registerProExtensions() {
    var kc = global.klinecharts;
    if (!kc || kc.__wa_extensions_registered) return;
    kc.__wa_extensions_registered = true;

    // [TỐI ƯU HÓA SIÊU MƯỢT] Hàm tính toán tia Zero-Allocation (Không dùng Mảng)
    // Giúp loại bỏ hoàn toàn lag giật khi vẽ Pitchfork, Elliott, Mô hình giá
    function fastRayEnd(p, dx, dy, W, H) {
        var t = Infinity;
        if (dx > 0.001) { var v = (W - p.x) / dx; if (v >= 0 && v < t) t = v; }
        if (dx < -0.001) { var v = (0 - p.x) / dx; if (v >= 0 && v < t) t = v; }
        if (dy > 0.001) { var v = (H - p.y) / dy; if (v >= 0 && v < t) t = v; }
        if (dy < -0.001) { var v = (0 - p.y) / dy; if (v >= 0 && v < t) t = v; }
        return t === Infinity ? { x: p.x, y: p.y } : { x: p.x + dx * t, y: p.y + dy * t };
    }

    function fastBidirLine(A, B, W, H) {
        var dx = B.x - A.x, dy = B.y - A.y;
        return [fastRayEnd(A, -dx, -dy, W, H), fastRayEnd(A, dx, dy, W, H)];
    }

    function getDistance(c1, c2) { return Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2)); }
    
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
          if (Math.abs(dx) < 0.001) { pts = [{ x: c0.x, y: 0 }, { x: c0.x, y: H }]; } 
          else if (Math.abs(dy) < 0.001) { pts = [{ x: 0, y: c0.y }, { x: W, y: c0.y }]; } 
          else {
            var m = dy / dx, bi = c0.y - m * c0.x;
            [{ x: 0, y: bi }, { x: W, y: m * W + bi }, { x: -bi / m, y: 0 }, { x: (H - bi) / m, y: H }].forEach(function(p) {
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
          var canvasRad = Math.atan2(dy, dx);
          var chartDeg  = (Math.atan2(-dy, dx) * 180 / Math.PI).toFixed(1);
          var r = 22, startA = Math.min(0, canvasRad), endA = Math.max(0, canvasRad);
          figs.push({ type: 'arc', attrs: { x: c0.x, y: c0.y, r: r, startAngle: startA, endAngle: endA }, ignoreEvent: true });
          var midA = (startA + endA) / 2;
          var sign = parseFloat(chartDeg) >= 0 ? '+' : '';
          figs.push({ type: 'text', attrs: { x: c0.x + (r + 12) * Math.cos(midA), y: c0.y + (r + 12) * Math.sin(midA), text: sign + chartDeg + '°', align: 'center', baseline: 'middle' }, ignoreEvent: true });
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
            figs.push({ type: 'text', attrs: { x: (c[0].x + c[1].x) / 2, y: Math.min(c[0].y, c[1].y) - 10, text: sign + delta.toFixed(dp) + '  (' + sign + pct + '%)', align: 'center', baseline: 'bottom' }, ignoreEvent: true });
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
          return [ { type: 'line', attrs: { coordinates: [{ x: 0, y: p.y }, { x: W, y: p.y }] } }, { type: 'line', attrs: { coordinates: [{ x: p.x, y: 0 }, { x: p.x, y: H }] } } ];
        }
      },
      {
        name: 'curvedLine', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [];
          if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var pts = [], N = 40;
          for (var i = 0; i <= N; i++) {
            var t = i / N, mt = 1 - t;
            pts.push({ x: mt * mt * c[0].x + 2 * mt * t * c[1].x + t * t * c[2].x, y: mt * mt * c[0].y + 2 * mt * t * c[1].y + t * t * c[2].y });
          }
          return [{ type: 'line', attrs: { coordinates: pts } }];
        }
      },
      
      // --- BATCH 2: PITCHFORK FAMILY ---
      {
        name: 'andrewsPitchfork', totalStep: 4,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding, figs = [];
          if (c.length < 2) return figs;
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          var W = b.width, H = b.height, P0 = c[0], P1 = c[1], P2 = c[2];
          var M = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
          var dx = M.x - P0.x, dy = M.y - P0.y;
          
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] } });            
          figs.push({ type: 'line', attrs: { coordinates: [P0, M] } });            
          figs.push({ type: 'line', attrs: { coordinates: [P0, fastRayEnd(P0, dx, dy, W, H)] } });   
          figs.push({ type: 'line', attrs: { coordinates: [P1, fastRayEnd(P1, dx, dy, W, H)] } });   
          figs.push({ type: 'line', attrs: { coordinates: [P2, fastRayEnd(P2, dx, dy, W, H)] } });   
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
          var W = b.width, H = b.height, P0 = c[0], P1 = c[1], P2 = c[2];
          var M  = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
          var HS = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
          var dx = M.x - HS.x, dy = M.y - HS.y;
          
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] } });
          figs.push({ type: 'line', attrs: { coordinates: [HS, M] } });
          figs.push({ type: 'line', attrs: { coordinates: [HS, fastRayEnd(HS, dx, dy, W, H)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P1, fastRayEnd(P1, dx, dy, W, H)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P2, fastRayEnd(P2, dx, dy, W, H)] } });
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
          var W = b.width, H = b.height, P0 = c[0], P1 = c[1], P2 = c[2];
          var M  = { x: (P1.x + P2.x) / 2, y: (P1.y + P2.y) / 2 };
          var HM = { x: P0.x, y: (P0.y + P1.y) / 2 };
          var dx = M.x - HM.x, dy = M.y - HM.y;
          
          figs.push({ type: 'line', attrs: { coordinates: [P1, P2] } });
          figs.push({ type: 'line', attrs: { coordinates: [HM, M] } });
          figs.push({ type: 'line', attrs: { coordinates: [HM, fastRayEnd(HM, dx, dy, W, H)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P1, fastRayEnd(P1, dx, dy, W, H)] } });
          figs.push({ type: 'line', attrs: { coordinates: [P2, fastRayEnd(P2, dx, dy, W, H)] } });
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
          var W = b.width, H = b.height, P0 = c[0], P1 = c[1], P2 = c[2];
          var IP1 = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 };
          var IP2 = { x: (P0.x + P2.x) / 2, y: (P0.y + P2.y) / 2 };
          var MI  = { x: (IP1.x + IP2.x) / 2, y: (IP1.y + IP2.y) / 2 };
          var dx = MI.x - P0.x, dy = MI.y - P0.y;
          
          figs.push({ type: 'line', attrs: { coordinates: [IP1, IP2] } });          
          figs.push({ type: 'line', attrs: { coordinates: [P0, MI] } });            
          figs.push({ type: 'line', attrs: { coordinates: [P0, fastRayEnd(P0, dx, dy, W, H)] } });   
          figs.push({ type: 'line', attrs: { coordinates: [IP1, fastRayEnd(IP1, dx, dy, W, H)] } });  
          figs.push({ type: 'line', attrs: { coordinates: [IP2, fastRayEnd(IP2, dx, dy, W, H)] } });  
          return figs;
        }
      },

      // --- BATCH 6: ELLIOTT WAVE FAMILY ---
      {
        name: 'elliottImpulse', totalStep: 7,
        needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding;
          if (c.length < 2) return [];
          var W = b.width, H = b.height, LABELS = ['(0)', '①', '②', '③', '④', '⑤'], figs = [];

          for (var i = 0; i < c.length - 1; i++) figs.push({ type: 'line', attrs: { coordinates: [c[i], c[i + 1]] } });

          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var p = c[j], pPrev = j > 0 ? c[j - 1] : c[Math.min(j + 1, c.length - 1)], pNext = j < c.length - 1 ? c[j + 1] : c[Math.max(j - 1, 0)];
            var above = p.y <= (pPrev.y + pNext.y) / 2;
            figs.push({ type: 'text', attrs: { x: p.x, y: above ? p.y - 10 : p.y + 10, text: LABELS[j], align: 'center', baseline: above ? 'bottom' : 'top' }, ignoreEvent: true });
          }

          if (c.length >= 3) {
            var dx02 = c[2].x - c[0].x, dy02 = c[2].y - c[0].y;
            figs.push({ type: 'line', attrs: { coordinates: [c[0], fastRayEnd(c[0], dx02, dy02, W, H)] }, styles: { style: 'dashed' } });
            figs.push({ type: 'line', attrs: { coordinates: [c[1], fastRayEnd(c[1], dx02, dy02, W, H)] }, styles: { style: 'dashed' } });
          }
          if (c.length >= 5) {
            var dx24 = c[4].x - c[2].x, dy24 = c[4].y - c[2].y;
            figs.push({ type: 'line', attrs: { coordinates: [c[2], fastRayEnd(c[2], dx24, dy24, W, H)] }, styles: { style: 'dashed' } });
            figs.push({ type: 'line', attrs: { coordinates: [c[3], fastRayEnd(c[3], dx24, dy24, W, H)] }, styles: { style: 'dashed' } });
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

      // --- BATCH 5: SHAPES & ARROWS ---
      {
        name: 'highlighter', totalStep: Number.MAX_SAFE_INTEGER,
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
          var pts = smooth(c, 4); var a = pts[0], z = pts[pts.length - 1];
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
          return [{ type: 'line', attrs: { coordinates: smooth(c, 5) } }];
        }
      },
      {
        name: 'circle', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var ctr = c[0], p = c[1];
          var r = Math.sqrt(Math.pow(p.x - ctr.x, 2) + Math.pow(p.y - ctr.y, 2)); if (r < 2) return [];
          var pts = [], N = 48;
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

      // --- BATCH 3: FIBONACCI FAMILY ---
      {
        name: 'fibRetracement', totalStep: 3,
        needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], ov = ref.overlay, prec = ref.precision;
          var pts = ov?.points;
          if (c.length < 2 || !pts || pts.length < 2) return [];
          var P0 = c[0], P1 = c[1];
          var vDif = (pts[1].value || 0) - (pts[0].value || 0);
          var yDif = P1.y - P0.y;
          var LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
          var rainbow = ['rgba(242,54,69,0.15)', 'rgba(255,152,0,0.15)', 'rgba(255,235,59,0.15)', 'rgba(76,175,80,0.15)', 'rgba(0,188,212,0.15)', 'rgba(41,98,255,0.15)'];
          var polygons = [], lines = [], texts = [];
          let ext = ov.extendData || {}; let alpha = ext.fillOpacity !== undefined ? ext.fillOpacity : 0.15;
          let prevY = null; var endX = P1.x;

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
          var c = ref.coordinates || [], ov = ref.overlay, prec = ref.precision;
          var pts = ov?.points;
          if (c.length < 2) return [];
          if (c.length === 2) return [{ type: 'line', attrs: { coordinates: [c[0], c[1]] } }];
          if (!pts || pts.length < 3) return [];
          var P0 = c[0], P1 = c[1], P2 = c[2];
          var swingY = P1.y - P0.y, swingV = (pts[1].value || 0) - (pts[0].value || 0);
          var endX = P2.x; 
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
            var end = fastRayEnd(P0, dx, dy, W, H);
            
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
      // --- BATCH 4: GANN FAMILY ---
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
            var end = fastRayEnd(P0, dx, dy, W, H);
            
            figs.push({ type: 'line', attrs: { coordinates: [P0, end] } });
            figs.push({ type: 'text', attrs: { x: end.x + (signX > 0 ? -4 : 4), y: end.y + (signY > 0 ? -4 : 4), text: r[2], align: signX > 0 ? 'right' : 'left', baseline: signY > 0 ? 'bottom' : 'top' }, ignoreEvent: true });
            
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
          var c = ref.coordinates || [];
          if (c.length < 2) return [];
          var x0 = Math.min(c[0].x, c[1].x), x1 = Math.max(c[0].x, c[1].x);
          var y0 = Math.min(c[0].y, c[1].y), y1 = Math.max(c[0].y, c[1].y);
          if ((x1 - x0) < 2 || (y1 - y0) < 2) return [];
          var figs = [];
          
          figs.push({ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{x:x0, y:y0}, {x:x1, y:y0}, {x:x1, y:y1}, {x:x0, y:y1}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:x0, y:y0}, {x:x1, y:y0}, {x:x1, y:y1}, {x:x0, y:y1}, {x:x0, y:y0}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:x0, y:y0}, {x:x1, y:y1}] } });
          figs.push({ type: 'line', attrs: { coordinates: [{x:x1, y:y0}, {x:x0, y:y1}] } });

          for (var i = 1; i <= 7; i++) {
            var hy = y0 + (i / 8) * (y1 - y0), vx = x0 + (i / 8) * (x1 - x0);
            var isMid = (i === 4); 
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

          var RATIOS = [[1, 8], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [8, 1]];
          RATIOS.forEach(function(r) {
            var end = fastRayEnd(P0, signX * r[0] * size, signY * r[1] * size, W, H);
            figs.push({ type: 'line', attrs: { coordinates: [P0, end] }, styles: { style: 'dashed' } });
          });
          return figs;
        }
      },
      { name: 'abcd', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { let acLineCoordinates = [], bdLineCoordinates = []; const tags = ['A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` })); if (coordinates.length > 2) { acLineCoordinates = [coordinates[0], coordinates[2]]; if (coordinates.length > 3) bdLineCoordinates = [coordinates[1], coordinates[3]]; } return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: [{ coordinates: acLineCoordinates }, { coordinates: bdLineCoordinates }], styles: { style: 'dashed' } }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      { name: 'xabcd', totalStep: 6, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, createPointFigures: function({ coordinates }) { const dashedLines = [], polygons = []; const tags = ['X', 'A', 'B', 'C', 'D']; const texts = coordinates.map((coordinate, i) => ({ ...coordinate, baseline: 'bottom', text: `(${tags[i]})` })); if (coordinates.length > 2) { dashedLines.push({ coordinates: [coordinates[0], coordinates[2]] }); polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] }); if (coordinates.length > 3) { dashedLines.push({ coordinates: [coordinates[1], coordinates[3]] }); if (coordinates.length > 4) { dashedLines.push({ coordinates: [coordinates[2], coordinates[4]] }); polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] }); } } } return [{ type: 'line', attrs: { coordinates } }, { type: 'line', attrs: dashedLines, styles: { style: 'dashed' } }, { type: 'polygon', ignoreEvent: true, attrs: polygons }, { type: 'text', ignoreEvent: true, attrs: texts }]; } },
      
      // --- BATCH 7: CHART PATTERNS ---
      {
        name: 'headAndShoulders', totalStep: 8, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, LABELS = ['', 'LS', '', 'Head', '', 'RS', ''];
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = fastBidirLine(c[2], c[4], W, H);
            figs.push({ type:'line', attrs:{ coordinates:nl }, styles: { style: 'dashed' } });
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
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = fastBidirLine(c[2], c[4], W, H);
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
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = fastBidirLine(c[2], c[4], W, H);
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
          var figs = [];
          for (var i = 0; i < c.length-1; i++) figs.push({ type:'line', attrs:{ coordinates:[c[i],c[i+1]] } });
          for (var j = 0; j < c.length; j++) {
            if (!LABELS[j]) continue;
            var pp = j>0?c[j-1]:c[Math.min(j+1,c.length-1)], pn = j<c.length-1?c[j+1]:c[Math.max(j-1,0)];
            var above = c[j].y <= (pp.y+pn.y)/2;
            figs.push({ type:'text', attrs:{ x:c[j].x, y:above?c[j].y-10:c[j].y+10, text:LABELS[j], align:'center', baseline:above?'bottom':'top' }, ignoreEvent:true });
          }
          if (c.length >= 5) {
            var nl = fastBidirLine(c[2], c[4], W, H);
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
          var figs = [];
          if(c.length === 4) { figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } }); }
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[0], c[2], W, H)}, styles: { style: 'dashed' } });
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[1], c[3], W, H)}, styles: { style: 'dashed' } });
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'ascendingTriangle', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = 'Asc △';
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[0], c[2], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[1], c[3], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'descendingTriangle', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = 'Desc △';
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[0], c[2], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[1], c[3], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'risingWedge', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = '↑ Wedge';
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[0], c[2], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[1], c[3], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'fallingWedge', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || [], b = ref.bounding; if (c.length < 2) return [];
          var W = b.width, H = b.height, PATTERN_NAME = '↓ Wedge';
          var figs = [];
          if(c.length === 4) figs.push({ type: 'polygon', attrs: { coordinates: c }, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.08)' } });
          for(var i=0;i<c.length-1;i++) figs.push({type:'line',attrs:{coordinates:[c[i],c[i+1]]}});
          if(c.length>=3) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[0], c[2], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=4) figs.push({type:'line',attrs:{coordinates:fastBidirLine(c[1], c[3], W, H)}, styles: { style: 'dashed' }});
          if(c.length>=2){ var cx=(c[0].x+c[c.length-1].x)/2, cy=(c[0].y+c[c.length-1].y)/2; figs.push({type:'text',attrs:{x:cx,y:cy,text:PATTERN_NAME,align:'center',baseline:'middle'},ignoreEvent:true}); }
          return figs;
        }
      },
      {
        name: 'flagPattern', totalStep: 5, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
        createPointFigures: function(ref) {
          var c = ref.coordinates || []; if (c.length < 2) return [];
          var figs = [];
          figs.push({ type:'line', attrs:{ coordinates:[c[0],c[1]] } }); 
          if (c.length < 4) {
            if (c.length >= 3) figs.push({ type:'line', attrs:{ coordinates:[c[1],c[2]] } });
            return figs;
          }
          var P1 = c[1], P2 = c[2], P3 = c[3];
          var P4 = { x: P1.x + P3.x - P2.x, y: P1.y + P3.y - P2.y };
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
          figs.push({ type:'line', attrs:{ coordinates:[c[0],c[1]] } }); 
          if (c.length < 4) {
            if (c.length >= 3) figs.push({ type:'line', attrs:{ coordinates:[c[1],c[2]] } });
            return figs;
          }
          var P1 = c[1], P2 = c[2], P3 = c[3];
          figs.push({ type:'polygon', attrs:{ coordinates:[P1, fastRayEnd(P1, P2.x-P1.x, P2.y-P1.y, W, H), fastRayEnd(P1, P3.x-P1.x, P3.y-P1.y, W, H)] }, styles: { style: 'stroke_fill', color: 'rgba(0, 240, 255, 0.08)' } });
          var cx=(P1.x+P2.x+P3.x)/3, cy=(P1.y+P2.y+P3.y)/3;
          figs.push({ type:'text', attrs:{ x:cx, y:cy, text:'Pennant', align:'center', baseline:'middle' }, ignoreEvent:true });
          return figs;
        }
      },

      // --- BATCH 8: Text Annotation Tools (HỖ TRỢ MULTILINE TỰ ĐỘNG CĂN DÒNG) ---
      { 
        name: 'plainText', totalStep: 2, needDefaultPointFigure: true, 
        styles: { text: { color: '#EAECEF', style: 'normal' }, polygon: { color: 'transparent', borderColor: 'transparent', borderSize: 0 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || '...'; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)];
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var bgC = (pS.color && pS.color !== 'transparent') ? pS.color : 'transparent'; 
            var lh = (tS.size || 14) + 6;
            var figs = [];
            lines.forEach(function(l, i) {
                figs.push({ type: 'text', attrs: { x: c[0].x, y: c[0].y + i * lh, text: l, align: 'left', baseline: 'top' }, styles: {
                  color:           tS.color  || '#EAECEF',
                  size:            tS.size   || 14,
                  family:          tS.family || 'Be Vietnam Pro, sans-serif',
                  weight:          tS.weight || '600',
                  style:           tS.style  || 'normal',   // ← THÊM DÒNG NÀY
                  backgroundColor: bgC,
                  borderColor:     pS.borderColor || 'transparent',
                  borderSize:      pS.borderSize || 0
                } });
            });
            return figs; 
        } 
      },
      { 
        name: 'anchoredText', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, 
        styles: { text: { color: '#00F0FF', style: 'normal' }, polygon: { color: 'transparent', borderColor: 'transparent', borderSize: 0 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || '...'; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)];
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var bgC = (pS.color && pS.color !== 'transparent') ? pS.color : 'transparent'; 
            var figs = []; 
            var lh = (tS.size || 14) + 6;
            if (c.length >= 2) { figs.push({ type: 'line', attrs: { coordinates: [c[0], c[1]] }, styles: { color: 'rgba(0,240,255,0.4)', size: 1, style: 'dashed' } }); } 
            var tx = c.length >= 2 ? c[1].x : c[0].x; var ty = c.length >= 2 ? c[1].y : c[0].y; 
            lines.forEach(function(l, i) {
                figs.push({ type: 'text', attrs: { x: tx, y: ty + i * lh, text: l, align: 'left', baseline: 'top' }, styles: { color: tS.color || '#00F0FF', size: tS.size || 13, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '700', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
            });
            return figs; 
        } 
      },
      { 
        name: 'note', totalStep: 2, needDefaultPointFigure: true, 
        styles: { text: { color: '#EAECEF', style: 'normal' }, polygon: { color: 'rgba(240,185,11,0.15)', borderColor: '#F0B90B', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || '...'; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)];
            var x = c[0].x, y = c[0].y; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6, pd = 10; 
            var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); 
            var bw = Math.max(60, maxLen * ((tS.size||12) * 0.6) + pd * 2); 
            var bh = lines.length * lh + pd * 2; 
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            var figs = [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y }, { x: x + bw, y: y }, { x: x + bw, y: y + bh }, { x: x, y: y + bh } ]}, styles: { style: 'fill', color: pS.color || 'rgba(240,185,11,0.15)', borderColor: pS.borderColor || '#F0B90B', borderSize: 1 }, ignoreEvent: true } ];
            lines.forEach(function(l, i) {
                figs.push({ type: 'text', attrs: { x: x + pd, y: y + pd + i * lh, text: l, align: 'left', baseline: 'top' }, styles: {
                  color:           tS.color  || '#EAECEF',
                  size:            tS.size   || 14,
                  family:          tS.family || 'Be Vietnam Pro, sans-serif',
                  weight:          tS.weight || '600',
                  style:           tS.style  || 'normal',   // ← THÊM DÒNG NÀY
                  backgroundColor: bgC,
                  borderColor:     pS.borderColor || 'transparent',
                  borderSize:      pS.borderSize || 0
                } });
            });
            return figs; 
        } 
      },
      { 
        name: 'priceNote', totalStep: 2, needDefaultPointFigure: true, needDefaultYAxisFigure: true, 
        styles: { text: { color: '#0ECB81', style: 'normal' }, polygon: { color: 'rgba(14,203,129,0.2)', borderColor: '#0ECB81', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var pts = (ref.overlay && ref.overlay.points) ? ref.overlay.points : []; 
            var priceVal = (pts[0] && pts[0].value != null) ? pts[0].value : null; var dp = (ref.precision && ref.precision.price != null) ? ref.precision.price : 4; 
            var custom = ref.overlay.extendData || ''; var priceStr = priceVal != null ? priceVal.toFixed(dp) : ''; 
            var label = custom ? (priceStr ? priceStr + '  ' + custom : custom) : (priceStr || '...'); 
            var lines = typeof label === 'string' ? label.split('\n') : [String(label)]; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var x = c[0].x, y = c[0].y; 
            var lh = (tS.size || 12) + 6;
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); 
            var bw = maxLen * ((tS.size||12) * 0.6) + 20, bh = lines.length * lh + 10; 
            var figs = [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - bh / 2 }, { x: x + bw, y: y - bh / 2 }, { x: x + bw, y: y + bh / 2 }, { x: x, y: y + bh / 2 } ]}, styles: { style: 'fill', color: pS.color || 'rgba(14,203,129,0.2)', borderColor: pS.borderColor || '#0ECB81', borderSize: 1 }, ignoreEvent: true } ];
            lines.forEach(function(l, i) {
                var lineY = y - (lines.length - 1) * lh / 2 + i * lh;
                figs.push({ type: 'text', attrs: { x: x + 8, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#0ECB81', size: tS.size || 12, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '700', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
            });
            return figs; 
        } 
      },
      { 
        name: 'pin', totalStep: 2, 
        styles: { text: { color: '#EAECEF', style: 'normal' }, polygon: { color: '#F0B90B', borderColor: '#fff', borderSize: 1.5 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || ''; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)];
            var x = c[0].x, y = c[0].y, r = 10; var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6;
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            var figs = [ { type: 'circle', attrs: { x: x, y: y - r - 10, r: r }, styles: { style: 'fill', color: pS.color || '#F0B90B', borderColor: pS.borderColor || '#fff', borderSize: 1.5 } }, { type: 'line', attrs: { coordinates: [{ x: x, y: y - 10 }, { x: x, y: y }] }, styles: { color: pS.color || '#F0B90B', size: 2 } } ]; 
            if (txt) { 
                lines.forEach(function(l, i) {
                    var lineY = (y - r - 10) - (lines.length - 1) * lh / 2 + i * lh;
                    figs.push({ type: 'text', attrs: { x: x + r + 4, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: {
                      color:           tS.color  || '#EAECEF',
                      size:            tS.size   || 14,
                      family:          tS.family || 'Be Vietnam Pro, sans-serif',
                      weight:          tS.weight || '600',
                      style:           tS.style  || 'normal',   // ← THÊM DÒNG NÀY
                      backgroundColor: bgC,
                      borderColor:     pS.borderColor || 'transparent',
                      borderSize:      pS.borderSize || 0
                    } }); 
                });
            } 
            return figs; 
        } 
      },
      { 
        name: 'annotation', totalStep: 3, needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true, 
        styles: { text: { color: '#00F0FF', style: 'normal' }, polygon: { color: 'rgba(0,240,255,0.1)', borderColor: '#00F0FF', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || '...'; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)]; 
            var figs = []; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6;
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            if (c.length >= 2) { 
                figs.push({ type: 'line', attrs: { coordinates: [c[0], c[1]] }, styles: { color: pS.borderColor || '#00F0FF', size: 1 } }); 
                var tx = c[1].x, ty = c[1].y; 
                var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); 
                var bw = maxLen * ((tS.size||12) * 0.6) + 16, bh = lines.length * lh + 10; 
                figs.push({ type: 'polygon', attrs: { coordinates: [ { x: tx, y: ty - bh / 2 }, { x: tx + bw, y: ty - bh / 2 }, { x: tx + bw, y: ty + bh / 2 }, { x: tx, y: ty + bh / 2 } ]}, styles: { style: 'stroke_fill', color: pS.color || 'rgba(0,240,255,0.1)', borderColor: pS.borderColor || '#00F0FF', borderSize: 1 }, ignoreEvent: true }); 
                lines.forEach(function(l, i) {
                    var lineY = ty - (lines.length - 1) * lh / 2 + i * lh;
                    figs.push({ type: 'text', attrs: { x: tx + 8, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#00F0FF', size: tS.size || 12, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '600', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
                });
            } else { 
                lines.forEach(function(l, i) {
                    var lineY = c[0].y - (lines.length - 1) * lh / 2 + i * lh;
                    figs.push({ type: 'text', attrs: { x: c[0].x + 8, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#00F0FF', size: tS.size || 12, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '600', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
                });
            } 
            return figs; 
        } 
      },
      { 
        name: 'comment', totalStep: 2, 
        styles: { text: { color: '#EAECEF', style: 'normal' }, polygon: { color: 'rgba(30,35,42,0.95)', borderColor: '#474d57', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || '...'; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)]; 
            var x = c[0].x, y = c[0].y; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6;
            var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); 
            var bw = Math.max(80, maxLen * ((tS.size||12) * 0.6) + 20), bh = lines.length * lh + 14, tail = 8; 
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            var figs = [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - bh - tail }, { x: x + bw, y: y - bh - tail }, { x: x + bw, y: y - tail }, { x: x + 18, y: y - tail }, { x: x + 10, y: y }, { x: x + 6, y: y - tail }, { x: x, y: y - tail } ]}, styles: { style: 'stroke_fill', color: pS.color || 'rgba(30,35,42,0.95)', borderColor: pS.borderColor || '#474d57', borderSize: 1 }, ignoreEvent: true } ];
            lines.forEach(function(l, i) {
                var lineY = y - bh / 2 - tail - (lines.length - 1) * lh / 2 + i * lh;
                figs.push({ type: 'text', attrs: { x: x + 10, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: {
                  color:           tS.color  || '#EAECEF',
                  size:            tS.size   || 14,
                  family:          tS.family || 'Be Vietnam Pro, sans-serif',
                  weight:          tS.weight || '600',
                  style:           tS.style  || 'normal',   // ← THÊM DÒNG NÀY
                  backgroundColor: bgC,
                  borderColor:     pS.borderColor || 'transparent',
                  borderSize:      pS.borderSize || 0
                } });
            });
            return figs; 
        } 
      },
      { 
        name: 'priceLabel', totalStep: 2, needDefaultYAxisFigure: true, 
        styles: { text: { color: '#fff', style: 'normal' }, polygon: { color: '#F6465D', borderColor: '#F6465D', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var pts = (ref.overlay && ref.overlay.points) ? ref.overlay.points : []; 
            var priceVal = (pts[0] && pts[0].value != null) ? pts[0].value : null; var dp = (ref.precision && ref.precision.price != null) ? ref.precision.price : 4; 
            var custom = ref.overlay.extendData || ''; var priceStr = priceVal != null ? priceVal.toFixed(dp) : ''; 
            var label = custom ? (priceStr ? priceStr + '  ' + custom : custom) : (priceStr || '...'); 
            var lines = typeof label === 'string' ? label.split('\n') : [String(label)]; 
            var x = c[0].x, y = c[0].y; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6;
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); 
            var bw = maxLen * ((tS.size||12) * 0.6) + 16, bh = lines.length * lh + 10; var arr = 6; 
            var figs = [ { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - bh / 2 }, { x: x + arr, y: y - bh / 2 }, { x: x + arr + bw, y: y - bh / 2 }, { x: x + arr + bw, y: y + bh / 2 }, { x: x + arr, y: y + bh / 2 } ]}, styles: { style: 'fill', color: pS.color || '#F6465D' }, ignoreEvent: true } ];
            lines.forEach(function(l, i) {
                var lineY = y - (lines.length - 1) * lh / 2 + i * lh;
                figs.push({ type: 'text', attrs: { x: x + arr + 6, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#fff', size: tS.size || 11, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '700', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
            });
            return figs; 
        } 
      },
      { 
        name: 'signpost', totalStep: 3, needDefaultPointFigure: true, 
        styles: { text: { color: '#d0aaff', style: 'normal' }, polygon: { color: 'rgba(153,69,255,0.25)', borderColor: '#9945FF', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || '...'; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)]; 
            var tx = c.length >= 2 ? c[1].x : c[0].x; var ty = c.length >= 2 ? c[1].y : c[0].y - 40; 
            var figs = []; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6;
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            if (c.length >= 2) { figs.push({ type: 'line', attrs: { coordinates: [c[0], { x: tx, y: ty }] }, styles: { color: pS.borderColor || '#848e9c', size: 1, style: 'dashed' } }); } 
            var maxLen = lines.reduce(function(m, l) { return Math.max(m, l.length); }, 1); 
            var bw = maxLen * ((tS.size||12) * 0.6) + 24, bh = lines.length * lh + 10, notch = 10; 
            var isRight = tx >= c[0].x; 
            var coords = isRight ? [{ x: tx, y: ty }, { x: tx + notch, y: ty - bh / 2 }, { x: tx + notch + bw, y: ty - bh / 2 }, { x: tx + notch + bw, y: ty + bh / 2 }, { x: tx + notch, y: ty + bh / 2 }] : [{ x: tx, y: ty }, { x: tx - notch, y: ty - bh / 2 }, { x: tx - notch - bw, y: ty - bh / 2 }, { x: tx - notch - bw, y: ty + bh / 2 }, { x: tx - notch, y: ty + bh / 2 }]; 
            figs.push({ type: 'polygon', attrs: { coordinates: coords }, styles: { style: 'fill', color: pS.color || 'rgba(153,69,255,0.25)', borderColor: pS.borderColor || '#9945FF', borderSize: 1 }, ignoreEvent: true }); 
                lines.forEach(function(l, i) {
                    var lineY = ty - (lines.length - 1) * lh / 2 + i * lh;
                    figs.push({ type: 'text', attrs: { x: isRight ? tx + notch + 8 : tx - notch - 8, y: lineY, text: l, align: isRight ? 'left' : 'right', baseline: 'middle' }, styles: { color: tS.color || '#d0aaff', size: tS.size || 12, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '700', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
                });
            return figs; 
        } 
      },
      { 
        name: 'flagMarker', totalStep: 2, 
        styles: { text: { color: '#F0B90B', style: 'normal' }, polygon: { color: '#F0B90B', borderColor: '#F0B90B', borderSize: 1 } }, 
        createPointFigures: function(ref) { 
            var c = ref.coordinates || []; if (!c.length) return []; 
            var txt = ref.overlay.extendData || ''; 
            var lines = typeof txt === 'string' ? txt.split('\n') : [String(txt)];
            var x = c[0].x, y = c[0].y, pw = 3, ph = 30, fw = 22, fh = 14; 
            var os = ref.overlay.styles || {}; var tS = os.text || {}; var pS = os.polygon || {}; 
            var lh = (tS.size || 12) + 6;
            var bgC = pS.color && pS.color !== 'transparent' ? pS.color : 'transparent';
            var figs = [ { type: 'line', attrs: { coordinates: [{ x: x, y: y }, { x: x, y: y - ph }] }, styles: { color: pS.color || '#F0B90B', size: pw } }, { type: 'polygon', attrs: { coordinates: [ { x: x, y: y - ph }, { x: x + fw, y: y - ph + fh / 2 }, { x: x, y: y - ph + fh } ]}, styles: { style: 'fill', color: pS.color || '#F0B90B' }, ignoreEvent: true } ];
            if (txt) {
                lines.forEach(function(l, i) {
                    var lineY = (y - ph + fh / 2) - (lines.length - 1) * lh / 2 + i * lh;
                    figs.push({ type: 'text', attrs: { x: x + fw + 4, y: lineY, text: l, align: 'left', baseline: 'middle' }, styles: { color: tS.color || '#F0B90B', size: tS.size || 11, family: tS.family || 'Be Vietnam Pro, sans-serif', weight: tS.weight || '700', style: tS.style || 'normal', backgroundColor: bgC, borderColor: pS.borderColor || 'transparent', borderSize: pS.borderSize || 0 } });
                });
            }
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
    const style = document.createElement('style');
    style.id = 'wa-pro-css-v4';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Lexend:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&family=Josefin+Sans:wght@400;600;700&family=Raleway:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap');

      :root {
        --wa-bg-base:        #0A0C10;
        --wa-bg-surface:     #0F1218;
        --wa-bg-elevated:    #151B23;
        --wa-bg-overlay:     #1C242E;
        --wa-bg-modal:       rgba(10,12,16,0.85);
        --wa-border-subtle:  #1E2733;
        --wa-border-default: #273040;
        --wa-border-focus:   #3B82F6;
        --wa-text-primary:   #E8EDF2;
        --wa-text-secondary: #8896A7;
        --wa-text-muted:     #4A5568;
        --wa-text-accent:    #60A5FA;
        --wa-accent:         #3B82F6;
        --wa-accent-glow:    rgba(59,130,246,0.15);
        --wa-accent-bright:  #60A5FA;
        --wa-success:        #22C55E;
        --wa-danger:         #EF4444;
        --wa-warning:        #F59E0B;
        --wa-purple:         #8B5CF6;
        --wa-cyan:           #06B6D4;
      }

      #sc-chart-container { position: relative !important; overflow: hidden !important; }

      /* ─── BASE FONT ─── */
      .wa-toolbar, .wa-props-panel, .wa-context-menu, .wa-toast, #wa-text-editor {
        font-family: 'Be Vietnam Pro', 'Lexend', 'Inter', sans-serif;
        -webkit-font-smoothing: antialiased;
      }

      /* ─── ANIMATIONS ─── */
      @keyframes wa-fadein {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes wa-fadein-scale {
        from { opacity: 0; transform: scale(0.92); }
        to   { opacity: 1; transform: scale(1); }
      }

      /* ─── TOOLBAR ─── */
      .wa-toolbar {
        position: absolute; top: 60px; left: 16px; z-index: 999;
        width: 48px;
        background: var(--wa-bg-surface);
        border: 1px solid var(--wa-border-subtle);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
        display: flex; flex-direction: column; align-items: center;
        padding: 0 0 8px 0;
        transition: height 0.25s cubic-bezier(0.4,0,0.2,1), overflow 0.25s;
      }
      .wa-toolbar.collapsed { height: 24px; overflow: hidden; }
      
      /* Glow báo hiệu đang trong chế độ vẽ */
      .wa-drawing-mode .wa-toolbar {
        box-shadow: 0 0 0 2px var(--wa-accent), 0 8px 32px rgba(59,130,246,0.2);
      }
      .wa-drawing-mode canvas { cursor: crosshair !important; }

      /* Drag Grip (···) */
      .wa-drag-grip {
        width: 100%; height: 20px;
        display: flex; align-items: center; justify-content: center;
        cursor: grab;
        background: var(--wa-bg-elevated);
        border-radius: 12px 12px 0 0;
        opacity: 0.5; margin-bottom: 4px;
        transition: opacity 0.15s;
      }
      .wa-drag-grip:active { cursor: grabbing; }
      .wa-drag-grip::after {
        content: '···';
        color: var(--wa-text-secondary); font-size: 14px; letter-spacing: 2px; line-height: 1;
      }
      .wa-drag-grip:hover { opacity: 1; }

      /* Tool Buttons */
      .wa-tb-btn {
        width: 38px; height: 38px;
        border-radius: 8px; border: none;
        background: transparent; color: var(--wa-text-secondary);
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        margin: 2px 0; position: relative;
        transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
      }
      .wa-tb-btn svg { width: 20px; height: 20px; }
      .wa-tb-btn:hover {
        background: var(--wa-bg-overlay); color: var(--wa-text-primary);
        transform: scale(1.08);
      }
      .wa-tb-btn.active {
        background: var(--wa-accent-glow); color: var(--wa-accent-bright);
        box-shadow: 0 0 0 1px var(--wa-accent), 0 0 12px rgba(59,130,246,0.2);
        border-radius: 8px;
        border-left: 2px solid var(--wa-accent);
        cursor: default;
      }
      .wa-tb-btn[data-tool="pointer"] { cursor: pointer; }

      /* Tooltip */
      .wa-tb-btn::after {
        content: attr(data-tooltip);
        position: absolute; left: 50px; top: 50%; transform: translateY(-50%);
        background: var(--wa-bg-elevated); color: var(--wa-text-primary);
        padding: 5px 10px; border-radius: 6px;
        font-size: 11px; white-space: nowrap;
        pointer-events: none; opacity: 0; transition: opacity 0.2s;
        border: 1px solid var(--wa-border-default);
        box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 1000;
      }
      .wa-tb-btn::before {
        content: '';
        position: absolute; left: 46px; top: 50%; transform: translateY(-50%);
        border: 5px solid transparent; border-right-color: var(--wa-border-default);
        pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 1000;
      }
      .wa-tb-btn:hover::after, .wa-tb-btn:hover::before { opacity: 1; }

      /* Keyboard Shortcuts Badge */
      .wa-kbd {
        display: inline-block; background: var(--wa-bg-overlay);
        border: 1px solid var(--wa-border-default); border-radius: 3px;
        font-size: 9px; padding: 1px 4px; margin-left: 6px; color: var(--wa-text-muted);
      }

      /* ─── DROPDOWN MENU ─── */
      .wa-tb-group { position: relative; width: 100%; display: flex; justify-content: center; }
      .wa-tb-group::after {
        content: ''; position: absolute; right: 5px; bottom: 7px; width: 6px; height: 6px;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath d='M2 1l4 3-4 3' stroke='%234A5568' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") center/contain no-repeat;
        pointer-events: none;
      }
      .wa-tb-menu {
        position: absolute; left: 100%; top: -6px;
        padding-left: 8px; display: none; z-index: 1000;
      }
      .wa-tb-group:hover .wa-tb-menu { display: block; }
      
      .wa-tb-menu-inner {
        background: var(--wa-bg-elevated);
        border: 1px solid var(--wa-border-subtle);
        border-radius: 12px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
        width: 240px; padding: 8px 0;
        display: flex; flex-direction: column;
        max-height: 55vh; overflow-y: auto; overflow-x: hidden;
        backdrop-filter: blur(20px);
        animation: wa-fadein 0.18s ease;
      }
      
      /* Scrollbar */
      .wa-tb-menu-inner::-webkit-scrollbar, .wa-panel-body::-webkit-scrollbar { width: 3px; }
      .wa-tb-menu-inner::-webkit-scrollbar-thumb, .wa-panel-body::-webkit-scrollbar-thumb { background: var(--wa-border-default); border-radius: 3px; }
      .wa-tb-menu-inner::-webkit-scrollbar-track, .wa-panel-body::-webkit-scrollbar-track { background: var(--wa-border-subtle); }

      .wa-menu-header {
        padding: 14px 16px 6px 16px;
        color: var(--wa-text-muted); font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 1.2px;
        pointer-events: none; border-left: 2px solid var(--wa-accent);
        margin: 0 6px;
      }
      .wa-menu-divider {
        background: var(--wa-border-subtle);
        height: 1px; margin: 6px 12px; border-radius: 1px;
      }
      .wa-menu-item {
        padding: 8px 16px; margin: 1px 6px;
        color: var(--wa-text-secondary); font-size: 12.5px;
        cursor: pointer; border-radius: 6px;
        transition: background 0.12s, color 0.12s, transform 0.12s;
        display: flex; align-items: center; gap: 8px;
      }
      .wa-menu-item:hover {
        background: var(--wa-bg-overlay); color: var(--wa-text-primary);
        transform: translateX(2px);
      }

      /* ─── PROPERTIES PANEL ─── */
      .wa-props-panel {
        position: absolute; right: 0; top: 0; bottom: 0; width: 280px;
        background: var(--wa-bg-modal); backdrop-filter: blur(24px);
        border-left: 1px solid var(--wa-border-subtle);
        box-shadow: -8px 0 40px rgba(0,0,0,0.6); z-index: 999;
        transform: translateX(100%); opacity: 0;
        transition: transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s;
        display: flex; flex-direction: column;
      }
      .wa-props-panel.show { transform: translateX(0); opacity: 1; }

      .wa-panel-header {
        padding: 14px 16px; background: var(--wa-bg-elevated);
        border-bottom: 1px solid var(--wa-border-subtle);
        display: flex; justify-content: space-between; align-items: center;
        color: var(--wa-text-secondary); font-weight: 700; font-size: 12px;
        letter-spacing: 0.5px; text-transform: uppercase;
      }
      .wa-close-btn {
        background: none; border: none; color: var(--wa-text-muted);
        cursor: pointer; padding: 4px; border-radius: 4px;
        display: flex; align-items: center; transition: 0.15s;
      }
      .wa-close-btn:hover { background: rgba(239,68,68,0.12); color: var(--wa-danger); }

      .wa-panel-body { padding: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
      
      /* Inputs */
      .wa-control-row { display: flex; flex-direction: column; gap: 6px; }
      .wa-control-row label {
        color: var(--wa-text-muted); font-size: 11px; font-weight: 600;
        letter-spacing: 0.3px; text-transform: uppercase;
      }
      .wa-input, .wa-select {
        background: var(--wa-bg-base); border: 1px solid var(--wa-border-default);
        color: var(--wa-text-primary); padding: 8px 12px; border-radius: 8px;
        outline: none; font-size: 12.5px; width: 100%; box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit;
      }
      .wa-input:focus, .wa-select:focus {
        border-color: var(--wa-border-focus); box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
      }
      .wa-textarea { height: 90px; resize: vertical; line-height: 1.5; }
      
      .wa-color-picker {
        width: 100%; height: 38px; padding: 0;
        border: 1px solid var(--wa-border-default); border-radius: 8px;
        cursor: pointer; background: var(--wa-bg-base); overflow: hidden;
      }
      .wa-color-picker::-webkit-color-swatch-wrapper { padding: 0; }
      .wa-color-picker::-webkit-color-swatch { border: none; border-radius: 7px; }

      /* Swatches */
      .wa-swatches-row { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 6px; }
      .wa-swatch {
        width: 100%; aspect-ratio: 1; border-radius: 4px; cursor: pointer;
        border: 1.5px solid transparent; transition: transform 0.12s, border-color 0.12s;
      }
      .wa-swatch:hover { transform: scale(1.2); border-color: var(--wa-text-primary); }
      .wa-swatch.selected { border-color: var(--wa-accent-bright); box-shadow: 0 0 0 2px var(--wa-accent-glow); }

      /* Footer Buttons */
      .wa-panel-footer {
        background: var(--wa-bg-elevated); border-top: 1px solid var(--wa-border-subtle);
        padding: 12px 16px; display: flex; gap: 8px;
      }
      .wa-action-btn {
        flex: 1; background: var(--wa-bg-overlay); border: 1px solid var(--wa-border-subtle);
        color: var(--wa-text-secondary); padding: 9px; border-radius: 8px; cursor: pointer;
        font-size: 12px; font-weight: 600; font-family: inherit;
        transition: all 0.15s cubic-bezier(0.4,0,0.2,1);
        display: flex; justify-content: center; align-items: center; gap: 6px;
      }
      .wa-action-btn:hover { background: var(--wa-bg-elevated); color: var(--wa-text-primary); }
      .wa-action-btn.delete:hover { background: rgba(239,68,68,0.12); color: var(--wa-danger); border-color: rgba(239,68,68,0.3); }

      /* ─── TOAST ─── */
      .wa-toast {
        position: absolute; bottom: 24px; left: 50%;
        transform: translateX(-50%) translateY(6px);
        background: var(--wa-bg-elevated); border: 1px solid var(--wa-border-default);
        color: var(--wa-text-primary); padding: 9px 18px; border-radius: 8px;
        font-size: 12px; font-weight: 500; letter-spacing: 0.2px;
        opacity: 0; transition: opacity 0.3s, transform 0.3s;
        z-index: 9999; pointer-events: none; white-space: nowrap;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      }
      .wa-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
      /* ===== FLOATING TOOLBAR ===== */
.wa-float-bar {
  position: absolute;
  z-index: 1002;
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 4px 8px;
  background: #1C242E;
  border: 1px solid #273040;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05);
  backdrop-filter: blur(20px);
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
  transition: opacity 0.18s, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
  pointer-events: none;
  user-select: none;
  font-family: Be Vietnam Pro, Inter, sans-serif;
}
.wa-float-bar.wa-fb-show { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
.wa-fb-color-wrap {
  width: 26px; height: 26px; border-radius: 6px; position: relative;
  border: 1.5px solid #273040; overflow: hidden; cursor: pointer; flex-shrink: 0;
}
.wa-fb-color-wrap input[type=color] {
  opacity: 0; position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; border: none; padding: 0;
}
.wa-fb-cswatch { width: 100%; height: 100%; pointer-events: none; }
.wa-fb-sep { width: 1px; height: 16px; background: #273040; margin: 0 4px; flex-shrink: 0; }
.wa-fb-btn {
  width: 28px; height: 28px; border: none; background: transparent;
  color: #8896A7; cursor: pointer; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.14s; flex-shrink: 0; padding: 0;
}
.wa-fb-btn:hover { background: rgba(255,255,255,0.07); color: #E8EDF2; }
.wa-fb-btn.wa-fb-on { background: rgba(59,130,246,0.15); color: #60A5FA; box-shadow: 0 0 0 1px #3B82F6; }
.wa-fb-btn.wa-fb-del:hover { background: rgba(239,68,68,0.15); color: #EF4444; }
.wa-fb-label {
  font-size: 10px; color: #4A5568; padding: 0 4px; white-space: nowrap;
}
/* Panel improvements */
.wa-prop-section { padding: 12px 16px; border-bottom: 1px solid #1E2733; }
.wa-prop-section:last-child { border-bottom: none; }
.wa-prop-section-title { font-size: 10px; font-weight: 700; color: #4A5568; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.wa-row { display: flex; gap: 8px; margin-bottom: 8px; }
.wa-row:last-child { margin-bottom: 0; }
.wa-col { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.wa-col label { font-size: 10px; color: #8896A7; font-weight: 600; }
.wa-seg { display: flex; gap: 2px; background: #0F1218; border-radius: 6px; padding: 2px; }
.wa-seg-btn {
  flex: 1; padding: 4px 6px; border: none; background: transparent;
  color: #8896A7; cursor: pointer; border-radius: 4px; font-size: 11px;
  display: flex; align-items: center; justify-content: center; gap: 3px;
  transition: all 0.14s;
}
.wa-seg-btn:hover { background: rgba(255,255,255,0.06); color: #E8EDF2; }
.wa-seg-btn.wa-seg-on { background: #273040; color: #E8EDF2; box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
.wa-range-wrap { display: flex; align-items: center; gap: 8px; }
.wa-range { flex: 1; -webkit-appearance: none; height: 3px; background: #273040; border-radius: 2px; outline: none; }
.wa-range::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #3B82F6; cursor: pointer; }
.wa-range-val { font-size: 11px; color: #60A5FA; min-width: 28px; text-align: right; font-weight: 600; }
.wa-toggle-row { display: flex; align-items: center; justify-content: space-between; }
.wa-toggle-label { font-size: 12px; color: #8896A7; }
.wa-toggle { width: 36px; height: 20px; border-radius: 10px; background: #1E2733; border: 1px solid #273040; position: relative; cursor: pointer; transition: background 0.2s; flex-shrink: 0; }
.wa-toggle.wa-toggle-on { background: #3B82F6; border-color: #3B82F6; }
.wa-toggle::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 2px; left: 2px; transition: left 0.2s; }
.wa-toggle.wa-toggle-on::after { left: 18px; }
/* ── Mobile responsive ── */
@media (max-width: 768px) {
  .wa-tb-btn { min-width: 44px !important; min-height: 44px !important; }
  .wa-menu-item { padding: 12px 16px !important; font-size: 13px !important; }
  .wa-props-panel {
    width: calc(100vw - 16px) !important;
    right: 8px !important; left: 8px !important;
    top: auto !important; bottom: 56px !important;
    max-height: 52vh !important;
    border-radius: 12px !important;
    transform: translateY(110%) !important;
    opacity: 0 !important;
  }
  .wa-props-panel.show { transform: translateY(0) !important; opacity: 1 !important; }
  .wa-float-bar { gap: 2px !important; padding: 6px 10px !important; }
  .wa-fb-btn { min-width: 40px !important; min-height: 40px !important; }
  ._rng { height: 8px !important; }
  ._rng::-webkit-slider-thumb { width: 18px !important; height: 18px !important; }
  ._cpb { min-height: 40px !important; }
}

/* ── Touch: chặn text selection khi drag toolbar ── */
#wa-float-bar { user-select: none; -webkit-user-select: none; }
.wa-drawing-mode canvas { touch-action: none; }
    `;
      /* ═══════════ COLOR PICKER + COMPACT PANEL ═══════════════ */
  style.textContent += [
    /* Color picker button */
    '.wa-cp{position:relative;width:100%}',
    '.wa-cp-btn{height:26px;border-radius:5px;border:2px solid #273040;cursor:pointer;position:relative;overflow:hidden;transition:border-color .15s}',
    '.wa-cp-btn:hover{border-color:#3B82F6}',
    '.wa-cp-fill{position:absolute;inset:0;pointer-events:none}',
    /* Popup */
    '.wa-cp-pop{position:fixed;z-index:999999;background:#151B23;border:1px solid #273040;border-radius:10px;padding:10px;box-shadow:0 20px 60px rgba(0,0,0,.92);width:228px;animation:wa-fadein-scale .15s cubic-bezier(.34,1.56,.64,1)}',
    '.wa-cp-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;margin-bottom:6px}',
    '.wa-cp-cell{aspect-ratio:1;border-radius:3px;cursor:pointer;border:1.5px solid transparent;transition:transform .1s,border-color .1s;position:relative;z-index:0}',
    '.wa-cp-cell:hover{transform:scale(1.45);border-color:#fff;z-index:2}',
    '.wa-cp-cell.sel{border-color:#3B82F6;box-shadow:0 0 0 2px rgba(59,130,246,.5);z-index:1}',
    '.wa-cp-sep{height:1px;background:#1E2733;margin:6px 0}',
    '.wa-cp-bottom{display:flex;align-items:center;gap:6px;margin-top:6px}',
    '.wa-cp-hexbox{flex:1;display:flex;align-items:center;gap:4px;background:#0A0C10;border:1px solid #273040;border-radius:6px;padding:4px 7px}',
    '.wa-cp-hexbox:focus-within{border-color:#3B82F6}',
    '.wa-cp-hash{color:#4A5568;font-size:11px;font-weight:700;font-family:monospace;user-select:none}',
    '.wa-cp-hi{flex:1;background:transparent;border:none;color:#E8EDF2;font-size:11px;padding:0;outline:none;font-family:monospace;min-width:0;text-transform:uppercase;width:60px}',
    '.wa-cp-native{width:28px;height:28px;border:2px solid #273040;border-radius:5px;cursor:pointer;padding:0;overflow:hidden;flex-shrink:0}',
    '.wa-cp-native::-webkit-color-swatch-wrapper{padding:0}',
    '.wa-cp-native::-webkit-color-swatch{border:none}',
    /* Compact sections */
    '.wp-sec{border-bottom:1px solid #1A2030;padding:9px 12px}',
    '.wp-sec:last-child{border-bottom:none}',
    '.wp-stitle{font-size:9px;font-weight:800;color:#3A4A5A;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:7px}',
    '.wp-r{display:flex;gap:7px;margin-bottom:5px}',
    '.wp-r:last-child{margin-bottom:0}',
    '.wp-c{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}',
    '.wp-lbl{font-size:10px;color:#6B7A8D;font-weight:600;display:block;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    /* Range */
    '.wp-rw{display:flex;align-items:center;gap:5px}',
    '.wp-rng{flex:1;-webkit-appearance:none;height:3px;background:#1E2B3A;border-radius:2px;outline:none;cursor:pointer}',
    '.wp-rng::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:#3B82F6;cursor:pointer;border:none}',
    '.wp-rv{font-size:10px;color:#60A5FA;min-width:24px;text-align:right;font-weight:700;font-family:monospace}',
    /* Seg */
    '.wp-seg{display:flex;gap:1px;background:#0A0F15;border-radius:5px;padding:2px}',
    '.wp-sb{flex:1;padding:3px 2px;border:none;background:transparent;color:#5A6A7A;cursor:pointer;border-radius:4px;font-size:10px;display:flex;align-items:center;justify-content:center;transition:all .12s;line-height:1}',
    '.wp-sb:hover{background:rgba(255,255,255,.07);color:#C0C8D0}',
    '.wp-sb.on{background:#1E2B3A;color:#E8EDF2;box-shadow:0 1px 3px rgba(0,0,0,.5)}',
    /* Toggle */
    '.wp-togrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
    '.wp-toglbl{font-size:11px;color:#8896A7}',
    '.wp-tog{width:32px;height:18px;border-radius:9px;background:#1A2130;border:1px solid #273040;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}',
    '.wp-tog.on{background:#3B82F6;border-color:#3B82F6}',
    '.wp-tog::after{content:"";position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;top:2px;left:2px;transition:left .18s}',
    '.wp-tog.on::after{left:16px}',
    /* Select */
    '.wp-sel{background:#0A0C10;border:1px solid #273040;color:#C8D0DA;padding:5px 8px;border-radius:5px;outline:none;font-size:11px;width:100%;font-family:inherit;cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%234A5568\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;padding-right:22px}',
    '.wp-sel:focus{border-color:#3B82F6}',
    /* Textarea */
    '.wp-ta{background:#0A0C10;border:1px solid #273040;color:#E8EDF2;padding:7px 9px;border-radius:6px;outline:none;font-size:12px;width:100%;font-family:inherit;resize:vertical;line-height:1.5;min-height:64px;box-sizing:border-box;transition:border-color .15s}',
    '.wp-ta:focus{border-color:#3B82F6}',
    /* Fibo level row */
    '.wp-fvr{display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid #141C26}',
    '.wp-fvr:last-child{border-bottom:none}',
    '.wp-fvlv{font-size:10px;color:#6B7A8D;min-width:38px;font-weight:700;font-family:monospace}',
    /* Small toggle for fibo levels */
    '.wp-tog-sm{width:24px!important;height:14px!important;border-radius:7px!important}',
    '.wp-tog-sm::after{width:10px!important;height:10px!important;top:1px!important;left:1px!important}',
    '.wp-tog-sm.on::after{left:11px!important}',
    /* cp label under color */
    '.wp-cp-sub{font-size:8px;color:#3A4A5A;text-align:center;margin-top:2px}',
  ].join('');
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
        { id: 'flagMarker', name: 'Cờ đánh dấu', n: 'Cờ đánh dấu' }
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
    let html = `<div class="wa-drag-grip" title="Kéo để di chuyển • Double-click thu gọn"></div>
                <button class="wa-tb-btn active" data-tool="pointer" data-tooltip="Con trỏ chuột [Esc]">${SVG.ptr}</button>`;
    
    MENUS.forEach(m => {
      html += `<div class="wa-tb-group">
                <button class="wa-tb-btn">${m.icon}</button>
                <div class="wa-tb-menu"><div class="wa-tb-menu-inner">`;
      m.tools.forEach(t => {
        if (t.id === 'header') {
          html += `<div class="wa-menu-header">${t.n}</div>`;
        } else if (t.id === 'divider') {
          html += `<div class="wa-menu-divider"></div>`;
        } else {
          // Thêm dấu › phía trước tên công cụ để phân cấp thị giác tốt hơn
          html += `<div class="wa-menu-item" data-tool="${t.id}">
                    <span style="font-size:12px;width:16px;text-align:center;flex-shrink:0;opacity:0.7">›</span>${t.n}
                  </div>`;
        }
      });
      html += `</div></div></div>`;
    });
    
    html += `<div style="width:36px;height:1px;background:var(--wa-border-subtle);margin:4px 0"></div>
         <div class="wa-bot-actions">
           <button class="wa-tb-btn" id="wa-btn-del-sel" data-tooltip="Xoá hình đang chọn">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
           </button>
           <button class="wa-tb-btn" id="wa-btn-hide-all" data-tooltip="Ẩn/Hiện tất cả"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
           <button class="wa-tb-btn" id="wa-btn-clear" data-tooltip="Xoá tất cả">${SVG.trash}</button>
         </div>`;          
    return html;
  }

  function showToast(msg, type) {
    let t = document.getElementById('wa-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'wa-toast';
      document.body.appendChild(t); // ← gắn body, không gắn container
    }
    if (!type) {
      if (msg.includes('lưu') || msg.includes('nhân') || msg.includes('bật') || msg.includes('bản') || msg.includes('sạch')) type = 'success';
      else if (msg.includes('lỗi') || msg.includes('xóa') || msg.includes('tắt') || msg.includes('⚠')) type = 'error';
      else type = 'info';
    }
    const icons   = { success: '✓', error: '✕', info: 'ℹ' };
    const colors  = { success: '#22C55E', error: '#EF4444', info: '#3B82F6' };
    t.style.cssText = `
      position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-10px);
      background:rgba(14,20,27,0.96); border:1px solid ${colors[type]}40;
      border-left:3px solid ${colors[type]};
      color:#E8EDF2; font-size:12px; font-weight:600;
      font-family:'Be Vietnam Pro','Inter',sans-serif;
      padding:9px 18px 9px 14px; border-radius:8px;
      box-shadow:0 8px 32px rgba(0,0,0,0.7);
      z-index:9999999; white-space:nowrap; pointer-events:none;
      opacity:0; transition:opacity 0.2s ease, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
    `;
    t.innerHTML = `<span style="color:${colors[type]};margin-right:7px">${icons[type]}</span>${msg}`;
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
    });
    clearTimeout(t._to);
    t._to = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 2500);
  }

  function createConfirmModal(msg, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:absolute;top:0;left:0;right:0;bottom:0;
      background:rgba(0,0,0,0.7);z-index:99999;
      display:flex;align-items:center;justify-content:center;
      backdrop-filter:blur(8px)`;
    const box = document.createElement('div');
    box.style.cssText = `background:var(--wa-bg-elevated);
      border:1px solid var(--wa-border-subtle);
      padding:28px 24px;border-radius:12px;
      color:var(--wa-text-primary);text-align:center;
      box-shadow:0 24px 64px rgba(0,0,0,0.8);
      font-family:'Be Vietnam Pro','Inter',sans-serif;
      animation:wa-fadein-scale 0.2s cubic-bezier(0.34,1.56,0.64,1)`;
    box.innerHTML = `
      <div style="margin-bottom:20px;font-size:14px;color:var(--wa-text-secondary)">${msg}</div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="wa-btn-c-cancel" style="
          padding:9px 22px;background:var(--wa-bg-overlay);
          border:1px solid var(--wa-border-default);
          color:var(--wa-text-secondary);border-radius:8px;
          cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;
          transition:all 0.15s">Huỷ</button>
        <button id="wa-btn-c-ok" style="
          padding:9px 22px;background:var(--wa-danger);border:none;
          color:#fff;border-radius:8px;cursor:pointer;
          font-family:inherit;font-size:12px;font-weight:700;
          transition:all 0.15s">Đồng ý</button>
      </div>`;
    overlay.appendChild(box);
    document.getElementById('sc-chart-container').appendChild(overlay);
    
    // Hover effects via JS inline logic
    setTimeout(() => {
      box.querySelector('#wa-btn-c-cancel').onmouseenter = (e) => { e.target.style.background='transparent'; e.target.style.color='#E8EDF2'; };
      box.querySelector('#wa-btn-c-cancel').onmouseleave = (e) => { e.target.style.background='var(--wa-bg-overlay)'; e.target.style.color='var(--wa-text-secondary)'; };
      box.querySelector('#wa-btn-c-ok').onmouseenter = (e) => { e.target.style.background='#B91C1C'; };
      box.querySelector('#wa-btn-c-ok').onmouseleave = (e) => { e.target.style.background='var(--wa-danger)'; };
      
      box.querySelector('#wa-btn-c-cancel').onclick = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      };
      box.querySelector('#wa-btn-c-ok').onclick = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        setTimeout(onConfirm, 50);
      };
    }, 0);
  }

  // ─────────────────────────────────────────────
  // TEXT EDITOR & WRAPPER
  // ─────────────────────────────────────────────
  function openTextEditor(currentText, currentStyles, toolId, onConfirm) {
    var existing = document.getElementById('wa-text-editor');
    if (existing) existing.remove();

    var defBg = 'rgba(22, 26, 30, 0.9)';
    if (toolId === 'plainText') defBg = 'transparent'; 
    else if (toolId === 'note') defBg = 'rgba(240,185,11,0.15)';
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
    var curFont = tStyles.family || 'Be Vietnam Pro, sans-serif';

    var backdrop = document.createElement('div');
    backdrop.id = 'wa-text-editor';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px)';
    // Bên trong openTextEditor(...)
    backdrop.innerHTML = `<div style="
      background:var(--wa-bg-elevated);
      border:1px solid var(--wa-border-subtle);
      border-radius:14px; padding:24px; width:400px;
      box-shadow:0 24px 80px rgba(0,0,0,0.8);
      font-family:'Be Vietnam Pro','Inter',sans-serif;
      animation: wa-fadein-scale 0.2s cubic-bezier(0.34,1.56,0.64,1);">
      <div style="font-size:11px;font-weight:800;color:var(--wa-text-muted);
        text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">
        ✏️ ${toolId.toUpperCase()}
      </div>
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div style="flex:1">
          <label style="display:block;font-size:11px;color:var(--wa-text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Màu chữ</label>
          <input type="color" id="wa-te-color" value="${curColor}"
            style="width:100%;height:34px;border:1px solid var(--wa-border-default);
            border-radius:8px;background:var(--wa-bg-base);cursor:pointer;padding:0">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:11px;color:var(--wa-text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Màu nền</label>
          <input type="color" id="wa-te-bg" value="${curBg}"
            style="width:100%;height:34px;border:1px solid var(--wa-border-default);
            border-radius:8px;background:var(--wa-bg-base);cursor:pointer;padding:0">
        </div>
        <div style="flex:1">
          <label style="display:block;font-size:11px;color:var(--wa-text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Cỡ chữ</label>
          <input type="number" id="wa-te-size" value="${curSize}"
            style="width:100%;height:34px;border:1px solid var(--wa-border-default);
            border-radius:8px;background:var(--wa-bg-base);color:var(--wa-text-primary);
            padding:0 8px;box-sizing:border-box;outline:none;font-family:inherit">
        </div>
      </div>
      <div style="margin-bottom:14px">
        <label style="display:block;font-size:11px;color:var(--wa-text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Font chữ</label>
        <select id="wa-te-font" style="width:100%;height:34px;
          border:1px solid var(--wa-border-default);border-radius:8px;
          background:var(--wa-bg-base);color:var(--wa-text-primary);
          padding:0 8px;outline:none;cursor:pointer;font-family:inherit">
          <option value="'Be Vietnam Pro',sans-serif" ${curFont.includes('Be Vietnam') ? 'selected' : ''}>Be Vietnam Pro</option>
          <option value="'Lexend',sans-serif" ${curFont.includes('Lexend') ? 'selected' : ''}>Lexend</option>
          <option value="'Nunito',sans-serif" ${curFont.includes('Nunito') ? 'selected' : ''}>Nunito</option>
          <option value="'Josefin Sans',sans-serif" ${curFont.includes('Josefin') ? 'selected' : ''}>Josefin Sans</option>
          <option value="'Raleway',sans-serif" ${curFont.includes('Raleway') ? 'selected' : ''}>Raleway</option>
          <option value="'Space Grotesk',sans-serif" ${curFont.includes('Space') ? 'selected' : ''}>Space Grotesk</option>
          <option value="'Sora',sans-serif" ${curFont.includes('Sora') ? 'selected' : ''}>Sora</option>
          <option value="'Inter',sans-serif" ${curFont.includes('Inter') ? 'selected' : ''}>Inter</option>
          <option value="'Roboto',sans-serif" ${curFont.includes('Roboto') ? 'selected' : ''}>Roboto</option>
          <option value="Arial,sans-serif" ${curFont.includes('Arial') ? 'selected' : ''}>Arial</option>
        </select>
      </div>
      <label style="display:block;font-size:11px;color:var(--wa-text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Nội dung</label>
      <textarea id="wa-te-input" rows="4" placeholder="Nhập text..."
        style="width:100%;box-sizing:border-box;
        background:var(--wa-bg-base);border:1px solid var(--wa-border-default);
        border-radius:8px;color:var(--wa-text-primary);
        font-size:14px;font-family:inherit;padding:8px 12px;
        resize:vertical;outline:none;line-height:1.5;
        transition:border-color 0.15s,box-shadow 0.15s"></textarea>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button id="wa-te-cancel" style="
          background:transparent;border:1px solid var(--wa-border-default);
          color:var(--wa-text-secondary);padding:8px 18px;border-radius:8px;
          cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;
          transition:all 0.15s">Huỷ</button>
        <button id="wa-te-confirm" style="
          background:var(--wa-accent);border:none;color:#fff;
          padding:8px 18px;border-radius:8px;cursor:pointer;
          font-family:inherit;font-size:12px;font-weight:700;
          transition:all 0.15s">Xác nhận</button>
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
      updatedStyles.text.weight = updatedStyles.text.weight || tStyles.weight || 'normal';
      updatedStyles.text.style = updatedStyles.text.style || tStyles.style || 'normal';
      
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

  function createTextOverlay(chart, toolId, initialData) {
    if (!chart) return null;
    var overlayId = null;

    function openEditor(currentText, currentStyles) {
      openTextEditor(currentText, currentStyles, toolId, function(newText, newStyles) {
        if (overlayId) chart.overrideOverlay({ id: overlayId, extendData: newText, styles: newStyles });
      });
    }

    var config = {
      name: toolId, extendData: initialData || '',
      onDrawEnd: function(event) {
        isDrawingSessionActive = false;
        if (!overlayId && event && event.overlay) overlayId = event.overlay.id;
        openEditor((event && event.overlay) ? event.overlay.extendData : '', (event && event.overlay) ? event.overlay.styles : {});
        return false;
      },
      onDoubleClick: function(event) {
        if (!overlayId && event && event.overlay) {
          overlayId = event.overlay.id;
          openEditor(event.overlay ? event.overlay.extendData : '', event.overlay ? event.overlay.styles : {});
        }
        return false;
      },  // ← ĐỔI } thành }, (thêm dấu phẩy)
      // THÊM VÀO ĐÂY:
      onSelected: function(event) {
        // Bỏ dòng: if (isDrawingSessionActive) return;
        isDrawingSessionActive = false;  // ← THÊM DÒNG NÀY để reset sau khi vẽ xong
        var ov = event && event.overlay ? event.overlay : null;
        if (!ov) return;
        currentSelectedOverlay = ov;
        window.currentSelectedOverlay = ov;
        if (document.getElementById('wa-text-editor-backdrop')) return;
        if (typeof showFloatToolbar === 'function') showFloatToolbar(ov, null, null);
        if (typeof renderPanel === 'function') renderPanel(ov);
      },
      onDeselected: function() {}
    };
    var id = chart.createOverlay(config);
    if (id) overlayId = id;
    return id;
  }

  

  // ==========================================
  // 5. PROPS PANEL (WYSIWYG TÙY BIẾN CHO TỪNG LOẠI)
  // ==========================================
  function getToolCategory(name) {
    const shapes = ['rectangle', 'rotatedRectangle', 'circle', 'ellipse', 'triangle', 'parallelogram', 'gannBox', 'gannSquare', 'arrowUp', 'arrowDown', 'symmetricalTriangle', 'ascendingTriangle', 'descendingTriangle', 'risingWedge', 'fallingWedge', 'flagPattern', 'pennantPattern'];
    if (shapes.includes(name)) return 'shapes';
    if (name.startsWith('fibR') || name.startsWith('fibE') || name.startsWith('fibF') || name.startsWith('fibA') || name.startsWith('fibT') || name === 'gannFan') return 'fibo';
    const textTools = ['plainText', 'anchoredText', 'note', 'priceNote', 'pin', 'annotation', 'comment', 'priceLabel', 'signpost', 'flagMarker'];
    if (textTools.includes(name)) return 'text';
    if (name.startsWith('wave') || name.startsWith('elliott') || name.includes('abcd') || name.includes('HeadAndShoulders') || name.includes('Top') || name.includes('Bottom') || name === 'threeDrives') return 'waves';
    return 'lines'; 
  }

  function renderPanel(overlay) {
    var panel = document.getElementById('wa-props-panel');
    if (!panel || !overlay) return;
  
    // ── 1. Cleanup listeners & popup từ lần trước ──
    if (panel._rpCleanup) { try { panel._rpCleanup(); } catch(e){} }
    var _H = [];
    function _on(el, ev, fn) { if (!el) return; el.addEventListener(ev, fn, false); _H.push([el, ev, fn]); }
    function _off() { _H.forEach(function(h){ h[0].removeEventListener(h[1], h[2], false); }); _H = []; var p=document.getElementById('_rp_pop'); if(p) p.remove(); }
    panel._rpCleanup = _off;
  
    // ── 2. CSS (chỉ inject 1 lần) ──
    if (!document.getElementById('_rp_css_v3')) {
      var _css = document.createElement('style');
      _css.id = '_rp_css_v3';
      _css.textContent = [
        '.wa-props-panel{display:flex!important;flex-direction:column!important}',
        '.wa-panel-body{padding:10px!important;gap:0!important;flex:1 1 auto!important;overflow-y:auto!important;min-height:0!important;overscroll-behavior:contain}',
        '.wa-panel-body::-webkit-scrollbar{width:4px}',
        '.wa-panel-body::-webkit-scrollbar-thumb{background:#273040;border-radius:4px}',
        '._s{background:#0D1117;border:1px solid #1E2A3A;border-radius:8px;margin-bottom:7px}',
        '._sh{font-size:9.5px;font-weight:800;color:#4A5F72;text-transform:uppercase;letter-spacing:.9px;padding:7px 10px 5px;border-bottom:1px solid #1A2535}',
        '._sb{padding:8px 10px}',
        '._r{display:flex;gap:8px;margin-bottom:6px}._r:last-child{margin-bottom:0}',
        '._c{flex:1;min-width:0}',
        '._l{display:block;font-size:10px;color:#6B7E8D;font-weight:600;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '._sel{width:100%;background:#080D12;border:1px solid #1E2A3A;color:#C8D6E0;padding:5px 24px 5px 8px;border-radius:5px;font-size:11px;outline:none;font-family:inherit;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%234A5568\'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 7px center}',
        '._sel:focus{border-color:#3B82F6}',
        '._ta{width:100%;background:#080D12;border:1px solid #1E2A3A;color:#E8EDF2;padding:8px;border-radius:5px;font-size:12px;outline:none;font-family:inherit;resize:vertical;min-height:60px;box-sizing:border-box;line-height:1.5}',
        '._ta:focus{border-color:#3B82F6}',
        '._rw{display:flex;align-items:center;gap:6px}',
        '._rng{flex:1;-webkit-appearance:none;height:3px;background:#1A2535;border-radius:2px;outline:none;cursor:pointer}',
        '._rng::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#3B82F6;cursor:pointer;border:2px solid #0D1117}',
        '._rv{font-size:10px;color:#60A5FA;min-width:26px;text-align:right;font-weight:700;font-family:monospace}',
        '._seg{display:flex;background:#080D12;border:1px solid #1A2535;border-radius:6px;padding:2px;gap:2px}',
        '._segb{flex:1;border:none;background:transparent;color:#6B7E8D;padding:5px 3px;cursor:pointer;border-radius:4px;transition:.12s;display:flex;align-items:center;justify-content:center;gap:3px;font-size:10px;font-weight:600;font-family:inherit;white-space:nowrap}',
        '._segb:hover{color:#A0B0C0;background:rgba(255,255,255,.05)}',
        '._segb.on{background:#1E2B3A;color:#E8EDF2}',
        '._trow{display:flex;justify-content:space-between;align-items:center;padding:3px 0}',
        '._tlbl{font-size:11px;color:#8896A7}',
        '._tog{width:32px;height:17px;border-radius:9px;background:#1A2130;border:1px solid #273040;position:relative;cursor:pointer;transition:.18s;flex-shrink:0}',
        '._tog::after{content:"";position:absolute;width:11px;height:11px;background:#fff;border-radius:50%;top:2px;left:2px;transition:.18s}',
        '._tog.on{background:#3B82F6;border-color:#2563EB}',
        '._tog.on::after{left:17px}',
        // ─── Color Picker Button ───
        '._cpb{width:100%;height:28px;border-radius:6px;border:1.5px solid #1E2A3A;cursor:pointer;position:relative;overflow:hidden;transition:border-color .15s}',
        '._cpb:hover{border-color:#3B82F6}',
        '._cpbg{position:absolute;inset:0;background-image:linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%);background-size:6px 6px;background-position:0 0,0 3px,3px -3px,-3px 0}',
        '._cpf{position:absolute;inset:0;border-radius:5px}',
        // ─── Popup ───
        '._pop{position:fixed;z-index:999999;background:#151B23;border:1px solid #273040;border-radius:9px;padding:10px;box-shadow:0 20px 60px rgba(0,0,0,.92);width:218px}',
        '._pg{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;margin-bottom:8px}',
        '._pc{aspect-ratio:1;border-radius:2px;cursor:pointer;border:1.5px solid transparent;transition:transform .1s;position:relative;z-index:0}',
        '._pc:hover{transform:scale(1.5);border-color:rgba(255,255,255,.8);z-index:3}',
        '._pc.on{border-color:#3B82F6;z-index:2}',
        '._ph{display:flex;align-items:center;gap:5px;background:#080D12;border:1px solid #1E2A3A;border-radius:5px;padding:4px 7px}',
        '._ph:focus-within{border-color:#3B82F6}',
        '._phi{flex:1;background:transparent;border:none;color:#E8EDF2;font-size:11px;outline:none;font-family:monospace;text-transform:uppercase;min-width:0}',
      ].join('');
      document.head.appendChild(_css);
    }
  
    var cat    = getToolCategory(overlay.name);
    var body   = panel.querySelector('.wa-panel-body');
    if (!body) return;
  
    var s      = overlay.styles || {};
    var rawExt = overlay.extendData;
    var ext    = (rawExt && typeof rawExt === 'object') ? rawExt : {};
  
    // ── Utilities màu ──────────────────────────────────────────────────────────
    // FIX BUG #1: toHex luôn trả về '#RRGGBB' hoặc null - KHÔNG BAO GIỜ thiếu '#'
    function toHex(c) {
      if (!c || c === 'transparent' || c === '') return null;
      if (typeof c !== 'string') return null;
      var v = c.trim();
      if (v.charAt(0) === '#') {
        var h = v.slice(1);
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        return '#' + h.slice(0, 6).toUpperCase();
      }
      var m = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (m) return '#' + [m[1],m[2],m[3]].map(function(x){ return (+x).toString(16).padStart(2,'0'); }).join('').toUpperCase();
      return null;
    }
    function safeHex(c, def) { return toHex(c) || def || '#3B82F6'; }
    function toAlpha(c, def) {
      if (!c || c === 'transparent') return (def !== undefined ? def : 0);
      var m = c.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
      return m ? Math.max(0, Math.min(1, parseFloat(m[1]))) : (def !== undefined ? def : 1);
    }
    function mkRgba(hex, a) {
      if (!hex || a <= 0) return 'transparent';
      var h = hex.replace('#','');
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
      return 'rgba('+r+','+g+','+b+','+parseFloat(a.toFixed(2))+')';
    }
  
    // ── Component Builders ─────────────────────────────────────────────────────
    // FIX BUG #2: data-cur được set ngay trong HTML, không phải lúc click
    function cpBtn(id, hex) {
      var safeColor = hex || '';
      var bg = safeColor || 'transparent';
      return '<div class="_cpb" data-cp="'+id+'" data-cur="'+safeColor+'">'
           + '<div class="_cpbg"></div>'
           + '<div class="_cpf" id="_cpfc_'+id+'" style="background:'+bg+'"></div>'
           + '</div>';
    }
    function rng(id, mn, mx, st, val, unit) {
      var u = unit || '';
      return '<div class="_rw"><input type="range" class="_rng" id="'+id+'" min="'+mn+'" max="'+mx+'" step="'+st+'" value="'+val+'"><span class="_rv" id="'+id+'_v">'+val+u+'</span></div>';
    }
    function seg(id, opts, cur) {
      return '<div class="_seg">'+opts.map(function(o){
        return '<button class="_segb'+(o.v===cur?' on':'')+'" data-seg="'+id+'" data-val="'+o.v+'">'+o.l+'</button>';
      }).join('')+'</div>';
    }
    function tog(id, on, lbl) {
      return '<div class="_trow"><span class="_tlbl">'+lbl+'</span><div class="_tog'+(on?' on':'')+'" id="'+id+'"></div></div>';
    }
    function sel(id, opts, cur) {
      return '<select class="_sel" id="'+id+'">'+opts.map(function(o){
        return '<option value="'+o.v+'"'+(o.v===cur?' selected':'')+'>'+o.n+'</option>';
      }).join('')+'</select>';
    }
    function co(lbl, ctrl) { return '<div class="_c"><span class="_l">'+lbl+'</span>'+ctrl+'</div>'; }
    function ro()           { return '<div class="_r">'+[].slice.call(arguments).join('')+'</div>'; }
    function sec(title, inner) {
      return '<div class="_s">'+(title?'<div class="_sh">'+title+'</div>':'')+'<div class="_sb">'+inner+'</div></div>';
    }
  
    var LS = [
      { v:'solid',  l:'<svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" stroke-width="2.5"/></svg> Liền' },
      { v:'dashed', l:'<svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 3"/></svg> Đứt' },
      { v:'dotted', l:'<svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" stroke-width="2.5" stroke-dasharray="1.5 3"/></svg> Chấm' }
    ];
    var FONTS = [
      { v:'Be Vietnam Pro, sans-serif', n:'Be Vietnam Pro' },
      { v:'Inter, sans-serif',          n:'Inter' },
      { v:'Lexend, sans-serif',         n:'Lexend' },
      { v:'Nunito, sans-serif',         n:'Nunito' },
      { v:'Space Grotesk, sans-serif',  n:'Space Grotesk' },
      { v:'Sora, sans-serif',           n:'Sora' },
      { v:'Raleway, sans-serif',        n:'Raleway' },
      { v:'Roboto Mono, monospace',     n:'Roboto Mono' },
      { v:'Arial, sans-serif',          n:'Arial' }
    ];
  
    // ── Build HTML theo từng category ─────────────────────────────────────────
    var html = '';
    try {
      if (cat === 'text') {
        var stxt   = s.text    || {};
        var spoly  = s.polygon || {};
        var txt    = typeof rawExt === 'string' ? rawExt : (typeof ext.text === 'string' ? ext.text : '');
        var tc     = safeHex(stxt.color,  '#E8EDF2');
        var ff     = stxt.family || 'Be Vietnam Pro, sans-serif';
        var sz     = stxt.size   || 13;
        var fw     = stxt.weight || 'normal';
        var fi     = stxt.style  || 'normal';
        var bgHex  = safeHex(spoly.color, '#151B23');
        var bgA    = toAlpha(spoly.color, 0);
        var bdHex  = safeHex(spoly.borderColor, '#273040');
        var bdW    = spoly.borderSize || 1;
        var bdA    = toAlpha(spoly.borderColor, 1);
        var bdOn   = !!(spoly.borderSize && spoly.borderColor && spoly.borderColor !== 'transparent');
  
        html += sec('', '<textarea id="_rp_txt" class="_ta">'+txt+'</textarea>');
        html += sec('Văn bản',
          ro(co('Font chữ', sel('_rp_ff', FONTS, ff))) +
          ro(co('Màu chữ', cpBtn('c_tc', tc)), co('Cỡ (px)', rng('_rp_sz', 10, 64, 1, sz))) +
          ro(co('Độ đậm', seg('_rp_fw', [{v:'normal',l:'Thường'},{v:'bold',l:'Đậm'},{v:'800',l:'Đậm+'}], fw))) +
          ro(co('In nghiêng', seg('_rp_fi', [{v:'normal',l:'Thẳng'},{v:'italic',l:'Nghiêng'}], fi)))
        );
        html += sec('Nền & Khung',
          ro(co('Màu nền', cpBtn('c_bgc', bgHex)), co('Opacity nền', rng('_rp_bga', 0, 1, 0.05, bgA))) +
          '<div style="padding:2px 0 4px">'+tog('_rp_bdon', bdOn, 'Bật viền khung')+'</div>' +
          '<div id="_rp_bdbox" style="'+(bdOn ? '' : 'opacity:.3;pointer-events:none')+'">' +
          ro(co('Màu viền', cpBtn('c_bdc', bdHex)), co('Dày viền', rng('_rp_bdw', 1, 5, 1, bdW))) +
          ro(co('Opacity viền', rng('_rp_bda', 0, 1, 0.05, bdA))) +
          '</div>'
        );
  
      } else if (cat === 'shapes') {
        var spoly  = s.polygon || {};
        var sline  = s.line    || {};
        var bc     = safeHex(spoly.borderColor, '#3B82F6');
        var bw     = spoly.borderSize || 1;
        var bo     = toAlpha(spoly.borderColor, 1);
        var bs     = sline.style || 'solid';
        var fcHex  = safeHex(spoly.color, '#3B82F6');
        var fa     = toAlpha(spoly.color, 0.15);
  
        html += sec('Đường viền',
          ro(co('Màu viền', cpBtn('c_bc', bc)), co('Độ dày', rng('_rp_bw', 1, 8, 1, bw))) +
          ro(co('Opacity viền', rng('_rp_bo', 0, 1, 0.05, bo))) +
          ro(co('Kiểu viền', seg('_rp_bs', LS, bs)))
        );
        html += sec('Nền khối',
          ro(co('Màu nền', cpBtn('c_fc', fcHex)), co('Opacity (0=trong suốt)', rng('_rp_fa', 0, 1, 0.05, fa)))
        );
  
      } else if (cat === 'fibo') {
        var sline  = s.line || {};
        var lc     = safeHex(sline.color, '#E8EDF2');
        var lw     = sline.size  || 1;
        var ls     = sline.style || 'solid';
        var lo     = toAlpha(sline.color, 1);
        var fa     = (ext.fillOpacity !== undefined) ? ext.fillOpacity : 0.15;
        var slbl   = (ext.showLabels !== false);
  
        html += sec('Đường Fibonacci',
          ro(co('Màu đường', cpBtn('c_lc', lc)), co('Độ dày', rng('_rp_lw', 1, 5, 1, lw))) +
          ro(co('Opacity đường', rng('_rp_lo', 0, 1, 0.05, lo))) +
          ro(co('Kiểu nét', seg('_rp_ls', LS, ls)))
        );
        html += sec('Hiển thị',
          ro(co('Opacity fill (0 = tắt)', rng('_rp_fa', 0, 0.5, 0.01, fa))) +
          tog('_rp_slbl', slbl, 'Hiện nhãn % Fibonacci')
        );
  
      } else if (cat === 'waves') {
        // Sóng Elliott, Harmonic, Chart Patterns
        var sline  = s.line || {};
        var stxt   = s.text || {};
        var lc     = safeHex(sline.color, '#3B82F6');
        var lw     = sline.size  || 1;
        var ls     = sline.style || 'solid';
        var lo     = toAlpha(sline.color, 1);
        var tc     = safeHex(stxt.color, '#E8EDF2');
        var tsz    = stxt.size || 12;
  
        html += sec('Đường kẻ sóng',
          ro(co('Màu đường', cpBtn('c_lc', lc)), co('Độ dày', rng('_rp_lw', 1, 5, 1, lw))) +
          ro(co('Opacity đường', rng('_rp_lo', 0, 1, 0.05, lo))) +
          ro(co('Kiểu nét', seg('_rp_ls', LS, ls)))
        );
        html += sec('Nhãn ký hiệu',
          ro(co('Màu nhãn', cpBtn('c_tc', tc)), co('Cỡ chữ', rng('_rp_tsz', 8, 20, 1, tsz)))
        );
  
      } else {
        // lines, pitchforks, arrows, v.v.
        var sline  = s.line || {};
        var lc     = safeHex(sline.color, '#3B82F6');
        var lw     = sline.size  || 1;
        var ls     = sline.style || 'solid';
        var lo     = toAlpha(sline.color, 1);
  
        html += sec('Đường kẻ',
          ro(co('Màu sắc', cpBtn('c_lc', lc)), co('Độ dày', rng('_rp_lw', 1, 8, 1, lw))) +
          ro(co('Opacity đường', rng('_rp_lo', 0, 1, 0.05, lo))) +
          ro(co('Kiểu nét', seg('_rp_ls', LS, ls)))
        );
      }
    } catch(e) {
      html = '<div style="padding:12px;color:#EF4444;font-size:11px">⚠ '+e.message+'</div>';
      console.error('[renderPanel]', e);
    }
  
    body.innerHTML = html;
    panel.classList.add('show');
  
    // ── Range: cập nhật display ──
    body.querySelectorAll('._rng').forEach(function(inp) {
      var vEl = document.getElementById(inp.id + '_v');
      if (!vEl) return;
      var unit = vEl.textContent.replace(/[\d.]/g, '');
      _on(inp, 'input', function() { vEl.textContent = this.value + unit; });
    });
  
    // ── Segment buttons ──
    body.querySelectorAll('._segb').forEach(function(btn) {
      _on(btn, 'click', function() {
        body.querySelectorAll('._segb[data-seg="'+this.dataset.seg+'"]').forEach(function(b){ b.classList.remove('on'); });
        this.classList.add('on');
        doAction();
      });
    });
  
    // ── Toggle ──
    body.querySelectorAll('._tog').forEach(function(t) {
      _on(t, 'click', function() {
        this.classList.toggle('on');
        if (this.id === '_rp_bdon') {
          var bx = document.getElementById('_rp_bdbox');
          if (bx) {
            var on = this.classList.contains('on');
            bx.style.opacity      = on ? '1' : '0.3';
            bx.style.pointerEvents = on ? '' : 'none';
          }
        }
        doAction();
      });
    });
  
    // ── Color Picker (hoàn toàn viết lại để fix bug #2) ──
    var PAL = [
      ['#FFFFFF','#F2F3F5','#C0C8D0','#8896A7','#4A5568','#2D3748','#1A202C','#0F141A','#060A0F','#000000'],
      ['#FFF5F5','#FED7D7','#FC8181','#F56565','#F23645','#E53E3E','#C53030','#9B2C2C','#742A2A','#450A0A'],
      ['#F0FFF4','#C6F6D5','#9AE6B4','#68D391','#48BB78','#38A169','#22C55E','#276749','#1C4532','#052E16'],
      ['#EBF8FF','#BEE3F8','#90CDF4','#63B3ED','#4299E1','#3B82F6','#2B6CB0','#2C5282','#1E3A5F','#172554'],
      ['#FFFFF0','#FEFCBF','#FAF089','#F6E05E','#ECC94B','#F59E0B','#D69E2E','#B7791F','#975A16','#78350F'],
      ['#FAF5FF','#E9D8FD','#D6BCFA','#B794F4','#9F7AEA','#8B5CF6','#6B46C1','#553C9A','#44337A','#1A0A3D'],
      ['#E0FFFF','#B2F5EA','#81E6D9','#4FD1C5','#38B2AC','#06B6D4','#0891B2','#0E7490','#155E75','#083344'],
      ['#FFF0F6','#FFD6E7','#FFA8CB','#FF79A8','#F06292','#EC4899','#DB2777','#BE185D','#9D174D','#831843']
    ];
    var _aCP = null;
    function _closeCP() { var p=document.getElementById('_rp_pop'); if(p) p.remove(); _aCP=null; }
  
    body.querySelectorAll('._cpb').forEach(function(btn) {
      var cid = btn.dataset.cp;
      _on(btn, 'click', function(ev) {
        ev.stopPropagation();
        if (_aCP === cid) { _closeCP(); return; }
        _closeCP(); _aCP = cid;
  
        // FIX BUG #2: đọc từ data-cur (luôn có giá trị từ HTML)
        var curHex = toHex(btn.dataset.cur) || '#3B82F6';
  
        var pop = document.createElement('div');
        pop.id = '_rp_pop'; pop.className = '_pop';
        var gh = '<div class="_pg">';
        PAL.forEach(function(row){ row.forEach(function(cl){
          gh += '<div class="_pc'+(cl.toUpperCase()===curHex.toUpperCase()?' on':'')+'" style="background:'+cl+'" data-c="'+cl+'"></div>';
        }); });
        gh += '</div><div class="_ph">'
            + '<span style="color:#4A5568;font-family:monospace;font-weight:800;font-size:11px;user-select:none">#</span>'
            + '<input class="_phi" id="_phi_'+cid+'" maxlength="6" value="'+curHex.slice(1).toUpperCase()+'">'
            + '</div>';
        pop.innerHTML = gh;
        document.body.appendChild(pop);
  
        var br = btn.getBoundingClientRect();
        var top = br.bottom+5, left = br.left;
        if (top+250 > window.innerHeight) top = br.top-254;
        if (left+222 > window.innerWidth)  left = window.innerWidth-224;
        pop.style.left = Math.max(4,left)+'px';
        pop.style.top  = Math.max(4,top)+'px';
  
        var fEl = document.getElementById('_cpfc_'+cid);
        function applyC(hex) {
          // FIX BUG #2: update cả visual lẫn data-cur
          if (fEl) fEl.style.background = hex;
          btn.dataset.cur = hex;
          pop.querySelectorAll('._pc').forEach(function(c){
            c.classList.toggle('on', c.dataset.c.toUpperCase()===hex.toUpperCase());
          });
          var phi = document.getElementById('_phi_'+cid);
          if (phi) phi.value = hex.slice(1).toUpperCase();
          doAction();
        }
  
        pop.querySelectorAll('._pc').forEach(function(c){
          c.addEventListener('mousedown', function(e){ e.stopPropagation(); applyC(this.dataset.c); });
        });
        var phi = document.getElementById('_phi_'+cid);
        if (phi) {
          phi.addEventListener('mousedown', function(e){ e.stopPropagation(); });
          phi.addEventListener('input', function(){
            var v = this.value.replace(/[^0-9a-fA-F]/g,''); this.value = v;
            if (v.length === 6) applyC('#'+v);
          });
        }
      });
    });
  
    _on(document, 'mousedown', function(ev){
      var pop = document.getElementById('_rp_pop');
      if (pop && !pop.contains(ev.target) && !ev.target.closest('._cpb')) _closeCP();
    });
  
    // ── Getters (tất cả đều null-safe) ──────────────────────────────────────
    // FIX BUG #3: gCP đọc data-cur (luôn hợp lệ sau init), trả về hex hoặc null
    function gCP(id) {
      var b = body.querySelector('._cpb[data-cp="'+id+'"]');
      if (!b) return null;
      return toHex(b.dataset.cur); // '#RRGGBB' hoặc null - KHÔNG BAO GIỜ thiếu '#'
    }
    function gRng(id) { var e=document.getElementById(id); return e ? parseFloat(e.value) : null; }
    function gSeg(id) { var e=body.querySelector('._segb.on[data-seg="'+id+'"]'); return e ? e.dataset.val : null; }
    function gSel(id) { var e=document.getElementById(id); return e ? e.value : null; }
    function gTog(id) { var e=document.getElementById(id); return e ? e.classList.contains('on') : false; }
    function gTa(id)  { var e=document.getElementById(id); return e ? e.value : null; }
  
    // ── 2-tier debounce: render nhanh, save chậm ──
    var _uiT, _svT;
    function doAction() {
      clearTimeout(_uiT); clearTimeout(_svT);
      _uiT = setTimeout(updateChartLive, 16);
      _svT = setTimeout(saveToStorage, 800);
    }
  
    function updateChartLive() {
      if (!currentSelectedOverlay || !global.tvChart) return;
      try {
        var ns = JSON.parse(JSON.stringify(currentSelectedOverlay.styles || {}));
        if (!ns.line)    ns.line    = {};
        if (!ns.text)    ns.text    = {};
        if (!ns.polygon) ns.polygon = {};
  
        if (cat === 'text') {
          var tc  = gCP('c_tc');
          var ff  = gSel('_rp_ff');
          var sz  = gRng('_rp_sz');
          var fw  = gSeg('_rp_fw');
          var fi  = gSeg('_rp_fi');
          var bgC = gCP('c_bgc');
          var bgA = gRng('_rp_bga');
          var bdOn = gTog('_rp_bdon');
          var bdC = gCP('c_bdc');
          var bdW = gRng('_rp_bdw');
          var bdA = gRng('_rp_bda');
          var txt = gTa('_rp_txt');
  
          // FIX BUG #4: chỉ assign khi giá trị hợp lệ (không null)
          if (tc)         ns.text.color  = tc;
          if (ff)         ns.text.family = ff;
          if (sz !== null) ns.text.size  = sz;
          if (fw)         ns.text.weight = fw;
          if (fi)         ns.text.style  = fi;
  
          ns.polygon.color       = (bgC && bgA > 0) ? mkRgba(bgC, bgA) : 'transparent';
          ns.polygon.style       = (bdOn || (bgA && bgA > 0)) ? 'strokefill' : 'fill';
          ns.polygon.borderColor = bdOn ? mkRgba((bdC || '#3B82F6'), bdA !== null ? bdA : 1) : 'transparent';
          ns.polygon.borderSize  = bdOn ? (bdW !== null ? bdW : 1) : 0;
  
          if (txt !== null) currentSelectedOverlay.extendData = txt;
  
        } else if (cat === 'shapes') {
          var bc = gCP('c_bc');
          var bw = gRng('_rp_bw');
          var bo = gRng('_rp_bo');
          var bs = gSeg('_rp_bs');
          var fc = gCP('c_fc');
          var fa = gRng('_rp_fa');
  
          if (bc) {
            ns.polygon.borderColor = mkRgba(bc, bo !== null ? bo : 1);
            ns.line.color          = mkRgba(bc, bo !== null ? bo : 1);  // KLineChart dùng line.color cho viền polygon
          }
          if (bw !== null) {
            ns.polygon.borderSize = bw;
            ns.line.size          = bw;
          }
          ns.polygon.color = (fc && fa !== null && fa > 0) ? mkRgba(fc, fa) : 'transparent';
          ns.polygon.style = 'strokefill';
          // Kiểu nét đứt cho polygon border dùng line.style trong KLineChart
          if (bs) {
            ns.line.style = bs === 'dotted' ? 'dashed' : bs;
            if (bs === 'dashed') ns.line.dashedValue = [6, 4];
            else if (bs === 'dotted') ns.line.dashedValue = [1.5, 3];
            else delete ns.line.dashedValue;
        }
  
        } else if (cat === 'fibo') {
          var lc = gCP('c_lc');
          var lw = gRng('_rp_lw');
          var lo = gRng('_rp_lo');
          var ls = gSeg('_rp_ls');
          var fa = gRng('_rp_fa');
          var sl = gTog('_rp_slbl');
  
          if (lc) { ns.line.color = mkRgba(lc, lo !== null ? lo : 1); ns.text.color = lc; }
          if (lw !== null) ns.line.size  = lw;
          if (ls) { ns.line.style = ls === 'dotted' ? 'dashed' : ls; if (ls === 'dashed') ns.line.dashedValue = [6, 4]; else if (ls === 'dotted') ns.line.dashedValue = [1.5, 3]; else delete ns.line.dashedValue; }
  
          var ne = (typeof currentSelectedOverlay.extendData === 'object' && currentSelectedOverlay.extendData)
                   ? JSON.parse(JSON.stringify(currentSelectedOverlay.extendData)) : {};
          if (fa !== null) ne.fillOpacity = fa;
          ne.showLabels = sl;
          currentSelectedOverlay.extendData = ne;
  
        } else if (cat === 'waves') {
          // FIX BUG #4: Sóng Elliott - check null trước khi assign
          var lc  = gCP('c_lc');
          var lw  = gRng('_rp_lw');
          var lo  = gRng('_rp_lo');
          var ls  = gSeg('_rp_ls');
          var tc  = gCP('c_tc');
          var tsz = gRng('_rp_tsz');
  
          if (lc)          ns.line.color  = mkRgba(lc, lo !== null ? lo : 1);
          if (lw !== null) ns.line.size   = lw;
          if (ls) { ns.line.style = ls === 'dotted' ? 'dashed' : ls; if (ls === 'dashed') ns.line.dashedValue = [6, 4]; else if (ls === 'dotted') ns.line.dashedValue = [1.5, 3]; else delete ns.line.dashedValue; }
          if (tc)          ns.text.color  = tc;
          if (tsz !== null) ns.text.size  = tsz;
  
        } else { // lines, pitchforks, arrows
          var lc = gCP('c_lc');
          var lw = gRng('_rp_lw');
          var lo = gRng('_rp_lo');
          var ls = gSeg('_rp_ls');
  
          if (lc)          ns.line.color  = mkRgba(lc, lo !== null ? lo : 1);
          if (lw !== null) ns.line.size   = lw;
          if (ls) { ns.line.style = ls === 'dotted' ? 'dashed' : ls; if (ls === 'dashed') ns.line.dashedValue = [6, 4]; else if (ls === 'dotted') ns.line.dashedValue = [1.5, 3]; else delete ns.line.dashedValue; }
        }
  
        currentSelectedOverlay.styles = ns;
        global.tvChart.overrideOverlay({
          id:         currentSelectedOverlay.id,
          styles:     ns,
          extendData: currentSelectedOverlay.extendData
        });
  
      } catch(err) {
        console.error('[updateChartLive]', err);
      }
    }
  
    function saveToStorage() {
      try {
        if (typeof saveStyles           === 'function') saveStyles();
        if (typeof global.wasaveAllOverlays === 'function') global.wasaveAllOverlays();
      } catch(e) {}
    }
  
    // Bind input/change cho tất cả controls
    body.querySelectorAll('input, textarea, select').forEach(function(el) {
      _on(el, 'input',  doAction);
      _on(el, 'change', doAction);
    });
  }

  function hidePanel() {
    const p = document.getElementById('wa-props-panel');
    if(p) p.classList.remove('show');
    currentSelectedOverlay = null;
    window.currentSelectedOverlay = null; // ← sync cả hai
}
function hideFloatToolbar() {
  var b = document.getElementById('wa-float-bar');
  if (b && b.parentNode) b.parentNode.removeChild(b);
}

function showFloatToolbar(ov, posX, posY) {
  if (!ov) return;
   // ── GIỮ VỊ TRÍ CŨ khi chỉ cập nhật icon (posX/posY = null) ──
   var existingBar = document.getElementById('wa-float-bar');
   var savedLeft = null, savedTop = null;
   if (posX === null && posY === null && existingBar) {
     savedLeft = existingBar.style.left;
     savedTop  = existingBar.style.top;
   }
  hideFloatToolbar();

  var container = document.getElementById('sc-chart-container');
  if (!container) return;
  var rect = container.getBoundingClientRect();

  var cat = typeof getToolCategory === 'function' ? getToolCategory(ov.name) : 'lines';
  var s   = ov.styles || {};
  var ext = (typeof ov.extendData === 'object' && ov.extendData) ? ov.extendData : {};

  // ── Màu chính ──────────────────────────────────────────────────
  var pc = '#3B82F6';
  if (cat === 'text')   pc = s.text    && s.text.color         ? colorToHex(s.text.color)            : '#E8EDF2';
  else if (cat === 'shapes') pc = s.polygon && s.polygon.borderColor ? colorToHex(s.polygon.borderColor) : '#3B82F6';
  else                  pc = s.line    && s.line.color          ? colorToHex(s.line.color)             : '#3B82F6';
  if (!pc.startsWith('#')) pc = '#' + pc;

  var lw       = (s.line && s.line.size)  || 1;
  var ls       = (s.line && s.line.style) || 'solid';
  var isLocked = !!ov.lock;
  var isHidden = !!ext._hidden;
  var showLine = (cat !== 'text');

  // ── SVG helpers ────────────────────────────────────────────────
  function lwSVG(h) {
    return '<span style="display:block;width:14px;height:'+h+'px;background:currentColor;border-radius:1px;margin:auto"></span>';
  }
  function lsSVG(da) {
    return '<svg width="16" height="10" viewBox="0 0 16 10"><line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" stroke-width="2" stroke-dasharray="'+da+'"/></svg>';
  }

    // ── Build HTML ─────────────────────────────────────────────────
    var html = '';
  
    var dragSVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
    var eyeShow  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var eyeHide  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    var gearSVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';
    var lockOn   = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
    var lockOff  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
    var trashSVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
  
    // Chỉ chừa lại: Drag, Config, Lock, Visibility, Delete
    html += '<div id="wa-fb-drag" title="Kéo thả" style="cursor: grab; display: flex; align-items: center; justify-content: center; width: 24px; height: 28px; color: #8896A7;">' + dragSVG + '</div>';
    html += '<div class="wa-fb-sep"></div>';
    html += '<button class="wa-fb-btn" id="wa-fb-cfg" title="Cài đặt chi tiết">'+gearSVG+'</button>';
    html += '<button class="wa-fb-btn'+(isLocked?' wa-fb-on':'')+'" id="wa-fb-lk" title="'+(isLocked?'Mở khóa':'Khóa')+'">'+(isLocked?lockOn:lockOff)+'</button>';
    html += '<button class="wa-fb-btn'+(isHidden?' wa-fb-on':'')+'" id="wa-fb-vis" title="'+(isHidden?'Hiện':'Ẩn')+'">'+(isHidden?eyeHide:eyeShow)+'</button>';
    html += '<button class="wa-fb-btn wa-fb-del" id="wa-fb-rm" title="Xóa">'+trashSVG+'</button>';

  // ── Tạo DOM ────────────────────────────────────────────────────
  var bar = document.createElement('div');
  bar.id = 'wa-float-bar';
  bar.className = 'wa-float-bar';
  bar.innerHTML = html;

  // ─────────────────────────────────────────────────────────────
  // 🎯 SMART POSITIONING — Tránh mép container, không bao giờ bị cắt
  // Bước 1: Append trước (ẩn) để đo kích thước thực của bar
  // ─────────────────────────────────────────────────────────────
  bar.style.visibility = 'hidden';   // ẩn để đo, chưa animate
  bar.style.opacity    = '0';
  bar.style.transform  = 'translateY(6px) scale(0.97)';
  bar.style.transition = 'none';
  container.appendChild(bar);

  requestAnimationFrame(function() {
    // ── Nếu chỉ cập nhật icon, khôi phục vị trí cũ, không animate ──
  if (savedLeft !== null) {
    bar.style.left       = savedLeft;
    bar.style.top        = savedTop;
    bar.style.visibility = 'visible';
    bar.style.transition = 'none';
    bar.style.opacity    = '1';
    bar.style.transform  = 'translateY(0) scale(1)';
    bar.classList.add('wa-fb-show');
    return;   // ← bỏ qua toàn bộ logic tính vị trí bên dưới
  }
    var bW     = bar.offsetWidth  || (showLine ? 320 : 180);
    var bH     = bar.offsetHeight || 40;
    var MARGIN = 6;                   // khoảng cách tối thiểu với mép container
    var BAR_OFFSET_Y = 50;            // thanh nằm phía TRÊN con trỏ bao nhiêu px
    var safeBottom = (window.visualViewport && window.visualViewport.height) ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;

    // Tọa độ gốc (tính theo container)
    var cx = (posX != null ? posX : (_fbX - rect.left));
    var cy = (posY != null ? posY : (_fbY - rect.top));

    // Căn giữa bar theo chiều ngang so với điểm click
    var left = cx - bW / 2;
    // Mặc định: hiện phía TRÊN điểm click
    var top  = cy - BAR_OFFSET_Y;

    // ── Flip dọc: nếu phía trên không đủ chỗ → đặt xuống dưới ──
    if (top < MARGIN) {
      top = cy + 16;  // hiện phía DƯỚI điểm click
    }
    // Nếu xuống dưới cũng không đủ chỗ (màn hình rất nhỏ) → ép vào MARGIN
    if (top + bH > rect.height - MARGIN - safeBottom) {
      top = rect.height - bH - MARGIN - safeBottom;
    }

    // ── Clamp ngang: không ra ngoài trái/phải ──────────────────
    left = Math.max(MARGIN, Math.min(left, rect.width - bW - MARGIN));

    bar.style.left = left + 'px';
    bar.style.top  = top  + 'px';

    // ── Animate in ─────────────────────────────────────────────
    bar.style.visibility = 'visible';
    bar.style.transition = 'opacity 0.16s ease, transform 0.16s cubic-bezier(0.34,1.56,0.64,1)';
    requestAnimationFrame(function() {
      bar.style.opacity   = '1';
      bar.style.transform = 'translateY(0) scale(1)';
      bar.classList.add('wa-fb-show');
    });
  });

  
  bar.querySelector('#wa-fb-vis').addEventListener('click', function() {
    _fbToggleVisible(ov);
  });
  bar.querySelector('#wa-fb-cfg').addEventListener('click', function() {
    if (typeof renderPanel === 'function') renderPanel(ov);
  });
  bar.querySelector('#wa-fb-lk').addEventListener('click', function() {
    _fbToggleLock(ov);
  });
  bar.querySelector('#wa-fb-rm').addEventListener('click', function() {
    if (!global.tvChart) return;
    if (typeof saveHistory === 'function') saveHistory('delete', ov);
    global.tvChart.removeOverlay({ id: ov.id });
    if (typeof global.__wa_untrack_overlay === 'function') global.__wa_untrack_overlay(ov.id);
    else if (global.__wa_overlay_map) global.__wa_overlay_map.delete(ov.id);
    hideFloatToolbar();
    if (typeof hidePanel === 'function') hidePanel();
    if (typeof saveAllOverlays === 'function') saveAllOverlays();
  });
  var dragHandle = bar.querySelector('#wa-fb-drag');
  var isDragging = false;
  var startX, startY, initLeft, initTop;

  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initLeft = parseFloat(bar.style.left) || 0;
    initTop = parseFloat(bar.style.top) || 0;
    dragHandle.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    bar.style.left = (initLeft + dx) + 'px';
    bar.style.top = (initTop + dy) + 'px';
  });

  document.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
      // Cập nhật lại _fbX và _fbY để khi save vị trí bar nó được ghi đè
      var rect = bar.getBoundingClientRect();
      _fbX = rect.left;
      _fbY = rect.top;
    }
  });
}

function _fbSetColor(ov, cat, hex) {
  if (!global.tvChart || !ov) return;
  var ns = JSON.parse(JSON.stringify(ov.styles || {}));
  if (cat === 'text')        { if (!ns.text)    ns.text    = {}; ns.text.color          = hex; }
  else if (cat === 'shapes') { if (!ns.polygon) ns.polygon = {}; ns.polygon.borderColor = hex; }
  else                       { if (!ns.line)    ns.line    = {}; ns.line.color           = hex; }
  ov.styles = ns;
  global.tvChart.overrideOverlay({ id: ov.id, styles: ns });
  if (typeof saveAllOverlays === 'function') saveAllOverlays();
}

function _fbSetLineWidth(ov, w) {
  if (!global.tvChart || !ov) return;
  var ns = JSON.parse(JSON.stringify(ov.styles || {}));
  if (!ns.line) ns.line = {};
  ns.line.size = w;
  ov.styles = ns;
  global.tvChart.overrideOverlay({ id: ov.id, styles: ns });
  if (typeof saveAllOverlays === 'function') saveAllOverlays();
}

function _fbSetLineStyle(ov, style) {
  if (!global.tvChart || !ov) return;
  var ns = JSON.parse(JSON.stringify(ov.styles || {}));
  if (!ns.line) ns.line = {};
  ns.line.style = style;
  ov.styles = ns;
  global.tvChart.overrideOverlay({ id: ov.id, styles: ns });
  if (typeof saveAllOverlays === 'function') saveAllOverlays();
}

function _fbToggleVisible(ov) {
  if (!global.tvChart || !ov) return;
  var ext = (typeof ov.extendData === 'object' && ov.extendData) ? JSON.parse(JSON.stringify(ov.extendData)) : {};
  ext._hidden = !ext._hidden;

  var ns = JSON.parse(JSON.stringify(ov.styles || {}));
  if (!ns.line)    ns.line    = {};
  if (!ns.polygon) ns.polygon = {};
  if (!ns.text)    ns.text    = {};

  if (ext._hidden) {
    ov._hiddenExtSnap = JSON.stringify(ov.extendData || {});
    ns.line.color          = 'rgba(0,0,0,0)';
    ns.polygon.color       = 'rgba(0,0,0,0)';
    ns.polygon.borderColor = 'rgba(0,0,0,0)';
    ns.text.color          = 'rgba(0,0,0,0)';
    ns.text.backgroundColor = 'rgba(0,0,0,0)';
    ext.fillOpacity = 0;
  } else {
    delete ns.line.color;
    delete ns.polygon.color;
    delete ns.polygon.borderColor;
    delete ns.text.color;
    delete ns.text.backgroundColor;
    if (ov._hiddenExtSnap) {
      try { ext = JSON.parse(ov._hiddenExtSnap); } catch(e) {}
      delete ov._hiddenExtSnap;
    }
    ext._hidden = false;
  }

  ov.extendData = ext;
  ov.styles = ns;
  global.tvChart.overrideOverlay({ id: ov.id, styles: ns, extendData: ext });
  if (typeof saveAllOverlays === 'function') saveAllOverlays();
  if (typeof showFloatToolbar === 'function') showFloatToolbar(ov, null, null);
}

function _fbToggleLock(ov) {
  if (!global.tvChart || !ov) return;
  ov.lock = !ov.lock;
  global.tvChart.overrideOverlay({ id: ov.id, lock: ov.lock });
  if (typeof saveAllOverlays === 'function') saveAllOverlays();
  // Re-render toolbar để cập nhật icon khóa
  if (typeof showFloatToolbar === 'function') showFloatToolbar(ov, null, null);
}
  function bindContextMenu(panel) {
    // Tất cả sự kiện cho Props Panel đã được xử lý trong _bindToolbarLocalEvents.
    // Hàm này được giữ lại để tránh lỗi nếu có nơi nào gọi đến.
  }

  // ============================================================
  // 6.5. BỔ SUNG CÁC HÀM BỊ THẤT LẠC KHI REFACTOR
  // ============================================================
  

  function saveHistory(action, obj) {
      if (!obj) return;
      
      var snap;
      try { snap = JSON.parse(JSON.stringify(obj)); } catch(e) { snap = Object.assign({}, obj); }
      if (snap && snap.points && Array.isArray(snap.points)) {
        snap.points = snap.points.map(function(p){ return { timestamp: p.timestamp, dataIndex: p.dataIndex, value: p.value }; });
      }
      undoStack.push({ action: action, overlay: snap });
      
      // Xóa entry cũ nhất nếu vượt quá 50 bước
      if (undoStack.length > MAX_HISTORY) undoStack.shift(); 
      
      // Reset redo mỗi khi có hành động vẽ/xóa mới
      redoStack = []; 
  }

  function _wa_applyHistory(entry, isRedo) {
    if (!entry || !entry.overlay || !global.tvChart) return;
    var ov = entry.overlay;
    if (entry.action === 'add') {
      if (isRedo) {
        var newId = global.tvChart.createOverlay(ov);
        if (newId) { ov.id = newId; _wa_trackOverlay(ov); currentSelectedOverlay = ov; window.currentSelectedOverlay = ov; }
      } else {
        global.tvChart.removeOverlay({ id: ov.id });
        _wa_untrackOverlay(ov.id);
        if (currentSelectedOverlay && currentSelectedOverlay.id === ov.id) { currentSelectedOverlay = null; window.currentSelectedOverlay = null; hideFloatToolbar(); hidePanel(); }
      }
      return;
    }
    if (entry.action === 'delete') {
      if (isRedo) {
        global.tvChart.removeOverlay({ id: ov.id });
        _wa_untrackOverlay(ov.id);
        if (currentSelectedOverlay && currentSelectedOverlay.id === ov.id) { currentSelectedOverlay = null; window.currentSelectedOverlay = null; hideFloatToolbar(); hidePanel(); }
      } else {
        var restoredId = global.tvChart.createOverlay(ov);
        if (restoredId) { ov.id = restoredId; _wa_trackOverlay(ov); currentSelectedOverlay = ov; window.currentSelectedOverlay = ov; showFloatToolbar(ov, null, null); renderPanel(ov); }
      }
    }
  }
  function undoLastAction() {
    var entry = undoStack.pop();
    if (!entry) return;
    _wa_applyHistory(entry, false);
    redoStack.push(entry);
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
  }
  function redoLastAction() {
    var entry = redoStack.pop();
    if (!entry) return;
    _wa_applyHistory(entry, true);
    undoStack.push(entry);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
  }

  function activateTool(toolId) {
    if (!global.tvChart) return;
    const container = document.getElementById('sc-chart-container');
    if (!container) return;

    if (typeof hideFloatToolbar === 'function') hideFloatToolbar();
    if (typeof hidePanel === 'function') hidePanel();
    currentSelectedOverlay = null;
    window.currentSelectedOverlay = null;
    try { global.tvChart.cancelDrawing(); } catch(e){}
    if (typeof hideFloatToolbar === 'function') hideFloatToolbar();
    if (typeof hidePanel === 'function') hidePanel();
    if (toolId === 'pointer') { isDrawingSessionActive = false; container.classList.remove('wa-drawing-mode'); return; }
    isDrawingSessionActive = true;
    container.classList.add('wa-drawing-mode');

    const TEXT_TOOLS = ['plainText','anchoredText','note','priceNote','pin','annotation','comment','priceLabel','signpost','flagMarker'];

    //ĐÃ XÓA KHỐI NÀY ĐỂ BỎ POPUP
    // if (TEXT_TOOLS.includes(toolId)) {
    //   if (typeof createTextOverlay === 'function') createTextOverlay(global.tvChart, toolId);
    //   return;
    // }

    try {
      let tType = typeof getToolCategory === 'function' ? getToolCategory(toolId) : 'lines'; 
      let s = (typeof toolStyles !== 'undefined' && toolStyles[tType]) ? toolStyles[tType] : {};
      let config = { name: toolId, lock: false, styles: {} };
      
      if(tType === 'lines' || tType === 'waves') {
        config.styles.line = {
          color: typeof hexToRgba === 'function' ? hexToRgba(s.lineColor || '#3B82F6', s.lineOpacity !== undefined ? s.lineOpacity : 1) : (s.lineColor || '#3B82F6'),
          size: s.lineWidth || 1,
          style: s.lineStyle || 'solid',
          dashedValue: s.lineStyle === 'dashed' ? [6, 4] : s.lineStyle === 'dotted' ? [1.5, 3] : undefined
        };
      } else if (tType === 'shapes') {
        config.styles.polygon = { style: 'stroke_fill', color: typeof hexToRgba === 'function' ? hexToRgba(s.fillColor || '#3B82F6', s.fillOpacity !== undefined ? s.fillOpacity : 0.15) : '#3B82F6', borderColor: typeof hexToRgba === 'function' ? hexToRgba(s.borderColor || '#3B82F6', s.borderOpacity !== undefined ? s.borderOpacity : 1) : (s.borderColor || '#3B82F6'), borderSize: s.borderWidth || 1 };
        config.styles.line = { color: typeof hexToRgba === 'function' ? hexToRgba(s.borderColor || '#3B82F6', s.borderOpacity !== undefined ? s.borderOpacity : 1) : (s.borderColor || '#3B82F6'), size: s.borderWidth || 1, style: s.borderStyle || 'solid' };
      } else if (tType === 'fibo') {
        config.styles.line = {
  color: typeof hexToRgba === 'function' ? hexToRgba(s.lineColor || '#E8EDF2', s.lineOpacity !== undefined ? s.lineOpacity : 1) : (s.lineColor || '#E8EDF2'),
  size: 1,
  style: s.lineStyle || 'solid',
  dashedValue: s.lineStyle === 'dashed' ? [6, 4] : s.lineStyle === 'dotted' ? [1.5, 3] : undefined
};
      } else if (tType === 'text') {
        config.extendData = (typeof toolStyles !== 'undefined' && toolStyles.text && toolStyles.text.textInput) ? toolStyles.text.textInput : 'Văn bản...';
        config.styles.text = { color: s.textColor || '#E8EDF2', size: s.textSize || 14, weight: 'normal', style: 'normal', family: 'sans-serif' };
      }
// THÊM 2 DÒNG NÀY TRƯỚC createOverlay:
config.onSelected = function(event) {
  isDrawingSessionActive = false;
  var ov = event && event.overlay ? event.overlay : null;
  if (!ov) return;
  currentSelectedOverlay = ov;
  window.currentSelectedOverlay = ov;
  if (document.getElementById('wa-text-editor-backdrop')) return;
  if (typeof showFloatToolbar === 'function') showFloatToolbar(ov, null, null);
  if (typeof renderPanel === 'function') renderPanel(ov);
};
config.onDeselected = function() {
  if (typeof hideFloatToolbar === 'function') hideFloatToolbar();
};

      global.tvChart.createOverlay(config);
    } catch (err) { 
      if (typeof showToast === 'function') showToast('Lỗi khởi tạo công cụ. Hệ thống sẽ khôi phục về mặc định.'); 
    }
  }


// ============================================================
// 7. AUTO-HEAL & PERSISTENCE — REWRITE v4.0 (GIẢI PHÁP BINARY SEARCH)
// ============================================================

global.__wa_overlay_map = global.__wa_overlay_map || new Map();

function getDrawingKey() {
  let sym = (window.currentChartToken && (window.currentChartToken.symbol || window.currentChartToken)) || window.__wa_currentSymbol || 'UNKNOWN';
  sym = String(sym).toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Dùng MỘT Key duy nhất để hình vẽ hiển thị đồng bộ qua MỌI khung giờ
  return 'wa_drawings_' + sym;
}

function saveAllOverlays() {
  try {
    let dataToSave = [];
    global.__wa_overlay_map.forEach(function(data) {
      dataToSave.push(data);
    });
    localStorage.setItem(getDrawingKey(), JSON.stringify(dataToSave));
  } catch(e) {}
}

// ✅ FIX 1: Hàm Debounce tự viết để chống giật lag khi ghi ổ cứng
function _wa_debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() { func.apply(context, args); }, wait);
    };
}

// Tạo một phiên bản "lưu chậm 400ms"
var _saveAllOverlaysDebounced = _wa_debounce(saveAllOverlays, 400);

// Gán bản "lưu chậm" vào hệ thống vẽ (Để user vẽ thoải mái không bị giật)
global.__wa_saveAllOverlays = _saveAllOverlaysDebounced;

// Gán bản "LƯU NGAY LẬP TỨC" (Sync) vào một biến riêng để dùng khi khẩn cấp
global.__wa_saveAllOverlays_SYNC = saveAllOverlays;

function _wa_trackOverlay(o) {
  if (!o || !o.id) return;
  // BẮT BUỘC xóa dataIndex khi lưu để KLineChart không ngáo
  var cleanPoints = (o.points || []).map(function(p) { return { timestamp: p.timestamp, value: p.value }; });
  global.__wa_overlay_map.set(o.id, { name: o.name, id: o.id, points: cleanPoints, styles: o.styles, lock: !!o.lock, extendData: o.extendData });
}

function _wa_untrackOverlay(id) {
  if (id) global.__wa_overlay_map.delete(id);
}

// 🌟 THUẬT TOÁN BINARY SEARCH SIÊU TỐC TÌM CÂY NẾN GẦN NHẤT
function _wa_findNearestDataIndex(dataList, targetTs) {
    if (!dataList || dataList.length === 0) return 0;
    let minDiff = Infinity;
    let bestIndex = 0;
    let left = 0;
    let right = dataList.length - 1;
    
    while (left <= right) {
        let mid = Math.floor((left + right) / 2);
        let ts = dataList[mid].timestamp;
        
        if (ts === targetTs) return mid; // Trúng phóc
        
        let diff = Math.abs(ts - targetTs);
        if (diff < minDiff) {
            minDiff = diff;
            bestIndex = mid; // Lưu lại cây nến gần nhất
        }
        if (ts < targetTs) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return bestIndex;
}

let _waRestoreTimer = null;
let _waRestoreAttempts = 0;
let _waActiveKey = '';

function restoreOverlays() {
  if (!global.tvChart) return;
  clearInterval(_waRestoreTimer);
  _waRestoreAttempts = 0;

  _waRestoreTimer = setInterval(function() {
    _waRestoreAttempts++;
    if (_waRestoreAttempts > 25) { clearInterval(_waRestoreTimer); return; }

    let dataList = global.tvChart.getDataList();
    // Đổi thành === 0 để đảm bảo coin mới list (ít nến) vẫn khôi phục được
    if (!dataList || dataList.length === 0) return;

    clearInterval(_waRestoreTimer);

    let key = getDrawingKey();
    if (_waActiveKey && _waActiveKey !== key) {
      try { global.tvChart.removeOverlay(); } catch(e) {}
      global.__wa_overlay_map.clear();
    }
    _waActiveKey = key;

    let saved = localStorage.getItem(key);
    if (!saved || saved === '[]') return;

    let overlayDefs;
    try { overlayDefs = JSON.parse(saved); } catch(e) { return; }
    if (!Array.isArray(overlayDefs) || overlayDefs.length === 0) return;

    if (global.__wa_overlay_map.size >= overlayDefs.length) return;

    try { global.tvChart.removeOverlay(); } catch(e) {}
    
    // Xóa map cũ trước khi restore
    global.__wa_overlay_map.clear();

    overlayDefs.forEach(function(o) {
      try {
        // 🌟 BÍ QUYẾT ĐẦU NGÀNH: Ép KLineChart phải nghe lời bằng cách tự tính dataIndex mới!
        var mappedPoints = (o.points || []).map(function(p) {
            let newIdx = _wa_findNearestDataIndex(dataList, p.timestamp);
            return { timestamp: p.timestamp, dataIndex: newIdx, value: p.value };
        });
        
        let cfg = {
          id: o.id,
          name: o.name,
          points: mappedPoints,
          styles: o.styles,
          lock: !!o.lock,
          extendData: o.extendData,
          onSelected: function(event) {
            var ov = event && event.overlay ? event.overlay : null;
            if (!ov) return;
            currentSelectedOverlay = ov;
            window.currentSelectedOverlay = ov;
            if (typeof renderPanel === 'function') renderPanel(ov);
          },
          onDeselected: function() {}
        };
        let newId = global.tvChart.createOverlay(cfg);
        
        if (newId) {
          global.__wa_overlay_map.set(newId, Object.assign({}, cfg, { id: newId }));
        }
      } catch(e) {}
    });
  }, 100);
}
global.__wa_restoreOverlays = restoreOverlays;


// ============================================================
// 7.4 GLOBAL HOOKS — Gọi từ chart-ui.js bên ngoài
// ============================================================

window.__wa_onIntervalChange = function(newInterval) {
  // ✅ Dùng bản SYNC để lưu tức thì trước khi bộ nhớ bị xóa
  if (typeof global.__wa_saveAllOverlays_SYNC === 'function') {
      global.__wa_saveAllOverlays_SYNC();
  }
  if (global.__wa_overlay_map) global.__wa_overlay_map.clear();
};

window.__wa_onSymbolChange = function(newSymbol) {
  // ✅ Dùng bản SYNC để lưu tức thì
  if (typeof global.__wa_saveAllOverlays_SYNC === 'function') {
      global.__wa_saveAllOverlays_SYNC();
  }
  window.__wa_currentSymbol = String(newSymbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (global.__wa_overlay_map) global.__wa_overlay_map.clear();
};

window.__wa_onChartReady = function() {
  if (!global.tvChart) return;
  global.tvChart.__wa_chart_events_bound = false;
  if (typeof _bindChartEventsOnce === 'function') _bindChartEventsOnce();
  
  if (typeof global.__wa_restoreOverlays === 'function') {
      global.__wa_restoreOverlays();
  }
};


// ============================================================
// 7.5 BIND CORE EVENTS — CHỈ GẮN 1 LẦN DUY NHẤT
// ============================================================
var _waCoreEventsBound = false;
var _cachedContainer = null; // ✅ FIX 5: Cache chart container

function bindCoreEventsOnce() {
  if (_waCoreEventsBound) return; 
  _waCoreEventsBound = true;

  var _isDragging = false;
  var _startX = 0, _startY = 0, _initLeft = 0, _initTop = 0;
  var _dragRaf = null;
  var _cachedToolbar = null;

  function _clampFloatBarToViewport() {
    var bar = document.getElementById('wa-float-bar');
    var container = document.getElementById('sc-chart-container');
    if (!bar || !container) return;
    var M = 6;
    var safeBottom = (window.visualViewport && window.visualViewport.height) ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;
    var maxL = Math.max(M, container.clientWidth - bar.offsetWidth - M);
    var maxT = Math.max(M, container.clientHeight - bar.offsetHeight - M - safeBottom);
    var left = parseFloat(bar.style.left || '0');
    var top  = parseFloat(bar.style.top  || '0');
    if (isNaN(left)) left = M;
    if (isNaN(top))  top  = M;
    bar.style.left = Math.max(M, Math.min(left, maxL)) + 'px';
    bar.style.top  = Math.max(M, Math.min(top,  maxT)) + 'px';
  }

  document.addEventListener('mousemove', function(e){ _fbX = e.clientX; _fbY = e.clientY; }, { passive: true });
  document.addEventListener('touchend', function(e){ if(e.changedTouches&&e.changedTouches[0]){ _fbX=e.changedTouches[0].clientX; _fbY=e.changedTouches[0].clientY; } }, { passive: true });

  document.addEventListener('mousemove', function(e) {
    if (!_isDragging) return;
    if (_dragRaf) cancelAnimationFrame(_dragRaf);
    _dragRaf = requestAnimationFrame(function() {
      var tb = _cachedToolbar || (_cachedToolbar = document.querySelector('.wa-toolbar'));
      if (!tb) { _isDragging = false; return; }
      var dx = e.clientX - _startX;
      var dy = e.clientY - _startY;
      var TBW = tb.offsetWidth  || 48;
      var TBH = tb.offsetHeight || 300;
      var M   = 4;
      tb.style.left = Math.max(M, Math.min(_initLeft + dx, window.innerWidth  - TBW - M)) + 'px';
      tb.style.top  = Math.max(M, Math.min(_initTop  + dy, window.innerHeight - TBH - M)) + 'px';
    });
  });

  document.addEventListener('touchmove', function(e) {
    if (!_isDragging || !e.touches || !e.touches.length) return;
    e.preventDefault();
    if (_dragRaf) cancelAnimationFrame(_dragRaf);
    _dragRaf = requestAnimationFrame(function() {
      var tb = _cachedToolbar || (_cachedToolbar = document.querySelector('.wa-toolbar'));
      if (!tb) { _isDragging = false; return; }
      var dx = e.touches[0].clientX - _startX;
      var dy = e.touches[0].clientY - _startY;
      var TBW = tb.offsetWidth  || 48;
      var TBH = tb.offsetHeight || 300;
      var M   = 4;
      tb.style.left = Math.max(M, Math.min(_initLeft + dx, window.innerWidth  - TBW - M)) + 'px';
      tb.style.top  = Math.max(M, Math.min(_initTop  + dy, window.innerHeight - TBH - M)) + 'px';
    });
  }, { passive: false });

  document.addEventListener('mouseup', function() {
    if (_isDragging) {
      _isDragging = false;
      document.body.style.userSelect = '';
    }
  });

  document.addEventListener('touchend', function() {
    if (_isDragging) {
      _isDragging = false;
      document.body.style.userSelect = '';
    }
  });

  document.addEventListener('mousedown', function(e) {
    var grip = e.target.closest('.wa-drag-grip');
    if (!grip) return;
    _isDragging = true;
    _startX = e.clientX;
    _startY = e.clientY;
    var tb = document.querySelector('.wa-toolbar');
    _initLeft = tb ? tb.offsetLeft : 0;
    _initTop  = tb ? tb.offsetTop  : 0;
    _cachedToolbar = tb;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousedown', function(e) {
    if (isDrawingSessionActive) return;
    var bar = document.getElementById('wa-float-bar');
    if (!bar) return;
    if (bar.contains(e.target)) return;
    var panel = document.getElementById('wa-props-panel');
    if (panel && panel.contains(e.target)) return;
    var tb = document.querySelector('.wa-toolbar');
    if (tb && tb.contains(e.target)) return;
    var _container = document.getElementById('sc-chart-container');
    if (_container && _container.classList.contains('wa-drawing-mode')) return;
    if (typeof hideFloatToolbar === 'function') hideFloatToolbar();
    if (typeof hidePanel === 'function') hidePanel();
  }, { passive: true });

  document.addEventListener('touchstart', function(e) {
    var grip = e.target.closest('.wa-drag-grip');
    if (!grip || !e.touches || !e.touches.length) return;
    _isDragging = true;
    _startX = e.touches[0].clientX;
    _startY = e.touches[0].clientY;
    var tb = document.querySelector('.wa-toolbar');
    _initLeft = tb ? tb.offsetLeft : 0;
    _initTop  = tb ? tb.offsetTop  : 0;
    _cachedToolbar = tb;
    document.body.style.userSelect = 'none';
  }, { passive: false });

  document.addEventListener('dblclick', function(e) {
    if (e.target.closest('.wa-drag-grip')) {
      var tb = document.querySelector('.wa-toolbar');
      if (tb) tb.classList.toggle('collapsed');
    }
  });

  var _lastTapTime = 0;
  document.addEventListener('touchstart', function(e) {
    if (!e.target.closest('.wa-drag-grip')) return;
    var now = Date.now();
    if (now - _lastTapTime < 300) {
      var tb = document.querySelector('.wa-toolbar');
      if (tb) tb.classList.toggle('collapsed');
      _lastTapTime = 0;
    } else {
      _lastTapTime = now;
    }
  }, { passive: true });
  window.addEventListener('resize', _clampFloatBarToViewport, { passive: true });
  document.addEventListener('scroll', _clampFloatBarToViewport, { passive: true, capture: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', _clampFloatBarToViewport, { passive: true });
    window.visualViewport.addEventListener('scroll', _clampFloatBarToViewport, { passive: true });
  }
  document.addEventListener('keydown', function(e) {
    var tag = e.target.tagName;
    var isInput = (tag === 'INPUT' || tag === 'TEXTAREA');
    var key = (e.key || '').toLowerCase();

    if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) { if (typeof redoLastAction === 'function') redoLastAction(); }
      else { if (typeof undoLastAction === 'function') undoLastAction(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && key === 'y') {
      e.preventDefault();
      if (typeof redoLastAction === 'function') redoLastAction();
      return;
    }

    if (e.key === 'Escape') {
      if (global.tvChart) global.tvChart.cancelDrawing();
      activateTool('pointer');
      if (typeof hidePanel === 'function') hidePanel();
      if (typeof hideFloatToolbar === 'function') hideFloatToolbar();  // ← THÊM DÒNG NÀY
      if (isInput) e.target.blur();
      return;
    }

    if (!isInput) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && typeof currentSelectedOverlay !== 'undefined' && currentSelectedOverlay) {
        if (global.tvChart) {
          if (typeof saveHistory === 'function') saveHistory('delete', currentSelectedOverlay);
          global.tvChart.removeOverlay({ id: currentSelectedOverlay.id });
          _wa_untrackOverlay(currentSelectedOverlay.id); 
          if (typeof hidePanel === 'function') hidePanel();
          if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
        }
      }
    }
  });
}

// ============================================================
// 7.6 MOUNT DOM — Chỉ chèn HTML Elements, KHÔNG bind global events
// ============================================================
function mountDOM() {
  var container = document.getElementById('sc-chart-container');
  if (!container) return;

  if (container.querySelector('.wa-toolbar')) return;

  if (typeof injectCSS === 'function') injectCSS();
  if (typeof registerProExtensions === 'function') registerProExtensions();

  var sidebar = document.createElement('div');
  sidebar.className = 'wa-toolbar';
  sidebar.innerHTML = typeof buildToolbar === 'function' ? buildToolbar() : '';
  container.appendChild(sidebar);

  var panel = document.createElement('div');
  panel.className = 'wa-props-panel';
  panel.id = 'wa-props-panel';
  panel.innerHTML = `
    <div class="wa-panel-header">Cài đặt công cụ
      <button class="wa-close-btn" title="Đóng (Esc)">✕</button>
    </div>
    <div class="wa-panel-body">
      <div class="wa-panel-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
          style="width:36px;height:36px;margin-bottom:8px;color:var(--wa-text-muted)">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <span>Chọn hoặc vẽ một hình</span>
      </div>
    </div>
    <div class="wa-panel-footer">
      <button class="wa-action-btn" id="wa-btn-p-lock" title="Khoá hình">Khoá</button>
      <button class="wa-action-btn delete" id="wa-btn-p-del" title="Xoá hình">Xoá</button>
    </div>`;
  container.appendChild(panel);

  _bindToolbarLocalEvents(sidebar, panel);
  if (typeof bindContextMenu === 'function') bindContextMenu(panel);
}

function _bindToolbarLocalEvents(toolbar, panel) {
  // ✅ FIX 5: Dùng cache container
  var container = _cachedContainer || (_cachedContainer = document.getElementById('sc-chart-container'));
  
  // ✅ FIX 4: Cache danh sách nút bấm (Lazy load)
  var _tbBtns = [];
  function _getTbBtns() {
      if (!_tbBtns.length) _tbBtns = Array.from(toolbar.querySelectorAll('.wa-tb-btn'));
      return _tbBtns;
  }

  toolbar.addEventListener('click', function(e) {
    var menuItem = e.target.closest('.wa-menu-item');
    var btn = e.target.closest('.wa-tb-btn[data-tool]');
    var toolId = null;
    if (menuItem) {
      toolId = menuItem.getAttribute('data-tool');
      _getTbBtns().forEach(function(b) { b.classList.remove('active'); });
      menuItem.closest('.wa-tb-group').querySelector('.wa-tb-btn').classList.add('active');

            // ── Đóng menu sau khi chọn tool ──────────────────────────────
            var group = menuItem.closest('.wa-tb-group');
            var menu  = group ? group.querySelector('.wa-tb-menu') : null;
            if (menu) {
              // 1. Ẩn menu vừa click — dùng '' để trả quyền về CSS :hover
              menu.style.display = 'none';
setTimeout(function() { menu.style.display = ''; }, 200); // ← reset sau 200ms
            
              // 2. Desktop: mouseleave không cần làm gì thêm vì CSS đã tự ẩn
              // (xóa hoàn toàn dòng group.addEventListener mouseleave)
            
              // 3. Mobile: closeMenuOutside — dùng '' thay 'none'
              function closeMenuOutside(e) {
                if (!group.contains(e.target)) {
                  menu.style.display = '';  // ← đúng rồi, giữ nguyên
                  document.removeEventListener('mousedown', closeMenuOutside);
                  document.removeEventListener('touchstart', closeMenuOutside);
                }
              }
              setTimeout(function() {
                document.addEventListener('mousedown', closeMenuOutside);
                document.addEventListener('touchstart', closeMenuOutside, { passive: true });
              }, 0);
            
              // 4. Đóng tất cả menu khác — dùng '' thay 'none'
              document.querySelectorAll('.wa-tb-menu').forEach(function(m) {
                              });
            }

    } else if (btn) {
      toolId = btn.getAttribute('data-tool');
      _getTbBtns().forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    }
    if (toolId) activateTool(toolId);
  });

  // NÚT XÓA HÌNH ĐANG CHỌN
var delSelBtn = toolbar.querySelector('#wa-btn-del-sel');
if (delSelBtn) {
  var _delSelSnapshot = null;
// ── THÊM: Mờ mặc định khi chưa chọn hình ──────────────────
window._syncDelSelBtn = function(hasSelection) {
  var btn = document.querySelector('#wa-btn-del-sel');
  if (!btn) return;
  btn.style.opacity    = hasSelection ? '1'       : '0.35';
  btn.style.cursor     = hasSelection ? 'pointer' : 'not-allowed';
  btn.style.transition = 'opacity 0.2s ease';
  btn.title            = hasSelection ? 'Xoá hình đang chọn [Del]' : 'Chưa chọn hình nào';
};
window._syncDelSelBtn(false); // mờ mặc định khi load
// ── HẾT THÊM ────────────────────────────────────────────────
  function _findSelectedOverlay() {
    if (currentSelectedOverlay) return currentSelectedOverlay;
    if (window.currentSelectedOverlay) return window.currentSelectedOverlay;
    // Dùng đúng tên: waoverlaymap (toàn bộ lowercase)
    if (global.waoverlaymap && global.tvChart) {
      for (var _id of global.waoverlaymap.keys()) {
        try {
          var _ov = global.tvChart.getOverlayById(_id);
          if (_ov && _ov.selected) return _ov;
        } catch(e) {}
      }
    }
    return null;
  }

  delSelBtn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    e.stopPropagation();
    _delSelSnapshot = _findSelectedOverlay();
  }, { passive: false });

  delSelBtn.addEventListener('mousedown', function(e) {
    e.stopPropagation();
    _delSelSnapshot = _findSelectedOverlay();
  });

  delSelBtn.addEventListener('click', function() {
    var sel = _delSelSnapshot || _findSelectedOverlay();
    _delSelSnapshot = null;

    if (sel && global.tvChart) {
      if (typeof saveHistory === 'function') saveHistory('delete', sel);
      global.tvChart.removeOverlay({ id: sel.id });
      if (typeof _wa_untrackOverlay === 'function') _wa_untrackOverlay(sel.id);
      currentSelectedOverlay = null;
      window.currentSelectedOverlay = null;
      if (typeof hidePanel === 'function') hidePanel();
      if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
      if (typeof showToast === 'function') showToast('Đã xóa hình');
      window._syncDelSelBtn(false);
    } else {
      if (typeof showToast === 'function') showToast('Hãy chọn một hình trước khi xóa');
    }
  });
}

  // 🌟 2. NÚT XÓA TẤT CẢ (Đã gỡ bỏ cancelDrawing gây lỗi)
  var clearBtn = toolbar.querySelector('#wa-btn-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (typeof createConfirmModal === 'function') {
        createConfirmModal('Bạn có chắc muốn xoá tất cả bản vẽ?', function() {
          if (global.tvChart) {
            global.tvChart.removeOverlay();
            // KHÔNG GỌI cancelDrawing() Ở ĐÂY NỮA
          }
          if (global.__wa_overlay_map) global.__wa_overlay_map.clear(); 
          if (typeof window.undoStack !== 'undefined') window.undoStack = []; 
          if (typeof window.redoStack !== 'undefined') window.redoStack = [];
          if (typeof hidePanel === 'function') hidePanel();
          
          _getTbBtns().forEach(function(b) { b.classList.remove('active'); }); 
          var ptr = toolbar.querySelector('[data-tool=pointer]');
          if (ptr) ptr.classList.add('active');
          if(container) container.classList.remove('wa-drawing-mode');
          
          if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
          if (typeof showToast === 'function') showToast('🗑️ Đã xoá sạch bản vẽ');
        });
      }
       });
  }
 
    // NÚT ẨN/HIỆN TẤT CẢ
    var _allHidden = false;
    var hideAllBtn = toolbar.querySelector('#wa-btn-hide-all');
  
    if (hideAllBtn) {
      hideAllBtn.addEventListener('click', function() {
        if (!global.tvChart) return;
        _allHidden = !_allHidden;
        hideAllBtn.style.opacity = _allHidden ? '0.4' : '1';
        
        // Dùng thuộc tính visible chuẩn của KLineChart v9 (Không làm mất màu cũ)
        global.tvChart.overrideOverlay({
          visible: !_allHidden
        });
        
        if (typeof showToast === 'function') {
          showToast(_allHidden ? 'Đã ẩn tất cả' : 'Đã hiện tất cả');
        }
      });
    }
  

  // 🌟 CÁC NÚT TRÊN BẢNG PROPERTIES PANEL (Thanh trượt bên phải)
  if (panel) {
    var closeBtn = panel.querySelector('.wa-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', function() { if(typeof hidePanel === 'function') hidePanel(); });
    
    var lockBtn = panel.querySelector('#wa-btn-p-lock');
    if (lockBtn) lockBtn.addEventListener('click', function() {
      if (typeof window.currentSelectedOverlay === 'undefined' || !window.currentSelectedOverlay || !global.tvChart) return;
      global.tvChart.overrideOverlay({ id: window.currentSelectedOverlay.id, lock: !window.currentSelectedOverlay.lock });
      
      // Đồng bộ lại RAM
      let existing = global.__wa_overlay_map.get(window.currentSelectedOverlay.id);
      if (existing) existing.lock = !window.currentSelectedOverlay.lock;
      window.currentSelectedOverlay.lock = !window.currentSelectedOverlay.lock;

      if (typeof showToast === 'function') showToast('Đã đổi trạng thái khoá');
      if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
    });
    
    var delBtn = panel.querySelector('#wa-btn-p-del');
    if (delBtn) delBtn.addEventListener('click', function() {
      if (typeof window.currentSelectedOverlay === 'undefined' || !window.currentSelectedOverlay || !global.tvChart) return;
      
      if (typeof saveHistory === 'function') saveHistory('delete', window.currentSelectedOverlay);
      global.tvChart.removeOverlay({ id: window.currentSelectedOverlay.id });
      
      if (typeof _wa_untrackOverlay === 'function') _wa_untrackOverlay(window.currentSelectedOverlay.id); 
      if (typeof hidePanel === 'function') hidePanel();
      if (typeof global.__wa_saveAllOverlays === 'function') global.__wa_saveAllOverlays();
      
      window.currentSelectedOverlay = null; // Xóa xong phải gỡ biến nhớ
    });
  }
}

// ============================================================
// 7.7 BIND CHART EVENTS — Gắn vào tvChart object (1 lần / chart instance)
// ============================================================
function _bindChartEventsOnce() {
  if (!global.tvChart || global.tvChart.__wa_chart_events_bound) return;
  global.tvChart.__wa_chart_events_bound = true;
// ── THÊM: Sáng/mờ nút xóa theo trạng thái chọn ─────────────
global.tvChart.subscribeAction('onOverlaySelected', function() {
  if (typeof window._syncDelSelBtn === 'function') window._syncDelSelBtn(true);
});
global.tvChart.subscribeAction('onOverlayDeselected', function() {
  if (typeof window._syncDelSelBtn === 'function') window._syncDelSelBtn(false);
});
// ── HẾT THÊM ─────────────────────────────────────────────────
  global.tvChart.subscribeAction('onDrawEnd', function(data) {
    isDrawingSessionActive = false;
    activateTool('pointer');
    var toolbar = document.querySelector('.wa-toolbar');
    if (toolbar) {
      toolbar.querySelectorAll('.wa-tb-btn').forEach(function(b) { b.classList.remove('active'); });
      var ptr = toolbar.querySelector('[data-tool=pointer]');
      if (ptr) ptr.classList.add('active');
    }
    var overlayObj = Array.isArray(data) ? data[0] : data;
    if (!overlayObj) return;
    
    _wa_trackOverlay(overlayObj); 

    saveHistory('add', overlayObj);
    currentSelectedOverlay = overlayObj;
    window.currentSelectedOverlay = overlayObj;
    if (typeof showFloatToolbar === 'function') showFloatToolbar(currentSelectedOverlay, null, null);
    if (typeof renderPanel === 'function') renderPanel(currentSelectedOverlay);
saveAllOverlays();
  });

  
}

// ============================================================
// 7.8 MAIN MOUNT FUNCTION — Entry point gọi từ ngoài
// ============================================================
function mountUI() {
  bindCoreEventsOnce();
  mountDOM();

  var _waitChart = setInterval(function() {
    if (global.tvChart && typeof global.tvChart.subscribeAction === 'function') {
      clearInterval(_waitChart);
      _bindChartEventsOnce();
      restoreOverlays();
    }
  }, 100);
}

// ============================================================
// 7.9 TOOLBAR WATCHDOG
// ============================================================
(function startToolbarWatchdog() {
  if (window.__wa_watchdog_started) return; 
  window.__wa_watchdog_started = true;

  var _observer = null;

  function _onContainerMutation(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].removedNodes.length === 0) continue;
      var container = document.getElementById('sc-chart-container');
      if (container && !container.querySelector('.wa-toolbar')) {
        mountDOM();
        
        if (global.__wa_overlay_map) global.__wa_overlay_map.clear();
        
        if (global.tvChart) {
          global.tvChart.__wa_chart_events_bound = false;
          _bindChartEventsOnce();
        }
        setTimeout(restoreOverlays, 100);
        break;
      }
    }
  }

  function _startObserver() {
    var container = document.getElementById('sc-chart-container');
    var target = container ? container.parentNode : document.body;
    if (!target) return;

    _observer = new MutationObserver(_onContainerMutation);
    _observer.observe(target, {
      childList: true,
      subtree: true  
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _startObserver);
  } else {
    _startObserver();
  }
})();

// ============================================================
// 7.10 KHỞI ĐỘNG
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountUI);
} else {
  mountUI();
}

})(window); // <-- Chú ý giữ nguyên dòng đóng module này
/*
=== CODEX IMPROVEMENT PROPOSALS ===

BUGS FOUND (not in the task description):

- `saveHistory` trước đó dùng clone nông (`Object.assign`) nên undo/redo có thể giữ tham chiếu cũ và gây sai dữ liệu khi overlay bị mutate tiếp.
- Panel style trước đó chỉ có `solid/dashed` nên các overlay hỗ trợ `dotted` qua toolbar không đồng bộ với panel.
- Trên mobile, panel đang dùng animation trượt ngang của desktop khiến cảm giác mở panel không đúng kỳ vọng dạng bottom-sheet.

UX IMPROVEMENTS SUGGESTED (not implemented, for human review):

- Thêm nút Undo/Redo trực tiếp trên toolbar nổi để người dùng mobile thao tác mà không cần bàn phím.
- Thêm “preset style chips” cho text/shape (ví dụ: Note, Warning, Success) để rút ngắn số lần mở panel.
- Thêm tùy chọn ghim panel (pin) khi người dùng muốn chỉnh nhiều object liên tục mà không tự đóng.

PERFORMANCE OBSERVATIONS:

- `renderPanel` rebuild lại toàn bộ HTML mỗi lần chọn overlay; với overlay thay đổi nhanh có thể tạo nhiều listener ngắn hạn.
- Có nhiều `document.addEventListener` toàn cục; có thể gom theo event bus nhẹ để giảm số callback luôn hoạt động.
- Một số `createPointFigures` tạo nhiều object mỗi frame khi kéo điểm; có thể cân nhắc cache style-derived values theo overlay id.

MOBILE-SPECIFIC GAPS REMAINING:

- Chưa có gesture “shake để undo”; hiện tại mới hỗ trợ Ctrl/Cmd + Z/Y (desktop) và API hàm nội bộ.
- Cần test thực thiết bị cho bàn phím ảo (iOS/Android) để tinh chỉnh thêm safe-area cho floating toolbar trong mọi trường hợp.
- Chưa có tối ưu đặc thù cho thao tác một tay trên màn hình nhỏ (đặc biệt khi panel mở đồng thời với toolbar nổi).
*/
