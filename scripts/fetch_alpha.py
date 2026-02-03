import requests
import json
import os
import time
from datetime import datetime
import concurrent.futures
from dotenv import load_dotenv

# --- 1. CẤU HÌNH & BẢO MẬT ---
load_dotenv()

# Lấy API nội bộ từ biến môi trường (Tuyệt đối không hardcode)
API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")

# API Công khai (Public) để kiểm tra chéo - An toàn, không cần key
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"

if not API_AGG_TICKER or not API_AGG_KLINES:
    print("❌ LỖI: Thiếu API Binance trong file .env")
    exit()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "client-type": "web"
}

OUTPUT_FILE = "public/data/market-data.json"
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

MAX_WORKERS = 5 # Giữ 5 luồng để ổn định, không bị rate limit

# Biến toàn cục để lưu cache và danh sách Spot thực tế
ACTIVE_SPOT_SYMBOLS = set()
OLD_DATA_MAP = {} # Lưu dữ liệu cũ để tái sử dụng

# --- 2. CÁC HÀM BỔ TRỢ (UTILITIES) ---

def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

def load_old_data():
    """
    Đọc dữ liệu từ file JSON cũ để làm Cache.
    Giúp tránh gọi lại API cho các token đã 'chốt sổ' (Spot/Delisted).
    """
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Tạo Map: { "ALPHA_123": { ...token_data... } }
                return {t['id']: t for t in data.get('tokens', [])}
        except: pass
    return {}

def get_active_spot_symbols():
    """
    Gọi API Public Spot để lấy danh sách 'Sự Thật'.
    Dùng để sửa lỗi khi API Alpha báo sai trạng thái (VD: FOGO).
    """
    print("🌍 Đang lấy danh sách Spot Trading thực tế (Public API)...")
    try:
        res = requests.get(API_PUBLIC_SPOT, timeout=10)
        if res.status_code == 200:
            data = res.json()
            symbols = set()
            for s in data.get("symbols", []):
                if s.get("status") == "TRADING":
                    symbols.add(s.get("baseAsset")) 
            print(f"✅ Đã tìm thấy {len(symbols)} token đang giao dịch Spot.")
            return symbols
    except Exception as e:
        print(f"⚠️ Không gọi được API Spot (Sẽ dùng dữ liệu gốc): {e}")
    return set()

def get_usd_from_kline(kline_array):
    if not kline_array or not isinstance(kline_array, list): return 0.0
    length = len(kline_array)
    try:
        # Index 5 là Volume USD (cho cả Limit và Aggregate hiện tại)
        if length >= 6: return safe_float(kline_array[5])
        elif length >= 8: return safe_float(kline_array[7])
    except: pass
    return 0.0

def fetch_with_retry(url, retries=3):
    for i in range(retries):
        try:
            res = requests.get(url, headers=HEADERS, timeout=5)
            if res.status_code == 200:
                return res.json()
            elif res.status_code == 429:
                time.sleep(2) # Bị chặn nhẹ thì nghỉ chút
        except:
            time.sleep(0.5)
    return None

def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total = 0.0
    d_limit = 0.0
    
    # DataType = aggregate
    url_total = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=1&tokenAddress={contract_addr}&dataType=aggregate"
    res_total = fetch_with_retry(url_total)
    if res_total and res_total.get("data") and res_total["data"].get("klineInfos"):
        d_total = get_usd_from_kline(res_total["data"]["klineInfos"][0])

    # DataType = limit
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

# --- 3. WORKER (LÕI XỬ LÝ) ---
def process_token_smart(item):
    """
    Hàm xử lý thông minh:
    1. Check Cache cũ -> Nếu đã Spot/Delisted thì bỏ qua gọi API nặng.
    2. Check Cross-Check -> Sửa lỗi trạng thái.
    3. Chỉ gọi API Klines cho token cần thiết.
    """
    aid = item.get("alphaId")
    if not aid: return None

    # Lấy thông tin cơ bản từ API Tổng (API Nhẹ)
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

    # --- LOGIC XÁC ĐỊNH TRẠNG THÁI (STATUS) ---
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    
    status = "ALPHA"
    if is_offline is True:
        if is_listing_cex is True:
            status = "SPOT"
        else:
            # CROSS-CHECK: Nếu Alpha bảo Delisted nhưng Spot có -> Sửa thành SPOT
            if symbol in ACTIVE_SPOT_SYMBOLS:
                status = "SPOT"
                is_listing_cex = True 
            else:
                status = "DELISTED"

    # --- LOGIC CACHING (QUAN TRỌNG) ---
    # Kiểm tra xem token này đã có trong file cũ chưa
    old_data = OLD_DATA_MAP.get(aid)
    
    daily_total = 0.0
    daily_limit = 0.0
    daily_onchain = 0.0
    chart_data = []
    
    # QUYẾT ĐỊNH: CÓ GỌI API CHI TIẾT HAY KHÔNG?
    should_fetch_details = False
    
    if status == "ALPHA":
        # Nếu đang chạy giải -> Luôn phải cập nhật mới
        should_fetch_details = True
    else:
        # Nếu đã SPOT hoặc DELISTED
        if old_data and old_data.get("status") == status:
            # Trạng thái không đổi -> Dùng lại dữ liệu cũ (Chart, Volume giải)
            # Chỉ cập nhật Giá & Vol 24h từ API Nhẹ
            daily_total = safe_float(old_data["volume"].get("daily_total"))
            daily_limit = safe_float(old_data["volume"].get("daily_limit"))
            daily_onchain = safe_float(old_data["volume"].get("daily_onchain"))
            chart_data = old_data.get("chart", [])
            should_fetch_details = False # Tiết kiệm API
        else:
            # Trạng thái mới đổi (VD: Mới chuyển từ Alpha sang Spot) -> Gọi 1 lần để chốt
            should_fetch_details = True

    # THỰC THI GỌI API (NẾU CẦN)
    if should_fetch_details and vol_24h > 0 and contract and chain_id:
        daily_total, daily_limit = fetch_daily_utc_stats(chain_id, contract)
        
        # Fallback sửa lỗi dữ liệu 0
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
        
        # --- TRẠNG THÁI & SỰ KIỆN ---
        "offline": is_offline,
        "listingCex": is_listing_cex,
        "status": status,
        "onlineTge": item.get("onlineTge", False),
        "onlineAirdrop": item.get("onlineAirdrop", False),
        # ----------------------------
        
        "mul_point": safe_float(item.get("mulPoint")),
        "listing_time": item.get("listingTime", 0),
        
        # Dữ liệu cập nhật realtime từ API Nhẹ
        "price": price,
        "change_24h": change_24h,
        "liquidity": liquidity,
        "market_cap": market_cap,
        "tx_count": tx_count,
        
        "volume": {
            "rolling_24h": vol_24h,
            "daily_total": daily_total,   # Có thể lấy từ Cache hoặc API mới
            "daily_limit": daily_limit,
            "daily_onchain": daily_onchain
        },
        "chart": chart_data # Có thể lấy từ Cache hoặc API mới
    }

# --- 4. MAIN ---
def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    
    start_time = time.time()
    print("🔒 [SECURE MODE] Bắt đầu quét dữ liệu thông minh...")
    
    # BƯỚC 1: Load dữ liệu cũ để Cache
    OLD_DATA_MAP = load_old_data()
    print(f"📂 Đã tải {len(OLD_DATA_MAP)} token từ cache cũ.")

    # BƯỚC 2: Lấy danh sách Spot thực tế (Cross-Check)
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    # BƯỚC 3: Gọi API Tổng (API Nhẹ)
    try:
        raw_res = fetch_with_retry(API_AGG_TICKER)
        raw_data = raw_res.get("data", [])
    except Exception as e:
        print(f"❌ Lỗi API Tổng: {e}")
        return

    tokens = []
    # Chỉ xử lý token có volume > 0 để nhẹ gánh
    active_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    inactive_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]
    
    print(f"📋 Tổng API trả về: {len(raw_data)}. Active cần xử lý: {len(active_tokens)}")
    
    # BƯỚC 4: Chạy đa luồng thông minh
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        results = list(executor.map(process_token_smart, active_tokens))

    for t in results:
        if t: tokens.append(t)
    
    # Xử lý token rác (inactive)
    for t in inactive_tokens:
        basic = process_token_smart(t)
        if basic: tokens.append(basic)

    # Sắp xếp theo Volume giải đấu
    final_sorted = sorted(tokens, key=lambda x: x["volume"]["daily_total"], reverse=True)

    # Lưu file
    data = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "tokens": final_sorted
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    elapsed = time.time() - start_time
    print(f"✅ HOÀN TẤT! Tổng thời gian: {elapsed:.2f}s")
    
    # DEBUG: Kiểm tra thử 1 con Spot xem có bị gọi lại không
    spot_count = sum(1 for t in final_sorted if t["status"] == "SPOT")
    print(f"📊 Thống kê: {spot_count} Token đang là SPOT.")

if __name__ == "__main__":
    fetch_data()