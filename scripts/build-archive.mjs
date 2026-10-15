import { writeFile } from "node:fs/promises";
import { buildFromDirectory } from "../lib/ascn-record.mjs";

// public/round2/*.csv is read automatically when the folder exists. An empty or
// missing folder changes nothing. PDFs under that folder are not copied.
const dir = process.env.ASCN_ARCHIVE_DIR || "/cursor/stores/bot/ascn-archive";
const { document, report } = await buildFromDirectory(dir);
await writeFile(new URL("../data/ascn-archive.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
console.log(report);
console.log(`Wrote data/ascn-archive.json (${document.items.length} public items).`);
