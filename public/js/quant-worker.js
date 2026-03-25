// =================================================================
// 🧠 QUANT WORKER V3 - HFT ENGINE (TAKER BUY & CVD INTEGRATION)
// =================================================================

let tickHistory = [];
let speedWindow = [];
let speedHist = []; // Lưu lịch sử tốc độ để tính Z-Score

self.onmessage = function(e) {
    const msg = e.data;

    // 1. Lệnh Khởi tạo / Xóa bộ nhớ khi chuyển Coin
    if (msg.cmd === 'INIT') {
        tickHistory = [];
        speedWindow = [];
        speedHist = [];
    }
    
    // 2. Lệnh Bơm Data từng Tick (Từ WebSocket luồng chính bắn sang)
    else if (msg.cmd === 'TICK') {
        tickHistory.push(msg.data); // data: {t, p, q, v, dir}
        speedWindow.push({ t: msg.data.t, v: msg.data.v });
    }
};

// 3. Vòng lặp tính toán ngầm (1 giây 1 lần - HFT Throttle)
setInterval(() => {
    if (tickHistory.length === 0) return;
    const now = Date.now();

    // --- DỌN RÁC BỘ NHỚ (GARBAGE COLLECTION) BẰNG V8 FILTER ---
    // Giữ lại 5 phút lịch sử Tick (300,000ms) để tính toán
    tickHistory = tickHistory.filter(x => now - x.t <= 300000);
    speedWindow = speedWindow.filter(x => now - x.t <= 5000); // Tốc độ đo trong 5s

    if (tickHistory.length === 0) return;
    const lastPrice = tickHistory[tickHistory.length - 1].p;

    // Phân rã khung thời gian
    const hist15s = tickHistory.filter(x => now - x.t <= 15000);
    const hist60s = tickHistory.filter(x => now - x.t <= 60000);

    // ==========================================
    // A. TÍNH SPREAD & RỦI RO THANH KHOẢN (15s)
    // ==========================================
    let spread = 0;
    if (hist15s.length > 5) {
        let prices = hist15s.map(x => x.p).sort((a,b) => a - b);
        let p10 = prices[Math.floor(prices.length * 0.1)];
        let p90 = prices[Math.floor(prices.length * 0.9)];
        if (p10 > 0) spread = ((p90 - p10) / p10) * 100;
    }

    // ==========================================
    // B. TÍNH VWAP TREND & DROP (RỦI RO ĐU ĐỈNH)
    // ==========================================
    let trend = 0;
    if (hist60s.length > 10) {
        let oldHalf = hist60s.filter(x => now - x.t > 30000);
        let newHalf = hist60s.filter(x => now - x.t <= 30000);
        let vwapOld = oldHalf.reduce((s, x) => s + x.p * x.v, 0) / (oldHalf.reduce((s, x) => s + x.v, 0) || 1);
        let vwapNew = newHalf.reduce((s, x) => s + x.p * x.v, 0) / (newHalf.reduce((s, x) => s + x.v, 0) || 1);
        if (vwapOld > 0 && vwapNew > 0) trend = ((vwapNew - vwapOld) / vwapOld) * 100;
    }

    let drop = 0;
    if (tickHistory.length > 20) {
        let prices5m = tickHistory.map(x => x.p).sort((a,b) => a - b);
        let peakP95 = prices5m[Math.floor(prices5m.length * 0.95)];
        if (peakP95 > 0) drop = ((lastPrice - peakP95) / peakP95) * 100;
    }

    // ==========================================
    // C. TAKER BUY DOMINANCE & MICRO CVD (CỐT LÕI MỚI)
    // ==========================================
    // Tính toán dựa trên biến Q (Taker Buy Quote Volume) logic ngay trên mili-giây
    let buyVol15s = hist15s.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
    let sellVol15s = hist15s.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
    let totalVol15s = buyVol15s + sellVol15s;
    
    let ofi = totalVol15s > 0 ? ((buyVol15s - sellVol15s) / totalVol15s) : 0;
    let buyDominance = totalVol15s > 0 ? (buyVol15s / totalVol15s) * 100 : 50; // Trọng số Mua (Fomo Index)
    
    // Micro CVD: Lực lượng kéo co trong 5 phút
    let microCVD = tickHistory.reduce((s, x) => s + (x.dir ? x.v : -x.v), 0);

    // ==========================================
    // D. Z-SCORE V2 (ĐỘT BIẾN KHỐI LƯỢNG)
    // ==========================================
    let currentSpeed = speedWindow.reduce((s, x) => s + x.v, 0) / 5; // Tốc độ USD/giây
    let txPerSec = speedWindow.length / 5; 
    
    speedHist.push(currentSpeed);
    if (speedHist.length > 60) speedHist.shift(); // Lưu 60 nhịp (1 phút)

    let zScore = 0;
    if (speedHist.length >= 10) {
        let mean = speedHist.reduce((a, b) => a + b, 0) / speedHist.length;
        let variance = speedHist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speedHist.length;
        let stdDev = Math.sqrt(variance);
        
        // Chống nhiễu (Division by zero) khi thị trường tĩnh lặng
        const baselineStd = Math.max(1000, mean * 0.15); 
        if (stdDev < baselineStd) stdDev = baselineStd; 
        
        zScore = (currentSpeed - mean) / stdDev;
    }

    // ==========================================
    // E. ALGO LIMIT V2 (DUAL-BOUND WHALE FILTER)
    // ==========================================
    let timeSpan = 1;
    if (hist60s.length > 1) timeSpan = (hist60s[hist60s.length - 1].t - hist60s[0].t) / 1000;
    if (timeSpan < 1) timeSpan = 1;
    let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / timeSpan; 
    
    let algoLimit = currentSpeed * 0.15; 
    
    if (hist60s.length > 5) {
        let sortedVols = hist60s.map(x => x.v).sort((a,b) => a - b);
        let limitIdx = Math.floor(sortedVols.length * 0.95); // Lọc 5% lệnh Cá Voi
        let normalVols = sortedVols.slice(0, limitIdx > 0 ? limitIdx : 1);
        let normalTicket = normalVols.reduce((a, b) => a + b, 0) / normalVols.length;

        let baseFlowLimit = avgSpeed60s * 0.25; 
        let maxAbsorbLimit = normalTicket * 5;  
        algoLimit = Math.min(baseFlowLimit, maxAbsorbLimit);
    }

    // Phạt trượt giá (Spread Penalty)
    if (spread <= 0.5) algoLimit *= 1.0;       
    else if (spread <= 1.0) algoLimit *= 0.8;  
    else if (spread <= 2.0) algoLimit *= 0.5;  
    else algoLimit *= 0.2;                     

    // Phạt thị trường chết (Tx/s thấp)
    if (txPerSec < 1) algoLimit *= 0.3;      
    else if (txPerSec < 3) algoLimit *= 0.6; 

    algoLimit = Math.round(algoLimit);

    // BẮN DATA ĐÃ XỬ LÝ VỀ FRONTEND
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { spread, trend, drop, ofi, zScore, currentSpeed, algoLimit, avgSpeed60s, buyDominance, microCVD }
    });

}, 1000);
