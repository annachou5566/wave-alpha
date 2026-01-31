/* pro-mode.js - Full Feature: Sort, Contract, Logo */

const DATA_FILES = ['public/data/market-data.json', 'data/market-data.json', 'market-data.json'];
let ALL_TOKENS = [];
let VISIBLE_COUNT = 10;
const LOAD_STEP = 10;
let SORT_STATE = { col: 'volume.total', dir: 'desc' }; // Mặc định sort volume

// HTML UI
const HTML_UI = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="safeSwitch('market')">
                <i class="fas fa-chart-line"></i> ALPHA MARKET
            </button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="safeSwitch('tourney')">
                <i class="fas fa-trophy"></i> TRADING COMPETITION
            </button>
        </div>
        <div class="pm-ticker">
            <div class="pm-tick-box"><span class="pm-tick-lbl">TOTAL VOL</span><span class="pm-tick-val" id="tk-total">---</span></div>
            <div class="pm-tick-box"><span class="pm-tick-lbl">LIMIT</span><span class="pm-tick-val c-purple" id="tk-limit">---</span></div>
            <div class="pm-tick-box"><span class="pm-tick-lbl">ON-CHAIN</span><span class="pm-tick-val c-blue" id="tk-onchain">---</span></div>
        </div>
    </div>
</div>

<div id="view-market-pro">
    <div class="pm-container">
        <div class="pm-card">
            <div style="overflow-x:auto">
                <table class="pm-table">
                    <thead>
                        <tr>
                            <th onclick="sortData('name')" style="padding-left:25px; width:220px">Token <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('price')" class="text-right">Price <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('change_24h')" class="text-right">24h % <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('liquidity')" class="text-right">Liquidity <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('volume.total')" class="text-right">Total Vol <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('volume.limit')" class="text-right c-purple">Limit Vol <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('volume.onchain')" class="text-right c-blue">On-Chain <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('market_cap')" class="text-right" style="padding-right:25px">Cap <i class="fas fa-sort sort-icon"></i></th>
                        </tr>
                    </thead>
                    <tbody id="pm-body">
                        <tr><td colspan="8" style="text-align:center; padding:40px; color:#888"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pm-footer">
                <button class="btn-more" onclick="loadMore()">Show Next 10 Tokens <i class="fas fa-chevron-down"></i></button>
            </div>
        </div>
    </div>
</div>
<div id="copy-toast">Copied to clipboard!</div>
`;

// --- HÀM SORT ---
window.sortData = function(column) {
    if (SORT_STATE.col === column) {
        SORT_STATE.dir = SORT_STATE.dir === 'desc' ? 'asc' : 'desc';
    } else {
        SORT_STATE.col = column;
        SORT_STATE.dir = 'desc';
    }

    ALL_TOKENS.sort((a, b) => {
        let valA = getNested(a, column);
        let valB = getNested(b, column);
        if(typeof valA === 'string') valA = valA.toLowerCase();
        if(typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return SORT_STATE.dir === 'asc' ? -1 : 1;
        if (valA > valB) return SORT_STATE.dir === 'asc' ? 1 : -1;
        return 0;
    });

    VISIBLE_COUNT = 10; // Reset về trang đầu
    renderTable();
    updateSortIcons();
};

function getNested(obj, path) {
    return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj);
}

function updateSortIcons() {
    document.querySelectorAll('.pm-table th').forEach(th => {
        th.classList.remove('active-sort');
        const icon = th.querySelector('.sort-icon');
        if(icon) icon.className = 'fas fa-sort sort-icon';
    });
    // Highlight cột active
    const map = ['name','price','change_24h','liquidity','volume.total','volume.limit','volume.onchain','market_cap'];
    const headers = document.querySelectorAll('.pm-table th');
    const idx = map.indexOf(SORT_STATE.col);
    if(idx >= 0 && headers[idx]) {
        headers[idx].classList.add('active-sort');
        headers[idx].querySelector('.sort-icon').className = SORT_STATE.dir === 'desc' ? 'fas fa-sort-down sort-icon' : 'fas fa-sort-up sort-icon';
    }
}

// --- HÀM COPY CONTRACT ---
window.copyContract = function(addr, symbol) {
    if(!addr) return;
    navigator.clipboard.writeText(addr);
    const toast = document.getElementById('copy-toast');
    toast.innerText = `Copied ${symbol} Contract!`;
    toast.classList.add('show-toast');
    setTimeout(() => toast.classList.remove('show-toast'), 2000);
};

// --- INIT ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    if (isAdmin) localStorage.setItem('wave_alpha_admin', 'true');
    else { document.body.innerHTML = '<h1 style="color:#fff;text-align:center;margin-top:20%">MAINTENANCE</h1>'; return; }

    const navbar = document.querySelector('.navbar');
    if (navbar && !document.getElementById('pm-toolbar')) {
        navbar.insertAdjacentHTML('afterend', HTML_UI);
    } else if (!document.getElementById('pm-toolbar')) {
        document.body.insertAdjacentHTML('afterbegin', HTML_UI);
    }

    safeSwitch('market');
    fetchData();
})();

async function fetchData() {
    let data = null;
    const ts = Date.now();
    for (let p of DATA_FILES) {
        try {
            let res = await fetch(`${p}?v=${ts}`);
            if (res.ok) { data = await res.json(); break; }
        } catch(e){}
    }

    if (!data) return;

    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    if(data.global_stats) {
        document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h);
        document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume);
        document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume);
    }

    ALL_TOKENS = (data.tokens || []).sort((a,b) => (b.volume?.total || 0) - (a.volume?.total || 0));
    renderTable();
    updateSortIcons();
}

function renderTable() {
    const tbody = document.getElementById('pm-body');
    if(!tbody) return;
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    let html = '';
    
    ALL_TOKENS.slice(0, VISIBLE_COUNT).forEach(t => {
        const p = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;
        
        // Render Contract Rút gọn
        const shortContract = t.contract ? `${t.contract.substring(0,6)}...${t.contract.substring(t.contract.length-4)}` : '';
        const contractHtml = t.contract 
            ? `<div class="token-contract" onclick="event.stopPropagation(); copyContract('${t.contract}', '${t.symbol}')">${shortContract} <i class="far fa-copy"></i></div>` 
            : '';

        html += `
        <tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px">
                <div class="td-token">
                    <img src="${t.icon}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                    <div class="token-info">
                        <div class="token-symbol">${t.symbol}</div>
                        ${contractHtml}
                    </div>
                </div>
            </td>
            <td class="text-right" style="font-weight:700">$${p}</td>
            <td class="text-right ${cls}">${sign}${t.change_24h.toFixed(2)}%</td>
            <td class="text-right" style="color:#ddd">${fmt(t.liquidity || 0)}</td>
            <td class="text-right" style="font-weight:700; color:#fff">${fmt(t.volume?.total || 0)}</td>
            <td class="text-right c-purple">${fmt(t.volume?.limit || 0)}</td>
            <td class="text-right c-blue">${fmt(t.volume?.onchain || 0)}</td>
            <td class="text-right" style="padding-right:25px;color:#888">${fmt(t.market_cap || 0)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    
    const btn = document.querySelector('.btn-more');
    if(btn) btn.style.display = (VISIBLE_COUNT >= ALL_TOKENS.length) ? 'none' : 'inline-block';
}

window.loadMore = function() {
    const btn = document.querySelector('.btn-more');
    btn.innerHTML = 'Loading...';
    setTimeout(() => { VISIBLE_COUNT += LOAD_STEP; renderTable(); btn.innerHTML = 'Show Next 10 Tokens <i class="fas fa-chevron-down"></i>'; }, 100);
}

window.safeSwitch = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    const oldView = document.getElementById('view-dashboard');
    if (mode === 'market') {
        marketView.style.display = 'block';
        oldView.style.display = 'none';
        document.querySelectorAll('.hero-banner, .command-deck').forEach(e => e.style.display = 'none');
        document.getElementById('btn-tab-market').classList.add('active');
        document.getElementById('btn-tab-tourney').classList.remove('active');
    } else {
        marketView.style.display = 'none';
        oldView.style.display = 'block';
        document.querySelectorAll('.hero-banner, .command-deck').forEach(e => e.style.display = 'block');
        document.getElementById('btn-tab-market').classList.remove('active');
        document.getElementById('btn-tab-tourney').classList.add('active');
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};