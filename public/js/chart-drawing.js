// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — DRAGGABLE FLOATING TOOLBAR
// Version: 2.0.0 | Native KLineCharts Safe Tools
// ==========================================

(function(global) {
    'use strict';

    // Danh sách công cụ an toàn 100% của KLineCharts V9
    const DRAWING_TOOLS = [
        { id: 'segment', icon: '📏', title: 'Đường xu hướng (Trendline)' },
        { id: 'rayLine', icon: '↗️', title: 'Tia (Ray)' },
        { id: 'horizontalStraightLine', icon: '➖', title: 'Đường ngang' },
        { id: 'verticalStraightLine', icon: '│', title: 'Đường dọc' },
        { id: 'priceChannelLine', icon: '🟰', title: 'Kênh song song' },
        { id: 'fibonacciLine', icon: '📐', title: 'Fibonacci Retracement' },
        { id: 'rect', icon: '▭', title: 'Hình chữ nhật' },
        { id: 'circle', icon: '⭕', title: 'Hình tròn' },
        { id: 'triangle', icon: '🔺', title: 'Hình tam giác' },
        { id: 'text', icon: '📝', title: 'Văn bản (Text)' },
        { id: 'arrow', icon: '➡️', title: 'Mũi tên' }
    ];

    global.initDrawingToolbar = function() {
        if (document.getElementById('wa-float-drawing-bar')) return;

        // 1. TẠO CSS CHO THANH LƠ LỬNG
        const style = document.createElement('style');
        style.innerHTML = `
            #wa-float-drawing-bar {
                position: absolute; top: 100px; left: 20px; width: 44px;
                background: rgba(30, 35, 41, 0.95); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px; z-index: 10000; display: none; flex-direction: column;
                box-shadow: 0 16px 40px rgba(0,0,0,0.8); backdrop-filter: blur(8px);
                user-select: none; overflow: hidden; transition: opacity 0.2s;
            }
            .wa-draw-grip {
                width: 100%; height: 28px; cursor: grab; display: flex;
                align-items: center; justify-content: center; color: #527c82;
                border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 16px;
                background: rgba(0,0,0,0.2);
            }
            .wa-draw-grip:active { cursor: grabbing; }
            .wa-draw-btn {
                width: 44px; height: 44px; display: flex; align-items: center;
                justify-content: center; color: #848e9c; cursor: pointer;
                font-size: 18px; transition: 0.15s; position: relative;
            }
            .wa-draw-btn:hover { color: #0ECB81; background: rgba(255,255,255,0.05); }
            .wa-draw-btn.active { color: #00F0FF; background: rgba(0,240,255,0.1); border-left: 2px solid #00F0FF; }
            .wa-draw-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 2px 8px; }
        `;
        document.head.appendChild(style);

        // 2. TẠO GIAO DIỆN HTML
        const bar = document.createElement('div');
        bar.id = 'wa-float-drawing-bar';
        
        // Tay cầm (Grip) để kéo thả
        const grip = document.createElement('div');
        grip.className = 'wa-draw-grip';
        grip.innerHTML = '⋮⋮';
        grip.title = 'Kéo thả để di chuyển';
        bar.appendChild(grip);

        // Render các nút công cụ vẽ
        DRAWING_TOOLS.forEach(tool => {
            const btn = document.createElement('div');
            btn.className = 'wa-draw-btn';
            btn.innerHTML = tool.icon;
            btn.title = tool.title;
            btn.dataset.tool = tool.id;
            
            btn.onclick = () => {
                // Xóa trạng thái active của các nút khác
                document.querySelectorAll('.wa-draw-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Kích hoạt công cụ vẽ trên Chart
                if (global.tvChart) {
                    global.tvChart.createOverlay(tool.id);
                }
            };
            bar.appendChild(btn);
        });

        bar.appendChild(document.createElement('div')).className = 'wa-draw-divider';

        // Nút Xóa tất cả hình vẽ
        const clearBtn = document.createElement('div');
        clearBtn.className = 'wa-draw-btn';
        clearBtn.innerHTML = '🗑️';
        clearBtn.title = 'Xóa tất cả nét vẽ';
        clearBtn.style.color = '#F6465D';
        clearBtn.onclick = () => {
            if (global.tvChart) {
                global.tvChart.removeOverlay();
                document.querySelectorAll('.wa-draw-btn').forEach(b => b.classList.remove('active'));
            }
        };
        bar.appendChild(clearBtn);

        // Chèn vào Container của biểu đồ
        const overlayContainer = document.getElementById('super-chart-overlay') || document.body;
        overlayContainer.appendChild(bar);

        // 3. LOGIC KÉO THẢ (DRAG & DROP)
        let isDragging = false;
        let currentX; let currentY;
        let initialX; let initialY;
        let xOffset = 0; let yOffset = 0;

        grip.addEventListener('mousedown', dragStart);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('mousemove', drag);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        }
        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                bar.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        }
    };

    // HÀM BẬT / TẮT THANH CÔNG CỤ TỪ TOPBAR
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
            // Tắt chế độ vẽ trên chart nếu đang bật
            if (global.tvChart) {
                global.tvChart.overrideOverlay({ isDrawing: false });
                document.querySelectorAll('.wa-draw-btn').forEach(b => b.classList.remove('active'));
            }
        }
    };

})(window);