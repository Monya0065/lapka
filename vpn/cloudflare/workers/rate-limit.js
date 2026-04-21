addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

const RATE_LIMITS = {
  "/api/auth/login": { requests: 5, period: 60 },
  "/api/auth/register": { requests: 3, period: 300 },
  "/api/billing/payment": { requests: 10, period: 300 },
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const limit = RATE_LIMITS[path];
  if (limit) {
    const clientIP = request.headers.get("CF-Connecting-IP");
    const key = `${clientIP}:${path}`;
    
    const count = await KV.get(key);
    const current = parseInt(count || "0");

    if (current >= limit.requests) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": limit.period.toString(),
          },
        }
      );
    }

    await KV.put(key, (current + 1).toString(), {
      expirationTtl: limit.period,
    });
  }

  const response = await fetch(request);
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Remaining", "100");

  return new Response(response.body, {
    status: response.status,
    headers: headers,
  });
}