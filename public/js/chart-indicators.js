// ==========================================
// 🚀 FILE: chart-indicators.js - THƯ VIỆN CHỈ BÁO & UI (ĐỘC QUYỀN WAVE ALPHA)
// ==========================================

// 1. ĐĂNG KÝ CÁC CHỈ BÁO TOÁN HỌC (CHẠY 1 LẦN TRƯỚC KHI VẼ CHART)
window.registerWaveIndicators = function() {
    if (!window.klinecharts || typeof window.klinecharts.registerIndicator !== 'function') return;

    // --- CHỈ BÁO 1: WAVE VWAP PRO ---
    window.klinecharts.registerIndicator({
        name: 'VWAP_BANDS',
        shortName: 'VWAP',
        series: 'price',  // Vẽ đè lên biểu đồ giá
        calcParams: [1, 2], // Hệ số Standard Deviation
        figures: [
            { key: 'upper2', title: 'UB2: ', type: 'line' },
            { key: 'upper1', title: 'UB1: ', type: 'line' },
            { key: 'vwap', title: 'VWAP: ', type: 'line' },
            { key: 'lower1', title: 'LB1: ', type: 'line' },
            { key: 'lower2', title: 'LB2: ', type: 'line' }
        ],
        styles: {
            lines: [
                { color: '#0ECB81', size: 1, style: 'dashed' }, 
                { color: '#0ECB81', size: 1, style: 'solid' },  
                { color: '#EAECEF', size: 2, style: 'solid' },  
                { color: '#F6465D', size: 1, style: 'solid' },  
                { color: '#F6465D', size: 1, style: 'dashed' }  
            ]
        },
        calc: (dataList, indicator) => {
            const { calcParams } = indicator;
            const mult1 = calcParams[0]; const mult2 = calcParams[1];
            let cumVol = 0; let cumVolPrice = 0; let cumVolPriceSq = 0;

            return dataList.map((kLineData, i) => {
                const currentDay = new Date(kLineData.timestamp).getDate();
                const prevDay = i > 0 ? new Date(dataList[i - 1].timestamp).getDate() : currentDay;

                if (currentDay !== prevDay) { cumVol = 0; cumVolPrice = 0; cumVolPriceSq = 0; }

                const typicalPrice = (kLineData.high + kLineData.low + kLineData.close) / 3;
                const vol = kLineData.volume || 0;

                cumVol += vol; cumVolPrice += typicalPrice * vol; cumVolPriceSq += vol * typicalPrice * typicalPrice;
                if (cumVol === 0) return {};

                const vwap = cumVolPrice / cumVol;
                const variance = Math.max(0, (cumVolPriceSq / cumVol) - (vwap * vwap));
                const sd = Math.sqrt(variance);

                return {
                    upper2: vwap + sd * mult2, upper1: vwap + sd * mult1, vwap: vwap,
                    lower1: vwap - sd * mult1, lower2: vwap - sd * mult2,
                };
            });
        }
    });

    console.log("🟢 Đã tải thành công Thư viện Chỉ báo Wave Alpha");
};


// 2. GIAO DIỆN UI TÌM KIẾM & QUẢN LÝ CHỈ BÁO
window.initExpertUI = function() {
    // Inject Modal
    if (!document.getElementById('sc-indicator-modal')) {
        const modalHtml = `
        <div id="sc-indicator-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); z-index: 99999; backdrop-filter: blur(5px); justify-content: center; align-items: center;">
            <div style="background: #1e2329; width: 600px; max-width: 90%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.9); display: flex; flex-direction: column; overflow: hidden;">
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <h5 style="margin: 0; color: #EAECEF; font-size: 16px; font-weight: 700;"><i class="fas fa-wave-square" style="color: #00F0FF; margin-right: 8px;"></i> Các chỉ báo & Chiến lược</h5>
                    <button onclick="document.getElementById('sc-indicator-modal').style.display='none'" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 16px; transition: 0.2s;" onmouseover="this.style.color='#F6465D'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-times"></i></button>
                </div>
                <div style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div style="position: relative;">
                        <i class="fas fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #848e9c;"></i>
                        <input type="text" placeholder="Tìm kiếm chỉ báo..." style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px 8px 35px; color: #EAECEF; outline: none; font-size: 13px;">
                    </div>
                </div>
                <div style="display: flex; height: 350px;">
                    <div style="width: 180px; background: rgba(0,0,0,0.15); border-right: 1px solid rgba(255,255,255,0.05); padding: 10px 0;">
                        <div style="padding: 10px 20px; color: #EAECEF; cursor: pointer; font-size: 13px; font-weight: 600; border-left: 3px solid #00F0FF; background: rgba(0,240,255,0.05);">Chỉ báo Mặc định</div>
                        <div style="padding: 10px 20px; color: #848e9c; font-size: 13px; font-weight: 600; border-left: 3px solid transparent; cursor: pointer;">Độc quyền Wave Alpha <i class="fas fa-lock" style="font-size: 10px; margin-left: 5px; color: #F6465D;"></i></div>
                    </div>
                    <div style="flex: 1; padding: 10px 20px; overflow-y: auto;">
                        <div onclick="window.addIndicatorToChart('VWAP_BANDS')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(0, 240, 255, 0.1)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #00F0FF; font-size: 14px; font-weight: 700;">Wave VWAP Pro <i class="fas fa-crown" style="font-size: 10px; color: #F0B90B; margin-left: 5px;"></i></div>
                            <div style="color: #848e9c; font-size: 11px;">VWAP Anchored Daily kèm Bands</div>
                        </div>
                        <div onclick="window.addIndicatorToChart('MACD')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #EAECEF; font-size: 14px; font-weight: 600;">MACD</div>
                            <div style="color: #848e9c; font-size: 11px;">Moving Average Convergence Divergence</div>
                        </div>
                        <div onclick="window.addIndicatorToChart('RSI')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #EAECEF; font-size: 14px; font-weight: 600;">RSI</div>
                            <div style="color: #848e9c; font-size: 11px;">Relative Strength Index</div>
                        </div>
                        <div onclick="window.addIndicatorToChart('EMA')" style="padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: 0.2s; border-radius: 6px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                            <div style="color: #EAECEF; font-size: 14px; font-weight: 600;">EMA</div>
                            <div style="color: #848e9c; font-size: 11px;">Đường Trung bình Động Lũy thừa</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div.firstElementChild);
    }

    // Inject Topbar Button
    if (!document.getElementById('btn-fx-indicator')) {
        let timeBtnLists = document.querySelectorAll('.sc-time-btn');
        if (timeBtnLists.length > 0) {
            let topbarContainer = timeBtnLists[0].parentElement;
            let fxBtnHtml = `
                <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 10px;"></div>
                <button id="btn-fx-indicator" class="btn btn-sm" onclick="window.openIndicatorModal()" style="background: transparent; color: #848e9c; border: none; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: 0.2s;" onmouseover="this.style.color='#00F0FF'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-wave-square"></i> Chỉ báo</button>
                <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 10px;"></div>
                <button onclick="window.tvChart.createOverlay('trendLine')" title="Vẽ Trendline" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 13px; transition: 0.2s;" onmouseover="this.style.color='#0ECB81'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-chart-line"></i></button>
                <button onclick="window.tvChart.createOverlay('fibonacciLine')" title="Vẽ Fibonacci" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 13px; transition: 0.2s;" onmouseover="this.style.color='#0ECB81'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-align-center"></i></button>
                <button onclick="window.clearUserDrawings()" title="Xóa hình vẽ" style="background: transparent; border: none; color: #848e9c; cursor: pointer; font-size: 13px; transition: 0.2s;" onmouseover="this.style.color='#F6465D'" onmouseout="this.style.color='#848e9c'"><i class="fas fa-trash-alt"></i></button>
            `;
            topbarContainer.insertAdjacentHTML('beforeend', fxBtnHtml);
        }
    }
};

window.openIndicatorModal = function() {
    let modal = document.getElementById('sc-indicator-modal');
    if (modal) modal.style.display = 'flex';
};

window.addIndicatorToChart = function(indName) {
    if (!window.tvChart) return;
    document.getElementById('sc-indicator-modal').style.display = 'none'; 
    try {
        if (indName === 'EMA' || indName === 'VWAP_BANDS') {
            window.tvChart.createIndicator(indName, true, { id: 'candle_pane' }); 
        } else {
            window.tvChart.createIndicator(indName, false, { id: 'pane_' + indName.toLowerCase() }); 
        }
    } catch (e) {}
};