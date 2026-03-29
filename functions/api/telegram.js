export async function onRequestPost(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin') || '';

    // 1. Mở khóa CORS
    let allowedOrigin = 'https://wave-alpha.pages.dev';
    if (origin.endsWith('.github.dev') || origin.endsWith('idx.google.com') || origin.startsWith('http://localhost')) {
        allowedOrigin = origin;
    }

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": allowedOrigin,
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400"
            }
        });
    }

    // 2. Lấy Token Telegram từ biến môi trường bảo mật
    const TELE_TOKEN = env.TELEGRAM_BOT_TOKEN;
    if (!TELE_TOKEN) {
        return new Response(JSON.stringify({ error: "Server missing Telegram Token" }), { 
            status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin } 
        });
    }

    try {
        // Phân loại xem client muốn gửi ảnh (sendPhoto) hay tin nhắn (sendMessage)
        const url = new URL(request.url);
        const method = url.searchParams.get('method') || 'sendMessage';

        // 3. Chuyển tiếp toàn bộ nội dung (ảnh/chữ) sang Telegram
        const tgResponse = await fetch(`https://api.telegram.org/bot${TELE_TOKEN}/${method}`, {
            method: 'POST',
            // Truyền nguyên dạng Content-Type (FormData hoặc JSON) từ Client
            headers: request.headers.has('Content-Type') ? { 'Content-Type': request.headers.get('Content-Type') } : {},
            body: request.body 
        });

        const data = await tgResponse.json();
        
        return new Response(JSON.stringify(data), {
            status: tgResponse.status,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": allowedOrigin }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
            status: 500, headers: { "Access-Control-Allow-Origin": allowedOrigin } 
        });
    }
}
