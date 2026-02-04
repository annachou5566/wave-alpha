import json
import os
import time
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv
import requests 
import cloudscraper 
from concurrent.futures import ThreadPoolExecutor, as_completed


load_dotenv()

PROXY_WORKER_URL = os.getenv("PROXY_WORKER_URL")
API_AGG_TICKER = os.getenv("BINANCE_INTERNAL_AGG_API")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")
API_PUBLIC_SPOT = "https://api.binance.com/api/v3/exchangeInfo"




MAX_WORKERS = 5 

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


def fetch_smart(target_url, retries=3):
    """
    Hàm gọi API thông minh:
    - Tự động mã hóa URL để tránh lỗi ký tự đặc biệt qua Proxy.
    - Tự động Retry nếu Render đang ngủ hoặc Binance chặn nhẹ.
    """
    is_render = "onrender.com" in (PROXY_WORKER_URL or "")
    
    if not target_url or "None" in target_url:
        print(f"❌ LỖI: URL mục tiêu không hợp lệ!")
        return None

    for i in range(retries):

        if PROXY_WORKER_URL:
            try:

                encoded_target = urllib.parse.quote(target_url, safe='')
                proxy_final_url = f"{PROXY_WORKER_URL}?url={encoded_target}"
                

                current_timeout = 50 if (is_render and i == 0) else 20
                
                res = requests.get(proxy_final_url, timeout=current_timeout)
                
                if res.status_code == 200:
                    data = res.json()

                    if isinstance(data, dict):
                        if "symbols" in data: return data
                        if data.get("code") == "000000": return data
                        
                elif res.status_code == 403:

                    pass 
                elif res.status_code == 502:
                    time.sleep(3)
            except: pass
        

        try:
            res = scraper.get(target_url, headers=HEADERS, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if "symbols" in data: return data
                if data.get("code") == "000000": return data
        except: pass
        
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

    try:
        print("⏳ Đang lấy danh sách Spot Market...", end=" ", flush=True)
        data = fetch_smart(API_PUBLIC_SPOT)
        if data and "symbols" in data:
            res = {s["baseAsset"] for s in data["symbols"] if s["status"] == "TRADING"}
            print(f"OK ({len(res)} symbols)")
            return res
    except Exception as e: 
        print(f"❌ Lỗi lấy Spot: {e}")
    
    print("⚠️ Không lấy được danh sách Spot (Dùng backup rỗng)")
    return set()


def fetch_details_optimized(chain_id, contract_addr):
    """
    Chiến thuật lấy dữ liệu Tiết kiệm & Chính xác:
    1. Gọi Aggregate (Tổng).
    2. Gọi Limit (QUAN TRỌNG ĐỂ CHECK SỐNG/CHẾT).
    3. Market (On-chain) = Tổng - Limit.
    4. Chart 1H (Để vẽ biểu đồ).
    """
    if not API_AGG_KLINES: return 0, 0, 0, []


    no_lower_chains = ["CT_501", "CT_784"]
    clean_addr = str(contract_addr)
    if chain_id not in no_lower_chains:
        clean_addr = clean_addr.lower()
    
    base_url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1d&limit=5&tokenAddress={clean_addr}"
    
    d_total, d_limit = 0.0, 0.0
    chart_data = []


    res_limit = fetch_smart(f"{base_url}&dataType=limit")
    if res_limit and res_limit.get("data") and res_limit["data"].get("klineInfos"):
        k = res_limit["data"]["klineInfos"]
        d_limit = safe_float(k[-1][5])


    res_agg = fetch_smart(f"{base_url}&dataType=aggregate")
    if res_agg and res_agg.get("data") and res_agg["data"].get("klineInfos"):
        k = res_agg["data"]["klineInfos"]
        d_total = safe_float(k[-1][5])


    d_market = d_total - d_limit
    if d_market < 0: d_market = 0 


    url_chart = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1h&limit=24&tokenAddress={clean_addr}&dataType=aggregate"
    res_chart = fetch_smart(url_chart)
    if res_chart and res_chart.get("data") and res_chart["data"].get("klineInfos"):
        chart_data = [{"p": safe_float(k[4]), "v": safe_float(k[5])} for k in res_chart["data"]["klineInfos"]]

    return d_total, d_limit, d_market, chart_data


def process_single_token(item):
    aid = item.get("alphaId")
    if not aid: return None


    vol_rolling = safe_float(item.get("volume24h"))
    symbol = item.get("symbol")
    contract = item.get("contractAddress")
    chain_id = item.get("chainId")
    
    is_offline = item.get("offline", False)
    is_listing_cex = item.get("listingCex", False)
    

    status = "ALPHA"
    need_limit_check = False

    if is_offline:
        if is_listing_cex or symbol in ACTIVE_SPOT_SYMBOLS:
            status = "SPOT"
        else:


            status = "PRE_DELISTED"
            need_limit_check = True





    should_fetch = False
    
    if vol_rolling > 0:
        if status == "ALPHA" or status == "PRE_DELISTED":
            should_fetch = True
    
    daily_total, daily_limit, daily_onchain = 0.0, 0.0, 0.0
    chart_data = []
    old = OLD_DATA_MAP.get(aid)
    
    if should_fetch:
        try:

            d_t, d_l, d_m, chart = fetch_details_optimized(chain_id, contract)
            
            daily_total = d_t
            daily_limit = d_l
            daily_onchain = d_m
            chart_data = chart
            

            if need_limit_check:

                if daily_limit > 0:
                    status = "ALPHA"
                else:

                    status = "DELISTED"
            

            if daily_total <= 0: daily_total = vol_rolling
            
        except Exception as e:

            if old: 
                daily_total = safe_float(old["volume"]["daily_total"])
                daily_limit = safe_float(old["volume"]["daily_limit"])
                daily_onchain = safe_float(old["volume"]["daily_onchain"])
                chart_data = old.get("chart", [])
                

                if need_limit_check:
                    if daily_limit > 0: status = "ALPHA"
                    else: status = "DELISTED"
            else: 

                daily_total = vol_rolling
                if need_limit_check: status = "DELISTED"
    else:


        if old:
            daily_total = safe_float(old["volume"]["daily_total"])
            chart_data = old.get("chart", [])
        else: daily_total = vol_rolling
        

        if status == "PRE_DELISTED": status = "DELISTED"

    return {
        "id": aid,
        "symbol": symbol,
        "name": item.get("name"),
        "icon": item.get("iconUrl"),
        "chain": item.get("chainName", ""),
        "contract": contract,
        "status": status,
        "offline": is_offline,
        "price": safe_float(item.get("price")),
        "change_24h": safe_float(item.get("percentChange24h")),
        "market_cap": safe_float(item.get("marketCap")),
        "volume": {
            "rolling_24h": vol_rolling,
            "daily_total": daily_total,
            "daily_limit": daily_limit,
            "daily_onchain": daily_onchain
        },
        "chart": chart_data
    }


def fetch_data():
    global ACTIVE_SPOT_SYMBOLS, OLD_DATA_MAP
    start = time.time()
    
    print(f"🛡️ [MODE: PARALLEL WORKERS] Max Workers: {MAX_WORKERS}")
    if not API_AGG_TICKER: 
        print("❌ LỖI: Thiếu biến môi trường API_AGG_TICKER")
        return

    OLD_DATA_MAP = load_old_data()
    ACTIVE_SPOT_SYMBOLS = get_active_spot_symbols()
    
    print("⏳ Đang lấy danh sách Token tổng...", end=" ", flush=True)
    raw_res = fetch_smart(API_AGG_TICKER)
    if not raw_res:
        print("\n❌ THẤT BẠI: Không kết nối được API tổng.")
        return
    
    raw_data = raw_res.get("data", [])
    print(f"Xong! ({len(raw_data)} tokens)")



    target_tokens = [t for t in raw_data if safe_float(t.get("volume24h")) > 0]
    
    results = []
    print(f"🚀 Bắt đầu quét đa luồng {len(target_tokens)} Tokens...")
    

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:

        future_to_token = {executor.submit(process_single_token, t): t for t in target_tokens}
        
        completed_count = 0
        total_tasks = len(target_tokens)
        
        for future in as_completed(future_to_token):
            token = future_to_token[future]
            try:
                data = future.result()
                if data: results.append(data)
            except Exception as e:
                print(f"❌ Lỗi xử lý {token.get('symbol')}: {e}")
            
            completed_count += 1

            if completed_count % 50 == 0:
                print(f"   ...Đã xong {completed_count}/{total_tasks} ({time.time()-start:.0f}s)")


    results.sort(key=lambda x: x["volume"]["daily_total"], reverse=True)

    final_output = {
        "last_updated": datetime.now().strftime("%H:%M %d/%m"),
        "total_tokens": len(results),
        "tokens": results
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final_output, f, ensure_ascii=False, indent=2)
        
    print(f"✅ HOÀN TẤT TOÀN BỘ! Tổng thời gian: {time.time()-start:.1f}s")

if __name__ == "__main__":
    fetch_data()
