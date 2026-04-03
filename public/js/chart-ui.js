// ==========================================
// 🚀 FILE: chart-ui.js - GIAO DIỆN & TRADINGVIEW
// ==========================================

window.tvChart = null;
window.tvLineSeries = null; 
window.tvVolumeSeries = null; 
window.tvCandleSeries = null;
window.currentChartInterval = '1d'; 
window.currentTheme = localStorage.getItem('wave_theme') || 'cyber';

window.isProSoundOn = true; 
window.tapeRenderQueue = [];
window.isTapeRendering = false;
window.liveTradesQueue = [];
window.isLiveTradesRendering = false;

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

window.logToSniperTape = function(isBuy, vol, type, price, timestamp = null) {
    let isLiq = type.includes('CHÁY');
    
    // Nếu có truyền timestamp (từ API lịch sử) thì lấy giờ đó, không thì lấy giờ hiện tại (Realtime)
    let dateObj = timestamp ? new Date(timestamp) : new Date();
    const timeStr = dateObj.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // ----------------------------------------------------
    // 1. XỬ LÝ TAPE THANH LÝ TẠI TAB FUTURES
    // ----------------------------------------------------
    if (isLiq) {
        let liqSig = `${type}_${price}_${vol}`;
        let nowMs = Date.now();
        if (!window.lastLiqEvent) window.lastLiqEvent = { sig: '', time: 0 };
        if (window.lastLiqEvent.sig === liqSig && (nowMs - window.lastLiqEvent.time < 2000)) return; 
        window.lastLiqEvent = { sig: liqSig, time: nowMs };

        const liqTape = document.getElementById('fut-liq-tape');
        if (liqTape) {
            if (liqTape.innerHTML.includes('Đang rình')) liqTape.innerHTML = '';
            
            const currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
            const heatMaxThreshold = Math.max(5000, currentAvgTicket * 15);
            const heatRatio = Math.min(1, vol / heatMaxThreshold); 
            const opacity = 0.05 + (heatRatio * 0.5); 
            
            const lColor = type.includes('LONG') ? '#FF007F' : '#00F0FF'; 
            const lBg = type.includes('LONG') ? `rgba(255, 0, 127, ${opacity})` : `rgba(0, 240, 255, ${opacity})`;
            
            const lEntry = document.createElement('div');
            const borderLeft = heatRatio > 0.6 ? `4px solid ${lColor}` : 'none';
            const fontWeight = heatRatio > 0.6 ? '900' : '600';

            lEntry.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; padding: 4px 6px; border-bottom: 1px solid var(--term-border); border-left: ${borderLeft}; background: ${lBg}; font-family: var(--font-num); transition: 0.3s; font-weight: ${fontWeight};`;

            let lIcon = type.includes('LONG') ? '🩸' : '💥';
            let lAction = type.includes('LONG') ? 'LIQ L' : 'LIQ S';
            
            lEntry.innerHTML = `
                <span style="color:${lColor}; font-weight:800; width: 35%; text-shadow: 0 0 5px ${lColor};">${lIcon} ${lAction}</span>
                <span style="color:#eaecef; font-weight:bold; width: 45%; text-align: center;">$${window.formatCompactUSD(vol)} @ ${window.formatPrice(price)}</span>
                <span style="color:#848e9c; font-weight:600; width: 20%; text-align: right;">${timeStr}</span>
            `;
            
            liqTape.prepend(lEntry);
            
            if (!timestamp) {
                lEntry.style.background = lColor;
                lEntry.style.color = '#000';
                setTimeout(() => { lEntry.style.background = lBg; lEntry.style.color = ''; }, 150);
            }

            while (liqTape.children.length > 50) liqTape.removeChild(liqTape.lastChild);
        }
    }

    if (isLiq && vol < 1000) return; 
    if (!isLiq && vol < 500 && !type.includes('BOT')) return;

    // ----------------------------------------------------
    // 2. PHÂN LOẠI CHÍNH XÁC TAG CHO BỘ LỌC TAPE
    // ----------------------------------------------------
    let tapeType = 'bot'; // Mặc định tất cả thuật toán, wash trade, sweep là bot
    if (isLiq) tapeType = 'liq';
    else if (type.includes('VOI')) tapeType = 'whale';
    else if (type.includes('MẬP')) tapeType = 'shark';
    else if (type.includes('HEO')) tapeType = 'dolphin';

    // Chỉ cá voi, cá mập và thanh lý mới phát ra âm thanh và phát sáng
    const isGlowFish = (tapeType === 'whale' || tapeType === 'shark' || tapeType === 'liq');
    if (isGlowFish && !timestamp) window.playProPing();

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

    // GÁN NHÃN ĐÃ ĐƯỢC CHUẨN HÓA Ở TRÊN
    entry.dataset.tapeType = tapeType; 
    entry.style.cssText = `display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: ${bg}; border-left: ${(heatRatio > 0.6 || isLiq) ? 4 : 2}px solid ${color}; border-radius: 0; font-family: var(--font-num); gap: 4px; font-weight: ${fontWt}; transition: background 0.8s ease;`;

    let glow = isGlowFish ? `text-shadow: 0 0 5px ${color};` : '';

    entry.innerHTML = `
        <span style="color:${color}; font-weight:800; width: 35%; ${glow}">${type} ${action}</span>
        <span style="color:#eaecef; font-weight:bold; width: 45%; text-align: center;">$${window.formatCompactUSD(vol)} @ ${window.formatPrice(price)}</span>
        <span style="color:#848e9c; font-weight:600; width: 20%; text-align: right;">${timeStr}</span>
    `;
    
    // KIỂM TRA CHECKBOX ĐỂ ẨN HIỆN NGAY TỪ LÚC TẠO LỆNH MỚI
    let checkboxes = document.querySelectorAll('.tape-filter-cb');
    if (checkboxes.length > 0) {
        let activeTypes = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (!activeTypes.includes(tapeType)) {
            entry.style.display = 'none';
        }
    }

    window.tapeRenderQueue.push({ entry, isGlowFish, isBuy, bg });

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
                    if (items[i].isGlowFish && !timestamp) { 
                        items[i].entry.style.background = items[i].isBuy ? 'rgba(14, 203, 129, 0.55)' : 'rgba(246, 70, 93, 0.55)';
                        setTimeout(() => { items[i].entry.style.background = items[i].bg; items[i].entry.style.textShadow = 'none'; }, 150);
                    }
                }
                tape.prepend(fragment);
                while (tape.children.length > 50) tape.removeChild(tape.lastChild);
            }
            window.isTapeRendering = false;
        });
    }
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

// Đè lại hàm click ra ngoài để đóng cả 2 menu (Menu Chart lớn và Menu Tape nhỏ)
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

window.toggleTapeFilterMenu = function(e) {
    if(e) e.stopPropagation();
    let menu = document.getElementById('tape-filter-menu');
    let btn = document.getElementById('tape-filter-btn');
    if(menu) {
        menu.classList.toggle('show');
        if (btn) btn.classList.toggle('active', menu.classList.contains('show'));
    }
};

// Đè lại hàm click ra ngoài để đóng cả 2 menu (Menu Chart lớn và Menu Tape nhỏ)
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

window.filterSniperTape = function() {
    let checkboxes = document.querySelectorAll('.tape-filter-cb');
    if (checkboxes.length === 0) return;
    
    // Lấy danh sách các loại đang được Tick
    let activeTypes = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

    const tape = document.getElementById('cc-sniper-tape');
    if (!tape) return;
    
    Array.from(tape.children).forEach(child => {
        if (!child.dataset.tapeType) return; 
        
        // Hiện lên nếu Loại của dòng đó nằm trong danh sách đang Tick
        if (activeTypes.includes(child.dataset.tapeType)) {
            child.style.display = 'flex';
        } else {
            child.style.display = 'none';
        }
    });
};

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
    if (isWhale) { icon = '🐋 '; fontWeight = '800'; } else if (isShark) { icon = '🦈 '; fontWeight = '700'; } else if (isDolphin) { icon = '🐬 '; fontWeight = '600'; } else if (isSweep) { icon = '🤖 '; fontWeight = '600'; }

    let c_up = '#0ECB81'; let c_down = '#F6465D';
    let c_bg_up = 'transparent'; let c_bg_down = 'transparent';
    if (isWhale || isShark || isSweep) { c_bg_up = 'rgba(14, 203, 129, 0.15)'; c_bg_down = 'rgba(246, 70, 93, 0.15)'; }

    let row = document.createElement('div');
    row.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:3px 4px; border-bottom:1px solid #1A1F26; background:${cluster.dir ? c_bg_up : c_bg_down}; font-weight:${fontWeight}; font-variant-numeric: tabular-nums; transition: 0.1s;`;
    let timeStr = new Date(cluster.t).toLocaleTimeString('en-GB',{hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'});
    row.innerHTML = `<span style="color:${cluster.dir ? c_up : c_down}; flex: 1; text-align: left; overflow: hidden; white-space: nowrap;">${window.formatPrice(cluster.p)}</span><span style="color:#eaecef; flex: 1; text-align: center; white-space: nowrap;">${icon}$${window.formatCompactUSD(cluster.vol)}</span><span style="color:#707A8A; flex: 1; text-align: right; white-space: nowrap;">${timeStr}</span>`;

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
                        items[i].el.style.background = items[i].dir ? items[i].c_up : items[i].c_down; items[i].el.style.color = '#000000';
                        setTimeout(() => { items[i].el.style.background = items[i].dir ? items[i].c_bg_up : items[i].c_bg_down; items[i].el.style.color = ''; }, 100);
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

        let fishType = isWhale ? 'whale' : (isShark ? 'shark' : (isDolphin ? 'dolphin' : 'bot'));
        
        // RÚT GỌN SỐ: Chỉ lấy 1 chữ số thập phân (Ví dụ 7.89K -> 7.8K)
        let shortVol = cluster.vol >= 1e9 ? (cluster.vol/1e9).toFixed(1) + 'B' : (cluster.vol >= 1e6 ? (cluster.vol/1e6).toFixed(1) + 'M' : (cluster.vol >= 1e3 ? (cluster.vol/1e3).toFixed(1) + 'K' : cluster.vol.toFixed(0)));
        let textMsg = icon + '$' + shortVol;
        
        if (isSweep && !isDolphin && !isShark && !isWhale) textMsg = '🤖 SWEEP';
        let markerColor = cluster.dir ? (window.currentTheme === 'trad' ? '#0ECB81' : '#2af592') : (window.currentTheme === 'trad' ? '#F6465D' : '#cb55e3');

        window.scChartMarkers.push({ time: cluster.timeSec, position: cluster.dir ? 'belowBar' : 'aboveBar', color: markerColor, shape: cluster.dir ? 'arrowUp' : 'arrowDown', text: textMsg, fishType: fishType });
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

    let nfEl = document.getElementById('cc-net-flow');
    let nfBox = document.getElementById('cc-nf-box');
    if (nfEl && window.scNetFlow !== undefined) {
        nfEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + window.formatCompactUSD(Math.abs(window.scNetFlow));
        nfEl.style.color = window.scNetFlow >= 0 ? '#0ECB81' : '#F6465D';
        if (nfBox) nfBox.style.borderLeftColor = window.scNetFlow >= 0 ? '#0ECB81' : '#F6465D';
    }

    let speed = window.scSpeedWindow ? window.scSpeedWindow.reduce((s, x) => s + x.v, 0) / 5 : 0;
    let speedEl = document.getElementById('cc-speed');
    if (speedEl) speedEl.innerText = '$' + window.formatCompactUSD(speed) + ' /s';

    let algoStatus = document.getElementById('cc-algo-status');
    let algoBox = document.getElementById('cc-algo-box');
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

    let ofiBarBuy = document.getElementById('cc-ofi-bar-buy');
    let ofiBarSell = document.getElementById('cc-ofi-bar-sell');
    if (ofiBarBuy && ofiBarSell) {
        let buyPct = window.quantStats.buyDominance || 50; let sellPct = 100 - buyPct;
        ofiBarBuy.style.width = `${buyPct}%`; ofiBarSell.style.width = `${sellPct}%`;
        ofiBarBuy.style.background = buyPct >= 70 ? '#00F0FF' : '#0ECB81'; ofiBarBuy.style.boxShadow = buyPct >= 70 ? '0 0 5px #00F0FF' : 'none';
        ofiBarSell.style.background = sellPct >= 70 ? '#FF007F' : '#F6465D'; ofiBarSell.style.boxShadow = sellPct >= 70 ? '0 0 5px #FF007F' : 'none';
    }
    
    let avgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 0;
    let avgEl = document.getElementById('cc-avg-ticket');
    if (avgEl) { let icon = avgTicket > 3000 ? '🐋' : '🦐'; let color = avgTicket > 3000 ? '#F0B90B' : '#eaecef'; avgEl.innerHTML = `${icon} <span style="color:${color}">$${window.formatCompactUSD(avgTicket)}</span>`; }

    let trend = window.quantStats.trend || 0;
    let trendEl = document.getElementById('cc-vwap-trend');
    if (trendEl) { trendEl.innerText = (trend > 0 ? '▲ +' : (trend < 0 ? '▼ ' : '')) + Math.abs(trend).toFixed(2) + '%'; trendEl.style.color = trend >= 0 ? '#0ECB81' : '#F6465D'; }

    let spread = window.quantStats.spread || 0;
    let spVal = document.getElementById('cc-spread-val'); let spMeter = document.getElementById('cc-spread-meter');
    if (spVal && spMeter) {
        spVal.innerText = spread.toFixed(2) + '%';
        let fill = Math.min(100, Math.max(5, (spread / 2.0) * 100)); spMeter.style.width = fill + '%';
        if (spread < 0.2) { spMeter.style.background = '#0ECB81'; spVal.style.color = '#0ECB81'; } else if (spread < 0.8) { spMeter.style.background = '#F0B90B'; spVal.style.color = '#F0B90B'; } else { spMeter.style.background = '#F6465D'; spVal.style.color = '#F6465D'; }
    }

    let drop = window.quantStats.drop || 0; let dropEl = document.getElementById('cc-drop-val');
    if (dropEl) { dropEl.innerText = drop.toFixed(2) + '%'; dropEl.style.color = drop < -1.0 ? '#00F0FF' : '#eaecef'; }

    const wBuy = window.quantStats.whaleBuyVol || 0; const wSell = window.quantStats.whaleSellVol || 0; const totalWhale = wBuy + wSell;
    let smBuyPct = 50, smSellPct = 50;
    if (totalWhale > 0) { smBuyPct = (wBuy / totalWhale) * 100; smSellPct = (wSell / totalWhale) * 100; }
    
    let barBuy = document.getElementById('cc-whale-bar-buy'); let barSell = document.getElementById('cc-whale-bar-sell');
    if(barBuy) barBuy.style.width = `${smBuyPct}%`; if(barSell) barSell.style.width = `${smSellPct}%`;
    let volBuy = document.getElementById('cc-whale-vol-buy'); if(volBuy) volBuy.innerText = 'B: $' + window.formatCompactUSD(wBuy);
    let volSell = document.getElementById('cc-whale-vol-sell'); if(volSell) volSell.innerText = 'S: $' + window.formatCompactUSD(wSell);
    let ratioTxt = document.getElementById('cc-whale-ratio');
    if(ratioTxt) { ratioTxt.innerText = `${smBuyPct.toFixed(0)}% BUY`; ratioTxt.style.color = smBuyPct > 50 ? '#0ECB81' : '#F6465D'; }

    // Chỉ đến fut-ai-verdict nếu có Tab Futures, nếu không lấy ai-verdict-badge
    const verdictEl = document.getElementById('fut-ai-verdict') || document.getElementById('ai-verdict-badge');
    if (verdictEl) {
        let _vTrend = window.quantStats.trend || 0; let _vWBuy = window.quantStats.whaleBuyVol || 0; let _vWSell = window.quantStats.whaleSellVol || 0;
        let _vTotalW = _vWBuy + _vWSell; let _vSPct = _vTotalW > 0 ? (_vWSell / _vTotalW) * 100 : 50; let _vWNet = _vWBuy - _vWSell;
        let txPerSec = window.scSpeedWindow ? (window.scSpeedWindow.length / 5) : 0; let zScore = window.quantStats.zScore || 0; let ofi = window.quantStats.ofi || 0;

        let t_chart = window.currentChartToken || {};
        let dailyTx = t_chart.tx_count || 86400; let dailyVol = t_chart.volume?.daily_total || 1000000;
        let normalTxPerSec = dailyTx / 86400; let normalAvgTicket = dailyVol / dailyTx;
        let isCrazyFast = txPerSec > Math.max(3, normalTxPerSec * 4); let isRetailTicket = avgTicket < Math.max(100, normalAvgTicket * 0.3); let isHeavyDump = _vWNet < -(Math.max(10000, normalAvgTicket * 20));

        // Phán đoán Futures
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
    // Cập nhật lên Tab Futures Mới (Khắc phục lỗi 0$)
    let futLiqLongEl = document.getElementById('fut-liq-long');
    if (futLiqLongEl) futLiqLongEl.innerText = `$${window.formatCompactUSD((window.quantStats && window.quantStats.longLiq) ? window.quantStats.longLiq : 0)}`;
    
    let futLiqShortEl = document.getElementById('fut-liq-short');
    if (futLiqShortEl) futLiqShortEl.innerText = `$${window.formatCompactUSD((window.quantStats && window.quantStats.shortLiq) ? window.quantStats.shortLiq : 0)}`;

    // Cập nhật cho bảng Data Flow cũ (Nếu bạn chưa xóa thẻ cũ)
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
    let el = document.getElementById('sc-theme-select');
    if (el) {
        window.currentTheme = el.value;
        localStorage.setItem('wave_theme', window.currentTheme);
        if (window.currentChartToken) window.openProChart(window.currentChartToken, true); 
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
    const panelContent = document.getElementById('sc-panel-content');
    const allBtns = document.querySelectorAll('.sc-sidebar-icon');
    const allTabs = document.querySelectorAll('.sc-tab-content');

    if (btnElement && btnElement.classList.contains('active')) { panelContent.classList.toggle('collapsed'); return; }
    if (panelContent.classList.contains('collapsed')) { panelContent.classList.remove('collapsed'); }

    allBtns.forEach(btn => btn.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    allTabs.forEach(tab => { tab.style.display = 'none'; tab.classList.remove('active'); });
    let targetTab = document.getElementById('tab-' + tabId);
    if (targetTab) { targetTab.style.display = 'flex'; targetTab.classList.add('active'); }
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
    
    // TIÊU DIỆT KLINECHART CŨ CHUẨN XÁC ĐỂ KHÔNG BỊ TREO KHI ĐỔI KHUNG
    if (window.tvChart) { 
        try { klinecharts.dispose(container); } catch(e) {} 
        window.tvChart = null; 
    }
    window.scActivePriceLines = [];
    
    container.innerHTML = `<div style="position: absolute; bottom: 25px; left: 15px; z-index: 2; font-family: var(--font-main); font-weight: 800; font-size: 20px; color: rgba(255,255,255,0.06); pointer-events: none; letter-spacing: 2px;">WAVE ALPHA</div>
        <div id="sc-custom-tooltip" style="position: absolute; top: 10px; left: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; color: #848e9c; font-size: 10.5px; font-family: var(--font-num); font-weight: 600; pointer-events: none; z-index: 10; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">
            <span id="tp-o-wrap">O <span id="tp-o" style="color:#eaecef;">--</span></span><span id="tp-h-wrap">H <span id="tp-h" style="color:#eaecef;">--</span></span><span id="tp-l-wrap">L <span id="tp-l" style="color:#eaecef;">--</span></span><span id="tp-c-wrap">C <span id="tp-c" style="color:#eaecef;">--</span></span><span>Vol <span id="tp-v" style="color:#eaecef;">--</span></span>
        </div>`;
    
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
        
        // FIX LỖI 1: Tự động Clear sạch Tape Thanh Lý của token cũ
        let liqTape = document.getElementById('fut-liq-tape');
        if(liqTape) liqTape.innerHTML = '<div style="font-size: 10px; color: #527c82; text-align: center; margin-top: 45px; font-style:italic;">Đang rình cá mập bị luộc...</div>';
        window.lastLiqEvent = null; // Reset luôn bộ nhớ chống lặp lệnh
        
        // -----> GỌI SMART MONEY VÀ FUTURES Ở ĐÂY <-----
        setTimeout(() => {
            if (typeof window.injectSmartMoneyTab === 'function') window.injectSmartMoneyTab();
            if (typeof window.injectFuturesTab === 'function') window.injectFuturesTab();
            
            if (typeof window.fetchSmartMoneyData === 'function') window.fetchSmartMoneyData(t.contract, t.chainId || t.chain_id || 56);
            if (typeof window.fetchFuturesSentiment === 'function') window.fetchFuturesSentiment(t.symbol);
            if (typeof window.fetchCommandCenterFutures === 'function') window.fetchCommandCenterFutures(t.symbol);
        }, 100);
    }

    setTimeout(() => {
        const rect = container.getBoundingClientRect();
        const w = rect.width > 0 ? rect.width : window.innerWidth * 0.75;
        const h = (rect.height > 0 ? rect.height : window.innerHeight * 0.7);

        let priceVal = parseFloat(t.price) || 1;
        let prec = 4; let minM = 0.0001;
        if (priceVal < 1) { prec = 6; minM = 0.000001; } if (priceVal < 0.1) { prec = 8; minM = 0.00000001; } if (priceVal < 0.0001) { prec = 10; minM = 0.0000000001; }

        let isTrad = window.currentTheme === 'trad';
        let t_bg = isTrad ? '#111418' : '#0f1a1c'; let t_text = isTrad ? '#848e9c' : '#527c82'; let t_line = isTrad ? '#00F0FF' : '#41e6e7'; let t_up = isTrad ? '#0ECB81' : '#2af592'; let t_down = isTrad ? '#F6465D' : '#cb55e3';
        
        let overlayElem = document.getElementById('super-chart-overlay');
        if(overlayElem) { overlayElem.classList.remove('theme-cyber', 'theme-trad'); overlayElem.classList.add('theme-' + window.currentTheme); }
        let themeSel = document.getElementById('sc-theme-select'); if(themeSel) themeSel.value = window.currentTheme;

        

        // 2. KHỞI TẠO KLINECHART
        window.tvChart = klinecharts.init(container, {
            styles: {
                grid: { horizontal: { color: 'rgba(255,255,255,0.05)', style: 'dashed' }, vertical: { color: 'rgba(255,255,255,0.05)', style: 'dashed' } },
                candle: {
                    type: window.currentChartInterval === 'tick' ? 'area' : 'candle',
                    bar: { upColor: t_up, downColor: t_down, noChangeColor: t_text, upBorderColor: t_up, downBorderColor: t_down, upWickColor: t_up, downWickColor: t_down },
                    area: {
                        lineSize: 2, lineColor: t_line,
                        backgroundColor: [{ offset: 0, color: isTrad ? 'rgba(0, 240, 255, 0.2)' : 'rgba(65, 230, 231, 0.2)' }, { offset: 1, color: 'rgba(0,0,0,0)' }]
                    },
                    tooltip: { showRule: 'none' }
                },
                yAxis: { axisLine: { show: false }, tickText: { color: t_text } },
                xAxis: { axisLine: { color: 'rgba(255,255,255,0.1)' }, tickText: { color: t_text } }
            }
        });

        window.tvChart.setPriceVolumePrecision(prec, 2);
        window.tvChart.createIndicator('VOL', false, { height: 80 });

        // Lắng nghe đổi size trình duyệt
        new ResizeObserver(entries => { if (entries.length === 0 || entries[0].target !== container) return; window.tvChart.resize(); }).observe(container);

        // 3. TOOLTIP HIỂN THỊ GIÁ
        const tooltipEl = document.getElementById('sc-custom-tooltip'); const tpV = document.getElementById('tp-v'); 
        window.tvChart.subscribeAction('onCrosshairChange', (param) => {
            if (tooltipEl) tooltipEl.style.display = 'flex';
            if (!param || param.dataIndex === undefined) return;
            const dataList = window.tvChart.getDataList();
            const ohlc = dataList[param.dataIndex];
            if (!ohlc) return;

            const tpoWrap = document.getElementById('tp-o-wrap'); const tphWrap = document.getElementById('tp-h-wrap'); const tplWrap = document.getElementById('tp-l-wrap'); const tpcWrap = document.getElementById('tp-c-wrap');
            if (window.currentChartInterval === 'tick') {
                if (tpoWrap) tpoWrap.style.display = 'none'; if (tphWrap) tphWrap.style.display = 'none'; if (tplWrap) tplWrap.style.display = 'none';
                if (tpcWrap) tpcWrap.innerHTML = `Price <span id="tp-c" style="color:#00F0FF;">${window.formatPrice(ohlc.close)}</span>`;
            } else {
                if (tpoWrap) tpoWrap.style.display = 'inline'; if (tphWrap) tphWrap.style.display = 'inline'; if (tplWrap) tplWrap.style.display = 'inline';
                if (tpcWrap && !tpcWrap.innerHTML.startsWith('C')) tpcWrap.innerHTML = `C <span id="tp-c">--</span>`;
                const elO = document.getElementById('tp-o'); const elH = document.getElementById('tp-h'); const elL = document.getElementById('tp-l'); const elC = document.getElementById('tp-c');
                if (elO) elO.innerText = window.formatPrice(ohlc.open); if (elH) elH.innerText = window.formatPrice(ohlc.high); if (elL) elL.innerText = window.formatPrice(ohlc.low);
                if (elC) { elC.innerText = window.formatPrice(ohlc.close); elC.style.color = ohlc.close >= ohlc.open ? '#0ECB81' : '#F6465D'; }
            }
            if (tpV) tpV.innerText = window.formatCompactUSD(ohlc.volume || 0);
        });

        // 4. NẠP DỮ LIỆU LỊCH SỬ VÀ BẬT WEBSOCKET
        if (typeof window.fetchBinanceHistory === 'function') {
            window.fetchBinanceHistory(t, window.currentChartInterval, window.currentChartInterval === 'tick').then(histData => {
                if (histData && histData.length > 0) {
                    window.tvChart.applyNewData(histData); // Nạp 1 phát ăn ngay cho KLineChart
                }
                
                if (typeof window.connectRealtimeChart === 'function') { window.connectRealtimeChart(t, isTimeSwitch); }
                if (typeof window.startFuturesEngine === 'function') { window.startFuturesEngine(t.symbol); }
                
                setTimeout(() => {
                    if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
                    let flowEl = document.getElementById('sc-stat-net-flow');
                    if (flowEl && window.scNetFlow !== undefined) { flowEl.innerText = (window.scNetFlow >= 0 ? '+' : '-') + '$' + window.formatCompactUSD(Math.abs(window.scNetFlow)); flowEl.style.color = window.scNetFlow >= 0 ? '#00F0FF' : '#FF007F'; }
                }, 200);
            });
        }
    }, 100); 
};

window.changeChartInterval = function(interval, btnEl) {
    if (window.currentChartInterval === interval) return;

    document.querySelectorAll('.sc-time-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    window.oldChartInterval = window.currentChartInterval; 
    window.currentChartInterval = interval;

    // Ngắt Data Realtime cũ
    if (window.chartWs) {
        window.chartWs.close();
        window.chartWs = null;
    }

    if (window.currentChartToken) {
        window.openProChart(window.currentChartToken, true);
    }
};

window.closeProChart = function() {
    if (window.quantWorker) { window.quantWorker.terminate(); window.quantWorker = null; }
    if (typeof window.stopFuturesEngine === 'function') window.stopFuturesEngine();
    if (window.scCalcInterval) { clearInterval(window.scCalcInterval); window.scCalcInterval = null; }
    
    // TẮT LUỒNG CẬP NHẬT API SMART MONEY VÀ FUTURES ĐỂ GIẢI PHÓNG RAM
    if (window.proChartApiInterval) { clearInterval(window.proChartApiInterval); window.proChartApiInterval = null; }

    const overlay = document.getElementById('super-chart-overlay');
    if (overlay) { overlay.classList.remove('active'); document.body.classList.remove('overlay-active'); }
    if (window.chartWs) { window.chartWs.close(); window.chartWs = null; }
    if (window.tvChart) { 
        try { klinecharts.dispose('sc-chart-container'); } catch(e) {}
        window.tvChart = null; 
    }
    window.currentChartToken = null; 
};

// ==========================================
// 🚀 HỆ THỐNG QUẢN LÝ CHỈ BÁO (EXPERT UI)
// ==========================================

window.initExpertUI = function() {
    // 1. TẠO CỬA SỔ MODAL TÌM KIẾM CHỈ BÁO (DOM INJECTION)
    if (!document.getElementById('sc-indicator-modal')) {
        const modalHtml = `
        <div id="sc-indicator-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 99999; backdrop-filter: blur(5px); justify-content: center; align-items: center;">
            <div style="background: #1e2329; width: 600px; max-width: 90%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.9); display: flex; flex-direction: column; overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <h5 style="margin: 0; color: #EAECEF; font-size: 16px; font-weight: 700;"><i class="fas fa-wave-square" style="color: #00F0FF; margin-right: 8px;"></i> Các chỉ báo & Chiến lược</h5>
                    <button onclick="document.getElementById('sc-indicator-modal').style.display='none'" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 16px; transition: 0.2s;" onmouseover="this.style.color='#F6465D'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #848e9c;"></i>
                        <input type="text" placeholder="Tìm kiếm chỉ báo..." style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px 8px 35px; color: #EAECEF; outline: none; font-size: 13px;">
                    </div>
                </div>
                <div style="display: flex; height: 350px;">
                    <div style="width: 180px; background: rgba(0,0,0,0.15); border-right: 1px solid rgba(255,255,255,0.05); padding: 10px 0;">
                        <div style="padding: 10px 20px; color: #EAECEF; cursor: pointer; font-size: 13px; font-weight: 600; border-left: 3px solid #00F0FF; background: rgba(0,240,255,0.05);">Chỉ báo Mặc định</div>
                        <div style="padding: 10px 20px; color: #848e9c; font-size: 13px; font-weight: 600; border-left: 3px solid transparent; cursor: pointer;">Độc quyền Wave Alpha <i class="fas fa-lock" style="font-size: 10px; margin-left: 5px; color: #F6465D;"></i></div>
                    </div>
                    <div style="flex: 1; padding: 10px 20px; overflow-y: auto;">
                        <div onclick="window.addIndicatorToChart('MACD')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #EAECEF; font-size: 14px; font-weight: 600;">MACD</div>
                            <div style="color: #848e9c; font-size: 11px;">Moving Average Convergence Divergence</div>
                        </div>
                        <div onclick="window.addIndicatorToChart('RSI')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #EAECEF; font-size: 14px; font-weight: 600;">RSI</div>
                            <div style="color: #848e9c; font-size: 11px;">Relative Strength Index</div>
                        </div>
                        <div onclick="window.addIndicatorToChart('EMA')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #EAECEF; font-size: 14px; font-weight: 600;">EMA</div>
                            <div style="color: #848e9c; font-size: 11px;">Đường Trung bình Động Lũy thừa</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div.firstElementChild);
    }

    // 2. GẮN NÚT VÀO TOPBAR (TÌM CLASS CỦA NÚT CHỌN KHUNG GIỜ ĐỂ ĐỨNG KẾ BÊN)
    if (!document.getElementById('btn-fx-indicator')) {
        let timeBtnLists = document.querySelectorAll('.sc-time-btn');
        if (timeBtnLists.length > 0) {
            // Lấy cái container bọc các nút thời gian
            let topbarContainer = timeBtnLists[0].parentElement;
            let fxBtnHtml = `
                <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 10px;"></div>
                
                <button id="btn-fx-indicator" class="btn btn-sm" onclick="window.openIndicatorModal()" style="background: transparent; color: #848e9c; border: none; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: 0.2s;" onmouseover="this.style.color='#00F0FF'" onmouseout="this.style.color='#848e9c'">
                    <i class="fas fa-wave-square"></i> Chỉ báo
                </button>
                
                <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 10px;"></div>
                
                <button onclick="window.tvChart.createOverlay('trendLine')" title="Vẽ Trendline" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 13px; transition: 0.2s;" onmouseover="this.style.color='#0ECB81'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-chart-line"></i></button>
                <button onclick="window.tvChart.createOverlay('fibonacciLine')" title="Vẽ Fibonacci" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 13px; transition: 0.2s;" onmouseover="this.style.color='#0ECB81'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-align-center"></i></button>
                <button onclick="window.clearUserDrawings()" title="Xóa hình vẽ" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 13px; transition: 0.2s;" onmouseover="this.style.color='#F6465D'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-trash-alt"></i></button>
            `;
            topbarContainer.insertAdjacentHTML('beforeend', fxBtnHtml);
        }
    }
};

// 3. CÁC HÀM XỬ LÝ SỰ KIỆN CLICK
window.openIndicatorModal = function() {
    let modal = document.getElementById('sc-indicator-modal');
    if (modal) modal.style.display = 'flex';
};

window.addIndicatorToChart = function(indName) {
    if (!window.tvChart) return;
    document.getElementById('sc-indicator-modal').style.display = 'none'; // Tắt Modal đi
    try {
        if (indName === 'EMA') {
            window.tvChart.createIndicator('EMA', true, { id: 'candle_pane' }); // Chèn lên nến
        } else {
            window.tvChart.createIndicator(indName, false, { id: 'pane_' + indName.toLowerCase() }); // Chèn xuống dưới
        }
    } catch (e) {}
};

// Đánh thức hệ thống UI này mỗi khi mở Chart lên
const originalOpenChart = window.openProChart;
window.openProChart = function(t, isTimeSwitch = false) {
    originalOpenChart(t, isTimeSwitch);
    setTimeout(window.initExpertUI, 500); // Chờ KLineChart nạp xong 0.5s rồi mới gắn Menu vào
};