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

# Lấy Proxy từ Env
PROXY_WORKER_URL = os.getenv("PROXY_WORKER_URL")

API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

TOP_TOKEN_LIMIT = 5

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

# --- 2. HÀM GỌI API THÔNG MINH (PROXY -> DIRECT) ---
def fetch_smart(target_url, retries=4): # Tăng retry lên 4
    use_proxy = True if PROXY_WORKER_URL and "workers.dev" in PROXY_WORKER_URL else False
    
    for i in range(retries):
        # [PHA 1] GỌI QUA PROXY
        if use_proxy:
            try:
                # Random param để tránh cache cứng của Cloudflare nếu request trước bị lỗi
                random_ts = int(time.time() * 1000)
                res = requests.get(
                    PROXY_WORKER_URL, 
                    params={"url": target_url, "_t": random_ts}, 
                    timeout=30
                )
                if res.status_code == 200:
                    return res.json()
                elif res.status_code == 403:
                    print(f"⚠️ Proxy 403 (Lần {i+1})...", end=" ")
                    # Nếu bị chặn, ngủ tăng dần: 5s, 10s, 15s
                    time.sleep(5 * (i + 1)) 
            except Exception as e:
                print(f"⚠️ Lỗi Proxy: {e}")
                time.sleep(2)

        # [PHA 2] GỌI TRỰC TIẾP (Nếu Proxy thua)
        try:
            res = scraper.get(target_url, headers=HEADERS, timeout=15)
            if res.status_code == 200:
                return res.json()
        except: pass
        
    return None

# --- CÁC HÀM BỔ TRỢ ---
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

# --- 3. LOGIC DATA ---
def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total, d_limit, d_market = 0.0, 0.0, 0.0
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

    # Các thông số cơ bản
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

    # Check Cache
    old = OLD_DATA_MAP.get(aid)
    if old and not should_fetch:
        if old.get("volume"):
            daily_limit = safe_float(old["volume"].get("daily_limit"))
            daily_onchain = safe_float(old["volume"].get("daily_onchain"))
            if safe_float(old["volume"].get("daily_total")) > 0:
                daily_total = safe_float(old["volume"].get("daily_total"))
            chart_data = old.get("chart", [])

    # Fetch Mới (Chỉ VIP)
    if should_fetch and vol_24h > 0 and contract and chain_id:
        print(f"📡 {symbol}...", end=" ", flush=True)
        d_t, d_l, d_m = fetch_daily_utc_stats(chain_id, contract)
        print(f"OK ({d_t:.0f})")
        daily_limit, daily_onchain = d_l, d_m
        daily_total = d_t if d_t >= (d_l + d_m) else (d_l + d_m)
        chart_data = get_sparkline_data(chain_id, contract)
    
    if daily_total == 0: daily_total = vol_24h

    # Return Full Data
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
    
    proxy_status = "✅ ON" if PROXY_WORKER_URL else "❌ OFF"
    print(f"🛡️ [Smart Fetch] Proxy: {proxy_status} | Limit: Top {TOP_TOKEN_LIMIT}")

    if not API_AGG_TICKER:
        print("❌ Lỗi: Thiếu API Env")
        return

    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    # Lấy List Tổng
    print("⏳ Đang lấy danh sách Token...", end=" ")
    raw_res = fetch_smart(API_AGG_TICKER)
    if not raw_res:
        print("\n❌ THẤT BẠI: Không lấy được danh sách gốc (Cả Proxy và Direct đều lỗi).")
        return
    raw_data = raw_res.get("data", [])
    print(f"Xong! ({len(raw_data)} tokens)")

    all_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    all_tokens.sort(key=lambda x: safe_float(x.get("volume24h")), reverse=True)
    
    vip = all_tokens[:TOP_TOKEN_LIMIT]
    normal = all_tokens[TOP_TOKEN_LIMIT:]
    trash = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]

    res = []
    print(f"💎 Đang xử lý {len(vip)} VIP...")
    for t in vip:
        r = process_token_smart(t, True)
        if r: res.append(r)
        
    print(f"⚡ Đang xử lý {len(normal)} Normal...")
    for t in normal:
        r = process_token_smart(t, False)
        if r: res.append(r)
        
    for t in trash:
        r = process_token_smart(t, False)
        if r: res.append(r)

    res.sort(key=lambda x: x["volume"]["daily_total"], reverse=True)

    final_data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "total_tokens": len(res),
        "tokens": res
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT! {time.time()-start:.1f}s")

if __name__ == "__main__":
    fetch_data()