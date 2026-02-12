export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Chỉ xử lý các yêu cầu lấy dữ liệu trong thư mục /data/
  if (url.pathname.startsWith('/data/')) {

    // [QUAN TRỌNG] Cho phép trình duyệt hỏi đường (Preflight OPTIONS)
    // Giúp sửa lỗi "TypeError: Failed to fetch" và lỗi CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "X-Wave-Source, Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    // --- LỚP BẢO MẬT DUY NHẤT: KIỂM TRA HEADER BÍ MẬT ---
    // Chúng ta bỏ qua bước check Referer vì nó hay gây lỗi cho người dùng thật.
    const customAuth = request.headers.get('X-Wave-Source');
    
    // Nếu không có header 'web-client' -> CHẶN NGAY
    if (customAuth !== 'web-client') {
         return new Response(JSON.stringify({ error: "Access Denied: Missing Secret Signature" }), { 
            status: 403,
            headers: { 
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*" 
            }
        });
    }

    // --- LẤY FILE TỪ R2 ---
    let r2Key = null;
    if (url.pathname.includes('market-data.json')) r2Key = 'market-data.json';
    else if (url.pathname.includes('competition-history.json')) r2Key = 'competition-history.json';

    if (!r2Key) return new Response('File not mapped', { status: 404 });

    try {
        const object = await env.R2_BUCKET.get(r2Key);
        if (object === null) return new Response('File not found in R2', { status: 404 });

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set("Access-Control-Allow-Origin", "*"); // Cho phép JS đọc được
        headers.set('Cache-Control', 'private, max-age=30'); 

        return new Response(object.body, { headers });

    } catch (e) {
        return new Response(`Middleware Error: ${e.message}`, { status: 500 });
    }
  }

  return context.next();
}
