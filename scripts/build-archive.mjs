import { writeFile } from "node:fs/promises";
import { buildFromDirectory } from "../lib/ascn-record.mjs";

const dir = process.env.ASCN_ARCHIVE_DIR || "/cursor/stores/bot/ascn-archive";
const { document, report } = await buildFromDirectory(dir);
await writeFile(new URL("../data/ascn-archive.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
console.log(report);
console.log(`Wrote data/ascn-archive.json (${document.items.length} public items).`);
