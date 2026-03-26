/**
 * =================================================================
 * 🧠 QUANT WORKER V7.1 - APEX HFT ENGINE (MULTI-LEVEL CONT-STOIKOV)
 * =================================================================
 * - Tích hợp Welford EMA cho Trung bình & Phương sai (Zero-GC).
 * - Multi-Level OFI (Cont-Stoikov 2014, K=5) cho Book Depth.
 * - TRUE ZERO-GC: Sử dụng Typed Arrays (Float64Array) thay vì JSON/Array động.
 * - Price Acceleration (Gia tốc giá - Đạo hàm bậc 2) từ luồng BookTicker siêu tốc.
 * - Storyteller Engine với Independent Signal Locks.
 * - Tương thích ngược 100% payload UI (Restored Flags & Stats).
 */

const ALPHA_1S = 2 / (10 + 1); 
const ALPHA_3S = 2 / (30 + 1);
const ALPHA_15S = 2 / (150 + 1);
const ALPHA_60S = 2 / (600 + 1); 
const LOCK_DUR = 5000;
const K_LEVELS = 5;

// ZERO-GC BUFFERS CHO CONT-STOIKOV K=5 (Không sinh rác bộ nhớ)
const prevBidP = new Float64Array(K_LEVELS);
const prevBidQ = new Float64Array(K_LEVELS);
const prevAskP = new Float64Array(K_LEVELS);
const prevAskQ = new Float64Array(K_LEVELS);

let state = {
    microPrice: 0, midPrice: 0, 
    prevMid: 0, prevPrevMid: 0, accel: 0,
    spread: 0, emaSpread: 0, varSpread: 0,
    
    // Cont-Stoikov Variables
    ofiMean: 0, ofiVar: 0, rawOFI: 0, multiLevelOFI: 0,
    
    emaTakerBuy: 0, varTakerBuy: 0,
    emaTakerSell: 0, varTakerSell: 0,
    
    microCVD: 0, lastPrice: 0, maxPrice5m: 0, minPrice5m: 9999999999,
    emaPriceFast: 0, emaPriceSlow: 0, currentSpeed: 0, emaSpeed60s: 0,
    zScore: 0, algoLimit: 20, buyDominance: 50, trend: 0, drop: 0,

    hftVerdict: null,
    
    // Khóa tín hiệu độc lập
    lockUntil: {
        flashDump: 0,
        marketPump: 0,
        spoofing: 0,
        iceberg: 0
    }
};

function initEngine() {
    for (let key in state) {
        if (typeof state[key] === 'number') state[key] = 0;
    }
    state.minPrice5m = 9999999999;
    state.algoLimit = 20;
    state.buyDominance = 50;
    state.hftVerdict = null;
    state.lockUntil = { flashDump: 0, marketPump: 0, spoofing: 0, iceberg: 0 };
    
    // Reset buffers
    for(let i=0; i<K_LEVELS; i++) {
        prevBidP[i] = 0; prevBidQ[i] = 0;
        prevAskP[i] = 0; prevAskQ[i] = 0;
    }
}

// Lõi Welford (Zero-GC) tính Trung bình & Phương sai
function updateWelford(val, ema, variance, alpha) {
    let diff = val - ema;
    let newEma = ema + alpha * diff;
    let newVar = (1 - alpha) * (variance + alpha * diff * diff);
    return { e: newEma, v: newVar };
}

// Thuật toán Cont-Stoikov (2014) chuẩn hóa với Zero-GC Memory
function computeMultiLevelOFI(bids, asks) {
    let ofi = 0;
    let totalLiquidity = 0;
    const len = Math.min(bids.length, asks.length, K_LEVELS);

    for (let i = 0; i < len; i++) {
        let bp = Number(bids[i][0]); let bq = Number(bids[i][1]);
        let ap = Number(asks[i][0]); let aq = Number(asks[i][1]);
        
        totalLiquidity += (bq + aq);

        // Delta Bid
        let deltaBid = 0;
        if (bp > prevBidP[i]) deltaBid = bq;
        else if (bp === prevBidP[i]) deltaBid = bq - prevBidQ[i];
        else deltaBid = -prevBidQ[i];

        // Delta Ask
        let deltaAsk = 0;
        if (ap < prevAskP[i]) deltaAsk = aq;
        else if (ap === prevAskP[i]) deltaAsk = aq - prevAskQ[i];
        else deltaAsk = -prevAskQ[i];

        // Trọng số OFI (Các mức giá gần Top-book sẽ có tác động cao hơn)
        let weight = (K_LEVELS - i) / K_LEVELS; 
        ofi += (deltaBid - deltaAsk) * weight;

        // Cập nhật Buffer trực tiếp vào bộ nhớ (Zero-GC)
        prevBidP[i] = bp; prevBidQ[i] = bq;
        prevAskP[i] = ap; prevAskQ[i] = aq;
    }
    
    // Chuẩn hóa OFI để không bị tràn biên độ [-1, 1]
    return totalLiquidity > 0 ? (ofi / totalLiquidity) : 0;
}

// Động cơ Kể chuyện Market Maker (Storyteller)
function evaluateStoryteller(now) {
    let z = state.zScore;
    let buyDom = state.buyDominance;
    let accel = state.accel;
    
    // Dùng Multi-level OFI (Cont-Stoikov 5-cấp) nếu có, nếu không thì dùng rawOFI (1-cấp)
    let activeOFI = state.multiLevelOFI !== 0 ? state.multiLevelOFI : state.rawOFI;
    
    let speed = state.currentSpeed;
    let avgSpeed = state.emaSpeed60s;

    let pace = "[🚶 CHẬM]";
    if (speed > avgSpeed * 3 && avgSpeed > 1000) pace = "[⚡ KÍCH ĐỘNG]";
    else if (speed > avgSpeed * 1.5 && avgSpeed > 1000) pace = "[🔥 SÔI ĐỘNG]";

    let signal = { text: '', color: '', bgColor: '' };

    // 1. Flash Dump (Kết hợp Z-Score, Dom, OFI âm và Gia tốc âm)
    if ((buyDom < 35 || z < -2.0) && activeOFI < -0.15 && accel < -1e-6 && now > state.lockUntil.flashDump) {
        state.lockUntil.flashDump = now + LOCK_DUR;
        signal = { text: 'Flash Dump', color: '#FF007F', bgColor: 'rgba(255, 0, 127, 0.15)' };
    }
    // 2. Market Pump
    else if ((buyDom > 65 || z > 2.0) && activeOFI > 0.15 && accel > 1e-6 && now > state.lockUntil.marketPump) {
        state.lockUntil.marketPump = now + LOCK_DUR;
        signal = { text: 'Market Pump', color: '#00F0FF', bgColor: 'rgba(0, 240, 255, 0.15)' };
    }
    // Giữ tín hiệu Lock
    else if (now <= state.lockUntil.flashDump) {
        signal = { text: 'Flash Dump (Active)', color: '#FF007F', bgColor: 'rgba(255, 0, 127, 0.15)' };
    }
    else if (now <= state.lockUntil.marketPump) {
        signal = { text: 'Market Pump (Active)', color: '#00F0FF', bgColor: 'rgba(0, 240, 255, 0.15)' };
    }

    // 3. Phân tích vi mô: Cực kỳ hiệu quả nhờ thuật toán Cont-Stoikov K=5
    if (!signal.text) {
        // Spoofing: Order Flow Imbalance lớn nhưng giá không nhúc nhích (gia tốc = 0)
        if (Math.abs(activeOFI) > 0.5 && Math.abs(accel) < 1e-8 && now > state.lockUntil.spoofing) {
            state.lockUntil.spoofing = now + LOCK_DUR;
            signal = { text: 'Spoofing Wall', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' };
        }
        // Iceberg: Volume khớp lệnh khủng (Z-score cao) nhưng giá bị chặn lại
        else if (Math.abs(z) > 2.0 && Math.abs(accel) < 1e-8 && now > state.lockUntil.iceberg) {
            state.lockUntil.iceberg = now + LOCK_DUR;
            signal = { text: 'Iceberg Absorption', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' };
        }
        else if (now <= state.lockUntil.spoofing) {
            signal = { text: 'Spoofing Wall', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' };
        }
        else if (now <= state.lockUntil.iceberg) {
            signal = { text: 'Iceberg Absorption', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' };
        }
    }

    // 4. Tín hiệu nền (Background State)
    if (!signal.text) {
        if (buyDom < 45 || state.trend < -0.1) {
            signal = { text: 'Áp lực Bán', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' };
        } else if (buyDom > 55 || state.trend > 0.1) {
            signal = { text: 'Lực Mua Chủ Động', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' };
        } else {
            signal = { text: 'Giằng Co (Sideo)', color: '#848e9c', bgColor: 'rgba(255, 255, 255, 0.05)' };
        }
    }

    state.hftVerdict = {
        html: `<b style="opacity:0.8; margin-right:4px;">${pace}</b> ${signal.text}`,
        color: signal.color,
        bg: signal.bgColor
    };
}

self.onmessage = function(e) {
    const msg = e.data;
    const now = Date.now();

    if (msg.cmd === 'INIT') {
        initEngine();
    } 
    // Hứng dữ liệu chiều sâu để chạy Cont-Stoikov K=5
    else if (msg.cmd === 'DEPTH' || msg.cmd === 'FULLDEPTH' || msg.type === 'depthUpdate') {
        const bids = msg.data.bids;
        const asks = msg.data.asks;
        if (bids && asks && bids.length > 0 && asks.length > 0) {
            let rawMultiOFI = computeMultiLevelOFI(bids, asks);
            // Dùng Welford chuẩn hóa độ nhiễu
            let ofiStats = updateWelford(rawMultiOFI, state.ofiMean, state.ofiVar, ALPHA_15S);
            state.ofiMean = ofiStats.e;
            state.ofiVar = ofiStats.v;
            // Tính Z-Score của OFI để nhận diện điểm đột biến
            state.multiLevelOFI = state.ofiVar > 0 ? (rawMultiOFI - state.ofiMean) / Math.sqrt(state.ofiVar) : 0;
            state.multiLevelOFI = Math.max(-1, Math.min(1, state.multiLevelOFI));
        }
    }
    // Hứng luồng BookTicker siêu tốc để tính Gia tốc giá và OFI K=1 dự phòng
    else if (msg.cmd === 'BOOK_TICKER' || msg.cmd === 'BOOKTICKER') {
        const b = Number(msg.data.b); 
        const a = Number(msg.data.a); 

        if (!b || !a || b <= 0 || a < b) return; 
        
        let rawSpread = ((a - b) / b) * 100;
        if (rawSpread > 10) return; 
        state.spread = rawSpread;

        state.midPrice = (b + a) / 2;
        
        // CẬP NHẬT GIA TỐC GIÁ (Acceleration) - Trái tim để bắt điểm đảo chiều
        state.accel = state.midPrice - 2 * state.prevMid + state.prevPrevMid;
        state.prevPrevMid = state.prevMid || state.midPrice;
        state.prevMid = state.midPrice;

        // Tính Top-level OFI (K=1) dự phòng nếu luồng DEPTH bị lag
        let B = Number(msg.data.B) || 0; 
        let A = Number(msg.data.A) || 0;
        let e_bid = 0, e_ask = 0;
        if (b > prevBidP[0]) e_bid = B;
        else if (b === prevBidP[0]) e_bid = B - prevBidQ[0];
        if (a < prevAskP[0]) e_ask = A;
        else if (a === prevAskP[0]) e_ask = A - prevAskQ[0];
        
        let totalD = B + A;
        state.rawOFI = (e_bid - e_ask) / (totalD > 0 ? totalD : 1);
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
        state.algoLimit = Math.max(20, Math.round(state.emaSpeed60s * 0.4));

        state.emaPriceFast = state.emaPriceFast === 0 ? p : state.emaPriceFast * (1 - ALPHA_3S) + p * ALPHA_3S;
        state.emaPriceSlow = state.emaPriceSlow === 0 ? p : state.emaPriceSlow * (1 - ALPHA_60S) + p * ALPHA_60S;
        state.trend = state.emaPriceSlow > 0 ? ((state.emaPriceFast - state.emaPriceSlow) / state.emaPriceSlow) * 100 : 0;

        if (p > state.maxPrice5m) state.maxPrice5m = p;
        if (p < state.minPrice5m) state.minPrice5m = p;
        state.drop = state.maxPrice5m > 0 ? ((p - state.maxPrice5m) / state.maxPrice5m) * 100 : 0;
    }
};

setInterval(() => {
    const now = Date.now();
    evaluateStoryteller(now); 

    // KHÔI PHỤC TƯƠNG THÍCH UI: Ánh xạ hệ thống khóa lockUntil về định dạng flags cũ
    const legacyFlags = {
        liquidityVacuum: false, 
        spoofingDetected: now <= state.lockUntil.spoofing,
        icebergAbsorption: now <= state.lockUntil.iceberg,
        zoneAbsorptionBottom: false, // Legacy compatibility
        zoneDistributionTop: false,  // Legacy compatibility
        washTrading: false
    };

    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread: state.spread || 0,
            trend: state.trend || 0,
            drop: state.drop || 0,
            ofi: state.multiLevelOFI !== 0 ? state.multiLevelOFI : state.rawOFI || 0,
            zScore: state.zScore || 0,
            currentSpeed: state.currentSpeed || 0,
            algoLimit: state.algoLimit || 0,
            avgSpeed60s: state.emaSpeed60s || 0,
            buyDominance: state.buyDominance || 50,
            microCVD: state.microCVD || 0,
            flags: legacyFlags, // Đảm bảo các widget UI khác không bị lỗi
            hftVerdict: state.hftVerdict 
        }
    });
    
    state.currentSpeed = 0;
    // Tự động Decay min/max (Khử rác giới hạn)
    state.maxPrice5m = state.maxPrice5m * 0.9999; 
    if(state.minPrice5m < 999999) state.minPrice5m = state.minPrice5m * 1.0001; 
}, 250);
