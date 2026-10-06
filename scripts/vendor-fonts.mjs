import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!process.argv[2]) throw new Error("Pass the installed @fontsource/source-sans-3 directory.");
const source = pathToFileURL(`${resolve(process.argv[2])}/`);
const output = new URL("../fonts/", import.meta.url);
await mkdir(new URL("files/", output), { recursive: true });
let css = "";
for (const face of ["400", "600", "700", "800", "900", "400-italic", "600-italic"]) {
  const content = await readFile(new URL(`${face}.css`, source), "utf8");
  css += content;
  for (const match of content.matchAll(/url\(\.\/(files\/[^)]+)\)/g)) await cp(new URL(match[1], source), new URL(match[1], output));
}
await writeFile(new URL("source-sans-3.css", output), css);
await cp(new URL("LICENSE", source), new URL("LICENSE", output));
console.log("Prepared local Source Sans 3 fonts and OFL license.");
