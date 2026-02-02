import requests
import json
import os
import time
from datetime import datetime
import concurrent.futures
from dotenv import load_dotenv

# --- 1. CẤU HÌNH ---
load_dotenv()

API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")

if not API_AGG_TICKER or not API_AGG_KLINES:
    print("❌ LỖI: Thiếu API trong .env")
    exit()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "client-type": "web"
}

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

# SỐ LUỒNG (Giữ 5 để ổn định)
MAX_WORKERS = 5

CHAIN_MAP = {
    "BSC": 56, "BNB": 56, "ETH": 1, "Ethereum": 1, "POLYGON": 137, "Matic": 137,
    "Arbitrum": 42161, "ARB": 42161, "Optimism": 10, "OP": 10, "Base": 8453,
    "Avalanche": 43114, "SOL": 501
}

# --- 2. HÀM BỔ TRỢ ---
def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def get_usd_from_kline(kline_array):
    """
    FIX LỖI: Dựa trên log debug, cả Aggregate và Limit đều có thể trả về mảng 7 phần tử.
    Ở mảng 7 phần tử, Index 5 chính là Volume USD.
    """
    if not kline_array or not isinstance(kline_array, list): return 0.0
    
    length = len(kline_array)
    try:
        # Trường hợp chuẩn cũ (Mảng dài 8 hoặc 12) -> Index 7 là USD
        if length >= 8: 
            return safe_float(kline_array[7])
        
        # Trường hợp hiện tại (Mảng dài 7) -> Index 5 là USD
        # (Áp dụng cho cả Limit và Aggregate)
        elif length >= 6: 
            return safe_float(kline_array[5])
            
    except: pass
    return 0.0

def fetch_with_retry(url, retries=3):
    for i in range(retries):
        try:
            res = requests.get(url, headers=HEADERS, timeout=5)
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 429:
                time.sleep(2)
        except:
            time.sleep(0.5)
    return None

def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    
    # 1. Gọi TOTAL
    url_total = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=aggregate"
    res_total = fetch_with_retry(url_total)
    if res_total and res_total.get("data") and res_total["data"].get("klineInfos"):
        d_total = get_usd_from_kline(res_total["data"]["klineInfos"][0])

    # 2. Gọi LIMIT
    url_limit = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=limit"
    res_limit = fetch_with_retry(url_limit)
    if res_limit and res_limit.get("data") and res_limit["data"].get("klineInfos"):
        d_limit = get_usd_from_kline(res_limit["data"]["klineInfos"][0])
    
    return d_total, d_limit

def get_sparkline_data(chain_id, contract_addr):
    chart = []
    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=7&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_with_retry(url, retries=2)
    if res and res.get("data") and res["data"].get("klineInfos"):
        chart = [safe_float(k[4]) for k in res["data"]["klineInfos"]]
    return chart

# --- 3. WORKER ---
# --- 3. WORKER ---
def process_token_securely(item):
    """
    Hàm xử lý từng token. Đã cập nhật logic lấy trường 'offline', 'listingCex',
    'onlineTge' và 'onlineAirdrop' từ dữ liệu mẫu thực tế.
    """
    aid = item.get("alphaId")
    if not aid: return None

    # Lấy các chỉ số cơ bản
    vol_24h = safe_float(item.get("volume24h"))
    contract = item.get("contractAddress")
    
    # Lấy Chain ID trực tiếp từ API (Thông minh hơn)
    chain_id = item.get("chainId") 
    chain_name = item.get("chainName", "")

    # Lấy trạng thái Status
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    
    status = "ALPHA"
    if is_offline is True:
        if is_listing_cex is True: status = "SPOT"
        else: status = "DELISTED"

    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []

    # Chỉ quét dữ liệu chi tiết nếu là Token ALPHA (Đang chạy) và có Volume
    if status == "ALPHA" and vol_24h > 0 and contract and chain_id:
        daily_total, daily_limit = fetch_daily_utc_stats(chain_id, contract)
        
        # Logic sửa lỗi dữ liệu (Fallback)
        if daily_total == 0 and daily_limit > 0: daily_total = daily_limit
        if daily_total < daily_limit: daily_total = daily_limit
        
        daily_onchain = daily_total - daily_limit
        chart_data = get_sparkline_data(chain_id, contract)

    return {
        "id": aid,
        "symbol": item.get("symbol"),
        "name": item.get("name"),
        "icon": item.get("iconUrl"),
        "chain": chain_name,
        "chain_icon": item.get("chainIconUrl"),
        "contract": contract,
        
        # --- CÁC TRƯỜNG QUAN TRỌNG CHO WEB ---
        "offline": is_offline,
        "listingCex": is_listing_cex,
        "status": status,
        "onlineTge": item.get("onlineTge", False),
        "onlineAirdrop": item.get("onlineAirdrop", False),
        # -------------------------------------
        
        "mul_point": safe_float(item.get("mulPoint")),
        "listing_time": item.get("listingTime", 0),
        "price": safe_float(item.get("price")),
        "change_24h": safe_float(item.get("percentChange24h")),
        "liquidity": safe_float(item.get("liquidity")),
        "market_cap": safe_float(item.get("marketCap")),
        "tx_count": safe_float(item.get("count24h")),
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
    start_time = time.time()
    print("🔒 [SECURE MODE] Đang quét dữ liệu (Đã Fix lỗi Index)...")
    
    try:
        raw_res = fetch_with_retry(API_AGG_TICKER)
        raw_data = raw_res.get("data", [])
    except Exception as e:
        print(f"❌ Lỗi API Tổng: {e}")
        return

    tokens = []
    active_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    inactive_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]
    
    print(f"📋 Tổng: {len(raw_data)}. Active: {len(active_tokens)}")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        results = list(executor.map(process_token_securely, active_tokens))

    for t in results:
        if t: tokens.append(t)
    
    for t in inactive_tokens:
        basic = process_token_securely(t)
        if basic: tokens.append(basic)

    final_sorted = sorted(tokens, key=lambda x: x["volume"]["daily_total"], reverse=True)

    data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "tokens": final_sorted
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    elapsed = time.time() - start_time
    print(f"✅ HOÀN TẤT! Thời gian: {elapsed:.2f}s")
    
    # DEBUG KIỂM TRA LẠI OWL
    for t in final_sorted:
        if t["symbol"] == "OWL":
            print(f"🔎 DEBUG OWL FINAL: Total={t['volume']['daily_total']:,.0f} | Limit={t['volume']['daily_limit']:,.0f} | OnChain={t['volume']['daily_onchain']:,.0f}")
            break

if __name__ == "__main__":
    fetch_data()
