import os
import requests
from dotenv import load_dotenv

load_dotenv()

# Link Render của bạn (Lấy từ env)
PROXY_WORKER_URL = os.getenv("PROXY_WORKER_URL") 
# API Klines (Lấy từ env)
API_AGG_KLINES = os.getenv("BINANCE_INTERNAL_KLINES_API")

# Token OWL (BSC) để test
CHAIN_ID = "BSC"
CONTRACT = "0x51e667e91b4b8cb8e6e0528757f248406bd34b57"

def inspect_url(datatype):
    if not API_AGG_KLINES or not PROXY_WORKER_URL:
        print("❌ LỖI: Thiếu biến môi trường PROXY_WORKER_URL hoặc API_AGG_KLINES")
        return

    target_url = f"{API_AGG_KLINES}?chainId={CHAIN_ID}&interval=1d&limit=5&tokenAddress={CONTRACT}&dataType={datatype}"
    
    print(f"\n🔍 CHECKING dataType = {datatype.upper()}...")
    print(f"👉 Target: {target_url}")
    
    try:
        # Timeout 60s cho chắc ăn
        res = requests.get(
            PROXY_WORKER_URL, 
            params={"url": target_url}, 
            timeout=60
        )
        
        print(f"📡 Status: {res.status_code}")
        
        if res.status_code == 200:
            data = res.json()
            # In ra mã lỗi của Binance
            code = data.get('code')
            print(f"📦 Data Code: {code}")
            
            if code != "000000":
                 print(f"⚠️ Binance Error: {data.get('message') or data.get('msg')}")
            
            kline = data.get('data', {}).get('klineInfos', [])
            if not kline:
                print("❌ KLINE INFOS LÀ RỖNG/NULL!")
                print("Raw Data:", str(data)[:500]) 
            else:
                print(f"✅ Có {len(kline)} cây nến.")
                print(f"📊 Cây nến cuối: {kline[-1]}")
        else:
            print(f"⛔ Lỗi HTTP: {res.status_code}")
            print(f"Body: {res.text[:200]}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

print(f"🛡️ Using Proxy: {PROXY_WORKER_URL}")
# Kiểm tra 3 loại dữ liệu
inspect_url("limit")      # Order book volume
inspect_url("market")     # On-chain volume
inspect_url("aggregate")  # Total volume
