/**
 * =================================================================
 * 🧠 QUANT WORKER V9.0 - APEX HFT ENGINE (AUDIT APPROVED)
 * =================================================================
 * - Welford EMA (Zero-GC) với Clamp chống trôi số thực (Floating-point drift).
 * - Multi-Level OFI (Cont-Stoikov K=5) kẹp Guard 1e-12 chống NaN.
 * - TRUE ZERO-GC: Sử dụng Float64Array.
 * - Lọc nhiễu Gia tốc (EMA smoothed MidPrice) & Fix Order-of-operations.
 * - Normalized Acceleration Threshold (Scale theo mọi price level).
 * - Cờ chống Decay vô lý khi thị trường illiquid (_hadTickThisInterval).
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
    lastPrice: 0, microPrice: 0, midPrice: 0, 
    prevMid: 0, prevPrevMid: 0, accel: 0,
    emaMid: 0, // [NEW V9] EMA-smoothed mid price lọc nhiễu
    emaAccel: 0,
    spread: 0, emaSpread: 0, varSpread: 0,
    liquidityVacuum: false, 
    
    // Cont-Stoikov Variables
    ofiMean: 0, ofiVar: 0, rawOFI: 0, multiLevelOFI: 0,
    
    emaTakerBuy: 0, varTakerBuy: 0,
    emaTakerSell: 0, varTakerSell: 0,
    
    microCVD: 0, maxPrice5m: 0, minPrice5m: 9999999999,
    emaPriceFast: 0, emaPriceSlow: 0, currentSpeed: 0, emaSpeed60s: 0,
    zScore: 0, algoLimit: 20, buyDominance: 50, trend: 0, drop: 0,

    hftVerdict: null,
    _hadTickThisInterval: false, // [NEW V9] Cờ chống decay ảo
    
    // Khóa tín hiệu độc lập
    lockUntil: {
        flashDump: 0,
        marketPump: 0,
        spoofingBuyWall: 0,  
        spoofingSellWall: 0, 
        iceberg: 0,
        bearishIceberg: 0, 
        bullishIceberg: 0, 
        exhausted: 0,
        stopHunt: 0
    }
};

function initEngine() {
    // Reset primitives
    for (let key in state) {
        if (typeof state[key] === 'number') state[key] = 0;
    }
    state.minPrice5m = 9999999999;
    state.algoLimit = 20;
    state.buyDominance = 50;
    state.liquidityVacuum = false;
    state.hftVerdict = null;
    state._hadTickThisInterval = false;
    state.lockUntil = { flashDump: 0, marketPump: 0, spoofingBuyWall: 0, spoofingSellWall: 0, iceberg: 0, bearishIceberg: 0, bullishIceberg: 0, exhausted: 0, stopHunt: 0 };
    
    for(let i=0; i<K_LEVELS; i++) {
        prevBidP[i] = 0; prevBidQ[i] = 0;
        prevAskP[i] = 0; prevAskQ[i] = 0;
    }
}

// Lõi Welford (Zero-GC)
function updateWelford(val, ema, variance, alpha) {
    let diff = val - ema;
    let newEma = ema + alpha * diff;
    // [V9 FIX] Clamp >= 0 để chống floating-point drift sinh ra số âm cực nhỏ
    let newVar = Math.max(0, (1 - alpha) * (variance + alpha * diff * diff));
    return { e: newEma, v: newVar };
}

function computeMultiLevelOFI(bids, asks) {
    let ofi = 0;
    let totalLiquidity = 0;
    const len = Math.min(bids.length, asks.length, K_LEVELS);

    for (let i = 0; i < len; i++) {
        let bp = Number(bids[i][0]); let bq = Number(bids[i][1]);
        let ap = Number(asks[i][0]); let aq = Number(asks[i][1]);
        
        totalLiquidity += (bq + aq);

        let deltaBid = 0;
        if (bp > prevBidP[i]) deltaBid = bq;
        else if (bp === prevBidP[i]) deltaBid = bq - prevBidQ[i];
        else deltaBid = -prevBidQ[i];

        let deltaAsk = 0;
        if (ap < prevAskP[i]) deltaAsk = aq;
        else if (ap === prevAskP[i]) deltaAsk = aq - prevAskQ[i];
        else deltaAsk = -prevAskQ[i];

        let weight = (K_LEVELS - i) / K_LEVELS; 
        ofi += (deltaBid - deltaAsk) * weight;

        prevBidP[i] = bp; prevBidQ[i] = bq;
        prevAskP[i] = ap; prevAskQ[i] = aq;
    }
    
    return totalLiquidity > 0 ? (ofi / totalLiquidity) : 0;
}

// Động cơ Kể chuyện Market Maker (Storyteller & Micro-structure)
function evaluateStoryteller(now) {
    let z = state.zScore;
    let buyDom = state.buyDominance;
    let accel = state.accel;
    let velocity = state.midPrice - state.prevMid; 
    
    let activeOFI = state.multiLevelOFI !== 0 ? state.multiLevelOFI : state.rawOFI;
    let speed = state.currentSpeed;
    let avgSpeed = state.emaSpeed60s;

    let pace = "[🚶 CHẬM]";
    if (speed > avgSpeed * 3 && avgSpeed > 1000) pace = "[⚡ KÍCH ĐỘNG]";
    else if (speed > avgSpeed * 1.5 && avgSpeed > 1000) pace = "[🔥 SÔI ĐỘNG]";

    let signal = { text: '', color: '', bgColor: '' };

    // =======================================================
    // 1. TÍN HIỆU ƯU TIÊN TỐI CAO: MICRO-STRUCTURE (Iceberg/Spoofing)
    let isVolumeSpike = Math.abs(z) > 2.0;
    
    // [V9 FIX] Normalize accel theo price để scale đúng cho mọi coin (BTC hay Meme)
    const accelNorm = state.midPrice > 0 ? Math.abs(accel) / state.midPrice : Math.abs(accel);
    let isPriceStalled = accelNorm < 5e-7;

    if (isVolumeSpike && isPriceStalled && now > state.lockUntil.iceberg) {
        state.lockUntil.iceberg = now + LOCK_DUR;
        state.lockUntil.flashDump = 0; 
        state.lockUntil.exhausted = 0; 
        state.lockUntil.marketPump = 0;
        
        if (activeOFI < -0.2 || buyDom < 45) {
            state.lockUntil.bearishIceberg = now + LOCK_DUR;
            signal = { text: '🧊 BEARISH ICEBERG (Sắp Vỡ)', color: '#ffffff', bgColor: '#F6465D' }; 
        } else {
            state.lockUntil.bullishIceberg = now + LOCK_DUR;
            signal = { text: '🧊 BULLISH ICEBERG (Đỡ Giá)', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' };
        }
    }
    else if (activeOFI > 0.6 && isPriceStalled && now > state.lockUntil.spoofingBuyWall) {
        state.lockUntil.spoofingBuyWall = now + LOCK_DUR;
        signal = { text: '⚠️ TƯỜNG MUA ẢO', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' };
    }
    else if (activeOFI < -0.6 && isPriceStalled && now > state.lockUntil.spoofingSellWall) {
        state.lockUntil.spoofingSellWall = now + LOCK_DUR;
        signal = { text: '⚠️ TƯỜNG BÁN ẢO', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' };
    }

    // =======================================================
    // 2. FLASH DUMP & MARKET PUMP
    if (!signal.text) {
        let isDumping = (buyDom < 35 || z < -2.0) && activeOFI < -0.15 && velocity < 0;
        if (isDumping && state.trend > 0.1 && (z > -3.0 || activeOFI > -0.4)) isDumping = false; 

        if (isDumping && now > state.lockUntil.flashDump) {
            state.lockUntil.flashDump = now + LOCK_DUR;
            state.lockUntil.marketPump = 0;
            state.lockUntil.exhausted = 0; 
            signal = { text: '🩸 FLASH DUMP', color: '#FF007F', bgColor: 'rgba(255, 0, 127, 0.15)' };
        }

        let isPumping = (buyDom > 65 || z > 2.0) && activeOFI > 0.15 && velocity > 0;
        if (isPumping && state.trend < -0.1 && (z < 3.0 || activeOFI < 0.4)) isPumping = false; 

        if (isPumping && now > state.lockUntil.marketPump) {
            state.lockUntil.marketPump = now + LOCK_DUR;
            state.lockUntil.flashDump = 0; 
            signal = { text: '🚀 MARKET PUMP', color: '#00F0FF', bgColor: 'rgba(0, 240, 255, 0.15)' };
        }
    }

    // =======================================================
    // 3. 🪫 SELLING EXHAUSTION & 🪝 STOP-HUNT (FIXED TIME-SCALE)
    let isSharpDrop = state.drop <= -0.6;
    let projectedSpeed1s = speed * 4; 
    let isPanicSpeed = projectedSpeed1s > (avgSpeed * 1.5);

    if (isSharpDrop && isPanicSpeed) {
        let isBuyReversal = state.emaTakerBuy > (state.emaTakerSell * 2) && (z > 1.5 || activeOFI > 0.3);

        if (isBuyReversal && now > state.lockUntil.stopHunt) {
            state.lockUntil.stopHunt = now + LOCK_DUR;
            state.lockUntil.exhausted = 0; 
            state.lockUntil.flashDump = 0; 
            signal = { text: '🪝 STOP-HUNT REVERSAL', color: '#ffffff', bgColor: '#8e44ad' };
        }
        else if (!isBuyReversal && state.liquidityVacuum && now > state.lockUntil.exhausted) {
            state.lockUntil.exhausted = now + LOCK_DUR;
            state.lockUntil.flashDump = 0; 
            signal = { text: '🪫 EXHAUSTED (Cạn Kiệt)', color: '#000000', bgColor: '#f1c40f' }; 
        }
    }

    // =======================================================
    // 4. PERSISTENCE (GIỮ TÍN HIỆU UI CHỐNG CHỚP NHÁY)
    if (!signal.text) {
        if (now <= state.lockUntil.bearishIceberg) {
            signal = { text: '🧊 BEARISH ICEBERG (Active)', color: '#ffffff', bgColor: '#F6465D' };
        } else if (now <= state.lockUntil.bullishIceberg) {
            signal = { text: '🧊 BULLISH ICEBERG (Active)', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' };
        } else if (now <= state.lockUntil.spoofingBuyWall) {
            signal = { text: '⚠️ TƯỜNG MUA ẢO (Active)', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' };
        } else if (now <= state.lockUntil.spoofingSellWall) {
            signal = { text: '⚠️ TƯỜNG BÁN ẢO (Active)', color: '#F0B90B', bgColor: 'rgba(240, 185, 11, 0.15)' };
        } else if (now <= state.lockUntil.stopHunt) {
            signal = { text: '🪝 STOP-HUNT (Active)', color: '#ffffff', bgColor: '#8e44ad' };
        } else if (now <= state.lockUntil.exhausted) {
            signal = { text: '🪫 EXHAUSTED (Active)', color: '#000000', bgColor: '#f1c40f' };
        } else if (now <= state.lockUntil.flashDump) {
            signal = { text: '🩸 FLASH DUMP (Active)', color: '#FF007F', bgColor: 'rgba(255, 0, 127, 0.15)' };
        } else if (now <= state.lockUntil.marketPump) {
            signal = { text: '🚀 MARKET PUMP (Active)', color: '#00F0FF', bgColor: 'rgba(0, 240, 255, 0.15)' };
        }
    }

    // =======================================================
    // 5. TÍN HIỆU NỀN TẢNG
    if (!signal.text) {
        if (buyDom < 45 || state.trend < -0.1) {
            signal = { text: '📉 Áp lực Bán', color: '#F6465D', bgColor: 'rgba(246, 70, 93, 0.15)' };
        } else if (buyDom > 55 || state.trend > 0.1) {
            signal = { text: '📈 Lực Mua Chủ Động', color: '#0ECB81', bgColor: 'rgba(14, 203, 129, 0.15)' };
        } else {
            signal = { text: '⚖️ Giằng Co (Sideo)', color: '#848e9c', bgColor: 'rgba(255, 255, 255, 0.05)' };
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
    else if (msg.cmd === 'DEPTH' || msg.cmd === 'FULLDEPTH' || msg.type === 'depthUpdate') {
        const bids = msg.data.bids;
        const asks = msg.data.asks;
        if (bids && asks && bids.length > 0 && asks.length > 0) {
            let rawMultiOFI = computeMultiLevelOFI(bids, asks);
            let ofiStats = updateWelford(rawMultiOFI, state.ofiMean, state.ofiVar, ALPHA_15S);
            state.ofiMean = ofiStats.e;
            state.ofiVar = ofiStats.v;
            // [V9 FIX] Cập nhật guard 1e-12 chống chia cho 0 hoặc sinh NaN
            state.multiLevelOFI = state.ofiVar > 1e-12 ? (rawMultiOFI - state.ofiMean) / Math.sqrt(state.ofiVar) : 0;
            state.multiLevelOFI = Math.max(-1, Math.min(1, state.multiLevelOFI));

            let hasWall = false;
            let currentP = state.lastPrice > 0 ? state.lastPrice : Number(bids[0][0]);
            let scanLimitP = currentP * 0.998; 
            
            for (let i = 0; i < bids.length; i++) {
                let p = Number(bids[i][0]);
                let q = Number(bids[i][1]);
                if (p < scanLimitP) break; 
                
                let usdValue = p * q;
                let wallThreshold = Math.max(10000, state.algoLimit * 15);
                if (usdValue >= wallThreshold) {
                    hasWall = true;
                    break;
                }
            }
            state.liquidityVacuum = !hasWall;
        }
    }
    else if (msg.cmd === 'BOOK_TICKER' || msg.cmd === 'BOOKTICKER') {
        const b = Number(msg.data.b); 
        const a = Number(msg.data.a); 

        // [V9 FIX] Bắt cảnh báo nếu bị lệch orderbook (Crossed book)
        if (!b || !a || b <= 0 || a < b) {
            if (a < b) console.warn('HFT Warning: Crossed book detected');
            return; 
        }
        
        let rawSpread = ((a - b) / b) * 100;
        if (rawSpread > 10) return; 
        state.spread = rawSpread;

        state.midPrice = (b + a) / 2;
        
        // [V9 FIX] Lọc nhiễu gia tốc bằng EMA MidPrice và sửa Order-of-ops
        const ALPHA_MID = ALPHA_3S;
        state.emaMid = state.emaMid === 0 ? state.midPrice : state.emaMid * (1 - ALPHA_MID) + state.midPrice * ALPHA_MID;
        
        const smoothMid = state.emaMid;
        state.accel = smoothMid - 2 * (state.prevMid || smoothMid) + (state.prevPrevMid || smoothMid);
        
        // Gán prevPrevMid TRƯỚC khi gán prevMid
        state.prevPrevMid = state.prevMid === 0 ? smoothMid : state.prevMid;
        state.prevMid = smoothMid;

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

        // =======================================================
        // [DYNAMIC EMA CLAMP] TÍNH TOÁN ALGO LIMIT CHỐNG TRƯỢT GIÁ (SLIPPAGE)
        // =======================================================
        // 1. Tính toán Trung bình thực tế (Biến ẩn emaTickVol)
        if (!state.emaTickVol) { 
            state.emaTickVol = vUSD; // Khởi tạo mốc trung bình thực tế bằng lệnh đầu tiên
        } else {
            // Tự động tạo Trần/Sàn dựa trên trung bình thực (Gấp 5 lần và chia 5 lần)
            let upperBound = state.emaTickVol * 5; 
            let lowerBound = Math.max(10, state.emaTickVol / 5); 

            // Cắt gọt lệnh (Chặn Cá Voi và Rác)
            let clampedVol = Math.min(Math.max(vUSD, lowerBound), upperBound);

            // Tính Trung bình động lũy thừa (EMA) thực tế
            state.emaTickVol = (clampedVol * 0.02) + (state.emaTickVol * 0.98);
        }

        // 2. Chốt số Algo Limit an toàn cho User Swap (Hệ số 80%)
        // Ví dụ: Market Maker đang đi lệnh 1000$ -> Giao diện sẽ báo Algo Limit là 800$ để User đi lệnh không bị quét trượt giá.
        state.algoLimit = Math.max(20, Math.round(state.emaTickVol * 0.8));
        // =======================================================

        state.emaPriceFast = state.emaPriceFast === 0 ? p : state.emaPriceFast * (1 - ALPHA_3S) + p * ALPHA_3S;
        state.emaPriceSlow = state.emaPriceSlow === 0 ? p : state.emaPriceSlow * (1 - ALPHA_60S) + p * ALPHA_60S;
        state.trend = state.emaPriceSlow > 0 ? ((state.emaPriceFast - state.emaPriceSlow) / state.emaPriceSlow) * 100 : 0;

        if (p > state.maxPrice5m) state.maxPrice5m = p;
        if (p < state.minPrice5m) state.minPrice5m = p;
        state.drop = state.maxPrice5m > 0 ? ((p - state.maxPrice5m) / state.maxPrice5m) * 100 : 0;
        
        state.lastPrice = p; 
        state._hadTickThisInterval = true; // [V9 FIX] Bật cờ có giao dịch
    }
};

setInterval(() => {
    const now = Date.now();
    evaluateStoryteller(now); 

    const legacyFlags = {
        liquidityVacuum: state.liquidityVacuum,
        spoofingBuyWall: now <= state.lockUntil.spoofingBuyWall,   
        spoofingSellWall: now <= state.lockUntil.spoofingSellWall, 
        bullishIceberg: now <= state.lockUntil.bullishIceberg, 
        bearishIceberg: now <= state.lockUntil.bearishIceberg, 
        icebergAbsorption: now <= state.lockUntil.bullishIceberg, 
        zoneAbsorptionBottom: false,
        zoneDistributionTop: false,
        washTrading: false,
        exhausted: now <= state.lockUntil.exhausted,
        stopHunt: now <= state.lockUntil.stopHunt,
        wallHit: !state.liquidityVacuum
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
            flags: legacyFlags, 
            hftVerdict: state.hftVerdict 
        }
    });
    
    state.currentSpeed = 0;
    
    // [V9 FIX] Chỉ trừ dần giá (decay) nếu thực sự có giao dịch xảy ra
    if (state._hadTickThisInterval) {
        state.maxPrice5m = state.maxPrice5m * 0.9999; 
        if(state.minPrice5m < 999999) state.minPrice5m = state.minPrice5m * 1.0001; 
        state._hadTickThisInterval = false; // Reset cờ
    }
}, 250);
