export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/data/')) {
    const referer = request.headers.get('Referer') || '';
    const origin = request.headers.get('Origin') || '';
    const allowedDomain = 'wave-alpha.pages.dev';
    
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const isAllowedOrigin = referer.includes(allowedDomain) || origin.includes(allowedDomain);

    if (!isAllowedOrigin && !isLocalhost) {
        return new Response(JSON.stringify({ error: "Access Denied: Invalid Source" }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const customAuth = request.headers.get('X-Wave-Source');
    if (customAuth !== 'web-client') {
         return new Response(JSON.stringify({ error: "Access Denied: Missing Signature" }), { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let r2Key = null;

    if (url.pathname.includes('market-data.json')) {
        r2Key = 'market-data.json';
    } else if (url.pathname.includes('competition-history.json')) {
        r2Key = 'competition-history.json';
    }

    if (!r2Key) {
        return new Response('File not mapped in Middleware', { status: 404 });
    }

    try {
        const object = await env.R2_BUCKET.get(r2Key);

        if (object === null) {
            return new Response('File not found in R2 Bucket', { status: 404 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Cache-Control', 'private, max-age=30'); 

        return new Response(object.body, { headers });

    } catch (e) {
        return new Response(`Middleware Error: ${e.message}`, { status: 500 });
    }
  }

  return context.next();
}
