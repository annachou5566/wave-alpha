import requests
import json

# --- HEADERS GIẢ LẬP TRÌNH DUYỆT ---
FAKE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.binance.com/en/alpha",
    "client-type": "web",
    "content-type": "application/json"
}

API_TOKEN_LIST = "https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list"
API_AGG_TICKER = "https://www.binance.com/bapi/defi/v1/public/alpha-trade/aggTicker24?dataType=aggregate"

def debug_data():
    print("🕵️  ĐANG SOI DỮ LIỆU TỪ BINANCE...\n")

    # 1. KIỂM TRA API TOKEN LIST
    try:
        print("➤ 1. Đang gọi API TOKEN LIST...")
        r1 = requests.get(API_TOKEN_LIST, headers=FAKE_HEADERS, timeout=10)
        d1 = r1.json().get("data", [])
        
        if d1:
            print(f"   ✅ Lấy được {len(d1)} tokens.")
            print("   👉 MẪU DỮ LIỆU (Token đầu tiên):")
            print(json.dumps(d1[0], indent=2, ensure_ascii=False))
            
            # Lấy thử mẫu symbol để so sánh
            sample_symbols = [t.get("symbol") for t in d1[:5]]
            sample_alpha_ids = [t.get("alphaId") for t in d1[:5]]
            print(f"   👉 Danh sách Symbol mẫu: {sample_symbols}")
            print(f"   👉 Danh sách AlphaID mẫu: {sample_alpha_ids}")
        else:
            print("   ❌ API List trả về rỗng!")
    except Exception as e:
        print(f"   ❌ Lỗi API List: {e}")

    print("\n" + "="*50 + "\n")

    # 2. KIỂM TRA API AGG TICKER (GIÁ)
    try:
        print("➤ 2. Đang gọi API AGG TICKER (GIÁ)...")
        r2 = requests.get(API_AGG_TICKER, headers=FAKE_HEADERS, timeout=10)
        d2 = r2.json().get("data", [])
        
        if d2:
            print(f"   ✅ Lấy được {len(d2)} tickers.")
            print("   👉 MẪU DỮ LIỆU (Ticker đầu tiên):")
            print(json.dumps(d2[0], indent=2, ensure_ascii=False))
            
            # In ra 10 cái key 's' (symbol) đầu tiên để xem định dạng nó là gì
            keys_in_ticker = [t.get("s") for t in d2[:10]]
            print(f"   👉 SAMPLE KEYS trong Ticker (s): {keys_in_ticker}")
        else:
            print("   ❌ API AggTicker trả về rỗng!")
    except Exception as e:
        print(f"   ❌ Lỗi API AggTicker: {e}")

if __name__ == "__main__":
    debug_data()
