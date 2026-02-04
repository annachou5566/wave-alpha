export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // Chỉ chặn file market-data.json
  if (url.pathname.includes('market-data.json')) {
    
    // --- 1. CƠ CHẾ CHÌA KHÓA VẠN NĂNG (BACKDOOR) ---
    // Nếu trên link có ?secret=admin123 -> CHO QUA LUÔN (Không cần check Referer)
    const secretKey = url.searchParams.get('secret');
    if (secretKey === 'admin123') { // Bạn có thể đổi 'admin123' thành mật khẩu khác
        return context.next();
    }

    // --- 2. CƠ CHẾ BẢO VỆ CHO NGƯỜI DÙNG THƯỜNG ---
    const referer = request.headers.get('Referer') || "";
    
    // Mở rộng cho phép tất cả các domain con của pages.dev (để support bản preview/admin)
    const allowedDomains = [
      "wave-alpha.pages.dev", 
      ".pages.dev", // Cho phép mọi sub-domain của Cloudflare Pages
      "localhost", 
      "127.0.0.1"
    ];
    
    const isAllowed = allowedDomains.some(domain => referer.includes(domain));

    if (!isAllowed) {
      return new Response(JSON.stringify({
        error: "403 Forbidden",
        message: "Access Denied.",
        debug_referer: referer || "No Referer detected" // Hiện ra để bạn biết tại sao bị chặn
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }
  }

  return context.next();
}
