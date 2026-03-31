export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    // 1. CORS an toàn tuyệt đối
    const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788', 'http://localhost:3000'];
    const origin = request.headers.get('Origin') || '';
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
    
    const contract = url.searchParams.get('contractAddress');
    const chainId = url.searchParams.get('chainId');

    try {
        const cache = caches.default;
        const cacheKey = new Request(url.toString(), { method: 'GET' });
        let response = await cache.match(cacheKey);

        if (!response) {
            // 2. Chống Parameter Injection (Bọc chuỗi an toàn bằng searchParams)
            const upstreamUrl = new URL('https://alpha-realtime.onrender.com/api/smart-money');
            if (contract) upstreamUrl.searchParams.set('contractAddress', contract);
            if (chainId) upstreamUrl.searchParams.set('chainId', chainId);
            
            // CẦM CHÌA KHÓA LÊN RENDER
            const upstreamResponse = await fetch(upstreamUrl.toString(), { 
                headers: { 'x-api-key': env.RENDER_API_KEY || '' } 
            });
            
            if (!upstreamResponse.ok) throw new Error("Upstream failed");

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // 3. Chống bão request sập server bằng stale-while-revalidate
            headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
            
            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // 4. Clone body để tránh lỗi mất dữ liệu khi đọc từ Cache
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
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
            status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin } 
        });
    }
}
