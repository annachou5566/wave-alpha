/**
 * =================================================================
 * 🎨 CHART UI V1.0 - DECOUPLED RENDERING LAYER
 * =================================================================
 * Nhiệm vụ:
 * - Khởi tạo và quản lý LightweightCharts.
 * - Lắng nghe sự kiện từ ChartEngine để vẽ OHLCV & Volume.
 * - Lắng nghe sự kiện từ Controller để vẽ HFT Markers (Đỉnh/Đáy/Iceberg).
 * - Quản lý Tooltip, Crosshair và Resize.
 */

(function(window) {
    'use strict';

    class ChartUICore {
        constructor() {
            this.chart = null;
            this.candleSeries = null;
            this.volumeSeries = null;
            this.container = null;
            this.tooltip = null;

            this._setupEventListeners();
        }

        // ==========================================
        // 1. KHỞI TẠO BIỂU ĐỒ (Gọi 1 lần duy nhất)
        // ==========================================
        init(containerId) {
            this.container = document.getElementById(containerId);
            if (!this.container) {
                console.error(`[ChartUI] Không tìm thấy container #${containerId}`);
                return;
            }

            // Xóa nội dung cũ nếu có
            this.container.innerHTML = '';

            // Cấu hình giao diện chuẩn HFT Terminal (Dark mode)
            this.chart = LightweightCharts.createChart(this.container, {
                width: this.container.clientWidth,
                height: this.container.clientHeight,
                layout: {
                    background: { type: 'solid', color: '#131722' },
                    textColor: '#d1d4dc',
                },
                grid: {
                    vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                    horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                },
                rightPriceScale: {
                    borderColor: 'rgba(197, 203, 206, 0.8)',
                },
                timeScale: {
                    borderColor: 'rgba(197, 203, 206, 0.8)',
                    timeVisible: true,
                    secondsVisible: false,
                },
            });

            // Khởi tạo Series Nến
            this.candleSeries = this.chart.addCandlestickSeries({
                upColor: '#0ECB81',
                downColor: '#F6465D',
                borderDownColor: '#F6465D',
                borderUpColor: '#0ECB81',
                wickDownColor: '#F6465D',
                wickUpColor: '#0ECB81',
            });

            // Khởi tạo Series Volume
            this.volumeSeries = this.chart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: '', // Đặt volume ở dưới cùng
                scaleMargins: {
                    top: 0.8, // Chiếm 20% chiều cao biểu đồ ở dưới cùng
                    bottom: 0,
                },
            });

            this._setupResizeHandler();
            console.log('[ChartUI] Đã khởi tạo thành công.');
        }

        // ==========================================
        // 2. LẮNG NGHE SỰ KIỆN TỪ ENGINE & CONTROLLER
        // ==========================================
        _setupEventListeners() {
            // Lắng nghe: Khi ChartEngine tải xong lịch sử
            document.addEventListener('ENGINE_DATA_READY', (e) => {
                const { candles, volumes } = e.detail;
                this.renderHistoricalData(candles, volumes);
            });

            // Lắng nghe: Khi ChartEngine có nến/tick mới realtime
            document.addEventListener('ENGINE_CANDLE_UPDATED', (e) => {
                const { candle, volume } = e.detail;
                this.updateRealtimeData(candle, volume);
            });

            // Lắng nghe: Khi QuantWorker báo có tín hiệu HFT (Đỉnh/Đáy)
            document.addEventListener('RENDER_HFT_MARKERS', (e) => {
                this.drawMarkers(e.detail);
            });
        }

        // ==========================================
        // 3. LOGIC VẼ DỮ LIỆU
        // ==========================================
        renderHistoricalData(candles, volumes) {
            if (!this.candleSeries || !this.volumeSeries) return;
            
            this.candleSeries.setData(candles);
            this.volumeSeries.setData(volumes);
            
            // Tự động fit màn hình để thấy hết nến
            this.chart.timeScale().fitContent();
        }

        updateRealtimeData(candleObj, volumeObj) {
            if (!this.candleSeries || !this.volumeSeries) return;

            this.candleSeries.update(candleObj);
            this.volumeSeries.update(volumeObj);
        }

        drawMarkers(markersArray) {
            if (!this.candleSeries) return;
            // markersArray format: [{ time: 1612345678, position: 'aboveBar', color: '#e91e63', shape: 'arrowDown', text: 'Sell' }]
            this.candleSeries.setMarkers(markersArray);
        }

        // ==========================================
        // 4. TIỆN ÍCH
        // ==========================================
        clearSeries() {
            if (this.candleSeries) this.candleSeries.setData([]);
            if (this.volumeSeries) this.volumeSeries.setData([]);
        }

        _setupResizeHandler() {
            window.addEventListener('resize', () => {
                if (this.chart && this.container) {
                    this.chart.applyOptions({ 
                        width: this.container.clientWidth, 
                        height: this.container.clientHeight 
                    });
                }
            });
        }
    }

    // Expose ra Global Scope
    window.ChartUI = new ChartUICore();

})(window);
