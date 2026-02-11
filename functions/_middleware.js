export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);


  if (url.pathname.startsWith('/data/')) {
    
 
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

        headers.set('Cache-Control', 'public, max-age=60'); 

        return new Response(object.body, { headers });

    } catch (e) {
        return new Response(`Middleware Error: ${e.message}`, { status: 500 });
    }
  }


  return context.next();
}
