export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // 1. Chỉ định CORS an toàn tuyệt đối
    const ALLOWED_ORIGINS = [
        'https://wave-alpha.pages.dev',
        'http://localhost:8788',
        'http://localhost:3000'
    ];
    const origin = request.headers.get('Origin') || '';
    
    // Cho phép Github Codespace nếu domain chứa username của bạn để tránh bypass
    const isSafeDev = origin.endsWith('.github.dev') && origin.includes('annachou5566'); 
    const allowedOrigin = (ALLOWED_ORIGINS.includes(origin) || isSafeDev) ? origin : ALLOWED_ORIGINS[0];

    // Xử lý OPTIONS request
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

    // 2. Lấy các tham số từ URL client gửi lên
    const contract = url.searchParams.get('contract');
    const chainId = url.searchParams.get('chainId');
    const interval = url.searchParams.get('interval');
    const limit = url.searchParams.get('limit');

    if (!contract) {
        return new Response(JSON.stringify({ error: "Missing contract" }), { status: 400 });
    }

    try {
        // 3. KÍCH HOẠT CACHE
        const cache = caches.default;
        // [BẢO MẬT] Bỏ bớt Request headers khi làm cache key để tránh miss cache không đáng có
        const cacheKey = new Request(url.toString(), { method: 'GET' });
        let response = await cache.match(cacheKey);

        if (!response) {
            // Đứng từ Cloudflare gọi ngầm về Render.com
            // [BẢO MẬT] Dùng URLSearchParams để build URL, chống Parameter Injection
            const upstreamUrl = new URL('https://alpha-realtime.onrender.com/api/klines');
            upstreamUrl.searchParams.set('contract', contract);
            if (chainId) upstreamUrl.searchParams.set('chainId', chainId);
            if (interval) upstreamUrl.searchParams.set('interval', interval);
            if (limit) upstreamUrl.searchParams.set('limit', limit);
            
            // Lấy API Key từ Cloudflare Variables và đính kèm vào Header
            const renderApiKey = env.RENDER_API_KEY;
            const upstreamResponse = await fetch(upstreamUrl.toString(), {
                headers: { 'x-api-key': renderApiKey || '' }
            });

            if (!upstreamResponse.ok) throw new Error("Upstream failed");

            // Sao chép response từ Render về
            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // Lệnh cho Cloudflare: Thêm stale-while-revalidate để cứu Render server khỏi Thundering Herd
            headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');

            response = new Response(upstreamResponse.body, { headers });
            
            // Lưu vào bộ nhớ đệm
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // Fix lỗi Cache Body "already read": Clone response trước khi modify header
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
        console.error('[Render Proxy Error]', e);
        return new Response(JSON.stringify({ error: "Internal Server Error", data: [] }), { 
            status: 500,
            headers: { "Access-Control-Allow-Origin": allowedOrigin }
        });
    }
}
