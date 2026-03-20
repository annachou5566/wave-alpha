const DATA_URL = '/data/market-data.json';
let allTokens = [];
let currentPage = 1;
let rowsPerPage = 20;
let pinnedTokens = JSON.parse(localStorage.getItem('alpha_pins')) || [];
let sortConfig = { key: null, dir: null };

let currentFilter = 'ALL';
let filterPoints = false;


document.addEventListener('DOMContentLoaded', () => {
    
    if (!document.querySelector('meta[name="referrer"]')) {
        const meta = document.createElement('meta');
        meta.name = "referrer";
        meta.content = "no-referrer";
        document.head.appendChild(meta);
    }

    if (!document.querySelector('link[href*="pro-mode.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'public/css/pro-mode.css?v=' + Date.now();
        document.head.appendChild(link);
    }

    // --- BƠM CSS CHO RWA VÀ BACKGROUND CHART ---
    if (!document.getElementById('wave-alpha-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'wave-alpha-custom-styles';
        style.innerHTML = `
            .rwa-marquee-wrapper { background: #111418; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0; overflow: hidden; white-space: nowrap; position: relative; display: flex; align-items: center; font-family: var(--font-num), sans-serif; font-size: 0.85rem; margin-bottom: 15px; border-radius: 4px; border: 1px solid rgba(240, 185, 11, 0.2); font-variant-numeric: tabular-nums;}
            .rwa-marquee-label { background: #F0B90B; color: #000; font-weight: 800; padding: 3px 12px; border-radius: 4px; margin-left: 10px; margin-right: 15px; z-index: 2; box-shadow: 2px 0 10px rgba(0,0,0,0.8); display:flex; align-items:center; }
            .rwa-marquee-content { display: inline-block; animation: marquee 80s linear infinite; will-change: transform; transform: translateZ(0); }
            .rwa-marquee-content:hover { animation-play-state: paused; }
            .rwa-item { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s; padding: 2px 8px; border-radius: 4px; }
            .rwa-item:hover { background: rgba(255,255,255,0.1); }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
            .active-rwa { background: rgba(240, 185, 11, 0.15) !important; color: #F0B90B !important; border-color: #F0B90B !important; }
            .excl-rwa-badge { font-size:0.6rem; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; margin-left:8px; color:#aaa; font-weight:normal; letter-spacing:0; font-family:var(--font-main);}
            
            /* CSS CHO BIỂU ĐỒ 14 NGÀY Ở GIỮA */
            .daily-mid-chart { display: flex; align-items: flex-end; justify-content: space-between; height: 65px; margin: 15px 0 10px 0; gap: 4px; }
            .daily-mid-bar { flex: 1; border-radius: 3px 3px 0 0; position: relative; transition: all 0.2s ease; min-width: 8px;}
            .daily-mid-bar.up { background: linear-gradient(to top, rgba(14,203,129,0.2), rgba(14,203,129,0.9)); border-top: 1px solid #0ecb81; }
            .daily-mid-bar.down { background: linear-gradient(to top, rgba(246,70,93,0.2), rgba(246,70,93,0.9)); border-top: 1px solid #f6465d; }
            .daily-mid-bar.today { background: linear-gradient(to top, rgba(240,185,11,0.2), #F0B90B); border-top: 2px solid #fff; box-shadow: 0 -2px 10px rgba(240,185,11,0.4); }
            .daily-mid-bar:hover { filter: brightness(1.3); cursor: pointer; }
            
            /* HOVER TOOLTIP XỊN SÒ */
            .chart-tooltip { display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #2b3139; color: #fff; padding: 4px 6px; font-size: 10px; font-family: var(--font-num); border-radius: 4px; white-space: nowrap; pointer-events: none; margin-bottom: 6px; z-index: 10; border: 1px solid #474d57; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
            .chart-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -4px; border-width: 4px; border-style: solid; border-color: #474d57 transparent transparent transparent; }
            .daily-mid-bar:hover .chart-tooltip { display: block; }
            
            /* HIỆU ỨNG NHẤP NHÁY CHO TRẠM TRACKING */
            @keyframes pulse-dot { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(14,203,129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(14,203,129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(14,203,129, 0); } }
            
            /* ÉP THANH TOOLBAR CHỌN GIỜ LUÔN NỔI LÊN VÀ RESPONSIVE TỐT TRÊN MOBILE */
            .sc-toolbar {
                display: flex !important;
                flex-wrap: wrap;
                align-items: center;
                gap: 4px;
                padding: 8px 15px;
                background: #111418;
                border-bottom: 1px solid rgba(255,255,255,0.05);
                z-index: 999;
            }
            /* ĐẢM BẢO KHU VỰC CHART KHÔNG NUỐT TOOLBAR */
            .sc-chart-main {
                display: flex !important;
                flex-direction: column !important;
                height: 100%;
                overflow: hidden;
            }

            /* CSS CHO NÚT CHỌN KHUNG GIỜ */
            .sc-time-btn { 
                background: transparent; 
                border: none; 
                color: #848e9c; 
                font-size: 11px; 
                cursor: pointer; 
                padding: 4px 8px; 
                border-radius: 3px; 
                transition: 0.2s;
                font-family: var(--font-main);
            }
            .sc-time-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
            .sc-time-btn.active { background: rgba(0, 240, 255, 0.15); color: #00F0FF; font-weight: bold; }

            /* HIỆU ỨNG NHẤP NHÁY GIÁ */
            .price-up { color: #00F0FF !important; animation: glow-cyan 0.5s; }
            .price-down { color: #FF007F !important; animation: glow-pink 0.5s; }
            @keyframes glow-cyan { from { text-shadow: 0 0 10px #00F0FF; } to { text-shadow: none; } }
            @keyframes glow-pink { from { text-shadow: 0 0 10px #FF007F; } to { text-shadow: none; } }
        `;
        document.head.appendChild(style);
    }
// ========================================================
    // BƠM CSS THIẾT KẾ LẠI CHART (BỐ CỤC PRO & MOBILE TABS)
    // ========================================================
    if (!document.getElementById('wave-alpha-pro-chart-styles')) {
        const proChartStyle = document.createElement('style');
        proChartStyle.id = 'wave-alpha-pro-chart-styles';
        proChartStyle.innerHTML = `
            #super-chart-overlay { height: 100dvh !important; padding-bottom: 5px; box-sizing: border-box; background: rgba(8, 10, 14, 0.98); backdrop-filter: blur(15px); font-family: var(--font-main); }
            .sc-topbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; background: #0B0E11; border-bottom: 1px solid rgba(255,255,255,0.03); height: 45px; flex-shrink: 0; }
            .sc-body { display: flex; flex: 1; overflow: hidden; width: 100%; }
            
            .sc-chart-area { flex: 1; display: flex; flex-direction: column; background: transparent; overflow: hidden; }
            .sc-stats-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(22, 26, 30, 0.4); }
            
            /* Class mới cho layout giá */
            .sc-price-box { display: flex; align-items: baseline; gap: 10px; margin-right: 15px; }
            
            .sc-metrics-compact { display: flex; gap: 20px; align-items: center; }
            .sc-mc-item { display: flex; flex-direction: column; align-items: flex-end; }
            .sc-mc-item span { font-size: 10px; color: #5E6673; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
            .sc-mc-item strong { font-size: 13px; color: #EAECEF; font-family: var(--font-num); font-weight: 700; }
            
            .sc-side-panel { width: 320px; background: #12151A; display: flex; flex-direction: column; border-left: 1px solid rgba(255,255,255,0.02); z-index: 2;}
            .sc-panel-section { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.02); }
            .sc-panel-title { font-size: 11px; text-transform: uppercase; color: #848e9c; letter-spacing: 1px; margin-bottom: 12px; font-weight: 700; display:flex; align-items:center; gap:6px;}
            
            .sc-mobile-tabs { display: none; }
            .sc-tab-content { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
            
            #sc-live-trades::-webkit-scrollbar { width: 4px; }
            #sc-live-trades::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            /* MOBILE RESPONSIVE (Tối ưu khít không gian, chữ nhỏ) */
            @media (max-width: 991px) {
                .sc-body { flex-direction: column !important; overflow-y: hidden !important; }
                .sc-topbar { padding: 8px 10px; }
                
                /* Tăng chiều cao chart 1 chút, khít với Tab dưới */
                .sc-chart-area { flex: none !important; height: 42vh !important; border-bottom: 1px solid #1e2329; }
                
                /* Đẩy Giá và % thành cột dọc */
                .sc-stats-row { padding: 6px 10px; gap: 8px; }
                .sc-price-box { flex-direction: column; align-items: flex-start; gap: 0px; margin-right: 5px; justify-content: center;}
                .sc-price-box #sc-live-price { font-size: 22px !important; }
                .sc-price-box #sc-change-24h { font-size: 11px !important; }
                
                /* Ép 5 thông số nằm vừa 1 hàng không cuộn */
                .sc-metrics-compact { width: 100%; justify-content: space-between; gap: 2px; overflow: hidden; padding-bottom: 0;}
                .sc-mc-item span { font-size: 8px; margin-bottom: 0; }
                .sc-mc-item strong { font-size: 10.5px; }
                
                .sc-side-panel { width: 100% !important; flex: 1 !important; border-left: none; background: #0B0E11; }
                .sc-mobile-tabs { display: flex; background: #12151A; border-bottom: 1px solid #1e2329; }
                .sc-tab-btn { flex: 1; background: transparent; border: none; color: #5e6673; padding: 8px 0; font-size: 11px; font-weight: 700; cursor: pointer; border-bottom: 2px solid transparent; text-transform: uppercase; transition: 0.2s;}
                .sc-tab-btn.active { color: #00F0FF; border-bottom-color: #00F0FF; background: rgba(0, 240, 255, 0.05); }
                
                .sc-tab-content { display: none; padding: 5px 0; flex: 1; overflow-y: auto;}
                .sc-tab-content.active { display: flex; }
                .sc-panel-section { padding: 5px 15px 10px 15px; border-bottom: none; margin-bottom: 5px;}
            }
        `;
        document.head.appendChild(proChartStyle);
    }
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        document.body.appendChild(modal);
    }); 
   
    injectLayout();

    const savedTab = localStorage.getItem('wave_main_tab') || 'alpha'; 
    window.pluginSwitchTab(savedTab, true);
    
    initMarket();
    setupEvents();
});


function calculateMarketStats(tokensToCalc) {
    let stats = {
        totalScan: tokensToCalc.length,
        countActive: 0, countSpot: 0, countDelisted: 0,
        alphaDailyTotal: 0, alphaDailyLimit: 0, alphaDailyChain: 0, alphaRolling24h: 0,
        gainers: 0, losers: 0,
        distribList: {
            up_0_2: [], up_2_4: [], up_4_6: [], up_6_8: [], up_8: [],
            down_0_2: [], down_2_4: [], down_4_6: [], down_6_8: [], down_8: []
        },
        maxDistribCount: 0, topVolTokens: []
    };

    let tempVolList = [];

    tokensToCalc.forEach(t => {
        const status = getTokenStatus(t);
        const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'));

        if (status === 'SPOT') {
            stats.countSpot++;
        } else if (status === 'DELISTED' || status === 'PRE_DELISTED') {
            stats.countDelisted++;
        } else if (isStock) {
            // NẾU LÀ CHỨNG KHOÁN -> BỎ QUA KHỎI STATS CHUNG
        } else {
            stats.countActive++;
            const v = t.volume || {};
            stats.alphaDailyTotal += (v.daily_total || 0);
            stats.alphaDailyLimit += (v.daily_limit || 0);
            stats.alphaDailyChain += (v.daily_onchain || 0);
            stats.alphaRolling24h += (v.rolling_24h || 0);

            if ((v.daily_total || 0) > 0) tempVolList.push(t);

            const chg = t.change_24h || 0;
            if (chg >= 0) stats.gainers++; else stats.losers++;
            
            const abs = Math.abs(chg);
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
        } 
    }); 

    tempVolList.sort((a, b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0));
    stats.topVolTokens = tempVolList.slice(0, 10);

    const d = stats.distribList;
    stats.maxDistribCount = Math.max(
        d.up_8.length, d.up_6_8.length, d.up_4_6.length, d.up_2_4.length, d.up_0_2.length,
        d.down_0_2.length, d.down_2_4.length, d.down_4_6.length, d.down_6_8.length, d.down_8.length, 1
    );

    return stats;
}

function renderTable() {
    const tbody = document.getElementById('market-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const stats = calculateMarketStats(allTokens);
    renderMarketHUD(stats); 
    renderTableRows(tbody); 
}

function renderTableRows(tbody) {
    let list = allTokens.filter(t => {
        const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
        const matchSearch = (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term));
        if (!matchSearch) return false;
        
        if (currentFilter === 'FAV') {
             return pinnedTokens.includes(t.symbol);
        }

        const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'));
        if (currentFilter === 'RWA') return isStock;
        if (isStock && currentFilter !== 'ALL') return false; 

        const status = getTokenStatus(t);
        if (currentFilter !== 'ALL' && currentFilter !== 'RWA' && status !== currentFilter) return false;
        
        if (filterPoints && (t.mul_point || 1) <= 1) return false;
        return true;
    });

    list.sort((a, b) => {
        const pinA = pinnedTokens.includes(a.symbol);
        const pinB = pinnedTokens.includes(b.symbol);
        if (pinA && !pinB) return -1;
        if (!pinA && pinB) return 1;

        const statusA = getTokenStatus(a);
        const statusB = getTokenStatus(b);
        const isBottomA = (statusA === 'SPOT' || statusA === 'DELISTED' || statusA === 'PRE_DELISTED');
        const isBottomB = (statusB === 'SPOT' || statusB === 'DELISTED' || statusB === 'PRE_DELISTED');

        if (!isBottomA && isBottomB) return -1;
        if (isBottomA && !isBottomB) return 1;

        if (sortConfig.key && sortConfig.dir) {
            let key = sortConfig.key;
            if (key === 'price') key = 'change_24h'; 

            const valA = getVal(a, key);
            const valB = getVal(b, key);
            return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
        }

        return 0;
    });

    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    const pageList = list.slice(startIndex, endIndex);

    if(document.getElementById('page-start')) document.getElementById('page-start').innerText = totalItems > 0 ? startIndex + 1 : 0;
    if(document.getElementById('page-end')) document.getElementById('page-end').innerText = endIndex;
    if(document.getElementById('total-tokens')) document.getElementById('total-tokens').innerText = totalItems;
    if(document.getElementById('page-num')) document.getElementById('page-num').innerText = `Page ${currentPage} / ${totalPages || 1}`;
    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = currentPage >= totalPages;

    pageList.forEach((t, index) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (!e.target.closest('.star-icon') && !e.target.closest('.contract-row')) {
                window.openProChart(t);
            }
        };
        const realIndex = startIndex + index + 1;

        let domKey = t.symbol; 
        if (t.alphaId) {
            domKey = String(t.alphaId).replace('ALPHA_', '');
        } else if (t.id) {
            domKey = String(t.id).replace('ALPHA_', '');
        }

        const status = getTokenStatus(t);
        let startBadges = [];
        if (t.onlineTge) startBadges.push('<span class="smart-badge badge-tge">TGE</span>');
        if (t.onlineAirdrop) startBadges.push('<span class="smart-badge badge-airdrop">AIR</span>');
        let journeyHtml = startBadges.join(' ');
        if (status === 'SPOT') {
            let endBadge = '<span class="smart-badge badge-spot">SPOT</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        } else if (status === 'DELISTED' || status === 'PRE_DELISTED') {
            let endBadge = '<span class="smart-badge badge-delisted">DELIST</span>';
            journeyHtml = journeyHtml ? `${journeyHtml} <span class="status-arrow">➔</span> ${endBadge}` : endBadge;
        }
        const now = Date.now();
        let mulBadgeHtml = '';
        if (!t.offline && t.listing_time && t.mul_point > 1) {
            let start = new Date(t.listing_time);
            let expiryTime = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 29, 23, 59, 59, 999)).getTime();
            const diffDays = Math.ceil((expiryTime - now) / 86400000);
            
            if (diffDays > 0) {
                const badgeClass = (t.chain === 'BSC') ? 'badge-bsc' : 'badge-alpha';
                mulBadgeHtml = `<span class="smart-badge ${badgeClass}">x${t.mul_point} ${diffDays}d</span>`;
            }
        }
        const maxVolPage = Math.max(...pageList.map(i => i.volume.daily_total || 0)) || 1;
        const volPct = ((t.volume.daily_total || 0) / maxVolPage) * 100;
        const isUp = t.change_24h >= 0;
        const absChg = Math.abs(t.change_24h);
        let opacityStart = 0.15;
        let opacityEnd = 0.02;
        if (absChg >= 20) { opacityStart = 0.5; opacityEnd = 0.1; }
        else if (absChg >= 10) { opacityStart = 0.3; opacityEnd = 0.05; }
        const rgb = isUp ? '34, 171, 148' : '246, 70, 93';
        const cellStyle = `background: linear-gradient(90deg, rgba(${rgb}, ${opacityStart}) 0%, rgba(${rgb}, ${opacityEnd}) 100%) !important;`;
        const textColorClass = isUp ? 'text-green' : 'text-red';
        const sign = isUp ? '+' : '';
        
        tr.innerHTML = `
            <td class="text-center col-fix-1">
                <i class="${pinnedTokens.includes(t.symbol) ? 'fas fa-star text-brand' : 'far fa-star text-secondary'} star-icon" onclick="window.togglePin('${t.symbol}')"></i>
                <div style="font-size:9px; color:#555; margin-top:4px;">${realIndex}</div>
            </td>
            <td class="col-fix-2">
                <div class="token-cell">
                    <div class="logo-wrapper">
                        <img src="${t.icon || 'assets/tokens/default.png'}" class="token-logo" onerror="this.src='assets/tokens/default.png'">
                        ${t.chain_icon ? `<img src="${t.chain_icon}" class="chain-badge">` : ''}
                    </div>
                    <div class="token-meta-container" style="display:block;">
                         <div class="symbol-row">
                            <span class="symbol-text">${t.symbol}</span>
                            ${mulBadgeHtml}
                        </div>
                        <div class="contract-row text-secondary" onclick="window.pluginCopy('${t.contract}')" style="cursor:pointer; font-size:11px;">
                            ${t.name || t.contract?.substring(0,6)}
                        </div>
                    </div>
                </div>
            </td>
            <td class="text-center status-col">
                <div class="status-badge-wrapper">${journeyHtml}</div>
                ${t.listing_time ? `<div class="journey-date-center"><i class="far fa-clock"></i> ${new Date(t.listing_time).toLocaleDateString('en-GB')}</div>` : ''}
            </td>

            <td id="alpha-td-price-${domKey}" class="text-center" style="${cellStyle}">
                <div id="alpha-price-${domKey}" data-raw="${t.price}" class="text-primary-val" style="font-weight:700; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">$${formatPrice(t.price)}</div>
                <div id="alpha-change-${domKey}" class="${textColorClass}" style="font-size:11px; font-weight:700; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
                    ${sign}${t.change_24h}%
                </div>
            </td>

            <td class="chart-cell" style="padding: 5px 10px; overflow: hidden; max-width: 100px; width: 100px;">
                ${getSparklineSVG(t.chart)}
            </td>

            <td class="text-end font-num">
                <div class="vol-cell-group">
                    <span id="alpha-vol-tot-${domKey}" class="text-primary-val">$${formatCompactNum(t.volume.daily_total)}</span>
                    <div class="vol-bar-bg"><div id="alpha-bar-${domKey}" class="vol-bar-fill" style="width:${Math.min(100, volPct)}%"></div></div>
                </div>
            </td>

            <td id="alpha-vol-lim-${domKey}" class="text-end font-num text-secondary-val">$${formatCompactNum(t.volume.daily_limit)}</td>
            
            <td id="alpha-vol-chain-${domKey}" class="text-end font-num text-secondary-val">
                $${formatCompactNum(Math.max(0, (t.volume.daily_total || 0) - (t.volume.daily_limit || 0)))}
            </td>
            
            <td id="alpha-vol-r24-${domKey}" class="text-end font-num text-secondary-val">
                 $${formatCompactNum(t.volume.rolling_24h)}
            </td>

            <td id="alpha-tx-${domKey}" class="text-end font-num text-secondary-val">${formatInt(t.tx_count)}</td>
            
            <td id="alpha-liq-${domKey}" class="text-end font-num text-secondary-val">$${formatCompactNum(t.liquidity)}</td>

            <td id="alpha-mc-${domKey}" class="text-end font-num text-secondary-val">$${formatCompactNum(t.market_cap)}</td>
            
            <td id="alpha-hold-${domKey}" class="text-end font-num text-secondary-val">${formatInt(t.holders)}</td>
            `;
        tbody.appendChild(tr);
    });
    if (pageList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-secondary">No data found matching filters.</td></tr>';
    }
}


function renderMarketHUD(stats) {
    const view = document.getElementById('alpha-market-view');
    if (!view || !view.querySelector('.alpha-container')) return;
    const container = view.querySelector('.alpha-container'); 
    
    // =======================================================
    // 1. MARQUEE TICKER CHO RWA
    // =======================================================
    let rwaTokens = allTokens.filter(t => t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on')));
    rwaTokens.sort((a, b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0));
    
    let marqueeContainer = document.getElementById('rwa-marquee-container');
    if (marqueeContainer && rwaTokens.length > 0) {
        if (!document.getElementById('rwa-marquee-wrapper')) {
            let marqueeItems = rwaTokens.map(t => {
                let isUp = (t.change_24h || 0) >= 0;
                let color = isUp ? '#0ecb81' : '#f6465d';
                let sign = isUp ? '+' : '';
                let safeSym = (t.symbol || '').replace(/"/g, '\\"');
                let cStr = parseFloat(t.change_24h || 0).toFixed(2);
                
                return `<div class="rwa-item" onclick="window.pluginCopy('${t.contract}')" title="Copy Contract">
                    <img src="${t.icon || 'assets/tokens/default.png'}" style="width:18px;height:18px;border-radius:50%; border:1px solid #444;">
                    <span class="text-white fw-bold">${t.symbol}</span>
                    <span data-rwa-p="${safeSym}" style="color:#eaecef">$${formatPrice(t.price)}</span>
                    <span data-rwa-c="${safeSym}" style="color:${color}">${sign}${cStr}%</span>
                </div>`;
            }).join('<span class="text-secondary mx-3">|</span>');

            marqueeContainer.innerHTML = `
            <div id="rwa-marquee-wrapper" class="rwa-marquee-wrapper">
                <div class="rwa-marquee-label"><i class="fas fa-chart-line me-1"></i> RWA STOCKS</div>
                <div class="rwa-marquee-content">
                    ${marqueeItems} <span class="text-secondary mx-3">|</span> ${marqueeItems}
                </div>
            </div>`;
        } else {
            rwaTokens.forEach(t => {
                let isUp = (t.change_24h || 0) >= 0;
                let safeSym = (t.symbol || '').replace(/"/g, '\\"');
                let cStr = parseFloat(t.change_24h || 0).toFixed(2);
                
                document.querySelectorAll(`[data-rwa-p="${safeSym}"]`).forEach(el => el.innerText = '$' + formatPrice(t.price));
                document.querySelectorAll(`[data-rwa-c="${safeSym}"]`).forEach(el => {
                    el.style.color = isUp ? '#0ecb81' : '#f6465d';
                    el.innerText = (isUp ? '+' : '') + cStr + '%';
                });
            });
        }
    }

    // =======================================================
    // 2. CHUẨN BỊ LOGIC DỮ LIỆU CHUNG (FIX LỖI FORMAT SỐ TỶ B)
    // =======================================================
    const formatNumK = (num) => {
        if(num >= 1000000000) return (num/1000000000).toFixed(2) + 'B'; // Đã thêm Tỷ (B)
        if(num >= 1000000) return (num/1000000).toFixed(2) + 'M'; // Triệu (M)
        if(num >= 1000) return (num/1000).toFixed(0) + 'K';
        return num || 0;
    };

    let updateTime = "Waiting...";
    const timeEl = document.getElementById('last-updated');
    if (timeEl && timeEl.innerText.includes('Updated:')) {
        updateTime = timeEl.innerText.replace('Updated: ', '').trim();
    } else {
        updateTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    let activeTokens = allTokens.filter(t => {
        const s = getTokenStatus(t);
        const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'));
        return s !== 'SPOT' && s !== 'DELISTED' && s !== 'PRE_DELISTED' && !isStock;
    });
    
    activeTokens.sort((a, b) => (b.volume.rolling_24h || 0) - (a.volume.rolling_24h || 0));
    const top10Rolling = activeTokens.slice(0, 10);
    const maxVolRolling = top10Rolling[0] ? (top10Rolling[0].volume.rolling_24h || 1) : 1;
    const volTop10Sum = top10Rolling.reduce((sum, t) => sum + (t.volume.rolling_24h || 0), 0);
    const totalRolling = stats.alphaRolling24h || 1;
    let domPct = totalRolling > 0 ? (volTop10Sum / totalRolling) * 100 : 0;
    domPct = Math.min(100, Math.max(0, domPct)) || 0;

    let dailyTokens = [...stats.topVolTokens].sort((a, b) => (b.volume.daily_total || 0) - (a.volume.daily_total || 0));
    const top10Daily = dailyTokens.slice(0, 10);
    const maxVolDaily = top10Daily[0] ? (top10Daily[0].volume.daily_total || 1) : 1;
    const volDailyTop10Sum = top10Daily.reduce((sum, t) => sum + (t.volume.daily_total || 0), 0);
    const totalDaily = stats.alphaDailyTotal || 1;
    let dailyDomPct = totalDaily > 0 ? (volDailyTop10Sum / totalDaily) * 100 : 0;
    dailyDomPct = Math.min(100, Math.max(0, dailyDomPct)) || 0;

    let validForTrend = allTokens.filter(t => !t.offline && t.price > 0 && !(t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'))));
    let topGainers = [...validForTrend].sort((a, b) => b.change_24h - a.change_24h).slice(0, 3);
    let topLosers = [...validForTrend].sort((a, b) => a.change_24h - b.change_24h).slice(0, 3);

    const renderTrendItem = (t, type) => {
        if (!t) return '';
        const colorClass = type === 'gain' ? 'text-green' : 'text-red';
        const arrow = type === 'gain' ? '▲' : '▼';
        return `
            <div class="trend-item">
                <div class="trend-symbol"><img src="${t.icon || 'assets/tokens/default.png'}" onerror="this.src='assets/tokens/default.png'"><span>${t.symbol}</span></div>
                <div class="trend-info">
                    <div class="trend-price">$${formatPrice(t.price)}</div>
                    <div class="trend-chg ${colorClass}">${arrow}${Math.abs(t.change_24h)}%</div>
                </div>
            </div>
        `;
    };

    // --- FIX TOP 10: CHỮ ÔM SÁT THANH BAR ---
    const renderRow = (t, idx, type) => {
        if (!t) return '';
        let barHtml = '', volDisplay = 0, pctWidth = 0;
        const dataAttrs = `data-symbol="${t.symbol}" data-total="${formatNum(t.volume.daily_total)}" data-limit="${formatNum(t.volume.daily_limit)}" data-chain="${formatNum(t.volume.daily_onchain)}"`;
        const tooltipEvents = `onmouseenter="window.showTooltip(event, this)" onmousemove="window.moveTooltip(event)" onmouseleave="window.hideTooltip()"`;

        if (type === 'ROLLING') {
            volDisplay = t.volume.rolling_24h || 0;
            pctWidth = maxVolRolling > 0 ? (volDisplay / maxVolRolling) * 100 : 0;
            pctWidth = Math.min(100, Math.max(0, pctWidth)) || 0;
            barHtml = `<div class="hud-bar-fill" style="width:100%; height:100%; background:#5E6673; border-radius:2px;"></div>`;
        } else {
            volDisplay = t.volume.daily_total || 0;
            pctWidth = maxVolDaily > 0 ? (volDisplay / maxVolDaily) * 100 : 0;
            pctWidth = Math.min(100, Math.max(0, pctWidth)) || 0;
            const pLimit = volDisplay > 0 ? ((t.volume.daily_limit || 0) / volDisplay) * 100 : 0;
            const pChain = volDisplay > 0 ? ((t.volume.daily_onchain || 0) / volDisplay) * 100 : 0;
            barHtml = `<div style="width:100%; height:100%; display:flex; border-radius:2px; overflow:hidden;">
                    <div style="width:${pLimit}%; height:100%; background:#F0B90B;"></div>
                    <div style="width:${pChain}%; height:100%; background:#9945FF;"></div>
                </div>`;
        }
        
        return `
            <div class="hud-list-row" ${dataAttrs} ${tooltipEvents} style="cursor:pointer; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.02);">
                <div class="hud-list-idx" style="font-size: 10px; width: 18px;">#${idx}</div>
                <div class="hud-list-name" title="${t.symbol}" style="font-size: 11px; width: 55px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.symbol}</div>
                
                <div class="hud-bar-wrapper" style="flex:1; display:flex; align-items:center; gap:6px;">
                    <div style="flex: 0 0 ${pctWidth}%; max-width: calc(100% - 40px); height:6px;"> ${barHtml}</div>
                    <div class="hud-list-val" style="font-size: 10.5px; color:#eaecef;">$${formatNumK(volDisplay)}</div>
                </div>
            </div>
        `;
    };

    const d = stats.distribList;
    const drawSentBar = (listTokens, label, colorClass) => {
        const count = listTokens.length;
        let h = stats.maxDistribCount > 0 ? (count / stats.maxDistribCount) * 100 : 0; 
        if (count > 0 && h < 5) h = 5;
        const tokensStr = listTokens.join(', '); 
        return `
            <div class="distrib-bar-item" onclick="window.showListTooltip(event, '${label}', '${tokensStr}')" onmouseenter="window.showListTooltip(event, '${label}', '${tokensStr}')" onmouseleave="window.hideTooltip()">
                 ${count > 0 ? `<div style="font-size:8px; font-weight:bold; color:#fff; margin-bottom:2px; text-align:center; width:100%">${count}</div>` : ''}
                 <div style="width:100%; height:${h}%; border-radius:1px;" class="${colorClass}"></div>
            </div>
        `;
    };

// --- CHART REAL 100%: LẤY TỪ BACKEND ---
    let volHistory = window.MARKET_VOL_HISTORY || [];
    let yRolling = volHistory.length > 0 ? (volHistory[volHistory.length - 1].rolling || 0) : 0;
    
    let rollingPctHtml = '<span style="color:#848e9c; font-weight:bold;">--</span>';
    if (yRolling > 0) {
        let rPct = ((stats.alphaRolling24h - yRolling) / yRolling) * 100;
        let rColor = rPct >= 0 ? '#0ecb81' : '#f6465d';
        let rSign = rPct >= 0 ? '▲ +' : '▼ ';
        rollingPctHtml = `<span style="color:${rColor}; font-weight:bold;">${rSign}${rPct.toFixed(2)}%</span>`;
    }

    let yDaily = volHistory.length > 0 ? (volHistory[volHistory.length - 1].daily || 0) : 0;
    let yDailyText = yDaily > 0 ? `Yesterday: $${formatCompactNum(yDaily)}` : '--';

    // XÓA FAKE DATA, CHỈ LẤY DATA THẬT
    let chartData = [...volHistory].slice(-13);

    
    chartData.push({ date: 'Today', daily: stats.alphaDailyTotal });
    let maxDailyChart = Math.max(...chartData.map(d => d.daily || 0), 1);
    
    let midChartHtml = chartData.map((d, i) => {
        let h = ((d.daily || 0) / maxDailyChart) * 100;
        if(h < 5 && (d.daily || 0) > 0) h = 5; 
        
        let colorClass = 'up';
        if (i > 0 && (d.daily || 0) < (chartData[i-1].daily || 0)) colorClass = 'down';
        let isToday = (i === chartData.length - 1) ? 'today' : colorClass;
        
        let dateLabel = d.date === 'Today' ? 'Hôm nay' : (d.date ? d.date.substring(5).replace('-','/') : '');
        let volLabel = '$' + formatCompactNum(d.daily || 0);
        
        return `<div class="daily-mid-bar ${isToday}" style="height:${h}%">
            <div class="chart-tooltip">${dateLabel}: ${volLabel}</div>
        </div>`;
    }).join('');


    // =======================================================
    // 3. TẠO KHUNG HUD (FIX CÂN ĐỐI CHIỀU CAO THẺ 1)
    // =======================================================
    let hud = document.getElementById('market-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'market-hud';
        hud.className = 'market-hud-container';
        
        hud.innerHTML = `
            <div class="hud-card" style="display:flex; flex-direction:column; justify-content:space-between; height:100%;">
                <div>
                    <div class="hud-title" style="margin-bottom:0px">MARKET LIFECYCLE</div>
                    <div style="font-family:var(--font-num); font-size:20px; font-weight:700; color:#fff; margin-bottom:8px; display:flex; align-items:baseline; gap:4px;">
                        <span id="hud-total-scan">0</span> 
                        <span style="font-size:11px; color:#5E6673; font-weight:600; font-family:var(--font-main);">Crypto Tokens</span>
                    </div>
                    <div id="hud-lifecycle-bar" style="display:flex; width:100%; height:24px; background:#1e2329; border-radius:4px; overflow:hidden; margin-bottom:0; font-family:var(--font-num); font-weight:700; font-size:11px; letter-spacing:0.5px;"></div>
                </div>
                
                <div style="flex-grow: 1; min-height: 12px;"></div> <div>
                    <div class="hud-title" style="border-top:1px solid rgba(255,255,255,0.05); padding-top:10px; margin-bottom:2px;">24H PRICE ACTION</div>
                    <div id="hud-trend-grid" class="trend-grid-inner"></div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700; font-family:var(--font-num);">
                        <div style="color:#f6465d">▼ <span id="hud-losers-count">0</span> LOSERS</div>
                        <div style="color:#0ecb81"><span id="hud-gainers-count">0</span> GAINERS ▲</div>
                    </div>
                </div>

                <div style="flex-grow: 1.5; min-height: 12px;"></div> <div>
                    <div id="hud-distrib-container" class="distrib-container"></div>
                    <div class="distrib-label-row">
                        <div class="distrib-label-side red"><div class="distrib-label">>8%</div><div class="distrib-label">6-8%</div><div class="distrib-label">4-6%</div><div class="distrib-label">2-4%</div><div class="distrib-label">0-2%</div></div>
                        <div class="distrib-label-side green"><div class="distrib-label">0-2%</div><div class="distrib-label">2-4%</div><div class="distrib-label">4-6%</div><div class="distrib-label">6-8%</div><div class="distrib-label">>8%</div></div>
                    </div>
                </div>
            </div>

            <div class="hud-card">
                <div class="hud-title" style="display:flex; align-items:center; justify-content:space-between;">
                    <div>ROLLING VOL 24H <span class="excl-rwa-badge">Excl. RWA</span></div>
                </div>
                <div style="display:flex; align-items:baseline; gap:10px;">
                    <div id="hud-rolling-total" class="hud-main-value" style="font-size:22px; color:#eaecef;">$0</div>
                    <div id="hud-rolling-pct" style="font-size:12px; color:#848e9c; font-weight:bold;" title="So với hôm qua">--</div>
                </div>

                <div style="height:65px; margin: 15px 0 10px 0; display:flex; flex-direction:column; align-items:center; justify-content:center; background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 80%); border-radius: 4px; border: 1px dashed rgba(255,255,255,0.05);">
                    <div style="display:flex; align-items:center; gap:8px; color:#0ecb81; font-size:10px; font-weight:bold; letter-spacing:1px;">
                        <span style="width:6px; height:6px; background:#0ecb81; border-radius:50%; box-shadow:0 0 8px #0ecb81; animation: pulse-dot 1.5s infinite;"></span>
                        LIVE TRACKING
                    </div>
                    <div style="color:#5E6673; font-size:9px; margin-top:4px;">Rolling 24H Window</div>
                </div>

                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                    <div style="flex:1; height:4px; background:#2b3139; border-radius:2px;">
                        <div id="hud-rolling-dom-bar" style="width:0%; height:100%; background:#eaecef; border-radius:2px;"></div>
                    </div>
                    <div style="font-size:9px; color:#848E9C; white-space:nowrap;">TOP 10: <span id="hud-rolling-dom-txt" style="color:#fff">0%</span></div>
                </div>
                <div class="hud-sub-stat-row spacer" style="margin-bottom:8px;"></div>
                <div id="hud-rolling-list" class="hud-list-container"></div>
            </div>

            <div class="hud-card">
                <div class="hud-title" style="display:flex; align-items:center; justify-content:space-between;">
                    <div>DAILY VOL (UTC) <span class="excl-rwa-badge">Excl. RWA</span></div>
                    <span id="hud-update-time" class="update-badge">Waiting...</span>
                </div>
                <div style="display:flex; align-items:baseline; gap:10px;">
                    <div id="hud-daily-total" class="hud-main-value" style="font-size:22px; color:#eaecef;">$0</div>
                    <div id="hud-daily-yesterday" style="font-size:12px; color:#848e9c; font-weight:bold;" title="So với hôm qua">--</div>
                </div>
                 
                <div id="hud-mid-chart" class="daily-mid-chart"></div>

                <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">
                    <div style="flex:1; height:4px; background:#2b3139; border-radius:2px;">
                        <div id="hud-daily-dom-bar" style="width:0%; height:100%; background:#eaecef; border-radius:2px;"></div>
                    </div>
                    <div style="font-size:9px; color:#848E9C; white-space:nowrap;">TOP 10: <span id="hud-daily-dom-txt" style="color:#fff">0%</span></div>
                </div>
                <div class="hud-sub-stat-row" style="margin-bottom:8px; font-size: 9px;">
                    <div style="color:#F0B90B;">● LIMIT: $<span id="hud-daily-limit">0</span></div>
                    <div style="color:#9945FF;">● CHAIN: $<span id="hud-daily-chain">0</span></div>
                </div>
                
                <div id="hud-daily-list" class="hud-list-container"></div>
            </div>
        `;
        
        if (marqueeContainer) {
            marqueeContainer.after(hud);
        } else {
            container.insertBefore(hud, container.firstChild);
        }
    }

    // =======================================================
    // 4. TIÊM MÁU VÀO XƯƠNG
    // =======================================================
    const pctActive = stats.totalScan > 0 ? (stats.countActive / stats.totalScan) * 100 : 0;
    const pctSpot = stats.totalScan > 0 ? (stats.countSpot / stats.totalScan) * 100 : 0;
    const pctDelist = stats.totalScan > 0 ? (stats.countDelisted / stats.totalScan) * 100 : 0;

    const safeSet = (id, html, isText=false) => {
        let el = document.getElementById(id);
        if (el) { if (isText) el.innerText = html; else el.innerHTML = html; }
    };

    safeSet('hud-update-time', updateTime, true);
    safeSet('hud-total-scan', (stats.countActive + stats.countSpot + stats.countDelisted), true);
    
    safeSet('hud-lifecycle-bar', `
        <div style="width:${pctActive}%; background:#0ecb81; color:#000; display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden;">${pctActive > 5 ? `${stats.countActive} LIVE` : ''}</div>
        <div style="width:${pctSpot}%; background:#F0B90B; color:#000; display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden; border-left:1px solid rgba(0,0,0,0.1);">${pctSpot > 5 ? `${stats.countSpot} SPOT` : ''}</div>
        <div style="width:${pctDelist}%; background:#f6465d; color:#fff; display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden; border-left:1px solid rgba(0,0,0,0.1);">${pctDelist > 5 ? `${stats.countDelisted} DEAD` : ''}</div>
    `);

    safeSet('hud-losers-count', stats.losers, true);
    safeSet('hud-gainers-count', stats.gainers, true);
    
    safeSet('hud-trend-grid', `
        <div class="trend-col">${topLosers.map(t => renderTrendItem(t, 'lose')).join('')}</div>
        <div class="trend-col">${topGainers.map(t => renderTrendItem(t, 'gain')).join('')}</div>
    `);

    safeSet('hud-distrib-container', `
        <div class="distrib-side red">
            ${drawSentBar(d.down_8, '>8%', 'bg-red-5')} ${drawSentBar(d.down_6_8, '6-8%', 'bg-red-4')}
            ${drawSentBar(d.down_4_6, '4-6%', 'bg-red-3')} ${drawSentBar(d.down_2_4, '2-4%', 'bg-red-2')} ${drawSentBar(d.down_0_2, '0-2%', 'bg-red-1')}
        </div>
        <div class="distrib-side green">
            ${drawSentBar(d.up_0_2, '0-2%', 'bg-green-1')} ${drawSentBar(d.up_2_4, '2-4%', 'bg-green-2')}
            ${drawSentBar(d.up_4_6, '4-6%', 'bg-green-3')} ${drawSentBar(d.up_6_8, '6-8%', 'bg-green-4')} ${drawSentBar(d.up_8, '>8%', 'bg-green-5')}
        </div>
    `);

    safeSet('hud-rolling-total', '$' + formatNum(stats.alphaRolling24h), true);
    safeSet('hud-rolling-pct', rollingPctHtml, false);
    let rb = document.getElementById('hud-rolling-dom-bar'); if(rb) rb.style.width = domPct + '%';
    safeSet('hud-rolling-dom-txt', domPct.toFixed(0) + '%', true);
    safeSet('hud-rolling-list', top10Rolling.map((t, i) => renderRow(t, i+1, 'ROLLING')).join(''));

    safeSet('hud-daily-total', '$' + formatNum(stats.alphaDailyTotal), true);
    safeSet('hud-daily-yesterday', yDailyText, true);
    safeSet('hud-mid-chart', midChartHtml, false); 
    let db = document.getElementById('hud-daily-dom-bar'); if(db) db.style.width = dailyDomPct + '%';
    safeSet('hud-daily-dom-txt', dailyDomPct.toFixed(0) + '%', true);
    safeSet('hud-daily-limit', formatNumK(stats.alphaDailyLimit), true);
    safeSet('hud-daily-chain', formatNumK(stats.alphaDailyChain), true);
    safeSet('hud-daily-list', top10Daily.map((t, i) => renderRow(t, i+1, 'DAILY')).join(''));
}

window.showTooltip = function(e, el) {
    const t = document.getElementById('hud-tooltip');
    if(t && el.dataset.symbol) {
        
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
        t.style.left = (e.clientX) + 'px';
        t.style.top = (e.clientY) + 'px';
    }
};

window.hideTooltip = function() {
    const t = document.getElementById('hud-tooltip');
    if(t) t.style.display = 'none';
};


// =======================================================
// GIAO DIỆN VÀ LOGIC CHÍNH
// =======================================================

function injectLayout() {
    document.getElementById('alpha-tab-nav')?.remove();
    document.getElementById('alpha-market-view')?.remove();
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    const tabNav = document.createElement('div');
    tabNav.id = 'alpha-tab-nav';
    tabNav.innerHTML = `
        <button id="btn-tab-alpha" class="tab-btn" onclick="window.pluginSwitchTab('alpha')">ALPHA MARKET</button>
        <button id="btn-tab-competition" class="tab-btn" onclick="window.pluginSwitchTab('competition')">COMPETITION</button>
        <button id="btn-tab-sonar" class="tab-btn" onclick="window.pluginSwitchTab('sonar')">SONAR GALAXY</button>
    `;
    navbar.insertAdjacentElement('afterend', tabNav);
    
    const marketView = document.createElement('div');
    marketView.id = 'alpha-market-view';
    marketView.style.display = 'none';
    
    marketView.innerHTML = `
        <div class="alpha-container">
            <div id="rwa-marquee-container"></div>
            <div class="alpha-header">
                 <div class="filter-group">
                    <button class="filter-btn active-all" id="btn-f-all" onclick="setFilter('ALL')">All</button>
                    <button class="filter-btn" id="btn-f-alpha" onclick="setFilter('ALPHA')">Alpha</button>
                    <button class="filter-btn" id="btn-f-spot" onclick="setFilter('SPOT')">Spot</button>
                    <button class="filter-btn" id="btn-f-delist" onclick="setFilter('DELISTED')">Delisted</button>
                    <button class="filter-btn" id="btn-f-rwa" onclick="setFilter('RWA')">RWA Stocks</button>
                    <button class="filter-btn" id="btn-f-fav" onclick="setFilter('FAV')">★ Favorites</button>
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
                            <th rowspan="2" class="text-center cursor-pointer" onclick="window.pluginSort('price')">PRICE (24h%)</th>
                            <th rowspan="2" class="text-center">CHART</th>
                            <th colspan="3" class="text-center th-group-vol">DAILY VOLUME (UTC)</th>
                            <th colspan="5" class="text-center th-group-stats">MARKET STATS</th> 
                        </tr>
                        <tr class="h-sub">
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_total')">TOTAL</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_limit')">LIMIT</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.daily_onchain')">ON-CHAIN</th>
                            
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('volume.rolling_24h')">VOL 24H</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('tx_count')">TXs</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('liquidity')">LIQ</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('market_cap')">MCAP</th>
                            <th class="text-end cursor-pointer" onclick="window.pluginSort('holders')">HOLDERS</th>
                        </tr>
                    </thead>
                    <tbody id="market-table-body"></tbody>
                </table>
            </div>
            <div class="pagination-container">
                <div class="page-info">
                    Showing <span id="page-start">0</span>-<span id="page-end">0</span> of <span id="total-tokens">0</span> tokens
                </div>
                <div class="page-controls">
                    Rows: 
                    <select id="rows-per-page" class="rows-selector" onchange="changeRowsPerPage()">
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                    <button class="page-btn" id="btn-prev" onclick="prevPage()">&lt;</button>
                    <span id="page-num" style="margin:0 10px; font-weight:bold;">Page 1</span>
                    <button class="page-btn" id="btn-next" onclick="nextPage()">&gt;</button>
                </div>
            </div>
        </div>

        <div id="super-chart-overlay">
            <div class="sc-topbar">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img id="sc-coin-logo" style="width: 22px; height: 22px; border-radius: 50%;" src="assets/tokens/default.png" onerror="this.src='assets/tokens/default.png'">
                    <span id="sc-coin-symbol" style="font-size: 16px; font-weight: 800; color: #eaecef; font-family: var(--font-num);">---/USDT</span>
                    <span id="sc-coin-contract" style="background: rgba(255,255,255,0.05); color: #848e9c; font-size: 10px; padding: 3px 6px; border-radius: 4px; cursor: pointer;" onclick="window.pluginCopy(this.innerText)">---</span>
                    <span id="sc-algo-limit" style="background: rgba(14,203,129,0.1); color: #0ecb81; font-size: 10px; font-weight: 800; padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(14,203,129,0.3); white-space: nowrap;">ALGO: N/A</span>
                </div>
                <button style="background: transparent; border: none; color: #848e9c; font-size: 18px; cursor: pointer;" onclick="window.closeProChart()">✕</button>
            </div>

            <div class="sc-body">
                <div class="sc-chart-area">
                    <div class="sc-stats-row">
                        <div class="sc-price-box">
                            <div id="sc-live-price" style="font-size: 28px; font-weight: 700; color: #00F0FF; line-height: 1; font-family: var(--font-num); text-shadow: 0 0 10px rgba(0,240,255,0.2);">$--</div>
                            <div id="sc-change-24h" style="font-size: 14px; font-weight: 600; font-family: var(--font-num); color: #00F0FF;">--%</div>
                        </div>
                        
                        <div class="sc-metrics-compact">
                            <div class="sc-mc-item"><span>VOL(24H)</span><strong id="sc-top-vol">$--</strong></div>
                            <div class="sc-mc-item"><span>LIQ</span><strong id="sc-top-liq">$--</strong></div>
                            <div class="sc-mc-item"><span>MCAP</span><strong id="sc-top-mc">$--</strong></div>
                            <div class="sc-mc-item"><span>HOLD</span><strong id="sc-top-hold">--</strong></div>
                            <div class="sc-mc-item"><span>TXs</span><strong id="sc-top-tx">--</strong></div>
                        </div>
                    </div>
                    
                    <div class="sc-toolbar" style="display:flex; gap:4px; padding:6px 15px; background:#1e2329; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <button class="sc-time-btn active" onclick="window.changeChartInterval('tick', this)">Tick</button>
                        <span style="color:#2b3139; margin:0 2px;">|</span>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('1s', this)">1s</button>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('1m', this)">1m</button>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('5m', this)">5m</button>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('15m', this)">15m</button>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('1h', this)">1h</button>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('4h', this)">4h</button>
                        <button class="sc-time-btn" onclick="window.changeChartInterval('1d', this)">1d</button>
                    </div>
                    
                    <div id="sc-chart-container" style="flex:1; position: relative; overflow: hidden;">
                        <div id="sc-custom-tooltip" style="display:none; position: absolute; top: 10px; left: 10px; padding: 8px 12px; background: rgba(14, 18, 22, 0.9); border-radius: 4px; color: #848e9c; font-size: 11px; font-family: var(--font-num); font-weight: 500; pointer-events: none; z-index: 5; border: 1px solid rgba(255,255,255,0.02);">
                            <div id="tp-symbol" style="color:#eaecef; font-weight:800; font-size:12px; margin-bottom: 3px;">---</div>
                            <div style="display:flex; gap: 8px;">
                                <span>O: <strong id="tp-o" style="color:#eaecef;">--</strong></span>
                                <span>H: <strong id="tp-h" style="color:#00F0FF;">--</strong></span>
                                <span>L: <strong id="tp-l" style="color:#FF007F;">--</strong></span>
                                <span>C: <strong id="tp-c" style="color:#eaecef;">--</strong></span>
                            </div>
                            <div>V: <strong id="tp-v" style="color:#eaecef;">--</strong></div>
                            <div>T: <strong id="tp-t" style="color:#5e6673;">--</strong></div>
                        </div>
                    </div>
                </div> <div class="sc-side-panel">
                    <div class="sc-mobile-tabs">
                        <button class="sc-tab-btn active" onclick="window.switchScTab('trades', this)">Live Trades</button>
                        <button class="sc-tab-btn" onclick="window.switchScTab('info', this)">Data Flow</button>
                    </div>

                    <div id="tab-trades" class="sc-tab-content active" style="padding: 0; display: flex; flex-direction: column;">
                        <div class="sc-panel-title" style="padding: 10px 15px 5px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329;">
                            <i class="fas fa-bolt" style="color:#00F0FF; margin-right: 5px;"></i> LIVE TRADES
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:10px; color:#5e6673; padding: 6px 15px; font-weight:700; background: #0B0E11;">
                            <span>GIÁ</span><span>KL ($)</span><span>TIME</span>
                        </div>
                        <div id="sc-live-trades" style="flex:1; overflow-y:auto; padding: 0 10px; font-size:11.5px; font-family:var(--font-num);">
                            <div style="text-align:center; margin-top:20px; color:#5e6673; font-style:italic;">Connecting to Dex...</div>
                        </div>
                    </div>

                    <div id="tab-info" class="sc-tab-content" style="background: #12151A;">
                        <div class="sc-panel-section" style="padding-bottom: 10px;">
            <div class="sc-panel-title"><i class="fas fa-water" style="color:#00F0FF; margin-right: 5px;"></i> Smart Tape Tracker</div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Ticket trung bình</span><span id="sc-stat-avg-ticket" style="font-family:var(--font-num); color:#eaecef; font-weight:700;">$0</span></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Lệnh đột biến (🐋🦈🐬🤖)</span><span id="sc-stat-whale-tx" style="font-family:var(--font-num); color:#F0B90B; font-weight:700;">0</span></div>
        </div>
                        <div class="sc-panel-section" style="border-bottom: none; padding-top: 10px;">
                            <div class="sc-panel-title"><i class="fas fa-wave-square" style="color:#FF007F; margin-right: 5px;"></i> Data Flow (Realtime)</div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Dòng tiền Net</span><span id="sc-stat-net-flow" style="font-family:var(--font-num); color:#00F0FF; font-weight:700;">+$0</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Tốc độ khớp / s</span><span id="sc-stat-match-speed" style="font-family:var(--font-num); color:#eaecef; font-weight:700;">$0 /s</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Spread (15s)</span><span id="sc-stat-spread" style="font-family:var(--font-num); color:#eaecef; font-weight:700;">0.00%</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Trend (VWAP 60s)</span><span id="sc-stat-trend" style="font-family:var(--font-num); color:#eaecef; font-weight:700;">0.00%</span></div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="color:#848e9c; font-size:11px;">Rớt đỉnh (Drop 5m)</span><span id="sc-stat-drop" style="font-family:var(--font-num); color:#eaecef; font-weight:700;">0.00%</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    tabNav.insertAdjacentElement('afterend', marketView);

    document.body.appendChild(document.getElementById('super-chart-overlay'));

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

window.pluginSwitchTab = (tab, instant = false) => {
    localStorage.setItem('wave_main_tab', tab);
    const alphaView = document.getElementById('alpha-market-view');
    const compView = document.getElementById('view-dashboard');
    const sonarView = document.getElementById('sonar-market-view');
    const btnA = document.getElementById('btn-tab-alpha');
    const btnC = document.getElementById('btn-tab-competition');
    const btnS = document.getElementById('btn-tab-sonar');

    [alphaView, compView, sonarView].forEach(v => { if(v) v.style.display = 'none'; });
    [btnA, btnC, btnS].forEach(b => b?.classList.remove('active'));

    if (tab === 'alpha') {
        btnA?.classList.add('active');
        if(alphaView) alphaView.style.display = 'block';
    } else if (tab === 'competition' || tab === 'comp') {
        btnC?.classList.add('active');
        if(compView) compView.style.display = 'block';
        if (typeof renderGrid === 'function') renderGrid();
    } else if (tab === 'sonar') {
        btnS?.classList.add('active');
        if(sonarView) {
            sonarView.style.display = 'block';
            if (typeof mySonarGalaxy !== 'undefined' && mySonarGalaxy) {
                setTimeout(() => mySonarGalaxy.resize(), 50);
            }
        }
    }
};

window.pluginSort = function(key) {
    if (sortConfig.key === key) {
        if (sortConfig.dir === 'desc') sortConfig.dir = 'asc';
        else if (sortConfig.dir === 'asc') { sortConfig.key = null; sortConfig.dir = null; } 
        else sortConfig.dir = 'desc';
    } else {
        sortConfig.key = key;
        sortConfig.dir = 'desc';
    }
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

let lastDataUpdateTime = "Waiting...";

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now(), { method: 'GET', headers: { 'X-Wave-Source': 'web-client' } });
        if (!res.ok) return;
        const json = await res.json();
        const rawList = json.data || json.tokens || []; 
        allTokens = rawList.map(item => unminifyToken(item));

        let rawTime = json.meta ? json.meta.u : (json.last_updated || "");
        if (rawTime) {
            const d = new Date(rawTime.replace(' ', 'T')); 
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            lastDataUpdateTime = `${hours}:${mins} ${day}/${month}/${year}`;
        } else {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            lastDataUpdateTime = `${hours}:${mins} ${day}/${month}/${year}`;
        }
        updateSummary();
        renderTable();
        const timeLbl = document.getElementById('last-updated');
        if(timeLbl) timeLbl.innerText = 'Updated: ' + lastDataUpdateTime;
    } catch (e) { console.error("Data error:", e); }
}

window.togglePin = (symbol) => {
    if (pinnedTokens.includes(symbol)) pinnedTokens = pinnedTokens.filter(s => s !== symbol);
    else pinnedTokens.push(symbol);
    localStorage.setItem('alpha_pins', JSON.stringify(pinnedTokens));
    renderTable();
};

function formatNum(n) { return (!n) ? '0' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n); }
function formatCompactNum(n) { return (!n) ? '0' : new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(n); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) {
    if (!n) return '0';
    let v = parseFloat(n);
    let absV = Math.abs(v);
    if (absV >= 1000) return v.toFixed(2);
    if (absV >= 1) return v.toFixed(4);
    if (absV >= 0.1) return v.toFixed(6);
    if (absV >= 0.0001) return v.toFixed(8); 
    if (absV >= 0.000001) return v.toFixed(10);
    return v.toExponential(4);
}
function getVal(obj, path) { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); }
function setupEvents() { document.getElementById('alpha-search')?.addEventListener('keyup', () => renderTable()); window.addEventListener('scroll', () => { if (document.getElementById('alpha-market-view')?.style.display === 'block') { if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) { if (displayCount < allTokens.length) { displayCount += 50; renderTable(); } } } }); }

function getTokenStatus(t) {
    if (t.status) return t.status.toUpperCase();
    if (t.offline) { if (t.listingCex) return 'SPOT'; return 'DELISTED'; }
    return 'ALPHA'; 
}

function updateSummary() {
    let total = allTokens.length, spot = 0, delisted = 0, alpha = 0;
    allTokens.forEach(t => {
        const s = (t.status || '').toUpperCase();
        if (s === 'SPOT') spot++;
        else if (s === 'DELISTED' || s === 'PRE_DELISTED') delisted++;
        else alpha++; 
    });

    const elTotal = document.getElementById('stat-total-tokens');
    const elActive = document.getElementById('stat-active-tokens');
    const elSpot = document.getElementById('stat-spot-tokens');
    const elDelist = document.getElementById('stat-delisted-tokens');

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = alpha;
    if (elSpot) elSpot.innerText = spot;
    if (elDelist) elDelist.innerText = delisted;

    const elRate = document.getElementById('stat-spot-rate');
    if (elRate) {
        const rate = total > 0 ? ((spot / total) * 100).toFixed(1) : "0.0";
        elRate.innerText = `${rate}%`;
        if (parseFloat(rate) > 10) elRate.style.color = '#00ff88'; 
        else elRate.style.color = '#eaecef'; 
    }
}

window.toggleFilter = (filterType) => {
    currentFilter = (currentFilter === filterType) ? 'ALL' : filterType;
    document.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active-filter'));
    if (currentFilter === 'ALPHA') document.getElementById('card-alpha-vol')?.classList.add('active-filter');
    else if (currentFilter === 'SPOT') document.getElementById('card-spot')?.classList.add('active-filter');
    else if (currentFilter === 'DELISTED') document.getElementById('card-delist')?.classList.add('active-filter');
    renderTable(); 
};

function getSparklineSVG(data) {
    if (!data || !Array.isArray(data) || data.length < 2) return '';
    const width = 100, height = 30; 
    let prices, volumes, maxV = 1;
    if (typeof data[0] === 'object') {
        prices = data.map(d => d.p); volumes = data.map(d => d.v); maxV = Math.max(...volumes) || 1;
    } else { prices = data; volumes = []; }
    const minP = Math.min(...prices), maxP = Math.max(...prices), rangeP = maxP - minP || 1;
    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#0ecb81' : '#f6465d'; 
    let points = prices.map((p, i) => {
        const x = (i / (prices.length - 1)) * width;
        const bottomPadding = volumes.length > 0 ? 8 : 0; 
        const y = (height - bottomPadding) - ((p - minP) / rangeP) * (height - bottomPadding - 4) - 2; 
        return `${x},${y}`;
    }).join(' ');
    let bars = '';
    if (volumes.length > 0) {
        const barWidth = (width / (data.length - 1)) * 0.6; 
        volumes.forEach((v, i) => {
            let barHeight = (v / maxV) * 8;
            if (barHeight < 1 && v > 0) barHeight = 1;
            const x = (i / (data.length - 1)) * width;
            const y = height - barHeight;
            bars += `<rect x="${x - barWidth/2}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" opacity="0.3" />`;
        });
    }
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="mini-chart" style="overflow:visible; display:block;">${bars}<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
}

window.setFilter = function(status) {
    currentFilter = status; currentPage = 1;
    ['all', 'alpha', 'spot', 'delist', 'rwa', 'fav'].forEach(k => {
        document.getElementById(`btn-f-${k}`)?.classList.remove(`active-${k}`);
        document.getElementById(`btn-f-${k}`)?.classList.remove('active');
    });
    if (status === 'ALL') document.getElementById('btn-f-all').classList.add('active-all');
    else if (status === 'ALPHA') document.getElementById('btn-f-alpha').classList.add('active-alpha');
    else if (status === 'SPOT') document.getElementById('btn-f-spot').classList.add('active-spot');
    else if (status === 'DELISTED') document.getElementById('btn-f-delist').classList.add('active-delist');
    else if (status === 'RWA') document.getElementById('btn-f-rwa').classList.add('active-rwa');
    else if (status === 'FAV') {
        const btn = document.getElementById('btn-f-fav');
        if(btn) { btn.classList.add('active'); btn.style.color = '#F0B90B'; }
    }
    renderTable();
};

window.togglePoints = function() {
    filterPoints = !filterPoints;
    const btn = document.getElementById('btn-f-points');
    if (filterPoints) btn.classList.add('active-points'); else btn.classList.remove('active-points');
    renderTable();
};

const KEY_MAP_REVERSE = {
  "i": "id", "s": "symbol", "n": "name", "ic": "icon", "cn": "chain", "ci": "chain_icon", "ct": "contract",
  "st": "status", "p": "price", "c": "change_24h", "mp": "mul_point", "mc": "market_cap", "l": "liquidity", "v": "volume",
  "r24": "rolling_24h", "dt": "daily_total", "dl": "daily_limit", "do": "daily_onchain", "ch": "chart", "lt": "listing_time", "tx": "tx_count",
  "off": "offline", "cex": "listingCex", "tge": "onlineTge", "air": "onlineAirdrop", "aid": "alphaId", "h": "holders"
};

function unminifyToken(minifiedItem) {
  const fullItem = {};
  for (const [shortKey, value] of Object.entries(minifiedItem)) {
    const fullKey = KEY_MAP_REVERSE[shortKey] || shortKey; 
    if (fullKey === "volume" && typeof value === 'object') {
      fullItem[fullKey] = {};
      for (const [vKey, vVal] of Object.entries(value)) fullItem[fullKey][KEY_MAP_REVERSE[vKey] || vKey] = vVal;
    } else { fullItem[fullKey] = value; }
  }
  return fullItem;
}

window.showListTooltip = function(e, label, tokensStr) {
    const t = document.getElementById('hud-tooltip');
    if (!t) return;
    if(e.type === 'click') e.stopPropagation();
    if (!tokensStr) tokensStr = "No tokens";
    let displayStr = tokensStr;
    if (displayStr.length > 150) displayStr = displayStr.substring(0, 150) + "...";
    t.style.display = 'block';
    t.innerHTML = `
        <div style="color:#00F0FF; font-size:11px; font-weight:bold; margin-bottom:4px; border-bottom:1px solid #333; padding-bottom:2px;">PRICE RANGE: ${label}</div>
        <div style="color:#eaecef; font-size:10px; line-height:1.4; word-wrap:break-word;">${displayStr}</div>
    `;
    t.style.left = (e.clientX + 10) + 'px';
    t.style.top = (e.clientY + 10) + 'px';
};

window.prevPage = function() { if (currentPage > 1) { currentPage--; renderTable(); } };
window.nextPage = function() { currentPage++; renderTable(); };
window.changeRowsPerPage = function() {
    const select = document.getElementById('rows-per-page');
    if (select) { rowsPerPage = parseInt(select.value); currentPage = 1; renderTable(); }
};

window.updateAlphaMarketUI = function(serverData) {
    if (document.getElementById('alpha-market-view') && document.getElementById('alpha-market-view').style.display === 'none') return;
    if (serverData['_STATS']) window.MARKET_VOL_HISTORY = serverData['_STATS'];

    let hasUpdates = false;
    let maxVolDaily = Math.max(...allTokens.map(t => {
        const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'));
        return isStock ? 0 : (t.volume?.daily_total || 0);
    })) || 1;

    Object.keys(serverData).forEach(key => {
        if (key === '_STATS') return;
        let liveItem = serverData[key];
        let tokenKey = key.replace('ALPHA_', ''); 
        if (liveItem.alphaId) tokenKey = liveItem.alphaId.replace('ALPHA_', '');
        else if (!key.startsWith('ALPHA_')) tokenKey = liveItem.symbol || key;

        let targetToken = allTokens.find(t => (t.alphaId && t.alphaId.replace('ALPHA_','') === tokenKey) || (t.id && t.id.replace('ALPHA_','') === tokenKey) || t.symbol === tokenKey);

        if (targetToken) {
            hasUpdates = true;
            if (liveItem.p !== undefined) targetToken.price = parseFloat(liveItem.p);
            if (liveItem.c !== undefined) targetToken.change_24h = parseFloat(liveItem.c);
            if (liveItem.mc !== undefined) targetToken.market_cap = parseFloat(liveItem.mc);
            if (liveItem.h !== undefined) targetToken.holders = parseInt(liveItem.h);
            if (liveItem.tx !== undefined) targetToken.tx_count = parseInt(liveItem.tx);
            if (liveItem.l !== undefined) targetToken.liquidity = parseFloat(liveItem.l);
            if (liveItem.ss !== undefined) targetToken.stockState = liveItem.ss;
            
            if (!targetToken.volume) targetToken.volume = {};
            if (liveItem.r24 !== undefined) targetToken.volume.rolling_24h = parseFloat(liveItem.r24);
            if (liveItem.v) {
                if (liveItem.v.dt !== undefined) targetToken.volume.daily_total = parseFloat(liveItem.v.dt);
                if (liveItem.v.dl !== undefined) targetToken.volume.daily_limit = parseFloat(liveItem.v.dl);
                targetToken.volume.daily_onchain = Math.max(0, (targetToken.volume.daily_total || 0) - (targetToken.volume.daily_limit || 0));
            }
        }

        let priceEl = document.getElementById(`alpha-price-${tokenKey}`);
        if (priceEl && liveItem.p !== undefined) {
            let oldPrice = parseFloat(priceEl.getAttribute('data-raw')) || parseFloat(liveItem.p);
            let newPrice = parseFloat(liveItem.p);
            if (newPrice !== oldPrice) {
                let isUp = newPrice > oldPrice;
                priceEl.style.color = isUp ? '#0ECB81' : '#F6465D';
                priceEl.innerHTML = `$${newPrice.toLocaleString('en-US', { maximumFractionDigits: newPrice < 1 ? 6 : 4 })}`;
                priceEl.setAttribute('data-raw', newPrice);
                setTimeout(() => { priceEl.style.color = ''; }, 1000);
            } else if (!priceEl.getAttribute('data-raw')) { priceEl.setAttribute('data-raw', newPrice); }

            let tdPriceEl = document.getElementById(`alpha-td-price-${tokenKey}`);
            if (tdPriceEl && targetToken) {
                const isUp = targetToken.change_24h >= 0;
                const absChg = Math.abs(targetToken.change_24h);
                let opacityStart = 0.15, opacityEnd = 0.02;
                if (absChg >= 20) { opacityStart = 0.5; opacityEnd = 0.1; }
                else if (absChg >= 10) { opacityStart = 0.3; opacityEnd = 0.05; }
                const rgb = isUp ? '34, 171, 148' : '246, 70, 93';
                tdPriceEl.style.cssText = `background: linear-gradient(90deg, rgba(${rgb}, ${opacityStart}) 0%, rgba(${rgb}, ${opacityEnd}) 100%) !important;`;
            }
        }

        let changeEl = document.getElementById(`alpha-change-${tokenKey}`);
        if (changeEl && liveItem.c !== undefined) {
            let chg = parseFloat(liveItem.c);
            let sign = chg >= 0 ? '+' : '';
            changeEl.innerText = `${sign}${chg.toFixed(2)}%`;
            changeEl.className = chg >= 0 ? 'text-green' : 'text-red';
        }

        if (window.currentChartSymbol) {
            let chartSym = window.currentChartSymbol.toUpperCase();
            let tKey = tokenKey.toUpperCase();
            let targetSym = targetToken && targetToken.symbol ? targetToken.symbol.toUpperCase() : '';
            let isMatching = (tKey === chartSym || targetSym === chartSym || tKey.includes(chartSym) || chartSym.includes(tKey));

            
 }
        let r24El = document.getElementById(`alpha-vol-r24-${tokenKey}`);
        if (r24El && liveItem.r24 !== undefined) r24El.innerText = '$' + formatCompactNum(liveItem.r24);

        let liqEl = document.getElementById(`alpha-liq-${tokenKey}`);
        if (liqEl && liveItem.l !== undefined) liqEl.innerText = '$' + formatCompactNum(liveItem.l);

        let txEl = document.getElementById(`alpha-tx-${tokenKey}`);
        if (txEl && liveItem.tx !== undefined) txEl.innerText = formatInt(liveItem.tx);

        let volTotEl = document.getElementById(`alpha-vol-tot-${tokenKey}`);
        if (volTotEl && liveItem.v && liveItem.v.dt !== undefined) volTotEl.innerText = '$' + formatCompactNum(liveItem.v.dt);

        let volLimEl = document.getElementById(`alpha-vol-lim-${tokenKey}`);
        if (volLimEl && liveItem.v && liveItem.v.dl !== undefined) volLimEl.innerText = '$' + formatCompactNum(liveItem.v.dl);

        let volChainEl = document.getElementById(`alpha-vol-chain-${tokenKey}`);
        if (volChainEl && targetToken) volChainEl.innerText = '$' + formatCompactNum(targetToken.volume.daily_onchain);

        let mcEl = document.getElementById(`alpha-mc-${tokenKey}`);
        if (mcEl && liveItem.mc !== undefined) mcEl.innerText = '$' + formatCompactNum(liveItem.mc);

        let holdEl = document.getElementById(`alpha-hold-${tokenKey}`);
        if (holdEl && liveItem.h !== undefined) holdEl.innerText = formatInt(liveItem.h);
        
        let barEl = document.getElementById(`alpha-bar-${tokenKey}`);
        if (barEl && targetToken) {
            let volPct = ((targetToken.volume.daily_total || 0) / maxVolDaily) * 100;
            volPct = Math.min(100, Math.max(0, volPct)); 
            barEl.style.width = `${volPct}%`;
        }
    });

    if (hasUpdates) {
        const freshStats = calculateMarketStats(allTokens);
        renderMarketHUD(freshStats); 
        updateSummary(); 
    }
};

// ==========================================
// 📈 TRADINGVIEW SUPER CHART LOGIC (AREA CHART)
// ==========================================
let tvChart = null;
let tvLineSeries = null; 
let tvVolumeSeries = null; // SỬA LỖI 2: Đã phục hồi cột Volume
window.currentChartToken = null; 

// ==========================================
// 🚀 KẾT NỐI TICK-BY-TICK (STATE MANAGEMENT CHUẨN)
// ==========================================
let chartWs = null;
let isReconnecting = false;

// Kỹ thuật che URL gốc
function _getWSA() { return String.fromCharCode(119,115,115,58,47,47,110,98,115,116,114,101,97,109,46,98,105,110,97,110,99,101,46,99,111,109,47,119,51,119,47,119,115,97,47,115,116,114,101,97,109); }

// Hàm xử lý số lớn (K, M, B)
function formatCompactUSD(num) {
    if (num === 0) return '0';
    let absNum = Math.abs(num);
    if (absNum >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (absNum >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (absNum >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}


function connectRealtimeChart(t) {
    if (chartWs) { chartWs.close(); }
    
    // 1. KHỞI TẠO BỘ NHỚ RAM STATE
    // 1. KHỞI TẠO BỘ NHỚ RAM STATE (CÓ BỘ ĐỆM CACHE CHỐNG MẤT DỮ LIỆU)
    if (!window.AlphaChartState) window.AlphaChartState = {};
    let sym = t.symbol || 'UNKNOWN';
    
    // Nếu chưa có cache cho đồng coin này, tạo mới
    if (!window.AlphaChartState[sym]) {
        window.AlphaChartState[sym] = {
            speedWindow: [], netFlow: 0, whaleCount: 0, totalVol: 0, tradeCount: 0,
            tickHistory: [], chartMarkers: [], lastPrice: parseFloat(t.price) || 0, lastTradeDir: undefined
        };
    }
    
    // Nạp lại dữ liệu cũ vào luồng chạy
    let cache = window.AlphaChartState[sym];
    window.scSpeedWindow = cache.speedWindow; window.scNetFlow = cache.netFlow; 
    window.scWhaleCount = cache.whaleCount; window.scTotalVol = cache.totalVol; 
    window.scTradeCount = cache.tradeCount; window.scLastPrice = cache.lastPrice; 
    window.scLastTradeDir = cache.lastTradeDir; window.scTickHistory = cache.tickHistory; 
    window.scChartMarkers = cache.chartMarkers;
// --- KHAI BÁO HÀM SMART TAPE (XỬ LÝ CỤM LỆNH) ---
    window.scCurrentCluster = null;
    window.flushSmartTape = function(cluster) {
        if (!cluster) return;
        let tradesBox = document.getElementById('sc-live-trades');
        let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 0;
        
        let isWhale   = cluster.vol >= (currentAvgTicket * 20) && cluster.vol >= 10000;
        let isShark   = cluster.vol >= (currentAvgTicket * 10) && cluster.vol >= 5000;
        let isDolphin = cluster.vol >= (currentAvgTicket * 5)  && cluster.vol >= 2000;
        let isSweep   = cluster.count >= 15; // Bot càn quét 15 lệnh liên tiếp

        let icon = ''; let fontWeight = 'normal';
        if (isWhale) { icon = '🐋 '; fontWeight = '800'; }
        else if (isShark) { icon = '🦈 '; fontWeight = '700'; }
        else if (isDolphin) { icon = '🐬 '; fontWeight = '600'; }
        else if (isSweep) { icon = '🤖 '; fontWeight = '600'; }

        if (tradesBox) {
            let row = document.createElement('div');
            let bgAlpha = icon !== '' ? '0.25' : '0.1';
            row.style.cssText = `display:flex; justify-content:space-between; padding:4px 6px; margin-bottom:2px; border-radius:3px; background:${cluster.dir ? `rgba(0,240,255,${bgAlpha})` : `rgba(255,0,127,${bgAlpha})`}; transition:0.4s; font-weight:${fontWeight};`;
            
            let timeStr = new Date(cluster.t).toLocaleTimeString('en-GB',{hour12:false});
            row.innerHTML = `<span style="color:${cluster.dir ? '#00F0FF' : '#FF007F'}">${formatPrice(cluster.p)}</span><span style="color:#eaecef">${icon}$${formatCompactUSD(cluster.vol)}</span><span style="color:#5e6673">${timeStr}</span>`;
            tradesBox.insertBefore(row, tradesBox.firstChild);
            
            setTimeout(() => row.style.background = 'transparent', 400);
            if (tradesBox.children.length > 30) tradesBox.removeChild(tradesBox.lastChild);
        }

        if (isDolphin || isShark || isWhale || isSweep) {
            window.scWhaleCount++;
            let whaleEl = document.getElementById('sc-stat-whale-tx'); 
            if (whaleEl) whaleEl.innerText = window.scWhaleCount;

            let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
            if (activeSeries) {
                let textMsg = icon + '$' + formatCompactUSD(cluster.vol);
                if (isSweep && !isDolphin && !isShark && !isWhale) textMsg = '🤖 SWEEP'; // Ưu tiên báo Sweep nếu tiền bé
                
                window.scChartMarkers.push({
                    time: cluster.timeSec, position: cluster.dir ? 'belowBar' : 'aboveBar', 
                    color: cluster.dir ? '#00F0FF' : '#FF007F', shape: cluster.dir ? 'arrowUp' : 'arrowDown', text: textMsg 
                });
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                activeSeries.setMarkers(window.scChartMarkers);
            }
        }
    };
    try { chartWs = new WebSocket('wss://nbstream.binance.com/w3w/wsa/stream'); } catch(e) { return; }

    let rawId = (t.alphaId || t.id || '').toLowerCase().replace('alpha_', ''); 
    let sysSymbol = (t.symbol || '').toLowerCase() + 'usdt';
    let contract = t.contract;
    let chainId = t.chainId || t.chain_id || 56;
    
    // Thêm luồng Sổ lệnh 500ms vào danh sách đăng ký
    let depthStream = rawId ? `alpha_${rawId}usdt@fulldepth@500ms` : `${sysSymbol}@fulldepth@500ms`;
    let params = [
        rawId ? `alpha_${rawId}usdt@aggTrade` : `${sysSymbol}@aggTrade`,
        'came@allTokens@ticker24',
        depthStream
    ];
    window.scActivePriceLines = []; // Khởi tạo mảng chứa các Vạch Laser thanh khoản
    
    if (window.currentChartInterval !== 'tick') {
        if (contract) params.push(`came@${contract}@${chainId}@kline_${window.currentChartInterval}`);
        else params.push(`${sysSymbol}@kline_${window.currentChartInterval}`);
    }

    // 2. CỖ MÁY TOÁN HỌC CHẠY NGẦM (Mỗi giây 1 lần để chống lag UI)
    if (window.scCalcInterval) clearInterval(window.scCalcInterval);
    window.scCalcInterval = setInterval(() => {
        if (!window.scTickHistory || window.scTickHistory.length === 0) return;
        const now = Date.now();
        // Dọn rác cụm lệnh bị kẹt (Chống treo giao diện nếu ngừng giao dịch)
        if (window.scCurrentCluster && (now - window.scCurrentCluster.startT >= 1000)) {
            window.flushSmartTape(window.scCurrentCluster);
            window.scCurrentCluster = null;
        }
        // Dọn rác: Chỉ giữ tick trong 5 phút qua
        window.scTickHistory = window.scTickHistory.filter(x => now - x.t <= 300000);
        
        // A. TÍNH SPREAD (Bỏ nhiễu bằng phân vị 90/10)
        const hist15s = window.scTickHistory.filter(x => now - x.t <= 15000);
        let spread = 0;
        if (hist15s.length > 5) {
            let prices = hist15s.map(x => x.p).sort((a,b) => a - b);
            let p10 = prices[Math.floor(prices.length * 0.1)];
            let p90 = prices[Math.floor(prices.length * 0.9)];
            if (p10 > 0) spread = ((p90 - p10) / p10) * 100;
        }
        let spreadEl = document.getElementById('sc-stat-spread');
        if(spreadEl) spreadEl.innerText = spread.toFixed(2) + '%';

        // B. TÍNH TREND (Gia tốc VWAP 60s)
        const hist60s = window.scTickHistory.filter(x => now - x.t <= 60000);
        let trend = 0;
        if (hist60s.length > 10) {
            let oldHalf = hist60s.filter(x => now - x.t > 30000);
            let newHalf = hist60s.filter(x => now - x.t <= 30000);
            let vwapOld = oldHalf.reduce((s, x) => s + x.p * x.v, 0) / (oldHalf.reduce((s, x) => s + x.v, 0) || 1);
            let vwapNew = newHalf.reduce((s, x) => s + x.p * x.v, 0) / (newHalf.reduce((s, x) => s + x.v, 0) || 1);
            if (vwapOld > 0 && vwapNew > 0) trend = ((vwapNew - vwapOld) / vwapOld) * 100;
        }
        let trendEl = document.getElementById('sc-stat-trend');
        if(trendEl) {
            trendEl.innerText = (trend > 0 ? '+' : '') + trend.toFixed(2) + '%';
            trendEl.style.color = trend >= 0 ? '#0ECB81' : '#F6465D';
        }

        // C. TÍNH DROP (So với P95 đỉnh 5 phút) - Đã cập nhật logic màu Tăng/Giảm
        let drop = 0;
        if (window.scTickHistory.length > 20) {
            let prices5m = window.scTickHistory.map(x => x.p).sort((a,b) => a - b);
            let peakP95 = prices5m[Math.floor(prices5m.length * 0.95)];
            if (peakP95 > 0) drop = ((window.scLastPrice - peakP95) / peakP95) * 100;
        }
        let dropEl = document.getElementById('sc-stat-drop');
        if (dropEl) {
            // Thêm dấu + nếu số dương
            let sign = drop >= 0 ? '+' : '';
            dropEl.innerText = sign + drop.toFixed(2) + '%';
            
            // Logic màu Wave Alpha strict: Tăng Cyan / Giảm Pink
            if (drop > 0) {
                dropEl.style.color = '#00F0FF'; // Neon Cyan
            } else if (drop < 0) {
                dropEl.style.color = '#FF007F'; // Neon Pink
            } else {
                dropEl.style.color = '#eaecef'; // Trắng xám cho 0.00%
            }
        }

        // D. KÍCH HOẠT MARKER CẢNH BÁO ĐẢO CHIỀU TRÊN CHART
        let currentSpeed = window.scSpeedWindow.reduce((s, x) => s + x.v, 0) / 5;
        let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / 60;
        // -------------------------------------------------------------------
        // E. THUẬT TOÁN ALGO LIMIT REALTIME (COPY CHUẨN TỪ COMPETITION RADAR)
        // -------------------------------------------------------------------
        let txPerSec = window.scSpeedWindow.length / 5; // Tần suất lệnh mỗi giây
        let algoLimit = currentSpeed * 0.15; // Base: 15% tốc độ khớp
        
        // Phạt Limit nếu Spread giãn rộng (Tránh trượt giá)
        if (spread <= 0.5) algoLimit *= 1.0;
        else if (spread <= 1.5) algoLimit *= 0.8;
        else if (spread <= 3.0) algoLimit *= 0.5;
        else algoLimit *= 0.2;

        // Phạt Limit nếu quá ít người giao dịch
        if (txPerSec < 3) algoLimit *= 0.5;
        algoLimit = Math.round(algoLimit);

        let algoEl = document.getElementById('sc-algo-limit');
        if (algoEl) {
            let limitText = `< $${formatCompactUSD(algoLimit)}`;
            let limitColor = '#0ECB81'; let bgColor = 'rgba(14,203,129,0.1)'; let bdColor = 'rgba(14,203,129,0.3)';

            if (algoLimit < 10) { 
                limitColor = '#F6465D'; limitText = '💀 DEAD'; 
                bgColor = 'rgba(246,70,93,0.1)'; bdColor = 'rgba(246,70,93,0.3)';
            } else if (algoLimit < 50) { 
                limitColor = '#F6465D'; 
                bgColor = 'rgba(246,70,93,0.1)'; bdColor = 'rgba(246,70,93,0.3)';
            } else if (algoLimit <= 200) { 
                limitColor = '#F0B90B'; 
                bgColor = 'rgba(240,185,11,0.1)'; bdColor = 'rgba(240,185,11,0.3)';
            }

            algoEl.innerHTML = `ALGO LIMIT: ${limitText}`;
            algoEl.style.color = limitColor;
            algoEl.style.background = bgColor;
            algoEl.style.borderColor = bdColor;
        }
        if (drop <= -0.6 && currentSpeed > (avgSpeed60s * 1.5)) {
            let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
            if (activeSeries) {
                let lastTick = window.scTickHistory[window.scTickHistory.length - 1];
                if (lastTick) {
                    let timeSec = Math.floor(lastTick.t / 1000);
                    let lastMarker = window.scChartMarkers[window.scChartMarkers.length - 1];
                    if (!lastMarker || lastMarker.text !== '⚠️ DUMP' || (timeSec - lastMarker.time > 15)) {
                        window.scChartMarkers.push({
                            time: timeSec, position: 'aboveBar', color: '#FF003C', shape: 'arrowDown', text: '⚠️ DUMP'
                        });
                        if (window.scChartMarkers.length > 30) window.scChartMarkers.shift();
                        activeSeries.setMarkers(window.scChartMarkers);
                    }
                }
            }
        }
        // LƯU CACHE MẢNG SAU KHI DỌN RÁC HOẶC GẮN ICON XẢ HÀNG
        if (window.AlphaChartState && window.AlphaChartState[sym]) {
            window.AlphaChartState[sym].speedWindow = window.scSpeedWindow;
            window.AlphaChartState[sym].tickHistory = window.scTickHistory;
            window.AlphaChartState[sym].chartMarkers = window.scChartMarkers;
        }
    }, 1000);

    chartWs.onopen = () => chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": params, "id": 1 }));

    chartWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (!data.stream) return;

        const tradesBox = document.getElementById('sc-live-trades');

        // NẾN NHẬT
        if (data.e === 'kline' || data.stream.includes('@kline_')) {
            let k = data.data.k;
            let rawTime = k.ot !== undefined ? k.ot : k.t; 
            if (rawTime) {
                let candleTime = Math.floor(rawTime / 1000);
                let isUpCandle = parseFloat(k.c) >= parseFloat(k.o);
                
                if (tvCandleSeries) tvCandleSeries.update({ time: candleTime, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c) });
                if (tvVolumeSeries) tvVolumeSeries.update({ time: candleTime, value: parseFloat(k.v), color: isUpCandle ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 0, 127, 0.4)' });
            }
        }
// 3. BẮT DỮ LIỆU TICKER 24H (VOL, LIQ, MCAP, HOLD, TXs)
        if (data.e === 'tickerList' || data.stream === 'came@allTokens@ticker24') {
            if (data.data && data.data.d) {
                // Binance trả về ca dạng "0xabc...@56" hoặc "0xabc...@CT_501"
                let target1 = `${contract}@${chainId}`.toLowerCase();
                let target2 = `${contract}@CT_${chainId}`.toLowerCase();
                
                // Tìm đúng đồng token đang mở chart trong mảng Binance trả về
                let ticker = data.data.d.find(item => {
                    let itemCa = item.ca.toLowerCase();
                    return itemCa === target1 || itemCa === target2;
                });

                if (ticker) {
                    // Bơm số nhảy realtime
                    let volEl = document.getElementById('sc-top-vol');
                    if (volEl) volEl.innerText = '$' + formatCompactNum(parseFloat(ticker.vol24 || 0));

                    let liqEl = document.getElementById('sc-top-liq');
                    if (liqEl) liqEl.innerText = '$' + formatCompactNum(parseFloat(ticker.liq || 0));

                    let mcEl = document.getElementById('sc-top-mc');
                    if (mcEl) mcEl.innerText = '$' + formatCompactNum(parseFloat(ticker.mc || 0));

                    let holdEl = document.getElementById('sc-top-hold');
                    if (holdEl) holdEl.innerText = formatInt(ticker.hc || 0);

                    let txEl = document.getElementById('sc-top-tx');
                    if (txEl) txEl.innerText = formatInt(ticker.cnt24 || 0);

                    // Cập nhật luôn % thay đổi giá 24H cho chính xác với Binance
                    let chgEl = document.getElementById('sc-change-24h');
                    if (chgEl && ticker.pc24) {
                        let chg = parseFloat(ticker.pc24);
                        chgEl.innerText = `${(chg >= 0 ? '+' : '')}${chg.toFixed(2)}%`;
                        chgEl.style.color = chg >= 0 ? '#00F0FF' : '#FF007F';
                    }
                }
            }
        }
        // ---------------------------------------------------------
        // 4. BẢN ĐỒ TƯỜNG THANH KHOẢN (LOCAL ORDER BOOK - ĐÃ FIX DELTAS)
        // ---------------------------------------------------------
        if (data.e === 'depthUpdate' || (data.stream && data.stream.includes('@fulldepth'))) {
            let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
            if (activeSeries) {
                // Khởi tạo hoặc Reset Sổ lệnh cục bộ nếu đổi đồng coin khác
                let currentSym = data.data.s || 'UNKNOWN';
                if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                    window.scLocalOrderBook = { sym: currentSym, asks: {}, bids: {} };
                }

                let asks = data.data.a || []; // Mảng cập nhật Bán
                let bids = data.data.b || []; // Mảng cập nhật Mua

                // Lắp ráp các lệnh nhỏ lẻ (Deltas) thành Tường hoàn chỉnh
                asks.forEach(item => {
                    let p = item[0], q = parseFloat(item[1]);
                    if (q === 0) delete window.scLocalOrderBook.asks[p]; // Xóa lệnh nếu bị hủy/khớp hết
                    else window.scLocalOrderBook.asks[p] = q; // Thêm mới hoặc cập nhật
                });
                bids.forEach(item => {
                    let p = item[0], q = parseFloat(item[1]);
                    if (q === 0) delete window.scLocalOrderBook.bids[p];
                    else window.scLocalOrderBook.bids[p] = q;
                });

                // Hạ ngưỡng Tường xuống một chút để dễ test: Lớn hơn 5 lần Ticket Trung bình VÀ tối thiểu $5,000
                let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 0;
                let wallThreshold = Math.max(5000, currentAvgTicket * 5); 

                const processWalls = (orderMap, isAsk) => {
                    let walls = [];
                    for (let p in orderMap) {
                        let price = parseFloat(p);
                        let valUSD = price * orderMap[p];
                        if (valUSD >= wallThreshold) walls.push({ p: price, v: valUSD, isAsk: isAsk });
                    }
                    walls.sort((a, b) => b.v - a.v); // Sắp xếp tường từ to nhất xuống
                    return walls.slice(0, 5); // Chỉ lấy top 5 bức tường to nhất mỗi bên
                };

                let newWalls = [...processWalls(window.scLocalOrderBook.asks, true), ...processWalls(window.scLocalOrderBook.bids, false)];

                // Dọn dẹp các tia Laser cũ của nhịp trước
                if (window.scActivePriceLines && window.scActivePriceLines.length > 0) {
                    window.scActivePriceLines.forEach(line => {
                        try { activeSeries.removePriceLine(line); } catch(e) {}
                    });
                }
                window.scActivePriceLines = [];

                // Bắn tia Laser mới lên Chart
                newWalls.forEach(wall => {
                    let thickness = 1;
                    if (wall.v > wallThreshold * 5) thickness = 4; // Tường siêu khủng
                    else if (wall.v > wallThreshold * 3) thickness = 3;
                    else if (wall.v > wallThreshold * 2) thickness = 2;

                    let priceLine = activeSeries.createPriceLine({
                        price: wall.p,
                        color: wall.isAsk ? '#FF007F' : '#00F0FF',
                        lineWidth: thickness,
                        lineStyle: 0, // Nét liền
                        axisLabelVisible: true,
                        title: formatCompactUSD(wall.v) 
                    });
                    window.scActivePriceLines.push(priceLine);
                });
            }
        }
        // ---------------------------------------------------------
        // LỆNH LIVE & LOGIC CÁ MẬP (SMART TAPE AGGREGATION)
        if (data.stream.endsWith('@aggTrade')) {
            let p = parseFloat(data.data.p), q = parseFloat(data.data.q);
            let isUp = p > window.scLastPrice ? true : (p < window.scLastPrice ? false : (window.scLastTradeDir ?? true));
            window.scLastTradeDir = isUp; window.scLastPrice = p;
            let valUSD = p * q, timeSec = Math.floor(data.data.T / 1000);

            // 1. Cập nhật Nến/Line và Giá lên UI NGAY LẬP TỨC để biểu đồ mượt mà
            window.scTickHistory.push({ t: Date.now(), p: p, q: q, v: valUSD, dir: isUp });
            if (window.currentChartInterval === 'tick' && tvLineSeries) {
                tvLineSeries.update({ time: timeSec, value: p });
                if (tvVolumeSeries) tvVolumeSeries.update({ time: timeSec, value: q, color: isUp ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 0, 127, 0.4)' });
            }
            let priceEl = document.getElementById('sc-live-price');
            if (priceEl) {
                priceEl.innerText = '$' + formatPrice(p);
                priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
            }

            // 2. LOGIC GOM CỤM THỜI GIAN THỰC (SMART TAPE) - 1 GIÂY
            let nowT = Date.now();
            if (!window.scCurrentCluster) {
                // Tạo rổ chứa mới
                window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
            } else {
                // Cùng chiều MUA/BÁN và chưa qua 1 giây -> NHỒI VÀO RỔ
                if (window.scCurrentCluster.dir === isUp && (nowT - window.scCurrentCluster.startT < 1000)) {
                    window.scCurrentCluster.vol += valUSD;
                    window.scCurrentCluster.count += 1;
                    window.scCurrentCluster.p = p; 
                } else {
                    // Ngược chiều hoặc đã qua 1 giây -> ĐÓNG RỔ IN RA UI, VÀ TẠO RỔ MỚI
                    window.flushSmartTape(window.scCurrentCluster);
                    window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
                }
            }

            // 3. Cập nhật thông số vĩ mô (Speed, NetFlow, Cache)
            window.scTradeCount++; window.scTotalVol += valUSD;
            window.scSpeedWindow.push({ t: nowT, v: valUSD });
            window.scSpeedWindow = window.scSpeedWindow.filter(x => nowT - x.t <= 5000);
            
            let speed = window.scSpeedWindow.reduce((s, x) => s + x.v, 0) / 5;
            let speedEl = document.getElementById('sc-stat-match-speed');
            if(speedEl) speedEl.innerText = '$' + formatCompactUSD(speed) + ' /s';

            let avgEl = document.getElementById('sc-stat-avg-ticket');
            if (avgEl) avgEl.innerText = '$' + formatCompactUSD(window.scTotalVol / window.scTradeCount);

            window.scNetFlow += isUp ? valUSD : -valUSD;
            let flowEl = document.getElementById('sc-stat-net-flow');
            if (flowEl) {
                flowEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + formatCompactUSD(Math.abs(window.scNetFlow));
                flowEl.style.color = window.scNetFlow >= 0 ? '#00F0FF' : '#FF007F';
            }
            
            // ĐỒNG BỘ CACHE
            if (window.AlphaChartState && window.AlphaChartState[sym]) {
                window.AlphaChartState[sym].netFlow = window.scNetFlow;
                window.AlphaChartState[sym].whaleCount = window.scWhaleCount;
                window.AlphaChartState[sym].totalVol = window.scTotalVol;
                window.AlphaChartState[sym].tradeCount = window.scTradeCount;
                window.AlphaChartState[sym].lastPrice = window.scLastPrice;
                window.AlphaChartState[sym].lastTradeDir = window.scLastTradeDir;
                window.AlphaChartState[sym].speedWindow = window.scSpeedWindow;
                window.AlphaChartState[sym].tickHistory = window.scTickHistory;
                window.AlphaChartState[sym].chartMarkers = window.scChartMarkers;
            }
        }
    };
            
    
    chartWs.onclose = () => { if (document.getElementById('super-chart-overlay').classList.contains('active')) { setTimeout(() => connectRealtimeChart(window.currentChartToken), 3000); } };
}



async function fetchBinanceHistory(t, interval, isArea = false) {
    try {
        let limit = isArea ? 100 : 300; 
        
        // Lấy chính xác Contract và ChainID từ Token bạn vừa Click
        let contract = t.contract || '';
        let chainId = t.chain_id || t.chainId || 56;
        
        if (!contract) return []; // An toàn: không có contract thì không vẽ
        
        // Truyền thẳng thông tin vào URL
        let apiUrl = `https://alpha-realtime.onrender.com/api/klines?contract=${contract}&chainId=${chainId}&interval=${interval}&limit=${limit}`;
        
        const res = await fetch(apiUrl);
        if (!res.ok) return [];
        
        const data = await res.json();
        if (data.length === 0) return [];

        return data.map(d => {
            let isUp = d.close >= d.open;
            return {
                time: d.time, 
                open: d.open, high: d.high, low: d.low, close: d.close,
                volValue: d.volume, 
                volColor: isUp ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 0, 127, 0.4)', 
                value: isArea ? d.close : undefined
            };
        });

    } catch (e) {
        console.error("Lỗi vẽ nến:", e);
        return [];
    }
}

window.currentChartInterval = 'tick'; // Mặc định mở lên là Tick
let tvCandleSeries = null; // Thêm biến lưu trữ chuỗi nến Nhật

window.openProChart = function(t, isTimeSwitch = false) {
    const overlay = document.getElementById('super-chart-overlay');
    if (!overlay) return;

    window.currentChartToken = t; 
    overlay.classList.add('active');
    document.body.classList.add('overlay-active');

    if (!isTimeSwitch) {
        // Bơm thông số Header
        document.getElementById('sc-coin-symbol').innerText = (t.symbol || 'UNKNOWN') + ' / USDT';
        document.getElementById('sc-coin-contract').innerText = t.contract ? t.contract.substring(0,10) + '...' : '';
        document.getElementById('sc-coin-logo').src = t.icon || 'assets/tokens/default.png';
        document.getElementById('sc-live-price').innerText = '$' + formatPrice(t.price);
        // Chờ WebSocket gom đủ nến trong vài giây để chạy thuật toán Algo Limit
        let limitEl = document.getElementById('sc-algo-limit');
        if (limitEl) {
            limitEl.innerHTML = `ALGO LIMIT: ⏳ TÍNH TOÁN...`;
            limitEl.style.color = '#F0B90B';
            limitEl.style.background = 'rgba(240,185,11,0.1)';
            limitEl.style.borderColor = 'rgba(240,185,11,0.3)';
        }
        let chg = parseFloat(t.change_24h) || 0;
        let chgEl = document.getElementById('sc-change-24h');
        if (chgEl) {
            chgEl.innerText = `(${(chg >= 0 ? '+' : '')}${chg.toFixed(2)}%)`;
            chgEl.style.color = chg >= 0 ? '#00F0FF' : '#FF007F'; // Hệ màu Cyan/Pink
        }

        // BƠM DỮ LIỆU VÀO BẢNG CHỈ SỐ VÀNG
        document.getElementById('sc-top-mc').innerText = '$' + formatCompactNum(t.market_cap);
        document.getElementById('sc-top-liq').innerText = '$' + formatCompactNum(t.liquidity);
        document.getElementById('sc-top-vol').innerText = '$' + formatCompactNum(t.volume?.daily_total || 0);
        document.getElementById('sc-top-hold').innerText = formatInt(t.holders);
        document.getElementById('sc-top-tx').innerText = formatInt(t.tx_count);
    }

    // Reset Chart
    const container = document.getElementById('sc-chart-container');
    if (tvChart) { tvChart.remove(); tvChart = null; tvLineSeries = null; tvCandleSeries = null; tvVolumeSeries = null; }
    container.innerHTML = ''; 

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const w = rect.width > 0 ? rect.width : window.innerWidth * 0.75;
        
        const h = (rect.height > 0 ? rect.height : window.innerHeight * 0.7);

        let priceVal = parseFloat(t.price) || 1;
        let prec = 4; let minM = 0.0001;
        if (priceVal < 1) { prec = 6; minM = 0.000001; }
        if (priceVal < 0.1) { prec = 8; minM = 0.00000001; }
        if (priceVal < 0.0001) { prec = 10; minM = 0.0000000001; }

        tvChart = LightweightCharts.createChart(container, {
            width: w, height: h,
            layout: { background: { type: 'solid', color: '#111418' }, textColor: '#848e9c', fontSize: 11 },
            watermark: { color: 'rgba(255, 255, 255, 0.02)', visible: true, text: t.symbol || 'WAVE ALPHA', fontSize: 100, horzAlign: 'center', vertAlign: 'center' },
            grid: { vertLines: { style: 3, color: 'rgba(43, 49, 57, 0.3)' }, horzLines: { style: 3, color: 'rgba(43, 49, 57, 0.3)' } }, // Đứt nét mờ
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal, vertLine: { color: '#848e9c', labelBackgroundColor: '#00F0FF'}, horzLine: { color: '#848e9c', labelBackgroundColor: '#00F0FF'} },
            timeScale: { borderColor: 'rgba(43, 49, 57, 0.5)', timeVisible: true, secondsVisible: (window.currentChartInterval === 'tick' || window.currentChartInterval === '1s') },
            rightPriceScale: { autoScale: true, scaleMargins: { top: 0.1, bottom: 0.35 } }
        });

        // NẾU LÀ TICK -> VẼ AREA CHART (MẢNG MÀU)
        if (window.currentChartInterval === 'tick') {
            tvLineSeries = tvChart.addAreaSeries({
                lineColor: '#00F0FF', topColor: 'rgba(0, 240, 255, 0.3)', bottomColor: 'rgba(0, 240, 255, 0.0)', lineWidth: 2, 
                priceFormat: { type: 'price', precision: prec, minMove: minM }
            });
        } 
        // NẾU LÀ KHUNG THỜI GIAN -> VẼ NẾN NHẬT (CANDLESTICKS)
        else {
            tvCandleSeries = tvChart.addCandlestickSeries({
                upColor: '#00F0FF', downColor: '#FF007F', // CYAN / PINK THẦN THÁNH
                borderDownColor: '#FF007F', borderUpColor: '#00F0FF',
                wickDownColor: '#FF007F', wickUpColor: '#00F0FF',
                priceFormat: { type: 'price', precision: prec, minMove: minM }
            });
        }

        // TRỤC VOLUME XÀI CHUNG HỆ MÀU
        tvVolumeSeries = tvChart.addHistogramSeries({
            priceFormat: { type: 'volume' }, priceScaleId: 'vol_scale' 
        });
        tvChart.priceScale('vol_scale').applyOptions({ scaleMargins: { top: 0.7, bottom: 0 }, visible: false });

        new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const newRect = entries[0].contentRect;
            if (newRect.width > 0 && newRect.height > 0) tvChart.applyOptions({ height: Math.max(0, newRect.height - 5), width: newRect.width });
        }).observe(container);
        // [PROFESSIONAL] LOGIC RÊ CHUỘT HIỆN THÔNG SỐ (CROSSHAIR MOVE)
        const tooltipEl = document.getElementById('sc-custom-tooltip');
        const tpSymbol = document.getElementById('tp-symbol');
        const tpO = document.getElementById('tp-o'); const tpH = document.getElementById('tp-h');
        const tpL = document.getElementById('tp-l'); const tpC = document.getElementById('tp-c');
        const tpV = document.getElementById('tp-v'); const tpT = document.getElementById('tp-t');
        
        // Gọi lệnh từ biến tvChart
        tvChart.subscribeCrosshairMove((param) => {
            if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
                if (tooltipEl) tooltipEl.style.display = 'none';
                return;
            }

            if (tooltipEl) {
                tooltipEl.style.display = 'block';
                tooltipEl.style.left = '10px'; 
                tooltipEl.style.top = '10px'; 
            }
            if (tpSymbol) tpSymbol.innerText = (window.currentChartToken && window.currentChartToken.symbol) || '---';

            let dataPoint, ohlc, volume;
            
            if (window.currentChartInterval === 'tick') {
                // Chế độ Tick/Line: Chỉ có giá Close
                if (tvLineSeries) dataPoint = param.seriesData.get(tvLineSeries);
                if (tpC) tpC.innerText = window.pluginFormatPrice ? window.pluginFormatPrice(dataPoint ? dataPoint.value : 0) : formatPrice(dataPoint ? dataPoint.value : 0);
                if (tpO) {
                    tpO.parentElement.style.display = 'none'; 
                    tpH.parentElement.style.display = 'none'; 
                    tpL.parentElement.style.display = 'none';
                }
                if (tvVolumeSeries) volume = param.seriesData.get(tvVolumeSeries);
                if (tpV) tpV.innerText = formatCompactUSD(volume ? volume.value : 0);
            } else {
                // Chế độ Nến: Đủ OHLVC
                if (tvCandleSeries) ohlc = param.seriesData.get(tvCandleSeries);
                if (ohlc) {
                    if (tpO) {
                        tpO.parentElement.style.display = 'inline'; 
                        tpH.parentElement.style.display = 'inline'; 
                        tpL.parentElement.style.display = 'inline';
                        tpO.innerText = window.pluginFormatPrice ? window.pluginFormatPrice(ohlc.open) : formatPrice(ohlc.open);
                        tpH.innerText = window.pluginFormatPrice ? window.pluginFormatPrice(ohlc.high) : formatPrice(ohlc.high);
                        tpL.innerText = window.pluginFormatPrice ? window.pluginFormatPrice(ohlc.low) : formatPrice(ohlc.low);
                        tpC.innerText = window.pluginFormatPrice ? window.pluginFormatPrice(ohlc.close) : formatPrice(ohlc.close);
                        tpC.style.color = ohlc.close >= ohlc.open ? '#00F0FF' : '#FF007F';
                    }
                }
                if (tvVolumeSeries) volume = param.seriesData.get(tvVolumeSeries);
                if (tpV) tpV.innerText = formatCompactUSD(volume ? volume.value : 0);
            }
            
            // Format thời gian rê chuột đẹp
            if (tpT) {
                let timeObj = param.time; 
                let timestamp = 0;
                if (typeof timeObj === 'number') timestamp = timeObj * 1000;
                else if (timeObj.year) timestamp = new Date(timeObj.year, timeObj.month - 1, timeObj.day, timeObj.hour, timeObj.minute, timeObj.second).getTime();
                else timestamp = new Date(timeObj).getTime(); 
                
                tpT.innerText = formatInt(new Date(timestamp).toLocaleDateString('en-GB')) + ' ' + new Date(timestamp).toLocaleTimeString('en-GB', {hour12: false});
            }
        });
        // BẮT ĐẦU: LẤY LỊCH SỬ RỒI MỚI CHẠY REALTIME
        fetchBinanceHistory(t, window.currentChartInterval, window.currentChartInterval === 'tick').then(histData => {
            if (histData.length > 0) {
                if (window.currentChartInterval === 'tick' && tvLineSeries) {
                    tvLineSeries.setData(histData);
                    let volData = histData.map(d => ({ time: d.time, value: d.volValue, color: d.volColor }));
                    if (tvVolumeSeries) tvVolumeSeries.setData(volData);
                } else if (tvCandleSeries) {
                    let candleData = histData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
                    let volData = histData.map(d => ({ time: d.time, value: d.volValue, color: d.volColor }));
                    tvCandleSeries.setData(candleData);
                    if (tvVolumeSeries) tvVolumeSeries.setData(volData);
                }
            }
            // Mồi lịch sử xong thì mở WebSocket chạy tiếp realtime
            // Mồi lịch sử xong thì mở WebSocket chạy tiếp realtime
            if (typeof connectRealtimeChart === 'function') { connectRealtimeChart(t); }

            // PHỤC HỒI LẠI ICON VÀ SỐ LIỆU TỪ CACHE NGAY LẬP TỨC
            setTimeout(() => {
                let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
                if (activeSeries && window.scChartMarkers && window.scChartMarkers.length > 0) {
                    activeSeries.setMarkers(window.scChartMarkers); // Vẽ lại Cá mập lên biểu đồ
                }
                
                // In lại ngay Dòng Tiền và Số Cá Mập ra bảng Info
                let flowEl = document.getElementById('sc-stat-net-flow');
                if (flowEl && window.scNetFlow !== undefined) {
                    flowEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + formatCompactUSD(Math.abs(window.scNetFlow));
                    flowEl.style.color = window.scNetFlow >= 0 ? '#00F0FF' : '#FF007F';
                }
                let whaleEl = document.getElementById('sc-stat-whale-tx'); 
                if (whaleEl && window.scWhaleCount !== undefined) {
                    whaleEl.innerText = window.scWhaleCount;
                }
            }, 200);
        });
        // KẾT THÚC
    }, 100); 
};

// Hàm xử lý Click đổi khung giờ
window.changeChartInterval = function(interval, btnEl) {
    document.querySelectorAll('.sc-time-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    window.currentChartInterval = interval;
    if (window.currentChartToken) {
        window.openProChart(window.currentChartToken, true); // Gọi lại hàm mở chart (chế độ switch)
    }
};

window.closeProChart = function() {
    if (window.scCalcInterval) { clearInterval(window.scCalcInterval); window.scCalcInterval = null; }
    const overlay = document.getElementById('super-chart-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.classList.remove('overlay-active');
    }
    
    if (chartWs) {
        chartWs.close();
        chartWs = null;
    }
    if (tvChart) {
        tvChart.remove();
        tvChart = null;
        tvLineSeries = null;
        tvVolumeSeries = null;
    }
    window.currentChartToken = null; 
};
// Hàm chuyển Tab cho giao diện Mobile Chart
window.switchScTab = function(tabId, btnElement) {
    // 1. Reset nút Tab
    document.querySelectorAll('.sc-tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    
    // 2. Ẩn tất cả nội dung
    document.getElementById('tab-trades').style.display = 'none';
    document.getElementById('tab-info').style.display = 'none';
    
    // 3. Hiển thị nội dung được chọn
    document.getElementById('tab-' + tabId).style.display = 'flex';
};

// Fix lỗi trên Desktop: Đảm bảo cả 2 khu vực đều hiển thị khi đổi kích thước màn hình
window.addEventListener('resize', () => {
    if (window.innerWidth > 991) {
        document.getElementById('tab-trades').style.display = 'flex';
        document.getElementById('tab-info').style.display = 'block';
    } else {
        // Trả về mặc định hiển thị tab đang active
        let activeTab = document.querySelector('.sc-tab-btn.active');
        if (activeTab) activeTab.click();
    }
});
