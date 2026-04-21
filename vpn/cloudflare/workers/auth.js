addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/auth/login") {
    const body = await request.json();
    
    const cfData = await KV.get(body.email);
    if (cfData) {
      const data = JSON.parse(cfData);
      
      if (data.rateLimit && data.rateLimit.count > 5) {
        return new Response(JSON.stringify({ error: "Too many attempts" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      await KV.put(body.email, JSON.stringify({
        ...data,
        rateLimit: {
          count: (data.rateLimit?.count || 0) + 1,
          reset: Date.now() + 60000,
        },
      }), { expirationTtl: 60 });
    }
  }

  const response = await fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    headers: headers,
  });
}