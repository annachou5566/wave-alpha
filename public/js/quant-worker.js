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

// 3. Vòng lặp tính toán ngầm HFT (1 giây 1 lần)
setInterval(() => {
    if (tickHistory.length === 0) return;
    const now = Date.now();

    // --- DỌN RÁC BỘ NHỚ ---
    tickHistory = tickHistory.filter(x => now - x.t <= 300000);
    speedWindow = speedWindow.filter(x => now - x.t <= 5000); 

    if (tickHistory.length === 0) return;
    const lastPrice = tickHistory[tickHistory.length - 1].p;

    // Phân rã khung thời gian vi mô (Thêm hist5s để cực nhạy)
    const hist5s = tickHistory.filter(x => now - x.t <= 5000);
    const hist15s = tickHistory.filter(x => now - x.t <= 15000);
    const hist60s = tickHistory.filter(x => now - x.t <= 60000);

    // ==========================================
    // A. TÍNH SPREAD & RỦI RO THANH KHOẢN (Chỉnh lại p5/p95 cho nhạy)
    // ==========================================
    let spread = 0;
    if (hist15s.length > 5) {
        let prices = hist15s.map(x => x.p).sort((a,b) => a - b);
        let p05 = prices[Math.floor(prices.length * 0.05)];
        let p95 = prices[Math.floor(prices.length * 0.95)];
        if (p05 > 0) spread = ((p95 - p05) / p05) * 100;
    }

    // ==========================================
    // B. VWAP TREND: FAST (5s) CẮT SLOW (60s) - BẮT CHÍNH XÁC TÍCH TẮC XẢ
    // ==========================================
    let trend = 0;
    if (hist5s.length > 2 && hist60s.length > 10) {
        let vwapFast = hist5s.reduce((s, x) => s + x.p * x.v, 0) / (hist5s.reduce((s, x) => s + x.v, 0) || 1);
        let vwapSlow = hist60s.reduce((s, x) => s + x.p * x.v, 0) / (hist60s.reduce((s, x) => s + x.v, 0) || 1);
        
        // Độ dốc VWAP. Nếu Fast rớt xa khỏi Slow -> Đang cắm đầu
        if (vwapSlow > 0 && vwapFast > 0) {
            trend = ((vwapFast - vwapSlow) / vwapSlow) * 100;
        }
    }

    let drop = 0;
    if (tickHistory.length > 20) {
        let prices5m = tickHistory.map(x => x.p).sort((a,b) => a - b);
        let peakP98 = prices5m[Math.floor(prices5m.length * 0.98)]; // Dùng p98 thay vì p95 để lấy đỉnh rõ hơn
        if (peakP98 > 0) drop = ((lastPrice - peakP98) / peakP98) * 100; // Sẽ âm cực mạnh khi sập
    }

    // ==========================================
    // C. TAKER DOMINANCE & TOXIC ORDER FLOW (OFI V2)
    // ==========================================
    let buyVol15s = hist15s.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
    let sellVol15s = hist15s.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
    let totalVol15s = buyVol15s + sellVol15s;
    
    // OFI thuần túy
    let ofi = totalVol15s > 0 ? ((buyVol15s - sellVol15s) / totalVol15s) : 0;
    let buyDominance = totalVol15s > 0 ? (buyVol15s / totalVol15s) * 100 : 50;
    
    // MICRO CVD & TỐC ĐỘ GIA TỐC (CVD Acceleration)
    let microCVD = tickHistory.reduce((s, x) => s + (x.dir ? x.v : -x.v), 0);
    
    // TÍNH ĐỘC HẠI (TOXICITY) - Bí mật của Quant: 
    // Giá rớt nhưng khối lượng không cần quá lớn (thanh khoản bị rút) hoặc xả gắt.
    let priceTickImpact = 0;
    if (hist5s.length >= 2) {
        let firstP5s = hist5s[0].p;
        priceTickImpact = ((lastPrice - firstP5s) / firstP5s) * 100; 
        
        // Nếu giá rớt nhanh (priceTickImpact < 0) và OFI âm, khuếch đại tín hiệu OFI cho Frontend
        if (priceTickImpact < -0.05 && ofi < 0) {
            ofi = ofi * 1.5; // Trigger cảnh báo mạnh hơn
            if (ofi < -1) ofi = -1;
        }
    }

    // ==========================================
    // D. Z-SCORE V3 (SỬA LỖI BỊ TRIỆT TIÊU BỞI BASELINE)
    // ==========================================
    let currentSpeed = speedWindow.reduce((s, x) => s + x.v, 0) / 5; // USD/giây
    let txPerSec = speedWindow.length / 5; 
    
    speedHist.push(currentSpeed);
    if (speedHist.length > 60) speedHist.shift();

    let zScore = 0;
    if (speedHist.length >= 10) {
        let mean = speedHist.reduce((a, b) => a + b, 0) / speedHist.length;
        let variance = speedHist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / speedHist.length;
        let stdDev = Math.sqrt(variance);
        
        // SỬA LỖI TẠI ĐÂY: Hạ baseline multiplier từ 0.15 xuống 0.03 để nhạy hơn với spike
        const baselineStd = Math.max(500, mean * 0.03); 
        if (stdDev < baselineStd) stdDev = baselineStd; 
        
        zScore = (currentSpeed - mean) / stdDev;
    }

    // ==========================================
    // E. ALGO LIMIT V3 (CHẶN CÁ MẬP RÕ RÀNG HƠN)
    // ==========================================
    let timeSpan = 1;
    if (hist60s.length > 1) timeSpan = (hist60s[hist60s.length - 1].t - hist60s[0].t) / 1000;
    if (timeSpan < 1) timeSpan = 1;
    let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / timeSpan; 
    
    let algoLimit = currentSpeed * 0.20; // Nới nhẹ để bắt được nhiều lệnh to hơn lúc xả
    
    if (hist60s.length > 5) {
        let sortedVols = hist60s.map(x => x.v).sort((a,b) => a - b);
        let limitIdx = Math.floor(sortedVols.length * 0.90); // Hạ ngưỡng từ 95% xuống 90%
        let normalVols = sortedVols.slice(0, limitIdx > 0 ? limitIdx : 1);
        let normalTicket = normalVols.reduce((a, b) => a + b, 0) / normalVols.length;

        let baseFlowLimit = avgSpeed60s * 0.30; 
        let maxAbsorbLimit = normalTicket * 4;  // Thắt chặt lại để tick limit không quá cao
        algoLimit = Math.min(baseFlowLimit, maxAbsorbLimit);
    }

    // Phạt thị trường tĩnh lặng, nhưng nếu Z-score vọt (cắm đầu) thì bỏ phạt
    if (zScore < 1.5) {
        if (txPerSec < 1) algoLimit *= 0.3;      
        else if (txPerSec < 3) algoLimit *= 0.6; 
    }

    algoLimit = Math.max(50, Math.round(algoLimit)); // Giới hạn đáy không bao giờ bằng 0

    // BẮN DATA VỀ FRONTEND
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread, 
            trend, 
            drop, 
            ofi, 
            zScore, 
            currentSpeed, 
            algoLimit, 
            avgSpeed60s, 
            buyDominance, 
            microCVD,
            priceTickImpact // Gửi thêm biến mới cho Frontend xử lý cảnh báo
        }
    });

}, 1000);
