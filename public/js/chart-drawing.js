// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — DRAWING TOOLS ENGINE
// Version: 1.0.0 | KLineCharts Compatible
// ==========================================
// ── SECTION 1: CONSTANTS & REGISTRY ───────
// ── SECTION 2: DRAWING STATE ──────────────
// ── SECTION 3: CSS INJECTION ──────────────
// ── SECTION 4: TOOLBAR HTML ───────────────
// ── SECTION 5: DOM INJECTION ──────────────
// ── SECTION 6: TOOL ACTIVATION ────────────
// ── SECTION 7: OVERLAY STYLE BUILDER ──────
// ── SECTION 8: EVENT SUBSCRIPTIONS ────────
// ── SECTION 9: FLYOUT MANAGEMENT ──────────
// ── SECTION 10: KEYBOARD SHORTCUTS ────────
// ── SECTION 11: SETTINGS PERSISTENCE ──────
// ── SECTION 12: PUBLIC API ────────────────
// ==========================================

(function (global) {
  'use strict';

  const WD_VERSION = '1.0.0';
  const LS_SETTINGS_KEY = 'wa_draw_settings_v1';

  // ══════════════════════════════════════════════════════
  // SECTION 1: TOOL REGISTRY
  // Toàn bộ công cụ vẽ — KLineCharts built-in overlay names
  // ══════════════════════════════════════════════════════

  /**
   * @typedef {Object} DrawTool
   * @property {string}  id          — unique ID
   * @property {string}  name        — tên hiển thị tiếng Việt
   * @property {string}  overlay     — KLineCharts overlay name (null = no overlay)
   * @property {string}  icon        — emoji/ký tự icon
   * @property {string}  [key]       — keyboard shortcut
   * @property {string}  desc        — mô tả ngắn
   * @property {number}  [points]    — số điểm cần click
   * @property {boolean} [isShape]   — có polygon fill
   */

  /** @type {Array<{id,label,icon,tools:DrawTool[]}>} */
  const TOOL_GROUPS = [
    // ── 0. Cursor ─────────────────────────────────────
    {
      id: 'cursor', label: 'Con Trỏ', icon: '↖',
      tools: [
        { id: 'pointer', name: 'Con trỏ / Chọn', overlay: null,       icon: '↖', key: 'Escape', desc: 'Chọn, di chuyển, chỉnh sửa hình vẽ', points: 0 },
        { id: 'eraser',  name: 'Xóa nhanh',       overlay: '__erase__', icon: '⌫', key: 'E',      desc: 'Click lên hình vẽ để xóa ngay',     points: 0 },
      ]
    },

    // ── 1. Lines & Rays ───────────────────────────────
    {
      id: 'lines', label: 'Đường & Tia', icon: '╱',
      tools: [
        { id: 'segment',                name: 'Đường xu hướng',          overlay: 'segment',                  icon: '╱', key: 'L', desc: '2 điểm — đoạn thẳng',               points: 2 },
        { id: 'ray',                    name: 'Tia một chiều (Ray)',      overlay: 'ray',                      icon: '→',          desc: '2 điểm — kéo dài về 1 phía',        points: 2 },
        { id: 'straightLine',           name: 'Đường thẳng hai chiều',    overlay: 'straightLine',             icon: '↔',          desc: '2 điểm — kéo dài vô hạn 2 chiều',  points: 2 },
        { id: 'horizontalStraightLine', name: 'Đường nằm ngang (∞)',     overlay: 'horizontalStraightLine',   icon: '─', key: 'H', desc: '1 điểm — ngang vô hạn',             points: 1 },
        { id: 'horizontalRayLine',      name: 'Tia nằm ngang',           overlay: 'horizontalRayLine',        icon: '⟶',          desc: '2 điểm — ngang 1 chiều',            points: 2 },
        { id: 'horizontalSegment',      name: 'Đoạn nằm ngang',          overlay: 'horizontalSegment',        icon: '⊢',          desc: '2 điểm — đoạn ngang có giới hạn',   points: 2 },
        { id: 'verticalStraightLine',   name: 'Đường thẳng đứng (∞)',    overlay: 'verticalStraightLine',     icon: '│', key: 'V', desc: '1 điểm — dọc vô hạn',              points: 1 },
        { id: 'verticalRayLine',        name: 'Tia thẳng đứng',          overlay: 'verticalRayLine',          icon: '↑',          desc: '2 điểm — dọc 1 chiều',              points: 2 },
        { id: 'verticalSegment',        name: 'Đoạn thẳng đứng',         overlay: 'verticalSegment',          icon: '⊥',          desc: '2 điểm — đoạn dọc có giới hạn',    points: 2 },
        { id: 'priceLine',              name: 'Nhãn giá (Price Line)',    overlay: 'priceLine',                icon: '＄',          desc: '1 điểm — đường giá có nhãn số',     points: 1 },
        { id: 'arrow',                  name: 'Mũi tên (Arrow)',          overlay: 'arrow',                   icon: '↗',          desc: '2 điểm — mũi tên có đầu nhọn',     points: 2 },
      ]
    },

    // ── 2. Channels ───────────────────────────────────
    {
      id: 'channels', label: 'Kênh Giá', icon: '⫣',
      tools: [
        { id: 'priceChannelLine',     name: 'Kênh giá (Price Channel)',      overlay: 'priceChannelLine',     icon: '⟰', desc: '3 điểm — kênh song song, dùng cho phân tích trend', points: 3 },
        { id: 'parallelStraightLine', name: 'Đường song song (Parallel)',    overlay: 'parallelStraightLine', icon: '⫿', desc: '3 điểm — 2 đường song song vô hạn',               points: 3 },
      ]
    },

    // ── 3. Fibonacci ──────────────────────────────────
    {
      id: 'fibonacci', label: 'Fibonacci', icon: 'ϕ',
      tools: [
        { id: 'fibonacciLine',               name: 'Fib Retracement (Hồi quy)',       overlay: 'fibonacciLine',               icon: 'ℱ', key: 'F', desc: '2 điểm — mức hồi quy Fib: 23.6% 38.2% 50% 61.8% 78.6%', points: 2 },
        { id: 'fibonacciSegment',            name: 'Fib Segment',                     overlay: 'fibonacciSegment',            icon: 'ℱs',          desc: '2 điểm — Fib tính trên đoạn thẳng',                    points: 2 },
        { id: 'fibonacciExtension',          name: 'Fib Extension (Mở rộng)',         overlay: 'fibonacciExtension',          icon: 'ℱe',          desc: '3 điểm — mức mở rộng Fib: 127.2% 161.8% 200% 261.8%', points: 3 },
        { id: 'fibonacciSpiral',             name: 'Fib Spiral (Xoắn ốc)',            overlay: 'fibonacciSpiral',             icon: '🌀',          desc: '2 điểm — xoắn ốc Fibonacci dựa trên tỷ lệ vàng',      points: 2 },
        { id: 'fibonacciSpeedResistanceFan', name: 'Fib Speed & Resistance Fan',      overlay: 'fibonacciSpeedResistanceFan', icon: 'ℱf',          desc: '2 điểm — quạt kháng cự / tốc độ Fibonacci',           points: 2 },
        { id: 'fibTrendExtension',           name: 'Trend-Based Fib Extension',       overlay: 'fibonacciExtension',          icon: 'ℱt',          desc: '3 điểm — mở rộng Fib theo xu hướng (A→B→C)',          points: 3 },
      ]
    },

    // ── 4. Gann ───────────────────────────────────────
    {
      id: 'gann', label: 'Gann', icon: 'ℊ',
      tools: [
        { id: 'gannBox',    name: 'Gann Box (Hộp)',       overlay: 'gannBox',    icon: '⊞', desc: '2 điểm — hộp Gann với góc 1×1, 2×1, 1×2', points: 2 },
        { id: 'gannFan',    name: 'Gann Fan (Quạt)',      overlay: 'gannFan',    icon: '⊠', desc: '2 điểm — quạt Gann 8 góc cổ điển',          points: 2 },
        { id: 'gannSquare', name: 'Gann Square (Vuông)',  overlay: 'gannSquare', icon: '⊟', desc: '2 điểm — hình vuông Gann với lưới nội tâm',  points: 2 },
      ]
    },

    // ── 5. Elliott Wave ───────────────────────────────
    {
      id: 'elliott', label: 'Sóng Elliott', icon: '〜',
      tools: [
        { id: 'elliottImpulseWave',     name: 'Sóng đẩy Impulse (1-2-3-4-5)',    overlay: 'elliottImpulseWave',     icon: '①②③④⑤', desc: '6 điểm — sóng đẩy 5 bước (motive wave)',     points: 6 },
        { id: 'elliottCorrectiveWave',  name: 'Sóng điều chỉnh Corrective (ABC)', overlay: 'elliottCorrectiveWave',  icon: 'Ⓐ-Ⓑ-Ⓒ',  desc: '4 điểm — sóng điều chỉnh 3 bước zigzag',   points: 4 },
        { id: 'elliottTriangleWave',    name: 'Sóng tam giác (A-B-C-D-E)',        overlay: 'elliottTriangleWave',    icon: '△',       desc: '5 điểm — sóng tam giác Elliott 5 cạnh',    points: 5 },
        { id: 'elliottDoubleComboWave', name: 'Sóng kép Double Combo (WXY)',      overlay: 'elliottDoubleComboWave', icon: 'WXY',     desc: '7 điểm — sóng kép phức tạp W-X-Y',        points: 7 },
        { id: 'elliottTripleComboWave', name: 'Sóng ba Triple Combo (WXYXZ)',     overlay: 'elliottTripleComboWave', icon: 'WXYXZ',   desc: '9 điểm — sóng ba phức tạp W-X-Y-X-Z',     points: 9 },
      ]
    },

    // ── 6. Shapes ─────────────────────────────────────
    {
      id: 'shapes', label: 'Hình Vẽ', icon: '□',
      tools: [
        { id: 'rect',         name: 'Hình chữ nhật (Rectangle)',  overlay: 'rect',         icon: '▭', key: 'R', desc: '2 điểm — vùng tô màu hình chữ nhật', points: 2, isShape: true },
        { id: 'circle',       name: 'Hình tròn (Circle)',          overlay: 'circle',       icon: '○',          desc: '2 điểm — hình tròn tô màu',          points: 2, isShape: true },
        { id: 'triangle',     name: 'Tam giác (Triangle)',         overlay: 'triangle',     icon: '△',          desc: '3 điểm — tam giác bất kỳ',           points: 3, isShape: true },
        { id: 'parallelogram',name: 'Bình hành (Parallelogram)',   overlay: 'parallelogram',icon: '▱',          desc: '3 điểm — hình bình hành',            points: 3, isShape: true },
      ]
    },

    // ── 7. Harmonic Patterns ──────────────────────────
    {
      id: 'patterns', label: 'Harmonic', icon: 'X',
      tools: [
        { id: 'xabcd', name: 'XABCD Pattern (Harmonic)', overlay: 'xabcd', icon: 'XABCD', desc: '5 điểm — Gartley / Butterfly / Bat / Crab XABCD', points: 5 },
        { id: 'abcd',  name: 'ABCD Pattern',              overlay: 'abcd',  icon: 'ABCD',  desc: '4 điểm — AB=CD harmonic pattern',               points: 4 },
        { id: 'threedrives', name: 'Three Drives Pattern', overlay: 'threedrives', icon: '3D', desc: '7 điểm — Three Drives reversal pattern',      points: 7 },
        { id: 'headshoulders', name: 'Head & Shoulders',  overlay: 'headshoulders', icon: 'H&S', desc: '7 điểm — Đầu vai đảo chiều',               points: 7 },
        { id: 'cypher',  name: 'Cypher Pattern',           overlay: 'cypher',  icon: 'CYP', desc: '5 điểm — Cypher harmonic (0.382-1.414)',       points: 5 },
      ]
    },

    // ── 8. Projections / Risk Tools ───────────────────
    {
      id: 'projections', label: 'R/R & Vùng', icon: '⊹',
      tools: [
        { id: 'longPosition',  name: 'Vị thế LONG (Risk/Reward)',  overlay: 'longPosition',  icon: '↑ L', desc: '3 điểm — Entry / Stop / Target cho Long',  points: 3 },
        { id: 'shortPosition', name: 'Vị thế SHORT (Risk/Reward)', overlay: 'shortPosition', icon: '↓ S', desc: '3 điểm — Entry / Stop / Target cho Short', points: 3 },
        { id: 'dateRangeNote', name: 'Vùng thời gian (Date Range)', overlay: 'dateRangeNote', icon: '⏱',  desc: '2 điểm — tô vùng theo thời gian',          points: 2 },
        { id: 'priceRange',    name: 'Vùng giá (Price Range)',      overlay: 'priceRange',    icon: '⟺',  desc: '2 điểm — đo khoảng cách giá',             points: 2 },
      ]
    },

    // ── 9. Text & Labels ──────────────────────────────
    {
      id: 'text', label: 'Chú Thích', icon: 'T',
      tools: [
        { id: 'text',     name: 'Văn bản (Text Label)',    overlay: 'text',     icon: 'T', key: 'T', desc: '1 điểm — nhập text ghi chú trên chart', points: 1 },
        { id: 'note',     name: 'Ghi chú có khung (Note)',  overlay: 'note',     icon: '📝',          desc: '1 điểm — ghi chú với nền màu',          points: 1 },
        { id: 'callout',  name: 'Mũi tên + Text (Callout)', overlay: 'callout',  icon: '💬',          desc: '2 điểm — bong bóng chú thích',          points: 2 },
      ]
    },
  ];

  // Flat lookup map: toolId → DrawTool
  const TOOL_MAP = {};
  TOOL_GROUPS.forEach(function (g) {
    g.tools.forEach(function (t) { TOOL_MAP[t.id] = Object.assign({ groupId: g.id }, t); });
  });

  // KLineCharts native overlay names (those guaranteed to exist)
  const KC_NATIVE_OVERLAYS = new Set([
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
    'xabcd', 'text',
  ]);

  // ══════════════════════════════════════════════════════
  // SECTION 2: DRAWING STATE
  // ══════════════════════════════════════════════════════

  const DS = {
    activeTool:  'pointer',
    color:       '#00F0FF',
    fillColor:   'rgba(0,240,255,0.12)',
    lineSize:    2,
    lineStyle:   'solid',   // 'solid' | 'dashed' | 'dotted'
    textSize:    13,
    textContent: '',
    allVisible:  true,
    drawCount:   0,
    isDrawing:   false,
    flyoutOpenId: null,
    initialized:  false,
  };

  // ══════════════════════════════════════════════════════
  // SECTION 3: CSS INJECTION
  // ══════════════════════════════════════════════════════

  function injectCSS() {
    if (document.getElementById('wa-drawing-css')) return;
    const style = document.createElement('style');
    style.id = 'wa-drawing-css';
    style.textContent = `
      /* ── Layout: ensure chart container is relative ─── */
      #sc-chart-container { position: relative !important; }

      /* ═══════════════════════════════════════════════
         DRAWING TOOLBAR (left strip inside chart)
      ═══════════════════════════════════════════════ */
      #wa-drawing-toolbar {
        position: absolute;
        left: 0; top: 0;
        width: 36px;
        height: 100%;
        z-index: 300;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 0 6px;
        gap: 1px;
        background: rgba(18, 22, 28, 0.93);
        border-right: 1px solid rgba(255,255,255,0.06);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        overflow: hidden;
        overflow-y: auto;
        scrollbar-width: none;
        user-select: none;
        box-sizing: border-box;
      }
      #wa-drawing-toolbar::-webkit-scrollbar { display: none; }

      /* ── Group wrapper (relative for flyout positioning) */
      .wa-dt-group {
        position: relative;
        width: 100%;
        display: flex;
        justify-content: center;
        flex-shrink: 0;
      }

      /* ── Separator ─────────────────────────────────── */
      .wa-dt-sep {
        width: 22px; height: 1px;
        background: rgba(255,255,255,0.07);
        margin: 3px 0;
        flex-shrink: 0;
        align-self: center;
      }

      /* ── Tool button ───────────────────────────────── */
      .wa-dt-btn {
        width: 30px; height: 30px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: #616b76;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.13s, color 0.13s, border-color 0.13s;
        flex-shrink: 0;
        position: relative;
        outline: none;
        padding: 0;
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
      /* Small chevron on buttons with flyouts */
      .wa-dt-btn.has-flyout::after {
        content: '';
        position: absolute;
        bottom: 3px; right: 3px;
        width: 3.5px; height: 3.5px;
        border-right: 1.5px solid currentColor;
        border-bottom: 1.5px solid currentColor;
        opacity: 0.4;
        pointer-events: none;
      }

      /* ── Flyout sub-menu ───────────────────────────── */
      .wa-flyout {
        position: absolute;
        left: 38px;
        top: -2px;
        background: #13171d;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 9px;
        padding: 6px 5px;
        min-width: 224px;
        z-index: 9999;
        box-shadow: 0 12px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4);
        display: none;
        flex-direction: column;
        gap: 1px;
        pointer-events: all;
      }
      .wa-flyout.open { display: flex; }

      .wa-flyout-header {
        font-size: 9px;
        font-weight: 800;
        color: #3a434f;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 4px 8px 7px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        margin-bottom: 2px;
      }
      .wa-flyout-item {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 6px 9px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.1s;
        color: #7a8694;
        font-size: 11.5px;
      }
      .wa-flyout-item:hover { background: rgba(255,255,255,0.06); color: #d4dae2; }
      .wa-flyout-item.active {
        background: rgba(0,240,255,0.09);
        color: #00F0FF;
      }
      .wa-flyout-icon {
        font-size: 13px;
        width: 20px;
        text-align: center;
        flex-shrink: 0;
        opacity: 0.85;
      }
      .wa-flyout-info { flex: 1; min-width: 0; }
      .wa-flyout-name { display: block; }
      .wa-flyout-desc {
        display: block;
        font-size: 9.5px;
        color: #3a434f;
        margin-top: 1px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wa-flyout-pts {
        font-size: 9px;
        color: #2d353f;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 3px;
        padding: 1px 4px;
        flex-shrink: 0;
        font-family: monospace;
      }
      .wa-flyout-key {
        font-size: 9px;
        color: #2d353f;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 3px;
        padding: 1px 5px;
        flex-shrink: 0;
        font-family: monospace;
      }

      /* ── Tooltip (hover on toolbar button) ─────────── */
      .wa-dt-tip {
        position: absolute;
        left: 40px;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(10, 13, 17, 0.95);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        padding: 4px 9px;
        font-size: 11px;
        color: #c8cdd4;
        white-space: nowrap;
        pointer-events: none;
        z-index: 9998;
        opacity: 0;
        transition: opacity 0.15s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      }
      .wa-dt-btn:hover .wa-dt-tip { opacity: 1; }

      /* ═══════════════════════════════════════════════
         PROPERTIES BAR (top of chart, shows when drawing)
      ═══════════════════════════════════════════════ */
      #wa-drawing-props {
        position: absolute;
        top: 8px;
        left: 46px;
        right: 8px;
        height: 36px;
        background: rgba(14, 18, 24, 0.95);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 9px;
        display: none;
        align-items: center;
        gap: 5px;
        padding: 0 10px;
        z-index: 295;
        box-shadow: 0 6px 20px rgba(0,0,0,0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        flex-wrap: nowrap;
        overflow: hidden;
      }
      #wa-drawing-props.show { display: flex; }

      .wa-dp-tool-badge {
        font-size: 11px;
        font-weight: 700;
        color: #00F0FF;
        flex-shrink: 0;
        padding-right: 2px;
        white-space: nowrap;
        max-width: 130px;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wa-dp-sep {
        width: 1px; height: 20px;
        background: rgba(255,255,255,0.08);
        flex-shrink: 0;
        margin: 0 1px;
      }
      .wa-dp-lbl {
        font-size: 10px;
        color: #4a5460;
        flex-shrink: 0;
      }

      /* Color swatch */
      .wa-dp-color-box {
        position: relative;
        width: 22px; height: 22px;
        border-radius: 5px;
        border: 1.5px solid rgba(255,255,255,0.15);
        cursor: pointer;
        overflow: hidden;
        flex-shrink: 0;
        transition: border-color 0.12s;
      }
      .wa-dp-color-box:hover { border-color: rgba(255,255,255,0.4); }
      .wa-dp-color-box .wa-dp-swatch { width: 100%; height: 100%; border-radius: 3px; }
      .wa-dp-color-box input[type=color] {
        position: absolute; opacity: 0;
        width: 200%; height: 200%;
        top: -50%; left: -50%;
        cursor: pointer; border: none; padding: 0;
      }

      /* Preset swatches */
      .wa-dp-preset {
        width: 14px; height: 14px;
        border-radius: 3px;
        cursor: pointer;
        flex-shrink: 0;
        border: 1px solid rgba(255,255,255,0.12);
        transition: transform 0.1s, border-color 0.1s;
      }
      .wa-dp-preset:hover { transform: scale(1.25); border-color: rgba(255,255,255,0.5); }

      /* Select */
      .wa-dp-sel {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 5px;
        color: #c8cdd4;
        font-size: 11px;
        padding: 3px 5px;
        cursor: pointer;
        outline: none;
        transition: border-color 0.12s;
        flex-shrink: 0;
      }
      .wa-dp-sel:hover, .wa-dp-sel:focus { border-color: rgba(0,240,255,0.4); }

      /* Buttons */
      .wa-dp-btn {
        padding: 4px 9px;
        border-radius: 5px;
        border: 1px solid rgba(255,255,255,0.08);
        background: transparent;
        color: #7a8694;
        font-size: 10.5px;
        cursor: pointer;
        transition: all 0.12s;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .wa-dp-btn:hover { border-color: rgba(0,240,255,0.4); color: #00F0FF; background: rgba(0,240,255,0.05); }
      .wa-dp-btn.red:hover { border-color: rgba(246,70,93,0.4); color: #F6465D; background: rgba(246,70,93,0.05); }
      .wa-dp-btn.accent { background: rgba(0,240,255,0.1); border-color: rgba(0,240,255,0.3); color: #00F0FF; }

      /* ── Drawing status indicator in toolbar ───────── */
      .wa-dt-badge {
        position: absolute; top: 1px; right: 1px;
        background: #00F0FF; color: #000;
        font-size: 7px; font-weight: 800;
        min-width: 11px; height: 11px;
        border-radius: 5px;
        display: none;
        align-items: center; justify-content: center;
        padding: 0 2px;
        pointer-events: none;
        line-height: 1;
      }

      /* ── Toolbar spacer to push controls to bottom ─── */
      .wa-dt-spacer { flex: 1; }

      /* ── Crosshair cursor when tool active ─────────── */
      .wa-chart-drawing-mode canvas { cursor: crosshair !important; }
    `;
    document.head.appendChild(style);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 4: TOOLBAR HTML BUILDER
  // ══════════════════════════════════════════════════════

  const PRESET_COLORS = ['#00F0FF', '#F0B90B', '#0ECB81', '#F6465D', '#EAECEF', '#848e9c', '#cb55e3', '#FF8C00'];

  function buildToolbarHTML() {
    let html = '';

    TOOL_GROUPS.forEach(function (group, gi) {
      if (gi > 0) html += '<div class="wa-dt-sep"></div>';

      const representTool = group.tools[0];
      const hasFlyout = group.tools.length > 1;

      html += `
        <div class="wa-dt-group" data-group="${group.id}">
          <button
            class="wa-dt-btn${hasFlyout ? ' has-flyout' : ''}"
            id="wa-dtg-${group.id}"
            data-group="${group.id}"
            data-tool="${representTool.id}"
            onclick="WaveDrawingAPI._groupClick(event,'${group.id}')"
            onmouseenter="WaveDrawingAPI._groupHover(event,'${group.id}')"
          >
            <span>${representTool.icon}</span>
            <span class="wa-dt-tip">${group.label}</span>
          </button>
          ${buildFlyoutHTML(group)}
        </div>`;
    });

    // Spacer + bottom controls
    html += `
      <div class="wa-dt-spacer"></div>
      <div class="wa-dt-sep"></div>
      <div class="wa-dt-group">
        <button class="wa-dt-btn" onclick="WaveDrawingAPI.undo()" title="">
          ↩<span class="wa-dt-tip">Undo (Ctrl+Z)</span>
        </button>
      </div>
      <div class="wa-dt-group">
        <button class="wa-dt-btn" onclick="WaveDrawingAPI.redo()" title="">
          ↪<span class="wa-dt-tip">Redo (Ctrl+Y)</span>
        </button>
      </div>
      <div class="wa-dt-sep"></div>
      <div class="wa-dt-group">
        <button class="wa-dt-btn" id="wa-dt-vis-btn" onclick="WaveDrawingAPI.toggleVisibility()">
          👁<span class="wa-dt-tip">Ẩn/Hiện hình vẽ</span>
        </button>
      </div>
      <div class="wa-dt-group" style="position:relative;">
        <button class="wa-dt-btn" onclick="WaveDrawingAPI.deleteAll()" id="wa-dt-del-btn">
          🗑<span class="wa-dt-badge" id="wa-dt-badge">0</span>
          <span class="wa-dt-tip">Xóa tất cả hình vẽ</span>
        </button>
      </div>
    `;
    return html;
  }

  function buildFlyoutHTML(group) {
    if (group.tools.length <= 1) return '';

    let html = `<div class="wa-flyout" id="wa-flyout-${group.id}">
      <div class="wa-flyout-header">${group.label}</div>`;

    group.tools.forEach(function (tool) {
      const ptsLabel = tool.points ? `<span class="wa-flyout-pts">${tool.points}đ</span>` : '';
      const keyLabel = tool.key ? `<span class="wa-flyout-key">${tool.key}</span>` : '';
      html += `
        <div class="wa-flyout-item" data-tool="${tool.id}"
          onclick="WaveDrawingAPI._toolClick('${tool.id}',event)">
          <span class="wa-flyout-icon">${tool.icon}</span>
          <span class="wa-flyout-info">
            <span class="wa-flyout-name">${tool.name}</span>
            <span class="wa-flyout-desc">${tool.desc || ''}</span>
          </span>
          ${ptsLabel}
          ${keyLabel}
        </div>`;
    });

    html += '</div>';
    return html;
  }

  function buildPropsBarHTML() {
    const presets = PRESET_COLORS.map(function (c) {
      return `<div class="wa-dp-preset" style="background:${c};" title="${c}"
        onclick="WaveDrawingAPI._setColor('${c}')"></div>`;
    }).join('');

    return `
      <div id="wa-drawing-props">
        <span class="wa-dp-tool-badge" id="wa-dp-toolname">Công cụ vẽ</span>
        <div class="wa-dp-sep"></div>

        <span class="wa-dp-lbl">Màu:</span>
        <div class="wa-dp-color-box" title="Màu đường / viền">
          <div class="wa-dp-swatch" id="wa-dp-stroke-swatch" style="background:#00F0FF;"></div>
          <input type="color" id="wa-dp-stroke-color" value="#00F0FF"
            oninput="WaveDrawingAPI._onStrokeColor(this.value)">
        </div>

        <span class="wa-dp-lbl">Nền:</span>
        <div class="wa-dp-color-box" title="Màu nền (fill)">
          <div class="wa-dp-swatch" id="wa-dp-fill-swatch" style="background:rgba(0,240,255,0.12);"></div>
          <input type="color" id="wa-dp-fill-color" value="#00f0ff"
            oninput="WaveDrawingAPI._onFillColor(this.value)">
        </div>

        <div class="wa-dp-sep"></div>

        <span class="wa-dp-lbl">Nét:</span>
        <select class="wa-dp-sel" id="wa-dp-size"
          onchange="WaveDrawingAPI._onLineSize(this.value)">
          <option value="1">1px</option>
          <option value="2" selected>2px</option>
          <option value="3">3px</option>
          <option value="4">4px</option>
          <option value="5">5px</option>
        </select>

        <select class="wa-dp-sel" id="wa-dp-linestyle"
          onchange="WaveDrawingAPI._onLineStyle(this.value)">
          <option value="solid">───</option>
          <option value="dashed">- - -</option>
          <option value="dotted">· · ·</option>
        </select>

        <div class="wa-dp-sep"></div>

        ${presets}

        <div class="wa-dp-sep"></div>

        <button class="wa-dp-btn accent" onclick="WaveDrawingAPI._applyAll()" title="Áp dụng màu/kiểu này cho TẤT CẢ hình vẽ">Áp dụng tất cả</button>
        <button class="wa-dp-btn red" onclick="WaveDrawingAPI.deleteAll()">🗑 Xóa tất</button>
        <button class="wa-dp-btn" id="wa-dp-cancel-btn" style="display:none;" onclick="WaveDrawingAPI._cancelDraw()">✕ Hủy vẽ</button>
      </div>`;
  }

  // ══════════════════════════════════════════════════════
  // SECTION 5: DOM INJECTION
  // ══════════════════════════════════════════════════════

  let _mutationObserver = null;

  function inject() {
    const container = document.getElementById('sc-chart-container');
    if (!container) {
      setTimeout(inject, 600);
      return;
    }

    // Prevent double-inject
    if (document.getElementById('wa-drawing-toolbar')) return;

    container.style.position = 'relative';

    // Inject toolbar
    const toolbarDiv = document.createElement('div');
    toolbarDiv.id = 'wa-drawing-toolbar';
    toolbarDiv.innerHTML = buildToolbarHTML();
    container.appendChild(toolbarDiv);

    // Inject properties bar
    const propsWrap = document.createElement('div');
    propsWrap.innerHTML = buildPropsBarHTML();
    container.appendChild(propsWrap.firstElementChild);

    // Subscribe to chart overlay events
    subscribeToChart();

    // Close flyouts on outside click
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.wa-dt-group') && !e.target.closest('.wa-flyout')) {
        closeFlyouts();
      }
    }, true);

    DS.initialized = true;
    updatePropsBar();

    console.log('[WaveDrawing v' + WD_VERSION + '] ✅ Toolbar injected into #sc-chart-container');
  }

  /**
   * Watch for chart re-initializations (openProChart clears container.innerHTML)
   * and re-inject the toolbar automatically.
   */
  function watchForChartReinit() {
    const target = document.getElementById('super-chart-overlay') || document.body;
    if (_mutationObserver) _mutationObserver.disconnect();

    _mutationObserver = new MutationObserver(function () {
      const container = document.getElementById('sc-chart-container');
      if (container && !document.getElementById('wa-drawing-toolbar')) {
        // Chart was re-initialized, re-inject after a short delay
        setTimeout(inject, 350);
      }
    });

    _mutationObserver.observe(target, { childList: true, subtree: true });
  }

  // ══════════════════════════════════════════════════════
  // SECTION 6: TOOL ACTIVATION
  // ══════════════════════════════════════════════════════

  function activateTool(toolId) {
    const tool = TOOL_MAP[toolId];
    if (!tool) return;

    DS.activeTool = toolId;
    DS.isDrawing = (toolId !== 'pointer' && toolId !== 'eraser' && !!tool.overlay);

    // ── Update toolbar button highlights ──────────────
    document.querySelectorAll('.wa-dt-btn[data-group]').forEach(function (btn) {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.wa-flyout-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.tool === toolId);
    });

    // Highlight parent group button and update its icon/tooltip
    const groupBtn = document.getElementById('wa-dtg-' + tool.groupId);
    if (groupBtn) {
      groupBtn.classList.add('active');
      const iconSpan = groupBtn.querySelector('span:first-child');
      if (iconSpan) iconSpan.textContent = tool.icon;
    }

    // ── Update props bar ───────────────────────────────
    updatePropsBar(tool);

    // ── Crosshair cursor when drawing ─────────────────
    const container = document.getElementById('sc-chart-container');
    if (container) {
      container.classList.toggle('wa-chart-drawing-mode', DS.isDrawing || toolId === 'eraser');
    }

    // ── Cancel any in-progress drawing ────────────────
    if (global.tvChart) {
      try { global.tvChart.removeOverlay({ id: '__wa_drawing__' }); } catch (e) {}
    }

    if (toolId === 'pointer' || toolId === 'eraser') {
      hideCancelBtn();
      return;
    }

    // ── Start the overlay drawing ──────────────────────
    const overlayName = tool.overlay;
    if (!overlayName || overlayName.startsWith('__')) return;

    // Check if this overlay is native or needs custom registration
    if (!KC_NATIVE_OVERLAYS.has(overlayName)) {
      tryRegisterCustomOverlay(overlayName, tool);
    }

    setTimeout(function () {
      if (!global.tvChart) return;
      try {
        global.tvChart.createOverlay({
          id: '__wa_drawing__',
          name: overlayName,
          lock: false,
          visible: true,
          styles: buildOverlayStyles(tool),
        });
        showCancelBtn();
      } catch (err) {
        console.warn('[WaveDrawing] createOverlay "' + overlayName + '" failed:', err.message);
        // Fallback: try with segment for unsupported overlays
        if (overlayName !== 'segment') {
          try {
            global.tvChart.createOverlay({
              id: '__wa_drawing__',
              name: 'segment',
              styles: buildOverlayStyles(tool),
            });
            showCancelBtn();
          } catch (e2) {}
        }
      }
    }, 60);
  }

  function updatePropsBar(tool) {
    const bar = document.getElementById('wa-drawing-props');
    if (!bar) return;

    const toolNameEl = document.getElementById('wa-dp-toolname');
    if (toolNameEl) toolNameEl.textContent = tool ? tool.name : 'Công cụ vẽ';

    // Sync state → UI
    const strokeInput = document.getElementById('wa-dp-stroke-color');
    const strokeSwatch = document.getElementById('wa-dp-stroke-swatch');
    if (strokeInput) strokeInput.value = hexColor(DS.color);
    if (strokeSwatch) strokeSwatch.style.background = DS.color;

    const fillSwatch = document.getElementById('wa-dp-fill-swatch');
    if (fillSwatch) fillSwatch.style.background = DS.fillColor;

    const sizeEl = document.getElementById('wa-dp-size');
    if (sizeEl) sizeEl.value = DS.lineSize;

    const styleEl = document.getElementById('wa-dp-linestyle');
    if (styleEl) styleEl.value = DS.lineStyle;

    // Show bar when any tool except pointer is active
    const shouldShow = !!(tool && tool.id !== 'pointer');
    bar.classList.toggle('show', shouldShow);
  }

  function showCancelBtn() {
    const btn = document.getElementById('wa-dp-cancel-btn');
    if (btn) btn.style.display = '';
  }

  function hideCancelBtn() {
    const btn = document.getElementById('wa-dp-cancel-btn');
    if (btn) btn.style.display = 'none';
  }

  function updateBadge() {
    const badge = document.getElementById('wa-dt-badge');
    if (!badge) return;
    badge.textContent = DS.drawCount;
    badge.style.display = DS.drawCount > 0 ? 'flex' : 'none';
  }

  // ══════════════════════════════════════════════════════
  // SECTION 7: OVERLAY STYLE BUILDER
  // ══════════════════════════════════════════════════════

  function buildOverlayStyles(tool) {
    const isShape = !!(tool && tool.isShape);
    return {
      line: {
        color: DS.color,
        size:  DS.lineSize,
        style: DS.lineStyle,
      },
      text: {
        color:  DS.color,
        size:   DS.textSize,
        family: 'Arial, "Segoe UI", sans-serif',
        weight: 'normal',
      },
      polygon: isShape ? {
        color:       DS.fillColor,
        style:       'fill',
        borderColor: DS.color,
        borderSize:  DS.lineSize,
        borderStyle: DS.lineStyle,
      } : {
        color:       'transparent',
        style:       'fill',
        borderColor: DS.color,
        borderSize:  DS.lineSize,
        borderStyle: DS.lineStyle,
      },
      arc: {
        color: DS.color,
        size:  DS.lineSize,
        style: DS.lineStyle,
      },
      rect: isShape ? {
        color:       DS.fillColor,
        style:       'fill',
        borderColor: DS.color,
        borderSize:  DS.lineSize,
      } : undefined,
    };
  }

  /** Convert any color string to 6-char hex for <input type=color> */
  function hexColor(colorStr) {
    if (!colorStr) return '#00F0FF';
    if (/^#[0-9a-fA-F]{6}$/.test(colorStr)) return colorStr;
    if (/^#[0-9a-fA-F]{3}$/.test(colorStr)) {
      const s = colorStr.slice(1);
      return '#' + s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
    }
    // fallback
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return '#' + [d[0],d[1],d[2]].map(function(x){ return x.toString(16).padStart(2,'0'); }).join('');
  }

  /** Hex + opacity → rgba */
  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ══════════════════════════════════════════════════════
  // SECTION 8: KLINECHARTS EVENT SUBSCRIPTIONS
  // ══════════════════════════════════════════════════════

  function subscribeToChart() {
    // Poll until tvChart is ready
    let attempts = 0;
    const poll = setInterval(function () {
      if (!global.tvChart || ++attempts > 40) { clearInterval(poll); return; }
      clearInterval(poll);

      // Drawing completed
      try {
        global.tvChart.subscribeAction('onDrawEnd', function (overlays) {
          DS.drawCount++;
          updateBadge();
          hideCancelBtn();
          DS.isDrawing = false;
          // Auto-revert to pointer after each drawing
          setTimeout(function () { activateTool('pointer'); }, 0);
        });
      } catch (e) {}

      // Drawing cancelled / removed
      try {
        global.tvChart.subscribeAction('onDrawRemove', function () {
          if (DS.drawCount > 0) DS.drawCount--;
          updateBadge();
        });
      } catch (e) {}

      // Click on existing overlay → show its properties
      try {
        global.tvChart.subscribeAction('onOverlayClick', function (params) {
          if (params && params.overlay && DS.activeTool === 'pointer') {
            const tool = TOOL_MAP[params.overlay.name] || { name: params.overlay.name, id: 'pointer', isShape: false };
            updatePropsBar(tool);
          }
        });
      } catch (e) {}

    }, 400);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 9: FLYOUT MANAGEMENT
  // ══════════════════════════════════════════════════════

  function closeFlyouts() {
    document.querySelectorAll('.wa-flyout.open').forEach(function (f) { f.classList.remove('open'); });
    DS.flyoutOpenId = null;
  }

  function openFlyout(groupId) {
    closeFlyouts();
    const flyout = document.getElementById('wa-flyout-' + groupId);
    if (!flyout) return;

    // Compute vertical position relative to the chart container
    const groupBtn = document.getElementById('wa-dtg-' + groupId);
    const container = document.getElementById('sc-chart-container');
    if (groupBtn && container) {
      const btnTop    = groupBtn.getBoundingClientRect().top;
      const cTop      = container.getBoundingClientRect().top;
      const relTop    = btnTop - cTop;
      const flyH      = flyout.offsetHeight || 220;
      const maxTop    = container.clientHeight - flyH - 8;
      flyout.style.top = Math.max(4, Math.min(relTop, maxTop)) + 'px';
    }

    flyout.classList.add('open');
    DS.flyoutOpenId = groupId;
  }

  // ══════════════════════════════════════════════════════
  // SECTION 10: KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════════════════

  function handleKeydown(e) {
    // Ignore when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const ov = document.getElementById('super-chart-overlay');
    if (!ov || !ov.classList.contains('active')) return; // chart not open

    // Ctrl+Z → Undo
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); WaveDrawingAPI.undo(); return; }
    // Ctrl+Y or Ctrl+Shift+Z → Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) { e.preventDefault(); WaveDrawingAPI.redo(); return; }
    // Delete / Backspace → remove selected overlay
    if ((e.key === 'Delete' || e.key === 'Backspace') && DS.activeTool === 'pointer') {
      if (global.tvChart) {
        try { global.tvChart.removeOverlay(); } catch (err) {}
      }
      return;
    }
    // Escape → cancel / back to pointer
    if (e.key === 'Escape') { WaveDrawingAPI._cancelDraw(); return; }

    // Tool shortcuts (single-key, no modifiers)
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      Object.values(TOOL_MAP).forEach(function (tool) {
        if (tool.key && e.key.toUpperCase() === tool.key.toUpperCase()) {
          e.preventDefault();
          activateTool(tool.id);
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // SECTION 11: CUSTOM OVERLAY REGISTRATION
  // For tools whose overlay names are not in KC native set
  // ══════════════════════════════════════════════════════

  const _registeredCustom = new Set();

  function tryRegisterCustomOverlay(name, tool) {
    if (_registeredCustom.has(name)) return;
    const kc = global.klinecharts;
    if (!kc || typeof kc.registerOverlay !== 'function') return;

    _registeredCustom.add(name);

    // Generic fallback registration — maps unknown tools to segment behavior
    try {
      kc.registerOverlay({
        name: name,
        totalStep: tool.points || 2,
        createPointFigures: function (_ref) {
          var coordinates = _ref.coordinates;
          if (!coordinates || coordinates.length < 2) return [];
          var figs = [];
          for (var i = 0; i < coordinates.length - 1; i++) {
            figs.push({
              type: 'line',
              attrs: {
                coordinates: [
                  { x: coordinates[i].x,     y: coordinates[i].y },
                  { x: coordinates[i+1].x,   y: coordinates[i+1].y },
                ]
              },
            });
          }
          return figs;
        },
      });
    } catch (e) {
      // Overlay already registered or not supported — silently ignore
    }
  }

  // ══════════════════════════════════════════════════════
  // SECTION 12: SETTINGS PERSISTENCE
  // ══════════════════════════════════════════════════════

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SETTINGS_KEY) || '{}');
      if (s.color)     DS.color     = s.color;
      if (s.fillColor) DS.fillColor = s.fillColor;
      if (s.lineSize)  DS.lineSize  = +s.lineSize || 2;
      if (s.lineStyle) DS.lineStyle = s.lineStyle;
    } catch (e) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify({
        color:     DS.color,
        fillColor: DS.fillColor,
        lineSize:  DS.lineSize,
        lineStyle: DS.lineStyle,
      }));
    } catch (e) {}
  }

  // ══════════════════════════════════════════════════════
  // SECTION 13: PUBLIC API
  // ══════════════════════════════════════════════════════

  global.WaveDrawingAPI = {
    version: WD_VERSION,

    /** Initialize drawing tools system */
    init: function () {
      injectCSS();
      loadSettings();
      inject();
      document.addEventListener('keydown', handleKeydown);
      watchForChartReinit();
    },

    /** Re-inject after chart re-initialization */
    reinject: function () {
      const existing = document.getElementById('wa-drawing-toolbar');
      if (existing) existing.remove();
      const existingProps = document.getElementById('wa-drawing-props');
      if (existingProps) existingProps.remove();
      DS.initialized = false;
      setTimeout(inject, 300);
    },

    // ── Event handlers (called from HTML onclick) ──────

    _groupClick: function (event, groupId) {
      event.stopPropagation();
      const group = TOOL_GROUPS.find(function (g) { return g.id === groupId; });
      if (!group) return;

      if (group.tools.length === 1) {
        closeFlyouts();
        activateTool(group.tools[0].id);
      } else {
        const flyout = document.getElementById('wa-flyout-' + groupId);
        if (flyout && flyout.classList.contains('open')) {
          closeFlyouts();
          // Single-click active group without flyout → activate representative tool
          activateTool(group.tools[0].id);
        } else {
          openFlyout(groupId);
        }
      }
    },

    _groupHover: function (event, groupId) {
      // Only open flyout on hover if another flyout is already open
      if (DS.flyoutOpenId && DS.flyoutOpenId !== groupId) {
        openFlyout(groupId);
      }
    },

    _toolClick: function (toolId, event) {
      if (event) event.stopPropagation();
      closeFlyouts();
      activateTool(toolId);
    },

    _cancelDraw: function () {
      if (global.tvChart) {
        try { global.tvChart.removeOverlay({ id: '__wa_drawing__' }); } catch (e) {}
        try { global.tvChart.removeOverlay(); } catch (e) {} // remove any in-progress
      }
      DS.isDrawing = false;
      hideCancelBtn();
      activateTool('pointer');
    },

    // ── Color / style change handlers ─────────────────

    _onStrokeColor: function (val) {
      DS.color = val;
      const swatch = document.getElementById('wa-dp-stroke-swatch');
      if (swatch) swatch.style.background = val;
      saveSettings();
    },

    _onFillColor: function (val) {
      DS.fillColor = hexToRgba(val, 0.15);
      const swatch = document.getElementById('wa-dp-fill-swatch');
      if (swatch) swatch.style.background = DS.fillColor;
      saveSettings();
    },

    _setColor: function (colorHex) {
      DS.color = colorHex;
      const swatch = document.getElementById('wa-dp-stroke-swatch');
      if (swatch) swatch.style.background = colorHex;
      const input  = document.getElementById('wa-dp-stroke-color');
      if (input) input.value = hexColor(colorHex);
      // Infer fill from the same color at low opacity
      DS.fillColor = hexToRgba(colorHex, 0.12);
      const fswatch = document.getElementById('wa-dp-fill-swatch');
      if (fswatch) fswatch.style.background = DS.fillColor;
      saveSettings();
    },

    _onLineSize: function (val) {
      DS.lineSize = parseInt(val) || 2;
      saveSettings();
    },

    _onLineStyle: function (val) {
      DS.lineStyle = val;
      saveSettings();
    },

    /** Apply current color/style settings to ALL existing overlays */
    _applyAll: function () {
      if (!global.tvChart) return;
      try {
        global.tvChart.overrideOverlay({
          styles: buildOverlayStyles({ isShape: true }),
        });
      } catch (e) {
        console.warn('[WaveDrawing] overrideOverlay (apply all) error:', e.message);
      }
    },

    // ── History ────────────────────────────────────────

    undo: function () {
      if (!global.tvChart) return;
      try {
        if (typeof global.tvChart.undoOverlay === 'function') {
          global.tvChart.undoOverlay();
          if (DS.drawCount > 0) DS.drawCount--;
          updateBadge();
        } else {
          // Fallback: remove last drawn overlay
          global.tvChart.removeOverlay();
        }
      } catch (e) {}
    },

    redo: function () {
      if (!global.tvChart) return;
      try {
        if (typeof global.tvChart.redoOverlay === 'function') {
          global.tvChart.redoOverlay();
          DS.drawCount++;
          updateBadge();
        }
      } catch (e) {}
    },

    // ── Visibility ─────────────────────────────────────

    toggleVisibility: function () {
      if (!global.tvChart) return;
      DS.allVisible = !DS.allVisible;
      try {
        global.tvChart.overrideOverlay({ visible: DS.allVisible });
      } catch (e) {}
      const btn = document.getElementById('wa-dt-vis-btn');
      if (btn) {
        const iconSpan = btn.querySelector('span:first-child');
        if (iconSpan) iconSpan.textContent = DS.allVisible ? '👁' : '🚫';
        const tip = btn.querySelector('.wa-dt-tip');
        if (tip) tip.textContent = DS.allVisible ? 'Ẩn/Hiện hình vẽ' : 'Hiện tất cả hình vẽ';
      }
    },

    // ── Delete ─────────────────────────────────────────

    deleteAll: function () {
      if (!global.tvChart) return;
      if (!confirm('Xóa tất cả hình vẽ trên chart?\n(Không thể hoàn tác)')) return;
      try {
        if (typeof global.tvChart.removeAllOverlay === 'function') {
          global.tvChart.removeAllOverlay();
        } else {
          global.tvChart.removeOverlay();
        }
      } catch (e) {}
      DS.drawCount = 0;
      updateBadge();
      // Re-draw fish markers
      if (typeof global.applyFishFilter === 'function') {
        setTimeout(global.applyFishFilter, 100);
      }
    },

    // ── State accessor (for external use) ─────────────
    getState: function () { return Object.assign({}, DS); },
    getTools: function () { return TOOL_GROUPS; },
  };

  // ══════════════════════════════════════════════════════
  // AUTO-INIT
  // Delay to ensure DOM + KLineCharts are ready
  // ══════════════════════════════════════════════════════

  function autoInit() {
    WaveDrawingAPI.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(autoInit, 400); });
  } else {
    setTimeout(autoInit, 400);
  }

  // Hook into openProChart to re-inject drawing toolbar after chart re-init
  // (openProChart sets container.innerHTML = '' which destroys the toolbar)
  const _origOpenProChart = global.openProChart;
  Object.defineProperty(global, 'openProChart', {
    configurable: true,
    get: function () { return _hookedOpenProChart; },
    set: function (fn) { /* allow overwrite from chart-ui.js */ _origRef = fn; }
  });
  let _origRef = _origOpenProChart;

  function _hookedOpenProChart() {
    if (_origRef) _origRef.apply(this, arguments);
    // Re-inject drawing toolbar ~500ms after chart init sequence completes
    setTimeout(function () {
      if (!document.getElementById('wa-drawing-toolbar')) {
        WaveDrawingAPI.reinject();
      }
    }, 500);
  }

  // Fallback: patch after window.openProChart is set
  setTimeout(function () {
    if (typeof global.openProChart === 'function' && global.openProChart !== _hookedOpenProChart) {
      const orig = global.openProChart;
      global.openProChart = function () {
        orig.apply(this, arguments);
        setTimeout(function () {
          if (!document.getElementById('wa-drawing-toolbar')) WaveDrawingAPI.reinject();
        }, 500);
      };
    }
  }, 1000);

  console.log('[Wave Alpha Drawing Tools v' + WD_VERSION + '] Module loaded — waiting for chart.');

})(window);
