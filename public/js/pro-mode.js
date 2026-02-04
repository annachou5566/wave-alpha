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
    
    // 1. KHỞI TẠO BIẾN THỐNG KÊ
    let stats = {
        totalScan: allTokens.length,
        countActive: 0, countSpot: 0, countDelisted: 0,
        alphaDailyTotal: 0, alphaDailyLimit: 0, alphaDailyChain: 0,
        alphaRolling24h: 0, 
        gainers: 0, losers: 0,
        // Dữ liệu cho biểu đồ phân phối (Sentiment)
        distribution: {
            up_8: 0, up_6_8: 0, up_4_6: 0, up_2_4: 0, up_0_2: 0,
            down_0_2: 0, down_2_4: 0, down_4_6: 0, down_6_8: 0, down_8: 0,
            maxCount: 0 
        },
        // Dữ liệu cho biểu đồ Volume (Top 30)
        topVolTokens: [] 
    };

    // Danh sách tạm để sort lấy Top 30
    let tempVolList = [];

    allTokens.forEach(t => {
        const status = getTokenStatus(t);
        
        // Phân loại Trạng thái
        if (status === 'SPOT') stats.countSpot++;
        else if (status === 'DELISTED') stats.countDelisted++;
        else {
            stats.countActive++;
            // Chỉ cộng dồn Volume của các token Active/Spot
            const v = t.volume || {};
            stats.alphaDailyTotal += (v.daily_total || 0);
            stats.alphaDailyLimit += (v.daily_limit || 0);
            stats.alphaDailyChain += (v.daily_onchain || 0);
            stats.alphaRolling24h += (v.rolling_24h || 0);
            
            // Đẩy vào danh sách tạm để tí nữa tìm Top 30 vẽ biểu đồ
            if ((v.daily_total || 0) > 0) {
                tempVolList.push(t);
            }

            // Phân loại Tăng/Giảm (Sentiment)
            const chg = t.change_24h || 0;
            if (chg >= 0) stats.gainers++; else stats.losers++;

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

    // Lấy Top 30 Token có Daily Vol lớn nhất để vẽ biểu đồ
    tempVolList.sort((a, b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0));
    stats.topVolTokens = tempVolList.slice(0, 30);

    // Tìm maxCount cho biểu đồ Sentiment
    const d = stats.distribution;
    stats.distribution.maxCount = Math.max(
        d.up_8, d.up_6_8, d.up_4_6, d.up_2_4, d.up_0_2,
        d.down_0_2, d.down_2_4, d.down_4_6, d.down_6_8, d.down_8, 1
    );

    // VẼ HUD (Giao diện 3 cột)
    renderMarketHUD(stats);

    // --- PHẦN RENDER BẢNG BÊN DƯỚI (GIỮ NGUYÊN) ---
    // (Logic lọc và render hàng bảng không thay đổi, giữ nguyên code cũ của bạn ở đây)
    renderTableRows(tbody); 
}

// Hàm phụ tách ra để code gọn hơn (Bạn copy đoạn render tr trong code cũ vào đây)
function renderTableRows(tbody) {
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

    list.slice(0, displayCount).forEach((t, i) => {
        // ... (COPY NGUYÊN VĂN ĐOẠN TẠO <tr> TỪ CODE CŨ CỦA BẠN VÀO ĐÂY) ...
        // Lưu ý: Nhớ dùng logic badge mới (status === 'SPOT'...)
        // Để cho gọn tôi không paste lại đoạn dài dòng đó, bạn giữ nguyên nhé.
        const tr = document.createElement('tr');
        
        // --- LOGIC BADGE CHUẨN ---
        const status = getTokenStatus(t);
        let startBadges = [];
        if (t.onlineTge) startBadges.push('<span class="smart-badge badge-tge">TGE</span>');
        if (t.onlineAirdrop) startBadges.push('<span class="smart-badge badge-airdrop">AIRDROP</span>');
        let journeyHtml = startBadges.join(' ');
        
        if (status === 'SPOT') {
            let endBadge = '<span class="smart-badge badge-spot">SPOT</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        } else if (status === 'DELISTED' || status === 'PRE_DELISTED') {
            let endBadge = '<span class="smart-badge badge-delisted">DELISTED</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        }

        // ... Các phần khác của dòng tr (Logo, Price, Chart...) giữ nguyên ...
        // (Nếu bạn cần tôi viết lại cả đoạn này thì bảo nhé, nhưng tôi nghĩ bạn copy được)
        
        // SAMPLE CODE RENDER DÒNG ĐỂ BẠN DỄ HÌNH DUNG:
        const tokenImg = t.icon || 'assets/tokens/default.png';
        const chainBadgeHtml = t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge">` : '';
        const shortContract = t.contract ? `${t.contract.substring(0, 6)}...` : '';
        
        tr.innerHTML = `
            <td class="text-center col-fix-1"><i class="${pinnedTokens.includes(t.symbol) ? 'fas fa-star text-brand' : 'far fa-star text-secondary'} star-icon" onclick="window.togglePin('${t.symbol}')"></i></td>
            <td class="col-fix-2">
                <div class="token-cell">
                    <div class="logo-wrapper"><img src="${tokenImg}" class="token-logo">${chainBadgeHtml}</div>
                    <div class="token-meta-container">
                         <div class="symbol-row"><span class="symbol-text">${t.symbol}</span></div>
                         <div class="contract-row" onclick="window.pluginCopy('${t.contract}')">${shortContract} <i class="fas fa-copy"></i></div>
                    </div>
                </div>
            </td>
            <td style="padding-left:15px;">${journeyHtml}</td>
            <td class="text-end text-primary-val">$${formatPrice(t.price)} <div class="${t.change_24h >= 0 ? 'text-green' : 'text-red'}" style="font-size:11px;">${t.change_24h}%</div></td>
            <td class="chart-cell">${getSparklineSVG(t.chart)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.volume.daily_total)}</td>
            <td class="text-end font-num text-accent">$${formatNum(t.volume.daily_limit)}</td>
            <td class="text-end font-num text-brand">$${formatNum(t.volume.daily_onchain)}</td>
            <td class="text-end font-num text-secondary-val">$${formatNum(t.volume.rolling_24h)}</td>
            <td class="text-end font-num text-secondary-val">${formatInt(t.tx_count)}</td>
            <td class="text-end font-num text-primary-val">$${formatNum(t.liquidity)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- HÀM 2: VẼ DASHBOARD (MARKET HUD) - GIAO DIỆN 3 CỘT PRO ---
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
        container.insertBefore(hud, container.firstChild);
    }

    // Tính toán tỷ lệ
    const pctActive = stats.totalScan > 0 ? (stats.countActive / stats.totalScan) * 100 : 0;
    const pctSpot = stats.totalScan > 0 ? (stats.countSpot / stats.totalScan) * 100 : 0;
    const pctDelist = stats.totalScan > 0 ? (stats.countDelisted / stats.totalScan) * 100 : 0;
    const limitPct = stats.alphaDailyTotal > 0 ? (stats.alphaDailyLimit / stats.alphaDailyTotal) * 100 : 0;
    const chainPct = stats.alphaDailyTotal > 0 ? (stats.alphaDailyChain / stats.alphaDailyTotal) * 100 : 0;

    // Helper vẽ Histogram Sentiment (Giữ nguyên)
    const drawSentBar = (count, label, colorClass) => {
        let h = (count / stats.distribution.maxCount) * 40;
        if (count > 0 && h < 4) h = 4;
        return `<div style="display:flex; flex-direction:column; align-items:center; justify-content:flex-end; width:100%;">
            <div style="font-size:10px; color:${count>0?'#fff':'#444'}; margin-bottom:2px; font-weight:700;">${count>0?count:''}</div>
            <div style="width:100%; height:${h}px; border-radius:2px 2px 0 0;" class="${colorClass}"></div>
            <div style="font-size:9px; color:#5E6673; margin-top:4px;">${label}</div>
        </div>`;
    };
    const d = stats.distribution;

    // Helper vẽ Mirrored Chart (Biểu đồ Đối Xứng Limit/Chain)
    const drawMirroredChart = () => {
        if (stats.topVolTokens.length === 0) return '<div style="height:60px; display:flex; align-items:center; justify-content:center; color:#444; font-size:10px;">No Data</div>';
        
        // Tìm giá trị max để scale (lấy max của limit hoặc chain lẻ để cột không bị lùn quá)
        let maxVal = 0;
        stats.topVolTokens.forEach(t => {
            maxVal = Math.max(maxVal, t.volume.daily_limit, t.volume.daily_onchain);
        });
        if (maxVal === 0) maxVal = 1;

        const barWidth = 100 / 30; // Chia đều cho 30 cột
        let svgContent = '';
        
        stats.topVolTokens.forEach((t, i) => {
            const hLimit = (t.volume.daily_limit / maxVal) * 25; // Max cao 25px
            const hChain = (t.volume.daily_onchain / maxVal) * 25;
            const x = i * barWidth;
            
            // Tooltip khi hover
            const tooltip = `${t.symbol} &#10;Limit: $${formatNum(t.volume.daily_limit)} &#10;Chain: $${formatNum(t.volume.daily_onchain)}`;

            svgContent += `
                <g class="chart-bar-group">
                    <title>${tooltip}</title>
                    <rect x="${x}%" y="${30 - hLimit}" width="${barWidth - 0.5}%" height="${hLimit}" fill="#F0B90B" opacity="0.9"></rect>
                    <rect x="${x}%" y="30" width="${barWidth - 0.5}%" height="${hChain}" fill="#00F0FF" opacity="0.9"></rect>
                </g>
            `;
        });

        return `
            <svg width="100%" height="60" viewBox="0 0 100 60" preserveAspectRatio="none" style="overflow:visible;">
                <line x1="0" y1="30" x2="100" y2="30" stroke="#2b3139" stroke-width="0.5" />
                ${svgContent}
            </svg>
        `;
    };

    // RENDER HTML CHÍNH
    hud.innerHTML = `
        <div class="hud-module">
            <div class="hud-title">ALPHA LIFECYCLE (ALL TIME)</div>
            <div style="font-size:14px; color:#848e9c; margin-bottom:4px;">TOTAL SCAN</div>
            <div style="font-size:24px; font-weight:bold; color:#eaecef; font-family:'Rajdhani'; line-height:1;">
                ${stats.totalScan} <span style="font-size:12px; color:#5E6673; font-weight:normal">TOKENS</span>
            </div>
            
            <div class="hud-progress-bar" style="margin-top:15px; margin-bottom:15px; height:6px;">
                <div class="bar-segment" style="width: ${pctActive}%; background-color:#0ecb81;"></div>
                <div class="bar-segment" style="width: ${pctSpot}%; background-color:#F0B90B;"></div>
                <div class="bar-segment" style="width: ${pctDelist}%; background-color:#f6465d;"></div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:11px; color:#848e9c;">
                <div style="text-align:left;"><span style="color:#0ecb81; font-weight:bold;">${stats.countActive}</span> Active</div>
                <div style="text-align:center;"><span style="color:#F0B90B; font-weight:bold;">${stats.countSpot}</span> Spot</div>
                <div style="text-align:right;"><span style="color:#f6465d; font-weight:bold;">${stats.countDelisted}</span> Delisted</div>
            </div>
        </div>

        <div class="hud-module border-left-dim">
            <div class="hud-title" style="display:flex; justify-content:space-between;">
                DAILY VOL STRUCTURE (UTC 0:00)
                <span style="color:#5E6673; font-size:10px;">Rolling 24h: $${formatNum(stats.alphaRolling24h)}</span>
            </div>
            
            <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:12px;">
                <div class="text-neon" style="font-size:24px; font-weight:bold; font-family:'Rajdhani';">$${formatNum(stats.alphaDailyTotal)}</div>
                <div style="font-size:11px; color:#848e9c;">(Active Only)</div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:8px; font-family:'Rajdhani'; font-weight:600;">
                <div style="color:#F0B90B;">LIMIT: $${formatNum(stats.alphaDailyLimit)} (${Math.round(limitPct)}%)</div>
                <div style="color:#00F0FF;">CHAIN: $${formatNum(stats.alphaDailyChain)} (${Math.round(chainPct)}%)</div>
            </div>

            <div style="flex-grow:1; display:flex; align-items:center;">
                ${drawMirroredChart()}
            </div>
        </div>

        <div class="hud-module border-left-dim">
            <div class="hud-title">24H PRICE DISTRIBUTION</div>
            <div style="flex-grow:1; display:flex; align-items:flex-end; gap:3px; padding-bottom:5px;">
                 ${drawSentBar(d.up_0_2, '0-2%', 'bar-green-dim')}
                ${drawSentBar(d.up_2_4, '2-4%', 'bar-green-mid')}
                ${drawSentBar(d.up_4_6, '4-6%', 'bar-green')}
                ${drawSentBar(d.up_6_8, '6-8%', 'bar-green')}
                ${drawSentBar(d.up_8, '>8%', 'bar-green')}
                
                <div style="width:10px;"></div>

                ${drawSentBar(d.down_0_2, '0-2%', 'bar-red-dim')}
                ${drawSentBar(d.down_2_4, '2-4%', 'bar-red-mid')}
                ${drawSentBar(d.down_4_6, '4-6%', 'bar-red')}
                ${drawSentBar(d.down_6_8, '6-8%', 'bar-red')}
                ${drawSentBar(d.down_8, '>8%', 'bar-red')}
            </div>
            
            <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                <div style="color: #0ecb81; font-weight: 700; font-family: var(--font-num); font-size: 16px;">
                    <i class="fas fa-arrow-up" style="font-size:12px; transform: rotate(45deg);"></i> ${stats.gainers}
                </div>
                <div style="color: #f6465d; font-weight: 700; font-family: var(--font-num); font-size: 16px;">
                    ${stats.losers} <i class="fas fa-arrow-down" style="font-size:12px; transform: rotate(45deg);"></i>
                </div>
            </div>
        </div>
    `;

    // Inject CSS nội bộ cho Chart Bar Hover
    if (!document.getElementById('chart-hover-style')) {
        const style = document.createElement('style');
        style.id = 'chart-hover-style';
        style.innerHTML = `
            .chart-bar-group rect { transition: opacity 0.2s; cursor: pointer; }
            .chart-bar-group:hover rect { opacity: 1 !important; stroke: #fff; stroke-width: 0.5px; }
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
