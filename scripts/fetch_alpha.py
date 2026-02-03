import json
import os
import time
import random
from datetime import datetime
from dotenv import load_dotenv
import requests 
import cloudscraper 

# --- 1. CẤU HÌNH ---
load_dotenv()

PROXY_WORKER_URL = os.getenv("PROXY_WORKER_URL")
API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

# Test ít thôi để soi lỗi cho nhanh
TOP_TOKEN_LIMIT = 3 

scraper = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True}
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "Accept": "application/json"
}

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

ACTIVE_SPOT_SYMBOLS = set()
OLD_DATA_MAP = {}

# --- 2. HÀM GỌI API (DEBUG MODE) ---
def fetch_smart(target_url, retries=2):
    is_render = "onrender.com" in (PROXY_WORKER_URL or "")
    
    # [CHECK QUAN TRỌNG] Kiểm tra xem URL có bị Null không
    if "None" in target_url:
        print(f"❌ LỖI: URL chứa 'None'. Kiểm tra lại Secret API_AGG_KLINES!")
        return None

    for i in range(retries):
        if PROXY_WORKER_URL:
            try:
                # In ra URL đang gọi để kiểm tra
                print(f"   👉 Requesting: {target_url[:60]}...", end=" ")
                
                current_timeout = 60 if (is_render and i==0) else 30
                
                res = requests.get(
                    PROXY_WORKER_URL, 
                    params={"url": target_url}, 
                    timeout=current_timeout 
                )
                
                if res.status_code == 200:
                    data = res.json()
                    # [DEBUG] NẾU DATA RỖNG HOẶC CÓ LỖI, IN RA NGAY
                    if not data or (isinstance(data, dict) and (not data.get("data") or data.get("code") != "000000")):
                        print(f"\n   ⚠️ RESPONSE LẠ: {str(data)[:200]}") # In 200 ký tự đầu xem là gì
                    else:
                        print("✅ OK")
                    return data
                
                elif res.status_code == 403:
                    print("⛔ 403 (Binance Block)")
                elif res.status_code == 502:
                    print("💤 Render 502...")
                    time.sleep(5)
                else:
                    print(f"⚠️ Status: {res.status_code}")
                    print(f"   Content: {res.text[:100]}") # In nội dung lỗi
                    
            except Exception as e:
                print(f"❌ Err: {str(e)[:50]}")
        
        # Backup Direct...
        try:
            res = scraper.get(target_url, headers=HEADERS, timeout=15)
            if res.status_code == 200:
                return res.json()
        except: pass
        
        time.sleep(1)
            
    return None

# --- GIỮ NGUYÊN CÁC HÀM KHÁC ---
def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def load_old_data():
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return {t['id']: t for t in data.get('tokens', [])}
        except: pass
    return {}

def get_active_spot_symbols():
    try:
        res = scraper.get(API_PUBLIC_SPOT, timeout=10)
        if res.status_code == 200:
            data = res.json()
            return {s["baseAsset"] for s in data.get("symbols", []) if s["status"] == "TRADING"}
    except: pass
    return set()

# --- 3. LOGIC ---
def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total, d_limit, d_market = 0.0, 0.0, 0.0
    
    # Kiểm tra biến môi trường
    if not API_AGG_KLINES:
        print("❌ CRITICAL: Thiếu Secret BINANCE_INTERNAL_KLINES_API")
        return 0,0,0

    base_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=5&tokenAddress={contract_addr}"
    
    # 1. LIMIT
    res_limit = fetch_smart(f"{base_url}&dataType=limit")
    if res_limit and res_limit.get("data"):
        k = res_limit["data"]["klineInfos"]
        if k: d_limit = safe_float(k[-1][5])

    # 2. MARKET
    res_market = fetch_smart(f"{base_url}&dataType=market")
    if res_market and res_market.get("data"):
        k = res_market["data"]["klineInfos"]
        if k: d_market = safe_float(k[-1][5])

    # 3. TOTAL
    res_total = fetch_smart(f"{base_url}&dataType=aggregate")
    if res_total and res_total.get("data"):
        k = res_total["data"]["klineInfos"]
        if k: d_total = safe_float(k[-1][5])

    if d_total < (d_limit + d_market): d_total = d_limit + d_market
    return d_total, d_limit, d_market

def get_sparkline_data(chain_id, contract_addr):
    if not API_AGG_KLINES: return []
    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=20&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_smart(url)
    if res and res.get("data") and res.get("data", {}).get("klineInfos"):
        return [{"p": safe_float(k[4]), "v": safe_float(k[5])} for k in res["data"]["klineInfos"]]
    return []

# --- 4. MAIN ---
def process_token_smart(item, is_vip=False):
    should_fetch = is_vip
    aid = item.get("alphaId")
    if not aid: return None

    vol_24h = safe_float(item.get("volume24h"))
    symbol = item.get("symbol")
    contract = item.get("contractAddress")
    chain_id = item.get("chainId")
    
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    status = "ALPHA"
    if is_offline:
        status = "SPOT" if (is_listing_cex or symbol in ACTIVE_SPOT_SYMBOLS) else "DELISTED"

    daily_total, daily_limit, daily_onchain = 0.0, 0.0, 0.0
    chart_data = []

    old = OLD_DATA_MAP.get(aid)
    if old and not should_fetch:
        if old.get("volume"):
            daily_limit = safe_float(old["volume"].get("daily_limit"))
            daily_onchain = safe_float(old["volume"].get("daily_onchain"))
            if safe_float(old["volume"].get("daily_total")) > 0:
                daily_total = safe_float(old["volume"].get("daily_total"))
            chart_data = old.get("chart", [])

    if should_fetch and vol_24h > 0 and contract and chain_id:
        print(f"\n📡 {symbol}...", end=" ")
        d_t, d_l, d_m = fetch_daily_utc_stats(chain_id, contract)
        daily_limit, daily_onchain = d_l, d_m
        daily_total = d_t if d_t >= (d_l + d_m) else (d_l + d_m)
        chart_data = get_sparkline_data(chain_id, contract)
        print(f"-> Total: {daily_total:.0f}") # In kết quả ngay
    
    if daily_total == 0: daily_total = vol_24h

    return {
        "id": aid, "symbol": symbol, "name": item.get("name"), "icon": item.get("iconUrl"),
        "chain": item.get("chainName", ""), "chain_icon": item.get("chainIconUrl"), "contract": contract,
        "offline": is_offline, "listingCex": is_listing_cex, "status": status,
        "onlineTge": item.get("onlineTge", False), "onlineAirdrop": item.get("onlineAirdrop", False),
        "mul_point": safe_float(item.get("mulPoint")), "listing_time": item.get("listingTime", 0),
        "tx_count": safe_float(item.get("count24h")), "price": safe_float(item.get("price")),
        "change_24h": safe_float(item.get("percentChange24h")), "liquidity": safe_float(item.get("liquidity")),
        "market_cap": safe_float(item.get("marketCap")),
        "volume": { "rolling_24h": vol_24h, "daily_total": daily_total, 
                   "daily_limit": daily_limit, "daily_onchain": daily_onchain },
        "chart": chart_data
    }

def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    start = time.time()
    
    print(f"🛡️ [DEBUG MODE] Proxy: {PROXY_WORKER_URL[:20]}...", flush=True)

    if not API_AGG_TICKER:
        print("❌ Lỗi: Thiếu API Env")
        return

    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    print("⏳ Đang lấy List...", end=" ")
    raw_res = fetch_smart(API_AGG_TICKER)
    if not raw_res:
        print("\n❌ THẤT BẠI: Render không phản hồi.")
        return
    raw_data = raw_res.get("data", [])
    print(f"Xong! ({len(raw_data)} tokens)")

    all_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    all_tokens.sort(key=lambda x: safe_float(x.get("volume24h")), reverse=True)
    
    # Test 3 token đầu thôi
    vip = all_tokens[:TOP_TOKEN_LIMIT]
    
    res = []
    print(f"💎 Soi kỹ {len(vip)} VIP...")
    for t in vip:
        r = process_token_smart(t, True)
        if r: res.append(r)
        
    # Bỏ qua phần normal để test cho nhanh
    
    print(f"\n✅ HOÀN TẤT! {time.time()-start:.1f}s")

if __name__ == "__main__":
    fetch_data()
