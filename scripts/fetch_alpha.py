import requests, json, os
from datetime import datetime

FAKE = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.binance.com", "client-type": "web"}
API_AGG = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24?dataType=aggregate"
API_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker"
OUT = "public/data/market-data.json"

def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def fetch():
    try:
        raw = requests.get(API_AGG, headers=FAKE, timeout=15).json().get("data", [])
        if not raw: return
        tokens = []
        stats = {"total_volume_24h":0, "total_limit_volume":0, "total_onchain_volume":0}
        
        for i in raw:
            sym = i.get("symbol")
            if not sym: continue
            vol = safe_float(i.get("volume24h"))
            aid = i.get("alphaId")
            
            # Status
            is_cex = i.get("listingCex", False) is True
            is_off = i.get("offline", False) is True
            st = "ALPHA"
            if is_cex and is_off: st = "SPOT"
            elif (not is_cex) and is_off: st = "DELISTED"

            # Limit Vol
            lvol = 0.0
            if aid:
                try:
                    r = requests.get(f"{API_TICKER}?symbol={aid}USDT", headers=FAKE, timeout=0.5).json()
                    if not r.get("success"):
                        r = requests.get(f"{API_TICKER}?symbol={aid}USDC", headers=FAKE, timeout=0.5).json()
                    if r.get("success"): lvol = safe_float(r["data"].get("quoteVolume"))
                except: pass
            
            lvol = min(lvol, vol)
            
            obj = {
                "id": aid, "symbol": sym, "name": i.get("name"), "icon": i.get("iconUrl"),
                "chain": i.get("chainName"), "chain_icon": i.get("chainIconUrl"),
                "contract": i.get("contractAddress"), "status": st,
                "mul_point": safe_float(i.get("mulPoint")), "listing_time": i.get("listingTime", 0),
                "price": safe_float(i.get("price")), "change_24h": safe_float(i.get("percentChange24h")),
                "liquidity": safe_float(i.get("liquidity")), "market_cap": safe_float(i.get("marketCap")),
                "volume": {"total": vol, "limit": lvol, "onchain": max(0, vol-lvol)}
            }
            tokens.append(obj)
            
            # ONLY ALPHA STATS
            if st == "ALPHA":
                stats["total_volume_24h"] += vol
                stats["total_limit_volume"] += lvol
                stats["total_onchain_volume"] += (vol - lvol)

        final = {"last_updated": datetime.now().strftime("%H:%M %d/%m"), "global_stats": stats, "tokens": sorted(tokens, key=lambda x: x["volume"]["total"], reverse=True)}
        with open(OUT, "w", encoding="utf-8") as f: json.dump(final, f, ensure_ascii=False, indent=2)
        print("Data Updated.")
    except Exception as e: print(e)

if __name__ == "__main__": fetch()
