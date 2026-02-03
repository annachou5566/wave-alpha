import requests
import json
import os
import time
from datetime import datetime
import concurrent.futures
from dotenv import load_dotenv

# --- 1. CẤU HÌNH & BẢO MẬT ---
load_dotenv()

API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

if not API_AGG_TICKER or not API_AGG_KLINES:
    print("⚠️ Cảnh báo: Kiểm tra lại biến môi trường API.")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "client-type": "web"
}

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

MAX_WORKERS = 5 
ACTIVE_SPOT_SYMBOLS = set()
OLD_DATA_MAP = {} 

# --- 2. CÁC HÀM BỔ TRỢ ---
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
    print("🌍 Đang lấy danh sách Spot Trading thực tế...")
    try:
        res = requests.get(API_PUBLIC_SPOT, timeout=10)
        if res.status_code == 200:
            data = res.json()
            symbols = set()
            for s in data.get("symbols", []):
                if s.get("status") == "TRADING":
                    symbols.add(s.get("baseAsset")) 
            return symbols
    except: pass
    return set()

def get_usd_from_kline(kline_array):
    if not kline_array or not isinstance(kline_array, list): return 0.0
    length = len(kline_array)
    try:
        if length >= 6: return safe_float(kline_array[5])
        elif length >= 8: return safe_float(kline_array[7])
    except: pass
    return 0.0

def fetch_with_retry(url, retries=3):
    for i in range(retries):
        try:
            res = requests.get(url, headers=HEADERS, timeout=5)
            if res.status_code == 200: return res.json()
            elif res.status_code == 429: time.sleep(2)
        except: time.sleep(0.5)
    return None

def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    
    url_total = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=aggregate"
    res_total = fetch_with_retry(url_total)
    if res_total and res_total.get("data") and res_total["data"].get("klineInfos"):
        d_total = get_usd_from_kline(res_total["data"]["klineInfos"][0])

    url_limit = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=limit"
    res_limit = fetch_with_retry(url_limit)
    if res_limit and res_limit.get("data") and res_limit["data"].get("klineInfos"):
        d_limit = get_usd_from_kline(res_limit["data"]["klineInfos"][0])
    
    return d_total, d_limit

def get_sparkline_data(chain_id, contract_addr):
    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=7&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_with_retry(url, retries=2)
    if res and res.get("data") and res["data"].get("klineInfos"):
        return [safe_float(k[4]) for k in res["data"]["klineInfos"]]
    return []

# --- 3. WORKER THÔNG MINH (LOGIC FLAG-BASED) ---
def process_token_smart(item):
    aid = item.get("alphaId")
    if not aid: return None

    # Lấy dữ liệu cơ bản
    vol_24h = safe_float(item.get("volume24h"))
    price = safe_float(item.get("price"))
    change_24h = safe_float(item.get("percentChange24h"))
    tx_count = safe_float(item.get("count24h"))
    liquidity = safe_float(item.get("liquidity"))
    market_cap = safe_float(item.get("marketCap"))
    
    contract = item.get("contractAddress")
    chain_id = item.get("chainId") 
    chain_name = item.get("chainName", "")
    symbol = item.get("symbol")

    # Các cờ quan trọng
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    is_cex_off_display = item.get("cexOffDisplay", False) # Cờ quan trọng nhất
    
    # --- LOGIC XÁC ĐỊNH TRẠNG THÁI (STATUS) ---
    status = "ALPHA"
    
    # Ưu tiên 1: Kiểm tra SPOT (Cross-Check + Flag nội bộ)
    is_spot_confirmed = False
    if is_listing_cex is True:
        is_spot_confirmed = True
    elif symbol in ACTIVE_SPOT_SYMBOLS:
        is_spot_confirmed = True
        is_listing_cex = True # Cập nhật lại cho đúng

    if is_spot_confirmed:
        status = "SPOT"
    
    else:
        # Nếu không phải Spot, kiểm tra xem có bị Tắt hiển thị không
        if is_cex_off_display is False:
            # Vẫn cho hiển thị -> ALPHA (Bất kể offline hay không)
            status = "ALPHA"
            is_offline = False # Ép về False để Web hiển thị như đang chạy
        else:
            # Đã tắt hiển thị -> DELISTED
            status = "DELISTED"

    # --- LOGIC CACHING (TỰ SỬA LỖI) ---
    old_data = OLD_DATA_MAP.get(aid)
    
    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []
    
    should_fetch_details = False
    
    # Nếu là ALPHA -> Phải tải chi tiết (để vẽ chart, tính vol)
    if status == "ALPHA":
        should_fetch_details = True
    else:
        # Nếu đã SPOT/DELISTED -> Kiểm tra Cache
        if old_data and old_data.get("status") == status:
            cached_total = safe_float(old_data["volume"].get("daily_total"))
            if cached_total > 0:
                daily_total = cached_total
                daily_limit = safe_float(old_data["volume"].get("daily_limit"))
                daily_onchain = safe_float(old_data["volume"].get("daily_onchain"))
                chart_data = old_data.get("chart", [])
                should_fetch_details = False 
            else:
                should_fetch_details = True # Cache lỗi -> Tải lại
        else:
            should_fetch_details = True # Trạng thái đổi -> Tải lại

    if should_fetch_details and vol_24h > 0 and contract and chain_id:
        daily_total, daily_limit = fetch_daily_utc_stats(chain_id, contract)
        if daily_total == 0 and daily_limit > 0: daily_total = daily_limit
        if daily_total < daily_limit: daily_total = daily_limit
        daily_onchain = daily_total - daily_limit
        chart_data = get_sparkline_data(chain_id, contract)

    return {
        "id": aid,
        "symbol": symbol,
        "name": item.get("name"),
        "icon": item.get("iconUrl"),
        "chain": chain_name,
        "chain_icon": item.get("chainIconUrl"),
        "contract": contract,
        "offline": is_offline, 
        "listingCex": is_listing_cex,
        "status": status,
        "onlineTge": item.get("onlineTge", False),
        "onlineAirdrop": item.get("onlineAirdrop", False),
        "mul_point": safe_float(item.get("mulPoint")),
        "listing_time": item.get("listingTime", 0),
        "price": price,
        "change_24h": change_24h,
        "liquidity": liquidity,
        "market_cap": market_cap,
        "tx_count": tx_count,
        "volume": {
            "rolling_24h": vol_24h,
            "daily_total": daily_total,
            "daily_limit": daily_limit,
            "daily_onchain": daily_onchain
        },
        "chart": chart_data
    }

# --- 4. MAIN ---
def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    
    start_time = time.time()
    print("🔒 [SECURE MODE] Bắt đầu quét dữ liệu...")
    
    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    try:
        raw_res = fetch_with_retry(API_AGG_TICKER)
        raw_data = raw_res.get("data", [])
    except: return

    active_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    inactive_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]
    
    tokens = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        results = list(executor.map(process_token_smart, active_tokens))

    for t in results:
        if t: tokens.append(t)
    
    for t in inactive_tokens:
        basic = process_token_smart(t)
        if basic: tokens.append(basic)

    final_sorted = sorted(tokens, key=lambda x: x["volume"]["daily_total"], reverse=True)

    data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "tokens": final_sorted
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT! Thời gian: {time.time() - start_time:.2f}s")

if __name__ == "__main__":
    fetch_data()