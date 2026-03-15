/**
 * ============================================================================
 * ALPHA SONAR GALAXY - PRO MILITARY EDITION (PHASE 1 - V8 HIGH DPI & CLEAN)
 * ============================================================================
 * Đã Fix: 
 * - Chữ siêu nét căng trên mọi màn hình (Tích hợp window.devicePixelRatio)
 * - Đổi font chữ Hover Tag sang chuẩn dễ đọc (Sans-serif)
 * - Xóa sạch sẽ các vệt mờ (Glow) Xanh/Đỏ đằng sau Logo.
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

        this.initUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        this.animate();
    }

    formatCompact(num) {
        if (!num) return '0';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return parseFloat(num).toFixed(2);
    }

    initUI() {
        if (!document.getElementById('sonar-pro-styles')) {
            const style = document.createElement('style');
            style.id = 'sonar-pro-styles';
            style.innerHTML = `
                #sonar-control-bar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; background: rgba(0, 0, 0, 0.6); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(0, 240, 255, 0.2); backdrop-filter: blur(5px); }
                .sonar-btn { background: transparent; border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; text-transform: uppercase; transition: all 0.2s; }
                .sonar-btn:hover, .sonar-btn.active { background: rgba(0, 240, 255, 0.2); box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
                .sonar-btn.pause-btn.paused { border-color: #ff3366; color: #ff3366; background: rgba(255, 51, 102, 0.1); }
                
                #sonar-side-panel { position: absolute; top: 15px; right: -360px; width: 320px; height: calc(100% - 30px); background: rgba(10, 14, 23, 0.95); border-left: 1px solid #00f0ff; border-top: 1px solid rgba(0, 240, 255, 0.2); border-bottom: 1px solid rgba(0, 240, 255, 0.2); z-index: 10; backdrop-filter: blur(10px); transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 20px; box-sizing: border-box; color: white; font-family: 'Rajdhani', sans-serif; box-shadow: -10px 0 30px rgba(0, 240, 255, 0.1); display: flex; flex-direction: column; overflow-y: auto; }
                #sonar-side-panel.open { right: 0; }
                #sonar-side-panel::-webkit-scrollbar { width: 4px; } #sonar-side-panel::-webkit-scrollbar-thumb { background: #00f0ff; }
                
                .sp-close { position: absolute; top: 10px; right: 15px; cursor: pointer; color: #fff; font-size: 24px; opacity: 0.5; transition: 0.2s;}
                .sp-close:hover { opacity: 1; color: #ff3366; transform: scale(1.1); }
                
                .sp-head { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 15px;}
                .sp-head img { width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(0, 240, 255, 0.5); object-fit: cover; background: #000; }
                .sp-sym-wrap { display: flex; flex-direction: column; }
                .sp-title { font-size: 24px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: 1px; }
                .sp-contract { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; font-family: 'Courier New', monospace; display: flex; align-items: center; gap: 5px; cursor: pointer; }
                .sp-contract:hover { color: #00f0ff; }
                
                .sp-lock-status { font-size: 11px; color: #ff3366; text-transform: uppercase; letter-spacing: 2px; display: flex; align-items: center; gap: 8px; margin-bottom: 15px; font-weight: 600;}
                .blink-dot { width: 8px; height: 8px; background: #ff3366; border-radius: 50%; box-shadow: 0 0 8px #ff3366; animation: blink 1s infinite; }
                
                .sp-price-box { display: flex; align-items: flex-end; justify-content: space-between; background: rgba(0, 240, 255, 0.05); padding: 15px; border-radius: 6px; border: 1px solid rgba(0, 240, 255, 0.15); margin-bottom: 15px; }
                .sp-price-lbl { font-size: 11px; color: #848e9c; letter-spacing: 1px; margin-bottom: 4px;}
                .sp-price-val { font-size: 28px; font-weight: 800; color: #fff; line-height: 1; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
                .sp-price-chg { font-size: 16px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
                
                .sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; }
                .sp-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 10px; border-radius: 4px; }
                .sp-box-lbl { font-size: 10px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
                .sp-box-val { font-size: 16px; font-weight: 700; font-family: 'Courier New', monospace; }
                
                .sp-vol-bar-wrap { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 4px; margin-bottom: 0;}
                .sp-vol-head { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.5); margin-bottom: 6px; letter-spacing: 0.5px;}
                .sp-vol-track { width: 100%; height: 6px; background: #1e2329; border-radius: 3px; display: flex; overflow: hidden; }
                .sp-vol-limit { height: 100%; background: #F0B90B; box-shadow: 0 0 5px #F0B90B;}
                .sp-vol-chain { height: 100%; background: #9945FF; box-shadow: 0 0 5px #9945FF;}
                
                @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
            `;
            document.head.appendChild(style);
        }

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
            this.checkHover();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredToken = null;
            this.canvas.style.cursor = 'default';
        });

        this.canvas.addEventListener('click', () => {
            if (this.hoveredToken) {
                this.lockedToken = this.hoveredToken;
                this.openSidePanel();
            } else {
                this.lockedToken = null;
                this.closeSidePanel();
            }
        });
    }

    // --- CẬP NHẬT RESIZE: KỸ THUẬT HIGH-DPI GIÚP CHỮ NÉT CĂNG ---
    resize() {
        const dpr = window.devicePixelRatio || 1; // Lấy mật độ điểm ảnh của màn hình
        
        this.width = this.container.clientWidth || 800;
        this.height = this.container.clientHeight || 600;
        
        // Scale bộ nhớ thực tế của Canvas lên gấp N lần
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        
        // Ép kích thước hiển thị CSS giữ nguyên
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // Scale ngữ cảnh vẽ để khớp với tọa độ chuột
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

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

    recalculate(force = false) {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;
        
        const oldTxMap = {};
        this.tokens.forEach(t => { oldTxMap[t.symbol] = t.tx; });

        let maxVol = 0;
        let maxLiq = 0;
        let dataArray = [];

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            let tokenKey = key.replace('ALPHA_', '').replace('legacy_', '');
            let realSymbol = '';
            let logoUrl = '';
            
            let mc = t.mc || 0;
            let holders = t.h || 0;
            let vLimit = t.v.dl || 0;
            let contract = '';
            let liq = t.l || 0; 

            if (typeof allTokens !== 'undefined' && allTokens.length > 0) {
                let targetToken = allTokens.find(item => 
                    (item.alphaId && String(item.alphaId).replace('ALPHA_','') === tokenKey) || 
                    (item.id && String(item.id).replace('ALPHA_','') === tokenKey) ||
                    item.symbol === tokenKey
                );

                if (targetToken) {
                    realSymbol = targetToken.symbol;
                    logoUrl = targetToken.icon;
                    mc = targetToken.market_cap || mc;
                    holders = targetToken.holders || holders;
                    vLimit = (targetToken.volume && targetToken.volume.daily_limit) ? targetToken.volume.daily_limit : vLimit;
                    contract = targetToken.contract || '';
                    liq = targetToken.liquidity || liq; 
                }
            }

            if (!realSymbol) realSymbol = t.symbol || t.s || t.name || tokenKey;
            if (!logoUrl) logoUrl = `assets/tokens/${realSymbol.toUpperCase()}.png`;

            let vol = t.v.dt || 0;
            if (!liq) liq = vol || 1000; 

            let vChain = Math.max(0, vol - vLimit); 
            
            if (vol > maxVol) maxVol = vol;
            if (liq > maxLiq) maxLiq = liq;

            dataArray.push({ 
                symbol: realSymbol, logo: logoUrl, contract: contract,
                vol: vol, liq: liq, mc: mc, holders: holders, vLimit: vLimit, vChain: vChain,
                change: t.c || 0, tx: t.tx || 0, price: t.p || 0 
            });
        });

        if (this.filterMode === 'volume') dataArray.sort((a, b) => b.vol - a.vol);
        else if (this.filterMode === 'liquidity') dataArray.sort((a, b) => b.liq - a.liq);
        
        dataArray = dataArray.slice(0, 80); 

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
            // Đã đổi sóng Ripple sang màu Xanh lơ (Radar Ping) để tránh hiểu lầm là Glow Đỏ/Xanh
            let colorHex = data.change > 0 ? '#0ECB81' : (data.change < 0 ? '#F6465D' : '#F0B90B');

            if (oldTxMap[data.symbol] !== undefined && data.tx > oldTxMap[data.symbol]) {
                this.ripples.push({ x: tX, y: tY, r: 5, alpha: 1, color: '#00f0ff' }); 
            }

            let existingToken = this.tokens.find(t => t.symbol === data.symbol);
            if (existingToken) {
                existingToken.tX = tX; existingToken.tY = tY;
                existingToken.targetSize = targetSize;
                existingToken.color = colorHex;
                existingToken.price = data.price;
                existingToken.vol = data.vol;
                existingToken.change = data.change;
                existingToken.tx = data.tx;
                
                if (existingToken.logo !== data.logo) {
                    existingToken.logo = data.logo;
                    let img = new Image();
                    img.src = data.logo;
                    img.onerror = function() { this.src = 'assets/tokens/default.png'; };
                    existingToken.imgObj = img;
                }

                existingToken.liq = data.liq;
                existingToken.mc = data.mc;
                existingToken.holders = data.holders;
                existingToken.vLimit = data.vLimit;
                existingToken.vChain = data.vChain;
                existingToken.contract = data.contract;
                existingToken.updated = true; 
            } else {
                let img = new Image();
                img.src = data.logo;
                img.onerror = function() { this.src = 'assets/tokens/default.png'; };

                this.tokens.push({
                    symbol: data.symbol, logo: data.logo, contract: data.contract,
                    imgObj: img, 
                    x: tX, y: tY, tX: tX, tY: tY,
                    size: 0, targetSize: targetSize, color: colorHex, 
                    price: data.price, vol: data.vol, liq: data.liq, change: data.change, tx: data.tx,
                    mc: data.mc, holders: data.holders, vLimit: data.vLimit, vChain: data.vChain,
                    updated: true
                });
            }
        });

        this.tokens = this.tokens.filter(t => t.updated);
        this.tokens.forEach(t => t.updated = false); 

        this.checkHover();
        if (this.lockedToken) this.updateSidePanelData(); 
    }

    checkHover() {
        this.hoveredToken = null;
        for (let t of this.tokens) {
            let dx = this.mouseX - t.x;
            let dy = this.mouseY - t.y;
            let hitRadius = Math.max(12, t.size + 4); 
            if (Math.sqrt(dx*dx + dy*dy) < hitRadius) {
                this.hoveredToken = t;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredToken ? 'crosshair' : 'default';
    }

    openSidePanel() {
        this.sidePanel.classList.add('open');
        this.updateSidePanelData();
    }

    closeSidePanel() {
        this.sidePanel.classList.remove('open');
    }

    updateSidePanelData() {
        if (!this.lockedToken) return;
        const t = this.lockedToken;
        
        let isUp = t.change > 0;
        let cColor = isUp ? '#0ECB81' : (t.change < 0 ? '#F6465D' : '#F0B90B');
        let cSign = isUp ? '+' : '';
        let cBg = isUp ? 'rgba(14, 203, 129, 0.2)' : (t.change < 0 ? 'rgba(246, 70, 93, 0.2)' : 'rgba(240, 185, 11, 0.2)');

        let shortContract = t.contract ? `${t.contract.substring(0,6)}...${t.contract.slice(-4)}` : 'N/A';
        
        let totalVol = t.vol || 1;
        let MathLim = Math.max(0, Math.min(100, ((t.vLimit || 0) / totalVol) * 100));
        let pctLimit = isNaN(MathLim) ? 0 : MathLim;
        let pctChain = Math.max(0, 100 - pctLimit);

        this.sidePanel.innerHTML = `
            <div class="sp-close" onclick="document.getElementById('sonar-side-panel').classList.remove('open')">×</div>
            
            <div class="sp-lock-status">
                <span class="blink-dot"></span> TARGET LOCKED // SECTOR RADAR
            </div>

            <div class="sp-head">
                <img src="${t.logo}" onerror="this.src='assets/tokens/default.png'">
                <div class="sp-sym-wrap">
                    <div class="sp-title">${t.symbol}</div>
                    <div class="sp-contract" onclick="window.pluginCopy && window.pluginCopy('${t.contract}')" title="Copy Contract">
                        ${shortContract} <i class="far fa-copy"></i>
                    </div>
                </div>
            </div>
            
            <div class="sp-price-box">
                <div>
                    <div class="sp-price-lbl">CURRENT PRICE</div>
                    <div class="sp-price-val">$${t.price < 0.0001 ? t.price.toExponential(2) : t.price.toFixed(4)}</div>
                </div>
                <div class="sp-price-chg" style="color: ${cColor}; background: ${cBg};">
                    ${cSign}${t.change.toFixed(2)}%
                </div>
            </div>

            <div class="sp-grid">
                <div class="sp-box">
                    <div class="sp-box-lbl">24H VOLUME</div>
                    <div class="sp-box-val" style="color: #F0B90B;">$${this.formatCompact(t.vol)}</div>
                </div>
                <div class="sp-box">
                    <div class="sp-box-lbl">LIQUIDITY</div>
                    <div class="sp-box-val" style="color: #00f0ff;">$${this.formatCompact(t.liq)}</div>
                </div>
                <div class="sp-box">
                    <div class="sp-box-lbl">MARKET CAP</div>
                    <div class="sp-box-val" style="color: #fff;">$${this.formatCompact(t.mc)}</div>
                </div>
                <div class="sp-box">
                    <div class="sp-box-lbl">HOLDERS / TXs</div>
                    <div class="sp-box-val" style="color: #eaecef;">${this.formatCompact(t.holders)} <span style="font-size:10px; color:#888">(${this.formatCompact(t.tx)})</span></div>
                </div>
            </div>

            <div class="sp-vol-bar-wrap" style="margin-bottom: 0;">
                <div class="sp-vol-head">
                    <span style="color: #F0B90B;">CEX LIMIT: $${this.formatCompact(t.vLimit)} (${pctLimit.toFixed(0)}%)</span>
                    <span style="color: #9945FF;">ON-CHAIN: $${this.formatCompact(t.vChain)} (${pctChain.toFixed(0)}%)</span>
                </div>
                <div class="sp-vol-track">
                    <div class="sp-vol-limit" style="width: ${pctLimit}%"></div>
                    <div class="sp-vol-chain" style="width: ${pctChain}%"></div>
                </div>
            </div>
        `;
    }

    animate() {
        if (this.width === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.15)'; 
        this.ctx.fillRect(0, 0, this.width, this.height);

        // --- VẼ LƯỚI ---
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

        // --- VẼ SÓNG ÂM (Đổi sang màu Cyan cho gọn gàng, không bị nhầm là Glow) ---
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

        // ==========================================
        // VÒNG 1: VẼ LOGO SẠCH SẼ (KHÔNG GLOW, KHÔNG NỀN LÓA)
        // ==========================================
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
            if (angleDiff < 0.8 && !this.isPaused) blipBrightness = 1.0 - (angleDiff / 0.8);
            if (isHovered || isLocked) blipBrightness = 1.0;

            let imgSize = Math.max(16, t.size * 2.5);
            let radius = imgSize / 2;

            this.ctx.globalAlpha = Math.max(0.2, blipBrightness);
            this.ctx.shadowBlur = 0; // XÓA SẠCH HIỆU ỨNG GLOW NHÒE NHOẸT

            // Cắt viền tròn và vẽ Logo siêu nét
            if (t.imgObj && t.imgObj.complete) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                this.ctx.closePath();
                this.ctx.clip(); 
                
                // Vẽ ảnh trên toạ độ Canvas siêu phân giải
                this.ctx.drawImage(t.imgObj, t.x - radius, t.y - radius, imgSize, imgSize);
                this.ctx.restore();
            } else {
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                this.ctx.fillStyle = '#1a1f2e';
                this.ctx.fill();
            }

            // Vẽ viền nhẹ cho Logo (chỉ sáng lên khi Hover/Lock)
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = (isHovered || isLocked) ? '#fff' : 'rgba(255,255,255,0.15)';
            this.ctx.lineWidth = (isHovered || isLocked) ? 2 : 1;
            this.ctx.stroke();

            this.ctx.globalAlpha = 1.0;
        });

        // ==========================================
        // VÒNG 2: VẼ CHỮ HUD VÀ CROSSHAIR (SIÊU NÉT, NỔI LÊN TRÊN)
        // ==========================================
        this.tokens.forEach(t => {
            let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
            let isLocked = (this.lockedToken && this.lockedToken.symbol === t.symbol);
            
            let imgSize = Math.max(16, t.size * 2.5);
            let radius = imgSize / 2;

            if (isLocked) {
                this.ctx.strokeStyle = '#ff3366'; 
                this.ctx.lineWidth = 1.5;
                let d = radius + 6; 
                let l = 6; 
                
                this.ctx.beginPath();
                this.ctx.moveTo(t.x - d, t.y - d + l); this.ctx.lineTo(t.x - d, t.y - d); this.ctx.lineTo(t.x - d + l, t.y - d);
                this.ctx.moveTo(t.x + d - l, t.y - d); this.ctx.lineTo(t.x + d, t.y - d); this.ctx.lineTo(t.x + d, t.y - d + l);
                this.ctx.moveTo(t.x + d, t.y + d - l); this.ctx.lineTo(t.x + d, t.y + d); this.ctx.lineTo(t.x + d - l, t.y + d);
                this.ctx.moveTo(t.x - d + l, t.y + d); this.ctx.lineTo(t.x - d, t.y + d); this.ctx.lineTo(t.x - d, t.y + d - l);
                this.ctx.stroke();
            } 
            
            if (isHovered && !isLocked) {
                let tagText = ` ${t.symbol} | ${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}% `;
                
                // SỬ DỤNG FONT BÌNH THƯỜNG, RÕ RÀNG, CHỐNG NHÒE
                this.ctx.font = '600 12px "Segoe UI", Arial, sans-serif'; 
                let textMetrics = this.ctx.measureText(tagText);
                let textWidth = textMetrics.width;
                
                let tagX = t.x + radius + 8;
                let tagY = t.y - radius - 8;

                this.ctx.fillStyle = 'rgba(10, 14, 23, 0.9)';
                this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                this.ctx.lineWidth = 1;
                
                this.ctx.fillRect(tagX, tagY - 14, textWidth + 8, 20);
                this.ctx.strokeRect(tagX, tagY - 14, textWidth + 8, 20);

                this.ctx.beginPath();
                this.ctx.moveTo(t.x + radius + 2, t.y - radius - 2);
                this.ctx.lineTo(tagX, tagY - 4);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.stroke();

                this.ctx.fillStyle = '#fff';
                // Vẽ chữ
                this.ctx.fillText(tagText, tagX + 4, tagY + 1);
            }
        });

        // --- VẼ TIA QUÉT ---
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
