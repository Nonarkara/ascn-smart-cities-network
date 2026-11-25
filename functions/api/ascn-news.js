import { ASCN_DISCOVERY_SOURCES, mergeDiscovery, validateDiscovery } from "../../lib/ascn-discovery.mjs";
import { feedFailure, fetchFeed } from "../../lib/news-feed.mjs";

// The discovery list is a list of leads that no one has reviewed yet, so it
// is never evidence. It is drawn from a search index that this site's edge
// may not be allowed to read: measured on 2026-11-22, news.google.com
// refuses Cloudflare's address with its "unusual traffic" page, while the
// same feed answers normally from a workstation. That is the publisher's
// policy toward the edge, and it will not change because the request is
// better formed.
//
// So the list of record is the PUBLISHED SNAPSHOT — refreshed by
// scripts/refresh-ascn-news.mjs from a place where the index answers, and
// carried in the build. This endpoint checks the index live when it can,
// and when it cannot it answers with the snapshot and says so: the reader
// sees the current list and is told whether it was checked live. A bare 503
// with no body told the reader nothing and lost the list.
const LIVE_CHECK_TIMEOUT_MS = 2500;
const SNAPSHOT_PATH = "/data/ascn-news-discovery.json";

async function readSnapshot(context) {
  const assets = context.env?.ASSETS;
  if (!assets?.fetch) return null;
  try {
    const response = await assets.fetch(new URL(SNAPSHOT_PATH, context.request.url), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = validateDiscovery(await response.json());
    return payload.articles.length ? payload : null;
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

  const [snapshot, results] = await Promise.all([
    readSnapshot(context),
    Promise.allSettled(ASCN_DISCOVERY_SOURCES.map((source) => fetchFeed(source, fetch, { timeoutMs: LIVE_CHECK_TIMEOUT_MS }))),
  ]);
  const attemptedAt = new Date().toISOString();
  const sources = ASCN_DISCOVERY_SOURCES.map((source, index) => {
    const result = results[index];
    if (result.status === "fulfilled") {
      return result.value.length ? { id: source.id, status: "ok" } :
        { id: source.id, status: "unavailable", reason: { code: "empty", status: null } };
    }
    return { id: source.id, status: "unavailable", reason: feedFailure(result.reason) };
  });
  const live = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const articles = mergeDiscovery(live);

  let payload;
  if (articles.length) {
    payload = { checkedAt: attemptedAt, attemptedAt, snapshotAt: snapshot?.checkedAt ?? null, mode: "live", live: true, articles, sources };
  } else {
    // The index did not answer. The snapshot does, and it is this site's
    // published list of record — so the answer is that list, marked as not
    // checked live, with the reason each feed gave.
    if (!snapshot) {
      const body = { error: "Discovery index unavailable", checkedAt: attemptedAt, attemptedAt, mode: "unavailable", articles: [], sources };
      const response = Response.json(body, { status: 503, headers: { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" } });
      return request.method === "HEAD" ? new Response(null, response) : response;
    }
    payload = { checkedAt: snapshot.checkedAt, attemptedAt, snapshotAt: snapshot.checkedAt, mode: "saved", live: false, articles: snapshot.articles, sources };
  }

  const response = Response.json(payload, { status: 200, headers: {
    "Cache-Control": "public, max-age=300, s-maxage=900",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff",
  } });
  if (cache) context.waitUntil(cache.put(key, response.clone()));
  return request.method === "HEAD" ? new Response(null, response) : response;
}
