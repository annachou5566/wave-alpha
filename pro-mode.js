/* pro-mode.js - FIX LOADING & CACHE BUG */

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

    // Inject HTML
    const navbar = document.querySelector('.navbar');
    if(navbar && !document.getElementById('pm-toolbar')) {
        navbar.insertAdjacentHTML('afterend', HTML_TOOLBAR);
        document.getElementById('pm-toolbar').insertAdjacentHTML('afterend', document.getElementById('view-market-pro')?.outerHTML || HTML_TOOLBAR.split('</div></div>')[1]);
        const ghost = document.querySelectorAll('#view-market-pro')[1]; if(ghost) ghost.remove();
    }

    switchMode('market');
    loadData();
})();

// --- HÀM TẢI DATA (THÊM LOG & CHỐNG CACHE) ---
async function loadData() {
    const tbody = document.getElementById('pm-body');
    
    // Thử 3 đường dẫn khác nhau
    // Thêm ?v=Time để ép trình duyệt không dùng Cache cũ
    const timestamp = Date.now();
    let paths = [
        `public/data/market-data.json?v=${timestamp}`, 
        `data/market-data.json?v=${timestamp}`, 
        `./market-data.json?v=${timestamp}`
    ];
    
    let data = null;
    let errorMsg = "";

    for (let p of paths) {
        try {
            console.log(`Trying to fetch: ${p}`);
            let res = await fetch(p);
            if (res.ok) {
                data = await res.json();
                console.log("✅ Success load from:", p);
                break;
            } else {
                errorMsg += `Failed ${p}: ${res.status} | `;
            }
        } catch(e) {
            errorMsg += `Error ${p}: ${e.message} | `;
        }
    }

    if (!data) {
        console.error("ALL PATHS FAILED:", errorMsg);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:#F6465D">
            <strong>❌ KHÔNG TẢI ĐƯỢC DỮ LIỆU!</strong><br>
            <small>${errorMsg}</small><br>
            <small>Vui lòng kiểm tra lại file public/data/market-data.json trên GitHub</small>
        </td></tr>`;
        return;
    }

    // --- RENDER DỮ LIỆU ---
    try {
        const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
        
        // Update Ticker (Dùng optional chaining ?. đề phòng null)
        if(data.global_stats) {
            document.getElementById('tk-total').innerText = fmt(data.global_stats.total_volume_24h || 0);
            document.getElementById('tk-limit').innerText = fmt(data.global_stats.total_limit_volume || 0);
            document.getElementById('tk-onchain').innerText = fmt(data.global_stats.total_onchain_volume || 0);
        }

        // Sort
        ALL_TOKENS = (data.tokens || []).sort((a,b) => (b.volume?.total || 0) - (a.volume?.total || 0));
        
        renderTable();
        
    } catch (renderError) {
        console.error("Render Error:", renderError);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red">JSON Format Error: ${renderError.message}</td></tr>`;
    }
}

function renderTable() {
    const tbody = document.getElementById('pm-body');
    const fmt = (n) => '$' + new Intl.NumberFormat('en-US', {maximumFractionDigits:0}).format(n);
    let html = '';
    
    ALL_TOKENS.slice(0, VISIBLE_COUNT).forEach(t => {
        const p = t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2);
        const cls = t.change_24h >= 0 ? 'c-up' : 'c-down';
        const sign = t.change_24h >= 0 ? '+' : '';
        const link = `https://www.binance.com/en/alpha/${t.id.replace('ALPHA_','')}`;
        
        html += `<tr onclick="window.open('${link}', '_blank')">
            <td style="padding-left:25px">
                <img src="${t.icon}" class="token-icon" onerror="this.src='assets/tokens/default.png'">
                <span style="font-weight:700;color:#fff">${t.symbol}</span> 
                <span style="font-size:12px;color:#666;margin-left:5px">${t.name}</span>
            </td>
            <td style="font-weight:700">$${p}</td>
            <td class="${cls}">${sign}${t.change_24h.toFixed(2)}%</td>
            <td style="color:#ddd">${fmt(t.liquidity || 0)}</td>
            <td style="color:#fff">${fmt(t.volume?.total || 0)}</td>
            <td class="c-purple">${fmt(t.volume?.limit || 0)}</td>
            <td class="c-blue">${fmt(t.volume?.onchain || 0)}</td>
            <td style="padding-right:25px;color:#888">${fmt(t.market_cap || 0)}</td>
        </tr>`;
    });
    
    if (ALL_TOKENS.length === 0) {
        html = `<tr><td colspan="8" style="text-align:center; padding:30px">No tokens found in data.</td></tr>`;
    }
    
    tbody.innerHTML = html;
    
    const btn = document.querySelector('.btn-more');
    if(VISIBLE_COUNT >= ALL_TOKENS.length) btn.style.display = 'none';
    else { btn.style.display = 'inline-block'; btn.innerHTML = `Show Next ${LOAD_STEP} Tokens <i class="fas fa-chevron-down"></i>`; }
}

window.loadMore = function() {
    document.querySelector('.btn-more').innerHTML = 'Loading...';
    setTimeout(() => { VISIBLE_COUNT += LOAD_STEP; renderTable(); }, 200);
}

window.switchMode = function(mode) {
    const m = document.getElementById('view-market-pro');
    const t = document.getElementById('view-dashboard');
    if(mode === 'market') {
        if(m) m.style.display = 'block';
        if(t) t.style.display = 'none';
        document.querySelectorAll('.hero-banner, .command-deck').forEach(e => e.style.display = 'none');
        document.getElementById('btn-tab-market').classList.add('active');
        document.getElementById('btn-tab-tourney').classList.remove('active');
    } else {
        if(m) m.style.display = 'none';
        if(t) t.style.display = 'block';
        document.querySelectorAll('.hero-banner, .command-deck').forEach(e => e.style.display = 'block');
        document.getElementById('btn-tab-market').classList.remove('active');
        document.getElementById('btn-tab-tourney').classList.add('active');
        if(typeof renderGrid === 'function') setTimeout(renderGrid, 100);
    }
};