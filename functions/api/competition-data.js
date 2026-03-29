export async function onRequest(context) {
    const { request } = context;
    const origin = request.headers.get('Origin') || '';
    
    // 1. Mở khóa CORS
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

    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url, request);
        let response = await cache.match(cacheKey);

        if (!response) {
            // Lấy dữ liệu từ Render.com
            const upstream = `https://alpha-realtime.onrender.com/api/competition-data`;
            const upstreamResponse = await fetch(upstream);
            if (!upstreamResponse.ok) throw new Error("Render is down");

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // Ép Cache 60 giây: Trình duyệt sẽ load cái vèo, không cần đợi Render!
            headers.set('Cache-Control', 'public, s-maxage=60, max-age=60');

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
