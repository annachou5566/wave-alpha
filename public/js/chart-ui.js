
// ==========================================
// 🚀 FILE: chart-ui.js - GIAO DIỆN & TRADINGVIEW
// ==========================================

window.tvLineSeries = null; 
// ═══ CACHE DOM — tránh querySelector mỗi giây ═══
const _UI = {
    nfEl: null, nfBox: null, speedEl: null, algoStatus: null, algoBox: null,
    ofiBarBuy: null, ofiBarSell: null, avgEl: null, trendEl: null,
    spVal: null, spMeter: null, dropEl: null, barBuy: null, barSell: null,
    volBuy: null, volSell: null, ratioTxt: null, verdictEl: null
};
window.getOptimalDataInterval = function(uiInterval) {
    const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
    if (config && parseInt(config.chartType) === 14) {
        // 🚀 BÍ QUYẾT RENKO: Cần lịch sử dài để đủ biên độ vẽ gạch. 
        // Nếu user chọn khung < 15m, ta âm thầm hack ép API tải dữ liệu 15m.
        // 1000 nến 15m = 10 ngày. Đủ vẽ hàng trăm viên gạch!
        const smallTFs = ['tick', '1s', '1m', '3m', '5m'];
        if (smallTFs.includes(uiInterval)) return '15m'; 
    }
    return uiInterval;
};
window.__cacheCommandCenterUI = function() {
    _UI.nfEl       = document.getElementById('cc-net-flow');
    _UI.nfBox      = document.getElementById('cc-nf-box');
    _UI.speedEl    = document.getElementById('cc-speed');
    _UI.algoStatus = document.getElementById('cc-algo-status');
    _UI.algoBox    = document.getElementById('cc-algo-box');
    _UI.ofiBarBuy  = document.getElementById('cc-ofi-bar-buy');
    _UI.ofiBarSell = document.getElementById('cc-ofi-bar-sell');
    _UI.avgEl      = document.getElementById('cc-avg-ticket');
    _UI.trendEl    = document.getElementById('cc-vwap-trend');
    _UI.spVal      = document.getElementById('cc-spread-val');
    _UI.spMeter    = document.getElementById('cc-spread-meter');
    _UI.dropEl     = document.getElementById('cc-drop-val');
    _UI.barBuy     = document.getElementById('cc-whale-bar-buy');
    _UI.barSell    = document.getElementById('cc-whale-bar-sell');
    _UI.volBuy     = document.getElementById('cc-whale-vol-buy');
    _UI.volSell    = document.getElementById('cc-whale-vol-sell');
    _UI.ratioTxt   = document.getElementById('cc-whale-ratio');
    _UI.verdictEl  = document.getElementById('fut-ai-verdict') || document.getElementById('ai-verdict-badge');
};
window.tvVolumeSeries = null; 
window.tvCandleSeries = null;
window.currentChartInterval = '1d'; 
window.currentTheme = localStorage.getItem('wave_theme') || 'cyber';

window.isProSoundOn = true; 
// ==========================================
// 🚀 INIT GLOBAL TOOLTIP (BULLETPROOF FIX)
// ==========================================
(function initGlobalTooltip() {
    if (document.getElementById('wa-global-tooltip')) return;

    // 1. Tạo một Tooltip duy nhất gắn thẳng vào Body (Né mọi lỗi bị che/cắt)
    const tooltip = document.createElement('div');
    tooltip.id = 'wa-global-tooltip';
    tooltip.style.cssText = `
        position: fixed; background: #1e222d; color: #EAECEF; padding: 5px 10px;
        font-size: 11px; font-weight: 700; font-family: var(--font-main, sans-serif);
        border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); white-space: nowrap;
        pointer-events: none; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        opacity: 0; visibility: hidden; transition: opacity 0.15s, transform 0.15s;
        transform: translate(-50%, 4px);
    `;
    document.body.appendChild(tooltip);

    const hideTooltip = () => {
        tooltip.style.opacity = '0'; tooltip.style.visibility = 'hidden';
        tooltip.style.transform = 'translate(-50%, 4px)';
    };

    // 2. Bám theo chuột để bật Tooltip
    document.addEventListener('mouseover', (e) => {
        // Hỗ trợ cả 2 định dạng: data-wa-tip (UI) và data-tip (Indicator)
        const target = e.target.closest('[data-wa-tip], [data-tip]');
        if (!target) return hideTooltip();

        const text = target.getAttribute('data-wa-tip') || target.getAttribute('data-tip');
        if (!text) return;

        tooltip.innerText = text;
        const rect = target.getBoundingClientRect();
        
        // Tính toán tọa độ và ghim nó chính giữa phía dưới nút
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.bottom + 8) + 'px';
        
        tooltip.style.visibility = 'visible'; tooltip.style.opacity = '1';
        tooltip.style.transform = 'translate(-50%, 0)';
    }, true);

    // 3. Tắt Tooltip khi chuột rời đi, click, hoặc cuộn trang
    document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget || !e.target.closest('[data-wa-tip], [data-tip]')) hideTooltip();
    }, true);
    document.addEventListener('mousedown', hideTooltip, true);
    window.addEventListener('scroll', hideTooltip, true);
})();
// ==========================================
// 🌊 HFT TAPE ENGINE (DOM RECYCLING & BATCHING)
// ==========================================

// 1. Khởi tạo các Buffer và Bể chứa DOM (Tránh dọn rác GC)
window._tapeBuffer = [];
window._tradesBuffer = [];
window._highlightQueue = [];
window._domPool = [];
window._isMasterRafRunning = false;
window._tapeActiveTypes = new Set(['bot', 'liq', 'whale', 'shark', 'dolphin']); // Cache bộ lọc

// ==========================================
// 🔊 GIỮ NGUYÊN CÁC HÀM UI & ÂM THANH CỦA BẠN
// ==========================================
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
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
};

window.toggleTapeFilterMenu = function(e) {
    if(e) e.stopPropagation();
    let menu = document.getElementById('tape-filter-menu');
    let btn = document.getElementById('tape-filter-btn');
    if(menu) {
        menu.classList.toggle('show');
        if (btn) btn.classList.toggle('active', menu.classList.contains('show'));
    }
};

document.addEventListener('click', function(e) {
    let menu1 = document.getElementById('sc-filter-menu');
    let btn1 = document.getElementById('sc-filter-btn');
    if (menu1 && menu1.classList.contains('show') && !menu1.contains(e.target) && e.target !== btn1) {
        menu1.classList.remove('show');
        if (btn1) btn1.classList.remove('active');
    }
    
    let menu2 = document.getElementById('tape-filter-menu');
    let btn2 = document.getElementById('tape-filter-btn');
    if (menu2 && menu2.classList.contains('show') && !menu2.contains(e.target) && e.target !== btn2) {
        menu2.classList.remove('show');
        if (btn2) btn2.classList.remove('active');
    }
});

// ==========================================
// 🚀 ĐỘNG CƠ RENDER MỚI (CHỐNG GIẬT LAG)
// ==========================================

// Hàm fomat thời gian siêu tốc (Dùng Bitwise ops, nhanh hơn Date() 8x)
window._fmtTime = function(ms) {
    let d = ms ? new Date(ms) : new Date();
    let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    return (h < 10 ? '0'+h : h) + ':' + (m < 10 ? '0'+m : m) + ':' + (s < 10 ? '0'+s : s);
};

// Hàm lấy thẻ Div tái chế (Không tạo mới nếu không cần thiết)
window._getDiv = function() { return window._domPool.length > 0 ? window._domPool.pop() : document.createElement('div'); };

// VÒNG LẶP MASTER: Chỉ 1 vòng lặp duy nhất xử lý TẤT CẢ mọi thứ trên màn hình
window._masterTapeRenderLoop = function(time) {
    let needsNextFrame = false;
    
    // A. Xử lý tắt đèn Highlight (Thay thế setTimeout tốn CPU)
    for (let i = window._highlightQueue.length - 1; i >= 0; i--) {
        let item = window._highlightQueue[i];
        if (time - item.start > 150) {
            item.el.style.background = item.endBg;
            item.el.style.color = item.endColor || '';
            item.el.style.textShadow = 'none';
            window._highlightQueue.splice(i, 1);
        } else {
            needsNextFrame = true;
        }
    }

    // B. Xử lý đẩy dữ liệu vào Sniper Tape & Bảng Thanh Lý (Futures)
    const tape = document.getElementById('cc-sniper-tape');
    const liqTape = document.getElementById('fut-liq-tape');
    
    if (window._tapeBuffer.length > 0) {
        let fragSniper = document.createDocumentFragment();
        let fragLiq = document.createDocumentFragment();
        let items = window._tapeBuffer.splice(0, window._tapeBuffer.length);
        
        for (let i = items.length - 1; i >= 0; i--) { 
            if (items[i].dataset.tapeType === 'liq_only' && liqTape) {
                fragLiq.insertBefore(items[i], fragLiq.firstChild);
            } else if (tape) {
                fragSniper.insertBefore(items[i], fragSniper.firstChild); 
            }
        }
        
        if (tape && fragSniper.childNodes.length > 0) {
            if (tape.innerHTML.includes('Đang quét')) tape.innerHTML = '';
            tape.prepend(fragSniper);
            while (tape.children.length > 50) { window._domPool.push(tape.removeChild(tape.lastChild)); }
        }
        
        if (liqTape && fragLiq.childNodes.length > 0) {
            if (liqTape.innerHTML.includes('Đang rình')) liqTape.innerHTML = '';
            liqTape.prepend(fragLiq);
            while (liqTape.children.length > 50) { window._domPool.push(liqTape.removeChild(liqTape.lastChild)); }
        }
    }

    // C. Xử lý đẩy dữ liệu vào Smart Trades
    const tradesBox = document.getElementById('sc-live-trades');
    if (tradesBox && window._tradesBuffer.length > 0) {
        let frag = document.createDocumentFragment();
        let items = window._tradesBuffer.splice(0, window._tradesBuffer.length);
        
        for (let i = items.length - 1; i >= 0; i--) { frag.appendChild(items[i]); }
        tradesBox.insertBefore(frag, tradesBox.firstChild);
        
        while (tradesBox.children.length > 30) { window._domPool.push(tradesBox.removeChild(tradesBox.lastChild)); }
    }

    if (window._tapeBuffer.length > 0 || window._tradesBuffer.length > 0 || needsNextFrame) {
        requestAnimationFrame(window._masterTapeRenderLoop);
    } else {
        window._isMasterRafRunning = false;
    }
};

window._triggerMasterRaf = function() {
    if (!window._isMasterRafRunning) {
        window._isMasterRafRunning = true;
        requestAnimationFrame(window._masterTapeRenderLoop);
    }
};

window.logToSniperTape = function(isBuy, vol, type, price, timestamp = null) {
    let isLiq = type.includes('CHÁY');
    const timeStr = window._fmtTime(timestamp);
    
    // 1. XỬ LÝ TAPE THANH LÝ TẠI TAB FUTURES
    if (isLiq) {
        let liqSig = `${type}_${price}_${vol}`;
        let nowMs = Date.now();
        if (!window.lastLiqEvent) window.lastLiqEvent = { sig: '', time: 0 };
        if (window.lastLiqEvent.sig === liqSig && (nowMs - window.lastLiqEvent.time < 2000)) return; 
        window.lastLiqEvent = { sig: liqSig, time: nowMs };

        const currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
        const heatRatio = Math.min(1, vol / Math.max(5000, currentAvgTicket * 15)); 
        const opacity = 0.05 + (heatRatio * 0.5); 
        
        const lColor = type.includes('LONG') ? '#FF007F' : '#00F0FF'; 
        const lBg = type.includes('LONG') ? `rgba(255, 0, 127, ${opacity})` : `rgba(0, 240, 255, ${opacity})`;
        
        const lEntry = window._getDiv();
        lEntry.dataset.tapeType = 'liq_only';
        lEntry.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; padding: 4px 6px; border-bottom: 1px solid var(--term-border); border-left: ${heatRatio > 0.6 ? `4px solid ${lColor}` : 'none'}; background: ${lBg}; font-family: var(--font-num); transition: none; font-weight: ${heatRatio > 0.6 ? '900' : '600'};`;

        let lIcon = type.includes('LONG') ? '🩸' : '💥';
        let lAction = type.includes('LONG') ? 'LIQ L' : 'LIQ S';
        
        lEntry.innerHTML = `<span style="color:${lColor}; font-weight:800; width: 35%; text-shadow: 0 0 5px ${lColor};">${lIcon} ${lAction}</span><span style="color:#eaecef; font-weight:bold; width: 45%; text-align: center;">$${window.formatCompactUSD(vol)} @ ${window.formatPrice(price)}</span><span style="color:#848e9c; font-weight:600; width: 20%; text-align: right;">${timeStr}</span>`;
        
        if (!timestamp) {
            lEntry.style.background = lColor;
            lEntry.style.color = '#000';
            window._highlightQueue.push({ el: lEntry, endBg: lBg, endColor: '', start: performance.now() });
        }

        window._tapeBuffer.push(lEntry);
        window._triggerMasterRaf();
    }

    if (isLiq && vol < 1000) return; 
    if (!isLiq && vol < 500 && !type.includes('BOT')) return;

    let tapeType = isLiq ? 'liq' : (type.includes('VOI') ? 'whale' : (type.includes('MẬP') ? 'shark' : (type.includes('HEO') ? 'dolphin' : 'bot')));
    const isGlowFish = (tapeType === 'whale' || tapeType === 'shark' || tapeType === 'liq');
    if (isGlowFish && !timestamp) window.playProPing();

    const currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
    const heatRatio = Math.min(1, vol / Math.max(5000, currentAvgTicket * 15)); 
    
    let color = isLiq ? (type.includes('LONG') ? '#FF007F' : '#00F0FF') : (isBuy ? '#0ECB81' : '#F6465D');
    let baseRgb = isLiq ? (type.includes('LONG') ? '255, 0, 127' : '0, 240, 255') : (isBuy ? '14, 203, 129' : '246, 70, 93');
    const bg = `rgba(${baseRgb}, ${isLiq ? 0.35 : (0.03 + heatRatio * 0.27)})`;
    const action = isLiq ? '' : (isBuy ? 'BUY' : 'SELL');

    const entry = window._getDiv();
    entry.dataset.tapeType = tapeType; 
    entry.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: ${bg}; border-left: ${(heatRatio > 0.6 || isLiq) ? 4 : 2}px solid ${color}; font-family: var(--font-num); gap: 4px; font-weight: ${(heatRatio > 0.6 || isLiq) ? '900' : '800'}; transition: none;`;

    entry.innerHTML = `<span style="color:${color}; width:35%; text-shadow:${isGlowFish ? '0 0 5px '+color : 'none'};">${type} ${action}</span><span style="color:#eaecef; width:45%; text-align:center;">$${window.formatCompactUSD(vol)} @ ${window.formatPrice(price)}</span><span style="color:#848e9c; width:20%; text-align:right;">${timeStr}</span>`;
    
    if (!window._tapeActiveTypes.has(tapeType)) entry.style.display = 'none';

    if (isGlowFish && !timestamp) {
        entry.style.background = `rgba(${baseRgb}, 0.55)`;
        window._highlightQueue.push({ el: entry, endBg: bg, start: performance.now() });
    }

    window._tapeBuffer.push(entry);
    window._triggerMasterRaf();
};

window.filterSniperTape = function() {
    let checkboxes = document.querySelectorAll('.tape-filter-cb');
    window._tapeActiveTypes.clear();
    checkboxes.forEach(cb => { if(cb.checked) window._tapeActiveTypes.add(cb.value); });
    
    const tape = document.getElementById('cc-sniper-tape');
    if (!tape) return;
    Array.from(tape.children).forEach(child => {
        if (child.dataset.tapeType && child.dataset.tapeType !== 'liq_only') {
            child.style.display = window._tapeActiveTypes.has(child.dataset.tapeType) ? 'flex' : 'none';
        }
    });
};

window.flushSmartTape = function(cluster) {
    if (!cluster) return;
    let filterEl = document.getElementById('sc-fish-filter');
    if (filterEl && filterEl.value === 'none') return;
    
    let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
    let whaleMin = Math.max(15000, currentAvgTicket * 15), sharkMin = Math.max(5000, currentAvgTicket * 7), dolphinMin = Math.max(2000, currentAvgTicket * 3);
    let isWhale = cluster.vol >= whaleMin, isShark = cluster.vol >= sharkMin && cluster.vol < whaleMin, isDolphin = cluster.vol >= dolphinMin && cluster.vol < sharkMin;
    let isSweep = cluster.count >= 6 && cluster.vol >= 1000;

    let icon = isWhale ? '🐋 ' : (isShark ? '🦈 ' : (isDolphin ? '🐬 ' : (isSweep ? '🤖 ' : '')));
    let row = window._getDiv();
    
    let c_up = '#0ECB81', c_down = '#F6465D', c_bg = cluster.dir ? 'rgba(14,203,129,0.15)' : 'rgba(246,70,93,0.15)';
    row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:3px 4px; border-bottom:1px solid #1A1F26; background:${icon ? c_bg : 'transparent'}; font-weight:${icon ? '800' : 'normal'}; font-variant-numeric: tabular-nums; transition: none;`;
    
    row.innerHTML = `<span style="color:${cluster.dir ? c_up : c_down}; flex: 1; text-align: left; overflow: hidden; white-space: nowrap;">${window.formatPrice(cluster.p)}</span><span style="color:#eaecef; flex: 1; text-align: center; white-space: nowrap;">${icon}$${window.formatCompactUSD(cluster.vol)}</span><span style="color:#707A8A; flex: 1; text-align: right; white-space: nowrap;">${window._fmtTime(cluster.t)}</span>`;

    if (isWhale || isShark) {
        row.style.background = cluster.dir ? c_up : c_down; row.style.color = '#000000';
        window._highlightQueue.push({ el: row, endBg: c_bg, endColor: '', start: performance.now() });
    }

    window._tradesBuffer.push(row);
    window._triggerMasterRaf();
    
    if (isDolphin || isShark || isWhale || isSweep) {
        if (isWhale) { window.scCWhale = (window.scCWhale||0) + 1; let el = document.getElementById('sc-stat-whale'); if(el) el.innerText = window.scCWhale; }
        else if (isShark) { window.scCShark = (window.scCShark||0) + 1; let el = document.getElementById('sc-stat-shark'); if(el) el.innerText = window.scCShark; }
        else if (isDolphin) { window.scCDolphin = (window.scCDolphin||0) + 1; let el = document.getElementById('sc-stat-dolphin'); if(el) el.innerText = window.scCDolphin; }
        else if (isSweep) { window.scCSweep = (window.scCSweep||0) + 1; let el = document.getElementById('sc-stat-sweep'); if(el) el.innerText = window.scCSweep; }

        let textMsg = icon + '$' + (cluster.vol >= 1e6 ? (cluster.vol/1e6).toFixed(1)+'M' : (cluster.vol >= 1e3 ? (cluster.vol/1e3).toFixed(1)+'K' : cluster.vol.toFixed(0)));
        if (isSweep && !isDolphin && !isShark && !isWhale) textMsg = '🤖 SWEEP';
        let markerColor = cluster.dir ? (window.currentTheme === 'trad' ? '#0ECB81' : '#2af592') : (window.currentTheme === 'trad' ? '#F6465D' : '#cb55e3');

        window.scChartMarkers.push({ time: cluster.timeSec, position: cluster.dir ? 'belowBar' : 'aboveBar', color: markerColor, shape: cluster.dir ? 'arrowUp' : 'arrowDown', text: textMsg, fishType: isWhale ? 'whale' : (isShark ? 'shark' : (isDolphin ? 'dolphin' : 'bot')) });
        if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
        
        if (isWhale || isShark) {
            if (cluster.dir) window.quantStats.whaleBuyVol += cluster.vol; else window.quantStats.whaleSellVol += cluster.vol;
            window.logToSniperTape(cluster.dir, cluster.vol, isWhale ? '🐋 VOI' : '🦈 MẬP', cluster.p);
        } else if (isSweep) {
            if (cluster.dir) window.quantStats.botSweepBuy++; else window.quantStats.botSweepSell++;
            window.logToSniperTape(cluster.dir, cluster.vol, '🤖 SWEEP', cluster.p);
        } else if (isDolphin) {
            window.logToSniperTape(cluster.dir, cluster.vol, '🐬 HEO', cluster.p);
        }
    }
};

window.updateCommandCenterUI = function() {
    if (!document.getElementById('quant-command-center')) return;

    // ✅ Kích hoạt Cache DOM 1 lần duy nhất, lấy ra dùng vĩnh viễn
    if (!_UI.nfEl) window.__cacheCommandCenterUI();
    if (!_UI.nfEl) return;

    let nfEl = _UI.nfEl, nfBox = _UI.nfBox,
        speedEl = _UI.speedEl, algoStatus = _UI.algoStatus, algoBox = _UI.algoBox,
        ofiBarBuy = _UI.ofiBarBuy, ofiBarSell = _UI.ofiBarSell,
        avgEl = _UI.avgEl, trendEl = _UI.trendEl,
        spVal = _UI.spVal, spMeter = _UI.spMeter, dropEl = _UI.dropEl,
        barBuy = _UI.barBuy, barSell = _UI.barSell,
        volBuy = _UI.volBuy, volSell = _UI.volSell, ratioTxt = _UI.ratioTxt;
    let verdictEl = _UI.verdictEl;

    // --- BẮT ĐẦU LOGIC TÍNH TOÁN (Giữ nguyên 100%) ---
    if (nfEl && window.scNetFlow !== undefined) {
        nfEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + window.formatCompactUSD(Math.abs(window.scNetFlow));
        nfEl.style.color = window.scNetFlow >= 0 ? '#0ECB81' : '#F6465D';
        if (nfBox) nfBox.style.borderLeftColor = window.scNetFlow >= 0 ? '#0ECB81' : '#F6465D';
    }

    let speed = window.scSpeedWindow ? window.scSpeedWindow.reduce((s, x) => s + x.v, 0) / 5 : 0;
    if (speedEl) speedEl.innerText = '$' + window.formatCompactUSD(speed) + ' /s';

    let now = Date.now();
    let recentSweeps = window.scTickHistory ? window.scTickHistory.filter(x => (now - x.t <= 15000) && x.q > 0) : [];
    let shortNetFlow = recentSweeps.reduce((s, x) => s + (x.dir ? x.v : -x.v), 0);
    let isHighUrgency = speed > 50000 || (recentSweeps.length > 20);

    if (algoStatus && algoBox) {
        let z = window.quantStats.zScore || 0; let ofi = window.quantStats.ofi || 0;
        let ofiText = ofi >= 0 ? `+${ofi.toFixed(2)}` : `${ofi.toFixed(2)}`; let zText = `Z:${z.toFixed(1)}`;
        if (z > 3.0) { 
            if (ofi > 0.5) { algoStatus.innerHTML = `🚀 ĐỘT BIẾN MUA [${zText} | OFI ${ofiText}]`; algoStatus.style.color = '#00F0FF'; algoBox.style.borderLeftColor = '#00F0FF'; } 
            else if (ofi < -0.5) { algoStatus.innerHTML = `🩸 ĐỘT BIẾN BÁN [${zText} | OFI ${ofiText}]`; algoStatus.style.color = '#FF007F'; algoBox.style.borderLeftColor = '#FF007F'; } 
            else { algoStatus.innerHTML = `⚔️ TRANH CHẤP GẮT [${zText}]`; algoStatus.style.color = '#F0B90B'; algoBox.style.borderLeftColor = '#F0B90B'; }
        } else if (isHighUrgency) {
            algoStatus.innerHTML = shortNetFlow > 0 ? `🤖 SWEEP GOM [OFI ${ofiText}]` : `🤖 SWEEP XẢ [OFI ${ofiText}]`;
            algoStatus.style.color = shortNetFlow > 0 ? '#2af592' : '#cb55e3'; algoBox.style.borderLeftColor = shortNetFlow > 0 ? '#2af592' : '#cb55e3';
        } else {
            algoStatus.innerHTML = `🤖 TĨNH LẶNG [${zText}]`; algoStatus.style.color = '#848e9c'; algoBox.style.borderLeftColor = '#848e9c';
        }
    }

    if (ofiBarBuy && ofiBarSell) {
        let buyPct = window.quantStats.buyDominance || 50; let sellPct = 100 - buyPct;
        ofiBarBuy.style.width = `${buyPct}%`; ofiBarSell.style.width = `${sellPct}%`;
        ofiBarBuy.style.background = buyPct >= 70 ? '#00F0FF' : '#0ECB81'; ofiBarBuy.style.boxShadow = buyPct >= 70 ? '0 0 5px #00F0FF' : 'none';
        ofiBarSell.style.background = sellPct >= 70 ? '#FF007F' : '#F6465D'; ofiBarSell.style.boxShadow = sellPct >= 70 ? '0 0 5px #FF007F' : 'none';
    }
    
    let avgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 0;
    if (avgEl) { let icon = avgTicket > 3000 ? '🐋' : '🦐'; let color = avgTicket > 3000 ? '#F0B90B' : '#eaecef'; avgEl.innerHTML = `${icon} <span style="color:${color}">$${window.formatCompactUSD(avgTicket)}</span>`; }

    let trend = window.quantStats.trend || 0;
    if (trendEl) { trendEl.innerText = (trend > 0 ? '▲ +' : (trend < 0 ? '▼ ' : '')) + Math.abs(trend).toFixed(2) + '%'; trendEl.style.color = trend >= 0 ? '#0ECB81' : '#F6465D'; }

    let spread = window.quantStats.spread || 0;
    if (spVal && spMeter) {
        spVal.innerText = spread.toFixed(2) + '%';
        let fill = Math.min(100, Math.max(5, (spread / 2.0) * 100)); spMeter.style.width = fill + '%';
        if (spread < 0.2) { spMeter.style.background = '#0ECB81'; spVal.style.color = '#0ECB81'; } else if (spread < 0.8) { spMeter.style.background = '#F0B90B'; spVal.style.color = '#F0B90B'; } else { spMeter.style.background = '#F6465D'; spVal.style.color = '#F6465D'; }
    }

    let drop = window.quantStats.drop || 0;
    if (dropEl) { dropEl.innerText = drop.toFixed(2) + '%'; dropEl.style.color = drop < -1.0 ? '#00F0FF' : '#eaecef'; }

    const wBuy = window.quantStats.whaleBuyVol || 0; const wSell = window.quantStats.whaleSellVol || 0; const totalWhale = wBuy + wSell;
    let smBuyPct = 50, smSellPct = 50;
    if (totalWhale > 0) { smBuyPct = (wBuy / totalWhale) * 100; smSellPct = (wSell / totalWhale) * 100; }
    
    if(barBuy) barBuy.style.width = `${smBuyPct}%`; if(barSell) barSell.style.width = `${smSellPct}%`;
    if(volBuy) volBuy.innerText = 'B: $' + window.formatCompactUSD(wBuy);
    if(volSell) volSell.innerText = 'S: $' + window.formatCompactUSD(wSell);
    if(ratioTxt) { ratioTxt.innerText = `${smBuyPct.toFixed(0)}% BUY`; ratioTxt.style.color = smBuyPct > 50 ? '#0ECB81' : '#F6465D'; }

    if (verdictEl) {
        let _vTrend = window.quantStats.trend || 0; let _vWBuy = window.quantStats.whaleBuyVol || 0; let _vWSell = window.quantStats.whaleSellVol || 0;
        let _vTotalW = _vWBuy + _vWSell; let _vSPct = _vTotalW > 0 ? (_vWSell / _vTotalW) * 100 : 50; let _vWNet = _vWBuy - _vWSell;
        let txPerSec = window.scSpeedWindow ? (window.scSpeedWindow.length / 5) : 0; let zScore = window.quantStats.zScore || 0; let ofi = window.quantStats.ofi || 0;

        let t_chart = window.currentChartToken || {};
        let dailyTx = t_chart.tx_count || 86400; let dailyVol = t_chart.volume?.daily_total || 1000000;
        let normalTxPerSec = dailyTx / 86400; let normalAvgTicket = dailyVol / dailyTx;
        let isCrazyFast = txPerSec > Math.max(3, normalTxPerSec * 4); let isRetailTicket = avgTicket < Math.max(100, normalAvgTicket * 0.3); let isHeavyDump = _vWNet < -(Math.max(10000, normalAvgTicket * 20));

        let hasFutures = window.quantStats.fundingRateObj != null;
        let fFunding = window.quantStats.fundingRateObj ? window.quantStats.fundingRateObj.rate : 0;
        let liqLong = window.quantStats.longLiq || 0; let liqShort = window.quantStats.shortLiq || 0;
        
        let sBids = 0, sAsks = 0;
        if (window.scLocalOrderBook && window.scLastPrice > 0) {
            let pLimitDown = window.scLastPrice * 0.99; let pLimitUp = window.scLastPrice * 1.01;
            let bBook = window.scLocalOrderBook.bids; let aBook = window.scLocalOrderBook.asks;
            if (bBook) { if (bBook instanceof Map) { for (let [p, v] of bBook) { if (parseFloat(p) >= pLimitDown) sBids += parseFloat(p) * v; } } else { for (let p in bBook) { if (parseFloat(p) >= pLimitDown) sBids += parseFloat(p) * bBook[p]; } } }
            if (aBook) { if (aBook instanceof Map) { for (let [p, v] of aBook) { if (parseFloat(p) <= pLimitUp) sAsks += parseFloat(p) * v; } } else { for (let p in aBook) { if (parseFloat(p) <= pLimitUp) sAsks += parseFloat(p) * aBook[p]; } } }
        }
        let isSpoofBids = (sAsks > 0 && sBids > sAsks * 4) && (_vTrend < -0.1) && (!isCrazyFast);
        let isSpoofAsks = (sBids > 0 && sAsks > sBids * 4) && (_vTrend > 0.1) && (!isCrazyFast);

        if (hasFutures) {
            if (zScore > 2.5 && ofi > 0.6 && liqShort > 5000) { verdictEl.innerText = '🔥 SHORT SQUEEZE'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(0, 240, 255, 0.2); color: #00F0FF; border: 1px solid #00F0FF; animation: pulse-dot 0.5s infinite;'; }
            else if (zScore > 2.5 && ofi < -0.6 && liqLong > 5000) { verdictEl.innerText = '🩸 LONG CASCADE'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(246, 70, 93, 0.2); color: #F6465D; border: 1px solid #F6465D; animation: pulse-dot 0.5s infinite;'; }
            else if (zScore > 2.0 && ofi > 0.7 && fFunding <= 0.01) { verdictEl.innerText = '🚀 BÙNG NỔ MUA'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(14, 203, 129, 0.2); color: #0ECB81; border: 1px solid #0ECB81;'; }
            else if (_vWNet < 0 && _vSPct > 65 && fFunding > 0.01 && zScore < 1.0) { verdictEl.innerText = '⚠️ TRAP DIVERGENCE'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(240, 185, 11, 0.2); color: #F0B90B; border: 1px solid #F0B90B;'; }
            else if (isSpoofBids || isSpoofAsks) { verdictEl.innerText = isSpoofBids ? '⚠️ SPOOFING MUA' : '⚠️ SPOOFING BÁN'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(240, 185, 11, 0.2); color: #F0B90B; border: 1px solid #F0B90B;'; }
            else { verdictEl.innerText = '⚖️ TÍCH LŨY / CHOPPING'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1);'; }
        } else {
            if (txPerSec < 0.5 && spread > 1.0) { verdictEl.innerText = '💀 THIẾU THANH KHOẢN'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(132, 142, 156, 0.2); color: #848e9c; border: 1px solid #848e9c;'; }
            else if (zScore > 3.0 && ofi < -0.7 && isHeavyDump) { verdictEl.innerText = '🩸 DEV EXIT'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(246, 70, 93, 0.2); color: #F6465D; border: 1px solid #F6465D; animation: pulse-dot 0.3s infinite;'; }
            else if (zScore > 2.0 && isRetailTicket && Math.abs(ofi) < 0.3) { verdictEl.innerText = '🤖 WASH TRADING'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(203, 85, 227, 0.2); color: #cb55e3; border: 1px solid #cb55e3;'; }
            else if (zScore > 2.5 && ofi > 0.8 && avgTicket < 500) { verdictEl.innerText = '🎈 BƠM RỖNG'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(246, 70, 93, 0.2); color: #F6465D; border: 1px solid #F6465D; animation: pulse-dot 0.5s infinite;'; }
            else if (zScore < 1.0 && ofi > 0.5 && avgTicket > 3000) { verdictEl.innerText = '🛡️ GOM HÀNG NGẦM'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(14, 203, 129, 0.2); color: #0ECB81; border: 1px solid #0ECB81;'; }
            else { verdictEl.innerText = '⚖️ TỰ NHIÊN / SIDEO'; verdictEl.style.cssText = 'font-size: 9px; font-weight: 800; padding: 3px 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1);'; }
        }
    }
    
    // --- UPDATE FUNDING RATE TRÊN TAB FUTURES ---
    if (window.quantStats && window.quantStats.fundingRateObj) {
        let fObj = window.quantStats.fundingRateObj; let remain = fObj.nextTime - Date.now();
        let countdownStr = "";
        if (remain > 0) {
            let hrs = String(Math.floor(remain / (1000 * 60 * 60))).padStart(2, '0');
            let mins = String(Math.floor((remain % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            let secs = String(Math.floor((remain % (1000 * 60)) / 1000)).padStart(2, '0');
            countdownStr = `${hrs}:${mins}:${secs}`;
        } else { countdownStr = "00:00:00"; }

        let sign = fObj.rate > 0 ? '+' : ''; let color = fObj.rate > 0.01 ? '#F6465D' : (fObj.rate < -0.01 ? '#00F0FF' : '#eaecef');
        let fLbl = document.getElementById('fut-funding-lbl'); if (fLbl) fLbl.innerText = `Funding (${fObj.interval || 8}h)`;
        let fEl = document.getElementById('fut-funding-val'); if (fEl) fEl.innerHTML = `<span style="font-family:var(--font-num); color:#848e9c">${countdownStr}</span><span style="color:#527c82; margin: 0 4px;">/</span><span style="color:${color}">${sign}${fObj.rate.toFixed(4)}%</span>`;
    }

    // --- UPDATE OPEN INTEREST REALTIME ---
    let oiEl = document.getElementById('fut-oi-val');
    if (oiEl) {
        if (window.quantStats && window.quantStats.openInterest && window.scLastPrice) {
            let oiUSD = window.quantStats.openInterest * window.scLastPrice; 
            if (window.formatCompactUSD) oiEl.innerText = '$' + window.formatCompactUSD(oiUSD);
        }
    }

    // --- UPDATE THANH LÝ (LIQUIDATION) ---
    let futLiqLongEl = document.getElementById('fut-liq-long');
    if (futLiqLongEl) futLiqLongEl.innerText = `$${window.formatCompactUSD((window.quantStats && window.quantStats.longLiq) ? window.quantStats.longLiq : 0)}`;
    
    let futLiqShortEl = document.getElementById('fut-liq-short');
    if (futLiqShortEl) futLiqShortEl.innerText = `$${window.formatCompactUSD((window.quantStats && window.quantStats.shortLiq) ? window.quantStats.shortLiq : 0)}`;

    let ccLiqLongEl = document.getElementById('cc-liq-long');
    if (ccLiqLongEl) ccLiqLongEl.innerText = `🩸 Liq L: $${window.formatCompactUSD((window.quantStats && window.quantStats.longLiq) ? window.quantStats.longLiq : 0)}`;
    
    let ccLiqShortEl = document.getElementById('cc-liq-short');
    if (ccLiqShortEl) ccLiqShortEl.innerText = `💥 Liq S: $${window.formatCompactUSD((window.quantStats && window.quantStats.shortLiq) ? window.quantStats.shortLiq : 0)}`;
    
    let sq = window.computeSqueezeZone ? window.computeSqueezeZone() : { confirmed: false };
    if (sq.confirmed && window.scChartMarkers) {
        let currentTime = Date.now();
        if (!window._lastSqueezeMarkerTime || currentTime - window._lastSqueezeMarkerTime > 10000) {
            const markerTime = Math.floor(currentTime / 1000);
            const sqMarker = { time: markerTime, position: sq.side === 'short' ? 'belowBar' : 'aboveBar', color: sq.side === 'short' ? '#00F0FF' : '#FF007F', shape: sq.side === 'short' ? 'arrowUp' : 'arrowDown', text: sq.side === 'short' ? '🔥SQ' : '🩸SQ', fishType: 'liq', size: 2 };
            window.scChartMarkers.push(sqMarker);
            if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
            window._lastSqueezeMarkerTime = currentTime;
        }
    }

    if (typeof window.evaluateQuantVerdict === 'function') window.evaluateQuantVerdict();
};

window.changeTheme = function() {
    const el = document.getElementById('sc-theme-select');
    if (!el) return;
    window.currentTheme = el.value;
    localStorage.setItem('wave_theme', window.currentTheme);
    
    // Cập nhật class để CSS biến đổi màu HUD xung quanh
    const overlayElem = document.getElementById('super-chart-overlay');
    if (overlayElem) {
        overlayElem.classList.remove('theme-cyber', 'theme-trad');
        overlayElem.classList.add('theme-' + window.currentTheme);
    }

    // 💡 VÁ LỖI: Chỉ đổi màu trực tiếp vào Canvas, KHÔNG xóa chart đi vẽ lại
    if (window.WA_Chart) {
        const isTrad = window.currentTheme === 'trad';
        const t_up = isTrad ? '#0ECB81' : '#2af592';
        const t_down = isTrad ? '#F6465D' : '#cb55e3';
        const t_text = isTrad ? '#848e9c' : '#527c82';
        const t_line = isTrad ? '#00F0FF' : '#41e6e7';

        window.WA_Chart.setStyles({
            candle: {
                bar: { upColor: t_up, downColor: t_down, noChangeColor: t_text,
                       upBorderColor: t_up, downBorderColor: t_down,
                       upWickColor: t_up, downWickColor: t_down },
                area: { lineColor: t_line,
                        backgroundColor: [
                            { offset: 0, color: isTrad ? 'rgba(0,240,255,0.2)' : 'rgba(65,230,231,0.2)' },
                            { offset: 1, color: 'rgba(0,0,0,0)' }
                        ]}
            },
            yAxis: { tickText: { color: t_text } }
        });
    }
};



window.applyFishFilter = function() {
    if (!window.WA_Chart) return;

    try {
        // 🚀 TẠO TEMPLATE ĐỘC QUYỀN VỚI HÀNG RÀO BẢO VỆ CHỐNG CRASH
        if (!window.isCyberMarkerRegistered && window.klinecharts && typeof window.klinecharts.registerOverlay === 'function') {
            window.klinecharts.registerOverlay({
                name: 'cyberMarker',
                needDefaultPointFigure: false,
                needDefaultXAxisFigure: false,
                needDefaultYAxisFigure: false,
                createPointFigures: ({ overlay, coordinates }) => {
                    if (!coordinates || coordinates.length === 0) return [];
                    
                    let data = overlay.extendData || {};
                    let textVal = typeof data === 'string' ? data : (data.text || '');
                    let isBuy = data.isBuy === true; 
                    let colorVal = data.color || '#00F0FF'; 
                    
                    let pixelX = Math.round(coordinates[0].x);
                    let pixelY = Math.round(coordinates[0].y) + (isBuy ? 8 : -8); 
                    
                    return [
                        {
                            type: 'text',
                            attrs: {
                                x: pixelX,
                                y: pixelY, 
                                text: (isBuy ? '▲ ' : '▼ ') + textVal,
                                align: 'center',
                                baseline: isBuy ? 'top' : 'bottom' 
                            },
                            ignoreEvent: true, 
                            styles: {
                                color: colorVal,
                                size: 11,
                                family: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                                weight: 'bold',
                                
                                // 👇 ĐÃ TRẢ LẠI ĐOẠN CODE TRIỆT TIÊU KHUNG XANH Ở ĐÂY 👇
                                backgroundColor: 'transparent',
                                borderColor: 'transparent',
                                borderSize: 0,
                                paddingLeft: 0,
                                paddingRight: 0,
                                paddingTop: 0,
                                paddingBottom: 0
                            }
                        }
                    ];
                }
            });
            window.isCyberMarkerRegistered = true;
        }

        // Kiểm tra checkbox giao diện
        let checkboxes = document.querySelectorAll('.marker-filter-cb');
        if (checkboxes.length === 0) return; 

        let activeTypes = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

        if (!window.activeWaveMarkers) window.activeWaveMarkers = {};
        let newActiveMarkers = {};

        // Nếu tắt filter hoặc ở khung lớn -> Xóa mượt mà
        if (activeTypes.length === 0 || (window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s')) {
            for (let oldId in window.activeWaveMarkers) {
                try { window.WA_Chart.removeOverlay(oldId); } catch(e) {}
            }
            window.activeWaveMarkers = {};
            return;
        }

        // Lọc dữ liệu an toàn
        let filteredMarkers = (window.scChartMarkers || []).filter(m => {
            let type = m.fishType || 'bot';
            if (type === 'sweep') type = 'bot';
            return activeTypes.includes(type);
        });

        let chartData = window.WA_Chart.getDataList();
        if (!chartData || chartData.length === 0) return;

        filteredMarkers.forEach((m, idx) => {
            let targetTs = m.time * 1000;
            let overlayId = 'marker_' + targetTs + '_' + idx;
            
            newActiveMarkers[overlayId] = true;

            // Thuật toán Smart-Diff: CHỈ VẼ MỚI NẾU CHƯA TỒN TẠI
            if (!window.activeWaveMarkers[overlayId]) {
                let candle = chartData.find(d => d.timestamp === targetTs);
                if (!candle) candle = chartData[chartData.length - 1];

                if (candle) {
                    let isBuy = m.position === 'belowBar'; 
                    let yPrice = isBuy ? candle.low : candle.high;

                    try {
                        window.WA_Chart.createOverlay({
                            id: overlayId,
                            name: 'cyberMarker', 
                            extendData: { isBuy: isBuy, text: m.text, color: m.color },
                            points: [{ timestamp: targetTs, value: yPrice }]
                        });
                    } catch(err) {} 
                }
            }
        });

        // Dọn dẹp marker cũ
        for (let oldId in window.activeWaveMarkers) {
            if (!newActiveMarkers[oldId]) { 
                try { window.WA_Chart.removeOverlay(oldId); } catch(e) {}
            }
        }
        window.activeWaveMarkers = newActiveMarkers;

    } catch (error) {
        console.error("🔴 Đã chặn được lỗi Crash tại applyFishFilter:", error);
    }
};

// Hàm hỗ trợ Xóa hình vẽ của User cho Bước 4 (không xóa Marker cá voi)
window.clearUserDrawings = function() {
    if (!window.WA_Chart) return;
    window.WA_Chart.removeOverlay(); // Xóa sạch tất cả
    window.applyFishFilter();       // Vẽ lại Marker cá voi
};

window.toggleProSidePanel = function(tabId, btnElement) {
    if (!document.getElementById('wa-panel-transition')) {
        const s = document.createElement('style');
        s.id = 'wa-panel-transition';
        s.textContent = `
    /* Desktop: Trượt ngang từ trái qua mượt mà */
    @media (min-width: 992px) {
        #sc-panel-content {
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.25s ease !important;
            overflow: hidden;
        }
        #sc-panel-content.collapsed { 
            width: 0 !important; min-width: 0 !important; opacity: 0; pointer-events: none; 
        }
    }

    /* Mobile: Trượt dọc từ dưới lên êm ái, không giật mạnh */
    @media (max-width: 991px) {
        #sc-panel-content {
            transition: height 0.4s cubic-bezier(0.33, 1, 0.68, 1), 
                        opacity 0.3s ease !important;
            width: 100% !important; 
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        #sc-panel-content.collapsed {
            flex: 0 0 0 !important;
            height: 0 !important; min-height: 0 !important;
            opacity: 0; 
            pointer-events: none;
            margin: 0 !important; padding: 0 !important; border: none !important;
        }
        .sc-tab-content { animation: none !important; }
        .sc-tab-content.active {
            animation: contentSlideUp 0.45s cubic-bezier(0.33, 1, 0.68, 1) forwards !important;
        }
        @keyframes contentSlideUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }

        /* ============================================
           FIX: SIDEBAR ICON KHÔNG BỊ ĐÈ BỞI PANEL
           ============================================ */

        /* Thanh icon công cụ vẽ luôn nằm trên cùng, không bị panel nội dung đè */
        .sc-sidebar-icons {
            position: relative;
            z-index: 10;
            flex-shrink: 0;
            background: var(--term-bg, #0b1217);
        }

        /* Panel nội dung (Watchlist, Alpha Flow...) nằm dưới thanh icon */
        #sc-panel-content {
            z-index: 5;
            position: relative;
        }

        /* Nội dung bên trong panel cuộn được, không bị cắt xén */
        .sc-tab-content {
            overflow-y: auto;
            -webkit-overflow-scrolling: touch; /* Cuộn mượt trên iOS */
            flex: 1 1 auto;
            min-height: 0; /* Quan trọng: cho phép flex child co lại đúng */
        }

        /* Đảm bảo wrapper tổng không bị tràn ngang */
        .sc-chart-wrapper,
        #super-chart-overlay {
            overflow-x: hidden;
        }
    }
`;
document.head.appendChild(s);
    }

    const panelContent = document.getElementById('sc-panel-content');
    const allBtns = document.querySelectorAll('.sc-sidebar-icon');
    const allTabs = document.querySelectorAll('.sc-tab-content');
    const isMobile = window.innerWidth <= 991;

    const oldBackdrop = document.getElementById('sc-panel-backdrop');
    if (oldBackdrop) oldBackdrop.remove(); 

    const doResize = function() {
        if (!window.WA_Chart) return;
        const start = Date.now();
        const animate = function() {
            if (window.WA_Chart) window.WA_Chart.resize();
            // Gọi liên tục trong 450ms (khớp với thời gian transition CSS)
            if (Date.now() - start < 450) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    const handleMobileUI = (isNowCollapsed) => {
        if (!isMobile) return;
        const chartArea = document.querySelector('.sc-chart-area');
        if (chartArea) {
            chartArea.dataset.mobileExpanded = isNowCollapsed ? 'true' : 'false';
        }
    };

    if (btnElement && btnElement.classList.contains('active')) {
        panelContent.classList.toggle('collapsed');
        handleMobileUI(panelContent.classList.contains('collapsed'));
        doResize();
        return; 
    }
    
    if (panelContent.classList.contains('collapsed')) {
        panelContent.classList.remove('collapsed');
    }

    allBtns.forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    allTabs.forEach(tab => { tab.style.display = 'none'; tab.classList.remove('active'); });
    const targetTab = document.getElementById('tab-' + tabId);
    if (targetTab) { targetTab.style.display = 'flex'; targetTab.classList.add('active'); }
    
    handleMobileUI(false); 
    doResize();
};

// ✅ NÚT ẨN/HIỆN PANEL — 1 tap/click dứt khoát, không giật
window.togglePanelCollapse = function() {
    const panelContent = document.getElementById('sc-panel-content');
    if (!panelContent) return;
    const isCollapsed = panelContent.classList.toggle('collapsed');
    const isMobile = window.innerWidth <= 991;
    const chartArea = document.querySelector('.sc-chart-area');
    if (isMobile && chartArea) {
        chartArea.dataset.mobileExpanded = isCollapsed ? 'true' : 'false';
    }
    // Cập nhật icon nút toggle
    const toggleBtn = document.getElementById('sc-panel-toggle-btn');
    if (toggleBtn) {
        toggleBtn.innerHTML = isCollapsed
            ? '<i class="fas fa-chevron-right"></i>'
            : '<i class="fas fa-chevron-left"></i>';
        toggleBtn.title = isCollapsed ? 'Mở panel' : 'Ẩn panel';
    }
    if (window.WA_Chart) {
        const start = Date.now();
        const animate = () => {
            if (window.WA_Chart) window.WA_Chart.resize();
            if (Date.now() - start < 450) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
};

window.renderProWatchlist = function(passedSearchTerm) {
    const wlBody = document.getElementById('sc-watchlist-body');
    if (!wlBody) return;
    
    let searchInput = document.getElementById('wl-search');
    let searchTerm = typeof passedSearchTerm === 'string' ? passedSearchTerm : (searchInput ? searchInput.value : '');

    let tokensToRender = []; let isSearching = searchTerm && searchTerm.trim().length > 0; let isShowingSuggested = false;
    if (isSearching) {
        let term = searchTerm.trim().toLowerCase();
        tokensToRender = window.allTokens.filter(t => (t.symbol && t.symbol.toLowerCase().includes(term)) || (t.contract && t.contract.toLowerCase().includes(term))).slice(0, 50);
    } else {
        let pinned = JSON.parse(localStorage.getItem('alpha_pins')) || [];
        tokensToRender = window.allTokens.filter(t => pinned.includes(t.symbol));
        if (tokensToRender.length === 0) { isShowingSuggested = true; let sortedByVol = [...window.allTokens].sort((a,b) => (b.volume?.daily_total || 0) - (a.volume?.daily_total || 0)); tokensToRender = sortedByVol.slice(0, 20); }
    }

    let html = '';
    if (isShowingSuggested) html += '<div style="padding:6px 15px; font-size:8.5px; color:#F0B90B; font-weight:800; background:rgba(240,185,11,0.05); border-bottom:1px solid #1A1F26; text-align:center;">CHƯA CÓ WATCHLIST - GỢI Ý TOP 20 TRENDING</div>';

    tokensToRender.forEach(t => {
        let sym = t.symbol; let isPinned = (JSON.parse(localStorage.getItem('alpha_pins')) || []).includes(sym);
        let isUp = (t.change_24h || 0) >= 0; let colorClass = isUp ? 'text-green' : 'text-red'; let sign = isUp ? '+' : '';
        let pinIconColor = isPinned ? '#F0B90B' : '#474d57';

        html += `<div class="wl-item" onclick="window.openProChart(window.allTokens.find(x => x.symbol === '${sym}'))">
                <div class="wl-sym" style="width: 45%;"><i class="fas fa-star" style="color:${pinIconColor}; font-size:10px; margin-right:6px; transition:0.2s;" onmouseover="this.style.color='#F0B90B'" onmouseout="this.style.color='${pinIconColor}'" onclick="event.stopPropagation(); window.togglePin('${sym}'); window.renderProWatchlist();"></i><img src="${t.icon || 'assets/tokens/default.png'}" onerror="this.src='assets/tokens/default.png'">${sym}</div>
                <div class="wl-price" style="width: 30%;">$${window.formatPrice(t.price)}</div>
                <div class="wl-chg ${colorClass}" style="width: 25%;">${sign}${parseFloat(t.change_24h||0).toFixed(2)}%</div>
            </div>`;
    });

    if (tokensToRender.length === 0 && isSearching) html = '<div style="text-align:center; padding:30px 10px; color:#5e6673; font-style:italic; font-size: 11px;">Không tìm thấy token nào trùng khớp.</div>';
    wlBody.innerHTML = html;
};

window.openProChart = function(t, isTimeSwitch = false) {
    const overlay = document.getElementById('super-chart-overlay');
    if (!overlay) return;

    // 🛡️ PHÁO HIỆU ƯU TIÊN CAO: Báo cho Drawing Engine lưu nét vẽ TRƯỚC KHI bị đè mất
    if (!isTimeSwitch) {
        window.dispatchEvent(new CustomEvent('WA_BEFORE_TOKEN_SWITCH'));
    }

    // ✅ FIX 3: Hủy API fetch cũ nếu còn đang chạy — tránh race condition (chồng chéo dữ liệu)
    if (window._fetchAbortCtrl) {
        window._fetchAbortCtrl.abort();
    }
    window._fetchAbortCtrl = new AbortController();
    const _abortSignal = window._fetchAbortCtrl.signal;

    

    window.currentChartToken = t; 
    overlay.classList.add('active');
    document.body.classList.add('overlay-active');

    if (!isTimeSwitch) {
        document.getElementById('sc-coin-symbol').innerText = (t.symbol || 'UNKNOWN') + '/USDT';
        let nameEl = document.getElementById('sc-coin-name'); if (nameEl) nameEl.innerText = t.name || t.symbol; 
        document.getElementById('sc-coin-logo').src = t.icon || 'assets/tokens/default.png';
        document.getElementById('sc-live-price').innerText = '$' + window.formatPrice(t.price);
        
        let limitEl = document.getElementById('sc-algo-limit');
        if (limitEl) { limitEl.innerHTML = `ALGO LIMIT: ⏳ TÍNH TOÁN...`; limitEl.style.color = '#F0B90B'; limitEl.style.background = 'rgba(240,185,11,0.1)'; limitEl.style.borderColor = 'rgba(240,185,11,0.3)'; }
        
        let chg = parseFloat(t.change_24h) || 0; let chgEl = document.getElementById('sc-change-24h');
        if (chgEl) { chgEl.innerText = `(${(chg >= 0 ? '+' : '')}${chg.toFixed(2)}%)`; chgEl.style.color = chg >= 0 ? '#00F0FF' : '#FF007F'; }

        document.getElementById('sc-top-mc').innerText = '$' + window.formatCompactNum(t.market_cap);
        document.getElementById('sc-top-liq').innerText = '$' + window.formatCompactNum(t.liquidity);
        document.getElementById('sc-top-vol').innerText = '$' + window.formatCompactNum(t.volume?.daily_total || 0);
        
        let el24hVol = document.getElementById('sc-top-vol-24h');
        if (el24hVol) el24hVol.innerText = '$' + window.formatCompactNum(t.volume?.rolling_24h || 0);
        document.getElementById('sc-top-hold').innerText = window.formatInt(t.holders);
        document.getElementById('sc-top-tx').innerText = window.formatInt(t.tx_count);
    }

        const container = document.getElementById('sc-chart-container');

    
    // [WA-DRAWING] Lưu drawings của timeframe CŨ trước khi destroy chart
    if (window.__wa_onBeforeChartInit) {
        window.__wa_onBeforeChartInit(
            (window.currentChartToken && window.currentChartToken.symbol) || '',
            window.oldChartInterval || window.currentChartInterval || '1d'
        );
    }
    
    if (window.WA_Chart) { window.WA_Chart.destroy(); }
    window.scActivePriceLines = [];
    
    // XÓA SẠCH CONTAINER (KHÔNG DÙNG WRAPPER ĐỂ TRÁNH VỠ LAYOUT)
    container.innerHTML = ''; 

    if (!isTimeSwitch) {
        let tradesBox = document.getElementById('sc-live-trades');
        if (tradesBox) tradesBox.innerHTML = '<div style="text-align:center; margin-top:20px; color:#5e6673; font-style:italic;">Connecting to Dex...</div>';
        window.scCurrentCluster = null; 
        window.quantStats = { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };
        
        let fStatus = document.getElementById('fut-live-status'); if(fStatus) { fStatus.innerText = '⏳ ĐANG TẢI...'; fStatus.style.color = 'var(--term-warn)'; }
        let oiElUI = document.getElementById('fut-oi-val'); if(oiElUI) oiElUI.innerText = '$--';
        let fundVal = document.getElementById('fut-funding-val'); if(fundVal) fundVal.innerText = '--%';
        let liqLEl = document.getElementById('fut-liq-long'); if(liqLEl) liqLEl.innerText = '$0';
        let liqSEl = document.getElementById('fut-liq-short'); if(liqSEl) liqSEl.innerText = '$0';
        let fVerdict = document.getElementById('fut-ai-verdict'); if(fVerdict) { fVerdict.innerText = '⚖️ ĐANG PHÂN TÍCH...'; fVerdict.style.cssText = 'font-size: 10px; font-weight: 800; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #848e9c;'; }
        
        let tape = document.getElementById('cc-sniper-tape');
        if(tape) tape.innerHTML = '<div style="font-size: 11px; color: #527c82; text-align: center; margin-top: 50px; font-style:italic;">Đang quét...</div>';
        
        let liqTape = document.getElementById('fut-liq-tape');
        if(liqTape) liqTape.innerHTML = '<div style="font-size: 10px; color: #527c82; text-align: center; margin-top: 45px; font-style:italic;">Đang rình cá mập bị luộc...</div>';
        window.lastLiqEvent = null; 
        
        setTimeout(() => {
            if (typeof window.injectSmartMoneyTab === 'function') window.injectSmartMoneyTab();
            if (typeof window.injectFuturesTab === 'function') window.injectFuturesTab();
            if (typeof window.fetchSmartMoneyData === 'function') window.fetchSmartMoneyData(t.contract, t.chainId || t.chain_id || 56);
            if (typeof window.fetchFuturesSentiment === 'function') window.fetchFuturesSentiment(t.symbol);
            if (typeof window.fetchCommandCenterFutures === 'function') window.fetchCommandCenterFutures(t.symbol);
        }, 100);
    }

    setTimeout(() => {
        let priceVal = parseFloat(t.price) || 1;
        let prec = 4;
        if (priceVal < 1) prec = 6; if (priceVal < 0.1) prec = 8; if (priceVal < 0.0001) prec = 10;

        let isTrad = window.currentTheme === 'trad';
        let t_text = isTrad ? '#848e9c' : '#527c82'; let t_line = isTrad ? '#00F0FF' : '#41e6e7'; let t_up = isTrad ? '#0ECB81' : '#2af592'; let t_down = isTrad ? '#F6465D' : '#cb55e3';
        
        let overlayElem = document.getElementById('super-chart-overlay');
        if(overlayElem) { overlayElem.classList.remove('theme-cyber', 'theme-trad'); overlayElem.classList.add('theme-' + window.currentTheme); }
        let themeSel = document.getElementById('sc-theme-select'); if(themeSel) themeSel.value = window.currentTheme;

        if (window.WaveIndicatorAPI) window.WaveIndicatorAPI.register();

        // 1. KHỞI TẠO CHART BẰNG BỨC TƯỜNG LỬA (WA_Chart)
        container.style.position = 'relative'; 
        if (!window.WA_Chart.init('sc-chart-container')) return;

        // 🚀 KÍCH HOẠT WAVE CHART ENGINE ĐỂ TỰ ĐỒNG BỘ STYLE NẾN VÀ LƯỚI
        if (window.WaveChartEngine) {
            window.WaveChartEngine.init();
        }

        // ĐĂNG KÝ CLICK ICON (Xử lý mượt cả VOL mặc định)
        window.WA_Chart.subscribeAction('onTooltipIconClick', function(data) {
            if (!data.indicatorName) return;
            const indName = data.indicatorName;
            const paneId = data.paneId;

            if (data.iconId === 'visible') {
                window.WA_Chart.overrideIndicator({ name: indName, visible: true }, paneId);
                let ind = window.scActiveIndicators?.find(x => x.name === indName);
                if (ind) ind.visible = true;
            } 
            else if (data.iconId === 'invisible') {
                window.WA_Chart.overrideIndicator({ name: indName, visible: false }, paneId);
                let ind = window.scActiveIndicators?.find(x => x.name === indName);
                if (ind) ind.visible = false;
            } 
            else if (data.iconId === 'setting') {
                if (typeof window.openIndicatorSettings === 'function') {
                    let calcParams;
                    // Bước 1: Thử lấy trực tiếp từ canvas
                    try {
                        const instances = window.WA_Chart.getIndicators({ name: indName, paneId: paneId });
                        if (instances && instances.length > 0) calcParams = instances[0].calcParams;
                    } catch(e) {}
                    
                    // Bước 2: Fallback -> lấy từ state scActiveIndicators
                    if (!calcParams || calcParams.length === 0) {
                        const stateEntry = (window.scActiveIndicators || []).find(x => x.name === indName);
                        if (stateEntry && stateEntry.params && stateEntry.params.length > 0) {
                            calcParams = stateEntry.params;
                        }
                    }
                    
                    // Bước 3: Truyền vào modal (openIndicatorSettings tự fallback về defaults nếu vẫn rỗng)
                    window.openIndicatorSettings({ name: indName, shortName: indName, calcParams: calcParams }, paneId);
                }
            }
            else if (data.iconId === 'close') {
                if (typeof window.removeIndicatorFromChart === 'function') {
                    window.removeIndicatorFromChart(indName);
                } 
                // Fallback chuẩn qua Tường Lửa
                try { window.WA_Chart.removeIndicator(paneId, indName); } catch(e){}
            }
        });

        // 2. CHỈ TẠO LỚP KÍNH HTML CHỨA ĐÚNG LOGO WATERMARK (ĐÃ XÓA SẠCH HTML LEGEND RÁC)
        // 🛡️ TẠO LỚP UI HTML NỔI (CHỨA OHLC LEGEND VÀ WATERMARK)
        let customUI = document.getElementById('wa-custom-ui-layer');
        if (!customUI) {
            customUI = document.createElement('div');
            customUI.id = 'wa-custom-ui-layer';
            customUI.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;';
            
            customUI.innerHTML = `
                <div style="position: absolute; top: 6px; left: 10px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 600; display: flex; gap: 8px; flex-wrap: wrap; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                    <span id="tp-symbol" style="color: #EAECEF; margin-right: 4px;">---</span>
                    <span><span style="color: #848e9c;">O</span> <span id="tp-o" style="color: #848e9c;">---</span></span>
                    <span><span style="color: #848e9c;">H</span> <span id="tp-h" style="color: #0ECB81;">---</span></span>
                    <span><span style="color: #848e9c;">L</span> <span id="tp-l" style="color: #F6465D;">---</span></span>
                    <span><span style="color: #848e9c;">C</span> <span id="tp-c" style="color: #848e9c;">---</span></span>
                    <span><span style="color: #848e9c;">V</span> <span id="tp-v" style="color: #848e9c;">---</span></span>
                </div>
                <div style="position: absolute; bottom: 25px; left: 15px; font-family: var(--font-main, Arial); font-weight: 800; font-size: 20px; color: rgba(255,255,255,0.06); letter-spacing: 2px;">WAVE ALPHA</div>
            `;
            container.appendChild(customUI);
        }

        window.WA_Chart.setPriceVolumePrecision(prec, 2);
        window.WA_Chart.createIndicator('VOL', false, { height: 80 });

        // --- BẮT ĐẦU PATCH: TỐI ƯU RESIZE OBSERVER & CLEAR CACHE ---
        const chartArea = document.querySelector('.sc-chart-area');
        if (chartArea) delete chartArea.dataset.mobileExpanded;
        
        const oldBackdrop = document.getElementById('sc-panel-backdrop');
        if (oldBackdrop) oldBackdrop.classList.remove('visible');

        if (window._chartResizeObserver) window._chartResizeObserver.disconnect();
        
        let _resizeRafId = null;
        const isMobile = () => window.innerWidth <= 991;
        
        let _lastChartW = 0, _lastChartH = 0; // Lưu lại kích thước cũ
        window._chartResizeObserver = new ResizeObserver(function(entries) {
            if (!window.WA_Chart || !entries || entries.length === 0) return;
            
            // 🚀 KHÓA INFINITE LOOP: Chỉ vẽ lại nếu chiều rộng/cao thực sự thay đổi lớn hơn 1px
            const rect = entries[0].contentRect;
            if (Math.abs(rect.width - _lastChartW) < 1 && Math.abs(rect.height - _lastChartH) < 1) return;
            _lastChartW = rect.width; 
            _lastChartH = rect.height;

            if (_resizeRafId) cancelAnimationFrame(_resizeRafId);
            
            // Giới hạn call stack vẽ lại chart ở tốc độ 60fps của thiết bị
            _resizeRafId = requestAnimationFrame(function() {
                if (window.WA_Chart) window.WA_Chart.resize();
                _resizeRafId = null;
            });
        });
        
        window._chartResizeObserver.observe(container);
        
        // Trên mobile, Canvas đôi khi không bắt được sự thay đổi của class cha, 
        // cần observe thêm lớp Wrapper để chắc chắn kích hoạt resize khi Sidebar thụt thò.
        if (isMobile() && chartArea) {
            window._chartResizeObserver.observe(chartArea);
        }
        // --- KẾT THÚC PATCH ---

        // [FIX 1.2] Áp dụng màu Chart, Grid VÀ Viền Nến từ LocalStorage khi khởi tạo
        const ws = JSON.parse(localStorage.getItem('wa_chart_settings') || '{}');
        
        const chartContainer = document.getElementById('sc-chart-container');
        if (chartContainer) chartContainer.style.background = ws.colBg || '#0f1a1c';

        if (ws.colUp || ws.showGrid === false || ws.colBg || !ws.colUp) {
            const ub = ws.colUp || '#2af592';
            const ubd = ws.colUpBd || ub;
            const db = ws.colDown || '#cb55e3';
            const dbd = ws.colDownBd || db;

            // Tự động chuyển mode Hollow (nến rỗng) nếu màu thân nến là transparent
            const cType = (ub === 'transparent' || ub === 'rgba(0,0,0,0)') ? 'candle_up_stroke' : 'candle_solid';

            window.WA_Chart.setStyles({
                    grid: {
                        // SỬA LỖI Ở 2 DÒNG DƯỚI ĐÂY: Thêm chữ ws. vào trước showGrid
                        horizontal: { show: ws.showGrid !== false, color: 'rgba(255,255,255,0.05)', style: 'dashed' },
                        vertical:   { show: ws.showGrid !== false, color: 'rgba(255,255,255,0.05)', style: 'dashed' }
                    },
                    candle: { 
                        type: window.currentChartInterval === 'tick' ? 'area' : cType,
                        bar: {
                            upColor: ub, downColor: db, noChangeColor: '#848e9c',
                            upBorderColor: ubd, downBorderColor: dbd,
                            upWickColor: ubd, downWickColor: dbd
                        }
                    },
                    watermark: {
                        show: true, text: 'WAVE ALPHA', color: 'rgba(255, 255, 255, 0.05)', size: 48, weight: '800'
                    }
                });
        }

        // 3. SỰ KIỆN RÊ CHUỘT
        // 🛡️ HỆ THỐNG LEGEND HTML (HOẠT ĐỘNG 2 CHẾ ĐỘ: CROSSHAIR & REALTIME)
        window._isCrosshairActive = false;
        
        window._lastLegendUpdateMs = 0;
        window._lastLegendSig = null;

        window.updateLegendUI = function(ohlc, dataIndex = -1) {
            if (!ohlc || typeof ohlc.open === 'undefined') return;
            
            // 🚀 BỘ TIẾT LƯU 1: Nếu là Realtime tự nhảy (chuột đang nghỉ), ép giảm xuống 10 FPS
            const now = Date.now();
            if (dataIndex === -1) {
                if (now - window._lastLegendUpdateMs < 100) return;
                window._lastLegendUpdateMs = now;
            }

            // 🚀 BỘ TIẾT LƯU 2: Tạo chữ ký, nếu giá và volume không đổi thì TUYỆT ĐỐI KHÔNG VẼ LẠI
            const sig = `${dataIndex}_${ohlc.close}_${ohlc.volume}`;
            if (window._lastLegendSig === sig) return;
            window._lastLegendSig = sig;

            const fmt = (v) => v >= 1 ? v.toFixed(2) : v.toFixed(6);
            const fmtVol = (v) => v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(2)+'K' : (v || 0).toFixed(0);
            const setEl = (id, val, color) => { const el = document.getElementById(id); if (el) { el.textContent = val; if (color) el.style.color = color; } };

            const barColor = ohlc.close >= ohlc.open ? '#0ECB81' : '#F6465D';
            setEl('tp-o', fmt(ohlc.open), '#848e9c'); setEl('tp-h', fmt(ohlc.high), '#0ECB81');
            setEl('tp-l', fmt(ohlc.low), '#F6465D'); setEl('tp-c', fmt(ohlc.close), barColor);
            setEl('tp-v', fmtVol(ohlc.volume || 0), '#848e9c');
            
            // Tính % thay đổi của nến hiện tại
            let pct = ohlc.open > 0 ? ((ohlc.close - ohlc.open) / ohlc.open) * 100 : 0;
            let sign = pct >= 0 ? '+' : '';
            let symStr = (window.currentChartToken ? window.currentChartToken.symbol : 'UNKNOWN').toUpperCase();
            let tfStr = (window.currentChartInterval || '').toUpperCase();
            setEl('tp-symbol', `${symStr} ${tfStr} (${sign}${pct.toFixed(2)}%)`, barColor);

            // Báo cho file indicator biết index hiện tại (Giữ nguyên logic của bạn)
            if (dataIndex >= 0 && window.WaveIndicatorAPI && typeof window.WaveIndicatorAPI.updateLegendValues === 'function') {
                window.WaveIndicatorAPI.updateLegendValues(dataIndex);
            }
        };

        window.WA_Chart.subscribeAction('onCrosshairChange', function(param) {
            const dataList = window.WA_Chart.getDataList();
            if (!dataList || dataList.length === 0) return;

            if (param && param.dataIndex !== undefined && param.dataIndex >= 0) {
                window._isCrosshairActive = true;
                window.updateLegendUI(dataList[param.dataIndex], param.dataIndex);
            } else {
                window._isCrosshairActive = false;
                let lastIndex = dataList.length - 1;
                window.updateLegendUI(dataList[lastIndex], lastIndex); // Chuột rời khỏi chart -> Cập nhật nến mới nhất
            }
        });

        
// 🛡️ BẮN PHÁO HIỆU: ĐÃ ĐỔI TOKEN MỚI
let dataInterval = window.getOptimalDataInterval(window.currentChartInterval);
        
window.dispatchEvent(new CustomEvent('WA_TOKEN_SWITCHED', {
    detail: { 
        token: t, 
        interval: dataInterval, 
        uiInterval: window.currentChartInterval 
    }
}));

}, 100); 
};

// chart-ui.js — hàm changeChartInterval
window.changeChartInterval = function(interval, btnEl, force = false) {
    if (window.currentChartInterval === interval) return;
    
    // 🚀 BẢO VỆ RENKO: Chặn đổi Timeframe nếu đang là Renko
    const config = window.WaveChartEngine ? window.WaveChartEngine.getConfig() : null;
    if (config && parseInt(config.chartType) === 14 && !force) {
        const masterBtn = document.getElementById('btn-wa-timeframe-master');
        if (masterBtn) {
            // Nháy đỏ cảnh báo
            masterBtn.style.background = 'rgba(246, 70, 93, 0.2)';
            masterBtn.style.borderColor = '#F6465D';
            setTimeout(() => {
                masterBtn.style.background = 'rgba(255,255,255,0.03)';
                masterBtn.style.borderColor = 'rgba(0,240,255,0.2)';
            }, 300);
        }
        console.log("Renko không phụ thuộc thời gian. Đã chặn đổi Timeframe.");
        return; // Dừng luôn, không đổi UI, không gọi API!
    }

    // Cập nhật nhãn hiển thị trên nút Master mới
    const labelEl = document.getElementById('wa-current-tf-label');
    if (labelEl) labelEl.innerText = interval.toUpperCase();

    document.querySelectorAll('.sc-time-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    window.oldChartInterval = window.currentChartInterval;
    window.currentChartInterval = interval;

    let tfEl = document.getElementById('chart-legend-tf');
    if (tfEl) tfEl.innerText = interval.toUpperCase();

    // TÌM ĐOẠN NÀY ĐỂ XÓA VÀ THAY THẾ:
    if (window.currentChartToken) {
        // 🚀 GỌI HÀM INTERCEPTOR ĐỂ TRÁO ĐỔI THỜI GIAN NẾU ĐANG LÀ RENKO
        let dataInterval = window.getOptimalDataInterval(interval);

        window.dispatchEvent(new CustomEvent('WA_TIMEFRAME_CHANGED', {
            detail: { 
                token: window.currentChartToken, 
                interval: dataInterval,  // Gửi 15m cho API Binance tải data
                oldInterval: window.oldChartInterval,
                uiInterval: interval // Truyền thêm để biết UI thực chất đang ở đâu
            }
        }));
    }
};

window.closeProChart = function() {
    // [FIX] Ngắt ResizeObserver khi đóng chart để chống tràn RAM
    if (window._chartResizeObserver) {
        window._chartResizeObserver.disconnect();
        window._chartResizeObserver = null;
    }
    
    if (window.quantWorker) { window.quantWorker.terminate(); window.quantWorker = null; }
    if (typeof window.stopFuturesEngine === 'function') window.stopFuturesEngine();
    if (window.scCalcInterval) { clearInterval(window.scCalcInterval); window.scCalcInterval = null; }
    
    // 💡 VÁ LỖI: Dừng vòng lặp 150ms của Tape để không bú CPU khi đã đóng chart
    if (window.scTapeInterval) { clearInterval(window.scTapeInterval); window.scTapeInterval = null; } 
    
    if (window.proChartApiInterval) { clearInterval(window.proChartApiInterval); window.proChartApiInterval = null; }

    // 💡 VÁ LỖI: Xóa sạch rác markers để lần mở chart sau không bị dính data cũ
    window.activeWaveMarkers = {};
    window.scChartMarkers = [];

    const overlay = document.getElementById('super-chart-overlay');
    if (overlay) { overlay.classList.remove('active'); document.body.classList.remove('overlay-active'); }
    if (window.chartWs) { window.chartWs.close(); window.chartWs = null; }
    if (window.WA_Chart) { 
        window.WA_Chart.destroy();
    }
    window.currentChartToken = null; 
};

// =========================================================================
// 🧩 BƯỚC 2: CHART TYPE SELECTOR (21 LOẠI BIỂU ĐỒ - CHUẨN MODAL ĐỒNG BỘ)
// =========================================================================
(function initChartTypeSelector() {
    'use strict';

    // Hàm bọc SVG để đồng bộ style
    const _svg = (paths) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

    const CHART_TYPES = [
        // Nhóm 1: Cơ bản
        { grp: 'CƠ BẢN', id: 1, name: 'Nến Nhật', icon: _svg('<path d="M9 4v16M15 4v16M7 8h4v8H7zM13 10h4v6h-4z"/>'), phase: 1, desc: 'Nến Open-High-Low-Close chuẩn' },
        { grp: 'CƠ BẢN', id: 2, name: 'Nến Rỗng', icon: _svg('<path d="M9 4v16M15 4v16"/><rect x="7" y="8" width="4" height="8"/><rect x="13" y="10" width="4" height="6"/>'), phase: 1, desc: 'Nến tăng rỗng ruột giúp giảm mỏi mắt' },
        { grp: 'CƠ BẢN', id: 3, name: 'Thanh (Bars)', icon: _svg('<path d="M9 4v16M6 8h3M9 16h3M15 4v16M12 10h3M15 18h3"/>'), phase: 1, desc: 'Thanh OHLC chuẩn thị trường Mỹ' },
        { grp: 'CƠ BẢN', id: 4, name: 'Cột (Columns)', icon: _svg('<path d="M18 20V10M12 20V4M6 20v-4"/>'), phase: 1, desc: 'Cột hiển thị theo giá Close' },
        { grp: 'CƠ BẢN', id: 5, name: 'Đỉnh - Đáy', icon: _svg('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'), phase: 1, desc: 'Bỏ qua Open/Close, chỉ xem biên độ' },
        
        // Nhóm 2: Đường & Vùng
        { grp: 'ĐƯỜNG & VÙNG', id: 6, name: 'Đường (Line)', icon: _svg('<polyline points="3 17 9 11 15 15 21 5"/>'), phase: 1, desc: 'Đường nối các giá đóng cửa' },
        { grp: 'ĐƯỜNG & VÙNG', id: 7, name: 'Đường + Điểm', icon: _svg('<polyline points="3 17 9 11 15 15 21 5"/><circle cx="9" cy="11" r="2"/><circle cx="15" cy="15" r="2"/><circle cx="21" cy="5" r="2"/>'), phase: 1, desc: 'Đường Line có đánh dấu đỉnh/đáy' },
        { grp: 'ĐƯỜNG & VÙNG', id: 8, name: 'Bậc Thang', icon: _svg('<polyline points="3 17 9 17 9 11 15 11 15 5 21 5"/>'), phase: 1, desc: 'Step Line giúp nhìn rõ nền giá' },
        { grp: 'ĐƯỜNG & VÙNG', id: 9, name: 'Vùng (Area)', icon: _svg('<path d="M3 20h18V5l-6 10-6-4-6 9z" fill="currentColor" fill-opacity="0.2"/>'), phase: 1, desc: 'Đổ bóng Gradient dưới đường Line' },
        { grp: 'ĐƯỜNG & VÙNG', id: 10, name: 'Vùng HLC', icon: _svg('<path d="M3 17l6-6 6 4 6-10v14H3z" fill="currentColor" fill-opacity="0.15"/><path d="M3 21l6-6 6 4 6-10" opacity="0.4"/>'), phase: 1, desc: 'Vùng dao động thực tế High-Low-Close' },
        { grp: 'ĐƯỜNG & VÙNG', id: 11, name: 'Đường Cơ Sở', icon: _svg('<line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2"/><polyline points="3 12 7 8 13 15 21 6"/>'), phase: 1, desc: 'Baseline: Trên xanh, dưới đỏ' },
        
        // Nhóm 3: Khử Nhiễu
        { grp: 'KHỬ NHIỄU (PRO)', id: 12, name: 'Heikin Ashi', icon: _svg('<path d="M9 4v16M15 4v16M7 10h4v6H7zM13 8h4v8h-4z"/>'), phase: 1, desc: 'Nến trung bình lọc nhiễu sóng' },
        { grp: 'KHỬ NHIỄU (PRO)', id: 13, name: 'Nến Khối Lượng', icon: _svg('<path d="M9 4v16M15 4v16M5 10h8v6H5zM14 8h2v8h-2z"/>'), phase: 2, desc: 'Bề ngang nến tỷ lệ với Volume' },
        { grp: 'KHỬ NHIỄU (PRO)', id: 14, name: 'Renko', icon: _svg('<rect x="5" y="14" width="6" height="6"/><rect x="11" y="8" width="6" height="6"/>'), phase: 2, desc: 'Gạch giá trị, loại bỏ thời gian' },
        { grp: 'KHỬ NHIỄU (PRO)', id: 15, name: 'Line Break', icon: _svg('<path d="M7 16h4v4H7zM13 8h4v12h-4zM7 4h4v10H7z"/>'), phase: 2, desc: 'Chỉ vẽ nến khi có Breakout' },
        { grp: 'KHỬ NHIỄU (PRO)', id: 16, name: 'Point & Figure', icon: _svg('<path d="M6 6l4 4M10 6l-4 4M14 14l4 4M18 14l-4 4M14 6h4v4h-4z"/>'), phase: 2, desc: 'Lưới X-O kinh điển của Wyckoff' },
        { grp: 'KHỬ NHIỄU (PRO)', id: 17, name: 'Kagi', icon: _svg('<polyline points="5 18 5 10 12 10 12 4 19 4 19 14" stroke-width="3"/><polyline points="12 10 12 16 19 16 19 14" stroke-width="1"/>'), phase: 2, desc: 'Đường gãy khúc theo tỷ lệ đảo chiều' },
        { grp: 'KHỬ NHIỄU (PRO)', id: 18, name: 'Range Bars', icon: _svg('<rect x="5" y="6" width="4" height="12"/><rect x="15" y="6" width="4" height="12"/><line x1="3" y1="6" x2="21" y2="6" stroke-dasharray="2 2"/><line x1="3" y1="18" x2="21" y2="18" stroke-dasharray="2 2"/>'), phase: 2, desc: 'Mỗi nến có biên độ Ticks bằng nhau' },
        
        // Nhóm 4: Order Flow
        { grp: 'ORDER FLOW (PRO)', id: 19, name: 'Footprint', icon: _svg('<rect x="8" y="4" width="8" height="16"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/>'), phase: 3, desc: 'In Volume Bid/Ask vào lõi nến' },
        { grp: 'ORDER FLOW (PRO)', id: 20, name: 'TPO Profile', icon: _svg('<path d="M5 6h4M5 12h8M5 18h6M11 6h2M15 12h2" stroke-width="3"/>'), phase: 3, desc: 'Hồ sơ thời gian chữ cái' },
        { grp: 'ORDER FLOW (PRO)', id: 21, name: 'VPVR Profile', icon: _svg('<path d="M3 6h12M3 10h8M3 14h16M3 18h10"/>'), phase: 3, desc: 'Hồ sơ khối lượng dồn dập' }
    ];

    const style = document.createElement('style');
    style.textContent = `
        /* 🚀 MODAL LOẠI BIỂU ĐỒ (Clone chuẩn UI của Modal Settings) */
        #wa-chart-type-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999; pointer-events: none; opacity: 0; visibility: hidden; transition: all 0.15s ease; transform: translateZ(0); }
        #wa-chart-type-modal.show { opacity: 1; visibility: visible; pointer-events: auto; }
        
        #wa-ctm-box { position: absolute; top: 50%; left: 50%; transform: translate3d(-50%, -50%, 0); background: #1e222d; width: 520px; max-height: 80vh; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; pointer-events: auto; }
        #wa-ctm-box.is-dragging { transition: none !important; will-change: left, top; }
        
        #wa-ctm-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none; }
        #wa-ctm-header:active { cursor: grabbing; }
        .wa-ctm-title { font-size: 16px; font-weight: 700; color: #EAECEF; pointer-events: none; }
        #btn-wa-ctm-close { color: #848e9c; cursor: pointer; font-size: 18px; transition: 0.2s; }
        #btn-wa-ctm-close:hover { color: #F6465D; }
        
        #wa-ctm-content { flex: 1; padding: 20px 24px; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; align-items: start; }
        #wa-ctm-content::-webkit-scrollbar { width: 4px; }
        #wa-ctm-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        
        .wa-ct-grp { display: flex; flex-direction: column; gap: 4px; }
        .wa-ct-title { font-size: 10px; font-weight: 800; color: #848e9c; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; text-transform: uppercase; }
        .wa-ct-item { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; background: transparent; border: 1px solid transparent; color: #EAECEF; }
        .wa-ct-item:hover { background: rgba(255,255,255,0.05); color: #FFF; }
        .wa-ct-item.active { background: rgba(0,240,255,0.08); border-color: rgba(0,240,255,0.2); color: #00F0FF; }
        .wa-ct-icon { display: flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s; }
        .wa-ct-item:hover .wa-ct-icon, .wa-ct-item.active .wa-ct-icon { opacity: 1; }
        .wa-ct-text { font-size: 12px; font-weight: 500; flex: 1; }
        .wa-ct-item.active .wa-ct-text { font-weight: 700; }
        .wa-ct-pro { font-size: 8px; background: rgba(240,185,11,0.15); color: #F0B90B; padding: 2px 5px; border-radius: 4px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid rgba(240,185,11,0.3); margin-left: auto; }
        
        /* 📱 ĐỒNG BỘ MOBILE BOTTOM SHEET CỰC XỊN SÒ */
        @media (max-width: 768px) {
            #wa-ctm-box {
                top: auto !important; bottom: 0 !important; left: 50% !important;
                transform: translate3d(-50%, 100%, 0) !important;
                width: 92vw !important; height: 80vh !important; max-height: none;
                border-radius: 24px 24px 0 0 !important;
                transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
            }
            #wa-chart-type-modal.show #wa-ctm-box {
                transform: translate3d(-50%, 0, 0) !important;
            }
            #wa-ctm-header { padding-top: 24px; position: relative; border-bottom: none; }
            #wa-ctm-header::before { content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; }
            /* Gộp thành 1 cột trên Mobile cho dễ vuốt chọn */
            #wa-ctm-content { grid-template-columns: 1fr; gap: 12px; padding: 0 24px 24px 24px; }
            .wa-ct-item { padding: 10px; }
        }
    `;
    document.head.appendChild(style);

    // 3. Auto-inject Nút bấm vào Toolbar
    const checkToolbar = setInterval(() => {
        const toolbar = document.querySelector('.sc-time-btn')?.parentNode || document.querySelector('.sc-tools-left') || document.querySelector('.sc-toolbar');
        
        if (toolbar) {
            clearInterval(checkToolbar);

            // Tìm hoặc tạo Group chứa các nút
            let btnWrap = document.getElementById('wa-chart-controls-group');
            if (!btnWrap) {
                btnWrap = document.createElement('div');
                btnWrap.id = 'wa-chart-controls-group'; 
                btnWrap.style.cssText = 'position: relative; display: inline-flex; align-items: center; gap: 6px; margin-left: 8px;';
                toolbar.appendChild(btnWrap);
            }

            // Tạo nút Type Button (Sử dụng đúng thông số CSS giống hệt nút Settings)
            const chartTypeBtn = document.createElement('button');
            chartTypeBtn.id = 'btn-wa-chart-type';
            chartTypeBtn.setAttribute('data-wa-tip', 'Loại Biểu Đồ');
            chartTypeBtn.style.cssText = 'background: rgba(255,255,255,0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 8px; height: 26px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: 0.2s;';
            chartTypeBtn.innerHTML = `
                <span id="wa-ct-btn-icon" style="display:flex; align-items:center;">${CHART_TYPES[0].icon}</span>
            `;
            
            // Xử lý Hover y chang Nút Settings
            chartTypeBtn.onmouseenter = () => { chartTypeBtn.style.color = '#EAECEF'; chartTypeBtn.style.background = 'rgba(255,255,255,0.08)'; };
            chartTypeBtn.onmouseleave = () => { chartTypeBtn.style.color = '#848e9c'; chartTypeBtn.style.background = 'rgba(255,255,255,0.05)'; };
            
            btnWrap.appendChild(chartTypeBtn);

            // Bơm Cấu trúc HTML của Modal vào DOM
            const modal = document.createElement('div');
            modal.id = 'wa-chart-type-modal';
            modal.innerHTML = `
                <div id="wa-ctm-box">
                    <div id="wa-ctm-header">
                        <div class="wa-ctm-title">Loại Biểu Đồ</div>
                        <div id="btn-wa-ctm-close">✖</div>
                    </div>
                    <div id="wa-ctm-content"></div>
                </div>
            `;
            document.body.appendChild(modal);

            const contentDiv = document.getElementById('wa-ctm-content');

            // Render Danh sách Menu
            const groups = [...new Set(CHART_TYPES.map(t => t.grp))];
            groups.forEach((gName) => {
                const grpDiv = document.createElement('div');
                grpDiv.className = 'wa-ct-grp';
                grpDiv.innerHTML = `<div class="wa-ct-title">${gName}</div>`;
                
                CHART_TYPES.filter(t => t.grp === gName).forEach(item => {
                    const isPro = item.phase > 1;
                    const div = document.createElement('div');
                    div.className = 'wa-ct-item';
                    div.dataset.id = item.id;
                    div.title = item.desc;
                    div.innerHTML = `
                        <span class="wa-ct-icon">${item.icon}</span>
                        <span class="wa-ct-text">${item.name}</span>
                        ${isPro ? '<span class="wa-ct-pro">PRO</span>' : ''}
                    `;

                    div.onclick = (e) => {
                        e.stopPropagation();
                        if (window.WaveChartEngine) {
                            // 🚀 SỬA LỖI KẸT GIAO DIỆN: Bỏ tham số 'true' để Engine áp dụng đổi kiểu (Line, Nến) lập tức
                            window.WaveChartEngine.update({ chartType: item.id });
                            
                            // 🚀 ÉP ĐỒNG BỘ: Nếu chọn Renko mà chưa ở 1m -> Ép tải data 1m ngầm
                            if (item.id === 14 && window.currentChartInterval !== '1m') {
                                window.changeChartInterval('1m', null, true); // force = true
                            } else {
                                // 🚀 SỬA LỖI: LUÔN KHÔI PHỤC DATA GỐC KHI ĐỔI CHART
                                // Để khi tắt Renko, nó trả lại Nến Nhật bình thường!
                                if (window.WaveDataEngine && window.WA_Chart) {
                                    let reprocessedData = window.WaveDataEngine.processHistory(window.WaveDataEngine.rawHistory, true);
                                    window.WA_Chart.applyNewData(reprocessedData);
                                }
                            }
                        }
                        
                        // Đổi Icon trên nút
                        const btnIcon = document.getElementById('wa-ct-btn-icon');
                        if (btnIcon) btnIcon.innerHTML = item.icon;
                        
                        // Active UI
                        contentDiv.querySelectorAll('.wa-ct-item').forEach(el => el.classList.remove('active'));
                        div.classList.add('active');
                        
                        window.closeChartTypeModal();
                    };
                    
                    grpDiv.appendChild(div);
                });
                contentDiv.appendChild(grpDiv);
            });

            // Thuật toán Kéo thả Drag y hệt Settings
            const modalBox = document.getElementById('wa-ctm-box');
            const header = document.getElementById('wa-ctm-header');
            let isDragging = false, startX, startY, initLeft, initTop;
            
            header.addEventListener('mousedown', (e) => {
                if (window.innerWidth <= 768) return; // Tắt kéo thả trên Mobile
                isDragging = true; startX = e.clientX; startY = e.clientY;
                const rect = modalBox.getBoundingClientRect();
                initLeft = rect.left; initTop = rect.top;
                modalBox.style.transform = 'translate3d(0, 0, 0)'; 
                modalBox.style.left = initLeft + 'px'; 
                modalBox.style.top = initTop + 'px';
                modalBox.classList.add('is-dragging');
                document.body.style.userSelect = 'none'; 
            });
            window.addEventListener('mousemove', (e) => { if (!isDragging) return; modalBox.style.left = (initLeft + e.clientX - startX) + 'px'; modalBox.style.top = (initTop + e.clientY - startY) + 'px'; });
            window.addEventListener('mouseup', () => { isDragging = false; modalBox.classList.remove('is-dragging'); document.body.style.userSelect = ''; });

            // Core Bật/Tắt
            window.openChartTypeModal = function() {
                // Tự động đặt lại tâm tọa độ bằng 3D
                modalBox.classList.remove('is-dragging');
                modalBox.style.transform = 'translate3d(-50%, -50%, 0)'; 
                modalBox.style.left = '50%'; 
                modalBox.style.top = '50%';
                
                // Đồng bộ Highlight (Active state)
                const currentType = window.WaveChartEngine ? window.WaveChartEngine.config.chartType : 1;
                contentDiv.querySelectorAll('.wa-ct-item').forEach(el => {
                    if (parseInt(el.dataset.id) === currentType) el.classList.add('active');
                    else el.classList.remove('active');
                });
                
                modal.classList.add('show');
            };

            window.closeChartTypeModal = function() {
                modal.classList.remove('show');
                // Chờ CSS animation mờ hẳn rồi mới chỉnh tọa độ về gốc
                setTimeout(() => {
                    modalBox.classList.remove('is-dragging');
                    modalBox.style.transform = 'translate3d(-50%, -50%, 0)';
                    modalBox.style.left = '50%';
                    modalBox.style.top = '50%';
                }, 150);
            };

            // Gắn sự kiện vào Nút bấm Toolbar (Cơ chế Toggle)
            chartTypeBtn.onclick = (e) => {
                e.stopPropagation();
                if (modal.classList.contains('show')) window.closeChartTypeModal();
                else window.openChartTypeModal();
            };

            // Đóng khi click nút X
            document.getElementById('btn-wa-ctm-close').onclick = window.closeChartTypeModal;

            // Đóng khi click bậy ra ngoài màn hình tối
            modal.addEventListener('mousedown', (e) => {
                if (e.target === modal) window.closeChartTypeModal();
            });
        }
    }, 200);
})();

// =========================================================================
// ⚙️ BƯỚC 3: CHART SETTINGS MODAL (ĐÃ REFACTOR NATIVE COMPONENTS)
// =========================================================================
(function initChartSettingsModal() {
    'use strict';
    if (window.__wa_chart_settings_modal_initialized) return;
    window.__wa_chart_settings_modal_initialized = true;

    // 1. DỌN SẠCH CSS RÁC: Đã gỡ bỏ toàn bộ CSS của .wa-select-wrap, .wa-select-options, .wa-color-swatch cũ.
    const style = document.createElement('style');
    style.textContent = `
        #wa-chart-settings-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999; pointer-events: none; opacity: 0; visibility: hidden; transition: all 0.15s ease; transform: translateZ(0); }
        #wa-chart-settings-modal.show { opacity: 1; visibility: visible; pointer-events: auto; }
        .wa-csm-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1e222d; width: 680px; height: 500px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; pointer-events: auto; }
        .wa-csm-box.is-dragging { transition: none !important; will-change: left, top; }
        .wa-csm-sidebar { width: 200px; background: #131722; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 20px 0 0 0; }
        .wa-csm-tab { padding: 12px 24px; color: #848e9c; font-size: 13px; font-weight: 600; cursor: pointer; border-left: 3px solid transparent; transition: all 0.2s; display: flex; align-items: center; gap: 10px; }
        .wa-csm-tab:hover { background: rgba(255,255,255,0.03); color: #EAECEF; }
        .wa-csm-tab.active { background: rgba(38,166,154,0.1); color: #26a69a; border-left-color: #26a69a; }
        .wa-csm-content { flex: 1; display: flex; flex-direction: column; background: #1e222d; }
        .wa-csm-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none; }
        .wa-csm-header:active { cursor: grabbing; }
        .wa-csm-title { font-size: 16px; font-weight: 700; color: #EAECEF; pointer-events: none; }
        .wa-csm-close { color: #848e9c; cursor: pointer; font-size: 18px; transition: 0.2s; }
        .wa-csm-close:hover { color: #F6465D; }
        .wa-csm-panels { flex: 1; overflow-y: auto; padding: 20px 24px; }
        .wa-csm-panel { display: none; flex-direction: column; gap: 20px; }
        .wa-csm-panel.active { display: flex; }
        .wa-csm-row { display: flex; justify-content: space-between; align-items: center; }
        .wa-csm-label { font-size: 13px; color: #b7bdc6; display: flex; align-items: center; gap: 8px; }
        .wa-csm-control { display: flex; align-items: center; gap: 10px; }
        .wa-csm-slider { width: 100px; accent-color: #26a69a; }
        .wa-switch { position: relative; display: inline-block; width: 36px; height: 20px; }
        .wa-switch input { opacity: 0; width: 0; height: 0; }
        .wa-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .2s; border-radius: 20px; }
        .wa-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #848e9c; transition: .2s; border-radius: 50%; }
        input:checked + .wa-slider { background-color: rgba(38,166,154,0.3); }
        input:checked + .wa-slider:before { transform: translateX(16px); background-color: #26a69a; }
        .wa-csm-divider { font-size: 11px; font-weight: 800; color: #527c82; text-transform: uppercase; margin-top: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; }
        
        /* 🚀 FIX LỖI TÀNG HÌNH: Khôi phục kích thước cho các ô chọn màu */
        .wa-ism-swatch { width: 28px; height: 28px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: 0.2s; background: transparent; flex-shrink: 0; }
        .wa-ism-swatch:hover { border-color: #00F0FF; box-shadow: 0 0 5px rgba(0,240,255,0.3); }

        /* CSS Custom Confirm Modal */
        #wa-custom-confirm-overlay { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: transparent; z-index: 99999999; align-items: center; justify-content: center; }
        .wa-confirm-box { background: linear-gradient(180deg, #1c2127 0%, #161a1e 100%); border: 1px solid #2b3139; border-radius: 16px; width: 340px; padding: 24px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05); animation: waScaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); font-family: 'Be Vietnam Pro', 'Inter', sans-serif; }
        @keyframes waScaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .wa-confirm-icon { width: 56px; height: 56px; background: rgba(246, 70, 93, 0.1); border: 1px solid rgba(246, 70, 93, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 0 20px rgba(246, 70, 93, 0.2); }
        .wa-confirm-icon i { color: #F6465D; font-size: 24px; }
        .wa-confirm-title { font-size: 16px; font-weight: 700; color: #EAECEF; margin-bottom: 8px; letter-spacing: 0.5px; }
        .wa-confirm-text { font-size: 13px; color: #848e9c; margin-bottom: 24px; line-height: 1.5; }
        .wa-confirm-actions { display: flex; gap: 12px; justify-content: center; }
        .wa-btn-cancel { flex: 1; background: transparent; color: #EAECEF; border: 1px solid #333; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; }
        .wa-btn-cancel:hover { background: rgba(255,255,255,0.05); border-color: #555; }
        .wa-btn-confirm { flex: 1; background: #F6465D; color: #fff; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; box-shadow: 0 4px 12px rgba(246, 70, 93, 0.3); }
        .wa-btn-confirm:hover { background: #ff526a; box-shadow: 0 6px 16px rgba(246, 70, 93, 0.4); transform: translateY(-1px); }
        
        /* Đồng bộ Mobile */
        @media (max-width: 768px) {
            .wa-csm-box {
                top: auto !important; bottom: 0 !important; left: 50% !important;
                transform: translate3d(-50%, 100%, 0) !important;
                width: 92vw !important; height: 85vh !important; min-width: 0 !important;
                border-radius: 24px 24px 0 0 !important;
                flex-direction: column !important;
                transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
            }
            #wa-chart-settings-modal.show .wa-csm-box { transform: translate3d(-50%, 0, 0) !important; }
            .wa-csm-header { padding-top: 24px; position: relative; border-bottom: none; }
            .wa-csm-header::before { content: ''; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 4px; }
            .wa-csm-sidebar { width: 100% !important; flex-direction: row; padding: 10px 16px 0; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); overflow-x: auto; white-space: nowrap; scrollbar-width: none; align-items: flex-start; }
            .wa-csm-sidebar::-webkit-scrollbar { display: none; }
            .wa-csm-sidebar > div:first-child { display: flex; gap: 8px; }
            .wa-csm-tab { padding: 10px 16px; border-left: none; border-bottom: 2px solid transparent; border-radius: 4px 4px 0 0; font-size: 14px; }
            .wa-csm-tab.active { border-bottom-color: #26a69a; background: transparent; }
            .wa-csm-sidebar > div:nth-child(2) { display: none; }
            .wa-csm-sidebar > div:last-child { display: block !important; padding: 0 0 0 12px !important; border-top: none !important; border-left: 1px solid rgba(255,255,255,0.1) !important; margin-left: 4px; }
            .wa-csm-sidebar > div:last-child button { padding: 8px 12px !important; font-size: 10px !important; margin-top: 2px; }
            .wa-csm-row { padding: 6px 0; }
        }
    `;
    document.head.appendChild(style);

    // 2. REFACTOR HTML: Chuẩn hóa WaveDropdown (div + hidden input) và WaveColorPicker (.wa-ism-swatch)
    const modalHTML = `
        <div id="wa-chart-settings-modal">
            <div class="wa-csm-box" id="wa-csm-box">
                <div class="wa-csm-sidebar">
                    <div>
                        <div class="wa-csm-tab active" data-tab="csm-symbol">Biểu Tượng</div>
                        <div class="wa-csm-tab" data-tab="csm-status">Trạng Thái</div>
                        <div class="wa-csm-tab" data-tab="csm-appearance">Giao Diện</div>
                        <div class="wa-csm-tab" data-tab="csm-pro">Nâng Cao</div>
                    </div>
                    <div style="flex: 1;"></div>
                    <div style="padding: 20px 16px; border-top: 1px solid rgba(255,255,255,0.05);">
                        <button id="wa-btn-reset-cfg" style="width: 100%; background: rgba(246, 70, 93, 0.05); color: #F6465D; border: 1px dashed rgba(246, 70, 93, 0.3); padding: 10px 0; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; cursor: pointer; transition: 0.2s;">KHÔI PHỤC MẶC ĐỊNH</button>
                    </div>
                </div>
                <div class="wa-csm-content">
                    <div class="wa-csm-header">
                        <div class="wa-csm-title">Cài đặt Biểu đồ</div>
                        <div class="wa-csm-close" id="btn-wa-csm-close">✖</div>
                    </div>
                    <div class="wa-csm-panels">
                        <div id="csm-symbol" class="wa-csm-panel active">
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Loại biểu đồ</div>
                                <div class="wa-csm-control">
                                    <div id="dd-wrapper-chartType"></div>
                                    <input type="hidden" id="csm-chart-type" data-bind="chartType" data-type="number">
                                </div>
                            </div>
                            <div class="wa-csm-divider">Màu sắc</div>
                            
                            <div id="csm-ui-candles" style="display:flex; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row"><div class="wa-csm-label">Thân nến (Body)</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="upColor"></div><div class="wa-ism-swatch" data-color-bind="downColor"></div></div></div>
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label"><label class="wa-switch"><input type="checkbox" data-bind="showBorder"><span class="wa-slider"></span></label> Viền (Borders)</div>
                                    <div class="wa-csm-control">
                                        <label class="wa-switch" title="Màu độc lập"><input type="checkbox" data-bind="borderIndependent"><span class="wa-slider"></span></label>
                                        <div id="csm-border-swatches" style="display:flex; gap:10px; opacity:0.5; pointer-events:none;">
                                            <div class="wa-ism-swatch" data-color-bind="borderUpColor"></div><div class="wa-ism-swatch" data-color-bind="borderDownColor"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label"><label class="wa-switch"><input type="checkbox" data-bind="showWick"><span class="wa-slider"></span></label> Bóng nến (Wicks)</div>
                                    <div class="wa-csm-control">
                                        <label class="wa-switch" title="Màu độc lập"><input type="checkbox" data-bind="wickIndependent"><span class="wa-slider"></span></label>
                                        <div id="csm-wick-swatches" style="display:flex; gap:10px; opacity:0.5; pointer-events:none;">
                                            <div class="wa-ism-swatch" data-color-bind="wickUpColor"></div><div class="wa-ism-swatch" data-color-bind="wickDownColor"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div id="csm-ui-lines" style="display:none; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row"><div class="wa-csm-label" id="lbl-line-color">Màu Đường / Vùng</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="upColor"></div><div class="wa-ism-swatch" id="swatch-line-down" data-color-bind="downColor" style="display:none;"></div></div></div>
                            </div>

                            <div id="csm-ui-step" style="display:none; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label"><label class="wa-switch"><input type="checkbox" data-bind="stepLineSingleColor"><span class="wa-slider"></span></label> Dùng 1 màu liền mạch</div>
                                </div>
                                <div class="wa-csm-row"><div class="wa-csm-label">Màu Đoạn Tăng / 1 Màu</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="upColor"></div></div></div>
                                <div class="wa-csm-row" id="row-step-down"><div class="wa-csm-label">Màu Đoạn Giảm</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="downColor"></div></div></div>
                            </div>

                            <div id="csm-ui-hlc" style="display:none; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row"><div class="wa-csm-label">Đường Đóng Cửa (Close)</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="hlcCloseColor"></div></div></div>
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label"><label class="wa-switch"><input type="checkbox" data-bind="hlcShowHighLow"><span class="wa-slider"></span></label> Viền Đỉnh/Đáy (H-L)</div>
                                    <div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="hlcHighColor"></div><div class="wa-ism-swatch" data-color-bind="hlcLowColor"></div></div>
                                </div>
                                <div class="wa-csm-row"><div class="wa-csm-label">Độ mờ viền (Opacity)</div><div class="wa-csm-control"><input type="range" class="wa-csm-slider" min="0" max="1" step="0.05" data-bind="hlcHighLowOpacity" data-type="number"></div></div>
                                <div class="wa-csm-row"><div class="wa-csm-label">Nền Trên / Nền Dưới</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="hlcUpFillColor"></div><div class="wa-ism-swatch" data-color-bind="hlcDownFillColor"></div></div></div>
                                <div class="wa-csm-row"><div class="wa-csm-label">Độ mờ nền (Opacity)</div><div class="wa-csm-control"><input type="range" class="wa-csm-slider" min="0" max="1" step="0.05" data-bind="hlcFillOpacity" data-type="number"></div></div>
                            </div>

                            <div id="csm-ui-baseline" style="display:none; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row"><div class="wa-csm-label">Đường Trên / Nền Trên</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="baselineUpColor"></div><div class="wa-ism-swatch" data-color-bind="baselineUpFill"></div></div></div>
                                <div class="wa-csm-row"><div class="wa-csm-label">Đường Dưới / Nền Dưới</div><div class="wa-csm-control"><div class="wa-ism-swatch" data-color-bind="baselineDownColor"></div><div class="wa-ism-swatch" data-color-bind="baselineDownFill"></div></div></div>
                                <div class="wa-csm-row"><div class="wa-csm-label">Độ mờ nền chung</div><div class="wa-csm-control"><input type="range" class="wa-csm-slider" min="0" max="1" step="0.05" data-bind="baselineFillOpacity" data-type="number"></div></div>
                                <div class="wa-csm-divider">Thông số Baseline</div>
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label">Mức cơ sở (%)</div>
                                    <div class="wa-csm-control"><input type="number" style="width:80px; text-align:center; background: #131722; color: #EAECEF; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;" min="0" max="100" data-bind="baselineValue" data-type="number"></div>
                                </div>
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label">Nguồn giá</div>
                                    <div class="wa-csm-control">
                                        <div id="dd-wrapper-baselineSource"></div>
                                        <input type="hidden" id="csm-baseline-source" data-bind="baselinePriceSource">
                                    </div>
                                </div>
                            </div>


<div id="csm-ui-renko" style="display:none; flex-direction:column; gap:16px;">
    <div style="background: rgba(0, 240, 255, 0.05); border: 1px dashed rgba(0, 240, 255, 0.2); padding: 10px; border-radius: 6px; font-size: 11.5px; color: #00F0FF; margin-bottom: 5px; line-height: 1.5;">
        <b>💡 AUTO NINZARENKO:</b> Hệ thống tự động tính kích thước gạch (Brick Size) linh hoạt theo biên độ từng Token. Bạn chỉ cần chỉnh <b>Tỷ lệ Trend Threshold</b> để thay đổi độ mượt và râu nến.
    </div>
    
    <div class="wa-csm-row">
        <div class="wa-csm-label">Nguồn giá</div>
        <div class="wa-csm-control"><div id="dd-wrapper-renkoSource"></div><input type="hidden" id="csm-renko-source" data-bind="renkoSource"></div>
    </div>
    <div class="wa-csm-row">
        <div class="wa-csm-label">Phương pháp (Brick Size)</div>
        <div class="wa-csm-control"><div id="dd-wrapper-renkoMethod"></div><input type="hidden" id="csm-renko-method" data-bind="renkoMethod"></div>
    </div>
    
    <div class="wa-csm-row" id="row-renko-atr">
        <div class="wa-csm-label">Độ dài ATR</div>
        <div class="wa-csm-control"><input type="number" class="wa-csm-input-num" data-bind="renkoAtrLength" data-type="number"></div>
    </div>
    <div class="wa-csm-row" id="row-renko-trad" style="display:none;">
        <div class="wa-csm-label">Kích thước gạch tĩnh ($)</div>
        <div class="wa-csm-control"><input type="number" class="wa-csm-input-num" data-bind="renkoBoxSize" data-type="number"></div>
    </div>
    <div class="wa-csm-row" id="row-renko-perc" style="display:none;">
        <div class="wa-csm-label">Phần trăm giá trị (%)</div>
        <div class="wa-csm-control"><input type="number" step="0.1" class="wa-csm-input-num" data-bind="renkoPercentage" data-type="number" placeholder="1.0"></div>
    </div>
    
    <div class="wa-csm-divider">Thông số Đảo chiều (Threshold)</div>
    <div class="wa-csm-row">
        <div class="wa-csm-label" style="flex-direction: column; align-items: flex-start; gap: 4px;">
            <div>Trend Threshold (%)</div>
            <div style="font-size: 10px; color: #848e9c; max-width: 250px; font-weight: normal;">
                Chuẩn NinZa là <b>50%</b> (Giá nhích đủ 50% Brick Size sẽ tạo nến mới/đảo chiều). Nếu bạn nhập <b>100%</b>, biểu đồ sẽ trở về dạng Renko thường (gạch vuông, không râu).
            </div>
        </div>
        <div class="wa-csm-control">
            <input type="number" step="1" min="1" max="100" style="width:80px; text-align:center; background: #131722; color: #EAECEF; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;" data-bind="renkoTrendPct" data-type="number" placeholder="50">
        </div>
    </div>
</div>



                            <div class="wa-csm-divider">Trục Y</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Thang đo giá</div>
                                <div class="wa-csm-control">
                                    <div id="dd-wrapper-yAxisMode"></div>
                                    <input type="hidden" id="csm-yaxis-mode" data-bind="yAxisMode">
                                </div>
                            </div>
                        </div>
                        
                        <div id="csm-status" class="wa-csm-panel">
                            <div class="wa-csm-row"><div class="wa-csm-label">OHLC Values</div><label class="wa-switch"><input type="checkbox" data-bind="showOHLC"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Đếm ngược (Countdown)</div><label class="wa-switch"><input type="checkbox" data-bind="showCountdown"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Đường giá Last Price</div><label class="wa-switch"><input type="checkbox" data-bind="showLastPriceLine"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Nhãn High/Low</div><label class="wa-switch"><input type="checkbox" data-bind="showHighLowTags"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-divider">Watermark</div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Hiển thị Dấu chìm</div><div class="wa-csm-control"><input type="range" class="wa-csm-slider" min="0" max="0.3" step="0.01" data-bind="watermarkOpacity"><label class="wa-switch"><input type="checkbox" data-bind="showWatermark"><span class="wa-slider"></span></label></div></div>
                        </div>

                        <div id="csm-appearance" class="wa-csm-panel">
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Kiểu nền</div>
                                <div class="wa-csm-control">
                                    <div id="dd-wrapper-bgType"></div>
                                    <input type="hidden" id="csm-bg-type" data-bind="bgType">
                                    <div class="wa-ism-swatch" data-color-bind="bgColor"></div>
                                    <div class="wa-ism-swatch" data-color-bind="bgColor2" id="csm-bg2-swatch" style="display:none;"></div>
                                </div>
                            </div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Lưới dọc</div><label class="wa-switch"><input type="checkbox" data-bind="gridVertical"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Lưới ngang</div><label class="wa-switch"><input type="checkbox" data-bind="gridHorizontal"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Màu Lưới</div><div class="wa-ism-swatch" data-color-bind="gridColor"></div></div>
                            <div class="wa-csm-divider">Trục & Không gian</div>
                            <div class="wa-csm-row">
                                <div class="wa-csm-label">Tâm ngắm</div>
                                <div class="wa-csm-control">
                                    <div id="dd-wrapper-crosshairMode"></div>
                                    <input type="hidden" id="csm-crosshair-mode" data-bind="crosshairMode">
                                </div>
                            </div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Lề phải (Nến)</div><input type="range" class="wa-csm-slider" min="0" max="50" step="1" data-bind="rightMargin" data-type="number"></div>
                        </div>
                        
                        <div id="csm-pro" class="wa-csm-panel">
                            <div style="background: rgba(240,185,11,0.1); border: 1px dashed rgba(240,185,11,0.3); padding: 10px; border-radius: 6px; font-size: 11px; color: #F0B90B; margin-bottom: 10px;">🚀 Dự phòng cho Phase 4.</div>
                            <div class="wa-csm-row"><div class="wa-csm-label">PAC Coloring</div><label class="wa-switch"><input type="checkbox" data-bind="pacColoring"><span class="wa-slider"></span></label></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const confirmHTML = `
        <div id="wa-custom-confirm-overlay">
            <div class="wa-confirm-box">
                <div class="wa-confirm-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="wa-confirm-title">XÁC NHẬN KHÔI PHỤC</div>
                <div class="wa-confirm-text" id="wa-confirm-msg"></div>
                <div class="wa-confirm-actions">
                    <button class="wa-btn-cancel" id="wa-btn-cancel-confirm">HỦY BỎ</button>
                    <button class="wa-btn-confirm" id="wa-btn-ok-confirm">KHÔI PHỤC</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML + confirmHTML);

    // 3. TẠO DATA CHO WAVEDROPDOWN (Đã sửa lại đúng chuẩn { val, text } của Core UI)
    const ddConfigs = [
        { 
            id: 'chartType', 
            wrapId: 'dd-wrapper-chartType', 
            inputId: 'csm-chart-type',
            options: [
                { val: '1', text: 'Nến Nhật' }, { val: '2', text: 'Nến Rỗng' }, { val: '3', text: 'Thanh (Bars)' },
                { val: '4', text: 'Cột (Columns)' }, { val: '5', text: 'Đỉnh-Đáy (H-L)' }, { val: '6', text: 'Đường (Line)' },
                { val: '7', text: 'Đường + Điểm' }, { val: '8', text: 'Bậc Thang' }, { val: '9', text: 'Vùng (Area)' },
                { val: '10', text: 'Vùng HLC (Pro)' }, { val: '11', text: 'Đường Cơ Sở (Pro)' },
                { val: '12', text: 'Heikin Ashi (Pro)' }, { val: '14', text: 'Renko (Pro)' }
            ]
        },
        {
            id: 'renkoMethod',
            wrapId: 'dd-wrapper-renkoMethod',
            inputId: 'csm-renko-method',
            options: [{ val: 'atr', text: 'Average True Range (ATR)' }, { val: 'traditional', text: 'Truyền thống' }, { val: 'percentage', text: 'Tỷ lệ phần trăm (LTP)' }]
        },
        {
            id: 'renkoSource',
            wrapId: 'dd-wrapper-renkoSource',
            inputId: 'csm-renko-source',
            options: [{ val: 'close', text: 'Giá đóng cửa' }, { val: 'ohlc', text: 'Giá OHLC' }]
        },
        {
            id: 'baselinePriceSource',
            wrapId: 'dd-wrapper-baselineSource',
            inputId: 'csm-baseline-source',
            options: [{ val: 'close', text: 'Đóng cửa' }, { val: 'hl2', text: 'TB (H+L)/2' }, { val: 'ohlc4', text: 'TB Toàn phần' }]
        },
        {
            id: 'yAxisMode',
            wrapId: 'dd-wrapper-yAxisMode',
            inputId: 'csm-yaxis-mode',
            options: [{ val: 'normal', text: 'Bình thường' }, { val: 'percentage', text: 'Phần trăm (%)' }, { val: 'log', text: 'Logarit' }]
        },
        {
            id: 'bgType',
            wrapId: 'dd-wrapper-bgType',
            inputId: 'csm-bg-type',
            options: [{ val: 'solid', text: 'Đơn sắc' }, { val: 'gradient', text: 'Gradient' }]
        },
        {
            id: 'crosshairMode',
            wrapId: 'dd-wrapper-crosshairMode',
            inputId: 'csm-crosshair-mode',
            options: [{ val: 'normal', text: 'Bình thường' }, { val: 'hidden', text: 'Ẩn' }]
        }
    ];

    // Cập nhật giá trị hiển thị cho Slider
    document.querySelectorAll('.wa-csm-slider').forEach(slider => {
        const badge = document.createElement('span');
        badge.style.cssText = 'min-width:34px; text-align:right; font-size:10px; color:#848e9c; font-variant-numeric:tabular-nums; margin-left:8px; display:inline-block; font-weight: bold;';
        badge.innerText = slider.value;
        slider.parentNode.appendChild(badge);
        slider.addEventListener('input', (e) => {
            let val = e.target.value;
            badge.innerText = slider.max > 10 ? val + 'px' : parseFloat(val).toFixed(2);
        });
        slider.dispatchEvent(new Event('input'));
    });

    window.showCustomConfirm = function(msg, onConfirm) {
        const overlay = document.getElementById('wa-custom-confirm-overlay');
        document.getElementById('wa-confirm-msg').innerText = msg;
        overlay.style.display = 'flex';
        const btnOk = document.getElementById('wa-btn-ok-confirm');
        const btnCancel = document.getElementById('wa-btn-cancel-confirm');
        
        const cleanup = () => { overlay.style.display = 'none'; btnOk.replaceWith(btnOk.cloneNode(true)); btnCancel.replaceWith(btnCancel.cloneNode(true)); };
        document.getElementById('wa-btn-cancel-confirm').addEventListener('click', cleanup, {once: true});
        document.getElementById('wa-btn-ok-confirm').addEventListener('click', () => { cleanup(); if (onConfirm) onConfirm(); }, {once: true});
    };

    const modal = document.getElementById('wa-chart-settings-modal');
    const modalBox = document.getElementById('wa-csm-box');
    const header = modal.querySelector('.wa-csm-header');

    // Drag logic
    let isDragging = false, startX, startY, initLeft, initTop;
    header.addEventListener('mousedown', (e) => {
        if (window.innerWidth <= 768) return; 
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = modalBox.getBoundingClientRect();
        initLeft = rect.left; initTop = rect.top;
        modalBox.style.transform = 'translate3d(0, 0, 0)'; 
        modalBox.style.left = initLeft + 'px'; 
        modalBox.style.top = initTop + 'px';
        modalBox.classList.add('is-dragging');
        document.body.style.userSelect = 'none'; 
    });
    window.addEventListener('mousemove', (e) => { if (!isDragging) return; modalBox.style.left = (initLeft + e.clientX - startX) + 'px'; modalBox.style.top = (initTop + e.clientY - startY) + 'px'; });
    window.addEventListener('mouseup', () => { isDragging = false; modalBox.classList.remove('is-dragging'); document.body.style.userSelect = ''; });

    // Tabs
    const tabs = modal.querySelectorAll('.wa-csm-tab');
    const panels = modal.querySelectorAll('.wa-csm-panel');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active')); panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(tab.dataset.tab).classList.add('active');
        };
    });

    // 4. KÍCH HOẠT CUSTOM COLOR PICKER
    modal.querySelectorAll('.wa-ism-swatch').forEach(swatch => {
        swatch.onclick = (e) => {
            e.stopPropagation();
            const key = swatch.dataset.colorBind;
            let curColor = swatch.style.backgroundColor || swatch.style.background || '#ffffff';
            if (curColor.startsWith('rgb') && !curColor.includes('rgba')) {
                 curColor = curColor.replace('rgb', 'rgba').replace(')', ', 1)');
            }
            if (window.WaveColorPicker) {
                window.WaveColorPicker.open(swatch, curColor, (newColor) => {
                    swatch.style.backgroundColor = newColor;
                    swatch.dataset.color = newColor; 
                    if (window.WaveChartEngine) {
                        window.WaveChartEngine.update({ [key]: newColor });
                    }
                });
            }
        };
    });

    function updateDynamicUI(config) {
        const t = parseInt(config.chartType) || 1; 
        
        // 🚀 ĐÃ SỬA: Bao gồm tất cả các loại biểu đồ Pro (13-21) để không bị mất bảng màu
        const isCandles = [1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].includes(t);
        const isLines = [6, 7, 9].includes(t);
        const isStep = (t === 8);
        const isHLC = (t === 10);
        const isBaseline = (t === 11);
        const isRenko = (t === 14); // 🚀 THÊM DÒNG NÀY
        let candleEl = document.getElementById('csm-ui-candles');
        if (candleEl) candleEl.style.display = isCandles ? 'flex' : 'none';

        let linesEl = document.getElementById('csm-ui-lines');
        if(linesEl) {
            linesEl.style.display = isLines ? 'flex' : 'none';
            let lineDownSwatch = document.getElementById('swatch-line-down');
            let lblLine = document.getElementById('lbl-line-color');
            if (lineDownSwatch) lineDownSwatch.style.display = (t === 7) ? 'block' : 'none';
            if (lblLine) lblLine.innerText = (t === 7) ? 'Đường Chính / Điểm Giảm' : 'Màu Đường / Vùng';
        }

        let stepEl = document.getElementById('csm-ui-step'); 
        if(stepEl) {
            stepEl.style.display = isStep ? 'flex' : 'none';
            let rowStepDown = document.getElementById('row-step-down');
            if (rowStepDown) rowStepDown.style.display = config.stepLineSingleColor ? 'none' : 'flex';
        }
        
        let hlcEl = document.getElementById('csm-ui-hlc'); if(hlcEl) hlcEl.style.display = isHLC ? 'flex' : 'none';
        let baseEl = document.getElementById('csm-ui-baseline'); if(baseEl) baseEl.style.display = isBaseline ? 'flex' : 'none';
        let renkoEl = document.getElementById('csm-ui-renko'); if(renkoEl) renkoEl.style.display = isRenko ? 'flex' : 'none';
        let bg2Swatch = document.getElementById('csm-bg2-swatch');
        if (bg2Swatch) bg2Swatch.style.display = config.bgType === 'gradient' ? 'block' : 'none';
        
        let wickSwatches = document.getElementById('csm-wick-swatches');
        if(wickSwatches) {
            wickSwatches.style.opacity = config.wickIndependent ? '1' : '0.5';
            wickSwatches.style.pointerEvents = config.wickIndependent ? 'auto' : 'none';
        }
        
        let borderSwatches = document.getElementById('csm-border-swatches');
        if(borderSwatches) {
            borderSwatches.style.opacity = config.borderIndependent ? '1' : '0.5';
            borderSwatches.style.pointerEvents = config.borderIndependent ? 'auto' : 'none';
        }
        // Logic ẩn hiện thông số Renko theo phương pháp đã chọn
        // Logic ẩn hiện thông số Renko theo phương pháp đã chọn (CÓ BẢO VỆ CHỐNG CRASH)
        if (isRenko) {
            const method = config.renkoMethod || 'atr';
            let elAtr = document.getElementById('row-renko-atr'); if(elAtr) elAtr.style.display = (method === 'atr') ? 'flex' : 'none';
            let elTrad = document.getElementById('row-renko-trad'); if(elTrad) elTrad.style.display = (method === 'traditional') ? 'flex' : 'none';
            let elPerc = document.getElementById('row-renko-perc'); if(elPerc) elPerc.style.display = (method === 'percentage') ? 'flex' : 'none';
        }
    }

    window.openChartSettings = function() {
        if (!window.WaveChartEngine) return;
        const config = window.WaveChartEngine.getConfig();
        
        // 🚀 ĐÃ SỬA: Chỉ điền giá trị cũ vào ô cài đặt, KHÔNG gắn thêm event lắng nghe ảo
        modal.querySelectorAll('[data-bind]').forEach(el => {
            const key = el.dataset.bind;
            if (config[key] !== undefined) {
                if (el.type === 'checkbox') el.checked = config[key];
                else el.value = config[key];
                
                if (el.type === 'range') {
                    const badge = el.parentNode.querySelector('span');
                    if (badge) badge.innerText = el.max > 10 ? el.value + 'px' : parseFloat(el.value).toFixed(2);
                }
            }
        });

        // 🚀 ĐÃ SỬA LỖI ĐỨNG BẢNG SETTINGS: Chặn WaveDropdown kích hoạt sự kiện khi vừa khởi tạo
        ddConfigs.forEach(dd => {
            const wrapper = document.getElementById(dd.wrapId);
            const hiddenInput = document.getElementById(dd.inputId);
            const currVal = String(config[dd.id]);

            if (window.WaveDropdown) {
                wrapper.innerHTML = ''; 
                let isInitializing = true; // Cờ chặn chạy hàm Change khi mới mở lên
                window.WaveDropdown.create(wrapper, dd.options, currVal, (newVal) => {
                    hiddenInput.value = newVal;
                    if (!isInitializing) hiddenInput.dispatchEvent(new Event('change'));
                });
                isInitializing = false;
            }
        });

        modal.querySelectorAll('.wa-ism-swatch').forEach(swatch => {
            const key = swatch.dataset.colorBind; 
            if (config[key]) swatch.style.background = config[key];
        });
        
        modalBox.classList.remove('is-dragging');
        modalBox.style.transform = 'translate3d(-50%, -50%, 0)'; 
        modalBox.style.left = '50%'; 
        modalBox.style.top = '50%';
        
        updateDynamicUI(config);
        modal.classList.add('show');
    };

    window.closeChartSettings = function() {
        if (window.WaveColorPicker) window.WaveColorPicker.close();
        modal.classList.remove('show');
        setTimeout(() => {
            modalBox.classList.remove('is-dragging');
            modalBox.style.transform = 'translate3d(-50%, -50%, 0)';
            modalBox.style.left = '50%';
            modalBox.style.top = '50%';
        }, 150);
    };

    document.getElementById('btn-wa-csm-close').onclick = window.closeChartSettings;

    // BẢO VỆ POPUP: Ngăn modal đóng ngang khi user đang click/kéo bảng màu (Lỗi UX cũ cậu nhắc)
    modal.addEventListener('mousedown', (e) => {
        // Chỉ đóng Modal nếu click đúng vào khoảng tối bên ngoài VÀ Picker màu đang không hoạt động
        const isClickingInsidePicker = e.target.closest('.wa-color-picker-container'); // Giả định class wrap của picker
        if (e.target === modal && !isClickingInsidePicker) {
            window.closeChartSettings();
        }
    });

    modal.querySelector('.wa-csm-panels').addEventListener('scroll', () => {
        if (window.WaveColorPicker && typeof window.WaveColorPicker.close === 'function') {
            // Cậu có thể gắn thêm flag isDragging trong Core nếu muốn lúc kéo màu cuộn thanh không bị tắt
            window.WaveColorPicker.close(); 
        }
    });

    // Lắng nghe thay đổi từ Hidden Input (do WaveDropdown bắn ra) và Checkbox/Range
    modal.querySelectorAll('[data-bind]').forEach(el => {
        const eventType = el.type === 'range' ? 'input' : 'change';
        el.addEventListener(eventType, (e) => {
            const key = el.dataset.bind;
            let value = el.type === 'checkbox' ? el.checked : el.value;
            if (el.dataset.type === 'number') value = parseFloat(value);
            
            if (window.WaveChartEngine) window.WaveChartEngine.update({ [key]: value });
            updateDynamicUI(window.WaveChartEngine.getConfig());

            // 🚀 XỬ LÝ SÂU: KHI ĐỔI CHART TYPE HOẶC THAY THÔNG SỐ RENKO
            if (key === 'chartType') {
                if (parseInt(value) === 14 && window.currentChartInterval !== '1m') {
                    // Nếu bấm sang Renko mà chưa ở 1m -> Ép tải Data API 15m ngầm
                    let dataInterval = window.getOptimalDataInterval(window.currentChartInterval);
                    window.dispatchEvent(new CustomEvent('WA_TIMEFRAME_CHANGED', {
                        detail: { token: window.currentChartToken, interval: dataInterval, oldInterval: window.currentChartInterval }
                    }));
                } else if (window.WaveDataEngine && window.WA_Chart) {
                    // 🚀 SỬA LỖI KẸT GẠCH: Ép hệ thống nhả bộ nhớ Renko và vẽ lại nến nguyên bản lập tức
                    let reprocessedData = window.WaveDataEngine.processHistory(window.WaveDataEngine.rawHistory, true);
                    window.WA_Chart.applyNewData(reprocessedData);
                }
            } else if (key.startsWith('renko') || parseInt(window.WaveChartEngine.getConfig().chartType) === 12) {
                // Đổi thông số gạch/nến -> Cập nhật trực tiếp lên màn hình
                if (window.WaveDataEngine && window.WA_Chart) {
                    let reprocessedData = window.WaveDataEngine.processHistory(window.WaveDataEngine.rawHistory, true);
                    window.WA_Chart.applyNewData(reprocessedData);
                }
            }
        });
    });

    const checkToolbar = setInterval(() => {
        const typeBtn = document.getElementById('btn-wa-chart-type');
        if (typeBtn && typeBtn.parentNode) {
            clearInterval(checkToolbar);
            if (!document.getElementById('btn-wa-chart-settings')) {
                const btnHTML = `
                    <button id="btn-wa-chart-settings" data-wa-tip="Cài đặt Biểu đồ" style="background: rgba(255,255,255,0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; margin-left: 6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                `;
                typeBtn.parentNode.insertAdjacentHTML('beforeend', btnHTML);
            }
            document.getElementById('btn-wa-chart-settings').onclick = (e) => { 
                e.stopPropagation(); 
                if (modal.classList.contains('show')) window.closeChartSettings();
                else window.openChartSettings();
            };
        }
    }, 200);

    const btnReset = document.getElementById('wa-btn-reset-cfg');
    if (btnReset) {
        btnReset.onmouseenter = () => { btnReset.style.background = 'rgba(246, 70, 93, 0.15)'; btnReset.style.borderColor = 'rgba(246, 70, 93, 0.6)'; };
        btnReset.onmouseleave = () => { btnReset.style.background = 'rgba(246, 70, 93, 0.05)'; btnReset.style.borderColor = 'rgba(246, 70, 93, 0.3)'; };
        btnReset.onclick = () => {
            window.showCustomConfirm("Bạn có chắc chắn muốn khôi phục toàn bộ cài đặt biểu đồ về mặc định? Hành động này không thể hoàn tác.", () => {
                localStorage.removeItem('wave_alpha_chart_config');
                if (window.WaveChartEngine) {
                    const defaultCfg = {
                        chartType: 1, upColor: '#0ECB81', downColor: '#F6465D',
                        showWick: true, wickIndependent: false, wickUpColor: '#0ECB81', wickDownColor: '#F6465D',
                        showBorder: true, borderIndependent: false, borderUpColor: '#0ECB81', borderDownColor: '#F6465D',
                        abnormalVolColoring: false, yAxisMode: 'normal',
                        showOHLC: true, showCountdown: true, showLastPriceLine: true, showHighLowTags: true, showWatermark: true, watermarkOpacity: 0.05,
                        bgType: 'solid', bgColor: '#131722', bgColor2: '#000000',
                        gridVertical: true, gridHorizontal: true, gridColor: 'rgba(255,255,255,0.06)',
                        sessionBreaks: false, crosshairMode: 'normal', rightMargin: 10, timezone: 'Asia/Ho_Chi_Minh',
                        stepLineSingleColor: false,
                        hlcCloseColor: '#00F0FF', hlcHighColor: '#0ECB81', hlcLowColor: '#F6465D',
                        hlcUpFillColor: '#0ECB81', hlcDownFillColor: '#F6465D',
                        hlcHighLowOpacity: 0.35, hlcFillOpacity: 0.15, hlcShowHighLow: true,
                        baselineUpColor: '#0ECB81', baselineDownColor: '#F6465D',
                        baselineUpFill: '#0ECB81', baselineDownFill: '#F6465D',
                        baselineFillOpacity: 0.2, baselineValue: 50, baselinePriceSource: 'close',
                        renkoBrickPct: 0.5, renkoTrendThreshold: 0
                    };
                    
                    window.WaveChartEngine.config = { ...defaultCfg };
                    window.WaveChartEngine.applyNow();
                    
                    // Render lại Dropdown
                    ddConfigs.forEach(dd => {
                        const wrapper = document.getElementById(dd.wrapId);
                        wrapper.innerHTML = '';
                        window.WaveDropdown.create(wrapper, dd.options, String(defaultCfg[dd.id]), (newVal) => {
                            document.getElementById(dd.inputId).value = newVal;
                            document.getElementById(dd.inputId).dispatchEvent(new Event('change'));
                        });
                    });

                    modal.querySelectorAll('[data-bind]').forEach(el => {
                        const key = el.dataset.bind;
                        const dataObj = typeof defaultCfg !== 'undefined' && defaultCfg[key] !== undefined ? defaultCfg : config;
                        if (dataObj[key] !== undefined) { 
                            if (el.type === 'checkbox') el.checked = dataObj[key]; 
                            else el.value = dataObj[key]; 
                            if (el.type === 'range') el.dispatchEvent(new Event('input'));
                        }
                    });
                    modal.querySelectorAll('.wa-ism-swatch').forEach(swatch => {
                        const key = swatch.dataset.colorBind; 
                        if (defaultCfg[key]) swatch.style.background = defaultCfg[key];
                    });
                    updateDynamicUI(defaultCfg);
                }
            });
        };
    }

    const proPanel = document.getElementById('csm-pro');
    if (proPanel) {
        const ioHTML = `
            <div class="wa-csm-divider" style="margin-top:10px;">Sao lưu cấu hình</div>
            <div style="display:flex; gap:10px;">
                <button id="wa-btn-export-cfg" style="flex:1; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:#EAECEF; padding:8px; border-radius:4px; font-size:11px; cursor:pointer;">📥 XUẤT JSON</button>
                <button id="wa-btn-import-cfg" style="flex:1; background:rgba(38,166,154,0.1); border:1px solid rgba(38,166,154,0.3); color:#26a69a; padding:8px; border-radius:4px; font-size:11px; cursor:pointer;">📤 NHẬP JSON</button>
            </div>
            <input type="file" id="wa-import-file" accept=".json" style="display:none;">
        `;
        proPanel.insertAdjacentHTML('beforeend', ioHTML);

        document.getElementById('wa-btn-export-cfg').onclick = () => {
            if (!window.WaveChartEngine) return;
            const blob = new Blob([JSON.stringify(window.WaveChartEngine.getConfig(), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'wave-alpha-chart-config.json';
            a.click();
            URL.revokeObjectURL(a.href);
        };

        document.getElementById('wa-btn-import-cfg').onclick = () => document.getElementById('wa-import-file').click();
        document.getElementById('wa-import-file').onchange = e => {
            const f = e.target.files[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = ev => {
                try {
                    const cfg = JSON.parse(ev.target.result);
                    if (window.WaveChartEngine) {
                        window.WaveChartEngine.update(cfg);
                        window.openChartSettings(); 
                        alert('Nhập cấu hình thành công!');
                    }
                } catch (err) { alert('File JSON không hợp lệ!'); }
            };
            fr.readAsText(f);
            e.target.value = ''; 
        };
    }
})();

// =========================================================================
// ⏱️ BƯỚC 5: CHART OVERLAYS (NATIVE COUNTDOWN & WATERMARK)
// =========================================================================
(function initChartOverlays() {
    'use strict';

    let countdownInterval = null;
    let countdownRafId = null;

    // 🚀 MASTER LISTENER: Xử lý Giao diện Tức thời (Trị dứt điểm 4 lỗi)
    const handleConfigUpdate = (e) => {
        const config = e.detail || {};
        const container = document.getElementById('sc-chart-container');
        
        // 1. CHỮ CHÌM (WATERMARK)
        let wm = document.getElementById('wa-overlay-watermark');
        if (config.showWatermark !== false) {
            if (!wm && container) {
                wm = document.createElement('div');
                wm.id = 'wa-overlay-watermark';
                wm.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: "Inter", sans-serif; font-weight: 800; font-size: clamp(40px, 8vw, 120px); letter-spacing: 2px; pointer-events: none; z-index: 1; white-space: nowrap; transition: opacity 0.2s;';
                container.appendChild(wm);
            }
            if (wm) {
                const sym = window.currentChartToken ? window.currentChartToken.symbol : 'WAVE ALPHA';
                const tf = (window.currentChartInterval || '1D').toUpperCase();
                wm.innerText = `${sym} • ${tf}`;
                wm.style.color = `rgba(255,255,255, ${config.watermarkOpacity || 0.05})`;
            }
        } else if (wm) { wm.remove(); }

        // 2. ĐẾM NGƯỢC (COUNTDOWN)
        let cd = document.getElementById('wa-overlay-countdown');
        if (config.showCountdown !== false) {
            if (!cd && container) {
                cd = document.createElement('div');
                cd.id = 'wa-overlay-countdown';
                cd.style.cssText = 'position: absolute; right: 0; width: 64px; text-align: center; font-family: "Trebuchet MS", sans-serif; font-size: 11px; font-weight: 600; padding: 2px 0; color: #b7bdc6; pointer-events: none; z-index: 100;';
                container.appendChild(cd);
                if (countdownInterval) clearInterval(countdownInterval);
                countdownInterval = setInterval(updateCountdownText, 1000);
                syncPosition60FPS(); 
            }
        } else {
            if (cd) cd.remove();
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            if (countdownRafId) { cancelAnimationFrame(countdownRafId); countdownRafId = null; }
        }

        // 3. TẮT/MỞ OHLC LEGEND
        const uiLayer = document.getElementById('wa-custom-ui-layer');
        if (uiLayer && uiLayer.children.length > 0) {
            // Thẻ div đầu tiên trong uiLayer chính là dải OHLC
            uiLayer.children[0].style.display = config.showOHLC === false ? 'none' : 'flex';
        }

        // 4. TẮT/MỞ TÂM NGẮM (CROSSHAIR)
        if (window.WA_Chart) {
            window.WA_Chart.setStyles({
                crosshair: { show: config.crosshairMode !== 'hidden' }
            });
        }
    };

    // Lắng nghe cả chữ Hoa lẫn chữ Thường để không bao giờ bị trượt lệnh
    window.addEventListener('wa_chart_config_updated', handleConfigUpdate);
    window.addEventListener('WA_CHART_CONFIG_UPDATED', handleConfigUpdate);

    function updateCountdownText() {
        const cd = document.getElementById('wa-overlay-countdown');
        if (!cd) return;

        const interval = window.currentChartInterval || '1d';
        const now = new Date();
        let nextTime = new Date(now.getTime());

        // 🚀 FIX LỖI ĐỨNG HÌNH: Dùng thuật toán Floor + Chu kỳ để luôn tính nến Tương lai
        if (interval.includes('m')) {
            const m = parseInt(interval);
            nextTime.setMinutes(Math.floor(now.getMinutes() / m) * m + m);
            nextTime.setSeconds(0);
            nextTime.setMilliseconds(0);
        } else if (interval.includes('h')) {
            const h = parseInt(interval);
            nextTime.setHours(Math.floor(now.getHours() / h) * h + h);
            nextTime.setMinutes(0); 
            nextTime.setSeconds(0);
            nextTime.setMilliseconds(0);
        } else if (interval === '1d') {
            nextTime.setUTCDate(now.getUTCDate() + 1); 
            nextTime.setUTCHours(0, 0, 0, 0); 
        } else {
            cd.style.display = 'none'; return; 
        }

        let diff = nextTime.getTime() - now.getTime();
        if (diff < 0) diff = 0;

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        let timeStr = '';
        if (h > 0) timeStr += String(h).padStart(2, '0') + ':';
        timeStr += String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

        cd.innerText = timeStr;
        cd.style.display = 'block';

        // Đổi màu Đỏ khi sắp đóng nến (< 10s)
        cd.style.color = (diff <= 10000) ? '#F6465D' : '#b7bdc6';
    }

    // 🚀 PHÉP MÀU 60 FPS: Luôn neo Countdown ngay dưới nhãn giá cuối cùng
    function syncPosition60FPS() {
        const cd = document.getElementById('wa-overlay-countdown');
        if (cd && window.WA_Chart) {
            try {
                const dataList = window.WA_Chart.getDataList();
                if (dataList && dataList.length > 0) {
                    const lastPrice = dataList[dataList.length - 1].close;
                    const pixel = window.WA_Chart.convertToPixel({ value: lastPrice }, { paneId: 'candle_pane' });
                    const y = typeof pixel === 'number' ? pixel : (pixel ? pixel.y : null);
                    
                    if (y !== null && !isNaN(y)) {
                        // Y là tâm của đường Last Price Line.
                        // Ta đẩy hộp đếm ngược tụt xuống 12px để nó nằm ngoan ngoãn ngay dưới nhãn giá
                        cd.style.top = (y + 12) + 'px'; 
                    }
                }
            } catch(e) {}
        }
        // Gọi lại liên tục để bám dính siêu mượt khi cuộn/zoom biểu đồ
        countdownRafId = requestAnimationFrame(syncPosition60FPS);
    }
})();

(function initTimeframeSelector() {
    'use strict';

    // Danh sách các Timeframe phổ biến cho Crypto
    const TIMEFRAMES = [
        { id: 'tick', name: 'Tick' },
        { id: '1s', name: '1 Giây' },
        { id: '1m', name: '1 Phút' },
        { id: '5m', name: '5 Phút' },
        { id: '15m', name: '15 Phút' },
        { id: '30m', name: '30 Phút' },
        { id: '1h', name: '1 Giờ' },
        { id: '4h', name: '4 Giờ' },
        { id: '1d', name: '1 Ngày' },
        { id: '1w', name: '1 Tuần' }
    ];

    const checkToolbar = setInterval(() => {
        // Tìm Group chứa các nút Chart Type/Settings đã làm trước đó
        const targetGroup = document.getElementById('wa-chart-controls-group');
        
        if (targetGroup) {
            clearInterval(checkToolbar);

            // 1. Tạo Nút Master hiển thị Timeframe hiện tại
            const tfBtnWrap = document.createElement('div');
            tfBtnWrap.style.cssText = 'position: relative; display: inline-flex; align-items: center; margin-right: 8px;';
            tfBtnWrap.innerHTML = `
    <button id="btn-wa-timeframe-master" data-wa-tip="Khung Thời Gian" style="background: rgba(255,255,255,0.03); color: #00F0FF; border: 1px solid rgba(0,240,255,0.2); border-radius: 4px; padding: 4px 8px; height: 26px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-family: var(--font-num); font-weight: 800; font-size: 12px;">
        <span id="wa-current-tf-label">${(window.currentChartInterval || '1D').toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </button>
            `;
            
            // Chèn vào đầu Group để nó nằm bên trái nút Chart Type
            targetGroup.prepend(tfBtnWrap);

            // 2. Tạo Menu Dropdown
            const menu = document.createElement('div');
            menu.id = 'wa-timeframe-menu';
            menu.style.cssText = `
                display: none; position: fixed; background: #1e222d; border: 1px solid rgba(255,255,255,0.1); 
                border-radius: 8px; width: 140px; z-index: 999999; box-shadow: 0 16px 40px rgba(0,0,0,0.8);
                padding: 8px; flex-direction: column; gap: 2px;
            `;

            TIMEFRAMES.forEach(tf => {
                const item = document.createElement('div');
                item.className = 'wa-tf-item';
                item.style.cssText = `
                    display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; 
                    border-radius: 4px; cursor: pointer; color: #EAECEF; font-size: 12px; font-weight: 500;
                `;
                item.innerHTML = `
                    <span>${tf.name}</span>
                    <span style="color: #848e9c; font-size: 10px; font-weight: 800;">${tf.id.toUpperCase()}</span>
                `;

                item.onclick = (e) => {
                    e.stopPropagation();
                    // Gọi hàm chuyển timeframe hiện có của Wave Alpha
                    window.changeChartInterval(tf.id); 
                    menu.style.display = 'none';
                };

                // Hiệu ứng Hover
                item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
                item.onmouseleave = () => item.style.background = 'transparent';

                menu.appendChild(item);
            });

            document.body.appendChild(menu);

            // 3. Logic đóng mở Menu
            const masterBtn = document.getElementById('btn-wa-timeframe-master');
            masterBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = menu.style.display === 'none';
                if (isHidden) {
                    const rect = masterBtn.getBoundingClientRect();
                    menu.style.top = (rect.bottom + 6) + 'px';
                    menu.style.left = rect.left + 'px';
                    menu.style.display = 'flex';
                } else {
                    menu.style.display = 'none';
                }
            };

            document.addEventListener('click', () => menu.style.display = 'none');
        }
    }, 200);
})();

(function initFishFilterMenu() {
    'use strict';

    // Dữ liệu các mốc lọc cá (Đã kết nối ID để JS tự động đếm)
    const FISH_FILTERS = [
        { id: 'whale', name: '🐋 Cá Voi', statId: 'sc-stat-whale', defaultChecked: true },
        { id: 'shark', name: '🦈 Cá Mập', statId: 'sc-stat-shark', defaultChecked: true },
        { id: 'dolphin', name: '🐬 Cá Heo', statId: 'sc-stat-dolphin', defaultChecked: true },
        { id: 'bot', name: '🤖 Bot Sweep', statId: 'sc-stat-sweep', defaultChecked: true },
        { id: 'liq', name: '🩸 Thanh Lý', statId: null, defaultChecked: true }
    ];

    const checkToolbar = setInterval(() => {
        const targetGroup = document.getElementById('wa-chart-controls-group') || document.querySelector('.sc-toolbar');
        
        if (targetGroup) {
            clearInterval(checkToolbar);

            // 1. Dọn dẹp menu cũ nếu có
            const oldBtn = document.getElementById('sc-filter-btn');
            if (oldBtn) oldBtn.remove();
            const oldMenu = document.getElementById('sc-filter-menu');
            if (oldMenu) oldMenu.remove();

            // 2. Tạo nút Lọc Cá trên Toolbar (Dùng data-wa-tip)
            const btnWrap = document.createElement('div');
            btnWrap.style.cssText = 'position: relative; display: inline-flex; align-items: center; margin-left: 8px;';
            btnWrap.innerHTML = `
                <button id="sc-filter-btn" data-wa-tip="Lọc Dấu Chân Cá Mập" style="background: rgba(255,255,255,0.03); color: #848e9c; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px 10px; height: 26px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: 0.2s;">
                    <i class="fas fa-filter" style="font-size: 10px;"></i>
                    <span style="font-size: 11px; font-weight: 700; font-family: var(--font-main); letter-spacing: 0.5px;">LỌC</span>
                </button>
            `;
            targetGroup.appendChild(btnWrap);

            // 3. Tạo Menu Dropdown (Rộng 200px để chứa số đếm thẳng hàng)
            const menu = document.createElement('div');
            menu.id = 'sc-filter-menu';
            menu.style.cssText = `
                display: none; position: fixed; background: #1e222d; border: 1px solid rgba(255,255,255,0.1); 
                border-radius: 8px; width: 200px; z-index: 999999; box-shadow: 0 16px 40px rgba(0,0,0,0.8);
                padding: 8px; flex-direction: column; gap: 2px; user-select: none;
            `;

            FISH_FILTERS.forEach(fish => {
                const item = document.createElement('label');
                item.className = 'minimal-filter-item';
                item.style.cssText = `
                    display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; 
                    border-radius: 4px; cursor: pointer; color: #EAECEF; font-size: 12px; font-weight: 600;
                    margin: 0; transition: background 0.2s;
                `;
                
                // Lấy số đếm cá hiện tại
                let currentCount = 0;
                if (fish.statId === 'sc-stat-whale') currentCount = window.scCWhale || 0;
                if (fish.statId === 'sc-stat-shark') currentCount = window.scCShark || 0;
                if (fish.statId === 'sc-stat-dolphin') currentCount = window.scCDolphin || 0;
                if (fish.statId === 'sc-stat-sweep') currentCount = window.scCSweep || 0;

                // Thẻ Badge hiển thị số lượng (Màu xanh dương)
                const badgeHtml = fish.statId ? 
                    `<span id="${fish.statId}" style="background: rgba(0, 240, 255, 0.1); color: #00F0FF; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: var(--font-num); font-weight: 800; min-width: 24px; text-align: center; border: 1px solid rgba(0, 240, 255, 0.2); display: inline-block;">${currentCount}</span>` : 
                    '';

                // Tên cá bị ép width 85px để các số Badge thẳng hàng 100%
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 85px; display: inline-block;">${fish.name}</span>
                        ${badgeHtml}
                    </div>
                    <input type="checkbox" class="marker-filter-cb" value="${fish.id}" ${fish.defaultChecked ? 'checked' : ''} style="display: none;">
                    <div class="custom-checkbox" style="width: 16px; height: 16px; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0;"></div>
                `;

                // Hiệu ứng Hover
                item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.05)';
                item.onmouseleave = () => item.style.background = 'transparent';

                // Xử lý Custom Checkbox UI (Trắng xám)
                const checkbox = item.querySelector('input');
                const checkBoxUI = item.querySelector('.custom-checkbox');
                
                const updateUI = () => {
                    if (checkbox.checked) {
                        checkBoxUI.style.background = 'rgba(255, 255, 255, 0.1)';
                        checkBoxUI.style.borderColor = '#EAECEF';
                        checkBoxUI.innerHTML = '<i class="fas fa-check" style="color: #EAECEF; font-size: 9px;"></i>';
                    } else {
                        checkBoxUI.style.background = 'transparent';
                        checkBoxUI.style.borderColor = 'rgba(255,255,255,0.2)';
                        checkBoxUI.innerHTML = '';
                    }
                };
                updateUI();

                checkbox.addEventListener('change', (e) => {
                    updateUI();
                    if (typeof window.applyFishFilter === 'function') {
                        window.applyFishFilter();
                    }
                });

                menu.appendChild(item);
            });

            document.body.appendChild(menu);

            // 4. Logic Đóng/Mở mượt mà
            const filterBtn = document.getElementById('sc-filter-btn');
            filterBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = menu.style.display === 'none' || menu.style.display === '';
                if (isHidden) {
                    const rect = filterBtn.getBoundingClientRect();
                    menu.style.top = (rect.bottom + 6) + 'px';
                    // Cập nhật lề trái theo chiều rộng 200px mới
                    menu.style.left = (rect.right - 200) + 'px'; 
                    menu.style.display = 'flex';
                    filterBtn.style.background = 'rgba(255,255,255,0.08)';
                    filterBtn.style.color = '#EAECEF';
                } else {
                    menu.style.display = 'none';
                    filterBtn.style.background = 'rgba(255,255,255,0.03)';
                    filterBtn.style.color = '#848e9c';
                }
            };

            menu.onclick = (e) => e.stopPropagation(); 
        }
    }, 200);
    
    // Đóng menu khi click ra ngoài màn hình
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('sc-filter-menu');
        const btn = document.getElementById('sc-filter-btn');
        if (menu && menu.style.display === 'flex' && !menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
            menu.style.display = 'none';
            if (btn) {
                btn.style.background = 'rgba(255,255,255,0.03)';
                btn.style.color = '#848e9c';
            }
        }
    });
})();

