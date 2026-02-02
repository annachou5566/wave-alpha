// public/js/pro-mode.js - UI & DATA ONLY (No Admin Logic)

const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayedTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. DỌN DẸP GIAO DIỆN CŨ (Tránh lỗi 2 tab)
    const oldRoot = document.getElementById('alpha-plugin-root');
    if (oldRoot) oldRoot.remove();
    
    // Xóa lẻ tẻ nếu có
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();

    // 2. Load CSS nếu thiếu
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    // 3. Bơm HTML mới (Alpha First)
    injectHTML();

    // 4. Nếu là Admin, tự động chuyển Tab
    if (localStorage.getItem('wave_alpha_role') === 'admin') {
        window.pluginSwitchTab('alpha');
    }

    initMarket();
    setupEvents();
});

// --- UI LOGIC ---
function injectHTML() {
    const root = document.createElement('div');
    root.id = 'alpha-plugin-root';
    root.innerHTML = \`
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
                    <div class="time-badge" id="last-updated">Connecting...</div>
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
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_limit')">LIMIT</th>
                                <th class="text-end cursor-pointer border-right-dim" onclick="window.pluginSort('volume.daily_onchain')">ON-CHAIN</th>
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

window.pluginSwitchTab = (tab) => {
    // Đảm bảo tab nav luôn hiện nếu đã inject
    const nav = document.getElementById('alpha-tab-nav');
    if (nav) nav.style.display = 'flex';

    const newView = document.getElementById('alpha-market-view');
    const oldView = document.getElementById('view-dashboard'); // ID của web cũ
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

window.pluginCopy = (txt) => { 
    if(txt) {
        navigator.clipboard.writeText(txt);
        const t = document.createElement('div');
        t.innerText = 'COPIED';
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00F0FF;color:#000;padding:6px 12px;font-weight:800;font-family:sans-serif;z-index:9999;border-radius:4px;box-shadow:0 0 10px #00F0FF;';
        document.body.appendChild(t);
        setTimeout(()=>t.remove(), 1500);
    }
};

// --- DATA LOGIC ---
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
        
        // Logic Badge
        let badgesHtml = '';
        if (t.status === 'SPOT') badgesHtml += '<span class="smart-badge badge-spot">SPOT</span>';
        if (t.status === 'DELISTED') badgesHtml += '<span class="smart-badge badge-delisted">DELISTED</span>';
        if (t.listing_time && t.mul_point) {
            const diff = Math.ceil(((t.listing_time + 2592000000) - Date.now()) / 86400000);
            if (diff > 0) {
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
                badgesHtml += \`<span class="smart-badge badge-alpha">[x\${t.mul_point} \${diff}d]</span>\`;
            }
        }

        // Image Logic (API Only)
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
            <td class="text-end font-num text-white-bold">$\${formatNum(t.volume.daily_total)}</td>
            <td class="text-end font-num text-dim">$\${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-neon border-right-dim">$\${formatNum(t.volume.daily_onchain)}</td>
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
