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
if (!document.getElementById('wave-alpha-pro-chart-styles')) {
        const proChartStyle = document.createElement('style');
        proChartStyle.id = 'wave-alpha-pro-chart-styles';
        proChartStyle.innerHTML = `
            /* BẢN SẮC BLOOMBERG TERMINAL (THỰC CHIẾN) */
            :root { 
                --term-bg: #000000;         /* Đen tuyệt đối */
                --term-panel: #0B0E14;      /* Xám nền Panel */
                --term-border: #1A1F26;     /* Viền cực mảnh */
                --term-text: #EAECEF;       /* Trắng sáng */
                --term-dim: #707A8A;        /* Xám mờ cho Label */
                --term-up: #0ECB81;         /* Xanh Mua */
                --term-down: #F6465D;       /* Đỏ Bán */
                --term-warn: #F0B90B;       /* Vàng Cảnh báo */
            }
            
            /* TẮT TOÀN BỘ BÓNG ĐỔ VÀ HOẠT ẢNH RÁC */
            #super-chart-overlay * { text-shadow: none !important; box-shadow: none !important; }
            #super-chart-overlay { height: 100dvh !important; padding-bottom: 0; box-sizing: border-box; background: var(--term-bg); font-family: var(--font-main); }
            
            /* LAYOUT CHÍNH */
            .sc-topbar { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; background: var(--term-panel); border-bottom: 1px solid var(--term-border); height: 42px; flex-shrink: 0; }
            .sc-body { display: flex; flex: 1; overflow: hidden; width: 100%; }
            .sc-chart-area { flex: 1; display: flex; flex-direction: column; background: var(--term-bg); overflow: hidden; }
            .sc-stats-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 15px; background: var(--term-panel); border-bottom: 1px solid var(--term-border); }
            .sc-side-panel { width: 340px; background: var(--term-bg); display: flex; flex-direction: column; border-left: 1px solid var(--term-border); z-index: 2;}
            
            /* TOP BAR METRICS */
            .sc-price-box { display: flex; align-items: baseline; gap: 10px; margin-right: 15px; }
            .sc-metrics-compact { display: flex; gap: 20px; align-items: center; }
            .sc-mc-item { display: flex; flex-direction: column; align-items: flex-end; }
            .sc-mc-item span { font-size: 9.5px; color: var(--term-dim); font-weight: 600; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px;}
            .sc-mc-item strong { font-size: 13px; color: var(--term-text); font-family: var(--font-num); font-weight: 700; font-variant-numeric: tabular-nums; }
            
            /* ========================================= */
            /* BỘ KHUNG LAYOUT TERMINAL BÊN PHẢI (MỚI) */
            /* ========================================= */
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
            
            /* ========================================= */
            /* BỘ CLASS WIDGET MỚI DÀNH CHO COMMAND CENTER */
            /* ========================================= */
            /* [FIX NHẢY KHUNG] Thêm overflow: hidden để khóa cứng biên giới hộp */
            .term-widget { background: var(--term-panel); border: 1px solid var(--term-border); border-radius: 2px; padding: 8px; margin-bottom: 6px; overflow: hidden; }
            
            .term-w-title { font-size: 9px; color: var(--term-dim); font-weight: 700; text-transform: uppercase; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.5px; white-space: nowrap; gap: 4px; overflow: hidden; }
            .term-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; gap: 4px; }
            .term-lbl { font-size: 9px; color: var(--term-dim); overflow: hidden; text-overflow: ellipsis; }
            
            /* [FIX NHẢY KHUNG] Thêm ép chữ tự thu gọn bằng dấu ... nếu quá dài */
            .term-val { font-size: 11px; font-weight: 700; color: var(--term-text); font-family: var(--font-num); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; text-align: right;}
            
            /* CUỘN TAPE */
            #sc-live-trades::-webkit-scrollbar { width: 4px; }
            #sc-live-trades::-webkit-scrollbar-thumb { background: #2B3139; border-radius: 0; }
            #sc-live-trades::-webkit-scrollbar-track { background: var(--term-bg); }

            /* MOBILE RESPONSIVE CÓ KHÓA CUỘN (SCROLL BLEEDING FIX) */
            @media (max-width: 991px) {
                /* 1. KHOÁ CHẾT NỀN TRANG WEB BÊN DƯỚI */
                body.overlay-active { overflow: hidden !important; }
                
                /* 2. CÁC STYLE PHẦN BIỂU ĐỒ BÊN TRÊN (GIỮ NGUYÊN CỦA BẠN) */
                .sc-body { flex-direction: column !important; min-height: 0 !important; flex: 1 1 auto !important; }
                .sc-topbar { padding: 6px 10px; }
                .sc-chart-area { flex: none !important; height: 42vh !important; border-bottom: 1px solid var(--term-border); }
                .sc-stats-row { padding: 6px 10px; gap: 8px; }
                .sc-price-box { flex-direction: column; align-items: flex-start; gap: 0px; margin-right: 5px; justify-content: center;}
                .sc-price-box #sc-live-price { font-size: 20px !important; }
                .sc-price-box #sc-change-24h { font-size: 11px !important; }
                .sc-metrics-compact { width: 100%; justify-content: space-between; gap: 2px; overflow: hidden; padding-bottom: 0;}
                .sc-mc-item span { font-size: 8px; margin-bottom: 0; }
                .sc-mc-item strong { font-size: 10.5px; }
                
                /* 3. BỘ KHUNG PANEL BÊN DƯỚI KÈM THUỐC TRỊ LỖI CUỘN */
                .sc-right-container { flex-direction: column-reverse; width: 100%; height: auto; flex: 1 1 auto; border-left: none; min-height: 0 !important; }
                .sc-icon-sidebar { flex-direction: row; width: 100%; height: 40px; padding-top: 0; border-left: none; border-top: 1px solid var(--term-border); justify-content: space-around; flex-shrink: 0; }
                .sc-sidebar-icon { border-left: none !important; border-bottom: 2px solid transparent; }
                .sc-sidebar-icon.active { border-bottom-color: var(--term-warn); }
                .sc-sidebar-icon:hover::after { display: none; }
                
                .sc-panel-content { width: 100% !important; flex: 1 1 auto !important; min-height: 0 !important; transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .sc-panel-content.collapsed { height: 0px !important; flex: none !important; }
                
                .sc-tab-content { 
                    flex: 1 1 auto !important; 
                    min-height: 0 !important; 
                    overflow-y: auto !important; 
                    overflow-x: hidden !important;
                    overscroll-behavior: contain !important; /* Ngăn cuộn lây lan ra ngoài (Scroll Bleeding) */
                    -webkit-overflow-scrolling: touch !important; /* Vuốt mượt có quán tính trên iOS */
                    padding-bottom: 30px !important; 
                }
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
    <div class="sc-mc-item"><span>VOL(24H)</span><strong id="sc-top-vol">$--</strong></div>
    <div class="sc-mc-item"><span>LIQ</span><strong id="sc-top-liq">$--</strong></div>
    <div class="sc-mc-item"><span>MCAP</span><strong id="sc-top-mc">$--</strong></div>
    <div class="sc-mc-item"><span>FDV</span><strong id="sc-top-fdv">$--</strong></div> <div class="sc-mc-item"><span>HOLD</span><strong id="sc-top-hold">--</strong></div>
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
                                <div style="display:flex; align-items:center; gap:4px; color:#527c82; font-size:10px; font-weight:700; font-family:var(--font-main);">
                                    <i class="fas fa-filter"></i>
                                    <select id="sc-fish-filter" onchange="window.applyFishFilter()" style="background:transparent; color:#527c82; border:none; font-size:10px; font-weight:700; outline:none; cursor:pointer; padding:0; width: 80px; text-overflow: ellipsis;">
                                        <option value="sweep">TẤT CẢ BOT</option>
                                        <option value="dolphin">TỪ CÁ HEO</option>
                                        <option value="shark" selected>TỪ CÁ MẬP</option>
                                        <option value="whale">CHỈ CÁ VOI</option>
                                        <option value="none" style="color:var(--term-dim)">🚫 ẨN TẤT CẢ</option>
                                    </select>
                                </div>
                            </div>

                            <div style="display:flex; gap:6px; font-size:11px; font-weight:700; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.03);">
                                <span title="Cá Voi" style="color:#cb55e3; display:flex; gap:2px; align-items:center;">🐋 <span id="sc-stat-whale">0</span></span>
                                <span title="Cá Mập" style="color:#eaecef; display:flex; gap:2px; align-items:center;">🦈 <span id="sc-stat-shark">0</span></span>
                                <span title="Cá Heo" style="color:#eaecef; display:flex; gap:2px; align-items:center;">🐬 <span id="sc-stat-dolphin">0</span></span>
                                <span title="Sweep" style="color:#2af592; display:flex; gap:2px; align-items:center;">🤖 <span id="sc-stat-sweep">0</span></span>
                            </div>

                            <div style="display:flex; align-items:center; gap:4px; background:rgba(0,0,0,0.25); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.03); color:#848e9c; font-size:10px; font-weight:700; font-family:var(--font-main);">
                                <i class="fas fa-palette"></i>
                                <select id="sc-theme-select" onchange="window.changeTheme()" style="background:transparent; color:#848e9c; border:none; font-size:10px; font-weight:700; outline:none; cursor:pointer; padding:0; width: 70px; text-overflow: ellipsis;">
                                    <option value="cyber">ALPHA</option>
                                    <option value="trad">CLASSIC</option>
                                </select>
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


                    
                </div> <div class="sc-right-container" id="sc-right-container">
                    <div class="sc-panel-content" id="sc-panel-content">
                        <div id="tab-watchlist" class="sc-tab-content" style="padding: 0; display: none;">
                            <div class="sc-panel-title" style="padding: 10px 15px; margin: 0; background: #12151A; display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-size: 11px; color:#eaecef;"><i class="fas fa-list" style="color:#F0B90B; margin-right: 5px;"></i> WATCHLIST</div>
                                <input type="text" id="wl-search" placeholder="Tìm token..." onkeyup="window.renderProWatchlist(this.value)" autocomplete="off" style="background:rgba(255,255,255,0.05); border:1px solid #2b3139; color:#eaecef; font-size:10px; padding:3px 8px; border-radius:2px; width:120px; outline:none; font-family:var(--font-main);">
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9px; color:#5e6673; padding: 6px 15px; font-weight:800; background: #0B0E11; border-top: 1px solid #1A1F26; border-bottom: 1px solid #1A1F26; letter-spacing: 0.5px;">
                                <span style="width:45%">TOKEN</span><span style="width:30%; text-align:right;">GIÁ</span><span style="width:25%; text-align:right;">24H%</span>
                            </div>
                            <div id="sc-watchlist-body" style="flex:1; overflow-y:auto; background: var(--term-bg);">
                                </div>
                        </div>

                        <div id="tab-trades" class="sc-tab-content active" style="padding: 0; display: flex;">
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

                        <div id="tab-info" class="sc-tab-content" style="padding: 10px; display: none; flex-direction: column; height: 100%; overflow-y: auto;">
                            <div class="term-w-title" style="margin-bottom: 8px; color:#EAECEF; font-size: 11px;">
                                <i class="fas fa-wave-square" style="color:var(--term-warn); margin-right: 5px;"></i> COMMAND CENTER (PRO)
                            </div>
                            
                            <div id="quant-command-center" style="display: flex; flex-direction: column;">
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
                                
                              </div>  <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; margin-bottom: 6px;">
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

                                <div class="term-w-title" style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
    <span style="display:flex; align-items:center; gap:6px;">
        SNIPER TAPE 
        <select id="cc-tape-filter" onchange="window.filterSniperTape()" style="background:transparent; color:var(--term-warn); border:none; font-size:9px; outline:none; cursor:pointer; font-weight:800;"><option value="all">ALL</option><option value="whale">WHALE</option><option value="shark">SHARK+</option></select>
        <i id="cc-sound-icon" class="fas fa-volume-up" style="color:#0ECB81; cursor:pointer; font-size:11px; transition:0.2s;" onclick="window.toggleProSound()" title="Bật/Tắt Âm Cảnh Báo"></i>
    </span>
    <span style="display:flex; width: 55%; font-size: 8px; color: var(--term-dim); justify-content: flex-end;">
        <span style="width: 65%; text-align: center;">SIZE & GIÁ</span>
        <span style="width: 35%; text-align: right;">TIME</span>
    </span>
</div>
<div id="cc-sniper-tape" style="background: var(--term-bg); border: 1px solid var(--term-border); border-radius: 2px; padding: 4px; height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px;">
    <div style="font-size: 11px; color: var(--term-dim); text-align: center; margin-top: 50px; font-style: italic;">Đang quét...</div>
</div>

                                <div class="term-widget" style="margin-bottom: 0;">
                                    <div class="term-w-title">FUTURES <span id="cc-futures-status" style="color: var(--term-warn);">⏳ ĐANG DÒ...</span></div>
                                    <div class="term-row"><span class="term-lbl">Open Interest</span><span id="cc-oi-val" class="term-val">$--</span></div>
                                    <div class="term-row"><span class="term-lbl" id="cc-funding-lbl">Funding Rate</span><span id="cc-funding-val" class="term-val">--%</span></div>
                                    <div class="term-row" style="border-top: 1px solid var(--term-border); padding-top: 6px; margin-top: 4px;">
                                        <span id="cc-liq-long" style="color:var(--term-down); font-size:9.5px; font-weight:700; font-family:var(--font-num);">🩸 Liq L: $0</span>
                                        <span id="cc-liq-short" style="color:var(--term-up); font-size:9.5px; font-weight:700; font-family:var(--font-num);">💥 Liq S: $0</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="sc-icon-sidebar">
                        <button class="sc-sidebar-icon" data-title="Watchlist" onclick="window.toggleProSidePanel('watchlist', this)"><i class="fas fa-list"></i></button>
                        <button class="sc-sidebar-icon active" data-title="Live Trades" onclick="window.toggleProSidePanel('trades', this)"><i class="fas fa-bolt"></i></button>
                        <button class="sc-sidebar-icon" data-title="Data Flow" onclick="window.toggleProSidePanel('info', this)"><i class="fas fa-wave-square"></i></button>
                        <button class="sc-sidebar-icon" data-title="Smart Money" onclick="window.toggleProSidePanel('smartmoney', this)"><i class="fas fa-microscope"></i></button>
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
    if (typeof window.renderProWatchlist === 'function') window.renderProWatchlist(); // Cập nhật Watchlist ngay lập tức
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
        if (typeof window.renderProWatchlist === 'function') window.renderProWatchlist(); // Update Watchlist Realtime
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
window.quantStats = {
    whaleBuyVol: 0, whaleSellVol: 0,
    botSweepBuy: 0, botSweepSell: 0,
    priceTrend: 0,          // Giữ lại field không bị mất
    trend: 0, drop: 0, spread: 0,
    ofi: 0, zScore: 0, buyDominance: 50,
    longLiq: 0, shortLiq: 0,
    fundingRateObj: null,
    hftVerdict: null
};

// 🔊 CÔNG TẮC VÀ TRÌNH PHÁT ÂM THANH
window.isProSoundOn = true; 

window.toggleProSound = function() {
    window.isProSoundOn = !window.isProSoundOn;
    let icon = document.getElementById('cc-sound-icon');
    if (icon) {
        icon.className = window.isProSoundOn ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        icon.style.color = window.isProSoundOn ? '#0ECB81' : '#F6465D';
    }
};

window.playProPing = function() {
    if (!window.isProSoundOn) return; 
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz (Nốt A5)
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
};

window.tapeRenderQueue = [];
window.isTapeRendering = false;

window.logToSniperTape = function(isBuy, vol, type, price) {
let isLiq = type.includes('CHÁY');
if (vol < 500 && !type.includes('BOT') && !isLiq) return;

const isWhaleOrShark = type.includes('VOI') || type.includes('MẬP') || type.includes('🧊') || isLiq;
if (isWhaleOrShark) window.playProPing();

const currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
const heatMaxThreshold = Math.max(5000, currentAvgTicket * 15);
const heatRatio = Math.min(1, vol / heatMaxThreshold); 
const opacity = 0.03 + (heatRatio * 0.27); 

let color = isBuy ? '#0ECB81' : '#F6465D';
let baseRgb = isBuy ? '14, 203, 129' : '246, 70, 93';

if (type.includes('CHÁY LONG')) { color = '#FF007F'; baseRgb = '255, 0, 127'; } 
else if (type.includes('CHÁY SHORT')) { color = '#00F0FF'; baseRgb = '0, 240, 255'; }

const bg = `rgba(${baseRgb}, ${isLiq ? 0.35 : opacity})`;
const action = isLiq ? '' : (isBuy ? 'BUY' : 'SELL');

const entry = document.createElement('div');
const fontWt = (heatRatio > 0.6 || isLiq) ? '900' : (heatRatio > 0.3 ? '800' : '600');

// Ép lệnh thanh lý vào nhóm 'whale' để nó đâm thủng mọi bộ lọc (bất chấp đang chọn TỪ CÁ MẬP)
entry.dataset.tapeType = isLiq ? 'whale' : (isWhaleOrShark ? (type.includes('VOI') ? 'whale' : 'shark') : 'bot');
entry.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: ${bg}; border-left: ${(heatRatio > 0.6 || isLiq) ? 4 : 2}px solid ${color}; border-radius: 0; font-family: var(--font-num); gap: 4px; font-weight: ${fontWt}; transition: background 0.8s ease;`;

let glow = isWhaleOrShark ? `text-shadow: 0 0 5px ${color};` : '';
const timeStr = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

entry.innerHTML = `
    <span style="color:${color}; font-weight:800; width: 35%; ${glow}">${type} ${action}</span>
    <span style="color:#eaecef; font-weight:bold; width: 45%; text-align: center;">$${formatCompactUSD(vol)} @ ${formatPrice(price)}</span>
    <span style="color:#848e9c; font-weight:600; width: 20%; text-align: right;">${timeStr}</span>
`;
    
    const filterEl = document.getElementById('cc-tape-filter');
    const currentFilter = filterEl ? filterEl.value : 'all';
    if (currentFilter === 'whale' && entry.dataset.tapeType !== 'whale') entry.style.display = 'none';
    else if (currentFilter === 'shark' && entry.dataset.tapeType === 'bot') entry.style.display = 'none';

    // [CHỐNG GIẬT] Nạp đạn vào hàng đợi
    window.tapeRenderQueue.push({ entry, isWhaleOrShark, isBuy, bg });

    if (!window.isTapeRendering) {
        window.isTapeRendering = true;
        requestAnimationFrame(() => {
            const tape = document.getElementById('cc-sniper-tape');
            if (tape && window.tapeRenderQueue.length > 0) {
                if (tape.innerHTML.includes('Đang quét') || tape.innerHTML.includes('Đang rình')) tape.innerHTML = '';
                const fragment = document.createDocumentFragment();
                const items = window.tapeRenderQueue.splice(0, window.tapeRenderQueue.length);
                for (let i = items.length - 1; i >= 0; i--) {
                    fragment.insertBefore(items[i].entry, fragment.firstChild);
                    if (items[i].isWhaleOrShark) {
                        items[i].entry.style.background = items[i].isBuy ? 'rgba(14, 203, 129, 0.55)' : 'rgba(246, 70, 93, 0.55)';
                        setTimeout(() => { 
                            items[i].entry.style.background = items[i].bg; 
                            items[i].entry.style.textShadow = 'none'; 
                        }, 150);
                    }
                }
                tape.prepend(fragment);
                while (tape.children.length > 50) tape.removeChild(tape.lastChild);
            }
            window.isTapeRendering = false;
        });
    }
};

// [NÃO BỘ CỦA NÚT DROPDOWN] - Hàm quét lại các lệnh đã in ra mỗi khi User bấm chuyển Dropdown
window.filterSniperTape = function() {
    const fVal = document.getElementById('cc-tape-filter').value;
    const tape = document.getElementById('cc-sniper-tape');
    if (!tape) return;
    
    Array.from(tape.children).forEach(child => {
        if (!child.dataset.tapeType) return; // Bỏ qua dòng text "Đang quét..."
        
        if (fVal === 'all') {
            child.style.display = 'flex';
        } else if (fVal === 'whale') {
            child.style.display = child.dataset.tapeType === 'whale' ? 'flex' : 'none';
        } else if (fVal === 'shark') {
            child.style.display = (child.dataset.tapeType === 'whale' || child.dataset.tapeType === 'shark') ? 'flex' : 'none';
        }
    });
};

// =========================================================
// [TARGET-3] ĐỘNG CƠ NHẬN DIỆN SQUEEZE (BƠM / XẢ THANH LÝ)
// =========================================================
const SQUEEZE_LIQ_THRESHOLD = 10000; // $10k liquidation tối thiểu
function computeSqueezeZone() {
    if (!window.quantStats) return { confirmed: false };
    const liqLong  = window.quantStats.longLiq  || 0;
    const liqShort = window.quantStats.shortLiq || 0;
    const flags    = window.quantStats.flags    || {};
    const ofi      = window.quantStats.ofi      || 0;
    const zScore   = window.quantStats.zScore   || 0;

    let confirmed = false; let side = null; let strength = 0;

    if (liqLong > SQUEEZE_LIQ_THRESHOLD && flags.stopHunt && ofi > 0.2) {
        confirmed = true; side = 'short';
        strength = Math.min(1, (liqLong / (SQUEEZE_LIQ_THRESHOLD * 5)) * (ofi + 0.2) * (zScore > 1.5 ? 1.3 : 1));
    } else if (liqShort > SQUEEZE_LIQ_THRESHOLD && flags.exhausted && ofi < -0.2) {
        confirmed = true; side = 'long';
        strength = Math.min(1, (liqShort / (SQUEEZE_LIQ_THRESHOLD * 5)) * (Math.abs(ofi) + 0.2));
    }
    window.quantStats.squeezeZone = { confirmed, side, strength };
    return window.quantStats.squeezeZone;
}

// =========================================================
// HÀM CẬP NHẬT GIAO DIỆN CHÍNH
// =========================================================
window.updateCommandCenterUI = function() {
    if (!document.getElementById('quant-command-center')) return;

    // --- 1. CORE FLOW ---
    let nfEl = document.getElementById('cc-net-flow');
    let nfBox = document.getElementById('cc-nf-box');
    if (nfEl && window.scNetFlow !== undefined) {
        nfEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + formatCompactUSD(Math.abs(window.scNetFlow));
        nfEl.style.color = window.scNetFlow >= 0 ? '#0ECB81' : '#F6465D';
        if (nfBox) nfBox.style.borderLeftColor = window.scNetFlow >= 0 ? '#0ECB81' : '#F6465D';
    }

    // --- 2. NHIỆT KẾ BOT (ALGO URGENCY) ---
    let speed = window.scSpeedWindow ? window.scSpeedWindow.reduce((s, x) => s + x.v, 0) / 5 : 0;
    let speedEl = document.getElementById('cc-speed');
    if (speedEl) speedEl.innerText = '$' + formatCompactUSD(speed) + ' /s';

    let algoStatus = document.getElementById('cc-algo-status');
    let algoBox = document.getElementById('cc-algo-box');
    
    let now = Date.now();
    let recentSweeps = window.scTickHistory ? window.scTickHistory.filter(x => (now - x.t <= 15000) && x.q > 0) : [];
    let shortNetFlow = recentSweeps.reduce((s, x) => s + (x.dir ? x.v : -x.v), 0);
    let isHighUrgency = speed > 50000 || (recentSweeps.length > 20);

    if (algoStatus && algoBox) {
        let z = window.quantStats.zScore || 0;
        let ofi = window.quantStats.ofi || 0;
        
        let ofiText = ofi >= 0 ? `+${ofi.toFixed(2)}` : `${ofi.toFixed(2)}`;
        let zText = `Z:${z.toFixed(1)}`;
        
        if (z > 3.0) { 
            if (ofi > 0.5) {
                algoStatus.innerHTML = `🚀 ĐỘT BIẾN MUA [${zText} | OFI ${ofiText}]`;
                algoStatus.style.color = '#00F0FF'; algoBox.style.borderLeftColor = '#00F0FF';
            } else if (ofi < -0.5) {
                algoStatus.innerHTML = `🩸 ĐỘT BIẾN BÁN [${zText} | OFI ${ofiText}]`;
                algoStatus.style.color = '#FF007F'; algoBox.style.borderLeftColor = '#FF007F';
            } else {
                algoStatus.innerHTML = `⚔️ TRANH CHẤP GẮT [${zText}]`;
                algoStatus.style.color = '#F0B90B'; algoBox.style.borderLeftColor = '#F0B90B';
            }
        } else if (isHighUrgency) {
            algoStatus.innerHTML = shortNetFlow > 0 ? `🤖 SWEEP GOM [OFI ${ofiText}]` : `🤖 SWEEP XẢ [OFI ${ofiText}]`;
            algoStatus.style.color = shortNetFlow > 0 ? '#2af592' : '#cb55e3';
            algoBox.style.borderLeftColor = shortNetFlow > 0 ? '#2af592' : '#cb55e3';
        } else {
            algoStatus.innerHTML = `🤖 TĨNH LẶNG [${zText}]`;
            algoStatus.style.color = '#848e9c'; algoBox.style.borderLeftColor = '#848e9c';
        }
    }

    let ofiBarBuy = document.getElementById('cc-ofi-bar-buy');
    let ofiBarSell = document.getElementById('cc-ofi-bar-sell');
    if (ofiBarBuy && ofiBarSell) {
        let buyPct = window.quantStats.buyDominance || 50;
        let sellPct = 100 - buyPct;
        
        ofiBarBuy.style.width = `${buyPct}%`;
        ofiBarSell.style.width = `${sellPct}%`;
        
        ofiBarBuy.style.background = buyPct >= 70 ? '#00F0FF' : '#0ECB81'; 
        ofiBarBuy.style.boxShadow = buyPct >= 70 ? '0 0 5px #00F0FF' : 'none';

        ofiBarSell.style.background = sellPct >= 70 ? '#FF007F' : '#F6465D';
        ofiBarSell.style.boxShadow = sellPct >= 70 ? '0 0 5px #FF007F' : 'none';
    }
    
    // --- 3. HỒ SƠ DÒNG TIỀN ---
    let avgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 0;
    let avgEl = document.getElementById('cc-avg-ticket');
    if (avgEl) {
        let icon = avgTicket > 3000 ? '🐋' : '🦐';
        let color = avgTicket > 3000 ? '#F0B90B' : '#eaecef';
        avgEl.innerHTML = `${icon} <span style="color:${color}">$${formatCompactUSD(avgTicket)}</span>`;
    }

    let trend = window.quantStats.trend || 0;
    let trendEl = document.getElementById('cc-vwap-trend');
    if (trendEl) {
        trendEl.innerText = (trend > 0 ? '▲ +' : (trend < 0 ? '▼ ' : '')) + Math.abs(trend).toFixed(2) + '%';
        trendEl.style.color = trend >= 0 ? '#0ECB81' : '#F6465D';
    }

    // --- 4. RỦI RO THANH KHOẢN ---
    let spread = window.quantStats.spread || 0;
    let spVal = document.getElementById('cc-spread-val');
    let spMeter = document.getElementById('cc-spread-meter');
    if (spVal && spMeter) {
        spVal.innerText = spread.toFixed(2) + '%';
        let fill = Math.min(100, Math.max(5, (spread / 2.0) * 100));
        spMeter.style.width = fill + '%';
        if (spread < 0.2) { spMeter.style.background = '#0ECB81'; spVal.style.color = '#0ECB81'; }
        else if (spread < 0.8) { spMeter.style.background = '#F0B90B'; spVal.style.color = '#F0B90B'; }
        else { spMeter.style.background = '#F6465D'; spVal.style.color = '#F6465D'; }
    }

    let drop = window.quantStats.drop || 0;
    let dropEl = document.getElementById('cc-drop-val');
    if (dropEl) {
        dropEl.innerText = drop.toFixed(2) + '%';
        dropEl.style.color = drop < -1.0 ? '#00F0FF' : '#eaecef';
    }

    // --- 5. LA BÀN CÁ MẬP ---
    const wBuy = window.quantStats.whaleBuyVol || 0;
    const wSell = window.quantStats.whaleSellVol || 0;
    const totalWhale = wBuy + wSell;
    let smBuyPct = 50, smSellPct = 50;
    if (totalWhale > 0) { smBuyPct = (wBuy / totalWhale) * 100; smSellPct = (wSell / totalWhale) * 100; }
    
    let barBuy = document.getElementById('cc-whale-bar-buy');
    let barSell = document.getElementById('cc-whale-bar-sell');
    if(barBuy) barBuy.style.width = `${smBuyPct}%`; 
    if(barSell) barSell.style.width = `${smSellPct}%`;
    
    let volBuy = document.getElementById('cc-whale-vol-buy');
    if(volBuy) volBuy.innerText = 'B: $' + formatCompactUSD(wBuy);
    let volSell = document.getElementById('cc-whale-vol-sell');
    if(volSell) volSell.innerText = 'S: $' + formatCompactUSD(wSell);
    
    let ratioTxt = document.getElementById('cc-whale-ratio');
    if(ratioTxt) {
        ratioTxt.innerText = `${smBuyPct.toFixed(0)}% BUY`;
        ratioTxt.style.color = smBuyPct > 50 ? '#0ECB81' : '#F6465D';
    }

    // =========================================================
    // 6. 🧠 SUPER QUANT AI VERDICT V3 (CROSS-MARKET & MM TRACKER)
    // =========================================================
    const verdictEl = document.getElementById('ai-verdict-badge');
    if (verdictEl) {
        let _vTrend = window.quantStats.trend || 0;
        let _vWBuy = window.quantStats.whaleBuyVol || 0;
        let _vWSell = window.quantStats.whaleSellVol || 0;
        let _vTotalW = _vWBuy + _vWSell;
        let _vSPct = _vTotalW > 0 ? (_vWSell / _vTotalW) * 100 : 50;
        let _vWNet = _vWBuy - _vWSell;
        
        let txPerSec = window.scSpeedWindow ? (window.scSpeedWindow.length / 5) : 0;
        let zScore = window.quantStats.zScore || 0;
        let ofi = window.quantStats.ofi || 0;

        let t_chart = window.currentChartToken || {};
        let dailyTx = t_chart.tx_count || 86400; 
        let dailyVol = t_chart.volume?.daily_total || 1000000;
        
        let normalTxPerSec = dailyTx / 86400; 
        let normalAvgTicket = dailyVol / dailyTx;

        let isCrazyFast = txPerSec > Math.max(3, normalTxPerSec * 4);
        let isRetailTicket = avgTicket < Math.max(100, normalAvgTicket * 0.3);
        let isHeavyDump = _vWNet < -(Math.max(10000, normalAvgTicket * 20));

        let hasFutures = document.getElementById('cc-futures-status')?.innerText === '🟢 ACTIVE';
        let fFunding = window.quantStats.fundingRateObj ? window.quantStats.fundingRateObj.rate : 0;
        let liqLong = window.quantStats.longLiq || 0;
        let liqShort = window.quantStats.shortLiq || 0;
        
        // 3. Tính toán Spoofing (Đã nâng cấp hỗ trợ Map)
        let sBids = 0, sAsks = 0;
        if (window.scLocalOrderBook && window.scLastPrice > 0) {
            let pLimitDown = window.scLastPrice * 0.99;
            let pLimitUp = window.scLastPrice * 1.01;
            
            let bBook = window.scLocalOrderBook.bids;
            let aBook = window.scLocalOrderBook.asks;

            if (bBook) {
                if (bBook instanceof Map) {
                    for (let [p, v] of bBook) { if (parseFloat(p) >= pLimitDown) sBids += parseFloat(p) * v; }
                } else {
                    for (let p in bBook) { if (parseFloat(p) >= pLimitDown) sBids += parseFloat(p) * bBook[p]; }
                }
            }
            if (aBook) {
                if (aBook instanceof Map) {
                    for (let [p, v] of aBook) { if (parseFloat(p) <= pLimitUp) sAsks += parseFloat(p) * v; }
                } else {
                    for (let p in aBook) { if (parseFloat(p) <= pLimitUp) sAsks += parseFloat(p) * aBook[p]; }
                }
            }
        }
        let isSpoofBids = (sAsks > 0 && sBids > sAsks * 4) && (_vTrend < -0.1) && (!isCrazyFast);
        let isSpoofAsks = (sBids > 0 && sAsks > sBids * 4) && (_vTrend > 0.1) && (!isCrazyFast);

        if (hasFutures) {
            if (zScore > 2.5 && ofi > 0.6 && liqShort > 5000) {
                verdictEl.innerText = '🔥 SHORT SQUEEZE (DIỆT SHORT)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(0, 240, 255, 0.2); color: #00F0FF; border: 1px solid #00F0FF; animation: pulse-dot 0.5s infinite;';
            }
            else if (zScore > 2.5 && ofi < -0.6 && liqLong > 5000) {
                verdictEl.innerText = '🩸 LONG CASCADE (RŨ ĐÒN BẨY)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(246, 70, 93, 0.2); color: #F6465D; border: 1px solid #F6465D; animation: pulse-dot 0.5s infinite;';
            }
            else if (zScore > 2.0 && ofi > 0.7 && fFunding <= 0.01) {
                verdictEl.innerText = '🚀 BÙNG NỔ MUA (REAL MOMENTUM)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(14, 203, 129, 0.2); color: #0ECB81; border: 1px solid #0ECB81;';
            }
            else if (_vWNet < 0 && _vSPct > 65 && fFunding > 0.01 && zScore < 1.0) {
                verdictEl.innerText = '⚠️ TRAP DIVERGENCE (BẪY GIẢ)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(240, 185, 11, 0.2); color: #F0B90B; border: 1px solid #F0B90B;';
            }
            else if (isSpoofBids || isSpoofAsks) {
                verdictEl.innerText = isSpoofBids ? '⚠️ SPOOFING (TƯỜNG MUA ẢO)' : '⚠️ SPOOFING (TƯỜNG BÁN ẢO)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(240, 185, 11, 0.2); color: #F0B90B; border: 1px solid #F0B90B;';
            }
            else {
                verdictEl.innerText = '⚖️ TÍCH LŨY / CHOPPING';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1);';
            }
        } else {
            if (txPerSec < 0.5 && spread > 1.0) {
                verdictEl.innerText = '💀 ILLIQUID (THIẾU THANH KHOẢN)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(132, 142, 156, 0.2); color: #848e9c; border: 1px solid #848e9c;';
            }
            else if (zScore > 3.0 && ofi < -0.7 && isHeavyDump) {
                verdictEl.innerText = '🩸 DEV EXIT (XẢ NGẦM KHỦNG)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(246, 70, 93, 0.2); color: #F6465D; border: 1px solid #F6465D; animation: pulse-dot 0.3s infinite;';
            }
            else if (zScore > 2.0 && isRetailTicket && Math.abs(ofi) < 0.3) {
                verdictEl.innerText = '🤖 WASH TRADING (BOT QUAY TAY)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(203, 85, 227, 0.2); color: #cb55e3; border: 1px solid #cb55e3;';
            }
            else if (zScore > 2.5 && ofi > 0.8 && avgTicket < 500) {
                verdictEl.innerText = '🎈 EMPTY PUMP (BƠM RỖNG / LÙA GÀ)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(246, 70, 93, 0.2); color: #F6465D; border: 1px solid #F6465D; animation: pulse-dot 0.5s infinite;';
            }
            else if (zScore < 1.0 && ofi > 0.5 && avgTicket > 3000) {
                verdictEl.innerText = '🛡️ GOM HÀNG NGẦM (ACCUMULATION)';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(14, 203, 129, 0.2); color: #0ECB81; border: 1px solid #0ECB81;';
            }
            else {
                verdictEl.innerText = '⚖️ TỰ NHIÊN / SIDEO';
                verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1);';
            }
        }
    }
    
    // --- 7. BỘ ĐẾM NGƯỢC FUNDING RATE ---
    if (window.quantStats && window.quantStats.fundingRateObj) {
        let fObj = window.quantStats.fundingRateObj;
        let remain = fObj.nextTime - Date.now();
        
        let countdownStr = "";
        if (remain > 0) {
            let hrs = String(Math.floor(remain / (1000 * 60 * 60))).padStart(2, '0');
            let mins = String(Math.floor((remain % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            let secs = String(Math.floor((remain % (1000 * 60)) / 1000)).padStart(2, '0');
            countdownStr = `${hrs}:${mins}:${secs}`;
        } else {
            countdownStr = "00:00:00";
        }

        let sign = fObj.rate > 0 ? '+' : '';
        let color = fObj.rate > 0.01 ? '#F6465D' : (fObj.rate < -0.01 ? '#00F0FF' : '#eaecef');
        
        let fLbl = document.getElementById('cc-funding-lbl');
        if (fLbl) fLbl.innerText = `Funding (${fObj.interval}h)`;

        let fEl = document.getElementById('cc-funding-val');
        if (fEl) {
            fEl.innerHTML = `<span style="font-family:var(--font-num); color:#848e9c">${countdownStr}</span><span style="color:#527c82; margin: 0 4px;">/</span><span style="color:${color}">${sign}${fObj.rate.toFixed(4)}%</span>`;
        }
    }

    // =========================================================
    // KÍCH HOẠT MARKER SQUEEZE TRÊN CHART VÀ RENDER QUANT ENGINE
    // =========================================================
    let sq = computeSqueezeZone();
    if (sq.confirmed && window.scChartMarkers) {
        let currentTime = Date.now();
        // Chống Spam Mũi Tên: Mỗi 10 giây mới in 1 mũi tên Squeeze lên Chart
        if (!window._lastSqueezeMarkerTime || currentTime - window._lastSqueezeMarkerTime > 10000) {
            const markerTime = Math.floor(currentTime / 1000);
            const sqMarker = {
                time: markerTime,
                position: sq.side === 'short' ? 'belowBar' : 'aboveBar',
                color: sq.side === 'short' ? '#00F0FF' : '#FF007F',
                shape: sq.side === 'short' ? 'arrowUp' : 'arrowDown',
                text: sq.side === 'short' ? '🔥SQ' : '🩸SQ',
                fishType: 'whale', // Đè lên mọi filter để luôn hiển thị
                size: 2
            };
            window.scChartMarkers.push(sqMarker);
            if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
            window._lastSqueezeMarkerTime = currentTime;
        }
    }

    if (typeof window.evaluateQuantVerdict === 'function') {
        window.evaluateQuantVerdict();
    }
};

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


function connectRealtimeChart(t, isTimeSwitch = false) {
    // --- 1. CHUẨN HÓA TÊN KÊNH CHO ALPHA TOKEN ---
    let rawId = (t.alphaId || t.id || '').toLowerCase().replace('alpha_', ''); 
    let sysSymbol = (t.symbol || '').toLowerCase() + 'usdt';
    let contract = t.contract;
    let chainId = t.chainId || t.chain_id || 56;
    
    // BIẾN QUAN TRỌNG NHẤT: Định danh chuẩn để Binance không bơ dữ liệu
    let streamPrefix = rawId ? `alpha_${rawId}usdt` : sysSymbol;

    // [CÚ PHÁP CHỐNG KHỰNG BINANCE] Đổi khung giờ: KHÔNG ngắt mạng, chỉ đăng ký nến mới
    if (isTimeSwitch && chartWs && chartWs.readyState === 1) { 
        if (window.oldChartInterval && window.oldChartInterval !== 'tick') {
            let oldK = contract ? `came@${contract}@${chainId}@kline_${window.oldChartInterval}` : `${streamPrefix}@kline_${window.oldChartInterval}`;
            chartWs.send(JSON.stringify({ "method": "UNSUBSCRIBE", "params": [oldK], "id": Date.now() }));
        }

        if (window.currentChartInterval !== 'tick') {
            let newK = contract ? `came@${contract}@${chainId}@kline_${window.currentChartInterval}` : `${streamPrefix}@kline_${window.currentChartInterval}`;
            chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": [newK], "id": Date.now() + 1 }));
        }
        return; // Dừng hàm tại đây, giữ nguyên luồng Live Trade đang chảy!
    }

    if (chartWs) { chartWs.close(); }

    // Khởi tạo Web Worker nếu chưa có
    if (!window.quantWorker) {
        window.quantWorker = new Worker('public/js/quant-worker.js');
        
       // Lắng nghe kết quả từ Worker trả về
    window.quantWorker.onmessage = function(e) {
        if (e.data.cmd === 'STATS_UPDATE') {
            // 1. DÙNG OBJECT.ASSIGN ĐỂ HỢP NHẤT (MERGE) DATA
            // Chống ghi đè làm mất dữ liệu Cá Voi/Cá Mập và dữ liệu Phái Sinh (Funding, Liq)
            Object.assign(window.quantStats, e.data.stats);

            // [ĐÃ XÓA] Phần 2: Đã loại bỏ việc gọi evaluateQuantVerdict() ở đây để giảm tải CPU.
            // Việc phân tích và đổi chữ sẽ được gom lại chạy 1 lần duy nhất bên trong hàm updateCommandCenterUI().
        }
    };
    } // (Dấu ngoặc này đóng cho khối lệnh bọc bên ngoài của bạn, cứ giữ nguyên nhé)
    
    // Gửi lệnh Clear Data cũ cho Worker
    window.quantWorker.postMessage({ cmd: 'INIT' });

    // [FIX BÓNG MA] Tạo Session ID dựa trên thời gian thực để khóa luồng dữ liệu
    window.activeChartSessionId = Date.now() + '_' + t.symbol;
    let currentSession = window.activeChartSessionId;

    // 1. KHỞI TẠO BỘ NHỚ RAM STATE (CÓ BỘ ĐỆM CACHE CHỐNG MẤT DỮ LIỆU)
    if (!window.AlphaChartState) window.AlphaChartState = {};
    let sym = t.symbol || 'UNKNOWN';

    if (!window.AlphaChartState[sym]) {
        window.AlphaChartState[sym] = {
            speedWindow: [], netFlow: 0, whaleCount: 0, totalVol: 0, tradeCount: 0,
            tickHistory: [], chartMarkers: [], lastPrice: parseFloat(t.price) || 0, lastTradeDir: undefined,
            cWhale: 0, cShark: 0, cDolphin: 0, cSweep: 0
        };
    }

    let cache = window.AlphaChartState[sym];
    window.scSpeedWindow = cache.speedWindow; window.scNetFlow = cache.netFlow; 
    window.scWhaleCount = cache.whaleCount; window.scTotalVol = cache.totalVol; 
    window.scTradeCount = cache.tradeCount; window.scLastPrice = cache.lastPrice; 
    window.scLastTradeDir = cache.lastTradeDir; window.scTickHistory = cache.tickHistory; 
    window.scChartMarkers = cache.chartMarkers;

    window.scCWhale = cache.cWhale || 0;
    window.scCShark = cache.cShark || 0;
    window.scCDolphin = cache.cDolphin || 0;
    window.scCSweep = cache.cSweep || 0;
    window.quantStats = cache.quantStats || { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };

    window.scCurrentCluster = null;

    window.applyFishFilter = function() {
        let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
        if (!activeSeries) return;
        let filterEl = document.getElementById('sc-fish-filter');
        let fVal = filterEl ? filterEl.value : 'sweep';

        if (fVal === 'none' || (window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s')) {
            try { activeSeries.setMarkers([]); } catch (e) {}
            return;
        }

        let filteredMarkers = window.scChartMarkers.filter(m => {
            if (!m.fishType) return true; 
            if (fVal === 'whale' && m.fishType === 'whale') return true;
            if (fVal === 'shark' && (m.fishType === 'whale' || m.fishType === 'shark')) return true;
            if (fVal === 'dolphin' && (m.fishType === 'whale' || m.fishType === 'shark' || m.fishType === 'dolphin')) return true;
            if (fVal === 'sweep') return true;
            return false;
        });

        let intervalSec = 0;
        if (window.currentChartInterval === '1m') intervalSec = 60;
        else if (window.currentChartInterval === '5m') intervalSec = 300;
        else if (window.currentChartInterval === '15m') intervalSec = 900;
        else if (window.currentChartInterval === '1h') intervalSec = 3600;
        else if (window.currentChartInterval === '4h') intervalSec = 14400;
        else if (window.currentChartInterval === '1d') intervalSec = 86400;

        let processedMarkers = filteredMarkers.map(m => {
            let newTime = m.time;
            if (intervalSec > 0) {
                newTime = Math.floor(m.time / intervalSec) * intervalSec;
            }
            return { ...m, time: newTime };
        });

        processedMarkers.sort((a, b) => a.time - b.time);
        try { activeSeries.setMarkers(processedMarkers); } catch (e) {}
    };

    window.isHeatmapOn = true;
    window.toggleHeatmapUI = function() {
        window.isHeatmapOn = !window.isHeatmapOn;
        let icon = document.getElementById('sc-heatmap-icon');
        if (icon) {
            icon.className = window.isHeatmapOn ? 'fas fa-eye' : 'fas fa-eye-slash';
            icon.style.color = window.isHeatmapOn ? '#41e6e7' : '#527c82';
        }
        if (!window.isHeatmapOn && window.scActivePriceLines) {
            window.scActivePriceLines.forEach(line => {
                try { line.applyOptions({ color: 'transparent' }); } catch(e) {}
            });
        }
    };

    window.liveTradesQueue = [];
    window.isLiveTradesRendering = false;

    window.flushSmartTape = function(cluster) {
        if (!cluster) return;
        let filterEl = document.getElementById('sc-fish-filter');
        if (filterEl && filterEl.value === 'none') return;
        
        let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
        let whaleMin = Math.max(15000, currentAvgTicket * 15);
        let sharkMin = Math.max(5000, currentAvgTicket * 7);
        let dolphinMin = Math.max(2000, currentAvgTicket * 3);

        let isWhale   = cluster.vol >= whaleMin;
        let isShark   = cluster.vol >= sharkMin && cluster.vol < whaleMin;
        let isDolphin = cluster.vol >= dolphinMin && cluster.vol < sharkMin;
        let isSweep   = cluster.count >= 6 && cluster.vol >= 1000;

        let icon = ''; let fontWeight = 'normal';
        if (isWhale) { icon = '🐋 '; fontWeight = '800'; }
        else if (isShark) { icon = '🦈 '; fontWeight = '700'; }
        else if (isDolphin) { icon = '🐬 '; fontWeight = '600'; }
        else if (isSweep) { icon = '🤖 '; fontWeight = '600'; }

        let c_up = '#0ECB81'; let c_down = '#F6465D';
        let c_bg_up = 'transparent'; let c_bg_down = 'transparent';
        if (isWhale || isShark || isSweep) {
            c_bg_up = 'rgba(14, 203, 129, 0.15)'; 
            c_bg_down = 'rgba(246, 70, 93, 0.15)';
        }

        let row = document.createElement('div');
        row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:3px 4px; border-bottom:1px solid #1A1F26; background:${cluster.dir ? c_bg_up : c_bg_down}; font-weight:${fontWeight}; font-variant-numeric: tabular-nums; transition: 0.1s;`;
        let timeStr = new Date(cluster.t).toLocaleTimeString('en-GB',{hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'});
        row.innerHTML = `
            <span style="color:${cluster.dir ? c_up : c_down}; flex: 1; text-align: left; overflow: hidden; white-space: nowrap;">${formatPrice(cluster.p)}</span>
            <span style="color:#eaecef; flex: 1; text-align: center; white-space: nowrap;">${icon}$${formatCompactUSD(cluster.vol)}</span>
            <span style="color:#707A8A; flex: 1; text-align: right; white-space: nowrap;">${timeStr}</span>
        `;

        window.liveTradesQueue.push({ el: row, isHighlight: isWhale || isShark, dir: cluster.dir, c_up, c_down, c_bg_up, c_bg_down });

        if (!window.isLiveTradesRendering) {
            window.isLiveTradesRendering = true;
            requestAnimationFrame(() => {
                let tradesBox = document.getElementById('sc-live-trades');
                if (tradesBox && window.liveTradesQueue.length > 0) {
                    let fragment = document.createDocumentFragment();
                    let items = window.liveTradesQueue.splice(0, window.liveTradesQueue.length);
                    for (let i = items.length - 1; i >= 0; i--) {
                        fragment.appendChild(items[i].el);
                        if (items[i].isHighlight) {
                            items[i].el.style.background = items[i].dir ? items[i].c_up : items[i].c_down;
                            items[i].el.style.color = '#000000';
                            setTimeout(() => { 
                                items[i].el.style.background = items[i].dir ? items[i].c_bg_up : items[i].c_bg_down; 
                                items[i].el.style.color = ''; 
                            }, 100);
                        }
                    }
                    tradesBox.insertBefore(fragment, tradesBox.firstChild);
                    while (tradesBox.children.length > 30) tradesBox.removeChild(tradesBox.lastChild);
                }
                window.isLiveTradesRendering = false;
            });
        }

        if (isDolphin || isShark || isWhale || isSweep) {
            if (isWhale) { window.scCWhale = (window.scCWhale||0) + 1; let el = document.getElementById('sc-stat-whale'); if(el) el.innerText = window.scCWhale; }
            else if (isShark) { window.scCShark = (window.scCShark||0) + 1; let el = document.getElementById('sc-stat-shark'); if(el) el.innerText = window.scCShark; }
            else if (isDolphin) { window.scCDolphin = (window.scCDolphin||0) + 1; let el = document.getElementById('sc-stat-dolphin'); if(el) el.innerText = window.scCDolphin; }
            else if (isSweep) { window.scCSweep = (window.scCSweep||0) + 1; let el = document.getElementById('sc-stat-sweep'); if(el) el.innerText = window.scCSweep; }

            let fishType = isWhale ? 'whale' : (isShark ? 'shark' : (isDolphin ? 'dolphin' : 'sweep'));
            let textMsg = icon + '$' + formatCompactUSD(cluster.vol);
            if (isSweep && !isDolphin && !isShark && !isWhale) textMsg = '🤖 SWEEP';
            let markerColor = cluster.dir ? (window.currentTheme === 'trad' ? '#0ECB81' : '#2af592') : (window.currentTheme === 'trad' ? '#F6465D' : '#cb55e3');

            window.scChartMarkers.push({
                time: cluster.timeSec, position: cluster.dir ? 'belowBar' : 'aboveBar', 
                color: markerColor, shape: cluster.dir ? 'arrowUp' : 'arrowDown', text: textMsg,
                fishType: fishType
            });
            if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            
            if (isWhale || isShark) {
                if (cluster.dir) window.quantStats.whaleBuyVol += cluster.vol;
                else window.quantStats.whaleSellVol += cluster.vol;
                window.logToSniperTape(cluster.dir, cluster.vol, isWhale ? '🐋 VOI' : '🦈 MẬP', cluster.p);
            }
            else if (isSweep) {
                if (cluster.dir) window.quantStats.botSweepBuy++;
                else window.quantStats.botSweepSell++;
                window.logToSniperTape(cluster.dir, cluster.vol, '🤖 SWEEP', cluster.p);
            }
            else if (isDolphin) {
                window.logToSniperTape(cluster.dir, cluster.vol, '🐬 HEO', cluster.p);
            }
        }
    };

    try { chartWs = new WebSocket('wss://nbstream.binance.com/w3w/wsa/stream'); } catch(e) { return; }

    // --- 2. ĐĂNG KÝ HÀNG LOẠT BẰNG STREAM PREFIX CHUẨN ---
    let params = [
        `${streamPrefix}@aggTrade`,
        `${streamPrefix}@bookTicker`,
        'came@allTokens@ticker24',
        `${streamPrefix}@fulldepth@500ms`,
        `${streamPrefix}@kline_1m`,
        `${streamPrefix}@kline_5m`,
        `${streamPrefix}@kline_15m`,
        `${streamPrefix}@kline_1h`
    ];
    window.scActivePriceLines = []; 
    
    // [FIX LỖI NHẢY CHART] Kiểm tra để không đăng ký trùng lặp nếu khung chart đang chọn đã nằm trong danh sách mặc định ở trên
    if (window.currentChartInterval !== 'tick') {
        let targetKline = contract ? `came@${contract}@${chainId}@kline_${window.currentChartInterval}` : `${streamPrefix}@kline_${window.currentChartInterval}`;
        if (!params.includes(targetKline)) {
            params.push(targetKline);
        }
    }

   // ==========================================
    // 2. CỖ MÁY UI CHẠY NGẦM (MỖI GIÂY 1 LẦN) - ĐÃ FIX LỖI CRASH
    // ==========================================
    if (window.scCalcInterval) clearInterval(window.scCalcInterval);
    window.scCalcInterval = setInterval(() => {
        if (window.activeChartSessionId !== currentSession) return;
        if (!window.scTickHistory || window.scTickHistory.length === 0) return;
        
        // 🔥 ĐÂY LÀ NHỊP TIM ĐÃ BỊ XÓA NHẦM - CHÚNG TA BƠM NÓ TRỞ LẠI!
        const now = Date.now();

        // Tối ưu hóa Garbage Collection bằng Filter (V8 Engine xử lý siêu tốc)
        window.scTickHistory = window.scTickHistory.filter(x => now - x.t <= 300000);

        // ========================================================
        // ========================================================
// THÊM MỚI: BẮN MARKER BẮT ĐỈNH/ĐÁY TỪ WORKER LÊN BẢNG CHART
// ========================================================
let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;
if (activeSeries && window.quantStats.flags && window.scTickHistory.length > 0) {
let flags = window.quantStats.flags;
let timeSec = Math.floor(Date.now() / 1000);

        let lastMarker = window.scChartMarkers[window.scChartMarkers.length - 1];
        let canDraw = !lastMarker || (timeSec - lastMarker.time > 5);

        if (canDraw) {
// Ưu tiên 1: Stop-Hunt và Exhausted
if (flags.stopHunt) {
window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#00F0FF', shape: 'arrowUp', text: '🪝 STOP-HUNT' });
if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
}
else if (flags.exhausted) {
let markerText = flags.wallHit ? '🛡️ WALL HIT' : '🪫 EXHAUSTED';
let markerColor = flags.wallHit ? '#F0B90B' : '#848e9c';
window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: markerColor, shape: 'arrowUp', text: markerText });
if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
}

            // Ưu tiên 2: Iceberg (Bắt đúng Tường Xanh / Tường Đỏ)
            else if (flags.bullishIceberg || flags.icebergAbsorption) {
                window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#0ECB81', shape: 'arrowUp', text: '🧊 ICEBERG ĐỠ GIÁ', fishType: 'whale' });
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
            else if (flags.bearishIceberg) {
                window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F6465D', shape: 'arrowDown', text: '🧊 ICEBERG ĐÈ GIÁ', fishType: 'whale' });
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
            
            // Ưu tiên 3: Spoofing (Đã tách Tường Mua Ảo và Tường Bán Ảo)
            else if (flags.spoofingBuyWall) {
                window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#F0B90B', shape: 'arrowUp', text: '⚠️ TƯỜNG MUA ẢO' });
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
            else if (flags.spoofingSellWall) {
                window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F0B90B', shape: 'arrowDown', text: '⚠️ TƯỜNG BÁN ẢO' });
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
            else if (flags.spoofingDetected) { // Fallback chống sập nếu Worker cũ chưa load
                window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F0B90B', shape: 'arrowDown', text: '⚠️ SPOOFING WALL' });
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
        }
    }
    // ========================================================

        // --- CẬP NHẬT UI ALGO LIMIT (Dữ liệu toán học đã được Worker tính ngầm) ---
        let algoEl = document.getElementById('sc-algo-limit');
        if (algoEl && window.quantStats.algoLimit !== undefined) {
            let algoLmt = window.quantStats.algoLimit;
            let limitText = `< $${formatCompactUSD(algoLmt)}`;
            let limitColor = '#0ECB81'; let bgColor = 'rgba(14,203,129,0.1)'; let bdColor = 'rgba(14,203,129,0.3)';
            if (algoLmt < 10 || algoLmt < 50) { 
                limitColor = '#F6465D'; limitText = algoLmt < 10 ? '💀 DEAD' : limitText; 
                bgColor = 'rgba(246,70,93,0.1)'; bdColor = 'rgba(246,70,93,0.3)';
            } else if (algoLmt <= 200) { 
                limitColor = '#F0B90B'; bgColor = 'rgba(240,185,11,0.1)'; bdColor = 'rgba(240,185,11,0.3)';
            }
            algoEl.innerHTML = `ALGO LIMIT: ${limitText}`;
            algoEl.style.color = limitColor; algoEl.style.background = bgColor; algoEl.style.borderColor = bdColor;
        }

        

        // --- BẢN ĐỒ TƯỜNG THANH KHOẢN (HEATMAP) ---
        if (window.isHeatmapOn && window.scLocalOrderBook && (window.currentChartInterval === 'tick' || window.currentChartInterval === '1s')) {
            let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
            const processWalls = (orderMap, isAsk) => {
                let walls = [];
                // [BƯỚC 8 - TỐI ƯU RAM] Đọc dữ liệu từ Map để vẽ Heatmap
                if (orderMap instanceof Map) {
                    for (let [p, vol] of orderMap) {
                        let price = parseFloat(p); let valUSD = price * vol;
                        if (valUSD > 500) walls.push({ p: price, v: valUSD, isAsk: isAsk });
                    }
                } else {
                    for (let p in orderMap) {
                        let price = parseFloat(p); let valUSD = price * orderMap[p];
                        if (valUSD > 500) walls.push({ p: price, v: valUSD, isAsk: isAsk });
                    }
                }
                return walls.sort((a, b) => b.v - a.v).slice(0, 5); 
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

                    if (i < window.scActivePriceLines.length) { window.scActivePriceLines[i].applyOptions({ price: wall.p, color: lineColor, lineWidth: thickness }); } 
                    else {
                        let priceLine = window.tvHeatmapLayer.createPriceLine({ price: wall.p, color: lineColor, lineWidth: thickness, lineStyle: 0, axisLabelVisible: false, title: '' });
                        window.scActivePriceLines.push(priceLine);
                    }
                }
                for (let i = newWalls.length; i < window.scActivePriceLines.length; i++) { window.scActivePriceLines[i].applyOptions({ color: 'transparent' }); }
            }
        }

        // --- BẮT BÀI ICEBERG ABSORPTION ---
        if (!window.scLastIcebergTime) window.scLastIcebergTime = 0;
        if (now - window.scLastIcebergTime > 10000 && window.scTickHistory && window.scTickHistory.length > 10) {
            let recent3s = window.scTickHistory.filter(x => now - x.t <= 3000);
            if (recent3s.length > 5) {
                let buyVol3s = recent3s.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
                let sellVol3s = recent3s.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
                let pMax = Math.max(...recent3s.map(x => x.p)); let pMin = Math.min(...recent3s.map(x => x.p));
                let priceDiffPct = pMin > 0 ? ((pMax - pMin) / pMin) * 100 : 1;
                let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
                let volThreshold = Math.max(10000, currentAvgTicket * 15);
                let isTrad = window.currentTheme === 'trad';
                let timeSec = window.scCurrentCluster ? window.scCurrentCluster.timeSec : Math.floor(now / 1000);
                let activeSeries = window.currentChartInterval === 'tick' ? tvLineSeries : tvCandleSeries;

                if (activeSeries) {
                    if (sellVol3s > buyVol3s * 3 && sellVol3s > volThreshold && priceDiffPct < 0.05) {
                        window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: isTrad ? '#0ECB81' : '#00F0FF', shape: 'arrowUp', text: '🧊 BUY ABSORPTION', fishType: 'whale' });
                        window.scLastIcebergTime = now;
                    }
                    else if (buyVol3s > sellVol3s * 3 && buyVol3s > volThreshold && priceDiffPct < 0.05) {
                        window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: isTrad ? '#F6465D' : '#FF007F', shape: 'arrowDown', text: '🧊 SELL ABSORPTION', fishType: 'whale' });
                        window.scLastIcebergTime = now;
                    }
                    if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                }
            }
        }

        // --- ĐỒNG BỘ RAM CACHE ---
        let sym = window.currentChartToken ? window.currentChartToken.symbol : 'UNKNOWN';
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
            window.AlphaChartState[sym].cWhale = window.scCWhale;
            window.AlphaChartState[sym].cShark = window.scCShark;
            window.AlphaChartState[sym].cDolphin = window.scCDolphin;
            window.AlphaChartState[sym].cSweep = window.scCSweep;
            window.AlphaChartState[sym].quantStats = window.quantStats;
        }

        // Tối ưu hóa Garbage Collection bằng Filter (V8 Engine xử lý siêu tốc)
        window.scSpeedWindow = window.scSpeedWindow.filter(x => now - x.t <= 5000);

        // --- CẬP NHẬT CÁC WIDGET GIAO DIỆN ---
        let displaySpeed = window.scSpeedWindow.filter(x => now - x.t <= 5000).reduce((s, x) => s + x.v, 0) / 5;
        let speedElUI = document.getElementById('sc-stat-match-speed');
        if(speedElUI) speedElUI.innerText = '$' + formatCompactUSD(displaySpeed) + ' /s';

        let avgElUI = document.getElementById('sc-stat-avg-ticket');
        if (avgElUI) avgElUI.innerText = '$' + formatCompactUSD(window.scTotalVol / (window.scTradeCount || 1));

        let flowElUI = document.getElementById('sc-stat-net-flow');
        if (flowElUI) {
            flowElUI.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + formatCompactUSD(Math.abs(window.scNetFlow));
            flowElUI.style.color = window.scNetFlow >= 0 ? '#00F0FF' : '#FF007F';
        }

        if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
        if (typeof window.updateCommandCenterUI === 'function') window.updateCommandCenterUI();
        
    }, 1000);
// ==========================================
    // 3. CỖ MÁY XẢ BĂNG ĐẠN SMART TAPE (TỐC ĐỘ CAO 150ms)
    // ==========================================
    if (window.scTapeInterval) clearInterval(window.scTapeInterval);
    window.scTapeInterval = setInterval(() => {
        if (!window.scCurrentCluster) return;
        
        // Cứ 150ms (0.15 giây) là in lệnh ra màn hình một lần. Chống khựng, trôi siêu mượt!
        const nowMs = Date.now();
        if (nowMs - window.scCurrentCluster.startT >= 150) {
            window.flushSmartTape(window.scCurrentCluster);
            window.scCurrentCluster = null;
        }
    }, 150);
    chartWs.onopen = () => chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": params, "id": 1 }));

    chartWs.onmessage = (event) => {
        if (window.activeChartSessionId !== currentSession) return;
        const data = JSON.parse(event.data);
        if (!data.stream) return;

        // --- BỔ SUNG NHÁNH NÀY CHO WOKER V5 ĐỂ ĐO SPREAD ---
        if (data.stream.endsWith('@bookTicker')) {
            if (window.quantWorker) {
                window.quantWorker.postMessage({
                    cmd: 'BOOK_TICKER',
                    data: data.data
                });
            }
        }

        if (data.e === 'kline' || data.stream.includes('@kline_')) {
            let k = data.data.k; 
            if (!k) return; // An toàn: Chặn lỗi nếu cục data bị rỗng
            
            // --- CẬP NHẬT WIDGET DATA FLOW BÊN PHẢI ---
            if (['1m', '5m', '15m', '1h'].includes(k.i)) {
                // [FIX LỖI $NaN TẠI ĐÂY]: Ưu tiên k.q (Binance), nếu không có thì lấy k.v (DEX)
                let totalQuote = parseFloat(k.q !== undefined ? k.q : (k.v || 0)); 
                if (isNaN(totalQuote)) totalQuote = 0; // Chặn đứng chữ NaN
                
                let openPrice = parseFloat(k.o);  // Giá mở cửa
                let closePrice = parseFloat(k.c); // Giá đóng cửa
                let isUpCandle = closePrice >= openPrice;
                
                let nfEl = document.getElementById(`cc-cex-nf-${k.i}`);
                if (nfEl) {
                    let color = isUpCandle ? 'var(--term-up)' : 'var(--term-down)';
                    let icon = isUpCandle ? '▲' : '▼';
                    nfEl.innerHTML = `<span style="color:${color}">${icon} $${formatCompactUSD(totalQuote)}</span>`;
                }
            }

            // --- BẮT BỆNH VÀ CẬP NHẬT BIỂU ĐỒ CHART CHÍNH ---
            if (k.i !== window.currentChartInterval) return; // Chặn nếu khác khung
            if (window.currentChartInterval === 'tick') return;

            let rawTime = k.t; // Dùng k.t (Thời gian mở nến chuẩn của Binance)
            if (rawTime) {
                let candleTime = Math.floor(rawTime / 1000);
                let isUpCandle = parseFloat(k.c) >= parseFloat(k.o);
                
                // Đồng bộ Theme Màu Sắc
                let isTrad = window.currentTheme === 'trad';
                let volColor = isUpCandle ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)');

                if (tvCandleSeries) {
                    tvCandleSeries.update({ 
                        time: candleTime, 
                        open: parseFloat(k.o), high: parseFloat(k.h), 
                        low: parseFloat(k.l), close: parseFloat(k.c) 
                    });
                }
                
                if (tvVolumeSeries) {
                    // [FIX LỖI $NaN CHO BIỂU ĐỒ CHART]: Chống sập biểu đồ khi Volume bị lỗi
                    let volValue = parseFloat(k.q !== undefined ? k.q : (k.v || 0));
                    if (isNaN(volValue)) volValue = 0;
                    
                    tvVolumeSeries.update({ 
                        time: candleTime, 
                        value: volValue, 
                        color: volColor 
                    });
                }
                
                if (window.tvHeatmapLayer) {
                    window.tvHeatmapLayer.update({ time: candleTime, value: parseFloat(k.c) });
                }
            }
        }
        
        if (data.e === 'tickerList' || data.stream === 'came@allTokens@ticker24') {
            if (data.data && data.data.d) {
                let target1 = `${contract}@${chainId}`.toLowerCase();
                let target2 = `${contract}@CT_${chainId}`.toLowerCase();
                let ticker = data.data.d.find(item => item.ca.toLowerCase() === target1 || item.ca.toLowerCase() === target2);
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
        
        if (data.stream && data.stream.includes('@fulldepth') && data.data) {
            let currentSym = data.data.s || 'UNKNOWN';
            // [BƯỚC 8 - TỐI ƯU RAM] Khởi tạo bằng Map thay vì Object
            if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                window.scLocalOrderBook = { sym: currentSym, asks: new Map(), bids: new Map() };
            }
            // Cập nhật sổ lệnh thần tốc với cơ chế của Map (.set, .delete)
            (data.data.a || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.asks.delete(p); 
                else window.scLocalOrderBook.asks.set(p, q); 
            });
            (data.data.b || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.bids.delete(p); 
                else window.scLocalOrderBook.bids.set(p, q); 
            });
        }
        
        if (data.stream.endsWith('@aggTrade') || data.stream.endsWith('@trade')) {
    let p = parseFloat(data.data.p), q = parseFloat(data.data.q);
    
    // BINANCE BỊ LỖI TRƯỜNG "m", QUAY LẠI DÙNG THUẬT TOÁN TICK-TEST
    let isUp = p > window.scLastPrice ? true : (p < window.scLastPrice ? false : (window.scLastTradeDir ?? true));
    
    window.scLastTradeDir = isUp; window.scLastPrice = p;
    let valUSD = p * q, timeSec = Math.floor(data.data.T / 1000);
    let nowT = Date.now();

    window.scTickHistory.push({ t: nowT, p: p, q: q, v: valUSD, dir: isUp });
    // Bắn đạn sang cho Worker tính toán ngầm
            // Bắn đạn sang cho Worker tính toán ngầm
            window.quantWorker.postMessage({ cmd: 'TICK', data: { t: nowT, p: p, q: q, v: valUSD, dir: isUp } });

            // [NẶN NẾN 1S TỪ TICK]: Tính toán High/Low liên tục để nến có thân và râu chuẩn
            if (window.currentChartInterval === '1s') {
                if (!window.liveCandle1s || window.liveCandle1s.time !== timeSec) {
                    // Nếu sang giây mới -> Khởi tạo nến mới
                    window.liveCandle1s = { time: timeSec, open: p, high: p, low: p, close: p, vol: q };
                } else {
                    // Cập nhật đỉnh/đáy/đóng cửa trong cùng 1 giây
                    window.liveCandle1s.high = Math.max(window.liveCandle1s.high, p);
                    window.liveCandle1s.low = Math.min(window.liveCandle1s.low, p);
                    window.liveCandle1s.close = p;
                    window.liveCandle1s.vol += q; // Tích lũy volume
                }
            }

            // [CHỐNG SẬP CPU FINAL BOSS] Throttling giới hạn Render Canvas tối đa 6 FPS (150ms/lần)
            if (window.currentChartInterval === 'tick' || window.currentChartInterval === '1s') {
                if (nowT - (window.lastChartRender || 0) > 150) {
                    window.lastChartRender = nowT;
                    
                    let isTrad = window.currentTheme === 'trad';
                    let volColor = isUp ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)');

                    if (window.tvHeatmapLayer) window.tvHeatmapLayer.update({ time: timeSec, value: p });

                    // Khung TICK thì vẽ đường Line
                    if (window.currentChartInterval === 'tick' && tvLineSeries) {
                        tvLineSeries.update({ time: timeSec, value: p });
                        if (tvVolumeSeries) tvVolumeSeries.update({ time: timeSec, value: q, color: volColor });
                    } 
                    // Khung 1S thì vẽ nến Candlestick bằng bộ nặn nến chuẩn
                    else if (window.currentChartInterval === '1s' && tvCandleSeries && window.liveCandle1s) {
                        tvCandleSeries.update(window.liveCandle1s);
                        if (tvVolumeSeries) tvVolumeSeries.update({ time: timeSec, value: window.liveCandle1s.vol, color: volColor });
                    }
                }
            }

            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl) {
                        priceEl.innerText = '$' + formatPrice(window.scLastPrice);
                        priceEl.className = 'sc-live-price ' + (window.scLastTradeDir ? 'price-up' : 'price-down');
                    }
                    window.isRenderingPrice = false;
                });
            }

            if (!window.scCurrentCluster) {
                window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
            } else {
                if (window.scCurrentCluster.dir === isUp && (nowT - window.scCurrentCluster.startT < 1000)) {
                    window.scCurrentCluster.vol += valUSD; window.scCurrentCluster.count += 1; window.scCurrentCluster.p = p; 
                } else {
                    window.flushSmartTape(window.scCurrentCluster);
                    window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
                }
            }

            window.scTradeCount++; window.scTotalVol += valUSD; window.scNetFlow += isUp ? valUSD : -valUSD;
            
            // Mảng Speed cố định 500 phần tử (rất nhẹ, O(N) không đáng kể)
            if (window.scSpeedWindow.length > 500) window.scSpeedWindow.shift(); 
            window.scSpeedWindow.push({ t: nowT, v: valUSD });
        }
    };
            
    chartWs.onclose = () => { if (document.getElementById('super-chart-overlay').classList.contains('active')) { setTimeout(() => connectRealtimeChart(window.currentChartToken), 30000); } };
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

window.currentChartInterval = '1d'; 
let tvCandleSeries = null; 
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
        document.getElementById('sc-coin-symbol').innerText = (t.symbol || 'UNKNOWN') + '/USDT';
        let nameEl = document.getElementById('sc-coin-name');
        if (nameEl) nameEl.innerText = t.name || t.symbol; 
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
    
    // [FIX HEATMAP] Xóa sạch bộ nhớ các đường Heatmap cũ khi đập đi xây lại Chart
    window.scActivePriceLines = [];
    
    // [FIX LỖI MẤT TOOLTIP & LÀM GỌN UI MOBILE]
    container.innerHTML = `
        <div style="position: absolute; bottom: 25px; left: 15px; z-index: 2; font-family: var(--font-main); font-weight: 800; font-size: 20px; color: rgba(255,255,255,0.06); pointer-events: none; letter-spacing: 2px;">WAVE ALPHA</div>
        
        <div id="sc-custom-tooltip" style="position: absolute; top: 10px; left: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; color: #848e9c; font-size: 10.5px; font-family: var(--font-num); font-weight: 600; pointer-events: none; z-index: 10; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
            <span id="tp-o-wrap">O <span id="tp-o" style="color:#eaecef;">--</span></span>
            <span id="tp-h-wrap">H <span id="tp-h" style="color:#eaecef;">--</span></span>
            <span id="tp-l-wrap">L <span id="tp-l" style="color:#eaecef;">--</span></span>
            <span id="tp-c-wrap">C <span id="tp-c" style="color:#eaecef;">--</span></span>
            <span>Vol <span id="tp-v" style="color:#eaecef;">--</span></span>
        </div>
    `;
    
    // Nếu là bấm sang Token mới (không phải đổi khung giờ) -> Quét sạch bảng Live Trades
    if (!isTimeSwitch) {
        let tradesBox = document.getElementById('sc-live-trades');
        if (tradesBox) {
            tradesBox.innerHTML = '<div style="text-align:center; margin-top:20px; color:#5e6673; font-style:italic;">Connecting to Dex...</div>';
        }
        window.scCurrentCluster = null; // Cắt đứt cụm lệnh (Smart Tape) đang tính dở của token cũ

        // DÁN ĐOẠN RESET VÀO ĐÚNG CHỖ NÀY:
        window.quantStats = { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };
        let tape = document.getElementById('cc-sniper-tape');
        if(tape) tape.innerHTML = '<div style="font-size: 11px; color: #527c82; text-align: center; margin-top: 50px; font-style:italic;">Đang quét...</div>';
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

// [PROFESSIONAL] LOGIC RÊ CHUỘT HIỆN THÔNG SỐ (CROSSHAIR MOVE) CHUẨN TRADINGVIEW
        const tooltipEl = document.getElementById('sc-custom-tooltip');
        const tpSymbol = document.getElementById('tp-symbol');
        const tpV = document.getElementById('tp-v'); 
        
        tvChart.subscribeCrosshairMove((param) => {
            if (tooltipEl) tooltipEl.style.display = 'flex';
            if (tpSymbol) tpSymbol.innerText = (window.currentChartToken && window.currentChartToken.symbol) || '---';

            // [CHUẨN TRADINGVIEW] Khi rút chuột ra ngoài, không ẩn tooltip đi, mà giữ nguyên số liệu nến cuối
            if (param.point === undefined || !param.time || param.point.x < 0 || param.point.y < 0) {
                return; 
            }

            let dataPoint, ohlc, volume;
            const tpoWrap = document.getElementById('tp-o-wrap');
            const tphWrap = document.getElementById('tp-h-wrap');
            const tplWrap = document.getElementById('tp-l-wrap');
            const tpcWrap = document.getElementById('tp-c-wrap');
            
            if (window.currentChartInterval === 'tick') {
                // Khung Tick (Area Chart) chỉ hiện Price và Volume, ẩn O H L
                if (tvLineSeries) dataPoint = param.seriesData.get(tvLineSeries);
                if (dataPoint) {
                    if (tpoWrap) tpoWrap.style.display = 'none';
                    if (tphWrap) tphWrap.style.display = 'none';
                    if (tplWrap) tplWrap.style.display = 'none';
                    
                    if (tpcWrap) {
                        tpcWrap.innerHTML = `Price <span id="tp-c" style="color:#00F0FF;">${formatPrice(dataPoint.value)}</span>`;
                    }
                }
                if (tvVolumeSeries) {
                    volume = param.seriesData.get(tvVolumeSeries);
                    if (tpV) tpV.innerText = formatCompactUSD(volume ? volume.value : 0);
                }
            } else {
                // Khung Nến (Candlestick): Hiện đủ O H L C
                if (tvCandleSeries) ohlc = param.seriesData.get(tvCandleSeries);
                if (ohlc) {
                    if (tpoWrap) tpoWrap.style.display = 'inline';
                    if (tphWrap) tphWrap.style.display = 'inline';
                    if (tplWrap) tplWrap.style.display = 'inline';
                    
                    // Trả lại cấu trúc HTML ban đầu cho C
                    if (tpcWrap && !tpcWrap.innerHTML.startsWith('C')) {
                        tpcWrap.innerHTML = `C <span id="tp-c">--</span>`;
                    }
                    
                    const elO = document.getElementById('tp-o');
                    const elH = document.getElementById('tp-h');
                    const elL = document.getElementById('tp-l');
                    const elC = document.getElementById('tp-c');
                    
                    if (elO) elO.innerText = formatPrice(ohlc.open);
                    if (elH) elH.innerText = formatPrice(ohlc.high);
                    if (elL) elL.innerText = formatPrice(ohlc.low);
                    if (elC) {
                        elC.innerText = formatPrice(ohlc.close);
                        // Đổi màu C dựa theo nến Tăng (Xanh) hay Giảm (Đỏ)
                        elC.style.color = ohlc.close >= ohlc.open ? '#0ECB81' : '#F6465D';
                    }
                }
                
                if (tvVolumeSeries) {
                    volume = param.seriesData.get(tvVolumeSeries);
                    if (tpV) tpV.innerText = formatCompactUSD(volume ? volume.value : 0);
                }
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
            if (typeof connectRealtimeChart === 'function') { connectRealtimeChart(t, isTimeSwitch); }
if (typeof window.startFuturesEngine === 'function') { window.startFuturesEngine(t.symbol); }
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

window.changeChartInterval = function(interval, btnEl) {
    document.querySelectorAll('.sc-time-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    
    // FIX LỖI: Lưu lại khung giờ cũ trước khi đổi
    window.oldChartInterval = window.currentChartInterval; 
    
    window.currentChartInterval = interval;
    if (window.currentChartToken) {
        window.openProChart(window.currentChartToken, true); // Gọi lại hàm mở chart (chế độ switch)
    }
};

window.closeProChart = function() {
    // ---- [THÊM MỚI] ĐOẠN NÀY LÀ ĐỂ FIX RÒ RỈ BỘ NHỚ ----
    if (window.quantWorker) {
        window.quantWorker.terminate();
        window.quantWorker = null;
    }

    if (typeof window.stopFuturesEngine === 'function') window.stopFuturesEngine();
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

// Logic ẩn/hiện Tab chuẩn TradingView Zen Mode
window.toggleProSidePanel = function(tabId, btnElement) {
    const panelContent = document.getElementById('sc-panel-content');
    const allBtns = document.querySelectorAll('.sc-sidebar-icon');
    const allTabs = document.querySelectorAll('.sc-tab-content');

    // Nếu ấn lại nút đang active -> Gập panel lại (Zen Mode)
    if (btnElement && btnElement.classList.contains('active')) {
        panelContent.classList.toggle('collapsed');
        return; 
    }

    // Nếu panel đang gập mà ấn nút khác -> Mở panel ra
    if (panelContent.classList.contains('collapsed')) {
        panelContent.classList.remove('collapsed');
    }

    allBtns.forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    allTabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });

    let targetTab = document.getElementById('tab-' + tabId);
    if (targetTab) {
        targetTab.style.display = 'flex';
        targetTab.classList.add('active');
    }
};

function injectSmartMoneyTab() {
    const sidePanel = document.getElementById('sc-panel-content');
    if (!sidePanel || document.getElementById('tab-smartmoney')) return;

    const newTabContent = document.createElement('div');
    newTabContent.id = 'tab-smartmoney';
    newTabContent.className = 'sc-tab-content';
    // [FIX KHUNG GẦM] Bỏ height 100% gây tràn, chuyển thành flex layout nguyên thủy
    newTabContent.style.cssText = 'padding: 0; display: none; flex-direction: column; background: var(--term-bg);';
    
    newTabContent.innerHTML = `
        <div class="term-w-title" style="padding: 10px 15px 5px 15px; margin: 0; background: #12151A; border-bottom: 1px solid #1e2329; color:#EAECEF; font-size: 11px; flex-shrink: 0;">
            <i class="fas fa-microscope" style="color:var(--term-warn); margin-right: 5px;"></i> RADAR SMART MONEY (PRO)
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

            <div class="term-widget" style="border-left: 2px solid #3B82F6; margin-top: 4px;">
                <div class="term-w-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span>🏦 DÒNG TIỀN BINANCE DEX</span>
                    <span id="sm-bn-traders" style="color:#00F0FF; font-size: 8.5px; font-family:var(--font-num); font-weight:700;">-- Traders | -- KYC</span>
                </div>
                <div class="term-row"><span class="term-lbl">Net Flow (4H)</span><span id="sm-bn-netflow-4h" class="term-val">$--</span></div>
                <div class="term-row" style="border-top: 1px solid var(--term-border); padding-top: 4px; margin-top: 2px;"><span class="term-lbl">Net Flow (24H)</span><span id="sm-bn-netflow-24h" class="term-val">$--</span></div>
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

            <div class="term-widget" style="border-left: 2px solid #9945FF; margin-top: 6px; margin-bottom: 20px; padding: 8px;" id="sm-futures-sentiment-box">
                <div class="term-w-title" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #9945FF;"><i class="fas fa-satellite-dish"></i> VỊ THẾ CÁ MẬP (FUTURES)</span>
                    <span id="sm-fs-status" style="color:var(--term-warn); font-size: 8.5px;">⏳ Đang tải...</span>
                </div>

                <div class="term-row" style="margin-bottom: 2px;"><span class="term-lbl">Tỷ lệ Tiền (Margin)</span><span id="sm-fs-pos-ratio" class="term-val">--% L / --% S</span></div>
                <div style="display:flex; height:4px; border-radius:2px; overflow:hidden; background:var(--term-border); margin: 4px 0 8px 0;">
                    <div id="sm-fs-pos-long" style="height:100%; width:50%; background:var(--term-up); transition:0.5s;"></div>
                    <div id="sm-fs-pos-short" style="height:100%; width:50%; background:var(--term-down); transition:0.5s;"></div>
                </div>

                <div class="term-row" style="margin-bottom: 2px;"><span class="term-lbl">Tỷ lệ Người (Traders)</span><span id="sm-fs-acc-ratio" class="term-val">--% L / --% S</span></div>
                <div style="display:flex; height:4px; border-radius:2px; overflow:hidden; background:var(--term-border); margin: 4px 0 8px 0;">
                    <div id="sm-fs-acc-long" style="height:100%; width:50%; background:var(--term-up); transition:0.5s;"></div>
                    <div id="sm-fs-acc-short" style="height:100%; width:50%; background:var(--term-down); transition:0.5s;"></div>
                </div>

                <div class="term-row" style="border-top: 1px solid var(--term-border); padding-top: 6px; margin-bottom: 0;">
                    <span class="term-lbl">Taker Volume (5m)</span>
                    <div style="text-align:right;">
                        <div style="font-size: 10px; color: var(--term-up); font-weight: 800; font-family: var(--font-num);">Buy: <span id="sm-fs-taker-buy">$--</span></div>
                        <div style="font-size: 10px; color: var(--term-down); font-weight: 800; font-family: var(--font-num);">Sell: <span id="sm-fs-taker-sell">$--</span></div>
                    </div>
                </div>
            </div>

        </div> `;
    sidePanel.appendChild(newTabContent);
}

// 3. Phân tích dữ liệu API JSON & Trực quan hóa Insight
window.updateSmartMoneyRadar = function(apiData) {
    if (!apiData || !apiData.data) return;
    const d = apiData.data;

    const safeSet = (id, val, color) => {
        let el = document.getElementById(id);
        if (el) { el.innerHTML = val; if (color) el.style.color = color; }
    };

    const fmtUsd = (val) => val && !isNaN(val) ? '$' + formatCompactUSD(parseFloat(val)) : '$0';
    const fmtPrice = (val) => val && !isNaN(val) ? parseFloat(val).toPrecision(5) : '--';
// [UPDATE DATA FLOW HISTORY] Hàm format Net Flow +/-
    const fmtNetFlow = (val) => {
        let n = parseFloat(val || 0);
        if (isNaN(n) || n === 0) return '<span style="color:var(--term-dim)">$0</span>';
        let color = n >= 0 ? 'var(--term-up)' : 'var(--term-down)';
        let sign = n >= 0 ? '+' : '-';
        return `<span style="color:${color}">${sign}$${formatCompactUSD(Math.abs(n))}</span>`;
    };

    
    // --- LẤY DATA GỐC TỪ CHART ĐANG MỞ ĐỂ ĐỒNG BỘ TUYỆT ĐỐI ---
    let t_chart = window.currentChartToken || {};

    // --- ZONE 1: LOGIC RỦI RO SỐNG CÒN & TOKENOMICS ---
    // 1.1 Tập trung Ví
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

    // 1.2 Áp lực Dump
    // Đã gộp biến currentPrice để dùng chung, không bị lỗi trùng lặp nữa
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

    // 1.3 Lạm phát (Unlock / FDV vs MCAP) - ĐỒNG BỘ TUYỆT ĐỐI
    let mc = Number(t_chart.market_cap) || Number(d.marketCap) || 0;
    
    // Tính FDV = Giá * Tổng cung (ưu tiên lấy Max Supply All-chain nếu có)
    let maxSup = Number(d.allChainMaxSupply) || Number(d.totalSupply) || Number(d.maxSupply);
    let fdv = maxSup > 0 ? (currentPrice * maxSup) : (Number(d.fdv) || mc);

    // Chặn triệt để: FDV không bao giờ được nhỏ hơn MC
    if (fdv < mc) fdv = mc;

    let unlockPct = fdv > 0 ? (mc / fdv) * 100 : 100;
    if (unlockPct > 100) unlockPct = 100;

    // Bơm FDV lên thanh Topbar
    let topFdvEl = document.getElementById('sc-top-fdv');
    if (topFdvEl) topFdvEl.innerText = '$' + formatCompactNum(fdv);

    // Xử lý hiển thị UI cho Lạm phát
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

    // 1.4 Độ sâu thanh khoản (Liquidity vs MCAP)
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

    // --- ZONE 2: LOGIC DẤU CHÂN CÁ MẬP ---
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

    // --- ZONE 3: FLOW BINANCE ---
    let fShort = (n) => n ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(n) : '0';
    safeSet('sm-bn-traders', `${fShort(d.bnTraders)} Traders <span style="color:#527c82">|</span> ${fShort(d.bnUniqueHolders || d.kycHolderCount)} KYC`);
    
    let net4h = parseFloat(d.volume4hNetBinance || 0);
    safeSet('sm-bn-netflow-4h', (net4h >= 0 ? '+' : '') + fmtUsd(Math.abs(net4h)), net4h >= 0 ? '#0ECB81' : '#F6465D');

    let net24h = parseFloat(d.volume24hNetBinance || 0);
    safeSet('sm-bn-netflow-24h', (net24h >= 0 ? '+' : '') + fmtUsd(Math.abs(net24h)), net24h >= 0 ? '#0ECB81' : '#F6465D');

    // --- ZONE 4: ĐỘNG LƯỢNG KÉO CO (CVD) ---
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

// 🚀 ENGINE: HÚT DỮ LIỆU TÂM LÝ TAY TO PHÁI SINH TỪ BINANCE
window.fetchFuturesSentiment = async function(symbol) {
    if (!symbol) return;
    // Chuẩn hóa tên symbol cho API Binance Futures (ví dụ: BTCUSDT)
    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '') + 'USDT';

    const box = document.getElementById('sm-futures-sentiment-box');
    if (!box) return;

    // =======================================================
    // [FIX BÓNG MA DỮ LIỆU] Tẩy trắng toàn bộ UI về mặc định ngay khi bấm sang Coin mới
    // =======================================================
    document.getElementById('sm-fs-status').innerText = '⏳ Đang tải...';
    document.getElementById('sm-fs-status').style.color = 'var(--term-warn)';
    
    document.getElementById('sm-fs-pos-ratio').innerText = '--% L / --% S';
    document.getElementById('sm-fs-pos-long').style.width = '50%';
    document.getElementById('sm-fs-pos-short').style.width = '50%';
    
    document.getElementById('sm-fs-acc-ratio').innerText = '--% L / --% S';
    document.getElementById('sm-fs-acc-long').style.width = '50%';
    document.getElementById('sm-fs-acc-short').style.width = '50%';
    
    document.getElementById('sm-fs-taker-buy').innerText = '$--';
    document.getElementById('sm-fs-taker-sell').innerText = '$--';
    // =======================================================

    try {
        // Gắn timeout để không bị treo web nếu Binance lag
        const fetchTimeout = (url) => Promise.race([
            fetch(url), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
        ]);

        // Gọi 3 API cùng lúc (Song song) để tối ưu tốc độ
        const [posRes, accRes, takerRes] = await Promise.all([
            fetchTimeout(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${cleanSymbol}&period=5m&limit=1`),
            fetchTimeout(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${cleanSymbol}&period=5m&limit=1`),
            fetchTimeout(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${cleanSymbol}&period=5m&limit=1`)
        ]);

        const posData = await posRes.json();
        const accData = await accRes.json();
        const takerData = await takerRes.json();

        // Cập nhật Trạng thái thành công
        document.getElementById('sm-fs-status').innerText = '🟢 ĐÃ ĐỒNG BỘ';
        document.getElementById('sm-fs-status').style.color = '#0ECB81';

        // 1. Tỷ lệ Tiền (Khối lượng Vị thế Long/Short của Cá mập)
        if (posData && posData.length > 0) {
            let longPct = parseFloat(posData[0].longAccount) * 100;
            let shortPct = parseFloat(posData[0].shortAccount) * 100;
            document.getElementById('sm-fs-pos-ratio').innerText = `${longPct.toFixed(1)}% L / ${shortPct.toFixed(1)}% S`;
            document.getElementById('sm-fs-pos-long').style.width = `${longPct}%`;
            document.getElementById('sm-fs-pos-short').style.width = `${shortPct}%`;
        }

        // 2. Tỷ lệ Người (Số lượng tài khoản Cá mập Long/Short)
        if (accData && accData.length > 0) {
            let longPct = parseFloat(accData[0].longAccount) * 100;
            let shortPct = parseFloat(accData[0].shortAccount) * 100;
            document.getElementById('sm-fs-acc-ratio').innerText = `${longPct.toFixed(1)}% L / ${shortPct.toFixed(1)}% S`;
            document.getElementById('sm-fs-acc-long').style.width = `${longPct}%`;
            document.getElementById('sm-fs-acc-short').style.width = `${shortPct}%`;
        }

        // 3. Khối lượng khớp chủ động (Bọn nó đang Market Buy hay Market Sell)
        if (takerData && takerData.length > 0) {
            let buyVol = parseFloat(takerData[0].buyVol);
            let sellVol = parseFloat(takerData[0].sellVol);
            document.getElementById('sm-fs-taker-buy').innerText = '$' + formatCompactUSD(buyVol);
            document.getElementById('sm-fs-taker-sell').innerText = '$' + formatCompactUSD(sellVol);
        }

    } catch(e) {
        console.warn(`[Smart Money] Không có dữ liệu Futures cho ${cleanSymbol}`);
        document.getElementById('sm-fs-status').innerText = '🚫 KHÔNG CÓ DATA';
        document.getElementById('sm-fs-status').style.color = '#848e9c';
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
            
            // GỌI HÀM VỪA TẠO Ở ĐÂY ĐỂ NÓ CHẠY CÙNG LÚC!
            window.fetchFuturesSentiment(t.symbol);
            
        }, 100);
    }
};

// =========================================================
// 🚀 CỖ MÁY PHÁI SINH TỔNG HỢP (BẢN FINAL V5 - CHỐNG BÓNG MA)
// =========================================================
let liquidationWs = null;
let futuresDataInterval = null;

// Hàm cập nhật an toàn mọi ngóc ngách của giao diện
function updateAllDOM(id, text, color) {
    let elements = document.querySelectorAll(`[id="${id}"]`);
    elements.forEach(el => {
        if (text !== null) el.innerText = text;
        if (color !== null) el.style.color = color;
    });
}

window.startFuturesEngine = async function(symbol) {
    window.stopFuturesEngine();
    if (!symbol) return;

    window.activeFuturesSession = symbol.toUpperCase();
    let currentSession = window.activeFuturesSession;

    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    let fSymbol = cleanSymbol + 'USDT';
    let streamSymbol = fSymbol.toLowerCase();

    // Chỉ báo "ĐANG DÒ" DUY NHẤT LÚC MỚI BẤM SANG COIN MỚI
    updateAllDOM('cc-futures-status', '⏳ ĐANG DÒ...', '#F0B90B');
    updateAllDOM('cc-oi-val', '$--', null);
    updateAllDOM('cc-funding-lbl', 'Funding Rate', null);
    updateAllDOM('cc-funding-val', '--%', '#eaecef');

    if (!window.quantStats) window.quantStats = {};
    window.quantStats.longLiq = 0;
    window.quantStats.shortLiq = 0;
    window.quantStats.fundingRateObj = null; 
    window.quantStats.fundingInterval = null; // Biến lưu trữ Khung giờ thu phí

    const fetchWithTimeout = async (url) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const fetchRestData = async () => {
        if (window.activeFuturesSession !== currentSession) return false;
        try {
            // 1. CHỈ GỌI API TÌM KHUNG GIỜ FUNDING 1 LẦN DUY NHẤT
            if (!window.quantStats.fundingInterval) {
                try {
                    let fInfo = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/fundingInfo`);
                    let sInfo = fInfo.find(x => x.symbol === fSymbol);
                    window.quantStats.fundingInterval = sInfo ? sInfo.fundingIntervalHours : 8;
                } catch(e) { window.quantStats.fundingInterval = 8; }
            }

            // 2. CẬP NHẬT CHỈ SỐ RATE HIỆN TẠI
            let fundData = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${fSymbol}`);
            if (window.activeFuturesSession !== currentSession) return false;

            updateAllDOM('cc-futures-status', '🟢 ACTIVE', '#0ECB81');

            if (fundData && fundData.lastFundingRate) {
                window.quantStats.fundingRateObj = {
                    rate: parseFloat(fundData.lastFundingRate) * 100,
                    nextTime: fundData.nextFundingTime,
                    interval: window.quantStats.fundingInterval
                };
            }

            // 3. CẬP NHẬT OPEN INTEREST
            try {
                let oiData = await fetchWithTimeout(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${fSymbol}`);
                if (window.activeFuturesSession !== currentSession) return false;

                let currentPrice = window.scLastPrice || (window.currentChartToken ? parseFloat(window.currentChartToken.price) : 0);
                let oiUsd = parseFloat(oiData.openInterest) * currentPrice;
                if (oiUsd > 0) updateAllDOM('cc-oi-val', '$' + formatCompactUSD(oiUsd), null);
            } catch(oiErr) {}
            return true;

        } catch (err) {
            if (window.activeFuturesSession !== currentSession) return false;
            updateAllDOM('cc-futures-status', '🚫 NO FUTURES', '#848e9c');
            updateAllDOM('cc-oi-val', 'N/A', null);
            updateAllDOM('cc-funding-lbl', 'Funding Rate', null);
            updateAllDOM('cc-funding-val', 'N/A', '#848e9c');
            return false;
        }
    };

    let hasFutures = await fetchRestData();
    
    // NẾU CÓ PHÁI SINH -> BẬT VÒNG LẶP VÀ WEBSOCKET
    if (hasFutures && window.activeFuturesSession === currentSession) {
        futuresDataInterval = setInterval(() => {
            if (window.activeFuturesSession === currentSession) fetchRestData();
        }, 15000);

        const connectForceOrderWS = () => {
            if (window.activeFuturesSession !== currentSession) return;
            
            let wsUrl = `wss://fstream.binance.com/ws/${streamSymbol}@forceOrder`;
            liquidationWs = new WebSocket(wsUrl);

            liquidationWs.onmessage = (event) => {
                if (window.activeFuturesSession !== currentSession) return;
                const data = JSON.parse(event.data);
                if (data.e === 'forceOrder' && data.o) {
                    let order = data.o;
                    let valUSD = parseFloat(order.p) * parseFloat(order.q);
                    let isLongLiq = (order.S === 'SELL');

                    if (isLongLiq) {
                        window.quantStats.longLiq += valUSD;
                        updateAllDOM('cc-liq-long', `🩸 Liq L: $${formatCompactUSD(window.quantStats.longLiq)}`, null);
                    } else {
                        window.quantStats.shortLiq += valUSD;
                        updateAllDOM('cc-liq-short', `💥 Liq S: $${formatCompactUSD(window.quantStats.shortLiq)}`, null);
                    }

                    // [V12 T3] Forward sự kiện Thanh Lý (Force Order) vào Worker để tính toán Hawkes Intensity
                    if (window.quantWorker) {
                        window.quantWorker.postMessage({ cmd: 'LIQ_EVENT', data: { v: valUSD, dir: order.S, p: parseFloat(order.p) } });
                    }

                    if (valUSD > 1000 && typeof window.logToSniperTape === 'function') {
                        window.logToSniperTape(!isLongLiq, valUSD, isLongLiq ? '🩸 CHÁY LONG' : '🔥 CHÁY SHORT', parseFloat(order.p));
                    }
                }
            };

            liquidationWs.onclose = () => {
                // SILENT RECONNECT: Nối cáp ngầm, không reset UI gây chớp tắt
                if (window.activeFuturesSession === currentSession) {
                    setTimeout(() => connectForceOrderWS(), 3000);
                }
            };
        };
        
        connectForceOrderWS();
    }
};

window.stopFuturesEngine = function() {
    window.activeFuturesSession = null;
    if (futuresDataInterval) { clearInterval(futuresDataInterval); futuresDataInterval = null; }
    if (liquidationWs) { liquidationWs.close(); liquidationWs = null; }
};
// HÀM: Bơm dữ liệu Token Yêu thích vào Watchlist Sidebar (Nâng cấp Hybrid)
window.renderProWatchlist = function(passedSearchTerm) {
    const wlBody = document.getElementById('sc-watchlist-body');
    if (!wlBody) return;
    
    // [FIX LỖI MẤT KẾT QUẢ] Luôn ưu tiên đọc giá trị đang gõ trong ô Search để không bị Reset khi Server update giá Real-time
    let searchInput = document.getElementById('wl-search');
    let searchTerm = typeof passedSearchTerm === 'string' ? passedSearchTerm : (searchInput ? searchInput.value : '');

    let tokensToRender = [];
    let isSearching = searchTerm && searchTerm.trim().length > 0;
    let isShowingSuggested = false;

    if (isSearching) {
        // [CHẾ ĐỘ TÌM KIẾM]: Lọc toàn thị trường nhưng cắt đúng 50 con đầu tiên để chống lag CPU
        let term = searchTerm.trim().toLowerCase();
        tokensToRender = allTokens.filter(t => (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term))).slice(0, 50);
    } else {
        // [CHẾ ĐỘ MẶC ĐỊNH]: Lấy hàng đã Pin
        let pinned = JSON.parse(localStorage.getItem('alpha_pins')) || [];
        tokensToRender = allTokens.filter(t => pinned.includes(t.symbol));

        // Nếu chưa Pin con nào, tự động nhét Top 20 Trending Volume vào làm gợi ý
        if (tokensToRender.length === 0) {
            isShowingSuggested = true;
            let sortedByVol = [...allTokens].sort((a,b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0));
            tokensToRender = sortedByVol.slice(0, 20);
        }
    }

    let html = '';
    
    if (isShowingSuggested) {
        html += '<div style="padding:6px 15px; font-size:8.5px; color:#F0B90B; font-weight:800; background:rgba(240,185,11,0.05); border-bottom:1px solid #1A1F26; text-align:center;">CHƯA CÓ WATCHLIST - GỢI Ý TOP 20 TRENDING</div>';
    }

    tokensToRender.forEach(t => {
        let sym = t.symbol;
        let isPinned = (JSON.parse(localStorage.getItem('alpha_pins')) || []).includes(sym);
        let isUp = (t.change_24h || 0) >= 0;
        let colorClass = isUp ? 'text-green' : 'text-red';
        let sign = isUp ? '+' : '';
        let priceStr = formatPrice(t.price);
        
        let pinIconColor = isPinned ? '#F0B90B' : '#474d57';

        html += `
            <div class="wl-item" onclick="window.openProChart(allTokens.find(x => x.symbol === '${sym}'))">
                <div class="wl-sym" style="width: 45%;">
                    <i class="fas fa-star" style="color:${pinIconColor}; font-size:10px; margin-right:6px; transition:0.2s;" 
                       onmouseover="this.style.color='#F0B90B'" 
                       onmouseout="this.style.color='${pinIconColor}'"
                       onclick="event.stopPropagation(); window.togglePin('${sym}'); window.renderProWatchlist();"></i>
                    <img src="${t.icon || 'assets/tokens/default.png'}" onerror="this.src='assets/tokens/default.png'">
                    ${sym}
                </div>
                <div class="wl-price" style="width: 30%;">$${priceStr}</div>
                <div class="wl-chg ${colorClass}" style="width: 25%;">${sign}${parseFloat(t.change_24h||0).toFixed(2)}%</div>
            </div>
        `;
    });

    if (tokensToRender.length === 0 && isSearching) {
        html = '<div style="text-align:center; padding:30px 10px; color:#5e6673; font-style:italic; font-size: 11px;">Không tìm thấy token nào trùng khớp.</div>';
    }

    wlBody.innerHTML = html;
};
// =====================================================================
// [TARGET-2] ZERO-LAG DOM CACHE SYSTEM & BITMASK (Nâng cấp chuẩn 2026)
// =====================================================================
const _verdictCache = {
    hft_html: null, hft_css: null,
    mft_html: null, mft_css: null,
    lft_html: null, lft_css: null
};
let _verdictRafPending = false;
let _legacyFlagsBitmaskCache = -1; // -1 = uninitialized

// [V12 T2] Bitmask encoding O(1) so sánh 12 legacyFlags
function encodeFlagsBitmask(flags) {
    if (!flags) return 0;
    return (flags.liquidityVacuum      ? 1    : 0) |
           (flags.spoofingBuyWall      ? 2    : 0) |
           (flags.spoofingSellWall     ? 4    : 0) |
           (flags.bullishIceberg       ? 8    : 0) |
           (flags.bearishIceberg       ? 16   : 0) |
           (flags.icebergAbsorption    ? 32   : 0) |
           (flags.exhausted            ? 64   : 0) |
           (flags.stopHunt             ? 128  : 0) |
           (flags.wallHit              ? 256  : 0) |
           (flags.washTrading          ? 512  : 0) |
           (flags.zoneAbsorptionBottom ? 1024 : 0) |
           (flags.zoneDistributionTop  ? 2048 : 0) |
           (flags.spotTop              ? 4096 : 0); // [V12] Hỗ trợ cờ Spot Top
}

function scheduleVerdictRender(hft, mft, lft, flags) {
    // Chỉ render nếu HTML, CSS hoặc trạng thái các cờ (Bitmask) thực sự thay đổi
    const hftChanged = hft && (hft.html !== _verdictCache.hft_html || hft.css !== _verdictCache.hft_css);
    const mftChanged = mft && (mft.html !== _verdictCache.mft_html || mft.css !== _verdictCache.mft_css);
    const lftChanged = lft && (lft.html !== _verdictCache.lft_html || lft.css !== _verdictCache.lft_css);
    
    const newBitmask = encodeFlagsBitmask(flags);
    const flagsChanged = newBitmask !== _legacyFlagsBitmaskCache;

    if (!hftChanged && !mftChanged && !lftChanged && !flagsChanged) return;
    if (_verdictRafPending) return;
    
    _verdictRafPending = true;
    requestAnimationFrame(() => {
        _verdictRafPending = false;
        
        if (flagsChanged) _legacyFlagsBitmaskCache = newBitmask; // Update cache cờ tĩnh
        
        if (hftChanged && hft) {
            const el = document.getElementById('verdict-hft');
            if (el) { el.innerHTML = hft.html; el.style.cssText = hft.css; }
            _verdictCache.hft_html = hft.html; _verdictCache.hft_css = hft.css;
        }
        if (mftChanged && mft) {
            const el = document.getElementById('verdict-mft');
            if (el) { el.innerHTML = mft.html; el.style.cssText = mft.css; }
            _verdictCache.mft_html = mft.html; _verdictCache.mft_css = mft.css;
        }
        if (lftChanged && lft) {
            const el = document.getElementById('verdict-lft');
            if (el) { el.innerHTML = lft.html; el.style.cssText = lft.css; }
            _verdictCache.lft_html = lft.html; _verdictCache.lft_css = lft.css;
        }
    });
}

// =====================================================================
// 🧠 SUPER QUANT AI: ĐỘNG CƠ PHÂN TÍCH ĐA KHUNG THỜI GIAN (HFT - MFT - LFT)
// =====================================================================
window.hftLockTime = 0;
window.hftLockedHtml = '';
window.hftLockedCss = '';

window.evaluateQuantVerdict = function() {
    if (!window.quantStats) return;
    let q = window.quantStats;
    let flags = q.flags || {};

    // --- [V12 FRAMEWORK HỢP LƯU] ĐỊNH TUYẾN LẠI TÍN HIỆU HFT (SUPPRESSION RULES) ---
    if (q.hftVerdict) {
        let wBuy = q.whaleBuyVol || 0;
        let wSell = q.whaleSellVol || 0;
        let ofi = q.ofi || 0;
        let trend = q.trend || 0;

        // LỚP 1: GIẤU TÍN HIỆU BÁN -> ĐỔI THÀNH MM MARKUP (Đẩy Giá)
        if ((flags.spoofingSellWall || flags.bearishIceberg) && ofi > 0.2 && wBuy > wSell && trend > 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[⚡ ĐẨY]</b> 🚀 MM MARKUP (NAM CHÂM HÚT GIÁ)`;
            q.hftVerdict.color = '#00F0FF'; q.hftVerdict.bg = 'rgba(0, 240, 255, 0.15)';
        }
        // LỚP 2: GIẤU TÍN HIỆU MUA -> ĐỔI THÀNH MM MARKDOWN (Xả Hàng)
        else if (flags.spoofingBuyWall && ofi < -0.2 && wSell > wBuy && trend < 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[🩸 XẢ]</b> 🩸 MM MARKDOWN (TƯỜNG ĐỠ ẢO)`;
            q.hftVerdict.color = '#FF007F'; q.hftVerdict.bg = 'rgba(255, 0, 127, 0.15)';
        }
    }

    // --- 1. HFT (MICRO): Giữ nguyên logic tối ưu từ Worker V7.1 ---
    let hftObj = { 
        html: "⚡ ĐANG KHỞI ĐỘNG TICK...",
        css: "font-size: 9.5px; background: rgba(0, 240, 255, 0.1); padding: 3px 6px; border-radius: 3px; color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.2); white-space: nowrap;" 
    };
    if (q.hftVerdict) {
        let v = q.hftVerdict;
        hftObj.html = v.html;
        hftObj.css = `font-size: 9.5px; background: ${v.bg}; padding: 3px 6px; border-radius: 3px; color: ${v.color}; border: 1px solid ${v.color}; white-space: nowrap;`;
    }

    // --- 2. MFT (MESO): DYNAMIC NORMALIZED MATRIX ---
    // Đọc DOM 1 lần duy nhất ở ngoài (Chống layout thrashing)
    let cvd1hTag = document.getElementById('sm-tag-1h') ? document.getElementById('sm-tag-1h').innerText.toUpperCase() : '';
    let cvd4hTag = document.getElementById('sm-tag-4h') ? document.getElementById('sm-tag-4h').innerText.toUpperCase() : '';

    let fFunding = q.fundingRateObj ? q.fundingRateObj.rate : (q.fundingRate || 0);
    let liqLong = q.longLiq || 0;
    let liqShort = q.shortLiq || 0;
    let totalLiq = liqLong + liqShort;

    let spotScore = 0;
    if (cvd1hTag.includes('BULLISH')) spotScore += 0.5;
    else if (cvd1hTag.includes('BEARISH')) spotScore -= 0.5;
    
    if (cvd4hTag.includes('BULLISH')) spotScore += 0.5;
    else if (cvd4hTag.includes('BEARISH')) spotScore -= 0.5;

    let futuresScore = 0;
    let hasFutures = Math.abs(fFunding) > 0 || totalLiq > 0;
    if (hasFutures) {
        if (fFunding < -0.005) futuresScore += 0.5;
        else if (fFunding > 0.005) futuresScore -= 0.5;
        if (totalLiq > 5000) {
            let liqRatio = liqShort / totalLiq;
            if (liqRatio > 0.65) futuresScore += 0.5;
            else if (liqRatio < 0.35) futuresScore -= 0.5;
        }
    }

    let finalMftScore = hasFutures ? (spotScore * 0.4) + (futuresScore * 0.6) : (spotScore * 1.0);

    let mftMsg = '⚖️ ĐI NGANG TRUNG HẠN';
    let mftColor = '#848e9c'; let mftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalMftScore >= 0.6) {
        mftMsg = hasFutures ? '🔥 SHORT SQUEEZE (STRONG BUY)' : '🔥 LỰC MUA CỰC MẠNH (STRONG BUY)';
        mftColor = '#00F0FF'; mftBg = 'rgba(0, 240, 255, 0.1)';
    } else if (finalMftScore >= 0.25) {
        mftMsg = '📈 ĐỘNG LƯỢNG TĂNG (BUY)';
        mftColor = '#0ECB81'; mftBg = 'rgba(14, 203, 129, 0.1)';
    } else if (finalMftScore <= -0.6) {
        mftMsg = hasFutures ? '🩸 LONG CASCADE (STRONG SELL)' : '🩸 LỰC XẢ CỰC MẠNH (STRONG SELL)';
        mftColor = '#FF007F'; mftBg = 'rgba(255, 0, 127, 0.1)';
    } else if (finalMftScore <= -0.25) {
        mftMsg = '📉 ÁP LỰC GIẢM (SELL)';
        mftColor = '#F6465D'; mftBg = 'rgba(246, 70, 93, 0.1)';
    }
    
    let mftObj = {
        html: mftMsg,
        css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${mftColor}; background: ${mftBg}; white-space: nowrap;`
    };

    // --- 3. LFT (MACRO): NORMALIZED SCORING CHO SMART MONEY ---
    let smBadge = document.getElementById('sm-verdict-badge');
    let smTag = smBadge ? smBadge.innerText.toUpperCase() : '';
    let unlockStr = document.getElementById('sm-unlock-pct') ? document.getElementById('sm-unlock-pct').innerText : '100%';
    let unlockPct = parseFloat(unlockStr) || 100;

    let smScore = 0;
    if (smTag.includes('CÁ MẬP GOM') || smTag.includes('BULLISH')) smScore = 1.0;
    else if (smTag.includes('BOT KIỂM SOÁT') || smTag.includes('BEARISH') || smTag.includes('XẢ')) smScore = -1.0;

    let tokenomicsScore = 0;
    if (unlockPct < 30) tokenomicsScore = -1.0;
    else if (unlockPct >= 50) tokenomicsScore = 0.5;
    else if (unlockPct >= 80) tokenomicsScore = 1.0;

    let finalLftScore = (smScore * 0.75) + (tokenomicsScore * 0.25);

    let lftMsg = '⚖️ TRUNG LẬP VĨ MÔ';
    let lftColor = '#848e9c'; let lftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalLftScore >= 0.5) {
        lftMsg = '💎 TÍCH LŨY VĨ MÔ (MACRO BULL)';
        lftColor = '#0ECB81'; lftBg = 'rgba(14, 203, 129, 0.1)';
    } else if (finalLftScore <= -0.5) {
        lftMsg = '⚠️ RỦI RO PHÂN PHỐI (MACRO BEAR)';
        lftColor = '#FF007F'; lftBg = 'rgba(255, 0, 127, 0.1)';
    }

    let lftObj = {
        html: lftMsg,
        css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${lftColor}; background: ${lftBg}; white-space: nowrap;`
    };

    // [V12 T2] Truyền thêm q.flags vào Rendering Engine để chạy Bitmask Check
    scheduleVerdictRender(hftObj, mftObj, lftObj, q.flags);
};
