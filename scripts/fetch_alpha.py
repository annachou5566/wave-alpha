import requests
import json
import os
from datetime import datetime

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
    print("🚀 Updating Data: Fetching Tokens & Filtering Global Stats (Alpha Only)...")
    
    try:
        resp = requests.get(API_AGG_TICKER, headers=FAKE_HEADERS, timeout=15)
        raw_data = resp.json().get("data", [])
        
        if not raw_data: return

        processed_tokens = []
        global_stats = {"total_volume_24h":0, "total_limit_volume":0, "total_onchain_volume":0}

        for item in raw_data:
            symbol = item.get("symbol")
            if not symbol: continue

            price = safe_float(item.get("price"))
            total_vol = safe_float(item.get("volume24h"))
            alpha_id = item.get("alphaId")
            contract = item.get("contractAddress", "")
            
            chain_name = item.get("chainName", "UNK")
            chain_icon = item.get("chainIconUrl", "")
            mul_point = safe_float(item.get("mulPoint"))
            listing_time = item.get("listingTime", 0)

            # --- LOGIC TRẠNG THÁI ---
            listing_cex = item.get("listingCex", False) is True
            is_offline = item.get("offline", False) is True

            status = "ALPHA"
            if listing_cex and is_offline:
                status = "SPOT"
            elif (not listing_cex) and is_offline:
                status = "DELISTED"

            # --- LIMIT VOL ---
            limit_vol = 0.0
            if alpha_id: 
                try:
                    limit_url = f"{API_LIMIT_TICKER}?symbol={alpha_id}USDT"
                    limit_res = requests.get(limit_url, headers=FAKE_HEADERS, timeout=0.5).json()
                    
                    if limit_res.get("success") and limit_res.get("data"):
                        limit_vol = safe_float(limit_res["data"].get("quoteVolume"))
                    else:
                        limit_url_usdc = f"{API_LIMIT_TICKER}?symbol={alpha_id}USDC"
                        limit_res_usdc = requests.get(limit_url_usdc, headers=FAKE_HEADERS, timeout=0.5).json()
                        if limit_res_usdc.get("success") and limit_res_usdc.get("data"):
                            limit_vol = safe_float(limit_res_usdc["data"].get("quoteVolume"))
                except: pass

            if limit_vol > total_vol: limit_vol = total_vol
            onchain_vol = max(0, total_vol - limit_vol)

            source_type = "On-Chain"
            if status == "DELISTED": source_type = "DELISTED"
            elif status == "SPOT": source_type = "SPOT"
            elif limit_vol > 0: source_type = "Hybrid"

            token_obj = {
                "id": alpha_id,
                "symbol": symbol,
                "name": item.get("name"),
                "icon": item.get("iconUrl"),
                "chain": chain_name,
                "chain_icon": chain_icon,
                "contract": contract,
                "status": status,
                "mul_point": mul_point,
                "listing_time": listing_time,
                "price": price,
                "change_24h": safe_float(item.get("percentChange24h")),
                "liquidity": safe_float(item.get("liquidity")),
                "market_cap": safe_float(item.get("marketCap")),
                "volume": { "total": total_vol, "limit": limit_vol, "onchain": onchain_vol, "source": source_type }
            }
            processed_tokens.append(token_obj)

            # --- CHỈ TÍNH VOLUME ALPHA VÀO GLOBAL STATS ---
            if status == "ALPHA":
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
            
        print(f"🎉 Updated! Global Stats exclude SPOT/DELISTED.")

    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fetch_data()
