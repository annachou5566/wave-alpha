/**
 * ============================================================================
 * ALPHA SONAR GALAXY - PRO MILITARY EDITION (PHASE 1)
 * ============================================================================
 * Tính năng:
 * - Giao diện Military Radar (Lưới, Tia quét, Hiệu ứng sóng âm, Hào quang)
 * - Anti-Jitter: Tích hợp nội suy tuyến tính (Lerp) giúp token di chuyển mượt
 * - Control Bar Overlay: Pause/Resume, Filter Mode
 * - Side Panel Info: Bảng phân tích chi tiết khi Khóa mục tiêu (Target Lock)
 * - HUD Tooltip: Hiển thị nhanh khi rê chuột
 * ============================================================================
 */

class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error("AlphaSonar: Không tìm thấy canvas với ID:", canvasId);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement;
        this.container.style.position = 'relative'; // Bắt buộc để đặt overlay
        this.container.style.overflow = 'hidden';

        // --- STATE QUẢN LÝ DỮ LIỆU ---
        this.tokens = [];
        this.ripples = []; 
        this.angle = 0;
        this.latestData = null;
        
        // --- STATE ĐIỀU KHIỂN ---
        this.isPaused = false;
        this.filterMode = 'volume'; // 'volume', 'liquidity', 'momentum'
        this.lockedToken = null;    // Token đang bị click chọn
        this.hoveredToken = null;   // Token đang được hover
        
        // Tọa độ chuột
        this.mouseX = -1;
        this.mouseY = -1;
        this.clientX = -1;
        this.clientY = -1;

        // Khởi tạo UI (CSS + HTML Components)
        this.initUI();
        
        // Căn chỉnh kích thước
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Lắng nghe sự kiện chuột
        this.bindEvents();

        // Bắt đầu vòng lặp render
        this.animate();
    }

    // ==========================================
    // 1. KHỞI TẠO GIAO DIỆN (UI COMPONENTS)
    // ==========================================
    initUI() {
        // --- INJECT CSS TỰ ĐỘNG ---
        if (!document.getElementById('sonar-pro-styles')) {
            const style = document.createElement('style');
            style.id = 'sonar-pro-styles';
            style.innerHTML = `
                /* HUD TOOLTIP */
                #sonar-hud-tooltip {
                    position: fixed; top: 0; left: 0; width: 220px;
                    background: rgba(10, 14, 23, 0.95);
                    border: 1px solid rgba(0, 240, 255, 0.4);
                    box-shadow: 0 0 15px rgba(0, 240, 255, 0.15), inset 0 0 20px rgba(0, 240, 255, 0.05);
                    border-radius: 6px; padding: 12px; pointer-events: none; opacity: 0; z-index: 9999;
                    font-family: 'Rajdhani', 'Courier New', monospace;
                    backdrop-filter: blur(4px);
                    transition: opacity 0.15s ease-in-out, transform 0.05s linear;
                }
                #sonar-hud-tooltip::before { content: ''; position: absolute; top: -1px; left: -1px; width: 10px; height: 10px; border-top: 2px solid #00f0ff; border-left: 2px solid #00f0ff; }
                #sonar-hud-tooltip::after { content: ''; position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-bottom: 2px solid #00f0ff; border-right: 2px solid #00f0ff; }
                .hud-header { display: flex; align-items: center; border-bottom: 1px solid rgba(0, 240, 255, 0.2); padding-bottom: 10px; margin-bottom: 10px; }
                .hud-logo { width: 32px; height: 32px; border-radius: 50%; margin-right: 12px; background: #1a1f2e; border: 1px solid rgba(255, 255, 255, 0.1); }
                .hud-symbol { font-size: 18px; font-weight: 700; line-height: 1; }
                .hud-status { font-size: 11px; color: #00f0ff; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
                .hud-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px; }
                .hud-label { color: rgba(255, 255, 255, 0.5); font-weight: 500; }
                .hud-val { font-weight: 700; text-shadow: 0 0 5px rgba(255, 255, 255, 0.2); }

                /* CONTROL BAR OVERLAY */
                #sonar-control-bar {
                    position: absolute; top: 15px; left: 15px; z-index: 10;
                    display: flex; gap: 10px; background: rgba(0, 0, 0, 0.5); padding: 8px 12px;
                    border-radius: 8px; border: 1px solid rgba(0, 240, 255, 0.2); backdrop-filter: blur(5px);
                }
                .sonar-btn {
                    background: transparent; border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff;
                    padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: 'Rajdhani', sans-serif;
                    font-size: 13px; font-weight: 600; text-transform: uppercase; transition: all 0.2s;
                }
                .sonar-btn:hover, .sonar-btn.active { background: rgba(0, 240, 255, 0.2); box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
                .sonar-btn.pause-btn.paused { border-color: #ff3366; color: #ff3366; background: rgba(255, 51, 102, 0.1); }

                /* SIDE PANEL OVERLAY */
                #sonar-side-panel {
                    position: absolute; top: 15px; right: -320px; width: 280px; height: calc(100% - 30px);
                    background: rgba(10, 14, 23, 0.85); border-left: 2px solid #00f0ff; z-index: 10;
                    backdrop-filter: blur(8px); transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    padding: 20px; box-sizing: border-box; color: white; font-family: 'Rajdhani', sans-serif;
                    box-shadow: -5px 0 20px rgba(0,0,0,0.5); display: flex; flex-direction: column;
                }
                #sonar-side-panel.open { right: 0; }
                .sp-close { position: absolute; top: 10px; right: 15px; cursor: pointer; color: #fff; font-size: 20px; opacity: 0.5; }
                .sp-close:hover { opacity: 1; }
                .sp-title { font-size: 24px; font-weight: bold; color: #00f0ff; margin-bottom: 5px; display: flex; align-items: center; gap: 10px; }
                .sp-subtitle { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 20px; text-transform: uppercase; }
                .sp-stat { background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); }
                .sp-stat-label { font-size: 12px; color: rgba(255,255,255,0.5); }
                .sp-stat-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
                .sp-actions { margin-top: auto; display: flex; gap: 10px; }
                .sp-action-btn { flex: 1; text-align: center; padding: 10px; background: rgba(0, 240, 255, 0.1); border: 1px solid #00f0ff; color: #00f0ff; cursor: pointer; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 12px;}
                .sp-action-btn:hover { background: #00f0ff; color: #000; }
            `;
            document.head.appendChild(style);
        }

        // --- TẠO HUD TOOLTIP ---
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'sonar-hud-tooltip';
        document.body.appendChild(this.tooltip);

        // --- TẠO CONTROL BAR ---
        this.controlBar = document.createElement('div');
        this.controlBar.id = 'sonar-control-bar';
        this.controlBar.innerHTML = `
            <button class="sonar-btn active" data-filter="volume">Top Volume</button>
            <button class="sonar-btn" data-filter="liquidity">Top Liq</button>
            <button class="sonar-btn pause-btn" id="sonar-pause-btn">|| PAUSE</button>
        `;
        this.container.appendChild(this.controlBar);

        // Xử lý sự kiện Control Bar
        const btns = this.controlBar.querySelectorAll('button[data-filter]');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterMode = e.target.getAttribute('data-filter');
                this.recalculate(true); // Ép tính toán lại ngay
            });
        });

        const pauseBtn = document.getElementById('sonar-pause-btn');
        pauseBtn.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            if (this.isPaused) {
                pauseBtn.classList.add('paused');
                pauseBtn.innerText = '▶ RESUME';
            } else {
                pauseBtn.classList.remove('paused');
                pauseBtn.innerText = '|| PAUSE';
            }
        });

        // --- TẠO SIDE PANEL ---
        this.sidePanel = document.createElement('div');
        this.sidePanel.id = 'sonar-side-panel';
        this.container.appendChild(this.sidePanel);
    }

    bindEvents() {
        // Theo dõi chuột (Mouse Move)
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.clientX = e.clientX;
            this.clientY = e.clientY;
            this.checkHover();
        });

        // Rời chuột khỏi Canvas
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredToken = null;
            if (this.tooltip) this.tooltip.style.opacity = '0';
            this.canvas.style.cursor = 'default';
        });

        // Click để Khóa Mục Tiêu (Target Lock)
        this.canvas.addEventListener('click', () => {
            if (this.hoveredToken) {
                this.lockedToken = this.hoveredToken;
                this.openSidePanel(this.lockedToken);
            } else {
                this.lockedToken = null;
                this.closeSidePanel();
            }
        });
    }

    // ==========================================
    // 2. LOGIC DỮ LIỆU & TỌA ĐỘ (ANTI-JITTER)
    // ==========================================
    resize() {
        this.width = this.container.clientWidth || 800;
        this.height = this.container.clientHeight || 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Dịch tâm Radar sang trái một chút nếu Side Panel đang mở để cân đối
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 50);
    }

    updateData(marketData) {
        if (!marketData) return;
        this.latestData = marketData;
        // Nếu đang pause thì không cập nhật vị trí mới, giữ nguyên trạng thái
        if (!this.isPaused) {
            this.recalculate();
        }
    }

    recalculate(force = false) {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;
        
        const oldTxMap = {};
        this.tokens.forEach(t => { oldTxMap[t.symbol] = t.tx; });

        let maxVol = 0;
        let maxLiq = 0;
        let dataArray = [];

        // 1. Chuyển Object thành Array và Lọc rác
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            let realSymbol = t.symbol || t.s || t.name;
            if (!realSymbol && t.baseToken && t.baseToken.symbol) realSymbol = t.baseToken.symbol;
            if (!realSymbol) realSymbol = isNaN(key) ? key.replace('ALPHA_', '') : 'UNKNOWN';

            let vol = t.v.dt || 0;
            let liq = t.l || vol || 1000;
            
            if (vol > maxVol) maxVol = vol;
            if (liq > maxLiq) maxLiq = liq;

            dataArray.push({ raw: t, symbol: realSymbol, vol: vol, liq: liq, change: t.c || 0, tx: t.tx || 0, price: t.p || 0 });
        });

        // 2. Sort & Filter theo mode (Pha 1)
        if (this.filterMode === 'volume') {
            dataArray.sort((a, b) => b.vol - a.vol);
        } else if (this.filterMode === 'liquidity') {
            dataArray.sort((a, b) => b.liq - a.liq);
        }
        // Giới hạn hiển thị 100 tokens để tránh nhiễu nát Radar
        dataArray = dataArray.slice(0, 100);

        // 3. Tính toán Target Position (Chống Jitter bằng Lerp)
        dataArray.forEach(data => {
            let ratio = this.filterMode === 'liquidity' 
                        ? Math.max(0.01, Math.min(1, data.liq / (maxLiq || 1)))
                        : Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));
            
            // Những con top sẽ ở gần tâm, nhưng chừa lõi 30px
            let targetR = this.maxRadius * (1 - Math.pow(ratio, 0.3));
            if (targetR < 30) targetR = 30 + Math.random() * 5;

            // Phân bổ góc dựa trên % change. Xanh ở trên, Đỏ ở dưới
            let angleBase = (data.change / 15) * Math.PI; 
            // Cố định random seed cho mỗi token để không bị nhảy lung tung giữa các frame (Anti-jitter logic 2)
            let hashOffset = (data.symbol.charCodeAt(0) % 10) / 10 - 0.5; 
            let targetAngle = angleBase + hashOffset; 
            
            let tX = this.centerX + targetR * Math.cos(targetAngle);
            let tY = this.centerY + targetR * Math.sin(targetAngle);
            let targetSize = Math.max(3, (data.vol / (maxVol || 1)) * 12);
            let colorHex = data.change > 0 ? '#00f0ff' : (data.change < 0 ? '#ff3366' : '#F0B90B');

            // Bắn sóng âm nếu có TX mới
            if (oldTxMap[data.symbol] !== undefined && data.tx > oldTxMap[data.symbol]) {
                this.ripples.push({ x: tX, y: tY, r: 5, alpha: 1, color: colorHex });
            }

            // Tìm xem token này đã có trên Radar chưa
            let existingToken = this.tokens.find(t => t.symbol === data.symbol);
            if (existingToken) {
                // Cập nhật Target (Lerp sẽ xử lý di chuyển ở animate)
                existingToken.tX = tX;
                existingToken.tY = tY;
                existingToken.targetSize = targetSize;
                existingToken.color = colorHex;
                existingToken.price = data.price;
                existingToken.vol = data.vol;
                existingToken.change = data.change;
                existingToken.tx = data.tx;
                existingToken.updated = true; // Đánh dấu để không bị xóa
            } else {
                // Thêm mới (Xuất hiện ngay tại đích)
                this.tokens.push({
                    symbol: data.symbol,
                    x: tX, y: tY, tX: tX, tY: tY, // Tọa độ hiện tại và đích
                    size: 0, targetSize: targetSize, // Scale in animation
                    color: colorHex, price: data.price, vol: data.vol, change: data.change, tx: data.tx,
                    updated: true
                });
            }
        });

        // Xóa những token văng khỏi Top
        this.tokens = this.tokens.filter(t => t.updated);
        this.tokens.forEach(t => t.updated = false); // Reset cờ

        this.checkHover();
        if (this.lockedToken) this.updateSidePanelData(); // Cập nhật realtime cho Panel
    }

    // ==========================================
    // 3. XỬ LÝ TƯƠNG TÁC (HOVER & SIDE PANEL)
    // ==========================================
    checkHover() {
        this.hoveredToken = null;
        for (let t of this.tokens) {
            let dx = this.mouseX - t.x;
            let dy = this.mouseY - t.y;
            if (Math.sqrt(dx*dx + dy*dy) < Math.max(t.size * 2, 12)) {
                this.hoveredToken = t;
                break;
            }
        }
        
        this.canvas.style.cursor = this.hoveredToken ? 'crosshair' : 'default';

        if (this.hoveredToken && this.tooltip) {
            const t = this.hoveredToken;
            this.tooltip.style.opacity = '1';
            
            let tipX = this.clientX + 15;
            let tipY = this.clientY + 15;
            let tipW = 220, tipH = 150;

            if (tipX + tipW > window.innerWidth) tipX = this.clientX - tipW - 15;
            if (tipY + tipH > window.innerHeight) tipY = this.clientY - tipH - 15;

            this.tooltip.style.transform = `translate(${tipX}px, ${tipY}px)`;
            
            let cColor = t.change > 0 ? '#00f0ff' : (t.change < 0 ? '#ff3366' : '#F0B90B');
            let cSign = t.change > 0 ? '+' : '';
            let imgSrc = `assets/tokens/${t.symbol.toUpperCase()}.png`;

            this.tooltip.innerHTML = `
                <div class="hud-header">
                    <img class="hud-logo" src="${imgSrc}" onerror="this.src='assets/tokens/default.png'">
                    <div>
                        <div class="hud-symbol" style="color:${t.color}">$${t.symbol}</div>
                        <div class="hud-status" style="color:${t.color}">Radar Signal Active</div>
                    </div>
                </div>
                <div class="hud-row"><span class="hud-label">PRICE</span><span class="hud-val" style="color:#fff;">$${t.price.toFixed(4)}</span></div>
                <div class="hud-row"><span class="hud-label">24H VOL</span><span class="hud-val" style="color:#F0B90B;">$${Math.round(t.vol).toLocaleString()}</span></div>
                <div class="hud-row"><span class="hud-label">MOMENTUM</span><span class="hud-val" style="color:${cColor};">${cSign}${t.change.toFixed(2)}%</span></div>
            `;
        } else if (this.tooltip) {
            this.tooltip.style.opacity = '0';
        }
    }

    openSidePanel(t) {
        if (!t) return;
        this.sidePanel.classList.add('open');
        this.updateSidePanelData();
    }

    closeSidePanel() {
        this.sidePanel.classList.remove('open');
    }

    updateSidePanelData() {
        if (!this.lockedToken) return;
        const t = this.lockedToken;
        let cColor = t.change > 0 ? '#00f0ff' : (t.change < 0 ? '#ff3366' : '#F0B90B');
        let cSign = t.change > 0 ? '+' : '';
        let imgSrc = `assets/tokens/${t.symbol.toUpperCase()}.png`;

        this.sidePanel.innerHTML = `
            <div class="sp-close" onclick="document.getElementById('sonar-side-panel').classList.remove('open')">×</div>
            <div class="sp-title">
                <img src="${imgSrc}" onerror="this.src='assets/tokens/default.png'" style="width:30px; height:30px; border-radius:50%;">
                $${t.symbol}
            </div>
            <div class="sp-subtitle">Target Locked / ID: ${Math.floor(Math.random() * 9000) + 1000}</div>
            
            <div class="sp-stat">
                <div class="sp-stat-label">CURRENT PRICE</div>
                <div class="sp-stat-value" style="color: #fff">$${t.price.toFixed(6)}</div>
            </div>
            <div class="sp-stat">
                <div class="sp-stat-label">24H MOMENTUM</div>
                <div class="sp-stat-value" style="color: ${cColor}">${cSign}${t.change.toFixed(2)}%</div>
            </div>
            <div class="sp-stat">
                <div class="sp-stat-label">24H VOLUME</div>
                <div class="sp-stat-value" style="color: #F0B90B">$${Math.round(t.vol).toLocaleString()}</div>
            </div>
            <div class="sp-stat">
                <div class="sp-stat-label">TRANSACTIONS</div>
                <div class="sp-stat-value" style="color: #fff">${t.tx}</div>
            </div>

            <div class="sp-actions">
                <div class="sp-action-btn">CHART</div>
                <div class="sp-action-btn" style="background: rgba(255, 51, 102, 0.1); border-color: #ff3366; color: #ff3366;">TRADE</div>
            </div>
        `;
    }

    // ==========================================
    // 4. RENDER ENGINE (CANVAS ANIMATION)
    // ==========================================
    animate() {
        if (this.width === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        // Xóa frame cũ với hiệu ứng bóng mờ (Fade Trail)
        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        // --- VẼ LƯỚI MILITARY RADAR ---
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        this.ctx.lineWidth = 1;
        
        for (let i = 1; i <= 4; i++) {
            let currentRadius = (this.maxRadius / 4) * i;
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            
            if (i < 4) {
                this.ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
                this.ctx.font = '10px Courier New';
                this.ctx.fillText(`${i * 25}%`, this.centerX + 5, this.centerY - currentRadius - 5);
            }
        }

        // Trục chữ thập
        this.ctx.setLineDash([4, 4]); 
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        this.ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        this.ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        this.ctx.stroke();
        this.ctx.setLineDash([]); 

        // --- VẼ RIPPLES (Sóng âm) ---
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            let rip = this.ripples[i];
            this.ctx.beginPath();
            this.ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
            this.ctx.strokeStyle = rip.color;
            this.ctx.globalAlpha = rip.alpha;
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            if (!this.isPaused) {
                rip.r += 1.2; 
                rip.alpha -= 0.02; 
            }
            if (rip.alpha <= 0) this.ripples.splice(i, 1);
        }
        this.ctx.globalAlpha = 1.0; 

        let normalizedSweep = this.angle % (Math.PI * 2);
        if (normalizedSweep < 0) normalizedSweep += Math.PI * 2;

        // --- VẼ TOKEN BLIPS (Mục tiêu) ---
        this.tokens.forEach(t => {
            // LERP: Làm mượt di chuyển (Tự động lướt đến vị trí đích)
            if (!this.isPaused) {
                t.x += (t.tX - t.x) * 0.05; // 0.05 là tốc độ mượt (Lerp factor)
                t.y += (t.tY - t.y) * 0.05;
                t.size += (t.targetSize - t.size) * 0.1;
            }

            let tA = Math.atan2(t.y - this.centerY, t.x - this.centerX);
            if (tA < 0) tA += Math.PI * 2;
            
            let angleDiff = normalizedSweep - tA;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
            let isLocked = (this.lockedToken && this.lockedToken.symbol === t.symbol);
            
            // Logic phát sáng
            let blipBrightness = 0.25; 
            if (angleDiff < 0.8 && !this.isPaused) {
                blipBrightness = 1.0 - (angleDiff / 0.8);
            }
            if (isHovered || isLocked) blipBrightness = 1.0;

            this.ctx.globalAlpha = Math.max(0.2, blipBrightness);

            // Core
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, Math.max(1, t.size), 0, Math.PI * 2);
            this.ctx.fillStyle = (isHovered || isLocked) ? '#fff' : t.color;
            
            // Glow
            this.ctx.shadowBlur = (isHovered || isLocked) ? t.size * 5 : t.size * (2 + blipBrightness * 4);
            this.ctx.shadowColor = (isHovered || isLocked) ? '#fff' : t.color;
            this.ctx.fill();

            // Hiệu ứng "Target Locked" (Vẽ khung vuông ngắm bắn xung quanh token)
            if (isLocked) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 1;
                let s = t.size + 8;
                this.ctx.strokeRect(t.x - s/2, t.y - s/2, s, s);
            } 
            // Hiệu ứng Echo bình thường
            else if (blipBrightness > 0.6 && !isHovered) {
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, t.size + 3 + (1 - blipBrightness) * 5, 0, Math.PI * 2);
                this.ctx.strokeStyle = t.color;
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }

            this.ctx.globalAlpha = 1.0;
            this.ctx.shadowBlur = 0;
        });

        // --- TIA QUÉT RADAR ---
        if (!this.isPaused) {
            this.angle += 0.025;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius * Math.cos(this.angle), this.centerY + this.maxRadius * Math.sin(this.angle));
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 12;
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY);
        this.ctx.arc(this.centerX, this.centerY, this.maxRadius, this.angle - 0.7, this.angle, false);
        this.ctx.lineTo(this.centerX, this.centerY);
        
        let grad = this.ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, this.maxRadius);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.3)'); 
        this.ctx.fillStyle = grad;
        this.ctx.fill();

        requestAnimationFrame(() => this.animate());
    }
}
