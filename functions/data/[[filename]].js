export async function onRequest(context) {
  const { request, env, params } = context; // Thêm params để lấy tên file
  const url = new URL(request.url);

  // 1. Xử lý CORS (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "X-Wave-Source, Content-Type",
        "Access-Control-Max-Age": "86400" // Browser sẽ nhớ cái này 1 ngày, đỡ tốn request OPTIONS
      }
    });
  }

  // 2. Kiểm tra Auth
  const customAuth = request.headers.get('X-Wave-Source');
  if (customAuth !== 'web-client') {
       return new Response(JSON.stringify({ error: "Access Denied" }), { 
          status: 403,
          headers: { 
              'Content-Type': 'application/json',
              "Access-Control-Allow-Origin": "*" 
          }
      });
  }

  // 3. Map file từ params (thay vì check url.includes)
  // params.filename là mảng vì dùng [[filename]]
  const requestFile = params.filename[0]; 
  
  let r2Key = null;
  if (requestFile === 'market-data.json') r2Key = 'market-data.json';
  else if (requestFile === 'competition-history.json') r2Key = 'competition-history.json';

  if (!r2Key) return new Response('File not mapped', { status: 404 });

  try {
      const object = await env.R2_BUCKET.get(r2Key);
      if (object === null) return new Response('File not found in R2', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set("Access-Control-Allow-Origin", "*"); 
      
      // TĂNG CACHE LÊN NẾU CÓ THỂ
      // Nếu dữ liệu không cần realtime từng giây, hãy tăng max-age lên
      headers.set('Cache-Control', 'public, max-age=60'); 

      return new Response(object.body, { headers });

  } catch (e) {
      return new Response(`Error: ${e.message}`, { status: 500 });
  }
}
