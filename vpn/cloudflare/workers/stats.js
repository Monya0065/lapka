addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/stats/connections") {
    const stats = await getConnectionStats();
    
    return new Response(JSON.stringify(stats), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (path === "/api/stats/nodes") {
    const nodeStats = await getNodeStats();
    
    return new Response(JSON.stringify(nodeStats), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(request);
  
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

async function getConnectionStats() {
  const connections = await KV.get("connections");
  const data = JSON.parse(connections || '{"active": 0, "total": 0}');
  
  return {
    active: data.active,
    total: data.total,
    timestamp: Date.now(),
  };
}

async function getNodeStats() {
  const nodes = await KV.get("node_stats");
  const data = JSON.parse(nodes || "[]");
  
  return {
    nodes: data,
    timestamp: Date.now(),
  };
}