export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // Chỉ xử lý bảo vệ file JSON
  if (url.pathname.includes('market-data.json')) {
    
    // 1. CHÌA KHÓA VẠN NĂNG (Gắn trực tiếp vào link JSON)
    if (url.searchParams.get('secret') === 'admin123') {
        return context.next();
    }

    // 2. LẤY REFERER
    const referer = request.headers.get('Referer') || "";
    
    // 3. DANH SÁCH DOMAIN HỢP LỆ
    const allowedDomains = ["wave-alpha.pages.dev", ".pages.dev", "localhost", "127.0.0.1"];
    const isAllowed = allowedDomains.some(domain => referer.includes(domain));

    // --- CẢI TIẾN: CƠ CHẾ CỨU TRỢ KHI THIẾU REFERER ---
    // Nếu Referer trống NHƯNG nguồn truy cập (URL hiện tại của trình duyệt) có mode=admin
    // Chúng ta sẽ kiểm tra xem client có đang gửi yêu cầu từ một trang có mode=admin không
    // Lưu ý: Middleware không biết URL của tab hiện tại, nó chỉ biết URL của request JSON.
    // Vì vậy ta kiểm tra Referer chứa 'mode=admin' hoặc 'secret'
    
    const isAdminReferer = referer.includes('mode=admin');

    if (isAllowed || isAdminReferer) {
      return context.next();
    }

    // Nếu vẫn không lọt qua các điều kiện trên -> CHẶN
    return new Response(JSON.stringify({
      error: "403 Forbidden",
      message: "Access Denied. Referer missing or invalid.",
      debug_referer: referer || "No Referer detected"
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return context.next();
}
