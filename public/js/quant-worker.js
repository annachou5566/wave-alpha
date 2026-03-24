// ==========================================
// 🧠 QUANT WORKER - BỘ NÃO TÍNH TOÁN ĐA LUỒNG
// ==========================================
let tickHistory = [];
let speedWindow = [];

self.onmessage = function(e) {
    const msg = e.data;

    // 1. Lệnh Khởi tạo / Xóa bộ nhớ khi chuyển Coin
    if (msg.cmd === 'INIT') {
        tickHistory = [];
        speedWindow = [];
    }
    
    // 2. Lệnh Bơm Data từng Tick (Từ WebSocket luồng chính bắn sang)
    else if (msg.cmd === 'TICK') {
        tickHistory.push(msg.data);
        speedWindow.push({ t: msg.data.t, v: msg.data.v });
    }
};

// 3. Vòng lặp tính toán ngầm (1 giây 1 lần)
setInterval(() => {
    if (tickHistory.length === 0) return;
    const now = Date.now();

    // --- Dọn rác nội bộ Worker ---
    let expireTickIdx = 0;
    while (expireTickIdx < tickHistory.length && now - tickHistory[expireTickIdx].t > 300000) expireTickIdx++;
    if (expireTickIdx > 0) tickHistory.splice(0, expireTickIdx);

    let expireSpeedIdx = 0;
    while (expireSpeedIdx < speedWindow.length && now - speedWindow[expireSpeedIdx].t > 5000) expireSpeedIdx++;
    if (expireSpeedIdx > 0) speedWindow.splice(0, expireSpeedIdx);

    if (tickHistory.length === 0) return;
    const lastPrice = tickHistory[tickHistory.length - 1].p;

    // --- A. TÍNH SPREAD (Phân vị 90/10 trong 15s) ---
    const hist15s = tickHistory.filter(x => now - x.t <= 15000);
    let spread = 0;
    if (hist15s.length > 5) {
        let prices = hist15s.map(x => x.p).sort((a,b) => a - b);
        let p10 = prices[Math.floor(prices.length * 0.1)];
        let p90 = prices[Math.floor(prices.length * 0.9)];
        if (p10 > 0) spread = ((p90 - p10) / p10) * 100;
    }

    // --- B. TÍNH VWAP TREND (Gia tốc 60s) ---
    const hist60s = tickHistory.filter(x => now - x.t <= 60000);
    let trend = 0;
    if (hist60s.length > 10) {
        let oldHalf = hist60s.filter(x => now - x.t > 30000);
        let newHalf = hist60s.filter(x => now - x.t <= 30000);
        let vwapOld = oldHalf.reduce((s, x) => s + x.p * x.v, 0) / (oldHalf.reduce((s, x) => s + x.v, 0) || 1);
        let vwapNew = newHalf.reduce((s, x) => s + x.p * x.v, 0) / (newHalf.reduce((s, x) => s + x.v, 0) || 1);
        if (vwapOld > 0 && vwapNew > 0) trend = ((vwapNew - vwapOld) / vwapOld) * 100;
    }

    // --- C. TÍNH DROP (Đỉnh 5 phút) ---
    let drop = 0;
    if (tickHistory.length > 20) {
        let prices5m = tickHistory.map(x => x.p).sort((a,b) => a - b);
        let peakP95 = prices5m[Math.floor(prices5m.length * 0.95)];
        if (peakP95 > 0) drop = ((lastPrice - peakP95) / peakP95) * 100;
    }

    // --- D. TÍNH OFI (Order Flow Imbalance 15s) ---
    let buyVol15s = hist15s.filter(x => x.dir).reduce((s, x) => s + x.v, 0);
    let sellVol15s = hist15s.filter(x => !x.dir).reduce((s, x) => s + x.v, 0);
    let totalVol15s = buyVol15s + sellVol15s;
    let ofi = totalVol15s > 0 ? ((buyVol15s - sellVol15s) / totalVol15s) : 0;

    // --- E. TÍNH Z-SCORE (Đột biến dòng tiền) ---
    let currentSpeed = speedWindow.reduce((s, x) => s + x.v, 0) / 5; 
    let txPerSec = speedWindow.length / 5; // Khai báo txPerSec DUY NHẤT 1 lần ở đây
    
    if (!self.speedHist) self.speedHist = [];
    self.speedHist.push(currentSpeed);
    if (self.speedHist.length > 60) self.speedHist.shift();

    let zScore = 0;
    if (self.speedHist.length >= 10) {
        let mean = self.speedHist.reduce((a, b) => a + b, 0) / self.speedHist.length;
        let variance = self.speedHist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / self.speedHist.length;
        let stdDev = Math.sqrt(variance);
        const baselineStd = Math.max(1000, mean * 0.15);
        if (stdDev < baselineStd) stdDev = baselineStd; 
        zScore = (currentSpeed - mean) / stdDev;
    }

    // --- F. TÍNH ALGO LIMIT (CHUẨN QUANT THỰC CHIẾN - CHỐNG TRƯỢT GIÁ) ---
    // [FIX LỖI DEAD] 1. Đo lường chính xác khoảng thời gian thực tế đang có
    let timeSpan = 1;
    if (hist60s.length > 1) {
        timeSpan = (hist60s[hist60s.length - 1].t - hist60s[0].t) / 1000;
    }
    if (timeSpan < 1) timeSpan = 1;
    
    // Tốc độ nền thực tế (Chống lỗi chia cứng 60 gây ép ALGO Limit)
    let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / timeSpan; 
    
    // [FIX LỖI DEAD] 2. Mặc định dùng công thức cũ để chống 0 khi vừa mở Chart
    let algoLimit = currentSpeed * 0.15; 
    
    // Khi đã có đủ dữ liệu (> 5 lệnh), Bật giáp chống Cá voi
    if (hist60s.length > 5) {
        // TÌM LỆNH TRUNG BÌNH CỦA "DÂN THƯỜNG" (TRIMMED MEAN)
        let sortedVols = hist60s.map(x => x.v).sort((a,b) => a - b);
        let limitIdx = Math.floor(sortedVols.length * 0.95);
        let normalVols = sortedVols.slice(0, limitIdx > 0 ? limitIdx : 1);
        let normalTicket = normalVols.reduce((a, b) => a + b, 0) / normalVols.length;

        // THIẾT LẬP GIỚI HẠN KÉP (DUAL-BOUND)
        let baseFlowLimit = avgSpeed60s * 0.25; // Nới lỏng lên 25% cho dễ bơi
        let maxAbsorbLimit = normalTicket * 5;  // Không được đánh to gấp 5 dân thường
        algoLimit = Math.min(baseFlowLimit, maxAbsorbLimit);
    }

    // 3. HỆ SỐ PHẠT TRƯỢT GIÁ (SPREAD PENALTY)
    if (spread <= 0.5) algoLimit *= 1.0;       
    else if (spread <= 1.0) algoLimit *= 0.8;  
    else if (spread <= 2.0) algoLimit *= 0.5;  
    else algoLimit *= 0.2;                     

    // 4. HỆ SỐ PHẠT THỊ TRƯỜNG CHẾT (DEAD MARKET PENALTY)
    if (txPerSec < 1) algoLimit *= 0.3;      
    else if (txPerSec < 3) algoLimit *= 0.6; 

    algoLimit = Math.round(algoLimit);

    // Gửi cục kết quả đã tính xong về lại cho Luồng Chính vẽ UI
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { spread, trend, drop, ofi, zScore, currentSpeed, algoLimit, avgSpeed60s }
    });

}, 1000);
