// public/js/pro-mode.js

const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayedTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

// --- 1. BOOTSTRAP PLUGIN ---
(function initPlugin() {
    // Tự động nạp CSS
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectHTML();
        checkAccess();
        initMarket();
        setupEvents();
    });
})();

// --- 2. LOGIC QUYỀN TRUY CẬP & TAB MẶC ĐỊNH ---
function checkAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const savedRole = localStorage.getItem('wave_alpha_role');
    const overlay = document.getElementById('maintenance-overlay');
    const nav = document.getElementById('alpha-tab-nav');

    if (mode === 'admin' || savedRole === 'admin') {
        localStorage.setItem('wave_alpha_role', 'admin');
        document.body.classList.add('is-admin-mode');
        
        if (overlay) overlay.style.display = 'none';
        if (nav) nav.style.display = 'flex';
        
        // [QUAN TRỌNG] Mặc định bật Tab Alpha Market ngay lập tức
        window.pluginSwitchTab('alpha');
        
    } else {
        document.body.classList.remove('is-admin-mode');
        if (overlay) overlay.style.display = 'flex';
        if (nav) nav.style.display = 'none';
    }
}

// --- 3. BƠM GIAO DIỆN (ALPHA MARKET ĐỨNG TRƯỚC) ---
function injectHTML() {
    if (document.getElementById('alpha-plugin-root')) return;

    const root = document.createElement('div');
    root.id = 'alpha-plugin-root';
    root.innerHTML = `
        <div id="maintenance-overlay">
            <div class="maintenance-content">
                <div class="maintenance-icon">🚧</div>
                <h1>SYSTEM MAINTENANCE</h1>
                <p>Wave Alpha Terminal is updating data logic.</p>
                <p class="sub-text">Restricted Access.</p>
            </div>
        </div>

        <div id="alpha-tab-nav" style="display:none">
            <button id="btn-tab-alpha" class="tab-btn active" onclick="window.pluginSwitchTab('alpha')">
                🌊 Alpha Market <span class="badge-pro">PRO</span>
            </button>
            <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">
                🏆 Competition
            </button>
        </div>

        <div id="alpha-market-view" style="display:none">
            <div class="alpha-container">
                <div class="alpha-header">
                    <div class="search-group">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="alpha-search" placeholder="Search Token / Contract..." autocomplete="off">
                    </div>
                    <div class="header-meta">
                        <div id="last-updated" class="time-badge"><i class="fas fa-clock me-1"></i> Loading...</div>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="alpha-table">
                        <thead>
                            <tr class="h-top">
                                <th rowspan="2" class="text-center sticky-col" style="width:40px">#</th>
                                <th rowspan="2" class="sticky-col-2">TOKEN / CHAIN</th>
                                <th rowspan="2" class="text-end">PRICE</th>
                                <th colspan="3" class="text-center group-header">DAILY VOLUME (UTC)</th>
                                <th colspan="3" class="text-center group-header">MARKET STATS (24h)</th>
                            </tr>
                            <tr class="h-sub">
                                <th class="text-end cursor-pointer group-start" onclick="window.pluginSort('volume.daily_total')">TOTAL</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_limit')">LIMIT</th>
                                <th class="text-end cursor-pointer group-end" onclick="window.pluginSort('volume.daily_onchain')">ON-CHAIN</th>
                                <th class="text-end cursor-pointer group-start" onclick="window.pluginSort('volume.rolling_24h')">VOL 24H</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('tx_count')">TXs</th>
                                <th class="text-end cursor-pointer group-end" onclick="window.pluginSort('liquidity')">LIQ</th>
                            </tr>
                        </thead>
                        <tbody id="market-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);
}

// --- 4. RENDER TABLE (SỬ DỤNG LINK ẢNH API CHUẨN) ---
function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    displayedTokens.slice(0, displayCount).forEach((t, i) => {
        const tr = document.createElement('tr');
        
        // Logic Badge
        let badges = '';
        if (t.status === 'SPOT') badges += `<span class="smart-badge badge-spot">SPOT</span>`;
        if (t.status === 'DELISTED') badges += `<span class="smart-badge badge-delisted">DELISTED</span>`;
        
        if (t.listing_time && t.mul_point) {
            const days = Math.ceil(((t.listing_time + 2592000000) - Date.now()) / 86400000);
            if (days > 0) {
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
                badges += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${days}d]</span>`;
            }
        }

        // --- XỬ LÝ ẢNH (Theo mẫu JSON bạn đưa) ---
        // t.icon: Link ảnh Token
        // t.chain_icon: Link ảnh Chain
        const tokenImg = t.icon || 'https://placehold.co/32';
        const chainImg = t.chain_icon || 'https://placehold.co/14';

        tr.innerHTML = `
            <td class="text-center rank-col">${i + 1}</td>
            <td class="token-col">
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenImg}" class="token-logo" onerror="this.src='https://placehold.co/32'">
                        
                        <img src="${chainImg}" class="chain-badge" title="${t.chain || 'Chain'}" onerror="this.style.display='none'">
                    </div>
                    <div class="token-meta">
                        <div class="d-flex align-items-center gap-2 cursor-pointer" onclick="window.pluginCopy('${t.contract}')">
                            <span class="symbol-text">${t.symbol}</span>
                            <i class="fas fa-copy copy-icon"></i>
                        </div>
                        <div class="badge-row">${badges}</div>
                    </div>
                </div>
            </td>
            <td class="text-end price-col">
                <div class="price-val">$${formatPrice(t.price)}</div>
                <div class="price-change ${t.change_24h >= 0 ? 'up' : 'down'}">${t.change_24h >= 0 ? '+' : ''}${t.change_24h}%</div>
            </td>
            
            <td class="text-end col-total group-start">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end col-limit">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end col-onchain group-end">$${formatNum(t.volume.daily_onchain)}</td>
            
            <td class="text-end group-start">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num">${formatInt(t.tx_count)}</td>
            <td class="text-end col-liq group-end">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- UTILS & EVENTS ---
window.pluginSwitchTab = (tab) => {
    const oldView = document.getElementById('view-dashboard');
    const newView = document.getElementById('alpha-market-view');
    const btnComp = document.getElementById('btn-tab-competition');
    const btnAlpha = document.getElementById('btn-tab-alpha');

    if (tab === 'alpha') {
        if(newView) newView.style.display = 'block';
        if(oldView) oldView.style.display = 'none';
        btnAlpha?.classList.add('active');
        btnComp?.classList.remove('active');
    } else {
        if(newView) newView.style.display = 'none';
        if(oldView) oldView.style.display = 'block';
        btnComp?.classList.add('active');
        btnAlpha?.classList.remove('active');
    }
};

window.pluginSort = (key) => {
    if (sortConfig.key === key) sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else { sortConfig.key = key; sortConfig.dir = 'desc'; }
    applyFilterAndSort();
};

window.pluginCopy = (txt) => { if(txt) navigator.clipboard.writeText(txt); };

function setupEvents() {
    document.getElementById('alpha-search')?.addEventListener('keyup', applyFilterAndSort);
    window.addEventListener('scroll', () => {
        if (document.getElementById('alpha-market-view')?.style.display === 'block') {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (displayCount < displayedTokens.length) { displayCount += 50; renderTable(); }
            }
        }
    });
}

async function initMarket() { await fetchMarketData(); setInterval(fetchMarketData, 60000); }
async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        allTokens = data.tokens || [];
        applyFilterAndSort();
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = '<i class="fas fa-sync-alt me-1"></i> Updated: ' + data.last_updated;
    } catch (e) { console.error("Data error:", e); }
}

function applyFilterAndSort() {
    const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
    displayedTokens = allTokens.filter(t => (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term)));
    displayedTokens.sort((a, b) => {
        const valA = key => key.split('.').reduce((o, i) => (o ? o[i] : 0), a);
        const valB = key => key.split('.').reduce((o, i) => (o ? o[i] : 0), b);
        return sortConfig.dir === 'desc' ? valB(sortConfig.key) - valA(sortConfig.key) : valA(sortConfig.key) - valB(sortConfig.key);
    });
    displayCount = 50; renderTable();
}

function formatNum(n) { return !n ? '0' : (n >= 1e6 ? (n/1e6).toFixed(2)+'M' : (n >= 1e3 ? (n/1e3).toFixed(2)+'K' : n.toFixed(2))); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }