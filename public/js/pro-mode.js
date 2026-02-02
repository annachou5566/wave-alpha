// public/js/pro-mode.js

// --- 0. FORCE ADMIN ---
(function forceAdminCheck() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin' || localStorage.getItem('wave_alpha_role') === 'admin') {
        localStorage.setItem('wave_alpha_role', 'admin');
        document.documentElement.classList.add('is-admin-mode');
        const style = document.createElement('style');
        style.innerHTML = 'body.is-admin-mode #maintenance-overlay { display: none !important; } body.is-admin-mode #alpha-tab-nav { display: flex !important; }';
        document.head.appendChild(style);
    }
})();

const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. Dọn dẹp các element cũ nếu bị trùng (Fix lỗi 2 tab bấm)
    const oldNav = document.getElementById('alpha-tab-nav');
    if (oldNav) oldNav.remove(); 
    const oldView = document.getElementById('alpha-market-view');
    if (oldView) oldView.remove();
    const oldOverlay = document.getElementById('maintenance-overlay');
    if (oldOverlay) oldOverlay.remove();

    // 2. Load CSS
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }
    
    injectHTML();
    checkAccessLoop();
    initMarket();
    setupEvents();
});

function checkAccessLoop() {
    if (localStorage.getItem('wave_alpha_role') === 'admin') {
        const overlay = document.getElementById('maintenance-overlay');
        const nav = document.getElementById('alpha-tab-nav');
        if (overlay) overlay.style.display = 'none';
        if (nav) nav.style.display = 'flex';
        // Mặc định mở Tab Alpha
        window.pluginSwitchTab('alpha');
    }
}

function injectHTML() {
    const root = document.createElement('div');
    root.id = 'alpha-plugin-root';
    root.innerHTML = \`
        <div id="maintenance-overlay">
            <div class="maintenance-content">
                <div class="maintenance-icon">🚧</div>
                <h1>SYSTEM MAINTENANCE</h1>
                <p>Restricted Access.</p>
            </div>
        </div>

        <div id="alpha-tab-nav" style="display:none">
            <button id="btn-tab-alpha" class="tab-btn active" onclick="window.pluginSwitchTab('alpha')">
                <i class="fas fa-layer-group"></i> ALPHA MARKET <span class="badge-pro">PRO</span>
            </button>
            <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">
                <i class="fas fa-trophy"></i> COMPETITION
            </button>
        </div>

        <div id="alpha-market-view" style="display:none">
            <div class="alpha-container">
                <div class="alpha-header">
                    <div class="search-group">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="alpha-search" placeholder="Search Token / Contract..." autocomplete="off">
                    </div>
                    <div class="time-badge" id="last-updated">Waiting...</div>
                </div>
                
                <div class="table-responsive">
                    <table class="alpha-table">
                        <thead>
                            <tr class="h-top">
                                <th rowspan="2" class="text-center" style="width:40px">#</th>
                                <th rowspan="2" style="min-width:200px">TOKEN INFO</th>
                                <th rowspan="2" class="text-end">PRICE</th>
                                <th colspan="3" class="text-center group-col">DAILY VOLUME (UTC)</th>
                                <th colspan="3" class="text-center">MARKET STATS (24h)</th>
                            </tr>
                            <tr class="h-sub">
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_total')">TOTAL</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_limit')">LIMIT (CEX)</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_onchain')">ON-CHAIN</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.rolling_24h')">VOL 24H</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('tx_count')">TXs</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('liquidity')">LIQ</th>
                            </tr>
                        </thead>
                        <tbody id="market-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    \`;
    document.body.appendChild(root);
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let list = allTokens.filter(t => {
        const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
        return (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term));
    });

    list.sort((a, b) => {
        const valA = getVal(a, sortConfig.key);
        const valB = getVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });

    list.slice(0, displayCount).forEach((t, i) => {
        const tr = document.createElement('tr');
        
        // Badge Logic
        let badgesHtml = '';
        if (t.status === 'SPOT') badgesHtml += '<span class="smart-badge badge-spot">SPOT</span>';
        if (t.status === 'DELISTED') badgesHtml += '<span class="smart-badge badge-delisted">DELISTED</span>';
        if (t.listing_time && t.mul_point) {
            const now = Date.now();
            const end = t.listing_time + (30 * 24 * 60 * 60 * 1000);
            const diff = Math.ceil((end - now) / 86400000);
            if (diff > 0) {
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
                badgesHtml += \`<span class="smart-badge badge-alpha">[x\${t.mul_point} \${diff}d]</span>\`;
            }
        }

        // Image Logic (API Fallback)
        const tokenImg = t.icon || 'https://placehold.co/32';
        const chainImg = t.chain_icon || 'https://placehold.co/14';

        tr.innerHTML = \`
            <td class="text-center font-num text-secondary">\${i + 1}</td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="\${tokenImg}" class="token-logo" onerror="this.src='https://placehold.co/32'">
                        <img src="\${chainImg}" class="chain-badge" onerror="this.style.display='none'">
                    </div>
                    <div class="token-meta">
                        <div class="symbol-row" onclick="window.pluginCopy('\${t.contract}')">
                            <span class="symbol-text">\${t.symbol}</span>
                            <i class="fas fa-copy copy-icon"></i>
                        </div>
                        <div class="badge-row">\${badgesHtml}</div>
                    </div>
                </div>
            </td>
            <td class="text-end font-num">
                <div class="text-white-bold">$\${formatPrice(t.price)}</div>
                <div style="font-size:11px" class="\${t.change_24h >= 0 ? 'text-green' : 'text-red'}">
                    \${t.change_24h >= 0 ? '+' : ''}\${t.change_24h}%
                </div>
            </td>
            
            <td class="text-end font-num text-white-bold" style="font-size:15px">$\${formatNum(t.volume.daily_total)}</td>
            <td class="text-end font-num text-dim">$\${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-neon">$\${formatNum(t.volume.daily_onchain)}</td>
            
            <td class="text-end font-num text-white">$\${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num text-secondary">\${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-brand">$\${formatNum(t.liquidity)}</td>
        \`;
        tbody.appendChild(tr);
    });
}

function formatNum(n) { 
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k';
    return n.toFixed(2);
}
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }

window.pluginCopy = (txt) => { 
    if(txt) {
        navigator.clipboard.writeText(txt);
        const t = document.createElement('div');
        t.innerText = 'Copied Contract!';
        t.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#00F0FF; color:#000; padding:8px 16px; border-radius:4px; font-weight:bold; z-index:99999;';
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
    }
};

window.pluginSwitchTab = (tab) => {
    const newView = document.getElementById('alpha-market-view');
    const oldView = document.getElementById('view-dashboard');
    const btnA = document.getElementById('btn-tab-alpha');
    const btnC = document.getElementById('btn-tab-competition');

    if (tab === 'alpha') {
        if(newView) newView.style.display = 'block';
        if(oldView) oldView.style.display = 'none';
        btnA?.classList.add('active'); btnC?.classList.remove('active');
    } else {
        if(newView) newView.style.display = 'none';
        if(oldView) oldView.style.display = 'block';
        btnC?.classList.add('active'); btnA?.classList.remove('active');
    }
};

window.pluginSort = (key) => {
    if (sortConfig.key === key) sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else { sortConfig.key = key; sortConfig.dir = 'desc'; }
    renderTable();
};

function setupEvents() {
    document.getElementById('alpha-search')?.addEventListener('keyup', () => renderTable());
    window.addEventListener('scroll', () => {
        if (document.getElementById('alpha-market-view')?.style.display === 'block') {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                if (displayCount < allTokens.length) { displayCount += 50; renderTable(); }
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
        renderTable();
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'Updated: ' + data.last_updated;
    } catch (e) { console.error("Data error:", e); }
}
