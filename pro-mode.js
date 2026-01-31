/* pro-mode.js - Wave Alpha Logic (Load More & Sorting) */

const MARKET_API = 'public/data/market-data.json';
let ALL_TOKENS = []; // Chứa toàn bộ token
let VISIBLE_COUNT = 10; // Số lượng hiển thị ban đầu
const LOAD_STEP = 10; // Mỗi lần load thêm bao nhiêu

// --- HTML HEADER MỚI (CHỨA TAB) ---
const HTML_HEADER = `
<div id="pm-header" class="pm-header-wrapper">
    <div class="pm-nav-bar">
        <div class="pm-tabs">
            <button class="pm-tab-btn active" id="tab-new" onclick="window.switchProTab('market')">
                <i class="fas fa-chart-line"></i> ALPHA MARKET
            </button>
            <button class="pm-tab-btn" id="tab-old" onclick="window.switchProTab('classic')">
                <i class="fas fa-trophy"></i> TOURNAMENTS
            </button>
        </div>
        
        <div class="pm-ticker-group">
            <div class="pm-ticker-mini">
                <span class="pm-ticker-label">TOTAL ALPHA VOL</span>
                <span class="pm-ticker-value" id="tk-total">---</span>
            </div>
            <div class="pm-ticker-mini">
                <span class="pm-ticker-label">LIMIT (CEX)</span>
                <span class="pm-ticker-value c-purple" id="tk-limit">---</span>
            </div>
            <div class="pm-ticker-mini">
                <span class="pm-ticker-label">ON-CHAIN (DEX)</span>
                <span class="pm-ticker-value c-blue" id="tk-onchain">---</span>
            </div>
        </div>
    </div>
</div>

<div id="view-market-pro">
    <div class="pm-table-card">
        <div class="pm-table-container">
            <table class="pm-table">
                <thead>
                    <tr>
                        <th style="padding-left:20px">Token Name</th>
                        <th class="text-right">Price</th>
                        <th class="text-right">24h Change</th>
                        <th class="text-right">Total Vol</th>
                        <th class="text-right c-purple">Limit Vol</th>
                        <th class="text-right c-blue">On-Chain</th>
                        <th class="text-right">Liquidity</th> <th class="text-right">Market Cap</th>
                        <th class="text-center" style="padding-right:20px">Source</th>
                    </tr>
                </thead>
                <tbody id="pm-table-body">
                    </tbody>
            </table>
        </div>
        <div class="pm-load-more-area">
            <button class="btn-load-more" onclick="window.loadMoreTokens()">
                Show More Tokens <i class="fas fa-chevron-down ms-1"></i>
            </button>
        </div>
    </div>
</div>
`;

// --- LOGIC KHỞI TẠO ---
(function() {
    // Check Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isUrlAdmin = urlParams.get('mode') === 'admin';
    const isSavedAdmin = localStorage.getItem('wave_alpha_admin') === 'true';
    const isAdmin = isUrlAdmin || isSavedAdmin;

    if (isUrlAdmin) localStorage.setItem('wave_alpha_admin', 'true');

    // Nếu không phải Admin -> Hiện bảo trì
    if (!isAdmin) {
        const maintenanceHTML = `
        <div id="maintenance-overlay">
            <div class="pm-loader"></div>
            <div class="pm-title">SYSTEM UPGRADE</div>
            <p class="pm-desc">Chúng tôi đang nâng cấp dữ liệu Real-time.<br>Vui lòng quay lại sau.</p>
        </div>`;
        document.body.insertAdjacentHTML('afterbegin', maintenanceHTML);
        document.body.style.overflow = 'hidden';
        return; 
    }

    // Nếu là Admin -> Inject giao diện
    console.log("Admin detected. Loading Wave Alpha Pro...");
    const oldApp = document.getElementById('app-container') || document.querySelector('body > :not(script):not(link)');
    if(oldApp) oldApp.classList.add('hidden-view'); // Ẩn web cũ trước

    document.body.insertAdjacentHTML('afterbegin', HTML_HEADER);
    
    loadMarketData();
})();

// --- HÀM TẢI & XỬ LÝ DỮ LIỆU ---
async function loadMarketData() {
    try {
        const res = await fetch(MARKET_API);
        if (!res.ok) return;
        const data = await res.json();
        
        // 1. Cập nhật Ticker
        const fmtUsd = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        document.getElementById('tk-total').innerText = fmtUsd(data.global_stats.total_volume_24h);
        document.getElementById('tk-limit').innerText = fmtUsd(data.global_stats.total_limit_volume);
        document.getElementById('tk-onchain').innerText = fmtUsd(data.global_stats.total_onchain_volume);

        // 2. Lưu và Sắp xếp Token (Volume cao nhất lên đầu)
        ALL_TOKENS = data.tokens.sort((a, b) => b.volume.total - a.volume.total);
        
        // 3. Render lần đầu (10 token)
        renderTable();

    } catch (e) { console.error("Error loading data:", e); }
}

// --- HÀM VẼ BẢNG (RENDER) ---
function renderTable() {
    const tbody = document.getElementById('pm-table-body');
    tbody.innerHTML = ''; // Xóa cũ

    const tokensToShow = ALL_TOKENS.slice(0, VISIBLE_COUNT);
    const fmtUsd = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);

    tokensToShow.forEach((t, index) => {
        const price = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const changeClass = t.change_24h >= 0 ? 'text-up' : 'text-down';
        const changeSign = t.change_24h >= 0 ? '+' : '';
        
        let sourceBadge = `<span class="source-tag">On-Chain</span>`;
        if (t.volume.source.includes('Limit')) sourceBadge = `<span class="source-tag mix">Hybrid</span>`;

        let link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;

        const row = `
        <tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:20px">
                <div class="td-token">
                    <span class="token-rank">#${index + 1}</span>
                    <img src="${t.icon || 'assets/tokens/default.png'}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                    <div class="token-info">
                        <span class="token-symbol">${t.symbol}</span>
                        <span class="token-name">${t.name}</span>
                    </div>
                </div>
            </td>
            <td class="text-right" style="font-weight:700">$${price}</td>
            <td class="text-right ${changeClass}" style="font-weight:700">${changeSign}${t.change_24h.toFixed(2)}%</td>
            <td class="text-right" style="font-weight:700; color:#fff">${fmtUsd(t.volume.total)}</td>
            <td class="text-right c-purple">${fmtUsd(t.volume.limit)}</td>
            <td class="text-right c-blue">${fmtUsd(t.volume.onchain)}</td>
            <td class="text-right" style="color:#ddd">${fmtUsd(t.liquidity || 0)}</td> <td class="text-right" style="color:#888">${fmtUsd(t.market_cap)}</td>
            <td class="text-center" style="padding-right:20px">${sourceBadge}</td>
        </tr>`;
        tbody.innerHTML += row;
    });

    // Ẩn nút Load More nếu đã hiện hết
    const loadBtn = document.querySelector('.btn-load-more');
    if (VISIBLE_COUNT >= ALL_TOKENS.length) {
        loadBtn.style.display = 'none';
    } else {
        loadBtn.style.display = 'inline-block';
        loadBtn.innerHTML = `Show Next ${LOAD_STEP} Tokens <i class="fas fa-chevron-down ms-1"></i>`;
    }
}

// --- HÀM LOAD MORE ---
window.loadMoreTokens = function() {
    VISIBlE_COUNT += LOAD_STEP;
    // Hiệu ứng loading giả lập cho chuyên nghiệp
    const btn = document.querySelector('.btn-load-more');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    
    setTimeout(() => {
        VISIBLE_COUNT += LOAD_STEP; // Tăng số lượng hiển thị
        renderTable(); // Vẽ lại
    }, 300); // Delay nhẹ 0.3s cho mượt
};

// --- HÀM CHUYỂN TAB ---
window.switchProTab = function(tab) {
    const marketView = document.getElementById('view-market-pro');
    const oldView = document.getElementById('view-dashboard') || document.getElementById('app-container');
    const btnNew = document.getElementById('tab-new');
    const btnOld = document.getElementById('tab-old');

    // Chuyển UI Tab
    if (tab === 'market') {
        btnNew.classList.add('active');
        btnOld.classList.remove('active');
        marketView.classList.remove('hidden-view');
        if(oldView) oldView.classList.add('hidden-view');
    } else {
        btnNew.classList.remove('active');
        btnOld.classList.add('active');
        marketView.classList.add('hidden-view');
        if(oldView) {
            oldView.classList.remove('hidden-view');
            oldView.style.display = 'block'; // Force hiện
        }
        // Fix grid layout cũ (nếu có)
        if (typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};
