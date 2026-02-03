import json
import os
import time
import urllib.parse
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

# Điều chỉnh giới hạn quét VIP (Deep Fetch)
TOP_TOKEN_LIMIT = 60 

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

# --- 2. HÀM GỌI API (RENDER & ENCODING OPTIMIZED) ---
def fetch_smart(target_url, retries=3):
    is_render = "onrender.com" in (PROXY_WORKER_URL or "")
    
    if not target_url or "None" in target_url:
        print(f"❌ LỖI: URL mục tiêu không hợp lệ!")
        return None

    for i in range(retries):
        if PROXY_WORKER_URL:
            try:
                # FIX: Mã hóa URL đích để tránh lỗi 000002 illegal parameter trên Render/Express
                encoded_target = urllib.parse.quote(target_url, safe='')
                proxy_final_url = f"{PROXY_WORKER_URL}?url={encoded_target}"
                
                # Render Free cần thời gian tỉnh giấc lần đầu (60s), các lần sau 30s
                current_timeout = 60 if (is_render and i == 0) else 30
                
                res = requests.get(proxy_final_url, timeout=current_timeout)
                
                if res.status_code == 200:
                    data = res.json()
                    if data and isinstance(data, dict):
                        if data.get("code") == "000000":
                            return data
                        else:
                            print(f"\n   ⚠️ BINANCE ERROR: {data.get('code')} - {data.get('message')}")
                
                elif res.status_code == 403:
                    print("⛔ 403 (Binance Block Proxy)")
                elif res.status_code == 502:
                    print("💤 Render 502 (Khởi động)...")
                    time.sleep(5)
                else:
                    print(f"⚠️ Status: {res.status_code}")
                    
            except Exception as e:
                print(f"❌ Proxy Err: {str(e)[:50]}")
        
        # Backup Direct (Dùng cloudscraper)
        try:
            res = scraper.get(target_url, headers=HEADERS, timeout=15)
            if res.status_code == 200:
                data = res.json()
                if data.get("code") == "000000":
                    return data
        except: pass
        
        time.sleep(2)
            
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
    try:
        res = scraper.get(API_PUBLIC_SPOT, timeout=10)
        if res.status_code == 200:
            data = res.json()
            return {s["baseAsset"] for s in data.get("symbols", []) if s["status"] == "TRADING"}
    except: pass
    return set()

# --- 3. LOGIC DATA (FIX SOLANA & KLINE) ---
# --- Cập nhật logic xử lý địa chỉ ví cho nhiều Chain ---

def fetch_daily_utc_stats(chain_id, contract_addr):
    d_total, d_limit, d_market = 0.0, 0.0, 0.0
    if not API_AGG_KLINES: return 0, 0, 0

    # Danh sách các Chain KHÔNG ĐƯỢC lowercase địa chỉ ví
    # CT_501: Solana, CT_784: Sui
    no_lower_chains = ["CT_501", "CT_784"]
    
    clean_addr = str(contract_addr)
    if chain_id not in no_lower_chains:
        clean_addr = clean_addr.lower()
    
    base_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=5&tokenAddress={clean_addr}"
    
    for dtype in ["limit", "market", "aggregate"]:
        res = fetch_smart(f"{base_url}&dataType={dtype}")
        if res and res.get("data") and res["data"].get("klineInfos"):
            val = safe_float(res["data"]["klineInfos"][-1][5])
            if dtype == "limit": d_limit = val
            elif dtype == "market": d_market = val
            elif dtype == "aggregate": d_total = val
                
    if d_total < (d_limit + d_market):
        d_total = d_limit + d_market
    return d_total, d_limit, d_market

def get_sparkline_data(chain_id, contract_addr):
    if not API_AGG_KLINES: return []
    
    no_lower_chains = ["CT_501", "CT_784"]
    clean_addr = str(contract_addr)
    if chain_id not in no_lower_chains:
        clean_addr = clean_addr.lower()

    url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1h&limit=24&tokenAddress={clean_addr}&dataType=aggregate"
    res = fetch_smart(url)
    if res and res.get("data") and res["data"].get("klineInfos"):
        return [{"p": safe_float(k[4]), "v": safe_float(k[5])} for k in res["data"]["klineInfos"]]
    return []

# --- 4. MAIN PROCESSOR ---
def process_token_smart(item, is_vip=False):
    aid = item.get("alphaId")
    if not aid: return None

    vol_24h = safe_float(item.get("volume24h"))
    symbol = item.get("symbol")
    contract = item.get("contractAddress")
    chain_id = item.get("chainId")
    
    # 1. PHÂN LOẠI TRẠNG THÁI
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    
    status = "ALPHA"
    if is_offline:
        if is_listing_cex or symbol in ACTIVE_SPOT_SYMBOLS:
            status = "SPOT"
        else:
            status = "DELISTED"

    # 2. LOGIC FETCH CHI TIẾT
    # Chỉ fetch nếu: status là ALPHA + là VIP + không bị Offline
    should_fetch_detail = (is_vip and status == "ALPHA" and not is_offline)

    daily_total, daily_limit, daily_onchain = 0.0, 0.0, 0.0
    chart_data = []

    # Ưu tiên lấy từ Cache nếu không cần fetch mới
    old = OLD_DATA_MAP.get(aid)
    if old and not should_fetch_detail:
        if old.get("volume"):
            daily_limit = safe_float(old["volume"].get("daily_limit"))
            daily_onchain = safe_float(old["volume"].get("daily_onchain"))
            daily_total = safe_float(old["volume"].get("daily_total"))
            chart_data = old.get("chart", [])

    # Thực hiện Deep Fetch cho hàng ALPHA VIP
    if should_fetch_detail and vol_24h > 0 and contract and chain_id:
        print(f"📡 Deep Processing {symbol} ({chain_id})...", end=" ", flush=True)
        d_t, d_l, d_m = fetch_daily_utc_stats(chain_id, contract)
        daily_limit, daily_onchain = d_l, d_m
        daily_total = d_t if d_t >= (d_l + d_m) else (d_l + d_m)
        chart_data = get_sparkline_data(chain_id, contract)
        print(f"OK (Total: {daily_total:,.0f})")
    
    # Fallback cho SPOT/DELISTED hoặc lỗi fetch
    if daily_total <= 0: 
        daily_total = vol_24h

    return {
        "id": aid,
        "symbol": symbol,
        "name": item.get("name"),
        "icon": item.get("iconUrl"),
        "chain": item.get("chainName", ""),
        "chain_icon": item.get("chainIconUrl"),
        "contract": contract,
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

def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    start = time.time()
    
    print(f"🛡️ [MODE: RENDER PROXY] Target: {PROXY_WORKER_URL[:25]}...")

    if not API_AGG_TICKER:
        print("❌ Lỗi: Thiếu API_AGG_TICKER trong Env")
        return

    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    print("⏳ Đang lấy danh sách Token tổng...", end=" ", flush=True)
    raw_res = fetch_smart(API_AGG_TICKER)
    if not raw_res:
        print("\n❌ THẤT BẠI: Không nhận được dữ liệu từ API tổng.")
        return
    
    raw_data = raw_res.get("data", [])
    print(f"Xong! ({len(raw_data)} tokens)")

    # Sắp xếp theo Volume 24h
    all_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    all_tokens.sort(key=lambda x: safe_float(x.get("volume24h")), reverse=True)
    
    vip = all_tokens[:TOP_TOKEN_LIMIT]
    normal = all_tokens[TOP_TOKEN_LIMIT:]
    trash = [t for t in raw_data if safe_float(t.get("volume24h")) == 0]

    results = []

    print(f"💎 Xử lý {len(vip)} Token VIP (Fetch chi tiết)...")
    for t in vip:
        r = process_token_smart(t, is_vip=True)
        if r: results.append(r)
        
    print(f"⚡ Xử lý nhanh {len(normal)} Token thường...")
    for t in normal:
        r = process_token_smart(t, is_vip=False)
        if r: results.append(r)
        
    for t in trash:
        r = process_token_smart(t, is_vip=False)
        if r: results.append(r)

    # Sắp xếp danh sách cuối cùng theo volume total thực tế
    results.sort(key=lambda x: x["volume"]["daily_total"], reverse=True)

    final_output = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "total_tokens": len(results),
        "tokens": results
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT! Thời gian: {time.time()-start:.1f}s")

if __name__ == "__main__":
    fetch_data()
