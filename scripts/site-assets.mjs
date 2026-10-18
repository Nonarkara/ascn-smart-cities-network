import { cp, lstat, mkdir, readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

export const siteEntries = ["index.html", "styles.css", "app.js", "showcase.js", "news.js", "ascn-news.js", "archive.js", "favicon.svg", "_headers",
  "lib", "vendor", "fonts", "data", "docs", "Photos", "logos", "media"];

export const publishedDatasets = new Set([
  "ascn-archive.json",
  "ascn-cities.json", "ascn-knowledge.json",
  "ascn-library.json", "ascn-library-full.json", "ascn-news-archive.json",
  "ascn-news-discovery.json", "ascn-v2-data.json", "city-stats-merged.json", "news-snapshot.json",
]);

const runtimeModules = new Set(["security.mjs", "i18n.mjs", "ascn-review.mjs", "ascn-discovery.mjs", "news-feed.mjs", "news-sources.mjs"]);
const publicAssets = new Set(JSON.parse(await readFile(new URL("./public-assets.json", import.meta.url), "utf8")));
const assetFolders = new Set(["docs", "Photos", "logos", "media"]);
const extensions = {
  lib: new Set([".mjs"]), vendor: new Set([".js", ".css", ".png"]),
  fonts: new Set([".css", ".woff", ".woff2"]),
  data: new Set([".json"]), docs: new Set([".pdf", ".png"]),
  Photos: new Set([".jpg", ".jpeg", ".png", ".webp"]),
  logos: new Set([".png", ".svg"]), media: new Set([".png", ".jpg", ".jpeg", ".webp", ".mp4", ".json"]),
};

export async function copySiteEntry(root, output, entry, relative = entry) {
  if (entry === "data" && relative !== "data" && !publishedDatasets.has(relative.slice(5))) return;
  if (entry === "lib" && relative !== "lib" && !runtimeModules.has(relative.slice(4))) return;
  if (assetFolders.has(entry) && relative !== entry && !publicAssets.has(relative) && ![...publicAssets].some((path) => path.startsWith(`${relative}/`))) return;
  const source = join(root, relative);
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error(`Refusing to publish symbolic link: ${relative}`);
  const parts = relative.split("/");
  if (parts.some((part) => part.startsWith("."))) return;
  if (info.isDirectory()) {
    for (const name of await readdir(source)) await copySiteEntry(root, output, entry, `${relative}/${name}`);
    return;
  }
  if (relative !== entry && !extensions[entry]?.has(extname(relative).toLowerCase()) && !["vendor/leaflet/LICENSE", "fonts/LICENSE"].includes(relative)) return;
  if (!info.isFile()) throw new Error(`Not a regular site asset: ${relative}`);
  if (info.size >= 25 * 1024 * 1024) throw new Error(`Site asset exceeds 25 MiB: ${relative}`);
  const destination = join(output, relative);
  await mkdir(join(destination, ".."), { recursive: true });
  await cp(source, destination, { dereference: false });
}
