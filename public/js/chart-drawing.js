// ==========================================
// 🎨 FILE: chart-drawing.js
// 📦 WAVE ALPHA — FLAT DRAWING PANEL
// Version: 4.1.0 | Universal Toggle (No Button Fix Needed)
// ==========================================

(function (global) {
    'use strict';

    // 1. BƠM THUẬT TOÁN CHO CÁC CÔNG CỤ VẼ NÂNG CAO
    function registerWaveOverlays() {
        const kc = global.klinecharts;
        if (!kc) return;

        // 🌊 Sóng Elliott (5 Bước - 6 Điểm)
        kc.registerOverlay({
            name: 'waveElliott', totalStep: 6,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let lines = [], texts = [];
                let tags = ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'];
                for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
                coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
                return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
            }
        });

        // ∿ Sóng Điều Chỉnh ABC (4 Điểm)
        kc.registerOverlay({
            name: 'waveABC', totalStep: 4,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let lines = [], texts = [];
                let tags = ['(0)', '(A)', '(B)', '(C)'];
                for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
                coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
                return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
            }
        });

        // 🦇 Harmonic XABCD (5 Điểm)
        kc.registerOverlay({
            name: 'waveXABCD', totalStep: 5,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates }) {
                let lines = [], polygons = [], texts = [], tags = ['X', 'A', 'B', 'C', 'D'];
                for (let i = 0; i < coordinates.length - 1; i++) { lines.push({ coordinates: [coordinates[i], coordinates[i + 1]] }); }
                if (coordinates.length >= 3) polygons.push({ coordinates: [coordinates[0], coordinates[1], coordinates[2]] });
                if (coordinates.length >= 4) polygons.push({ coordinates: [coordinates[1], coordinates[2], coordinates[3]] });
                if (coordinates.length >= 5) polygons.push({ coordinates: [coordinates[2], coordinates[3], coordinates[4]] });
                coordinates.forEach((c, i) => { texts.push({ x: c.x, y: c.y, text: tags[i], baseline: 'bottom' }); });
                return [{ type: 'polygon', attrs: polygons, styles: { style: 'fill' } }, { type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
            }
        });

        // 📈 Fibonacci Mở Rộng (3 Điểm)
        kc.registerOverlay({
            name: 'waveFibExt', totalStep: 4,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates, bounding }) {
                if (coordinates.length < 3) return [];
                const diff = coordinates[0].y - coordinates[1].y; 
                const ratios = [0, 0.382, 0.618, 1, 1.618, 2.618];
                let lines = [], texts = [];
                ratios.forEach(r => {
                    const y = coordinates[2].y - (diff * r);
                    lines.push({ coordinates: [{ x: 0, y }, { x: bounding.width, y }] });
                    texts.push({ x: 0, y: y - 2, text: `Fib Ext ${r}`, baseline: 'bottom' });
                });
                lines.push({ coordinates: [coordinates[0], coordinates[1]] });
                lines.push({ coordinates: [coordinates[1], coordinates[2]] });
                return [{ type: 'line', attrs: lines }, { type: 'text', ignoreEvent: true, attrs: texts }];
            }
        });

        // 📝 Text (Hỗ trợ tiếng Việt có dấu)
        kc.registerOverlay({
            name: 'waveText', totalStep: 2,
            needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true,
            createPointFigures: function({ coordinates, overlay }) {
                if (coordinates.length === 0) return [];
                const txt = (overlay.extendData && overlay.extendData.text) ? overlay.extendData.text : 'Văn bản...';
                return [{ type: 'text', attrs: { x: coordinates[0].x, y: coordinates[0].y, text: txt, baseline: 'bottom' }, ignoreEvent: false }];
            }
        });
    }

    // 2. GIAO DIỆN BẢNG PHẲNG (KHÔNG XỔ MENU)
    function injectFlatToolbar() {
        if (document.getElementById('wa-flat-draw-panel')) return;
        registerWaveOverlays();

        const style = document.createElement('style');
        style.innerHTML = `
            #wa-flat-draw-panel {
                position: absolute; top: 60px; left: 20px; width: 230px;
                background: rgba(18, 22, 28, 0.98); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px; z-index: 10000; display: none; flex-direction: column;
                box-shadow: 0 16px 40px rgba(0,0,0,0.8); backdrop-filter: blur(10px);
                user-select: none;
            }
            .wa-fd-header {
                padding: 10px; cursor: move; display: flex; justify-content: space-between;
                align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);
                background: rgba(255,255,255,0.03); border-radius: 12px 12px 0 0;
            }
            .wa-fd-title { font-size: 11px; font-weight: 800; color: #00F0FF; letter-spacing: 1px; pointer-events: none; }
            .wa-fd-close { background: transparent; color: #848e9c; border: none; cursor: pointer; font-size: 16px; line-height: 1; }
            .wa-fd-close:hover { color: #F6465D; }
            .wa-fd-body { padding: 10px; display: flex; flex-direction: column; gap: 12px; max-height: 65vh; overflow-y: auto; }
            
            .wa-fd-group-title { font-size: 10px; color: #848e9c; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; }
            .wa-fd-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
            
            .wa-fd-btn {
                background: rgba(255,255,255,0.04); border: 1px solid transparent; border-radius: 6px;
                color: #eaecef; font-size: 16px; height: 38px; display: flex; align-items: center;
                justify-content: center; cursor: pointer; transition: 0.15s; position: relative;
            }
            .wa-fd-btn:hover { background: rgba(255,255,255,0.1); }
            .wa-fd-btn.active { background: rgba(0,240,255,0.15); color: #00F0FF; border-color: rgba(0,240,255,0.4); }
            
            /* Tooltip tên công cụ */
            .wa-fd-btn::after {
                content: attr(data-name); position: absolute; bottom: 110%; left: 50%; transform: translateX(-50%);
                background: #000; color: #fff; font-size: 10px; padding: 4px 6px; border-radius: 4px;
                white-space: nowrap; opacity: 0; pointer-events: none; transition: 0.2s; border: 1px solid rgba(255,255,255,0.1);
            }
            .wa-fd-btn:hover::after { opacity: 1; bottom: 120%; }

            .wa-fd-input { width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 8px; border-radius: 6px; font-size: 12px; margin-bottom: 8px; display: none; outline: none; }
            .wa-fd-input:focus { border-color: #00F0FF; }

            .wa-fd-colors { display: flex; gap: 8px; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; margin-top: 4px;}
            .wa-fd-color-btn { width: 22px; height: 22px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; transition: 0.1s;}
            .wa-fd-color-btn:hover { transform: scale(1.2); }
            .wa-fd-color-btn.active { border-color: #fff; }

            .wa-fd-footer { padding: 10px; display: flex; gap: 6px; border-top: 1px solid rgba(255,255,255,0.08); }
            .wa-fd-action { flex: 1; padding: 6px; background: rgba(255,255,255,0.05); color: #848e9c; border: none; border-radius: 6px; font-size: 11px; cursor: pointer; font-weight: bold; }
            .wa-fd-action:hover { background: rgba(255,255,255,0.1); color: #fff;}
            .wa-fd-action.red:hover { background: rgba(246,70,93,0.15); color: #F6465D; }
        `;
        document.head.appendChild(style);

        const colors = ['#00F0FF', '#0ECB81', '#F0B90B', '#F6465D', '#cb55e3', '#EAECEF'];
        global.waCurrentDrawColor = '#00F0FF';
        global.waCurrentDrawText = 'Ghi chú...';

        const toolsHTML = `
            <input type="text" id="wa-fd-text-input" class="wa-fd-input" placeholder="Nhập tiếng Việt có dấu..." oninput="window.waCurrentDrawText = this.value; window.waUpdateDrawData();">

            <div class="wa-fd-group-title">Đường & Tia</div>
            <div class="wa-fd-grid">
                <button class="wa-fd-btn" data-tool="segment" data-name="Trendline">📏</button>
                <button class="wa-fd-btn" data-tool="rayLine" data-name="Tia (Ray)">↗️</button>
                <button class="wa-fd-btn" data-tool="horizontalStraightLine" data-name="Đường Ngang">➖</button>
                <button class="wa-fd-btn" data-tool="verticalStraightLine" data-name="Đường Dọc">│</button>
            </div>
            
            <div class="wa-fd-group-title">Fibonacci & Kênh</div>
            <div class="wa-fd-grid">
                <button class="wa-fd-btn" data-tool="fibonacciLine" data-name="Fib Thoái lui">📐</button>
                <button class="wa-fd-btn" data-tool="waveFibExt" data-name="Fib Mở rộng">📈</button>
                <button class="wa-fd-btn" data-tool="priceChannelLine" data-name="Kênh song song">🟰</button>
            </div>

            <div class="wa-fd-group-title">Mẫu Hình (Pro)</div>
            <div class="wa-fd-grid">
                <button class="wa-fd-btn" data-tool="waveElliott" data-name="Sóng Elliott (5)">🌊</button>
                <button class="wa-fd-btn" data-tool="waveABC" data-name="Sóng ABC">∿</button>
                <button class="wa-fd-btn" data-tool="waveXABCD" data-name="Harmonic XABCD">🦇</button>
            </div>

            <div class="wa-fd-group-title">Hình Khối & Chữ</div>
            <div class="wa-fd-grid">
                <button class="wa-fd-btn" data-tool="rect" data-name="Hình chữ nhật">▭</button>
                <button class="wa-fd-btn" data-tool="circle" data-name="Hình tròn">⭕</button>
                <button class="wa-fd-btn" data-tool="triangle" data-name="Tam giác">🔺</button>
                <button class="wa-fd-btn" data-tool="waveText" data-name="Viết Chữ">T</button>
            </div>

            <div class="wa-fd-colors">
                <span style="font-size:11px; color:#848e9c; font-weight:bold;">MÀU:</span>
                ${colors.map(c => `<div class="wa-fd-color-btn ${c==='#00F0FF'?'active':''}" style="background:${c};" onclick="window.waSetDrawColor('${c}', this)"></div>`).join('')}
            </div>
        `;

        const panel = document.createElement('div');
        panel.id = 'wa-flat-draw-panel';
        panel.innerHTML = `
            <div class="wa-fd-header" id="wa-fd-drag">
                <span class="wa-fd-title">CÔNG CỤ VẼ</span>
                <button class="wa-fd-close" onclick="window.universalDrawToggle()">×</button>
            </div>
            <div class="wa-fd-body">${toolsHTML}</div>
            <div class="wa-fd-footer">
                <button class="wa-fd-action" onclick="window.waDrawAction('pointer')">↖ Con trỏ</button>
                <button class="wa-fd-action red" onclick="window.waDrawAction('clear')">🗑 Xóa sạch</button>
            </div>
        `;

        document.body.appendChild(panel);

        // Logic Kéo thả
        const header = document.getElementById('wa-fd-drag');
        let isDragging = false, offsetX, offsetY;
        header.onmousedown = (e) => {
            if(e.target.tagName === 'BUTTON') return;
            isDragging = true;
            offsetX = e.clientX - panel.offsetLeft;
            offsetY = e.clientY - panel.offsetTop;
        };
        document.onmousemove = (e) => {
            if (isDragging) {
                panel.style.left = (e.clientX - offsetX) + 'px';
                panel.style.top = (e.clientY - offsetY) + 'px';
            }
        };
        document.onmouseup = () => { isDragging = false; };

        // Logic Click nút công cụ
        document.querySelectorAll('.wa-fd-btn').forEach(btn => {
            btn.onclick = function() {
                document.querySelectorAll('.wa-fd-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const toolName = this.dataset.tool;
                
                // Ẩn/Hiện ô nhập chữ
                const textInput = document.getElementById('wa-fd-text-input');
                if (toolName === 'waveText') {
                    textInput.style.display = 'block';
                    textInput.focus();
                } else {
                    textInput.style.display = 'none';
                }

                window.waDrawAction(toolName);
            };
        });
    }

    // 3. XỬ LÝ LỆNH VẼ VỚI KLINECHARTS (0 DELAY)
    global.waSetDrawColor = function(colorHex, btnElement) {
        global.waCurrentDrawColor = colorHex;
        document.querySelectorAll('.wa-fd-color-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        
        const activeBtn = document.querySelector('.wa-fd-btn.active');
        if(activeBtn) window.waDrawAction(activeBtn.dataset.tool);
    };

    global.waUpdateDrawData = function() {
        const activeBtn = document.querySelector('.wa-fd-btn.active');
        if(activeBtn && activeBtn.dataset.tool === 'waveText') window.waDrawAction('waveText');
    };

    global.waDrawAction = function(actionName) {
        if (!global.tvChart) return;
        const chartContainer = document.getElementById('sc-chart-container');

        if (actionName === 'clear') {
            if(confirm('Xóa toàn bộ hình vẽ trên biểu đồ?')) global.tvChart.removeAllOverlay();
            return;
        }
        
        if (actionName === 'pointer') {
            global.tvChart.cancelDrawing();
            document.querySelectorAll('.wa-fd-btn').forEach(b => b.classList.remove('active'));
            if(chartContainer) chartContainer.style.cursor = 'crosshair';
            document.getElementById('wa-fd-text-input').style.display = 'none';
            return;
        }

        global.tvChart.cancelDrawing();
        
        const hex = global.waCurrentDrawColor;
        const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
        const fillRgba = `rgba(${r}, ${g}, ${b}, 0.15)`;

        global.tvChart.createOverlay({
            name: actionName, lock: false, visible: true,
            extendData: { text: global.waCurrentDrawText },
            styles: {
                line: { color: hex, size: 2, style: 'solid' },
                polygon: { color: fillRgba, style: 'fill', borderColor: hex, borderSize: 2 },
                text: { color: hex, size: 14, family: '"Segoe UI", sans-serif', weight: 'bold' }
            }
        });

        if(chartContainer) chartContainer.style.cursor = 'crosshair';
    };

    // 4. CHÌA KHÓA VẠN NĂNG (Bao bọc TẤT CẢ các tên hàm mở bảng vẽ)
    // Dù file chart-indicators của bạn gọi tên gì, nó cũng sẽ trúng đích!
    global.universalDrawToggle = function() {
        let panel = document.getElementById('wa-flat-draw-panel');
        if (!panel) {
            injectFlatToolbar();
            panel = document.getElementById('wa-flat-draw-panel');
        }
        if (panel.style.display === 'none' || panel.style.display === '') {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
            if (global.waDrawAction) global.waDrawAction('pointer'); 
        }
    };

    // CÁC BÍ DANH (ALIASES) ĐỂ CHỐNG LỖI NÚT BẤM CŨ
    global.toggleDrawingToolbar = global.universalDrawToggle;
    global.WaveDrawingAPI = { toggle: global.universalDrawToggle };

    // Tự động nhúng UI sau khi tải trang
    setTimeout(injectFlatToolbar, 1000);

})(window);