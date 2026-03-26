/**
 * =================================================================
 * 🧠 QUANT WORKER V6.0 - INSTITUTIONAL ULTRA-HFT ENGINE
 * =================================================================
 * - Cont-Stoikov OFI (Order Flow Imbalance) approximation
 * - Welford's Online Algorithm for EMA & Variance
 * - Adaptive Thresholds (Gia tốc giá)
 * - Zero-GC Architecture (Không array push/shift liên tục)
 * - Storyteller Engine with 5-Second Signal Persistence
 */

const ALPHA_1S = 2 / (10 + 1); 
const ALPHA_3S = 2 / (30 + 1);
const ALPHA_15S = 2 / (150 + 1);
const ALPHA_60S = 2 / (600 + 1); 

let state = {
    lastBid: 0, lastAsk: 0, 
    lastBidVol: 0, lastAskVol: 0,
    microPrice: 0, midPrice: 0, spread: 0,
    emaSpread: 0, varSpread: 0, emaDepth: 0,
    
    ofi15s: 0, // Chuẩn hóa dòng chảy lệnh
    emaTakerBuy: 0, varTakerBuy: 0,
    emaTakerSell: 0, varTakerSell: 0,
    
    microCVD: 0, lastPrice: 0, maxPrice5m: 0, minPrice5m: 9999999999,
    emaPriceFast: 0, emaPriceSlow: 0, currentSpeed: 0, emaSpeed60s: 0,
    zScore: 0, algoLimit: 20, buyDominance: 50, trend: 0, drop: 0,

    // BỘ ĐỆM STORYTELLER (SIGNAL PERSISTENCE)
    verdictLockTime: 0,
    hftVerdict: null,

    flags: {
        liquidityVacuum: false, spoofingDetected: false, washTrading: false,
        zoneAbsorptionBottom: false, zoneDistributionTop: false, icebergAbsorption: false
    },
    timers: { absorption: 0, distribution: 0, wash: 0, vacuum: 0, spoofing: 0, iceberg: 0 }
};

function initEngine() {
    for (let key in state) {
        if (typeof state[key] === 'number') state[key] = 0;
    }
    state.minPrice5m = 9999999999;
    state.algoLimit = 20;
    state.buyDominance = 50;
    state.verdictLockTime = 0;
    state.hftVerdict = null;
    state.flags = { 
        liquidityVacuum: false, spoofingDetected: false, washTrading: false, 
        zoneAbsorptionBottom: false, zoneDistributionTop: false, icebergAbsorption: false 
    };
    state.timers = { absorption: 0, distribution: 0, wash: 0, vacuum: 0, spoofing: 0, iceberg: 0 };
}

// Lõi Welford cho Phương sai (Chống tràn bộ nhớ, Không dùng Mảng)
function updateWelford(val, ema, variance, alpha) {
    let diff = val - ema;
    let newEma = ema + alpha * diff;
    let newVar = (1 - alpha) * (variance + alpha * diff * diff);
    return { e: newEma, v: newVar };
}

// Logic Đánh giá HFT & Kể chuyện Market Maker (Lock 5 giây)
function evaluateStoryteller(now) {
    // Nếu đang trong thời gian khóa Signal quan trọng, giữ nguyên UI
    if (now < state.verdictLockTime && state.hftVerdict) {
        return state.hftVerdict;
    }

    let z = state.zScore;
    let buyDom = state.buyDominance;
    let drop = state.drop;
    let trend = state.trend;
    let speed = state.currentSpeed;
    let avgSpeed = state.emaSpeed60s;
    let ofi = state.ofi15s;

    // Phân tích nhịp độ (Pace)
    let pace = "[🚶 CHẬM]";
    if (speed > avgSpeed * 3 && avgSpeed > 1000) pace = "[⚡ KÍCH ĐỘNG]";
    else if (speed > avgSpeed * 1.5 && avgSpeed > 1000) pace = "[🔥 SÔI ĐỘNG]";

    let msg = "⚖️ ĐANG GIẰNG CO (Sideo)";
    let color = "#848e9c";
    let bg = "rgba(255, 255, 255, 0.05)";
    let priority = 0; // Trọng số khóa Signal

    // Động cơ kể chuyện MM (Market Maker)
    if (buyDom < 35 || z < -2.5 || drop < -0.5) {
        msg = "🩸 FLASH DUMP (XẢ THẲNG TAY)";
        color = "#FF007F"; bg = "rgba(255, 0, 127, 0.15)";
        priority = 5;
    } else if (buyDom > 65 || z > 2.5) {
        msg = "🚀 MARKET PUMP (BƠM QUYẾT LIỆT)";
        color = "#00F0FF"; bg = "rgba(0, 240, 255, 0.15)";
        priority = 5;
    } else if (state.flags.icebergAbsorption) {
        msg = "🧊 ICEBERG ABSORPTION (ĐỠ GIÁ NGẦM)";
        color = "#0ECB81"; bg = "rgba(14, 203, 129, 0.15)";
        priority = 4;
    } else if (state.flags.spoofingDetected) {
        msg = "⚠️ SPOOFING DETECTED (TƯỜNG ẢO)";
        color = "#F0B90B"; bg = "rgba(240, 185, 11, 0.15)";
        priority = 4;
    } else if (buyDom < 45 || trend < -0.1) {
        msg = "📉 ÁP LỰC BÁN LỚN (Sell Dominant)";
        color = "#F6465D"; bg = "rgba(246, 70, 93, 0.15)";
        priority = 2;
    } else if (buyDom > 55 || trend > 0.1) {
        msg = "📈 LỰC MUA CHỦ ĐỘNG (Buy Dominant)";
        color = "#0ECB81"; bg = "rgba(14, 203, 129, 0.15)";
        priority = 2;
    } else if (ofi > 0.4 && z > 1.2) {
        msg = "🟢 MUA CHỦ ĐỘNG TĂNG DẦN";
        color = "#2af592"; bg = "rgba(42, 245, 146, 0.1)";
        priority = 1;
    } else if (ofi < -0.4 && z < -1.2) {
        msg = "🔴 BÁN CHỦ ĐỘNG TĂNG DẦN";
        color = "#F6465D"; bg = "rgba(246, 70, 93, 0.1)";
        priority = 1;
    }

    let verdict = {
        html: `<b style="opacity:0.8; margin-right:4px;">${pace}</b> ${msg}`,
        color: color,
        bg: bg
    };

    // Áp dụng Lock-Time dựa trên Priority
    if (priority >= 4) {
        state.verdictLockTime = now + 5000; // Khóa tĩnh UI 5 giây với tín hiệu mạnh
    } else if (priority >= 2) {
        state.verdictLockTime = now + 2000; // Khóa 2 giây
    }
    
    state.hftVerdict = verdict;
    return verdict;
}

self.onmessage = function(e) {
    const msg = e.data;
    const now = Date.now();

    if (msg.cmd === 'INIT') {
        initEngine();
    } 
    else if (msg.cmd === 'BOOK_TICKER' || msg.cmd === 'BOOKTICKER') {
        const b = Number(msg.data.b); 
        const B = Number(msg.data.B) || 0; 
        const a = Number(msg.data.a); 
        const A = Number(msg.data.A) || 0; 

        if (!b || !a || b <= 0 || a < b) return; 
        
        let rawSpread = ((a - b) / b) * 100;
        if (rawSpread > 10) return; 

        const totalDepth = B + A;
        state.microPrice = totalDepth > 0 ? (b * A + a * B) / totalDepth : (b + a) / 2;
        state.midPrice = (b + a) / 2;
        state.spread = rawSpread;

        let spStats = updateWelford(state.spread, state.emaSpread, state.varSpread, ALPHA_3S);
        state.emaSpread = spStats.e; 
        state.varSpread = spStats.v;
        
        state.emaDepth = state.emaDepth * (1 - ALPHA_3S) + totalDepth * ALPHA_3S;

        // ==========================================
        // Cont-Stoikov OFI Approximation Core
        // ==========================================
        let e_bid = 0;
        if (b > state.lastBid) e_bid = B;
        else if (b === state.lastBid) e_bid = B - state.lastBidVol;
        else e_bid = -state.lastBidVol;

        let e_ask = 0;
        if (a < state.lastAsk) e_ask = A;
        else if (a === state.lastAsk) e_ask = A - state.lastAskVol;
        else e_ask = -state.lastAskVol;

        // Chuẩn hóa OFI [-1, 1] ngăn chặn nhiễu rác
        let rawOFI = (e_bid - e_ask) / (totalDepth > 0 ? totalDepth : 1);
        rawOFI = Math.max(-1, Math.min(1, rawOFI));
        state.ofi15s = state.ofi15s * (1 - ALPHA_15S) + rawOFI * ALPHA_15S;

        // Radar Spoofing: Orderbook mất cân bằng nhưng giá đi ngược lại
        if (state.ofi15s > 0.8 && state.trend < -0.05) {
            state.flags.spoofingDetected = true;
            state.timers.spoofing = now;
        } else if (state.ofi15s < -0.8 && state.trend > 0.05) {
            state.flags.spoofingDetected = true;
            state.timers.spoofing = now;
        } else if (now - state.timers.spoofing > 5000) {
            state.flags.spoofingDetected = false;
        }

        state.lastBid = b; state.lastAsk = a;
        state.lastBidVol = B; state.lastAskVol = A;

        let spreadZScore = state.varSpread > 0 ? (state.spread - state.emaSpread) / Math.sqrt(state.varSpread) : 0;
        if (spreadZScore > 3.0 && totalDepth < state.emaDepth * 0.5) {
            state.flags.liquidityVacuum = true;
            state.timers.vacuum = now;
        } else if (now - state.timers.vacuum > 5000) {
            state.flags.liquidityVacuum = false;
        }
    }
    else if (msg.cmd === 'TICK') {
        const vUSD = Number(msg.data.v) || (Number(msg.data.p) * Number(msg.data.q)); 
        const isBuy = msg.data.dir;          
        const p = Number(msg.data.p);    

        state.microCVD += isBuy ? vUSD : -vUSD;
        state.currentSpeed += vUSD; 
        state.emaSpeed60s = state.emaSpeed60s * (1 - ALPHA_60S) + vUSD * ALPHA_60S * 10; 
        
        let currentBuy = isBuy ? vUSD : 0;
        let currentSell = isBuy ? 0 : vUSD;

        let bStats = updateWelford(currentBuy, state.emaTakerBuy, state.varTakerBuy, ALPHA_3S);
        state.emaTakerBuy = bStats.e; 
        state.varTakerBuy = bStats.v;
        
        let sStats = updateWelford(currentSell, state.emaTakerSell, state.varTakerSell, ALPHA_3S);
        state.emaTakerSell = sStats.e; 
        state.varTakerSell = sStats.v;

        let zBuy = state.varTakerBuy > 0 ? (currentBuy - state.emaTakerBuy) / Math.sqrt(state.varTakerBuy) : 0;
        let zSell = state.varTakerSell > 0 ? (currentSell - state.emaTakerSell) / Math.sqrt(state.varTakerSell) : 0;

        state.zScore = isBuy ? zBuy : -zSell;

        let totalEMA = state.emaTakerBuy + state.emaTakerSell;
        state.buyDominance = totalEMA > 0 ? (state.emaTakerBuy / totalEMA) * 100 : 50;

        let baseLimit = state.emaSpeed60s * 0.4;
        state.algoLimit = Math.max(20, Math.round(baseLimit));

        state.emaPriceFast = state.emaPriceFast === 0 ? p : state.emaPriceFast * (1 - ALPHA_3S) + p * ALPHA_3S;
        state.emaPriceSlow = state.emaPriceSlow === 0 ? p : state.emaPriceSlow * (1 - ALPHA_60S) + p * ALPHA_60S;
        state.trend = state.emaPriceSlow > 0 ? ((state.emaPriceFast - state.emaPriceSlow) / state.emaPriceSlow) * 100 : 0;

        if (p > state.maxPrice5m) state.maxPrice5m = p;
        if (p < state.minPrice5m) state.minPrice5m = p;
        state.drop = state.maxPrice5m > 0 ? ((p - state.maxPrice5m) / state.maxPrice5m) * 100 : 0;

        // Iceberg Detection: Volume khủng nhưng giá bị neo cứng
        let priceRange = (state.maxPrice5m - state.minPrice5m) / state.minPrice5m;
        if (vUSD > state.algoLimit * 5 && priceRange < 0.005) {
            state.flags.icebergAbsorption = true;
            state.timers.iceberg = now;
        } else if (now - state.timers.iceberg > 5000) {
            state.flags.icebergAbsorption = false;
        }

        // Radar Bắt Đáy / Đỉnh với Adaptive Z-Score
        if (zSell > 2.0 && p >= state.lastPrice && state.ofi15s > -0.2) {
            state.flags.zoneAbsorptionBottom = true;
            state.timers.absorption = now; 
        } else if (now - state.timers.absorption > 5000) {
            state.flags.zoneAbsorptionBottom = false; 
        }

        if (zBuy > 2.5 && p <= state.lastPrice && state.ofi15s < 0.2) {
            state.flags.zoneDistributionTop = true;
            state.timers.distribution = now;
        } else if (now - state.timers.distribution > 5000) {
            state.flags.zoneDistributionTop = false;
        }
        
        if ((zBuy > 1.5 || zSell > 1.5) && Math.abs(state.microCVD) < vUSD * 0.2 && p === state.lastPrice) {
            state.flags.washTrading = true;
            state.timers.wash = now;
        } else if (now - state.timers.wash > 5000) {
            state.flags.washTrading = false;
        }

        state.lastPrice = p;
    }
    else if (msg.cmd === 'FULLDEPTH') {
        state.flags.spoofingDetected = false; 
    }
};

setInterval(() => {
    const now = Date.now();
    evaluateStoryteller(now); // Engine tính toán Verdict với Persistent Lock

    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread: state.spread || 0,
            trend: state.trend || 0,
            drop: state.drop || 0,
            ofi: state.ofi15s || 0,
            zScore: state.zScore || 0,
            currentSpeed: state.currentSpeed || 0,
            algoLimit: state.algoLimit || 0,
            avgSpeed60s: state.emaSpeed60s || 0,
            buyDominance: state.buyDominance || 50,
            microCVD: state.microCVD || 0,
            flags: state.flags,
            hftVerdict: state.hftVerdict // Gửi Output UI trực tiếp lên Frontend
        }
    });
    
    state.currentSpeed = 0;
    // Tự động Decay min/max (Khử rác giới hạn)
    state.maxPrice5m = state.maxPrice5m * 0.9999; 
    if(state.minPrice5m < 999999) state.minPrice5m = state.minPrice5m * 1.0001; 
}, 250);
