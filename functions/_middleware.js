export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // Chỉ kích hoạt bảo vệ nếu đường dẫn bắt đầu bằng /data/
  if (url.pathname.startsWith('/data/')) {
    
    // Lấy Referer (Nguồn truy cập)
    const referer = request.headers.get('Referer') || "";
    
    // Danh sách được phép (Domain chính + Localhost để dev)
    const allowedDomains = ["wave-alpha.pages.dev", "localhost", "127.0.0.1"];
    
    // Kiểm tra: Nếu Referer chứa một trong các domain cho phép thì OK
    const isAllowed = allowedDomains.some(domain => referer.includes(domain));

    // Nếu không hợp lệ -> Chặn 403
    if (!isAllowed) {
      return new Response(JSON.stringify({
        error: "403 Forbidden",
        message: "Access Denied. Please visit https://wave-alpha.pages.dev to view data."
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  // Cho phép đi tiếp nếu hợp lệ
  return context.next();
}
