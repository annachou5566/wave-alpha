export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin') || '';
    
    // 1. Mở khóa CORS an toàn tuyệt đối
    const ALLOWED_ORIGINS = [
        'https://wave-alpha.pages.dev',
        'http://localhost:8788',
        'http://localhost:3000'
    ];
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

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

    try {
        const cache = caches.default;
        // [BẢO MẬT] Chỉ dùng URL thuần làm khóa cache, không dùng request object
        const cacheKey = new Request(request.url);
        let response = await cache.match(cacheKey);

        if (!response) {
            // Lấy dữ liệu từ Render.com
            const upstream = `https://alpha-realtime.onrender.com/api/competition-data`;
            
            // [BẢO MẬT] Lấy API Key từ Cloudflare Variables và đính kèm vào Header
            const renderApiKey = env.RENDER_API_KEY;
            const upstreamResponse = await fetch(upstream, {
                headers: { 'x-api-key': renderApiKey || '' }
            });
            
            if (!upstreamResponse.ok) throw new Error("Render is down");

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // Ép Cache 180 giây (3 phút) để giảm tải triệt để cho Render
            headers.set('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=60');

            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // Cập nhật lại header cho response từ bộ nhớ đệm
            response = new Response(response.body, response);
            response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        }
        return response;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Upstream Error" }), { 
            status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin }
        });
    }
}
