import requests
import json
import datetime

# Cấu hình Token KOGE (BSC)
CHAIN_ID = "56"
CONTRACT = "0xe6df05ce8c8301223373cf5b969afcb1498c5528"
URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/agg-klines"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "Origin": "https://www.binance.com",
    "client-type": "web"
}

def format_num(n):
    try:
        val = float(n)
        return f"{val:,.0f}"
    except: return "0"

def get_time(ts):
    return datetime.datetime.fromtimestamp(int(ts)/1000).strftime('%Y-%m-%d')

def check_api(dtype):
    print(f"\n--- KIỂM TRA: {dtype.upper()} ---")
    # Lấy 3 cây nến gần nhất
    full_url = f"{URL}?chainId={CHAIN_ID}&interval=1d&limit=3&tokenAddress={CONTRACT}&dataType={dtype}"
    print(f"🔗 Gọi: {full_url}")
    
    try:
        res = requests.get(full_url, headers=HEADERS, timeout=10)
        
        if res.status_code == 200:
            data = res.json()
            kline_infos = data.get("data", {}).get("klineInfos", [])
            
            if not kline_infos:
                print("❌ KẾT QUẢ: Rỗng")
            else:
                print(f"✅ Tìm thấy {len(kline_infos)} cây nến.")
                # Soi 2 cây nến cuối cùng
                for i, k in enumerate(kline_infos[-2:]):
                    ts = k[0]
                    close_price = k[4]
                    vol_idx_5 = k[5] # Volume chuẩn Index 5
                    vol_idx_7 = k[7] if len(k)>7 else "N/A"
                    
                    print(f"   👉 Nến {i+1} ({get_time(ts)}): Giá={close_price} | Vol(idx5)={format_num(vol_idx_5)} $")
        else:
            print(f"❌ LỖI HTTP: {res.status_code}")
    except Exception as e:
        print(f"❌ LỖI CODE: {e}")

# Chạy kiểm tra
check_api("limit")     # Sổ lệnh
check_api("market")    # On-chain
check_api("aggregate") # Tổng hợp (Cái đang bị sai)
