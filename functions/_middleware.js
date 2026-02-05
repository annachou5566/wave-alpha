export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  
  if (url.pathname.includes('market-data.json')) {
      
      
      
      
      
      return serveFromR2(env, 'market-data.json');
  }

  
  return context.next();
}


async function serveFromR2(env, filename) {
  try {
    
    const object = await env.R2_BUCKET.get(filename);

    if (object === null) {
      return new Response('File not found in R2', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate'); 

    return new Response(object.body, { headers });
  } catch (e) {
    return new Response(`R2 Error: ${e.message}`, { status: 500 });
  }
}