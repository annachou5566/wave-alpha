```markdown
# WAVE_ALPHA_AI_RULES.md

## 1. TECH STACK BẮT BUỘC
* **Frontend:** Vanilla JS thuần (Tuyệt đối không dùng React, Vue, hay các thư viện trung gian render DOM).
* **Backend:** Node.js (Express thuần, KHÔNG dùng Socket.io để tiết kiệm băng thông) + Compression.
* **Data Fetcher:** Python (Cloudscraper, Boto3) chạy Cronjob.
* **Storage:** Supabase (PostgreSQL) cho dữ liệu quan hệ và Cloudflare R2 (S3) cho dữ liệu High-Frequency JSON.

---

## 2. TỪ ĐIỂN API & SCHEMAS (ĐÃ XÁC THỰC)

### 2.1. API Lấy Danh Sách Token (BAPI Ticker 24h)
* **Endpoint:** `GET https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24`
* **Params:** `dataType` (`aggregate` cho tổng khối lượng, `limit` cho khối lượng thực tế/hạn mức).
* **Schema Trích Xuất Quan Trọng:**
  ```json
  {
    "data": [{
      "alphaId": "ALPHA_822",
      "symbol": "PLAY",
      "contractAddress": "0x853a7c...",
      "chainId": "8453",
      "price": "0.0455",
      "percentChange24h": "-5.34",
      "volume24h": "646832.89",
      "count24h": "5744", // Số lượng Transaction
      "marketCap": "39590587.52",
      "liquidity": "609234.23",
      "holders": "1675",
      "offline": false, // Trạng thái Delisted/Offline
      "listingCex": false // Trạng thái lên sàn Spot
    }]
  }
  ```

### 2.2. API Lịch Sử Nến & Volume (BAPI Klines)
* **Endpoint:** `GET https://www.binance.com/bapi/defi/v1/public/alpha-trade/agg-klines`
* **Params:** `chainId`, `interval` (1s, 5m, 1h, 1d), `limit`, `tokenAddress`, `dataType` (`aggregate` hoặc `limit`).
* **Schema:** Mảng hai chiều trong `data.klineInfos`.
  * `k[0]`: Open Time (Timestamp ms)
  * `k[1]`: Open Price
  * `k[2]`: High Price
  * `k[3]`: Low Price
  * `k[4]`: Close Price
  * `k[5]`: Volume (USD - Cực kỳ quan trọng để tính Z-Score)
  * `k[6]`: Close Time (Timestamp ms)

### 2.3. API Smart Money Phân Tích Dòng Tiền (BAPI Web3)
* **Endpoint:** `GET https://web3.binance.com/bapi/defi/v4/public/wallet-direct/buw/wallet/market/token/dynamic/info`
* **Params:** `chainId`, `contractAddress`
* **Schema Trích Xuất:**
  ```json
  {
    "data": {
      "volume1hBuy": "187548.96",
      "volume1hSell": "197655.61",
      "count1hBuy": "647",
      "count1hSell": "685",
      "top10HoldersPercentage": "91.75",
      "smartMoneyHolders": "3",
      "smartMoneyHoldingPercent": "0.0033",
      "bundlerHoldingPercent": "0.4503"
    }
  }
  ```

### 2.4. WebSocket Binance (Realtime Market Data Feed)
* **WSS Endpoint:** `wss://nbstream.binance.com/w3w/wsa/stream`
* **Payload Subscribe:** `{"method": "SUBSCRIBE", "params": ["came@allTokens@ticker24"], "id": 1}`
* **Schema Tin Nhắn (`d` array):**
  ```json
  {
    "data": {
      "d": [{
        "ca": "0x8fce7206e3043dd360f115afa956ee31b90b787c@56", // Định dạng: contractAddress@chainId
        "p": "0.072849",  // Current Price
        "vol24": "12930712", // 24h Volume
        "cnt24": 10426,      // 24h Tx Count
        "hc": "6822",        // Holders
        "liq": "1442996"     // Liquidity
      }]
    }
  }
  ```

### 2.5. Internal Node.js APIs (Wave Alpha Backend)
Frontend giao tiếp với Server nội bộ qua các endpoint sau (đã bọc Cache):
* `GET /api/market-data`: Lấy `GLOBAL_MARKET` cache 60s (Fallback nếu R2 lỗi).
* `GET /api/competition-data`: Trả về dữ liệu giải đấu đang active từ Supabase + logic AI Prediction.
* `GET /api/klines`: Proxy gọi API nến của Binance (tránh CORS/Rate limit cho Client).
* `GET /api/smart-money`: Proxy lấy dữ liệu dòng tiền (có cache trên RAM Node.js).

---

## 3. RANH GIỚI DATABASE (STORAGE STRATEGY)

* **Cloudflare R2 (Dữ liệu tĩnh, Tần suất đọc cao):**
  * Lưu trữ `market-data.json`, lịch sử nến, và cấu trúc `tails_cache.json` (suffix sum).
  * Mục tiêu: Đỡ tải cho API Binance, làm bộ nhớ đệm cho Frontend (Client fetch thẳng từ CDN).
* **Supabase (Dữ liệu động, Trạng thái & Giao dịch):**
  * Bảng `tournaments`: Lưu cấu hình giải đấu (Start, End, ChainID, Contract). ID `-1` dùng làm Global Config.
  * Bảng `profiles`, `predictions`, `prediction_votes`: Lưu User Data, số dư, và các lệnh dự đoán khối lượng.
  * Mục tiêu: Logic nghiệp vụ cốt lõi, xác thực người dùng.

### 3.1. Cấu trúc Minify JSON (Python -> R2 -> Frontend)
Để tiết kiệm băng thông, dữ liệu ném lên `market-data.json` đã được rút gọn key. AI khi code Frontend đọc data từ R2 phải tuân thủ map sau:
* `s`: symbol (Tên token)
* `p`: price (Giá hiện tại)
* `v`: volume24h (Khối lượng 24h)
* `c`: count24h (Số lượng giao dịch)
* `mc`: marketCap (Vốn hóa)
* `l`: liquidity (Thanh khoản)
* `r24`: percentChange24h (% thay đổi 24h)

---

## 4. TIÊU CHUẨN TỐI ƯU HIỆU NĂNG FRONTEND (HFT STANDARD)

1. **Vẽ giao diện phi trạng thái (Stateless DOM Updates):** * Không re-render toàn bộ Grid/Table. 
   * Cập nhật thông qua Document Fragment hoặc gán thẳng `.innerText` vào các class/ID định danh sẵn (VD: `.live-price-val`).
2. **Kiểm soát Event Loop (rAF):** * Quá trình render giá realtime từ WebSocket phải được bọc trong `requestAnimationFrame` để khớp với tần số quét của màn hình (tránh nghẽn thread).
3. **Quản lý RAM (Worker Garbage Collection):**
   * Trong các mảng tính toán tần suất cao (Z-Score, VWAP, Spread), TUYỆT ĐỐI KHÔNG dùng `.splice()` hoặc `.shift()` liên tục trên mảng lớn.
   * Cú pháp bắt buộc: Dùng `.filter()` dọn rác theo chu kỳ (Ví dụ: `tickHistory = tickHistory.filter(x => now - x.t <= 60000)`).
4. **Giới hạn kết nối:** * Client chỉ duy trì 1 luồng WebSocket duy nhất tới Binance cho toàn bộ thị trường (`came@allTokens@ticker24`). Không mở WSS riêng lẻ cho từng token.

---

## 5. LƯU Ý RỦI RO & EDGE CASES

* **Cơ Chế Phân Loại Khối Lượng (Limit vs Aggregate):** * Volume hệ thống dùng để tính toán Quant (Z-Score, OFI) phải ưu tiên dựa trên `dataType=limit` (chỉ tính các cặp thanh khoản thật như USDT/USDC/BNB) để lọc bỏ giao dịch Wash Trading. `Aggregate` chỉ dùng cho hiển thị tổng quan.
* **Trạng Thái "Khu Vực Chết" (Tokens Status):**
  * Khi `offline == true` và `listingCex == true`: Token đã chuyển sang sàn Spot giao ngay.
  * Khi `offline == true` và `listingCex == false`: Token bị đánh dấu `PRE_DELISTED`. Cần ping kiểm tra lại volume Limit, nếu Volume = 0 -> Đã chết hẳn (`DELISTED`).
* **Sự cố đứt gãy WebSocket:**
  * WSS của Binance có thể ngắt kết nối định kỳ hoặc khi đổi IP.
  * Phải có cơ chế tự động reconnect với hàm Exponential Backoff (1s -> 2s -> 4s) và khôi phục mảng `clientPriceBuffer`. Giữ mạng sống kể cả khi trình duyệt bị đưa vào background tab (sử dụng Web Worker nếu cần thiết).

---

## 6. CÔNG THỨC QUANT LÕI (QUANT ALGORITHMS)
Toàn bộ logic HFT nằm trong `quant-worker.js`. AI khi can thiệp phải hiểu các định nghĩa sau:
* **Spread (Độ lệch Bid/Ask 15s):** Dựa trên phân vị giá `P90` và `P10`. Công thức: `((P90 - P10) / P10) * 100`.
* **VWAP Trend (Quán tính 60s):** Chia 60s làm 2 nửa, tính VWAP từng nửa. Quán tính = `((vwapNew - vwapOld) / vwapOld) * 100`.
* **Drop (Độ sập 5m):** Lấy đỉnh `P95` trong 5 phút so với giá hiện tại để tính % sụt giảm.
* **OFI (Order Flow Imbalance 15s):** `(BuyVol - SellVol) / TotalVol`.
* **Z-Score (Đột biến khối lượng):** Tính Mean và StdDev trên mảng 60 điểm (mỗi điểm = tốc độ trung bình 5s). `Z-Score = (CurrentSpeed - Mean) / StdDev`.
* **Algo Limit (Bộ lọc Cá Voi - Dual-Bound):**
  * `maxAbsorbLimit` = Trung bình lệnh dân thường x 5.
  * `baseFlowLimit` = Tốc độ trung bình 60s x 0.25.
  * Giới hạn lệnh hợp lệ = `Min(baseFlowLimit, maxAbsorbLimit)`. Bị trừ penalty (20-80%) nếu Spread > 1% hoặc Tx/sec < 1.
```
