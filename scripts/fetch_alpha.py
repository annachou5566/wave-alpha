import json
import os
import time
import random
from datetime import datetime
from dotenv import load_dotenv
import cloudscraper

# --- 1. CẤU HÌNH ---
load_dotenv()

API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

# [QUAN TRỌNG] CHỈ QUÉT CHI TIẾT TOP N TOKEN CÓ VOLUME CAO NHẤT
TOP_TOKEN_LIMIT = 60 

# Scraper giữ session
scraper = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True}
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "Accept": "application/json",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
}

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

# [QUAN TRỌNG] TẮT ĐA LUỒNG ĐỂ TRÁNH BỊ CHẶN
MAX_WORKERS = 1 
ACTIVE_SPOT_SYMBOLS = set()
OLD_DATA_MAP = {}

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
            symbols = {s["baseAsset"] for s in data.get("symbols", []) if s["status"] == "TRADING"}
            return symbols
    except: pass
    return set()

def fetch_with_retry(url, retries=3):
    for i in range(retries):
        try:
            res = scraper.get(url, headers=HEADERS, timeout=15)
            if res.status_code == 200: 
                return res.json()
            elif res.status_code == 403:
                print(f"⛔ Bị chặn (403). Đợi 10s...")
                time.sleep(10)
            elif res.status_code == 429:
                time.sleep(5)
        except Exception:
            time.sleep(1)
    return None

def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    d_market = 0.0 
    base_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=5&tokenAddress={contract_addr}"
    
    # [MẸO] Random delay
    time.sleep(random.uniform(2, 4)) 

    # 1. LIMIT
    res_limit = fetch_with_retry(f"{base_url}&dataType=limit")
    if res_limit and res_limit.get("data"):
        k = res_limit["data"]["klineInfos"]
        if k: d_limit = safe_float(k[-1][5])

    # 2. MARKET
    res_market = fetch_with_retry(f"{base_url}&dataType=market")
    if res_market and res_market.get("data"):
        k = res_market["data"]["klineInfos"]
        if k: d_market = safe_float(k[-1][5])

    # 3. AGGREGATE
    res_total = fetch_with_retry(f"{base_url}&dataType=aggregate")
    if res_total and res_total.get("data"):
        k = res_total["data"]["klineInfos"]
        if k: d_total = safe_float(k[-1][5])

    if d_total < (d_limit + d_market):
        d_total = d_limit + d_market
    
    return d_total, d_limit, d_market

def get_sparkline_data(chain_id, contract_addr):
    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=20&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_with_retry(url)
    if res and res.get("data") and res["data"].get("klineInfos"):
        return [{"p": safe_float(k[4]), "v": safe_float(k[5])} for k in res["data"]["klineInfos"]]
    return []

# --- XỬ LÝ TOKEN ---
def process_token_smart(item, is_vip=False):
    # Logic quyết định có gọi sâu API không
    should_fetch_details = is_vip 
    
    aid = item.get("alphaId")
    vol_24h = safe_float(item.get("volume24h"))
    symbol = item.get("symbol")
    contract = item.get("contractAddress")
    chain_id = item.get("chainId")

    # --- LOGIC STATUS (Của code cũ) ---
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    
    status = "ALPHA"
    if is_offline:
        if is_listing_cex is True or symbol in ACTIVE_SPOT_SYMBOLS:
            status = "SPOT"
            is_listing_cex = True # Đồng bộ cờ
        else:
            status = "DELISTED"
    else:
        status = "ALPHA"

    # --- INIT DATA ---
    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []

    # --- LẤY TỪ CACHE CŨ NẾU CÓ (Để lấp vào những token không VIP) ---
    old_entry = OLD_DATA_MAP.get(aid)
    if old_entry and not should_fetch_details:
        # Nếu không phải VIP, cố gắng dùng lại dữ liệu cũ để chart không bị trống
        if old_entry.get("volume"):
             daily_limit = safe_float(old_entry["volume"].get("daily_limit"))
             daily_onchain = safe_float(old_entry["volume"].get("daily_onchain"))
             chart_data = old_entry.get("chart", [])

    # --- GỌI API THỰC TẾ (CHỈ VIP) ---
    if should_fetch_details and vol_24h > 0 and contract and chain_id:
        print(f"📡 Fetching: {symbol}...")
        d_total, d_limit, d_market = fetch_daily_utc_stats(chain_id, contract)
        daily_limit = d_limit
        daily_onchain = d_market
        daily_total = d_total if d_total >= (d_limit + d_market) else (d_limit + d_market)
        chart_data = get_sparkline_data(chain_id, contract)
    else:
        # Nếu không fetch mới, dùng vol 24h làm daily total tạm
        daily_total = vol_24h 

    # --- TRẢ VỀ FULL FIELDS (Đã khôi phục đầy đủ) ---
    return {
        "id": aid,
        "symbol": symbol,
        "name": item.get("name"),
        "icon": item.get("iconUrl"),
        "chain": item.get("chainName", ""),
        "chain_icon": item.get("chainIconUrl"),
        "contract": contract,
        
        # [RESTORED] Các trường quan trọng bạn nhắc
        "offline": is_offline,
        "listingCex": is_listing_cex,
        "status": status,
        "onlineTge": item.get("onlineTge", False),
        "onlineAirdrop": item.get("onlineAirdrop", False),
        "mul_point": safe_float(item.get("mulPoint")),
        "listing_time": item.get("listingTime", 0),
        "tx_count": safe_float(item.get("count24h")),
        
        "price": safe_float(item.get("price")),
        "change_24h": safe_float(item.get("percentChange24h")),
        "liquidity": safe_float(item.get("liquidity")),
        "market_cap": safe_float(item.get("marketCap")),
        
        "volume": {
            "rolling_24h": vol_24h,
            "daily_total": daily_total,
            "daily_limit": daily_limit,
            "daily_onchain": daily_onchain
        },
        "chart": chart_data
    }

# --- MAIN ---
def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    start_time = time.time()
    print("🛡️ [SAFE MODE] Bắt đầu quét dữ liệu Alpha (Đã giảm tốc + Full Data)...")
    
    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    try:
        raw_res = fetch_with_retry(API_AGG_TICKER)
        if not raw_res: return
        raw_data = raw_res.get("data", [])
    except: return

    # Lọc & Sắp xếp theo Volume giảm dần
    all_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    all_tokens.sort(key=lambda x: safe_float(x.get("volume24h")), reverse=True)
    
    # Tách Top VIP
    vip_tokens = all_tokens[:TOP_TOKEN_LIMIT]
    normal_tokens = all_tokens[TOP_TOKEN_LIMIT:]

    results = []

    # 1. Xử lý VIP (Có check Limit/Onchain)
    print(f"💎 Xử lý {len(vip_tokens)} Token VIP...")
    for t in vip_tokens:
        res = process_token_smart(t, is_vip=True)
        if res: results.append(res)
    
    # 2. Xử lý Normal (Chạy nhanh, giữ data cũ nếu có)
    print(f"⚡ Xử lý nhanh {len(normal_tokens)} Token thường...")
    for t in normal_tokens:
        res = process_token_smart(t, is_vip=False)
        if res: results.append(res)

    # 3. Token Rác
    zero_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]
    for t in zero_tokens:
        res = process_token_smart(t, is_vip=False)
        if res: results.append(res)

    # Sắp xếp lại lần cuối
    results.sort(key=lambda x: x["volume"]["daily_total"], reverse=True)

    data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "total_tokens": len(results),
        "tokens": results
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT! Thời gian: {time.time() - start_time:.2f}s")

if __name__ == "__main__":
    fetch_data()