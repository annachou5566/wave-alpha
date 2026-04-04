// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — DRAWING TOOLS ENGINE
// Version: 2.0.0 | KLineCharts v9 Compatible
// ==========================================
// SECTION 1:  TOOL REGISTRY
// SECTION 2:  DRAWING STATE
// SECTION 3:  CSS INJECTION
// SECTION 4:  TOOLBAR HTML BUILDER
// SECTION 5:  DOM INJECTION
// SECTION 6:  TOOL ACTIVATION
// SECTION 7:  OVERLAY STYLE BUILDER
// SECTION 8:  FLYOUT MANAGEMENT
// SECTION 9:  KEYBOARD SHORTCUTS
// SECTION 10: SETTINGS PERSISTENCE
// SECTION 11: PUBLIC API
// ==========================================

(function (global) {
  'use strict';

  const WD_VERSION = '2.0.0';
  const LS_KEY = 'wa_draw_settings_v2';

  // ════════════════════════════════════════════
  // SECTION 1: TOOL REGISTRY
  // ════════════════════════════════════════════

  /**
   * TOOL_GROUPS — Nhóm công cụ vẽ, icon dùng ký tự ASCII/Latin
   * để đảm bảo hiển thị đúng trên mọi OS/font.
   * overlay: tên KLineCharts built-in overlay (null = chỉ là con trỏ)
   */
  const TOOL_GROUPS = [

    // ── 0. Cursor ─────────────────────────────
    {
      id: 'cursor', label: 'Con Trỏ', icon: '↖',
      tools: [
        { id: 'pointer',  name: 'Con trỏ / Chọn',   overlay: null,           icon: '↖',  key: 'Escape', desc: 'Chọn, di chuyển, chỉnh sửa hình vẽ',   points: 0 },
        { id: 'eraser',   name: 'Xóa nhanh',         overlay: '__erase__',    icon: 'X',  key: 'E',      desc: 'Click lên hình vẽ để xóa ngay',         points: 0 },
      ]
    },

    // ── 1. Lines ──────────────────────────────
    {
      id: 'lines', label: 'Đường & Tia', icon: '/',
      tools: [
        { id: 'segment',               name: 'Đường xu hướng',        overlay: 'segment',               icon: '/',   key: 'L', desc: '2 điểm — đoạn thẳng',                         points: 2 },
        { id: 'ray',                   name: 'Tia một chiều',          overlay: 'ray',                   icon: '→',             desc: '2 điểm — kéo dài về 1 phía',                  points: 2 },
        { id: 'straightLine',          name: 'Đường thẳng 2 chiều',    overlay: 'straightLine',          icon: '↔',             desc: '2 điểm — kéo dài vô hạn 2 chiều',             points: 2 },
        { id: 'horizontalStraightLine',name: 'Ngang vô hạn',           overlay: 'horizontalStraightLine',icon: '─',   key: 'H', desc: '1 điểm — đường ngang vô hạn',                 points: 1 },
        { id: 'horizontalRayLine',     name: 'Tia ngang 1 chiều',      overlay: 'horizontalRayLine',     icon: '->', desc: '2 điểm — ngang 1 chiều',                       points: 2 },
        { id: 'horizontalSegment',     name: 'Đoạn nằm ngang',         overlay: 'horizontalSegment',     icon: '|-', desc: '2 điểm — đoạn ngang có giới hạn',              points: 2 },
        { id: 'verticalStraightLine',  name: 'Dọc vô hạn',             overlay: 'verticalStraightLine',  icon: '│',   key: 'V', desc: '1 điểm — đường dọc vô hạn',                  points: 1 },
        { id: 'verticalRayLine',       name: 'Tia dọc 1 chiều',        overlay: 'verticalRayLine',       icon: '↑',             desc: '2 điểm — dọc 1 chiều',                        points: 2 },
        { id: 'verticalSegment',       name: 'Đoạn thẳng đứng',        overlay: 'verticalSegment',       icon: '⊥',             desc: '2 điểm — đoạn dọc có giới hạn',               points: 2 },
        { id: 'priceLine',             name: 'Price Line',             overlay: 'priceLine',             icon: '$',             desc: '1 điểm — đường giá có nhãn số',               points: 1 },
        { id: 'arrow',                 name: 'Mũi tên',                overlay: 'arrow',                 icon: '↗',             desc: '2 điểm — mũi tên có đầu nhọn',                points: 2 },
      ]
    },

    // ── 2. Channels ───────────────────────────
    {
      id: 'channels', label: 'Kênh Giá', icon: '=',
      tools: [
        { id: 'priceChannelLine',   name: 'Price Channel',  overlay: 'priceChannelLine',   icon: '=',  desc: '3 điểm — kênh song song',           points: 3 },
        { id: 'parallelStraightLine',name: 'Parallel Lines',overlay: 'parallelStraightLine',icon: '≡', desc: '3 điểm — 2 đường song song vô hạn', points: 3 },
      ]
    },

    // ── 3. Fibonacci ──────────────────────────
    {
      id: 'fibonacci', label: 'Fibonacci', icon: 'F',
      tools: [
        { id: 'fibonacciLine',               name: 'Fib Retracement',     overlay: 'fibonacciLine',               icon: 'FR', key: 'F', desc: '2 điểm — hồi quy Fib 23.6% 38.2% 50% 61.8%', points: 2 },
        { id: 'fibonacciSegment',             name: 'Fib Segment',         overlay: 'fibonacciSegment',             icon: 'FS',          desc: '2 điểm — Fib trên đoạn thẳng',               points: 2 },
        { id: 'fibonacciExtension',           name: 'Fib Extension',       overlay: 'fibonacciExtension',           icon: 'FE',          desc: '3 điểm — mở rộng Fib 127.2% 161.8% 200%',   points: 3 },
        { id: 'fibonacciSpiral',              name: 'Fib Spiral',          overlay: 'fibonacciSpiral',              icon: 'F@',          desc: '2 điểm — xoắn ốc Fibonacci',                 points: 2 },
        { id: 'fibonacciSpeedResistanceFan',  name: 'Fib Fan',             overlay: 'fibonacciSpeedResistanceFan',  icon: 'FF',          desc: '2 điểm — quạt kháng cự Fibonacci',           points: 2 },
        { id: 'fibTrendExtension',            name: 'Fib Trend Ext.',      overlay: 'fibonacciExtension',           icon: 'FT',          desc: '3 điểm — mở rộng Fib theo xu hướng A→B→C',  points: 3 },
      ]
    },

    // ── 4. Gann ───────────────────────────────
    {
      id: 'gann', label: 'Gann', icon: 'G',
      tools: [
        { id: 'gannBox',    name: 'Gann Box',    overlay: 'gannBox',    icon: 'GB', desc: '2 điểm — hộp Gann 1×1 2×1 1×2', points: 2 },
        { id: 'gannFan',    name: 'Gann Fan',    overlay: 'gannFan',    icon: 'GF', desc: '2 điểm — quạt Gann 8 góc',      points: 2 },
        { id: 'gannSquare', name: 'Gann Square', overlay: 'gannSquare', icon: 'GS', desc: '2 điểm — hình vuông Gann',       points: 2 },
      ]
    },

    // ── 5. Elliott Wave ───────────────────────
    {
      id: 'elliott', label: 'Sóng Elliott', icon: '~',
      tools: [
        { id: 'elliottImpulseWave',    name: 'Impulse Wave (1-2-3-4-5)', overlay: 'elliottImpulseWave',    icon: '1-5',  desc: '6 điểm — sóng đẩy 5 bước',      points: 6 },
        { id: 'elliottCorrectiveWave', name: 'Corrective Wave (A-B-C)',   overlay: 'elliottCorrectiveWave', icon: 'ABC',  desc: '4 điểm — sóng điều chỉnh 3 bước', points: 4 },
        { id: 'elliottTriangleWave',   name: 'Triangle Wave (A-E)',       overlay: 'elliottTriangleWave',   icon: '/\\/',  desc: '5 điểm — sóng tam giác Elliott',  points: 5 },
        { id: 'elliottDoubleComboWave',name: 'Double Combo (WXY)',        overlay: 'elliottDoubleComboWave',icon: 'WXY',  desc: '7 điểm — sóng kép W-X-Y',        points: 7 },
        { id: 'elliottTripleComboWave',name: 'Triple Combo (WXYXZ)',      overlay: 'elliottTripleComboWave',icon: 'WXYZ', desc: '9 điểm — sóng ba W-X-Y-X-Z',     points: 9 },
      ]
    },

    // ── 6. Shapes ─────────────────────────────
    {
      id: 'shapes', label: 'Hình Vẽ', icon: '□',
      tools: [
        { id: 'rect',        name: 'Rectangle',    overlay: 'rect',        icon: '□', key: 'R', desc: '2 điểm — vùng tô màu hình chữ nhật', points: 2, isShape: true },
        { id: 'circle',      name: 'Circle',       overlay: 'circle',      icon: 'O',           desc: '2 điểm — hình tròn',                  points: 2, isShape: true },
        { id: 'triangle',    name: 'Triangle',     overlay: 'triangle',    icon: '/\\',           desc: '3 điểm — tam giác bất kỳ',            points: 3, isShape: true },
        { id: 'parallelogram',name: 'Parallelogram',overlay: 'parallelogram',icon: '▱',          desc: '3 điểm — hình bình hành',             points: 3, isShape: true },
      ]
    },

    // ── 7. Harmonic Patterns ──────────────────
    {
      id: 'patterns', label: 'Harmonic', icon: 'P',
      tools: [
        { id: 'xabcd',        name: 'XABCD Pattern', overlay: 'xabcd',        icon: 'XAB', desc: '5 điểm — Gartley / Butterfly / Bat / Crab', points: 5 },
        { id: 'abcd',         name: 'ABCD Pattern',  overlay: 'abcd',         icon: 'ABD', desc: '4 điểm — AB=CD harmonic pattern',            points: 4 },
        { id: 'threedrives',  name: 'Three Drives',  overlay: 'threedrives',  icon: '3D',  desc: '7 điểm — Three Drives reversal pattern',     points: 7 },
      ]
    },

    // ── 8. R/R & Projections ──────────────────
    {
      id: 'projections', label: 'R/R & Vùng', icon: 'R',
      tools: [
        { id: 'longPosition',  name: 'Long Position (R/R)', overlay: 'longPosition',  icon: '↑L', desc: '3 điểm — Entry/Stop/Target Long',   points: 3 },
        { id: 'shortPosition', name: 'Short Position (R/R)',overlay: 'shortPosition', icon: '↓S', desc: '3 điểm — Entry/Stop/Target Short',  points: 3 },
        { id: 'priceRange',    name: 'Price Range',         overlay: 'priceRange',    icon: '↕',  desc: '2 điểm — đo khoảng cách giá',       points: 2 },
        { id: 'dateRangeNote', name: 'Date Range',          overlay: 'dateRangeNote', icon: '[t]', desc: '2 điểm — tô vùng theo thời gian',  points: 2 },
      ]
    },

    // ── 9. Text & Labels ──────────────────────
    {
      id: 'text', label: 'Chú Thích', icon: 'T',
      tools: [
        { id: 'text',    name: 'Text Label', overlay: 'text',    icon: 'T', key: 'T', desc: '1 điểm — nhập text ghi chú trên chart', points: 1 },
        { id: 'callout', name: 'Callout',    overlay: 'callout', icon: '»',           desc: '2 điểm — bong bóng chú thích',          points: 2 },
        { id: 'note',    name: 'Note',       overlay: 'note',    icon: 'N',           desc: '1 điểm — ghi chú có khung',             points: 1 },
      ]
    },
  ];

  // Flat lookup map: toolId → DrawTool
  const TOOL_MAP = {};
  TOOL_GROUPS.forEach(function (g) {
    g.tools.forEach(function (t) {
      TOOL_MAP[t.id] = Object.assign({ groupId: g.id }, t);
    });
  });

  /**
   * KLineCharts v9 built-in overlay names.
   * FIX: abcd, threedrives đã được thêm vào (trước bị thiếu → trigger register lại).
   * Ref: https://klinecharts.com/en-US/guide/overlay
   */
  const KC_NATIVE = new Set([
    'segment', 'ray', 'straightLine',
    'horizontalStraightLine', 'horizontalRayLine', 'horizontalSegment',
    'verticalStraightLine', 'verticalRayLine', 'verticalSegment',
    'priceLine', 'arrow',
    'priceChannelLine', 'parallelStraightLine',
    'fibonacciLine', 'fibonacciSegment', 'fibonacciExtension',
    'fibonacciSpiral', 'fibonacciSpeedResistanceFan',
    'gannBox', 'gannFan', 'gannSquare',
    'elliottImpulseWave', 'elliottCorrectiveWave', 'elliottTriangleWave',
    'elliottDoubleComboWave', 'elliottTripleComboWave',
    'rect', 'circle', 'triangle', 'parallelogram',
    'xabcd', 'abcd', 'threedrives',
    'longPosition', 'shortPosition',
    'text', 'callout',
  ]);
  // Các overlay sau không có trong KLC built-in — sẽ fallback về 'segment':
  // note, dateRangeNote, priceRange, cypher, headshoulders

  // ════════════════════════════════════════════
  // SECTION 2: DRAWING STATE
  // ════════════════════════════════════════════

  const DS = {
    activeTool: 'pointer',
    color:      '#00F0FF',
    fillColor:  'rgba(0,240,255,0.12)',
    lineSize:   2,
    lineStyle:  'solid',   // 'solid' | 'dashed' | 'dotted'
    textSize:   13,
    allVisible: true,
    drawCount:  0,
    isDrawing:  false,
    flyoutOpenId: null,
    initialized:  false,
    // State management (FIX: đây là những field bị thiếu trong v1)
    _history:   [],        // stack các ID đã vẽ xong — dùng cho undo
    _pendingId: null,      // ID overlay đang vẽ dở (chưa onDrawEnd)
    _idCounter: 1,         // counter tạo ID duy nhất cho mỗi overlay
  };

  // ════════════════════════════════════════════
  // SECTION 3: CSS INJECTION
  // ════════════════════════════════════════════

  function injectCSS() {
    if (document.getElementById('wa-drawing-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-drawing-css';
    style.textContent = `
      /* Ensure chart container is relative for absolute positioning */
      #sc-chart-container { position: relative !important; }

      /* ══ DRAWING TOOLBAR — left strip ══════════════════════════ */
      #wa-drawing-toolbar {
        position: absolute; left: 0; top: 0;
        width: 36px; height: 100%; z-index: 300;
        display: flex; flex-direction: column; align-items: center;
        padding: 6px 0; gap: 1px;
        background: rgba(14, 18, 24, 0.96);
        border-right: 1px solid rgba(255,255,255,0.07);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        overflow: hidden; overflow-y: auto;
        scrollbar-width: none; user-select: none;
        box-sizing: border-box;
      }
      #wa-drawing-toolbar::-webkit-scrollbar { display: none; }

      .wa-dt-group {
        position: relative; width: 100%;
        display: flex; justify-content: center; flex-shrink: 0;
      }
      .wa-dt-sep {
        width: 22px; height: 1px;
        background: rgba(255,255,255,0.07);
        margin: 3px 0; flex-shrink: 0; align-self: center;
      }
      .wa-dt-spacer { flex: 1; }

      /* ── Tool Button ────────────────────────────────────────── */
      .wa-dt-btn {
        width: 30px; height: 30px;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent;
        color: #5a6475;
        /* FIX: font-family đảm bảo icon ASCII hiển thị đúng trên mọi OS */
        font-family: 'Segoe UI', 'Segoe UI Symbol', 'Helvetica Neue', Arial, sans-serif;
        font-size: 10px; font-weight: 700;
        line-height: 1; letter-spacing: -0.3px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.13s, color 0.13s, border-color 0.13s;
        flex-shrink: 0; position: relative;
        outline: none; padding: 0;
        overflow: hidden; white-space: nowrap;
      }
      .wa-dt-btn:hover {
        background: rgba(255,255,255,0.07);
        color: #c8cdd4;
        border-color: rgba(255,255,255,0.1);
      }
      .wa-dt-btn.active {
        background: rgba(0,240,255,0.14);
        color: #00F0FF;
        border-color: rgba(0,240,255,0.35);
      }
      /* Chevron nhỏ ở góc → có flyout */
      .wa-dt-btn.has-flyout::after {
        content: '';
        position: absolute; bottom: 3px; right: 3px;
        width: 3px; height: 3px;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        opacity: 0.45; pointer-events: none;
      }

      /* ── Tooltip ──────────────────────────────────────────────── */
      .wa-dt-tip {
        position: absolute; left: 38px; top: 50%;
        transform: translateY(-50%);
        background: rgba(10, 14, 20, 0.97);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px; padding: 4px 10px;
        font-size: 11px; color: #c8cdd4;
        white-space: nowrap; pointer-events: none;
        z-index: 10000; opacity: 0;
        transition: opacity 0.15s;
        box-shadow: 0 4px 14px rgba(0,0,0,0.55);
      }
      .wa-dt-btn:hover .wa-dt-tip { opacity: 1; }

      /* ── Draw count badge ─────────────────────────────────────── */
      .wa-dt-badge {
        position: absolute; top: 1px; right: 1px;
        background: #00F0FF; color: #000;
        font-size: 7px; font-weight: 900;
        min-width: 11px; height: 11px;
        border-radius: 5px; padding: 0 2px;
        display: none; align-items: center; justify-content: center;
        pointer-events: none; line-height: 1;
      }

      /* ══ FLYOUT SUB-MENU ════════════════════════════════════════ */
      .wa-flyout {
        position: absolute; left: 38px; top: -2px;
        background: #0d1117;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px; padding: 6px 5px;
        min-width: 240px; z-index: 9999;
        box-shadow: 0 14px 44px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.4);
        display: none; flex-direction: column; gap: 1px;
        pointer-events: all;
      }
      .wa-flyout.open { display: flex; }

      .wa-flyout-header {
        font-size: 9px; font-weight: 800;
        color: #3a434f; text-transform: uppercase;
        letter-spacing: 1.2px; padding: 4px 10px 7px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        margin-bottom: 2px;
      }
      .wa-flyout-item {
        display: flex; align-items: center; gap: 10px;
        padding: 6px 10px; border-radius: 6px;
        cursor: pointer; transition: background 0.1s;
        color: #7a8694; font-size: 11.5px;
      }
      .wa-flyout-item:hover  { background: rgba(255,255,255,0.06); color: #d4dae2; }
      .wa-flyout-item.active { background: rgba(0,240,255,0.09); color: #00F0FF; }

      .wa-flyout-icon {
        font-size: 11px; font-weight: 700;
        width: 24px; text-align: center; flex-shrink: 0;
        font-family: 'Segoe UI', 'Segoe UI Symbol', Arial, sans-serif;
        overflow: hidden; white-space: nowrap;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 4px; padding: 2px 0;
        color: #9ba3af;
      }
      .wa-flyout-item.active .wa-flyout-icon { color: #00F0FF; border-color: rgba(0,240,255,0.25); }

      .wa-flyout-info { flex: 1; min-width: 0; }
      .wa-flyout-name { display: block; }
      .wa-flyout-desc {
        display: block; font-size: 9.5px; color: #3a434f;
        margin-top: 1px; white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
      }
      .wa-flyout-pts {
        font-size: 9px; color: #3d4855;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 3px; padding: 1px 5px;
        flex-shrink: 0; font-family: monospace;
      }
      .wa-flyout-key {
        font-size: 9px; color: #3d4855;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 3px; padding: 1px 5px;
        flex-shrink: 0; font-family: monospace;
      }

      /* ══ PROPERTIES BAR — top of chart ═════════════════════════ */
      #wa-drawing-props {
        position: absolute; top: 8px; left: 44px; right: 8px;
        height: 36px;
        background: rgba(10, 14, 20, 0.97);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 9px;
        display: none; align-items: center; gap: 6px;
        padding: 0 12px; z-index: 295;
        box-shadow: 0 6px 22px rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        flex-wrap: nowrap; overflow: hidden;
      }
      #wa-drawing-props.show { display: flex; }

      .wa-dp-tool-name {
        font-size: 11px; font-weight: 700;
        color: #00F0FF; flex-shrink: 0;
        max-width: 140px; overflow: hidden; text-overflow: ellipsis;
        white-space: nowrap;
      }
      .wa-dp-sep  { width: 1px; height: 20px; background: rgba(255,255,255,0.08); flex-shrink: 0; margin: 0 1px; }
      .wa-dp-lbl  { font-size: 10px; color: #4a5460; flex-shrink: 0; }

      /* Color swatch */
      .wa-dp-color-box {
        position: relative; width: 22px; height: 22px;
        border-radius: 5px; border: 1.5px solid rgba(255,255,255,0.15);
        cursor: pointer; overflow: hidden; flex-shrink: 0;
        transition: border-color 0.12s;
      }
      .wa-dp-color-box:hover { border-color: rgba(255,255,255,0.4); }
      .wa-dp-color-box .wa-dp-swatch { width: 100%; height: 100%; border-radius: 3px; }
      .wa-dp-color-box input[type=color] {
        position: absolute; opacity: 0;
        width: 200%; height: 200%; top: -50%; left: -50%;
        cursor: pointer; border: none; padding: 0;
      }

      /* Preset color swatches */
      .wa-dp-preset {
        width: 14px; height: 14px; border-radius: 3px;
        cursor: pointer; flex-shrink: 0;
        border: 1px solid rgba(255,255,255,0.12);
        transition: transform 0.12s, border-color 0.12s;
      }
      .wa-dp-preset:hover { transform: scale(1.3); border-color: rgba(255,255,255,0.5); }

      /* Select dropdown */
      .wa-dp-sel {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 5px; color: #c8cdd4;
        font-size: 11px; padding: 3px 5px;
        cursor: pointer; outline: none;
        transition: border-color 0.12s; flex-shrink: 0;
      }
      .wa-dp-sel:hover, .wa-dp-sel:focus { border-color: rgba(0,240,255,0.4); }

      /* Action buttons in props bar */
      .wa-dp-btn {
        padding: 3px 10px; border-radius: 5px;
        border: 1px solid rgba(255,255,255,0.08);
        background: transparent; color: #7a8694;
        font-size: 10.5px; cursor: pointer;
        transition: all 0.12s; white-space: nowrap; flex-shrink: 0;
      }
      .wa-dp-btn:hover       { border-color: rgba(0,240,255,0.4); color: #00F0FF; background: rgba(0,240,255,0.06); }
      .wa-dp-btn.red:hover   { border-color: rgba(246,70,93,0.4); color: #F6465D; background: rgba(246,70,93,0.06); }
      .wa-dp-btn.accent      { background: rgba(0,240,255,0.1); border-color: rgba(0,240,255,0.3); color: #00F0FF; }

      /* Crosshair khi đang vẽ */
      .wa-chart-drawing-mode canvas { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  // ════════════════════════════════════════════
  // SECTION 4: TOOLBAR HTML BUILDER
  // ════════════════════════════════════════════

  const PRESET_COLORS = ['#00F0FF', '#F0B90B', '#0ECB81', '#F6465D', '#EAECEF', '#848e9c', '#cb55e3', '#FF8C00'];

  function buildToolbarHTML() {
    let h = '';
    TOOL_GROUPS.forEach(function (group, gi) {
      if (gi > 0) h += '<div class="wa-dt-sep"></div>';
      const rep = group.tools[0];
      const hasFly = group.tools.length > 1;
      h += `<div class="wa-dt-group" data-group="${group.id}">
  <button class="wa-dt-btn${hasFly ? ' has-flyout' : ''}"
          id="wa-dtg-${group.id}"
          data-group="${group.id}"
          data-tool="${rep.id}"
          onclick="WaveDrawingAPI.groupClick(event,'${group.id}')"
          onmouseenter="WaveDrawingAPI.groupHover(event,'${group.id}')">
    <span class="wa-dt-icon">${rep.icon}</span>
    <span class="wa-dt-tip">${group.label}</span>
  </button>
  ${hasFly ? buildFlyoutHTML(group) : ''}
</div>`;
    });

    // Bottom controls
    h += `
<div class="wa-dt-spacer"></div>
<div class="wa-dt-sep"></div>
<div class="wa-dt-group">
  <button class="wa-dt-btn" onclick="WaveDrawingAPI.undo()" title="Undo Ctrl+Z">
    <span class="wa-dt-icon" style="font-size:12px">↩</span>
    <span class="wa-dt-tip">Undo (Ctrl+Z)</span>
  </button>
</div>
<div class="wa-dt-group">
  <button class="wa-dt-btn" onclick="WaveDrawingAPI.redo()" title="Redo Ctrl+Y">
    <span class="wa-dt-icon" style="font-size:12px">↪</span>
    <span class="wa-dt-tip">Redo (Ctrl+Y)</span>
  </button>
</div>
<div class="wa-dt-sep"></div>
<div class="wa-dt-group">
  <button class="wa-dt-btn" id="wa-dt-vis-btn" onclick="WaveDrawingAPI.toggleVisibility()">
    <span class="wa-dt-icon" style="font-size:12px">◎</span>
    <span class="wa-dt-tip">Ẩn/Hiện hình vẽ</span>
  </button>
</div>
<div class="wa-dt-group" style="position:relative">
  <button class="wa-dt-btn" id="wa-dt-del-btn" onclick="WaveDrawingAPI.deleteAll()">
    <span class="wa-dt-badge" id="wa-dt-badge">0</span>
    <span class="wa-dt-icon" style="font-size:12px">🗑</span>
    <span class="wa-dt-tip">Xóa tất cả hình vẽ</span>
  </button>
</div>`;
    return h;
  }

  function buildFlyoutHTML(group) {
    let h = `<div class="wa-flyout" id="wa-flyout-${group.id}">
  <div class="wa-flyout-header">${group.label}</div>`;
    group.tools.forEach(function (tool) {
      const pts  = tool.points ? `<span class="wa-flyout-pts">${tool.points}pt</span>` : '';
      const key  = tool.key    ? `<span class="wa-flyout-key">${tool.key}</span>`       : '';
      h += `<div class="wa-flyout-item" data-tool="${tool.id}"
         onclick="WaveDrawingAPI.toolClick('${tool.id}',event)">
    <span class="wa-flyout-icon">${tool.icon}</span>
    <span class="wa-flyout-info">
      <span class="wa-flyout-name">${tool.name}</span>
      <span class="wa-flyout-desc">${tool.desc}</span>
    </span>
    ${pts}${key}
  </div>`;
    });
    h += '</div>';
    return h;
  }

  function buildPropsBarHTML() {
    const presets = PRESET_COLORS.map(function (c) {
      return `<div class="wa-dp-preset" style="background:${c}" title="${c}" onclick="WaveDrawingAPI.setColor('${c}')"></div>`;
    }).join('');

    return `<div id="wa-drawing-props">
  <span class="wa-dp-tool-name" id="wa-dp-toolname">Công cụ vẽ</span>
  <div class="wa-dp-sep"></div>
  <span class="wa-dp-lbl">Nét</span>
  <div class="wa-dp-color-box" title="Màu đường/viền">
    <div class="wa-dp-swatch" id="wa-dp-stroke-swatch" style="background:#00F0FF"></div>
    <input type="color" id="wa-dp-stroke-color" value="#00f0ff" oninput="WaveDrawingAPI.onStrokeColor(this.value)">
  </div>
  <span class="wa-dp-lbl">Nền</span>
  <div class="wa-dp-color-box" title="Màu nền fill">
    <div class="wa-dp-swatch" id="wa-dp-fill-swatch" style="background:rgba(0,240,255,0.12)"></div>
    <input type="color" id="wa-dp-fill-color" value="#00f0ff" oninput="WaveDrawingAPI.onFillColor(this.value)">
  </div>
  <div class="wa-dp-sep"></div>
  <span class="wa-dp-lbl">Nét</span>
  <select class="wa-dp-sel" id="wa-dp-size" onchange="WaveDrawingAPI.onLineSize(this.value)">
    <option value="1">1px</option>
    <option value="2" selected>2px</option>
    <option value="3">3px</option>
    <option value="4">4px</option>
    <option value="5">5px</option>
  </select>
  <select class="wa-dp-sel" id="wa-dp-linestyle" onchange="WaveDrawingAPI.onLineStyle(this.value)">
    <option value="solid">──</option>
    <option value="dashed">- -</option>
    <option value="dotted">···</option>
  </select>
  <div class="wa-dp-sep"></div>
  ${presets}
  <div class="wa-dp-sep"></div>
  <button class="wa-dp-btn accent" onclick="WaveDrawingAPI.applyAll()" title="Áp dụng màu/kiểu này cho TẤT CẢ hình vẽ">Áp dụng tất cả</button>
  <button class="wa-dp-btn red"   onclick="WaveDrawingAPI.deleteAll()">Xóa tất</button>
  <button class="wa-dp-btn" id="wa-dp-cancel-btn" style="display:none" onclick="WaveDrawingAPI.cancelDraw()">Hủy vẽ</button>
</div>`;
  }

  // ════════════════════════════════════════════
  // SECTION 5: DOM INJECTION
  // ════════════════════════════════════════════

  let _mutObs = null;

  function inject() {
    const container = document.getElementById('sc-chart-container');
    if (!container) { setTimeout(inject, 600); return; }
    if (document.getElementById('wa-drawing-toolbar')) return;

    container.style.position = 'relative';

    // Toolbar
    const tb = document.createElement('div');
    tb.id = 'wa-drawing-toolbar';
    tb.innerHTML = buildToolbarHTML();
    container.appendChild(tb);

    // Props bar
    const pw = document.createElement('div');
    pw.innerHTML = buildPropsBarHTML();
    container.appendChild(pw.firstElementChild);

    // Close flyouts on outside click
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.wa-dt-group') && !e.target.closest('.wa-flyout')) {
        closeFlyouts();
      }
    }, true);

    DS.initialized = true;
    updatePropsBar(null);
    console.log(`WaveDrawing v${WD_VERSION} — toolbar injected.`);
  }

  function watchForReinit() {
    const root = document.getElementById('super-chart-overlay') || document.body;
    if (_mutObs) _mutObs.disconnect();
    _mutObs = new MutationObserver(function () {
      const c = document.getElementById('sc-chart-container');
      if (c && !document.getElementById('wa-drawing-toolbar')) {
        setTimeout(inject, 350);
      }
    });
    _mutObs.observe(root, { childList: true, subtree: true });
  }

  // ════════════════════════════════════════════
  // SECTION 6: TOOL ACTIVATION
  // ════════════════════════════════════════════

  function activateTool(toolId) {
    const tool = TOOL_MAP[toolId];
    if (!tool) return;

    // Hủy overlay đang vẽ dở (nếu có) — FIX: dùng DS._pendingId thay vì ID cứng
    if (global.tvChart && DS._pendingId) {
      try { global.tvChart.removeOverlay({ id: DS._pendingId }); } catch (e) {}
      DS._pendingId = null;
    }

    DS.activeTool  = toolId;
    DS.isDrawing   = (toolId !== 'pointer' && toolId !== 'eraser' && !!tool.overlay);

    // Cập nhật highlight toolbar
    document.querySelectorAll('.wa-dt-btn[data-group]').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.wa-flyout-item').forEach(function (i) {
      i.classList.toggle('active', i.dataset.tool === toolId);
    });
    const grpBtn = document.getElementById('wa-dtg-' + tool.groupId);
    if (grpBtn) {
      grpBtn.classList.add('active');
      const iconEl = grpBtn.querySelector('.wa-dt-icon');
      if (iconEl) iconEl.textContent = tool.icon;
    }

    updatePropsBar(tool);

    // Cursor crosshair khi đang vẽ
    const container = document.getElementById('sc-chart-container');
    if (container) container.classList.toggle('wa-chart-drawing-mode', DS.isDrawing || toolId === 'eraser');

    if (toolId === 'pointer' || toolId === 'eraser') { hideCancelBtn(); return; }
    if (!tool.overlay || tool.overlay === '__erase__') return;

    // Đảm bảo overlay được hỗ trợ (native hoặc custom đã register)
    const overlayName = KC_NATIVE.has(tool.overlay) ? tool.overlay : null;
    const fallbackName = overlayName || 'segment';
    if (!overlayName) {
      tryRegisterFallback(tool.overlay, tool);
    }

    // FIX: tạo ID duy nhất cho mỗi overlay — không dùng 'wadrawing' cứng
    const oid = 'wadr_' + (DS._idCounter++);
    DS._pendingId = oid;

    setTimeout(function () {
      if (!global.tvChart) { DS._pendingId = null; return; }

      // ══════════════════════════════════════════════════════════
      // FIX QUAN TRỌNG NHẤT:
      // KLineCharts KHÔNG có subscribeAction('onDrawEnd',...).
      // Callbacks onDrawEnd / onRemoved PHẢI truyền thẳng vào
      // object createOverlay — đây là cách duy nhất đúng theo API.
      // Ref: https://klinecharts.com/en-US/api/instance/createOverlay
      // ══════════════════════════════════════════════════════════
      function _onDrawEnd() {
        DS._history.push(oid);
        DS._pendingId = null;
        DS.drawCount++;
        updateBadge();
        hideCancelBtn();
        DS.isDrawing = false;
        setTimeout(function () { activateTool('pointer'); }, 0);
        return false; // false = không ngăn hành vi mặc định KLC
      }

      function _onRemoved() {
        // Tự động cập nhật count khi overlay bị xóa bằng bất kỳ cách nào
        const idx = DS._history.indexOf(oid);
        if (idx !== -1) DS._history.splice(idx, 1);
        if (DS.drawCount > 0) DS.drawCount--;
        updateBadge();
        return false;
      }

      function _onClick(evt) {
        // Khi đang ở eraser mode, click vào overlay → xóa ngay
        if (DS.activeTool === 'eraser' && evt && evt.overlay) {
          try { global.tvChart.removeOverlay({ id: evt.overlay.id }); } catch (e) {}
          return true; // true = ngăn event lan ra
        }
        return false;
      }

      try {
        global.tvChart.createOverlay({
          id:      oid,
          name:    fallbackName,
          lock:    false,
          visible: true,
          mode:    'normal',
          styles:  buildOverlayStyles(tool),
          onDrawEnd: _onDrawEnd,   // ← đúng vị trí
          onRemoved: _onRemoved,   // ← tự động sync count
          onClick:   _onClick,     // ← hỗ trợ eraser
        });
        showCancelBtn();           // ← FIX: gọi riêng, không phải property
      } catch (err) {
        console.warn('WaveDrawing: createOverlay', fallbackName, 'failed:', err.message);
        DS._pendingId = null;
        hideCancelBtn();
        DS.isDrawing = false;
      }
    }, 60);
  }

  // ════════════════════════════════════════════
  // SECTION 7: OVERLAY STYLE BUILDER
  // ════════════════════════════════════════════

  function buildOverlayStyles(tool) {
    const isShape = !!(tool && tool.isShape);
    return {
      line: {
        color: DS.color, size: DS.lineSize, style: DS.lineStyle,
      },
      text: {
        color: DS.color, size: DS.textSize,
        family: "'Segoe UI', Arial, sans-serif", weight: 'normal',
      },
      polygon: isShape
        ? { color: DS.fillColor, style: 'fill', borderColor: DS.color, borderSize: DS.lineSize, borderStyle: DS.lineStyle }
        : { color: 'transparent', style: 'fill', borderColor: DS.color, borderSize: DS.lineSize, borderStyle: DS.lineStyle },
      arc:  { color: DS.color, size: DS.lineSize, style: DS.lineStyle },
      rect: isShape
        ? { color: DS.fillColor, style: 'fill', borderColor: DS.color, borderSize: DS.lineSize }
        : undefined,
    };
  }

  // Helpers
  function hexColor(c) {
    if (!c) return '00F0FF';
    c = c.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(c)) return c.replace('#', '');
    if (/^#?[0-9a-fA-F]{3}$/.test(c)) {
      const s = c.replace('#', '');
      return s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
    }
    // rgba → hex via canvas
    const cvs = document.createElement('canvas'); cvs.width = 1; cvs.height = 1;
    const ctx = cvs.getContext('2d'); ctx.fillStyle = c; ctx.fillRect(0,0,1,1);
    const d = ctx.getImageData(0,0,1,1).data;
    return [d[0],d[1],d[2]].map(function (x) { return x.toString(16).padStart(2,'0'); }).join('');
  }

  function hexToRgba(hex, alpha) {
    hex = hex.replace('#','');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return 'rgba(' + parseInt(hex.slice(0,2),16) + ',' + parseInt(hex.slice(2,4),16) + ',' + parseInt(hex.slice(4,6),16) + ',' + alpha + ')';
  }

  // ════════════════════════════════════════════
  // Props bar helpers
  // ════════════════════════════════════════════

  function updatePropsBar(tool) {
    const bar = document.getElementById('wa-drawing-props');
    if (!bar) return;
    const nameEl = document.getElementById('wa-dp-toolname');
    if (nameEl) nameEl.textContent = tool ? tool.name : 'Công cụ vẽ';

    const strokeInput  = document.getElementById('wa-dp-stroke-color');
    const strokeSwatch = document.getElementById('wa-dp-stroke-swatch');
    const fillSwatch   = document.getElementById('wa-dp-fill-swatch');
    if (strokeInput)  strokeInput.value = '#' + hexColor(DS.color);
    if (strokeSwatch) strokeSwatch.style.background = DS.color;
    if (fillSwatch)   fillSwatch.style.background   = DS.fillColor;

    const sizeEl  = document.getElementById('wa-dp-size');
    const styleEl = document.getElementById('wa-dp-linestyle');
    if (sizeEl)  sizeEl.value  = DS.lineSize;
    if (styleEl) styleEl.value = DS.lineStyle;

    const show = !!(tool && tool.id !== 'pointer');
    bar.classList.toggle('show', show);
  }

  function showCancelBtn() {
    const b = document.getElementById('wa-dp-cancel-btn');
    if (b) b.style.display = '';
  }
  function hideCancelBtn() {
    const b = document.getElementById('wa-dp-cancel-btn');
    if (b) b.style.display = 'none';
  }
  function updateBadge() {
    const b = document.getElementById('wa-dt-badge');
    if (!b) return;
    b.textContent = DS.drawCount;
    b.style.display = DS.drawCount > 0 ? 'flex' : 'none';
  }

  // ════════════════════════════════════════════
  // SECTION 8: FLYOUT MANAGEMENT
  // ════════════════════════════════════════════

  function closeFlyouts() {
    document.querySelectorAll('.wa-flyout.open').forEach(function (f) { f.classList.remove('open'); });
    DS.flyoutOpenId = null;
  }

  function openFlyout(groupId) {
    closeFlyouts();
    const flyout = document.getElementById('wa-flyout-' + groupId);
    if (!flyout) return;
    // Vertical position clamp trong container
    const grpBtn = document.getElementById('wa-dtg-' + groupId);
    const container = document.getElementById('sc-chart-container');
    if (grpBtn && container) {
      const btnTop  = grpBtn.getBoundingClientRect().top;
      const cTop    = container.getBoundingClientRect().top;
      const relTop  = btnTop - cTop;
      const flyH    = 220;
      const maxTop  = container.clientHeight - flyH - 8;
      flyout.style.top = Math.max(4, Math.min(relTop, maxTop)) + 'px';
    }
    flyout.classList.add('open');
    DS.flyoutOpenId = groupId;
  }

  // ════════════════════════════════════════════
  // SECTION 9: KEYBOARD SHORTCUTS
  // ════════════════════════════════════════════

  function handleKeydown(e) {
    // Bỏ qua khi đang gõ trong input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    const overlay = document.getElementById('super-chart-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;

    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); WaveDrawingAPI.undo();    return; }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); WaveDrawingAPI.redo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && DS.activeTool === 'pointer') {
      if (global.tvChart) { try { global.tvChart.removeOverlay(); } catch (err) {} }
      return;
    }
    if (e.key === 'Escape') { WaveDrawingAPI.cancelDraw(); return; }

    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      Object.values(TOOL_MAP).forEach(function (t) {
        if (t.key && e.key.toUpperCase() === t.key.toUpperCase()) {
          e.preventDefault(); activateTool(t.id);
        }
      });
    }
  }

  // ════════════════════════════════════════════
  // SECTION 10: SETTINGS PERSISTENCE
  // ════════════════════════════════════════════

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (!s) return;
      if (s.color)     DS.color     = s.color;
      if (s.fillColor) DS.fillColor = s.fillColor;
      if (s.lineSize)  DS.lineSize  = Number(s.lineSize) || 2;
      if (s.lineStyle) DS.lineStyle = s.lineStyle;
    } catch (e) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        color: DS.color, fillColor: DS.fillColor,
        lineSize: DS.lineSize, lineStyle: DS.lineStyle,
      }));
    } catch (e) {}
  }

  // ════════════════════════════════════════════
  // Custom overlay fallback registration
  // ════════════════════════════════════════════

  const _registeredCustom = new Set();

  function tryRegisterFallback(name, tool) {
    if (_registeredCustom.has(name)) return;
    const kc = global.klinecharts;
    if (!kc || typeof kc.registerOverlay !== 'function') return;
    _registeredCustom.add(name);
    try {
      kc.registerOverlay({
        name: name,
        totalStep: (tool && tool.points) ? tool.points + 1 : 3,
        createPointFigures: function (ref) {
          const coords = ref.coordinates || [];
          if (coords.length < 2) return [];
          const figs = [];
          for (let i = 0; i < coords.length - 1; i++) {
            figs.push({ type: 'line', attrs: { coordinates: [coords[i], coords[i+1]] } });
          }
          return figs;
        },
      });
    } catch (e) {}
  }

  // ════════════════════════════════════════════
  // SECTION 11: PUBLIC API
  // ════════════════════════════════════════════

  global.WaveDrawingAPI = {

    version: WD_VERSION,

    // ── Init ──────────────────────────────────
    init: function () {
      injectCSS();
      loadSettings();
      inject();
      document.addEventListener('keydown', handleKeydown);
      watchForReinit();
    },

    reinject: function () {
      ['wa-drawing-toolbar', 'wa-drawing-props'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      DS.initialized = false;
      setTimeout(inject, 300);
    },

    // ── Event handlers (gọi từ HTML onclick) ──

    // FIX: groupClick chỉ toggle flyout, KHÔNG tự kích hoạt tool khi đóng
    groupClick: function (event, groupId) {
      event.stopPropagation();
      const group = TOOL_GROUPS.find(function (g) { return g.id === groupId; });
      if (!group) return;
      if (group.tools.length === 1) {
        // Nhóm chỉ có 1 tool → kích hoạt ngay
        closeFlyouts();
        activateTool(group.tools[0].id);
        return;
      }
      const flyout = document.getElementById('wa-flyout-' + groupId);
      if (flyout && flyout.classList.contains('open')) {
        // FIX: đóng flyout thôi, không activateTool
        closeFlyouts();
      } else {
        openFlyout(groupId);
      }
    },

    groupHover: function (event, groupId) {
      // Mở flyout khi hover nếu đang có flyout khác mở
      if (DS.flyoutOpenId && DS.flyoutOpenId !== groupId) {
        openFlyout(groupId);
      }
    },

    toolClick: function (toolId, event) {
      if (event) event.stopPropagation();
      closeFlyouts();
      activateTool(toolId);
    },

    // ── Cancel vẽ dở ──────────────────────────
    cancelDraw: function () {
      // FIX: dùng DS._pendingId thay vì ID cứng 'wadrawing'
      if (global.tvChart && DS._pendingId) {
        try { global.tvChart.removeOverlay({ id: DS._pendingId }); } catch (e) {}
      }
      DS._pendingId = null;
      DS.isDrawing  = false;
      hideCancelBtn();
      activateTool('pointer');
    },

    // ── Color / Style handlers ─────────────────
    onStrokeColor: function (val) {
      DS.color = val;
      const sw = document.getElementById('wa-dp-stroke-swatch');
      if (sw) sw.style.background = val;
      saveSettings();
    },

    onFillColor: function (val) {
      DS.fillColor = hexToRgba(hexColor(val), 0.15);
      const sw = document.getElementById('wa-dp-fill-swatch');
      if (sw) sw.style.background = DS.fillColor;
      saveSettings();
    },

    setColor: function (colorHex) {
      DS.color     = colorHex;
      DS.fillColor = hexToRgba(hexColor(colorHex), 0.12);
      const sw  = document.getElementById('wa-dp-stroke-swatch');
      const inp = document.getElementById('wa-dp-stroke-color');
      const fsw = document.getElementById('wa-dp-fill-swatch');
      if (sw)  sw.style.background  = colorHex;
      if (inp) inp.value = '#' + hexColor(colorHex);
      if (fsw) fsw.style.background = DS.fillColor;
      saveSettings();
    },

    onLineSize: function (val) {
      DS.lineSize = parseInt(val, 10) || 2;
      saveSettings();
    },

    onLineStyle: function (val) {
      DS.lineStyle = val;
      saveSettings();
    },

    // ── Apply current style to ALL existing overlays ──
    applyAll: function () {
      if (!global.tvChart) return;
      // FIX: dùng getOverlays() để lấy danh sách rồi override từng cái
      let overlays = [];
      if (typeof global.tvChart.getOverlays === 'function') {
        try { overlays = global.tvChart.getOverlays() || []; } catch (e) {}
      }
      const styles = buildOverlayStyles({ isShape: true });
      if (overlays.length > 0) {
        overlays.forEach(function (ov) {
          try { global.tvChart.overrideOverlay({ id: ov.id, styles: styles }); } catch (e) {}
        });
      } else {
        // Fallback: override không filter (override tất cả)
        try { global.tvChart.overrideOverlay({ styles: styles }); } catch (e) {}
      }
    },

    // ── Undo / Redo ───────────────────────────
    undo: function () {
      if (!global.tvChart) return;
      // Thử native undoOverlay trước (nếu KLC version hỗ trợ)
      if (typeof global.tvChart.undoOverlay === 'function') {
        try {
          global.tvChart.undoOverlay();
          if (DS.drawCount > 0) DS.drawCount--;
          updateBadge();
          return;
        } catch (e) {}
      }
      // FIX Fallback: xóa theo history stack — KHÔNG gọi removeOverlay() không tham số
      if (DS._history.length === 0) return;
      const lastId = DS._history.pop();
      try { global.tvChart.removeOverlay({ id: lastId }); } catch (e) {}
      if (DS.drawCount > 0) DS.drawCount--;
      updateBadge();
    },

    redo: function () {
      if (!global.tvChart) return;
      if (typeof global.tvChart.redoOverlay === 'function') {
        try {
          global.tvChart.redoOverlay();
          DS.drawCount++;
          updateBadge();
        } catch (e) {}
      }
    },

    // ── Visibility toggle ─────────────────────
    toggleVisibility: function () {
      if (!global.tvChart) return;
      DS.allVisible = !DS.allVisible;
      try { global.tvChart.overrideOverlay({ visible: DS.allVisible }); } catch (e) {}
      const btn = document.getElementById('wa-dt-vis-btn');
      if (btn) {
        const icon = btn.querySelector('.wa-dt-icon');
        const tip  = btn.querySelector('.wa-dt-tip');
        if (icon) icon.textContent = DS.allVisible ? '◎' : '○';
        if (tip)  tip.textContent  = DS.allVisible ? 'Ẩn/Hiện hình vẽ' : 'Hiện tất cả hình vẽ';
      }
    },

    // ── Delete all ────────────────────────────
    deleteAll: function () {
      if (!global.tvChart) return;
      if (!confirm('Xóa tất cả hình vẽ trên chart?\nKhông thể hoàn tác!')) return;
      // FIX: removeOverlay() không tham số = xóa tất cả (đúng theo KLC API)
      try { global.tvChart.removeOverlay(); } catch (e) {}
      DS.drawCount  = 0;
      DS._history   = [];
      DS._pendingId = null;
      updateBadge();
      if (typeof global.applyFishFilter === 'function') {
        setTimeout(global.applyFishFilter, 100);
      }
    },

    // ── State accessor ─────────────────────────
    getState: function () { return Object.assign({}, DS); },
    getTools: function () { return TOOL_GROUPS; },
  };

  // ════════════════════════════════════════════
  // AUTO-INIT
  // ════════════════════════════════════════════

  function autoInit() { WaveDrawingAPI.init(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(autoInit, 400); });
  } else {
    setTimeout(autoInit, 400);
  }

  // Hook vào openProChart để re-inject sau khi chart khởi động lại
  const _origOpen = global.openProChart;
  Object.defineProperty(global, 'openProChart', {
    configurable: true,
    get: function () { return _hookedOpen; },
    set: function (fn) { _origRef = fn; },
  });
  let _origRef = _origOpen;
  function _hookedOpen() {
    if (_origRef) _origRef.apply(this, arguments);
    setTimeout(function () {
      if (!document.getElementById('wa-drawing-toolbar')) {
        WaveDrawingAPI.reinject();
      }
    }, 500);
  }

  // Fallback patch sau khi openProChart được set
  setTimeout(function () {
    if (typeof global.openProChart === 'function' && global.openProChart !== _hookedOpen) {
      const orig = global.openProChart;
      global.openProChart = function () {
        orig.apply(this, arguments);
        setTimeout(function () {
          if (!document.getElementById('wa-drawing-toolbar')) WaveDrawingAPI.reinject();
        }, 500);
      };
    }
  }, 1000);

  console.log(`Wave Alpha Drawing Tools v${WD_VERSION} — module loaded.`);

}(window));