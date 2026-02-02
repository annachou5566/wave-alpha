const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. QUAN TRỌNG: Thêm thẻ Meta để bypass chặn ảnh của Binance
    if (!document.querySelector('meta[name="referrer"]')) {
        const meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer";
        document.head.appendChild(meta);
    }

    // Cleanup cũ
    document.getElementById('alpha-plugin-root')?.remove();
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();

    // Inject CSS
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    injectHTML();

    // Check role
    if (localStorage.getItem('wave_alpha_role') === 'admin') {
        // Khởi tạo tab mặc định mà không cần hiệu ứng
        const nav = document.getElementById('alpha-tab-nav');
        if (nav) nav.style.display = 'flex';
        window.pluginSwitchTab('alpha', true); // true = instant
    }

    initMarket();
    setupEvents();
});

// --- LOGIC CHUYỂN TAB MƯỢT MÀ ---
window.pluginSwitchTab = (tab, instant = false) => {
    const nav = document.getElementById('alpha-tab-nav');
    if (nav) nav.style.display = 'flex';

    const newView = document.getElementById('alpha-market-view');
    const oldView = document.getElementById('view-dashboard'); // Giả sử ID view cũ là view-dashboard
    
    const btnA = document.getElementById('btn-tab-alpha');
    const btnC = document.getElementById('btn-tab-competition');

    // Cập nhật nút active ngay lập tức
    if (tab === 'alpha') {
        btnA?.classList.add('active');
        btnC?.classList.remove('active');
    } else {
        btnC?.classList.add('active');
        btnA?.classList.remove('active');
    }

    // Nếu muốn chuyển ngay lập tức (lần đầu load)
    if (instant) {
        if (tab === 'alpha') {
            if(newView) newView.style.display = 'block';
            if(oldView) oldView.style.display = 'none';
        } else {
            if(newView) newView.style.display = 'none';
            if(oldView) oldView.style.display = 'block';
        }
        return;
    }

    // Hiệu ứng Fade
    const currentVisible = tab === 'alpha' ? oldView : newView;
    const nextVisible = tab === 'alpha' ? newView : oldView;

    if (currentVisible) {
        currentVisible.classList.add('fade-out');
        // Đợi 300ms cho hiệu ứng mờ đi xong mới ẩn hẳn
        setTimeout(() => {
            currentVisible.style.display = 'none';
            currentVisible.classList.remove('fade-out');
            
            if (nextVisible) {
                nextVisible.style.display = 'block';
                // Trigger reflow nhẹ
                void nextVisible.offsetWidth;
                nextVisible.classList.remove('fade-out'); // Đảm bảo nó hiện
            }
        }, 300);
    } else {
        // Trường hợp không tìm thấy view cũ
        if (nextVisible) nextVisible.style.display = 'block';
    }
};

window.pluginSort = (key) => {
    if (sortConfig.key === key) sortConfig.dir = sortConfig.dir === 'desc' ? 'asc' : 'desc';
    else { sortConfig.key = key; sortConfig.dir = 'desc'; }
    renderTable();
};

window.pluginCopy = (txt) => { 
    if(txt) {
        navigator.clipboard.writeText(txt);
        const t = document.createElement('div');
        t.innerText = 'COPIED';
        t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00F0FF;color:#000;padding:6px 12px;font-weight:800;border-radius:4px;z-index:999999;box-shadow:0 0 10px #00F0FF;font-family:sans-serif;';
        document.body.appendChild(t);
        setTimeout(()=>t.remove(), 1500);
    }
};

function injectHTML() {
    const root = document.createElement('div');
    root.id = 'alpha-plugin-root';
    root.innerHTML = `
        <div id="alpha-tab-nav" style="display:none; justify-content:center; gap:20px; padding: 20px 0;">
            <button id="btn-tab-alpha" class="tab-btn" onclick="window.pluginSwitchTab('alpha')">
                <i class="fas fa-layer-group"></i> ALPHA MARKET <span class="badge-pro">PRO</span>
            </button>
            <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">
                <i class="fas fa-trophy"></i> COMPETITION
            </button>
        </div>

        <div id="alpha-market-view" style="display:none; opacity:1;">
            <div class="alpha-container">
                <div class="alpha-header">
                    <div class="search-group">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" id="alpha-search" placeholder="Search Token / Contract..." autocomplete="off">
                    </div>
                    <div class="time-badge" id="last-updated">Connecting...</div>
                </div>
                <div class="table-responsive">
                    <table class="alpha-table">
                        <thead>
                            <tr class="h-top">
                                <th rowspan="2" class="text-center" style="width:40px">#</th>
                                <th rowspan="2" style="min-width:200px">TOKEN INFO</th>
                                <th rowspan="2" class="text-end">PRICE</th>
                                <th colspan="3" class="text-center group-col">DAILY VOLUME (UTC)</th>
                                <th colspan="3" class="text-center">MARKET STATS (24h)</th>
                            </tr>
                            <tr class="h-sub">
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_total')">TOTAL</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_limit')">LIMIT</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_onchain')">ON-CHAIN</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.rolling_24h')">VOL 24H</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('tx_count')">TXs</th>
                                <th class="text-end cursor-pointer" onclick="window.pluginSort('liquidity')">LIQ</th>
                            </tr>
                        </thead>
                        <tbody id="market-table-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);
}

async function initMarket() { await fetchMarketData(); setInterval(fetchMarketData, 60000); }
async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const data = await res.json();
        allTokens = data.tokens || [];
        renderTable();
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'Updated: ' + (data.last_updated || new Date().toLocaleTimeString());
    } catch (e) { console.error("Data error:", e); }
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let list = allTokens.filter(t => {
        const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
        return (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term));
    });

    list.sort((a, b) => {
        const valA = getVal(a, sortConfig.key);
        const valB = getVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });

    list.slice(0, displayCount).forEach((t, i) => {
        const tr = document.createElement('tr');
        const now = Date.now();
        let badgesHtml = '';

        // Logic Badge
        if (t.status === 'ALPHA' && t.offline === true) { // Giả sử logic offline
             // Custom logic nếu cần
        }

        if (t.listing_time && t.mul_point) {
            const expiryTime = t.listing_time + 2592000000; // 30 ngày
            const diffDays = Math.ceil((expiryTime - now) / 86400000);
            if (diffDays > 0) {
                badgesHtml += `<span class="smart-badge badge-alpha">[x${t.mul_point} ${diffDays}d]</span>`;
                if (t.chain === 'BSC' && t.mul_point >= 4) tr.classList.add('glow-row');
            }
        }

        // Hình ảnh fallback
        const tokenImg = t.icon || 'assets/tokens/default.png';
        const chainImg = t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge" onerror="this.style.display='none'">` : '';

        tr.innerHTML = `
            <td class="text-center font-num text-secondary">${i + 1}</td>
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenImg}" class="token-logo" onerror="this.src='assets/tokens/default.png'">
                        ${chainImg}
                    </div>
                    <div class="token-meta">
                        <div class="symbol-row" onclick="window.pluginCopy('${t.contract}')">
                            <span class="symbol-text">${t.symbol}</span>
                            <i class="fas fa-copy copy-icon"></i>
                        </div>
                        <div class="badge-row">${badgesHtml}</div>
                    </div>
                </div>
            </td>
            <td class="text-end font-num">
                <div class="text-white-bold">$${formatPrice(t.price)}</div>
                <div style="font-size:11px" class="${t.change_24h >= 0 ? 'text-green' : 'text-red'}">
                    ${t.change_24h >= 0 ? '+' : ''}${t.change_24h}%
                </div>
            </td>
            <td class="text-end font-num text-white-bold">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end font-num text-dim">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-neon border-right-dim">$${formatNum(t.volume.daily_onchain)}</td>
            <td class="text-end font-num text-white">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num text-secondary">${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-brand">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatNum(n) { if (!n) return '0'; if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k'; return n.toFixed(2); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }
function setupEvents() { document.getElementById('alpha-search')?.addEventListener('keyup', () => renderTable()); window.addEventListener('scroll', () => { if (document.getElementById('alpha-market-view')?.style.display === 'block') { if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) { if (displayCount < allTokens.length) { displayCount += 50; renderTable(); } } } }); }