/* pro-mode.js - Fix Layout & Logic */

const MARKET_API = 'public/data/market-data.json';
let ALL_TOKENS = [];
let VISIBLE = 10;
const STEP = 10;

// HTML Toolbar (Nằm dưới Navbar)
const HTML_TOOLBAR = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="switchMode('market')">
                <i class="fas fa-chart-line"></i> ALPHA MARKET
            </button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="switchMode('tourney')">
                <i class="fas fa-trophy"></i> TOURNAMENTS
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
    <div class="pm-card">
        <div style="overflow-x:auto">
            <table class="pm-table">
                <thead>
                    <tr>
                        <th style="padding-left:25px">Token</th>
                        <th>Price</th>
                        <th>24h %</th>
                        <th>Liquidity</th> <th>Total Vol</th>
                        <th class="c-purple">Limit Vol</th>
                        <th class="c-blue">On-Chain</th>
                        <th style="padding-right:25px">Cap</th>
                    </tr>
                </thead>
                <tbody id="pm-body"></tbody>
            </table>
        </div>
        <div class="pm-footer">
            <button class="btn-more" onclick="loadMore()">Load More <i class="fas fa-chevron-down"></i></button>
        </div>
    </div>
</div>
`;

// Khởi chạy
(function() {
    // Check Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    
    if (isAdmin) localStorage.setItem('wave_alpha_admin', 'true');
    else {
        // Bảo trì cho khách
        document.body.insertAdjacentHTML('afterbegin', `<div id="maintenance-overlay" style="z-index:999999;background:#000;position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#888"><h1 style="color:#fff">MAINTENANCE</h1></div>`);
        return;
    }

    console.log("Loading Pro Mode...");
    
    // 1. Chèn Toolbar vào SAU Navbar (Để không mất Logo/Login)
    const navbar = document.querySelector('.navbar');
    if(navbar) {
        navbar.insertAdjacentHTML('afterend', HTML_TOOLBAR);
    } else {
        // Fallback nếu không tìm thấy navbar
        document.body.insertAdjacentHTML('afterbegin', HTML_TOOLBAR);
    }

    // 2. Mặc định vào Market -> Ẩn Dashboard cũ
    switchMode('market');

    // 3. Tải data
    loadData();
})();

async function loadData() {
    try {
        const res = await fetch(MARKET_API);
        const data = await res.json();
        
        // Update Ticker
        const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h);
        document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume);
        document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume);

        // Sort & Save
        ALL_TOKENS = data.tokens.sort((a,b) => b.volume.total - a.volume.total);
        renderTable();

    } catch(e) { console.error(e); }
}

function renderTable() {
    const tbody = document.getElementById('pm-body');
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    
    // Chỉ render phần mới thêm (nếu cần tối ưu) hoặc render lại hết chunk
    const currentList = ALL_TOKENS.slice(0, VISIBLE);
    
    let html = '';
    currentList.forEach(t => {
        const p = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;
        const liq = t.liquidity ? fmt(t.liquidity) : '$0'; // Liquidity

        html += `
        <tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px">
                <img src="${t.icon}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                ${t.symbol} <span style="color:#666;font-size:12px;margin-left:5px">${t.name}</span>
            </td>
            <td>$${p}</td>
            <td class="${cls}">${t.change_24h.toFixed(2)}%</td>
            <td style="color:#ddd">${liq}</td>
            <td style="color:#fff">${fmt(t.volume.total)}</td>
            <td class="c-purple">${fmt(t.volume.limit)}</td>
            <td class="c-blue">${fmt(t.volume.onchain)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;

    // Ẩn nút Load More nếu hết
    if(VISIBLE >= ALL_TOKENS.length) document.querySelector('.btn-more').style.display = 'none';
}

window.loadMore = function() {
    VISIBLE += STEP;
    document.querySelector('.btn-more').innerHTML = 'Loading...';
    setTimeout(() => {
        renderTable();
        document.querySelector('.btn-more').innerHTML = 'Load More <i class="fas fa-chevron-down"></i>';
    }, 200);
}

window.switchMode = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    // Tìm dashboard cũ (thường là div ngay sau navbar hoặc có id view-dashboard)
    const oldView = document.getElementById('view-dashboard') || document.querySelector('.hero-banner')?.parentElement;
    
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');

    if(mode === 'market') {
        marketView.classList.remove('hidden-view');
        if(oldView) oldView.classList.add('hidden-view');
        btnM.classList.add('active');
        btnT.classList.remove('active');
        
        // Ẩn các thành phần rác của web cũ (nếu có)
        document.querySelectorAll('.command-deck, .hero-banner').forEach(el => el.classList.add('hidden-view'));
    } else {
        marketView.classList.add('hidden-view');
        if(oldView) oldView.classList.remove('hidden-view');
        btnM.classList.remove('active');
        btnT.classList.add('active');
        
        // Hiện lại
        document.querySelectorAll('.command-deck, .hero-banner').forEach(el => el.classList.remove('hidden-view'));
        
        // Fix grid layout
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
}
