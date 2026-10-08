import { ASCN_DISCOVERY_SOURCES, mergeDiscovery } from "../../lib/ascn-discovery.mjs";
import { fetchFeed } from "../../lib/news-feed.mjs";

export async function onRequest(context) {
  const { request } = context;
  if (!["GET", "HEAD"].includes(request.method)) return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  if (new URL(request.url).search) return Response.json({ error: "This endpoint accepts no parameters" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const cache = globalThis.caches?.default;
  const key = new Request(request.url, { method: "GET" });
  const cached = await cache?.match(key);
  if (cached) return request.method === "HEAD" ? new Response(null, cached) : cached;
  const results = await Promise.allSettled(ASCN_DISCOVERY_SOURCES.map((source) => fetchFeed(source)));
  const articles = mergeDiscovery(results.filter((result) => result.status === "fulfilled").map((result) => result.value));
  const payload = { checkedAt: new Date().toISOString(), articles,
    sources: ASCN_DISCOVERY_SOURCES.map((source, index) => ({ id: source.id, status: results[index].status === "fulfilled" ? "ok" : "unavailable" })) };
  const response = Response.json(payload, { status: articles.length ? 200 : 503, headers: {
    "Cache-Control": articles.length ? "public, max-age=300, s-maxage=900" : "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff",
  } });
  if (cache && articles.length) context.waitUntil(cache.put(key, response.clone()));
  return request.method === "HEAD" ? new Response(null, response) : response;
}
