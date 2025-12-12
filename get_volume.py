import cloudscraper
import json
import pandas as pd
import time
from datetime import datetime, timezone

# --- BƯỚC 1: CẤU HÌNH API ---
TARGET_TOKENS = ['NIGHT', 'ARTX', 'DGRAM', 'KOGE', 'JCT', 'CYS', 'LAB']
LIST_URL = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
KLINE_URL = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines"

def get_daily_alpha_volume_utc():
    scraper = cloudscraper.create_scraper()
    
    # 1. Lấy danh sách ID
    try:
        resp = scraper.get(LIST_URL).json()
        if not resp.get('success'): return {}
        
        token_map = {}
        for item in resp['data']:
            if item.get('symbol') in TARGET_TOKENS:
                token_map[item.get('symbol')] = item.get('alphaId')
    except Exception:
        return {} # Trả về rỗng nếu lỗi

    # 2. Lấy Volume từng con và lưu vào final_data
    final_data = {}
    
    for name, alpha_id in token_map.items():
        pair_symbol = f"{alpha_id}USDT"
        params = {"symbol": pair_symbol, "interval": "1d", "limit": "1"}
        
        try:
            kline_resp = scraper.get(KLINE_URL, params=params).json()
            if kline_resp.get('success') and kline_resp.get('data'):
                # Vị trí 7 là Volume USDT
                vol_today_usdt = float(kline_resp['data'][0][7])
                current_price = float(kline_resp['data'][0][4])
                
                final_data[name] = {
                    "volume": vol_today_usdt,
                    "price": current_price
                }
            else:
                final_data[name] = {"volume": 0, "price": 0}
        except:
            final_data[name] = {"volume": 0, "price": 0}
        
        time.sleep(0.5)

    return final_data

if __name__ == "__main__":
    data = get_daily_alpha_volume_utc()
    # Lưu kết quả vào file JSON để website đọc
    with open('alpha_data.json', 'w') as f:
        json.dump(data, f)
