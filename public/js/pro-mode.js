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

            /* HỆ THỐNG MÀU THEME ĐỘNG */
            .theme-cyber .price-up { color: #2af592 !important; transition: color 0.3s; }
            .theme-cyber .price-down { color: #cb55e3 !important; transition: color 0.3s; }
            .theme-trad .price-up { color: #0ECB81 !important; transition: color 0.3s; }
            .theme-trad .price-down { color: #F6465D !important; transition: color 0.3s; }

            /* DATA FLOW WIDGETS (COCKPIT STYLE) */
            .df-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
            .df-box { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 8px; display: flex; flex-direction: column; justify-content: center; }
            .df-label { font-size: 9px; color: #527c82; text-transform: uppercase; margin-bottom: 4px; font-weight: 700; white-space: nowrap; letter-spacing: 0.5px;}
            .df-val { font-size: 14px; font-family: var(--font-num); font-weight: 700; color: #eaecef; }
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
            
            /* TABS LUÔN HIỆN TRÊN CẢ PC VÀ MOBILE */
            .sc-mobile-tabs { display: flex; background: #12151A; border-bottom: 1px solid #1e2329; flex-shrink: 0; }
            .sc-tab-btn { flex: 1; background: transparent; border: none; color: #5e6673; padding: 10px 0; font-size: 11px; font-weight: 700; cursor: pointer; border-bottom: 2px solid transparent; text-transform: uppercase; transition: 0.2s;}
            .sc-tab-btn.active { color: #00F0FF; border-bottom-color: #00F0FF; background: rgba(0, 240, 255, 0.05); }
            
            .sc-tab-content { display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 10px 15px; background: #12151A;}
            .sc-tab-content.active { display: flex !important; }
            
            #sc-live-trades::-webkit-scrollbar { width: 4px; }
            #sc-live-trades::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

            /* MOBILE RESPONSIVE */
            @media (max-width: 991px) {
                .sc-body { flex-direction: column !important; overflow-y: hidden !important; }
                .sc-topbar { padding: 8px 10px; }
                .sc-chart-area { flex: none !important; height: 42vh !important; border-bottom: 1px solid #1e2329; }
                .sc-stats-row { padding: 6px 10px; gap: 8px; }
                .sc-price-box { flex-direction: column; align-items: flex-start; gap: 0px; margin-right: 5px; justify-content: center;}
                .sc-price-box #sc-live-price { font-size: 22px !important; }
                .sc-price-box #sc-change-24h { font-size: 11px !important; }
                .sc-metrics-compact { width: 100%; justify-content: space-between; gap: 2px; overflow: hidden; padding-bottom: 0;}
                .sc-mc-item span { font-size: 8px; margin-bottom: 0; }
                .sc-mc-item strong { font-size: 10.5px; }
                .sc-side-panel { width: 100% !important; flex: 1 !important; border-left: none; background: #0B0E11; }
                .sc-tab-content { padding: 5px 0; }
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
                    

<div class="sc-toolbar" style="display:flex; gap:4px; padding:6px 15px; background:#1e2329; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; flex-wrap:wrap;">
                        <div style="display:flex; gap:4px; align-items:center;">
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
                        
                        <div style="margin-left: auto; display:flex; align-items:center; gap:12px; font-family:var(--font-num);">
                            
                            <div style="display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.25); padding:4px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
                                
                                <div onclick="window.toggleHeatmapUI()" style="cursor:pointer; display:flex; align-items:center; gap:5px; color:#41e6e7; font-size:10px; font-weight:700; font-family:var(--font-main);">
                                    <i id="sc-heatmap-icon" class="fas fa-eye"></i> <span style="padding-top:1px;">HEATMAP</span>
                                </div>
                                
                                <span style="color:#2b3139;">|</span>
                                
                                <div style="display:flex; align-items:center; gap:4px; color:#527c82; font-size:10px; font-weight:700; font-family:var(--font-main);">
                                    <i class="fas fa-filter"></i>
                                    <select id="sc-fish-filter" onchange="window.applyFishFilter()" style="background:transparent; color:#527c82; border:none; font-size:10px; font-weight:700; outline:none; cursor:pointer; padding:0;">
                                        <option value="sweep">TẤT CẢ BOT</option>
                                        <option value="dolphin">TỪ CÁ HEO</option>
                                        <option value="shark">TỪ CÁ MẬP</option>
                                        <option value="whale">CHỈ CÁ VOI</option>
                                    </select>
                                </div>
                            </div>

                            <div style="display:flex; gap:10px; font-size:11px; font-weight:700; background:rgba(0,0,0,0.25); padding:4px 10px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
                                <span title="Cá Voi" style="color:#cb55e3; display:flex; gap:4px; align-items:center;">🐋 <span id="sc-stat-whale">0</span></span>
                                <span title="Cá Mập" style="color:#eaecef; display:flex; gap:4px; align-items:center;">🦈 <span id="sc-stat-shark">0</span></span>
                                <span title="Cá Heo" style="color:#eaecef; display:flex; gap:4px; align-items:center;">🐬 <span id="sc-stat-dolphin">0</span></span>
                                <span title="Sweep" style="color:#2af592; display:flex; gap:4px; align-items:center;">🤖 <span id="sc-stat-sweep">0</span></span>
                            </div>

                            <div style="display:flex; align-items:center; gap:4px; color:#848e9c; font-size:10px; font-weight:700; font-family:var(--font-main);">
                                <i class="fas fa-palette"></i>
                                <select id="sc-theme-select" onchange="window.changeTheme()" style="background:transparent; color:#848e9c; border:none; font-size:10px; font-weight:700; outline:none; cursor:pointer; padding:0;">
                                    <option value="cyber">WAVE ALPHA</option>
                                    <option value="trad">TRUYỀN THỐNG</option>
                                </select>
                            </div>
                            
                        </div>
                    </div>
                    
                    <div id="sc-chart-container" style="flex:1; position: relative; overflow: hidden;">
                        <div style="position: absolute; bottom: 25px; left: 15px; z-index: 2; font-family: var(--font-main); font-weight: 800; font-size: 20px; color: rgba(255,255,255,0.06); pointer-events: none; letter-spacing: 2px;">WAVE ALPHA</div>
                        
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

                    <div id="tab-trades" class="sc-tab-content active" style="padding: 0;">
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

                    <div id="tab-info" class="sc-tab-content">
                        <div class="sc-panel-title" style="margin-bottom: 0; color:#eaecef;"><i class="fas fa-wave-square" style="color:#41e6e7; margin-right: 5px;"></i> DATA FLOW (REALTIME)</div>
                        
                        <div class="df-grid">
                            <div class="df-box">
                                <div class="df-label">Dòng tiền Net</div>
                                <div class="df-val" id="sc-stat-net-flow" style="color:#41e6e7;">+$0</div>
                            </div>
                            <div class="df-box">
                                <div class="df-label">Tốc độ / Giây</div>
                                <div class="df-val" id="sc-stat-match-speed">$0 /s</div>
                            </div>
                            <div class="df-box">
                                <div class="df-label">Ticket TB / Lệnh</div>
                                <div class="df-val" id="sc-stat-avg-ticket">$0</div>
                            </div>
                            <div class="df-box">
                                <div class="df-label">Spread (15s)</div>
                                <div class="df-val" id="sc-stat-spread">0.00%</div>
                            </div>
                            <div class="df-box">
                                <div class="df-label">Trend (VWAP 60s)</div>
                                <div class="df-val" id="sc-stat-trend">0.00%</div>
                            </div>
                            <div class="df-box">
                                <div class="df-label">Drop (5 Phút)</div>
                                <div class="df-val" id="sc-stat-drop">0.00%</div>
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
    
    // 1. KHỞI TẠO BỘ NHỚ RAM STATE (CÓ BỘ ĐỆM CACHE CHỐNG MẤT DỮ LIỆU)
    if (!window.AlphaChartState) window.AlphaChartState = {};
    let sym = t.symbol || 'UNKNOWN';
    
    // Nếu chưa có cache cho đồng coin này, tạo mới
    if (!window.AlphaChartState[sym]) {
        window.AlphaChartState[sym] = {
            speedWindow: [], netFlow: 0, whaleCount: 0, totalVol: 0, tradeCount: 0,
            tickHistory: [], chartMarkers: [], lastPrice: parseFloat(t.price) || 0, lastTradeDir: undefined,
            cWhale: 0, cShark: 0, cDolphin: 0, cSweep: 0 // [FIX] Cấp đất cho 4 con cá xây nhà
        };
    }
    
    // Nạp lại dữ liệu cũ vào luồng chạy
    let cache = window.AlphaChartState[sym];
    window.scSpeedWindow = cache.speedWindow; window.scNetFlow = cache.netFlow; 
    window.scWhaleCount = cache.whaleCount; window.scTotalVol = cache.totalVol; 
    window.scTradeCount = cache.tradeCount; window.scLastPrice = cache.lastPrice; 
    window.scLastTradeDir = cache.lastTradeDir; window.scTickHistory = cache.tickHistory; 
    window.scChartMarkers = cache.chartMarkers;

    // [FIX] Bốc 4 con cá từ Cache ra lại biến tạm
    window.scCWhale = cache.cWhale || 0;
    window.scCShark = cache.cShark || 0;
    window.scCDolphin = cache.cDolphin || 0;
    window.scCSweep = cache.cSweep || 0;

    // --- KHAI BÁO HÀM SMART TAPE (XỬ LÝ CỤM LỆNH) ---
    window.scCurrentCluster = null;

    // --- HÀM 1: LỌC CÁ HỒI TỐ (QUÉT LẠI LỊCH SỬ) ---
    window.applyFishFilter = function() {
        let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
        if (!activeSeries) return;

        // Nếu khung giờ lớn hơn 1s -> Xóa sạch
        if (window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s') {
            activeSeries.setMarkers([]); return;
        }

        let filterEl = document.getElementById('sc-fish-filter');
        let fVal = filterEl ? filterEl.value : 'sweep';

        // Lọc mảng lịch sử 50 markers
        let filteredMarkers = window.scChartMarkers.filter(m => {
            if (!m.fishType) return true; 

            if (fVal === 'whale' && m.fishType === 'whale') return true;
            if (fVal === 'shark' && (m.fishType === 'whale' || m.fishType === 'shark')) return true;
            if (fVal === 'dolphin' && (m.fishType === 'whale' || m.fishType === 'shark' || m.fishType === 'dolphin')) return true;
            if (fVal === 'sweep') return true;
            return false;
        });

        // [ĐÃ FIX]: Bắt buộc phải sắp xếp thời gian tăng dần để thư viện chịu vẽ (Chống lỗi mất cá trên khung Tick)
        filteredMarkers.sort((a, b) => a.time - b.time);

        try {
            activeSeries.setMarkers(filteredMarkers); 
        } catch (e) {}
    };

   // --- HÀM 2: CÔNG TẮC HEATMAP (DÙNG ICON MẮT) ---
    window.isHeatmapOn = true;
    window.toggleHeatmapUI = function() {
        window.isHeatmapOn = !window.isHeatmapOn;
        let icon = document.getElementById('sc-heatmap-icon');
        if (icon) {
            icon.className = window.isHeatmapOn ? 'fas fa-eye' : 'fas fa-eye-slash';
            icon.style.color = window.isHeatmapOn ? '#41e6e7' : '#527c82';
        }
        // [ĐÃ FIX TRÀN RAM]: Đổi sang tàng hình thay vì xóa line liên tục
        if (!window.isHeatmapOn && window.scActivePriceLines) {
            window.scActivePriceLines.forEach(line => {
                try { line.applyOptions({ color: 'transparent' }); } catch(e) {}
            });
        }
    };

    window.flushSmartTape = function(cluster) {
        if (!cluster) return;
        let tradesBox = document.getElementById('sc-live-trades');
        let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 0;
        
        let isWhale   = cluster.vol >= (currentAvgTicket * 20) && cluster.vol >= 10000;
        let isShark   = cluster.vol >= (currentAvgTicket * 10) && cluster.vol >= 5000;
        let isDolphin = cluster.vol >= (currentAvgTicket * 5)  && cluster.vol >= 2000;
        let isSweep   = cluster.count >= 6; 

        let icon = ''; let fontWeight = 'normal';
        if (isWhale) { icon = '🐋 '; fontWeight = '800'; }
        else if (isShark) { icon = '🦈 '; fontWeight = '700'; }
        else if (isDolphin) { icon = '🐬 '; fontWeight = '600'; }
        else if (isSweep) { icon = '🤖 '; fontWeight = '600'; }

        if (tradesBox) {
            let row = document.createElement('div');
            let bgAlpha = icon !== '' ? '0.25' : '0.1';
            let isTrad = window.currentTheme === 'trad';
            let c_up = isTrad ? '#0ECB81' : '#2af592';
            let c_down = isTrad ? '#F6465D' : '#cb55e3';
            let c_bg_up = isTrad ? `rgba(14,203,129,${bgAlpha})` : `rgba(42,245,146,${bgAlpha})`;
            let c_bg_down = isTrad ? `rgba(246,70,93,${bgAlpha})` : `rgba(203,85,227,${bgAlpha})`;

            row.style.cssText = `display:flex; justify-content:space-between; padding:4px 6px; margin-bottom:2px; border-radius:3px; background:${cluster.dir ? c_bg_up : c_bg_down}; transition:0.4s; font-weight:${fontWeight};`;
            
            let timeStr = new Date(cluster.t).toLocaleTimeString('en-GB',{hour12:false});
            row.innerHTML = `<span style="color:${cluster.dir ? c_up : c_down}">${formatPrice(cluster.p)}</span><span style="color:#eaecef">${icon}$${formatCompactUSD(cluster.vol)}</span><span style="color:${isTrad?'#848e9c':'#527c82'}">${timeStr}</span>`;
            tradesBox.insertBefore(row, tradesBox.firstChild);
            
            setTimeout(() => row.style.background = 'transparent', 400);
            if (tradesBox.children.length > 30) tradesBox.removeChild(tradesBox.lastChild);
        }

        if (isDolphin || isShark || isWhale || isSweep) {
            // Tách riêng từng bộ đếm
            if (isWhale) { window.scCWhale = (window.scCWhale||0) + 1; let el = document.getElementById('sc-stat-whale'); if(el) el.innerText = window.scCWhale; }
            else if (isShark) { window.scCShark = (window.scCShark||0) + 1; let el = document.getElementById('sc-stat-shark'); if(el) el.innerText = window.scCShark; }
            else if (isDolphin) { window.scCDolphin = (window.scCDolphin||0) + 1; let el = document.getElementById('sc-stat-dolphin'); if(el) el.innerText = window.scCDolphin; }
            else if (isSweep) { window.scCSweep = (window.scCSweep||0) + 1; let el = document.getElementById('sc-stat-sweep'); if(el) el.innerText = window.scCSweep; }

            // LUÔN LƯU VÀO BỘ NHỚ BẤT CHẤP KHUNG GIỜ VÀ BỘ LỌC
            let fishType = 'sweep';
            if (isWhale) fishType = 'whale'; else if (isShark) fishType = 'shark'; else if (isDolphin) fishType = 'dolphin';
            
            let textMsg = icon + '$' + formatCompactUSD(cluster.vol);
            if (isSweep && !isDolphin && !isShark && !isWhale) textMsg = '🤖 SWEEP';
            let markerColor = cluster.dir ? (window.currentTheme === 'trad' ? '#0ECB81' : '#2af592') : (window.currentTheme === 'trad' ? '#F6465D' : '#cb55e3');

            window.scChartMarkers.push({
                time: cluster.timeSec, position: cluster.dir ? 'belowBar' : 'aboveBar', 
                color: markerColor, shape: cluster.dir ? 'arrowUp' : 'arrowDown', text: textMsg,
                fishType: fishType // [QUAN TRỌNG] Đóng mác loại cá để xài bộ lọc
            });
            
            if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
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

        // C. TÍNH DROP (So với P95 đỉnh 5 phút)
        let drop = 0;
        if (window.scTickHistory.length > 20) {
            let prices5m = window.scTickHistory.map(x => x.p).sort((a,b) => a - b);
            let peakP95 = prices5m[Math.floor(prices5m.length * 0.95)];
            if (peakP95 > 0) drop = ((window.scLastPrice - peakP95) / peakP95) * 100;
        }
        let dropEl = document.getElementById('sc-stat-drop');
        if (dropEl) {
            let sign = drop >= 0 ? '+' : '';
            dropEl.innerText = sign + drop.toFixed(2) + '%';
            if (drop > 0) { dropEl.style.color = '#00F0FF'; } 
            else if (drop < 0) { dropEl.style.color = '#FF007F'; } 
            else { dropEl.style.color = '#eaecef'; }
        }

        // D. KÍCH HOẠT MARKER CẢNH BÁO ĐẢO CHIỀU TRÊN CHART
        let currentSpeed = window.scSpeedWindow.reduce((s, x) => s + x.v, 0) / 5;
        let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / 60;

        // E. THUẬT TOÁN ALGO LIMIT REALTIME
        let txPerSec = window.scSpeedWindow.length / 5; 
        let algoLimit = currentSpeed * 0.15; 
        
        if (spread <= 0.5) algoLimit *= 1.0;
        else if (spread <= 1.5) algoLimit *= 0.8;
        else if (spread <= 3.0) algoLimit *= 0.5;
        else algoLimit *= 0.2;

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

        // F. THUẬT TOÁN PHÂN TÍCH VỊ THẾ BẮT ĐÁY (3 KỊCH BẢN SAU DUMP)
        if (drop <= -0.6 && currentSpeed > (avgSpeed60s * 1.5)) {
            let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
            if (activeSeries) {
                let lastTick = window.scTickHistory[window.scTickHistory.length - 1];
                if (lastTick) {
                    let timeSec = Math.floor(lastTick.t / 1000);
                    let lastMarker = window.scChartMarkers[window.scChartMarkers.length - 1];
                    
                    if (!lastMarker || !lastMarker.text.includes('DUMP') || (timeSec - lastMarker.time > 15)) {
                        let markerText = '⚠️ DUMP';
                        let markerColor = '#F0B90B'; 
                        
                        let hitWall = false;
                        if (window.scLocalOrderBook && window.scLocalOrderBook.bids) {
                            let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
                            let wallThreshold = Math.max(500, currentAvgTicket * 5); 
                            
                            for (let p in window.scLocalOrderBook.bids) {
                                let price = parseFloat(p);
                                let valUSD = price * window.scLocalOrderBook.bids[p];
                                if (valUSD >= wallThreshold) {
                                    let diff = Math.abs(window.scLastPrice - price) / price;
                                    if (diff <= 0.002) { hitWall = true; break; } 
                                }
                            }
                        }

                        let recentTicks = window.scTickHistory.filter(x => Date.now() - x.t <= 5000);
                        let recentBuyVol = recentTicks.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
                        let recentSellVol = recentTicks.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
                        let avgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;

                        if (hitWall) {
                            markerText = '🛡️ WALL HIT';
                            markerColor = '#F0B90B'; 
                        } else if (recentBuyVol > recentSellVol * 2 && recentBuyVol > avgTicket * 10) {
                            markerText = '🪝 STOP-HUNT';
                            markerColor = '#00F0FF'; 
                        } else {
                            markerText = '🪫 EXHAUSTED';
                            markerColor = '#848e9c'; 
                        }

                        window.scChartMarkers.push({
                            time: timeSec, position: 'belowBar', color: markerColor, shape: 'arrowUp', text: markerText 
                        });
                        
                        if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                        // Để applyFishFilter() tự động sort và render ở cuối hàm, an toàn hơn.
                    }
                }
            }
        }

        // ==========================================================
        // BẢN ĐỒ HEATMAP (ĐÃ FIX: OBJECT POOLING SIÊU MƯỢT, HIỆN LẠI TƯỜNG)
        // ==========================================================
        if (window.isHeatmapOn && window.scLocalOrderBook && (window.currentChartInterval === 'tick' || window.currentChartInterval === '1s')) {
            let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
            
            const processWalls = (orderMap, isAsk) => {
                let walls = [];
                for (let p in orderMap) {
                    let price = parseFloat(p);
                    let valUSD = price * orderMap[p];
                    if (valUSD > 500) walls.push({ p: price, v: valUSD, isAsk: isAsk });
                }
                walls.sort((a, b) => b.v - a.v); 
                return walls.slice(0, 5); 
            };

            let newWalls = [...processWalls(window.scLocalOrderBook.asks, true), ...processWalls(window.scLocalOrderBook.bids, false)];
            
            if (!window.scActivePriceLines) window.scActivePriceLines = [];
            
            if (window.tvHeatmapLayer) { 
                for (let i = 0; i < newWalls.length; i++) {
                    let wall = newWalls[i];
                    let lineColor = ''; let thickness = 1;
                    let isTrad = window.currentTheme === 'trad';
                    
                    if (wall.v > currentAvgTicket * 30) { lineColor = isTrad ? 'rgba(255,255,255,0.7)' : 'rgba(203, 85, 227, 0.7)'; thickness = 6; }
                    else if (wall.v > currentAvgTicket * 15) { lineColor = isTrad ? 'rgba(255,50,50,0.5)' : 'rgba(137, 57, 153, 0.5)'; thickness = 4; }
                    else if (wall.v > currentAvgTicket * 8) { lineColor = isTrad ? 'rgba(255,152,0,0.4)' : 'rgba(85, 69, 125, 0.4)'; thickness = 3; }
                    else { lineColor = isTrad ? 'rgba(33,150,243,0.3)' : 'rgba(22, 96, 73, 0.3)'; thickness = 2; }

                    if (i < window.scActivePriceLines.length) {
                        window.scActivePriceLines[i].applyOptions({ price: wall.p, color: lineColor, lineWidth: thickness });
                    } else {
                        let priceLine = window.tvHeatmapLayer.createPriceLine({
                            price: wall.p, color: lineColor, lineWidth: thickness, lineStyle: 0, axisLabelVisible: false, title: ''                
                        });
                        window.scActivePriceLines.push(priceLine);
                    }
                }
                
                // Dọn các vạch thừa sang tàng hình
                for (let i = newWalls.length; i < window.scActivePriceLines.length; i++) {
                    window.scActivePriceLines[i].applyOptions({ color: 'transparent' });
                }
            }
        }

        // ==========================================================
        // H. [PRO QUANT] ICEBERG & ABSORPTION DETECTION
        // ==========================================================
        if (!window.scLastIcebergTime) window.scLastIcebergTime = 0;
        let nowTsObj = Date.now();
        
        if (nowTsObj - window.scLastIcebergTime > 10000 && window.scTickHistory && window.scTickHistory.length > 10) {
            let recent3s = window.scTickHistory.filter(x => nowTsObj - x.t <= 3000);
            
            if (recent3s.length > 5) {
                let buyVol3s = recent3s.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
                let sellVol3s = recent3s.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
                
                let pMax = Math.max(...recent3s.map(x => x.p));
                let pMin = Math.min(...recent3s.map(x => x.p));
                let priceDiffPct = pMin > 0 ? ((pMax - pMin) / pMin) * 100 : 1;
                
                let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
                let volThreshold = Math.max(10000, currentAvgTicket * 15);
                
                let isTrad = window.currentTheme === 'trad';
                let timeSec = window.scCurrentCluster ? window.scCurrentCluster.timeSec : Math.floor(nowTsObj / 1000);
                let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;

                if (activeSeries) {
                    if (sellVol3s > buyVol3s * 3 && sellVol3s > volThreshold && priceDiffPct < 0.05) {
                        window.scChartMarkers.push({
                            time: timeSec, position: 'belowBar', 
                            color: isTrad ? '#0ECB81' : '#00F0FF', shape: 'arrowUp', 
                            text: '🧊 BUY ABSORPTION', fishType: 'whale' 
                        });
                        window.scLastIcebergTime = nowTsObj;
                    }
                    else if (buyVol3s > sellVol3s * 3 && buyVol3s > volThreshold && priceDiffPct < 0.05) {
                        window.scChartMarkers.push({
                            time: timeSec, position: 'aboveBar', 
                            color: isTrad ? '#F6465D' : '#FF007F', shape: 'arrowDown', 
                            text: '🧊 SELL ABSORPTION', fishType: 'whale'
                        });
                        window.scLastIcebergTime = nowTsObj;
                    }
                    if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                }
            }
        }

        // ĐỒNG BỘ CACHE VÀ VẼ LÊN CHART ĐÚNG 1 LẦN MỖI GIÂY
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

        if (typeof window.applyFishFilter === 'function') window.applyFishFilter();

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
                if (tvVolumeSeries) tvVolumeSeries.update({ time: candleTime, value: parseFloat(k.v), color: isUpCandle ? 'rgba(42, 245, 146, 0.5)' : 'rgba(203, 85, 227, 0.5)' });

                if (window.currentChartInterval !== 'tick' && window.tvHeatmapLayer) {
                    window.tvHeatmapLayer.update({ time: candleTime, value: parseFloat(k.c) });
                }
            }
        }
        
        // DỮ LIỆU TICKER 24H
        if (data.e === 'tickerList' || data.stream === 'came@allTokens@ticker24') {
            if (data.data && data.data.d) {
                let target1 = `${contract}@${chainId}`.toLowerCase();
                let target2 = `${contract}@CT_${chainId}`.toLowerCase();
                
                let ticker = data.data.d.find(item => {
                    let itemCa = item.ca.toLowerCase();
                    return itemCa === target1 || itemCa === target2;
                });

                if (ticker) {
                    let volEl = document.getElementById('sc-top-vol'); if (volEl) volEl.innerText = '$' + formatCompactNum(parseFloat(ticker.vol24 || 0));
                    let liqEl = document.getElementById('sc-top-liq'); if (liqEl) liqEl.innerText = '$' + formatCompactNum(parseFloat(ticker.liq || 0));
                    let mcEl = document.getElementById('sc-top-mc'); if (mcEl) mcEl.innerText = '$' + formatCompactNum(parseFloat(ticker.mc || 0));
                    let holdEl = document.getElementById('sc-top-hold'); if (holdEl) holdEl.innerText = formatInt(ticker.hc || 0);
                    let txEl = document.getElementById('sc-top-tx'); if (txEl) txEl.innerText = formatInt(ticker.cnt24 || 0);

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
        // BẢN ĐỒ TƯỜNG THANH KHOẢN (CHỈ CẬP NHẬT TỪ ĐIỂN VÀO RAM, KHÔNG VẼ Ở ĐÂY CHỐNG LAG)
        // ---------------------------------------------------------
        if (data.stream && data.stream.includes('@fulldepth')) {
            if (data.data) {
                let currentSym = data.data.s || 'UNKNOWN';
                if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                    window.scLocalOrderBook = { sym: currentSym, asks: {}, bids: {} };
                }

                let asks = data.data.a || []; 
                let bids = data.data.b || []; 
                
                asks.forEach(item => {
                    let p = item[0], q = parseFloat(item[1]);
                    if (q === 0) delete window.scLocalOrderBook.asks[p];
                    else window.scLocalOrderBook.asks[p] = q;
                });
                bids.forEach(item => {
                    let p = item[0], q = parseFloat(item[1]);
                    if (q === 0) delete window.scLocalOrderBook.bids[p];
                    else window.scLocalOrderBook.bids[p] = q;
                });
            }
        }
        
        // LỆNH LIVE & LOGIC CÁ MẬP (SMART TAPE AGGREGATION)
        if (data.stream.endsWith('@aggTrade')) {
            let p = parseFloat(data.data.p), q = parseFloat(data.data.q);
            let isUp = p > window.scLastPrice ? true : (p < window.scLastPrice ? false : (window.scLastTradeDir ?? true));
            window.scLastTradeDir = isUp; window.scLastPrice = p;
            let valUSD = p * q, timeSec = Math.floor(data.data.T / 1000);

            // Cập nhật Nến/Line và Giá lên UI NGAY LẬP TỨC để biểu đồ mượt mà
            window.scTickHistory.push({ t: Date.now(), p: p, q: q, v: valUSD, dir: isUp });
            
            if (window.currentChartInterval === 'tick') {
                if (window.tvHeatmapLayer) window.tvHeatmapLayer.update({ time: timeSec, value: p });
                if (tvLineSeries) tvLineSeries.update({ time: timeSec, value: p });
                let isTrad = window.currentTheme === 'trad';
                if (tvVolumeSeries) tvVolumeSeries.update({ time: timeSec, value: q, color: isUp ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)') });
            }

            let priceEl = document.getElementById('sc-live-price');
            if (priceEl) {
                priceEl.innerText = '$' + formatPrice(p);
                priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
            }

            // LOGIC GOM CỤM THỜI GIAN THỰC (SMART TAPE) - 1 GIÂY
            let nowT = Date.now();
            if (!window.scCurrentCluster) {
                window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
            } else {
                if (window.scCurrentCluster.dir === isUp && (nowT - window.scCurrentCluster.startT < 1000)) {
                    window.scCurrentCluster.vol += valUSD;
                    window.scCurrentCluster.count += 1;
                    window.scCurrentCluster.p = p; 
                } else {
                    window.flushSmartTape(window.scCurrentCluster);
                    window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
                }
            }

            // Cập nhật thông số vĩ mô
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
                volColor: isUp ? (window.currentTheme === 'trad' ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (window.currentTheme === 'trad' ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)'),
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
window.currentTheme = localStorage.getItem('wave_theme') || 'cyber';
window.changeTheme = function() {
    let el = document.getElementById('sc-theme-select');
    if (el) {
        window.currentTheme = el.value;
        localStorage.setItem('wave_theme', window.currentTheme);
        if (window.currentChartToken) window.openProChart(window.currentChartToken, true); // Tải lại chart để áp màu
    }
};
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

    // Reset Chart & Dọn rác UI cũ
    const container = document.getElementById('sc-chart-container');
    if (tvChart) { tvChart.remove(); tvChart = null; tvLineSeries = null; tvCandleSeries = null; tvVolumeSeries = null; }
    container.innerHTML = ''; 
    
    // Nếu là bấm sang Token mới (không phải đổi khung giờ) -> Quét sạch bảng Live Trades
    if (!isTimeSwitch) {
        let tradesBox = document.getElementById('sc-live-trades');
        if (tradesBox) {
            tradesBox.innerHTML = '<div style="text-align:center; margin-top:20px; color:#5e6673; font-style:italic;">Connecting to Dex...</div>';
        }
        window.scCurrentCluster = null; // Cắt đứt cụm lệnh (Smart Tape) đang tính dở của token cũ
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const w = rect.width > 0 ? rect.width : window.innerWidth * 0.75;
        
        const h = (rect.height > 0 ? rect.height : window.innerHeight * 0.7);

        let priceVal = parseFloat(t.price) || 1;
        let prec = 4; let minM = 0.0001;
        if (priceVal < 1) { prec = 6; minM = 0.000001; }
        if (priceVal < 0.1) { prec = 8; minM = 0.00000001; }
        if (priceVal < 0.0001) { prec = 10; minM = 0.0000000001; }

        
// XỬ LÝ MÀU THEME
        let isTrad = window.currentTheme === 'trad';
        let t_bg = isTrad ? '#111418' : '#0f1a1c';
        let t_text = isTrad ? '#848e9c' : '#527c82';
        let t_line = isTrad ? '#00F0FF' : '#41e6e7';
        let t_up = isTrad ? '#0ECB81' : '#2af592';
        let t_down = isTrad ? '#F6465D' : '#cb55e3';
        
        let overlayElem = document.getElementById('super-chart-overlay');
        if(overlayElem) {
            overlayElem.classList.remove('theme-cyber', 'theme-trad');
            overlayElem.classList.add('theme-' + window.currentTheme);
        }
        let themeSel = document.getElementById('sc-theme-select');
        if(themeSel) themeSel.value = window.currentTheme;

        // KHỞI TẠO BIỂU ĐỒ (TẮT GRID, BỎ WATERMARK CŨ)
        tvChart = LightweightCharts.createChart(container, {
            width: w, height: h,
            layout: { background: { type: 'solid', color: t_bg }, textColor: t_text, fontSize: 11 },
            grid: { vertLines: { visible: false }, horzLines: { visible: false } }, // [ĐÃ TẮT LƯỚI RỐI MẮT]
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal, vertLine: { color: t_text, labelBackgroundColor: t_down}, horzLine: { color: t_text, labelBackgroundColor: t_down} },
            timeScale: { borderColor: 'rgba(82, 124, 130, 0.2)', timeVisible: true, secondsVisible: (window.currentChartInterval === 'tick' || window.currentChartInterval === '1s') },
            rightPriceScale: { autoScale: true, scaleMargins: { top: 0.1, bottom: 0.35 }, borderColor: 'rgba(82, 124, 130, 0.2)' }
        });

        window.tvHeatmapLayer = tvChart.addLineSeries({
            color: 'transparent', lineWidth: 0, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
            priceFormat: { type: 'price', precision: prec, minMove: minM }
        });

        if (window.currentChartInterval === 'tick') {
            tvLineSeries = tvChart.addAreaSeries({
                lineColor: t_line, topColor: isTrad ? 'rgba(0, 240, 255, 0.3)' : 'rgba(65, 230, 231, 0.3)', bottomColor: 'rgba(0,0,0,0)', lineWidth: 2, 
                priceFormat: { type: 'price', precision: prec, minMove: minM }
            });
        } else {
            tvCandleSeries = tvChart.addCandlestickSeries({
                upColor: t_up, downColor: t_down,
                borderDownColor: t_down, borderUpColor: t_up,
                wickDownColor: t_down, wickUpColor: t_up,
                priceFormat: { type: 'price', precision: prec, minMove: minM }
            });
        }

        tvVolumeSeries = tvChart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol_scale' });
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
            
            // ==============================================================
            // ĐỒNG BỘ HÓA "KÉT SẮT RAM" CHỐNG MẤT TRÍ NHỚ KHI CHUYỂN TAB/GIỜ
            // ==============================================================
            if (window.currentChartInterval === 'tick') {
                let tickData = [];
                let volData = [];
                let isTrad = window.currentTheme === 'trad';
                
                // Gom nhóm Két sắt (scTickHistory) theo từng giây để Chart không bị lỗi lặp thời gian
                let groupedTicks = {};
                if (window.scTickHistory && window.scTickHistory.length > 0) {
                    window.scTickHistory.forEach(tk => {
                        let tSec = Math.floor(tk.t / 1000);
                        if (!groupedTicks[tSec]) {
                            groupedTicks[tSec] = { time: tSec, value: tk.p, vol: tk.q, dir: tk.dir };
                        } else {
                            groupedTicks[tSec].value = tk.p; 
                            groupedTicks[tSec].vol += tk.q;  
                            groupedTicks[tSec].dir = tk.dir;
                        }
                    });
                }
                
                // Lắp ráp dữ liệu chuẩn bị bơm vào Chart
                Object.values(groupedTicks).sort((a,b) => a.time - b.time).forEach(d => {
                    tickData.push({ time: d.time, value: d.value });
                    volData.push({ 
                        time: d.time, 
                        value: d.vol, 
                        color: d.dir ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)')
                    });
                });

                // ƯU TIÊN 1: Lấy tối đa 5 phút dữ liệu từ Két Sắt RAM đổ ập vào Chart ngay lập tức
                if (tickData.length > 0) {
                    if (window.tvHeatmapLayer) window.tvHeatmapLayer.setData(tickData);
                    if (tvLineSeries) tvLineSeries.setData(tickData);
                    if (tvVolumeSeries) tvVolumeSeries.setData(volData);
                } 
                else if (histData.length > 0) {
                    let apiHeatData = histData.map(d => ({ time: d.time, value: d.close || d.value }));
                    if (window.tvHeatmapLayer) window.tvHeatmapLayer.setData(apiHeatData);
                    if (tvLineSeries) tvLineSeries.setData(histData);
                    let apiVolData = histData.map(d => ({ time: d.time, value: d.volValue, color: d.volColor }));
                    if (tvVolumeSeries) tvVolumeSeries.setData(apiVolData);
                }
            } 
          
            else if (histData.length > 0) {
                if (window.tvHeatmapLayer) {
                    let heatData = histData.map(d => ({ time: d.time, value: d.close }));
                    window.tvHeatmapLayer.setData(heatData);
                }
                if (tvCandleSeries) {
                    let candleData = histData.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close }));
                    let volData = histData.map(d => ({ time: d.time, value: d.volValue, color: d.volColor }));
                    tvCandleSeries.setData(candleData);
                    if (tvVolumeSeries) tvVolumeSeries.setData(volData);
                }
            }
            
            // Mồi lịch sử xong thì mở WebSocket chạy tiếp realtime
            if (typeof connectRealtimeChart === 'function') { connectRealtimeChart(t); }

            // PHỤC HỒI LẠI ICON VÀ SỐ LIỆU TỪ CACHE NGAY LẬP TỨC
            setTimeout(() => {
                // Gọi thẳng hàm lọc cá (Hàm này đã có sẵn Logic: Nếu khung >=1m thì tự xóa cá, nếu <=1s thì lọc theo Dropdown)
                if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
                
                // In lại ngay Dòng Tiền và Số Cá Mập ra bảng Info
                let flowEl = document.getElementById('sc-stat-net-flow');
                if (flowEl && window.scNetFlow !== undefined) {
                    flowEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + formatCompactUSD(Math.abs(window.scNetFlow));
                    flowEl.style.color = window.scNetFlow >= 0 ? '#00F0FF' : '#FF007F';
                }
                
                let eWhale = document.getElementById('sc-stat-whale'); if (eWhale) eWhale.innerText = window.scCWhale || 0;
                let eShark = document.getElementById('sc-stat-shark'); if (eShark) eShark.innerText = window.scCShark || 0;
                let eDolphin = document.getElementById('sc-stat-dolphin'); if (eDolphin) eDolphin.innerText = window.scCDolphin || 0;
                let eSweep = document.getElementById('sc-stat-sweep'); if (eSweep) eSweep.innerText = window.scCSweep || 0;
                
            }, 200);
        });
     
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



// =====================================================================
// 🚀 TRỤ CỘT 4: SMART MONEY RADAR (ĐÃ FIX LỖI SYNTAX VÀ MAPPING DỮ LIỆU)
// =====================================================================

// 1. Logic chuyển Tab chuẩn xác
window.switchScTab = function(tabId, btnElement) {
    document.querySelectorAll('.sc-tab-btn').forEach(btn => btn.classList.remove('active'));
    if(btnElement) btnElement.classList.add('active');
    
    document.querySelectorAll('.sc-tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });
    
    let targetTab = document.getElementById('tab-' + tabId);
    if (targetTab) {
        targetTab.style.display = 'flex';
        targetTab.classList.add('active');
    }
};

// 2. Tự động tiêm UI Smart Money vào Side Panel
function injectSmartMoneyTab() {
    const tabsContainer = document.querySelector('.sc-mobile-tabs');
    const sidePanel = document.querySelector('.sc-side-panel');
    
    if (!tabsContainer || !sidePanel || document.getElementById('tab-smartmoney')) return;

    tabsContainer.style.display = 'flex';
    
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'sc-tab-btn';
    newTabBtn.innerText = 'Smart Money';
    newTabBtn.onclick = function() { window.switchScTab('smartmoney', this); };
    tabsContainer.appendChild(newTabBtn);

    const newTabContent = document.createElement('div');
    newTabContent.id = 'tab-smartmoney';
    newTabContent.className = 'sc-tab-content';
    newTabContent.style.cssText = 'background: #12151A; padding: 10px 15px; display: none; flex-direction: column; overflow-y: auto;';
    
    newTabContent.innerHTML = `
        <div class="sc-panel-title" style="margin-bottom: 15px; color:#eaecef;">
            <i class="fas fa-microscope" style="color:#F0B90B; margin-right: 5px;"></i> RADAR DÒNG TIỀN ON-CHAIN
        </div>
        
        <div style="font-size:10px; color:#848e9c; font-weight:700; margin-bottom:8px;">💎 PHÂN LỚP HOLDER (ON-CHAIN)</div>
        <div class="df-grid" style="margin-top:0; margin-bottom:15px; grid-template-columns: 1fr 1fr;">
            <div class="df-box" style="background: rgba(42, 245, 146, 0.05); border-color: rgba(42, 245, 146, 0.2);">
                <div class="df-label">Smart Money</div>
                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="df-val" id="sm-pct-smart">--%</div>
                    <div style="font-size:9px; color:#848e9c;"><span id="sm-cnt-smart">0</span> ví</div>
                </div>
            </div>
            <div class="df-box" style="background: rgba(240, 185, 11, 0.05); border-color: rgba(240, 185, 11, 0.2);">
                <div class="df-label">KOLs / Pro</div>
                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="df-val" id="sm-pct-kol" style="color:#F0B90B;">--%</div>
                    <div style="font-size:9px; color:#848e9c;"><span id="sm-cnt-kol">0</span> ví</div>
                </div>
            </div>
            <div class="df-box">
                <div class="df-label">New Wallets</div>
                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="df-val" id="sm-pct-new">--%</div>
                    <div style="font-size:9px; color:#848e9c;"><span id="sm-cnt-new">0</span> ví</div>
                </div>
            </div>
            <div class="df-box">
                <div class="df-label">Sniper / Bundler</div>
                <div style="display:flex; justify-content:space-between; align-items:baseline;">
                    <div class="df-val" id="sm-pct-sniper" style="color:#FF007F;">--%</div>
                    <div style="font-size:9px; color:#848e9c;"><span id="sm-cnt-sniper">0</span> ví</div>
                </div>
            </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
            <div style="font-size:10px; color:#848e9c; font-weight:700;">🏦 VỊ THẾ BINANCE CEX</div>
            <div id="sm-bn-traders" style="color:#00F0FF; font-size:9.5px; font-family:var(--font-num); font-weight:700; white-space:nowrap;">-- Traders | -- KYC</div>
        </div>
        <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; margin-bottom: 15px;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; align-items:center;">
                <span style="font-size:10px; color:#848e9c;">TB Giá Gom (Buy):</span>
                <div style="text-align:right;">
                    <span id="sm-bn-avg-buy" style="font-size:12px; font-weight:700; color:#eaecef; font-family:var(--font-num);">$--</span>
                    <span id="sm-bn-buy-status" style="font-size:9px; margin-left:4px;">(--)</span>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom: 8px; align-items:center;">
                <span style="font-size:10px; color:#848e9c;">TB Giá Xả (Sell):</span>
                <span id="sm-bn-avg-sell" style="font-size:12px; font-weight:700; color:#848e9c; font-family:var(--font-num);">$--</span>
            </div>
            
            <div style="height:1px; background:rgba(255,255,255,0.05); margin: 10px 0;"></div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                <span style="font-size:10px; color:#848e9c;">Net Flow Binance (4h):</span>
                <span id="sm-bn-netflow-4h" style="font-size:11px; font-weight:700; font-family:var(--font-num);">$--</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px; color:#848e9c;">Net Flow Binance (24h):</span>
                <span id="sm-bn-netflow-24h" style="font-size:12px; font-weight:800; font-family:var(--font-num);">$--</span>
            </div>
        </div>

        <div style="font-size:10px; color:#848e9c; font-weight:700; margin-bottom:8px;">⚖️ CÁN CÂN CUNG CẦU (ON-CHAIN)</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.02); padding: 8px; border-radius: 4px;">
                <div style="display:flex; justify-content:space-between; font-size:9px; color:#527c82; margin-bottom:4px;">
                    <span>Khung 1 GIỜ</span>
                    <span id="sm-vol-1h-total">Vol: $--</span>
                </div>
                <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; background:#2b3139;">
                    <div id="sm-bar-1h-buy" style="height:100%; width:50%; background:#0ECB81; transition:0.3s;"></div>
                    <div id="sm-bar-1h-sell" style="height:100%; width:50%; background:#F6465D; transition:0.3s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:4px; font-family:var(--font-num); font-weight:700;">
                    <span id="sm-txt-1h-buy" style="color:#0ECB81;">--%</span>
                    <span id="sm-txt-1h-sell" style="color:#F6465D;">--%</span>
                </div>
            </div>
            
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.02); padding: 8px; border-radius: 4px;">
                <div style="display:flex; justify-content:space-between; font-size:9px; color:#527c82; margin-bottom:4px;">
                    <span>Khung 4 GIỜ</span>
                    <span id="sm-vol-4h-total">Vol: $--</span>
                </div>
                <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; background:#2b3139;">
                    <div id="sm-bar-4h-buy" style="height:100%; width:50%; background:#0ECB81; transition:0.3s;"></div>
                    <div id="sm-bar-4h-sell" style="height:100%; width:50%; background:#F6465D; transition:0.3s;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10px; margin-top:4px; font-family:var(--font-num); font-weight:700;">
                    <span id="sm-txt-4h-buy" style="color:#0ECB81;">--%</span>
                    <span id="sm-txt-4h-sell" style="color:#F6465D;">--%</span>
                </div>
            </div>
        </div>
    `;
    sidePanel.appendChild(newTabContent);
}

// 3. Phân tích dữ liệu API JSON
window.updateSmartMoneyRadar = function(apiData) {
    if (!apiData || !apiData.data) return;
    const d = apiData.data;

    const safeSet = (id, val, color) => {
        let el = document.getElementById(id);
        if (el) { el.innerHTML = val; if (color) el.style.color = color; }
    };

    const fmtPct = (val) => val && !isNaN(val) ? (parseFloat(val) * 100).toFixed(2) + '%' : '0.00%';
    const fmtUsd = (val) => val && !isNaN(val) ? '$' + formatCompactUSD(parseFloat(val)) : '$0';
    const fmtPrice = (val) => val && !isNaN(val) ? parseFloat(val).toPrecision(5) : '--';

    let smartPct = parseFloat(d.holdersSmartMoneyPercent || d.smartMoneyHoldingPercent || 0);
    safeSet('sm-pct-smart', smartPct > 0 ? (smartPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-smart', d.smartMoneyHolders || '0');
    
    let kolProPct = parseFloat(d.kolHoldingPercent || 0) + parseFloat(d.proHoldingPercent || 0);
    safeSet('sm-pct-kol', kolProPct > 0 ? (kolProPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-kol', parseInt(d.kolHolders || 0) + parseInt(d.proHolders || 0));
    
    let newPct = parseFloat(d.newWalletHoldingPercent || 0);
    safeSet('sm-pct-new', newPct > 0 ? (newPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-new', d.newWalletHolders || '0');
    
    let sniperBundlerPct = parseFloat(d.sniperHoldingPercent || 0) + parseFloat(d.bundlerHoldingPercent || 0);
    safeSet('sm-pct-sniper', sniperBundlerPct > 0 ? (sniperBundlerPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-sniper', d.bundlerHolders || '0');

    let fShort = (n) => n ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(n) : '0';
    safeSet('sm-bn-traders', `${fShort(d.bnTraders)} Traders <span style="color:#527c82">|</span> ${fShort(d.bnUniqueHolders || d.kycHolderCount)} KYC`);
    
    let currentPrice = parseFloat(d.price || 0);
    let avgBuy = parseFloat(d.bnAvgBuyPrice || 0);
    let avgSell = parseFloat(d.bnAvgSellPrice || 0);
    
    safeSet('sm-bn-avg-buy', '$' + fmtPrice(avgBuy));
    safeSet('sm-bn-avg-sell', '$' + fmtPrice(avgSell));

    let buyStatusEl = document.getElementById('sm-bn-buy-status');
    if (buyStatusEl && avgBuy > 0 && currentPrice > 0) {
        let pnlPct = ((currentPrice - avgBuy) / avgBuy) * 100;
        let sign = pnlPct >= 0 ? '+' : '';
        buyStatusEl.innerText = `(${sign}${pnlPct.toFixed(2)}%)`;
        buyStatusEl.style.color = pnlPct >= 0 ? '#0ECB81' : '#F6465D';
    }

    let net4h = parseFloat(d.volume4hNetBinance || 0);
    safeSet('sm-bn-netflow-4h', (net4h >= 0 ? '+' : '') + fmtUsd(Math.abs(net4h)), net4h >= 0 ? '#0ECB81' : '#F6465D');

    let net24h = parseFloat(d.volume24hNetBinance || 0);
    safeSet('sm-bn-netflow-24h', (net24h >= 0 ? '+' : '') + fmtUsd(Math.abs(net24h)), net24h >= 0 ? '#0ECB81' : '#F6465D');

    const updateCVDBar = (timeKey, buyVol, sellVol) => {
        let total = buyVol + sellVol;
        safeSet(`sm-vol-${timeKey}-total`, `Vol: ` + fmtUsd(total));
        
        let buyPct = total > 0 ? (buyVol / total) * 100 : 50;
        let sellPct = total > 0 ? (sellVol / total) * 100 : 50;
        
        let barBuy = document.getElementById(`sm-bar-${timeKey}-buy`);
        let barSell = document.getElementById(`sm-bar-${timeKey}-sell`);
        if (barBuy) barBuy.style.width = buyPct + '%';
        if (barSell) barSell.style.width = sellPct + '%';
        
        safeSet(`sm-txt-${timeKey}-buy`, buyPct.toFixed(1) + '%');
        safeSet(`sm-txt-${timeKey}-sell`, sellPct.toFixed(1) + '%');
    };

    updateCVDBar('1h', parseFloat(d.volume1hBuy || 0), parseFloat(d.volume1hSell || 0));
    updateCVDBar('4h', parseFloat(d.volume4hBuy || 0), parseFloat(d.volume4hSell || 0));
};

// 4. Lệnh Gọi Fetch Data
window.fetchSmartMoneyData = async function(contract, chainId) {
    if (!contract) return;
    
    let titleEl = document.querySelector('#tab-smartmoney .sc-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-spinner fa-spin" style="color:#F0B90B; margin-right: 5px;"></i> ĐANG KẾT NỐI SERVER...`;
    }

    try {
        let url = `https://alpha-realtime.onrender.com/api/smart-money?chainId=${chainId || 56}&contractAddress=${contract}`;
        console.log("📡 Đang lấy dữ liệu Smart Money từ:", url);
        
        let res = await fetch(url);
        let json = await res.json();
        
        if (json && json.success) {
            window.updateSmartMoneyRadar(json);
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-bolt" style="color:#0ECB81; margin-right: 5px;"></i> RADAR SMART MONEY (LIVE)`;
        } else {
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#F6465D; margin-right: 5px;"></i> API TRẢ VỀ RỖNG`;
        }
    } catch(e) {
        console.error("❌ Lỗi Fetch Data:", e);
        if (titleEl) titleEl.innerHTML = `<i class="fas fa-wifi" style="color:#F6465D; margin-right: 5px;"></i> LỖI KẾT NỐI MẠNG`;
    }
};

// 5. Móc Hàm vào Lệnh Mở Chart
const oldOpenProChart = window.openProChart;
window.openProChart = function(t, isTimeSwitch = false) {
    oldOpenProChart(t, isTimeSwitch);
    if (!isTimeSwitch) {
        setTimeout(() => {
            injectSmartMoneyTab();
            window.fetchSmartMoneyData(t.contract, t.chainId || t.chain_id || 56);
        }, 100);
    }
};

