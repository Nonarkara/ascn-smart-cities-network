import { safeUrl } from "./security.mjs";

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
    try { return typeof row.title === "string" && row.title.length > 0 && row.title.length <= 240 && typeof row.publisher === "string" && row.publisher.length <= 160 && safeUrl(row.url) !== "#" && new URL(row.url).protocol === "https:" && new URL(row.url).hostname === "news.google.com" && row.kind === "Unreviewed search match" && (row.publishedAt === null || Number.isFinite(Date.parse(row.publishedAt))); } catch { return false; }
  });
  return { checkedAt: payload.checkedAt, articles, sources: Array.isArray(payload.sources) ? payload.sources.filter((source) => source && typeof source.id === "string" && ["ok", "unavailable"].includes(source.status)).slice(0, 10) : [] };
}

export function mergeDiscovery(lists) {
  const seen = new Set();
  return lists.flat().filter((row) => { const key = row.title.normalize("NFKC").toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
}
