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
        # THEO KẾT QUẢ DEBUG: Index 5 CHÍNH LÀ VOLUME USD
        if length >= 6: return safe_float(kline_array[5])
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

# --- HÀM GỌI API CHI TIẾT (CHUẨN DEBUG) ---
def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    d_market = 0.0 # On-Chain
    
    # 1. Gọi Limit (Index 5)
    url_limit = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=limit"
    res_limit = fetch_with_retry(url_limit)
    if res_limit and res_limit.get("data") and res_limit["data"].get("klineInfos"):
        d_limit = get_usd_from_kline(res_limit["data"]["klineInfos"][0])
    
    # 2. Gọi Market (Index 5) - ĐÂY LÀ ON-CHAIN
    url_market = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=market"
    res_market = fetch_with_retry(url_market)
    if res_market and res_market.get("data") and res_market["data"].get("klineInfos"):
        d_market = get_usd_from_kline(res_market["data"]["klineInfos"][0])

    # 3. Gọi Aggregate (Index 5) - Tổng
    url_total = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=aggregate"
    res_total = fetch_with_retry(url_total)
    if res_total and res_total.get("data") and res_total["data"].get("klineInfos"):
        d_total = get_usd_from_kline(res_total["data"]["klineInfos"][0])

    return d_total, d_limit, d_market

def get_sparkline_data(chain_id, contract_addr):
    # Chart lấy từ Aggregate
    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=20&tokenAddress={contract_addr}&dataType=aggregate"
    res = fetch_with_retry(url, retries=2)
    if res and res.get("data") and res["data"].get("klineInfos"):
        # TRẢ VỀ CẤU TRÚC MỚI: { "p": Price, "v": Volume }
        # k[4] là Giá, k[5] là Volume
        return [
            {"p": safe_float(k[4]), "v": safe_float(k[5])} 
            for k in res["data"]["klineInfos"]
        ]
    return []

def process_token_smart(item):
    aid = item.get("alphaId")
    if not aid: return None

    # --- GIỮ NGUYÊN TOÀN BỘ BIẾN CỦA BẠN ---
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
    is_cex_off_display = item.get("cexOffDisplay", False)
    
    # --- 1. SỬA LOGIC STATUS (ĐẢM BẢO CHÍNH XÁC THEO OFFLINE) ---
    status = "ALPHA"
    
    if is_offline:
        # Khi đã offline mới xét xem là Spot hay Delisted
        if is_listing_cex is True or symbol in ACTIVE_SPOT_SYMBOLS:
            status = "SPOT"
            is_listing_cex = True # Đồng bộ cờ listingCex
        else:
            status = "DELISTED"
    else:
        # Nếu chưa Offline (offline=False) -> CHẮC CHẮN LÀ ALPHA (Fix lỗi KOGE)
        status = "ALPHA"

    # --- 2. SỬA LOGIC LẤY DỮ LIỆU (QUÉT FULL CHI TIẾT) ---
    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []
    
    # Chỉ quét khi có Volume và thông tin Contract
    if vol_24h > 0 and contract and chain_id:
        # Gọi 3 API chi tiết (Limit, Market, Agg) để lấy Volume chuẩn
        d_total, d_limit, d_market = fetch_daily_utc_stats(chain_id, contract)
        
        daily_limit = d_limit
        daily_onchain = d_market 
        
        # Tính tổng Volume chuẩn xác
        if d_total > 0 and d_total >= (d_limit + d_market):
            daily_total = d_total
        else:
            daily_total = d_limit + d_market
            
        # Gọi hàm lấy Chart mới (bao gồm cả giá 'p' và volume 'v')
        chart_data = get_sparkline_data(chain_id, contract)

    # --- GIỮ NGUYÊN CẤU TRÚC RETURN CỦA BẠN ---
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