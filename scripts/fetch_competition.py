import json
import os
import time
import urllib.parse
from datetime import datetime, timedelta
from dotenv import load_dotenv
import cloudscraper
import boto3
from botocore.config import Config
import requests

# --- 1. CẤU HÌNH ---
load_dotenv()

# Cấu hình R2
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")

# Cấu hình Supabase (Để lấy danh sách giải đấu)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Hoặc Anon Key đều được

# Proxy & API
PROXY_WORKER_URL = os.getenv("PROXY_WORKER_URL")
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")

# --- KẾT NỐI R2 ---
def get_r2_client():
    if not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        print("⚠️ Thiếu R2 Credentials!")
        return None
    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version='s3v4')
    )

session = cloudscraper.create_scraper()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com"
})

# --- HÀM PROXY (Bypass chặn IP) ---
def fetch_smart(target_url, retries=3):
    is_render = "onrender.com" in (PROXY_WORKER_URL or "")
    if not target_url: return None

    for i in range(retries):
        if PROXY_WORKER_URL:
            try:
                encoded_target = urllib.parse.quote(target_url, safe='')
                proxy_final_url = f"{PROXY_WORKER_URL}?url={encoded_target}"
                current_timeout = 60 if (is_render and i == 0) else 30
                res = session.get(proxy_final_url, timeout=current_timeout)
                if res.status_code == 200:
                    data = res.json()
                    if isinstance(data, dict): return data
            except: pass
        
        try:
            res = session.get(target_url, timeout=15)
            if res.status_code == 200: return res.json()
        except: pass
        time.sleep(1)
    return None

def safe_float(v):
    try: return float(v) if v else 0.0
    except: return 0.0

# --- LẤY DANH SÁCH GIẢI ĐẤU TỪ SUPABASE ---
def get_active_tournaments():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️ Thiếu cấu hình Supabase! Không thể lấy danh sách giải đấu.")
        return []

    print("⏳ Đang lấy danh sách giải đấu từ Supabase...", end=" ")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Logic: Lấy các giải đấu chưa kết thúc (end_time >= hôm nay HOẶC null)
    # Ta lấy dư ra một chút để chắc chắn không sót
    try:
        # API Rest của Supabase: /rest/v1/tournaments?select=name,contract,data
        # Lọc đơn giản: Lấy hết về rồi filter bằng Python cho an toàn và dễ debug
        url = f"{SUPABASE_URL}/rest/v1/tournaments?select=id,name,contract,data&id=neq.-1"
        
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            print(f"Lỗi Supabase: {res.status_code}")
            return []
            
        data = res.json()
        active_list = []
        
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        
        for item in data:
            meta = item.get("data", {}) or {}
            end_date = meta.get("end")
            
            # Nếu không có ngày kết thúc HOẶC ngày kết thúc >= hôm nay -> Lấy
            if not end_date or end_date >= today_str:
                contract = item.get("contract")
                # Ưu tiên lấy contract trong data (vì đôi khi cột contract bên ngoài null)
                if not contract and meta.get("contractAddress"):
                    contract = meta.get("contractAddress")
                
                # Cần thêm AlphaID để gọi API Limit (nếu có)
                alpha_id = None
                if meta.get("alphaId"): alpha_id = meta.get("alphaId")
                
                # Cần ChainID
                chain_id = meta.get("chainId")

                if contract and chain_id:
                    active_list.append({
                        "symbol": item.get("name"),
                        "contract": contract.lower().strip(),
                        "chainId": chain_id,
                        "alphaId": alpha_id,
                        "quoteAsset": meta.get("quoteAsset", "USDT") # Mặc định USDT
                    })
        
        print(f"OK ({len(active_list)} giải đang chạy)")
        return active_list

    except Exception as e:
        print(f"Lỗi exception: {e}")
        return []

# --- LẤY LỊCH SỬ LIMIT (7 NGÀY) ---
def fetch_limit_history(token_info):
    if not API_AGG_KLINES: return []
    
    alpha_id = token_info.get("alphaId")
    contract = token_info.get("contract")
    chain_id = token_info.get("chainId")
    quote_asset = token_info.get("quoteAsset")

    # Xử lý logic chọn USDT/USDC y hệt code Deno
    c_id_str = str(chain_id).lower()
    # Nếu là Base hoặc Solana -> Dùng USDC
    if c_id_str == "8453" or "base" in c_id_str or "sol" in c_id_str:
        quote_asset = "USDC"
    
    # 7 ngày = 168 giờ
    limit_hours = 168 
    
    # Ưu tiên gọi API Limit theo Symbol (alphaId) nếu có -> Chuẩn hơn
    # Nếu không có alphaId thì mới fallback về contract (nhưng limit thường cần symbol)
    url = ""
    if alpha_id:
        # API Limit chuẩn: public/alpha-trade/klines?symbol=...
        # Lưu ý: API này dùng Symbol (VD: 12345USDT)
        base_url = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines"
        url = f"{base_url}?symbol={alpha_id}{quote_asset}&interval=1h&limit={limit_hours}"
    else:
        # Fallback: Dùng API Agg Klines nhưng set dataType=limit (ít chính xác hơn chút)
        url = f"{API_AGG_KLINES}?chainId={chain_id}&interval=1h&limit={limit_hours}&tokenAddress={contract}&dataType=limit"

    data = fetch_smart(url)
    chart_points = []
    
    # Xử lý dữ liệu trả về
    # Format Binance: [Time, Open, High, Low, Close, Volume, ..., QuoteVol(7), Count(8), ...]
    k_infos = []
    if data and data.get("data"):
        if isinstance(data["data"], list): # API alpha-trade trả về list trực tiếp
             k_infos = data["data"]
        elif data["data"].get("klineInfos"): # API agg-klines trả về object con
             k_infos = data["data"]["klineInfos"]

    for k in k_infos:
        try:
            ts = int(k[0])
            high = safe_float(k[2])
            low = safe_float(k[3])
            # Index 7 là Quote Volume (Volume tính bằng tiền USD) -> Cái này mới quan trọng cho Limit
            limit_vol_usd = safe_float(k[7]) 
            tx_count = int(k[8]) if len(k) > 8 else 0
            
            # Tính Risk Spread (Biến động trong cây nến đó)
            risk = 0
            if low > 0:
                spread_pct = ((high - low) / low) * 100
                if spread_pct > 5: risk = 2      # Biến động > 5% -> Spread to
                elif spread_pct > 2: risk = 1    # Trung bình
            
            # [Time, LimitVol($), TxCount, RiskScore]
            chart_points.append([ts, int(limit_vol_usd), tx_count, risk])
        except: continue
            
    return chart_points

def main():
    start_time = time.time()
    r2 = get_r2_client()
    if not r2: return

    # 1. Lấy danh sách Token ĐANG CÓ GIẢI ĐẤU (Từ Supabase)
    target_tokens = get_active_tournaments()
    
    if not target_tokens:
        print("❌ Không tìm thấy giải đấu nào đang chạy.")
        return

    history_data = {}

    # 2. Quét từng token
    print(f"🚀 Bắt đầu quét {len(target_tokens)} token (Chế độ: LIMIT Only, 7 Ngày)...")
    
    for t in target_tokens:
        symbol = t.get("symbol")
        contract = t.get("contract")
        
        print(f"📊 {symbol}...", end=" ", flush=True)
        points = fetch_limit_history(t)
        
        if points:
            # Lưu key là contract lowercase để Frontend dễ map
            history_data[contract] = {
                "s": symbol,
                "q": t.get("quoteAsset"), # Để frontend biết là USDT hay USDC
                "h": points 
            }
            print(f"OK ({len(points)}h)")
        else:
            print("No Data")
        
        time.sleep(0.5) 

    # 3. Upload lên R2
    final_json = {
        "updated_at": int(time.time() * 1000),
        "note": "Hourly Limit Volume (7 Days)",
        "data": history_data
    }
    
    print("☁️ Uploading competition-history.json...")
    try:
        r2.put_object(
            Bucket=R2_BUCKET_NAME,
            Key='competition-history.json', 
            Body=json.dumps(final_json, separators=(',', ':')).encode('utf-8'),
            ContentType='application/json',
            CacheControl='max-age=1800' 
        )
        print("✅ Success!")
    except Exception as e:
        print(f"❌ Upload Error: {e}")

    print(f"🏁 DONE in {time.time() - start_time:.1f}s")

if __name__ == "__main__":
    main()