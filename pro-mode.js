/* pro-mode.js - Final Clean UI */

const DATA_FILES = ['public/data/market-data.json', 'data/market-data.json', 'market-data.json'];
let ALL_TOKENS = [];
let VISIBLE_COUNT = 10;
const LOAD_STEP = 10;
let SORT_STATE = { col: 'volume.total', dir: 'desc' };

/* --- HELPER: CHỌN MÀU HỆ --- */
function getChainClass(chainName) {
    if (!chainName || chainName === 'UNK') return 'chain-UNK';
    const c = chainName.toUpperCase();
    if (c.includes('BSC') || c.includes('BINANCE')) return 'chain-BSC';
    if (c.includes('ETH')) return 'chain-ETH';
    if (c.includes('SOL')) return 'chain-SOL';
    if (c.includes('ARB')) return 'chain-ARB';
    if (c.includes('BASE')) return 'chain-BASE';
    if (c.includes('MATIC') || c.includes('POLY')) return 'chain-MATIC';
    return 'chain-UNK';
}

window.safeSwitch = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    const oldView = document.getElementById('view-dashboard');
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');
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
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};

window.sortData = function(column) {
    if (SORT_STATE.col === column) {
        SORT_STATE.dir = SORT_STATE.dir === 'desc' ? 'asc' : 'desc';
    } else {
        SORT_STATE.col = column;
        SORT_STATE.dir = 'desc';
    }
    ALL_TOKENS.sort((a, b) => {
        let valA = column.split('.').reduce((o, i) => (o ? o[i] : 0), a);
        let valB = column.split('.').reduce((o, i) => (o ? o[i] : 0), b);
        if(typeof valA === 'string') valA = valA.toLowerCase();
        if(typeof valB === 'string') valB = valB.toLowerCase();
        return SORT_STATE.dir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    VISIBLE_COUNT = 10;
    renderTable();
    updateSortIcons();
};

window.copyContract = function(addr, symbol) {
    if(!addr) return;
    navigator.clipboard.writeText(addr);
    const toast = document.getElementById('copy-toast');
    if(toast) {
        toast.innerText = `Copied ${symbol} Contract!`;
        toast.classList.add('show-toast');
        setTimeout(() => toast.classList.remove('show-toast'), 2000);
    }
};

window.loadMore = function() {
    const btn = document.querySelector('.btn-more');
    if(btn) btn.innerHTML = 'Loading...';
    setTimeout(() => {
        VISIBLE_COUNT += LOAD_STEP;
        renderTable();
        if(btn) btn.innerHTML = 'Show Next 10 Tokens <i class="fas fa-chevron-down"></i>';
    }, 150);
};

function updateSortIcons() {
    document.querySelectorAll('.pm-table th .sort-icon').forEach(icon => {
        icon.className = 'fas fa-sort sort-icon';
        icon.parentElement.classList.remove('active-sort');
    });
    const map = ['name','price','change_24h','liquidity','volume.total','volume.limit','volume.onchain','market_cap'];
    const idx = map.indexOf(SORT_STATE.col);
    const headers = document.querySelectorAll('.pm-table th');
    if(idx >= 0 && headers[idx]) {
        headers[idx].classList.add('active-sort');
        headers[idx].querySelector('.sort-icon').className = SORT_STATE.dir === 'desc' ? 'fas fa-sort-down sort-icon' : 'fas fa-sort-up sort-icon';
    }
}

function renderTable() {
    const tbody = document.getElementById('pm-body');
    if(!tbody) return;
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n || 0);
    let html = '';
    
    ALL_TOKENS.slice(0, VISIBLE_COUNT).forEach(t => {
        const p = t.price < 1 ? (t.price || 0).toFixed(6) : (t.price || 0).toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const alphaIdClean = t.id ? t.id.replace('ALPHA_','') : '';
        const link = `https://www.binance.com/en/alpha/${alphaIdClean}`;
        const logoUrl = t.icon || 'assets/tokens/default.png';
        const shortContract = t.contract ? `${t.contract.substring(0,6)}...${t.contract.substring(t.contract.length-4)}` : '';
        const contractHtml = t.contract ? `<div class="token-contract" onclick="event.stopPropagation(); copyContract('${t.contract}', '${t.symbol}')">${shortContract} <i class="far fa-copy"></i></div>` : '';

        // --- BADGE RENDER ---
        
        // 1. Hệ (Chain): Nhỏ, trước tên
        const chainName = t.chain && t.chain !== 'UNK' ? t.chain : '';
        let chainHtml = chainName ? `<span class="badge ${getChainClass(chainName)}">${chainName}</span>` : '';

        // 2. Status (Spot/Delisted): Nhỏ, sau tên
        let statusHtml = '';
        if (t.status === 'SPOT') statusHtml = `<span class="badge bd-spot">SPOT</span>`;
        else if (t.status === 'DELISTED') statusHtml = `<span class="badge bd-delist">DELISTED</span>`;

        // 3. Multiplier (4x 19d): Nhỏ, sau tên
        let mulHtml = '';
        if (t.listing_time > 0) {
            const now = Date.now();
            const expiry = t.listing_time + (30 * 24 * 60 * 60 * 1000);
            const diff = expiry - now;
            const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

            if (daysLeft > 0 && t.mul_point >= 2) {
                const isBSC4x = (t.chain === 'BSC' && t.mul_point >= 4);
                let cls = isBSC4x ? 'bd-4x' : (t.mul_point >= 4 ? 'bd-4x' : 'bd-2x'); // 4x có viền, 2x thường
                // Format: "4x 19d"
                mulHtml = `<span class="badge ${cls}">${t.mul_point}x<span class="bd-time">${daysLeft}d</span></span>`;
            }
        }

        html += `
        <tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px">
                <div class="td-token">
                    <img src="${logoUrl}" class="token-icon" referrerpolicy="no-referrer" onerror="this.src='assets/tokens/default.png'">
                    <div class="token-info">
                        <div class="token-symbol">
                            ${chainHtml} ${t.symbol || '???'} ${statusHtml} ${mulHtml}
                        </div>
                        ${contractHtml}
                    </div>
                </div>
            </td>
            <td class="text-right" style="font-weight:700">$${p}</td>
            <td class="text-right ${cls}">${sign}${(t.change_24h || 0).toFixed(2)}%</td>
            <td class="text-right" style="color:#ddd">${fmt(t.liquidity)}</td>
            <td class="text-right" style="font-weight:700; color:#fff">${fmt(t.volume?.total)}</td>
            <td class="text-right c-purple">${fmt(t.volume?.limit)}</td>
            <td class="text-right c-blue">${fmt(t.volume?.onchain)}</td>
            <td class="text-right" style="padding-right:25px;color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:20px">No data matches.</td></tr>';
    
    const btn = document.querySelector('.btn-more');
    if(btn) btn.style.display = (VISIBLE_COUNT >= ALL_TOKENS.length) ? 'none' : 'inline-block';
}

const HTML_UI = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="safeSwitch('market')">ALPHA MARKET</button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="safeSwitch('tourney')">COMPETITION</button>
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
                            <th onclick="sortData('symbol')" style="padding-left:25px; width:220px">Token <i class="fas fa-sort sort-icon"></i></th>
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
                        <tr><td colspan="8" style="text-align:center; padding:40px; color:#888"><i class="fas fa-circle-notch fa-spin"></i> Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pm-footer">
                <button class="btn-more" onclick="loadMore()">Show Next 10 Tokens</button>
            </div>
        </div>
    </div>
</div>
<div id="copy-toast">Copied to clipboard!</div>
`;

(function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    if (!isAdmin) {
        document.body.innerHTML = `
            <div class="maint-box">
                <div class="spinner"></div>
                <div class="maint-title">SYSTEM MAINTENANCE</div>
                <div class="maint-desc">Optimizing Alpha Market engine. Please check back shortly.</div>
            </div>`;
        return; 
    }
    localStorage.setItem('wave_alpha_admin', 'true');
    const navbar = document.querySelector('.navbar');
    if (navbar && !document.getElementById('pm-toolbar')) { navbar.insertAdjacentHTML('afterend', HTML_UI); }
    else if (!document.getElementById('pm-toolbar')) { document.body.insertAdjacentHTML('afterbegin', HTML_UI); }
    window.safeSwitch('market');
    const ts = Date.now();
    let loaded = false;
    const tryLoad = async (path) => {
        if(loaded) return;
        try {
            const res = await fetch(`${path}?v=${ts}`);
            if(res.ok) {
                const data = await res.json();
                const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n || 0);
                if(data.global_stats) {
                    document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h);
                    document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume);
                    document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume);
                }
                ALL_TOKENS = (data.tokens || []).sort((a,b) => (b.volume?.total || 0) - (a.volume?.total || 0));
                renderTable();
                updateSortIcons();
                loaded = true;
            }
        } catch(e){}
    };
    DATA_FILES.forEach(path => tryLoad(path));
})();
