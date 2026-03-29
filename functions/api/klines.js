export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // 1. Chỉ định CORS an toàn
    const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788'];
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

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
        // 3. KÍCH HOẠT CACHE - Cứu tinh của lỗi Cold Start Render.com
        const cache = caches.default;
        // Gom các tham số lại thành 1 khóa cache (ví dụ: BTC-15m)
        const cacheKey = new Request(url.toString(), request);
        let response = await cache.match(cacheKey);

        if (!response) {
            // Đứng từ Cloudflare gọi ngầm về Render.com (Giấu hoàn toàn Render khỏi user)
            const upstream = `https://alpha-realtime.onrender.com/api/klines?contract=${contract}&chainId=${chainId}&interval=${interval}&limit=${limit}`;
            
            const upstreamResponse = await fetch(upstream);
            if (!upstreamResponse.ok) throw new Error("Upstream failed");

            // Sao chép response từ Render về
            const headers = new Headers(upstreamResponse.headers);
            headers.set("Access-Control-Allow-Origin", allowedOrigin);
            headers.set("Vary", "Origin");
            
            // Lệnh cho Cloudflare: "Nhớ kết quả này trong 60 giây"
            headers.set('Cache-Control', 'public, s-maxage=60, max-age=60');

            response = new Response(upstreamResponse.body, { headers });
            
            // Lưu vào bộ nhớ đệm
            context.waitUntil(cache.put(cacheKey, response.clone()));
        } else {
            // Nếu có cache, cập nhật lại CORS cho đúng origin
            response = new Response(response.body, response);
            response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
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
