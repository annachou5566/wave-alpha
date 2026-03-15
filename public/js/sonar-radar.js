/**
 * ============================================================================
 * ALPHA SONAR GALAXY - ULTRA OPTIMIZED PERFORMANCE EDITION
 * ============================================================================
 * 1. Image Pre-caching: Loại bỏ hoàn toàn ctx.clip() trong vòng lặp animate.
 * 2. Math Optimization: Dùng bình phương khoảng cách thay cho Math.sqrt().
 * 3. Sleep Mode: Dừng tính toán vật lý nếu token đã nằm yên để tiết kiệm CPU.
 * ============================================================================
 */

class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        if (this.canvas.sonarInstance) {
            this.canvas.sonarInstance.destroy();
        }
        this.canvas.sonarInstance = this;
        this.isRunning = true; 
        this.isVisible = true; 

        this.ctx = this.canvas.getContext('2d');
        // Tối ưu hóa rendering của Canvas
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'low'; // 'low' là đủ đẹp cho radar và mượt hơn

        this.container = this.canvas.parentElement || document.body;
        this.container.style.position = 'relative'; 
        this.container.style.overflow = 'hidden';

        this.tokens = [];
        this.latestData = null;
        
        this.isPaused = false;
        this.filterMode = 'volume'; 
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
        
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                this.isVisible = entries[0].isIntersecting;
            }, { threshold: 0.01 });
            this.observer.observe(this.container);
        }

        this.animate();
    }

    destroy() {
        this.isRunning = false;
        if (this.observer) this.observer.disconnect();
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
                .sp-vol-limit { height: 100%; background: #F0B90B; transition: width 0.3s;}
                .sp-vol-chain { height: 100%; background: #9945FF; transition: width 0.3s;}

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
            <button class="sonar-btn active" id="btn-mode-toggle" style="border-color: #9945FF; color: #9945FF;">[ MESH NETWORK ]</button>
            <button class="sonar-btn active" data-filter="volume">TOP VOL</button>
            <button class="sonar-btn" data-filter="liquidity">TOP LIQ</button>
            <button class="sonar-btn pause-btn" id="sonar-pause-btn">PAUSE</button>
        `;
        this.container.appendChild(this.controlBar);

        const modeBtn = document.getElementById('btn-mode-toggle');
        modeBtn.addEventListener('click', () => {
            this.visualMode = this.visualMode === 'mesh' ? 'orbit' : 'mesh';
            if (this.visualMode === 'mesh') {
                modeBtn.innerText = '[ MESH NETWORK ]';
                modeBtn.style.borderColor = '#9945FF';
                modeBtn.style.color = '#9945FF';
            } else {
                modeBtn.innerText = '[ ORBITAL SYSTEM ]';
                modeBtn.style.borderColor = '#F0B90B';
                modeBtn.style.color = '#F0B90B';
            }
            this.recalculate(true); 
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
            pauseBtn.innerText = this.isPaused ? 'RESUME' : 'PAUSE';
        });

        this.sidePanel = document.createElement('div');
        this.sidePanel.id = 'sonar-side-panel';
        this.container.appendChild(this.sidePanel);
    }

    bindEvents() {
        let hoverTimeout;
        const updatePointer = (clientX, clientY) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = clientX - rect.left;
            this.mouseY = clientY - rect.top;
            
            // Tối ưu hóa: Debounce việc kiểm tra hover để giảm tải khi di chuột liên tục
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => this.checkHover(), 10);
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
        this.maxRadius = Math.max(10, Math.min(this.centerX, this.centerY) - 40);
        this.recalculate(true);
    }

    updateData(marketData) {
        if (!marketData || this.isPaused || !this.isVisible) return; 
        this.latestData = marketData;
        
        const now = Date.now();
        if (now - this.lastCalcTime > 500) {
            this.recalculate();
            this.lastCalcTime = now;
        }
    }

    // --- HÀM CACHE ẢNH RẤT QUAN TRỌNG ĐỂ TỐI ƯU ---
    createRoundedCache(imgObj) {
        const size = 64; // Cố định độ phân giải offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(imgObj, 0, 0, size, size);
        return canvas;
    }

    recalculate() {
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

            let realSymbol = "";
            let logoUrl = "";
            let mc = 0, holders = 0, vLimit = 0, contract = '', liq = 0;

            if (targetToken) {
                realSymbol = targetToken.symbol || "";
                logoUrl = targetToken.icon || "";
                mc = targetToken.market_cap || 0;
                holders = targetToken.holders || 0;
                if (targetToken.volume && targetToken.volume.daily_limit !== undefined) vLimit = targetToken.volume.daily_limit;
                contract = targetToken.contract || '';
                liq = targetToken.liquidity || 0; 
            }

            if (!realSymbol) realSymbol = t.symbol || t.s || t.name || tokenKey;
            if (!logoUrl) logoUrl = `assets/tokens/${realSymbol.toUpperCase()}.png`;

            let vol = this.safeNum(t.v ? t.v.dt : 0);
            if (!vLimit) vLimit = this.safeNum(t.v ? t.v.dl : 0);
            if (!liq) liq = this.safeNum(t.l, vol || 1000);
            
            mc = this.safeNum(mc ? mc : t.mc);
            holders = this.safeNum(holders ? holders : t.h);

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
        
        let maxDisplay = this.width < 768 ? 30 : 60;
        dataArray = dataArray.slice(0, maxDisplay);

        dataArray.forEach(data => {
            let targetSize = Math.max(10, Math.min(24, 10 + (data.vol / (maxVol || 1)) * 14));
            let colorHex = data.change > 0 ? '#0ECB81' : (data.change < 0 ? '#F6465D' : '#848E9C');
            let baseX, baseY;
            let baseOrbitRadius = 0; let orbitSpeed = 0; let orbitAngle = 0;

            let hashOffset = ((data.symbol.charCodeAt(0) || 0) % 10) / 10 - 0.5;

            if (this.visualMode === 'mesh') {
                let normChange = Math.max(-20, Math.min(20, data.change)); 
                let paddingX = 40; let paddingY = 80; 
                let useableW = this.width - paddingX * 2;
                let useableH = this.height - paddingY * 2;
                
                baseX = paddingX + (useableW / 2) + (normChange / 20) * (useableW / 2) + (hashOffset * 30);
                let volRatio = Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));
                baseY = paddingY + useableH - (Math.pow(volRatio, 0.4) * useableH) + (hashOffset * 20); 
            } else {
                let ratio = this.filterMode === 'liquidity' 
                            ? Math.max(0.01, Math.min(1, data.liq / (maxLiq || 1)))
                            : Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));
                baseOrbitRadius = this.maxRadius * (1 - Math.pow(ratio, 0.3));
                if (baseOrbitRadius < 40) baseOrbitRadius = 40 + Math.random() * 10;

                orbitAngle = Math.random() * Math.PI * 2; 
                orbitSpeed = 0.001 + (data.tx / (maxTx || 1)) * 0.006; 
                if (data.change < 0) orbitSpeed *= -1; 

                baseX = this.centerX + baseOrbitRadius * Math.cos(orbitAngle);
                baseY = this.centerY + baseOrbitRadius * Math.sin(orbitAngle);
            }

            let existingToken = this.tokens.find(t => t.symbol === data.symbol);
            if (existingToken) {
                existingToken.baseX = baseX; 
                existingToken.baseY = baseY;
                existingToken.targetSize = targetSize;
                existingToken.color = colorHex;
                existingToken.price = data.price;
                existingToken.vol = data.vol;
                existingToken.change = data.change;
                existingToken.tx = data.tx;
                existingToken.liq = data.liq;
                existingToken.mc = data.mc;
                
                if (this.visualMode === 'orbit') {
                    if(existingToken.orbitAngle === undefined) existingToken.orbitAngle = orbitAngle;
                    existingToken.baseOrbitRadius = baseOrbitRadius;
                    existingToken.orbitSpeed = orbitSpeed;
                }

                if (existingToken.logo !== data.logo) {
                    existingToken.logo = data.logo;
                    let img = new Image();
                    img.onerror = function() { if (!this.failed) { this.failed = true; this.src = 'assets/tokens/default.png'; }};
                    img.src = data.logo;
                    existingToken.imgObj = img;
                    existingToken.cachedImg = null; // Reset cache
                }
                existingToken.updated = true; 
            } else {
                let img = new Image();
                img.onerror = function() { if (!this.failed) { this.failed = true; this.src = 'assets/tokens/default.png'; }};
                img.src = data.logo;

                this.tokens.push({
                    symbol: data.symbol, logo: data.logo, contract: data.contract,
                    imgObj: img, cachedImg: null,
                    x: this.centerX, y: this.centerY,
                    tX: baseX, tY: baseY,
                    baseX: baseX, baseY: baseY, 
                    baseOrbitRadius: baseOrbitRadius, currentOrbitRadius: baseOrbitRadius, 
                    orbitSpeed: orbitSpeed, orbitAngle: orbitAngle,
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
        let bestDistSq = 999999;
        for (let t of this.tokens) {
            let dx = this.mouseX - t.x;
            let dy = this.mouseY - t.y;
            let distSq = dx*dx + dy*dy;
            let hitRadius = t.size + 8; 
            if (distSq < hitRadius*hitRadius && distSq < bestDistSq) {
                this.hoveredToken = t;
                bestDistSq = distSq;
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

        let existingSymbol = document.getElementById('sp-locked-symbol');
        if (existingSymbol && existingSymbol.innerText === t.symbol) {
            document.getElementById('sp-price-val').innerText = `$${t.price < 0.0001 ? t.price.toExponential(2) : t.price.toFixed(4)}`;
            let chgEl = document.getElementById('sp-price-chg');
            chgEl.innerText = `${cSign}${t.change.toFixed(2)}%`;
            chgEl.style.color = cColor; chgEl.style.backgroundColor = cBg;
            
            document.getElementById('sp-vol-val').innerText = `$${this.formatCompact(t.vol)}`;
            document.getElementById('sp-liq-val').innerText = `$${this.formatCompact(t.liq)}`;
            document.getElementById('sp-mc-val').innerText = `$${this.formatCompact(t.mc)}`;
            document.getElementById('sp-hold-val').innerText = this.formatCompact(t.holders);
            
            document.getElementById('sp-limit-txt').innerText = `CEX: $${this.formatCompact(t.vLimit)} (${pctLimit.toFixed(0)}%)`;
            document.getElementById('sp-chain-txt').innerText = `ON-CHAIN: $${this.formatCompact(t.vChain)} (${pctChain.toFixed(0)}%)`;
            document.getElementById('sp-limit-bar').style.width = `${pctLimit}%`;
            document.getElementById('sp-chain-bar').style.width = `${pctChain}%`;
            return;
        }

        this.sidePanel.innerHTML = `
            <div class="sp-close" onclick="document.getElementById('sonar-side-panel').classList.remove('open')">×</div>
            <div class="sp-lock-status"><span class="blink-dot"></span> SATELLITE LINK ESTABLISHED</div>
            <div class="sp-head">
                <img src="${t.logo}" onerror="this.src='assets/tokens/default.png'">
                <div class="sp-sym-wrap">
                    <div class="sp-title" id="sp-locked-symbol">${t.symbol}</div>
                    <div class="sp-contract" onclick="window.pluginCopy && window.pluginCopy('${t.contract}')" title="Copy Contract">
                        ${shortContract} <i class="far fa-copy"></i>
                    </div>
                </div>
            </div>
            <div class="sp-price-box">
                <div>
                    <div class="sp-price-lbl">CURRENT PRICE</div>
                    <div class="sp-price-val" id="sp-price-val">$${t.price < 0.0001 ? t.price.toExponential(2) : t.price.toFixed(4)}</div>
                </div>
                <div class="sp-price-chg" id="sp-price-chg" style="color: ${cColor}; background: ${cBg};">${cSign}${t.change.toFixed(2)}%</div>
            </div>
            <div class="sp-grid">
                <div class="sp-box"><div class="sp-box-lbl">24H VOLUME</div><div class="sp-box-val" id="sp-vol-val" style="color: #F0B90B;">$${this.formatCompact(t.vol)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">LIQUIDITY</div><div class="sp-box-val" id="sp-liq-val" style="color: #00f0ff;">$${this.formatCompact(t.liq)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">MARKET CAP</div><div class="sp-box-val" id="sp-mc-val" style="color: #fff;">$${this.formatCompact(t.mc)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">HOLDERS</div><div class="sp-box-val" id="sp-hold-val" style="color: #eaecef;">${this.formatCompact(t.holders)}</div></div>
            </div>
            <div class="sp-vol-bar-wrap" style="margin-bottom: 0;">
                <div class="sp-vol-head">
                    <span id="sp-limit-txt" style="color: #F0B90B;">CEX: $${this.formatCompact(t.vLimit)} (${pctLimit.toFixed(0)}%)</span>
                    <span id="sp-chain-txt" style="color: #9945FF;">ON-CHAIN: $${this.formatCompact(t.vChain)} (${pctChain.toFixed(0)}%)</span>
                </div>
                <div class="sp-vol-track"><div id="sp-limit-bar" class="sp-vol-limit" style="width: ${pctLimit}%"></div><div id="sp-chain-bar" class="sp-vol-chain" style="width: ${pctChain}%"></div></div>
            </div>
        `;
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());
        if (!this.isVisible || this.width === 0) return;

        try {
            this.ctx.fillStyle = 'rgba(10, 14, 23, 0.3)'; 
            this.ctx.fillRect(0, 0, this.width, this.height);

            // --- VẼ CHÚ THÍCH HUD ---
            this.ctx.font = '600 11px "Courier New", monospace';
            
            if (this.visualMode === 'orbit') {
                this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                for (let i = 1; i <= 4; i++) {
                    let currentRadius = (this.maxRadius / 4) * i;
                    this.ctx.moveTo(this.centerX + currentRadius, this.centerY);
                    this.ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2);
                }
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, 8, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
                this.ctx.fill();

                this.ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('[ CORE: MAX LIQ/VOL ]', this.centerX, this.centerY - 15);
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                this.ctx.fillText('[ OUTER: MIN LIQ/VOL ]', this.centerX, this.centerY - this.maxRadius + 15);
                this.ctx.fillStyle = 'rgba(255, 51, 102, 0.4)';
                this.ctx.fillText('* ORBIT SPEED = TRANSACTION ACTIVITY *', this.centerX, this.height - 15);
                this.ctx.textAlign = 'left';
            } else {
                this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
                this.ctx.setLineDash([4, 4]);
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerX, 0); this.ctx.lineTo(this.centerX, this.height);
                this.ctx.moveTo(0, this.centerY); this.ctx.lineTo(this.width, this.centerY);
                this.ctx.stroke();
                this.ctx.setLineDash([]);

                this.ctx.fillStyle = 'rgba(255, 51, 102, 0.3)'; 
                this.ctx.textAlign = 'left';
                this.ctx.fillText('[ HIGH VOL / BEARISH ]', 15, 60);
                this.ctx.fillText('[ LOW VOL / BEARISH ]', 15, this.height - 20);

                this.ctx.fillStyle = 'rgba(14, 203, 129, 0.3)'; 
                this.ctx.textAlign = 'right';
                this.ctx.fillText('[ HIGH VOL / BULLISH ]', this.width - 15, 60);
                this.ctx.fillText('[ LOW VOL / BULLISH ]', this.width - 15, this.height - 20);

                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('<<< PRICE DROP', this.centerX / 2, this.centerY - 5);
                this.ctx.fillText('PRICE SURGE >>>', this.centerX + (this.centerX / 2), this.centerY - 5);
                this.ctx.textAlign = 'left';
            }

            // --- THUẬT TOÁN VẬT LÝ VÀ CHỐNG DÍNH CHÙM ---
            if (!this.isPaused) {
                for (let i = 0; i < this.tokens.length; i++) {
                    let t = this.tokens[i];
                    if (this.visualMode === 'orbit') {
                        t.orbitAngle += t.orbitSpeed;
                        t.currentOrbitRadius += (t.baseOrbitRadius - t.currentOrbitRadius) * 0.05;
                        t.baseX = this.centerX + t.currentOrbitRadius * Math.cos(t.orbitAngle);
                        t.baseY = this.centerY + t.currentOrbitRadius * Math.sin(t.orbitAngle);
                    }
                    t.tX += (t.baseX - t.tX) * 0.05;
                    t.tY += (t.baseY - t.tY) * 0.05;
                }

                // TỐI ƯU HÓA: Chỉ tính toán lực đẩy (repulsion) nếu thực sự cần
                for (let i = 0; i < this.tokens.length; i++) {
                    let t = this.tokens[i];
                    for (let j = i + 1; j < this.tokens.length; j++) {
                        let other = this.tokens[j];
                        
                        let dx = t.tX - other.tX;
                        let dy = t.tY - other.tY;
                        let distSq = dx*dx + dy*dy; // Dùng khoảng cách bình phương thay vì Math.sqrt()
                        let minDist = t.size + other.size + 15;

                        // Chống dính chùm
                        if (distSq < minDist * minDist && distSq > 0) {
                            let dist = Math.sqrt(distSq);
                            let pushForce = (minDist - dist) * 0.2; 
                            let fX = (dx / dist) * pushForce;
                            let fY = (dy / dist) * pushForce;
                            
                            t.tX += fX; t.tY += fY;
                            other.tX -= fX; other.tY -= fY;
                        }
                        
                        // Vẽ tia lưới Mesh (Batch vẽ chung để tối ưu)
                        if (this.visualMode === 'mesh' && t.color === other.color) {
                            let realDistSq = (t.x - other.x) * (t.x - other.x) + (t.y - other.y) * (t.y - other.y);
                            if (realDistSq < 6400) { // 80^2 = 6400
                                let realDist = Math.sqrt(realDistSq);
                                this.ctx.beginPath();
                                this.ctx.moveTo(t.x, t.y);
                                this.ctx.lineTo(other.x, other.y);
                                this.ctx.strokeStyle = t.color;
                                this.ctx.globalAlpha = 0.15 * (1 - realDist/80);
                                this.ctx.stroke();
                            }
                        }
                    }

                    // Ép khung
                    t.tX = Math.max(20, Math.min(this.width - 20, t.tX));
                    t.tY = Math.max(20, Math.min(this.height - 20, t.tY));

                    // TỐI ƯU HÓA: Sleep state - Nếu lệch cực nhỏ thì cho đứng im luôn khỏi tính
                    if (Math.abs(t.tX - t.x) > 0.1 || Math.abs(t.tY - t.y) > 0.1 || Math.abs(t.targetSize - t.size) > 0.1) {
                        t.x += (t.tX - t.x) * 0.15; 
                        t.y += (t.tY - t.y) * 0.15;
                        t.size += (t.targetSize - t.size) * 0.1;
                    }
                }
            }

            this.ctx.globalAlpha = 1.0;

            // --- VẼ LOGO ĐÃ CACHE TRƯỚC VÀO CANVAS (Tối ưu triệt để) ---
            this.tokens.forEach(t => {
                let isHovered = (this.hoveredToken && this.hoveredToken.symbol === t.symbol);
                let isLocked = (this.lockedToken && this.lockedToken.symbol === t.symbol);
                
                this.ctx.globalAlpha = (isHovered || isLocked) ? 1.0 : 0.8;
                let radius = t.size;

                // Tạo cache bo tròn duy nhất 1 lần nếu ảnh đã load
                if (!t.cachedImg && t.imgObj && t.imgObj.complete && t.imgObj.naturalWidth > 0 && !t.imgObj.failed) {
                    t.cachedImg = this.createRoundedCache(t.imgObj);
                }

                // Nếu đã có ảnh Cache => Vẽ cực mượt (thay vì phải gọi ctx.clip() mỗi frame)
                if (t.cachedImg) {
                    this.ctx.drawImage(t.cachedImg, t.x - radius, t.y - radius, radius*2, radius*2);
                } else {
                    // Fallback trong lúc chờ load ảnh
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#1a1f2e';
                    this.ctx.fill();
                }

                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = (isHovered || isLocked) ? '#fff' : t.color;
                this.ctx.lineWidth = (isHovered || isLocked) ? 2 : 1;
                this.ctx.stroke();
            });
            this.ctx.globalAlpha = 1.0;

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
