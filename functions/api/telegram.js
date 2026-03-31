export async function onRequestPost(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin') || '';

    // 1. Mở khóa CORS an toàn (Chỉ định rõ domain)
    const ALLOWED_ORIGINS = ['https://wave-alpha.pages.dev', 'http://localhost:8788', 'http://localhost:3000'];
    
    // Chỉ cho phép Github Codespace nếu domain chứa username của bạn để tránh bypass
    const isSafeDev = origin.endsWith('.github.dev') && origin.includes('annachou5566'); 
    let allowedOrigin = (ALLOWED_ORIGINS.includes(origin) || isSafeDev) ? origin : ALLOWED_ORIGINS[0];

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
        const url = new URL(request.url);
        const method = url.searchParams.get('method') || 'sendMessage';

        // 3. Khóa Method (Chống Method Injection)
        // Kẻ gian không thể truyền ?method=deleteWebhook hoặc các method phá hoại khác
        const ALLOWED_METHODS = ['sendMessage', 'sendPhoto'];
        if (!ALLOWED_METHODS.includes(method)) {
            return new Response(JSON.stringify({ error: "Method not allowed" }), { 
                status: 403, headers: { "Access-Control-Allow-Origin": allowedOrigin } 
            });
        }

        // 4. Phân tích & Làm sạch Dữ Liệu (Chống Bot Abuse / Open Relay)
        let safeBody;
        let fetchHeaders = {};
        const contentType = request.headers.get('Content-Type') || '';

        // XỬ LÝ DỮ LIỆU DẠNG JSON
        if (contentType.includes('application/json')) {
            const bodyJson = await request.json();
            
            if (!bodyJson.chat_id) {
                return new Response(JSON.stringify({ error: "Missing chat_id" }), { status: 400, headers: { "Access-Control-Allow-Origin": allowedOrigin } });
            }

            if (method === 'sendMessage') {
                safeBody = JSON.stringify({
                    chat_id: bodyJson.chat_id,
                    text: String(bodyJson.text || '').substring(0, 4000), // Cắt ngắn chống Spam bomb
                    parse_mode: bodyJson.parse_mode || 'HTML',
                    disable_web_page_preview: bodyJson.disable_web_page_preview || false
                });
            } else if (method === 'sendPhoto') {
                safeBody = JSON.stringify({
                    chat_id: bodyJson.chat_id,
                    photo: bodyJson.photo,
                    caption: String(bodyJson.caption || '').substring(0, 1000),
                    parse_mode: bodyJson.parse_mode || 'HTML'
                });
            }
            fetchHeaders['Content-Type'] = 'application/json';
        } 
        
        // XỬ LÝ DỮ LIỆU DẠNG FORM-DATA (Dùng để upload ảnh file binary)
        else if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            
            if (!formData.has('chat_id')) {
                return new Response(JSON.stringify({ error: "Missing chat_id" }), { status: 400, headers: { "Access-Control-Allow-Origin": allowedOrigin } });
            }

            // Tạo một FormData mới chỉ cho phép copy các trường an toàn
            safeBody = new FormData();
            safeBody.append('chat_id', formData.get('chat_id'));
            
            if (method === 'sendPhoto' && formData.has('photo')) {
                safeBody.append('photo', formData.get('photo'));
            }
            if (formData.has('caption')) {
                safeBody.append('caption', String(formData.get('caption')).substring(0, 1000));
            }
            if (formData.has('parse_mode')) {
                safeBody.append('parse_mode', formData.get('parse_mode'));
            }
            
            // Lưu ý: Không set Content-Type header bằng tay ở đây, 
            // hàm fetch sẽ tự động set thành 'multipart/form-data; boundary=...' khi truyền FormData
        } 
        else {
            return new Response(JSON.stringify({ error: "Unsupported Content-Type" }), { 
                status: 415, headers: { "Access-Control-Allow-Origin": allowedOrigin } 
            });
        }

        // 5. Chuyển tiếp payload ĐÃ ĐƯỢC LÀM SẠCH sang Telegram
        const tgResponse = await fetch(`https://api.telegram.org/bot${TELE_TOKEN}/${method}`, {
            method: 'POST',
            headers: fetchHeaders,
            body: safeBody 
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
