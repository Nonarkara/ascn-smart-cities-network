/* Vendor the two design faces, replacing a stack that never named a real one.

   The old `--font` was "Helvetica Neue", Helvetica, Arial, "IBM Plex Sans
   Thai", sans-serif. That is a system font doing the work of a design font,
   a Thai face the site never shipped, and no CJK face at all — so every
   Chinese string rendered in whatever the visitor's OS happened to pick.
   "Source Sans 3" was downloaded, vendored, and referenced by nothing.

   Two faces now, both self-hosted because the CSP is font-src 'self':
     Josefin Sans — Latin. Jost was the first Latin face and League Spartan
       the second; both were Futura-derived geometrics that read as the same
       face as each other, and League Spartan's Bauhaus weight turned heavy
       and clunky at the 13px body size this site runs at. Josefin Sans is the
       1920s geometric line — closer in character to Bauhaus Universal's
       period without its unicase, and it stays light at small sizes.
     Prompt  — Thai, geometric and matched in weight and proportion.
   A third is not a third design choice: Noto Sans CJK is the script fallback
   that lets the Chinese edition render at all. It is listed after the two
   design faces, so a Latin or Thai run never reaches it. */
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const FACES = [
  { pkg: "@fontsource/josefin-sans", name: "josefin-sans", label: "Josefin Sans",
    weights: ["300", "400", "600", "700"] },
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
console.log(`Vendored ${FACES.map((f) => f.label).join(" + ")} (self-hosted, OFL).`);