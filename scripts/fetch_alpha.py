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
API_KLINES = f"{BASE_URL}/klines"
API_TICKER = f"{BASE_URL}/ticker"

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def fetch_pair_data(symbol_pair):
    """
    Hàm lấy dữ liệu cho một cặp cụ thể (VD: ALPHA_556USDT)
    Trả về: (Limit_Vol_24h, Daily_Vol_UTC)
    """
    l_vol = 0.0
    d_vol = 0.0
    
    # 1. Lấy Limit Vol (Ticker 24h)
    try:
        t_res = requests.get(f"{API_TICKER}?symbol={symbol_pair}", headers=HEADERS, timeout=0.5).json()
        if t_res.get("success"):
            l_vol = safe_float(t_res["data"].get("quoteVolume"))
    except: pass

    # 2. Lấy Daily Vol (Klines 1d - Index 7)
    try:
        k_res = requests.get(f"{API_KLINES}?symbol={symbol_pair}&interval=1d&limit=1", headers=HEADERS, timeout=0.5).json()
        if k_res.get("success") and k_res.get("data"):
            d_vol = safe_float(k_res["data"][0][7]) # Index 7 là Quote Asset Volume
    except: pass
    
    return l_vol, d_vol

def fetch_data():
    print("🚀 Starting Data Update (Dual-Pair Scan: USDT + USDC)...")
    
    try:
        raw = requests.get(API_AGG, headers=HEADERS, timeout=15).json().get("data", [])
    except Exception as e:
        print(f"❌ Error fetching AggTicker: {e}")
        return

    tokens = []
    
    # Biến thống kê toàn sàn
    s_daily = 0
    s_24h = 0
    
    print(f"🔄 Scanning {len(raw)} tokens...")
    
    for i in raw:
        aid = i.get("alphaId")
        if not aid: continue
        
        vol_24h = safe_float(i.get("volume24h"))
        
        # Status
        is_cex = i.get("listingCex", False) is True
        is_off = i.get("offline", False) is True
        status = "ALPHA"
        if is_cex and is_off: status = "SPOT"
        elif (not is_cex) and is_off: status = "DELISTED"

        # --- LOGIC MỚI: QUÉT CẢ 2 CẶP ---
        # Thay vì đoán, ta check cả 2 khả năng và cộng dồn
        
        # 1. Check cặp USDT
        limit_usdt, daily_usdt = fetch_pair_data(f"{aid}USDT")
        
        # 2. Check cặp USDC
        limit_usdc, daily_usdc = fetch_pair_data(f"{aid}USDC")
        
        # 3. Tổng hợp
        final_daily_vol = daily_usdt + daily_usdc
        final_limit_vol = limit_usdt + limit_usdc
        
        # Ràng buộc logic: Limit Vol không thể lớn hơn Total Vol 24h (nếu có sai số API)
        # Tuy nhiên Daily Vol có thể lớn hơn 24h Vol nếu biến động lớn đầu ngày
        final_limit_vol = min(final_limit_vol, vol_24h)
        
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
                "daily": final_daily_vol, # Tổng cả USDT + USDC
                "limit": final_limit_vol,
                "onchain": max(0, vol_24h - final_limit_vol)
            }
        }
        tokens.append(token_obj)

        if status == "ALPHA":
            s_daily += final_daily_vol
            s_24h += vol_24h

    final_data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "global_stats": {
            "total_volume_24h": s_24h,
            "total_volume_daily": s_daily
        },
        "tokens": sorted(tokens, key=lambda x: x["volume"]["total"], reverse=True)
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
        
    print(f"🎉 Updated! Total Daily Vol (USDT+USDC): ${s_daily:,.0f}")

if __name__ == "__main__":
    fetch_data()
