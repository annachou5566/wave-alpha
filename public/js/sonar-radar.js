* Alpha Sonar Galaxy - Performance Refactor
 * - Default token cap = 50 (nhẹ khi mở tab)
 * - Cho phép chọn 10/50/100/200/500
 * - Orbit mode ưu tiên mượt, token có thể lướt qua nhau
 * - Mesh mode có anti-clump + laser links nhưng giới hạn để tránh lag
 */

class AlphaSonarGalaxy {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        if (this.canvas.sonarInstance) {
            this.canvas.sonarInstance.destroy();
        }
        this.canvas.sonarInstance = this;

        this.ctx = this.canvas.getContext('2d');
        this.container = this.canvas.parentElement || document.body;
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';

        this.isRunning = true;
        this.isVisible = true;
        this.isPaused = false;

        this.latestData = null;
        this.tokens = [];
        this.tokenDict = {};
        this.lastTokenCount = 0;
        this.lastCalcTime = 0;

        this.filterMode = 'volume';
        this.visualMode = 'mesh';

        this.lockedToken = null;
        this.hoveredToken = null;
        this.mouseX = -1;
        this.mouseY = -1;

        // Performance knobs
        this.connectionDistance = 82;
        this.connectionDistanceSq = this.connectionDistance * this.connectionDistance;
        this.orbitLaneSpacing = 11;
        this.orbitDriftStrength = 0.35;
        this.minLogoRenderSize = 9;
        this.meshHardCapDesktop = 220;
        this.meshHardCapMobile = 120;
        this.orbitHardCapDesktop = 520;
        this.orbitHardCapMobile = 280;

        // User configurable cap (default nhẹ)
        this.tokenCapOptions = [10, 50, 100, 200, 500];
        this.userTokenCap = 50;

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
        return Number.isNaN(n) ? fallback : n;
    }

    formatCompact(num) {
        const n = this.safeNum(num);
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
                #sonar-control-bar {
                    position: absolute; top: 14px; left: 14px; z-index: 15;
                    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
                    background: rgba(0,0,0,0.55); border: 1px solid rgba(0,240,255,0.18);
                    padding: 8px 10px; border-radius: 10px; backdrop-filter: blur(5px);
                }
                .sonar-btn {
                    background: transparent; border: 1px solid rgba(0,240,255,0.35);
                    color: #00f0ff; padding: 5px 10px; border-radius: 6px; cursor: pointer;
                    font-family: 'Rajdhani', sans-serif; font-size: 12px; font-weight: 700;
                    text-transform: uppercase;
                }
                .sonar-btn.active, .sonar-btn:hover {
                    background: rgba(0,240,255,0.15);
                    box-shadow: 0 0 10px rgba(0,240,255,0.2);
                }
                .sonar-btn.pause-btn.paused {
                    color: #ff4775; border-color: rgba(255,71,117,0.6); background: rgba(255,71,117,0.12);
                }
                .sonar-cap-wrap {
                    display: flex; align-items: center; gap: 6px;
                    border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
                    padding: 3px 6px; color: rgba(255,255,255,0.7);
                    font: 600 11px 'Rajdhani', sans-serif;
                }
                #sonar-token-cap {
                    background: rgba(9,14,22,0.95); color: #fff; border: 1px solid rgba(0,240,255,0.3);
                    border-radius: 4px; padding: 2px 4px; font: 700 12px 'Rajdhani', sans-serif;
                }

                #sonar-side-panel {
                    position: absolute; top: 0; right: -360px; width: 320px; height: 100%; z-index: 100;
                    background: rgba(10, 14, 23, 0.95); border-left: 1px solid #00f0ff;
                    backdrop-filter: blur(10px); transition: right 0.25s ease;
                    padding: 20px; box-sizing: border-box; color: #fff; font-family: 'Rajdhani', sans-serif;
                    overflow-y: auto;
                }
                #sonar-side-panel.open { right: 0; }

                .sp-close { position: absolute; top: 10px; right: 14px; cursor: pointer; font-size: 24px; opacity: 0.7; }
                .sp-close:hover { opacity: 1; color: #ff4775; }
                .sp-head { display: flex; gap: 12px; align-items: center; margin: 18px 0 14px; border-bottom: 1px dashed rgba(255,255,255,0.14); padding-bottom: 12px; }
                .sp-head img { width: 42px; height: 42px; border-radius: 50%; border: 2px solid rgba(0,240,255,0.5); object-fit: cover; }
                .sp-title { font-size: 24px; font-weight: 800; }
                .sp-contract { font-size: 11px; color: rgba(255,255,255,0.5); font-family: monospace; cursor: pointer; }
                .sp-price-box { display: flex; justify-content: space-between; align-items: center; margin: 10px 0 14px; }
                .sp-price-val { font-size: 28px; font-weight: 800; }
                .sp-price-chg { font-size: 15px; font-weight: 800; padding: 2px 8px; border-radius: 4px; }
                .sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
                .sp-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 8px; }
                .sp-box-lbl { font-size: 10px; color: rgba(255,255,255,0.45); margin-bottom: 3px; }
                .sp-box-val { font-size: 16px; font-weight: 700; font-family: monospace; }

                @media (max-width: 768px) {
                    #sonar-side-panel { width: 100%; right: -100%; border-left: none; }
                }
            `;
            document.head.appendChild(style);
        }

        this.controlBar = document.createElement('div');
        this.controlBar.id = 'sonar-control-bar';
        this.controlBar.innerHTML = `
            <button class="sonar-btn active" id="btn-mode-toggle" style="border-color:#9945FF;color:#9945FF;">[ MESH NETWORK ]</button>
            <button class="sonar-btn active" data-filter="volume">TOP VOL</button>
            <button class="sonar-btn" data-filter="liquidity">TOP LIQ</button>
            <div class="sonar-cap-wrap">TOKENS
                <select id="sonar-token-cap">
                    ${this.tokenCapOptions.map(v => `<option value="${v}" ${v === this.userTokenCap ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
            </div>
            <button class="sonar-btn pause-btn" id="sonar-pause-btn">PAUSE</button>
        `;
        this.container.appendChild(this.controlBar);

        const modeBtn = this.controlBar.querySelector('#btn-mode-toggle');
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

        const filterBtns = this.controlBar.querySelectorAll('button[data-filter]');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.filterMode = e.currentTarget.getAttribute('data-filter');
                this.recalculate(true);
            });
        });

        const capSelect = this.controlBar.querySelector('#sonar-token-cap');
        capSelect.addEventListener('change', (e) => {
            this.userTokenCap = Math.max(10, this.safeNum(e.target.value, 50));
            this.recalculate(true);
        });

        const pauseBtn = this.controlBar.querySelector('#sonar-pause-btn');
        pauseBtn.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            pauseBtn.classList.toggle('paused', this.isPaused);
            pauseBtn.innerText = this.isPaused ? 'RESUME' : 'PAUSE';
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
            if (e.touches && e.touches.length > 0) updatePointer(e.touches[0].clientX, e.touches[0].clientY);
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
        if (this.container.clientHeight < 100) this.container.style.height = '450px';
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
        this.maxRadius = Math.max(20, Math.min(this.centerX, this.centerY) - 36);

        this.recalculate(true);
    }

    updateData(marketData) {
        if (!marketData || this.isPaused || !this.isVisible) return;
        this.latestData = marketData;

        const now = Date.now();
        if (now - this.lastCalcTime > 400) {
            this.recalculate();
            this.lastCalcTime = now;
        }
    }

    getEffectiveCap() {
        const isMobile = this.width < 768;
        const hardCap = this.visualMode === 'orbit'
            ? (isMobile ? this.orbitHardCapMobile : this.orbitHardCapDesktop)
            : (isMobile ? this.meshHardCapMobile : this.meshHardCapDesktop);
        return Math.min(this.userTokenCap, hardCap);
    }

    rebuildTokenDictIfNeeded() {
        if (typeof allTokens === 'undefined' || !Array.isArray(allTokens)) return;
        if (this.lastTokenCount === allTokens.length) return;

        this.tokenDict = {};
        allTokens.forEach(item => {
            if (item.alphaId) this.tokenDict[String(item.alphaId).replace('ALPHA_', '')] = item;
            if (item.id) this.tokenDict[String(item.id).replace('ALPHA_', '')] = item;
            if (item.symbol) this.tokenDict[item.symbol] = item;
        });
        this.lastTokenCount = allTokens.length;
    }

    recalculate() {
        if (!this.latestData || typeof this.latestData !== 'object' || this.width === 0) return;

        this.rebuildTokenDictIfNeeded();

        let maxVol = 0;
        let maxLiq = 0;
        let maxTx = 0;
        const dataArray = [];

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;

            const tokenKey = key.replace('ALPHA_', '').replace('legacy_', '');
            const tokenMeta = this.tokenDict[tokenKey];

            let symbol = tokenMeta?.symbol || t.symbol || t.s || t.name || tokenKey;
            let logo = tokenMeta?.icon || `assets/tokens/${String(symbol).toUpperCase()}.png`;
            const contract = tokenMeta?.contract || '';

            const vol = this.safeNum(t.v?.dt);
            const vLimit = this.safeNum(tokenMeta?.volume?.daily_limit, this.safeNum(t.v?.dl));
            const liq = this.safeNum(tokenMeta?.liquidity, this.safeNum(t.l, vol || 1));
            const change = this.safeNum(t.c);
            const tx = this.safeNum(t.tx);
            const price = this.safeNum(t.p);
            const mc = this.safeNum(tokenMeta?.market_cap, this.safeNum(t.mc));
            const holders = this.safeNum(tokenMeta?.holders, this.safeNum(t.h));
            const vChain = Math.max(0, vol - vLimit);

            if (vol > maxVol) maxVol = vol;
            if (liq > maxLiq) maxLiq = liq;
            if (tx > maxTx) maxTx = tx;

            dataArray.push({ symbol, logo, contract, vol, liq, change, tx, price, mc, holders, vLimit, vChain });
        });

        if (this.filterMode === 'liquidity') dataArray.sort((a, b) => b.liq - a.liq);
        else dataArray.sort((a, b) => b.vol - a.vol);

        const effectiveCap = this.getEffectiveCap();
        const selected = dataArray.slice(0, Math.min(effectiveCap, dataArray.length));
        const densityScale = selected.length > 300 ? 0.55 : (selected.length > 180 ? 0.75 : 1);

        const tokenBySymbol = new Map(this.tokens.map(t => [t.symbol, t]));

        selected.forEach((data, idx) => {
            const sizeBase = 10 + (data.vol / (maxVol || 1)) * 14;
            const targetSize = Math.max(3.5, Math.min(24, sizeBase * densityScale));
            const color = data.change > 0 ? '#0ECB81' : (data.change < 0 ? '#F6465D' : '#848E9C');

            let baseX = this.centerX;
            let baseY = this.centerY;
            let baseOrbitRadius = 0;
            let orbitSpeed = 0;
            let orbitAngle = 0;
            let driftPhase = 0;

            const symbolCode = String(data.symbol).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

            if (this.visualMode === 'mesh') {
                const normChange = Math.max(-20, Math.min(20, data.change));
                const paddingX = 38;
                const paddingY = 76;
                const usableW = Math.max(1, this.width - paddingX * 2);
                const usableH = Math.max(1, this.height - paddingY * 2);

                const hashOffset = ((symbolCode % 11) / 10) - 0.5;
                const volRatio = Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));

                baseX = paddingX + (usableW / 2) + (normChange / 20) * (usableW / 2) + hashOffset * 24;
                baseY = paddingY + usableH - (Math.pow(volRatio, 0.4) * usableH) + hashOffset * 16;
            } else {
                const ratio = this.filterMode === 'liquidity'
                    ? Math.max(0.01, Math.min(1, data.liq / (maxLiq || 1)))
                    : Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));

                baseOrbitRadius = this.maxRadius * (1 - Math.pow(ratio, 0.3));
                baseOrbitRadius = Math.max(36, baseOrbitRadius);

                const laneCount = Math.max(8, Math.floor((this.maxRadius - 36) / this.orbitLaneSpacing));
                const laneIndex = (idx + symbolCode) % laneCount;
                const laneRadius = 36 + laneIndex * this.orbitLaneSpacing;
                baseOrbitRadius = Math.max(36, Math.min(this.maxRadius, baseOrbitRadius * 0.62 + laneRadius * 0.38));

                driftPhase = (symbolCode % 360) * (Math.PI / 180);
                const goldenAngle = 2.399963229728653;
                orbitAngle = ((idx + 1) * goldenAngle + driftPhase) % (Math.PI * 2);

                orbitSpeed = 0.001 + (data.tx / (maxTx || 1)) * 0.006;
                if (data.change < 0) orbitSpeed *= -1;

                baseX = this.centerX + baseOrbitRadius * Math.cos(orbitAngle);
                baseY = this.centerY + baseOrbitRadius * Math.sin(orbitAngle);
            }

            const existing = tokenBySymbol.get(data.symbol);
            if (existing) {
                existing.baseX = baseX;
                existing.baseY = baseY;
                existing.targetSize = targetSize;
                existing.color = color;
                existing.price = data.price;
                existing.vol = data.vol;
                existing.change = data.change;
                existing.tx = data.tx;
                existing.liq = data.liq;
                existing.mc = data.mc;
                existing.holders = data.holders;
                existing.vLimit = data.vLimit;
                existing.vChain = data.vChain;

                if (this.visualMode === 'orbit') {
                    if (existing.orbitAngle === undefined) existing.orbitAngle = orbitAngle;
                    existing.baseOrbitRadius = baseOrbitRadius;
                    existing.orbitSpeed = orbitSpeed;
                    existing.driftPhase = driftPhase;
                }

                if (existing.logo !== data.logo) {
                    existing.logo = data.logo;
                    const img = new Image();
                    img.onerror = function () {
                        if (!this.failed) {
                            this.failed = true;
                            this.src = 'assets/tokens/default.png';
                        }
                    };
                    img.src = data.logo;
                    existing.imgObj = img;
                }

                existing.updated = true;
            } else {
                const img = new Image();
                img.onerror = function () {
                    if (!this.failed) {
                        this.failed = true;
                        this.src = 'assets/tokens/default.png';
                    }
                };
                img.src = data.logo;

                this.tokens.push({
                    symbol: data.symbol,
                    logo: data.logo,
                    contract: data.contract,
                    imgObj: img,
                    x: this.centerX,
                    y: this.centerY,
                    tX: baseX,
                    tY: baseY,
                    baseX,
                    baseY,
                    baseOrbitRadius,
                    currentOrbitRadius: baseOrbitRadius,
                    orbitSpeed,
                    orbitAngle,
                    driftPhase,
                    size: 0,
                    targetSize,
                    color,
                    price: data.price,
                    vol: data.vol,
                    liq: data.liq,
                    change: data.change,
                    tx: data.tx,
                    mc: data.mc,
                    holders: data.holders,
                    vLimit: data.vLimit,
                    vChain: data.vChain,
                    lowDetail: false,
                    updated: true
                });
            }
        });

        this.tokens = this.tokens.filter(t => t.updated);
        this.tokens.forEach(t => { t.updated = false; });

        this.checkHover();
        if (this.lockedToken) this.updateSidePanelData();
    }

    checkHover() {
        this.hoveredToken = null;
        let bestDistSq = Number.MAX_SAFE_INTEGER;

        for (let i = 0; i < this.tokens.length; i++) {
            const t = this.tokens[i];
            const dx = this.mouseX - t.x;
            const dy = this.mouseY - t.y;
            const distSq = dx * dx + dy * dy;
            const hitRadius = t.size + 8;
            if (distSq < hitRadius * hitRadius && distSq < bestDistSq) {
                bestDistSq = distSq;
                this.hoveredToken = t;
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

        const isUp = t.change > 0;
        const cColor = isUp ? '#0ECB81' : (t.change < 0 ? '#F6465D' : '#F0B90B');
        const cSign = isUp ? '+' : '';
        const cBg = isUp ? 'rgba(14,203,129,0.2)' : (t.change < 0 ? 'rgba(246,70,93,0.2)' : 'rgba(240,185,11,0.2)');
        const shortContract = t.contract ? `${t.contract.substring(0, 6)}...${t.contract.slice(-4)}` : 'N/A';

        this.sidePanel.innerHTML = `
            <div class="sp-close" onclick="document.getElementById('sonar-side-panel').classList.remove('open')">×</div>
            <div class="sp-head">
                <img src="${t.logo}" onerror="this.src='assets/tokens/default.png'">
                <div>
                    <div class="sp-title">${t.symbol}</div>
                    <div class="sp-contract" onclick="window.pluginCopy && window.pluginCopy('${t.contract}')">${shortContract}</div>
                </div>
            </div>
            <div class="sp-price-box">
                <div>
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);">CURRENT PRICE</div>
                    <div class="sp-price-val">$${t.price < 0.0001 ? t.price.toExponential(2) : t.price.toFixed(4)}</div>
                </div>
                <div class="sp-price-chg" style="color:${cColor};background:${cBg};">${cSign}${t.change.toFixed(2)}%</div>
            </div>
            <div class="sp-grid">
                <div class="sp-box"><div class="sp-box-lbl">24H VOL</div><div class="sp-box-val" style="color:#F0B90B;">$${this.formatCompact(t.vol)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">LIQUIDITY</div><div class="sp-box-val" style="color:#00f0ff;">$${this.formatCompact(t.liq)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">MARKET CAP</div><div class="sp-box-val">$${this.formatCompact(t.mc)}</div></div>
                <div class="sp-box"><div class="sp-box-lbl">HOLDERS</div><div class="sp-box-val">${this.formatCompact(t.holders)}</div></div>
            </div>
        `;
    }

    drawBackdrop() {
        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.35)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.font = '600 11px "Courier New", monospace';

        if (this.visualMode === 'orbit') {
            this.ctx.strokeStyle = 'rgba(0,240,255,0.08)';
            this.ctx.lineWidth = 1;
            for (let i = 1; i <= 4; i++) {
                const r = (this.maxRadius / 4) * i;
                this.ctx.beginPath();
                this.ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = 'rgba(0,240,255,0.38)';
            this.ctx.fillText('[ ORBIT: TOP TOKENS ]', this.centerX, this.centerY - 14);
            this.ctx.textAlign = 'left';
        } else {
            this.ctx.strokeStyle = 'rgba(0,240,255,0.08)';
            this.ctx.setLineDash([4, 4]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.centerX, 0); this.ctx.lineTo(this.centerX, this.height);
            this.ctx.moveTo(0, this.centerY); this.ctx.lineTo(this.width, this.centerY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.ctx.fillStyle = 'rgba(255,255,255,0.38)';
        this.ctx.fillText(`MODE: ${this.visualMode.toUpperCase()} | TOKENS: ${this.tokens.length}/${this.getEffectiveCap()}`, 12, this.height - 12);
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());
        if (!this.isVisible || this.width === 0) return;

        this.drawBackdrop();

        if (!this.isPaused) {
            for (let i = 0; i < this.tokens.length; i++) {
                const t = this.tokens[i];
                if (this.visualMode === 'orbit') {
                    t.orbitAngle += t.orbitSpeed;
                    t.currentOrbitRadius += (t.baseOrbitRadius - t.currentOrbitRadius) * 0.05;
                    const drift = Math.sin(t.orbitAngle * 2 + (t.driftPhase || 0)) * this.orbitDriftStrength;
                    const r = t.currentOrbitRadius + drift;
                    t.baseX = this.centerX + r * Math.cos(t.orbitAngle);
                    t.baseY = this.centerY + r * Math.sin(t.orbitAngle);
                }
                t.tX += (t.baseX - t.tX) * 0.05;
                t.tY += (t.baseY - t.tY) * 0.05;
            }

            // Repulsion + laser links chỉ cho Mesh để tiết kiệm CPU và đúng concept
            if (this.visualMode === 'mesh') {
                const pushPadding = 15;
                for (let i = 0; i < this.tokens.length; i++) {
                    const t = this.tokens[i];
                    for (let j = i + 1; j < this.tokens.length; j++) {
                        const o = this.tokens[j];

                        let dx = t.tX - o.tX;
                        let dy = t.tY - o.tY;
                        let distSq = dx * dx + dy * dy;
                        if (distSq === 0) {
                            dx = 0.01;
                            dy = 0.01;
                            distSq = 0.0002;
                        }

                        const minDist = t.size + o.size + pushPadding;
                        const minDistSq = minDist * minDist;
                        if (distSq < minDistSq) {
                            const dist = Math.sqrt(distSq);
                            const pushForce = (minDist - dist) * 0.2;
                            const fx = (dx / dist) * pushForce;
                            const fy = (dy / dist) * pushForce;
                            t.tX += fx; t.tY += fy;
                            o.tX -= fx; o.tY -= fy;
                        }

                        const rDx = t.x - o.x;
                        const rDy = t.y - o.y;
                        const realDistSq = rDx * rDx + rDy * rDy;
                        if (realDistSq < this.connectionDistanceSq && t.color === o.color) {
                            const realDist = Math.sqrt(realDistSq);
                            this.ctx.beginPath();
                            this.ctx.moveTo(t.x, t.y);
                            this.ctx.lineTo(o.x, o.y);
                            this.ctx.strokeStyle = t.color;
                            this.ctx.globalAlpha = 0.15 * (1 - realDist / this.connectionDistance);
                            this.ctx.stroke();
                            this.ctx.globalAlpha = 1;
                        }
                    }
                }
            }

            for (let i = 0; i < this.tokens.length; i++) {
                const t = this.tokens[i];
                t.tX = Math.max(20, Math.min(this.width - 20, t.tX));
                t.tY = Math.max(20, Math.min(this.height - 20, t.tY));
                t.x += (t.tX - t.x) * 0.15;
                t.y += (t.tY - t.y) * 0.15;
                t.size += (t.targetSize - t.size) * 0.1;
                t.lowDetail = this.visualMode === 'orbit' && this.tokens.length > 180 && t.size < this.minLogoRenderSize;
            }
        }

        // Token render
        for (let i = 0; i < this.tokens.length; i++) {
            const t = this.tokens[i];
            const isHovered = this.hoveredToken && this.hoveredToken.symbol === t.symbol;
            const isLocked = this.lockedToken && this.lockedToken.symbol === t.symbol;
            const radius = t.size;

            this.ctx.globalAlpha = (isHovered || isLocked) ? 1 : 0.8;

            if (!t.lowDetail && t.imgObj && t.imgObj.complete && t.imgObj.naturalWidth > 0) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
                this.ctx.closePath();
                this.ctx.clip();
                this.ctx.drawImage(t.imgObj, t.x - radius, t.y - radius, radius * 2, radius * 2);
                this.ctx.restore();
            } else {
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
            this.ctx.globalAlpha = 1;

            if (isHovered && !isLocked) {
                const tagText = ` ${t.symbol} | ${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}% `;
                this.ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
                const textWidth = this.ctx.measureText(tagText).width;
                const tagX = t.x + radius + 8;
                const tagY = t.y - radius - 8;

                this.ctx.fillStyle = 'rgba(10,14,23,0.9)';
                this.ctx.fillRect(tagX, tagY - 14, textWidth + 8, 20);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                this.ctx.strokeRect(tagX, tagY - 14, textWidth + 8, 20);
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText(tagText, tagX + 4, tagY + 1);
            }
        }
    }
}
