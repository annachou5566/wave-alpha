
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
        if (!window.tvChart) return;
        const start = Date.now();
        const animate = function() {
            if (window.tvChart) window.tvChart.resize();
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

    // Trong đoạn isTimeSwitch của openProChart
if (isTimeSwitch && window.tvChart) {
    let isTick = window.currentChartInterval === 'tick';
    
    // 🚀 FIX LỖI TIME-SWITCH: Tôn trọng WaveChartEngine, không tự ép nến đặc nữa!
    if (window.WaveChartEngine) {
        if (isTick) window.WaveChartEngine.update({ chartType: 9 }, true);
        else window.WaveChartEngine.applyNow(); // Vẽ lại nến Rỗng/Line/Bar y như cũ
    } else {
        window.tvChart.setStyles({ candle: { type: isTick ? 'area' : 'candle_solid' } });
    }

    // ✅ THÊM: Reset waterfall ngay lập tức để không render nến zombie
    window._waTargetCandle = null;
    window._waCurrentCandle = null;
    window._waRafRunning = false; // ← Dừng RAF cũ

    window.fetchBinanceHistory(t, window.currentChartInterval, isTick).then(histData => {
        if (histData && histData.length > 0) {
            // 🚀 HOOK 1: Nấu data lịch sử trước khi nạp vào Chart
            let finalData = window.WaveDataEngine ? window.WaveDataEngine.processHistory(histData) : histData;
            window.tvChart.applyNewData(finalData);
        }
        if (typeof window.__wa_onChartReady === 'function') window.__wa_onChartReady();
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

// 🚀 KÍCH HOẠT WAVE CHART ENGINE NGAY SAU KHI KLINECHART VỪA INIT XONG
if (window.WaveChartEngine && window.tvChart) {
    window.WaveChartEngine.init(window.tvChart);
}

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
            
            // 🚀 HOOK 2: Nấu data lịch sử trước khi nạp vào Chart
            let finalData = window.WaveDataEngine ? window.WaveDataEngine.processHistory(histData) : histData;
            window.tvChart.applyNewData(finalData);
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

// =========================================================================
// 🧩 BƯỚC 2: CHART TYPE SELECTOR (21 LOẠI BIỂU ĐỒ - LAYOUT LƯỚI 2x2 TỐI ƯU)
// =========================================================================
(function initChartTypeSelector() {
    'use strict';

    // Hàm bọc SVG để đồng bộ style
    const _svg = (paths) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

    // 1. Data 21 loại biểu đồ với Custom SVG Icons (ĐÃ MỞ KHÓA CỘT, ĐỈNH-ĐÁY, HEIKIN ASHI)
    const CHART_TYPES = [
        // Nhóm 1: Cơ bản
        { grp: 'CƠ BẢN', id: 1, name: 'Nến Nhật', icon: _svg('<path d="M9 4v16M15 4v16M7 8h4v8H7zM13 10h4v6h-4z"/>'), phase: 1, desc: 'Nến Open-High-Low-Close chuẩn' },
        { grp: 'CƠ BẢN', id: 2, name: 'Nến Rỗng', icon: _svg('<path d="M9 4v16M15 4v16"/><rect x="7" y="8" width="4" height="8"/><rect x="13" y="10" width="4" height="6"/>'), phase: 1, desc: 'Nến tăng rỗng ruột giúp giảm mỏi mắt' },
        { grp: 'CƠ BẢN', id: 3, name: 'Thanh (Bars)', icon: _svg('<path d="M9 4v16M6 8h3M9 16h3M15 4v16M12 10h3M15 18h3"/>'), phase: 1, desc: 'Thanh OHLC chuẩn thị trường Mỹ' },
        { grp: 'CƠ BẢN', id: 4, name: 'Cột (Columns)', icon: _svg('<path d="M18 20V10M12 20V4M6 20v-4"/>'), phase: 1, desc: 'Cột hiển thị theo giá Close' }, // 🚀 Đổi thành phase 1
        { grp: 'CƠ BẢN', id: 5, name: 'Đỉnh - Đáy', icon: _svg('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'), phase: 1, desc: 'Bỏ qua Open/Close, chỉ xem biên độ' }, // 🚀 Đổi thành phase 1
        
        // Nhóm 2: Đường & Vùng
        { grp: 'ĐƯỜNG & VÙNG', id: 6, name: 'Đường (Line)', icon: _svg('<polyline points="3 17 9 11 15 15 21 5"/>'), phase: 1, desc: 'Đường nối các giá đóng cửa' },
        { grp: 'ĐƯỜNG & VÙNG', id: 7, name: 'Đường + Điểm', icon: _svg('<polyline points="3 17 9 11 15 15 21 5"/><circle cx="9" cy="11" r="2"/><circle cx="15" cy="15" r="2"/><circle cx="21" cy="5" r="2"/>'), phase: 2, desc: 'Đường Line có đánh dấu đỉnh/đáy' },
        { grp: 'ĐƯỜNG & VÙNG', id: 8, name: 'Bậc Thang', icon: _svg('<polyline points="3 17 9 17 9 11 15 11 15 5 21 5"/>'), phase: 2, desc: 'Step Line giúp nhìn rõ nền giá' },
        { grp: 'ĐƯỜNG & VÙNG', id: 9, name: 'Vùng (Area)', icon: _svg('<path d="M3 20h18V5l-6 10-6-4-6 9z" fill="currentColor" fill-opacity="0.2"/>'), phase: 1, desc: 'Đổ bóng Gradient dưới đường Line' },
        { grp: 'ĐƯỜNG & VÙNG', id: 10, name: 'Vùng HLC', icon: _svg('<path d="M3 17l6-6 6 4 6-10v14H3z" fill="currentColor" fill-opacity="0.15"/><path d="M3 21l6-6 6 4 6-10" opacity="0.4"/>'), phase: 2, desc: 'Vùng dao động thực tế High-Low-Close' },
        { grp: 'ĐƯỜNG & VÙNG', id: 11, name: 'Đường Cơ Sở', icon: _svg('<line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2"/><polyline points="3 12 7 8 13 15 21 6"/>'), phase: 2, desc: 'Baseline: Trên xanh, dưới đỏ' },
        
        // Nhóm 3: Khử Nhiễu
        { grp: 'KHỬ NHIỄU (PRO)', id: 12, name: 'Heikin Ashi', icon: _svg('<path d="M9 4v16M15 4v16M7 10h4v6H7zM13 8h4v8h-4z"/>'), phase: 1, desc: 'Nến trung bình lọc nhiễu sóng' }, // 🚀 Đổi thành phase 1
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

    // 2. CSS cho Menu
    const style = document.createElement('style');
    style.textContent = `
        #wa-chart-type-menu {
            display: none; position: fixed; background: #1e222d; border: 1px solid rgba(255,255,255,0.1); 
            /* 🚀 FIX: Tăng chiều rộng lên 440px để 2 cột không bị chật chội */
            border-radius: 8px; width: 440px; max-height: 85vh; overflow-y: auto; z-index: 999999; box-shadow: 0 16px 40px rgba(0,0,0,0.8);
            padding: 16px; grid-template-columns: 1fr 1fr; gap: 16px 24px; align-items: start; user-select: none;
        }
        #wa-chart-type-menu::-webkit-scrollbar { width: 4px; }
        #wa-chart-type-menu::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        #wa-chart-type-menu::-webkit-scrollbar-track { background: transparent; }

        .wa-ct-grp { display: flex; flex-direction: column; gap: 4px; }
        .wa-ct-title { font-size: 10px; font-weight: 800; color: #848e9c; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; text-transform: uppercase; }
        .wa-ct-item {
            display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; cursor: pointer;
            transition: all 0.2s ease; background: transparent; border: 1px solid transparent; color: #EAECEF;
        }
        .wa-ct-item:hover { background: rgba(255,255,255,0.05); color: #FFF; }
        .wa-ct-item.active { background: rgba(0,240,255,0.08); border-color: rgba(0,240,255,0.2); color: #00F0FF; }
        .wa-ct-icon { display: flex; align-items: center; justify-content: center; opacity: 0.7; transition: opacity 0.2s; }
        .wa-ct-item:hover .wa-ct-icon, .wa-ct-item.active .wa-ct-icon { opacity: 1; }
        .wa-ct-text { font-size: 12px; font-weight: 500; flex: 1; }
        .wa-ct-item.active .wa-ct-text { font-weight: 700; }
        .wa-ct-pro { font-size: 8px; background: rgba(240,185,11,0.15); color: #F0B90B; padding: 2px 5px; border-radius: 4px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid rgba(240,185,11,0.3); margin-left: auto; }
        #btn-wa-chart-type {
            background: rgba(255,255,255,0.03); color: #848e9c; border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 4px; padding: 4px 10px; height: 26px; display: inline-flex; align-items: center; 
            gap: 6px; transition: 0.2s; cursor: pointer;
        }
        #btn-wa-chart-type:hover { background: rgba(255,255,255,0.08); color: #EAECEF; }
    `;
    document.head.appendChild(style);

    
})();

// =========================================================================
// ⚙️ BƯỚC 3: CHART SETTINGS MODAL (FIX LỖI CẤM CLICK RÂU/VIỀN NẾN)
// =========================================================================
(function initChartSettingsModal() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        #wa-chart-settings-modal { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999999; pointer-events: none; opacity: 0; transition: opacity 0.15s ease; }
        #wa-chart-settings-modal.show { display: block; opacity: 1; }
        .wa-csm-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1e222d; width: 680px; height: 500px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; overflow: hidden; font-family: 'Inter', system-ui, sans-serif; pointer-events: auto; }
        .wa-csm-sidebar { width: 200px; background: #131722; border-right: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; padding: 20px 0; }
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
        .wa-csm-select { background: #131722; color: #EAECEF; border: 1px solid rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 4px; font-size: 12px; outline: none; cursor: pointer; width: 140px; }
        .wa-csm-slider { width: 100px; accent-color: #26a69a; }
        .wa-color-swatch { width: 26px; height: 26px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: 0.2s; background: transparent; }
        .wa-color-swatch:hover { border-color: #00F0FF; box-shadow: 0 0 5px rgba(0,240,255,0.3); }
        .wa-switch { position: relative; display: inline-block; width: 36px; height: 20px; }
        .wa-switch input { opacity: 0; width: 0; height: 0; }
        .wa-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .2s; border-radius: 20px; }
        .wa-slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: #848e9c; transition: .2s; border-radius: 50%; }
        input:checked + .wa-slider { background-color: rgba(38,166,154,0.3); }
        input:checked + .wa-slider:before { transform: translateX(16px); background-color: #26a69a; }
        .wa-csm-divider { font-size: 11px; font-weight: 800; color: #527c82; text-transform: uppercase; margin-top: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; }
        #wa-color-picker { display: none; position: fixed; background: #1e222d; border: 1px solid #363c4e; border-radius: 8px; padding: 12px; z-index: 99999999; box-shadow: 0 10px 30px rgba(0,0,0,0.8); width: 220px; }
        .wcp-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-bottom: 12px; }
        .wcp-cell { width: 18px; height: 18px; border-radius: 3px; cursor: pointer; border: 1px solid transparent; transition: 0.1s; }
        .wcp-cell:hover { border-color: #fff; transform: scale(1.1); }
        .wcp-hex-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .wcp-hex-input { flex: 1; background: #131722; border: 1px solid #363c4e; color: #EAECEF; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; outline: none; }
        .wcp-opacity-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #848e9c; }
        .wcp-opacity-slider { flex: 1; accent-color: #26a69a; }
    `;
    document.head.appendChild(style);

    const modalHTML = `
        <div id="wa-chart-settings-modal">
            <div class="wa-csm-box" id="wa-csm-box">
                <div class="wa-csm-sidebar">
                    <div class="wa-csm-tab active" data-tab="csm-symbol">Biểu Tượng</div>
                    <div class="wa-csm-tab" data-tab="csm-status">Trạng Thái</div>
                    <div class="wa-csm-tab" data-tab="csm-appearance">Giao Diện</div>
                    <div class="wa-csm-tab" data-tab="csm-pro">Nâng Cao</div>
                </div>
                <div class="wa-csm-content">
                    <div class="wa-csm-header">
                        <div class="wa-csm-title">Cài đặt Biểu đồ</div>
                        <div class="wa-csm-close" id="btn-wa-csm-close">✖</div>
                    </div>
                    <div class="wa-csm-panels">
                        <div id="csm-symbol" class="wa-csm-panel active">
                            <div class="wa-csm-row"><div class="wa-csm-label">Loại biểu đồ</div><select class="wa-csm-select" data-bind="chartType" id="csm-chart-type" data-type="number"><option value="1">Nến Nhật</option><option value="2">Nến Rỗng</option><option value="3">Thanh (Bars)</option><option value="6">Đường (Line)</option><option value="9">Vùng (Area)</option></select></div>
                            <div class="wa-csm-divider">Màu sắc</div>
                            
                            <div id="csm-ui-candles" style="display:flex; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row"><div class="wa-csm-label">Thân nến (Body)</div><div class="wa-csm-control"><div class="wa-color-swatch" data-color-bind="upColor"></div><div class="wa-color-swatch" data-color-bind="downColor"></div></div></div>
                                
                                <div class="wa-csm-row">
                                    <div class="wa-csm-label"><label class="wa-switch"><input type="checkbox" data-bind="showBorder"><span class="wa-slider"></span></label> Viền (Borders)</div>
                                    <div class="wa-csm-control">
                                        <label class="wa-switch" title="Màu độc lập"><input type="checkbox" data-bind="borderIndependent"><span class="wa-slider"></span></label>
                                        <div id="csm-border-swatches" style="display:flex; gap:10px; opacity:0.5; pointer-events:none;">
                                            <div class="wa-color-swatch" data-color-bind="borderUpColor"></div><div class="wa-color-swatch" data-color-bind="borderDownColor"></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="wa-csm-row">
                                    <div class="wa-csm-label"><label class="wa-switch"><input type="checkbox" data-bind="showWick"><span class="wa-slider"></span></label> Bóng nến (Wicks)</div>
                                    <div class="wa-csm-control">
                                        <label class="wa-switch" title="Màu độc lập"><input type="checkbox" data-bind="wickIndependent"><span class="wa-slider"></span></label>
                                        <div id="csm-wick-swatches" style="display:flex; gap:10px; opacity:0.5; pointer-events:none;">
                                            <div class="wa-color-swatch" data-color-bind="wickUpColor"></div><div class="wa-color-swatch" data-color-bind="wickDownColor"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div id="csm-ui-lines" style="display:none; flex-direction:column; gap:20px;">
                                <div class="wa-csm-row"><div class="wa-csm-label">Màu Đường / Vùng</div><div class="wa-csm-control"><div class="wa-color-swatch" data-color-bind="upColor"></div></div></div>
                            </div>

                            <div class="wa-csm-divider">Trục Y</div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Thang đo giá</div><select class="wa-csm-select" data-bind="yAxisMode"><option value="normal">Bình thường</option><option value="percentage">Phần trăm (%)</option><option value="log">Logarit</option></select></div>
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
                            <div class="wa-csm-row"><div class="wa-csm-label">Kiểu nền</div><div class="wa-csm-control"><select class="wa-csm-select" data-bind="bgType" id="csm-bg-type" style="width:100px;"><option value="solid">Đơn sắc</option><option value="gradient">Gradient</option></select><div class="wa-color-swatch" data-color-bind="bgColor"></div><div class="wa-color-swatch" data-color-bind="bgColor2" id="csm-bg2-swatch" style="display:none;"></div></div></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Lưới dọc</div><label class="wa-switch"><input type="checkbox" data-bind="gridVertical"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Lưới ngang</div><label class="wa-switch"><input type="checkbox" data-bind="gridHorizontal"><span class="wa-slider"></span></label></div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Màu Lưới</div><div class="wa-color-swatch" data-color-bind="gridColor"></div></div>
                            <div class="wa-csm-divider">Trục & Không gian</div>
                            <div class="wa-csm-row"><div class="wa-csm-label">Tâm ngắm</div><select class="wa-csm-select" data-bind="crosshairMode"><option value="normal">Bình thường</option><option value="hidden">Ẩn</option></select></div>
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
    
    const pickerHTML = `
        <div id="wa-color-picker">
            <div class="wcp-grid" id="wcp-palette"></div>
            <div class="wcp-hex-row"><span style="font-size:11px; color:#848e9c; font-weight:bold;">HEX</span><input type="text" class="wcp-hex-input" id="wcp-hex" maxlength="9"></div>
            <div class="wcp-opacity-row"><span>OPACITY</span><input type="range" class="wcp-opacity-slider" id="wcp-opacity" min="0" max="1" step="0.05" value="1"></div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML + pickerHTML);

    const modal = document.getElementById('wa-chart-settings-modal');
    const modalBox = document.getElementById('wa-csm-box');
    const header = modal.querySelector('.wa-csm-header');
    const colorPicker = document.getElementById('wa-color-picker');

    let isDragging = false, startX, startY, initLeft, initTop;
    header.addEventListener('mousedown', (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = modalBox.getBoundingClientRect();
        initLeft = rect.left; initTop = rect.top;
        modalBox.style.transform = 'none'; modalBox.style.left = initLeft + 'px'; modalBox.style.top = initTop + 'px';
        document.body.style.userSelect = 'none'; 
    });
    window.addEventListener('mousemove', (e) => { if (!isDragging) return; modalBox.style.left = (initLeft + e.clientX - startX) + 'px'; modalBox.style.top = (initTop + e.clientY - startY) + 'px'; });
    window.addEventListener('mouseup', () => { isDragging = false; document.body.style.userSelect = ''; });

    const tabs = modal.querySelectorAll('.wa-csm-tab');
    const panels = modal.querySelectorAll('.wa-csm-panel');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active')); panels.forEach(p => p.classList.remove('active'));
            tab.classList.add('active'); document.getElementById(tab.dataset.tab).classList.add('active');
        };
    });

    const tvColors = ['#ffffff','#d1d4dc','#b2b5be','#848e9c','#5d606b','#363a45','#1e222d','#000000','#f23645','#ff9800','#f0b90b','#089981','#00bcd4','#2962ff','#673ab7','#9c27b0','#f7525f','#ffb74d','#ffe066','#2af592','#4dd0e1','#448aff','#9575cd','#ba68c8','#f98080','#ffcc80','#fff59d','#66bb6a','#80deea','#82b1ff','#b39ddb','#ce93d8'];
    const palette = document.getElementById('wcp-palette'), hexInp = document.getElementById('wcp-hex'), opSlider = document.getElementById('wcp-opacity');
    let activeSwatchBtn = null, activeBindKey = null;

    tvColors.forEach(col => {
        const cell = document.createElement('div'); cell.className = 'wcp-cell'; cell.style.background = col;
        cell.onclick = () => applyColorToSwatch(col, opSlider.value);
        palette.appendChild(cell);
    });

    function applyColorToSwatch(hexCode, opacity) {
        if (!activeSwatchBtn) return;
        let finalColor = hexCode;
        if (opacity < 1 && hexCode.startsWith('#')) {
            let r = parseInt(hexCode.slice(1,3), 16), g = parseInt(hexCode.slice(3,5), 16), b = parseInt(hexCode.slice(5,7), 16);
            finalColor = `rgba(${r},${g},${b},${opacity})`;
        }
        activeSwatchBtn.style.background = finalColor; hexInp.value = finalColor;
        if (window.WaveChartEngine) window.WaveChartEngine.update({ [activeBindKey]: finalColor });
    }

    modal.querySelectorAll('.wa-color-swatch').forEach(swatch => {
        swatch.onclick = (e) => {
            e.stopPropagation(); activeSwatchBtn = swatch; activeBindKey = swatch.dataset.colorBind;
            let curColor = swatch.style.background || '#ffffff';
            hexInp.value = curColor.startsWith('rgb') ? curColor : rgb2hex(curColor);
            const rect = swatch.getBoundingClientRect();
            colorPicker.style.display = 'block'; colorPicker.style.left = rect.left + 'px'; colorPicker.style.top = (rect.bottom + 10) + 'px';
        };
    });

    hexInp.oninput = (e) => applyColorToSwatch(e.target.value, opSlider.value);
    opSlider.oninput = (e) => applyColorToSwatch(hexInp.value.substring(0,7), e.target.value);
    document.addEventListener('click', (e) => { if (!colorPicker.contains(e.target) && !e.target.classList.contains('wa-color-swatch')) colorPicker.style.display = 'none'; });
    function rgb2hex(rgb) { if (rgb.search("rgb") === -1) return rgb; rgb = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/); return "#" + ("0" + parseInt(rgb[1]).toString(16)).slice(-2) + ("0" + parseInt(rgb[2]).toString(16)).slice(-2) + ("0" + parseInt(rgb[3]).toString(16)).slice(-2); }

    function updateDynamicUI(config) {
        const t = parseInt(config.chartType); const isLineOrArea = (t === 6 || t === 9);
        document.getElementById('csm-ui-candles').style.display = isLineOrArea ? 'none' : 'flex';
        document.getElementById('csm-ui-lines').style.display = isLineOrArea ? 'flex' : 'none';
        document.getElementById('csm-bg2-swatch').style.display = config.bgType === 'gradient' ? 'block' : 'none';
        
        // 🚀 BẬT TẮT SỰ KIỆN CLICK CHUẨN XÁC CHO BOX MÀU
        document.getElementById('csm-wick-swatches').style.opacity = config.wickIndependent ? '1' : '0.5';
        document.getElementById('csm-wick-swatches').style.pointerEvents = config.wickIndependent ? 'auto' : 'none';
        document.getElementById('csm-border-swatches').style.opacity = config.borderIndependent ? '1' : '0.5';
        document.getElementById('csm-border-swatches').style.pointerEvents = config.borderIndependent ? 'auto' : 'none';
    }

    window.openChartSettings = function() {
        if (!window.WaveChartEngine) return;
        const config = window.WaveChartEngine.getConfig();
        modal.querySelectorAll('[data-bind]').forEach(el => {
            const key = el.dataset.bind;
            if (config[key] !== undefined) { if (el.type === 'checkbox') el.checked = config[key]; else el.value = config[key]; }
        });
        modal.querySelectorAll('.wa-color-swatch').forEach(swatch => {
            const key = swatch.dataset.colorBind; if (config[key]) swatch.style.background = config[key];
        });
        modalBox.style.transform = 'translate(-50%, -50%)'; modalBox.style.left = '50%'; modalBox.style.top = '50%';
        updateDynamicUI(config);
        modal.classList.add('show');
    };

    document.getElementById('btn-wa-csm-close').onclick = () => modal.classList.remove('show');
    
    modal.querySelectorAll('[data-bind]').forEach(el => {
        const eventType = el.type === 'range' ? 'input' : 'change';
        el.addEventListener(eventType, (e) => {
            const key = el.dataset.bind;
            let value = el.type === 'checkbox' ? el.checked : el.value;
            if (el.dataset.type === 'number') value = parseFloat(value);
            if (window.WaveChartEngine) window.WaveChartEngine.update({ [key]: value });
            updateDynamicUI(window.WaveChartEngine.getConfig());
        });
    });

    
})();

// =========================================================================
// ⏱️ BƯỚC 5: CHART OVERLAYS (NATIVE COUNTDOWN & WATERMARK)
// =========================================================================
(function initChartOverlays() {
    'use strict';

    let countdownInterval = null;
    let countdownRafId = null;

    window.addEventListener('wa_chart_config_updated', (e) => {
        const config = e.detail;
        const container = document.getElementById('sc-chart-container');
        if (!container) return;

        // 1. WATERMARK
        let wm = document.getElementById('wa-overlay-watermark');
        if (config.showWatermark) {
            if (!wm) {
                wm = document.createElement('div');
                wm.id = 'wa-overlay-watermark';
                wm.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: "Inter", sans-serif; font-weight: 800; font-size: clamp(40px, 8vw, 120px); letter-spacing: 2px; pointer-events: none; z-index: 1; white-space: nowrap; transition: opacity 0.2s;';
                container.appendChild(wm);
            }
            const sym = window.currentChartToken ? window.currentChartToken.symbol : 'WAVE ALPHA';
            const tf = (window.currentChartInterval || '1D').toUpperCase();
            wm.innerText = `${sym} • ${tf}`;
            wm.style.color = `rgba(255,255,255, ${config.watermarkOpacity})`;
        } else if (wm) {
            wm.remove();
        }

        // 2. COUNTDOWN (ĐẾM NGƯỢC HÒA VÀO TRỤC Y)
        let cd = document.getElementById('wa-overlay-countdown');
        if (config.showCountdown) {
            if (!cd) {
                cd = document.createElement('div');
                cd.id = 'wa-overlay-countdown';
                // 🚀 STYLE MỚI: Xóa viền/nền bự, biến nó thành Text chìm hòa vào cột Y-Axis bên phải
                cd.style.cssText = 'position: absolute; right: 0; width: 64px; text-align: center; font-family: "Trebuchet MS", sans-serif; font-size: 11px; font-weight: 600; padding: 2px 0; color: #b7bdc6; pointer-events: none; z-index: 100;';
                container.appendChild(cd);
                
                if (countdownInterval) clearInterval(countdownInterval);
                countdownInterval = setInterval(updateCountdownText, 1000);
                syncPosition60FPS(); // Kích hoạt bám đuôi
            }
        } else {
            if (cd) cd.remove();
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            if (countdownRafId) { cancelAnimationFrame(countdownRafId); countdownRafId = null; }
        }
    });

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
        if (cd && window.tvChart) {
            try {
                const dataList = window.tvChart.getDataList();
                if (dataList && dataList.length > 0) {
                    const lastPrice = dataList[dataList.length - 1].close;
                    const pixel = window.tvChart.convertToPixel({ value: lastPrice }, { paneId: 'candle_pane' });
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

// =========================================================================
// 🚀 BƯỚC 8: TỔNG QUẢN THANH CÔNG CỤ (FIX LỖI LIỆT NÚT & SAI THỨ TỰ)
// =========================================================================
(function initUnifiedToolbar() {
    const checkToolbar = setInterval(() => {
        const timeBtns = document.querySelectorAll('.sc-time-btn');
        if (timeBtns.length > 0) {
            clearInterval(checkToolbar);
            const lastTimeBtn = timeBtns[timeBtns.length - 1];

            // 1. Tạo Group VIP cho Nến & Cài đặt (Nằm ngay sau Khung giờ)
            let waGroup = document.getElementById('wa-chart-tools-group');
            if (!waGroup) {
                waGroup = document.createElement('div');
                waGroup.id = 'wa-chart-tools-group';
                waGroup.style.cssText = 'display: flex; align-items: center; gap: 4px; margin-left: 8px; padding-left: 8px; border-left: 1px solid rgba(255,255,255,0.15); order: 2 !important; flex-shrink: 0; z-index: 10;';
                lastTimeBtn.after(waGroup);
            }

            // 2. Tạo nút Chọn Loại Nến
            if (!document.getElementById('btn-wa-chart-type')) {
                const typeBtnWrap = document.createElement('div');
                typeBtnWrap.style.cssText = 'position: relative; display: flex; align-items: center;';
                typeBtnWrap.innerHTML = `
                    <button id="btn-wa-chart-type" class="wa-topbtn-new" title="Chọn loại biểu đồ">
                        <span id="wa-ct-btn-icon" style="display:flex; align-items:center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 4v16M15 4v16M7 8h4v8H7zM13 10h4v6h-4z"/></svg>
                        </span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                `;
                waGroup.appendChild(typeBtnWrap);
                
                const btnType = document.getElementById('btn-wa-chart-type');
                const menuType = document.getElementById('wa-chart-type-menu');
                if(btnType && menuType) {
                    btnType.onclick = (e) => {
                        e.stopPropagation();
                        const isHidden = menuType.style.display === 'none' || menuType.style.display === '';
                        if (isHidden) {
                            const rect = btnType.getBoundingClientRect();
                            menuType.style.top = (rect.bottom + 6) + 'px';
                            menuType.style.left = rect.left + 'px';
                            menuType.style.display = 'grid';
                        } else {
                            menuType.style.display = 'none';
                        }
                    };
                }
            }

            // 3. Tạo nút Bánh Răng Cài Đặt
            if (!document.getElementById('btn-wa-chart-settings')) {
                const setBtnWrap = document.createElement('div');
                setBtnWrap.style.cssText = 'position: relative; display: flex; align-items: center;';
                setBtnWrap.innerHTML = `
                    <button id="btn-wa-chart-settings" class="wa-topbtn-new" title="Cài đặt giao diện">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                `;
                waGroup.appendChild(setBtnWrap);
                
                const btnSet = document.getElementById('btn-wa-chart-settings');
                if(btnSet) {
                    btnSet.onclick = (e) => { e.stopPropagation(); if(window.openChartSettings) window.openChartSettings(); };
                }
            }

            // 4. CSS bổ sung để nút không bị liệt
            if (!document.getElementById('wa-toolbar-fix-style')) {
                const s = document.createElement('style');
                s.id = 'wa-toolbar-fix-style';
                s.textContent = `
                    .wa-topbtn-new {
                        background: rgba(255,255,255,0.05); color: #848e9c; border: 1px solid rgba(255,255,255,0.1); 
                        border-radius: 4px; height: 28px; padding: 0 8px; display: flex; align-items: center; 
                        justify-content: center; cursor: pointer; transition: 0.2s; pointer-events: auto !important; z-index: 100;
                    }
                    .wa-topbtn-new:hover { background: rgba(255,255,255,0.1); color: #fff; }
                `;
                document.head.appendChild(s);
            }
        }
    }, 500);
})();