
// ==========================================
// 🚀 FILE: chart-ui.js - GIAO DIỆN & TRADINGVIEW
// ==========================================


window.tvChart = null;
window.tvLineSeries = null; 
// ═══ CACHE DOM — tránh querySelector mỗi giây ═══
const _UI = {
    nfEl: null, nfBox: null, speedEl: null, algoStatus: null, algoBox: null,
    ofiBarBuy: null, ofiBarSell: null, avgEl: null, trendEl: null,
    spVal: null, spMeter: null, dropEl: null, barBuy: null, barSell: null,
    volBuy: null, volSell: null, ratioTxt: null, verdictEl: null
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
    if (window.tvChart) {
        const isTrad = window.currentTheme === 'trad';
        const t_up = isTrad ? '#0ECB81' : '#2af592';
        const t_down = isTrad ? '#F6465D' : '#cb55e3';
        const t_text = isTrad ? '#848e9c' : '#527c82';
        const t_line = isTrad ? '#00F0FF' : '#41e6e7';

        window.tvChart.setStyles({
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

window.toggleMarkerFilterMenu = function(e) {
    if(e) e.stopPropagation();
    let menu = document.getElementById('sc-filter-menu');
    let btn = document.getElementById('sc-filter-btn');
    if(menu) {
        menu.classList.toggle('show');
        if (btn) btn.classList.toggle('active', menu.classList.contains('show'));
    }
};

// Tự động đóng menu khi click ra ngoài
document.addEventListener('click', function(e) {
    let menu = document.getElementById('sc-filter-menu');
    let btn = document.getElementById('sc-filter-btn');
    if (menu && menu.classList.contains('show') && !menu.contains(e.target) && e.target !== btn) {
        menu.classList.remove('show');
        if (btn) btn.classList.remove('active');
    }
});

window.applyFishFilter = function() {
    if (!window.tvChart) return;

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
                try { window.tvChart.removeOverlay(oldId); } catch(e) {}
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

        let chartData = window.tvChart.getDataList();
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
                        window.tvChart.createOverlay({
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
                try { window.tvChart.removeOverlay(oldId); } catch(e) {}
            }
        }
        window.activeWaveMarkers = newActiveMarkers;

    } catch (error) {
        console.error("🔴 Đã chặn được lỗi Crash tại applyFishFilter:", error);
    }
};

// Hàm hỗ trợ Xóa hình vẽ của User cho Bước 4 (không xóa Marker cá voi)
window.clearUserDrawings = function() {
    if (!window.tvChart) return;
    window.tvChart.removeOverlay(); // Xóa sạch tất cả
    window.applyFishFilter();       // Vẽ lại Marker cá voi
};

window.toggleProSidePanel = function(tabId, btnElement) {
    if (!document.getElementById('wa-panel-transition')) {
        const s = document.createElement('style');
        s.id = 'wa-panel-transition';
        s.textContent = `
            @media (min-width: 992px) {
                #sc-panel-content {
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease !important;
                    overflow: hidden;
                }
                #sc-panel-content.collapsed {
                    width: 0 !important; min-width: 0 !important; opacity: 0; pointer-events: none;
                }
            }
            @media (max-width: 991px) {
                #sc-panel-content {
                    transition: height 0.4s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.3s ease !important;
                    width: 100% !important; overflow: hidden; display: flex; flex-direction: column;
                }
                #sc-panel-content.collapsed {
                    flex: 0 0 0 !important; height: 0 !important; min-height: 0 !important;
                    opacity: 0; pointer-events: none;
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
            }
            .sc-sidebar-icons {
                position: relative; z-index: 10; flex-shrink: 0;
                background: var(--term-bg, #0b1217);
                display: flex; flex-direction: column;
            }
            #sc-panel-content { z-index: 5; position: relative; }
            .sc-tab-content {
                overflow-y: auto; -webkit-overflow-scrolling: touch;
                flex: 1 1 auto; min-height: 0;
            }
            .sc-chart-wrapper, #super-chart-overlay { overflow-x: hidden; }
            #sc-panel-toggle-btn {
                background: transparent; border: none;
                border-top: 1px solid rgba(255,255,255,0.06);
                color: #527c82; font-size: 13px; padding: 10px 0;
                cursor: pointer; width: 100%; text-align: center;
                transition: color 0.2s, background 0.2s;
                margin-top: auto; display: block;
            }
            #sc-panel-toggle-btn:hover { color: #00F0FF; background: rgba(0,240,255,0.05); }
        `;
        document.head.appendChild(s);
    }

    // ✅ Inject nút — TÁCH RIÊNG, không phụ thuộc vào điều kiện style
    if (!document.getElementById('sc-panel-toggle-btn')) {
        const sidebarIcons = document.querySelector('.sc-sidebar-icons');
        if (sidebarIcons) {
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'sc-panel-toggle-btn';
            toggleBtn.title = 'Ẩn panel';
            toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            toggleBtn.onclick = function() { window.togglePanelCollapse(); };
            sidebarIcons.appendChild(toggleBtn);
        }
    }

    const panelContent = document.getElementById('sc-panel-content');
    const allBtns = document.querySelectorAll('.sc-sidebar-icon');
    const allTabs = document.querySelectorAll('.sc-tab-content');
    const isMobile = window.innerWidth <= 991;

    const oldBackdrop = document.getElementById('sc-panel-backdrop');
    if (oldBackdrop) oldBackdrop.remove();

    const doResize = function() {
        if (!window.tvChart) return;
        const start = Date.now();
        const animate = function() {
            if (window.tvChart) window.tvChart.resize();
            if (Date.now() - start < 450) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    };

    const handleMobileUI = (isNowCollapsed) => {
        if (!isMobile) return;
        const chartArea = document.querySelector('.sc-chart-area');
        if (chartArea) chartArea.dataset.mobileExpanded = isNowCollapsed ? 'true' : 'false';
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

window.togglePanelCollapse = function() {
    const panelContent = document.getElementById('sc-panel-content');
    if (!panelContent) return;
    const isCollapsed = panelContent.classList.toggle('collapsed');
    const isMobile = window.innerWidth <= 991;
    const chartArea = document.querySelector('.sc-chart-area');
    if (isMobile && chartArea) {
        chartArea.dataset.mobileExpanded = isCollapsed ? 'true' : 'false';
    }
    const toggleBtn = document.getElementById('sc-panel-toggle-btn');
    if (toggleBtn) {
        toggleBtn.innerHTML = isCollapsed
            ? '<i class="fas fa-chevron-right"></i>'
            : '<i class="fas fa-chevron-left"></i>';
        toggleBtn.title = isCollapsed ? 'Mở panel' : 'Ẩn panel';
    }
    if (window.tvChart) {
        const start = Date.now();
        const animate = () => {
            if (window.tvChart) window.tvChart.resize();
            if (Date.now() - start < 450) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
};

// ✅ Hàm toggle ẩn/hiện panel — 1 tap dứt khoát
window.togglePanelCollapse = function() {
    const panelContent = document.getElementById('sc-panel-content');
    if (!panelContent) return;
    const isCollapsed = panelContent.classList.toggle('collapsed');
    const isMobile = window.innerWidth <= 991;
    const chartArea = document.querySelector('.sc-chart-area');
    if (isMobile && chartArea) {
        chartArea.dataset.mobileExpanded = isCollapsed ? 'true' : 'false';
    }
    const toggleBtn = document.getElementById('sc-panel-toggle-btn');
    if (toggleBtn) {
        toggleBtn.innerHTML = isCollapsed
            ? '<i class="fas fa-chevron-right"></i>'
            : '<i class="fas fa-chevron-left"></i>';
        toggleBtn.title = isCollapsed ? 'Mở panel' : 'Ẩn panel';
    }
    if (window.tvChart) {
        const start = Date.now();
        const animate = () => {
            if (window.tvChart) window.tvChart.resize();
            if (Date.now() - start < 450) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }
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
    if (window.tvChart) {
        const start = Date.now();
        const animate = () => {
            if (window.tvChart) window.tvChart.resize();
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

    // ✅ FIX 3: Hủy API fetch cũ nếu còn đang chạy — tránh race condition (chồng chéo dữ liệu)
    if (window._fetchAbortCtrl) {
        window._fetchAbortCtrl.abort();
    }
    window._fetchAbortCtrl = new AbortController();
    const _abortSignal = window._fetchAbortCtrl.signal;

    // THÊM ĐOẠN NÀY ĐỂ BÁO LƯU TRƯỚC KHI ĐỔI ĐỒNG COIN MỚI:
    if (!isTimeSwitch && window.currentChartToken && window.currentChartToken.symbol !== t.symbol) {
        if (window.__wa_onSymbolChange) window.__wa_onSymbolChange(t.symbol);
    }

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

    // ═══════════════════════════════════════════════════════════
    // ĐỔI TIMEFRAME: Thoát SỚM trước khi dispose/init
    // Overlay sống trong chart instance — không được phép dispose
    // ═══════════════════════════════════════════════════════════
    // Trong đoạn isTimeSwitch của openProChart
if (isTimeSwitch && window.tvChart) {
    let isTick = window.currentChartInterval === 'tick';
    window.tvChart.setStyles({ candle: { type: isTick ? 'area' : 'candle_solid' } });

    // ✅ THÊM: Reset waterfall ngay lập tức để không render nến zombie
    window._waTargetCandle = null;
    window._waCurrentCandle = null;
    window._waRafRunning = false; // ← Dừng RAF cũ

    window.fetchBinanceHistory(t, window.currentChartInterval, isTick).then(histData => {
        if (histData && histData.length > 0) {
            window.tvChart.applyNewData(histData);
        }
        if (typeof window.connectRealtimeChart === 'function') window.connectRealtimeChart(t, true);
    });
    return;
}

    // [WA-DRAWING] Lưu drawings của timeframe CŨ trước khi destroy chart
    if (window.__wa_onBeforeChartInit) {
        window.__wa_onBeforeChartInit(
            (window.currentChartToken && window.currentChartToken.symbol) || '',
            window.oldChartInterval || window.currentChartInterval || '1d'
        );
    }
    
    if (window.tvChart) { try { klinecharts.dispose(container); } catch(e) {} window.tvChart = null; }
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

        // 1. KHỞI TẠO CHART 100% NATIVE KLINECHARTS
        container.style.position = 'relative'; 
        window.tvChart = klinecharts.init(container, {
            styles: {
                grid: { horizontal: { color: 'rgba(255,255,255,0.05)', style: 'dashed' }, vertical: { color: 'rgba(255,255,255,0.05)', style: 'dashed' } },
                
                // 🚀 TÍCH HỢP OHLC VÀO TOOLTIP CỦA NẾN
                candle: {
                    type: window.currentChartInterval === 'tick' ? 'area' : 'candle_solid',
                    bar: { upColor: t_up, downColor: t_down, noChangeColor: t_text, upBorderColor: t_up, downBorderColor: t_down, upWickColor: t_up, downWickColor: t_down },
                    area: { lineSize: 2, lineColor: t_line, backgroundColor: [{ offset: 0, color: isTrad ? 'rgba(0, 240, 255, 0.2)' : 'rgba(65, 230, 231, 0.2)' }, { offset: 1, color: 'rgba(0,0,0,0)' }] },
                    tooltip: { 
                        showRule: 'always',
                        showType: 'standard',
                        custom: function(calcData) {
                            if (calcData.current) window.lastOHLC = calcData.current;
                            const kLineData = window.lastOHLC || calcData.default;
                            if (!kLineData) return [];

                            const sym = (t.symbol || 'UNKNOWN').toUpperCase() + 'USDT';
                            const tf = window.currentChartInterval.toUpperCase();
                            const volStr = kLineData.volume >= 1e9 ? (kLineData.volume/1e9).toFixed(2)+'B' : (kLineData.volume >= 1e6 ? (kLineData.volume/1e6).toFixed(2)+'M' : (kLineData.volume >= 1e3 ? (kLineData.volume/1e3).toFixed(2)+'K' : (kLineData.volume || 0).toFixed(0)));
                            const isUp = kLineData.close >= kLineData.open;

                            // 🎯 CẤU TRÚC OBJECT MỚI GIÚP CANVAS NHẬN MÀU
                            return [
                                { title: { text: `${sym} ${tf}  |`, color: '#EAECEF' }, value: '' },
                                { title: { text: ' O ', color: '#848e9c' }, value: { text: kLineData.open.toFixed(prec), color: '#848e9c' } },
                                { title: { text: ' H ', color: '#848e9c' }, value: { text: kLineData.high.toFixed(prec), color: '#0ECB81' } },
                                { title: { text: ' L ', color: '#848e9c' }, value: { text: kLineData.low.toFixed(prec), color: '#F6465D' } },
                                { title: { text: ' C ', color: '#848e9c' }, value: { text: kLineData.close.toFixed(prec), color: isUp ? '#0ECB81' : '#F6465D' } },
                                { title: { text: ' V ', color: '#848e9c' }, value: { text: volStr, color: '#848e9c' } }
                            ];
                        },
                        text: { 
                            size: 12, 
                            // 🚀 BÍ QUYẾT TRỊ BỆNH CO CHỮ: Ghi thẳng tên Font, tuyệt đối không dùng var()
                            family: 'Arial, "Segoe UI", sans-serif', 
                            weight: 600, 
                            color: '#848e9c', 
                            marginLeft: 10, marginTop: 8, marginRight: 0, marginBottom: 0 
                        }
                    }
                },
                
                // 🚀 CẤU HÌNH INDICATOR GLOBAL
                indicator: {
                    tooltip: {
                        showRule: 'always',    
                        showType: 'standard',  
                        icons: [
                            { id: 'visible', position: 'middle', marginLeft: 10, marginTop: 7, marginRight: 0, marginBottom: 0, paddingLeft: 2, paddingTop: 2, paddingRight: 2, paddingBottom: 2, icon: '◉', fontFamily: 'sans-serif', size: 14, color: '#848e9c', activeColor: '#00F0FF', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(0,240,255,0.1)' },
                            { id: 'invisible', position: 'middle', marginLeft: 10, marginTop: 7, marginRight: 0, marginBottom: 0, paddingLeft: 2, paddingTop: 2, paddingRight: 2, paddingBottom: 2, icon: '◎', fontFamily: 'sans-serif', size: 14, color: '#848e9c', activeColor: '#00F0FF', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(0,240,255,0.1)' },
                            { id: 'setting', position: 'middle', marginLeft: 6, marginTop: 7, marginRight: 0, marginBottom: 0, paddingLeft: 2, paddingTop: 2, paddingRight: 2, paddingBottom: 2, icon: '⚙', fontFamily: 'sans-serif', size: 14, color: '#848e9c', activeColor: '#F0B90B', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(240,185,11,0.1)' },
                            { id: 'close', position: 'middle', marginLeft: 6, marginTop: 7, marginRight: 0, marginBottom: 0, paddingLeft: 2, paddingTop: 2, paddingRight: 2, paddingBottom: 2, icon: '✕', fontFamily: 'sans-serif', size: 14, color: '#848e9c', activeColor: '#F6465D', backgroundColor: 'transparent', activeBackgroundColor: 'rgba(246,70,93,0.1)' }
                        ]
                    },
                    // 🚀 THIẾT KẾ NHÃN REALTIME MINIMALIST (TẮT MẶC ĐỊNH CHO MỌI CHỈ BÁO)
                    lastValueMark: {
                        show: false, // <-- Tắt mặc định để chart không bị rác rưởi
                        text: {
                            show: true,
                            color: '#ffffff',     // Chữ trắng tinh tế
                            size: 11,             // Nhỏ gọn
                            family: 'Arial, sans-serif',
                            weight: 'bold',
                            paddingLeft: 6,       // Căn lề trái phải rộng ra 1 xíu cho sang
                            paddingRight: 6,
                            paddingTop: 3,
                            paddingBottom: 3,
                            borderRadius: 3       // Bo góc nhẹ 3px
                            // Không set backgroundColor -> KLineCharts sẽ tự động mượn màu của dây Line làm màu nền.
                        }
                    }
                },
                yAxis: { axisLine: { show: false }, tickText: { color: t_text } },
            }
        });

        // ĐĂNG KÝ CLICK ICON (Xử lý mượt cả VOL mặc định)
        window.tvChart.subscribeAction('onTooltipIconClick', function(data) {
            if (!data.indicatorName) return;
            const indName = data.indicatorName;
            const paneId = data.paneId;

            if (data.iconId === 'visible') {
                window.tvChart.overrideIndicator({ name: indName, visible: true }, paneId);
                let ind = window.scActiveIndicators?.find(x => x.name === indName);
                if (ind) ind.visible = true;
            } 
            else if (data.iconId === 'invisible') {
                window.tvChart.overrideIndicator({ name: indName, visible: false }, paneId);
                let ind = window.scActiveIndicators?.find(x => x.name === indName);
                if (ind) ind.visible = false;
            } 
            else if (data.iconId === 'setting') {
                if (typeof window.openIndicatorSettings === 'function') {
                    let calcParams;
                    // Bước 1: Thử lấy trực tiếp từ canvas
                    try {
                        const instances = window.tvChart.getIndicators({ name: indName, paneId: paneId });
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
                // Fallback nếu người dùng bấm X xóa chỉ báo VOL mặc định
                try { window.tvChart.removeIndicator(paneId, indName); } catch(e){}
            }
        });

        // 2. CHỈ TẠO LỚP KÍNH HTML CHỨA ĐÚNG LOGO WATERMARK (ĐÃ XÓA SẠCH HTML LEGEND RÁC)
        const customUI = document.createElement('div');
        customUI.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
        customUI.innerHTML = `<div style="position: absolute; bottom: 25px; left: 15px; font-family: var(--font-main); font-weight: 800; font-size: 20px; color: rgba(255,255,255,0.06); letter-spacing: 2px;">WAVE ALPHA</div>`;
        container.appendChild(customUI);

        window.tvChart.setPriceVolumePrecision(prec, 2);
        window.tvChart.createIndicator('VOL', false, { height: 80 });

        // --- BẮT ĐẦU PATCH: TỐI ƯU RESIZE OBSERVER & CLEAR CACHE ---
        const chartArea = document.querySelector('.sc-chart-area');
        if (chartArea) delete chartArea.dataset.mobileExpanded;
        
        const oldBackdrop = document.getElementById('sc-panel-backdrop');
        if (oldBackdrop) oldBackdrop.classList.remove('visible');

        if (window._chartResizeObserver) window._chartResizeObserver.disconnect();
        
        let _resizeRafId = null;
        const isMobile = () => window.innerWidth <= 991;
        
        window._chartResizeObserver = new ResizeObserver(function() {
            if (!window.tvChart) return;
            if (_resizeRafId) cancelAnimationFrame(_resizeRafId);
            
            // Giới hạn call stack vẽ lại chart ở tốc độ 60fps của thiết bị
            _resizeRafId = requestAnimationFrame(function() {
                if (window.tvChart) window.tvChart.resize();
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

            window.tvChart.setStyles({
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
        window.tvChart.subscribeAction('onCrosshairChange', function(param) {
            if (!param || param.dataIndex === undefined || param.dataIndex < 0) return;
            const dataList = window.tvChart.getDataList();
            const ohlc = dataList[param.dataIndex];
            if (!ohlc) return;

            const fmt = (v) => v >= 1 ? v.toFixed(2) : v.toFixed(6);
            const fmtVol = (v) => v >= 1e9 ? (v/1e9).toFixed(2)+'B' : v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(2)+'K' : v.toFixed(0);
            const setEl = (id, val, color) => { const el = document.getElementById(id); if (el) { el.textContent = val; if (color) el.style.color = color; } };

            const barColor = ohlc.close >= ohlc.open ? '#0ECB81' : '#F6465D';
            setEl('tp-o', fmt(ohlc.open), '#848e9c'); setEl('tp-h', fmt(ohlc.high), '#0ECB81');
            setEl('tp-l', fmt(ohlc.low), '#F6465D'); setEl('tp-c', fmt(ohlc.close), barColor);
            setEl('tp-v', fmtVol(ohlc.volume || 0), '#848e9c');

            // Báo cho file indicator biết index hiện tại
            if (window.WaveIndicatorAPI && typeof window.WaveIndicatorAPI.updateLegendValues === 'function') {
                window.WaveIndicatorAPI.updateLegendValues(param.dataIndex);
            }
        });

        
// KHI ĐỔI COIN: Vẫn rebuild bình thường như cũ
if (typeof window.fetchBinanceHistory === 'function') {
    window.fetchBinanceHistory(t, window.currentChartInterval, window.currentChartInterval === 'tick').then(histData => {
        // ✅ FIX 3: Nếu lệnh fetch đã bị hủy do user bấm qua tab khác, bỏ qua không đổ nến nữa
        if (_abortSignal.aborted) return; 
        
        if (histData && histData.length > 0) {
            // 🛑 VÁ LỖI KHỰNG: Giết chết "cây nến bóng ma" của Token cũ
            window._waTargetCandle = null;
            window._waCurrentCandle = null;
            
            window.tvChart.applyNewData(histData);
        }

if (window.WaveIndicatorAPI) {
    if(typeof window.WaveIndicatorAPI.initUI === 'function') window.WaveIndicatorAPI.initUI();
    if(typeof window.WaveIndicatorAPI.restore === 'function') window.WaveIndicatorAPI.restore();
}

if (typeof window.__wa_onChartReady === 'function') {
    window.__wa_onChartReady();
}

if (typeof window.connectRealtimeChart === 'function') window.connectRealtimeChart(t, isTimeSwitch);
});
}
    }, 100); 
};

// chart-ui.js — hàm changeChartInterval
window.changeChartInterval = function(interval, btnEl) {
    if (window.currentChartInterval === interval) return;
    if (window.__wa_onIntervalChange) window.__wa_onIntervalChange(interval);

    document.querySelectorAll('.sc-time-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    window.oldChartInterval = window.currentChartInterval;
    window.currentChartInterval = interval;

    let tfEl = document.getElementById('chart-legend-tf');
    if (tfEl) tfEl.innerText = interval.toUpperCase();

    // ❌ XÓA ĐOẠN NÀY (nó giết WS một cách vô ích)
    // if (window.chartWs) {
    //     window.chartWs.close();
    //     window.chartWs = null;
    // }

    if (window.currentChartToken) {
        window.openProChart(window.currentChartToken, true);
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
    if (window.tvChart) { 
        try { klinecharts.dispose(document.getElementById('sc-chart-container')); } catch(e) {}
        window.tvChart = null; 
    }
    window.currentChartToken = null; 
};

// Tự động thêm nút ẩn/hiện panel khi trang load xong
document.addEventListener('DOMContentLoaded', function() {
    const sidebarIcons = document.querySelector('.sc-sidebar-icons');
    if (sidebarIcons && !document.getElementById('sc-panel-toggle-btn')) {
        const btn = document.createElement('button');
        btn.id = 'sc-panel-toggle-btn';
        btn.title = 'Ẩn panel';
        btn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        btn.style.cssText = 'background:transparent;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#527c82;font-size:13px;padding:10px 0;cursor:pointer;width:100%;text-align:center;margin-top:auto;display:block;';
        btn.onmouseover = function(){ this.style.color='#00F0FF'; };
        btn.onmouseout  = function(){ this.style.color='#527c82'; };
        btn.onclick = function(){ window.togglePanelCollapse(); };
        sidebarIcons.appendChild(btn);
    }
});