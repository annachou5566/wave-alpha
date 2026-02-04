const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let pinnedTokens = JSON.parse(localStorage.getItem('alpha_pins')) || [];
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };
let currentFilter = 'ALL';
let filterPoints = false;

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

// --- HÀM 1: TÍNH TOÁN SỐ LIỆU & RENDER BẢNG ---
function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // 1. KHỞI TẠO BIẾN THỐNG KÊ (Đã thêm object 'distribution' cho biểu đồ mới)
    let stats = {
        totalScan: allTokens.length,
        countActive: 0, countSpot: 0, countDelisted: 0,
        alphaDailyTotal: 0, alphaDailyLimit: 0, alphaDailyChain: 0,
        alphaRolling24h: 0, alphaMarketCap: 0,
        gainers: 0, losers: 0,
        // Thùng chứa dữ liệu phân bổ biến động giá (Histogram)
        distribution: {
            // Tăng giá (Xanh)
            up_8: 0, up_6_8: 0, up_4_6: 0, up_2_4: 0, up_0_2: 0,
            // Giảm giá (Đỏ)
            down_0_2: 0, down_2_4: 0, down_4_6: 0, down_6_8: 0, down_8: 0,
            // Giá trị cao nhất để vẽ chiều cao cột
            maxCount: 0 
        }
    };

    allTokens.forEach(t => {
        const status = getTokenStatus(t);
        
        // Phân loại Trạng thái
        if (status === 'SPOT') stats.countSpot++;
        else if (status === 'DELISTED') stats.countDelisted++;
        else {
            stats.countActive++;
            stats.alphaDailyTotal += (t.volume?.daily_total || 0);
            stats.alphaDailyLimit += (t.volume?.daily_limit || 0);
            stats.alphaDailyChain += (t.volume?.daily_onchain || 0);
            stats.alphaRolling24h += (t.volume?.rolling_24h || 0);
            stats.alphaMarketCap += (t.market_cap || 0);

            // Phân loại Tăng/Giảm chung
            const chg = t.change_24h || 0;
            if (chg >= 0) stats.gainers++;
            else stats.losers++;

            // --- LOGIC MỚI: PHÂN LOẠI VÀO CÁC THÙNG % (Histogram) ---
            const abs = Math.abs(chg);
            if (chg >= 0) {
                if (abs >= 8) stats.distribution.up_8++;
                else if (abs >= 6) stats.distribution.up_6_8++;
                else if (abs >= 4) stats.distribution.up_4_6++;
                else if (abs >= 2) stats.distribution.up_2_4++;
                else stats.distribution.up_0_2++;
            } else {
                if (abs >= 8) stats.distribution.down_8++;
                else if (abs >= 6) stats.distribution.down_6_8++;
                else if (abs >= 4) stats.distribution.down_4_6++;
                else if (abs >= 2) stats.distribution.down_2_4++;
                else stats.distribution.down_0_2++;
            }
        }
    });

    // Tìm cột cao nhất để scale biểu đồ cho đẹp (tránh bị lùn quá hoặc cao quá)
    const d = stats.distribution;
    stats.distribution.maxCount = Math.max(
        d.up_8, d.up_6_8, d.up_4_6, d.up_2_4, d.up_0_2,
        d.down_0_2, d.down_2_4, d.down_4_6, d.down_6_8, d.down_8, 1
    );

    // Vẽ HUD
    renderMarketHUD(stats);

    // 2. LỌC & SẮP XẾP BẢNG (Giữ nguyên logic cũ của bạn)
    let list = allTokens.filter(t => {
        const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
        const matchSearch = (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term));
        if (!matchSearch) return false;
        
        const status = getTokenStatus(t);
        if (currentFilter !== 'ALL' && status !== currentFilter) return false;
        if (filterPoints && (t.mul_point || 1) <= 1) return false;
        return true; 
    });

    list.sort((a, b) => {
        const pinA = pinnedTokens.includes(a.symbol);
        const pinB = pinnedTokens.includes(b.symbol);
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;

        const valA = getVal(a, sortConfig.key);
        const valB = getVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });

    // 3. RENDER CÁC DÒNG (Giữ nguyên logic cũ của bạn)
    list.slice(0, displayCount).forEach((t, i) => {
        const tr = document.createElement('tr');
        const now = Date.now();
        
        let startBadges = [];
        if (t.onlineTge) startBadges.push('<span class="smart-badge badge-tge">TGE</span>');
        if (t.onlineAirdrop) startBadges.push('<span class="smart-badge badge-airdrop">AIRDROP</span>');
        let journeyHtml = startBadges.join(' ');
        
        // Logic badge Status chuẩn
        const status = getTokenStatus(t);
        if (status === 'SPOT') {
            let endBadge = '<span class="smart-badge badge-spot">SPOT</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        } else if (status === 'DELISTED' || status === 'PRE_DELISTED') {
            let endBadge = '<span class="smart-badge badge-delisted">DELISTED</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        }

        let dateHtml = '';
        if (t.listing_time) {
            const d = new Date(t.listing_time);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            dateHtml = `<div class="journey-date"><i class="far fa-clock"></i> ${dateStr}</div>`;
        }

        let mulBadgeHtml = '';
        if (!t.offline && t.listing_time && t.mul_point > 1) {
            const expiryTime = t.listing_time + 2592000000;
            const diffDays = Math.ceil((expiryTime - now) / 86400000);
            if (diffDays > 0) {
                const badgeClass = (t.chain === 'BSC') ? 'badge-bsc' : 'badge-alpha';
                mulBadgeHtml = `<span class="smart-badge ${badgeClass}" style="margin-left:5px;">x${t.mul_point} ${diffDays}d</span>`;
            }
        }

        const shortContract = t.contract ? `${t.contract.substring(0, 6)}...${t.contract.substring(t.contract.length - 4)}` : '';
        const tokenImg = t.icon || 'assets/tokens/default.png';
        const chainBadgeHtml = t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge" onerror="this.style.display='none'">` : '';

        tr.innerHTML = `
            <td class="text-center col-fix-1">
                <i class="${pinnedTokens.includes(t.symbol) ? 'fas fa-star text-brand' : 'far fa-star text-secondary'} star-icon" onclick="window.togglePin('${t.symbol}')"></i>
            </td>
            <td class="col-fix-2">
                <div class="token-cell" style="justify-content: flex-start;">
                    <div class="logo-wrapper">
                        <img src="${tokenImg}" class="token-logo" onerror="this.src='assets/tokens/default.png'">
                        ${chainBadgeHtml}
                    </div>
                    <div class="token-meta-container" style="display:block; width:auto; border:none; padding:0;">
                         <div class="symbol-row">
                            <span class="symbol-text">${t.symbol}</span>
                            ${mulBadgeHtml}
                        </div>
                        <div class="contract-row" onclick="window.pluginCopy('${t.contract}')" style="cursor:pointer; opacity:0.6; font-size:10px; margin-top:2px;">
                            ${shortContract} <i class="fas fa-copy"></i>
                        </div>
                    </div>
                </div>
            </td>
            <td style="padding-left:15px; vertical-align: middle;">
                <div style="margin-bottom: 4px;">${journeyHtml}</div>
                ${dateHtml}
            </td>
            <td class="text-end">
                <div class="text-primary-val">$${formatPrice(t.price)}</div>
                <div style="font-size:11px; font-weight:700; margin-top:2px" class="${t.change_24h >= 0 ? 'text-green' : 'text-red'}">
                    ${t.change_24h >= 0 ? '▲' : '▼'} ${Math.abs(t.change_24h)}%
                </div>
            </td>
            <td class="chart-cell">${getSparklineSVG(t.chart)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.volume.daily_onchain)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num text-secondary-val">${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- HÀM 2: VẼ DASHBOARD (MARKET HUD) ---
function renderMarketHUD(stats) {
    const view = document.getElementById('alpha-market-view');
    if (!view) return;

    const container = view.querySelector('.alpha-container'); 
    if (!container) return;

    let hud = document.getElementById('market-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'market-hud';
        hud.className = 'market-hud-container';
        const header = container.querySelector('.alpha-header');
        if (header) container.insertBefore(hud, header); 
        else container.prepend(hud);
    }

    // Tính toán các phần trăm cơ bản
    const pctActive = stats.totalScan > 0 ? (stats.countActive / stats.totalScan) * 100 : 0;
    const pctSpot = stats.totalScan > 0 ? (stats.countSpot / stats.totalScan) * 100 : 0;
    const pctDelist = stats.totalScan > 0 ? (stats.countDelisted / stats.totalScan) * 100 : 0;
    const limitPct = stats.alphaDailyTotal > 0 ? (stats.alphaDailyLimit / stats.alphaDailyTotal) * 100 : 0;
    const chainPct = stats.alphaDailyTotal > 0 ? (stats.alphaDailyChain / stats.alphaDailyTotal) * 100 : 0;

    // --- HELPER VẼ CỘT HISTOGRAM ---
    // Hàm này vẽ 1 cột gồm: Số lượng (trên) -> Cột (giữa) -> Nhãn (dưới)
    const drawBar = (count, label, colorClass) => {
        // Chiều cao tối đa của cột là 40px. Tính tỷ lệ theo maxCount.
        // Đảm bảo cột có dữ liệu thì tối thiểu cao 4px để dễ nhìn.
        let h = (count / stats.distribution.maxCount) * 40;
        if (count > 0 && h < 4) h = 4;
        
        return `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end; width:100%;">
                <div style="font-size:10px; color:${count > 0 ? '#fff' : '#444'}; margin-bottom:2px; font-weight:700;">${count > 0 ? count : ''}</div>
                <div style="width:100%; height:${h}px; border-radius:2px 2px 0 0;" class="${colorClass}"></div>
                <div style="font-size:9px; color:#5E6673; margin-top:4px;">${label}</div>
            </div>
        `;
    };

    const d = stats.distribution;

    hud.innerHTML = `
        <div class="hud-module">
            <div class="hud-title">TOKEN LIFECYCLE (ALL TIME)</div>
            <div class="hud-main-value" style="margin-bottom: 20px;">${stats.totalScan} <span style="font-size:12px; color:#5E6673">TOKENS</span></div>
            
            <div class="hud-stats-row">
                <div class="hud-stat-item"><span class="hud-dot bg-active"></span> Active: ${stats.countActive}</div>
                <div class="hud-stat-item"><span class="hud-dot bg-spot"></span> Spot: ${stats.countSpot}</div>
                <div class="hud-stat-item"><span class="hud-dot bg-delist"></span> Delisted: ${stats.countDelisted}</div>
            </div>
            
            <div class="hud-progress-bar">
                <div class="bar-segment bar-active" style="width: ${pctActive}%"></div>
                <div class="bar-segment bar-spot" style="width: ${pctSpot}%"></div>
                <div class="bar-segment bar-delist" style="width: ${pctDelist}%"></div>
            </div>
        </div>

        <div class="hud-module border-left-dim">
            <div class="hud-title">DAILY VOL STRUCTURE (UTC 0:00)</div>
            <div class="hud-main-value text-neon">$${formatNum(stats.alphaDailyTotal)}</div>
            <div class="hud-sub-label" style="margin-bottom:12px;">Active Tokens Only (Limit + On-Chain)</div>

            <div class="hud-stats-row">
                <div class="hud-stat-item text-purple">Limit: $${formatNum(stats.alphaDailyLimit)} (${Math.round(limitPct)}%)</div>
                <div class="hud-stat-item text-orange">Chain: $${formatNum(stats.alphaDailyChain)} (${Math.round(chainPct)}%)</div>
            </div>

            <div class="hud-progress-bar">
                <div class="bar-segment bar-limit" style="width: ${limitPct}%"></div>
                <div class="bar-segment bar-chain" style="width: ${chainPct}%"></div>
            </div>
        </div>

        <div class="hud-module border-left-dim" style="justify-content: flex-start;">
            <div class="hud-title">Biến động 24h</div>
            
            <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 80px; gap: 3px; padding-bottom:5px;">
                ${drawBar(d.up_0_2, '0-2%', 'bar-green-dim')}
                ${drawBar(d.up_2_4, '2-4%', 'bar-green-mid')}
                ${drawBar(d.up_4_6, '4-6%', 'bar-green')}
                ${drawBar(d.up_6_8, '6-8%', 'bar-green')}
                ${drawBar(d.up_8, '>8%', 'bar-green')}
                
                <div style="width:10px;"></div>

                ${drawBar(d.down_0_2, '0-2%', 'bar-red-dim')}
                ${drawBar(d.down_2_4, '2-4%', 'bar-red-mid')}
                ${drawBar(d.down_4_6, '4-6%', 'bar-red')}
                ${drawBar(d.down_6_8, '6-8%', 'bar-red')}
                ${drawBar(d.down_8, '>8%', 'bar-red')}
            </div>

            <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: auto;">
                <div style="color: #0ecb81; font-weight: 700; font-family: var(--font-num); font-size: 16px;">
                    <i class="fas fa-arrow-up" style="font-size:12px; transform: rotate(45deg);"></i> ${stats.gainers}
                </div>
                <div style="color: #f6465d; font-weight: 700; font-family: var(--font-num); font-size: 16px;">
                    ${stats.losers} <i class="fas fa-arrow-down" style="font-size:12px; transform: rotate(45deg);"></i>
                </div>
            </div>
        </div>
    `;
    
    // --- INJECT CSS NHANH CHO BIỂU ĐỒ MỚI (Khỏi sửa file CSS) ---
    // Bạn có thể đưa vào file CSS nếu muốn gọn code JS
    const styleId = 'hud-sentiment-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .bar-green { background: #0ecb81; opacity: 1; }
            .bar-green-mid { background: #0ecb81; opacity: 0.7; }
            .bar-green-dim { background: #0ecb81; opacity: 0.4; }
            
            .bar-red { background: #f6465d; opacity: 1; }
            .bar-red-mid { background: #f6465d; opacity: 0.7; }
            .bar-red-dim { background: #f6465d; opacity: 0.4; }
        `;
        document.head.appendChild(style);
    }
}


function injectLayout() {
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();

    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    // 1. Tab Navigation
    const tabNav = document.createElement('div');
    tabNav.id = 'alpha-tab-nav';
    tabNav.innerHTML = `
        <button id="btn-tab-alpha" class="tab-btn" onclick="window.pluginSwitchTab('alpha')">ALPHA MARKET</button>
        <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">COMPETITION</button>
    `;
    navbar.insertAdjacentElement('afterend', tabNav);

    // 2. Market View (Với Toolbar Mới)
    const marketView = document.createElement('div');
    marketView.id = 'alpha-market-view';
    marketView.style.display = 'none'; 
    marketView.innerHTML = `
        <div class="alpha-container" style="padding-top: 20px;">
            
            <div class="alpha-header">
                <div class="filter-group">
                    <button class="filter-btn active-all" id="btn-f-all" onclick="setFilter('ALL')">All</button>
                    <button class="filter-btn" id="btn-f-alpha" onclick="setFilter('ALPHA')">Alpha</button>
                    <button class="filter-btn" id="btn-f-spot" onclick="setFilter('SPOT')">Spot</button>
                    <button class="filter-btn" id="btn-f-delist" onclick="setFilter('DELISTED')">Delisted</button>
                    <button class="filter-btn points-btn" id="btn-f-points" onclick="togglePoints()">Points +</button>
                </div>

                <div class="search-group">
                    <i class="fas fa-search search-icon-small"></i>
                    <input type="text" id="alpha-search" placeholder="Search Token / Contract..." autocomplete="off">
                </div>
            </div>

            <div class="table-responsive">
                <table class="alpha-table">
                    
<thead>
                        <tr class="h-top">
                            <th rowspan="2" class="text-center col-fix-1">#</th>
                            
                            <th rowspan="2" class="col-fix-2">TOKEN</th>
                            
                            <th rowspan="2" style="min-width:120px; padding-left:15px">STATUS</th>
                            
                            <th rowspan="2" class="text-end">PRICE</th>
                            <th rowspan="2" class="text-center">CHART (20D)</th>
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
        // Gọi file JSON từ R2 (qua Middleware)
        const res = await fetch(DATA_URL + '?t=' + Date.now());
        const json = await res.json();
        
        // --- [SỬA ĐOẠN NÀY] ---
        // Code cũ: allTokens = data.tokens || [];
        // Code mới: Lấy mảng 'data' từ R2 và giải mã từng token
        const rawList = json.data || json.tokens || []; 
        allTokens = rawList.map(item => unminifyToken(item));
        
        updateSummary();
        renderTable();

        // Cập nhật giờ (Lấy từ meta.u nếu có)
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) {
            const timeStr = json.meta ? json.meta.u : (json.last_updated || new Date().toLocaleTimeString());
            timeLbl.innerText = 'Updated: ' + timeStr;
        }

    } catch (e) { 
        console.error("Data error:", e); 
    }
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


function formatNum(n) {
    if (!n) return '0';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return !n ? '0' : (n < 0.0001 ? n.toExponential(2) : n.toFixed(4)); }
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }
function setupEvents() { document.getElementById('alpha-search')?.addEventListener('keyup', () => renderTable()); window.addEventListener('scroll', () => { if (document.getElementById('alpha-market-view')?.style.display === 'block') { if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) { if (displayCount < allTokens.length) { displayCount += 50; renderTable(); } } } }); }


// [SỬA LẠI] Helper: Xác định trạng thái Token
function getTokenStatus(t) {
    // Ưu tiên 1: Lấy trực tiếp trạng thái từ Python gửi về (Đã chuẩn hóa)
    if (t.status) {
        return t.status.toUpperCase();
    }

    // Fallback (Phòng hờ): Nếu không có status thì mới check thủ công
    // Lưu ý: Dùng t.offline (truthy) thay vì t.offline === true
    if (t.offline) {
        if (t.listingCex) return 'SPOT';
        return 'DELISTED';
    }
    
    return 'ALPHA'; // Mặc định là Active
}

function updateSummary() {
    let total = allTokens.length;
    let spot = 0;
    let delisted = 0;
    let alpha = 0;

    allTokens.forEach(t => {
        // Lấy trạng thái (đảm bảo viết hoa 100% để so sánh chuẩn)
        const s = (t.status || '').toUpperCase();

        if (s === 'SPOT') {
            spot++;
        } else if (s === 'DELISTED' || s === 'PRE_DELISTED') {
            delisted++;
        } else {
            alpha++; // Còn lại là ALPHA (Active)
        }
    });

    // --- Cập nhật lên giao diện HTML ---
    
    // 1. Cập nhật số lượng Text
    const elTotal = document.getElementById('stat-total-tokens');
    const elActive = document.getElementById('stat-active-tokens');
    const elSpot = document.getElementById('stat-spot-tokens');
    const elDelist = document.getElementById('stat-delisted-tokens');

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = alpha;
    if (elSpot) elSpot.innerText = spot;
    if (elDelist) elDelist.innerText = delisted;

    // 2. Tính Spot Rate (Tỷ lệ Spot / Tổng)
    const elRate = document.getElementById('stat-spot-rate');
    if (elRate) {
        // Chỉ tính trên tập (Spot + Delisted + Alpha) hoặc Total tuỳ logic bạn
        // Ở đây tính: Spot / Total
        const rate = total > 0 ? ((spot / total) * 100).toFixed(1) : "0.0";
        elRate.innerText = `${rate}%`;
        
        // Đổi màu nếu tỷ lệ cao
        if (parseFloat(rate) > 10) elRate.style.color = '#00ff88'; // Xanh
        else elRate.style.color = '#eaecef'; // Trắng
    }
}

// Xử lý khi click vào thẻ Filter
window.toggleFilter = (filterType) => {
    // Nếu bấm lại thẻ đang chọn -> Hủy filter (về ALL)
    if (currentFilter === filterType) {
        currentFilter = 'ALL';
    } else {
        currentFilter = filterType;
    }
    
    // Highlight thẻ đang chọn
    document.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active-filter'));
    if (currentFilter === 'ALPHA') {
        document.getElementById('card-alpha-vol')?.classList.add('active-filter');
        document.getElementById('card-active')?.classList.add('active-filter');
    } else if (currentFilter === 'SPOT') {
        document.getElementById('card-spot')?.classList.add('active-filter');
    } else if (currentFilter === 'DELISTED') {
        document.getElementById('card-delist')?.classList.add('active-filter');
    }

    renderTable(); // Vẽ lại bảng
};

// --- HÀM VẼ BIỂU ĐỒ MINI (REAL VOLUME + PRICE LINE) ---
function getSparklineSVG(data) {
    // Kiểm tra dữ liệu đầu vào có chuẩn format mới không
    if (!data || !Array.isArray(data) || data.length < 2) return '';
    
    // Nếu dữ liệu cũ (chưa chạy python mới) thì return rỗng để tránh lỗi
    if (typeof data[0] !== 'object') return '';

    const width = 120;
    const height = 40;
    
    // Tách mảng giá và volume riêng để tính min/max
    const prices = data.map(d => d.p);
    const volumes = data.map(d => d.v);

    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const rangeP = maxP - minP || 1;

    const maxV = Math.max(...volumes) || 1; // Volume lớn nhất để làm trần

    // Màu sắc: Giá cuối > Giá đầu ? Xanh : Đỏ
    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#0ecb81' : '#f6465d'; 
    
    // 1. VẼ ĐƯỜNG GIÁ (LINE CHART) - Nằm lớp trên
    let points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        // Chừa 15px bên dưới cho Volume
        const y = (height - 15) - ((d.p - minP) / rangeP) * (height - 20) - 5; 
        return `${x},${y}`;
    }).join(' ');

    // 2. VẼ CỘT VOLUME THẬT (BAR CHART) - Nằm lớp dưới
    let bars = '';
    const barWidth = (width / (data.length - 1)) * 0.6; 

    data.forEach((d, i) => {
        // Chiều cao cột = (Volume hiện tại / Volume lớn nhất) * Chiều cao tối đa cho phép (14px)
        let barHeight = (d.v / maxV) * 14;
        
        // Đảm bảo cột thấp nhất cũng có 2px để nhìn thấy
        if (barHeight < 2) barHeight = 2;

        const x = (i / (data.length - 1)) * width; // Canh giữa theo điểm neo của line
        const y = height - barHeight; // Vẽ từ đáy lên
        
        bars += `<rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" opacity="0.3" rx="1" />`;
    });

    return `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="mini-chart" xmlns="http://www.w3.org/2000/svg">
            ${bars}
            
            <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;
}

// --- LOGIC FILTER MỚI ---
window.setFilter = function(status) {
    currentFilter = status;
    
    // Reset classes
    ['all', 'alpha', 'spot', 'delist'].forEach(k => {
        document.getElementById(`btn-f-${k}`)?.classList.remove(`active-${k}`);
    });

    // Add active class
    if (status === 'ALL') document.getElementById('btn-f-all').classList.add('active-all');
    if (status === 'ALPHA') document.getElementById('btn-f-alpha').classList.add('active-alpha');
    if (status === 'SPOT') document.getElementById('btn-f-spot').classList.add('active-spot');
    if (status === 'DELISTED') document.getElementById('btn-f-delist').classList.add('active-delist');

    renderTable();
};

window.togglePoints = function() {
    filterPoints = !filterPoints;
    const btn = document.getElementById('btn-f-points');
    
    if (filterPoints) {
        btn.classList.add('active-points');
    } else {
        btn.classList.remove('active-points');
    }
    renderTable();
};

// --- CẬP NHẬT BẢNG DỊCH MÃ ĐẦY ĐỦ ---
const KEY_MAP_REVERSE = {
  "i": "id", "s": "symbol", "n": "name", "ic": "icon",
  "cn": "chain", "ci": "chain_icon", // Đã có chain_icon
  "ct": "contract",
  "st": "status", "p": "price", "c": "change_24h", "mp": "mul_point", // Đã có mul_point
  "mc": "market_cap", "l": "liquidity", "v": "volume",
  "r24": "rolling_24h", "dt": "daily_total",
  "dl": "daily_limit", "do": "daily_onchain",
  "ch": "chart", "lt": "listing_time", "tx": "tx_count",
  "off": "offline", "cex": "listingCex",
  "tge": "onlineTge", "air": "onlineAirdrop"
};

// Hàm dịch dữ liệu: Biến 'p' thành 'price', 'v' thành 'volume'...
function unminifyToken(minifiedItem) {
  const fullItem = {};
  for (const [shortKey, value] of Object.entries(minifiedItem)) {
    const fullKey = KEY_MAP_REVERSE[shortKey];
    
    // Xử lý riêng trường Volume vì nó lồng bên trong
    if (fullKey === "volume" && typeof value === 'object') {
      fullItem[fullKey] = {};
      for (const [vKey, vVal] of Object.entries(value)) {
        fullItem[fullKey][KEY_MAP_REVERSE[vKey] || vKey] = vVal;
      }
    } 
    // Các trường khác copy bình thường
    else if (fullKey) {
      fullItem[fullKey] = value;
    }
  }
  return fullItem;
}
