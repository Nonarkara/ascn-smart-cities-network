import { NEWS_SOURCES } from "../../lib/news-sources.mjs";
import { fetchFeed, mergeArticles } from "../../lib/news-feed.mjs";

export async function onRequest(context) {
  const { request } = context;
  if (!["GET", "HEAD"].includes(request.method)) return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  if (new URL(request.url).search) return Response.json({ error: "This endpoint accepts no parameters" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const cache = globalThis.caches?.default;
  const key = new Request(request.url, { method: "GET" });
  const cached = await cache?.match(key);
  if (cached) return request.method === "HEAD" ? new Response(null, cached) : cached;

  const results = await Promise.allSettled(NEWS_SOURCES.map((source) => fetchFeed(source)));
  results.forEach((result, index) => {
    if (result.status === "rejected") console.warn(`News feed ${NEWS_SOURCES[index].id} unavailable: ${result.reason?.message || "fetch failed"}`);
  });
  const articles = mergeArticles(results.filter((result) => result.status === "fulfilled").map((result) => result.value));
  const payload = { mode: "live", checkedAt: new Date().toISOString(), articles,
    sources: NEWS_SOURCES.map((source, index) => ({ id: source.id, name: source.name, section: source.section, site: source.site,
      status: results[index].status === "fulfilled" ? "ok" : "unavailable", articles: results[index].status === "fulfilled" ? results[index].value.length : 0 })) };
  const response = Response.json(payload, { status: articles.length ? 200 : 503, headers: {
    "Cache-Control": articles.length ? "public, max-age=300, s-maxage=900" : "no-store",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Frame-Options": "DENY",
  } });
  if (cache && articles.length) context.waitUntil(cache.put(key, response.clone()));
  return request.method === "HEAD" ? new Response(null, response) : response;
}
