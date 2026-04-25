export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin') || '';
    let allowedOrigin = 'https://wave-alpha.pages.dev';
    if (origin.endsWith('.github.dev') || origin.endsWith('idx.google.com') || origin.startsWith('http://localhost')) {
        allowedOrigin = origin;
    }

    try {
        const cache = caches.default;
        const cacheKey = new Request(request.url, { method: 'GET' });
        let response = await cache.match(cacheKey);

        if (!response) {
            const url = new URL(request.url);
            const symbol = url.searchParams.get('symbol');
            const limit = url.searchParams.get('limit') || 50;
            
            // Gọi về Render qua cửa ngõ bảo mật
            const upstream = `https://alpha-realtime.onrender.com/api/full-depth?symbol=${symbol}&limit=${limit}`;
            const upstreamResponse = await fetch(upstream);

            if (!upstreamResponse.ok) throw new Error("Render Error");

            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            
            // Cache 10 giây trên Cloudflare cho Sổ lệnh (vừa đủ nhanh vừa cực nhẹ cho Render)
            headers.set('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=5');

            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            response = new Response(response.body, response);
            response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
        }
        return response;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Depth Error" }), { status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin } });
    }
}