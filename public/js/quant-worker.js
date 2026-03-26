/**
 * =================================================================
 * 🧠 QUANT WORKER V5.3 - ULTRA-HFT ENGINE (ANTI-GLITCH + SIGNAL HOLD)
 * =================================================================
 * Giữ nguyên kiến trúc Zero-GC, Welford EMA và Cont-Stoikov OFI đẳng cấp.
 * Đã khôi phục bộ khiên chắn dữ liệu rác (Spread Anti-Glitch).
 * ĐÃ THÊM: Bộ nhớ đệm giữ tín hiệu (Signal Persistence) 5 giây cho UI.
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
    
    ofi1s: 0, ofi3s: 0,
    
    emaTakerBuy: 0, varTakerBuy: 0,
    emaTakerSell: 0, varTakerSell: 0,
    
    microCVD: 0, lastPrice: 0,
    
    maxPrice5m: 0,
    emaPriceFast: 0, 
    emaPriceSlow: 0,
    currentSpeed: 0,
    emaSpeed60s: 0,
    zScore: 0,
    algoLimit: 20,
    buyDominance: 50,
    trend: 0,
    drop: 0,

    flags: {
        liquidityVacuum: false, spoofingDetected: false,
        washTrading: false, zoneAbsorptionBottom: false, zoneDistributionTop: false
    },
    // Bộ đếm thời gian giữ tín hiệu để UI không bị chớp tắt quá nhanh
    timers: { absorption: 0, distribution: 0, wash: 0, vacuum: 0 }
};

function initEngine() {
    for (let key in state) {
        if (typeof state[key] === 'number') state[key] = 0;
    }
    state.algoLimit = 20;
    state.buyDominance = 50;
    state.flags = { 
        liquidityVacuum: false, spoofingDetected: false, 
        washTrading: false, zoneAbsorptionBottom: false, zoneDistributionTop: false 
    };
    state.timers = { absorption: 0, distribution: 0, wash: 0, vacuum: 0 };
}

function updateMetrics(val, ema, variance, alpha) {
    let diff = val - ema;
    let newEma = ema + alpha * diff;
    let newVar = (1 - alpha) * (variance + alpha * diff * diff);
    return { e: newEma, v: newVar };
}

self.onmessage = function(e) {
    const msg = e.data;

    if (msg.cmd === 'INIT') {
        initEngine();
    } 
    else if (msg.cmd === 'BOOKTICKER' || msg.cmd === 'BOOK_TICKER') {
        const b = parseFloat(msg.data.b); 
        const B = parseFloat(msg.data.B) || 0; 
        const a = parseFloat(msg.data.a); 
        const A = parseFloat(msg.data.A) || 0; 

        // 🛡️ BỘ LỌC KHIÊN CHẮN (ANTI-GLITCH FILTER)
        if (!b || !a || b <= 0 || a < b) return; 
        
        let rawSpread = ((a - b) / b) * 100;
        if (rawSpread > 10) return; // Chặn Spread tào lao

        const totalDepth = B + A;
        state.microPrice = totalDepth > 0 ? (b * A + a * B) / totalDepth : (b + a) / 2;
        state.midPrice = (b + a) / 2;

        state.spread = rawSpread;
        let spStats = updateMetrics(state.spread, state.emaSpread, state.varSpread, ALPHA_3S);
        state.emaSpread = spStats.e; 
        state.varSpread = spStats.v;
        
        state.emaDepth = state.emaDepth * (1 - ALPHA_3S) + totalDepth * ALPHA_3S;

        let e_bid = 0;
        if (b > state.lastBid) e_bid = B;
        else if (b === state.lastBid) e_bid = B - state.lastBidVol;
        else e_bid = -state.lastBidVol;

        let e_ask = 0;
        if (a < state.lastAsk) e_ask = A;
        else if (a === state.lastAsk) e_ask = A - state.lastAskVol;
        else e_ask = -state.lastAskVol;

        let currentOFI = e_bid - e_ask;
        
        state.ofi1s = state.ofi1s * (1 - ALPHA_1S) + currentOFI * ALPHA_1S;
        state.ofi3s = state.ofi3s * (1 - ALPHA_3S) + currentOFI * ALPHA_3S;

        state.lastBid = b; state.lastAsk = a;
        state.lastBidVol = B; state.lastAskVol = A;

        let spreadZScore = state.varSpread > 0 ? (state.spread - state.emaSpread) / Math.sqrt(state.varSpread) : 0;
        
        // Cập nhật thanh khoản bốc hơi (Cũng giữ 5 giây)
        const now = Date.now();
        if (spreadZScore > 3.0 && totalDepth < state.emaDepth * 0.5) {
            state.flags.liquidityVacuum = true;
            state.timers.vacuum = now;
        } else if (now - state.timers.vacuum > 5000) {
            state.flags.liquidityVacuum = false;
        }
    }
    else if (msg.cmd === 'TICK') {
        const vUSD = parseFloat(msg.data.v) || (parseFloat(msg.data.p) * parseFloat(msg.data.q)); 
        const isBuy = msg.data.dir;          
        const p = parseFloat(msg.data.p);    

        state.microCVD += isBuy ? vUSD : -vUSD;
        state.currentSpeed += vUSD; 
        state.emaSpeed60s = state.emaSpeed60s * (1 - ALPHA_60S) + vUSD * ALPHA_60S * 10; 
        
        let currentBuy = isBuy ? vUSD : 0;
        let currentSell = isBuy ? 0 : vUSD;

        let bStats = updateMetrics(currentBuy, state.emaTakerBuy, state.varTakerBuy, ALPHA_3S);
        state.emaTakerBuy = bStats.e; 
        state.varTakerBuy = bStats.v;
        
        let sStats = updateMetrics(currentSell, state.emaTakerSell, state.varTakerSell, ALPHA_3S);
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
        state.drop = state.maxPrice5m > 0 ? ((p - state.maxPrice5m) / state.maxPrice5m) * 100 : 0;

        // ========================================================
        // 🚨 RADAR BẮT ĐỈNH/ĐÁY VỚI BỘ NHỚ ĐỆM (5 GIÂY)
        // ========================================================
        const now = Date.now();

        // 🟢 VÙNG BẮT ĐÁY (ABSORPTION ZONE)
        if (zSell > 3.0 && p >= state.lastPrice && state.ofi3s > 0) {
            state.flags.zoneAbsorptionBottom = true;
            state.timers.absorption = now; // Bật đồng hồ 5 giây
        } else if (now - state.timers.absorption > 5000) {
            state.flags.zoneAbsorptionBottom = false; // Sau 5 giây mới tắt
        }

        // 🔴 VÙNG ĐỈNH FOMO (DISTRIBUTION ZONE)
        if (zBuy > 4.0 && p <= state.lastPrice && state.microPrice < state.midPrice && state.ofi3s < 0) {
            state.flags.zoneDistributionTop = true;
            state.timers.distribution = now;
        } else if (now - state.timers.distribution > 5000) {
            state.flags.zoneDistributionTop = false;
        }
        
        // 🟡 WASH TRADING
        if ((zBuy > 2.0 || zSell > 2.0) && Math.abs(state.microCVD) < vUSD * 0.1 && p === state.lastPrice) {
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
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread: Number(state.spread) || 0,
            trend: Number(state.trend) || 0,
            drop: Number(state.drop) || 0,
            ofi: Number(state.ofi3s) || 0,
            zScore: Number(state.zScore) || 0,
            currentSpeed: Number(state.currentSpeed) || 0,
            algoLimit: Number(state.algoLimit) || 0,
            avgSpeed60s: Number(state.emaSpeed60s) || 0,
            buyDominance: Number(state.buyDominance) || 50,
            microCVD: Number(state.microCVD) || 0,
            flags: state.flags
        }
    });
    
    state.currentSpeed = 0;
    state.maxPrice5m = state.maxPrice5m * 0.9999; 
}, 250);
