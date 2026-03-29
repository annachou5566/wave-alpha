/**
 * =================================================================
 * ⚙️ CHART ENGINE V1.0 - DECOUPLED DATA LAYER
 * =================================================================
 * Nhiệm vụ:
 * - Quản lý State của OHLCV, Volume, EMA...
 * - Xử lý data từ REST API (Lịch sử) và WebSocket (Realtime).
 * - Giao tiếp với Controller/View thông qua CustomEvent Bus.
 * - HOÀN TOÀN KHÔNG CHẠM VÀO DOM HAY LIGHTWEIGHT-CHARTS.
 */

(function(window) {
    'use strict';

    class ChartEngineCore {
        constructor() {
            this.currentSymbol = null;
            this.currentInterval = '1m';
            
            // Data Store
            this.candleData = [];
            this.volumeData = [];
            this.latestCandle = null;
            
            // Listeners
            this._setupEventListeners();
        }

        // ==========================================
        // 1. EVENT BUS SETUP (Lắng nghe lệnh từ pro-mode.js)
        // ==========================================
        _setupEventListeners() {
            // Lắng nghe lệnh khởi tạo/đổi symbol
            document.addEventListener('ENGINE_LOAD_SYMBOL', (e) => {
                const { symbol, interval } = e.detail;
                this.loadSymbol(symbol, interval);
            });

            // Lắng nghe stream KLINE từ WebSocket master
            document.addEventListener('WS_KLINE_STREAM', (e) => {
                this.processRealtimeKline(e.detail);
            });

            // Lắng nghe stream TICK từ WebSocket master (Để build nến realtime sub-second)
            document.addEventListener('WS_TICK_STREAM', (e) => {
                this.aggregateTickToCandle(e.detail);
            });
        }

        // ==========================================
        // 2. CORE LOGIC: NẠP DỮ LIỆU LỊCH SỬ
        // ==========================================
        async loadSymbol(symbol, interval = '1m') {
            if (!symbol) return;
            
            this.currentSymbol = symbol;
            this.currentInterval = interval;
            this.clearData();

            try {
                // TODO: Thay URL này bằng endpoint chuẩn của Binance Alpha / Backend của bạn
                const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
                const response = await fetch(url);
                const data = await response.json();

                this._parseHistoricalData(data);

                // Thông báo cho View biết data đã sẵn sàng để vẽ lần đầu
                document.dispatchEvent(new CustomEvent('ENGINE_DATA_READY', {
                    detail: {
                        candles: this.candleData,
                        volumes: this.volumeData
                    }
                }));

            } catch (error) {
                console.error('[ChartEngine] Lỗi fetch lịch sử:', error);
            }
        }

        _parseHistoricalData(rawKlines) {
            this.candleData = [];
            this.volumeData = [];

            for (let i = 0; i < rawKlines.length; i++) {
                const k = rawKlines[i];
                const time = k[0] / 1000; // LightweightCharts dùng timestamp giây
                const open = parseFloat(k[1]);
                const high = parseFloat(k[2]);
                const low = parseFloat(k[3]);
                const close = parseFloat(k[4]);
                const volume = parseFloat(k[5]);

                const candle = { time, open, high, low, close };
                this.candleData.push(candle);

                const color = close >= open ? 'rgba(14, 203, 129, 0.5)' : 'rgba(246, 70, 93, 0.5)';
                this.volumeData.push({ time, value: volume, color });
                
                if (i === rawKlines.length - 1) {
                    this.latestCandle = { ...candle, volume };
                }
            }
        }

        // ==========================================
        // 3. CORE LOGIC: XỬ LÝ DỮ LIỆU REALTIME
        // ==========================================
        processRealtimeKline(msg) {
            if (!msg.k || msg.s !== this.currentSymbol) return;

            const k = msg.k;
            const time = k.t / 1000;
            const open = parseFloat(k.o);
            const high = parseFloat(k.h);
            const low = parseFloat(k.l);
            const close = parseFloat(k.c);
            const volume = parseFloat(k.v);

            this.latestCandle = { time, open, high, low, close, volume };

            // Thông báo cho View update cây nến hiện tại
            this._broadcastUpdate(this.latestCandle);
        }

        aggregateTickToCandle(tick) {
            if (!this.latestCandle || tick.s !== this.currentSymbol) return;

            const price = parseFloat(tick.p);
            const vol = parseFloat(tick.q);

            // Update đỉnh đáy và giá đóng cửa tạm thời
            let isUpdated = false;
            if (price > this.latestCandle.high) { this.latestCandle.high = price; isUpdated = true; }
            if (price < this.latestCandle.low) { this.latestCandle.low = price; isUpdated = true; }
            
            if (price !== this.latestCandle.close) {
                this.latestCandle.close = price;
                isUpdated = true;
            }

            this.latestCandle.volume += vol;

            // Bắn event với tần suất cao (sub-second)
            if (isUpdated) {
                this._broadcastUpdate(this.latestCandle);
            }
        }

        _broadcastUpdate(candleObj) {
            const color = candleObj.close >= candleObj.open ? 'rgba(14, 203, 129, 0.8)' : 'rgba(246, 70, 93, 0.8)';
            
            document.dispatchEvent(new CustomEvent('ENGINE_CANDLE_UPDATED', {
                detail: {
                    candle: {
                        time: candleObj.time,
                        open: candleObj.open,
                        high: candleObj.high,
                        low: candleObj.low,
                        close: candleObj.close
                    },
                    volume: {
                        time: candleObj.time,
                        value: candleObj.volume,
                        color: color
                    }
                }
            }));
        }

        // ==========================================
        // 4. TIỆN ÍCH & CLEANUP
        // ==========================================
        getLatestTime() {
            return this.latestCandle ? this.latestCandle.time : null;
        }

        clearData() {
            this.candleData = [];
            this.volumeData = [];
            this.latestCandle = null;
        }
    }

    // Expose ra Global Scope
    window.ChartEngine = new ChartEngineCore();

})(window);
