/* pro-mode.js - PHIÊN BẢN ỔN ĐỊNH CAO */

// --- CẤU HÌNH ---
const DATA_FILES = [
    'public/data/market-data.json',  // Ưu tiên 1
    'data/market-data.json',         // Ưu tiên 2
    'market-data.json'               // Ưu tiên 3
];

let ALL_TOKENS = [];
let VISIBLE_COUNT = 10;
const LOAD_STEP = 10;

// --- 1. HTML GIAO DIỆN (GIỮ NGUYÊN HEADER) ---
const HTML_UI = `
<div id="pm-toolbar" class="pm-toolbar-wrapper">
    <div class="pm-container">
        <div class="pm-tab-group">
            <button class="pm-tab-item active" id="btn-tab-market" onclick="window.safeSwitch('market')">
                <i class="fas fa-chart-line"></i> ALPHA MARKET
            </button>
            <button class="pm-tab-item" id="btn-tab-tourney" onclick="window.safeSwitch('tourney')">
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
                        <tr><td colspan="8" style="text-align:center; padding:40px; color:#888"><i class="fas fa-circle-notch fa-spin"></i> Loading Market Data...</td></tr>
                    </tbody>
                </table>
            </div>
            <div class="pm-footer">
                <button class="btn-more" onclick="window.loadMore()">Show Next 10 Tokens <i class="fas fa-chevron-down"></i></button>
            </div>
        </div>
    </div>
</div>
`;

// --- 2. KHỞI TẠO NGAY LẬP TỨC (QUAN TRỌNG) ---
// Định nghĩa hàm chuyển Tab TRƯỚC KHI làm bất cứ việc gì khác để đảm bảo nút luôn bấm được
window.safeSwitch = function(mode) {
    console.log("Switching to:", mode);
    
    const marketView = document.getElementById('view-market-pro');
    const oldView = document.getElementById('view-dashboard'); // ID của web cũ
    const btnM = document.getElementById('btn-tab-market');
    const btnT = document.getElementById('btn-tab-tourney');

    // Các thành phần phụ của web cũ cần ẩn
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
        extras.forEach(e => e.style.display = 'block'); // Hiện lại

        if(btnM) btnM.classList.remove('active');
        if(btnT) btnT.classList.add('active');
        
        // Vẽ lại grid cũ nếu cần
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};

window.loadMore = function() {
    const btn = document.querySelector('.btn-more');
    if(btn) btn.innerHTML = 'Loading...';
    setTimeout(() => {
        VISIBLE_COUNT += LOAD_STEP;
        renderTable();
        if(btn) btn.innerHTML = 'Show Next 10 Tokens <i class="fas fa-chevron-down"></i>';
    }, 100);
};

// --- 3. LOGIC CHÍNH ---
(function init() {
    // Check Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('mode') === 'admin' || localStorage.getItem('wave_alpha_admin') === 'true';
    
    if (isAdmin) localStorage.setItem('wave_alpha_admin', 'true');
    else {
        // Overlay bảo trì
        const overlay = document.createElement('div');
        overlay.id = 'maintenance-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#0b0e11;z-index:999999;display:flex;align-items:center;justify-content:center;color:#888';
        overlay.innerHTML = '<h1>SYSTEM UPGRADE</h1>';
        document.body.prepend(overlay);
        return; 
    }

    console.log("🚀 Starting Pro Mode...");

    // Inject UI (Chèn vào sau Navbar để không mất Logo)
    const navbar = document.querySelector('.navbar');
    if (navbar && !document.getElementById('pm-toolbar')) {
        navbar.insertAdjacentHTML('afterend', HTML_UI);
    } else if (!document.getElementById('pm-toolbar')) {
        // Fallback: Chèn đầu trang
        document.body.insertAdjacentHTML('afterbegin', HTML_UI);
    }

    // Mặc định vào Market
    window.safeSwitch('market');

    // Tải dữ liệu
    fetchData();
})();

// --- 4. HÀM TẢI DỮ LIỆU (THỬ NHIỀU ĐƯỜNG DẪN) ---
async function fetchData() {
    let data = null;
    
    // Thêm timestamp để tránh Cache trình duyệt
    const ts = Date.now();
    
    for (let path of DATA_FILES) {
        try {
            const url = `${path}?v=${ts}`;
            console.log(`Trying to fetch: ${url}`);
            const res = await fetch(url);
            if (res.ok) {
                data = await res.json();
                console.log("✅ Success loaded:", path);
                break; 
            }
        } catch (e) {
            console.warn(`Failed ${path}:`, e);
        }
    }

    if (!data) {
        console.error("❌ ALL DATA PATHS FAILED");
        document.getElementById('pm-body').innerHTML = `
            <tr><td colspan="8" style="text-align:center; padding:30px; color:#F6465D">
                <strong>DATA NOT FOUND</strong><br>
                <small>Please run python script or check 'public/data' folder.</small>
            </td></tr>`;
        return;
    }

    // Xử lý dữ liệu
    try {
        const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        
        // Ticker
        if (data.global_stats) {
            document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h || 0);
            document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume || 0);
            document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume || 0);
        }

        // Table
        ALL_TOKENS = (data.tokens || []).sort((a, b) => (b.volume?.total || 0) - (a.volume?.total || 0));
        renderTable();

    } catch (e) {
        console.error("Render error:", e);
    }
}

function renderTable() {
    const tbody = document.getElementById('pm-body');
    if(!tbody) return;

    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    let html = '';
    
    const list = ALL_TOKENS.slice(0, VISIBLE_COUNT);
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px">Data is empty.</td></tr>`;
        return;
    }

    list.forEach(t => {
        const price = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const link = `https://www.binance.com/en/alpha/${t.id ? t.id.replace('ALPHA_','') : ''}`;
        
        html += `
        <tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px">
                <div class="td-token">
                    <img src="${t.icon}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                    <div>
                        <div style="font-weight:700;color:#fff">${t.symbol}</div>
                        <div class="token-name">${t.name}</div>
                    </div>
                </div>
            </td>
            <td style="font-weight:700">$${price}</td>
            <td class="${cls}">${sign}${t.change_24h.toFixed(2)}%</td>
            <td style="color:#ddd">${fmt(t.liquidity || 0)}</td>
            <td style="font-weight:700; color:#fff">${fmt(t.volume?.total || 0)}</td>
            <td class="c-purple">${fmt(t.volume?.limit || 0)}</td>
            <td class="c-blue">${fmt(t.volume?.onchain || 0)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap || 0)}</td>
        </tr>`;
    });

    tbody.innerHTML = html;
    
    // Nút Load More
    const btn = document.querySelector('.btn-more');
    if(btn) {
        btn.style.display = (VISIBLE_COUNT >= ALL_TOKENS.length) ? 'none' : 'inline-block';
    }
}