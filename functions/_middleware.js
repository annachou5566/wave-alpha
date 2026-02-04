export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // --- SỬA LỖI: Bắt dính tên file thay vì thư mục ---
  // Bất kể nó nằm ở /data/ hay /public/data/, miễn là file market-data.json
  if (url.pathname.includes('market-data.json')) {
    
    // Lấy Referer (Nguồn bấm link)
    const referer = request.headers.get('Referer') || "";
    
    // Domain được phép truy cập (Thêm cả wave-alpha.pages.dev và các biến thể)
    // Lưu ý: Cloudflare Pages có thể có nhiều domain preview
    const allowedDomains = [
      "wave-alpha.pages.dev", 
      "localhost", 
      "127.0.0.1"
    ];
    
    // Kiểm tra: Referer có chứa domain của mình không?
    const isAllowed = allowedDomains.some(domain => referer.includes(domain));

    // Nếu KHÔNG PHẢI từ web mình bấm vào -> CHẶN
    if (!isAllowed) {
      return new Response(JSON.stringify({
        error: "403 Forbidden",
        message: "Direct access prohibited. Data is only available via https://wave-alpha.pages.dev",
        your_referer: referer || "Empty (Direct Access)"
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store' // Cấm trình duyệt lưu cache file này
        }
      });
    }
  }

  // Nếu hợp lệ hoặc file khác -> Cho qua
  return context.next();
}
