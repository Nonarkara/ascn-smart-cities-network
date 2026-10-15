import { writeFile } from "node:fs/promises";
import { buildFromDirectory } from "../lib/ascn-record.mjs";

// public/round2/ is read when the folder exists. A scrape-schema CSV joins the
// record list. tied-aid.csv, programmes.csv and funding-by-donor.csv are read
// by their own columns. An empty or missing folder changes nothing. PDFs are
// not copied, and a conflicting donor figure is reported rather than written
// over a headline total.
const dir = process.env.ASCN_ARCHIVE_DIR || "/cursor/stores/bot/ascn-archive";
const { document, report } = await buildFromDirectory(dir);
await writeFile(new URL("../data/ascn-archive.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
console.log(report);
console.log(`Wrote data/ascn-archive.json (${document.items.length} public items).`);
