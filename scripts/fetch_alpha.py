import requests, json, os
from datetime import datetime

FAKE_HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.binance.com/en/alpha", "client-type": "web"}
API_AGG_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24?dataType=aggregate"
API_LIMIT_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker"
OUTPUT_FILE = "public/data/market-data.json"

def safe_float(val):
    try: return float(val) if val else 0.0
    except: return 0.0

def fetch_data():
    resp = requests.get(API_AGG_TICKER, headers=FAKE_HEADERS, timeout=15)
    raw_data = resp.json().get("data", [])
    if not raw_data: return
    processed_tokens = []
    global_stats = {"total_volume_24h":0, "total_limit_volume":0, "total_onchain_volume":0}
    for item in raw_data:
        symbol = item.get("symbol")
        if not symbol: continue
        total_vol = safe_float(item.get("volume24h"))
        alpha_id = item.get("alphaId")
        listing_cex = item.get("listingCex", False) is True
        is_offline = item.get("offline", False) is True
        status = "ALPHA"
        if listing_cex and is_offline: status = "SPOT"
        elif (not listing_cex) and is_offline: status = "DELISTED"
        
        limit_vol = 0.0
        if alpha_id:
            try:
                l_res = requests.get(f"{API_LIMIT_TICKER}?symbol={alpha_id}USDT", headers=FAKE_HEADERS, timeout=0.5).json()
                if not l_res.get("success"):
                    l_res = requests.get(f"{API_LIMIT_TICKER}?symbol={alpha_id}USDC", headers=FAKE_HEADERS, timeout=0.5).json()
                if l_res.get("success"): limit_vol = safe_float(l_res["data"].get("quoteVolume"))
            except: pass
        
        limit_vol = min(limit_vol, total_vol)
        token_obj = {
            "id": alpha_id, "symbol": symbol, "name": item.get("name"), "icon": item.get("iconUrl"),
            "chain": item.get("chainName"), "chain_icon": item.get("chainIconUrl"),
            "contract": item.get("contractAddress"), "status": status,
            "mul_point": safe_float(item.get("mulPoint")), "listing_time": item.get("listingTime", 0),
            "price": safe_float(item.get("price")), "change_24h": safe_float(item.get("percentChange24h")),
            "liquidity": safe_float(item.get("liquidity")), "market_cap": safe_float(item.get("marketCap")),
            "volume": { "total": total_vol, "limit": limit_vol, "onchain": max(0, total_vol-limit_vol) }
        }
        processed_tokens.append(token_obj)
        if status == "ALPHA":
            global_stats["total_volume_24h"] += total_vol
            global_stats["total_limit_volume"] += limit_vol
            global_stats["total_onchain_volume"] += (total_vol - limit_vol)

    final_data = {"last_updated": datetime.now().strftime("%H:%M %d/%m"), "global_stats": global_stats, "tokens": sorted(processed_tokens, key=lambda x: x["volume"]["total"], reverse=True)}
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f: json.dump(final_data, f, ensure_ascii=False, indent=2)
    print("🎉 Data Updated (Alpha Only Stats)")

if __name__ == "__main__": fetch_data()
