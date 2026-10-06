import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, mergeArticles, fetchFeed } from "../lib/news-feed.mjs";
import { filterArticles, validateNewsPayload } from "../lib/news-sources.mjs";
import { onRequest } from "../functions/api/news.js";

const source = { id: "test", name: "Publisher", site: "https://example.com/", url: "https://example.com/feed" };
const now = Date.parse("2026-10-07T00:00:00Z");
const rss = `<rss version="2.0"><channel><item><title>Singapore builds smarter transport infrastructure</title><link>https://example.com/story?utm_source=feed</link><pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Thailand flood resilience</title><link>https://example.com/flood</link></item><item><title>Political election in Europe</title><link>https://example.com/europe</link></item></channel></rss>`;

test("RSS selects regional city-development headlines and retains unknown dates", () => {
  const articles = parseFeed(rss, source, now);
  assert.equal(articles.length, 2);
  assert.deepEqual(articles[0].countries, ["Singapore"]);
  assert.ok(articles[0].topics.includes("Mobility"));
  assert.equal(articles[1].publishedAt, null);
  assert.equal(filterArticles(articles, { days: "7" }, now).length, 1);
  assert.equal(filterArticles(articles, { country: "Thailand", topic: "Climate & Resilience" }, now).length, 1);
});

test("Atom feeds parse namespaced titles and alternate links", () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Malaysia digital government innovation</title><link href="https://example.com/atom" rel="alternate"/><updated>2026-10-06T10:00:00Z</updated></entry></feed>`;
  assert.equal(parseFeed(atom, source, now)[0].url, "https://example.com/atom");
});

test("XML entities, oversized inputs, executable links, and cross-publisher URLs are rejected", () => {
  assert.throws(() => parseFeed('<!DOCTYPE x [<!ENTITY a "test">]><rss/>', source, now), /Unsafe/);
  assert.throws(() => parseFeed("x".repeat(524289), source, now), /oversized/);
  assert.throws(() => parseFeed("<html><body>Blocked</body></html>", source, now), /no items/);
  assert.equal(parseFeed(rss.replace(/https:\/\/example.com\/[^<]+/g, "javascript:alert(1)"), source, now).length, 0);
  assert.equal(parseFeed(rss.replaceAll("https://example.com/story", "https://evil.example/story"), source, now).length, 1);
});

test("deduplication removes tracking variants and dated stories sort ahead of undated ones", () => {
  const articles = parseFeed(rss, source, now);
  const merged = mergeArticles([articles, articles]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].url, "https://example.com/story");
});

test("feed response size limit is enforced while streaming", async () => {
  await assert.rejects(fetchFeed(source, async () => new Response("x".repeat(524289))), /Oversized/);
});

test("redirects are not followed, including redirects to private addresses", async () => {
  let requests = 0;
  await assert.rejects(fetchFeed(source, async (_, options) => {
    requests++;
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } });
  }), /unavailable/);
  assert.equal(requests, 1);
});

test("the public news endpoint rejects caller-supplied URLs and mutation methods", async () => {
  const context = (url, method = "GET") => ({ request: new Request(url, { method }), waitUntil() {} });
  assert.equal((await onRequest(context("https://example.com/api/news?url=http://127.0.0.1"))).status, 400);
  assert.equal((await onRequest(context("https://example.com/api/news", "POST"))).status, 405);
});

test("client payload validation rejects executable and credential-bearing links", () => {
  const article = parseFeed(rss, source, now)[0];
  const payload = { checkedAt: "2026-10-07", articles: [article, { ...article, url: "javascript:alert(1)" }, { ...article, url: "https://user:pass@example.com" }] };
  assert.equal(validateNewsPayload(payload).articles.length, 1);
});

test("upstream failures are not cached and successful collections are cached", async (t) => {
  const originalCaches = globalThis.caches;
  let writes = 0;
  globalThis.caches = { default: { match: async () => null, put: async () => { writes++; } } };
  t.after(() => { if (originalCaches) globalThis.caches = originalCaches; else delete globalThis.caches; mock.restoreAll(); });
  const pending = [];
  const context = { request: new Request("https://example.com/api/news"), waitUntil: (promise) => pending.push(promise) };
  mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  const failed = await onRequest(context);
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("cache-control"), "no-store");
  assert.equal(writes, 0);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async (url) => {
    const host = new URL(url).origin;
    return new Response(`<rss><channel><item><title>Singapore smart city transport infrastructure</title><link>${host}/verified-story</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
  });
  const successful = await onRequest(context);
  await Promise.all(pending);
  assert.equal(successful.status, 200);
  assert.equal(writes, 1);
  assert.ok((await successful.json()).articles.length > 0);
});
