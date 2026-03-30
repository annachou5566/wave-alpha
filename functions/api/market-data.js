export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin') || '';

    // CORS an toàn
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
            headers.set('Cache-Control', 'public, s-maxage=10, max-age=10'); // Cache 10s vì data này cần real-time

            response = new Response(upstreamResponse.body, { headers });
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
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
