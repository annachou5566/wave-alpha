// =================================================================
// 🧠 QUANT WORKER V4 - ULTRA-HFT ENGINE (TICK-LEVEL SENSITIVITY)
// =================================================================

let tickHistory = [];
let speedWindow = [];
let speedHist = []; 

self.onmessage = function(e) {
    const msg = e.data;

    // 1. Lệnh Khởi tạo / Xóa bộ nhớ khi chuyển Coin
    if (msg.cmd === 'INIT') {
        tickHistory = [];
        speedWindow = [];
        speedHist = [];
    }
    
    // 2. Lệnh Bơm Data từng Tick
    else if (msg.cmd === 'TICK') {
        tickHistory.push(msg.data); 
        speedWindow.push({ t: msg.data.t, v: msg.data.v });
    }
};

// 3. Vòng lặp tính toán ngầm siêu tốc (250ms/lần - 4 FPS để cực nhạy với Tick)
setInterval(() => {
    if (tickHistory.length === 0) return;
    const now = Date.now();

    // --- DỌN RÁC BỘ NHỚ ---
    tickHistory = tickHistory.filter(x => now - x.t <= 300000);
    speedWindow = speedWindow.filter(x => now - x.t <= 3000); // Đo tốc độ gia tốc trong 3 giây cuối 

    if (tickHistory.length === 0) return;
    const lastPrice = tickHistory[tickHistory.length - 1].p;

    // Phân rã khung thời gian siêu vi mô
    const hist3s = tickHistory.filter(x => now - x.t <= 3000);  // 3s (Tối thượng cho Tick)
    const hist15s = tickHistory.filter(x => now - x.t <= 15000);
    const hist60s = tickHistory.filter(x => now - x.t <= 60000);

    // ==========================================
    // A. TÍNH SPREAD & RỦI RO THANH KHOẢN
    // ==========================================
    let spread = 0;
    if (hist15s.length > 3) {
        let prices = hist15s.map(x => x.p).sort((a,b) => a - b);
        let p02 = prices[Math.floor(prices.length * 0.02)];
        let p98 = prices[Math.floor(prices.length * 0.98)];
        if (p02 > 0) spread = ((p98 - p02) / p02) * 100;
    }

    // ==========================================
    // B. VWAP TREND: FAST (3s) CẮT SLOW (15s) 
    // ==========================================
    let trend = 0;
    if (hist3s.length > 1 && hist15s.length > 5) {
        let vwapFast = hist3s.reduce((s, x) => s + x.p * x.v, 0) / (hist3s.reduce((s, x) => s + x.v, 0) || 1);
        let vwapSlow = hist15s.reduce((s, x) => s + x.p * x.v, 0) / (hist15s.reduce((s, x) => s + x.v, 0) || 1);
        
        // Độ dốc VWAP cực nhạy.
        if (vwapSlow > 0 && vwapFast > 0) {
            trend = ((vwapFast - vwapSlow) / vwapSlow) * 100;
        }
    }

    let drop = 0;
    if (hist60s.length > 5) {
        let prices1m = hist60s.map(x => x.p).sort((a,b) => a - b);
        let peakP99 = prices1m[Math.floor(prices1m.length * 0.99)]; // Đỉnh trong 1 phút qua
        if (peakP99 > 0) drop = ((lastPrice - peakP99) / peakP99) * 100; 
    }

    // ==========================================
    // C. TAKER DOMINANCE & TOXIC ORDER FLOW (OFI V3 SIÊU NHẠY)
    // ==========================================
    let buyVol3s = hist3s.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
    let sellVol3s = hist3s.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
    let totalVol3s = buyVol3s + sellVol3s;
    
    let ofi = totalVol3s > 0 ? ((buyVol3s - sellVol3s) / totalVol3s) : 0;
    let buyDominance = totalVol3s > 0 ? (buyVol3s / totalVol3s) * 100 : 50;
    
    let microCVD = hist60s.reduce((s, x) => s + (x.dir ? x.v : -x.v), 0);
    
    // TÍNH ĐỘC HẠI (TOXICITY) - Ép ngưỡng trigger xuống thấp nhất
    let priceTickImpact = 0;
    if (hist3s.length >= 2) {
        let firstP3s = hist3s[0].p;
        priceTickImpact = ((lastPrice - firstP3s) / firstP3s) * 100; 
        
        // Trượt giá siêu nhỏ (0.02%) + OFI đồng pha = Khuếch đại mạnh tín hiệu x2.5
        if (priceTickImpact < -0.02 && ofi < 0) {
            ofi = ofi * 2.5; 
        } else if (priceTickImpact > 0.02 && ofi > 0) {
            ofi = ofi * 2.5;
        }
        
        if (ofi < -1) ofi = -1;
        if (ofi > 1) ofi = 1;
    }

    // ==========================================
    // D. Z-SCORE V4 (MÔI TRƯỜNG TICK)
    // ==========================================
    let currentSpeed = speedWindow.reduce((s, x) => s + x.v, 0) / 3; // USD/s tính trong 3s
    let txPerSec = speedWindow.length / 3; 
    
    speedHist.push(currentSpeed);
    if (speedHist.length > 20) speedHist.shift(); // Chỉ lưu lịch sử 20 nhịp để Z-score thay đổi tức thời

    let zScore = 0;
    if (speedHist.length >= 5) {
        let mean = speedHist.reduce((a, b) => a + b, 0) / speedHist.length;
        let variance = speedHist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speedHist.length;
        let stdDev = Math.sqrt(variance);
        
        // Baseline hạ cực thấp để Z-score nhảy vọt với bất kỳ lệnh xả/bơm nào
        const baselineStd = Math.max(100, mean * 0.01); 
        if (stdDev < baselineStd) stdDev = baselineStd; 
        
        zScore = (currentSpeed - mean) / stdDev;
    }

    // ==========================================
    // E. ALGO LIMIT V4
    // ==========================================
    let timeSpan = 1;
    if (hist60s.length > 1) timeSpan = (hist60s[hist60s.length - 1].t - hist60s[0].t) / 1000;
    if (timeSpan < 1) timeSpan = 1;
    let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / timeSpan; 
    
    let algoLimit = currentSpeed * 0.25; 
    
    if (hist60s.length > 5) {
        let sortedVols = hist60s.map(x => x.v).sort((a,b) => a - b);
        let limitIdx = Math.floor(sortedVols.length * 0.85); // Lọc 15% lệnh Cá
        let normalVols = sortedVols.slice(0, limitIdx > 0 ? limitIdx : 1);
        let normalTicket = normalVols.reduce((a, b) => a + b, 0) / normalVols.length;

        let baseFlowLimit = avgSpeed60s * 0.40; 
        let maxAbsorbLimit = normalTicket * 3;  
        algoLimit = Math.min(baseFlowLimit, maxAbsorbLimit);
    }

    if (zScore < 1.0) {
        if (txPerSec < 1) algoLimit *= 0.2;      
        else if (txPerSec < 3) algoLimit *= 0.5; 
    }

    algoLimit = Math.max(20, Math.round(algoLimit)); 

    // BẮN DATA VỀ FRONTEND NGAY LẬP TỨC
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread, trend, drop, ofi, zScore, currentSpeed, 
            algoLimit, avgSpeed60s, buyDominance, microCVD, priceTickImpact 
        }
    });

}, 250); // CHẠY 250ms (4 LẦN/GIÂY) ĐỂ BẮT ĐÚNG NHỊP CỦA HFT
