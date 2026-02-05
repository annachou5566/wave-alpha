const DATA_URL = 'public/data/market-data.json';
let allTokens = [];
let displayCount = 50; 
let pinnedTokens = JSON.parse(localStorage.getItem('alpha_pins')) || [];
let sortConfig = { key: 'volume.daily_total', dir: 'desc' };
let currentFilter = 'ALL';
let filterPoints = false;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Meta bypass (Giữ nguyên)
    if (!document.querySelector('meta[name="referrer"]')) {
        const meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer";
        document.head.appendChild(meta);
    }

    // 2. Inject CSS (Giữ nguyên)
    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    // --- [FIX LỖI MÀN HÌNH ĐEN/POPUP BỊ CHE] ---
    // Tìm tất cả các bảng Modal (Login, v.v...) và đưa ra ngoài Body
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        document.body.appendChild(modal);
    }); 
   
    injectLayout();

    // 4. Init logic
    if (localStorage.getItem('wave_alpha_role') === 'admin') {
        window.pluginSwitchTab('alpha', true);
    }
    initMarket();
    setupEvents();
});

// =========================================================================
// HÀM 1: TÍNH TOÁN SỐ LIỆU TỔNG QUÁT & CHUẨN BỊ DỮ LIỆU
// =========================================================================
function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // 1. KHỞI TẠO BIẾN THỐNG KÊ
   
    // 1. KHỞI TẠO STATS (Cần mảng distribList để hiện Tooltip)
    let stats = {
        totalScan: allTokens.length,
        countActive: 0, countSpot: 0, countDelisted: 0,
        alphaDailyTotal: 0, alphaDailyLimit: 0, alphaDailyChain: 0,
        alphaRolling24h: 0, 
        gainers: 0, losers: 0,
        // QUAN TRỌNG: Mảng này chứa tên token cho Tooltip
        distribList: {
            up_0_2: [], up_2_4: [], up_4_6: [], up_6_8: [], up_8: [],
            down_0_2: [], down_2_4: [], down_4_6: [], down_6_8: [], down_8: []
        },
        maxDistribCount: 0, 
        topVolTokens: [] 
    };

    let tempVolList = [];

    allTokens.forEach(t => {
        const status = getTokenStatus(t);
        
        // Phân loại Trạng thái
        if (status === 'SPOT') stats.countSpot++;
        else if (status === 'DELISTED') stats.countDelisted++;
        else {
            // Chỉ cộng Volume của các token ACTIVE vào Tổng số liệu
            stats.countActive++;
            const v = t.volume || {};
            stats.alphaDailyTotal += (v.daily_total || 0);
            stats.alphaDailyLimit += (v.daily_limit || 0);
            stats.alphaDailyChain += (v.daily_onchain || 0);
            stats.alphaRolling24h += (v.rolling_24h || 0);
            
            // Lấy danh sách để tìm Top 10 vẽ biểu đồ
            if ((v.daily_total || 0) > 0) {
                tempVolList.push(t);
            }

            // Sentiment (Phân phối giá 24h)
            const chg = t.change_24h || 0;
        if (chg >= 0) stats.gainers++; else stats.losers++;
        const abs = Math.abs(chg);
        
        // Push Symbol vào mảng tương ứng
        if (chg >= 0) {
            if (abs >= 8) stats.distribList.up_8.push(t.symbol);
            else if (abs >= 6) stats.distribList.up_6_8.push(t.symbol);
            else if (abs >= 4) stats.distribList.up_4_6.push(t.symbol);
            else if (abs >= 2) stats.distribList.up_2_4.push(t.symbol);
            else stats.distribList.up_0_2.push(t.symbol);
        } else {
            if (abs >= 8) stats.distribList.down_8.push(t.symbol);
            else if (abs >= 6) stats.distribList.down_6_8.push(t.symbol);
            else if (abs >= 4) stats.distribList.down_4_6.push(t.symbol);
            else if (abs >= 2) stats.distribList.down_2_4.push(t.symbol);
            else stats.distribList.down_0_2.push(t.symbol);
        }
    });

    // Lấy Top 10 Token Volume lớn nhất để VẼ BIỂU ĐỒ
    tempVolList.sort((a, b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0));
    stats.topVolTokens = tempVolList.slice(0, 10); 

    // Tìm maxCount cho biểu đồ Sentiment
    const d = stats.distribList;
    stats.maxDistribCount = Math.max(
        d.up_8.length, d.up_6_8.length, d.up_4_6.length, d.up_2_4.length, d.up_0_2.length,
        d.down_0_2.length, d.down_2_4.length, d.down_4_6.length, d.down_6_8.length, d.down_8.length, 1
    );

    // VẼ HUD (Dashboard)
    renderMarketHUD(stats);

    // RENDER CÁC DÒNG BẢNG CHI TIẾT
    renderTableRows(tbody); 
}

// =========================================================================
// HÀM 2: RENDER CÁC DÒNG TRONG BẢNG (LOGIC SORT THÔNG MINH)
// =========================================================================
function renderTableRows(tbody) {
    // 1. Lọc dữ liệu (Filter)
    let list = allTokens.filter(t => {
        const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
        const matchSearch = (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term));
        if (!matchSearch) return false;
        
        const status = getTokenStatus(t);
        if (currentFilter !== 'ALL' && status !== currentFilter) return false;
        if (filterPoints && (t.mul_point || 1) <= 1) return false;
        return true; 
    });

    // 2. SẮP XẾP (SORT) - LOGIC MỚI
    list.sort((a, b) => {
        // Ưu tiên 1: Token được GHIM (Pin) luôn nằm trên cùng
        const pinA = pinnedTokens.includes(a.symbol);
        const pinB = pinnedTokens.includes(b.symbol);
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;

        // Ưu tiên 2: LOGIC THÔNG MINH
        // Chỉ áp dụng khi đang sắp xếp theo Volume (Mặc định) và chiều Giảm dần (Desc)
        if (sortConfig.key === 'volume.daily_total' && sortConfig.dir === 'desc') {
            const statusA = getTokenStatus(a);
            const statusB = getTokenStatus(b);
            
            // Định nghĩa: Token Active là token KHÔNG PHẢI Spot và KHÔNG PHẢI Delisted
            const isActiveA = (statusA !== 'SPOT' && statusA !== 'DELISTED' && statusA !== 'PRE_DELISTED');
            const isActiveB = (statusB !== 'SPOT' && statusB !== 'DELISTED' && statusB !== 'PRE_DELISTED');

            // Nếu A là Active mà B là Spot/Delist -> A lên trước (-1)
            if (isActiveA && !isActiveB) return -1;
            // Nếu A là Spot/Delist mà B là Active -> B lên trước (1)
            if (!isActiveA && isActiveB) return 1;
            
            // Nếu cả 2 cùng hạng (cùng Active hoặc cùng Spot) -> Xuống dưới so sánh Volume như thường
        }

        // Ưu tiên 3: Sắp xếp theo giá trị (Volume, Price...)
        const valA = getVal(a, sortConfig.key);
        const valB = getVal(b, sortConfig.key);
        return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
    });

    // 3. Render HTML từng dòng
    list.slice(0, displayCount).forEach((t) => {
        const tr = document.createElement('tr');
        const now = Date.now();
        
        // Logic Badge Trạng thái
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

        // Logic Badge xN (Mul Point)
        let mulBadgeHtml = '';
        if (!t.offline && t.listing_time && t.mul_point > 1) {
            const expiryTime = t.listing_time + 2592000000; 
            const diffDays = Math.ceil((expiryTime - now) / 86400000);
            if (diffDays > 0) {
                const badgeClass = (t.chain === 'BSC') ? 'badge-bsc' : 'badge-alpha';
                mulBadgeHtml = `<span class="smart-badge ${badgeClass}" style="margin-left:5px;">x${t.mul_point} ${diffDays}d</span>`;
            }
        }

        const tokenImg = t.icon || 'assets/tokens/default.png';
        const chainBadgeHtml = t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge" onerror="this.style.display='none'">` : '';
        const shortContract = t.contract ? `${t.contract.substring(0, 6)}...${t.contract.substring(t.contract.length - 4)}` : '';

        // Template HTML (Đã bỏ các style border cũ)
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
                ${t.listing_time ? `<div class="journey-date"><i class="far fa-clock"></i> ${new Date(t.listing_time).toLocaleDateString('en-GB')}</div>` : ''}
            </td>
            <td class="text-end">
                <div class="text-primary-val">$${formatPrice(t.price)}</div>
                <div style="font-size:11px; font-weight:700; margin-top:2px" class="${t.change_24h >= 0 ? 'text-green' : 'text-red'}">
                    ${t.change_24h >= 0 ? '▲' : '▼'} ${Math.abs(t.change_24h)}%
                </div>
            </td>
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

// =========================================================================
// HÀM VẼ DASHBOARD (HUD) - V4 FINAL POLISH
// =========================================================================
function renderMarketHUD(stats) {
    const view = document.getElementById('alpha-market-view');
    if (!view || !view.querySelector('.alpha-container')) return;
    const container = view.querySelector('.alpha-container'); 
    
    let hud = document.getElementById('market-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'market-hud';
        hud.className = 'market-hud-container';
        container.insertBefore(hud, container.firstChild);
    }

    // --- 1. DATA PREP ---
    let updateTime = "Waiting...";
    const timeEl = document.getElementById('last-updated');
    if (timeEl && timeEl.innerText.includes('Updated:')) {
        updateTime = timeEl.innerText.replace('Updated: ', '').trim();
    } else {
        updateTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    // Rolling Top 10
    let activeTokens = allTokens.filter(t => {
        const s = getTokenStatus(t);
        return s !== 'SPOT' && s !== 'DELISTED' && s !== 'PRE_DELISTED';
    });
    activeTokens.sort((a, b) => (b.volume.rolling_24h || 0) - (a.volume.rolling_24h || 0));
    const top10Rolling = activeTokens.slice(0, 10);
    const maxVolRolling = top10Rolling[0] ? (top10Rolling[0].volume.rolling_24h || 1) : 1;
    
    // Dominance
    const volTop10Sum = top10Rolling.reduce((sum, t) => sum + (t.volume.rolling_24h || 0), 0);
    const totalRolling = stats.alphaRolling24h || 1;
    const domPct = (volTop10Sum / totalRolling) * 100;

    // Daily Top 10
    let dailyTokens = [...stats.topVolTokens].sort((a, b) => (b.volume.daily_total || 0) - (a.volume.daily_total || 0));
    const top10Daily = dailyTokens.slice(0, 10);
    const maxVolDaily = top10Daily[0] ? (top10Daily[0].volume.daily_total || 1) : 1;

    const formatNumK = (num) => {
        if(num >= 1000000) return (num/1000000).toFixed(1) + 'M';
        if(num >= 1000) return (num/1000).toFixed(0) + 'K';
        return num;
    };

    // --- RENDER HELPERS ---

    // 1. Helper Vẽ Row (Rolling & Daily) - Style "Số dính Bar"
    const renderRow = (t, idx, type) => {
        if (!t) return '';
        
        let barHtml = '';
        let volDisplay = 0;
        let pctWidth = 0;
        
        // Tooltip Data Attributes
        const dataAttrs = `
            data-symbol="${t.symbol}"
            data-total="${formatNum(t.volume.daily_total)}"
            data-limit="${formatNum(t.volume.daily_limit)}"
            data-chain="${formatNum(t.volume.daily_onchain)}"
        `;
        // Chỉ hiện tooltip chi tiết cho Daily (hoặc cả 2 nếu muốn)
        const tooltipEvents = `
            onmouseenter="window.showTooltip(event, this)" 
            onmousemove="window.moveTooltip(event)" 
            onmouseleave="window.hideTooltip()"
        `;

        if (type === 'ROLLING') {
            volDisplay = t.volume.rolling_24h || 0;
            pctWidth = (volDisplay / maxVolRolling) * 100;
            // Màu Cyan (#00F0FF)
            barHtml = `<div class="hud-bar-fill" style="width:100%; height:100%; background:#00F0FF;"></div>`;
        } else {
            volDisplay = t.volume.daily_total || 0;
            pctWidth = (volDisplay / maxVolDaily) * 100;
            const vLimit = t.volume.daily_limit || 0;
            const vChain = t.volume.daily_onchain || 0;
            const pLimit = volDisplay > 0 ? (vLimit / volDisplay) * 100 : 0;
            const pChain = volDisplay > 0 ? (vChain / volDisplay) * 100 : 0;
            
            // Màu Vàng (Limit) + Tím (Chain)
            barHtml = `
                <div style="width:100%; height:100%; display:flex; border-radius: 0 3px 3px 0; overflow:hidden;">
                    <div style="width:${pLimit}%; height:100%; background:#F0B90B;"></div>
                    <div style="width:${pChain}%; height:100%; background:#9945FF;"></div>
                </div>
            `;
        }

        return `
            <div class="hud-list-row" ${dataAttrs} ${tooltipEvents} style="cursor:pointer">
                <div class="hud-list-idx">#${idx}</div>
                <div class="hud-list-name" title="${t.symbol}">${t.symbol}</div>
                
                <div class="hud-bar-wrapper">
                    <div style="width:${pctWidth}%; height:8px;"> ${barHtml}
                    </div>
                    <div class="hud-list-val">$${formatNumK(volDisplay)}</div>
                </div>
            </div>
        `;
    };

    // 2. Helper Vẽ Price Bar (Click hiện List)
    const d = stats.distribList;
    const drawSentBar = (listTokens, label, colorClass) => {
        const count = listTokens.length;
        let h = (count / stats.maxDistribCount) * 100; // 100% height container
        if (count > 0 && h < 5) h = 5;
        const tokensStr = listTokens.join(', '); // Chuỗi token cho tooltip
        
        return `
            <div class="distrib-bar-item" 
                 onclick="window.showListTooltip(event, '${label}', '${tokensStr}')"
                 onmouseenter="window.showListTooltip(event, '${label}', '${tokensStr}')"
                 onmouseleave="window.hideTooltip()">
                 ${count > 0 ? `<div style="font-size:8px; font-weight:bold; color:#fff; margin-bottom:2px;">${count}</div>` : ''}
                 <div style="width:100%; height:${h}%; border-radius:1px;" class="${colorClass}"></div>
            </div>
        `;
    };

    // --- RENDER HTML ---
    
    // Tỷ lệ Lifecycle
    const pctActive = stats.totalScan > 0 ? (stats.countActive / stats.totalScan) * 100 : 0;
    const pctSpot = stats.totalScan > 0 ? (stats.countSpot / stats.totalScan) * 100 : 0;
    const pctDelist = stats.totalScan > 0 ? (stats.countDelisted / stats.totalScan) * 100 : 0;

    hud.innerHTML = `
        <div class="hud-module">
            <div class="hud-title">MARKET OVERVIEW</div>
            
            <div class="lifecycle-labels" style="margin-top:10px;">
                <div class="lifecycle-label-item" style="width:${pctActive}%; color:#0ecb81;">${stats.countActive} ACT</div>
                <div class="lifecycle-label-item" style="width:${pctSpot}%; color:#F0B90B;">${stats.countSpot} SPOT</div>
                <div class="lifecycle-label-item" style="width:${pctDelist}%; color:#f6465d;">${stats.countDelisted} DEAD</div>
            </div>
            <div style="display:flex; width:100%; height:6px; background:#1e2329; border-radius:3px; overflow:hidden; margin-bottom:15px;">
                <div style="width:${pctActive}%; background:#0ecb81;"></div>
                <div style="width:${pctSpot}%; background:#F0B90B;"></div>
                <div style="width:${pctDelist}%; background:#f6465d;"></div>
            </div>

            <div class="distrib-header">
                <div style="color:#f6465d">▼ ${stats.losers} LOSERS</div>
                <div style="color:#0ecb81">${stats.gainers} GAINERS ▲</div>
            </div>

            <div class="distrib-container">
                <div class="distrib-side red">
                    ${drawSentBar(d.down_8, '>8%', 'bg-red-5')}
                    ${drawSentBar(d.down_6_8, '6-8%', 'bg-red-4')}
                    ${drawSentBar(d.down_4_6, '4-6%', 'bg-red-3')}
                    ${drawSentBar(d.down_2_4, '2-4%', 'bg-red-2')}
                    ${drawSentBar(d.down_0_2, '0-2%', 'bg-red-1')}
                </div>
                <div class="distrib-side green">
                    ${drawSentBar(d.up_0_2, '0-2%', 'bg-green-1')}
                    ${drawSentBar(d.up_2_4, '2-4%', 'bg-green-2')}
                    ${drawSentBar(d.up_4_6, '4-6%', 'bg-green-3')}
                    ${drawSentBar(d.up_6_8, '6-8%', 'bg-green-4')}
                    ${drawSentBar(d.up_8, '>8%', 'bg-green-5')}
                </div>
            </div>
             <div style="display:flex; justify-content:space-between; font-size:8px; color:#5E6673; margin-top:-2px;">
                <span>Heavy Drop</span>
                <span>Stable</span>
                <span>Moon</span>
            </div>
        </div>

        <div class="hud-module border-left-dim">
            <div class="hud-title">ROLLING VOL 24H</div>
            <div class="hud-main-value" style="font-size:22px; color:#eaecef; margin-bottom:5px;">
                $${formatNum(stats.alphaRolling24h)}
            </div>
            
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                <div style="flex:1; height:4px; background:#2b3139; border-radius:2px;">
                    <div style="width:${domPct}%; height:100%; background:#eaecef; border-radius:2px;"></div>
                </div>
                <div style="font-size:9px; color:#848E9C; white-space:nowrap;">TOP 10: <span style="color:#fff">${domPct.toFixed(0)}%</span></div>
            </div>

            <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:flex-start; overflow:hidden;">
                ${top10Rolling.map((t, i) => renderRow(t, i+1, 'ROLLING')).join('')}
            </div>
        </div>

        <div class="hud-module border-left-dim">
            <div class="hud-title" style="display:flex; align-items:center;">
                DAILY VOL (UTC +0) <span class="update-badge">${updateTime}</span>
            </div>
            <div class="hud-main-value" style="font-size:22px; color:#eaecef; margin-bottom:5px;">
                $${formatNum(stats.alphaDailyTotal)}
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:10px; font-size:10px; font-weight:700;">
                <div style="color:#F0B90B;">● LIMIT: $${formatNumK(stats.alphaDailyLimit)}</div>
                <div style="color:#9945FF;">● CHAIN: $${formatNumK(stats.alphaDailyChain)}</div>
            </div>

            <div style="flex-grow:1; display:flex; flex-direction:column; justify-content:flex-start; overflow:hidden;">
                ${top10Daily.map((t, i) => renderRow(t, i+1, 'DAILY')).join('')}
            </div>
        </div>
    `;
}

// =========================================================================
// CÁC HÀM XỬ LÝ TOOLTIP (GẮN GLOBAL WINDOW ĐỂ GỌI MỌI NƠI)
// =========================================================================
window.showTooltip = function(e, el) {
    const t = document.getElementById('hud-tooltip');
    if(t && el.dataset.symbol) {
        // Lấy dữ liệu từ data-attributes (An toàn 100%)
        const { symbol, total, limit, chain } = el.dataset;

        t.style.display = 'block';
        t.innerHTML = `
            <div style="color:#fff; font-size:16px; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #333; padding-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                ${symbol}
                <span style="font-size:10px; background:#2b3139; padding:2px 4px; border-radius:3px; color:#848e9c">VOL RANK</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px; color:#eaecef;">
                <span>Daily Vol:</span> <span style="font-weight:bold;">$${total}</span>
            </div>
            <div style="height:1px; background:#333; margin:4px 0;"></div>
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
                <span style="color:#F0B90B">● Limit:</span> <span style="color:#F0B90B; font-weight:bold;">$${limit}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px;">
                <span style="color:#00F0FF">● On-Chain:</span> <span style="color:#00F0FF; font-weight:bold;">$${chain}</span>
            </div>
        `;
        window.moveTooltip(e);
    }
};

window.moveTooltip = function(e) {
    const t = document.getElementById('hud-tooltip');
    if(t) {
        // Tooltip đi theo chuột
        t.style.left = (e.clientX) + 'px';
        t.style.top = (e.clientY) + 'px';
    }
};

window.hideTooltip = function() {
    const t = document.getElementById('hud-tooltip');
    if(t) t.style.display = 'none';
};


// =========================================================================
// HÀM INJECT LAYOUT: HEADER 11 CỘT (THÊM STATUS)
// =========================================================================
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

    // 2. Market View
    const marketView = document.createElement('div');
    marketView.id = 'alpha-market-view';
    marketView.style.display = 'none'; 
    
    marketView.innerHTML = `
        <div class="alpha-container">
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
                            <th rowspan="2" class="col-fix-2">TOKEN INFO</th>
                            
                            <th rowspan="2" class="text-center">STATUS</th>
                            
                            <th rowspan="2" class="text-end">PRICE</th>
                            <th rowspan="2" class="text-center">CHART</th>
                            
                            <th colspan="3" class="text-center th-group-vol">DAILY VOLUME (UTC)</th>
                            <th colspan="3" class="text-center th-group-stats">MARKET STATS (24h)</th>
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

    // 3. Smart Scroll Logic (Giữ nguyên)
    let lastScrollY = window.scrollY;
    window.removeEventListener('scroll', window._smartScroll);
    window._smartScroll = function() {
        const currentScrollY = window.scrollY;
        const nav = document.getElementById('alpha-tab-nav');
        if (!nav) return;
        if (currentScrollY > lastScrollY && currentScrollY > 20) {
            nav.classList.add('nav-hidden');
        } else if (currentScrollY < lastScrollY) {
            nav.classList.remove('nav-hidden');
        }
        lastScrollY = currentScrollY;
    };
    window.addEventListener('scroll', window._smartScroll, { passive: true });
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

window.showListTooltip = function(e, label, tokensStr) {
    const t = document.getElementById('hud-tooltip');
    if (!t) return;
    
    // Nếu danh sách rỗng
    if (!tokensStr) tokensStr = "No tokens";
    
    // Cắt bớt nếu quá dài (chỉ hiện 50 ký tự đầu rồi ...)
    let displayStr = tokensStr;
    if (displayStr.length > 100) displayStr = displayStr.substring(0, 100) + "...";

    t.style.display = 'block';
    t.innerHTML = `
        <div style="color:#fff; font-size:12px; font-weight:bold; margin-bottom:4px; border-bottom:1px solid #333;">
            RANGE: ${label}
        </div>
        <div style="color:#eaecef; font-size:11px; line-height:1.4;">
            ${displayStr}
        </div>
    `;
    window.moveTooltip(e);
};