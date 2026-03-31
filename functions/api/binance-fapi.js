export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // 1. Mở khóa CORS an toàn (Chỉ định rõ domain)
    const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788', 'http://localhost:3000'];
    const origin = request.headers.get('Origin') || '';
    
    // Chỉ cho phép Github Codespace nếu domain chứa username của bạn để tránh bypass
    const isSafeDev = origin.endsWith('.github.dev') && origin.includes('annachou5566'); 
    let allowedOrigin = (ALLOWED_ORIGINS.includes(origin) || isSafeDev) ? origin : ALLOWED_ORIGINS[0];

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowedOrigin,
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Max-Age": "86400",
                "Vary": "Origin"
            }
        });
    }

    // 2. Lấy và Validate endpoint để chống SSRF
    const endpoint = url.searchParams.get('endpoint');
    const symbol = url.searchParams.get('symbol');
    
    // Whitelist các endpoint hợp lệ được phép gọi lên Binance
    const ALLOWED_ENDPOINTS = [
        '/fapi/v1/klines', 
        '/fapi/v1/ticker/24hr', 
        '/fapi/v1/ticker/price', 
        '/fapi/v1/premiumIndex',
        '/fapi/v1/depth',
        '/fapi/v1/trades',
        '/fapi/v2/ticker/price',
        '/fapi/v1/exchangeInfo'
    ];

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
        return new Response(JSON.stringify({ error: "Invalid or blocked endpoint" }), { status: 403 });
    }

    try {
        const cache = caches.default;
        // Bỏ bớt Request headers khi làm cache key để tránh miss cache không đáng có
        const cacheKey = new Request(url.toString(), { method: 'GET' });
        let response = await cache.match(cacheKey);

        if (!response) {
            // 3. Lắp ráp URL an toàn bằng URL object thay vì cộng chuỗi
            let targetUrl = new URL(`https://fapi.binance.com${endpoint}`);
            
            if (symbol) {
                // Validate symbol: Chỉ cho phép chữ hoa và số, độ dài 2-20 ký tự
                if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
                    return new Response(JSON.stringify({ error: "Invalid symbol format" }), { status: 400 });
                }
                targetUrl.searchParams.set('symbol', symbol);
            }

            const upstreamResponse = await fetch(targetUrl.toString());
            if (!upstreamResponse.ok) throw new Error(`Binance API error`);

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // 4. Kích hoạt Cache 15 giây + stale-while-revalidate (30s) chống thundering herd
            headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30');

            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // 5. Fix lỗi Cache Body "already read": Clone response trước khi modify header
            const cachedClone = response.clone();
            const newHeaders = new Headers(cachedClone.headers);
            newHeaders.set("Access-Control-Allow-Origin", allowedOrigin);
            newHeaders.set("Vary", "Origin");
            
            response = new Response(cachedClone.body, {
                status: cachedClone.status,
                statusText: cachedClone.statusText,
                headers: newHeaders
            });
        }

        return response;
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500, 
            headers: { "Access-Control-Allow-Origin": allowedOrigin } 
        });
    }
}
