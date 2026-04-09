const DATA_URL = '/data/market-data.json';
window.allTokens = [];
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
            
            .daily-mid-chart { display: flex; align-items: flex-end; justify-content: space-between; height: 65px; margin: 15px 0 10px 0; gap: 4px; }
            .daily-mid-bar { flex: 1; border-radius: 3px 3px 0 0; position: relative; transition: all 0.2s ease; min-width: 8px;}
            .daily-mid-bar.up { background: linear-gradient(to top, rgba(14,203,129,0.2), rgba(14,203,129,0.9)); border-top: 1px solid #0ecb81; }
            .daily-mid-bar.down { background: linear-gradient(to top, rgba(246,70,93,0.2), rgba(246,70,93,0.9)); border-top: 1px solid #f6465d; }
            .daily-mid-bar.today { background: linear-gradient(to top, rgba(240,185,11,0.2), #F0B90B); border-top: 2px solid #fff; box-shadow: 0 -2px 10px rgba(240,185,11,0.4); }
            .daily-mid-bar:hover { filter: brightness(1.3); cursor: pointer; }
            
            .chart-tooltip { display: none; position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #2b3139; color: #fff; padding: 4px 6px; font-size: 10px; font-family: var(--font-num); border-radius: 4px; white-space: nowrap; pointer-events: none; margin-bottom: 6px; z-index: 10; border: 1px solid #474d57; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
            .chart-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -4px; border-width: 4px; border-style: solid; border-color: #474d57 transparent transparent transparent; }
            .daily-mid-bar:hover .chart-tooltip { display: block; }
            
            @keyframes pulse-dot { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(14,203,129, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(14,203,129, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(14,203,129, 0); } }
            
            .sc-toolbar { display: flex !important; flex-wrap: wrap; align-items: center; gap: 4px; padding: 8px 15px; background: #111418; border-bottom: 1px solid rgba(255,255,255,0.05); z-index: 999; }
            .sc-chart-main { display: flex !important; flex-direction: column !important; height: 100%; overflow: hidden; }

            .sc-time-btn { background: transparent; border: none; color: #848e9c; font-size: 11px; cursor: pointer; padding: 4px 8px; border-radius: 3px; transition: 0.2s; font-family: var(--font-main); }
            .sc-time-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
            .sc-time-btn.active { background: rgba(0, 240, 255, 0.15); color: #00F0FF; font-weight: bold; }

            .theme-cyber .price-up { color: #2af592 !important; transition: color 0.3s; }
            .theme-cyber .price-down { color: #cb55e3 !important; transition: color 0.3s; }
            .theme-trad .price-up { color: #0ECB81 !important; transition: color 0.3s; }
            .theme-trad .price-down { color: #F6465D !important; transition: color 0.3s; }

            .df-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
            .df-box { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 8px; display: flex; flex-direction: column; justify-content: center; }
            .df-label { font-size: 9px; color: #527c82; text-transform: uppercase; margin-bottom: 4px; font-weight: 700; white-space: nowrap; letter-spacing: 0.5px;}
            .df-val { font-size: 14px; font-family: var(--font-num); font-weight: 700; color: #eaecef; }
        `;
        document.head.appendChild(style);
    }
    
    if (!document.getElementById('wave-alpha-pro-chart-styles')) {
        const proChartStyle = document.createElement('style');
        proChartStyle.id = 'wave-alpha-pro-chart-styles';
        proChartStyle.innerHTML = `
            :root { 
                --term-bg: #000000; --term-panel: #0B0E14; --term-border: #1A1F26; --term-text: #EAECEF; 
                --term-dim: #707A8A; --term-up: #0ECB81; --term-down: #F6465D; --term-warn: #F0B90B; 
            }
            #super-chart-overlay * { text-shadow: none !important; box-shadow: none !important; }
            #super-chart-overlay { height: 100dvh !important; padding-bottom: 0; box-sizing: border-box; background: var(--term-bg); font-family: var(--font-main); }
            
            .sc-topbar { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; background: var(--term-panel); border-bottom: 1px solid var(--term-border); height: 42px; flex-shrink: 0; }
            .sc-body { display: flex; flex: 1; overflow: hidden; width: 100%; }
            .sc-chart-area { flex: 1; display: flex; flex-direction: column; background: var(--term-bg); overflow: hidden; }
            .sc-stats-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; background: var(--term-panel); border-bottom: 1px solid var(--term-border); }
            .sc-side-panel { width: 340px; background: var(--term-bg); display: flex; flex-direction: column; border-left: 1px solid var(--term-border); z-index: 2;}
            
            .sc-price-box { display: flex; align-items: baseline; gap: 10px; margin-right: 15px; }
            .sc-metrics-compact { display: flex; gap: 20px; align-items: center; }
            .sc-mc-item { display: flex; flex-direction: column; align-items: flex-end; }
            .sc-mc-item span { font-size: 9.5px; color: var(--term-dim); font-weight: 600; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px;}
            .sc-mc-item strong { font-size: 13px; color: var(--term-text); font-family: var(--font-num); font-weight: 700; font-variant-numeric: tabular-nums; }
            
            .sc-right-container { display: flex; height: 100%; background: var(--term-bg); border-left: 1px solid var(--term-border); z-index: 2; flex-shrink: 0; }
            .sc-panel-content { width: 340px; height: 100%; background: var(--term-bg); display: flex; flex-direction: column; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); overflow-x: hidden; overflow-y: hidden; }
            .sc-panel-content.collapsed { width: 0px !important; }
            
            .sc-icon-sidebar { width: 40px; height: 100%; background: var(--term-panel); border-left: 1px solid var(--term-border); display: flex; flex-direction: column; align-items: center; padding-top: 10px; flex-shrink: 0; z-index: 3; }
            .sc-sidebar-icon { width: 40px; height: 40px; background: transparent; border: none; color: var(--term-dim); font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; position: relative; border-left: 2px solid transparent; }
            .sc-sidebar-icon:hover { color: var(--term-text); background: rgba(255,255,255,0.05); }
            .sc-sidebar-icon.active { color: var(--term-warn); background: rgba(240, 185, 11, 0.1); border-left-color: var(--term-warn); }
            
            .sc-sidebar-icon::after { content: attr(data-title); position: absolute; right: 45px; background: #1e2329; color: #eaecef; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s, transform 0.2s; transform: translateX(10px); border: 1px solid var(--term-border); box-shadow: 0 2px 8px rgba(0,0,0,0.5); z-index: 100; }
            .sc-sidebar-icon:hover::after { opacity: 1; transform: translateX(0); }
            
            .wl-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; border-bottom: 1px solid var(--term-border); cursor: pointer; transition: 0.2s;}
            .wl-item:hover { background: rgba(255,255,255,0.03); }
            .wl-sym { font-weight: 700; color: var(--term-text); font-size: 12px; display: flex; align-items: center; gap: 6px; width: 35%;}
            .wl-sym img { width: 18px; height: 18px; border-radius: 50%; }
            .wl-price { font-family: var(--font-num); color: var(--term-text); font-size: 13px; text-align: right; width: 35%; font-weight: 600;}
            .wl-chg { font-family: var(--font-num); font-size: 12px; font-weight: 700; text-align: right; width: 30%;}
            
            .sc-tab-content { display: none; flex-direction: column; flex: 1; overflow-y: auto; padding: 10px; background: var(--term-bg);}
            .sc-tab-content.active { display: flex !important; }
            
            .term-widget { background: var(--term-panel); border: 1px solid var(--term-border); border-radius: 2px; padding: 8px; margin-bottom: 6px; overflow: hidden; }
            .term-w-title { font-size: 9px; color: var(--term-dim); font-weight: 700; text-transform: uppercase; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.5px; white-space: nowrap; gap: 4px; overflow: hidden; }
            .term-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; gap: 4px; }
            .term-lbl { font-size: 9px; color: var(--term-dim); overflow: hidden; text-overflow: ellipsis; }
            .term-val { font-size: 11px; font-weight: 700; color: var(--term-text); font-family: var(--font-num); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; text-align: right;}
            
            #sc-live-trades::-webkit-scrollbar { width: 4px; }
            #sc-live-trades::-webkit-scrollbar-thumb { background: #2B3139; border-radius: 0; }
            #sc-live-trades::-webkit-scrollbar-track { background: var(--term-bg); }

            @media (max-width: 991px) {
                /* Ép toàn bộ giao diện theo chiều dọc, không cho phép tràn màn hình */
                .sc-body { flex-direction: column !important; height: calc(100dvh - 42px) !important; overflow: hidden !important; }
                
                /* 1. CHART AREA: Chiếm toàn bộ khoảng trống còn lại (Tự co giãn) */
                .sc-chart-area { 
                    flex: 1 1 0% !important; 
                    display: flex !important; 
                    flex-direction: column !important;
                    min-height: 0 !important; 
                    height: auto !important; 
                }

                /* 2. THANH STATS & PRICE: Giữ nguyên vị trí sát dưới Chart */
                .sc-stats-row { padding: 4px 10px; gap: 8px; flex-shrink: 0; background: var(--term-panel); border-top: 1px solid var(--term-border); }
                .sc-price-box #sc-live-price { font-size: 18px !important; }

                /* 3. RIGHT CONTAINER: Chuyển thành khối điều hướng đáy */
                .sc-right-container { 
                    display: flex !important; 
                    flex-direction: column-reverse !important; 
                    width: 100% !important; 
                    flex-shrink: 0 !important;
                    background: var(--term-bg);
                }

                /* 4. BOTTOM NAVIGATION: Thanh icon chết ở đáy */
                .sc-icon-sidebar { 
                    flex-direction: row !important; 
                    width: 100% !important; 
                    height: 50px !important; 
                    padding: 0 !important;
                    border-left: none !important; 
                    border-top: 1px solid var(--term-border) !important; 
                    justify-content: space-around !important; 
                    align-items: center !important;
                    background: var(--term-panel) !important;
                    flex-shrink: 0 !important;
                }
                .sc-sidebar-icon { border-left: none !important; border-top: 2px solid transparent !important; height: 100% !important; flex: 1; }
                .sc-sidebar-icon.active { border-top-color: var(--term-warn) !important; color: var(--term-warn) !important; }
                .sc-sidebar-icon:hover::after { display: none; }

                /* 5. PANEL NỘI DUNG: Khi mở sẽ ĐẨY biểu đồ lên (Tách biệt hoàn toàn) */
                .sc-panel-content { 
                    width: 100% !important; 
                    height: 45vh !important; /* Độ cao khi mở bảng */
                    min-height: 0 !important; 
                    transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important; 
                    border-top: 1px solid var(--term-border);
                    background: var(--term-bg);
                    display: flex !important;
                    flex-shrink: 0 !important;
                }

                /* Khi đóng bảng: Co về 0, Chart sẽ tự động giãn ra chiếm 100% */
                .sc-panel-content.collapsed { 
                    height: 0px !important; 
                    border-top: none !important;
                    overflow: hidden !important;
                }
                
                .sc-tab-content { flex: 1 !important; overflow-y: auto !important; }
                
                .sc-tab-content { flex: 1 1 auto !important; min-height: 0 !important; overflow-y: auto !important; overflow-x: hidden !important; overscroll-behavior: contain !important; -webkit-overflow-scrolling: touch !important; padding-bottom: 30px !important; }
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

    const formatNumK = (num) => {
        if(num >= 1000000000) return (num/1000000000).toFixed(2) + 'B'; 
        if(num >= 1000000) return (num/1000000).toFixed(2) + 'M'; 
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
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; overflow: hidden;">
                    <img id="sc-coin-logo" style="width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;" src="assets/tokens/default.png" onerror="this.src='assets/tokens/default.png'">
                    <span id="sc-coin-symbol" style="font-size: 14px; font-weight: 800; color: #eaecef; font-family: var(--font-num); white-space: nowrap; flex-shrink: 0;">---/USDT</span>
                    <span id="sc-coin-name" style="background: rgba(255,255,255,0.05); color: #848e9c; font-size: 10px; padding: 3px 6px; border-radius: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">---</span>
                    <span id="sc-algo-limit" style="background: rgba(14,203,129,0.1); color: #0ecb81; font-size: 10px; font-weight: 800; padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(14,203,129,0.3); white-space: nowrap; flex-shrink: 0;">ALGO: N/A</span>
                </div>
                <button style="background: transparent; border: none; color: #848e9c; font-size: 18px; cursor: pointer; flex-shrink: 0;" onclick="window.closeProChart()">✕</button>
            </div>

            <div class="sc-body">
                <div class="sc-chart-area">
                    <div class="sc-stats-row">
                        <div class="sc-price-box">
                            <div id="sc-live-price" style="font-size: 28px; font-weight: 700; color: #00F0FF; line-height: 1; font-family: var(--font-num); text-shadow: 0 0 10px rgba(0,240,255,0.2);">$--</div>
                            <div id="sc-change-24h" style="font-size: 14px; font-weight: 600; font-family: var(--font-num); color: #00F0FF;">--%</div>
                        </div>
                        
                        <div class="sc-metrics-compact">
                            <div class="sc-mc-item"><span>DAILY VOL</span><strong id="sc-top-vol">$--</strong></div>
                            <div class="sc-mc-item"><span>24H VOL</span><strong id="sc-top-vol-24h">$--</strong></div>
                            <div class="sc-mc-item"><span>LIQ</span><strong id="sc-top-liq">$--</strong></div>
                            <div class="sc-mc-item"><span>MCAP</span><strong id="sc-top-mc">$--</strong></div>
                            <div class="sc-mc-item"><span>FDV</span><strong id="sc-top-fdv">$--</strong></div> 
                            <div class="sc-mc-item"><span>HOLD</span><strong id="sc-top-hold">--</strong></div>
                            <div class="sc-mc-item"><span>TXs</span><strong id="sc-top-tx">--</strong></div>
                        </div>
                    </div>
                    
                    <div class="sc-toolbar" style="display:flex; gap:4px; padding:6px 15px; background:#1e2329; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center; flex-wrap:wrap;">
                        <div style="display:flex; gap:4px; align-items:center;">
                            <button class="sc-time-btn" onclick="window.changeChartInterval('tick', this)">Tick</button>
                            <span style="color:#2b3139; margin:0 2px;">|</span>
                            <button class="sc-time-btn" onclick="window.changeChartInterval('1s', this)">1s</button>
                            <button class="sc-time-btn" onclick="window.changeChartInterval('1m', this)">1m</button>
                            <button class="sc-time-btn" onclick="window.changeChartInterval('5m', this)">5m</button>
                            <button class="sc-time-btn" onclick="window.changeChartInterval('15m', this)">15m</button>
                            <button class="sc-time-btn" onclick="window.changeChartInterval('1h', this)">1h</button>
                            <button class="sc-time-btn" onclick="window.changeChartInterval('4h', this)">4h</button>
                            <button class="sc-time-btn active" onclick="window.changeChartInterval('1d', this)">1d</button>
                        </div>
                        
                        <div style="margin-left: auto; display:flex; align-items:center; gap:4px; font-family:var(--font-num); flex-wrap: wrap; justify-content: flex-end;">
                            
                            <div style="display:flex; gap:6px; align-items:center; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
    <div class="sc-filter-wrapper">
        <button class="sc-filter-btn" id="sc-filter-btn" onclick="window.toggleMarkerFilterMenu(event)" title="Lọc Marker">
            <i class="fas fa-filter"></i> 
            <i class="fas fa-chevron-down" style="font-size: 9px; margin-left: 2px; opacity: 0.8;"></i>
        </button>
        <div class="sc-filter-menu" id="sc-filter-menu">
            <div class="marker-filter-item">
                <input type="checkbox" class="marker-filter-cb" id="mf-whale" value="whale" checked onchange="window.applyFishFilter()">
                <label for="mf-whale">🐋 Cá Voi</label>
            </div>
            <div class="marker-filter-item">
                <input type="checkbox" class="marker-filter-cb" id="mf-shark" value="shark" checked onchange="window.applyFishFilter()">
                <label for="mf-shark">🦈 Cá Mập</label>
            </div>
            <div class="marker-filter-item">
                <input type="checkbox" class="marker-filter-cb" id="mf-dolphin" value="dolphin" checked onchange="window.applyFishFilter()">
                <label for="mf-dolphin">🐬 Cá Heo</label>
            </div>
            <div class="marker-filter-item">
                <input type="checkbox" class="marker-filter-cb" id="mf-bot" value="bot" checked onchange="window.applyFishFilter()">
                <label for="mf-bot">🤖 Bot</label>
            </div>
            <div class="marker-filter-item">
                <input type="checkbox" class="marker-filter-cb" id="mf-liq" value="liq" checked onchange="window.applyFishFilter()">
                <label for="mf-liq">💥 Thanh Lý</label>
            </div>
        </div>
    </div>
</div>

                            <div style="display:flex; gap:6px; font-size:11px; font-weight:700; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
                                <span title="Cá Voi" style="color:#cb55e3; display:flex; gap:2px; align-items:center;">🐋 <span id="sc-stat-whale">0</span></span>
                                <span title="Cá Mập" style="color:#eaecef; display:flex; gap:2px; align-items:center;">🦈 <span id="sc-stat-shark">0</span></span>
                                <span title="Cá Heo" style="color:#eaecef; display:flex; gap:2px; align-items:center;">🐬 <span id="sc-stat-dolphin">0</span></span>
                                <span title="Sweep" style="color:#2af592; display:flex; gap:2px; align-items:center;">🤖 <span id="sc-stat-sweep">0</span></span>
                            </div>

                            

                        </div>
                    </div>
                    
                    <div id="sc-chart-container" style="flex:1; position: relative; overflow: hidden;">
                        <div style="position: absolute; bottom: 25px; left: 15px; z-index: 2; font-family: var(--font-main); font-weight: 800; font-size: 20px; color: rgba(255,255,255,0.06); pointer-events: none; letter-spacing: 2px;">WAVE ALPHA</div>
                        <div id="sc-custom-tooltip" style="position: absolute; top: 10px; left: 15px; display: flex; flex-wrap: wrap; gap: 12px; align-items: baseline; color: #848e9c; font-size: 12px; font-family: var(--font-num); font-weight: 600; pointer-events: none; z-index: 10; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
                            <span id="tp-symbol" style="color:#eaecef; font-weight:800; font-size:15px;">---</span>
                            <span id="tp-o-wrap">O <span id="tp-o" style="color:#eaecef;">--</span></span>
                            <span id="tp-h-wrap">H <span id="tp-h" style="color:#eaecef;">--</span></span>
                            <span id="tp-l-wrap">L <span id="tp-l" style="color:#eaecef;">--</span></span>
                            <span id="tp-c-wrap">C <span id="tp-c" style="color:#eaecef;">--</span></span>
                            <span>Vol <span id="tp-v" style="color:#eaecef;">--</span></span>
                        </div>
                    </div>
                </div> 

                <div class="sc-right-container" id="sc-right-container">
                    <div class="sc-panel-content" id="sc-panel-content">
                        <div id="tab-watchlist" class="sc-tab-content" style="padding: 0; display: none;">
                            <div class="sc-panel-title" style="padding: 12px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #eaecef; font-weight: 700; flex-shrink: 0; position: sticky; top: 0; z-index: 10; width: 100%; box-sizing: border-box;">
                                <div style="display:flex; align-items:center;"><i class="fas fa-list" style="color:#F0B90B; margin-right: 6px; font-size: 13px;"></i> WATCHLIST</div>
                                <input type="text" id="wl-search" placeholder="Tìm token..." onkeyup="window.renderProWatchlist(this.value)" autocomplete="off" style="background:rgba(255,255,255,0.05); border:1px solid #2b3139; color:#eaecef; font-size:10px; padding:3px 8px; border-radius:2px; width:120px; outline:none; font-family:var(--font-main);">
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9px; color:#5e6673; padding: 6px 15px; font-weight:800; background: #0B0E11; border-top: 1px solid #1A1F26; border-bottom: 1px solid #1A1F26; letter-spacing: 0.5px;">
                                <span style="width:45%">TOKEN</span><span style="width:30%; text-align:right;">GIÁ</span><span style="width:25%; text-align:right;">24H%</span>
                            </div>
                            <div id="sc-watchlist-body" style="flex:1; overflow-y:auto; background: var(--term-bg);"></div>
                        </div>

                        <div id="tab-trades" class="sc-tab-content active" style="padding: 0; display: flex;">
                            <div class="sc-panel-title" style="padding: 12px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #eaecef; font-weight: 700; flex-shrink: 0; position: sticky; top: 0; z-index: 10; width: 100%; box-sizing: border-box;">
                                <div style="display:flex; align-items:center;"><i class="fas fa-bolt" style="color:#00F0FF; margin-right: 6px; font-size: 13px;"></i> LIVE TRADES</div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:10px; color:#5e6673; padding: 6px 15px; font-weight:700; background: #0B0E11;">
                                <span>GIÁ</span><span>KL ($)</span><span>TIME</span>
                            </div>
                            <div id="sc-live-trades" style="flex:1; overflow-y:auto; padding: 0 10px; font-size:11.5px; font-family:var(--font-num);">
                                <div style="text-align:center; margin-top:20px; color:#5e6673; font-style:italic;">Connecting to Dex...</div>
                            </div>
                        </div>

                        <div id="tab-info" class="sc-tab-content" style="padding: 0; display: none; flex-direction: column; height: 100%; overflow-y: auto;">
                            <div class="sc-panel-title" style="padding: 12px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #eaecef; font-weight: 700; flex-shrink: 0; position: sticky; top: 0; z-index: 10; width: 100%; box-sizing: border-box;">
                                <div style="display:flex; align-items:center;"><i class="fas fa-wave-square" style="color:var(--term-warn); margin-right: 6px; font-size: 13px;"></i> ALPHA FLOW</div>
                            </div>
                            
                            <div id="quant-command-center" style="display: flex; flex-direction: column; padding: 10px;">
                                <div class="term-widget" style="border-left: 2px solid #9945FF; padding: 6px 8px;">
                                    <div class="term-w-title" style="margin-bottom: 8px; color: #9945FF;">
                                        <i class="fas fa-layer-group"></i> MULTI-HORIZON VERDICT
                                    </div>
                                    <div class="term-row" style="margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;">
                                        <span class="term-lbl" style="color:#00F0FF; font-weight: 800;">HFT (Micro)</span>
                                        <span id="verdict-hft" class="term-val" style="font-size: 10px; background: rgba(0, 240, 255, 0.1); padding: 2px 4px; border-radius: 2px; color: #00F0FF;">⚡ ĐANG QUÉT TICK...</span>
                                    </div>
                                    <div class="term-row" style="margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;">
                                        <span class="term-lbl" style="color:#F0B90B; font-weight: 800;">MFT (Meso)</span>
                                        <span id="verdict-mft" class="term-val" style="font-size: 10px; background: rgba(240, 185, 11, 0.1); padding: 2px 4px; border-radius: 2px; color: #F0B90B;">⏳ ĐANG PHÂN TÍCH...</span>
                                    </div>
                                    <div class="term-row" style="margin-bottom: 0;">
                                        <span class="term-lbl" style="color:#cb55e3; font-weight: 800;">LFT (Macro)</span>
                                        <span id="verdict-lft" class="term-val" style="font-size: 10px; background: rgba(203, 85, 227, 0.1); padding: 2px 4px; border-radius: 2px; color: #cb55e3;">🔭 CHỜ DỮ LIỆU...</span>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; margin-bottom: 6px;">
                                    <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%; gap: 6px;">
                                        <div class="term-widget" id="cc-nf-box" style="margin-bottom: 0; border-left: 2px solid var(--term-up); flex: 1; display: flex; flex-direction: column; justify-content: center;">
                                            <div class="term-w-title">REALTIME FLOW</div>
                                            <div id="cc-net-flow" class="term-val" style="font-size: 14px; color: var(--term-up);">+$0</div>
                                        </div>
                                        <div class="term-widget" id="cc-algo-box" style="margin-bottom: 0; border-left: 2px solid var(--term-dim); flex: 1; display: flex; flex-direction: column; justify-content: center;">
                                            <div class="term-w-title">ALGO <span id="cc-speed" style="color:var(--term-text); text-transform:none;">$0/s</span></div>
                                            <div id="cc-algo-status" style="font-size: 9px; font-weight: 800; color: var(--term-dim); margin-bottom:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🤖 TĨNH LẶNG (XÁM)</div>
                                            <div style="display: flex; height: 3px; border-radius: 1px; overflow: hidden; background: var(--term-border); position: relative;">
                                                <div id="cc-ofi-bar-sell" style="height: 100%; width: 50%; background: var(--term-down); transition: 0.2s linear;"></div>
                                                <div id="cc-ofi-bar-buy" style="height: 100%; width: 50%; background: var(--term-up); transition: 0.2s linear;"></div>
                                                <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #000; z-index: 2;"></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="term-widget" style="margin-bottom: 0; border-left: 2px solid #00F0FF; height: 100%; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
                                        <div class="term-w-title" style="color: #00F0FF; margin-bottom: auto;" title="Tổng khối lượng và xu hướng của nến hiện tại">
                                            <i class="fas fa-chart-bar"></i> CANDLE VOLUME
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1; justify-content: flex-end;">
                                            <div class="term-row"><span class="term-lbl">Nến 1 Phút</span><span id="cc-cex-nf-1m" class="term-val">...</span></div>
                                            <div class="term-row"><span class="term-lbl">Nến 5 Phút</span><span id="cc-cex-nf-5m" class="term-val">...</span></div>
                                            <div class="term-row"><span class="term-lbl">Nến 15 Phút</span><span id="cc-cex-nf-15m" class="term-val">...</span></div>
                                            <div class="term-row" style="border-top: 1px solid var(--term-border); padding-top: 4px; margin-top: 2px;">
                                                <span class="term-lbl">Nến 1 Giờ</span><span id="cc-cex-nf-1h" class="term-val">...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>  

                                <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; margin-bottom: 6px;">
                                    <div class="term-widget" style="margin-bottom: 0;">
                                        <div class="term-w-title">DÒNG TIỀN (60s)</div>
                                        <div class="term-row"><span class="term-lbl">Avg Ticket</span><span id="cc-avg-ticket" class="term-val">🦐 $0</span></div>
                                        <div class="term-row"><span class="term-lbl">VWAP</span><span id="cc-vwap-trend" class="term-val">0.00%</span></div>
                                    </div>
                                    <div class="term-widget" style="margin-bottom: 0;">
                                        <div class="term-w-title">RỦI RO THANH KHOẢN</div>
                                        <div class="term-row"><span class="term-lbl">Spread</span><span id="cc-spread-val" class="term-val" style="color:var(--term-up);">0.00%</span></div>
                                        <div style="height:2px; background:var(--term-border); margin: 2px 0 4px 0;"><div id="cc-spread-meter" style="height:100%; width:10%; background:var(--term-up);"></div></div>
                                        <div class="term-row"><span class="term-lbl">Drop (5m)</span><span id="cc-drop-val" class="term-val">0.00%</span></div>
                                    </div>
                                </div>

                                <div class="term-widget">
                                    <div class="term-w-title">WHALES & SHARKS <span id="cc-whale-ratio" style="color: var(--term-text);">--% BUY</span></div>
                                    <div style="display: flex; height: 4px; border-radius: 1px; overflow: hidden; background: var(--term-border); margin-bottom: 4px;">
                                        <div id="cc-whale-bar-buy" style="height: 100%; width: 50%; background: var(--term-up); transition: 0.2s;"></div>
                                        <div id="cc-whale-bar-sell" style="height: 100%; width: 50%; background: var(--term-down); transition: 0.2s;"></div>
                                    </div>
                                    <div class="term-row" style="font-size: 10px; color: var(--term-dim);">
                                        <span id="cc-whale-vol-buy">B: $0</span>
                                        <span id="cc-whale-vol-sell">S: $0</span>
                                    </div>
                                </div>

                                <div class="term-w-title" style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center; overflow: visible !important;">
                                    <span style="display:flex; align-items:center; gap:4px;">
                                        SNIPER TAPE 
                                        <div class="sc-filter-wrapper">
                                            <button class="sc-filter-btn" id="tape-filter-btn" onclick="window.toggleTapeFilterMenu(event)" style="padding: 2px 6px; font-size: 9px; background: rgba(255,255,255,0.05);">
                                                <i class="fas fa-filter"></i> <i class="fas fa-chevron-down" style="font-size: 8px;"></i>
                                            </button>
                                            <div class="sc-filter-menu" id="tape-filter-menu" style="top: calc(100% + 5px); left: 0; right: auto; min-width: 155px;">
                                                <div class="marker-filter-item">
                                                    <input type="checkbox" class="tape-filter-cb" id="tf-whale" value="whale" checked onchange="window.filterSniperTape()">
                                                    <label for="tf-whale">🐋 Cá Voi</label>
                                                </div>
                                                <div class="marker-filter-item">
                                                    <input type="checkbox" class="tape-filter-cb" id="tf-shark" value="shark" checked onchange="window.filterSniperTape()">
                                                    <label for="tf-shark">🦈 Cá Mập</label>
                                                </div>
                                                <div class="marker-filter-item">
                                                    <input type="checkbox" class="tape-filter-cb" id="tf-dolphin" value="dolphin" checked onchange="window.filterSniperTape()">
                                                    <label for="tf-dolphin">🐬 Cá Heo</label>
                                                </div>
                                                <div class="marker-filter-item">
                                                    <input type="checkbox" class="tape-filter-cb" id="tf-bot" value="bot" checked onchange="window.filterSniperTape()">
                                                    <label for="tf-bot">🤖 Bot / Thuật Toán</label>
                                                </div>
                                                <div class="marker-filter-item">
                                                    <input type="checkbox" class="tape-filter-cb" id="tf-liq" value="liq" checked onchange="window.filterSniperTape()">
                                                    <label for="tf-liq">💥 Thanh Lý</label>
                                                </div>
                                            </div>
                                        </div>
                                        <i id="cc-sound-icon" class="fas fa-volume-up" style="color:#0ECB81; cursor:pointer; font-size:11px; transition:0.2s; margin-left: 2px;" onclick="window.toggleProSound()" title="Bật/Tắt Âm Cảnh Báo"></i>
                                    </span>
                                    <span style="display:flex; width: 55%; font-size: 8px; color: var(--term-dim); justify-content: flex-end;">
                                        <span style="width: 65%; text-align: center;">SIZE & GIÁ</span>
                                        <span style="width: 35%; text-align: right;">TIME</span>
                                    </span>
                                </div>
                                <div id="cc-sniper-tape" style="background: var(--term-bg); border: 1px solid var(--term-border); border-radius: 2px; padding: 4px; height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px;">
                                    <div style="font-size: 11px; color: var(--term-dim); text-align: center; margin-top: 50px; font-style: italic;">Đang quét...</div>
                                </div>
                                
                            </div>
                        </div>
                    </div>

                    <div class="sc-icon-sidebar">
                        <button class="sc-sidebar-icon" data-title="Watchlist" onclick="window.toggleProSidePanel('watchlist', this)"><i class="fas fa-list"></i></button>
                        <button class="sc-sidebar-icon active" data-title="Live Trades" onclick="window.toggleProSidePanel('trades', this)"><i class="fas fa-bolt"></i></button>
                        <button class="sc-sidebar-icon" data-title="Alpha Flow" onclick="window.toggleProSidePanel('info', this)"><i class="fas fa-wave-square"></i></button>
                        <button class="sc-sidebar-icon" data-title="On-chain Dex" onclick="window.toggleProSidePanel('smartmoney', this)"><i class="fas fa-microscope"></i></button>
                        <button class="sc-sidebar-icon" data-title="Future Radar" onclick="window.toggleProSidePanel('futures', this)"><i class="fas fa-fire"></i></button>
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
        const res = await fetch(DATA_URL + '?t=' + Date.now()); 
        if (!res.ok) return;
        const json = await res.json();
        const rawList = json.data || json.tokens || []; 
        window.allTokens = rawList.map(item => unminifyToken(item));

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
    if (typeof window.renderProWatchlist === 'function') window.renderProWatchlist();
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
  "st": "status", "p": "price", "c": "change_24h", "mp": "mul_point", "mc": "market_cap", "f": "fdv", "l": "liquidity", "v": "volume", 
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

window.pendingMarketUpdates = {};
window.isMarketUpdateScheduled = false;

window.updateAlphaMarketUI = function(serverData) {
    if (document.getElementById('alpha-market-view') && document.getElementById('alpha-market-view').style.display === 'none') return;
    if (serverData['_STATS']) window.MARKET_VOL_HISTORY = serverData['_STATS'];

    // 1. GOM DATA: Nhét tất cả dữ liệu WebSocket đến vào bộ đệm thay vì render ngay
    Object.keys(serverData).forEach(key => {
        if (key !== '_STATS') {
            window.pendingMarketUpdates[key] = { ...(window.pendingMarketUpdates[key] || {}), ...serverData[key] };
        }
    });

    // 2. KÍCH HOẠT NHỊP 3 GIÂY: Nếu chưa có lịch render, hẹn 3s sau chạy
    if (!window.isMarketUpdateScheduled) {
        window.isMarketUpdateScheduled = true;
        setTimeout(() => {
            window.applyMarketUpdatesThrottled();
            window.isMarketUpdateScheduled = false;
        }, 3000); // <-- 3000ms là 3 giây
    }
};

window.applyMarketUpdatesThrottled = function() {
    let updates = window.pendingMarketUpdates;
    window.pendingMarketUpdates = {}; // Xả bộ đệm
    
    let hasUpdates = false;
    let maxVolDaily = Math.max(...window.allTokens.map(t => {
        const isStock = t.stockState === 1 || t.stockState === true || (t.symbol && t.symbol.endsWith('on'));
        return isStock ? 0 : (t.volume?.daily_total || 0);
    })) || 1;

    Object.keys(updates).forEach(key => {
        let liveItem = updates[key];
        let tokenKey = key.replace('ALPHA_', ''); 
        if (liveItem.alphaId) tokenKey = liveItem.alphaId.replace('ALPHA_', '');
        else if (!key.startsWith('ALPHA_')) tokenKey = liveItem.symbol || key;

        let targetToken = window.allTokens.find(t => (t.alphaId && t.alphaId.replace('ALPHA_','') === tokenKey) || (t.id && t.id.replace('ALPHA_','') === tokenKey) || t.symbol === tokenKey);

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

                // --- BẮT ĐẦU PATCH: HIỆU ỨNG CHỚP GIÁ TRÊN MOBILE ---
                if (window.innerWidth <= 991) {
                    let livePriceChartEl = document.getElementById('sc-live-price');
                    if (livePriceChartEl && priceEl.id.includes(window.currentChartToken?.symbol || 'XXX')) {
                        livePriceChartEl.classList.remove('price-flash-up', 'price-flash-down');
                        void livePriceChartEl.offsetWidth; // Ép trình duyệt reflow để kích hoạt lại keyframes
                        livePriceChartEl.classList.add(isUp ? 'price-flash-up' : 'price-flash-down');
                    }
                }
                // --- KẾT THÚC PATCH ---

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
            barEl.style.width = `${Math.min(100, Math.max(0, volPct))}%`;
        }
    });

    if (hasUpdates) {
        // 💡 VÁ LỖI: Nếu Chart (Overlay) đang mở và che mất màn hình chính thì BỎ QUA việc vẽ lại HUD
        const chartOverlay = document.getElementById('super-chart-overlay');
        const isChartActive = chartOverlay && chartOverlay.classList.contains('active');
        
        if (!isChartActive) {
            const freshStats = calculateMarketStats(window.allTokens);
            renderMarketHUD(freshStats); 
        }
        
        updateSummary();
        // ...
        if (typeof window.renderProWatchlist === 'function') window.renderProWatchlist(); 
    }
};

// =====================================================================
// KHU VỰC RADAR SMART MONEY & HỆ THỐNG GỌI MỞ BẢNG CHART MỚI
// =====================================================================

function formatCompactUSD(num) {
    if (num === 0) return '0';
    let absNum = Math.abs(num);
    if (absNum >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (absNum >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (absNum >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function injectSmartMoneyTab() {
    const sidePanel = document.getElementById('sc-panel-content');
    if (!sidePanel || document.getElementById('tab-smartmoney')) return;

    const newTabContent = document.createElement('div');
    newTabContent.id = 'tab-smartmoney';
    newTabContent.className = 'sc-tab-content';
    newTabContent.style.cssText = 'padding: 0; display: none; flex-direction: column; background: var(--term-bg);';
    
    newTabContent.innerHTML = `
        <div class="sc-panel-title" style="padding: 12px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #eaecef; font-weight: 700; flex-shrink: 0; position: sticky; top: 0; z-index: 10; width: 100%; box-sizing: border-box;">
            <div style="display:flex; align-items:center;"><i class="fas fa-microscope" style="color:var(--term-warn); margin-right: 6px; font-size: 13px;"></i> ON-CHAIN DEX</div>
        </div>
        
        <div id="sm-scroll-area" style="flex: 1; overflow-y: auto; padding: 10px; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;">
            
            <div class="term-widget" style="border-left: 2px solid #F6465D;">
                <div class="term-w-title">RỦI RO HỆ THỐNG & TOKENOMICS</div>
                <div class="term-row" style="margin-bottom: 6px;">
                    <span class="term-lbl">Ví Top 10 Hold:</span>
                    <div style="display:flex; align-items:center; gap: 6px;">
                        <span id="sm-top10-pct" class="term-val">--%</span>
                        <span id="sm-top10-badge" style="font-size:8.5px; font-weight:700; padding:2px 4px; border-radius:3px;">--</span>
                    </div>
                </div>
                <div class="term-row" style="margin-bottom: 6px;">
                    <span class="term-lbl">Áp lực xả (Dump CEX):</span>
                    <div style="display:flex; align-items:center; gap: 6px;">
                        <span id="sm-bn-avg-buy" class="term-val">$--</span>
                        <span id="sm-dump-risk-badge" style="font-size:8.5px; font-weight:700; padding:2px 4px; border-radius:3px;">--</span>
                    </div>
                </div>
                <div class="term-row" style="margin-bottom: 6px;">
                    <span class="term-lbl">Mở khóa (MC/FDV):</span>
                    <div style="display:flex; align-items:center; gap: 6px;">
                        <span id="sm-unlock-pct" class="term-val">--%</span>
                        <span id="sm-unlock-badge" style="font-size:8.5px; font-weight:700; padding:2px 4px; border-radius:3px;">--</span>
                    </div>
                </div>
                <div class="term-row">
                    <span class="term-lbl">Sức đỡ Thanh khoản:</span>
                    <div style="display:flex; align-items:center; gap: 6px;">
                        <span id="sm-liq-ratio" class="term-val">--%</span>
                        <span id="sm-liq-badge" style="font-size:8.5px; font-weight:700; padding:2px 4px; border-radius:3px;">--</span>
                    </div>
                </div>
            </div>

            <div class="term-w-title" style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>💎 TỔ HỢP VÍ (ON-CHAIN)</span>
                <span id="sm-verdict-badge" style="font-size: 8.5px; font-weight: 800; padding: 2px 4px; border-radius: 3px; background: transparent; border: 1px solid #444;">-- Đang quét --</span>
            </div>
            
            <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; margin-bottom: 6px;">
                <div class="term-widget" style="margin-bottom: 0; border-left: 2px solid #0ECB81; padding: 6px;">
                    <div class="term-w-title">Smart Money</div>
                    <div class="term-row"><span class="term-lbl" id="sm-cnt-smart">0 ví</span><span class="term-val" id="sm-pct-smart" style="color: #0ECB81;">--%</span></div>
                </div>
                <div class="term-widget" style="margin-bottom: 0; border-left: 2px solid #F0B90B; padding: 6px;">
                    <div class="term-w-title">KOLs / Pro</div>
                    <div class="term-row"><span class="term-lbl" id="sm-cnt-kol">0 ví</span><span class="term-val" id="sm-pct-kol" style="color: #F0B90B;">--%</span></div>
                </div>
                <div class="term-widget" style="margin-bottom: 0; border-left: 2px solid #848e9c; padding: 6px;">
                    <div class="term-w-title">New Wallets</div>
                    <div class="term-row"><span class="term-lbl" id="sm-cnt-new">0 ví</span><span class="term-val" id="sm-pct-new">--%</span></div>
                </div>
                <div class="term-widget" style="margin-bottom: 0; border-left: 2px solid #FF007F; padding: 6px;">
                    <div class="term-w-title">Sniper/Bundler</div>
                    <div class="term-row"><span class="term-lbl" id="sm-cnt-sniper">0 ví</span><span class="term-val" id="sm-pct-sniper" style="color: #FF007F;">--%</span></div>
                </div>
            </div>

            <div class="term-widget" style="border-left: 2px solid #3B82F6; margin-top: 4px;" id="sm-dex-widget">
                <div class="term-w-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span>🏦 DÒNG TIỀN BINANCE DEX</span>
                    <span id="sm-bn-traders" style="color:#00F0FF; font-size: 8.5px; font-family:var(--font-num); font-weight:700;">-- Traders | -- KYC</span>
                </div>
                
                <div style="display: flex; gap: 4px; margin-bottom: 8px;" id="sm-dex-tabs">
                    <button class="sc-time-btn" onclick="window.switchDexTab('5m', this)">5M</button>
                    <button class="sc-time-btn" onclick="window.switchDexTab('1h', this)">1H</button>
                    <button class="sc-time-btn" onclick="window.switchDexTab('4h', this)">4H</button>
                    <button class="sc-time-btn active" onclick="window.switchDexTab('24h', this)">24H</button>
                </div>

                <div class="term-row" style="margin-bottom: 4px;">
                    <span class="term-lbl">Price Trend (<span id="sm-dex-tf-lbl">24H</span>)</span>
                    <span id="sm-dex-trend" class="term-val">--%</span>
                </div>
                
                <div class="term-w-title" style="margin-top: 6px; margin-bottom: 4px; font-size: 8px;">📊 VOLUME BREAKDOWN (BINANCE VS OTHERS)</div>
                <div class="term-row" style="margin-bottom: 2px;">
                    <span class="term-lbl">Total DEX Vol</span>
                    <span id="sm-dex-vol-total" class="term-val">$--</span>
                </div>
                <div style="display:flex; height:5px; border-radius:2px; overflow:hidden; background:var(--term-border); margin-bottom: 4px;">
                    <div id="sm-dex-bar-binance" style="height:100%; width:0%; background:#F0B90B; transition:0.3s;" title="Binance Vol"></div>
                    <div id="sm-dex-bar-other" style="height:100%; width:0%; background:#9945FF; transition:0.3s;" title="Other DEX Vol"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 6px; font-family: var(--font-num); font-weight: 700;">
                    <span style="color:#F0B90B;">🔶 Bin: <span id="sm-dex-vol-binance">$--</span></span>
                    <span style="color:#9945FF;">🟣 Other: <span id="sm-dex-vol-other">$--</span></span>
                </div>

                <div class="term-row" style="margin-bottom: 8px; border-top: 1px dashed var(--term-border); padding-top: 6px;">
                    <span class="term-lbl">Net Flow (Binance)</span>
                    <span id="sm-dex-netflow" class="term-val">$--</span>
                </div>

                <div class="term-w-title" style="margin-bottom: 4px; font-size: 8px;">⚖️ CÁN CÂN MUA / BÁN (BINANCE)</div>
                <div style="display:flex; height:5px; border-radius:2px; overflow:hidden; background:var(--term-border); margin-bottom: 4px;">
                    <div id="sm-dex-bar-buy" style="height:100%; width:50%; background:var(--term-up); transition:0.3s;"></div>
                    <div id="sm-dex-bar-sell" style="height:100%; width:50%; background:var(--term-down); transition:0.3s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 2px; font-family: var(--font-num); font-weight: 700;">
                    <span style="color:var(--term-up);">🟢 <span id="sm-dex-buy-cnt">--</span> Lệnh / <span id="sm-dex-buy-vol">$--</span></span>
                    <span style="color:var(--term-down);">🔴 <span id="sm-dex-sell-cnt">--</span> Lệnh / <span id="sm-dex-sell-vol">$--</span></span>
                </div>
            </div>

            <div class="term-w-title" style="margin-top: 8px; margin-bottom: 4px;">⚖️ ĐỘNG LƯỢNG MUA/BÁN (CVD)</div>
            
            <div class="term-widget" style="margin-bottom: 6px; padding: 6px 8px;">
                <div class="term-w-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 8.5px;">Khung 1 Giờ</span>
                    <span id="sm-tag-1h" style="font-weight:bold; padding:2px 4px; border-radius:3px; font-size: 8px;">--</span>
                </div>
                <div style="display:flex; height:4px; border-radius:2px; overflow:hidden; background:var(--term-border); margin: 4px 0;">
                    <div id="sm-bar-1h-buy" style="height:100%; width:50%; background:var(--term-up); transition:0.3s;"></div>
                    <div id="sm-bar-1h-sell" style="height:100%; width:50%; background:var(--term-down); transition:0.3s;"></div>
                </div>
                <div class="term-row" style="margin-bottom: 0;"><span id="sm-txt-1h-buy" style="color:var(--term-up); font-size: 9px;">--%</span><span id="sm-txt-1h-sell" style="color:var(--term-down); font-size: 9px;">--%</span></div>
            </div>

            <div class="term-widget" style="margin-bottom: 0; padding: 6px 8px;">
                <div class="term-w-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 8.5px;">Khung 4 Giờ</span>
                    <span id="sm-tag-4h" style="font-weight:bold; padding:2px 4px; border-radius:3px; font-size: 8px;">--</span>
                </div>
                <div style="display:flex; height:4px; border-radius:2px; overflow:hidden; background:var(--term-border); margin: 4px 0;">
                    <div id="sm-bar-4h-buy" style="height:100%; width:50%; background:var(--term-up); transition:0.3s;"></div>
                    <div id="sm-bar-4h-sell" style="height:100%; width:50%; background:var(--term-down); transition:0.3s;"></div>
                </div>
                <div class="term-row" style="margin-bottom: 0;"><span id="sm-txt-4h-buy" style="color:var(--term-up); font-size: 9px;">--%</span><span id="sm-txt-4h-sell" style="color:var(--term-down); font-size: 9px;">--%</span></div>
            </div>
             </div>
        </div> `;
    sidePanel.appendChild(newTabContent);
}

function injectFuturesTab() {
    const sidePanel = document.getElementById('sc-panel-content');
    if (!sidePanel || document.getElementById('tab-futures')) return;

    const newTabContent = document.createElement('div');
    newTabContent.id = 'tab-futures';
    newTabContent.className = 'sc-tab-content';
    newTabContent.style.cssText = 'padding: 0; display: none; flex-direction: column; background: var(--term-bg);';
    
    newTabContent.innerHTML = `
        <div class="sc-panel-title" style="padding: 12px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #eaecef; font-weight: 700; flex-shrink: 0; position: sticky; top: 0; z-index: 10; width: 100%; box-sizing: border-box;">
            <div style="display:flex; align-items:center; color:#9945FF;"><i class="fas fa-fire" style="margin-right: 6px; font-size: 13px;"></i> FUTURE RADAR</div>
            <span id="fut-live-status" style="font-size:9px; color:var(--term-warn);">⏳ Waiting...</span>
        </div>
        
        <div style="flex: 1; overflow-y: auto; padding: 10px;">
            
            <div class="term-widget" style="border-left: 2px solid #F0B90B; margin-bottom: 8px;">
                <div class="term-w-title"><i class="fas fa-burn"></i> SỨC NÓNG (MARKET HEAT)</div>
                <div class="term-row" style="margin-bottom: 6px;">
                    <span class="term-lbl">Open Interest (OI)</span>
                    <span id="fut-oi-val" class="term-val" style="font-size: 14px; color: #F0B90B;">$--</span>
                </div>
                <div class="term-row">
                    <span class="term-lbl" id="fut-funding-lbl">Funding Rate</span>
                    <span id="fut-funding-val" class="term-val">--%</span>
                </div>
            </div>

            <div class="term-widget" style="border-left: 2px solid #9945FF; margin-bottom: 8px;">
                <div class="term-w-title" style="display:flex; justify-content:space-between;">
                    <span><i class="fas fa-balance-scale"></i> VỊ THẾ (LONG/SHORT)</span>
                    <span title="Tỷ lệ 5 Phút">5M</span>
                </div>
                
                <div style="margin-bottom: 8px;">
                    <div class="term-row" style="margin-bottom: 2px;">
                        <span class="term-lbl" style="color: #848e9c;">Retail (Theo số người)</span>
                        <span id="fut-acc-ratio" class="term-val">--% L / --% S</span>
                    </div>
                    <div style="display:flex; height:5px; border-radius:2px; overflow:hidden; background:var(--term-border);">
                        <div id="fut-acc-long" style="height:100%; width:50%; background:var(--term-up); transition:0.5s;"></div>
                        <div id="fut-acc-short" style="height:100%; width:50%; background:var(--term-down); transition:0.5s;"></div>
                    </div>
                </div>

                <div>
                    <div class="term-row" style="margin-bottom: 2px;">
                        <span class="term-lbl" style="color: #EAECEF; font-weight:bold;">Whales (Theo lượng tiền)</span>
                        <span id="fut-pos-ratio" class="term-val">--% L / --% S</span>
                    </div>
                    <div style="display:flex; height:5px; border-radius:2px; overflow:hidden; background:var(--term-border);">
                        <div id="fut-pos-long" style="height:100%; width:50%; background:var(--term-up); transition:0.5s;"></div>
                        <div id="fut-pos-short" style="height:100%; width:50%; background:var(--term-down); transition:0.5s;"></div>
                    </div>
                </div>
                <div id="fut-divergence-alert" style="margin-top: 8px; font-size: 9px; text-align: center; padding: 4px; border-radius: 3px; display: none;"></div>
            </div>

            <div class="term-widget" style="border-left: 2px solid #3B82F6; margin-bottom: 8px;">
                <div class="term-w-title"><i class="fas fa-gavel"></i> LỆNH THỊ TRƯỜNG (TAKER CVD)</div>
                <div style="display:flex; height:5px; border-radius:2px; overflow:hidden; background:var(--term-border); margin: 6px 0;">
                    <div id="fut-taker-buy-bar" style="height:100%; width:50%; background:var(--term-up); transition:0.5s;"></div>
                    <div id="fut-taker-sell-bar" style="height:100%; width:50%; background:var(--term-down); transition:0.5s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; font-family: var(--font-num); font-weight: 700;">
                    <span style="color: var(--term-up);">B: <span id="fut-taker-buy">$--</span></span>
                    <span style="color: var(--term-down);">S: <span id="fut-taker-sell">$--</span></span>
                </div>
            </div>

            <div class="term-widget" style="border-left: 2px solid #FF007F;">
                <div class="term-w-title"><i class="fas fa-skull-crossbones"></i> THANH LÝ & DỰ BÁO</div>
                <div class="term-row" style="margin-bottom: 4px;">
                    <span class="term-lbl">Long Bị Cháy (Liq L)</span>
                    <span id="fut-liq-long" class="term-val" style="color: #F6465D;">$0</span>
                </div>
                <div class="term-row" style="margin-bottom: 8px;">
                    <span class="term-lbl">Short Bị Cháy (Liq S)</span>
                    <span id="fut-liq-short" class="term-val" style="color: #00F0FF;">$0</span>
                </div>

                <div style="border-top: 1px dashed var(--term-border); padding-top: 8px; margin-bottom: 8px;">
                    <div class="term-w-title" style="font-size: 9px; margin-bottom: 4px;"><i class="fas fa-list-ul"></i> TAPE THANH LÝ (REALTIME)</div>
                    <div id="fut-liq-tape" style="height: 180px; overflow-y: auto; display: flex; flex-direction: column; background: #0b0e11; border: 1px solid var(--term-border); border-radius: 2px;">
                        <div style="font-size: 10px; color: #527c82; text-align: center; margin-top: 45px; font-style:italic;">Đang rình cá mập bị luộc...</div>
                    </div>
                </div>

                <div style="text-align: center; border-top: 1px dashed var(--term-border); padding-top: 8px;">
                    <span id="fut-ai-verdict" style="font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #848e9c;">⚖️ ĐANG PHÂN TÍCH...</span>
                </div>
            </div>

        </div>
    `;
    sidePanel.appendChild(newTabContent);
}

// Biến lưu trữ data hiện tại để chuyển tab không cần gọi lại API
window.currentSmartMoneyData = null; 

window.switchDexTab = function(tf, btn) {
    // 1. Đổi màu nút Tab đang được chọn
    const tabs = document.querySelectorAll('#sm-dex-tabs .sc-time-btn');
    tabs.forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');

    // 2. Render lại dữ liệu theo mốc thời gian mới
    window.renderBinanceDexTab(tf);
};

window.renderBinanceDexTab = function(tf) {
    const d = window.currentSmartMoneyData;
    if(!d) return;

    const safeSet = (id, val, color) => {
        let el = document.getElementById(id);
        if (el) { el.innerHTML = val; if (color) el.style.color = color; }
    };
    const fmtUsd = (val) => val && !isNaN(val) ? '$' + formatCompactUSD(parseFloat(val)) : '$0';
    
    // Cập nhật Nhãn thời gian
    let tfKey = tf === '24h' ? '24h' : (tf === '4h' ? '4h' : (tf === '1h' ? '1h' : '5m'));
    document.getElementById('sm-dex-tf-lbl').innerText = tf.toUpperCase();

    // 1. Trend Giá
    let trendVal = parseFloat(d[`percentChange${tfKey}`] || 0);
    let trendColor = trendVal >= 0 ? 'var(--term-up)' : 'var(--term-down)';
    let trendSign = trendVal >= 0 ? '+' : '';
    safeSet('sm-dex-trend', `${trendSign}${trendVal.toFixed(2)}%`, trendColor);

    // 2. VOLUME BREAKDOWN (Tổng DEX so với Binance DEX)
    let totalVol = parseFloat(d[`volume${tfKey}`] || 0); // Lấy tổng vol web3
    let binanceVol = parseFloat(d[`volume${tfKey}Binance`] || 0); // Lấy vol của riêng binance
    let otherVol = Math.max(0, totalVol - binanceVol); // Phần còn lại
    
    safeSet('sm-dex-vol-total', fmtUsd(totalVol));
    safeSet('sm-dex-vol-binance', fmtUsd(binanceVol));
    safeSet('sm-dex-vol-other', fmtUsd(otherVol));

    // Tính % chiều dài cho thanh Progress Bar
    let binancePct = totalVol > 0 ? (binanceVol / totalVol) * 100 : 0;
    let otherPct = totalVol > 0 ? (otherVol / totalVol) * 100 : 0;
    
    document.getElementById('sm-dex-bar-binance').style.width = binancePct + '%';
    document.getElementById('sm-dex-bar-other').style.width = otherPct + '%';

    // 3. Net Flow
    let netFlow = parseFloat(d[`volume${tfKey}NetBinance`] || 0);
    let netColor = netFlow >= 0 ? 'var(--term-up)' : 'var(--term-down)';
    let netSign = netFlow >= 0 ? '+' : '-';
    safeSet('sm-dex-netflow', `${netSign}${fmtUsd(Math.abs(netFlow))}`, netColor);

    // 4. Cán Cân Mua / Bán
    let buyVol = parseFloat(d[`volume${tfKey}BuyBinance`] || 0);
    let sellVol = parseFloat(d[`volume${tfKey}SellBinance`] || 0);
    let buyCnt = d[`count${tfKey}BuyBinance`] || 0;
    let sellCnt = d[`count${tfKey}SellBinance`] || 0;

    let totalBuySell = buyVol + sellVol;
    let buyPct = totalBuySell > 0 ? (buyVol / totalBuySell) * 100 : 50;
    let sellPct = totalBuySell > 0 ? (sellVol / totalBuySell) * 100 : 50;

    // Kéo thanh Progress Bar Mua/Bán
    document.getElementById('sm-dex-bar-buy').style.width = buyPct + '%';
    document.getElementById('sm-dex-bar-sell').style.width = sellPct + '%';

    // Đổ text số lượng
    safeSet('sm-dex-buy-cnt', buyCnt);
    safeSet('sm-dex-sell-cnt', sellCnt);
    safeSet('sm-dex-buy-vol', fmtUsd(buyVol));
    safeSet('sm-dex-sell-vol', fmtUsd(sellVol));
};

window.updateSmartMoneyRadar = function(apiData) {
    if (!apiData || !apiData.data) return;
    const d = apiData.data;

    const safeSet = (id, val, color) => {
        let el = document.getElementById(id);
        if (el) { el.innerHTML = val; if (color) el.style.color = color; }
    };

    const fmtUsd = (val) => val && !isNaN(val) ? '$' + formatCompactUSD(parseFloat(val)) : '$0';
    const fmtPrice = (val) => val && !isNaN(val) ? parseFloat(val).toPrecision(5) : '--';

    const fmtNetFlow = (val) => {
        let n = parseFloat(val || 0);
        if (isNaN(n) || n === 0) return '<span style="color:var(--term-dim)">$0</span>';
        let color = n >= 0 ? 'var(--term-up)' : 'var(--term-down)';
        let sign = n >= 0 ? '+' : '-';
        return `<span style="color:${color}">${sign}$${formatCompactUSD(Math.abs(n))}</span>`;
    };

    let t_chart = window.currentChartToken || {};

    let top10Pct = parseFloat(d.top10HoldersPercentage || 0);
    safeSet('sm-top10-pct', top10Pct.toFixed(1) + '%');
    let top10Badge = document.getElementById('sm-top10-badge');
    if (top10Badge) {
        if (top10Pct >= 80) {
            top10Badge.innerText = 'Thao túng cao';
            top10Badge.style.background = 'rgba(246, 70, 93, 0.2)'; top10Badge.style.color = '#F6465D';
        } else if (top10Pct >= 40) {
            top10Badge.innerText = 'Cảnh giác (CEX Hold)';
            top10Badge.style.background = 'rgba(240, 185, 11, 0.2)'; top10Badge.style.color = '#F0B90B';
        } else {
            top10Badge.innerText = 'An toàn';
            top10Badge.style.background = 'rgba(14, 203, 129, 0.2)'; top10Badge.style.color = '#0ECB81';
        }
    }

    let currentPrice = Number(t_chart.price) || parseFloat(d.price || 0);
    let avgBuy = parseFloat(d.bnAvgBuyPrice || 0);
    safeSet('sm-bn-avg-buy', '$' + fmtPrice(avgBuy));
    let dumpBadge = document.getElementById('sm-dump-risk-badge');
    if (dumpBadge && avgBuy > 0 && currentPrice > 0) {
        let pnlPct = ((currentPrice - avgBuy) / avgBuy) * 100;
        if (pnlPct > 50) {
            dumpBadge.innerText = `Lãi to (+${pnlPct.toFixed(0)}%)`;
            dumpBadge.style.background = 'rgba(246, 70, 93, 0.2)'; dumpBadge.style.color = '#F6465D';
        } else if (pnlPct < -20) {
            dumpBadge.innerText = `Cắt lỗ (${pnlPct.toFixed(0)}%)`;
            dumpBadge.style.background = 'rgba(240, 185, 11, 0.2)'; dumpBadge.style.color = '#F0B90B';
        } else {
            dumpBadge.innerText = `Tích lũy`;
            dumpBadge.style.background = 'rgba(14, 203, 129, 0.2)'; dumpBadge.style.color = '#0ECB81';
        }
    }

    let mc = Number(t_chart.market_cap) || Number(d.marketCap) || 0;
    let maxSup = Number(d.allChainMaxSupply) || Number(d.totalSupply) || Number(d.maxSupply);
    let fdv = maxSup > 0 ? (currentPrice * maxSup) : (Number(d.fdv) || mc);
    if (fdv < mc) fdv = mc;
    let unlockPct = fdv > 0 ? (mc / fdv) * 100 : 100;
    if (unlockPct > 100) unlockPct = 100;

    let topFdvEl = document.getElementById('sc-top-fdv');
    if (topFdvEl) topFdvEl.innerText = '$' + formatCompactNum(fdv);

    safeSet('sm-unlock-pct', unlockPct.toFixed(1) + '%');
    let unlockBadge = document.getElementById('sm-unlock-badge');
    if (unlockBadge) {
        if (unlockPct < 30) {
            unlockBadge.innerText = 'Lạm phát cực cao';
            unlockBadge.style.background = 'rgba(246, 70, 93, 0.2)'; unlockBadge.style.color = '#F6465D';
        } else if (unlockPct < 70) {
            unlockBadge.innerText = 'Mở khóa trung bình';
            unlockBadge.style.background = 'rgba(240, 185, 11, 0.2)'; unlockBadge.style.color = '#F0B90B';
        } else {
            unlockBadge.innerText = 'Lưu thông tốt';
            unlockBadge.style.background = 'rgba(14, 203, 129, 0.2)'; unlockBadge.style.color = '#0ECB81';
        }
    }

    let currentTokenLiq = t_chart.liquidity ? t_chart.liquidity : 0;
    let liq = Number(currentTokenLiq) || Number(d.liquidity) || 0;
    let liqRatio = mc > 0 ? (liq / mc) * 100 : 0;
    safeSet('sm-liq-ratio', liqRatio.toFixed(2) + '%');
    let liqBadge = document.getElementById('sm-liq-badge');
    if (liqBadge) {
        if (liq <= 0) {
            liqBadge.innerText = 'Đang dò Pool...';
            liqBadge.style.background = 'rgba(255, 255, 255, 0.1)'; liqBadge.style.color = '#848e9c';
        } else if (liqRatio < 1) {
            liqBadge.innerText = 'Kém (Dễ trượt giá)';
            liqBadge.style.background = 'rgba(246, 70, 93, 0.2)'; liqBadge.style.color = '#F6465D';
        } else if (liqRatio < 5) {
            liqBadge.innerText = 'Chấp nhận được';
            liqBadge.style.background = 'rgba(240, 185, 11, 0.2)'; liqBadge.style.color = '#F0B90B';
        } else {
            liqBadge.innerText = 'Dày & Khỏe';
            liqBadge.style.background = 'rgba(14, 203, 129, 0.2)'; liqBadge.style.color = '#0ECB81';
        }
    }

    let smartPct = parseFloat(d.holdersSmartMoneyPercent || d.smartMoneyHoldingPercent || 0);
    safeSet('sm-pct-smart', smartPct > 0 ? (smartPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-smart', d.smartMoneyHolders || '0');
    
    let kolProPct = parseFloat(d.kolHoldingPercent || 0) + parseFloat(d.proHoldingPercent || 0);
    safeSet('sm-pct-kol', kolProPct > 0 ? (kolProPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-kol', parseInt(d.kolHolders || 0) + parseInt(d.proHolders || 0));
    
    let newPct = parseFloat(d.newWalletHoldingPercent || 0);
    safeSet('sm-pct-new', newPct > 0 ? (newPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-new', d.newWalletHolders || '0');
    
    let sniperPct = parseFloat(d.sniperHoldingPercent || 0) + parseFloat(d.bundlerHoldingPercent || 0);
    safeSet('sm-pct-sniper', sniperPct > 0 ? (sniperPct * 1).toFixed(2) + '%' : '0.00%');
    safeSet('sm-cnt-sniper', d.bundlerHolders || '0');

    let verdictEl = document.getElementById('sm-verdict-badge');
    if (verdictEl) {
        if (smartPct + kolProPct > 1) {
            verdictEl.innerText = 'CÁ MẬP GOM';
            verdictEl.style.color = '#0ECB81'; verdictEl.style.border = '1px solid rgba(14, 203, 129, 0.5)'; verdictEl.style.background = 'rgba(14, 203, 129, 0.1)';
        } else if (sniperPct > 5) {
            verdictEl.innerText = 'BOT KIỂM SOÁT';
            verdictEl.style.color = '#FF007F'; verdictEl.style.border = '1px solid rgba(255, 0, 127, 0.5)'; verdictEl.style.background = 'rgba(255, 0, 127, 0.1)';
        } else if (newPct > 10) {
            verdictEl.innerText = 'FOMO RETAIL';
            verdictEl.style.color = '#F0B90B'; verdictEl.style.border = '1px solid rgba(240, 185, 11, 0.5)'; verdictEl.style.background = 'rgba(240, 185, 11, 0.1)';
        } else {
            verdictEl.innerText = 'KHÔNG CÓ TAY TO';
            verdictEl.style.color = '#848e9c'; verdictEl.style.border = '1px solid #444'; verdictEl.style.background = 'transparent';
        }
    }

    let fShort = (n) => n ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(n) : '0';
    safeSet('sm-bn-traders', `${fShort(d.bnTraders)} Traders <span style="color:#527c82">|</span> ${fShort(d.bnUniqueHolders || d.kycHolderCount)} KYC`);
    
    // --- BẮT ĐẦU CẬP NHẬT TAB BINANCE DEX MỚI ---
    window.currentSmartMoneyData = d; // Lưu data vào biến toàn cục

    // Tìm xem người dùng đang xem Tab nào (mặc định là 24h) để render đúng tab đó
    const activeBtn = document.querySelector('#sm-dex-tabs .sc-time-btn.active');
    const activeTf = activeBtn ? activeBtn.innerText.toLowerCase() : '24h';
    window.renderBinanceDexTab(activeTf);
    // --- KẾT THÚC CẬP NHẬT TAB BINANCE DEX MỚI ---
    
    const updateCVDBar = (timeKey, buyVol, sellVol) => {
        let total = buyVol + sellVol;
        let buyPct = total > 0 ? (buyVol / total) * 100 : 50;
        let sellPct = total > 0 ? (sellVol / total) * 100 : 50;
        
        let barBuy = document.getElementById(`sm-bar-${timeKey}-buy`);
        let barSell = document.getElementById(`sm-bar-${timeKey}-sell`);
        if (barBuy) barBuy.style.width = buyPct + '%';
        if (barSell) barSell.style.width = sellPct + '%';
        
        safeSet(`sm-txt-${timeKey}-buy`, buyPct.toFixed(1) + '%');
        safeSet(`sm-txt-${timeKey}-sell`, sellPct.toFixed(1) + '%');

        let tagEl = document.getElementById(`sm-tag-${timeKey}`);
        if (tagEl) {
            if (buyPct > 65) {
                tagEl.innerText = 'BULLISH';
                tagEl.style.background = 'rgba(14, 203, 129, 0.2)'; tagEl.style.color = '#0ECB81';
            } else if (sellPct > 65) {
                tagEl.innerText = 'BEARISH';
                tagEl.style.background = 'rgba(246, 70, 93, 0.2)'; tagEl.style.color = '#F6465D';
            } else {
                tagEl.innerText = 'SIDEO';
                tagEl.style.background = 'rgba(255, 255, 255, 0.1)'; tagEl.style.color = '#848e9c';
            }
        }
    };

    updateCVDBar('1h', parseFloat(d.volume1hBuy || 0), parseFloat(d.volume1hSell || 0));
    updateCVDBar('4h', parseFloat(d.volume4hBuy || 0), parseFloat(d.volume4hSell || 0));
};

window.fetchSmartMoneyData = async function(contract, chainId) {
    if (!contract) return;
    
    let titleEl = document.querySelector('#tab-smartmoney .sc-panel-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-spinner fa-spin" style="color:#F0B90B; margin-right: 5px;"></i> ĐANG KẾT NỐI SERVER...`;
    }

    try {
        let url = `https://alpha-realtime.onrender.com/api/smart-money?chainId=${chainId || 56}&contractAddress=${contract}`;
        let res = await fetch(url);
        let json = await res.json();
        
        if (json && json.success) {
            window.updateSmartMoneyRadar(json);
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-bolt" style="color:#0ECB81; margin-right: 5px;"></i> RADAR SMART MONEY (LIVE)`;
        } else {
            if (titleEl) titleEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#F6465D; margin-right: 5px;"></i> API TRẢ VỀ RỖNG`;
        }
    } catch(e) {
        if (titleEl) titleEl.innerHTML = `<i class="fas fa-wifi" style="color:#F6465D; margin-right: 5px;"></i> LỖI KẾT NỐI MẠNG`;
    }
};

window.fetchFuturesSentiment = async function(symbol) {
    if (!symbol) return;
    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '') + 'USDT';
    const box = document.getElementById('tab-futures');
    if (!box) return;

    document.getElementById('fut-live-status').innerText = '⏳ Đang tải...';
    document.getElementById('fut-live-status').style.color = 'var(--term-warn)';

    try {
        const fetchTimeout = (url) => Promise.race([
            fetch(url), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
        ]);

        const [posRes, accRes, takerRes] = await Promise.all([
            fetchTimeout(`/api/binance-fapi?endpoint=/futures/data/topLongShortPositionRatio&symbol=${cleanSymbol}&period=5m&limit=1`),
            fetchTimeout(`/api/binance-fapi?endpoint=/futures/data/topLongShortAccountRatio&symbol=${cleanSymbol}&period=5m&limit=1`),
            fetchTimeout(`/api/binance-fapi?endpoint=/futures/data/takerlongshortRatio&symbol=${cleanSymbol}&period=5m&limit=1`)
        ]);

        const posData = await posRes.json();
        const accData = await accRes.json();
        const takerData = await takerRes.json();

        if (posData.error || accData.error) throw new Error("API Error");

        document.getElementById('fut-live-status').innerText = '🟢 LIVE TỪ BINANCE';
        document.getElementById('fut-live-status').style.color = '#0ECB81';

        let posL = 50, accL = 50;

        if (posData && posData.length > 0) {
            posL = parseFloat(posData[0].longAccount) * 100;
            let shortPct = parseFloat(posData[0].shortAccount) * 100;
            document.getElementById('fut-pos-ratio').innerText = `${posL.toFixed(1)}% L / ${shortPct.toFixed(1)}% S`;
            document.getElementById('fut-pos-long').style.width = `${posL}%`;
            document.getElementById('fut-pos-short').style.width = `${shortPct}%`;
        }

        if (accData && accData.length > 0) {
            accL = parseFloat(accData[0].longAccount) * 100;
            let shortPct = parseFloat(accData[0].shortAccount) * 100;
            document.getElementById('fut-acc-ratio').innerText = `${accL.toFixed(1)}% L / ${shortPct.toFixed(1)}% S`;
            document.getElementById('fut-acc-long').style.width = `${accL}%`;
            document.getElementById('fut-acc-short').style.width = `${shortPct}%`;
        }
        
        // KIỂM TRA PHÂN KỲ TÂM LÝ (DIVERGENCE TRAP)
        let divAlert = document.getElementById('fut-divergence-alert');
        if (divAlert) {
            let divDiff = accL - posL;
            if (divDiff >= 15) { // Retail Long > Whales Long
                divAlert.style.display = 'block';
                divAlert.innerText = '⚠️ BẪY FOMO: Đám đông Long, Cá Mập Short!';
                divAlert.style.color = '#F6465D'; divAlert.style.background = 'rgba(246, 70, 93, 0.2)';
            } else if (divDiff <= -15) { // Retail Short > Whales Short
                divAlert.style.display = 'block';
                divAlert.innerText = '⚠️ BẪY SỢ HÃI: Đám đông Short, Cá Mập Long!';
                divAlert.style.color = '#0ECB81'; divAlert.style.background = 'rgba(14, 203, 129, 0.2)';
            } else {
                divAlert.style.display = 'none';
            }
        }

        if (takerData && takerData.length > 0) {
            let buyVol = parseFloat(takerData[0].buyVol);
            let sellVol = parseFloat(takerData[0].sellVol);
            document.getElementById('fut-taker-buy').innerText = '$' + formatCompactUSD(buyVol);
            document.getElementById('fut-taker-sell').innerText = '$' + formatCompactUSD(sellVol);
            
            let totalTaker = buyVol + sellVol;
            let buyPct = totalTaker > 0 ? (buyVol / totalTaker) * 100 : 50;
            let sellPct = totalTaker > 0 ? (sellVol / totalTaker) * 100 : 50;
            document.getElementById('fut-taker-buy-bar').style.width = `${buyPct}%`;
            document.getElementById('fut-taker-sell-bar').style.width = `${sellPct}%`;
        }
    } catch(e) {
        document.getElementById('fut-live-status').innerText = '🚫 KHÔNG CÓ DATA';
        document.getElementById('fut-live-status').style.color = '#848e9c';
    }
};

window.fetchCommandCenterFutures = async function(symbol) {
    if (!symbol) return;
    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '') + 'USDT';

    const oiEl = document.getElementById('fut-oi-val');
    const fundEl = document.getElementById('fut-funding-val');

    try {
        const fetchTimeout = (url) => Promise.race([
            fetch(url), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
        ]);

        const [oiRes, fundRes] = await Promise.all([
            fetchTimeout(`/api/binance-fapi?endpoint=/fapi/v1/openInterest&symbol=${cleanSymbol}`),
            fetchTimeout(`/api/binance-fapi?endpoint=/fapi/v1/premiumIndex&symbol=${cleanSymbol}`)
        ]);

        const oiData = await oiRes.json();
        const fundData = await fundRes.json();

        // Khởi tạo biến lưu trữ nếu chưa có
        if (!window.quantStats) window.quantStats = {};

        if (oiData && oiData.openInterest) {
            // LƯU VÀO BIẾN TOÀN CỤC CHO CHART-UI DÙNG
            window.quantStats.openInterest = parseFloat(oiData.openInterest); 
            
            const price = parseFloat(fundData.markPrice || 0);
            const oiUsd = parseFloat(oiData.openInterest) * price;
            if (oiEl) oiEl.innerText = '$' + formatCompactUSD(oiUsd);
        }

        if (fundData && fundData.lastFundingRate) {
            const fRate = parseFloat(fundData.lastFundingRate) * 100;
            
            // LƯU VÀO BIẾN TOÀN CỤC ĐỂ CHART-UI CHẠY COUNTDOWN
            window.quantStats.fundingRateObj = {
                rate: fRate,
                nextTime: parseInt(fundData.nextFundingTime || Date.now() + 28800000),
                interval: 8
            };

            if (fundEl) {
                fundEl.innerText = fRate.toFixed(4) + '%';
                fundEl.style.color = fRate >= 0 ? '#0ECB81' : '#F6465D';
            }
        }
    } catch (e) {
        if (oiEl) oiEl.innerText = 'N/A';
        if (fundEl) { fundEl.innerText = 'N/A'; fundEl.style.color = '#5e6673'; }
    }
};

// --- HÀM MỞ CHART ĐÃ ĐƯỢC CHÈN LỆNH KÍCH HOẠT ---
const oldOpenProChart = window.openProChart;
window.openProChart = function(t, isTimeSwitch = false) {
    if (typeof oldOpenProChart === 'function') oldOpenProChart(t, isTimeSwitch);
    if (!isTimeSwitch) {
        // Dọn dẹp tiến trình cập nhật của Token cũ (nếu có)
        if (window.proChartApiInterval) clearInterval(window.proChartApiInterval);

        setTimeout(() => {
            injectSmartMoneyTab();
            injectFuturesTab();
            
            // Lần 1: Gọi ngay lập tức khi vừa mở Chart
            window.fetchSmartMoneyData(t.contract, t.chainId || t.chain_id || 56);
            window.fetchFuturesSentiment(t.symbol);
            window.fetchCommandCenterFutures(t.symbol); 

            // Lần 2 trở đi: Lặp lại tự động mỗi 3 phút (180,000 ms)
            window.proChartApiInterval = setInterval(() => {
                // Kiểm tra an toàn: Nếu chart đã bị ẩn thì không gọi API nữa
                const overlay = document.getElementById('super-chart-overlay');
                if (!overlay || !overlay.classList.contains('active')) return;

                window.fetchSmartMoneyData(t.contract, t.chainId || t.chain_id || 56);
                window.fetchFuturesSentiment(t.symbol);
                window.fetchCommandCenterFutures(t.symbol);
            }, 180000);

        }, 100);
    }
};
