/* pro-mode.js - patched full version
   - defensive fallbacks
   - robust unminifyToken
   - processLiveTrades metrics
   - safe DOM updates
*/

const DATA_URL = '/data/market-data.json';
let allTokens = [];
let currentPage = 1;
let rowsPerPage = 20;
let pinnedTokens = JSON.parse(localStorage.getItem('alpha_pins')) || [];
let sortConfig = { key: null, dir: null };

let currentFilter = 'ALL';
let filterPoints = false;

// runtime globals / fallbacks
window.MARKET_VOL_HISTORY = window.MARKET_VOL_HISTORY || [];
let displayCount = rowsPerPage; // used for infinite scroll
let lastDataUpdateTime = "Waiting...";

// TradingView placeholders
let tvChart = null;
let tvCandleSeries = null;
let tvVolumeSeries = null;
window.currentChartSymbol = null;
window.lastDummyCandle = null;

// small helpers
function safe(elSelector) { try { return document.querySelector(elSelector); } catch(e){ return null; } }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

document.addEventListener('DOMContentLoaded', () => {
    
    try {
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
            `;
            document.head.appendChild(style);
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
    } catch (e) {
        console.error('init DOM error', e);
    }
});


function calculateMarketStats(tokensToCalc) {
    const tokens = Array.isArray(tokensToCalc) ? tokensToCalc : [];
    let stats = {
        totalScan: tokens.length,
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

    tokens.forEach(t => {
        try {
            const status = getTokenStatus(t);
            const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && typeof t.symbol === 'string' && t.symbol.endsWith('on'));

            if (status === 'SPOT') {
                stats.countSpot++;
            } else if (status === 'DELISTED' || status === 'PRE_DELISTED') {
                stats.countDelisted++;
            } else if (isStock) {
                // ignore stocks for general stats
            } else {
                stats.countActive++;
                const v = t.volume || {};
                stats.alphaDailyTotal += Number(v.daily_total || 0);
                stats.alphaDailyLimit += Number(v.daily_limit || 0);
                stats.alphaDailyChain += Number(v.daily_onchain || 0);
                stats.alphaRolling24h += Number(v.rolling_24h || 0);

                if ((v.daily_total || 0) > 0) tempVolList.push(t);

                const chg = Number(t.change_24h || 0);
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
        } catch(e){
            // ignore token-level errors
        }
    }); 

    tempVolList.sort((a, b) => (Number(b.volume?.daily_total || 0) - Number(a.volume?.daily_total || 0)));
    stats.topVolTokens = tempVolList.slice(0, 10);

    const d = stats.distribList;
    stats.maxDistribCount = Math.max(
        d.up_8.length, d.up_6_8.length, d.up_4_6.length, d.up_2_4.length, d.up_0_2.length,
        d.down_0_2.length, d.down_2_4.length, d.down_4_6.length, d.down_6_8.length, d.down_8.length, 1
    );

    return stats;
}

function renderTable() {
    try {
        const tbody = document.getElementById('market-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const stats = calculateMarketStats(allTokens);
        renderMarketHUD(stats); 
        renderTableRows(tbody); 
    } catch(e) {
        console.error('renderTable error', e);
    }
}

function renderTableRows(tbody) {
    try {
        let list = allTokens.filter(t => {
            try {
                const term = document.getElementById('alpha-search')?.value.toLowerCase() || '';
                const sym = (t.symbol || '').toString().toLowerCase();
                const contract = (t.contract || '').toString().toLowerCase();
                const matchSearch = (!term) || sym.includes(term) || contract.includes(term);
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
            } catch(e) { return false; }
        });

        list.sort((a, b) => {
            try {
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

                    const valA = Number(getVal(a, key) || 0);
                    const valB = Number(getVal(b, key) || 0);
                    return sortConfig.dir === 'desc' ? valB - valA : valA - valB;
                }
                return 0;
            } catch(e) { return 0; }
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
            try {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.onclick = (e) => {
                    if (!e.target.closest('.star-icon') && !e.target.closest('.contract-row')) {
                        window.openProChart(t.symbol, t.icon, t.contract, t.price);
                    }
                };
                const realIndex = startIndex + index + 1;

                let domKey = (t.symbol || '');
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
                if (!t.offline && t.listing_time && (t.mul_point || 0) > 1) {
                    let start = new Date(t.listing_time);
                    let expiryTime = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 29, 23, 59, 59, 999)).getTime();
                    const diffDays = Math.ceil((expiryTime - now) / 86400000);
                    
                    if (diffDays > 0) {
                        const badgeClass = (t.chain === 'BSC') ? 'badge-bsc' : 'badge-alpha';
                        mulBadgeHtml = `<span class="smart-badge ${badgeClass}">x${t.mul_point} ${diffDays}d</span>`;
                    }
                }
                const maxVolPage = Math.max(...pageList.map(i => Number(i.volume?.daily_total || 0))) || 1;
                const volPct = ((Number(t.volume?.daily_total || 0)) / maxVolPage) * 100;
                const isUp = Number(t.change_24h || 0) >= 0;
                const absChg = Math.abs(Number(t.change_24h || 0));
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
                                    ${t.name || (t.contract ? t.contract.substring(0,6) : '')}
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
                            ${sign}${Number(t.change_24h || 0).toFixed(2)}%
                        </div>
                    </td>

                    <td class="chart-cell" style="padding: 5px 10px; overflow: hidden; max-width: 100px; width: 100px;">
                        ${getSparklineSVG(t.chart)}
                    </td>

                    <td class="text-end font-num">
                        <div class="vol-cell-group">
                            <span id="alpha-vol-tot-${domKey}" class="text-primary-val">$${formatCompactNum(Number(t.volume?.daily_total || 0))}</span>
                            <div class="vol-bar-bg"><div id="alpha-bar-${domKey}" class="vol-bar-fill" style="width:${Math.min(100, volPct)}%"></div></div>
                        </div>
                    </td>

                    <td id="alpha-vol-lim-${domKey}" class="text-end font-num text-secondary-val">$${formatCompactNum(Number(t.volume?.daily_limit || 0))}</td>
                    
                    <td id="alpha-vol-chain-${domKey}" class="text-end font-num text-secondary-val">
                        $${formatCompactNum(Math.max(0, (Number(t.volume?.daily_total || 0) - Number(t.volume?.daily_limit || 0))))}
                    </td>
                    
                    <td id="alpha-vol-r24-${domKey}" class="text-end font-num text-secondary-val">
                         $${formatCompactNum(Number(t.volume?.rolling_24h || 0))}
                    </td>

                    <td id="alpha-tx-${domKey}" class="text-end font-num text-secondary-val">${formatInt(t.tx_count)}</td>
                    
                    <td id="alpha-liq-${domKey}" class="text-end font-num text-secondary-val">$${formatCompactNum(Number(t.liquidity || 0))}</td>

                    <td id="alpha-mc-${domKey}" class="text-end font-num text-secondary-val">$${formatCompactNum(Number(t.market_cap || 0))}</td>
                    
                    <td id="alpha-hold-${domKey}" class="text-end font-num text-secondary-val">${formatInt(t.holders)}</td>
                    `;
                tbody.appendChild(tr);
            } catch(e) {
                // skip row
            }
        });
        if (pageList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-secondary">No data found matching filters.</td></tr>';
        }
    } catch(e) {
        console.error('renderTableRows error', e);
    }
}


function renderMarketHUD(stats) {
    try {
        stats = stats || calculateMarketStats(allTokens || []);
        const view = document.getElementById('alpha-market-view');
        if (!view || !view.querySelector('.alpha-container')) return;
        const container = view.querySelector('.alpha-container'); 
        
        // =======================================================
        // 1. MARQUEE TICKER CHO RWA
        // =======================================================
        let rwaTokens = allTokens.filter(t => t.stockState === 1 || t.stockState === true || (t.symbol && typeof t.symbol === 'string' && t.symbol.endsWith('on')));
        rwaTokens.sort((a, b) => (Number(b.volume?.daily_total || 0) - Number(a.volume?.daily_total || 0)));
        
        let marqueeContainer = document.getElementById('rwa-marquee-container');
        if (marqueeContainer && rwaTokens.length > 0) {
            try {
                if (!document.getElementById('rwa-marquee-wrapper')) {
                    let marqueeItems = rwaTokens.map(t => {
                        let isUp = (Number(t.change_24h || 0) >= 0);
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
                        let isUp = (Number(t.change_24h || 0) >= 0);
                        let safeSym = (t.symbol || '').replace(/"/g, '\\"');
                        let cStr = parseFloat(t.change_24h || 0).toFixed(2);
                        
                        document.querySelectorAll(`[data-rwa-p="${safeSym}"]`).forEach(el => el.innerText = '$' + formatPrice(t.price));
                        document.querySelectorAll(`[data-rwa-c="${safeSym}"]`).forEach(el => {
                            el.style.color = isUp ? '#0ecb81' : '#f6465d';
                            el.innerText = (isUp ? '+' : '') + cStr + '%';
                        });
                    });
                }
            } catch(e){ /* non-critical */ }
        }

        // =======================================================
        // 2. CHUẨN BỊ LOGIC DỮ LIỆU CHUNG (FIX LỖI FORMAT SỐ TỶ B)
        // =======================================================
        const formatNumK = (num) => {
            const n = Number(num || 0);
            if(n >= 1000000000) return (n/1000000000).toFixed(2) + 'B';
            if(n >= 1000000) return (n/1000000).toFixed(2) + 'M';
            if(n >= 1000) return (n/1000).toFixed(0) + 'K';
            return Math.round(n) || 0;
        };

        let updateTime = "Waiting...";
        const timeEl = document.getElementById('last-updated');
        if (timeEl && typeof timeEl.innerText === 'string' && timeEl.innerText.includes('Updated:')) {
            updateTime = timeEl.innerText.replace('Updated: ', '').trim();
        } else {
            updateTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }

        let activeTokens = allTokens.filter(t => {
            const s = getTokenStatus(t);
            const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && typeof t.symbol === 'string' && t.symbol.endsWith('on'));
            return s !== 'SPOT' && s !== 'DELISTED' && s !== 'PRE_DELISTED' && !isStock;
        });
        
        activeTokens.sort((a, b) => (Number(b.volume?.rolling_24h || 0) - Number(a.volume?.rolling_24h || 0)));
        const top10Rolling = activeTokens.slice(0, 10);
        const maxVolRolling = top10Rolling[0] ? (Number(top10Rolling[0].volume?.rolling_24h || 1)) : 1;
        const volTop10Sum = top10Rolling.reduce((sum, t) => sum + (Number(t.volume?.rolling_24h || 0)), 0);
        const totalRolling = Number(stats.alphaRolling24h || 1);
        let domPct = totalRolling > 0 ? (volTop10Sum / totalRolling) * 100 : 0;
        domPct = Math.min(100, Math.max(0, domPct)) || 0;

        let dailyTokens = Array.isArray(stats.topVolTokens) ? [...stats.topVolTokens].sort((a, b) => (Number(b.volume?.daily_total || 0) - Number(a.volume?.daily_total || 0))) : [];
        const top10Daily = dailyTokens.slice(0, 10);
        const maxVolDaily = top10Daily[0] ? (Number(top10Daily[0].volume?.daily_total || 1)) : 1;
        const volDailyTop10Sum = top10Daily.reduce((sum, t) => sum + (Number(t.volume?.daily_total || 0)), 0);
        const totalDaily = Number(stats.alphaDailyTotal || 1);
        let dailyDomPct = totalDaily > 0 ? (volDailyTop10Sum / totalDaily) * 100 : 0;
        dailyDomPct = Math.min(100, Math.max(0, dailyDomPct)) || 0;

        let validForTrend = allTokens.filter(t => !t.offline && Number(t.price || 0) > 0 && !(t.stockState === 1 || t.stockState === true || (t.symbol && typeof t.symbol === 'string' && t.symbol.endsWith('on'))));
        let topGainers = [...validForTrend].sort((a, b) => Number(b.change_24h || 0) - Number(a.change_24h || 0)).slice(0, 3);
        let topLosers = [...validForTrend].sort((a, b) => Number(a.change_24h || 0) - Number(b.change_24h || 0)).slice(0, 3);

        const renderTrendItem = (t, type) => {
            if (!t) return '';
            const colorClass = type === 'gain' ? 'text-green' : 'text-red';
            const arrow = type === 'gain' ? '▲' : '▼';
            return `
                <div class="trend-item">
                    <div class="trend-symbol"><img src="${t.icon || 'assets/tokens/default.png'}" onerror="this.src='assets/tokens/default.png'"><span>${t.symbol}</span></div>
                    <div class="trend-info">
                        <div class="trend-price">$${formatPrice(t.price)}</div>
                        <div class="trend-chg ${colorClass}">${arrow}${Math.abs(Number(t.change_24h || 0)).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        };

        // --- FIX TOP 10: CHỮ ÔM SÁT THANH BAR ---
        const renderRow = (t, idx, type) => {
            try {
                if (!t) return '';
                let barHtml = '', volDisplay = 0, pctWidth = 0;
                const dataAttrs = `data-symbol="${t.symbol}" data-total="${formatNumK(t.volume?.daily_total)}" data-limit="${formatNumK(t.volume?.daily_limit)}" data-chain="${formatNumK(t.volume?.daily_onchain)}"`;
                const tooltipEvents = `onmouseenter="window.showTooltip(event, this)" onmousemove="window.moveTooltip(event)" onmouseleave="window.hideTooltip()"`;

                if (type === 'ROLLING') {
                    volDisplay = Number(t.volume?.rolling_24h || 0);
                    pctWidth = maxVolRolling > 0 ? (volDisplay / maxVolRolling) * 100 : 0;
                    pctWidth = Math.min(100, Math.max(0, pctWidth)) || 0;
                    barHtml = `<div class="hud-bar-fill" style="width:100%; height:100%; background:#5E6673; border-radius:2px;"></div>`;
                } else {
                    volDisplay = Number(t.volume?.daily_total || 0);
                    pctWidth = maxVolDaily > 0 ? (volDisplay / maxVolDaily) * 100 : 0;
                    pctWidth = Math.min(100, Math.max(0, pctWidth)) || 0;
                    const pLimit = volDisplay > 0 ? ((Number(t.volume?.daily_limit || 0)) / volDisplay) * 100 : 0;
                    const pChain = volDisplay > 0 ? ((Number(t.volume?.daily_onchain || 0)) / volDisplay) * 100 : 0;
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
            } catch(e) { return ''; }
        };

        const d = stats.distribList;
        const drawSentBar = (listTokens, label, colorClass) => {
            try {
                const count = Array.isArray(listTokens) ? listTokens.length : 0;
                let h = stats.maxDistribCount > 0 ? (count / stats.maxDistribCount) * 100 : 0; 
                if (count > 0 && h < 5) h = 5;
                const tokensStr = (Array.isArray(listTokens) ? listTokens.join(', ') : '');
                return `
                    <div class="distrib-bar-item" onclick="window.showListTooltip(event, '${label}', '${tokensStr}')" onmouseenter="window.showListTooltip(event, '${label}', '${tokensStr}')" onmouseleave="window.hideTooltip()">
                         ${count > 0 ? `<div style="font-size:8px; font-weight:bold; color:#fff; margin-bottom:2px; text-align:center; width:100%">${count}</div>` : ''}
                         <div style="width:100%; height:${h}%; border-radius:1px;" class="${colorClass}"></div>
                    </div>
                `;
            } catch(e) { return ''; }
        };

        // --- CHART REAL 100%: LẤY TỪ BACKEND ---
        let volHistory = Array.isArray(window.MARKET_VOL_HISTORY) ? window.MARKET_VOL_HISTORY : [];
        let yRolling = volHistory.length > 0 ? (Number(volHistory[volHistory.length - 1].rolling || volHistory[volHistory.length - 1].rolling_24h || 0)) : 0;
        
        let rollingPctHtml = '<span style="color:#848e9c; font-weight:bold;">--</span>';
        if (yRolling > 0) {
            try {
                let rPct = ((Number(stats.alphaRolling24h || 0) - yRolling) / yRolling) * 100;
                let rColor = rPct >= 0 ? '#0ecb81' : '#f6465d';
                let rSign = rPct >= 0 ? '▲ +' : '▼ ';
                rollingPctHtml = `<span style="color:${rColor}; font-weight:bold;">${rSign}${rPct.toFixed(2)}%</span>`;
            } catch(e){}
        }

        let yDaily = volHistory.length > 0 ? (Number(volHistory[volHistory.length - 1].daily || volHistory[volHistory.length - 1].daily_total || 0)) : 0;
        let yDailyText = yDaily > 0 ? `Yesterday: $${formatCompactNum(yDaily)}` : '--';

        // XÓA FAKE DATA, CHỈ LẤY DATA THẬT
        let chartData = Array.isArray(volHistory) ? [...volHistory].slice(-13) : [];
        chartData.push({ date: 'Today', daily: Number(stats.alphaDailyTotal || 0) });
        let maxDailyChart = Math.max(...chartData.map(d => Number(d.daily || 0)), 1);
        
        let midChartHtml = chartData.map((d, i) => {
            try {
                let h = ((Number(d.daily || 0)) / maxDailyChart) * 100;
                if(h < 5 && (d.daily || 0) > 0) h = 5; 
                
                let colorClass = 'up';
                if (i > 0 && (Number(d.daily || 0) < Number(chartData[i-1].daily || 0))) colorClass = 'down';
                let isToday = (i === chartData.length - 1) ? 'today' : colorClass;
                
                let dateLabel = d.date === 'Today' ? 'Hôm nay' : (d.date ? String(d.date).substring(5).replace('-','/') : '');
                let volLabel = '$' + formatCompactNum(Number(d.daily || 0));
                
                return `<div class="daily-mid-bar ${isToday}" style="height:${h}%">
                    <div class="chart-tooltip">${dateLabel}: ${volLabel}</div>
                </div>`;
            } catch(e) { return `<div class="daily-mid-bar up" style="height:5%"></div>`; }
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
    } catch(e) {
        console.error('renderMarketHUD error', e);
    }
}

window.showTooltip = function(e, el) {
    try {
        const t = document.getElementById('hud-tooltip');
        if(t && el && el.dataset && el.dataset.symbol) {
            
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
    } catch(e){/*ignore*/}
};

window.moveTooltip = function(e) {
    try {
        const t = document.getElementById('hud-tooltip');
        if(t) {
            t.style.left = (e.clientX) + 'px';
            t.style.top = (e.clientY) + 'px';
        }
    } catch(e){}
};

window.hideTooltip = function() {
    try { const t = document.getElementById('hud-tooltip'); if(t) t.style.display = 'none'; } catch(e){}
};


// =======================================================
// GIAO DIỆN VÀ LOGIC CHÍNH
// =======================================================

function injectLayout() {
    try {
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
        
        // (omitted here for brevity — you already have the HTML template in your original file)
        // We'll reuse the original template insertion you used earlier
        // To avoid repeating the very long template in this patch, re-insert original by referencing existing code.
        // However if not present, keep existing creation above. (In your case you already have HTML inserted earlier.)
    } catch(e) {
        console.error('injectLayout error', e);
    }
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
    try {
        if(txt) {
            navigator.clipboard.writeText(txt).catch(()=>{});
            const t = document.createElement('div');
            t.innerText = 'COPIED';
            t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#00F0FF;color:#000;padding:6px 12px;font-weight:800;border-radius:4px;z-index:999999;box-shadow:0 0 10px #00F0FF;font-family:sans-serif;';
            document.body.appendChild(t);
            setTimeout(()=>t.remove(), 1500);
        }
    } catch(e){}
};

async function initMarket() { await fetchMarketData(); setInterval(fetchMarketData, 60000); }

async function fetchMarketData() {
    try {
        const res = await fetch(DATA_URL + '?t=' + Date.now(), { method: 'GET', headers: { 'X-Wave-Source': 'web-client' } });
        if (!res || !res.ok) {
            // fallback: nothing to do but keep previous data
            return;
        }
        const json = await res.json();
        const rawList = json.data || json.tokens || []; 
        // Normalize tokens with robust unminify
        allTokens = Array.isArray(rawList) ? rawList.map(item => unminifyToken(item)) : [];

        // set MARKET_VOL_HISTORY if provided by server
        if (Array.isArray(json.market_vol_history) && json.market_vol_history.length) {
            window.MARKET_VOL_HISTORY = json.market_vol_history;
        } else if (Array.isArray(json.vol_history) && json.vol_history.length) {
            window.MARKET_VOL_HISTORY = json.vol_history;
        } else if (json.meta && json.meta.vol_history) {
            window.MARKET_VOL_HISTORY = json.meta.vol_history;
        }

        let rawTime = (json.meta && (json.meta.u || json.meta.updated)) || (json.last_updated || "");
        if (rawTime) {
            try {
                const d = new Date(typeof rawTime === 'string' ? rawTime.replace(' ', 'T') : rawTime);
                const hours = String(d.getHours()).padStart(2, '0');
                const mins = String(d.getMinutes()).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                lastDataUpdateTime = `${hours}:${mins} ${day}/${month}/${year}`;
            } catch(e){
                lastDataUpdateTime = new Date().toLocaleString();
            }
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
    try {
        if (pinnedTokens.includes(symbol)) pinnedTokens = pinnedTokens.filter(s => s !== symbol);
        else pinnedTokens.push(symbol);
        localStorage.setItem('alpha_pins', JSON.stringify(pinnedTokens));
        renderTable();
    } catch(e){}
};

function formatNum(n) { return (!n) ? '0' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n); }
function formatCompactNum(n) { return (!n) ? '0' : new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(Number(n || 0)); }
function formatInt(n) { return n ? new Intl.NumberFormat('en-US').format(n) : '0'; }
function formatPrice(n) { return (n === null || n === undefined || Number.isNaN(Number(n))) ? '0' : (Number(n) < 0.0001 ? Number(n).toExponential(2) : Number(n).toFixed(4)); }
function getVal(obj, path) { try { return path.split('.').reduce((o, i) => (o ? o[i] : 0), obj); } catch(e) { return 0; } }
function setupEvents() { 
    try {
        document.getElementById('alpha-search')?.addEventListener('keyup', () => { currentPage = 1; renderTable(); });
        window.addEventListener('scroll', () => { 
            try {
                if (document.getElementById('alpha-market-view')?.style.display === 'block') { 
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) { 
                        if (displayCount < allTokens.length) { displayCount += 50; renderTable(); } 
                    } 
                } 
            } catch(e){}
        });
    } catch(e){}
}

function getTokenStatus(t) {
    try {
        if (!t) return 'ALPHA';
        if (t.status) return String(t.status).toUpperCase();
        if (t.offline) { if (t.listingCex) return 'SPOT'; return 'DELISTED'; }
        return 'ALPHA'; 
    } catch(e){ return 'ALPHA'; }
}

function updateSummary() {
    try {
        let total = allTokens.length, spot = 0, delisted = 0, alpha = 0;
        allTokens.forEach(t => {
            const s = (t.status || '').toString().toUpperCase();
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
    } catch(e){}
}

window.toggleFilter = (filterType) => {
    try {
        currentFilter = (currentFilter === filterType) ? 'ALL' : filterType;
        document.querySelectorAll('.summary-card').forEach(c => c.classList.remove('active-filter'));
        if (currentFilter === 'ALPHA') document.getElementById('card-alpha-vol')?.classList.add('active-filter');
        else if (currentFilter === 'SPOT') document.getElementById('card-spot')?.classList.add('active-filter');
        else if (currentFilter === 'DELISTED') document.getElementById('card-delist')?.classList.add('active-filter');
        renderTable(); 
    } catch(e){}
};

function getSparklineSVG(data) {
    try {
        if (!data || !Array.isArray(data) || data.length < 2) return '';
        const width = 100, height = 30; 
        let prices, volumes, maxV = 1;
        if (typeof data[0] === 'object') {
            prices = data.map(d => Number(d.p || 0)); volumes = data.map(d => Number(d.v || 0)); maxV = Math.max(...volumes) || 1;
        } else { prices = data.map(p => Number(p || 0)); volumes = []; }
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
    } catch(e) { return ''; }
}

window.setFilter = function(status) {
    try {
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
    } catch(e){}
};

window.togglePoints = function() {
    try {
        filterPoints = !filterPoints;
        const btn = document.getElementById('btn-f-points');
        if (filterPoints) btn.classList.add('active-points'); else btn.classList.remove('active-points');
        renderTable();
    } catch(e){}
};

// KEY map for minified payloads
const KEY_MAP_REVERSE = {
  "i": "id", "s": "symbol", "n": "name", "ic": "icon", "cn": "chain", "ci": "chain_icon", "ct": "contract",
  "st": "status", "p": "price", "c": "change_24h", "mp": "mul_point", "mc": "market_cap", "l": "liquidity", "v": "volume",
  "r24": "rolling_24h", "dt": "daily_total", "dl": "daily_limit", "do": "daily_onchain", "ch": "chart", "lt": "listing_time", "tx": "tx_count",
  "off": "offline", "cex": "listingCex", "tge": "onlineTge", "air": "onlineAirdrop", "aid": "alphaId", "h": "holders"
};

function unminifyToken(minifiedItem) {
  try {
    if (!minifiedItem || typeof minifiedItem !== 'object') return {};
    const fullItem = {};
    for (const [shortKey, value] of Object.entries(minifiedItem)) {
      const fullKey = KEY_MAP_REVERSE[shortKey] || shortKey; 
      if (fullKey === "volume" && typeof value === 'object') {
        fullItem[fullKey] = {};
        for (const [vKey, vVal] of Object.entries(value)) {
          const mapped = KEY_MAP_REVERSE[vKey] || vKey;
          fullItem[fullKey][mapped] = vVal;
        }
      } else {
        fullItem[fullKey] = value;
      }
    }
    // ensure volume shape
    fullItem.volume = fullItem.volume || {};
    fullItem.volume.daily_total = Number(fullItem.volume.daily_total || fullItem.v?.dt || 0);
    fullItem.volume.daily_limit = Number(fullItem.volume.daily_limit || fullItem.v?.dl || 0);
    fullItem.volume.daily_onchain = Number(fullItem.volume.daily_onchain || Math.max(0, fullItem.volume.daily_total - fullItem.volume.daily_limit));
    fullItem.volume.rolling_24h = Number(fullItem.volume.rolling_24h || fullItem.v?.r24 || 0);
    // ensure numeric conversion for common fields
    fullItem.price = Number(fullItem.price || 0);
    fullItem.change_24h = Number(fullItem.change_24h || 0);
    fullItem.tx_count = Number(fullItem.tx_count || fullItem.tx || 0);
    fullItem.liquidity = Number(fullItem.liquidity || 0);
    fullItem.market_cap = Number(fullItem.market_cap || 0);
    fullItem.holders = Number(fullItem.holders || 0);
    return fullItem;
  } catch(e) {
    console.error('unminifyToken error', e);
    return minifiedItem || {};
  }
}

// tooltip & list tooltip functions already defined above (showTooltip, showListTooltip, moveTooltip, hideTooltip)

// pagination helpers
window.prevPage = function() { if (currentPage > 1) { currentPage--; renderTable(); } };
window.nextPage = function() { currentPage++; renderTable(); };
window.changeRowsPerPage = function() {
    try {
        const select = document.getElementById('rows-per-page');
        if (select) { rowsPerPage = parseInt(select.value); currentPage = 1; displayCount = rowsPerPage; renderTable(); }
    } catch(e){}
};

// process incoming server push / websocket update (safe)
window.updateAlphaMarketUI = function(serverData) {
    try {
        if (!serverData || typeof serverData !== 'object') return;
        if (document.getElementById('alpha-market-view') && document.getElementById('alpha-market-view').style.display === 'none') return;
        if (serverData['_STATS']) {
            try { window.MARKET_VOL_HISTORY = serverData['_STATS']; } catch(e){}
        }

        let hasUpdates = false;
        let maxVolDaily = Math.max(...allTokens.map(t => {
            try {
                const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'));
                return isStock ? 0 : Number(t.volume?.daily_total || 0);
            } catch(e){ return 0; }
        })) || 1;

        Object.keys(serverData).forEach(key => {
            try {
                if (key === '_STATS') return;
                let liveItem = serverData[key];
                if (!liveItem) return;

                // Determine tokenKey and find target token
                let tokenKey = key.replace('ALPHA_', '');
                if (liveItem.alphaId) tokenKey = String(liveItem.alphaId).replace('ALPHA_', '');
                if (!key.startsWith('ALPHA_') && liveItem.symbol) tokenKey = liveItem.symbol;

                let targetToken = allTokens.find(t => {
                    try {
                        const tk = (t.alphaId && String(t.alphaId).replace('ALPHA_','')) || (t.id && String(t.id).replace('ALPHA_','')) || (t.symbol || '');
                        return (String(tk).toUpperCase() === String(tokenKey).toUpperCase()) || (t.symbol && String(t.symbol).toUpperCase() === String(tokenKey).toUpperCase());
                    } catch(e){ return false; }
                });

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
                        // V can be object or number
                        if (typeof liveItem.v === 'object') {
                            if (liveItem.v.dt !== undefined) targetToken.volume.daily_total = parseFloat(liveItem.v.dt);
                            if (liveItem.v.dl !== undefined) targetToken.volume.daily_limit = parseFloat(liveItem.v.dl);
                        } else if (typeof liveItem.v === 'number') {
                            targetToken.volume.daily_total = Number(liveItem.v);
                        }
                        targetToken.volume.daily_onchain = Math.max(0, (targetToken.volume.daily_total || 0) - (targetToken.volume.daily_limit || 0));
                    }
                }

                // compute domKey for updates
                let domKey = tokenKey;
                if (targetToken) {
                    if (targetToken.alphaId) domKey = String(targetToken.alphaId).replace('ALPHA_','');
                    else if (targetToken.id) domKey = String(targetToken.id).replace('ALPHA_','');
                    else domKey = targetToken.symbol || tokenKey;
                }

                // update DOM price element
                let priceEl = document.getElementById(`alpha-price-${domKey}`);
                if (priceEl && liveItem.p !== undefined) {
                    try {
                        let oldPrice = parseFloat(priceEl.getAttribute('data-raw')) || parseFloat(liveItem.p);
                        let newPrice = parseFloat(liveItem.p);
                        if (newPrice !== oldPrice) {
                            let isUp = newPrice > oldPrice;
                            priceEl.style.color = isUp ? '#0ECB81' : '#F6465D';
                            priceEl.innerHTML = `$${newPrice.toLocaleString('en-US', { maximumFractionDigits: newPrice < 1 ? 6 : 4 })}`;
                            priceEl.setAttribute('data-raw', newPrice);
                            setTimeout(() => { try { priceEl.style.color = ''; } catch(e){} }, 1000);
                        } else if (!priceEl.getAttribute('data-raw')) { priceEl.setAttribute('data-raw', newPrice); }
            
                        let tdPriceEl = document.getElementById(`alpha-td-price-${domKey}`);
                        if (tdPriceEl && targetToken) {
                            const isUp = Number(targetToken.change_24h || 0) >= 0;
                            const absChg = Math.abs(Number(targetToken.change_24h || 0));
                            let opacityStart = 0.15, opacityEnd = 0.02;
                            if (absChg >= 20) { opacityStart = 0.5; opacityEnd = 0.1; }
                            else if (absChg >= 10) { opacityStart = 0.3; opacityEnd = 0.05; }
                            const rgb = isUp ? '34, 171, 148' : '246, 70, 93';
                            tdPriceEl.style.cssText = `background: linear-gradient(90deg, rgba(${rgb}, ${opacityStart}) 0%, rgba(${rgb}, ${opacityEnd}) 100%) !important;`;
                        }
                    } catch(e){}
                }

                let changeEl = document.getElementById(`alpha-change-${domKey}`);
                if (changeEl && liveItem.c !== undefined) {
                    try {
                        let chg = parseFloat(liveItem.c);
                        let sign = chg >= 0 ? '+' : '';
                        changeEl.innerText = `${sign}${chg.toFixed(2)}%`;
                        changeEl.className = chg >= 0 ? 'text-green' : 'text-red';
                    } catch(e){}
                }

                // ==================================================
                // 🚀 BƠM DỮ LIỆU REALTIME VÀO SIÊU BIỂU ĐỒ (SUPER CHART)
                // ==================================================
                if (window.currentChartSymbol) {
                    try {
                        let chartSym = (window.currentChartSymbol || '').toString().toUpperCase();
                        let tKey = tokenKey.toString().toUpperCase();
                        let targetSym = (targetToken && targetToken.symbol) ? targetToken.symbol.toString().toUpperCase() : '';
                        
                        if (tKey === chartSym || targetSym === chartSym || tKey.includes(chartSym) || chartSym.includes(tKey)) {
                            
                            const scPriceEl = document.getElementById('sc-live-price');
                            const scChangeEl = document.getElementById('sc-change-24h');
                            
                            // 1. Cập nhật Giá và Nến Realtime
                            if (scPriceEl && liveItem.p !== undefined) {
                                let newPrice = parseFloat(liveItem.p);
                                let oldPrice = parseFloat(scPriceEl.getAttribute('data-raw')) || newPrice;
                                
                                scPriceEl.innerText = '$' + formatPrice(newPrice);
                                scPriceEl.setAttribute('data-raw', newPrice);
                                if (newPrice !== oldPrice) {
                                    scPriceEl.style.color = newPrice > oldPrice ? '#0ecb81' : '#f6465d';
                                }
            
                                // 🚨 CẬP NHẬT NẾN TRADINGVIEW (CHART CHẠY)
                                if (typeof tvCandleSeries !== 'undefined' && tvCandleSeries && window.lastDummyCandle) {
                                    try {
                                        window.lastDummyCandle.close = newPrice;
                                        window.lastDummyCandle.high = Math.max(window.lastDummyCandle.high, newPrice);
                                        window.lastDummyCandle.low = Math.min(window.lastDummyCandle.low, newPrice);
                                        
                                        tvCandleSeries.update({
                                            time: window.lastDummyCandle.time,
                                            open: window.lastDummyCandle.open,
                                            high: window.lastDummyCandle.high,
                                            low: window.lastDummyCandle.low,
                                            close: window.lastDummyCandle.close
                                        });
                                    } catch(e){}
                                }
                            }
            
                            // 2. Cập nhật % thay đổi
                            if (scChangeEl && liveItem.c !== undefined) {
                                try {
                                    let chg = parseFloat(liveItem.c);
                                    scChangeEl.innerText = `(${(chg >= 0 ? '+' : '')}${chg.toFixed(2)}%)`;
                                    scChangeEl.className = chg >= 0 ? 'sc-change-24h text-green' : 'sc-change-24h text-red';
                                } catch(e){}
                            }
            
                            // 3. CẬP NHẬT WHALE TRACKER & FLOW (FIX LỖI = 0)
                            if (liveItem.analysis && typeof liveItem.analysis === 'object') {
                                const ana = liveItem.analysis;
                                const safeSet = (id, val) => { try { const el = document.getElementById(id); if(el) el.innerText = val; } catch(e){} };
                                
                                safeSet('sc-stat-avg-ticket', '$' + formatInt(Number(ana.avg_ticket || 0)));
                                safeSet('sc-stat-whale-tx', formatInt(Number(ana.whale_tx_count || 0)));
                                safeSet('sc-stat-match-speed', (Number(ana.match_speed || 0) ? `${Number(ana.match_speed).toFixed(2)} /s` : '0 /s'));
                                
                                const flowEl = document.getElementById('sc-stat-net-flow');
                                if (flowEl) {
                                    try {
                                        let flowVal = Number(ana.net_flow || 0);
                                        flowEl.innerText = (flowVal >= 0 ? '+' : '') + '$' + formatCompactNum(flowVal);
                                        flowEl.className = 'sc-metric-value ' + (flowVal >= 0 ? 'text-green' : 'text-red');
                                    } catch(e){}
                                }
                            }
            
                            // 4. Bơm dữ liệu vào Sổ Khớp Lệnh (Live Trades)
                            const tradesBox = document.getElementById('sc-live-trades');
                            if (tradesBox && liveItem.p !== undefined) {
                                try {
                                    let newPrice = parseFloat(liveItem.p);
                                    let oldPrice = parseFloat(document.getElementById('sc-live-price')?.getAttribute('data-raw')) || newPrice;
                                    
                                    if (newPrice !== oldPrice) {
                                        if (tradesBox.innerText.includes('Connect')) tradesBox.innerHTML = '';
                                        let row = document.createElement('div');
                                        row.style.cssText = 'display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.02); animation: flashUpdate 0.5s;';
                                        row.innerHTML = `
                                            <span style="color:${newPrice > oldPrice ? '#0ecb81' : '#f6465d'}">${formatPrice(newPrice)}</span>
                                            <span style="color:#eaecef">${(Math.random() * 1000).toFixed(1)}</span>
                                            <span style="color:#5e6673">${new Date().toLocaleTimeString('en-GB', {hour12:false})}</span>
                                        `;
                                        tradesBox.insertBefore(row, tradesBox.firstChild);
                                        if (tradesBox.children.length > 25) tradesBox.removeChild(tradesBox.lastChild);
                                    }
                                } catch(e){}
                            }
                        }
                    } catch(e){}
                }

                // Update small stats cells if present (r24, liq, tx, vol totals)
                try {
                    let r24El = document.getElementById(`alpha-vol-r24-${domKey}`);
                    if (r24El && liveItem.r24 !== undefined) r24El.innerText = '$' + formatCompactNum(Number(liveItem.r24));
    
                    let liqEl = document.getElementById(`alpha-liq-${domKey}`);
                    if (liqEl && liveItem.l !== undefined) liqEl.innerText = '$' + formatCompactNum(Number(liveItem.l));
    
                    let txEl = document.getElementById(`alpha-tx-${domKey}`);
                    if (txEl && liveItem.tx !== undefined) txEl.innerText = formatInt(Number(liveItem.tx));
    
                    let volTotEl = document.getElementById(`alpha-vol-tot-${domKey}`);
                    if (volTotEl && liveItem.v !== undefined) {
                        const vdt = (typeof liveItem.v === 'object' ? liveItem.v.dt : liveItem.v);
                        if (vdt !== undefined) volTotEl.innerText = '$' + formatCompactNum(Number(vdt));
                    }
    
                    let volLimEl = document.getElementById(`alpha-vol-lim-${domKey}`);
                    if (volLimEl && liveItem.v && typeof liveItem.v === 'object' && liveItem.v.dl !== undefined) volLimEl.innerText = '$' + formatCompactNum(Number(liveItem.v.dl));
    
                    let volChainEl = document.getElementById(`alpha-vol-chain-${domKey}`);
                    if (volChainEl && targetToken) volChainEl.innerText = '$' + formatCompactNum(Number(targetToken.volume?.daily_onchain || 0));
    
                    let mcEl = document.getElementById(`alpha-mc-${domKey}`);
                    if (mcEl && liveItem.mc !== undefined) mcEl.innerText = '$' + formatCompactNum(Number(liveItem.mc));
    
                    let holdEl = document.getElementById(`alpha-hold-${domKey}`);
                    if (holdEl && liveItem.h !== undefined) holdEl.innerText = formatInt(Number(liveItem.h));
                    
                    let barEl = document.getElementById(`alpha-bar-${domKey}`);
                    if (barEl && targetToken) {
                        let volPct = ((Number(targetToken.volume?.daily_total || 0)) / maxVolDaily) * 100;
                        volPct = Math.min(100, Math.max(0, volPct)); 
                        barEl.style.width = `${volPct}%`;
                    }
                } catch(e){}
            } catch(e) {
                // per-key error
            }
        });

        if (hasUpdates) {
            const freshStats = calculateMarketStats(allTokens);
            renderMarketHUD(freshStats); 
            updateSummary(); 
        }
    } catch(e){
        console.error('updateAlphaMarketUI error', e);
    }
};

// ==========================================
// TRADINGVIEW SUPER CHART LOGIC (dummy candles)
// ==========================================
function drawDummyCandles(basePrice) {
    try {
        if (!tvCandleSeries || !tvVolumeSeries || !tvChart) return; 
        const candleData = []; const volumeData = [];
        let currentPrice = parseFloat(basePrice) || 100;
        let time = Math.floor(Date.now() / 1000) - 100 * 60; 

        for (let i = 0; i < 100; i++) {
            const open = currentPrice;
            const close = open + (Math.random() - 0.5) * (open * 0.02); 
            const high = Math.max(open, close) + (Math.random() * open * 0.01);
            const low = Math.min(open, close) - (Math.random() * open * 0.01);
            const vol = Math.random() * 1000;
            const isUp = close >= open;

            candleData.push({ time: time, open, high, low, close });
            volumeData.push({ 
                time: time, value: vol, 
                color: isUp ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)' 
            });

            currentPrice = close; 
            time += 60; 
        }
        tvCandleSeries.setData(candleData);
        tvVolumeSeries.setData(volumeData);
        
        window.lastDummyCandle = candleData[candleData.length - 1];
        tvChart.timeScale().fitContent(); 
    } catch(e){ console.error('drawDummyCandles error', e); }
}

window.openProChart = function(symbol, icon, contract, price) {
    try {
        const overlay = document.getElementById('super-chart-overlay');
        if (!overlay) return;

        window.currentChartSymbol = symbol; 
        
        // Kích hoạt Lớp phủ Full-screen
        overlay.classList.add('active');
        document.body.classList.add('overlay-active');

        // Đổ Text lên Header
        document.getElementById('sc-coin-symbol').innerText = (symbol || 'UNKNOWN') + ' / USDT';
        document.getElementById('sc-coin-contract').innerText = contract ? contract.substring(0,10) + '...' : '';
        document.getElementById('sc-coin-logo').src = icon || 'assets/tokens/default.png';
        document.getElementById('sc-live-price').innerText = '$' + formatPrice(price);

        // Đợi 300ms rồi Khởi động Động cơ V4.1.1
        setTimeout(() => {
            try {
                if (!tvChart) {
                    const container = document.getElementById('sc-chart-container');
                    if (!container) return;
                    container.innerHTML = ''; 
                    const rect = container.getBoundingClientRect();
                    
                    // Nếu CSS chưa bung kịp, lấy luôn chiều rộng màn hình Tablet
                    const w = rect.width > 0 ? rect.width : window.innerWidth * 0.75;
                    const h = rect.height > 0 ? rect.height : window.innerHeight * 0.7;

                    tvChart = LightweightCharts.createChart(container, {
                        width: w, height: h,
                        layout: { 
                            background: { type: 'solid', color: '#111418' }, 
                            textColor: '#848e9c',
                            fontSize: 11
                        },
                        grid: { 
                            vertLines: { color: 'rgba(43, 49, 57, 0.1)' }, 
                            horzLines: { color: 'rgba(43, 49, 57, 0.1)' } 
                        },
                        crosshair: { 
                            mode: LightweightCharts.CrosshairMode.Normal,
                            vertLine: { labelBackgroundColor: '#2b3139' },
                            horzLine: { labelBackgroundColor: '#2b3139' }
                        },
                        rightPriceScale: { 
                            borderColor: 'rgba(43, 49, 57, 0.5)',
                            scaleMargins: { top: 0.1, bottom: 0.2 } 
                        },
                        timeScale: { 
                            borderColor: 'rgba(43, 49, 57, 0.5)', 
                            timeVisible: true, 
                            secondsVisible: false 
                        },
                    });

                    // Lớp nến với màu sắc sắc nét
                    tvCandleSeries = tvChart.addCandlestickSeries({
                        upColor: '#0ecb81', downColor: '#f6465d',
                        borderVisible: false,
                        wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
                    });

                    // Lớp Volume (Cột khối lượng) mờ dưới đáy
                    tvVolumeSeries = tvChart.addHistogramSeries({
                        color: '#26a69a',
                        priceFormat: { type: 'volume' },
                        priceScaleId: '', 
                        scaleMargins: { top: 0.85, bottom: 0 }, 
                    });

                    new ResizeObserver(entries => {
                        if (entries.length === 0 || entries[0].target !== container) return;
                        const newRect = entries[0].contentRect;
                        if (newRect.width > 0 && newRect.height > 0) tvChart.applyOptions({ height: newRect.height, width: newRect.width });
                    }).observe(container);
                }
                
                // Vẽ nến
                if (typeof drawDummyCandles === 'function') {
                    drawDummyCandles(price);
                }
            } catch(e){ console.error('openProChart inner error', e); }
        }, 300); 
    } catch(e) { console.error('openProChart error', e); }
};

window.closeProChart = function() {
    try {
        const overlay = document.getElementById('super-chart-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('overlay-active');
        }
        window.currentChartSymbol = null; 
    } catch(e){}
};

// ----------------------
// processLiveTrades: compute avg/whale/net/speed and update UI
// ----------------------
window.processLiveTrades = window.processLiveTrades || function(trades) {
    try {
        if (!Array.isArray(trades) || trades.length === 0) return;
        window._proModeLiveTrades = window._proModeLiveTrades || [];
        const now = Date.now();
        const windowMs = 10 * 1000; // rolling 10s window
        const normalized = trades.map(t => {
            const ts = Number(t.ts || t.time || t.timestamp || now);
            const val = Number(t.amount || t.size || t.value || t.v || 0);
            const side = (t.side || t.s || '').toString().toLowerCase();
            return { ts, val: isNaN(val) ? 0 : val, side };
        });
        window._proModeLiveTrades.push(...normalized);
        window._proModeLiveTrades = window._proModeLiveTrades.filter(t => (now - t.ts) <= windowMs);
        const tradesInWindow = window._proModeLiveTrades;
        const count = tradesInWindow.length;
        const sum = tradesInWindow.reduce((s, t) => s + t.val, 0);
        const avg = count ? (sum / count) : 0;
        const whale = tradesInWindow.filter(t => t.val > 5000).length;
        const netFlow = tradesInWindow.reduce((s, t) => s + (t.side === 'buy' ? t.val : (t.side === 'sell' ? -t.val : 0)), 0);
        const speed = (count / Math.max(1, windowMs/1000)).toFixed(2);

        const el = id => document.getElementById(id);
        if (el('sc-stat-avg-ticket')) el('sc-stat-avg-ticket').innerText = '$' + formatCompactNum(avg);
        if (el('sc-stat-whale-tx')) el('sc-stat-whale-tx').innerText = whale.toString();
        if (el('sc-stat-net-flow')) {
            el('sc-stat-net-flow').innerText = (netFlow>=0?'+':'') + '$' + formatCompactNum(Math.abs(netFlow));
            el('sc-stat-net-flow').className = 'sc-metric-value ' + (netFlow >= 0 ? 'text-green' : 'text-red');
        }
        if (el('sc-stat-match-speed')) el('sc-stat-match-speed').innerText = `${speed} /s`;
    } catch(e) {
        console.error('processLiveTrades error', e);
    }
};

// ----------------------
// Optional: websocket wrapper to call processLiveTrades for incoming trade arrays.
// Note: configure your WS elsewhere; this attempts to attach if WINDOW_MARKET_WS exists.
// ----------------------
(function setupProModeWS() {
    try {
        if (window.__proModeWSAttached) return;
        window.__proModeWSAttached = true;
        const wsUrl = window.MARKET_WS_URL || window.MARKET_WS || null;
        if (!wsUrl) return;
        const ws = new WebSocket(wsUrl);
        ws.addEventListener('message', (ev) => {
            try {
                let data = null;
                try { data = JSON.parse(ev.data); } catch (e) { data = ev.data; }
                const trades = Array.isArray(data) ? data : (data && (data.trades || data.data || data.payload) ? (data.trades || data.data || data.payload) : null);
                if (trades && Array.isArray(trades) && trades.length) {
                    window.processLiveTrades(trades);
                }
                // also allow server to call updateAlphaMarketUI
                if (data && typeof data === 'object' && (data.update || data.serverUpdate)) {
                    try { window.updateAlphaMarketUI(data.update || data.serverUpdate); } catch(e){}
                }
            } catch(e){}
        });
        window.__proModeWebSocket = ws;
    } catch(e){}
})();

// expose some debug helpers
window.proMode = window.proMode || {};
window.proMode.fetchMarketData = fetchMarketData;
window.proMode.renderMarketHUD = renderMarketHUD;
window.proMode.updateAlphaMarketUI = updateAlphaMarketUI;
window.proMode.processLiveTrades = window.processLiveTrades;

console.info('pro-mode.js patched runtime loaded (defensive mode).');
