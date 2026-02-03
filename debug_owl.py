import requests
import json
import datetime

# Cấu hình Token OWL (BSC)
CHAIN_ID = "56"
CONTRACT = "0x51e667e91b4b8cb8e6e0528757f248406bd34b57"
URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/agg-klines"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "client-type": "web"
}

def format_num(n):
    try: return f"{float(n):,.0f}"
    except: return "0"

def get_time(ts):
    return datetime.datetime.fromtimestamp(int(ts)/1000).strftime('%Y-%m-%d %H:%M:%S')

def check_api(dtype):
    print(f"\n--- KIỂM TRA: {dtype.upper()} ---")
    # Lấy 5 cây nến gần nhất để xem xu hướng và thời gian
    full_url = f"{URL}?chainId={CHAIN_ID}&interval=1d&limit=5&tokenAddress={CONTRACT}&dataType={dtype}"
    
    try:
        res = requests.get(full_url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            data = res.json()
            kline_infos = data.get("data", {}).get("klineInfos", [])
            
            if not kline_infos:
                print(f"❌ KẾT QUẢ: Rỗng (Binance không trả về dữ liệu {dtype})")
            else:
                print(f"✅ Tìm thấy {len(kline_infos)} cây nến.")
                # In chi tiết 2 cây nến cuối cùng
                for i, k in enumerate(kline_infos[-2:]):
                    ts = k[0]
                    vol_idx_5 = k[5] # Index 5
                    print(f"   👉 Nến {i+1} | Time: {get_time(ts)} | Vol: {format_num(vol_idx_5)}")
        else:
            print(f"❌ LỖI HTTP: {res.status_code}")
    except Exception as e:
        print(f"❌ LỖI CODE: {e}")

print("🔍 ĐANG DEBUG TOKEN: OWL (BSC)...")
check_api("limit")     # Sổ lệnh
check_api("market")    # On-chain
check_api("aggregate") # Tổng hợp
