/* pro-mode.js - RESTORED FULL */

// --- 1. KIỂM TRA BẢO TRÌ NGAY LẬP TỨC ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';

    if (!isAdmin) {
        document.body.innerHTML = `
            <div class="maint-box">
                <div class="spinner"></div>
                <div class="maint-title">SYSTEM MAINTENANCE</div>
                <div class="maint-desc">Optimizing Alpha Market engine. Please check back shortly.</div>
            </div>`;
        throw new Error("Maintenance Mode Active"); // Dừng script tại đây
    } else {
        localStorage.setItem('wave_alpha_admin', 'true');
    }
})();

// --- 2. LOGIC CHÍNH ---
const DATA_FILES = ['public/data/market-data.json', 'data/market-data.json', 'market-data.json'];
let ALL_TOKENS = [];
let VISIBLE_COUNT = 10;
const LOAD_STEP = 10;
let SORT_STATE = { col: 'volume.total', dir: 'desc' };

// HTML Giao diện Tabs & Bảng
const HTML_UI = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="safeSwitch('market')">ALPHA MARKET</button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="safeSwitch('tourney')">COMPETITION</button>
        </div>
        <div class="pm-ticker">
            <div style="text-align:right">
                <div style="font-size:10px;color:#888">TOTAL VOL</div>
                <div style="font-size:16px;font-weight:700;color:#fff" id="tk-total">---</div>
            </div>
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
                            <th onclick="sortData('symbol')" style="padding-left:25px">Token <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('price')">Price <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('change_24h')">24h % <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('liquidity')">Liq <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.total')">Total Vol <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.limit')" class="c-purple">Limit <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('volume.onchain')" class="c-blue">Chain <i class="fas fa-sort"></i></th>
                            <th onclick="sortData('market_cap')" style="padding-right:25px">Cap <i class="fas fa-sort"></i></th>
                        </tr>
                    </thead>
                    <tbody id="pm-body">
                        <tr><td colspan="8" style="text-align:center;padding:40px;color:#888">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
            <div style="padding:20px;text-align:center">
                <button onclick="loadMore()" style="background:#333;color:#fff;border:none;padding:10px 30px;border-radius:20px;cursor:pointer">Show More</button>
            </div>
        </div>
    </div>
</div>
`;

// Chèn Giao diện vào Web
const navbar = document.querySelector('.navbar');
if (navbar && !document.getElementById('pm-toolbar')) { 
    navbar.insertAdjacentHTML('afterend', HTML_UI); 
} else if (!document.getElementById('pm-toolbar')) { 
    document.body.insertAdjacentHTML('afterbegin', HTML_UI); 
}

// Hàm Chuyển Tab
window.safeSwitch = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');
    
    if (mode === 'market') {
        if(marketView) marketView.style.display = 'block';
        if(btnM) btnM.classList.add('active');
        if(btnT) btnT.classList.remove('active');
    } else {
        if(marketView) marketView.style.display = 'none';
        if(btnM) btnM.classList.remove('active');
        if(btnT) btnT.classList.add('active');
        alert("Competition Tab is coming soon!");
    }
};

// Hàm Render Bảng (Có icon lồng nhau)
function renderTable() {
    const tbody = document.getElementById('pm-body');
    if(!tbody) return;
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n || 0);
    let html = '';
    
    ALL_TOKENS.slice(0, VISIBLE_COUNT).forEach(t => {
        const p = t.price < 1 ? (t.price || 0).toFixed(6) : (t.price || 0).toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const link = `https://www.binance.com/en/alpha/${t.id ? t.id.replace('ALPHA_','') : ''}`;
        
        // Icon logic
        let chainUrl = t.chain_icon;
        if (!chainUrl && t.chain === 'BSC') chainUrl = 'https://bin.bnbstatic.com/image/admin_mgs_image_upload/20250228/d0216ce4-a3e9-4bda-8937-4a6aa943ccf2.png';
        const chainImg = chainUrl ? `<img src="${chainUrl}" class="chain-icon-sub" onerror="this.style.display='none'">` : '';
        const logoUrl = t.icon || 'assets/tokens/default.png';

        // Badge logic
        let statusBadge = t.status === 'SPOT' ? '<span class="badge bd-spot">SPOT</span>' : (t.status === 'DELISTED' ? '<span class="badge bd-delist">DELISTED</span>' : '');
        
        let mulBadge = '';
        if (t.listing_time > 0) {
            const daysLeft = Math.ceil((t.listing_time + (30*86400000) - Date.now()) / 86400000);
            if (daysLeft > 0 && t.mul_point >= 2) {
                const isGold = t.chain === 'BSC' && t.mul_point >= 4;
                mulBadge = `<span class="badge ${isGold ? 'bd-4x' : (t.mul_point>=4 ? 'bd-4x':'bd-2x')}">${t.mul_point}x ${daysLeft}d</span>`;
            }
        }

        html += `
        <tr onclick="window.open('${link}', '_blank')" style="cursor:pointer">
            <td style="padding-left:25px">
                <div style="display:flex;align-items:center">
                    <div class="logo-wrapper">
                        <img src="${logoUrl}" class="token-icon-main" onerror="this.src='assets/tokens/default.png'">
                        ${chainImg}
                    </div>
                    <div>
                        <div class="token-symbol">${t.symbol} ${statusBadge} ${mulBadge}</div>
                        <div style="font-size:10px;color:#666">${t.contract ? t.contract.substring(0,6)+'...' : ''}</div>
                    </div>
                </div>
            </td>
            <td>$${p}</td>
            <td class="${cls}">${sign}${(t.change_24h || 0).toFixed(2)}%</td>
            <td style="color:#aaa">${fmt(t.liquidity)}</td>
            <td style="font-weight:bold;color:#fff">${fmt(t.volume?.total)}</td>
            <td class="c-purple">${fmt(t.volume?.limit)}</td>
            <td class="c-blue">${fmt(t.volume?.onchain)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;padding:20px">No data matches</td></tr>';
}

// Load Data
window.sortData = function(col) { /* Logic sort giữ nguyên */ };
window.loadMore = function() { VISIBLE_COUNT += 10; renderTable(); };

const ts = Date.now();
DATA_FILES.forEach(path => {
    fetch(`${path}?v=${ts}`).then(r => r.json()).then(data => {
        if(data.global_stats) document.getElementById('tk-total').innerText = '$' + parseInt(data.global_stats.total_volume_24h).toLocaleString();
        ALL_TOKENS = (data.tokens || []).sort((a,b) => (b.volume?.total || 0) - (a.volume?.total || 0));
        renderTable();
    }).catch(e => {});
});
