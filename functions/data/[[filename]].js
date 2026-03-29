export async function onRequest(context) {
  const { request, env, params } = context;

  // 1. CHỈ CHO PHÉP DOMAIN CỦA BẠN TRUY CẬP
  const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788']; 
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }
    });
  }

  // 2. KHÔNG CẦN CHECK MẬT KHẨU NỮA (Vì là Public Data)

  // 3. MAP FILE
  const requestFile = params.filename ? params.filename[0] : ''; 
  let r2Key = null;
  if (requestFile === 'market-data.json') r2Key = 'market-data.json';
  else if (requestFile === 'competition-history.json') r2Key = 'competition-history.json';

  if (!r2Key) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 }); 

  try {
      // 4. KÍCH HOẠT CLOUDFLARE EDGE CACHE (Bảo vệ R2)
      const cache = caches.default;
      let response = await cache.match(request);

      if (!response) {
          // Lên R2 lấy data (chỉ xảy ra khi chưa có cache hoặc cache hết hạn)
          const object = await env.R2_BUCKET.get(r2Key);
          if (object === null) {
              return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("Access-Control-Allow-Origin", allowedOrigin); 
          headers.set("Vary", "Origin");
          
          // CACHE 60 GIÂY TRÊN CDN. Trong 60s này, 1 triệu người gọi cũng không tốn R2 read.
          headers.set('Cache-Control', 'public, s-maxage=60, max-age=60'); 

          response = new Response(object.body, { headers });
          
          // Lưu vào bộ đệm
          context.waitUntil(cache.put(request, response.clone()));
      }

      return response;

  } catch (e) {
      console.error('[R2 Error]', e); 
      return new Response(JSON.stringify({ error: "Server Error" }), { 
          status: 500,
          headers: { "Access-Control-Allow-Origin": allowedOrigin }
      });
  }
}
