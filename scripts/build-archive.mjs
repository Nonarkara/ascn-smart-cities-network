import { writeFile } from "node:fs/promises";
import { buildFromDirectory } from "../lib/ascn-record.mjs";

// public/round2/ is read when the folder exists. A scrape-schema CSV joins the
// record list. tied-aid.csv, programmes.csv and funding-by-donor.csv are read
// by their own columns. An empty or missing folder changes nothing. PDFs are
// not copied, and a conflicting donor figure is reported rather than written
// over a headline total.
// No default path: the source folder lives outside the repository and outside
// any other machine. The branch this came from defaulted to an absolute path
// that existed only on the agent's own box, so `npm run build:archive` failed
// with an opaque ENOENT for everyone else. Require the variable explicitly and
// say so, rather than naming a directory that is not ours to assume.
if (!process.env.ASCN_ARCHIVE_DIR) {
  console.error("build:archive needs ASCN_ARCHIVE_DIR — the folder holding records.json (and optionally the CSVs and round2/). It is intentionally not defaulted; see README.");
  process.exit(1);
}
const dir = process.env.ASCN_ARCHIVE_DIR;
const { document, report } = await buildFromDirectory(dir);
await writeFile(new URL("../data/ascn-archive.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
console.log(report);
console.log(`Wrote data/ascn-archive.json (${document.items.length} public items).`);
