import { createHash } from "node:crypto";
import { cp, mkdir, readFile } from "node:fs/promises";

const source = new URL("../node_modules/leaflet/", import.meta.url);
const output = new URL("../vendor/leaflet/", import.meta.url);
const checksums = {
  "leaflet.js": "20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=",
  "leaflet.css": "p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
};

await mkdir(output, { recursive: true });
for (const [name, expected] of Object.entries(checksums)) {
  const file = new URL(`dist/${name}`, source);
  const checksum = createHash("sha256").update(await readFile(file)).digest("base64");
  if (checksum !== expected) throw new Error(`Leaflet ${name} checksum does not match the pinned 1.9.4 release`);
  await cp(file, new URL(name, output));
}
await cp(new URL("dist/images/", source), new URL("images/", output), { recursive: true });
await cp(new URL("LICENSE", source), new URL("LICENSE", output));
console.log("Prepared pinned Leaflet 1.9.4 assets with verified checksums.");
