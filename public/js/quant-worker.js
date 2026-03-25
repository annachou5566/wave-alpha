// =================================================================
// 🧠 QUANT WORKER V5 - INSTITUTIONAL HFT ENGINE
// =================================================================

let tickHistory = [];
let klineData = {}; // K-line buffer cho k.Q (Quote Volume)
let bookDepth = { bid: 0, ask: 0, spread: 0 }; 

// Z-Score 60 điểm x 5s
let volumeBuckets = []; 
let currentBucket = { t: 0, vol: 0 };

self.onmessage = function(e) {
    const msg = e.data;
    const now = Date.now();

    if (msg.cmd === 'INIT') {
        tickHistory = [];
        volumeBuckets = [];
        bookDepth = { bid: 0, ask: 0, spread: 0 };
    }
    
    // Luồng 1: @aggTrade (Khớp lệnh thực tế HFT)
    else if (msg.cmd === 'TICK') {
        // msg.data: { p: float, q: float, m: bool (true = sell), t: ms }
        tickHistory.push(msg.data); 
        
        // Cập nhật Bucket 5s cho Z-Score
        let bucketTime = Math.floor(now / 5000) * 5000;
        if (currentBucket.t !== bucketTime) {
            if (currentBucket.t !== 0) volumeBuckets.push({...currentBucket});
            currentBucket = { t: bucketTime, vol: 0 };
            
            // Dọn rác: Giữ đúng 60 điểm (5 phút) bằng filter (Tuân thủ rule AI)
            volumeBuckets = volumeBuckets.filter(x => now - x.t <= 300000); 
        }
        currentBucket.vol += (msg.data.p * msg.data.q);
    }
    
    // Luồng 2: @bookTicker (Xuyên thấu sổ lệnh - Tính Spread mili-giây)
    else if (msg.cmd === 'BOOK_TICKER') {
        let b = Number(msg.data.b);
        let a = Number(msg.data.a);
        if (b > 0) {
            bookDepth.spread = ((a - b) / b) * 100;
            bookDepth.bidVol = b * Number(msg.data.B);
            bookDepth.askVol = a * Number(msg.data.A);
        }
    }

    // Luồng 3: @kline (Nhận diện Đỉnh FOMO qua Quote Asset)
    else if (msg.cmd === 'KLINE') {
        klineData = msg.data; // Cập nhật nến gần nhất (chứa k.Q, k.q)
    }
};

// Vòng lặp HFT (250ms/lần)
setInterval(() => {
    const now = Date.now();
    
    // DỌN RÁC BỘ NHỚ (Chỉ giữ 60s cho Tick History để tính CVD/OFI siêu nhạy)
    tickHistory = tickHistory.filter(x => now - x.t <= 60000);
    
    if (tickHistory.length === 0) return;

    const hist1s = tickHistory.filter(x => now - x.t <= 1000);
    const hist15s = tickHistory.filter(x => now - x.t <= 15000);
    
    const lastPrice = tickHistory[tickHistory.length - 1].p;

    // ==========================================
    // A. SPREAD & LIQUIDITY VACUUM (MM RADAR)
    // ==========================================
    let currentSpread = bookDepth.spread;
    let isLiquidityVacuum = false;
    // Nếu spread giãn rộng trên 0.5% ở khung tick, MM đang nhấc lệnh
    if (currentSpread > 0.5 && (bookDepth.bidVol + bookDepth.askVol) < 5000) {
        isLiquidityVacuum = true; 
    }

    // ==========================================
    // B. VWAP TREND (60s Halved theo chuẩn Rule)
    // ==========================================
    let trend = 0;
    const midPointTime = now - 30000; // Cắt đôi 60s
    const vwapRecent = tickHistory.filter(x => x.t >= midPointTime);
    const vwapOld = tickHistory.filter(x => x.t < midPointTime);

    let vwapFast = vwapRecent.reduce((s, x) => s + x.p * x.q, 0) / (vwapRecent.reduce((s, x) => s + x.q, 0) || 1);
    let vwapSlow = vwapOld.reduce((s, x) => s + x.p * x.q, 0) / (vwapOld.reduce((s, x) => s + x.q, 0) || 1);
    
    if (vwapSlow > 0 && vwapFast > 0) {
        trend = ((vwapFast - vwapSlow) / vwapSlow) * 100;
    }

    // ==========================================
    // C. DYNAMIC OFI & MICRO CVD
    // ==========================================
    let buyVol15s = 0, sellVol15s = 0;
    hist15s.forEach(x => {
        let volUSD = x.p * x.q;
        if (!x.m) buyVol15s += volUSD; // m = false -> Taker Buy
        else sellVol15s += volUSD;     // m = true -> Taker Sell
    });
    
    let totalVol15s = buyVol15s + sellVol15s;
    let trueOFI = totalVol15s > 0 ? (buyVol15s - sellVol15s) / totalVol15s : 0;
    let microCVD = buyVol15s - sellVol15s; // USD chênh lệch

    // ==========================================
    // D. INSTITUTIONAL Z-SCORE (60 buckets)
    // ==========================================
    let zScore = 0;
    let currentSpeed1s = hist1s.reduce((s, x) => s + (x.p * x.q), 0);
    
    if (volumeBuckets.length >= 12) { // Tối thiểu 1 phút (12 buckets * 5s)
        let mean = volumeBuckets.reduce((a, b) => a + b.vol, 0) / volumeBuckets.length;
        let variance = volumeBuckets.reduce((a, b) => a + Math.pow(b.vol - mean, 2), 0) / volumeBuckets.length;
        let stdDev = Math.max(Math.sqrt(variance), mean * 0.05); // Bảo vệ chia Zero
        
        // Z-score tính tốc độ hiện tại (quy đổi về hệ quy chiếu 5s) so với phân phối chuẩn
        zScore = ((currentSpeed1s * 5) - mean) / stdDev; 
    }

    // ==========================================
    // E. ACTIONABLE ZONES (CỜ TÍN HIỆU GIAO DỊCH)
    // ==========================================
    let isAbsorption = false;
    let isDistribution = false;

    // 1. Dấu hiệu gom hàng (Absorption)
    // CVD âm nặng (Taker bán mạnh) nhưng giá không rơi (trend >= 0) -> Đáy cứng
    if (trueOFI < -0.6 && microCVD < -10000 && trend > -0.05 && currentSpread < 0.2) {
        isAbsorption = true;
    }

    // 2. Dấu hiệu xả đỉnh (Distribution)
    // FOMO Mua chủ động chiếm > 75% khối lượng (k.Q / k.q), nhưng giá không tăng
    if (klineData && klineData.q > 0) {
        let takerBuyRatio = Number(klineData.Q) / Number(klineData.q);
        if (takerBuyRatio > 0.75 && trueOFI > 0.5 && trend < 0.05) {
            isDistribution = true;
        }
    }

    // POST MESSAGE VỀ TRÌNH DUYỆT (UI Stateless Render)
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread: currentSpread.toFixed(3), 
            trend: trend.toFixed(3), 
            ofi: trueOFI.toFixed(3), 
            zScore: zScore.toFixed(2), 
            microCVD,
            isLiquidityVacuum,
            isAbsorption,
            isDistribution
        }
    });

}, 250);
