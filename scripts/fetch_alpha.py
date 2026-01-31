import requests
import json
import os
from datetime import datetime

# --- CẤU HÌNH API ---
# 1. API Danh sách Token (Lấy Liquidity, Tên, ID)
API_TOKEN_LIST = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
# 2. API Tổng hợp (Lấy Giá, Total Volume chuẩn)
API_AGG_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24?dataType=aggregate"
# 3. API Limit (Lấy Volume Limit)
API_LIMIT_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker"

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

def safe_float(val):
    try:
        return float(val) if val else 0.0
    except:
        return 0.0

def fetch_data():
    print("⏳ Đang tải dữ liệu đa nguồn từ Binance...")
    
    try:
        # A. Lấy Token List (Metadata + Liquidity)
        list_resp = requests.get(API_TOKEN_LIST).json()
        token_map = {}
        if list_resp.get("success"):
            for t in list_resp["data"]:
                if t.get("symbol"):
                    token_map[t["symbol"]] = t

        # B. Lấy Aggregated Data (Total Vol, Price)
        agg_resp = requests.get(API_AGG_TICKER).json()
        agg_data = agg_resp.get("data", [])

        processed_tokens = []
        global_stats = {
            "total_volume_24h": 0,
            "total_limit_volume": 0,
            "total_onchain_volume": 0,
            "active_tokens": 0
        }

        print(f"✅ Đã tải {len(agg_data)} token từ AggTicker. Bắt đầu ghép dữ liệu...")

        for agg in agg_data:
            symbol = agg.get("s")
            # Tìm thông tin trong map (để lấy alphaId, Icon, Liquidity)
            meta = token_map.get(symbol)
            if not meta: continue # Bỏ qua nếu không khớp danh sách chính

            # 1. Total Data (Từ AggTicker)
            price = safe_float(agg.get("c")) # Close price
            total_vol = safe_float(agg.get("q")) # Quote Volume (USDT)
            change_24h = safe_float(agg.get("P")) # Percent change

            # 2. Limit Data (Gọi riêng API Ticker hoặc ước lượng)
            # Để tối ưu tốc độ, ta gọi API Limit cho từng con sẽ rất chậm (500 requests).
            # Giải pháp: Nếu API Agg trả về volume, ta tạm thời lấy Limit Vol từ Meta hoặc 
            # giả lập gọi API Ticker cho Top 20 con volume to nhất thôi.
            # Tuy nhiên, trong code mẫu của bạn dùng API riêng. Ở đây tôi sẽ dùng logic:
            # Limit Vol = QuoteVol trong Ticker Limit (nếu có)
            
            alpha_id = meta.get("alphaId")
            limit_vol = 0.0
            
            # Chỉ gọi Limit Ticker cho các token có volume đáng kể để tránh rate limit
            if total_vol > 1000: 
                try:
                    # Giả định USDT, cần fix nếu là USDC
                    limit_symbol = f"{alpha_id}USDT"
                    limit_url = f"{API_LIMIT_TICKER}?symbol={limit_symbol}"
                    limit_res = requests.get(limit_url, timeout=0.5).json()
                    if limit_res.get("success"):
                        limit_vol = safe_float(limit_res["data"].get("quoteVolume"))
                except:
                    limit_vol = 0.0

            # 3. Liquidity (Từ Token List)
            liquidity = safe_float(meta.get("liquidity"))

            # 4. Tính toán On-chain
            if limit_vol > total_vol: total_vol = limit_vol # Fix lệch pha
            onchain_vol = total_vol - limit_vol
            if onchain_vol < 0: onchain_vol = 0

            # Phân loại nguồn
            source = "On-Chain"
            if limit_vol > 100: source = "Hybrid" if onchain_vol > 100 else "Limit Only"

            token_obj = {
                "id": alpha_id,
                "symbol": symbol,
                "name": meta.get("name", symbol),
                "icon": meta.get("iconUrl"),
                "price": price,
                "change_24h": change_24h,
                "liquidity": liquidity,
                "market_cap": safe_float(meta.get("marketCap")),
                "volume": {
                    "total": total_vol,
                    "limit": limit_vol,
                    "onchain": onchain_vol,
                    "source": source
                }
            }
            
            processed_tokens.append(token_obj)

            # Cộng dồn Global
            global_stats["total_volume_24h"] += total_vol
            global_stats["total_limit_volume"] += limit_vol
            global_stats["total_onchain_volume"] += onchain_vol
            global_stats["active_tokens"] += 1

        # Sắp xếp theo Volume giảm dần
        processed_tokens.sort(key=lambda x: x["volume"]["total"], reverse=True)

        final_data = {
            "last_updated": datetime.now().strftime("%H:%M %d/%m"),
            "global_stats": global_stats,
            "tokens": processed_tokens
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 XONG! Lưu {len(processed_tokens)} token vào {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Lỗi: {str(e)}")

if __name__ == "__main__":
    fetch_data()
