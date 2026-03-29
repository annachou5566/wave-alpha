export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // 1. CẤU HÌNH CORS AN TOÀN
  // Thay url preview của máy ảo GitHub vào đây nếu bạn cần test trực tiếp
  const ALLOWED_ORIGINS = [
      'https://wave-alpha.pages.dev', 
      'http://localhost:8788' 
  ]; 
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // Xử lý OPTIONS (Preflight request)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "X-Wave-Token, Content-Type", // Đổi tên header
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin" // Báo cho trình duyệt biết response phụ thuộc vào Origin
      }
    });
  }

  // 2. KIỂM TRA AUTH THỰC SỰ BẰNG SECRET KEY
  const clientToken = request.headers.get('X-Wave-Token');
  const expectedToken = env.WAVE_API_SECRET; // Lấy từ biến môi trường bảo mật

  if (!clientToken || clientToken !== expectedToken) {
       return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401,
          headers: { 
              'Content-Type': 'application/json',
              "Access-Control-Allow-Origin": allowedOrigin,
              "Vary": "Origin"
          }
      });
  }

  // 3. MAP FILE AN TOÀN (Ngăn chặn Path Traversal)
  const requestFile = params.filename ? params.filename[0] : ''; 
  
  let r2Key = null;
  if (requestFile === 'market-data.json') r2Key = 'market-data.json';
  else if (requestFile === 'competition-history.json') r2Key = 'competition-history.json';

  if (!r2Key) {
      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 }); 
  }

  try {
      const object = await env.R2_BUCKET.get(r2Key);
      if (object === null) {
          return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set("Access-Control-Allow-Origin", allowedOrigin); 
      headers.set("Vary", "Origin");
      
      // Chuyển sang private cache để tránh rò rỉ chéo dữ liệu trên CDN
      headers.set('Cache-Control', 'private, max-age=60'); 

      return new Response(object.body, { headers });

  } catch (e) {
      // 4. GIẤU LỖI HỆ THỐNG TRƯỚC NGƯỜI DÙNG
      console.error('[R2 Bucket Error]', e); // Vẫn log để bạn debug trên dashboard
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
          status: 500,
          headers: { 
              'Content-Type': 'application/json',
              "Access-Control-Allow-Origin": allowedOrigin 
          }
      });
  }
}
