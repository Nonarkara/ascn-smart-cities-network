import { safeUrl } from "./security.mjs";

// The search index this site's discovery list is drawn from, by host. A
// lead is only ever a link this list published, so the host is pinned: a
// saved file cannot smuggle in a link to anywhere else. The list is named
// rather than written inline so that adding an index is one line here and
// one entry in the source list, not a hunt through the validator.
//
// Measured from Cloudflare's edge on 2026-11-22: news.google.com refuses
// the edge's address with its "unusual traffic" page (HTTP 503 from the
// RSS endpoint, a redirect to google.com/sorry/index for the root). The
// same feed answers normally from a workstation. This is the publisher's
// policy toward the edge's address range, not a fault in this code, and no
// other general news index answered the same query from the edge either:
// Bing's news index holds no items for the network's name, GDELT refused
// with a rate-limit, Yahoo answered with HTML rather than a feed, and
// DuckDuckGo's news feed is gone. So the published snapshot is the list of
// record and the live check is a bonus, not the other way round.
export const DISCOVERY_INDEX_HOSTS = ["news.google.com"];

const query = '"ASEAN Smart Cities Network" OR "ASEAN Smart City Network" OR "Jaringan Kota Cerdas ASEAN" OR "เครือข่ายเมืองอัจฉริยะอาเซียน"';
export const ASCN_DISCOVERY_SOURCES = [
  { id: "ascn-exact", name: "Google News index", section: "Exact network name", url: `https://news.google.com/rss/search?q=${encodeURIComponent('"ASEAN Smart Cities Network"')}&hl=en-SG&gl=SG&ceid=SG%3Aen`, site: "https://news.google.com", discovery: true },
  { id: "ascn-variants", name: "Google News index", section: "Name and language variants", url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-SG&gl=SG&ceid=SG%3Aen`, site: "https://news.google.com", discovery: true },
];

export function historicalDiscoverySources(endYear) {
  if (!Number.isInteger(endYear) || endYear < 2018 || endYear > 2100) throw new Error("Invalid ASCN discovery year");
  return Array.from({ length: endYear - 2018 + 1 }, (_, index) => {
    const year = 2018 + index;
    const search = `"ASEAN Smart Cities Network" after:${year}-01-01 before:${year + 1}-01-01`;
    return { id: `ascn-history-${year}`, name: "Google News index", section: `${year} historical search`, url: `https://news.google.com/rss/search?q=${encodeURIComponent(search)}&hl=en-SG&gl=SG&ceid=SG%3Aen`, site: "https://news.google.com", discovery: true };
  });
}

export function validateDiscovery(payload) {
  if (!payload || !Array.isArray(payload.articles) || payload.articles.length > 10000 || !Number.isFinite(Date.parse(payload.checkedAt))) throw new Error("Invalid ASCN discovery list");
  const articles = payload.articles.filter((row) => {
    try { return typeof row.title === "string" && row.title.length > 0 && row.title.length <= 240 && typeof row.publisher === "string" && row.publisher.length <= 160 && safeUrl(row.url) !== "#" && new URL(row.url).protocol === "https:" && DISCOVERY_INDEX_HOSTS.includes(new URL(row.url).hostname) && row.kind === "Unreviewed search match" && (row.publishedAt === null || Number.isFinite(Date.parse(row.publishedAt))); } catch { return false; }
  });
  return { checkedAt: payload.checkedAt, articles,
    attemptedAt: Number.isFinite(Date.parse(payload.attemptedAt)) ? payload.attemptedAt : null,
    snapshotAt: Number.isFinite(Date.parse(payload.snapshotAt)) ? payload.snapshotAt : null,
    // `mode` says how the list was obtained: "live" from the index at the
    // moment of the request, "saved" from the published snapshot. The reader
    // is told which, because a saved list is not a stale one — it is the
    // list this site was built to publish, refreshed where the index is
    // reachable.
    mode: payload.mode === "live" ? "live" : "saved",
    live: payload.mode === "live",
    sources: Array.isArray(payload.sources) ? payload.sources.filter((source) => source && typeof source.id === "string" && ["ok", "unavailable"].includes(source.status)).slice(0, 10).map((source) => ({ id: source.id, status: source.status, ...(source.reason && typeof source.reason === "object" ? { reason: { code: String(source.reason.code || "unreachable").slice(0, 24), status: Number.isFinite(source.reason.status) ? source.reason.status : null } } : {}) })) : [] };
}

export function mergeDiscovery(lists) {
  const seen = new Set();
  return lists.flat().filter((row) => { const key = row.title.normalize("NFKC").toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
}
