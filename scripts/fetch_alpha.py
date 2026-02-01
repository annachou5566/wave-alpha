import requests
import json
import os
from datetime import datetime

# HEADERS CHUẨN
FAKE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "client-type": "web",
    "content-type": "application/json"
}

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
    print("🚀 Updating Data (Status: Spot/Delisted + Limit Vol)...")
    
    try:
        resp = requests.get(API_AGG_TICKER, headers=FAKE_HEADERS, timeout=15)
        raw_data = resp.json().get("data", [])
        
        if not raw_data: return

        processed_tokens = []
        global_stats = {"total_volume_24h":0, "total_limit_volume":0, "total_onchain_volume":0}

        for item in raw_data:
            symbol = item.get("symbol")
            if not symbol: continue

            # DATA CƠ BẢN
            price = safe_float(item.get("price"))
            total_vol = safe_float(item.get("volume24h"))
            alpha_id = item.get("alphaId")
            contract = item.get("contractAddress", "")
            
            # --- PHÂN LOẠI TRẠNG THÁI (STATUS) ---
            # Dựa trên logic bạn cung cấp
            listing_cex = item.get("listingCex", False) is True
            is_offline = item.get("offline", False) is True

            status = "ALPHA"
            if listing_cex:
                status = "SPOT"     # listingCex = True -> Đã lên Spot
            elif is_offline:
                status = "DELISTED" # listingCex = False + offline = True -> Delisted

            # --- TÍNH LIMIT VOL (QUAN TRỌNG: KHÔNG BỎ) ---
            limit_vol = 0.0
            # Chỉ check Limit nếu là Spot hoặc Volume lớn (để tối ưu)
            if (status == "SPOT" or total_vol > 50000) and alpha_id:
                try:
                    limit_url = f"{API_LIMIT_TICKER}?symbol={alpha_id}USDT"
                    limit_res = requests.get(limit_url, headers=FAKE_HEADERS, timeout=0.3).json()
                    if limit_res.get("success"):
                        limit_vol = safe_float(limit_res["data"].get("quoteVolume"))
                except: pass

            # Fix logic số liệu ảo
            if limit_vol > total_vol: limit_vol = total_vol * 0.95
            onchain_vol = total_vol - limit_vol
            if onchain_vol < 0: onchain_vol = 0

            # --- XÁC ĐỊNH SOURCE TYPE ĐỂ HIỂN THỊ CỘT SOURCE ---
            source_type = "On-Chain"
            if status == "DELISTED":
                source_type = "DELISTED"
            elif status == "SPOT":
                source_type = "SPOT"
            elif limit_vol > 1000:
                source_type = "Hybrid" # Vẫn giữ logic Hybrid cho các token Alpha xịn

            token_obj = {
                "id": alpha_id,
                "symbol": symbol,
                "name": item.get("name"),
                "icon": item.get("iconUrl"),
                "contract": contract,
                "status": status, # Trả về status chuẩn: SPOT, DELISTED, ALPHA
                "price": price,
                "change_24h": safe_float(item.get("percentChange24h")),
                "liquidity": safe_float(item.get("liquidity")),
                "market_cap": safe_float(item.get("marketCap")),
                "volume": { 
                    "total": total_vol, 
                    "limit": limit_vol, 
                    "onchain": onchain_vol, 
                    "source": source_type 
                }
            }
            processed_tokens.append(token_obj)

            global_stats["total_volume_24h"] += total_vol
            global_stats["total_limit_volume"] += limit_vol
            global_stats["total_onchain_volume"] += onchain_vol

        processed_tokens.sort(key=lambda x: x["volume"]["total"], reverse=True)

        final_data = {
            "last_updated": datetime.now().strftime("%H:%M %d/%m"),
            "global_stats": global_stats,
            "tokens": processed_tokens
        }

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)
            
        print(f"🎉 Processed {len(processed_tokens)} tokens. Logic Limit Vol: KEEP.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fetch_data()
