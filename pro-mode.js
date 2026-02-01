/* pro-mode.js - PHASE 1: DAILY VOL INTEGRATED */

// 1. MAINT CHECK
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    if (!isAdmin) {
        document.body.innerHTML = `<div class="maint-box"><div class="spinner" style="margin-bottom:20px"></div><div style="color:#fff;font-weight:bold;font-size:24px">SYSTEM MAINTENANCE</div></div>`;
        throw new Error("Maintenance Mode");
    } else { localStorage.setItem('wave_alpha_admin', 'true'); }
})();

// 2. CONFIG
const DATA_FILES = ['public/data/market-data.json', 'market-data.json'];
let ALL_TOKENS = [];
let FILTERED_TOKENS = [];
let VISIBLE_COUNT = 10;
let SORT_STATE = { col: 'volume.total', dir: 'desc' };
let PINNED_SYMBOLS = JSON.parse(localStorage.getItem('alpha_pinned') || '[]');

// 3. UI INJECTION
const HTML_UI = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container" style="display:flex;justify-content:space-between;align-items:center">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="safeSwitch('market')">ALPHA MARKET</button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="safeSwitch('tourney')">COMPETITION</button>
        </div>
        <div style="text-align:right; display:flex; gap:20px">
            <div>
                <div style="font-size:10px;color:#888;letter-spacing:1px">TOTAL VOL (24H)</div>
                <div style="font-size:16px;font-weight:700;color:#fff" id="tk-total">---</div>
            </div>
            <div style="border-left:1px solid #333; padding-left:20px">
                <div style="font-size:10px;color:#F0B90B;letter-spacing:1px">DAILY VOL (UTC)</div>
                <div style="font-size:16px;font-weight:700;color:#F0B90B" id="tk-daily">---</div>
            </div>
        </div>
    </div>
</div>

<div id="view-market-pro">
    <div class="pm-container">
        <div class="pm-controls-row">
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
                            <th onclick="sortData('symbol')" style="padding-left:25px;width:240px">Token <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('price')">Price <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('change_24h')">24h % <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.daily')" style="color:#F0B90B">Daily Vol <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.total')">Total Vol <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.limit')" class="c-purple">Limit Vol <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.onchain')" class="c-blue">On-Chain <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('market_cap')" style="padding-right:25px">Cap <i class="fas fa-sort"></i></th>
                        </tr>
                    </thead>
                    <tbody id="pm-body">
                        <tr><td colspan="8" style="text-align:center;padding:40px;color:#888"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            <div style="text-align:center;padding:20px">
                <button class="btn-more" onclick="loadMore()">Show Next 10 Tokens</button>
            </div>
        </div>
    </div>
</div>
<div id="copy-toast">Copied!</div>
`;

const navbar = document.querySelector('.navbar');
if (navbar && !document.getElementById('pm-toolbar')) { navbar.insertAdjacentHTML('afterend', HTML_UI); }

// 4. LOGIC
window.safeSwitch = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    const oldView = document.getElementById('view-dashboard');
    const extras = document.querySelectorAll('.hero-banner, .command-deck, .stats-row');
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');

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

window.handleSearch = function(val) {
    const q = val.toLowerCase().trim();
    FILTERED_TOKENS = !q ? [...ALL_TOKENS] : ALL_TOKENS.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.contract && t.contract.toLowerCase().includes(q))
    );
    VISIBLE_COUNT = 10;
    sortInternal();
    renderTable();
};

window.togglePin = function(e, s) {
    e.stopPropagation();
    PINNED_SYMBOLS = PINNED_SYMBOLS.includes(s) ? PINNED_SYMBOLS.filter(x => x !== s) : [...PINNED_SYMBOLS, s];
    localStorage.setItem('alpha_pinned', JSON.stringify(PINNED_SYMBOLS));
    renderTable();
};

window.sortData = function(col) {
    if(SORT_STATE.col === col) SORT_STATE.dir = SORT_STATE.dir === 'desc' ? 'asc' : 'desc';
    else { SORT_STATE.col = col; SORT_STATE.dir = 'desc'; }
    sortInternal();
    renderTable();
};

function sortInternal() {
    FILTERED_TOKENS.sort((a,b) => {
        let vA = SORT_STATE.col.split('.').reduce((o,i)=>o?o[i]:0, a);
        let vB = SORT_STATE.col.split('.').reduce((o,i)=>o?o[i]:0, b);
        if(typeof vA==='string') vA=vA.toLowerCase();
        return SORT_STATE.dir==='asc' ? (vA>vB?1:-1) : (vA<vB?1:-1);
    });
}

window.copyContract = function(addr, sym) {
    navigator.clipboard.writeText(addr).then(() => {
        const t = document.getElementById('copy-toast');
        t.innerText = `Copied ${sym}`;
        t.classList.add('show-toast');
        setTimeout(()=>t.classList.remove('show-toast'), 2000);
    });
};

window.loadMore = function() { VISIBLE_COUNT += 10; renderTable(); };

function renderTable() {
    const tbody = document.getElementById('pm-body');
    if(!tbody) return;
    const fmt = n => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n||0);
    
    const pinned = FILTERED_TOKENS.filter(t => PINNED_SYMBOLS.includes(t.symbol));
    const others = FILTERED_TOKENS.filter(t => !PINNED_SYMBOLS.includes(t.symbol));
    const list = [...pinned, ...others].slice(0, VISIBLE_COUNT);

    let html = '';
    list.forEach(t => {
        const isPinned = PINNED_SYMBOLS.includes(t.symbol);
        const p = t.price < 1 ? (t.price||0).toFixed(6) : (t.price||0).toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const link = `https://www.binance.com/en/alpha/${t.id ? t.id.replace('ALPHA_','') : ''}`;
        
        // Badge Logic
        let badges = '';
        if(t.status === 'SPOT') badges += '<span class="badge bd-spot">SPOT</span> ';
        else if(t.status === 'DELISTED') badges += '<span class="badge bd-delist">DELISTED</span> ';
        
        if(t.listing_time > 0) {
            const days = Math.ceil(((t.listing_time + 30*86400000) - Date.now())/86400000);
            if(days > 0 && t.mul_point >= 2) {
                const isGold = (t.chain==='BSC' && t.mul_point >= 4);
                const bdCls = (isGold || t.mul_point >= 4) ? 'bd-4x' : 'bd-2x';
                badges += `<span class="badge ${bdCls}">x${t.mul_point}<span class="bd-time">${days}d</span></span>`;
            }
        }

        html += `
        <tr onclick="window.open('${link}','_blank')" class="${isPinned?'pinned-row':''}" style="cursor:pointer">
            <td style="padding-left:15px">
                <div class="td-token">
                    <i class="fas fa-star btn-pin ${isPinned?'active' : ''}" onclick="togglePin(event,'${t.symbol}')"></i>
                    <div class="logo-wrapper">
                        <img src="${t.icon||'assets/tokens/default.png'}" class="token-icon-main" referrerpolicy="no-referrer">
                        ${t.chain_icon ? `<img src="${t.chain_icon}" class="chain-icon-sub" referrerpolicy="no-referrer">` : ''}
                    </div>
                    <div>
                        <div class="token-symbol">${t.symbol} ${badges}</div>
                        <div class="token-contract" onclick="event.stopPropagation();copyContract('${t.contract}','${t.symbol}')">
                            ${t.contract ? t.contract.substring(0,6)+'...'+t.contract.slice(-4) : ''} <i class="far fa-copy"></i>
                        </div>
                    </div>
                </div>
            </td>
            <td style="font-weight:700">$${p}</td>
            <td class="${cls}">${t.change_24h>=0?'+':''}${(t.change_24h||0).toFixed(2)}%</td>
            
            <td style="color:#F0B90B;font-weight:700">${fmt(t.volume?.daily)}</td>
            
            <td style="font-weight:700;color:#fff">${fmt(t.volume?.total)}</td>
            <td class="c-purple">${fmt(t.volume?.limit)}</td>
            <td class="c-blue">${fmt(t.volume?.onchain)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:40px;color:#888">No data found</td></tr>';
    document.querySelector('.btn-more').style.display = (VISIBLE_COUNT >= FILTERED_TOKENS.length) ? 'none' : 'block';
}

// 5. INIT
window.safeSwitch('market');
fetch(`${DATA_FILES[0]}?v=${Date.now()}`).then(r=>r.json()).then(data=>{
    if(data.global_stats) {
        document.getElementById('tk-total').innerText = '$'+parseInt(data.global_stats.total_volume_24h).toLocaleString();
        if(document.getElementById('tk-daily')) {
            document.getElementById('tk-daily').innerText = '$'+parseInt(data.global_stats.total_volume_daily || 0).toLocaleString();
        }
    }
    ALL_TOKENS = data.tokens || [];
    FILTERED_TOKENS = [...ALL_TOKENS];
    renderTable();
});
