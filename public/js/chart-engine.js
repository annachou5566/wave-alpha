// ==========================================
// 🚀 FILE: chart-engine.js - LÕI XỬ LÝ DỮ LIỆU & WEBSOCKET (V5 - FINAL CSP BYPASS)
// ==========================================

window.chartWs = null;
window.liquidationWs = null;
window.futuresDataInterval = null;
window.isReconnecting = false;
window.currentChartToken = null; 

// Đổi Base URL về thẳng Render để không bị CSP chặn và không bị 404 Proxy
const RENDER_BASE_URL = "https://alpha-realtime.onrender.com";

window.quantStats = {
    whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0,
    priceTrend: 0, trend: 0, drop: 0, spread: 0,
    ofi: 0, zScore: 0, buyDominance: 50,
    longLiq: 0, shortLiq: 0, fundingRateObj: null, hftVerdict: null
};

// ==========================================
// 🌊 ĐỘNG CƠ WATERFALL (NỘI SUY TUYẾN TÍNH HFT KLINECHART)
// ==========================================
window._waTargetCandle = null;
window._waCurrentCandle = null;
window._waRafRunning = false;

window.startWaterfallEngine = function() {
    if (window._waRafRunning || !window.tvChart) return;
    window._waRafRunning = true;
    let lastDraw = 0;

    function renderLoop(time) {
        requestAnimationFrame(renderLoop);
        if (!window.tvChart || !window._waTargetCandle) return;
        
        // 🛡️ BẢO VỆ CPU: Khóa render ở mức 30 FPS (khoảng 30-33ms). 
        if (time - lastDraw < 30) return; 

        let t = window._waTargetCandle;
        let c = window._waCurrentCandle;

        if (!c || c.timestamp !== t.timestamp) {
            window._waCurrentCandle = { ...t };
            window.tvChart.updateData(window._waCurrentCandle);
            lastDraw = time;
            return;
        }

        let diff = t.close - c.close;
        
        if (diff !== 0) {
            c.close += diff * 0.35; // Trượt 35% quãng đường (Tạo cảm giác Waterfall)
            
            c.high = Math.max(c.high, t.high, c.close);
            c.low = Math.min(c.low, t.low, c.close);
            c.volume = t.volume;

            if (Math.abs(t.close - c.close) < (t.close * 0.000001)) {
                c.close = t.close;
            }

            window.tvChart.updateData(c);
            lastDraw = time;
        }
    }
    requestAnimationFrame(renderLoop);
};

// 🧠 BỘ NÃO DYNAMIC: LẤY MASTER LIST TỪ RENDER (LÁCH LUẬT CSP TRÌNH DUYỆT)
window._binanceTokenListCache = null;
window.getSmartTokenContext = async function(t) {
    let alphaId = (t.alphaId || t.id || '').toUpperCase();
    let contract = t.contractAddress || t.contract || '';
    let chainId = t.chainId || t.chain_id;

    if (!chainId || !contract) {
        if (!window._binanceTokenListCache) {
            try {
                // 👉 GỌI VỀ RENDER ĐỂ BYPASS CSP CỦA BINANCE
                let res = await fetch("/api/token-list");
                let json = await res.json();
                if (json.success) window._binanceTokenListCache = json.data;
            } catch(e) {}
        }
        if (window._binanceTokenListCache) {
            let found = window._binanceTokenListCache.find(x => 
                (x.alphaId && x.alphaId.toUpperCase() === alphaId) || 
                (x.symbol && t.symbol && x.symbol.toUpperCase() === t.symbol.toUpperCase())
            );
            if (found) {
                if (!contract) contract = found.contractAddress;
                if (!chainId) chainId = found.chainId;
            }
        }
    }

    t.contractAddress = contract;
    t.chainId = chainId;

    let finalChainId = String(chainId || "56"); 
    let cleanAddr = String(contract || '');
    
    // Thuật toán Case-sensitive bảo vệ TRON/SOLANA (Python Match)
    const no_lower_chains = ["CT_501", "CT_784", "501", "784", "CT_195", "195"];
    if (!no_lower_chains.includes(finalChainId)) {
        cleanAddr = cleanAddr.toLowerCase(); 
    }

    return { contract: cleanAddr, chainId: finalChainId };
};

window.connectRealtimeChart = async function(t, isTimeSwitch = false) {
    let rawId = (t.alphaId || t.id || '').toLowerCase().replace('alpha_', ''); 
    let sysSymbol = (t.symbol || '').toLowerCase() + 'usdt';
    let streamPrefix = rawId ? `alpha_${rawId}usdt` : sysSymbol;

    let smartCtx = await window.getSmartTokenContext(t);
    let contract = smartCtx.contract;
    let chainId = smartCtx.chainId;

    if (isTimeSwitch && window.chartWs && window.chartWs.readyState === 1) { 
        if (window.oldChartInterval && window.oldChartInterval !== 'tick') {
            let oldK = contract ? `came@${contract}@${chainId}@kline_${window.oldChartInterval}` : `${streamPrefix}@kline_${window.oldChartInterval}`;
            window.chartWs.send(JSON.stringify({ "method": "UNSUBSCRIBE", "params": [oldK], "id": Date.now() }));
        }
        if (window.currentChartInterval !== 'tick') {
            let newK = contract ? `came@${contract}@${chainId}@kline_${window.currentChartInterval}` : `${streamPrefix}@kline_${window.currentChartInterval}`;
            window.chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": [newK], "id": Date.now() + 1 }));
        }
        return; 
    }

    if (window.chartWs) window.chartWs.close();

    // 💡 VÁ LỖI: Terminate worker cũ nếu đây là mở chart mới (đổi coin) để tránh Zombie Worker
    if (!isTimeSwitch) {
        if (window.quantWorker) {
            window.quantWorker.terminate();
            window.quantWorker = null;
        }
        window.quantWorker = new Worker('public/js/quant-worker.js');
        window.quantWorker.onmessage = function(e) {
            if (e.data.cmd === 'STATS_UPDATE') {
                Object.assign(window.quantStats, e.data.stats);
            }
        };
    }
    
    // Nếu là đổi khung giờ (isTimeSwitch) hoặc vừa tạo xong, thì reset data
    if (window.quantWorker) {
        window.quantWorker.postMessage({ cmd: 'INIT' });
    }
    window.activeChartSessionId = Date.now() + '_' + t.symbol;
    let currentSession = window.activeChartSessionId;

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
    window.scCWhale = cache.cWhale || 0; window.scCShark = cache.cShark || 0;
    window.scCDolphin = cache.cDolphin || 0; window.scCSweep = cache.cSweep || 0;
    window.quantStats = cache.quantStats || { whaleBuyVol: 0, whaleSellVol: 0, botSweepBuy: 0, botSweepSell: 0, priceTrend: 0 };
    window.scCurrentCluster = null;
    window.scActivePriceLines = []; 

    try { window.chartWs = new WebSocket('wss://nbstream.binance.com/w3w/wsa/stream'); } catch(e) { return; }

    let params = [];
    if (contract) {
        let targetInterval = window.currentChartInterval === 'tick' ? '1s' : window.currentChartInterval;
        
        // 💡 VÁ LỖI: Chỉ subscribe luồng dữ liệu của khung giờ hiện tại
        params.push(`came@${contract}@${chainId}@kline_${targetInterval}`);
        
        // Nếu UI của bạn có tính năng Candle Volume Widget buộc phải dùng khung 1m, thì mới mở dòng dưới đây:
        if (targetInterval !== '1m') {
            params.push(`came@${contract}@${chainId}@kline_1m`); 
        }
    }

    params.push('came@allTokens@ticker24');

    if (rawId) {
        // Quét cả USDT và USDC cho hàng DEX
        const possibleQuotes = ['usdt', 'usdc'];
        possibleQuotes.forEach(quote => {
            let dexStream = `alpha_${rawId}${quote}`;
            params.push(`${dexStream}@aggTrade`, `${dexStream}@bookTicker`, `${dexStream}@fulldepth@500ms`);
            if (!contract) {
                params.push(`${dexStream}@kline_1m`, `${dexStream}@kline_5m`, `${dexStream}@kline_15m`, `${dexStream}@kline_1h`);
                let targetInterval = window.currentChartInterval === 'tick' ? '1s' : window.currentChartInterval;
                let tk = `${dexStream}@kline_${targetInterval}`;
                if (!params.includes(tk)) params.push(tk);
            }
        });
    } else {
        // Hàng CEX bình thường
        params.push(`${streamPrefix}@aggTrade`, `${streamPrefix}@bookTicker`, `${streamPrefix}@fulldepth@500ms`);
        if (!contract) {
            params.push(`${streamPrefix}@kline_1m`, `${streamPrefix}@kline_5m`, `${streamPrefix}@kline_15m`, `${streamPrefix}@kline_1h`);
            if (window.currentChartInterval !== 'tick') {
                let tk = `${streamPrefix}@kline_${window.currentChartInterval}`;
                if (!params.includes(tk)) params.push(tk);
            }
        }
    }

    window._lastMarkerCount = 0; // 💡 Khởi tạo biến đếm marker

    if (window.scCalcInterval) clearInterval(window.scCalcInterval);
    window.scCalcInterval = setInterval(() => {
        if (document.hidden) return; // 💡 VÁ LỖI: Đóng băng tính toán nếu tab bị ẩn
        if (window.activeChartSessionId !== currentSession) return;
        if (!window.scTickHistory || window.scTickHistory.length === 0) return;
        
        const now = Date.now();
        window.scTickHistory = window.scTickHistory.filter(x => now - x.t <= 300000);
        if (window.scTickHistory.length > 3000) window.scTickHistory = window.scTickHistory.slice(-3000);

        // Xóa bỏ tàn tích activeSeries của TradingView, thay bằng window.tvChart của KLineChart
        if (window.tvChart && window.quantStats.flags && window.scTickHistory.length > 0) {
            let flags = window.quantStats.flags;
            let timeSec = Math.floor(Date.now() / 1000);
            let lastMarker = window.scChartMarkers[window.scChartMarkers.length - 1];
            let canDraw = !lastMarker || (timeSec - lastMarker.time > 5);

            if (canDraw) {
                if (flags.stopHunt) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#00F0FF', shape: 'arrowUp', text: '🪝 STOP-HUNT', fishType: 'bot' }); }
                else if (flags.exhausted) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: flags.wallHit ? '#F0B90B' : '#848e9c', shape: 'arrowUp', text: flags.wallHit ? '🛡️ WALL HIT' : '🪫 EXHAUSTED', fishType: 'bot' }); }
                else if (flags.bullishIceberg || flags.icebergAbsorption) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#0ECB81', shape: 'arrowUp', text: '🧊 ĐỠ', fishType: 'bot' }); }
                else if (flags.bearishIceberg) { window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F6465D', shape: 'arrowDown', text: '🧊 ĐÈ', fishType: 'bot' }); }
                else if (flags.spoofingBuyWall) { window.scChartMarkers.push({ time: timeSec, position: 'belowBar', color: '#F0B90B', shape: 'arrowUp', text: '⚠️ TƯỜNG MUA ẢO', fishType: 'bot' }); }
                else if (flags.spoofingSellWall) { window.scChartMarkers.push({ time: timeSec, position: 'aboveBar', color: '#F0B90B', shape: 'arrowDown', text: '⚠️ TƯỜNG BÁN ẢO', fishType: 'bot' }); }
                if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
            }
        }

        let algoEl = document.getElementById('sc-algo-limit');
        if (algoEl && window.quantStats.algoLimit !== undefined) {
            let algoLmt = window.quantStats.algoLimit;
            let limitText = `< $${window.formatCompactUSD(algoLmt)}`;
            let limitColor = '#0ECB81'; let bgColor = 'rgba(14,203,129,0.1)'; let bdColor = 'rgba(14,203,129,0.3)';
            if (algoLmt < 10 || algoLmt < 50) { 
                limitColor = '#F6465D'; limitText = algoLmt < 10 ? '💀 DEAD' : limitText; bgColor = 'rgba(246,70,93,0.1)'; bdColor = 'rgba(246,70,93,0.3)';
            } else if (algoLmt <= 200) { 
                limitColor = '#F0B90B'; bgColor = 'rgba(240,185,11,0.1)'; bdColor = 'rgba(240,185,11,0.3)';
            }
            algoEl.innerHTML = `ALGO LIMIT: ${limitText}`;
            algoEl.style.color = limitColor; algoEl.style.background = bgColor; algoEl.style.borderColor = bdColor;
        }

        if (window.isHeatmapOn && window.scLocalOrderBook && (window.currentChartInterval === 'tick' || window.currentChartInterval === '1s')) {
            let currentAvgTicket = window.scTradeCount > 0 ? (window.scTotalVol / window.scTradeCount) : 1000;
            const processWalls = (orderMap, isAsk) => {
                let walls = [];
                if (orderMap instanceof Map) {
                    for (let [p, vol] of orderMap) { let price = parseFloat(p); let valUSD = price * vol; if (valUSD > 500) walls.push({ p: price, v: valUSD, isAsk: isAsk }); }
                } else {
                    for (let p in orderMap) { let price = parseFloat(p); let valUSD = price * orderMap[p]; if (valUSD > 500) walls.push({ p: price, v: valUSD, isAsk: isAsk }); }
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

                    if (i < window.scActivePriceLines.length) { 
                        // CHỐNG CRASH: Kiểm tra có hàm applyOptions
                        if (window.scActivePriceLines[i] && typeof window.scActivePriceLines[i].applyOptions === 'function') {
                            window.scActivePriceLines[i].applyOptions({ price: wall.p, color: lineColor, lineWidth: thickness }); 
                        }
                    } else {
                        let priceLine = window.tvHeatmapLayer.createPriceLine({ price: wall.p, color: lineColor, lineWidth: thickness, lineStyle: 0, axisLabelVisible: false, title: '' });
                        if (priceLine) window.scActivePriceLines.push(priceLine);
                    }
                }
                for (let i = newWalls.length; i < window.scActivePriceLines.length; i++) { 
                    if (window.scActivePriceLines[i] && typeof window.scActivePriceLines[i].applyOptions === 'function') {
                        window.scActivePriceLines[i].applyOptions({ color: 'transparent' }); 
                    }
                }
            }
        }

        let sym = window.currentChartToken ? window.currentChartToken.symbol : 'UNKNOWN';
        if (window.AlphaChartState && window.AlphaChartState[sym]) {
            Object.assign(window.AlphaChartState[sym], {
                netFlow: window.scNetFlow, whaleCount: window.scWhaleCount, totalVol: window.scTotalVol,
                tradeCount: window.scTradeCount, lastPrice: window.scLastPrice, lastTradeDir: window.scLastTradeDir,
                speedWindow: window.scSpeedWindow, tickHistory: window.scTickHistory, chartMarkers: window.scChartMarkers,
                cWhale: window.scCWhale, cShark: window.scCShark, cDolphin: window.scCDolphin, cSweep: window.scCSweep, quantStats: window.quantStats
            });
        }

        window.scSpeedWindow = window.scSpeedWindow.filter(x => now - x.t <= 5000);

        // 💡 VÁ LỖI: Chỉ chạy vòng lặp Fish Filter NẾU THỰC SỰ có marker mới được thêm vào
        if (typeof window.applyFishFilter === 'function') {
            let currentMarkerCount = (window.scChartMarkers || []).length;
            if (currentMarkerCount !== window._lastMarkerCount) {
                window.applyFishFilter();
                window._lastMarkerCount = currentMarkerCount;
            }
        }
        if (typeof window.updateCommandCenterUI === 'function') window.updateCommandCenterUI();
        
    }, 1000);

    if (window.scTapeInterval) clearInterval(window.scTapeInterval);
    window.scTapeInterval = setInterval(() => {
        if (!window.scCurrentCluster) return;
        const nowMs = Date.now();
        if (nowMs - window.scCurrentCluster.startT >= 150) {
            window.flushSmartTape(window.scCurrentCluster);
            window.scCurrentCluster = null;
        }
    }, 150);

    window.chartWsReconnectDelay = window.chartWsReconnectDelay || 1000;
    window.chartWs.onopen = () => {
        window.chartWsReconnectDelay = 1000; 
        window.chartWs.send(JSON.stringify({ "method": "SUBSCRIBE", "params": params, "id": 1 }));
    };

    window.chartWs.onmessage = (event) => {
        if (window.activeChartSessionId !== currentSession) return;
        const data = JSON.parse(event.data);
        if (!data.stream) return;

        // --- 💡 BẮT ĐẦU: TỰ ĐỘNG CẬP NHẬT ĐÚNG CẶP USDT/USDC ---
        if (window.currentChartToken) {
            let actualStream = data.stream.toUpperCase();
            
            // Binance trả về luồng nào (USDC/USDT), ta lấy luồng đó
            if (actualStream.includes("USDC@") || actualStream.includes("USDT@")) {
                let quote = actualStream.includes("USDC@") ? "USDC" : "USDT";
                let symbolEl = document.getElementById('sc-coin-symbol');
                let realPairName = `${window.currentChartToken.symbol.toUpperCase()}/${quote}`;
                
                // Nếu tên trên web đang bị sai, lập tức sửa lại cho đúng
                if (symbolEl && symbolEl.innerText !== realPairName) {
                    symbolEl.innerText = realPairName;
                    symbolEl.style.color = "#0ECB81"; // Đổi màu xanh nhẹ báo hiệu đã nhận chuẩn cặp
                    setTimeout(() => symbolEl.style.color = "", 1000); 
                }
            }
        }
        // --- KẾT THÚC ĐOẠN TỰ ĐỘNG ĐỔI TÊN ---

        if (data.stream.endsWith('@bookTicker')) {
            if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'BOOK_TICKER', data: data.data });
        }

        if (data.e === 'kline' || data.stream.includes('kline_')) {
            let k = data.data.k || data.data; 
            if (!k) return; 
            
            let streamParts = data.stream.split('kline_');
            let klineInterval = k.i || streamParts[streamParts.length - 1];
            let currentClose = parseFloat(k.c);
            let currentVol = parseFloat(k.q !== undefined ? k.q : (k.v || 0));

            window.scLastPrice = currentClose;
            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl && typeof window.formatPrice === 'function') {
                        let isUp = currentClose >= parseFloat(k.o);
                        priceEl.innerText = '$' + window.formatPrice(currentClose);
                        priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
                    }
                    window.isRenderingPrice = false;
                });
            }

            if (['1m', '5m', '15m', '1h'].includes(klineInterval)) {
                let totalQuote = parseFloat(k.q !== undefined ? k.q : (k.v || 0)); 
                if (isNaN(totalQuote)) totalQuote = 0; 
                let isUpCandle = currentClose >= parseFloat(k.o);
                let nfEl = document.getElementById(`cc-cex-nf-${klineInterval}`);
                if (nfEl && typeof window.formatCompactUSD === 'function') {
                    let color = isUpCandle ? 'var(--term-up)' : 'var(--term-down)';
                    let icon = isUpCandle ? '▲' : '▼';
                    nfEl.innerHTML = `<span style="color:${color}">${icon} $${window.formatCompactUSD(totalQuote)}</span>`;
                }
            }

            // --- BẮT ĐẦU ĐOẠN FAKE TICK CHO DEX ---
            let isTickFallback = (window.currentChartInterval === 'tick' && klineInterval === '1s');
            
            if (klineInterval !== window.currentChartInterval && !isTickFallback) return; 

            if (isTickFallback) {
                let nowT = Date.now();
                if (nowT - (window.lastChartRender || 0) > 150) {
                    window.lastChartRender = nowT;
                    let timeSec = Math.floor(nowT / 1000);
                    
                    if (window.tvChart && typeof window.tvChart.updateData === 'function') {
                        window.tvChart.updateData({
                            timestamp: timeSec * 1000,
                            open: currentClose, high: currentClose, low: currentClose, close: currentClose,
                            volume: currentVol
                        });
                    }
                }
                return; 
            }
            
            if (window.currentChartInterval === 'tick') return; 
            // --- KẾT THÚC ĐOẠN FAKE TICK ---

            let rawTime = k.t || k.ot;
            if (rawTime) {
                let candleTime = Math.floor(rawTime / 1000);
                let isUpCandle = currentClose >= parseFloat(k.o);
                let isTrad = window.currentTheme === 'trad';
                let volColor = isUpCandle ? (isTrad ? 'rgba(14,203,129,0.5)' : 'rgba(42, 245, 146, 0.5)') : (isTrad ? 'rgba(246,70,93,0.5)' : 'rgba(203, 85, 227, 0.5)');

                // Cập nhật nến cho khung 1m trở lên
                // Cập nhật nến cho khung 1m trở lên bằng WATERFALL
                if (window.tvChart && typeof window.tvChart.updateData === 'function' && window.currentChartInterval !== 'tick' && window.currentChartInterval !== '1s') {
                    
                    let rawTk = parseInt(k.t || k.ot);
                    let correctTk = rawTk < 100000000000 ? rawTk * 1000 : rawTk;

                    let dataList = window.tvChart.getDataList();
                    let lastCandle = (dataList && dataList.length > 0) ? dataList[dataList.length - 1] : null;

                    if (lastCandle && lastCandle.timestamp === correctTk && k.x !== true) {
                        // Nếu nến đang chạy, chỉ chốt Volume, giữ nguyên giá Realtime đang trượt
                        if (window._waTargetCandle) {
                            window._waTargetCandle.volume = isNaN(currentVol) ? 0 : currentVol; 
                        }
                    } else {
                        // Khi sang nến mới hoặc chốt sổ: Đẩy thẳng vào KLineChart và Reset Target
                        window._waTargetCandle = {
                            timestamp: correctTk, 
                            open: parseFloat(k.o), 
                            high: parseFloat(k.h), 
                            low: parseFloat(k.l), 
                            close: currentClose, 
                            volume: isNaN(currentVol) ? 0 : currentVol
                        };
                        window.tvChart.updateData(window._waTargetCandle);
                    }
                }
            }
        }
        
        if (data.stream && data.stream.includes('@fulldepth') && data.data) {
            let currentSym = data.data.s || 'UNKNOWN';
            if (!window.scLocalOrderBook || window.scLocalOrderBook.sym !== currentSym) {
                window.scLocalOrderBook = { sym: currentSym, asks: new Map(), bids: new Map() };
            }
            (data.data.a || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.asks.delete(p); else window.scLocalOrderBook.asks.set(p, q); 
            });
            (data.data.b || []).forEach(item => { 
                let p = item[0], q = parseFloat(item[1]); 
                if (q === 0) window.scLocalOrderBook.bids.delete(p); else window.scLocalOrderBook.bids.set(p, q); 
            });
        }
        
        if (data.stream.endsWith('@aggTrade') || data.stream.endsWith('@trade')) {
            let p = parseFloat(data.data.p), q = parseFloat(data.data.q);
            let isUp = p > window.scLastPrice ? true : (p < window.scLastPrice ? false : (window.scLastTradeDir ?? true));
            
            window.scLastTradeDir = isUp; window.scLastPrice = p;
            let valUSD = p * q, timeSec = Math.floor(data.data.T / 1000);
            let nowT = Date.now();

            window.scTickHistory.push({ t: nowT, p: p, q: q, v: valUSD, dir: isUp });
            if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'TICK', data: { t: nowT, p: p, q: q, v: valUSD, dir: isUp } });

            if (window.currentChartInterval === '1s') {
                if (!window.liveCandle1s || window.liveCandle1s.time !== timeSec) {
                    window.liveCandle1s = { time: timeSec, open: p, high: p, low: p, close: p, vol: valUSD };
                } else {
                    window.liveCandle1s.high = Math.max(window.liveCandle1s.high, p);
                    window.liveCandle1s.low = Math.min(window.liveCandle1s.low, p);
                    window.liveCandle1s.close = p;
                    window.liveCandle1s.vol += valUSD;
                }
            }

            // 🌊 ĐẨY DATA VÀO ĐỘNG CƠ WATERFALL THAY VÌ ÉP CHART VẼ TRỰC TIẾP
            if (window.currentChartInterval === 'tick') {
                window._waTargetCandle = { timestamp: timeSec * 1000, open: parseFloat(p), high: parseFloat(p), low: parseFloat(p), close: parseFloat(p), volume: parseFloat(valUSD || 0) };
            } else if (window.currentChartInterval === '1s' && window.liveCandle1s) {
                window._waTargetCandle = { timestamp: timeSec * 1000, open: window.liveCandle1s.open, high: window.liveCandle1s.high, low: window.liveCandle1s.low, close: window.liveCandle1s.close, volume: window.liveCandle1s.vol };
            } else {
                let dataList = window.tvChart ? window.tvChart.getDataList() : [];
                if (dataList && dataList.length > 0) {
                    let lastCandle = dataList[dataList.length - 1];
                    if (!window._waTargetCandle || window._waTargetCandle.timestamp !== lastCandle.timestamp) {
                        window._waTargetCandle = { ...lastCandle };
                    }
                    window._waTargetCandle.high = Math.max(window._waTargetCandle.high, p);
                    window._waTargetCandle.low = Math.min(window._waTargetCandle.low, p);
                    window._waTargetCandle.close = p; // Chỉ gán mục tiêu, không vẽ ngay lập tức
                }
            }
            
            // Kích hoạt động cơ chạy ngầm (Nó sẽ tự động trượt nến cực mượt)
            if (typeof window.startWaterfallEngine === 'function') window.startWaterfallEngine();

            if (!window.isRenderingPrice) {
                window.isRenderingPrice = true;
                requestAnimationFrame(() => {
                    let priceEl = document.getElementById('sc-live-price');
                    if (priceEl && typeof window.formatPrice === 'function') {
                        priceEl.innerText = '$' + window.formatPrice(p);
                        priceEl.className = 'sc-live-price ' + (isUp ? 'price-up' : 'price-down');
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
                    if (typeof window.flushSmartTape === 'function') window.flushSmartTape(window.scCurrentCluster);
                    window.scCurrentCluster = { dir: isUp, vol: valUSD, count: 1, startT: nowT, timeSec: timeSec, p: p, t: data.data.T };
                }
            }

            window.scTradeCount++; window.scTotalVol += valUSD; window.scNetFlow += isUp ? valUSD : -valUSD;
            if (window.scSpeedWindow.length > 500) window.scSpeedWindow.shift(); 
            window.scSpeedWindow.push({ t: nowT, v: valUSD });
        }
    };
            
    window.chartWs.onclose = () => { 
        let overlay = document.getElementById('super-chart-overlay');
        if (overlay && overlay.classList.contains('active')) { 
            const jitter = Math.random() * 1000;
            setTimeout(() => window.connectRealtimeChart(window.currentChartToken), window.chartWsReconnectDelay + jitter);
            window.chartWsReconnectDelay = Math.min(window.chartWsReconnectDelay * 2, 30000);
        } 
    };
};

window.fetchBinanceHistory = async function(t, interval, isArea = false) {
    try {
        let limit = isArea ? 100 : 300; 
        let smartCtx = await window.getSmartTokenContext(t);
        let contract = smartCtx.contract;
        let chainId = smartCtx.chainId;
        if (!contract) return []; 
        
        let apiInterval = interval === 'tick' ? '1s' : interval;
        let apiUrl = `/api/klines?contract=${contract}&chainId=${chainId}&interval=${apiInterval}&limit=${limit}`;
        
        const res = await fetch(apiUrl);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || data.length === 0) return [];

        return data.map(d => {
            // 🛑 FIX LỖI 1970 TẠI ĐÂY: Nếu là giây (10 số) thì nhân 1000 thành mili-giây
            let rawTs = parseInt(d.time || d.t || d[0]);
            let correctTs = rawTs < 100000000000 ? rawTs * 1000 : rawTs;

            return {
                timestamp: correctTs, 
                open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close),
                volume: parseFloat(d.volume)
            };
        });
    } catch (e) { return []; }
};

const originalFetch = window.fetch;
window.fetch = async function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('/api/smart-money')) {
        if (window.currentChartToken) {
            let smartCtx = await window.getSmartTokenContext(window.currentChartToken);
            // CẬP NHẬT RENDER URL ĐỂ VƯỢT CSP
            args[0] = `/api/smart-money?contractAddress=${smartCtx.contract}&chainId=${smartCtx.chainId}`;
        }
    }
    return originalFetch.apply(this, args);
};

window.startFuturesEngine = async function(symbol) {
    window.stopFuturesEngine();
    if (!symbol) return;
    window.activeFuturesSession = symbol.toUpperCase();
    let currentSession = window.activeFuturesSession;
    let cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    let fSymbol = cleanSymbol + 'USDT';
    let streamSymbol = fSymbol.toLowerCase();

    if (!window.quantStats) window.quantStats = {};
    window.quantStats.longLiq = 0; window.quantStats.shortLiq = 0; 
    window.quantStats.fundingRateObj = null; window.quantStats.fundingInterval = null;

    // =========================================================
    // 1. KẾT NỐI WEBSOCKET THANH LÝ NGAY LẬP TỨC (REALTIME)
    // =========================================================
    let liqReconnectDelay = 1000; const MAX_LIQ_DELAY = 30000; 

    const connectForceOrderWS = () => {
        if (window.activeFuturesSession !== currentSession) return;
        window.liquidationWs = new WebSocket(`wss://fstream.binance.com/ws/${streamSymbol}@forceOrder`);
        window.liquidationWs.onopen = () => { liqReconnectDelay = 1000; };
        
        window.liquidationWs.onmessage = (event) => {
            if (window.activeFuturesSession !== currentSession) return;
            const data = JSON.parse(event.data);
            if (data.e === 'forceOrder' && data.o) {
                let order = data.o; 
                let valUSD = parseFloat(order.p) * parseFloat(order.q); 
                let isLongLiq = (order.S === 'SELL'); // SELL = Long bị cháy
                
                // 🛑 CHẶN LỖI LẶP LỆNH NGAY TỪ CỬA NGÕ WEBSOCKET
                let liqSig = `${order.S}_${order.p}_${order.q}`;
                let nowMs = Date.now();
                if (!window.lastRootLiqEvent) window.lastRootLiqEvent = { sig: '', time: 0 };
                if (window.lastRootLiqEvent.sig === liqSig && (nowMs - window.lastRootLiqEvent.time < 2000)) {
                    return; // Bị trùng -> Chặn đứng luôn, không cho vẽ chart hay cộng tiền
                }
                window.lastRootLiqEvent = { sig: liqSig, time: nowMs };

                if (isLongLiq) { window.quantStats.longLiq += valUSD; } else { window.quantStats.shortLiq += valUSD; }
                if (window.quantWorker) window.quantWorker.postMessage({ cmd: 'LIQ_EVENT', data: { v: valUSD, dir: order.S, p: parseFloat(order.p) } });
                
                if (typeof window.logToSniperTape === 'function') {
                    window.logToSniperTape(!isLongLiq, valUSD, isLongLiq ? '🩸 CHÁY LONG' : '🔥 CHÁY SHORT', parseFloat(order.p));
                }

                // TÍCH HỢP MỚI: BẮN MARKER THANH LÝ LÊN CHART TRADINGVIEW
                if (window.scChartMarkers) {
                    let markerTime = Math.floor(Date.now() / 1000);
                    
                    let shortVol = valUSD >= 1e9 ? (valUSD/1e9).toFixed(1) + 'B' : (valUSD >= 1e6 ? (valUSD/1e6).toFixed(1) + 'M' : (valUSD >= 1e3 ? (valUSD/1e3).toFixed(1) + 'K' : valUSD.toFixed(0)));
                    
                    let textMsg = (isLongLiq ? '🩸 L $' : '💥 S $') + shortVol;
                    
                    window.scChartMarkers.push({
                        time: markerTime,
                        position: isLongLiq ? 'belowBar' : 'aboveBar',
                        color: isLongLiq ? '#FF007F' : '#00F0FF',
                        shape: isLongLiq ? 'arrowUp' : 'arrowDown',
                        text: textMsg,
                        fishType: 'liq' 
                    });
                    
                    if (window.scChartMarkers.length > 50) window.scChartMarkers.shift();
                    if (typeof window.applyFishFilter === 'function') window.applyFishFilter();
                }
            }
        };
        
        window.liquidationWs.onclose = () => { 
            if (window.activeFuturesSession === currentSession) {
                const jitter = Math.random() * 1000; 
                setTimeout(() => connectForceOrderWS(), liqReconnectDelay + jitter);
                liqReconnectDelay = Math.min(liqReconnectDelay * 2, MAX_LIQ_DELAY); 
            } 
        };
    };
    
    connectForceOrderWS();

    // =========================================================
    // 2. CHẠY API LẤY DỮ LIỆU TĨNH (VỐN MỒI + FUNDING/OI)
    // =========================================================
    const fetchWithTimeout = async (url) => {
        const controller = new AbortController(); const id = setTimeout(() => controller.abort(), 4000);
        try { const response = await fetch(url, { signal: controller.signal }); clearTimeout(id); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); } catch (err) { clearTimeout(id); throw err; }
    };

    const fetchRestData = async () => {
        if (window.activeFuturesSession !== currentSession) return false;
        try {
            // Đã xóa bỏ phần gọi API allForceOrders vì Binance đã khai tử tính năng này từ 2021.
            // Số liệu thanh lý giờ đây sẽ chỉ được đếm Realtime thông qua Websocket.

            if (!window.quantStats.fundingInterval) {
                try { 
                    let fInfo = await fetchWithTimeout(`${RENDER_BASE_URL}/api/binance-fapi?endpoint=/fapi/v1/fundingInfo`); 
                    let sInfo = fInfo.find(x => x.symbol === fSymbol); 
                    window.quantStats.fundingInterval = sInfo ? sInfo.fundingIntervalHours : 8; 
                } catch(e) { window.quantStats.fundingInterval = 8; }
            }
            
            let endpointFund = encodeURIComponent(`/fapi/v1/premiumIndex?symbol=${fSymbol}`);
            let fundData = await fetchWithTimeout(`${RENDER_BASE_URL}/api/binance-fapi?endpoint=${endpointFund}`);
            if (window.activeFuturesSession !== currentSession) return false;
            if (fundData && fundData.lastFundingRate) {
                window.quantStats.fundingRateObj = { rate: parseFloat(fundData.lastFundingRate) * 100, nextTime: fundData.nextFundingTime, interval: window.quantStats.fundingInterval };
            }
            
            try {
                let endpointOI = encodeURIComponent(`/fapi/v1/openInterest?symbol=${fSymbol}`);
                let oiData = await fetchWithTimeout(`${RENDER_BASE_URL}/api/binance-fapi?endpoint=${endpointOI}`);
                if (window.activeFuturesSession === currentSession && oiData && oiData.openInterest) {
                    window.quantStats.openInterest = parseFloat(oiData.openInterest);
                }
            } catch(e) {}

            return true;
        } catch (err) { return false; }
    };

    // Gọi lần đầu để lấy Funding/OI, sau đó lặp lại ngầm mỗi 15s
    fetchRestData().then(hasFutures => {
        if (hasFutures && window.activeFuturesSession === currentSession) {
            window.futuresDataInterval = setInterval(() => { if (window.activeFuturesSession === currentSession) fetchRestData(); }, 15000);
        }
    });
};

window.stopFuturesEngine = function() {
    window.activeFuturesSession = null;
    if (window.futuresDataInterval) { clearInterval(window.futuresDataInterval); window.futuresDataInterval = null; }
    if (window.liquidationWs) { window.liquidationWs.close(); window.liquidationWs = null; }
};

window.computeSqueezeZone = function() {
    if (!window.quantStats) return { confirmed: false };
    const liqLong  = window.quantStats.longLiq  || 0;
    const liqShort = window.quantStats.shortLiq || 0;
    const flags    = window.quantStats.flags    || {};
    const ofi      = window.quantStats.ofi      || 0;
    const zScore   = window.quantStats.zScore   || 0;
    const SQUEEZE_LIQ_THRESHOLD = 10000;
    let confirmed = false; let side = null; let strength = 0;

    if (liqLong > SQUEEZE_LIQ_THRESHOLD && flags.stopHunt && ofi > 0.2) {
        confirmed = true; side = 'short'; strength = Math.min(1, (liqLong / (SQUEEZE_LIQ_THRESHOLD * 5)) * (ofi + 0.2) * (zScore > 1.5 ? 1.3 : 1));
    } else if (liqShort > SQUEEZE_LIQ_THRESHOLD && flags.exhausted && ofi < -0.2) {
        confirmed = true; side = 'long'; strength = Math.min(1, (liqShort / (SQUEEZE_LIQ_THRESHOLD * 5)) * (Math.abs(ofi) + 0.2));
    }
    window.quantStats.squeezeZone = { confirmed, side, strength };
    return window.quantStats.squeezeZone;
};

const _verdictCache = { hft_html: null, hft_css: null, mft_html: null, mft_css: null, lft_html: null, lft_css: null };
let _verdictRafPending = false; let _legacyFlagsBitmaskCache = -1;

function encodeFlagsBitmask(flags) {
    if (!flags) return 0;
    return (flags.liquidityVacuum ? 1 : 0) | (flags.spoofingBuyWall ? 2 : 0) | (flags.spoofingSellWall ? 4 : 0) | (flags.bullishIceberg ? 8 : 0) | (flags.bearishIceberg ? 16 : 0) | (flags.icebergAbsorption ? 32 : 0) | (flags.exhausted ? 64 : 0) | (flags.stopHunt ? 128 : 0) | (flags.wallHit ? 256 : 0) | (flags.washTrading ? 512 : 0) | (flags.zoneAbsorptionBottom ? 1024 : 0) | (flags.zoneDistributionTop ? 2048 : 0) | (flags.spotTop ? 4096 : 0);
}

function scheduleVerdictRender(hft, mft, lft, flags) {
    const hftChanged = hft && (hft.html !== _verdictCache.hft_html || hft.css !== _verdictCache.hft_css);
    const mftChanged = mft && (mft.html !== _verdictCache.mft_html || mft.css !== _verdictCache.mft_css);
    const lftChanged = lft && (lft.html !== _verdictCache.lft_html || lft.css !== _verdictCache.lft_css);
    const newBitmask = encodeFlagsBitmask(flags); const flagsChanged = newBitmask !== _legacyFlagsBitmaskCache;

    if (!hftChanged && !mftChanged && !lftChanged && !flagsChanged) return;
    if (_verdictRafPending) return;
    _verdictRafPending = true;
    requestAnimationFrame(() => {
        _verdictRafPending = false;
        if (flagsChanged) _legacyFlagsBitmaskCache = newBitmask;
        if (hftChanged && hft) { let el = document.getElementById('verdict-hft'); if (el) { el.innerHTML = hft.html; el.style.cssText = hft.css; } _verdictCache.hft_html = hft.html; _verdictCache.hft_css = hft.css; }
        if (mftChanged && mft) { let el = document.getElementById('verdict-mft'); if (el) { el.innerHTML = mft.html; el.style.cssText = mft.css; } _verdictCache.mft_html = mft.html; _verdictCache.mft_css = mft.css; }
        if (lftChanged && lft) { let el = document.getElementById('verdict-lft'); if (el) { el.innerHTML = lft.html; el.style.cssText = lft.css; } _verdictCache.lft_html = lft.html; _verdictCache.lft_css = lft.css; }
    });
}

window.evaluateQuantVerdict = function() {
    if (!window.quantStats) return;
    let q = window.quantStats; let flags = q.flags || {};
    if (q.hftVerdict) {
        let wBuy = q.whaleBuyVol || 0; let wSell = q.whaleSellVol || 0; let ofi = q.ofi || 0; let trend = q.trend || 0;
        if ((flags.spoofingSellWall || flags.bearishIceberg) && ofi > 0.2 && wBuy > wSell && trend > 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[⚡ ĐẨY]</b> 🚀 MM MARKUP`; q.hftVerdict.color = '#00F0FF'; q.hftVerdict.bg = 'rgba(0, 240, 255, 0.15)';
        } else if (flags.spoofingBuyWall && ofi < -0.2 && wSell > wBuy && trend < 0) {
            q.hftVerdict.html = `<b style="opacity:0.8; margin-right:4px;">[🩸 XẢ]</b> 🩸 MM MARKDOWN`; q.hftVerdict.color = '#FF007F'; q.hftVerdict.bg = 'rgba(255, 0, 127, 0.15)';
        }
    }
    let hftObj = { html: "⚡ ĐANG KHỞI ĐỘNG TICK...", css: "font-size: 9.5px; background: rgba(0, 240, 255, 0.1); padding: 3px 6px; border-radius: 3px; color: #00F0FF; border: 1px solid rgba(0, 240, 255, 0.2); white-space: nowrap;" };
    if (q.hftVerdict) { let v = q.hftVerdict; hftObj.html = v.html; hftObj.css = `font-size: 9.5px; background: ${v.bg}; padding: 3px 6px; border-radius: 3px; color: ${v.color}; border: 1px solid ${v.color}; white-space: nowrap;`; }
    
    let cvd1hTag = document.getElementById('sm-tag-1h') ? document.getElementById('sm-tag-1h').innerText.toUpperCase() : '';
    let cvd4hTag = document.getElementById('sm-tag-4h') ? document.getElementById('sm-tag-4h').innerText.toUpperCase() : '';
    let fFunding = q.fundingRateObj ? q.fundingRateObj.rate : (q.fundingRate || 0);
    let liqLong = q.longLiq || 0; let liqShort = q.shortLiq || 0; let totalLiq = liqLong + liqShort;

    let spotScore = 0;
    if (cvd1hTag.includes('BULLISH')) spotScore += 0.5; else if (cvd1hTag.includes('BEARISH')) spotScore -= 0.5;
    if (cvd4hTag.includes('BULLISH')) spotScore += 0.5; else if (cvd4hTag.includes('BEARISH')) spotScore -= 0.5;

    let futuresScore = 0; let hasFutures = Math.abs(fFunding) > 0 || totalLiq > 0;
    if (hasFutures) {
        if (fFunding < -0.005) futuresScore += 0.5; else if (fFunding > 0.005) futuresScore -= 0.5;
        if (totalLiq > 5000) { let liqRatio = liqShort / totalLiq; if (liqRatio > 0.65) futuresScore += 0.5; else if (liqRatio < 0.35) futuresScore -= 0.5; }
    }

    let finalMftScore = hasFutures ? (spotScore * 0.4) + (futuresScore * 0.6) : (spotScore * 1.0);
    let mftMsg = '⚖️ ĐI NGANG TRUNG HẠN'; let mftColor = '#848e9c'; let mftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalMftScore >= 0.6) { mftMsg = hasFutures ? '🔥 SHORT SQUEEZE (STRONG BUY)' : '🔥 LỰC MUA CỰC MẠNH'; mftColor = '#00F0FF'; mftBg = 'rgba(0, 240, 255, 0.1)'; } 
    else if (finalMftScore >= 0.25) { mftMsg = '📈 ĐỘNG LƯỢNG TĂNG (BUY)'; mftColor = '#0ECB81'; mftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalMftScore <= -0.6) { mftMsg = hasFutures ? '🩸 LONG CASCADE (STRONG SELL)' : '🩸 LỰC XẢ CỰC MẠNH'; mftColor = '#FF007F'; mftBg = 'rgba(255, 0, 127, 0.1)'; } 
    else if (finalMftScore <= -0.25) { mftMsg = '📉 ÁP LỰC GIẢM (SELL)'; mftColor = '#F6465D'; mftBg = 'rgba(246, 70, 93, 0.1)'; }
    let mftObj = { html: mftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${mftColor}; background: ${mftBg}; white-space: nowrap;` };

    let smBadge = document.getElementById('sm-verdict-badge'); let smTag = smBadge ? smBadge.innerText.toUpperCase() : '';
    let unlockStr = document.getElementById('sm-unlock-pct') ? document.getElementById('sm-unlock-pct').innerText : '100%'; let unlockPct = parseFloat(unlockStr) || 100;
    let smScore = 0; if (smTag.includes('CÁ MẬP GOM') || smTag.includes('BULLISH')) smScore = 1.0; else if (smTag.includes('BOT KIỂM SOÁT') || smTag.includes('BEARISH') || smTag.includes('XẢ')) smScore = -1.0;
    let tokenomicsScore = 0; if (unlockPct < 30) tokenomicsScore = -1.0; else if (unlockPct >= 50) tokenomicsScore = 0.5; else if (unlockPct >= 80) tokenomicsScore = 1.0;
    let finalLftScore = (smScore * 0.75) + (tokenomicsScore * 0.25);
    let lftMsg = '⚖️ TRUNG LẬP VĨ MÔ'; let lftColor = '#848e9c'; let lftBg = 'rgba(255, 255, 255, 0.05)';
    if (finalLftScore >= 0.5) { lftMsg = '💎 TÍCH LŨY VĨ MÔ (MACRO BULL)'; lftColor = '#0ECB81'; lftBg = 'rgba(14, 203, 129, 0.1)'; } 
    else if (finalLftScore <= -0.5) { lftMsg = '⚠️ RỦI RO PHÂN PHỐI (MACRO BEAR)'; lftColor = '#FF007F'; lftBg = 'rgba(255, 0, 127, 0.1)'; }
    let lftObj = { html: lftMsg, css: `font-size: 10px; padding: 2px 4px; border-radius: 2px; color: ${lftColor}; background: ${lftBg}; white-space: nowrap;` };

    scheduleVerdictRender(hftObj, mftObj, lftObj, q.flags);
};
