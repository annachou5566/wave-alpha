import json
import os
import time
import random
from datetime import datetime
from dotenv import load_dotenv
import requests # Dùng requests vì đã có Proxy lo phần IP
import cloudscraper # Dự phòng nếu cần direct

# --- 1. CẤU HÌNH & KẾT NỐI ---
load_dotenv()


PROXY_WORKER_URL = os.getenv("PROXY_WORKER_URL")

API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

# Chỉ quét chi tiết Top N token volume to nhất
TOP_TOKEN_LIMIT = 60 

# Scraper dự phòng (dùng khi không có Proxy)
scraper = cloudscraper.create_scraper(
    browser={'browser': 'chrome', 'platform': 'windows', 'desktop': True}
)

# Headers dự phòng
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

# --- 2. CÁC HÀM GỌI API (CORE) ---

def fetch_via_proxy_or_direct(target_url, retries=3):
    """
    Hàm thông minh: Tự động chọn đi qua Proxy (nếu có) hoặc đi thẳng.
    """
    use_proxy = True if PROXY_WORKER_URL and "workers.dev" in PROXY_WORKER_URL else False
    
    for i in range(retries):
        try:
            if use_proxy:
                # Gọi qua Cloudflare Worker
                proxy_endpoint = f"{PROXY_WORKER_URL}?url={target_url}"
                # Timeout dài (30s) để chờ Worker xử lý delay
                res = requests.get(proxy_endpoint, timeout=30)
            else:
                # Gọi trực tiếp (Dễ bị 403)
                res = scraper.get(target_url, headers=HEADERS, timeout=15)

            # Xử lý kết quả
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 403:
                print(f"⛔ Bị chặn (403). Đợi 5s...")
                time.sleep(5)
            elif res.status_code == 429:
                print(f"⚠️ Rate Limit (429). Đợi 10s...")
                time.sleep(10)
            else:
                time.sleep(1)
        except Exception as e:
            print(f"⚠️ Lỗi kết nối ({'Proxy' if use_proxy else 'Direct'}): {e}")
            time.sleep(1)
            
    return None

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
    # Spot API public, gọi trực tiếp cho nhanh, ít khi chặn
    try:
        res = scraper.get(API_PUBLIC_SPOT, timeout=10)
        if res.status_code == 200:
            data = res.json()
            symbols = {s["baseAsset"] for s in data.get("symbols", []) if s["status"] == "TRADING"}
            return symbols
    except: pass
    return set()

# --- 3. LOGIC LẤY DỮ LIỆU CHI TIẾT ---

def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    d_market = 0.0 
    
    # URL Gốc
    base_binance_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=5&tokenAddress={contract_addr}"
    
    # Nếu không dùng Proxy, cần delay để tránh spam
    if not PROXY_WORKER_URL:
        time.sleep(random.uniform(2, 4)) 

    # 1. LIMIT
    res_limit = fetch_via_proxy_or_direct(f"{base_binance_url}&dataType=limit")
    if res_limit and res_limit.get("data"):
        k = res_limit["data"]["klineInfos"]
        if k: d_limit = safe_float(k[-1][5])

    # 2. MARKET (ON-CHAIN)
    res_market = fetch_via_proxy_or_direct(f"{base_binance_url}&dataType=market")
    if res_market and res_market.get("data"):
        k = res_market["data"]["klineInfos"]
        if k: d_market = safe_float(k[-1][5])

    # 3. AGGREGATE (TOTAL)
    res_total = fetch_via_proxy_or_direct(f"{base_binance_url}&dataType=aggregate")
    if res_total and res_total.get("data"):
        k = res_total["data"]["klineInfos"]
        if k: d_total = safe_float(k[-1][5])

    # Fallback Logic
    if d_total < (d_limit + d_market):
        d_total = d_limit + d_market
    
    return d_total, d_limit, d_market

def get_sparkline_data(chain_id, contract_addr):
    target_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=20&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_via_proxy_or_direct(target_url)
    if res and res.get("data") and res["data"].get("klineInfos"):
        return [{"p": safe_float(k[4]), "v": safe_float(k[5])} for k in res["data"]["klineInfos"]]
    return []

# --- 4. XỬ LÝ TỪNG TOKEN (FULL FIELDS) ---

def process_token_smart(item, is_vip=False):
    # Logic: Chỉ gọi API chi tiết nếu là VIP
    should_fetch_details = is_vip 
    
    aid = item.get("alphaId")
    vol_24h = safe_float(item.get("volume24h"))
    symbol = item.get("symbol")
    contract = item.get("contractAddress")
    chain_id = item.get("chainId")

    # --- STATUS LOGIC (GIỮ NGUYÊN) ---
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

    # --- INIT VARS ---
    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []

    # --- CACHE LOGIC ---
    old_entry = OLD_DATA_MAP.get(aid)
    
    # Nếu không phải VIP, ưu tiên lấy dữ liệu cũ để hiển thị cho đẹp
    if old_entry and not should_fetch_details:
        if old_entry.get("volume"):
             daily_limit = safe_float(old_entry["volume"].get("daily_limit"))
             daily_onchain = safe_float(old_entry["volume"].get("daily_onchain"))
             # Lấy luôn total cũ nếu nó hợp lý
             if safe_float(old_entry["volume"].get("daily_total")) > 0:
                 daily_total = safe_float(old_entry["volume"].get("daily_total"))
             chart_data = old_entry.get("chart", [])

    # --- FETCHING (CHỈ VIP MỚI GỌI MỚI) ---
    if should_fetch_details and vol_24h > 0 and contract and chain_id:
        print(f"📡 Fetching: {symbol}...")
        d_total, d_limit, d_market = fetch_daily_utc_stats(chain_id, contract)
        
        daily_limit = d_limit
        daily_onchain = d_market
        daily_total = d_total if d_total >= (d_limit + d_market) else (d_limit + d_market)
        chart_data = get_sparkline_data(chain_id, contract)
    
    # Fallback cho daily_total nếu chưa có
    if daily_total == 0:
        daily_total = vol_24h

    # --- RETURN FULL DATA (KHÔNG BỎ SÓT FIELD NÀO) ---
    return {
        "id": aid,
        "symbol": symbol,
        "name": item.get("name"),
        "icon": item.get("iconUrl"),
        "chain": item.get("chainName", ""),
        "chain_icon": item.get("chainIconUrl"),
        "contract": contract,
        
        # Các trường quan trọng giữ nguyên
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

# --- 5. MAIN ---
def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    start_time = time.time()
    
    mode_str = "PROXY" if PROXY_WORKER_URL else "DIRECT (UNSAFE)"
    print(f"🛡️ [MODE: {mode_str}] Bắt đầu quét dữ liệu Alpha...")
    
    if not API_AGG_TICKER:
        print("❌ Lỗi: Chưa cấu hình biến môi trường API_AGG_TICKER")
        return

    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    # Lấy danh sách tổng (Gọi qua Proxy/Direct)
    raw_res = fetch_via_proxy_or_direct(API_AGG_TICKER)
    if not raw_res:
        print("❌ Không lấy được danh sách Token gốc!")
        return
    raw_data = raw_res.get("data", [])

    # Lọc & Sắp xếp
    all_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    all_tokens.sort(key=lambda x: safe_float(x.get("volume24h")), reverse=True)
    
    # Chia nhóm VIP và Thường
    vip_tokens = all_tokens[:TOP_TOKEN_LIMIT]
    normal_tokens = all_tokens[TOP_TOKEN_LIMIT:]

    results = []

    # 1. VIP (Gọi API chi tiết)
    print(f"💎 Xử lý {len(vip_tokens)} Token VIP...")
    for t in vip_tokens:
        res = process_token_smart(t, is_vip=True)
        if res: results.append(res)
    
    # 2. Normal (Dùng data cơ bản + Cache cũ)
    print(f"⚡ Xử lý nhanh {len(normal_tokens)} Token thường...")
    for t in normal_tokens:
        res = process_token_smart(t, is_vip=False)
        if res: results.append(res)

    # 3. Rác (Volume 0)
    zero_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]
    for t in zero_tokens:
        res = process_token_smart(t, is_vip=False)
        if res: results.append(res)

    # Sắp xếp output cuối cùng
    results.sort(key=lambda x: x["volume"]["daily_total"], reverse=True)

    data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "total_tokens": len(results),
        "tokens": results
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT! Thời gian: {time.time() - start_time:.2f}s | Token: {len(results)}")

if __name__ == "__main__":
    fetch_data()