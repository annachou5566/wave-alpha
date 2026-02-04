export async function onRequest(context) {
  // --- CHẾ ĐỘ BẢO TRÌ: TẠM THỜI CHO QUA TẤT CẢ ---
  // Khi nào muốn bật lại bảo mật, hãy comment dòng dưới đây (thêm // vào đầu)
  return context.next(); 

  const request = context.request;
  const url = new URL(request.url);

  if (url.pathname.includes('market-data.json')) {
    if (url.searchParams.get('secret') === 'admin123') {
        return context.next();
    }

    const referer = request.headers.get('Referer') || "";
    const allowedDomains = ["wave-alpha.pages.dev", ".pages.dev", "localhost", "127.0.0.1"];
    const isAllowed = allowedDomains.some(domain => referer.includes(domain));

    if (!isAllowed) {
      return new Response(JSON.stringify({
        error: "403 Forbidden",
        message: "Security active. Referer missing.",
        debug_referer: referer || "No Referer detected"
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  return context.next();
}
