# BINANCE ALPHA DATA SCHEMAS & API REFERENCE (v3.0 - ULTIMATE EDITION)

Tài liệu này chứa định nghĩa chi tiết TOÀN BỘ cấu trúc dữ liệu (Schema) của hệ sinh thái Binance Alpha, bao gồm API tĩnh (REST) và luồng thời gian thực (WebSocket). Bộ luật này được thiết kế theo tiêu chuẩn HFT (High-Frequency Trading) để đảm bảo độ trễ thấp nhất và độ chính xác tuyệt đối.

## 1. PHÂN LOẠI KHỐI LƯỢNG (THE HOLY TRINITY OF VOLUME)
Hệ thống phải phân biệt rạch ròi 3 luồng dữ liệu thanh khoản. TUYỆT ĐỐI không dùng lẫn lộn:
* **LIMIT Volume (`dataType=limit`):** Khối lượng khớp lệnh thực tế trên Orderbook (CEX) của Binance. Dùng làm dữ liệu lõi ("Sạch") để tính toán các chỉ báo HFT (Z-Score, OFI, VWAP).
* **MARKET Volume (`dataType=market`):** Khối lượng giao dịch On-chain (DEX). Đây là Radar soi dấu chân cá mập chuyển tiền.
* **AGGREGATE Volume (`dataType=aggregate`):** Tổng hợp của Limit + Market. Dùng để hiển thị trên UI cho người dùng xem độ lớn tổng thể của token.

---

## 2. QUY TẮC XỬ LÝ DỮ LIỆU BẮT BUỘC (QUANT RULES)
* **Quy tắc Precision (Sai số):** Toàn bộ dữ liệu giá (`price`) và khối lượng (`volume`) từ Binance trả về dưới dạng **String**. Bắt buộc dùng `BigNumber.js` hoặc cấu trúc ép kiểu an toàn cho các vòng lặp HFT lõi, không dùng `parseFloat()` bừa bãi.
* **Quy tắc Rate Limit:** Tần suất gọi REST API không vượt quá `1 request/giây` cho cùng một endpoint. Luôn ưu tiên dùng WebSocket để hứng dữ liệu Real-time.

---

## 3. REST API REFERENCE

### 3.1. Market Ticker 24h (BAPI)
* **Endpoint:** `GET https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24`
* **Tham số:** `dataType` (`aggregate`, `limit`, `market`).
* **Schema chính:** `alphaId`, `symbol`, `price`, `volume24h`, `count24h`, `marketCap`, `liquidity`, `holders`.

### 3.2. Smart Money & On-chain Analysis (Web3 API)
* **Endpoint:** `GET https://web3.binance.com/bapi/defi/v4/public/wallet-direct/buw/wallet/market/token/dynamic/info`
* **Các biến Track Cá Mập (Smart Labels):**
    * `volume24hBuy`, `volume24hSell`, `volume24hBinance`.
    * `top10HoldersPercentage`, `smartMoneyHolders`, `bundlerHolders`, `newWalletHolders`.

### 3.3. Historical Klines (REST Klines)
* **Endpoint:** `GET .../agg-klines?chainId={id}&interval={int}&limit={l}&tokenAddress={ca}&dataType={type}`
* **Schema:** `[0]: Open Time`, `[1]: Open`, `[2]: High`, `[3]: Low`, `[4]: Close`, `[5]: Volume`, `[6]: Close Time`.

---

## 4. WEBSOCKET STREAMS (COMPREHENSIVE REAL-TIME DATA)

**Base URL:** `wss://nbstream.binance.com/w3w/wsa/stream`
* **Đăng ký (Subscribe):** `{"method": "SUBSCRIBE", "params": ["<stream_name>"], "id": 1}`
* **Hủy đăng ký (Unsubscribe):** `{"method": "UNSUBSCRIBE", "params": ["<stream_name>"], "id": 1}`

### NHÓM 4.1. GLOBAL MARKET & TICKERS (Dữ liệu toàn cảnh)

**1. Alpha Token Global (`came@allTokens@ticker24`)**
Dành riêng cho hệ Alpha (Bao gồm On-chain data).
* `ca`: Contract address@Chain ID
* `p`: Current price
* `vol24`: 24h volume
* `cnt24`: Number of trades (24h)
* `mc`: Market cap
* `fdv`: Fully Diluted Valuation
* `hc`: Number of holders
* `liq`: Liquidity

**2. 24hr Mini Ticker (`<symbol>@miniTicker` hoặc `!miniTicker@arr`)**
Ticker rút gọn nhẹ nhất cho Limit Orderbook. Dùng để cập nhật bảng giá siêu tốc.
* `c`: Close Price (Giá hiện tại)
* `v`: Volume (Base Asset)
* `q`: Quote Volume (Tính bằng USD)
* `h`/`l`/`o`: High/Low/Open Price

**3. 24hr Full Ticker (`<symbol>@ticker` hoặc `!ticker@arr`)**
Ticker chi tiết có chứa số lượng giao dịch và % thay đổi.
* `P`: Price Change Percent (VD: "-2.32")
* `p`: Price Change (Tuyệt đối)
* `w`: Weighted Average Price (VWAP 24h)
* `n`: Trade Number (Số lượng Tx)
* `Q`: Last Trade Volume

### NHÓM 4.2. TRADE FLOW (Dòng chảy Khớp Lệnh)

**4. Raw Trade (`<symbol>@trade`)**
Bắn ra TỪNG LỆNH KHỚP ĐƠN LẺ. Rất nặng, chỉ dùng khi cần đếm Tick siêu chi tiết.
* `p`: Fill Price (Giá khớp)
* `q`: Fill Quantity (Số lượng)
* `m`: Is Buyer Maker? (**Quan trọng: `true` = Lệnh BÁN chủ động; `false` = Lệnh MUA chủ động**).
* `t`: Trade ID

**5. Aggregated Trade (`<symbol>@aggTrade`)**
Gộp các lệnh khớp cùng mức giá trong cùng mili-giây. **(BẮT BUỘC DÙNG CHO THUẬT TOÁN HFT/OFI)**.
* `p`: Price
* `q`: Quantity
* `m`: Is Buyer Maker?
* `f` / `l`: First/Last Trade ID in aggregation.

### NHÓM 4.3. ORDERBOOK DEPTH (Xuyên thấu Sổ lệnh)

**6. Best Book Ticker (`<symbol>@bookTicker` hoặc `!bookTicker`)**
Trả về ngay lập tức Lệnh Mua Cao Nhất (Bid) và Lệnh Bán Thấp Nhất (Ask). **(Dùng để tính Spread 1 mili-giây)**.
* `b`: Best Bid Price (Giá mua cao nhất)
* `B`: Bid Quantity (Khối lượng đang chờ mua)
* `a`: Best Ask Price (Giá bán thấp nhất)
* `A`: Ask Quantity (Khối lượng đang chờ bán)

**7. Partial Depth (`<symbol>@depth<levels>@<interval>`)**
Trả về sổ lệnh hiển thị (UI Orders). `levels` = 5, 10, 20. `interval` = 100ms, 500ms.
* `b`: Mảng Bids (Mua) - `[Price, Quantity]`
* `a`: Mảng Asks (Bán) - `[Price, Quantity]`

**8. Full Depth (`<symbol>@fulldepth@<interval>`)**
Trả về TOÀN BỘ độ sâu sổ lệnh (Bao gồm API bot orders). Rất nặng, dùng để soi "Tường cản giá" (Bid/Ask Walls).


### NHÓM 4.4. KLINES (Nến Lịch sử Thời gian thực)

**9. Standard Symbol Klines (`<symbol>@kline_<interval>`)**
Luồng nến tiêu chuẩn dựa trên cặp giao dịch.
* **Interval hỗ trợ:** `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `6h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`.
* **Schema chi tiết:**
  * `k.c`, `k.o`, `k.h`, `k.l`: Close, Open, High, Low
  * `k.v`: Volume (Base Asset - Số lượng Token)
  * `k.q`: Quote Asset Volume (Khối lượng tính bằng USD).
  * `k.V`: Taker Buy Base Asset Volume (Lượng Mua Chủ Động - Bằng Token).
  * **`k.Q`: Taker Buy Quote Asset Volume (Lượng Mua Chủ Động - TÍNH BẰNG USD). -> BIẾN SỐ SÁT THỦ ĐỂ ĐO ĐỘ FOMO MUA.**
  * `k.x`: Is Kline Complete? (`true` khi đóng nến).

**10. Web3 Contract Klines (`came@<ContractAddress>@<ChainID>@kline_<interval>`)**
Luồng nến theo dõi thông qua địa chỉ Smart Contract và Chain ID (Định dạng Web3).
* **Interval hỗ trợ:** `1s`, `1m`, `5m`, `15m`, `1h`, `4h`, `1d`. (Lưu ý: Hỗ trợ nến siêu ngắn `1s` nhưng tối đa chỉ đến `1d`).
* **Schema `k` rút gọn:** * `c`, `h`, `l`, `o`: Close, High, Low, Open
  * `v`: Volume (Số lượng token)
  * `ot`: Open Time
  * `ct`: Close Time

---

## 5. HƯỚNG DẪN TÍNH TOÁN DÀNH CHO AI (QUANT DEVELOPERS)

* **Tính Cash Flow Thực tế:** Đừng lấy `Price * Base Volume`. Hãy lấy thẳng Quote Asset Volume (`q` hoặc `Q` trong Klines).
* **Đo lường Phe Mua / Phe Bán (Buy/Sell Dominance):** Lấy `k.Q` (Taker Buy Quote Volume) chia cho `k.q` (Total Quote Volume). Nếu tỷ lệ > 50%, phe mua đang chiến thắng tuyệt đối.
* **Tính Spread:** Subscribe `<symbol>@bookTicker`. `Spread % = ((a - b) / b) * 100`.
* **Phát hiện Bơm/Xả (Spoofing):** Dùng `fulldepth`. Nếu một lượng `a` (Ask) cực lớn xuất hiện nhưng giá chưa chạm tới đã biến mất -> Cá mập kê lệnh giả để đè giá.
