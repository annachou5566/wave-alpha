import json
import os
import time
import random # Thêm cái này để tạo delay ngẫu nhiên
from datetime import datetime
import concurrent.futures
from dotenv import load_dotenv
import cloudscraper # Thay requests bằng cái này

# --- 1. CẤU HÌNH & BẢO MẬT ---
load_dotenv()

API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

# --- [UPGRADE 1] TẠO TRÌNH DUYỆT GIẢ LẬP (SESSION) ---
# Dùng chung 1 scraper cho toàn bộ chương trình để giữ kết nối (Keep-Alive)
scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'desktop': True
    }
)

if not API_AGG_TICKER or not API_AGG_KLINES:
    print("⚠️ Cảnh báo: Thiếu biến môi trường API (Kiểm tra lại Secrets/ENV).")

# Header xịn hơn
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
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
        # [UPGRADE] Dùng scraper thay vì requests
        res = scraper.get(API_PUBLIC_SPOT, timeout=10)
        if res.status_code == 200:
            data = res.json()
            symbols = set()
            for s in data.get("symbols", []):
                if s.get("status") == "TRADING":
                    symbols.add(s.get("baseAsset")) 
            return symbols
    except Exception as e:
        print(f"⚠️ Lỗi lấy Spot symbols: {e}")
    return set()

def fetch_with_retry(url, retries=3):
    # [UPGRADE] Logic Retry thông minh hơn
    for i in range(retries):
        try:
            res = scraper.get(url, headers=HEADERS, timeout=10) # Tăng timeout lên 10s
            
            if res.status_code == 200: 
                return res.json()
            elif res.status_code == 429: 
                print(f"Rate Limit! Ngủ {i+2}s...")
                time.sleep(i + 2)
            elif res.status_code == 403:
                print(f"⛔ Bị chặn (403) tại {url[:50]}...")
                return None
        except Exception as e:
            time.sleep(0.5)
    return None

# --- 3. CÁC HÀM LOGIC CHÍNH ---
def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    d_market = 0.0 
    
    base_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=5&tokenAddress={contract_addr}"
    
    # 1. LIMIT
    limit_infos = []
    res_limit = fetch_with_retry(f"{base_url}&dataType=limit")
    if res_limit and res_limit.get("data"):
        limit_infos = res_limit["data"].get("klineInfos", [])
    
    if not limit_infos: return 0.0, 0.0, 0.0

    latest_limit = limit_infos[-1]
    target_ts = latest_limit[0]
    
    # Check index bounds để tránh crash
    if len(latest_limit) > 5:
        d_limit = safe_float(latest_limit[5]) 

    # 2. MARKET (ON-CHAIN)
    res_market = fetch_with_retry(f"{base_url}&dataType=market")
    if res_market and res_market.get("data"):
        m_infos = res_market["data"].get("klineInfos", [])
        for k in m_infos:
            if k[0] == target_ts and len(k) > 5:
                d_market = safe_float(k[5])
                break 

    # 3. AGGREGATE
    res_total = fetch_with_retry(f"{base_url}&dataType=aggregate")
    if res_total and res_total.get("data"):
        t_infos = res_total["data"].get("klineInfos", [])
        for k in t_infos:
            if k[0] == target_ts and len(k) > 5:
                d_total = safe_float(k[5])
                break

    if d_total < (d_limit + d_market):
        d_total = d_limit + d_market

    return d_total, d_limit, d_market

def get_sparkline_data(chain_id, contract_addr):
    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=20&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_with_retry(url, retries=2)
    if res and res.get("data") and res["data"].get("klineInfos"):
        return [
            {"p": safe_float(k[4]), "v": safe_float(k[5])} 
            for k in res["data"]["klineInfos"] if len(k) > 5
        ]
    return []

def process_token_smart(item):
    # [UPGRADE] Random delay nhỏ để tránh 5 luồng request cùng milisecond
    time.sleep(random.uniform(0.1, 0.5))
    
    aid = item.get("alphaId")
    if not aid: return None

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

    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    
    status = "ALPHA"
    if is_offline:
        if is_listing_cex is True or symbol in ACTIVE_SPOT_SYMBOLS:
            status = "SPOT"
            is_listing_cex = True
        else:
            status = "DELISTED"
    else:
        status = "ALPHA"

    # --- LOGIC CACHING GIỮ NGUYÊN ---
    old_data = OLD_DATA_MAP.get(aid)
    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []
    
    should_fetch_details = False
    
    if status == "ALPHA":
        should_fetch_details = True
    else:
        # Nếu là SPOT/DELISTED, tận dụng cache cũ nếu có
        if old_data and old_data.get("status") == status:
            cached_total = safe_float(old_data["volume"].get("daily_total"))
            if cached_total > 0:
                daily_total = cached_total
                daily_limit = safe_float(old_data["volume"].get("daily_limit"))
                daily_onchain = safe_float(old_data["volume"].get("daily_onchain"))
                chart_data = old_data.get("chart", [])
                should_fetch_details = False
            else:
                should_fetch_details = True
        else:
            should_fetch_details = True

    # Chỉ fetch chi tiết nếu volume > 0 để tiết kiệm request
    if should_fetch_details and vol_24h > 0 and contract and chain_id:
        d_total, d_limit, d_market = fetch_daily_utc_stats(chain_id, contract)
        daily_limit = d_limit
        daily_onchain = d_market
        if d_total > 0 and d_total >= (d_limit + d_market):
            daily_total = d_total
        else:
            daily_total = d_limit + d_market
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
    print("🔒 [CLOUD-SCRAPER] Bắt đầu quét dữ liệu Alpha...")
    
    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    if not API_AGG_TICKER:
        print("❌ Lỗi: Chưa cấu hình BINANCE_INTERNAL_AGG_API")
        return

    try:
        raw_res = fetch_with_retry(API_AGG_TICKER)
        if not raw_res:
            print("❌ Không lấy được danh sách Token ban đầu!")
            return
        raw_data = raw_res.get("data", [])
    except Exception as e:
        print(f"❌ Exception main fetch: {e}")
        return

    active_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    inactive_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]
    
    print(f"⚡ Tìm thấy {len(active_tokens)} token hoạt động. Bắt đầu xử lý đa luồng...")

    tokens = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        results = list(executor.map(process_token_smart, active_tokens))

    for t in results:
        if t: tokens.append(t)
    
    # Xử lý token rác (không cần luồng, chạy nhanh)
    for t in inactive_tokens:
        basic = process_token_smart(t)
        if basic: tokens.append(basic)

    final_sorted = sorted(tokens, key=lambda x: x["volume"]["daily_total"], reverse=True)

    data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "total_tokens": len(tokens),
        "tokens": final_sorted
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT! Thời gian: {time.time() - start_time:.2f}s | Token: {len(tokens)}")

if __name__ == "__main__":
    fetch_data()