/* Vendor the two design faces, replacing a stack that never named a real one.

   The old `--font` was "Helvetica Neue", Helvetica, Arial, "IBM Plex Sans
   Thai", sans-serif. That is a system font doing the work of a design font,
   a Thai face the site never shipped, and no CJK face at all — so every
   Chinese string rendered in whatever the visitor's OS happened to pick.
   "Source Sans 3" was downloaded, vendored, and referenced by nothing.

   Three faces, all self-hosted because the CSP is font-src 'self':
   Noto Sans CJK is the script fallback
   that lets the Chinese edition render at all. It is listed after the two
   design faces, so a Latin or Thai run never reaches it. */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FACES = [
  // Display. Julius Sans One is the closest freely licensed face to Bauhaus
  // Universal: it is unicase, so a lowercase 'a' and an uppercase 'A' are the
  // same shape, which is the one thing every "Bauhaus-inspired" geometric on
  // Google Fonts is not. Bauhaus Universal itself is a 1973 Albert Janer face
  // that is not redistributable. It ships a single weight and cannot set
  // 13px prose, so it never appears below the display sizes.
  { pkg: "@fontsource/julius-sans-one", name: "julius-sans-one", label: "Julius Sans One",
    weights: ["400"] },
  // Body. Archivo is a grotesque — tight apertures, flat terminals, no
  // geometric circles — which is the opposite of the Poppins/Jost/Josefin
  // look this site kept being handed. It carries every line of running text.
  { pkg: "@fontsource/archivo", name: "archivo", label: "Archivo",
    weights: ["400", "500", "600", "700"] },
  // Thai, matched in proportion, used for both registers.
  { pkg: "@fontsource/prompt", name: "prompt", label: "Prompt",
    weights: ["400", "500", "600", "700"] },
];

const output = new URL("../fonts/", import.meta.url);
await mkdir(new URL("files/", output), { recursive: true });

let css = "";
for (const face of FACES) {
  let source;
  try {
    source = pathToFileURL(`${resolve("node_modules", face.pkg)}/`);
  } catch {
    throw new Error(`Missing ${face.pkg}. Run: npm i -D ${face.pkg}`);
  }
  for (const w of face.weights) {
    const content = await readFile(new URL(`${w}.css`, source), "utf8");
    css += content;
    for (const m of content.matchAll(/url\(\.\/(files\/[^)]+)\)/g)) {
      await cp(new URL(m[1], source), new URL(m[1], output));
    }
  }
  try {
    await cp(new URL("LICENSE", source), new URL(`${face.name}-LICENSE`, output));
  } catch { /* the package may ship the licence at the repo root */ }
}
await writeFile(new URL("design-faces.css", output), css);

// Prune anything in files/ this stylesheet no longer references. Changing the
// face list once left 98 Source Sans 3 woff2 files — 1.4MB — sitting in the
// published bundle, referenced by nothing, because vendoring only ever added.
// Shipping bytes no stylesheet asks for is a silent cost that never shows up
// in a test; deleting the dead files is part of changing the faces.
{
  const dir = new URL("files/", output);
  const referenced = new Set([...css.matchAll(/url\(\.\/files\/([^)]+)\)/g)].map((m) => m[1]));
  const present = await readdir(dir);
  const orphans = present.filter((f) => !referenced.has(f));
  if (orphans.length) {
    for (const f of orphans) await rm(new URL(f, dir));
    console.log(`Pruned ${orphans.length} unreferenced font file(s).`);
  }
}

// The block above only reaches files/, so it could never clean the licences
// sitting beside it — and a licence outlives its face. Swapping Poppins for
// Jost, then Jost for Julius, left josefin-sans-LICENSE, jost-LICENSE and
// league-spartan-LICENSE in fonts/ and in git, for faces no rule references.
// They were never published: site-assets.mjs allowlists only the exact name
// fonts/LICENSE, so the build drops them. That is why nobody noticed for three
// typeface changes — the cost of leaving them was invisible from the live site,
// which is precisely why they survived. An OFL licence must be kept alongside
// the font it covers, so the rule is not "no stale licences" but "a licence for
// a current face and nothing else".
{
  const dir = new URL(".", output);
  const keep = new Set(["design-faces.css", ...FACES.map((f) => `${f.name}-LICENSE`)]);
  const present = await readdir(dir);
  const orphans = present.filter((f) => !keep.has(f) && !f.startsWith(".") && f !== "files");
  if (orphans.length) {
    for (const f of orphans) await rm(new URL(f, dir), { recursive: true, force: true });
    console.log(`Pruned ${orphans.length} stale top-level font file(s): ${orphans.join(", ")}`);
  }
}
console.log(`Vendored ${FACES.map((f) => f.label).join(" + ")} (self-hosted, OFL).`);