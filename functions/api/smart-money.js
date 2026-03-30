export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    
    const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788', 'http://localhost:3000'];
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Max-Age": "86400", "Vary": "Origin" }
        });
    }
    
    const contract = url.searchParams.get('contractAddress');
    const chainId = url.searchParams.get('chainId');

    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url);
        let response = await cache.match(cacheKey);

        if (!response) {
            const upstream = `https://alpha-realtime.onrender.com/api/smart-money?contractAddress=${contract}&chainId=${chainId}`;
            // CẦM CHÌA KHÓA LÊN RENDER
            const upstreamResponse = await fetch(upstream, { headers: { 'x-api-key': env.RENDER_API_KEY || '' } });
            
            if (!upstreamResponse.ok) throw new Error("Upstream failed");

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            headers.set('Cache-Control', 'public, s-maxage=60, max-age=60');
            
            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            response = new Response(response.body, response);
            response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        }
        return response;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin } });
    }
}
