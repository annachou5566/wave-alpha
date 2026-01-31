/* pro-mode.js - Module Bảo trì & Market Pro */

const MARKET_API = 'public/data/market-data.json';

// --- HTML CÁC THÀNH PHẦN MỚI ---
const HTML_TICKER = `
<div class="pm-ticker-bar">
    <div class="pm-container">
        <div class="pm-stats">
            <div class="pm-stat-box">
                <span class="pm-lbl">TOTAL VOLUME</span>
                <span class="pm-val" id="pm-total">LOADING...</span>
            </div>
            <div class="pm-stat-box">
                <span class="pm-lbl">LIMIT (CEX)</span>
                <span class="pm-val c-purple" id="pm-limit">---</span>
            </div>
            <div class="pm-stat-box">
                <span class="pm-lbl">ON-CHAIN (DEX)</span>
                <span class="pm-val c-blue" id="pm-onchain">---</span>
            </div>
        </div>
        <div class="pm-tabs">
            <button class="pm-tab-btn active" id="tab-new" onclick="window.switchProTab('market')">MARKET PRO</button>
            <button class="pm-tab-btn" id="tab-old" onclick="window.switchProTab('classic')">TOURNAMENTS</button>
        </div>
    </div>
</div>`;

const HTML_MARKET_VIEW = `
<div id="view-market-pro" class="pm-container">
    <div class="pm-table-card">
        <div class="pm-header">
            <div>
                <h5 style="margin:0; font-weight:700; color:#F0B90B">ALPHA MARKET DATA</h5>
                <small style="color:#848e9c; font-size:0.75rem" id="pm-updated">Auto-update active</small>
            </div>
        </div>
        <div class="pm-table-responsive">
            <table class="pm-table">
                <thead>
                    <tr>
                        <th>TOKEN</th>
                        <th>PRICE</th>
                        <th>24H CHANGE</th>
                        <th>TOTAL VOL</th>
                        <th class="c-purple">LIMIT VOL</th>
                        <th class="c-blue">ON-CHAIN</th>
                        <th class="text-center">SOURCE</th>
                    </tr>
                </thead>
                <tbody id="pm-table-body">
                    <tr><td colspan="7" style="text-align:center; padding:30px">Loading Alpha Data...</td></tr>
                </tbody>
            </table>
        </div>
    </div>
</div>`;

// --- LOGIC CHÍNH ---
(function() {
    // 1. Check Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isUrlAdmin = urlParams.get('mode') === 'admin';
    const isSavedAdmin = localStorage.getItem('wave_alpha_admin') === 'true';
    const isAdmin = isUrlAdmin || isSavedAdmin;

    if (isUrlAdmin) localStorage.setItem('wave_alpha_admin', 'true');

    // 2. Nếu KHÔNG phải Admin -> Hiện bảo trì & Dừng luôn
    if (!isAdmin) {
        console.log("Visitor detected. Showing Maintenance.");
        const maintenanceHTML = `
        <div id="maintenance-overlay">
            <div class="pm-loader"></div>
            <div class="pm-title">SYSTEM UPGRADE</div>
            <p class="pm-desc">Hệ thống đang bảo trì để nâng cấp dữ liệu Real-time.<br>Vui lòng quay lại sau.</p>
        </div>`;
        document.body.insertAdjacentHTML('afterbegin', maintenanceHTML);
        document.body.style.overflow = 'hidden';
        return; 
    }

    // 3. Nếu LÀ Admin -> Tiêm giao diện mới vào web cũ
    console.log("Admin detected. Injecting Pro Features...");
    
    // Chèn Ticker sau Navbar
    const navbar = document.querySelector('.navbar');
    if (navbar) navbar.insertAdjacentHTML('afterend', HTML_TICKER);

    // Chèn Bảng Market trước Dashboard cũ
    const oldDashboard = document.getElementById('view-dashboard');
    if (oldDashboard) {
        // Mặc định ẩn dashboard cũ đi
        oldDashboard.classList.add('hidden-view');
        oldDashboard.insertAdjacentHTML('beforebegin', HTML_MARKET_VIEW);
    }

    // Tải dữ liệu
    loadMarketData();

})();

// --- HÀM TẢI DỮ LIỆU ---
async function loadMarketData() {
    try {
        const res = await fetch(MARKET_API);
        if (!res.ok) throw new Error("Data file not found");
        const data = await res.json();
        const stats = data.global_stats;

        // Format tiền tệ
        const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);

        // Update Ticker
        document.getElementById('pm-total').innerText = fmt(stats.total_volume_24h);
        document.getElementById('pm-limit').innerText = fmt(stats.total_limit_volume);
        document.getElementById('pm-onchain').innerText = fmt(stats.total_onchain_volume);
        document.getElementById('pm-updated').innerText = 'Updated: ' + data.last_updated;

        // Render Table
        const tbody = document.getElementById('pm-table-body');
        tbody.innerHTML = '';

        data.tokens.slice(0, 100).forEach(t => {
            let badge = `<span class="pm-badge">On-Chain</span>`;
            if (t.volume.source.includes('Limit')) badge = `<span class="pm-badge mix">Hybrid</span>`;
            if (t.volume.source === 'Limit Only') badge = `<span class="pm-badge limit">Limit</span>`;

            let color = t.change_24h >= 0 ? 'c-up' : 'c-down';
            let sign = t.change_24h >= 0 ? '+' : '';
            // Link Binance Alpha (Giả định ID đúng)
            let link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;

            let row = `
            <tr onclick="window.open('${link}', '_blank')">
                <td>
                    <div style="display:flex; align-items:center; gap:10px">
                        <img src="${t.icon || 'assets/tokens/default.png'}" style="width:28px; height:28px; border-radius:50%; background:#000" onerror="this.src='assets/tokens/default.png'">
                        <div>
                            <div style="font-weight:700; color:#fff">${t.symbol}</div>
                            <div style="font-size:0.7rem; color:#666">${t.name}</div>
                        </div>
                    </div>
                </td>
                <td style="font-weight:700">$${t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2)}</td>
                <td class="${color}" style="font-weight:700">${sign}${t.change_24h.toFixed(2)}%</td>
                <td style="font-weight:700; color:#fff">${fmt(t.volume.total)}</td>
                <td class="c-purple">${fmt(t.volume.limit)}</td>
                <td class="c-blue">${fmt(t.volume.onchain)}</td>
                <td class="text-center">${badge}</td>
            </tr>`;
            tbody.innerHTML += row;
        });

    } catch (e) {
        console.error("Lỗi tải data:", e);
    }
}

// --- HÀM CHUYỂN TAB ---
window.switchProTab = function(tab) {
    const marketView = document.getElementById('view-market-pro');
    const classicView = document.getElementById('view-dashboard');
    const btnNew = document.getElementById('tab-new');
    const btnOld = document.getElementById('tab-old');

    if (tab === 'market') {
        marketView.classList.remove('hidden-view');
        classicView.classList.add('hidden-view');
        btnNew.classList.add('active');
        btnOld.classList.remove('active');
    } else {
        marketView.classList.add('hidden-view');
        classicView.classList.remove('hidden-view');
        btnNew.classList.remove('active');
        btnOld.classList.add('active');
        
        // Fix lỗi grid cũ không hiện khi ẩn/hiện lại
        if (typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};
