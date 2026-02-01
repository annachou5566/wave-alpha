import requests, json, os, time
from datetime import datetime

# CẤU HÌNH API
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "client-type": "web"
}
BASE_URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade"
API_AGG = f"{BASE_URL}/aggTicker24?dataType=aggregate"
API_EXCHANGE = f"{BASE_URL}/get-exchange-info"
API_KLINES = f"{BASE_URL}/klines"
API_TICKER = f"{BASE_URL}/ticker"

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def get_symbol_map():
    """Lấy danh sách cặp giao dịch chuẩn (USDT/USDC)"""
    print("⏳ Fetching Exchange Info map...")
    try:
        res = requests.get(API_EXCHANGE, headers=HEADERS, timeout=10).json()
        if not res.get("success"): return {}
        mapping = {}
        for s in res["data"]["symbols"]:
            if s["status"] == "TRADING":
                mapping[s["baseAsset"]] = s["symbol"]
        return mapping
    except: return {}

def fetch_data():
    print("🚀 Starting Data Update (Daily Vol Fix)...")
    
    try:
        raw = requests.get(API_AGG, headers=HEADERS, timeout=15).json().get("data", [])
    except Exception as e:
        print(f"❌ Error fetching AggTicker: {e}")
        return

    symbol_map = get_symbol_map()
    tokens = []
    
    # Stats counters
    s_total_24h = 0
    s_total_daily = 0
    s_total_limit = 0
    s_total_onchain = 0
    
    print(f"🔄 Processing {len(raw)} tokens...")
    
    for i in raw:
        aid = i.get("alphaId")
        if not aid: continue
        
        vol_24h = safe_float(i.get("volume24h"))
        
        # Status Logic
        is_cex = i.get("listingCex", False) is True
        is_off = i.get("offline", False) is True
        status = "ALPHA"
        if is_cex and is_off: status = "SPOT"
        elif (not is_cex) and is_off: status = "DELISTED"

        # 1. Tìm Symbol chuẩn (Ưu tiên Map, nếu không có thì đoán)
        real_symbol = symbol_map.get(aid)
        if not real_symbol:
            # Fallback: Thử ghép thủ công nếu map thiếu
            real_symbol = f"{aid}USDT"

        # 2. Fetch Limit & Daily Vol
        limit_vol = 0.0
        daily_vol = 0.0
        
        if real_symbol:
            # A. LIMIT VOL (Ticker 24h)
            try:
                t_res = requests.get(f"{API_TICKER}?symbol={real_symbol}", headers=HEADERS, timeout=0.5).json()
                if t_res.get("success"):
                    limit_vol = safe_float(t_res["data"].get("quoteVolume"))
                else:
                    # Thử lại với USDC nếu USDT lỗi
                    real_symbol_usdc = f"{aid}USDC"
                    t_res = requests.get(f"{API_TICKER}?symbol={real_symbol_usdc}", headers=HEADERS, timeout=0.5).json()
                    if t_res.get("success"):
                        limit_vol = safe_float(t_res["data"].get("quoteVolume"))
                        real_symbol = real_symbol_usdc # Cập nhật lại symbol đúng cho bước sau
            except: pass

            # B. DAILY VOL (Klines 1d)
            try:
                # Lấy nến ngày hôm nay
                k_res = requests.get(f"{API_KLINES}?symbol={real_symbol}&interval=1d&limit=1", headers=HEADERS, timeout=0.5).json()
                if k_res.get("success") and k_res.get("data"):
                    # Index 7: Quote Asset Volume
                    daily_vol = safe_float(k_res["data"][0][7])
            except: pass

        limit_vol = min(limit_vol, vol_24h)
        
        token_obj = {
            "id": aid,
            "symbol": i.get("symbol"),
            "name": i.get("name"),
            "icon": i.get("iconUrl"),
            "chain": i.get("chainName"),
            "chain_icon": i.get("chainIconUrl"),
            "contract": i.get("contractAddress"),
            "status": status,
            "mul_point": safe_float(i.get("mulPoint")),
            "listing_time": i.get("listingTime", 0),
            "price": safe_float(i.get("price")),
            "change_24h": safe_float(i.get("percentChange24h")),
            "liquidity": safe_float(i.get("liquidity")),
            "market_cap": safe_float(i.get("marketCap")),
            "volume": {
                "total": vol_24h,
                "daily": daily_vol,    # <--- Trường này BẮT BUỘC phải có
                "limit": limit_vol,
                "onchain": max(0, vol_24h - limit_vol)
            }
        }
        tokens.append(token_obj)

        if status == "ALPHA":
            s_total_24h += vol_24h
            s_total_daily += daily_vol
            s_total_limit += limit_vol
            s_total_onchain += (vol_24h - limit_vol)

    final_data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "global_stats": {
            "total_volume_24h": s_total_24h,
            "total_volume_daily": s_total_daily,
            "total_limit_volume": s_total_limit,
            "total_onchain_volume": s_total_onchain
        },
        "tokens": sorted(tokens, key=lambda x: x["volume"]["total"], reverse=True)
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 Updated! Daily Vol: ${s_total_daily:,.0f} | 24h Vol: ${s_total_24h:,.0f}")

if __name__ == "__main__":
    fetch_data()
