import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = new URL("..", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

const entries = [
  "index.html",
  "styles.css",
  "app.js",
  "favicon.svg",
  "data",
  "docs",
  "Photos",
  "logos",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of entries) {
  const from = new URL(entry, root);
  if (!existsSync(from)) continue;
  await cp(from, new URL(entry, dist), { recursive: true });
}

console.log("Built static site in dist/");
