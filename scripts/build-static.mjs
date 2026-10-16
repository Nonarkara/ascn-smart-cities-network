import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
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

// maxRetries: a local preview server reading dist/ can make a bare rm fail
// with ENOTEMPTY on APFS, which turns a transient race into a failed build.
await rm(dist, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const from = new URL(entry, root);
  if (!existsSync(from)) {
    if (["docs", "Photos"].includes(entry)) continue;
    throw new Error(`Required site asset is missing: ${entry}`);
  }
  await copySiteEntry(fileURLToPath(root), fileURLToPath(dist), entry);
}

/* ---------- Cache-bust every local asset from its own content --------------
   `?v=` used to be a hand-maintained counter, and it was not bumped across four
   consecutive deploys that all rewrote styles.css and app.js. The CDN serves
   assets with max-age=14400, so a visitor who had the page open got NEW
   markup against a STYLESHEET UP TO FOUR HOURS OLD. That is not a cosmetic
   cache miss: new markup with old rules rendered the twins directory as five
   unstyled inline <a> elements in a five-column grid, on top of the KPI row.

   Deriving the parameter from the bytes means a changed file gets a new URL
   and the stale entry can never be served again. Deriving it from a manual
   number means it fails silently, in production, on someone's screen.

   Rewritten in dist/ only — the source index.html keeps its placeholder. */
const shortHash = async (rel) => {
  const file = new URL(rel, dist);
  if (!existsSync(file)) return null;
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex").slice(0, 10);
};

const htmlPath = new URL("index.html", dist);
let html = await readFile(htmlPath, "utf8");
const cacheable = new Map();

for (const m of html.matchAll(/(?:href|src)="([^"?#:]+\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?))(?:\?v=\d+)?"/g)) {
  const rel = m[1];
  if (!cacheable.has(rel)) {
    const h = await shortHash(rel);
    if (h) cacheable.set(rel, h);
  }
}

let rewritten = 0;
for (const [rel, hash] of cacheable) {
  const re = new RegExp(`((?:href|src)="${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?:\\?v=\\d+)?`, "g");
  const before = html;
  html = html.replace(re, `$1?v=${hash}`);
  if (html !== before) rewritten++;
}
await writeFile(htmlPath, html);

console.log(`Built static site in dist/ (${rewritten} asset URLs hashed from content)`);
