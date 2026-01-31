/* pro-mode.js - Fix Layout & Data Logic */

const MARKET_API = 'public/data/market-data.json';
let ALL_TOKENS = [];
let VISIBLE_COUNT = 10;
const LOAD_STEP = 10;

// --- HTML TOOLBAR (Chứa Tab & Ticker) ---
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
            <div class="pm-tick-box">
                <span class="pm-tick-lbl">TOTAL VOL</span>
                <span class="pm-tick-val" id="tk-total">---</span>
            </div>
            <div class="pm-tick-box">
                <span class="pm-tick-lbl">LIMIT (CEX)</span>
                <span class="pm-tick-val c-purple" id="tk-limit">---</span>
            </div>
            <div class="pm-tick-box">
                <span class="pm-tick-lbl">ON-CHAIN</span>
                <span class="pm-tick-val c-blue" id="tk-onchain">---</span>
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
                            <th style="width:250px">Token Name</th>
                            <th>Price</th>
                            <th>24h Change</th>
                            <th>Liquidity</th>
                            <th>Total Volume</th>
                            <th class="c-purple">Limit Vol</th>
                            <th class="c-blue">On-Chain</th>
                            <th>Market Cap</th>
                        </tr>
                    </thead>
                    <tbody id="pm-body">
                        <tr><td colspan="8" style="text-align:center; padding:30px; color:#888">Loading Data...</td></tr>
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

// --- LOGIC KHỞI TẠO ---
(function() {
    // 1. Kiểm tra Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    
    if (isAdmin) localStorage.setItem('wave_alpha_admin', 'true');
    else {
        // Nếu là khách -> Hiện bảo trì
        document.body.insertAdjacentHTML('afterbegin', `<div id="maintenance-overlay" style="z-index:999999;background:#0b0e11;position:fixed;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#888"><div class="pm-loader"></div><h1 style="color:#fff;font-family:sans-serif">SYSTEM UPGRADE</h1><p>We are updating Alpha Market Data.</p></div>`);
        return;
    }

    console.log("Loading Wave Alpha Pro...");

    // 2. Chèn Toolbar vào SAU Navbar (Giữ nguyên Logo & Login)
    // Tìm Navbar trong code cũ (class .navbar)
    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        navbar.insertAdjacentHTML('afterend', HTML_TOOLBAR); // Chèn ngay dưới Navbar
        // Chèn bảng Market ngay sau Toolbar
        const toolbar = document.getElementById('pm-toolbar');
        toolbar.insertAdjacentHTML('afterend', document.getElementById('view-market-pro')?.outerHTML || HTML_MARKET_VIEW_RAW());
        // Xóa cái div ảo vừa tạo string
        const oldVirtual = document.getElementById('view-market-pro');
        if(oldVirtual && oldVirtual.parentNode === document.body) oldVirtual.remove(); 
    } else {
        // Fallback nếu không tìm thấy navbar (ít khi xảy ra)
        document.body.insertAdjacentHTML('afterbegin', HTML_TOOLBAR + HTML_MARKET_VIEW_RAW());
    }

    // 3. Khởi động Tab Market
    switchMode('market');

    // 4. Tải dữ liệu
    loadData();
})();

// Hàm trả về chuỗi HTML Table (để tránh lỗi undefined biến)
function HTML_MARKET_VIEW_RAW() {
    return HTML_TOOLBAR.split('</div></div>')[1] || HTML_TOOLBAR; // Hack nhẹ để lấy phần sau toolbar
}

// --- LOGIC TẢI DỮ LIỆU ---
async function loadData() {
    try {
        // Thử cả 2 đường dẫn để chắc chắn (Local và Deploy)
        let res = await fetch('public/data/market-data.json');
        if (!res.ok) res = await fetch('data/market-data.json');
        if (!res.ok) throw new Error("File not found");

        const data = await res.json();
        
        // Cập nhật Ticker
        const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h);
        document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume);
        document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume);

        // Lưu & Sort Token
        ALL_TOKENS = data.tokens.sort((a,b) => b.volume.total - a.volume.total);
        renderTable();

    } catch(e) { 
        console.error(e);
        document.getElementById('pm-body').innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--pm-red)">⚠️ Error loading data. Please check Python script.</td></tr>`;
    }
}

// --- LOGIC RENDER ---
function renderTable() {
    const tbody = document.getElementById('pm-body');
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    
    let html = '';
    const list = ALL_TOKENS.slice(0, VISIBLE_COUNT);

    list.forEach(t => {
        const price = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;
        
        html += `
        <tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px">
                <img src="${t.icon || 'assets/tokens/default.png'}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                <span style="font-weight:700; color:#fff">${t.symbol}</span>
                <span class="token-name">${t.name}</span>
            </td>
            <td style="font-weight:700">$${price}</td>
            <td class="${cls}">${sign}${t.change_24h.toFixed(2)}%</td>
            <td style="color:#ddd">${fmt(t.liquidity || 0)}</td>
            <td style="font-weight:700; color:#fff">${fmt(t.volume.total)}</td>
            <td class="c-purple">${fmt(t.volume.limit)}</td>
            <td class="c-blue">${fmt(t.volume.onchain)}</td>
            <td style="color:#888">${fmt(t.market_cap)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;

    // Nút Load More
    const btn = document.querySelector('.btn-more');
    if (VISIBLE_COUNT >= ALL_TOKENS.length) btn.style.display = 'none';
    else {
        btn.style.display = 'inline-block';
        btn.innerHTML = `Show Next ${LOAD_STEP} Tokens <i class="fas fa-chevron-down"></i>`;
    }
}

window.loadMore = function() {
    document.querySelector('.btn-more').innerHTML = 'Loading...';
    setTimeout(() => {
        VISIBLE_COUNT += LOAD_STEP;
        renderTable();
    }, 200);
}

// --- LOGIC CHUYỂN TAB (SỬA LỖI) ---
window.switchMode = function(mode) {
    const marketView = document.getElementById('view-market-pro');
    const oldView = document.getElementById('view-dashboard');
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');

    if (mode === 'market') {
        // Hiện Market, Ẩn Old
        marketView.classList.remove('hidden-view');
        if(oldView) oldView.classList.add('hidden-view');
        
        btnM.classList.add('active');
        btnT.classList.remove('active');
        
        // Ẩn thêm các thành phần phụ của web cũ (nếu có)
        document.querySelectorAll('.hero-banner, .command-deck').forEach(el => el.classList.add('hidden-view'));

    } else {
        // Ẩn Market, Hiện Old
        marketView.classList.add('hidden-view');
        if(oldView) oldView.classList.remove('hidden-view');
        
        btnM.classList.remove('active');
        btnT.classList.add('active');

        // Hiện lại banner cũ
        document.querySelectorAll('.hero-banner, .command-deck').forEach(el => el.classList.remove('hidden-view'));
        
        // Fix lỗi grid cũ (vẽ lại)
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};
