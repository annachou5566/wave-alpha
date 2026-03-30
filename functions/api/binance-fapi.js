export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // 1. Mở khóa CORS an toàn
    const origin = request.headers.get('Origin') || '';
    let allowedOrigin = 'https://wave-alpha.pages.dev';
    if (origin.endsWith('.github.dev') || origin.endsWith('idx.google.com') || origin.startsWith('http://localhost')) {
        allowedOrigin = origin;
    }

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

    // 2. Lấy đường dẫn API người dùng muốn gọi
    const endpoint = url.searchParams.get('endpoint');
    const symbol = url.searchParams.get('symbol');
    
    if (!endpoint) {
        return new Response(JSON.stringify({ error: "Missing endpoint" }), { status: 400 });
    }

    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url, request);
        let response = await cache.match(cacheKey);

        if (!response) {
            // Lắp ráp URL để gọi ngầm lên Binance
            let targetUrl = `https://fapi.binance.com${endpoint}`;
            if (symbol) {
                targetUrl += `?symbol=${symbol}`;
            }

            const upstreamResponse = await fetch(targetUrl);
            if (!upstreamResponse.ok) throw new Error(`Binance API error`);

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // Kích hoạt Cache 15 giây (Bảo vệ dự án khỏi lệnh cấm của Binance)
            headers.set('Cache-Control', 'public, s-maxage=15, max-age=15');

            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // Cập nhật CORS nếu lấy từ Cache
            response = new Response(response.body, response);
            response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        }

        return response;
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500, 
            headers: { "Access-Control-Allow-Origin": allowedOrigin } 
        });
    }
}
