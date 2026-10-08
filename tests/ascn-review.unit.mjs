import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateArchive, filterRecords, summarizeEvidence, cityEvidence, linkProjects, discoveryInbox } from "../lib/ascn-review.mjs";
import { ASCN_DISCOVERY_SOURCES, historicalDiscoverySources, validateDiscovery, mergeDiscovery } from "../lib/ascn-discovery.mjs";
import { parseFeed } from "../lib/news-feed.mjs";
import { onRequest } from "../functions/api/ascn-news.js";

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url)));
const archive = await read("ascn-news-archive");
const cities = (await read("ascn-cities")).cities;
const engine = await read("ascn-v2-data");
const source = ASCN_DISCOVERY_SOURCES[0];

test("archive validates provenance, known cities and exact project links", () => {
  assert.equal(validateArchive(archive, cities), archive);
  for (const record of archive.records) for (const link of linkProjects(record, engine.projects, 2025)) assert.ok(link.row, `${record.id}: ${link.project}`);
});

test("invalid links, fabricated cities, dates, metrics and outcome claims are rejected", () => {
  for (const patch of [{ id: undefined }, { year: 2027 }, { url: "javascript:alert(1)" }, { url: "https://user:pass@example.com" }, { cities: ["Surabaya"] }, { publishedAt: "2025-02-31" }, { publishedAt: "2026-12-31" }, { metrics: [{ label: "reach", value: "1000", unit: "people", asOf: "2025" }] }, { stage: "Outcome" }]) {
    const bad = structuredClone(archive); Object.assign(bad.records[0], patch);
    assert.throws(() => validateArchive(bad, cities));
  }
});

test("filters search claims and project names while keeping unrelated cities separate", () => {
  const rows = filterRecords(archive.records, { city: "Makassar", query: "health care", year: "2025" });
  assert.equal(rows.length, 1); assert.equal(rows[0].id, "makassar-service-2025");
  assert.equal(filterRecords(archive.records, { city: "Dili", stage: "Outcome" }).length, 0);
});

test("duplicate event reporting and service reach never become extra outcomes", () => {
  const rows = archive.records.filter((row) => row.eventId === "siem-reap-pilots");
  assert.equal(summarizeEvidence(rows).events, 1);
  assert.equal(summarizeEvidence(rows).records, 2);
  assert.equal(summarizeEvidence(archive.records).outcomeEvents, 0);
  assert.equal(summarizeEvidence([{ ...archive.records[0], year: 2027 }]).years.at(-1).year, 2027);
});

test("coverage gaps and missing project rows are distinct from zero performance", () => {
  const matrix = cityEvidence(archive.records, cities, engine.projects, 2025);
  assert.equal(matrix.length, 38);
  assert.equal(matrix.find((row) => row.name === "Dili").projects, 0);
  assert.equal(matrix.find((row) => row.name === "Dili").delivery, 0);
  assert.ok(matrix.find((row) => row.name === "Manila").projects > 0);
  assert.equal(cityEvidence([], cities)[0].projects, null);
  assert.equal(matrix.find((row) => row.name === "Luang Prabang").delivery, 0);
  assert.ok(matrix.find((row) => row.name === "Luang Prabang").evidence > 0);
  assert.ok(matrix.find((row) => row.name === "Vientiane").delivery > 0);
  assert.equal(matrix.find((row) => row.name === "Bandar Seri Begawan").delivery, 0);
  assert.ok(matrix.find((row) => row.name === "Bandar Seri Begawan").evidence > 0);
});

test("added donor and city sources keep announcement, delivery and outcome apart", () => {
  const byId = Object.fromEntries(archive.records.map((row) => [row.id, row]));
  for (const id of ["scap-2018", "aasctf-mtr-2022", "adb-luangprabang-2026", "adb-vientiane-vsutp-2025", "danang-wb-icr-2022", "hcmc-ioc-2026", "kk-basmy-2025"]) assert.ok(byId[id], id);
  assert.equal(byId["danang-wb-icr-2022"].stage, "Output");
  assert.equal(byId["hcmc-ioc-2026"].stage, "Output");
  assert.equal(byId["kk-basmy-2025"].stage, "Implementation");
  assert.equal(byId["aasctf-mtr-2022"].stage, "Scrutiny");
  assert.equal(byId["adb-luangprabang-2026"].projectLinks.length, 0);
  assert.equal(summarizeEvidence(archive.records).outcomeEvents, 0);
  for (const record of [byId["adb-vientiane-vsutp-2025"], byId["hcmc-ioc-2026"], byId["yangon-onemap-2022"], byId["phnompenh-hub-2025"]]) {
    for (const link of linkProjects(record, engine.projects, 2025)) assert.ok(link.row, `${record.id}: ${link.project}`);
  }
});

test("discovery retains old indexed matches and rejects XML and foreign-host links", () => {
  assert.equal(historicalDiscoverySources(2026).length, 9);
  assert.match(new URL(historicalDiscoverySources(2026)[0].url).searchParams.get("q"), /after:2018-01-01 before:2019-01-01/);
  assert.throws(() => historicalDiscoverySources("https://evil.example"));
  const xml = `<rss><channel><item><title>ASCN progress - ASEAN</title><link>https://news.google.com/rss/articles/abc</link><source url="https://asean.org">ASEAN</source><pubDate>Sun, 29 Apr 2018 00:00:00 GMT</pubDate></item><item><title>Bad</title><link>https://evil.example/article</link></item></channel></rss>`;
  const rows = parseFeed(xml, source);
  assert.equal(rows.length, 1); assert.equal(rows[0].title, "ASCN progress");
  assert.equal(rows[0].kind, "Unreviewed search match");
  assert.equal(rows[0].publishedAt, "2018-04-29T00:00:00.000Z");
  assert.throws(() => parseFeed('<!DOCTYPE rss [<!ENTITY secret SYSTEM "file:///etc/passwd">]><rss/>', source));
});

test("discovery is append-preserving, title-deduplicated and never auto-reviewed", () => {
  const rows = [{ title: "Old article", publishedAt: "2018-01-01", url: "https://news.google.com/a", publisher: "News", kind: "Unreviewed search match" }];
  const merged = mergeDiscovery([rows, rows, [{ ...rows[0], title: "New article", publishedAt: "2026-01-01" }]]);
  assert.equal(merged.length, 2);
  assert.equal(discoveryInbox(merged, [{ title: "Old article" }]).length, 1);
  assert.equal(validateDiscovery({ checkedAt: "2026-10-08", articles: [...merged, { ...rows[0], url: "javascript:alert(1)" }] }).articles.length, 2);
});

test("ASCN index endpoint rejects user-chosen sources and mutation requests", async () => {
  assert.equal((await onRequest({ request: new Request("https://ascn.example/api/ascn-news?url=http://127.0.0.1") })).status, 400);
  assert.equal((await onRequest({ request: new Request("https://ascn.example/api/ascn-news", { method: "POST" }) })).status, 405);
});

test("index failures are not cached; cached HEAD requests have no body", async (t) => {
  const originalCaches = globalThis.caches;
  let cached = null;
  globalThis.caches = { default: { match: async () => cached?.clone(), put: async (_key, response) => { cached = response; } } };
  t.after(() => { if (originalCaches) globalThis.caches = originalCaches; else delete globalThis.caches; mock.restoreAll(); });
  const pending = [];
  const context = (method = "GET") => ({ request: new Request("https://ascn.example/api/ascn-news", { method }), waitUntil: (promise) => pending.push(promise) });
  mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  const failed = await onRequest(context());
  assert.equal(failed.status, 503); assert.equal(failed.headers.get("cache-control"), "no-store"); assert.equal(cached, null);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.redirect, "manual");
    return new Response('<rss><channel><item><title>Historical ASCN lead</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Sun, 29 Apr 2018 00:00:00 GMT</pubDate></item></channel></rss>');
  });
  const successful = await onRequest(context()); await Promise.all(pending);
  assert.equal(successful.status, 200); assert.equal((await successful.json()).articles.length, 1);
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => { throw new Error("Should use cache"); });
  const head = await onRequest(context("HEAD")); assert.equal(head.status, 200); assert.equal(await head.text(), "");
});
