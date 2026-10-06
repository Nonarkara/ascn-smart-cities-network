import { writeFile } from "node:fs/promises";
import { NEWS_SOURCES } from "../lib/news-sources.mjs";
import { fetchFeed, mergeArticles } from "../lib/news-feed.mjs";

const results = await Promise.allSettled(NEWS_SOURCES.map((source) => fetchFeed(source)));
const articles = mergeArticles(results.filter((result) => result.status === "fulfilled").map((result) => result.value));
for (const [index, result] of results.entries()) console.log(`${NEWS_SOURCES[index].name} / ${NEWS_SOURCES[index].section}: ${result.status === "fulfilled" ? `${result.value.length} regional headlines` : "unavailable"}`);
if (!articles.length) throw new Error("No verified regional headlines fetched; existing snapshot was preserved.");
const snapshot = { mode: "saved", checkedAt: new Date().toISOString(), articles,
  sources: NEWS_SOURCES.map((source, index) => ({ id: source.id, name: source.name, section: source.section, site: source.site,
    status: results[index].status === "fulfilled" ? "ok" : "unavailable", articles: results[index].status === "fulfilled" ? results[index].value.length : 0 })) };
await writeFile(new URL("../data/news-snapshot.json", import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved ${articles.length} dated/source-linked regional headlines.`);
