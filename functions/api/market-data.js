export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // 1. CORS an toàn tuyệt đối
    const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788', 'http://localhost:3000'];
    const isSafeDev = origin.endsWith('.github.dev') && origin.includes('annachou5566');
    const allowedOrigin = (ALLOWED_ORIGINS.includes(origin) || isSafeDev) ? origin : ALLOWED_ORIGINS[0];

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
        // Bỏ request object để làm key thuần túy, tăng tỷ lệ Hit Cache
        const cacheKey = new Request(url.toString(), { method: 'GET' });
        let response = await cache.match(cacheKey);

        if (!response) {
            const renderApiKey = env.RENDER_API_KEY;
            if (!renderApiKey) {
                return new Response(JSON.stringify({ error: "Server misconfigured: Missing API Key" }), { 
                    status: 500, 
                    headers: { "Access-Control-Allow-Origin": allowedOrigin } 
                });
            }
            
            const upstream = `https://alpha-realtime.onrender.com/api/market-data`;
            const upstreamResponse = await fetch(upstream, {
                headers: { 'x-api-key': renderApiKey }
            });

            if (!upstreamResponse.ok) throw new Error("Render is down");

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // 2. Chống bão request sập server bằng stale-while-revalidate
            headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=20'); 

            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // 3. Clone body để tránh lỗi "ReadableStream already consumed"
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
        return new Response(JSON.stringify({ error: "Upstream Error" }), { 
            status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin }
        });
    }
}
