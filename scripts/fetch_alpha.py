import requests
import json
import os
import time
from datetime import datetime

# --- CẤU HÌNH API ---
API_TOKEN_LIST = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
API_AGG_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24?dataType=aggregate"
API_LIMIT_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker"

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

def safe_float(val):
    try:
        return float(val) if val else 0.0
    except:
        return 0.0

def fetch_data():
    print("⏳ Đang tải dữ liệu Alpha Market...")
    
    try:
        # 1. Lấy thông tin cơ bản & Liquidity (Token List)
        try:
            list_resp = requests.get(API_TOKEN_LIST, timeout=10).json()
            token_map = {}
            if list_resp.get("success"):
                for t in list_resp["data"]:
                    symbol = t.get("symbol")
                    if symbol:
                        token_map[symbol] = t
        except Exception as e:
            print(f"⚠️ Lỗi lấy Token List: {e}")
            token_map = {}

        # 2. Lấy dữ liệu Tổng hợp (AggTicker - Giá, Vol Tổng)
        agg_resp = requests.get(API_AGG_TICKER, timeout=10).json()
        agg_data = agg_resp.get("data", [])

        processed_tokens = []
        global_stats = {
            "total_volume_24h": 0,
            "total_limit_volume": 0,
            "total_onchain_volume": 0,
            "active_tokens": 0
        }

        print(f"✅ Đã tìm thấy {len(agg_data)} token. Đang xử lý...")

        # 3. Duyệt và gộp dữ liệu
        for agg in agg_data:
            symbol = agg.get("s")
            meta = token_map.get(symbol)
            
            # Chỉ lấy những token có trong danh sách chính thức
            if not meta: continue 

            # -- DATA CHÍNH --
            price = safe_float(agg.get("c"))      # Giá hiện tại
            total_vol = safe_float(agg.get("q"))  # Volume Tổng (USDT)
            change_24h = safe_float(agg.get("P")) # % Thay đổi
            liquidity = safe_float(meta.get("liquidity")) # Liquidity chuẩn từ API List

            # -- LIMIT VOLUME (Giả lập hoặc lấy từ Ticker) --
            # Để tránh gọi 500 API (bị chặn), ta dùng mẹo:
            # Nếu Token có gắn thẻ "Hot" hoặc Volume lớn > $100k -> Gọi API Ticker check Limit
            # Các token rác nhỏ -> Coi như Limit = 0 (Chỉ On-chain)
            
            limit_vol = 0.0
            alpha_id = meta.get("alphaId")
            
            if total_vol > 50000: # Ngưỡng check Limit
                try:
                    # Giả định cặp USDT (đa số Alpha là USDT)
                    ticker_url = f"{API_LIMIT_TICKER}?symbol={alpha_id}USDT"
                    ticker_res = requests.get(ticker_url, timeout=0.5).json()
                    if ticker_res.get("success") and ticker_res.get("data"):
                        limit_vol = safe_float(ticker_res["data"].get("quoteVolume"))
                except:
                    limit_vol = 0.0

            # -- ON-CHAIN VOLUME --
            # Fix lỗi: Đôi khi API tổng hợp cập nhật chậm hơn API Limit -> Limit > Total
            if limit_vol > total_vol: total_vol = limit_vol * 1.01 
            
            onchain_vol = total_vol - limit_vol
            if onchain_vol < 0: onchain_vol = 0

            # -- XẾP HẠNG & NGUỒN --
            source_type = "On-Chain"
            if limit_vol > 1000: source_type = "Hybrid" if onchain_vol > 1000 else "Limit Only"

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
                    "source": source_type
                }
            }
            
            processed_tokens.append(token_obj)

            # Cộng dồn Global Stats
            global_stats["total_volume_24h"] += total_vol
            global_stats["total_limit_volume"] += limit_vol
            global_stats["total_onchain_volume"] += onchain_vol
            global_stats["active_tokens"] += 1

        # Sắp xếp theo Total Volume giảm dần (Quan trọng cho nút Load More)
        processed_tokens.sort(key=lambda x: x["volume"]["total"], reverse=True)

        final_data = {
            "last_updated": datetime.now().strftime("%H:%M %d/%m"),
            "global_stats": global_stats,
            "tokens": processed_tokens
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 XONG! Dữ liệu đã lưu vào {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Lỗi nghiêm trọng: {str(e)}")

if __name__ == "__main__":
    fetch_data()
