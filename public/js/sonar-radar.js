/**
 * ============================================================================
 * ALPHA SONAR GALAXY - PRO MILITARY EDITION (PHASE 1 - FINAL FIX)
 * ============================================================================
 * Đã Fix: Sử dụng mảng `allTokens` từ pro-mode.js để lấy chính xác Tên và Logo
 * ============================================================================
 */

class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement;
        this.container.style.position = 'relative'; 
        this.container.style.overflow = 'hidden';

        this.tokens = [];
        this.ripples = []; 
        this.angle = 0;
        this.latestData = null;
        
        this.isPaused = false;
        this.filterMode = 'volume'; 
        this.lockedToken = null;    
        this.hoveredToken = null;   
        
        this.mouseX = -1;
        this.mouseY = -1;
        this.clientX = -1;
        this.clientY = -1;

        this.initUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        this.animate();
    }

    // --- KHỞI TẠO UI (CONTROL BAR & HUD) ---
    initUI() {
        if (!document.getElementById('sonar-pro-styles')) {
            const style = document.createElement('style');
            style.id = 'sonar-pro-styles';
            style.innerHTML = `
                #sonar-hud-tooltip { position: fixed; top: 0; left: 0; width: 220px; background: rgba(10, 14, 23, 0.95); border: 1px solid rgba(0, 240, 255, 0.4); box-shadow: 0 0 15px rgba(0, 240, 255, 0.15), inset 0 0 20px rgba(0, 240, 255, 0.05); border-radius: 6px; padding: 12px; pointer-events: none; opacity: 0; z-index: 9999; font-family: 'Rajdhani', sans-serif; backdrop-filter: blur(4px); transition: opacity 0.15s ease-in-out, transform 0.05s linear; }
                #sonar-hud-tooltip::before { content: ''; position: absolute; top: -1px; left: -1px; width: 10px; height: 10px; border-top: 2px solid #00f0ff; border-left: 2px solid #00f0ff; }
                #sonar-hud-tooltip::after { content: ''; position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-bottom: 2px solid #00f0ff; border-right: 2px solid #00f0ff; }
                .hud-header { display: flex; align-items: center; border-bottom: 1px solid rgba(0, 240, 255, 0.2); padding-bottom: 10px; margin-bottom: 10px; }
                .hud-logo { width: 32px; height: 32px; border-radius: 50%; margin-right: 12px; background: #1a1f2e; border: 1px solid rgba(255, 255, 255, 0.1); object-fit: cover; }
                .hud-symbol { font-size: 18px; font-weight: 700; line-height: 1; }
                .hud-status { font-size: 11px; color: #00f0ff; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
                .hud-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px; }
                .hud-label { color: rgba(255, 255, 255, 0.5); font-weight: 500; }
                .hud-val { font-weight: 700; text-shadow: 0 0 5px rgba(255, 255, 255, 0.2); }
                #sonar-control-bar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; background: rgba(0, 0, 0, 0.5); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(0, 240, 255, 0.2); backdrop-filter: blur(5px); }
                .sonar-btn { background: transparent; border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; text-transform: uppercase; transition: all 0.2s; }
                .sonar-btn:hover, .sonar-btn.active { background: rgba(0, 240, 255, 0.2); box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
                .sonar-btn.pause-btn.paused { border-color: #ff3366; color: #ff3366; background: rgba(255, 51, 102, 0.1); }
                #sonar-side-panel { position: absolute; top: 15px; right: -320px; width: 280px; height: calc(100% - 30px); background: rgba(10, 14, 23, 0.85); border-left: 2px solid #00f0ff; z-index: 10; backdrop-filter: blur(8px); transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 20px; box-sizing: border-box; color: white; font-family: 'Rajdhani', sans-serif; box-shadow: -5px 0 20px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
                #sonar-side-panel.open { right: 0; }
                .sp-close { position: absolute; top: 10px; right: 15px; cursor: pointer; color: #fff; font-size: 20px; opacity: 0.5; }
                .sp-close:hover { opacity: 1; }
                .sp-title { font-size: 24px; font-weight: bold; color: #00f0ff; margin-bottom: 5px; display: flex; align-items: center; gap: 10px; }
                .sp-subtitle { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 20px; text-transform: uppercase; }
                .sp-stat { background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.05); }
                .sp-stat-label { font-size: 12px; color: rgba(255,255,255,0.5); }
                .sp-stat-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
            `;
            document.head.appendChild(style);
        }

        this.tooltip = document.createElement('div');
        this.tooltip.id = 'sonar-hud-tooltip';
        document.body.appendChild(this.tooltip);

        this.controlBar = document.createElement('div');
        this.controlBar.id = 'sonar-control-bar';
        this.controlBar.innerHTML = `
            <button class="sonar-btn active" data-filter="volume">Top Volume</button>
            <button class="sonar-btn" data-filter="liquidity">Top Liq</button>
            <button class="sonar-btn pause-btn" id="sonar-pause-btn">|| PAUSE</button>
        `;
        this.container.appendChild(this.controlBar);

        const btns = this.controlBar.querySelectorAll('button[data-filter]');
        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                btns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterMode = e.target.getAttribute('data-filter');
                this.recalculate(true); 
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

        this.sidePanel = document.createElement('div');
        this.sidePanel.id = 'sonar-side-panel';
        this.container.appendChild(this.sidePanel);
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.clientX = e.clientX;
            this.clientY = e.clientY;
            this.checkHover();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredToken = null;
            if (this.tooltip) this.tooltip.style.opacity = '0';
            this.canvas.style.cursor = 'default';
        });

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

    resize() {
        this.width = this.container.clientWidth || 800;
        this.height = this.container.clientHeight || 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 50);
    }

    updateData(marketData) {
        if (!marketData) return;
        this.latestData = marketData;
        if (!this.isPaused) {
            this.recalculate();
        }
    }

    // ==========================================
    // LOGIC CỐT LÕI: ĐỒNG BỘ VỚI PRO-MODE.JS
    // ==========================================
    recalculate(force = false) {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;
        
        const oldTxMap = {};
        this.tokens.forEach(t => { oldTxMap[t.symbol] = t.tx; });

        let maxVol = 0;
        let maxLiq = 0;
        let dataArray = [];

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            // --- CỤM FIX: LẤY METADATA TỪ MẢNG allTokens ---
            let tokenKey = key.replace('ALPHA_', '').replace('legacy_', '');
            let realSymbol = '';
            let logoUrl = '';

            // Lục tìm trong mảng allTokens (đã được pro-mode.js xử lý từ JSON)
            if (typeof allTokens !== 'undefined' && allTokens.length > 0) {
                let targetToken = allTokens.find(item => 
                    (item.alphaId && String(item.alphaId).replace('ALPHA_','') === tokenKey) || 
                    (item.id && String(item.id).replace('ALPHA_','') === tokenKey) ||
                    item.symbol === tokenKey
                );

                if (targetToken) {
                    realSymbol = targetToken.symbol;
                    logoUrl = targetToken.icon; // Đã đổi sang .icon theo chuẩn pro-mode
                }
            }

            // Fallback nếu token quá mới, chưa có trong allTokens
            if (!realSymbol) realSymbol = t.symbol || t.s || t.name || tokenKey;
            if (!logoUrl) logoUrl = `assets/tokens/${realSymbol.toUpperCase()}.png`;
            // --- KẾT THÚC CỤM FIX ---

            let vol = t.v.dt || 0;
            let liq = t.l || vol || 1000;
            
            if (vol > maxVol) maxVol = vol;
            if (liq > maxLiq) maxLiq = liq;

            dataArray.push({ raw: t, symbol: realSymbol, logo: logoUrl, vol: vol, liq: liq, change: t.c || 0, tx: t.tx || 0, price: t.p || 0 });
        });

        // Sắp xếp theo Filter
        if (this.filterMode === 'volume') dataArray.sort((a, b) => b.vol - a.vol);
        else if (this.filterMode === 'liquidity') dataArray.sort((a, b) => b.liq - a.liq);
        
        dataArray = dataArray.slice(0, 80); // Lọc top 80 cho đỡ nhiễu

        dataArray.forEach(data => {
            let ratio = this.filterMode === 'liquidity' 
                        ? Math.max(0.01, Math.min(1, data.liq / (maxLiq || 1)))
                        : Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));
            
            let targetR = this.maxRadius * (1 - Math.pow(ratio, 0.3));
            if (targetR < 30) targetR = 30 + Math.random() * 5;

            let angleBase = (data.change / 15) * Math.PI; 
            let hashOffset = (data.symbol.charCodeAt(0) % 10) / 10 - 0.5; 
            let targetAngle = angleBase + hashOffset; 
            
            let tX = this.centerX + targetR * Math.cos(targetAngle);
            let tY = this.centerY + targetR * Math.sin(targetAngle);
            let targetSize = Math.max(3, (data.vol / (maxVol || 1)) * 12);
            let colorHex = data.change > 0 ? '#0ECB81' : (data.change < 0 ? '#F6465D' : '#F0B90B');

            if (oldTxMap[data.symbol] !== undefined && data.tx > oldTxMap[data.symbol]) {
                this.ripples.push({ x: tX, y: tY, r: 5, alpha: 1, color: colorHex });
            }

            let existingToken = this.tokens.find(t => t.symbol === data.symbol);
            if (existingToken) {
                existingToken.tX = tX;
                existingToken.tY = tY;
                existingToken.targetSize = targetSize;
                existingToken.color = colorHex;
                existingToken.price = data.price;
                existingToken.vol = data.vol;
                existingToken.change = data.change;
                existingToken.tx = data.tx;
                existingToken.logo = data.logo; 
                existingToken.updated = true; 
            } else {
                this.tokens.push({
                    symbol: data.symbol,
                    logo: data.logo, 
                    x: tX, y: tY, tX: tX, tY: tY,
                    size: 0, targetSize: targetSize, 
                    color: colorHex, price: data.price, vol: data.vol, change: data.change, tx: data.tx,
                    updated: true
                });
            }
        });

        this.tokens = this.tokens.filter(t => t.updated);
        this.tokens.forEach(t => t.updated = false); 

        this.checkHover();
        if (this.lockedToken) this.updateSidePanelData(); 
    }

    // ==========================================
    // UI UPDATES (TOOLTIP & SIDE PANEL)
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
            
            let cColor = t.change > 0 ? '#0ECB81' : (t.change < 0 ? '#F6465D' : '#F0B90B');
            let cSign = t.change > 0 ? '+' : '';

            this.tooltip.innerHTML = `
                <div class="hud-header">
                    <img class="hud-logo" src="${t.logo}" onerror="this.src='assets/tokens/default.png'">
                    <div>
                        <div class="hud-symbol" style="color:${t.color}">$${t.symbol}</div>
                        <div class="hud-status" style="color:${t.color}">Radar Active</div>
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
        let cColor = t.change > 0 ? '#0ECB81' : (t.change < 0 ? '#F6465D' : '#F0B90B');
        let cSign = t.change > 0 ? '+' : '';

        this.sidePanel.innerHTML = `
            <div class="sp-close" onclick="document.getElementById('sonar-side-panel').classList.remove('open')">×</div>
            <div class="sp-title">
                <img src="${t.logo}" onerror="this.src='assets/tokens/default.png'" style="width:30px; height:30px; border-radius:50%;">
                $${t.symbol}
            </div>
            <div class="sp-subtitle">Target Locked</div>
            
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
        `;
    }

    // ==========================================
    // RENDER ENGINE (CANVAS)
    // ==========================================
    animate() {
        if (this.width === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
        this.ctx.lineWidth = 1;
        
        for (let i = 1; i <= 4; i++) {
            let currentRadius = (this.maxRadius / 4) * i;
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.setLineDash([4, 4]); 
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, this.centerY - this.maxRadius);
        this.ctx.lineTo(this.centerX, this.centerY + this.maxRadius);
        this.ctx.moveTo(this.centerX - this.maxRadius, this.centerY);
        this.ctx.lineTo(this.centerX + this.maxRadius, this.centerY);
        this.ctx.stroke();
        this.ctx.setLineDash([]); 

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

        this.tokens.forEach(t => {
            if (!this.isPaused) {
                t.x += (t.tX - t.x) * 0.05; 
                t.y += (t.tY - t.y) * 0.05;
                t.size += (t.targetSize - t.size) * 0.1;
            }

            let tA = Math.atan2(t.y - this.centerY, t.x - this.centerX);
            if (tA < 0) tA += Math.PI * 2;
            
            let angleDiff = normalizedSweep - tA;
            if (angleDiff < 0) angleDiff += Math.PI * 2;

            let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
            let isLocked = (this.lockedToken && this.lockedToken.symbol === t.symbol);
            
            let blipBrightness = 0.25; 
            if (angleDiff < 0.8 && !this.isPaused) {
                blipBrightness = 1.0 - (angleDiff / 0.8);
            }
            if (isHovered || isLocked) blipBrightness = 1.0;

            this.ctx.globalAlpha = Math.max(0.2, blipBrightness);

            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, Math.max(1, t.size), 0, Math.PI * 2);
            this.ctx.fillStyle = (isHovered || isLocked) ? '#fff' : t.color;
            
            this.ctx.shadowBlur = (isHovered || isLocked) ? t.size * 5 : t.size * (2 + blipBrightness * 4);
            this.ctx.shadowColor = (isHovered || isLocked) ? '#fff' : t.color;
            this.ctx.fill();

            if (isLocked) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 1;
                let s = t.size + 8;
                this.ctx.strokeRect(t.x - s/2, t.y - s/2, s, s);
            } 
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
