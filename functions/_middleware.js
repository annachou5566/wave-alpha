export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Chỉ xử lý các link bắt đầu bằng /data/
  if (url.pathname.startsWith('/data/')) {

    // [FIX QUAN TRỌNG] Cho phép lệnh OPTIONS (Preflight) đi qua
    // Nếu không có đoạn này, trình duyệt sẽ báo lỗi CORS hoặc 403
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "X-Wave-Source"
        }
      });
    }
    
    // --- BẢO MẬT 1: REFERER ---
    const referer = request.headers.get('Referer') || '';
    const origin = request.headers.get('Origin') || '';
    const allowedDomain = 'wave-alpha.pages.dev';
    
    // Check linh hoạt hơn: Chỉ cần CHỨA domain là được (tránh lỗi www hoặc subdomain)
    const isAllowed = referer.includes(allowedDomain) || origin.includes(allowedDomain);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    if (!isAllowed && !isLocalhost) {
        return new Response(JSON.stringify({ 
            error: "Access Denied: Invalid Source",
            debug_referer: referer // [Debug] Để bạn biết tại sao bị chặn
        }), { 
            status: 403, headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- BẢO MẬT 2: HEADER BÍ MẬT ---
    const customAuth = request.headers.get('X-Wave-Source');
    if (customAuth !== 'web-client') {
         return new Response(JSON.stringify({ 
             error: "Access Denied: Missing Signature",
             debug_auth: customAuth // [Debug] Xem header gửi lên là gì
         }), { 
            status: 403, headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- LẤY DATA TỪ R2 ---
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
        headers.set('Cache-Control', 'private, max-age=30'); 
        
        // Thêm CORS header để trình duyệt không chặn
        headers.set("Access-Control-Allow-Origin", "*");

        return new Response(object.body, { headers });

    } catch (e) {
        return new Response(`Middleware Error: ${e.message}`, { status: 500 });
    }
  }

  return context.next();
}
