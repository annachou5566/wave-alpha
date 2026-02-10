export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // LOGIC: Chỉ chặn các yêu cầu bắt đầu bằng "/data/"
  // Ví dụ: web gọi /data/market-data.json -> Middleware sẽ hiểu
  if (url.pathname.startsWith('/data/')) {
    
    // 1. Xác định tên file cần lấy trên R2
    let r2Key = null;

    if (url.pathname.includes('market-data.json')) {
        r2Key = 'market-data.json'; // Tên file gốc trên R2 do python upload
    } else if (url.pathname.includes('competition-history.json')) {
        r2Key = 'competition-history.json'; // Tên file gốc trên R2 do python upload
    }

    // Nếu không khớp file nào -> Trả về lỗi 404
    if (!r2Key) {
        return new Response('File not mapped in Middleware', { status: 404 });
    }

    // 2. Gọi R2 để lấy dữ liệu
    try {
        // env.R2_BUCKET là biến bạn đã bind trong Dashboard
        const object = await env.R2_BUCKET.get(r2Key);

        if (object === null) {
            return new Response('File not found in R2 Bucket', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        // Quan trọng: Cache-Control để trình duyệt không lưu cache quá lâu
        headers.set('Cache-Control', 'public, max-age=60'); 

        return new Response(object.body, { headers });

    } catch (e) {
        return new Response(`Middleware Error: ${e.message}`, { status: 500 });
    }
  }

  // Các yêu cầu khác (html, css, js...) cho đi qua bình thường
  return context.next();
}