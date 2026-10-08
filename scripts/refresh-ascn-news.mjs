import { readFile, writeFile } from "node:fs/promises";
import { ASCN_DISCOVERY_SOURCES, historicalDiscoverySources, mergeDiscovery, validateDiscovery } from "../lib/ascn-discovery.mjs";
import { fetchFeed } from "../lib/news-feed.mjs";

const path = new URL("../data/ascn-news-discovery.json", import.meta.url);
let saved = [];
let previousSearches = [];
try {
  const previous = JSON.parse(await readFile(path, "utf8"));
  saved = validateDiscovery(previous).articles;
  previousSearches = Array.isArray(previous.searches) ? previous.searches : [];
} catch (error) { if (error.code !== "ENOENT") throw error; }
const archive = JSON.parse(await readFile(new URL("../data/ascn-news-archive.json", import.meta.url), "utf8"));
const knownSources = [...ASCN_DISCOVERY_SOURCES, ...historicalDiscoverySources(Number(archive.reviewedAt.slice(0, 4)))];
const sources = process.argv.includes("--backfill") ? knownSources : ASCN_DISCOVERY_SOURCES;
const checkedAt = new Date().toISOString();
const results = [];
for (let index = 0; index < sources.length; index += 3) {
  results.push(...await Promise.allSettled(sources.slice(index, index + 3).map((source) => fetchFeed(source))));
}
const searches = sources.map((source, index) => ({ id: source.id, section: source.section, url: source.url, checkedAt, status: results[index].status === "fulfilled" ? "ok" : "unavailable", returned: results[index].status === "fulfilled" ? results[index].value.length : 0 }));
const fresh = mergeDiscovery(results.filter((result) => result.status === "fulfilled").map((result) => result.value));
if (!fresh.length) throw new Error("ASCN index unavailable; existing archive left unchanged");
const articles = mergeDiscovery([fresh, saved]);
if (articles.length > 10000) throw new Error("Discovery archive needs partitioning; existing archive left unchanged");
const knownSearches = previousSearches.filter((search) => knownSources.some((source) => source.id === search.id && source.url === search.url));
const searchHistory = [...new Map([...knownSearches, ...searches].map((search) => [search.id, search])).values()];
const payload = { ...validateDiscovery({ checkedAt, articles }), searches: searchHistory };
await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Preserved ${articles.length} ASCN discovery leads (${fresh.length} returned by the index). These are not reviewed evidence.`);
console.log(searches.map((search) => `${search.section}: ${search.status}, ${search.returned} matches`).join("\n"));
