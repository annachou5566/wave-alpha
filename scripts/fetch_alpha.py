import requests
import json
import os
from datetime import datetime

# --- HEADERS ---
FAKE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "client-type": "web",
    "content-type": "application/json"
}

# CHỈ CẦN DÙNG ĐÚNG 1 API NÀY (VÌ NÓ ĐÃ CÓ ĐỦ DỮ LIỆU)
API_AGG_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24?dataType=aggregate"
# API Limit (để tách volume nếu cần)
API_LIMIT_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker"

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

def safe_float(val):
    try:
        return float(val) if val else 0.0
    except:
        return 0.0

def fetch_data():
    print("🚀 Bắt đầu lấy dữ liệu Alpha Market (Direct Parse)...")
    
    try:
        # Gọi API
        resp = requests.get(API_AGG_TICKER, headers=FAKE_HEADERS, timeout=15)
        raw_data = resp.json().get("data", [])
        
        if not raw_data:
            print("❌ API trả về rỗng!")
            return

        print(f"   ✅ Tìm thấy {len(raw_data)} token.")

        processed_tokens = []
        global_stats = {
            "total_volume_24h": 0,
            "total_limit_volume": 0,
            "total_onchain_volume": 0,
            "active_tokens": 0
        }

        # XỬ LÝ DỮ LIỆU (Dựa trên LOG thực tế của bạn)
        for item in raw_data:
            symbol = item.get("symbol")
            if not symbol: continue

            # Lấy dữ liệu trực tiếp từ JSON (Theo đúng log bạn gửi)
            price = safe_float(item.get("price"))
            total_vol = safe_float(item.get("volume24h"))
            change_24h = safe_float(item.get("percentChange24h"))
            liquidity = safe_float(item.get("liquidity"))
            market_cap = safe_float(item.get("marketCap"))
            
            alpha_id = item.get("alphaId")
            icon = item.get("iconUrl")
            name = item.get("name")

            # --- TÍNH TOÁN LIMIT / ON-CHAIN ---
            # Mặc định lấy Total làm On-chain trước
            limit_vol = 0.0
            
            # Logic thông minh: Nếu Token có alphaId, thử check xem có Limit Volume không
            # (Chỉ check với top token volume lớn > 50k để tối ưu tốc độ)
            if total_vol > 50000 and alpha_id:
                try:
                    limit_url = f"{API_LIMIT_TICKER}?symbol={alpha_id}USDT"
                    limit_res = requests.get(limit_url, headers=FAKE_HEADERS, timeout=0.3).json()
                    if limit_res.get("success"):
                        limit_vol = safe_float(limit_res["data"].get("quoteVolume"))
                except:
                    pass

            # Fix logic số liệu
            if limit_vol > total_vol: limit_vol = total_vol * 0.9 # Limit không thể lớn hơn tổng
            onchain_vol = total_vol - limit_vol
            if onchain_vol < 0: onchain_vol = 0

            # Tạo Object
            token_obj = {
                "id": alpha_id,
                "symbol": symbol,
                "name": name,
                "icon": icon,
                "price": price,
                "change_24h": change_24h,
                "liquidity": liquidity,
                "market_cap": market_cap,
                "volume": {
                    "total": total_vol,
                    "limit": limit_vol,
                    "onchain": onchain_vol,
                    "source": "Hybrid" if limit_vol > 0 else "On-Chain"
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
            
        print(f"🎉 XONG! Đã lưu {len(processed_tokens)} token.")
        
        # In thử Top 1 để bạn yên tâm
        if processed_tokens:
            top1 = processed_tokens[0]
            print(f"📊 Top 1: {top1['symbol']} - Price: ${top1['price']} - Vol: ${top1['volume']['total']:,.0f}")

    except Exception as e:
        print(f"❌ LỖI: {str(e)}")

if __name__ == "__main__":
    fetch_data()