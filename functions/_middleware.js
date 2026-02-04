export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // --- LOGIC XỬ LÝ: CHỈ QUAN TÂM FILE JSON ---
  if (url.pathname.includes('market-data.json')) {
      
      // Ở chế độ bảo trì/sửa lỗi: 
      // Chúng ta KHÔNG kiểm tra Referer, KHÔNG kiểm tra Secret.
      // Cứ có ai hỏi là vào R2 lấy đưa cho họ luôn.
      
      return serveFromR2(env, 'market-data.json');
  }

  // Với các file khác (HTML, CSS, JS...) -> Tải bình thường từ GitHub Pages
  return context.next();
}

// --- HÀM LẤY DỮ LIỆU TỪ R2 (GIỮ NGUYÊN) ---
async function serveFromR2(env, filename) {
  try {
    // Gọi vào xô R2 đã Binding
    const object = await env.R2_BUCKET.get(filename);

    if (object === null) {
      return new Response('File not found in R2', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    // Quan trọng: Không lưu cache để bạn F5 là thấy dữ liệu mới ngay
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate'); 

    return new Response(object.body, { headers });
  } catch (e) {
    return new Response(`R2 Error: ${e.message}`, { status: 500 });
  }
}