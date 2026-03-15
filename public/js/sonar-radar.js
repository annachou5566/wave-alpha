/**
 * ============================================================================
 * ALPHA SONAR GALAXY - PRO MILITARY EDITION (PHASE 2 - DUAL ENGINE V13)
 * ============================================================================
 * TÍNH NĂNG MỚI:
 * 1. Chuyển đổi 2 mô hình UX (Nút bấm trên Control Bar):
 * - MESH (Lưới vệ tinh): Tận dụng 100% không gian chữ nhật, chống đè logo.
 * - ORBIT (Quỹ đạo tâm): Xoay vòng quanh tâm theo dòng tiền.
 * 2. Mượt mà 100%: Khi chuyển mode, token sẽ tự bay lướt đến vị trí mới.
 * 3. Chỉ cần 1 file js duy nhất.
 * ============================================================================
 */

class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement || document.body;
        this.container.style.position = 'relative'; 
        this.container.style.overflow = 'hidden';

        this.tokens = [];
        this.ripples = []; 
        this.latestData = null;
        
        this.isPaused = false;
        this.filterMode = 'volume'; 
        // MODE MỚI: 'mesh' (Mô hình 1) hoặc 'orbit' (Mô hình 2)
        this.visualMode = 'mesh'; 
        
        this.lockedToken = null;    
        this.hoveredToken = null;   
        this.mouseX = -1;
        this.mouseY = -1;

        this.lastCalcTime = 0;       
        this.tokenDict = {};         
        this.lastTokenCount = 0;     

        this.initUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        this.animate();
    }

    safeNum(val, fallback = 0) {
        if (val === undefined || val === null) return fallback;
        const n = parseFloat(val);
        return isNaN(n) ? fallback : n;
    }

    formatCompact(num) {
        let n = this.safeNum(num);
        if (n === 0) return '0';
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
        return n.toFixed(2);
    }

    initUI() {
        const oldBar = document.getElementById('sonar-control-bar');
        if (oldBar) oldBar.remove();
        const oldPanel = document.getElementById('sonar-side-panel');
        if (oldPanel) oldPanel.remove();

        if (!document.getElementById('sonar-pro-styles')) {
            const style = document.createElement('style');
            style.id = 'sonar-pro-styles';
            style.innerHTML = `
                #sonar-control-bar { position: absolute; top: 15px; left: 15px; z-index: 10; display: flex; gap: 10px; background: rgba(0, 0, 0, 0.6); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(0, 240, 255, 0.2); backdrop-filter: blur(5px); }
                .sonar-btn { background: transparent; border: 1px solid rgba(0, 240, 255, 0.4); color: #00f0ff; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: 'Rajdhani', sans-serif; font-size: 13px; font-weight: 600; text-transform: uppercase; transition: all 0.2s; }
                .sonar-btn:hover, .sonar-btn.active { background: rgba(0, 240, 255, 0.2); box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
                .sonar-btn.pause-btn.paused { border-color: #ff3366; color: #ff3366; background: rgba(255, 51, 102, 0.1); }
                
                #sonar-side-panel { position: absolute; top: 0; right: -360px; width: 320px; height: 100%; background: rgba(10, 14, 23, 0.95); border-left: 1px solid #00f0ff; z-index: 100; backdrop-filter: blur(10px); transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1); padding: 20px; box-sizing: border-box; color: white; font-family: 'Rajdhani', sans-serif; box-shadow: -10px 0 30px rgba(0, 240, 255, 0.1); display: flex; flex-direction: column; overflow-y: auto; }
                #sonar-side-panel.open { right: 0; }
                #sonar-side-panel::-webkit-scrollbar { width: 4px; } #sonar-side-panel::-webkit-scrollbar-thumb { background: #00f0ff; }
                
                .sp-close { position: absolute; top: 10px; right: 15px; cursor: pointer; color: #fff; font-size: 24px; opacity: 0.5; transition: 0.2s; padding: 5px;}
                .sp-close:hover { opacity: 1; color: #ff3366; transform: scale(1.1); }
                
                .sp-head { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 15px; margin-top: 10px;}
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
                @media (max-width: 768px) {
                    #sonar-control-bar { top: 5px; left: 5px; right: 5px; flex-wrap: wrap; justify-content: center; padding: 6px; }
                    .sonar-btn { font-size: 11px; padding: 4px 8px; flex: 1; text-align: center; }
                    #sonar-side-panel { width: 100%; right: -100%; border-left: none; }
                    .sp-price-val { font-size: 24px; }
                }
            `;
            document.head.appendChild(style);
        }

        this.controlBar = document.createElement('div');
        this.controlBar.id = 'sonar-control-bar';
        this.controlBar.innerHTML = `
            <button class="sonar-btn active" id="btn-mode-toggle" style="border-color: #9945FF; color: #9945FF;">[ MẠNG LƯỚI ]</button>
            <button class="sonar-btn active" data-filter="volume">VOL</button>
            <button class="sonar-btn" data-filter="liquidity">LIQ</button>
            <button class="sonar-btn pause-btn" id="sonar-pause-btn">||</button>
        `;
        this.container.appendChild(this.controlBar);

        // Logic Nút chuyển đổi Mô hình
        const modeBtn = document.getElementById('btn-mode-toggle');
        modeBtn.addEventListener('click', () => {
            this.visualMode = this.visualMode === 'mesh' ? 'orbit' : 'mesh';
            if (this.visualMode === 'mesh') {
                modeBtn.innerText = '[ MẠNG LƯỚI ]';
                modeBtn.style.borderColor = '#9945FF';
                modeBtn.style.color = '#9945FF';
            } else {
                modeBtn.innerText = '[ QUỸ ĐẠO ]';
                modeBtn.style.borderColor = '#F0B90B';
                modeBtn.style.color = '#F0B90B';
            }
            this.recalculate(true); // Ép tính lại tọa độ đích
        });

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
            pauseBtn.classList.toggle('paused');
            pauseBtn.innerText = this.isPaused ? '▶' : '||';
        });

        this.sidePanel = document.createElement('div');
        this.sidePanel.id = 'sonar-side-panel';
        this.container.appendChild(this.sidePanel);
    }

    bindEvents() {
        const updatePointer = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = clientX - rect.left;
            this.mouseY = clientY - rect.top;
            this.checkHover();
        };

        this.canvas.addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 0) {
                updatePointer(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

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

    resize() {
        if (this.container.clientHeight < 100) {
            this.container.style.height = '450px';
        }

        const dpr = window.devicePixelRatio || 1; 
        
        this.width = Math.max(300, this.container.clientWidth || window.innerWidth);
        this.height = Math.max(300, this.container.clientHeight || window.innerHeight);
        
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        // Bán kính quỹ đạo cho Mô hình 2
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 40);
        this.recalculate(true);
    }

    updateData(marketData) {
        if (!marketData || this.isPaused) return;
        this.latestData = marketData;
        
        const now = Date.now();
        if (now - this.lastCalcTime > 500) {
            this.recalculate();
            this.lastCalcTime = now;
        }
    }

    recalculate(force = false) {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;
        
        if (typeof allTokens !== 'undefined' && Array.isArray(allTokens) && this.lastTokenCount !== allTokens.length) {
            this.tokenDict = {}; 
            allTokens.forEach(item => {
                if (item.alphaId) this.tokenDict[String(item.alphaId).replace('ALPHA_','')] = item;
                if (item.id) this.tokenDict[String(item.id).replace('ALPHA_','')] = item;
                if (item.symbol) this.tokenDict[item.symbol] = item;
            });
            this.lastTokenCount = allTokens.length;
        }

        let maxVol = 0; let maxLiq = 0; let maxTx = 0;
        let dataArray = [];

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            
            let tokenKey = key.replace('ALPHA_', '').replace('legacy_', '');
            let targetToken = this.tokenDict[tokenKey];

            let realSymbol = (targetToken ? targetToken.symbol : (t.symbol || t.s || t.name || tokenKey)) + "";
            let logoUrl = targetToken ? targetToken.icon : `assets/tokens/${realSymbol.toUpperCase()}.png`;
            
            let mc = this.safeNum(targetToken ? targetToken.market_cap : t.mc);
            let holders = this.safeNum(targetToken ? targetToken.holders : t.h);
            let vLimit = this.safeNum(targetToken?.volume?.daily_limit || (t.v ? t.v.dl : 0));
            let contract = targetToken ? targetToken.contract : '';
            
            let vol = this.safeNum(t.v ? t.v.dt : 0);
            let liq = this.safeNum(targetToken ? targetToken.liquidity : t.l, vol || 1000); 
            
            let change = this.safeNum(t.c);
            let tx = this.safeNum(t.tx);
            let price = this.safeNum(t.p);
            
            let vChain = Math.max(0, vol - vLimit); 
            
            if (vol > maxVol) maxVol = vol;
            if (liq > maxLiq) maxLiq = liq;
            if (tx > maxTx) maxTx = tx;

            dataArray.push({ 
                symbol: realSymbol, logo: logoUrl, contract: contract,
                vol: vol, liq: liq, mc: mc, holders: holders, vLimit: vLimit, vChain: vChain,
                change: change, tx: tx, price: price 
            });
        });

        if (this.filterMode === 'volume') dataArray.sort((a, b) => b.vol - a.vol);
        else if (this.filterMode === 'liquidity') dataArray.sort((a, b) => b.liq - a.liq);
        
        dataArray = dataArray.slice(0, 60); // Giữ 60 token cho thoáng màn hình

        dataArray.forEach(data => {
            let targetSize = Math.max(10, Math.min(24, 10 + (data.vol / (maxVol || 1)) * 14));
            let colorHex = data.change > 0 ? '#0ECB81' : (data.change < 0 ? '#F6465D' : '#848E9C');
            let tX, tY;
            let orbitRadius = 0; let orbitSpeed = 0; let orbitAngle = 0;

            // --- TÍNH TỌA ĐỘ ĐÍCH TÙY THEO MÔ HÌNH ---
            if (this.visualMode === 'mesh') {
                // LƯỚI VỆ TINH (Tận dụng 100% chữ nhật)
                // X: Trái là Giảm mạnh, Phải là Tăng mạnh. Y: Cao là Vol to, Thấp là Vol nhỏ.
                let normChange = Math.max(-20, Math.min(20, data.change)); 
                let paddingX = 40; let paddingY = 60;
                let useableW = this.width - paddingX * 2;
                let useableH = this.height - paddingY * 2;
                
                tX = paddingX + (useableW / 2) + (normChange / 20) * (useableW / 2);
                let volRatio = Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));
                // Y đảo ngược (tọa độ 0 ở trên cùng)
                tY = paddingY + useableH - (Math.pow(volRatio, 0.4) * useableH); 
            } 
            else {
                // QUỸ ĐẠO KHÔNG GIAN
                let ratio = this.filterMode === 'liquidity' 
                            ? Math.max(0.01, Math.min(1, data.liq / (maxLiq || 1)))
                            : Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));
                orbitRadius = this.maxRadius * (1 - Math.pow(ratio, 0.3));
                if (orbitRadius < 40) orbitRadius = 40 + Math.random() * 10;

                orbitAngle = ((data.symbol.charCodeAt(0) || 0) % 10) / 10 * Math.PI * 2; 
                orbitSpeed = 0.002 + (data.tx / (maxTx || 1)) * 0.008;
                if (data.change < 0) orbitSpeed *= -1; // Đỏ bay ngược chiều

                tX = this.centerX + orbitRadius * Math.cos(orbitAngle);
                tY = this.centerY + orbitRadius * Math.sin(orbitAngle);
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
                existingToken.liq = data.liq;
                existingToken.mc = data.mc;
                
                if (this.visualMode === 'orbit') {
                    if(!existingToken.orbitAngle) existingToken.orbitAngle = orbitAngle;
                    existingToken.orbitRadius = orbitRadius;
                    existingToken.orbitSpeed = orbitSpeed;
                }

                if (existingToken.logo !== data.logo) {
                    existingToken.logo = data.logo;
                    let img = new Image();
                    img.onerror = function() { if (!this.failed) { this.failed = true; this.src = 'assets/tokens/default.png'; }};
                    img.src = data.logo;
                    existingToken.imgObj = img;
                }
                existingToken.updated = true; 
            } else {
                let img = new Image();
                img.onerror = function() { if (!this.failed) { this.failed = true; this.src = 'assets/tokens/default.png'; }};
                img.src = data.logo;

                this.tokens.push({
                    symbol: data.symbol, logo: data.logo, contract: data.contract,
                    imgObj: img, 
                    x: this.centerX, y: this.centerY, // Xuất hiện từ giữa tỏa ra
                    tX: tX, tY: tY,
                    orbitRadius: orbitRadius, orbitSpeed: orbitSpeed, orbitAngle: orbitAngle,
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
            let hitRadius = t.size + 6; 
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
            <div class="sp-lock-status"><span class="blink-dot"></span> SATELLITE LINK ESTABLISHED</div>
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
                <div class="sp-price-chg" style="color: ${cColor}; background: ${cBg};">${cSign}${t.change.toFixed(2)}%</div>
            </div>
            <div class="sp-grid">
                <div class="sp-box"><div class="sp-box-lbl">24H VOLUME</div><div class="sp-box-val" style="color: #F0B90B;">$${this.formatCompact(t.vol)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">LIQUIDITY</div><div class="sp-box-val" style="color: #00f0ff;">$${this.formatCompact(t.liq)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">MARKET CAP</div><div class="sp-box-val" style="color: #fff;">$${this.formatCompact(t.mc)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">HOLDERS</div><div class="sp-box-val" style="color: #eaecef;">${this.formatCompact(t.holders)}</div></div>
            </div>
            <div class="sp-vol-bar-wrap" style="margin-bottom: 0;">
                <div class="sp-vol-head"><span style="color: #F0B90B;">CEX: ${pctLimit.toFixed(0)}%</span><span style="color: #9945FF;">DEX: ${pctChain.toFixed(0)}%</span></div>
                <div class="sp-vol-track"><div class="sp-vol-limit" style="width: ${pctLimit}%"></div><div class="sp-vol-chain" style="width: ${pctChain}%"></div></div>
            </div>
        `;
    }

    animate() {
        if (this.width === 0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        try {
            // Xóa nền mờ
            this.ctx.fillStyle = 'rgba(10, 14, 23, 0.2)'; 
            this.ctx.fillRect(0, 0, this.width, this.height);

            // --- VẼ BACKGROUND THEO MÔ HÌNH ---
            if (this.visualMode === 'orbit') {
                this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
                this.ctx.lineWidth = 1;
                for (let i = 1; i <= 4; i++) {
                    let currentRadius = (this.maxRadius / 4) * i;
                    this.ctx.beginPath();
                    this.ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
                // Central Core
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, 10, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
                this.ctx.fill();
            } else {
                // MESH Grid Background (Mặt phẳng chiến thuật)
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                this.ctx.lineWidth = 1;
                let step = 50;
                this.ctx.beginPath();
                for(let x = 0; x < this.width; x += step) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); }
                for(let y = 0; y < this.height; y += step) { this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); }
                this.ctx.stroke();
                
                // Trục tọa độ trung tâm tàng hình
                this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
                this.ctx.setLineDash([4, 4]);
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerX, 0); this.ctx.lineTo(this.centerX, this.height);
                this.ctx.moveTo(0, this.centerY); this.ctx.lineTo(this.width, this.centerY);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }

            // --- TÍNH TOÁN VẬT LÝ VÀ CHỐNG ĐÈ (COLLISION/REPULSION) ---
            for (let i = 0; i < this.tokens.length; i++) {
                let t = this.tokens[i];

                if (!this.isPaused) {
                    if (this.visualMode === 'orbit') {
                        t.orbitAngle += t.orbitSpeed;
                        t.tX = this.centerX + t.orbitRadius * Math.cos(t.orbitAngle);
                        t.tY = this.centerY + t.orbitRadius * Math.sin(t.orbitAngle);
                    }
                    
                    // Lực kéo về đích
                    t.x += (t.tX - t.x) * 0.08; 
                    t.y += (t.tY - t.y) * 0.08;
                    t.size += (t.targetSize - t.size) * 0.1;

                    // Lực Đẩy chống đè logo (chỉ áp dụng ở Mesh Mode để nhìn rõ)
                    if (this.visualMode === 'mesh') {
                        for (let j = i + 1; j < this.tokens.length; j++) {
                            let other = this.tokens[j];
                            let dx = t.x - other.x;
                            let dy = t.y - other.y;
                            let dist = Math.sqrt(dx*dx + dy*dy);
                            let minDist = t.size + other.size + 10; // Khoảng cách an toàn

                            // Nếu 2 logo đè lên nhau, đẩy nhau ra xa
                            if (dist < minDist && dist > 0) {
                                let force = (minDist - dist) / 2;
                                let fX = (dx / dist) * force;
                                let fY = (dy / dist) * force;
                                t.x += fX; t.y += fY;
                                other.x -= fX; other.y -= fY;
                            }
                            
                            // Vẽ tia laser nối các token cùng màu gần nhau
                            if (dist < 100 && t.color === other.color) {
                                this.ctx.beginPath();
                                this.ctx.moveTo(t.x, t.y);
                                this.ctx.lineTo(other.x, other.y);
                                this.ctx.strokeStyle = t.color;
                                this.ctx.globalAlpha = 0.2 * (1 - dist/100);
                                this.ctx.stroke();
                            }
                        }
                    }
                }
            }
            this.ctx.globalAlpha = 1.0;

            // --- VẼ LOGO TOKEN CHÌM BÊN DƯỚI ---
            this.tokens.forEach(t => {
                let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
                let isLocked = (this.lockedToken && this.lockedToken.symbol === t.symbol);
                
                this.ctx.globalAlpha = (isHovered || isLocked) ? 1.0 : 0.8;
                let radius = t.size;

                if (t.imgObj && t.imgObj.complete && t.imgObj.naturalWidth > 0) {
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                    this.ctx.closePath();
                    this.ctx.clip(); 
                    
                    this.ctx.drawImage(t.imgObj, t.x - radius, t.y - radius, radius*2, radius*2);
                    this.ctx.restore();
                } else {
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#1a1f2e';
                    this.ctx.fill();
                }

                // Viền token
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = (isHovered || isLocked) ? '#fff' : t.color;
                this.ctx.lineWidth = (isHovered || isLocked) ? 2 : 1;
                this.ctx.stroke();
                this.ctx.globalAlpha = 1.0;
            });

            // --- VẼ HUD & CROSSHAIR NỔI LÊN TRÊN ---
            this.tokens.forEach(t => {
                let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
                let isLocked = (this.lockedToken && this.lockedToken.symbol === t.symbol);
                let radius = t.size;

                if (isLocked) {
                    this.ctx.strokeStyle = '#ff3366'; 
                    this.ctx.lineWidth = 1.5;
                    let d = radius + 6; let l = 6; 
                    this.ctx.beginPath();
                    this.ctx.moveTo(t.x - d, t.y - d + l); this.ctx.lineTo(t.x - d, t.y - d); this.ctx.lineTo(t.x - d + l, t.y - d);
                    this.ctx.moveTo(t.x + d - l, t.y - d); this.ctx.lineTo(t.x + d, t.y - d); this.ctx.lineTo(t.x + d, t.y - d + l);
                    this.ctx.moveTo(t.x + d, t.y + d - l); this.ctx.lineTo(t.x + d, t.y + d); this.ctx.lineTo(t.x + d - l, t.y + d);
                    this.ctx.moveTo(t.x - d + l, t.y + d); this.ctx.lineTo(t.x - d, t.y + d); this.ctx.lineTo(t.x - d, t.y + d - l);
                    this.ctx.stroke();
                } 
                
                if (isHovered && !isLocked) {
                    let tagText = ` ${t.symbol} | ${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}% `;
                    this.ctx.font = '600 12px "Segoe UI", Arial, sans-serif'; 
                    let textWidth = this.ctx.measureText(tagText).width;
                    
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
                    this.ctx.fillText(tagText, tagX + 4, tagY + 1);
                }
            });

        } catch (e) {
            console.warn("Radar Render Prevented Crash:", e);
        }

        requestAnimationFrame(() => this.animate());
    }
}
