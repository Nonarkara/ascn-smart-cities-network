import { NEWS_SOURCES } from "../../lib/news-sources.mjs";
import { fetchFeed, feedFailure, mergeArticles } from "../../lib/news-feed.mjs";

// The regional list, and what happens when the publishers do not answer.
//
// A publisher's feed is outside this site's control: it is refused, it
// times out, it changes its markup, it goes down for a week. When that
// happens the old answer was a 503 with an empty body — a status code that
// says "nothing here" to anything that is not reading carefully, and a
// regional news view that renders nothing at all.
//
// The site's own published snapshot is the list of record. So the endpoint
// now behaves like the discovery endpoint: it checks the feeds live, and
// when they do not answer it answers with the snapshot and SAYS SO —
// `mode: "saved"`, `live: false`, and the reason each feed gave. A reader
// and a machine both get the list, and both are told whether it was
// checked live. Only when there is no snapshot either does the endpoint
// report that it cannot serve the list — and then it says that in a body,
// because a status code with no body is not an answer.
const SNAPSHOT_PATH = "/data/news-snapshot.json";

async function readSnapshot(context) {
  const assets = context.env?.ASSETS;
  if (!assets?.fetch) return null;
  try {
    const response = await assets.fetch(new URL(SNAPSHOT_PATH, context.request.url), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json();
    const articles = Array.isArray(payload?.articles) ? payload.articles : [];
    return articles.length ? { checkedAt: payload.checkedAt || null, articles, sources: Array.isArray(payload?.sources) ? payload.sources : [] } : null;
  } catch { return null; }
}

export async function onRequest(context) {
  const { request } = context;
  if (!["GET", "HEAD"].includes(request.method)) return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  if (new URL(request.url).search) return Response.json({ error: "This endpoint accepts no parameters" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const cache = globalThis.caches?.default;
  const key = new Request(request.url, { method: "GET" });
  const cached = await cache?.match(key);
  if (cached) return request.method === "HEAD" ? new Response(null, cached) : cached;

  const [results, snapshot] = await Promise.all([
    Promise.allSettled(NEWS_SOURCES.map((source) => fetchFeed(source))),
    readSnapshot(context),
  ]);
  results.forEach((result, index) => {
    if (result.status === "rejected") console.warn(`News feed ${NEWS_SOURCES[index].id} unavailable: ${result.reason?.message || "fetch failed"}`);
  });
  const attemptedAt = new Date().toISOString();
  const articles = mergeArticles(results.filter((result) => result.status === "fulfilled").map((result) => result.value));
  // The reason each feed gave, so a reader is told which publisher is quiet
  // and why — not just that something is.
  const sources = NEWS_SOURCES.map((source, index) => {
    const result = results[index];
    const base = { id: source.id, name: source.name, section: source.section, site: source.site };
    if (result.status === "fulfilled") {
      return result.value.length
        ? { ...base, status: "ok", articles: result.value.length }
        : { ...base, status: "unavailable", articles: 0, reason: { code: "empty", status: null } };
    }
    return { ...base, status: "unavailable", articles: 0, reason: feedFailure(result.reason) };
  });

  const headers = {
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Frame-Options": "DENY",
  };

  let payload;
  let status = 200;
  let cacheControl = "public, max-age=300, s-maxage=900";
  if (articles.length) {
    payload = { mode: "live", live: true, checkedAt: attemptedAt, attemptedAt, articles, sources };
  } else if (snapshot) {
    // The publishers did not answer; the published list of record does.
    payload = { mode: "saved", live: false, checkedAt: snapshot.checkedAt, attemptedAt, snapshotAt: snapshot.checkedAt, articles: snapshot.articles, sources };
  } else {
    payload = { mode: "unavailable", live: false, checkedAt: null, attemptedAt, articles: [], sources, error: "Publisher feeds unavailable and no snapshot is published" };
    status = 503;
    cacheControl = "no-store";
  }

  const response = Response.json(payload, { status, headers: { ...headers, "Cache-Control": cacheControl } });
  if (cache && articles.length) context.waitUntil(cache.put(key, response.clone()));
  return request.method === "HEAD" ? new Response(null, response) : response;
}
