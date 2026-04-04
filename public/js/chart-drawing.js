// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — ADVANCED DRAWING ENGINE
// Version: 3.0.0 | Floating Toolbar + Pro Extensions
// ==========================================

(function(global) {
    'use strict';

    // ==========================================
    // 1. ĐĂNG KÝ CÁC CÔNG CỤ VẼ NÂNG CAO (PRO EXTENSIONS)
    // ==========================================
    function registerAdvancedOverlays() {
        const kc = global.klinecharts;
        if (!kc || typeof kc.registerOverlay !== 'function') return;

        // 🌊 1. SÓNG ELLIOTT 5 BƯỚC (Five Waves)
        kc.registerOverlay({
            name: 'fiveWaves', totalStep: 6,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let lines = [], texts = [];
                let tags = ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'];
                for (let i = 0; i < coordinates.length - 1; i++) {
                    lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] });
                }
                coordinates.forEach((c, i) => {
                    texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' });
                });
                return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
            }
        });

        // 📐 2. MẪU HÌNH ABCD
        kc.registerOverlay({
            name: 'abcd', totalStep: 5,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let lines = [], texts = [], polygons = [];
                let tags = ['A', 'B', 'C', 'D'];
                for (let i = 0; i < coordinates.length - 1; i++) {
                    lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] });
                }
                if (coordinates.length >= 3) polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] });
                if (coordinates.length >= 4) polygons.push({ coordinates: [coordinates[1], coordinates[2], coordinates[3]] });
                coordinates.forEach((c, i) => {
                    texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' });
                });
                return [
                    { type: 'polygon', attrs: polygons, styles: { style: 'fill', color: 'rgba(0, 240, 255, 0.15)' } },
                    { type: 'line', attrs: lines },
                    { type: 'text', ignoreEvent: true, attrs: texts }
                ];
            }
        });

        // 📏 3. FIBONACCI MỞ RỘNG (Extension)
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

        // 👤 4. MẪU HÌNH VAI ĐẦU VAI (Head & Shoulders)
        kc.registerOverlay({
            name: 'headAndShoulders', totalStep: 8,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let lines = [], texts = [], polygons = [];
                let tags = ['L', 'LS', 'N', 'H', 'N', 'RS', 'R'];
                for (let i = 0; i < coordinates.length - 1; i++) {
                    lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] });
                }
                if (coordinates.length >= 3) polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] });
                if (coordinates.length >= 5) polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] });
                if (coordinates.length >= 7) polygons.push({ coordinates: [coordinates[4], coordinates[5], coordinates[6]] });
                coordinates.forEach((c, i) => {
                    texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' });
                });
                return [
                    { type: 'polygon', attrs: polygons, styles: { style: 'fill', color: 'rgba(255, 0, 127, 0.15)' } },
                    { type: 'line', attrs: lines },
                    { type: 'text', ignoreEvent: true, attrs: texts }
                ];
            }
        });
        
        // 🔲 5. GANN BOX (Hộp Gann)
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
                    { type: 'polygon', attrs: polygons, styles: { style: 'fill', color: 'rgba(240, 185, 11, 0.08)' } },
                    { type: 'line', attrs: lines }
                ];
            }
        });
    }

    // ==========================================
    // 2. CẤU HÌNH THANH CÔNG CỤ VẼ UI
    // ==========================================
    const DRAWING_TOOLS = [
        { id: 'segment', icon: '📏', title: 'Đường xu hướng (Trendline)' },
        { id: 'rayLine', icon: '↗️', title: 'Tia (Ray)' },
        { id: 'horizontalStraightLine', icon: '➖', title: 'Đường ngang' },
        { id: 'verticalStraightLine', icon: '│', title: 'Đường dọc' },
        { id: 'priceChannelLine', icon: '🟰', title: 'Kênh song song' },
        { id: 'fibonacciLine', icon: '📐', title: 'Fibonacci Retracement' },
        { id: 'fibonacciExtension', icon: '📈', title: 'Fibonacci Mở rộng (3 điểm)' },
        { id: 'fiveWaves', icon: '🌊', title: 'Sóng Elliott (5 bước)' },
        { id: 'abcd', icon: '⚡', title: 'Mẫu hình ABCD' },
        { id: 'headAndShoulders', icon: '👤', title: 'Vai Đầu Vai' },
        { id: 'gannBox', icon: '🔲', title: 'Hộp Gann (Gann Box)' },
        { id: 'rect', icon: '▭', title: 'Hình chữ nhật' },
        { id: 'triangle', icon: '🔺', title: 'Hình tam giác' },
        { id: 'text', icon: '📝', title: 'Văn bản (Text)' }
    ];

    global.initDrawingToolbar = function() {
        if (document.getElementById('wa-float-drawing-bar')) return;

        // Đăng ký các công cụ Custom trước khi render UI
        registerAdvancedOverlays();

        const style = document.createElement('style');
        style.innerHTML = `
            #wa-float-drawing-bar {
                position: absolute; top: 80px; left: 15px; width: 76px; /* 2 Cột */
                background: rgba(22, 26, 30, 0.95); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px; z-index: 10000; display: none; flex-direction: column;
                box-shadow: 0 16px 50px rgba(0,0,0,0.8); backdrop-filter: blur(10px);
                user-select: none; transition: opacity 0.2s; overflow: hidden;
            }
            .wa-draw-grip {
                width: 100%; height: 26px; cursor: grab; display: flex;
                align-items: center; justify-content: center; color: #527c82;
                border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.25);
            }
            .wa-draw-grip:active { cursor: grabbing; }
            .wa-draw-grid {
                display: flex; flex-wrap: wrap; padding: 4px; gap: 2px;
            }
            .wa-draw-btn {
                width: 32px; height: 32px; display: flex; align-items: center;
                justify-content: center; color: #848e9c; cursor: pointer;
                font-size: 15px; border-radius: 6px; transition: 0.15s;
            }
            .wa-draw-btn:hover { color: #0ECB81; background: rgba(255,255,255,0.08); }
            .wa-draw-btn.active { color: #00F0FF; background: rgba(0,240,255,0.15); box-shadow: inset 0 0 0 1px #00F0FF; }
            .wa-draw-clear {
                width: calc(100% - 8px); margin: 4px; height: 30px; display: flex; 
                align-items: center; justify-content: center; color: #F6465D; 
                font-size: 12px; font-weight: bold; cursor: pointer; border-radius: 6px;
                background: rgba(246, 70, 93, 0.1); transition: 0.15s; border: 1px solid rgba(246, 70, 93, 0.2);
            }
            .wa-draw-clear:hover { background: rgba(246, 70, 93, 0.2); }
        `;
        document.head.appendChild(style);

        const bar = document.createElement('div');
        bar.id = 'wa-float-drawing-bar';
        
        const grip = document.createElement('div');
        grip.className = 'wa-draw-grip';
        grip.innerHTML = '⋮⋮⋮';
        grip.title = 'Kéo thả để di chuyển';
        bar.appendChild(grip);

        const grid = document.createElement('div');
        grid.className = 'wa-draw-grid';

        DRAWING_TOOLS.forEach(tool => {
            const btn = document.createElement('div');
            btn.className = 'wa-draw-btn';
            btn.innerHTML = tool.icon;
            btn.title = tool.title;
            
            btn.onclick = () => {
                document.querySelectorAll('.wa-draw-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (global.tvChart) global.tvChart.createOverlay(tool.id);
            };
            grid.appendChild(btn);
        });
        bar.appendChild(grid);

        const clearBtn = document.createElement('div');
        clearBtn.className = 'wa-draw-clear';
        clearBtn.innerHTML = '🗑️ Xóa tất cả';
        clearBtn.onclick = () => {
            if (global.tvChart) {
                global.tvChart.removeOverlay();
                document.querySelectorAll('.wa-draw-btn').forEach(b => b.classList.remove('active'));
            }
        };
        bar.appendChild(clearBtn);

        const overlayContainer = document.getElementById('super-chart-overlay') || document.body;
        overlayContainer.appendChild(bar);

        // KÉO THẢ (DRAG & DROP)
        let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;
        grip.addEventListener('mousedown', e => { initialX = e.clientX - xOffset; initialY = e.clientY - yOffset; isDragging = true; });
        document.addEventListener('mouseup', () => { initialX = currentX; initialY = currentY; isDragging = false; });
        document.addEventListener('mousemove', e => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX; currentY = e.clientY - initialY;
                xOffset = currentX; yOffset = currentY;
                bar.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        });
    };

    // HÀM BẬT / TẮT THANH CÔNG CỤ
    global.toggleDrawingToolbar = function() {
        let bar = document.getElementById('wa-float-drawing-bar');
        if (!bar) {
            global.initDrawingToolbar();
            bar = document.getElementById('wa-float-drawing-bar');
        }
        
        if (bar.style.display === 'none' || bar.style.display === '') {
            bar.style.display = 'flex';
        } else {
            bar.style.display = 'none';
            if (global.tvChart) {
                global.tvChart.overrideOverlay({ isDrawing: false });
                document.querySelectorAll('.wa-draw-btn').forEach(b => b.classList.remove('active'));
            }
        }
    };

})(window);