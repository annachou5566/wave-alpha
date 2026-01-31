/* pro-mode.js - Wave Alpha Pro Logic */

const MARKET_API = 'public/data/market-data.json';

// --- HTML FRAMEWORK ---
const HTML_FRAMEWORK = `
<div id="pm-header" class="pm-nav-bar">
    <div class="pm-nav-links">
        <div class="pm-nav-item active">Alpha Market</div>
        <div class="pm-nav-item" style="opacity:0.5; cursor:not-allowed">Smart Money</div>
        <div class="pm-nav-item" style="opacity:0.5; cursor:not-allowed">Social Hype</div>
    </div>
    
    <div class="pm-ticker-group">
        <div class="pm-ticker-mini">
            <span class="pm-ticker-label">24H VOLUME</span>
            <span class="pm-ticker-value" id="tk-total">---</span>
        </div>
        <div class="pm-ticker-mini">
            <span class="pm-ticker-label">LIMIT (CEX)</span>
            <span class="pm-ticker-value" style="color:#bb86fc" id="tk-limit">---</span>
        </div>
        <div class="pm-ticker-mini">
            <span class="pm-ticker-label">ON-CHAIN</span>
            <span class="pm-ticker-value" style="color:#00b8ff" id="tk-onchain">---</span>
        </div>
        <button class="btn-back-classic" onclick="window.exitProMode()">
            <span>Legacy View</span> <i class="fas fa-external-link-alt"></i>
        </button>
    </div>
</div>

<div id="view-market-pro">
    <div class="pm-table-container">
        <table class="pm-table">
            <thead>
                <tr>
                    <th style="padding-left:0">Token</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">24h Change</th>
                    <th class="text-right">Total Vol</th>
                    <th class="text-right" style="color:#bb86fc">Limit Vol</th>
                    <th class="text-right" style="color:#00b8ff">On-Chain</th>
                    <th class="text-right">Market Cap</th>
                    <th class="text-right">Info</th>
                </tr>
            </thead>
            <tbody id="pm-table-body">
                </tbody>
        </table>
    </div>
</div>
`;

// --- LOGIC ---
(function() {
    // 1. Check Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isUrlAdmin = urlParams.get('mode') === 'admin';
    const isSavedAdmin = localStorage.getItem('wave_alpha_admin') === 'true';
    const isAdmin = isUrlAdmin || isSavedAdmin;

    if (isUrlAdmin) localStorage.setItem('wave_alpha_admin', 'true');

    // 2. Bảo trì (Cho khách)
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

    // 3. Admin: Vào giao diện Pro
    console.log("Admin detected. Loading Pro UI...");
    
    // Ẩn Web cũ
    const oldApp = document.getElementById('app-container') || document.querySelector('body > :not(script):not(link)');
    if(oldApp) oldApp.classList.add('hidden-view');

    // Chèn Web mới
    document.body.insertAdjacentHTML('afterbegin', HTML_FRAMEWORK);

    // Load dữ liệu
    loadMarketData();
})();

async function loadMarketData() {
    try {
        const res = await fetch(MARKET_API);
        if (!res.ok) return;
        const data = await res.json();
        
        // Update Ticker
        const fmtUsd = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        document.getElementById('tk-total').innerText = fmtUsd(data.global_stats.total_volume_24h);
        document.getElementById('tk-limit').innerText = fmtUsd(data.global_stats.total_limit_volume);
        document.getElementById('tk-onchain').innerText = fmtUsd(data.global_stats.total_onchain_volume);

        // Update Table
        const tbody = document.getElementById('pm-table-body');
        tbody.innerHTML = '';

        data.tokens.slice(0, 100).forEach(t => {
            const price = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
            const changeClass = t.change_24h >= 0 ? 'text-up' : 'text-down';
            const changeSign = t.change_24h >= 0 ? '+' : '';
            
            let sourceBadge = `<span class="source-tag">On-Chain</span>`;
            if (t.volume.source.includes('Limit')) sourceBadge = `<span class="source-tag mix">Hybrid</span>`;

            // Link Binance Alpha
            let link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;

            const row = `
            <tr onclick="window.open('${link}', '_blank')">
                <td style="padding-left:0">
                    <div class="td-token">
                        <img src="${t.icon || 'assets/tokens/default.png'}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                        <div>
                            <span class="token-symbol">${t.symbol}</span>
                            <span class="token-name">${t.name}</span>
                        </div>
                    </div>
                </td>
                <td class="text-right">$${price}</td>
                <td class="text-right ${changeClass}">${changeSign}${t.change_24h.toFixed(2)}%</td>
                <td class="text-right">${fmtUsd(t.volume.total)}</td>
                <td class="text-right" style="color:#bb86fc">${fmtUsd(t.volume.limit)}</td>
                <td class="text-right" style="color:#00b8ff">${fmtUsd(t.volume.onchain)}</td>
                <td class="text-right">${fmtUsd(t.market_cap)}</td>
                <td class="text-right">${sourceBadge}</td>
            </tr>`;
            tbody.innerHTML += row;
        });

    } catch (e) { console.error(e); }
}

// Hàm thoát về web cũ
window.exitProMode = function() {
    document.getElementById('pm-header').remove();
    document.getElementById('view-market-pro').remove();
    
    // Hiện lại web cũ
    const oldApps = document.querySelectorAll('.hidden-view');
    oldApps.forEach(el => el.classList.remove('hidden-view'));
    
    // Chạy lại grid cũ nếu cần
    if(typeof renderGrid === 'function') renderGrid();
}
