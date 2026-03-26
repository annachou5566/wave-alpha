/**
 * =================================================================
 * 🧠 QUANT WORKER V5.1 - ULTRA-HFT ENGINE (UI-COMPATIBLE FIX)
 * =================================================================
 * Giữ nguyên kiến trúc Zero-GC, Welford EMA và Cont-Stoikov OFI đẳng cấp.
 * Tái cấu trúc Output Schema để tương thích 100% với giao diện UI.
 */

const ALPHA_1S = 2 / (10 + 1);
const ALPHA_3S = 2 / (30 + 1);
const ALPHA_15S = 2 / (150 + 1);
const ALPHA_60S = 2 / (600 + 1); // Cho các chỉ số dài hạn

let state = {
    lastBid: 0, lastAsk: 0, 
    lastBidVol: 0, lastAskVol: 0,
    microPrice: 0, midPrice: 0, spread: 0,
    emaSpread: 0, varSpread: 0, emaDepth: 0,
    
    ofi1s: 0, ofi3s: 0,
    
    emaTakerBuy: 0, varTakerBuy: 0,
    emaTakerSell: 0, varTakerSell: 0,
    
    microCVD: 0, lastPrice: 0,
    
    // Các biến Zero-GC để giả lập lại dữ liệu hiển thị cho UI
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
    }
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
    // FIX 1: Hỗ trợ cả 2 chuẩn BOOKTICKER và BOOK_TICKER từ UI gửi qua
    else if (msg.cmd === 'BOOKTICKER' || msg.cmd === 'BOOK_TICKER') {
        const b = parseFloat(msg.data.b); 
        const B = parseFloat(msg.data.B); 
        const a = parseFloat(msg.data.a); 
        const A = parseFloat(msg.data.A); 

        const totalDepth = B + A;
        state.microPrice = totalDepth > 0 ? (b * A + a * B) / totalDepth : (b + a) / 2;
        state.midPrice = (b + a) / 2;

        state.spread = b > 0 ? ((a - b) / b) * 100 : 0;
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
        state.flags.liquidityVacuum = (spreadZScore > 3.0 && totalDepth < state.emaDepth * 0.5);
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

        // Tính Z-Score chung cho UI
        state.zScore = isBuy ? zBuy : -zSell;

        // Tính Buy Dominance cho UI
        let totalEMA = state.emaTakerBuy + state.emaTakerSell;
        state.buyDominance = totalEMA > 0 ? (state.emaTakerBuy / totalEMA) * 100 : 50;

        // Tính Algo Limit (Bộ lọc cá voi bằng EMA Speed) - Zero GC
        let baseLimit = state.emaSpeed60s * 0.4;
        state.algoLimit = Math.max(20, Math.round(baseLimit));

        // Tính Trend (VWAP Surrogate) - Zero GC
        state.emaPriceFast = state.emaPriceFast === 0 ? p : state.emaPriceFast * (1 - ALPHA_3S) + p * ALPHA_3S;
        state.emaPriceSlow = state.emaPriceSlow === 0 ? p : state.emaPriceSlow * (1 - ALPHA_60S) + p * ALPHA_60S;
        state.trend = state.emaPriceSlow > 0 ? ((state.emaPriceFast - state.emaPriceSlow) / state.emaPriceSlow) * 100 : 0;

        // Tính Drop (Giảm giá trị dần để tránh lưu trữ mảng)
        if (p > state.maxPrice5m) state.maxPrice5m = p;
        state.drop = state.maxPrice5m > 0 ? ((p - state.maxPrice5m) / state.maxPrice5m) * 100 : 0;

        state.flags.zoneAbsorptionBottom = (zSell > 3.0 && p >= state.lastPrice && state.ofi3s > 0);
        state.flags.zoneDistributionTop = (zBuy > 4.0 && p <= state.lastPrice && state.microPrice < state.midPrice && state.ofi3s < 0);
        
        // FIX 2: Đã sửa lại lỗi rớt dòng ngoặc ở đây
        state.flags.washTrading = ((zBuy > 2.0 || zSell > 2.0) && Math.abs(state.microCVD) < vUSD * 0.1 && p === state.lastPrice);

        state.lastPrice = p;
    }
    else if (msg.cmd === 'FULLDEPTH') {
        state.flags.spoofingDetected = false; 
    }
};

// FIX 3: Vòng lặp HFT trả ĐÚNG và ĐỦ các biến mà UI mong đợi
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
    
    // Reset speed đếm trong một tick
    state.currentSpeed = 0;
    
    // Tự động suy giảm maxPrice để tạo cơ chế Drop 5m mà không dùng mảng Array (Tránh Leak Memory)
    state.maxPrice5m = state.maxPrice5m * 0.9999; 
}, 250);
