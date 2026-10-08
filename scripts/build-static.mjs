import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { siteEntries, copySiteEntry } from "./site-assets.mjs";

const root = new URL("..", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

const entries = [
  "index.html",
  "styles.css",
  "app.js",
  "showcase.js",
  "news.js",
  "ascn-news.js",
  "favicon.svg",
  "data",
  "docs",
  "Photos",
  "logos",
  "media",
  "lib",
  "vendor",
  "fonts",
  "_headers",
];

if (entries.length !== siteEntries.length || entries.some((entry) => !siteEntries.includes(entry))) {
  throw new Error("Build entries do not match the reviewed site asset list.");
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const from = new URL(entry, root);
  if (!existsSync(from)) {
    if (["docs", "Photos"].includes(entry)) continue;
    throw new Error(`Required site asset is missing: ${entry}`);
  }
  await copySiteEntry(fileURLToPath(root), fileURLToPath(dist), entry);
}

console.log("Built static site in dist/");
