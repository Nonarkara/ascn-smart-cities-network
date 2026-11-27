// The reading measure, swept in every mode.
//
// The English sweep that lives inside verify-graphics.mjs is the canonical
// one, but it is also the only one: a gate that only ever measures one mode
// is a gate that has only looked at one mode. Thai sets without word spaces
// and Chinese sets a character per em, so the same content breaks into
// different lines — and a Chinese paragraph that has lost its measure column
// reads as 68 characters and passes a Latin ceiling while running three
// measures wide.
//
// This script sweeps every view at the three viewports the law names, in one
// language and one theme, and fails on either half of the measure law: the
// character ceiling for Latin, and the em ceiling that means the same thing
// in every script.
//
//   ASCN_MEASURE_LANG=en|th|zh   ASCN_MEASURE_THEME=dark|light
//   ASCN_TEST_URL=http://127.0.0.1:<port>
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { auditRoutes, waitForAuditRoute } from "./audit-routes.mjs";
import { measureRenderedLines } from "./visual-audit-rules.mjs";
import { READING_CEILING_CHARS, paperCeilingEm, measureOffenders } from "./measure-law.mjs";

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const LANG = process.env.ASCN_MEASURE_LANG || "en";
const THEME = process.env.ASCN_MEASURE_THEME || "dark";
const OUT = process.env.ASCN_MEASURE_OUT || "artifacts/measure";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const report = { base: BASE, lang: LANG, theme: THEME, startedAt: new Date().toISOString(), failures: [], views: [] };
let ceilingEm = null;
let worst = { chars: 0, em: 0, where: "—" };
let countedWrong = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: vp });
  await page.route("**/api/{news,ascn-news}", (r) => r.fulfill({ status: 503, json: { checkedAt: new Date().toISOString(), articles: [], sources: [] } }));
  await page.addInitScript(({ l, t }) => {
    try { if (l) localStorage.setItem("ascn-lang", l); } catch { /* private mode */ }
    try { if (t) localStorage.setItem("ascn_theme", t); } catch { /* private mode */ }
  }, { l: LANG, t: THEME });
  await page.goto(`${BASE}/#overview`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (ceilingEm === null) ceilingEm = await paperCeilingEm(page);
  const views = await auditRoutes(page);
  if (!views.length) throw new Error("The measure sweep could not read the navigation");
  for (const v of views) {
    await page.goto(`${BASE}/#${v}`, { waitUntil: "domcontentloaded" });
    await waitForAuditRoute(page, v);
    const found = await page.evaluate(measureRenderedLines, "p, li, dd, blockquote, figcaption, div, span, a, td, th, dt, strong, em, b, i, small, label, button, h1, h2, h3, h4, h5, h6, time, summary, caption, cite, legend, output, mark");
    const offenders = measureOffenders(found, ceilingEm);
    for (const f of found) {
      if (f.chars > worst.chars) worst = { chars: f.chars, em: f.em, where: `${v} ${f.sel} @${f.px}px @${vp.width}px` };
      if (f.em > worst.em) worst = { chars: f.chars, em: f.em, where: `${v} ${f.sel} @${f.px}px @${vp.width}px` };
      // The count must be the count of the line it reports.
      if (f.chars && f.line) {
        const graphemes = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(f.line)].length;
        if (graphemes !== f.chars) countedWrong.push(`${v} ${f.sel} counted ${f.chars} but the line reads ${graphemes}`);
      }
    }
    for (const o of offenders) {
      report.failures.push(`${v} ${o.sel}=${o.why} @${vp.width}px — "${String(o.line || "").replace(/\s+/g, " ").trim().slice(0, 60)}"`);
    }
    report.views.push({ view: v, width: vp.width, blocks: found.length, worstChars: Math.max(0, ...found.map((f) => f.chars)), worstEm: Math.max(0, ...found.map((f) => f.em)) });
  }
  await page.close();
}
await browser.close();

report.ceilingEm = ceilingEm;
report.ceilingChars = READING_CEILING_CHARS;
report.worst = worst;
report.countedWrong = countedWrong;
report.passed = report.failures.length === 0 && countedWrong.length === 0;
await writeFile(`${OUT}/measure-${LANG}-${THEME}.json`, JSON.stringify(report, null, 2) + "\n");

console.log(`Measure sweep — ${LANG}/${THEME}: ceiling ${ceilingEm ? ceilingEm.toFixed(2) : "?"}em, ${READING_CEILING_CHARS} characters`);
console.log(`  widest line: ${worst.em}em (${worst.chars} characters) at ${worst.where}`);
console.log(`  failures: ${report.failures.length}`);
for (const f of report.failures.slice(0, 25)) console.log("   FAIL", f);
if (countedWrong.length) {
  console.log(`  counted lines disagree with their text: ${countedWrong.length}`);
  for (const c of countedWrong.slice(0, 6)) console.log("   FAIL", c);
}
if (!report.passed) process.exitCode = 1;
