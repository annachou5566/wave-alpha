// =================================================================
// 🧠 QUANT WORKER V6 - INSTITUTIONAL HFT ENGINE (CRASH-FREE)
// =================================================================

let tickHistory = [];
let bookDepth = { bid: 0, ask: 0, spread: 0 }; 
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
    else if (msg.cmd === 'TICK') {
        // msg.data: { t: ms, p: float, q: float, v: float, dir: bool }
        tickHistory.push(msg.data); 
        
        // Cập nhật Bucket 5s cho Z-Score
        let bucketTime = Math.floor(now / 5000) * 5000;
        if (currentBucket.t !== bucketTime) {
            if (currentBucket.t !== 0) volumeBuckets.push({...currentBucket});
            currentBucket = { t: bucketTime, vol: 0 };
            
            // Dọn rác: Giữ đúng 60 điểm (5 phút)
            volumeBuckets = volumeBuckets.filter(x => now - x.t <= 300000); 
        }
        currentBucket.vol += (msg.data.v || (msg.data.p * msg.data.q));
    }
    else if (msg.cmd === 'BOOK_TICKER') {
        let b = Number(msg.data.b);
        let a = Number(msg.data.a);
        if (b > 0) {
            bookDepth.spread = ((a - b) / b) * 100;
        }
    }
};

// Vòng lặp HFT (250ms/lần)
setInterval(() => {
    const now = Date.now();
    
    // DỌN RÁC BỘ NHỚ: Giữ 5 phút (300,000ms) để tính toán đủ Drop và Z-Score
    tickHistory = tickHistory.filter(x => now - x.t <= 300000);
    
    if (tickHistory.length === 0) return;

    // Phân rã khung thời gian
    const hist1s = tickHistory.filter(x => now - x.t <= 1000);
    const hist15s = tickHistory.filter(x => now - x.t <= 15000);
    const hist60s = tickHistory.filter(x => now - x.t <= 60000);
    
    const lastPrice = tickHistory[tickHistory.length - 1].p;

    // ==========================================
    // A. SPREAD THỜI GIAN THỰC
    // ==========================================
    let currentSpread = bookDepth.spread || 0;

    // ==========================================
    // B. DROP (5m) - ĐỘ SẬP GIÁ
    // ==========================================
    let drop = 0;
    if (tickHistory.length > 5) {
        let prices5m = tickHistory.map(x => x.p).sort((a,b) => a - b);
        let peakP99 = prices5m[Math.floor(prices5m.length * 0.99)];
        if (peakP99 > 0) drop = ((lastPrice - peakP99) / peakP99) * 100;
    }

    // ==========================================
    // C. VWAP TREND (60s Halved)
    // ==========================================
    let trend = 0;
    const midPointTime = now - 30000;
    const vwapRecent = hist60s.filter(x => x.t >= midPointTime);
    const vwapOld = hist60s.filter(x => x.t < midPointTime);

    let vwapFast = vwapRecent.reduce((s, x) => s + x.p * x.v, 0) / (vwapRecent.reduce((s, x) => s + x.v, 0) || 1);
    let vwapSlow = vwapOld.reduce((s, x) => s + x.p * x.v, 0) / (vwapOld.reduce((s, x) => s + x.v, 0) || 1);
    
    if (vwapSlow > 0 && vwapFast > 0) {
        trend = ((vwapFast - vwapSlow) / vwapSlow) * 100;
    }

    // ==========================================
    // D. DYNAMIC OFI, MICRO CVD & BUY DOMINANCE
    // ==========================================
    let buyVol15s = 0, sellVol15s = 0;
    hist15s.forEach(x => {
        if (x.dir) buyVol15s += x.v;
        else sellVol15s += x.v;
    });
    
    let totalVol15s = buyVol15s + sellVol15s;
    let trueOFI = totalVol15s > 0 ? (buyVol15s - sellVol15s) / totalVol15s : 0;
    let microCVD = buyVol15s - sellVol15s;
    let buyDominance = totalVol15s > 0 ? (buyVol15s / totalVol15s) * 100 : 50;

    // ==========================================
    // E. INSTITUTIONAL Z-SCORE & TỐC ĐỘ GIAO DỊCH
    // ==========================================
    let currentSpeed = hist1s.reduce((s, x) => s + x.v, 0); // Tốc độ USD / 1 giây
    let avgSpeed60s = hist60s.reduce((s, x) => s + x.v, 0) / 60; // Tốc độ trung bình USD / giây
    
    let zScore = 0;
    if (volumeBuckets.length >= 12) { // Tối thiểu 1 phút
        let mean = volumeBuckets.reduce((a, b) => a + b.vol, 0) / volumeBuckets.length;
        let variance = volumeBuckets.reduce((a, b) => a + Math.pow(b.vol - mean, 2), 0) / volumeBuckets.length;
        let stdDev = Math.max(Math.sqrt(variance), mean * 0.05); // Bảo vệ chia Zero
        zScore = ((currentSpeed * 5) - mean) / stdDev; 
    }

    // ==========================================
    // F. ALGO LIMIT (BỘ LỌC CÁ VOI KÉP)
    // ==========================================
    let algoLimit = avgSpeed60s * 0.25; 
    if (hist60s.length > 5) {
        let sortedVols = hist60s.map(x => x.v).sort((a,b) => a - b);
        let limitIdx = Math.floor(sortedVols.length * 0.85); // Lọc bỏ 15% lệnh Cá
        let normalVols = sortedVols.slice(0, limitIdx > 0 ? limitIdx : 1);
        let normalTicket = normalVols.reduce((a, b) => a + b, 0) / normalVols.length;

        let baseFlowLimit = avgSpeed60s * 0.40; 
        let maxAbsorbLimit = normalTicket * 3;  
        algoLimit = Math.min(baseFlowLimit, maxAbsorbLimit);
    }
    algoLimit = Math.max(20, Math.round(algoLimit));

    // ==========================================
    // G. TRẢ VỀ TOÀN BỘ DATA (BẮT BUỘC LÀ NUMBER ĐỂ KHÔNG CRASH UI)
    // ==========================================
    self.postMessage({
        cmd: 'STATS_UPDATE',
        stats: { 
            spread: Number(currentSpread) || 0,
            trend: Number(trend) || 0,
            drop: Number(drop) || 0,
            ofi: Number(trueOFI) || 0,
            zScore: Number(zScore) || 0,
            currentSpeed: Number(currentSpeed) || 0,
            algoLimit: Number(algoLimit) || 0,
            avgSpeed60s: Number(avgSpeed60s) || 0,
            buyDominance: Number(buyDominance) || 50,
            microCVD: Number(microCVD) || 0
        }
    });

}, 250);
