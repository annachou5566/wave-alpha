// 🚀 HYBRID REALTIME ENGINE (BẢN TỐI ƯU HIỆU SUẤT & CHỐNG TRÀN RAM)

// ========================================================

window.caToAlphaIdCache = window.caToAlphaIdCache || {};
window.WAVE_BINANCE_WS_CORE = window.WAVE_BINANCE_WS_CORE || null;
window.FULL_MARKET_DATA = {}; 

// [CẢI TIẾN]: Đưa các biến quản lý vòng lặp và bộ đệm ra Global để dễ kiểm soát, chống đẻ thêm rác
let isRealtimeActive = false;
let layer2Interval = null;
let wsReconnectTimer = null;
let clientPriceBuffer = {};
let bufferProcessInterval = null;
let wsRetryCount = 0; // Đếm số lần thử kết nối lại

function startRealtimeSync() {
    console.log("🟢 Khởi động Hybrid Engine!");
    isRealtimeActive = true;

    fetchLayer2Data();
    if (typeof layer2Interval !== 'undefined' && layer2Interval) clearInterval(layer2Interval);
    layer2Interval = setInterval(fetchLayer2Data, 60000); 

    connectDirectBinanceWS();
}

async function fetchLayer2Data() {
    if (document.hidden) return; 
    try {
        const antiCacheUrl = `${window.REALTIME_API_URL || ''}?t=${Date.now()}`;
        const res = await fetch(antiCacheUrl, {
            method: 'GET' 
        });
        const json = await res.json();
        let actualData = json.data ? json.data : json; 
        
        if (actualData && Object.keys(actualData).length > 0) {
            window.FULL_MARKET_DATA = actualData; 
            
            let volDataOnly = JSON.parse(JSON.stringify(actualData));
            Object.keys(volDataOnly).forEach(k => {
                if(volDataOnly[k].p !== undefined) delete volDataOnly[k].p; 
                if(volDataOnly[k].c !== undefined) delete volDataOnly[k].c; 
            });

            if (typeof applyLayer2Data === 'function') applyLayer2Data(volDataOnly);
        }
    } catch (e) { 
        console.error("Lỗi đồng bộ Layer2:", e); 
    }
}

function connectDirectBinanceWS() {
    // 1. [CẢI TIẾN]: Dọn dẹp kết nối và timer cũ trước khi tạo mới
    if (window.WAVE_BINANCE_WS_CORE && window.WAVE_BINANCE_WS_CORE.readyState !== WebSocket.CLOSED) {
        window.WAVE_BINANCE_WS_CORE.close();
    }
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }

    const wsUrl = String.fromCharCode(119,115,115,58,47,47,110,98,115,116,114,101,97,109,46,98,105,110,97,110,99,101,46,99,111,109,47,119,51,119,47,119,115,97,47,115,116,114,101,97,109);
    window.WAVE_BINANCE_WS_CORE = new WebSocket(wsUrl);

    window.WAVE_BINANCE_WS_CORE.onopen = () => {
        console.log("🟢 [CLIENT] Đã kết nối thẳng Binance WS!");
        wsRetryCount = 0; // Reset biến đếm khi kết nối thành công

        // 2. [CẢI TIẾN]: Reset buffer cũ để tránh làm sai số liệu tính toán của Quant
        clientPriceBuffer = {};

        window.WAVE_BINANCE_WS_CORE.send(JSON.stringify({
            "method": "SUBSCRIBE",
            "params": ["came@allTokens@ticker24"],
            "id": 999
        }));
    };

    window.WAVE_BINANCE_WS_CORE.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.stream === 'came@allTokens@ticker24' && data.data && data.data.d) {
            if(Object.keys(window.caToAlphaIdCache).length === 0 && typeof compList !== 'undefined' && compList.length > 0) {
                compList.forEach(c => {
                    if(c.contract) window.caToAlphaIdCache[c.contract.toLowerCase()] = c.alphaId || `ALPHA_${c.db_id}`;
                });
            }

            data.data.d.forEach(t => {
                const contractStr = String(t.ca).split('@')[0].toLowerCase();
                const alphaId = window.caToAlphaIdCache[contractStr];

                if (alphaId) {
                    clientPriceBuffer[alphaId] = {
                        p: parseFloat(t.p),
                        c: parseFloat(t.pc24)
                    };
                }
            });
        }
    };

    // 3. [CẢI TIẾN]: Chỉ tạo Interval 1 LẦN DUY NHẤT để quét Buffer, không đẻ thêm vòng lặp khi Reconnect
    if (!bufferProcessInterval) {
        bufferProcessInterval = setInterval(() => {
            if (Object.keys(clientPriceBuffer).length > 0 && !document.hidden) {
                if (typeof applyLayer2Data === 'function') applyLayer2Data(clientPriceBuffer, true);
                clientPriceBuffer = {};
            }
        }, 1000);
    }

    // 4. [CẢI TIẾN]: Xử lý Reconnect với Exponential Backoff (1s -> 2s -> 4s -> max 30s) tránh bị ban IP
    window.WAVE_BINANCE_WS_CORE.onclose = () => {
        let delay = Math.min(1000 * Math.pow(2, wsRetryCount), 30000); 
        if (wsRetryCount === 0) delay = 3000; // Giữ nguyên mức 3s cho lần rớt mạng đầu tiên theo đúng thiết kế của bạn
        
        console.warn(`🔴 [CLIENT] Mất kết nối WS. Thử lại sau ${delay/1000}s...`);
        wsRetryCount++;
        wsReconnectTimer = setTimeout(connectDirectBinanceWS, delay);
    };
}

function applyLayer2Data(serverData, forceApply = false) {
    if (!serverData || Object.keys(serverData).length === 0) return;
    if (typeof isHeaderTooltipOpen !== 'undefined' && isHeaderTooltipOpen && !forceApply) { 
        if(typeof pendingRealtimeServerData !== 'undefined') pendingRealtimeServerData = serverData; 
        return; 
    }

    if (typeof compList !== 'undefined' && compList && compList.length > 0) {
        compList.forEach(c => {
            let alphaId = c.alphaId || (c.data && c.data.alphaId) || `ALPHA_${c.db_id}`;
            const liveItem = serverData[alphaId];
            
            if (liveItem) {
                c.cachedPrice = liveItem.p;
                let currentStatus = (c.status || '').toUpperCase();
                let isEnded = false;
                let endStr = c.end_at || c.end || (c.data && c.data.end);
                let endTimeStr = c.endTime || "23:59:59";
                if(endTimeStr.length === 5) endTimeStr += ":00";

                if (c.end_at) { isEnded = Date.now() > new Date(c.end_at).getTime(); } 
                else if (endStr) { let endDateTime = new Date(endStr + 'T' + endTimeStr + 'Z'); isEnded = Date.now() > endDateTime.getTime(); }
                let isFinalized = c.is_finalized || currentStatus === 'ENDED' || currentStatus === 'FINALIZED' || (c.ai_prediction && c.ai_prediction.status_label === 'FINALIZED');
                
                if (isEnded || isFinalized) return;
                
                if (liveItem.v) { c.limit_daily_volume = liveItem.v.dl || 0; c.real_alpha_volume = liveItem.v.dt || 0; }
                let baseTotal = parseFloat(c.base_total_vol || (c.data && c.data.base_total_vol) || 0);
                let baseLimit = parseFloat(c.base_limit_vol || (c.data && c.data.base_limit_vol) || 0);
                c.total_accumulated_volume = baseTotal + (c.real_alpha_volume || 0);
                c.limit_accumulated_volume = baseLimit + (c.limit_daily_volume || 0);
                c.daily_tx_count = liveItem.tx || 0;
                if (liveItem.analysis) c.market_analysis = liveItem.analysis;
                if (liveItem.ai_prediction) c.ai_prediction = liveItem.ai_prediction;
            }
        });
    }

    if(typeof alphaMarketCache === 'undefined') window.alphaMarketCache = {};

    Object.keys(serverData).forEach(key => {
        let liveItem = serverData[key];
        let symbol = liveItem.symbol || key.replace('ALPHA_', ''); 
        if (!alphaMarketCache[symbol]) alphaMarketCache[symbol] = {};
        if (liveItem.p) alphaMarketCache[symbol].price = liveItem.p;
        if (liveItem.v) { 
            alphaMarketCache[symbol].daily_total = liveItem.v.dt; 
            alphaMarketCache[symbol].daily_limit = liveItem.v.dl; 
        }
        if (liveItem.tx) alphaMarketCache[symbol].tx_count = liveItem.tx;
    });

    if (typeof window.updateAlphaMarketUI === 'function') {
        window.updateAlphaMarketUI(serverData);
    }
}

setInterval(() => {
    if (typeof updateGridValuesOnly === 'function') {
        updateGridValuesOnly();
    }
    
    const sonar = typeof ensureSonarGalaxy === 'function' ? ensureSonarGalaxy() : null;
    if (sonar && window.FULL_MARKET_DATA && Object.keys(window.FULL_MARKET_DATA).length > 0) {
        sonar.updateData(window.FULL_MARKET_DATA);
    }
}, 10000);

document.addEventListener('DOMContentLoaded', startRealtimeSync);
