const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let pinnedTokens = JSON.parse(localStorage.getItem('alpha_pins')) || [];
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. Meta bypass
    if (!document.querySelector('meta[name="referrer"]')) {
        const meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer";
        document.head.appendChild(meta);
    }

    // 2. Inject CSS
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    // 3. Xây dựng giao diện (Dựa trên Navbar có sẵn)
    injectLayout();

    // 4. Init logic
    if (localStorage.getItem('wave_alpha_role') === 'admin') {
        window.pluginSwitchTab('alpha', true);
    }
    initMarket();
    setupEvents();
});

// --- HÀM CHÈN LAYOUT VÀO SAU NAVBAR CÓ SẴN ---
function injectLayout() {
    // Xóa các element cũ nếu có
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();

    // TÌM NAVBAR CÓ SẴN TRONG INDEX.HTML
    const navbar = document.querySelector('.navbar');
    if (!navbar) {
        console.error("Không tìm thấy .navbar! Kiểm tra lại file index.html");
        return;
    }

    // 1. Tạo thanh Tab
    const tabNav = document.createElement('div');
    tabNav.id = 'alpha-tab-nav';
    tabNav.innerHTML = `
        <button id="btn-tab-alpha" class="tab-btn" onclick="window.pluginSwitchTab('alpha')">
            <i class="fas fa-layer-group"></i> ALPHA MARKET
        </button>
        <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">
            <i class="fas fa-trophy"></i> COMPETITION
        </button>
    `;

    // CHÈN THANH TAB NGAY SAU NAVBAR
    navbar.insertAdjacentElement('afterend', tabNav);

    // 2. Tạo Market View
    const marketView = document.createElement('div');
    marketView.id = 'alpha-market-view';
    marketView.style.display = 'none'; // Mặc định ẩn
    marketView.innerHTML = `
        <div class="alpha-container" style="padding-top: 20px;">
            <div class="alpha-header">
            
                <div class="search-group">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="alpha-search" placeholder="Search Token / Contract..." autocomplete="off">
                </div>
                
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
    `;

    // CHÈN MARKET VIEW NGAY SAU THANH TAB
    tabNav.insertAdjacentElement('afterend', marketView);
}

// --- LOGIC CHUYỂN TAB ---
window.pluginSwitchTab = (tab, instant = false) => {
    const alphaView = document.getElementById('alpha-market-view');
    const compView = document.getElementById('view-dashboard'); // View cũ có sẵn của bạn
    
    const btnA = document.getElementById('btn-tab-alpha');
    const btnC = document.getElementById('btn-tab-competition');

    if (tab === 'alpha') {
        btnA?.classList.add('active');
        btnC?.classList.remove('active');
        
        // Ẩn Competition, Hiện Alpha
        if(compView) compView.style.display = 'none';
        if(alphaView) alphaView.style.display = 'block';
    } else {
        btnC?.classList.add('active');
        btnA?.classList.remove('active');

        // Ẩn Alpha, Hiện Competition
        if(alphaView) alphaView.style.display = 'none';
        if(compView) compView.style.display = 'block';
    }
};

// ... COPY LẠI CÁC HÀM CŨ (sort, copy, fetchMarketData, renderTable, format...) ...
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

    /* --- SỬA LẠI ĐOẠN SORT --- */
    list.sort((a, b) => {
        // Kiểm tra xem token có được Pin không
        const pinA = pinnedTokens.includes(a.symbol);
        const pinB = pinnedTokens.includes(b.symbol);

        // Logic: Nếu A được Pin thì A lên đầu (return -1)
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;

        // Nếu cả 2 cùng Pin hoặc cùng không Pin thì sort như bình thường
        const valA = getVal(a, sortConfig.key);
        const valB = getVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });

    /* --- THAY THẾ TOÀN BỘ ĐOẠN RENDER TRONG VÒNG LẶP --- */
    list.slice(0, displayCount).forEach((t, i) => {
        const tr = document.createElement('tr');
        const now = Date.now();
        
        // 1. Xử lý Badge (Yêu cầu 1)
        let badgesHtml = '';
        
        // Badge Spot/Delisted (Giữ nguyên logic cũ của bạn)
        if (t.offline === true) {
            if (t.listingCex === true) badgesHtml += '<span class="smart-badge badge-spot">SPOT</span>';
            else badgesHtml += '<span class="smart-badge badge-delisted">DELISTED</span>';
        }

        // Badge Multiplier (SỬA Ở ĐÂY: Bỏ ngoặc [], thêm màu vàng cho BSC)
        if (t.listing_time && t.mul_point) {
            const expiryTime = t.listing_time + 2592000000; 
            const diffDays = Math.ceil((expiryTime - now) / 86400000);

            if (diffDays > 0) {
                // Logic màu sắc: Nếu là BSC thì dùng class 'badge-bsc', ngược lại dùng 'badge-alpha'
                const badgeClass = (t.chain === 'BSC') ? 'badge-bsc' : 'badge-alpha';
                
                // Nội dung: Bỏ dấu ngoặc vuông [ ]
                badgesHtml += `<span class="smart-badge ${badgeClass}">x${t.mul_point} ${diffDays}d</span>`;
                
                // Glow row (Giữ nguyên)
                if (t.chain === 'BSC' && t.mul_point >= 4) {
                    tr.classList.add('glow-row');
                }
            }
        }

        const tokenImg = t.icon || 'assets/tokens/default.png';
        const chainBadgeHtml = t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge" onerror="this.style.display='none'">` : '';

        // 2. Xử lý Ngôi sao Pin (Yêu cầu 3)
        const isPinned = pinnedTokens.includes(t.symbol);
        // Nếu đã pin: sao đặc (fas), màu brand. Chưa pin: sao rỗng (far), màu tối.
        const starClass = isPinned ? 'fas fa-star text-brand' : 'far fa-star text-secondary';

        tr.innerHTML = `
            <td class="text-center">
                <i class="${starClass} star-icon" onclick="window.togglePin('${t.symbol}')"></i>
            </td>
            
            <td>
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${tokenImg}" class="token-logo" onerror="this.onerror=null;this.src='assets/tokens/default.png'">
                        ${chainBadgeHtml}
                    </div>
                    <div class="token-meta">
                        <div class="symbol-row" onclick="window.pluginCopy('${t.contract}')" title="Copy Contract">
                            <span class="symbol-text">${t.symbol}</span>
                            <i class="fas fa-copy copy-icon" style="font-size:10px; margin-left:5px; opacity:0.6"></i>
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
            
            <td class="text-end font-num text-neon border-right-dim">$${formatNum(t.volume.daily_limit)}</td>
            
            <td class="text-end font-num text-dim">$${formatNum(t.volume.daily_onchain)}</td>
            
            <td class="text-end font-num text-white">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num text-secondary">${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-brand">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}
/* --- CODE MỚI HOÀN TOÀN --- */
window.togglePin = (symbol) => {
    // Nếu đang Pin thì bỏ Pin, chưa Pin thì thêm vào
    if (pinnedTokens.includes(symbol)) {
        pinnedTokens = pinnedTokens.filter(s => s !== symbol);
    } else {
        pinnedTokens.push(symbol);
    }
    // Lưu vào bộ nhớ máy
    localStorage.setItem('alpha_pins', JSON.stringify(pinnedTokens));
    // Vẽ lại bảng ngay lập tức
    renderTable();
};
function formatNum(n) { if (!n) return '0'; if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k'; return n.toFixed(2); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }
function setupEvents() { document.getElementById('alpha-search')?.addEventListener('keyup', () => renderTable()); window.addEventListener('scroll', () => { if (document.getElementById('alpha-market-view')?.style.display === 'block') { if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) { if (displayCount < allTokens.length) { displayCount += 50; renderTable(); } } } }); }