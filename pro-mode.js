/* pro-mode.js - SEARCH MOVED TO MARKET TAB */

// --- 1. CHECK BẢO TRÌ ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    if (!isAdmin) {
        document.body.innerHTML = `<div class="maint-box"><div class="spinner"></div><div class="maint-title">SYSTEM MAINTENANCE</div></div>`;
        throw new Error("Maintenance Mode");
    } else { localStorage.setItem('wave_alpha_admin', 'true'); }
})();

// --- 2. CONFIG & STATE ---
const DATA_FILES = ['public/data/market-data.json', 'market-data.json'];
let ALL_TOKENS = [];
let FILTERED_TOKENS = [];
let VISIBLE_COUNT = 10;
let SORT_STATE = { col: 'volume.total', dir: 'desc' };
let PINNED_SYMBOLS = JSON.parse(localStorage.getItem('alpha_pinned') || '[]');

// --- 3. UI INJECTION ---
const HTML_UI = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="safeSwitch('market')">ALPHA MARKET</button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="safeSwitch('tourney')">COMPETITION</button>
        </div>
        <div class="pm-ticker">
            <div style="text-align:right">
                <div style="font-size:10px;color:#888;letter-spacing:1px">TOTAL VOL</div>
                <div style="font-size:16px;font-weight:700;color:#fff" id="tk-total">---</div>
            </div>
        </div>
    </div>
</div>

<div id="view-market-pro">
    <div class="pm-container">
        
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
            <div class="pm-search-wrapper">
                <i class="fas fa-search search-icon-inside"></i>
                <input type="text" id="pm-search" class="pm-search-input" placeholder="Search Token / Contract..." oninput="handleSearch(this.value)">
            </div>
        </div>

        <div class="pm-card">
            <div style="overflow-x:auto">
                <table class="pm-table">
                    <thead>
                        <tr>
                            <th onclick="sortData('symbol')" style="padding-left:25px;width:240px">Token <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('price')">Price <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('change_24h')">24h % <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('liquidity')">Liquidity <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('volume.total')">Total Vol <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('volume.limit')" class="c-purple">Limit Vol <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('volume.onchain')" class="c-blue">On-Chain <i class="fas fa-sort sort-icon"></i></th>
                            <th onclick="sortData('market_cap')" style="padding-right:25px">Cap <i class="fas fa-sort sort-icon"></i></th>
                        </tr>
                    </thead>
                    <tbody id="pm-body">
                        <tr><td colspan="8" style="text-align:center;padding:40px;color:#888"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pm-footer" style="text-align:center;padding:20px">
                <button class="btn-more" onclick="loadMore()">Show Next 10 Tokens</button>
            </div>
        </div>
    </div>
</div>
<div id="copy-toast">Copied!</div>
`;

const navbar = document.querySelector('.navbar');
if (navbar && !document.getElementById('pm-toolbar')) { navbar.insertAdjacentHTML('afterend', HTML_UI); }

// --- 4. FUNCTIONS ---

window.safeSwitch = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');
    const oldView = document.getElementById('view-dashboard');
    const extras = document.querySelectorAll('.hero-banner, .command-deck, .stats-row');

    if (mode === 'market') {
        if(marketView) marketView.style.display = 'block';
        if(oldView) oldView.style.display = 'none';
        extras.forEach(e => e.style.display = 'none');
        if(btnM) btnM.classList.add('active');
        if(btnT) btnT.classList.remove('active');
    } else {
        if(marketView) marketView.style.display = 'none';
        if(oldView) oldView.style.display = 'block';
        extras.forEach(e => e.style.display = 'block');
        if(btnM) btnM.classList.remove('active');
        if(btnT) btnT.classList.add('active');
    }
};

// SEARCH
window.handleSearch = function(val) {
    const query = val.toLowerCase().trim();
    if (!query) {
        FILTERED_TOKENS = [...ALL_TOKENS];
    } else {
        FILTERED_TOKENS = ALL_TOKENS.filter(t => 
            t.symbol.toLowerCase().includes(query) || 
            (t.name && t.name.toLowerCase().includes(query)) ||
            (t.contract && t.contract.toLowerCase().includes(query))
        );
    }
    VISIBLE_COUNT = 10;
    sortInternal(); 
    renderTable();
};

// PIN
window.togglePin = function(e, symbol) {
    e.stopPropagation();
    if (PINNED_SYMBOLS.includes(symbol)) {
        PINNED_SYMBOLS = PINNED_SYMBOLS.filter(s => s !== symbol);
    } else {
        PINNED_SYMBOLS.push(symbol);
    }
    localStorage.setItem('alpha_pinned', JSON.stringify(PINNED_SYMBOLS));
    renderTable();
};

// SORT
window.sortData = function(column) {
    if (SORT_STATE.col === column) { SORT_STATE.dir = SORT_STATE.dir === 'desc' ? 'asc' : 'desc'; } 
    else { SORT_STATE.col = column; SORT_STATE.dir = 'desc'; }
    
    document.querySelectorAll('.pm-table th').forEach(th => {
        th.classList.remove('active-sort');
        if(th.innerText.toLowerCase().includes(column.split('.')[0])) th.classList.add('active-sort');
    });

    sortInternal();
    renderTable();
};

function sortInternal() {
    FILTERED_TOKENS.sort((a, b) => {
        let valA = SORT_STATE.col.split('.').reduce((o, i) => (o ? o[i] : 0), a);
        let valB = SORT_STATE.col.split('.').reduce((o, i) => (o ? o[i] : 0), b);
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (SORT_STATE.dir === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });
}

window.copyContract = function(addr, symbol) {
    navigator.clipboard.writeText(addr).then(() => {
        const toast = document.getElementById('copy-toast');
        toast.innerText = `Copied ${symbol}`;
        toast.classList.add('show-toast');
        setTimeout(() => toast.classList.remove('show-toast'), 2000);
    });
};

window.loadMore = function() { VISIBLE_COUNT += 10; renderTable(); };

function renderTable() {
    const tbody = document.getElementById('pm-body');
    if(!tbody) return;
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n || 0);
    
    // Logic hiển thị: Pinned lên đầu
    const pinned = FILTERED_TOKENS.filter(t => PINNED_SYMBOLS.includes(t.symbol));
    const others = FILTERED_TOKENS.filter(t => !PINNED_SYMBOLS.includes(t.symbol));
    const displayList = [...pinned, ...others].slice(0, VISIBLE_COUNT);

    let html = '';
    displayList.forEach(t => {
        const isPinned = PINNED_SYMBOLS.includes(t.symbol);
        const p = t.price < 1 ? (t.price || 0).toFixed(6) : (t.price || 0).toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        
        const link = `https://www.binance.com/en/alpha/${t.id ? t.id.replace('ALPHA_','') : ''}`;
        const chainImg = t.chain_icon ? `<img src="${t.chain_icon}" class="chain-icon-sub" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : '';
        const logoUrl = t.icon || 'assets/tokens/default.png';

        // Badge Logic
        let statusBadge = '';
        if (t.status === 'SPOT') statusBadge = '<span class="badge bd-spot">SPOT</span>';
        else if (t.status === 'DELISTED') statusBadge = '<span class="badge bd-delist">DELISTED</span>';
        
        let mulBadge = '';
        if (t.listing_time > 0) {
            const daysLeft = Math.ceil(((t.listing_time + (30*86400000)) - Date.now()) / 86400000);
            if (daysLeft > 0 && t.mul_point >= 2) {
                const isGold = (t.chain === 'BSC' && t.mul_point >= 4);
                mulBadge = `<span class="badge ${isGold || t.mul_point >= 4 ? 'bd-4x' : 'bd-2x'}">${t.mul_point}x<span class="bd-time">${daysLeft}d</span></span>`;
            }
        }

        html += `
        <tr onclick="window.open('${link}', '_blank')" class="${isPinned ? 'pinned-row' : ''}" style="cursor:pointer">
            <td style="padding-left:15px">
                <div class="td-token">
                    <i class="fas fa-star btn-pin ${isPinned ? 'active' : ''}" onclick="togglePin(event, '${t.symbol}')" title="Pin/Unpin"></i>
                    <div class="logo-wrapper">
                        <img src="${logoUrl}" class="token-icon-main" referrerpolicy="no-referrer" onerror="this.src='assets/tokens/default.png'">
                        ${chainImg}
                    </div>
                    <div>
                        <div class="token-symbol">${t.symbol} ${statusBadge} ${mulBadge}</div>
                        <div class="token-contract" onclick="event.stopPropagation(); copyContract('${t.contract}', '${t.symbol}')">
                            ${t.contract ? t.contract.substring(0,6)+'...'+t.contract.slice(-4) : ''} <i class="far fa-copy"></i>
                        </div>
                    </div>
                </div>
            </td>
            <td style="font-weight:700">$${p}</td>
            <td class="${cls}">${sign}${(t.change_24h||0).toFixed(2)}%</td>
            <td style="color:#aaa">${fmt(t.liquidity)}</td>
            <td style="font-weight:700;color:#fff">${fmt(t.volume?.total)}</td>
            <td class="c-purple">${fmt(t.volume?.limit)}</td>
            <td class="c-blue">${fmt(t.volume?.onchain)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:40px;color:#888">No data available.</td></tr>';
    
    const btn = document.querySelector('.btn-more');
    if(btn) btn.style.display = (VISIBLE_COUNT >= FILTERED_TOKENS.length) ? 'none' : 'inline-block';
}

// --- 5. INIT ---
window.safeSwitch('market');
fetch(`${DATA_FILES[0]}?v=${Date.now()}`).then(r => r.json()).then(data => {
    if(data.global_stats) document.getElementById('tk-total').innerText = '$' + parseInt(data.global_stats.total_volume_24h).toLocaleString();
    ALL_TOKENS = data.tokens || [];
    FILTERED_TOKENS = [...ALL_TOKENS];
    renderTable();
}).catch(e => console.log(e));
