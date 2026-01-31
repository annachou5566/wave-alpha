/* pro-mode.js - Fix Data Loading & Tab Switching */

let ALL_TOKENS = [];
let VISIBLE_COUNT = 10;
const LOAD_STEP = 10;

// HTML Toolbar
const HTML_TOOLBAR = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="switchMode('market')">
                <i class="fas fa-chart-line"></i> ALPHA MARKET
            </button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="switchMode('tourney')">
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
                            <th style="padding-left:25px">Token</th>
                            <th>Price</th>
                            <th>24h %</th>
                            <th>Liquidity</th>
                            <th>Total Vol</th>
                            <th class="c-purple">Limit Vol</th>
                            <th class="c-blue">On-Chain</th>
                            <th style="padding-right:25px">Cap</th>
                        </tr>
                    </thead>
                    <tbody id="pm-body">
                        <tr><td colspan="8" style="text-align:center; padding:30px; color:#888"><i class="fas fa-spinner fa-spin"></i> Loading Data...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pm-footer">
                <button class="btn-more" onclick="loadMore()">Show Next 10 Tokens <i class="fas fa-chevron-down"></i></button>
            </div>
        </div>
    </div>
</div>
`;

// --- KHỞI CHẠY ---
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    
    if (isAdmin) localStorage.setItem('wave_alpha_admin', 'true');
    else {
        document.body.insertAdjacentHTML('afterbegin', `<div id="maintenance-overlay" style="z-index:999999;background:#0b0e11;position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888"><h1>SYSTEM UPGRADE</h1></div>`);
        return;
    }

    console.log("Loading Pro Mode...");
    const navbar = document.querySelector('.navbar');
    if(navbar && !document.getElementById('pm-toolbar')) {
        navbar.insertAdjacentHTML('afterend', HTML_TOOLBAR);
        document.getElementById('pm-toolbar').insertAdjacentHTML('afterend', document.getElementById('view-market-pro')?.outerHTML || HTML_MARKET_VIEW_RAW());
        const ghost = document.querySelectorAll('#view-market-pro')[1]; 
        if(ghost) ghost.remove();
    }

    switchMode('market');
    loadData();
})();

function HTML_MARKET_VIEW_RAW() { return HTML_TOOLBAR.split('</div></div>')[1]; }

// --- HÀM TẢI DATA (Fix đường dẫn) ---
async function loadData() {
    try {
        // Thử tìm file ở 3 chỗ khác nhau để chắc chắn tìm thấy
        let paths = ['data/market-data.json', 'public/data/market-data.json', './market-data.json'];
        let data = null;

        for (let p of paths) {
            try {
                let res = await fetch(p);
                if (res.ok) {
                    data = await res.json();
                    console.log("Data loaded from:", p);
                    break;
                }
            } catch(e) {}
        }

        if (!data) throw new Error("No data found");

        // Update Ticker
        const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h);
        document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume);
        document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume);

        ALL_TOKENS = data.tokens.sort((a,b) => b.volume.total - a.volume.total);
        renderTable();

    } catch(e) { 
        console.error(e);
        document.getElementById('pm-body').innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--pm-red)">⚠️ Data not found. Run Python script!</td></tr>`;
    }
}

function renderTable() {
    const tbody = document.getElementById('pm-body');
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    let html = '';
    
    ALL_TOKENS.slice(0, VISIBLE_COUNT).forEach(t => {
        const p = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;
        
        html += `<tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px"><img src="${t.icon}" class="token-icon" onerror="this.src='assets/tokens/default.png'"><span style="font-weight:700;color:#fff">${t.symbol}</span> <span style="font-size:12px;color:#666">${t.name}</span></td>
            <td style="font-weight:700">$${p}</td>
            <td class="${cls}">${t.change_24h.toFixed(2)}%</td>
            <td style="color:#ddd">${fmt(t.liquidity||0)}</td>
            <td style="color:#fff">${fmt(t.volume.total)}</td>
            <td class="c-purple">${fmt(t.volume.limit)}</td>
            <td class="c-blue">${fmt(t.volume.onchain)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
    
    const btn = document.querySelector('.btn-more');
    if(VISIBLE_COUNT >= ALL_TOKENS.length) btn.style.display = 'none';
    else { btn.style.display = 'inline-block'; btn.innerHTML = `Show Next ${LOAD_STEP} Tokens <i class="fas fa-chevron-down"></i>`; }
}

window.loadMore = function() {
    document.querySelector('.btn-more').innerHTML = 'Loading...';
    setTimeout(() => { VISIBLE_COUNT += LOAD_STEP; renderTable(); }, 200);
}

// --- HÀM CHUYỂN TAB (Dùng style.display trực tiếp) ---
window.switchMode = function(mode) {
    const marketEl = document.getElementById('view-market-pro');
    const tourneyEl = document.getElementById('view-dashboard');
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');

    if (mode === 'market') {
        if(marketEl) marketEl.style.display = 'block';
        if(tourneyEl) tourneyEl.style.display = 'none';
        
        // Ẩn các phần thừa của web cũ
        document.querySelectorAll('.hero-banner, .command-deck').forEach(e => e.style.display = 'none');
        
        btnM.classList.add('active');
        btnT.classList.remove('active');
    } else {
        if(marketEl) marketEl.style.display = 'none';
        if(tourneyEl) tourneyEl.style.display = 'block';
        
        // Hiện lại web cũ
        document.querySelectorAll('.hero-banner, .command-deck').forEach(e => e.style.display = 'block');

        btnM.classList.remove('active');
        btnT.classList.add('active');
        
        // Vẽ lại grid cũ (nếu hàm tồn tại) để tránh lỗi layout
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};
