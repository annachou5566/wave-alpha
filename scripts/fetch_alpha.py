import requests
import json
import time
import os
from datetime import datetime

# --- CẤU HÌNH API ---
API_TOKEN_LIST = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
API_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker"
OUTPUT_FILE = "public/data/market-data.json"

# Đảm bảo thư mục tồn tại
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

# Hàm chuyển đổi số an toàn (Chống lỗi NoneType)
def safe_float(val):
    try:
        if val is None: return 0.0
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def fetch_data():
    print("⏳ Đang kết nối Binance Alpha...")
    try:
        # 1. Lấy Token List
        resp = requests.get(API_TOKEN_LIST)
        data = resp.json()
        
        if not data.get("success"):
            print("❌ Lỗi: Không lấy được danh sách Token")
            return

        token_list = data.get("data", [])
        processed_tokens = []
        
        global_stats = {
            "total_volume_24h": 0,
            "total_limit_volume": 0,
            "total_onchain_volume": 0,
            "total_market_cap": 0,
            "active_tokens": 0
        }

        print(f"✅ Tìm thấy {len(token_list)} tokens. Đang phân tích...")

        # 2. Duyệt từng token
        for token in token_list:
            # Bỏ qua token không có symbol
            if not token.get("symbol"): continue

            alpha_id = token.get("alphaId")
            symbol = token.get("symbol")
            
            # --- API TICKER (Lấy Limit Volume) ---
            ticker_symbol = f"{alpha_id}USDT" 
            limit_vol = 0.0
            
            # Chỉ gọi ticker nếu token có volume tổng > 0 để tiết kiệm thời gian
            # (Hoặc bỏ check này nếu muốn chính xác tuyệt đối)
            raw_total_vol = safe_float(token.get("volume24h"))
            
            if raw_total_vol > 0:
                try:
                    # Timeout ngắn để không bị treo
                    ticker_resp = requests.get(f"{API_TICKER}?symbol={ticker_symbol}", timeout=1)
                    t_data = ticker_resp.json()
                    if t_data.get("success") and t_data.get("data"):
                        limit_vol = safe_float(t_data["data"].get("quoteVolume"))
                except:
                    limit_vol = 0.0

            # --- TÍNH TOÁN AN TOÀN ---
            price = safe_float(token.get("price"))
            total_vol = raw_total_vol
            market_cap = safe_float(token.get("marketCap"))
            holders = int(safe_float(token.get("holders")))
            
            # Logic sửa sai nếu Limit > Total do độ trễ
            if limit_vol > total_vol: total_vol = limit_vol
            
            onchain_vol = total_vol - limit_vol
            if onchain_vol < 0: onchain_vol = 0.0

            # Phân loại Source
            source_type = "On-Chain Only"
            if limit_vol > 10: # Lọc nhiễu số quá nhỏ
                if onchain_vol > 10:
                    source_type = "On-Chain + Limit"
                else:
                    source_type = "Limit Only"

            # Đóng gói dữ liệu
            token_obj = {
                "id": alpha_id,
                "symbol": symbol,
                "name": token.get("name", "Unknown"),
                "icon": token.get("iconUrl", ""),
                "price": price,
                "change_24h": safe_float(token.get("percentChange24h")),
                "volume": {
                    "total": total_vol,
                    "limit": limit_vol,
                    "onchain": onchain_vol,
                    "source": source_type
                },
                "market_cap": market_cap,
                "holders": holders,
                "is_hot": token.get("hotTag", False)
            }
            
            processed_tokens.append(token_obj)
            
            # Cộng dồn Global
            global_stats["total_volume_24h"] += total_vol
            global_stats["total_limit_volume"] += limit_vol
            global_stats["total_onchain_volume"] += onchain_vol
            global_stats["total_market_cap"] += market_cap
            global_stats["active_tokens"] += 1

        # Sắp xếp theo Volume giảm dần
        processed_tokens.sort(key=lambda x: x["volume"]["total"], reverse=True)

        final_data = {
            "last_updated": datetime.now().strftime("%H:%M %d/%m/%Y"),
            "global_stats": global_stats,
            "tokens": processed_tokens
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 XONG! Dữ liệu đã lưu tại: {OUTPUT_FILE}")
        print(f"📊 Tổng Volume: ${global_stats['total_volume_24h']:,.2f}")
        print(f"🔹 Limit: ${global_stats['total_limit_volume']:,.2f}")
        print(f"🔸 On-chain: ${global_stats['total_onchain_volume']:,.2f}")

    except Exception as e:
        print(f"❌ Lỗi không mong muốn: {str(e)}")

if __name__ == "__main__":
    fetch_data()
