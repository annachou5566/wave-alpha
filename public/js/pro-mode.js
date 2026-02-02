// public/js/pro-mode.js
const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('alpha-plugin-root')?.remove();
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();

    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    injectHTML();

    if (localStorage.getItem('wave_alpha_role') === 'admin') {
        window.pluginSwitchTab('alpha');
    }

    initMarket();
    setupEvents();
});

window.pluginSwitchTab = (tab) => {
    const nav = document.getElementById('alpha-tab-nav');
    if (nav) nav.style.display = 'flex';

    const newView = document.getElementById('alpha-market-view');
    const oldView = document.getElementById('view-dashboard');
    const btnA = document.getElementById('btn-tab-alpha');
    const btnC = document.getElementById('btn-tab-competition');

    if (tab === 'alpha') {
        if(newView) newView.style.display = 'block';
        if(oldView) oldView.style.display = 'none';
        btnA?.classList.add('active'); 
        btnC?.classList.remove('active');
    } else {
        if(newView) newView.style.display = 'none';
        if(oldView) oldView.style.display = 'block';
        btnC?.classList.add('active'); 
        btnA?.classList.remove('active');
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
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00F0FF;color:#000;padding:6px 12px;font-weight:800;border-radius:4px;z-index:999999;box-shadow:0 0 10px #00F0FF;font-family:sans-serif;';
        document.body.appendChild(t);
        setTimeout(()=>t.remove(), 1500);
    }
};

function injectHTML() {
    const root = document.createElement('div');
    root.id = 'alpha-plugin-root';
    // Đã sửa lỗi syntax ở đây
    root.innerHTML = `
        <div id="alpha-tab-nav" style="display:none">
            <button id="btn-tab-alpha" class="tab-btn active" onclick="window.pluginSwitchTab('alpha')">
                <i class="fas fa-layer-group" style="margin-right:6px"></i> ALPHA MARKET <span class="badge-pro" style="margin-left:6px">PRO</span>
            </button>
            <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">
                <i class="fas fa-trophy" style="margin-right:6px"></i> COMPETITION
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
    `;
    document.body.appendChild(root);
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

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // ... (Giữ nguyên phần lọc list và sort)

    list.slice(0, displayCount).forEach((t, i) => {
        const tr = document.createElement('tr');
        const now = Date.now();
        let badgesHtml = '';
        
        // 1. Logic SPOT / DELISTED
        if (t.offline === true) {
            if (t.listingCex === true) {
                badgesHtml += '<span class="smart-badge badge-spot">SPOT</span>';
            } else {
                badgesHtml += '<span class="smart-badge badge-delisted">DELISTED</span>';
            }
        }

        // 2. Logic Multiplier Badge [xN Yd]
        // Yd = (listing_time + 30 ngày) - current_time
        if (t.listing_time && t.mul_point) {
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const expiryTime = t.listing_time + thirtyDaysMs;
            const diffDays = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                badgesHtml += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${diffDays}d]</span>`;
                
                // Hiệu ứng Glow: Hệ BSC và mul_point >= 4
                if (t.chain === 'BSC' && t.mul_point >= 4) {
                    tr.classList.add('glow-row');
                }
            }
        }

        const tokenImg = t.icon || 'assets/tokens/default.png';
        const chainImg = t.chain_icon || ''; // Icon mạng lưới

        tr.innerHTML = `
            <td class="text-center font-num text-secondary">${i + 1}</td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenImg}" class="token-logo" onerror="this.src='assets/tokens/default.png'">
                        ${chainImg ? `<img src="${chainImg}" class="chain-badge">` : ''}
                    </div>
                    <div class="token-meta">
                        <div class="symbol-row" onclick="window.pluginCopy('${t.contract}')" title="Click to copy contract">
                            <span class="symbol-text">${t.symbol}</span>
                            <i class="fas fa-copy copy-icon" style="font-size: 10px; margin-left: 4px; opacity: 0.5;"></i>
                        </div>
                        <div class="badge-row">${badgesHtml}</div>
                    </div>
                </div>
            </td>
            <td class="text-end font-num">
                <div class="text-white-bold">$${formatPrice(t.price)}</div>
                <div style="font-size:11px" class="${t.change_24h >= 0 ? 'text-green' : 'text-red'}">
                    ${t.change_24h >= 0 ? '+' : ''}${t.change_24h}%
                </div>
            </td>
            <td class="text-end font-num text-white-bold">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end font-num text-dim">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-neon border-right-dim">$${formatNum(t.volume.daily_onchain)}</td>
            <td class="text-end font-num text-white">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num text-secondary">${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-brand">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatNum(n) { if (!n) return '0'; if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k'; return n.toFixed(2); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }
function setupEvents() { document.getElementById('alpha-search')?.addEventListener('keyup', () => renderTable()); window.addEventListener('scroll', () => { if (document.getElementById('alpha-market-view')?.style.display === 'block') { if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) { if (displayCount < allTokens.length) { displayCount += 50; renderTable(); } } } }); }