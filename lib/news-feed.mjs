import xmlLibrary from "../vendor/xml/fxp.cjs";
import { tagHeadline } from "./news-sources.mjs";
import { safeUrl } from "./security.mjs";

const { XMLParser, XMLValidator } = xmlLibrary;
const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true });
const asArray = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value) => typeof value === "string" ? value : value?.["#text"] || "";

export function parseFeed(xml, source, now = Date.now()) {
  if (typeof xml !== "string" || xml.length > 524288 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsafe or oversized feed");
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid XML feed");
  const document = parser.parse(xml);
  const rows = document.rss?.channel?.item ?? document.feed?.entry;
  if (!rows) throw new Error("Feed has no items");
  const host = new URL(source.site).hostname.replace(/^www\./, "");
  return asArray(rows).slice(0, 100).flatMap((item) => {
    const title = text(item.title).replace(/<[^>]*>/g, "").trim().slice(0, 240);
    const link = typeof item.link === "string" ? item.link : asArray(item.link).find((link) => !link["@_rel"] || link["@_rel"] === "alternate")?.["@_href"];
    const url = safeUrl(link);
    if (!title || url === "#" || new URL(url).hostname.replace(/^www\./, "") !== host) return [];
    const rawDate = text(item.pubDate || item.published || item.updated || item.date);
    const timestamp = Date.parse(rawDate);
    if (Number.isFinite(timestamp) && (timestamp > now + 86400000 || now - timestamp > 180 * 86400000)) return [];
    const categories = asArray(item.category).map((value) => text(value) || value["@_term"] || "").join(" ");
    const context = `${title} ${text(item.description).replace(/<[^>]*>/g, "").slice(0, 1000)}`;
    if (!/\b(urban|cities|city|municipal|smart|government|digital|infrastructure|transport|rail|metro|traffic|mobility|electric vehicle|ev|charging|flood|climate|water|waste|energy|grid|housing|building|resilien|data centre)\w*/i.test(context)) return [];
    const evidence = `${context} ${categories}`;
    const tags = tagHeadline(evidence, source);
    if ((!tags.countries.length && !tags.regional) || !tags.topics.length) return [];
    return [{ title, url, publisher: source.name, sourceId: source.id,
      publishedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
      countries: tags.countries, topics: tags.topics,
      kind: /sponsored|partner content|eb studio/i.test(evidence) ? "Partner content" : /opinion/i.test(categories) ? "Opinion" : "Report" }];
  });
}

export function mergeArticles(lists) {
  const seen = new Set();
  return lists.flat().map((article) => {
    const url = new URL(article.url); url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/.test(key)) url.searchParams.delete(key);
    return { ...article, url: url.href };
  }).filter((article) => {
    const key = article.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (seen.has(article.url) || seen.has(key)) return false;
    seen.add(article.url); seen.add(key); return true;
  }).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, 60);
}

export async function fetchFeed(source, fetcher = fetch) {
  const response = await fetcher(source.url, {
    signal: AbortSignal.timeout(12000), redirect: "manual",
    headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "ASCN-Regional-News/1.0 (+https://ascn.nonarkara.org)" },
  });
  if (!response.ok || Number(response.headers.get("content-length")) > 524288) throw new Error("Feed unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder(); let bytes = 0; let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 524288) { await reader.cancel(); throw new Error("Oversized feed"); }
      body += decoder.decode(value, { stream: true });
    }
    return parseFeed(body + decoder.decode(), source);
  } finally { reader.releaseLock(); }
}
