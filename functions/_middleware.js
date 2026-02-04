export async function onRequest(context) {
  const { request, env } = context; // Lấy biến môi trường (env) để gọi R2
  const url = new URL(request.url);

  // Chỉ xử lý file market-data.json (File chính)
  if (url.pathname.includes('market-data.json')) {
    
    // --- 1. LỚP BẢO MẬT (GIỮ NGUYÊN) ---
    // Cho phép truy cập bằng khóa bí mật (Backdoor cho Admin)
    if (url.searchParams.get('secret') === 'admin123') {
        return serveFromR2(env, 'market-data.json');
    }

    // Kiểm tra Referer (Nguồn truy cập)
    const referer = request.headers.get('Referer') || "";
    const allowedDomains = ["wave-alpha.pages.dev", ".pages.dev", "localhost", "127.0.0.1"];
    const isAllowed = allowedDomains.some(domain => referer.includes(domain));
    
    // Logic cho Admin Mode (nếu thiếu Referer)
    const isAdminReferer = referer.includes('mode=admin');

    if (!isAllowed && !isAdminReferer) {
      return new Response(JSON.stringify({
        error: "403 Forbidden",
        message: "Access Denied via R2 Middleware.",
        debug_referer: referer || "No Referer detected"
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- 2. LẤY DỮ LIỆU TỪ R2 ---
    // Nếu vượt qua bảo mật -> Gọi hàm lấy dữ liệu từ R2
    return serveFromR2(env, 'market-data.json');
  }

  // Nếu là các file khác (HTML, JS, CSS...) -> Cứ tải bình thường
  return context.next();
}

// Hàm phụ trợ: Lấy file từ R2 và trả về cho Web
async function serveFromR2(env, filename) {
  try {
    // Gọi vào xô R2 đã Binding (tên biến là R2_BUCKET)
    const object = await env.R2_BUCKET.get(filename);

    if (object === null) {
      return new Response('File not found in R2', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'no-store'); // Không lưu cache để luôn có giá mới nhất

    return new Response(object.body, { headers });
  } catch (e) {
    return new Response(`R2 Error: ${e.message}`, { status: 500 });
  }
}
