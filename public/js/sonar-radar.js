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
        this.layoutHost = this.container.parentElement || document.body;
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';

        this.isRunning = true;
        this.isVisible = true;
        this.isPaused = false;

        this.latestData = null;
        this.tokens = [];
        this.tokenDict = {};
        this.lastTokenCount = 0;
        this.lastCalcTime = 0;

        this.filterMode = 'volume';
        this.visualMode = 'orbit';

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
        this.meshHardCapDesktop = 180;
        this.meshHardCapMobile = 100;
        this.orbitHardCapDesktop = 420;
        this.orbitHardCapMobile = 240;
        this.meshRepulsionStrength = 0.085;
        this.meshMaxPush = 1.8;
        this.meshRepulsionBuffer = 10;


        // User configurable cap (default nhẹ)
        this.tokenCapOptions = [10, 50, 100, 200, 500];
        this.userTokenCap = 10;
        this.absoluteMaxCap = 1000;
        this.maxMeshLinksPerFrame = 1200;
        this.panelOpenedAt = 0;
        this.dashboardStats = null;
        this.whaleAlerts = [];
        this.maxLiqCached = 0;
        this.pulseInterval = 2400;
        this.pulseDuration = 3200;
        this.lastPulseAt = 0;
        this.pulseWaves = [];
        this.whaleAlertHistory = {}; 

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


    isExcludedToken(source, tokenMeta = null) {
        const text = [
            source?.symbol, source?.s, source?.name, source?.status, source?.cat,
            tokenMeta?.symbol, tokenMeta?.name, tokenMeta?.status,
            Array.isArray(source?.tags) ? source.tags.join(' ') : source?.tags,
            Array.isArray(tokenMeta?.tags) ? tokenMeta.tags.join(' ') : tokenMeta?.tags
        ].filter(Boolean).join(' ').toLowerCase();

        if (!text) return false;
        return text.includes('delist') || text.includes('de-list') || text.includes('spot') ||
               text.includes('security') || text.includes('chứng khoán') || text.includes('chung khoan');
    }


    detectSector(token) {
        const raw = [token?.sector, token?.category, token?.tags, token?.cat]
            .map(v => Array.isArray(v) ? v.join(' ') : (v || ''))
            .join(' ')
            .toLowerCase();
        if (raw.includes('defi')) return 'DeFi';
        if (raw.includes('ai')) return 'AI';
        if (raw.includes('game')) return 'Gaming';
        if (raw.includes('infra') || raw.includes('layer') || raw.includes('l1') || raw.includes('l2')) return 'Infrastructure';
        if (raw.includes('meme')) return 'Memecoin';
        return 'Other';
    }

    pct(num, den) {
        if (!den) return 0;
        return (num / den) * 100;
    }

    initUI() {
        const oldBar = document.getElementById('sonar-control-bar');
        if (oldBar) oldBar.remove();
        const oldPanel = document.getElementById('sonar-side-panel');
        if (oldPanel) oldPanel.remove();

        const oldShell = document.getElementById('sonar-main-container');
        if (oldShell) {
            oldShell.replaceWith(this.container);
        }

        this.dashboardShell = document.createElement('div');
        this.dashboardShell.id = 'sonar-main-container';
        this.dashboardShell.innerHTML = `
            <aside id="sonar-left-panel" class="sonar-analytics-panel"></aside>
            <section id="sonar-center-panel"></section>
            <aside id="sonar-right-panel" class="sonar-analytics-panel"></aside>
        `;

        if (this.layoutHost && this.layoutHost !== this.container) {
            this.layoutHost.insertBefore(this.dashboardShell, this.container);
        } else if (this.container.parentElement) {
            this.container.parentElement.insertBefore(this.dashboardShell, this.container);
        }

        this.centerPanel = this.dashboardShell.querySelector('#sonar-center-panel');
        this.leftPanel = this.dashboardShell.querySelector('#sonar-left-panel');
        this.rightPanel = this.dashboardShell.querySelector('#sonar-right-panel');
        this.centerPanel.appendChild(this.container);
        this.layoutHost = this.centerPanel;

        if (!document.getElementById('sonar-pro-styles')) {
            const style = document.createElement('style');
            style.id = 'sonar-pro-styles';
            style.innerHTML = `
                #sonar-main-container { display: flex; gap: 10px; height: 100%; min-height: 560px; }
                #sonar-center-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; }
                .sonar-analytics-panel { width: 220px; background: rgba(8,12,18,0.96); border: 1px solid rgba(0,240,255,0.25); border-radius: 10px; padding: 10px; box-sizing: border-box; overflow: auto; color: #d6e5ee; font-family: 'Rajdhani', monospace; }
                .sap-title { color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0.6px; margin: 6px 0; }
                .sap-kv { border-top: 1px solid rgba(255,255,255,0.08); padding: 6px 0; }
                .sap-k { font-size: 10px; color: rgba(255,255,255,0.55); }
                .sap-v { font-size: 15px; color: #fff; font-weight: 700; }
                .sap-row { display:flex; justify-content:space-between; gap:8px; font-size:12px; padding:2px 0; }
                .sap-mini-bar { height: 6px; border-radius: 4px; background: rgba(255,255,255,0.09); overflow: hidden; }
                .sap-mini-fill { height:100%; background:#00f0ff; }
                #sonar-mobile-drawer { display:none; }

                #sonar-control-bar {
                    position: relative; z-index: 220;
                    display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
                    background: rgba(0,0,0,0.55); border: 1px solid rgba(0,240,255,0.18);
                    padding: 8px 10px; border-radius: 10px; backdrop-filter: blur(5px);
                    margin: 0 0 8px 0;
                    flex: 0 0 auto;
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
                #sonar-token-cap, #sonar-token-cap-custom {
                    background: rgba(9,14,22,0.95); color: #fff; border: 1px solid rgba(0,240,255,0.3);
                    border-radius: 4px; padding: 2px 4px; font: 700 12px 'Rajdhani', sans-serif;
                }
                #sonar-token-cap-custom { width: 68px; }
                #sonar-token-cap-apply { padding: 3px 8px; font-size: 11px; }
                .sonar-search-wrap { position: relative; display: flex; align-items: center; gap: 4px; }
                #sonar-search-input {
                    width: 150px; background: rgba(9,14,22,0.95); color: #fff; border: 1px solid rgba(0,240,255,0.3);
                    border-radius: 4px; padding: 4px 6px; font: 600 12px 'Rajdhani', sans-serif;
                }
                #sonar-search-list {
                    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 260;
                    background: rgba(8,12,18,0.96); border: 1px solid rgba(0,240,255,0.25); border-radius: 8px;
                    max-height: 260px; overflow-y: auto; display: none;
                }
                #sonar-search-list.open { display: block; }
                .sonar-search-item {
                    padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer;
                    font: 600 11px 'Rajdhani', sans-serif; color: #d9e7ef;
                }
                .sonar-search-item:last-child { border-bottom: none; }
                .sonar-search-item:hover { background: rgba(0,240,255,0.12); }
                .sonar-search-item .sym { color: #fff; font-weight: 800; }
                .sonar-search-item .meta { color: rgba(255,255,255,0.62); font-size: 10px; }
                .sonar-mode-hint {
                    color: rgba(255,255,255,0.75); border: 1px dashed rgba(255,255,255,0.25);
                    border-radius: 6px; padding: 3px 8px; font: 600 11px 'Rajdhani', sans-serif;
                    letter-spacing: 0.2px;
                }
                #sonar-read-guide {
                    position: absolute; left: 10px; bottom: 10px; z-index: 30;
                    width: min(430px, calc(100% - 20px)); max-height: 56%;
                    background: rgba(7,10,16,0.93); border: 1px solid rgba(0,240,255,0.26);
                    border-radius: 10px; padding: 10px 12px; color: #d8e6f0;
                    font: 600 11px/1.35 'Rajdhani', sans-serif;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.35);
                    display: none; overflow: auto;
                }
                #sonar-read-guide.open { display: block; }
                #sonar-read-guide b { color: #fff; }

                #sonar-panel-backdrop {
                    position: absolute; inset: 0; z-index: 95;
                    background: rgba(0,0,0,0.38); opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
                }
                #sonar-panel-backdrop.open { opacity: 1; pointer-events: auto; }

                #sonar-side-panel {
                    position: absolute; left: 50%; bottom: -110%; transform: translateX(-50%);
                    width: min(360px, 92%); max-height: 90%; z-index: 100;
                    background: rgba(10, 14, 23, 0.97); border: 1px solid rgba(0,240,255,0.45);
                    border-radius: 14px; backdrop-filter: blur(10px); transition: bottom 0.28s ease;
                    padding: 14px; box-sizing: border-box; color: #fff; font-family: 'Rajdhani', sans-serif;
                    overflow: hidden; display: flex; flex-direction: column;
                    box-shadow: 0 16px 40px rgba(0,0,0,0.45);
                }
                #sonar-side-panel.open { bottom: 12px; }

                .sp-head { display: flex; gap: 8px; align-items: center; margin: 2px 0 6px; border-bottom: 1px dashed rgba(255,255,255,0.14); padding-bottom: 6px; }
                .sp-head img { width: 42px; height: 42px; border-radius: 50%; border: 2px solid rgba(0,240,255,0.5); object-fit: cover; }
                .sp-title { font-size: clamp(18px, 2.1vw, 22px); font-weight: 800; line-height: 1.1; }
                .sp-contract { font-size: 11px; color: rgba(255,255,255,0.5); font-family: monospace; cursor: pointer; }
                .sp-price-box { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 8px; }
                .sp-price-val { font-size: clamp(18px, 2.2vw, 24px); font-weight: 800; line-height: 1.1; }
                .sp-price-chg { font-size: 15px; font-weight: 800; padding: 2px 8px; border-radius: 4px; }
                .sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
                .sp-box { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px; }
                .sp-box-lbl { font-size: 10px; color: rgba(255,255,255,0.45); margin-bottom: 3px; }
                .sp-box-val { font-size: clamp(12px, 1.5vw, 14px); font-weight: 700; font-family: monospace; }
                .sp-block { margin-top: 5px; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px; }
                .sp-block-title { font-size: 10px; letter-spacing: 0.35px; color: rgba(255,255,255,0.7); margin-bottom: 5px; font-weight: 700; }
                .sp-stat-row { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; margin: 2px 0; }
                .sp-stat-row .k { color: rgba(255,255,255,0.55); }
                .sp-stat-row .v { color: #fff; font-weight: 700; font-family: monospace; }
                .sp-bar-wrap { margin-top: 5px; }
                .sp-bar-head { display: flex; justify-content: space-between; font-size: 9px; color: rgba(255,255,255,0.7); margin-bottom: 4px; }
                .sp-bar-track { width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; display: flex; overflow: hidden; }
                .sp-bar-cex { height: 100%; background: #F0B90B; }
                .sp-bar-dex { height: 100%; background: #00f0ff; }

                @media (max-width: 768px) {
                    #sonar-control-bar { margin: 0 0 6px 0; gap: 6px; }
                    .sonar-btn { font-size: 11px; padding: 4px 8px; }
                    .sonar-cap-wrap { font-size: 10px; }
                    #sonar-token-cap-custom { width: 54px; }
                    #sonar-search-input { width: 120px; }
                    #sonar-read-guide { max-height: 50%; bottom: 8px; }
                    #sonar-side-panel { width: min(360px, 94%); max-height: 88%; padding: 10px; }
                    #sonar-left-panel, #sonar-right-panel { display: none; }
                    /* 1. Đổi main-container thành flex dọc để đẩy nội dung xuống dưới radar */
#sonar-main-container { display: flex; flex-direction: column; height: auto; min-height: unset; }

/* 2. Đổi drawer từ absolute thành relative để ngắt đè layer */
#sonar-mobile-drawer { 
    display: block; 
    position: relative; 
    margin-top: 10px; 
    z-index: 120; 
    background: rgba(8,12,18,0.96); 
    border: 1px solid rgba(0,240,255,0.25); 
    border-radius: 10px; 
}

/* 3. Ẩn thanh handle đi vì giờ chúng ta dùng thao tác cuộn trang tự nhiên, không cần kéo/thả */
#sonar-mobile-drawer .handle { display: none; }
#sonar-mobile-drawer .content { padding: 10px; }
                }
            `;
            document.head.appendChild(style);
        }

        this.controlBar = document.createElement('div');
        this.controlBar.id = 'sonar-control-bar';
        this.controlBar.innerHTML = `
            <button class="sonar-btn active" id="btn-mode-toggle" style="border-color:#F0B90B;color:#F0B90B;">[ ORBITAL SYSTEM ]</button>
            <button class="sonar-btn active" data-filter="volume">TOP VOL</button>
            <button class="sonar-btn" data-filter="liquidity">TOP LIQ</button>
            <button class="sonar-btn" data-filter="marketcap">TOP MC</button>
            <div class="sonar-cap-wrap">TOKENS
                <select id="sonar-token-cap">
                    ${this.tokenCapOptions.map(v => `<option value="${v}" ${v === this.userTokenCap ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
                <input id="sonar-token-cap-custom" type="number" min="1" max="2000" step="1" placeholder="Custom">
                <button class="sonar-btn" id="sonar-token-cap-apply">SET</button>
            </div>
            <button class="sonar-btn pause-btn" id="sonar-pause-btn">PAUSE</button>
            <div class="sonar-search-wrap">
                <input id="sonar-search-input" type="text" placeholder="Search symbol / contract">
                <div id="sonar-search-list"></div>
            </div>
            <button class="sonar-btn" id="sonar-read-guide-btn" style="border-color:#F0B90B;color:#F0B90B;">HOW TO READ</button>
            <span class="sonar-mode-hint" id="sonar-mode-hint">TIP: TRY ORBITAL SYSTEM</span>
        `;
        if (this.layoutHost && this.layoutHost !== this.container) {
            this.layoutHost.insertBefore(this.controlBar, this.container);
        } else {
            this.container.insertBefore(this.controlBar, this.container.firstChild);
        }
        this.canvas.style.display = 'block';

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
            const hint = this.controlBar.querySelector('#sonar-mode-hint');
            if (hint) hint.innerText = this.visualMode === 'mesh' ? 'TIP: TRY ORBITAL SYSTEM' : 'TIP: SWITCH BACK TO MESH';
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
            this.userTokenCap = Math.max(1, this.safeNum(e.target.value, 50));
            this.recalculate(true);
        });

        const capCustom = this.controlBar.querySelector('#sonar-token-cap-custom');
        const capApply = this.controlBar.querySelector('#sonar-token-cap-apply');
        const applyCustomCap = () => {
            const n = Math.floor(this.safeNum(capCustom?.value, 0));
            if (n > 0) {
                this.userTokenCap = n;
                this.recalculate(true);
            }
        };
        if (capApply) capApply.addEventListener('click', applyCustomCap);
        if (capCustom) capCustom.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') applyCustomCap(); });

        const searchInput = this.controlBar.querySelector('#sonar-search-input');
        const searchList = this.controlBar.querySelector('#sonar-search-list');
        const renderSearchResults = (query = '') => {
            if (!searchList) return;
            const items = this.getSearchCandidates(query).slice(0, 10);
            searchList.innerHTML = items.map(item => `
                <div class="sonar-search-item" data-symbol="${item.symbol}" data-contract="${item.contract || ''}">
                    <div class="sym">${item.symbol}</div>
                    <div class="meta">VOL $${this.formatCompact(item.vol)} • LIQ $${this.formatCompact(item.liq)} • MC $${this.formatCompact(item.mc)}</div>
                </div>
            `).join('');
            searchList.classList.toggle('open', items.length > 0);
        };

        if (searchInput) {
            searchInput.addEventListener('focus', () => renderSearchResults(searchInput.value || ''));
            searchInput.addEventListener('input', (e) => renderSearchResults((e.target.value || '').trim()));
        }

        if (searchList) {
            searchList.addEventListener('click', (e) => {
                const row = e.target.closest('.sonar-search-item');
                if (!row) return;
                const symbol = row.getAttribute('data-symbol');
                const contract = row.getAttribute('data-contract') || '';
                const token = this.findTokenForDetails(symbol, contract);
                if (token) {
                    this.lockedToken = token;
                    this.openSidePanel();
                }
                searchList.classList.remove('open');
                if (searchInput) searchInput.blur();
            });
        }

        const pauseBtn = this.controlBar.querySelector('#sonar-pause-btn');
        pauseBtn.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            pauseBtn.classList.toggle('paused', this.isPaused);
            pauseBtn.innerText = this.isPaused ? 'RESUME' : 'PAUSE';
        });

        this.panelBackdrop = document.createElement('div');
        this.panelBackdrop.id = 'sonar-panel-backdrop';
        this.panelBackdrop.addEventListener('click', () => { this.lockedToken = null; this.closeSidePanel(); });
        this.container.appendChild(this.panelBackdrop);

        this.sidePanel = document.createElement('div');
        this.sidePanel.id = 'sonar-side-panel';
        this.container.appendChild(this.sidePanel);

        this.readGuide = document.createElement('div');
        this.readGuide.id = 'sonar-read-guide';
        this.readGuide.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><b>How to read SONAR:</b><button id="sonar-guide-close" class="sonar-btn" style="padding:2px 8px;font-size:10px;">CLOSE</button></div>
            <div><b>Mesh Network:</b> X = Price change (left bearish, right bullish), Y = Relative volume (top high, bottom low).</div>
            <div><b>Orbital System:</b> Near center = token có Vol/Liq lớn hơn, outer rings = nhỏ hơn. Tốc độ quỹ đạo phản ánh hoạt động giao dịch.</div>
            <div><b>Filters:</b> TOP VOL / TOP LIQ / TOP MC sẽ đổi thứ hạng và kích thước token theo đúng metric đang chọn.</div>
        `;
        this.container.appendChild(this.readGuide);

        this.mobileDrawer = document.createElement('div');
        this.mobileDrawer.id = 'sonar-mobile-drawer';
        this.mobileDrawer.innerHTML = '<div class="handle"></div><div class="content"></div>';
        this.container.appendChild(this.mobileDrawer);

        const guideBtn = this.controlBar.querySelector('#sonar-read-guide-btn');
        const closeGuideBtn = this.readGuide.querySelector('#sonar-guide-close');
        if (guideBtn) {
            guideBtn.addEventListener('click', () => this.readGuide.classList.toggle('open'));
        }
        if (closeGuideBtn) {
            closeGuideBtn.addEventListener('click', () => this.readGuide.classList.remove('open'));
        }

        document.addEventListener('pointerdown', (e) => {
            const target = e.target;

            if (this.readGuide && this.readGuide.classList.contains('open') && !this.readGuide.contains(target) && !this.controlBar.contains(target)) {
                this.readGuide.classList.remove('open');
            }

            const searchListEl = this.controlBar ? this.controlBar.querySelector('#sonar-search-list') : null;
            const searchWrapEl = this.controlBar ? this.controlBar.querySelector('.sonar-search-wrap') : null;
            if (searchListEl && searchListEl.classList.contains('open') && (!searchWrapEl || !searchWrapEl.contains(target))) {
                searchListEl.classList.remove('open');
            }

            if (!this.sidePanel || !this.sidePanel.classList.contains('open')) return;
            if (Date.now() - this.panelOpenedAt < 120) return;
            if (this.sidePanel.contains(target) || this.controlBar.contains(target)) return;
            this.lockedToken = null;
            this.closeSidePanel();
        });
    }

    getSearchCandidates(query = '') {
        if (!this.latestData || typeof this.latestData !== 'object') return [];
        this.rebuildTokenDictIfNeeded();
        const q = String(query || '').trim().toLowerCase();
        const list = [];
        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;
            const tokenKey = key.replace('ALPHA_', '').replace('legacy_', '');
            const meta = this.tokenDict[tokenKey];
            if (this.isExcludedToken(t, meta)) return;

            const symbol = meta?.symbol || t.symbol || t.s || t.name || tokenKey;
            const contract = meta?.contract || '';
            const vol = this.safeNum(t.v?.dt);
            const liq = this.safeNum(meta?.liquidity, this.safeNum(t.l));
            const mc = this.safeNum(meta?.market_cap, this.safeNum(t.mc));
            const logo = meta?.icon || `assets/tokens/${String(symbol).toUpperCase()}.png`;
            const change = this.safeNum(t.c);
            const tx = this.safeNum(t.tx);
            const price = this.safeNum(t.p);
            const holders = this.safeNum(meta?.holders, this.safeNum(t.h));
            const vLimit = this.safeNum(meta?.volume?.daily_limit, this.safeNum(t.v?.dl));
            const vChain = Math.max(0, vol - vLimit);

            const hay = `${symbol} ${contract}`.toLowerCase();
            if (q && !hay.includes(q)) return;

            list.push({ symbol, contract, vol, liq, mc, logo, change, tx, price, holders, vLimit, vChain });
        });
        list.sort((a, b) => b.vol - a.vol);
        return list;
    }

    findTokenForDetails(symbol, contract = '') {
        const inCanvas = this.tokens.find(t => t.symbol === symbol || (contract && t.contract === contract));
        if (inCanvas) return inCanvas;
        const inSearch = this.getSearchCandidates(symbol).find(t => t.symbol === symbol || (contract && t.contract === contract));
        return inSearch || null;
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
        if (this.container.clientHeight < 100) this.container.style.height = '560px';
        const dpr = window.devicePixelRatio || 1;

        this.width = Math.max(300, this.container.clientWidth || window.innerWidth);
        this.height = Math.max(320, this.container.clientHeight || window.innerHeight);

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        this.orbitCenterX = this.width / 2;
        this.orbitCenterY = Math.max(110, this.height * 0.5);
        const maxLeft = this.orbitCenterX - 12;
        const maxRight = this.width - this.orbitCenterX - 12;
        const maxTop = this.orbitCenterY - 12;
        const maxBottom = this.height - this.orbitCenterY - 18;
        this.maxRadius = Math.max(20, Math.min(maxLeft, maxRight, maxTop, maxBottom));

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
        const requested = Math.max(1, Math.floor(this.userTokenCap || 50));
        const isMobile = this.width < 768;
        const modeHardCap = this.visualMode === 'orbit'
            ? (isMobile ? this.orbitHardCapMobile : this.orbitHardCapDesktop)
            : (isMobile ? this.meshHardCapMobile : this.meshHardCapDesktop);
        return Math.min(requested, modeHardCap, this.absoluteMaxCap);
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
        let maxMc = 0;
        let maxChange = 0;
        let sumVol = 0;
        const dataArray = [];

        Object.entries(this.latestData).forEach(([key, t]) => {
            if (!t || typeof t !== 'object' || !t.v || t.ss === 1) return;

            const tokenKey = key.replace('ALPHA_', '').replace('legacy_', '');
            const tokenMeta = this.tokenDict[tokenKey];
            if (this.isExcludedToken(t, tokenMeta)) return;

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
            if (mc > maxMc) maxMc = mc;
            if (Math.abs(change) > maxChange) maxChange = Math.abs(change);
            sumVol += vol;

            dataArray.push({ symbol, logo, contract, vol, liq, change, tx, price, mc, holders, vLimit, vChain });
        });

        // TÍNH TOÁN THỐNG KÊ Z-SCORE (Chỉ tính 1 lần)
        const meanVolume = dataArray.length ? sumVol / dataArray.length : 0;
        const stdVolume = Math.sqrt(dataArray.reduce((sq, t) => sq + Math.pow(t.vol - meanVolume, 2), 0) / (dataArray.length || 1));
        const now = Date.now();

        dataArray.forEach(data => {
            // 1. Tính Activity Score
            const volRatio = maxVol > 0 ? data.vol / maxVol : 0;
            const txRatio = maxTx > 0 ? data.tx / maxTx : 0;
            const volatility = maxChange > 0 ? Math.abs(data.change) / maxChange : 0;
            data.activityScore = 0.5 * volRatio + 0.3 * txRatio + 0.2 * volatility;

            // 2. Tính Z-Score Whale Alert
            data.isWhale = false;
            data.whaleSeverity = 'LOW';
            if (stdVolume > 0) {
                const zScore = (data.vol - meanVolume) / stdVolume;
                if (zScore > 2 && data.vol > meanVolume * 1.5 && data.liq > 10000) {
                    const lastAlert = this.whaleAlertHistory[data.symbol] || 0;
                    if (now - lastAlert > 600000) { // Rate limit 10 phút
                        data.isWhale = true;
                        data.whaleSeverity = zScore > 3 ? 'HIGH' : 'MEDIUM';
                        this.whaleAlertHistory[data.symbol] = now;
                    }
                }
            }
        });

        if (this.filterMode === 'liquidity') dataArray.sort((a, b) => b.liq - a.liq);
        else if (this.filterMode === 'marketcap') dataArray.sort((a, b) => b.mc - a.mc);
        else dataArray.sort((a, b) => b.vol - a.vol);

        this.maxLiqCached = maxLiq;
        const effectiveCap = this.getEffectiveCap();
        const selected = dataArray.slice(0, Math.min(effectiveCap, dataArray.length));
        const densityScale = selected.length > 300 ? 0.55 : (selected.length > 180 ? 0.75 : 1);

        const tokenBySymbol = new Map(this.tokens.map(t => [t.symbol, t]));
        selected.forEach((data, idx) => {
            const sizeMetric = this.filterMode === 'liquidity' ? data.liq : (this.filterMode === 'marketcap' ? data.mc : data.vol);
            const sizeMax = this.filterMode === 'liquidity' ? maxLiq : (this.filterMode === 'marketcap' ? maxMc : maxVol);
            const sizeBase = 10 + (sizeMetric / (sizeMax || 1)) * 14;
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
                const paddingY = 32;
                const usableW = Math.max(1, this.width - paddingX * 2);
                const usableH = Math.max(1, this.height - paddingY * 2);

                const hashOffset = ((symbolCode % 11) / 10) - 0.5;
                const volRatio = Math.max(0.01, Math.min(1, data.vol / (maxVol || 1)));

                baseX = paddingX + (usableW / 2) + (normChange / 20) * (usableW / 2) + hashOffset * 24;
                baseY = paddingY + usableH - (Math.pow(volRatio, 0.4) * usableH) + hashOffset * 16;
            } else {
                const ratio = this.filterMode === 'liquidity'
                    ? Math.max(0.01, Math.min(1, data.liq / (maxLiq || 1)))
                    : (this.filterMode === 'marketcap'
                        ? Math.max(0.01, Math.min(1, data.mc / (maxMc || 1)))
                        : Math.max(0.01, Math.min(1, data.vol / (maxVol || 1))));

                baseOrbitRadius = this.maxRadius * (1 - Math.pow(ratio, 0.3));
                baseOrbitRadius = Math.max(36, baseOrbitRadius);

                const laneCount = Math.max(8, Math.floor((this.maxRadius - 36) / this.orbitLaneSpacing));
                const laneIndex = (idx + symbolCode) % laneCount;
                const laneRadius = 36 + laneIndex * this.orbitLaneSpacing;
                baseOrbitRadius = Math.max(36, Math.min(this.maxRadius, baseOrbitRadius * 0.62 + laneRadius * 0.38));

                driftPhase = (symbolCode % 360) * (Math.PI / 180);
                const goldenAngle = 2.399963229728653;
                orbitAngle = ((idx + 1) * goldenAngle + driftPhase) % (Math.PI * 2);

                orbitSpeed = 0.001 + (data.activityScore * 0.006);
                if (data.change < 0) orbitSpeed *= -1;

                baseX = this.orbitCenterX + baseOrbitRadius * Math.cos(orbitAngle);
                baseY = this.orbitCenterY + baseOrbitRadius * Math.sin(orbitAngle);
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
                existing.isWhale = data.isWhale;
                existing.whaleSeverity = data.whaleSeverity;

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
                    isWhale: data.isWhale,
                    whaleSeverity: data.whaleSeverity,
                    lowDetail: false,
                    updated: true
                });
            }
        });

        this.tokens = this.tokens.filter(t => t.updated);
        this.tokens.forEach(t => { t.updated = false; });

        this.updateDashboardStats(dataArray);

        this.checkHover();
        if (this.lockedToken) this.updateSidePanelData();
    }


    updateDashboardStats(dataArray) {
        const totalVol = dataArray.reduce((a, t) => a + (t.vol || 0), 0);
        const dexVol = dataArray.reduce((a, t) => a + (t.vChain || 0), 0);
        const cexVol = dataArray.reduce((a, t) => a + (t.vLimit || 0), 0);
        const bullish = dataArray.filter(t => t.change > 0).length;
        const bearish = dataArray.filter(t => t.change < 0).length;
        const neutral = dataArray.length - bullish - bearish;

        const topGainers = [...dataArray].sort((a,b)=>b.change-a.change).slice(0,5);
        const topLosers = [...dataArray].sort((a,b)=>a.change-b.change).slice(0,5);
        const topMovers = [...dataArray].sort((a,b)=>(b.activityScore||0)-(a.activityScore||0)).slice(0,5);

        const whaleHits = dataArray.filter(t => t.isWhale).sort((a,b)=>b.vol-a.vol).slice(0,5);
        this.whaleAlerts = whaleHits.map(t => ({ symbol: t.symbol, vol: t.vol, severity: t.whaleSeverity }));

        this.dashboardStats = { totalVol, dexVol, cexVol, bullish, bearish, neutral, topGainers, topLosers, topMovers };

        if (this.leftPanel && this.rightPanel) {
            this.leftPanel.innerHTML = `
                <div class="sap-title">MARKET FLOW</div>
                <div class="sap-kv"><div class="sap-k">TOTAL VOL 24H</div><div class="sap-v">$${this.formatCompact(totalVol)}</div></div>
                <div class="sap-kv"><div class="sap-k">DEX VOL</div><div class="sap-v">$${this.formatCompact(dexVol)}</div></div>
                <div class="sap-kv"><div class="sap-k">CEX VOL</div><div class="sap-v">$${this.formatCompact(cexVol)}</div></div>
                <div class="sap-kv"><div class="sap-k">DEX SHARE</div><div class="sap-v">${this.pct(dexVol, totalVol).toFixed(1)}%</div></div>
                <div class="sap-title" style="margin-top:10px">MARKET STRUCTURE</div>
                <div class="sap-row"><span style="color:#0ECB81">BULLISH</span><span>${bullish}</span></div>
                <div class="sap-row"><span style="color:#F6465D">BEARISH</span><span>${bearish}</span></div>
                <div class="sap-row"><span style="color:#848E9C">NEUTRAL</span><span>${neutral}</span></div>
                <div class="sap-title" style="margin-top:10px; color:#F0B90B;">🔥 TOP MOVERS</div>
                ${topMovers.map(t=>`<div class="sap-row"><span>${t.symbol}</span><span style="color:#F0B90B">${(t.activityScore*100).toFixed(0)} pts</span></div>`).join('')}
            `;

            this.rightPanel.innerHTML = `
                <div class="sap-title">TOP GAINERS</div>
                ${topGainers.map(t=>`<div class="sap-row"><span>${t.symbol}</span><span style="color:#0ECB81">+${t.change.toFixed(2)}%</span></div>`).join('')}
                <div class="sap-title" style="margin-top:10px">TOP LOSERS</div>
                ${topLosers.map(t=>`<div class="sap-row"><span>${t.symbol}</span><span style="color:#F6465D">${t.change.toFixed(2)}%</span></div>`).join('')}
                <div class="sap-title" style="margin-top:10px; color:#9945FF">🐋 WHALE ALERTS</div>
                ${this.whaleAlerts.length ? this.whaleAlerts.map(w=>`
                    <div class="sap-row">
                        <span style="color:${w.severity === 'HIGH' ? '#F6465D' : '#F0B90B'}; font-weight:700;">${w.severity === 'HIGH' ? '🚨' : '⚠️'} ${w.symbol}</span>
                        <span>$${this.formatCompact(w.vol)}</span>
                    </div>`).join('') : '<div class="sap-k">Normal activity</div>'}
            `;
        }
    }

        if (this.mobileDrawer) {
            const c = this.mobileDrawer.querySelector('.content');
            if (c) {
                c.innerHTML = `
                    <div class="sap-title">MARKET FLOW</div>
                    <div class="sap-row"><span>TOTAL</span><span>$${this.formatCompact(totalVol)}</span></div>
                    <div class="sap-row"><span>DEX</span><span>$${this.formatCompact(dexVol)}</span></div>
                    <div class="sap-row"><span>CEX</span><span>$${this.formatCompact(cexVol)}</span></div>
                    <div class="sap-title">MARKET STRUCTURE</div>
                    <div class="sap-row"><span>BULL/BEAR/NEU</span><span>${bullish}/${bearish}/${neutral}</span></div>
                    <div class="sap-title">TOP GAINERS</div>
                    ${topGainers.map(t=>`<div class="sap-row"><span>${t.symbol}</span><span>${t.change>0?'+':''}${t.change.toFixed(2)}%</span></div>`).join('')}
                    <div class="sap-title">TOP VOLUME</div>
                    ${topVolume.map(t=>`<div class="sap-row"><span>${t.symbol}</span><span>$${this.formatCompact(t.vol)}</span></div>`).join('')}
                    <div class="sap-title">WHALE ALERTS</div>
                    ${this.whaleAlerts.length ? this.whaleAlerts.map(w=>`<div class="sap-row"><span>${w.symbol}</span><span>$${this.formatCompact(w.vol)}</span></div>`).join('') : '<div class="sap-k">No alerts</div>'}
                `;
            }
        }
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
        if (this.panelBackdrop) this.panelBackdrop.classList.add('open');
        this.panelOpenedAt = Date.now();
        this.updateSidePanelData();
    }

    closeSidePanel() {
        this.sidePanel.classList.remove('open');
        if (this.panelBackdrop) this.panelBackdrop.classList.remove('open');
        this.lockedToken = null;
    }

    updateSidePanelData() {
        if (!this.lockedToken) return;
        const t = this.lockedToken;

        const isUp = t.change > 0;
        const cColor = isUp ? '#0ECB81' : (t.change < 0 ? '#F6465D' : '#F0B90B');
        const cSign = isUp ? '+' : '';
        const cBg = isUp ? 'rgba(14,203,129,0.2)' : (t.change < 0 ? 'rgba(246,70,93,0.2)' : 'rgba(240,185,11,0.2)');
        const shortContract = t.contract ? `${t.contract.substring(0, 6)}...${t.contract.slice(-4)}` : 'N/A';

        const totalVol = Math.max(1, this.safeNum(t.vol));
        const cexVol = Math.max(0, this.safeNum(t.vLimit));
        const dexVol = Math.max(0, this.safeNum(t.vChain));
        const cexPct = Math.max(0, Math.min(100, (cexVol / totalVol) * 100));
        const dexPct = Math.max(0, 100 - cexPct);
        const liqToMc = t.mc > 0 ? (t.liq / t.mc) * 100 : 0;
        const volToLiq = t.liq > 0 ? (t.vol / t.liq) : 0;

        this.sidePanel.innerHTML = `
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
            <div class="sp-block">
                <div class="sp-block-title">VOLUME SOURCE BREAKDOWN</div>
                <div class="sp-bar-wrap">
                    <div class="sp-bar-head">
                        <span>CEX LIMIT: $${this.formatCompact(cexVol)} (${cexPct.toFixed(0)}%)</span>
                        <span>DEX ONCHAIN: $${this.formatCompact(dexVol)} (${dexPct.toFixed(0)}%)</span>
                    </div>
                    <div class="sp-bar-track">
                        <div class="sp-bar-cex" style="width:${cexPct}%;"></div>
                        <div class="sp-bar-dex" style="width:${dexPct}%;"></div>
                    </div>
                </div>
            </div>
            <div class="sp-block">
                <div class="sp-block-title">KEY METRICS</div>
                <div class="sp-stat-row"><span class="k">TX COUNT (24H)</span><span class="v">${this.formatCompact(t.tx || 0)}</span></div>
                <div class="sp-stat-row"><span class="k">VOL / LIQ RATIO</span><span class="v">${volToLiq.toFixed(2)}x</span></div>
                <div class="sp-stat-row"><span class="k">LIQ / MC COVERAGE</span><span class="v">${liqToMc.toFixed(2)}%</span></div>
            </div>
        `;
    }

    drawBackdrop() {
        this.ctx.fillStyle = 'rgba(10, 14, 23, 0.35)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const now = Date.now();
        if (now - this.lastPulseAt > this.pulseInterval) {
            this.lastPulseAt = now;
            this.pulseWaves.push({ start: now });
        }
        this.pulseWaves = this.pulseWaves.filter(w => (now - w.start) < this.pulseDuration);
        for (let i = 0; i < this.pulseWaves.length; i++) {
            const age = (now - this.pulseWaves[i].start) / this.pulseDuration;
            const r = this.maxRadius * age;
            this.ctx.beginPath();
            this.ctx.arc(this.orbitCenterX, this.orbitCenterY, r, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(0,240,255,${0.18 * (1 - age)})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        this.ctx.font = '600 11px "Courier New", monospace';

        if (this.visualMode === 'orbit') {
            this.ctx.strokeStyle = 'rgba(0,240,255,0.08)';
            this.ctx.lineWidth = 1;
            for (let i = 1; i <= 4; i++) {
                const r = (this.maxRadius / 4) * i;
                this.ctx.beginPath();
                this.ctx.arc(this.orbitCenterX, this.orbitCenterY, r, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = 'rgba(0,240,255,0.38)';
            this.ctx.fillText('[ ORBIT VIEW ]', this.orbitCenterX, this.orbitCenterY - 14);
            this.ctx.fillStyle = 'rgba(255,255,255,0.34)';
            this.ctx.fillText('CENTER = HIGHER VOL/LIQ/MC | OUTER = LOWER', this.orbitCenterX, this.height - 28);
            this.ctx.textAlign = 'left';
        } else {
            this.ctx.strokeStyle = 'rgba(0,240,255,0.08)';
            this.ctx.setLineDash([4, 4]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.centerX, 0); this.ctx.lineTo(this.centerX, this.height);
            this.ctx.moveTo(0, this.centerY); this.ctx.lineTo(this.width, this.centerY);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            this.ctx.fillStyle = 'rgba(255,255,255,0.34)';
            this.ctx.fillText('X = PRICE CHANGE (LEFT BEAR / RIGHT BULL)', 12, this.height - 28);
            this.ctx.fillText('Y = RELATIVE VOLUME (TOP HIGH / BOTTOM LOW)', 12, this.height - 14);
        }

        this.ctx.fillStyle = 'rgba(255,255,255,0.45)';
        this.ctx.fillText(`MODE: ${this.visualMode.toUpperCase()} | TOKENS: ${this.tokens.length}/${this.getEffectiveCap()}`, 12, 16);
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
                    t.baseX = this.orbitCenterX + r * Math.cos(t.orbitAngle);
                    t.baseY = this.orbitCenterY + r * Math.sin(t.orbitAngle);
                }
                t.tX += (t.baseX - t.tX) * 0.05;
                t.tY += (t.baseY - t.tY) * 0.05;
            }

            // Repulsion + laser links chỉ cho Mesh để tiết kiệm CPU và đúng concept
            if (this.visualMode === 'mesh') {
                const pushPadding = 15;
                let linksDrawn = 0;
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

                        const minDist = t.size + o.size + pushPadding + this.meshRepulsionBuffer;
                        const minDistSq = minDist * minDist;
                        if (distSq < minDistSq) {
                            const dist = Math.sqrt(distSq);
                            const overlap = (minDist - dist) / minDist;
                            let pushForce = overlap * overlap * this.meshRepulsionStrength * minDist;
                            if (pushForce > this.meshMaxPush) pushForce = this.meshMaxPush;
                            const fx = (dx / dist) * pushForce;
                            const fy = (dy / dist) * pushForce;
                            t.tX += fx; t.tY += fy;
                            o.tX -= fx; o.tY -= fy;
                        }

                        const rDx = t.x - o.x;
                        const rDy = t.y - o.y;
                        const realDistSq = rDx * rDx + rDy * rDy;
                        if (linksDrawn < this.maxMeshLinksPerFrame && realDistSq < this.connectionDistanceSq && t.color === o.color) {
                            const realDist = Math.sqrt(realDistSq);
                            this.ctx.beginPath();
                            this.ctx.moveTo(t.x, t.y);
                            this.ctx.lineTo(o.x, o.y);
                            this.ctx.strokeStyle = t.color;
                            this.ctx.globalAlpha = 0.15 * (1 - realDist / this.connectionDistance);
                            this.ctx.stroke();
                            this.ctx.globalAlpha = 1;
                            linksDrawn++;
                        }
                    }
                }
            }

            for (let i = 0; i < this.tokens.length; i++) {
                const t = this.tokens[i];
                t.tX = Math.max(20, Math.min(this.width - 20, t.tX));
                t.tY = Math.max(20, Math.min(this.height - 20, t.tY));
                t.x += (t.tX - t.x) * 0.12;
                t.y += (t.tY - t.y) * 0.12;
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

            const liqRatio = this.maxLiqCached > 0 ? (t.liq / this.maxLiqCached) : 0;
            if (liqRatio > 0.3) {
                this.ctx.shadowColor = t.color;
                this.ctx.shadowBlur = 3 + liqRatio * 8;
            } else {
                this.ctx.shadowBlur = 0;
            }

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
            this.ctx.shadowBlur = 0;

            if (t.isWhale) {
                const isHighSeverity = t.whaleSeverity === 'HIGH';
                this.ctx.fillStyle = isHighSeverity ? 'rgba(246,70,93,0.95)' : 'rgba(240,185,11,0.95)';
                this.ctx.font = '700 10px "Rajdhani", sans-serif';
                this.ctx.fillText(isHighSeverity ? '🚨 Anomaly' : '🐋 Whale', t.x + radius + 6, t.y + radius + 10);
            }
        }


        // Draw tooltip last to keep it above all tokens
        const tooltipToken = this.hoveredToken && !this.lockedToken ? this.hoveredToken : null;
        if (tooltipToken) {
            const t = tooltipToken;
            const radius = t.size;
            const tagText = ` ${t.symbol} | ${t.change > 0 ? '+' : ''}${t.change.toFixed(2)}% `;
            this.ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
            const textWidth = this.ctx.measureText(tagText).width;
            const boxW = textWidth + 8;
            const boxH = 20;
            const pad = 8;

            let tagX = t.x + radius + 8;
            let tagY = t.y - radius - 8;
            if (tagX + boxW > this.width - pad) tagX = t.x - radius - 8 - boxW;

            let boxTop = tagY - 14;
            boxTop = Math.max(pad, Math.min(this.height - boxH - pad, boxTop));
            const textY = boxTop + 15;

            this.ctx.fillStyle = 'rgba(10,14,23,0.95)';
            this.ctx.fillRect(tagX, boxTop, boxW, boxH);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            this.ctx.strokeRect(tagX, boxTop, boxW, boxH);

            const anchorX = tagX > t.x ? tagX : tagX + boxW;
            const anchorY = Math.max(boxTop + 4, Math.min(boxTop + boxH - 4, t.y));
            this.ctx.beginPath();
            this.ctx.moveTo(t.x + (tagX > t.x ? radius : -radius), t.y);
            this.ctx.lineTo(anchorX, anchorY);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(tagText, tagX + 4, textY);
        }
    }
}
