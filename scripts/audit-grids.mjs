// The grid law, measured: a grid's column count must divide its item count,
// or the last item takes the columns its row has left.
//
// The owner's rule, stated once: "A grid's column count must divide its
// item count or the last item strands alone." The failure is a hole — the
// last row of a grid of identical cards holds one card and a stretch of
// empty cells beside it, and the reader sees a rhythm that stopped.
//
// WHAT IS MEASURED
//
//   For every peer grid in every view at every viewport: the grid's column
//   tracks, its items, the rows those items form, and which cells of each
//   row are covered. A cell with nothing in it is a hole.
//
//   Only PEER grids are measured — grids whose children are all the same
//   element with the same classes. A grid whose children differ is a
//   deliberate composition (a panel with a title column and a notes column,
//   a row with a figure beside a caption), and the law does not apply.
//
//   The item that takes the row is a peer too: it carries the `is-wide` class
//   the runtime gives it, and that class is a state, not a type, so it is
//   read out of the signature.
//
//   The measure is in cells, not in pixels. An item narrower than its track
//   is alignment; an item that leaves a track with nothing in it is a hole.
//
// WHY IT IS A GATE AND NOT A NOTE
//
//   The counts here are data — eleven contact cards, eleven documents, sixty-
//   two library entries, and the library's count changes with the filter. A
//   count that divides today can stop dividing when the data changes, or
//   when a filter leaves six entries in a three-column grid. The law is
//   enforced in the runtime (app.js) and proved here, in the built site.
//
// THE RESIZE PATH
//
//   Every other gate in this repository loads the page fresh at each
//   viewport, so none of them has ever seen a page that was NARROWED after
//   it was built. That path is where a grid breaks: an item that spans two
//   columns in a one-column grid forces an implicit track, the explicit
//   track beside it collapses to zero width, and the items in it print on
//   top of their neighbours. Thirty-one of the sixty-two library entries
//   were at zero width that way, and no gate could see it.
//
//   So this gate walks the path: it loads at the desk width, narrows to the
//   phone and to the tablet, and measures again. A track that has collapsed
//   to nothing while the grid holds items is a failure.
//
// Usage:
//   ASCN_TEST_URL=http://127.0.0.1:<port> node scripts/audit-grids.mjs
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { auditRoutes, waitForAuditRoute } from "./audit-routes.mjs";

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const OUT = process.env.ASCN_GRIDS_OUT || "artifacts/grids";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

// The widths the page is narrowed TO, after it was built at the desk width.
const RESIZE_PATH = [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
];

// The judgement, separated from the measurement so a unit test can plant a
// stranded row and prove it is caught. A row that ends short of its grid's
// trailing edge is the law's failure; a row in the middle of a grid that is
// short is a composition, and is reported rather than failed.
export function judgeGridRows(rows) {
  const failures = [];
  const notes = [];
  for (const r of rows) {
    if (!r.emptyCells) continue;
    const where = `${r.view} ${r.sel} row ${r.row}/${r.rows} of ${r.cols} columns leaves cell(s) ${r.empty} empty — ${r.rowItems} item(s) in the row, ${r.items} in the grid`;
    if (r.last) failures.push(where);
    else notes.push(where);
  }
  return { failures, notes };
}

// The collapsed-track judgement. A grid whose track has collapsed to zero
// width while it holds items is not a grid: the items have no room, and
// their text prints over their neighbours.
export function judgeCollapsedTracks(collapsed) {
  const failures = [];
  for (const c of collapsed) {
    failures.push(
      `${c.view} ${c.path} ${c.sel}: a column track has collapsed to ${c.collapsedTracks} of ${c.cols} track(s) at ${c.width}px — ${c.zeroWidth} of ${c.items} item(s) have no width, and their text prints over their neighbours`,
    );
  }
  return failures;
}

// The measurement, in the page. It returns both the row map (the holes) and
// the collapsed tracks (a column with no width), because both are the grid
// law failing in different ways.
export async function collectGrids(page) {
  return page.evaluate(() => {
    const out = [];
    const collapsed = [];
    const view = [...document.querySelectorAll(".view")].find((el) => !el.hidden);
    if (!view) return { out, collapsed };
    const sig = (el) => {
      const classes = String(el.className || "").trim().split(/\s+/).filter((c) => c && c !== "is-wide");
      return el.tagName + "|" + classes.sort().join(".");
    };
    // A track is a column of the grid; a cell is a track in a row. A hole
    // is a cell with nothing in it — not an item that is narrower than
    // its track, which is alignment, and not a grid whose tracks do not
    // fill the field, which is the composition gate's business.
    const tracks = (cs, prop) => cs[prop].split(/\s+/).map((t) => parseFloat(t)).filter((n) => Number.isFinite(n));
    for (const grid of view.querySelectorAll("*")) {
      const cs = getComputedStyle(grid);
      if (!cs.display.includes("grid")) continue;
      if (cs.gridTemplateAreas && cs.gridTemplateAreas !== "none") continue; // a deliberate composition
      const cols = tracks(cs, "gridTemplateColumns");
      const allKids = [...grid.children].filter((k) => {
        const kc = getComputedStyle(k);
        if (kc.display === "none" || kc.visibility === "hidden") return false;
        return k.getBoundingClientRect().height > 0;
      });
      // A track at zero width while the grid holds items: the items have no
      // room, and their text prints over their neighbours.
      if (cols.length >= 1 && allKids.length >= 2) {
        const zeroTracks = cols.filter((w) => w === 0).length;
        const zeroItems = allKids.filter((k) => k.getBoundingClientRect().width < 1).length;
        if (zeroTracks > 0 && zeroItems > 0) {
          collapsed.push({
            sel: grid.tagName.toLowerCase() + (grid.id ? "#" + grid.id : "." + String(grid.className || "").trim().split(/\s+/).join(".")),
            cols: cols.length,
            collapsedTracks: zeroTracks,
            zeroWidth: zeroItems,
            items: allKids.length,
            width: Math.round(grid.getBoundingClientRect().width),
          });
        }
      }
      const kids = allKids.filter((k) => k.getBoundingClientRect().width > 0);
      if (kids.length < 2) continue;
      const s0 = sig(kids[0]);
      if (!kids.every((k) => sig(k) === s0)) continue; // not a peer grid
      if (cols.length < 2) continue;
      const rows = tracks(cs, "gridTemplateRows");
      if (!rows.length) continue;
      const colGap = parseFloat(cs.columnGap) || 0;
      const rowGap = parseFloat(cs.rowGap) || 0;
      const box = grid.getBoundingClientRect();
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padT = parseFloat(cs.paddingTop) || 0;
      const left = box.left + padL;
      const top = box.top + padT;
      // The column bands, in the grid's own coordinates.
      const colBands = [];
      let cx = 0;
      for (const w of cols) { colBands.push([cx, cx + w]); cx += w + colGap; }
      // The row bands, likewise. An item is placed by its band, not by its
      // top: an item that wraps to two lines has a different top from the
      // item beside it and still sits in the same row.
      const rowBands = [];
      let ry = 0;
      for (const h of rows) { rowBands.push([ry, ry + h]); ry += h + rowGap; }
      const byRow = new Map();
      for (const k of kids) {
        const r = k.getBoundingClientRect();
        const l = r.left - left;
        const rt = r.right - left;
        const t = r.top - top;
        const rowIndex = rowBands.findIndex((b) => t >= b[0] - 2 && t < b[1] + 2);
        const covered = new Set();
        colBands.forEach((b, i) => { if (rt > b[0] + 1 && l < b[1] - 1) covered.add(i); });
        const key = rowIndex < 0 ? rowBands.length : rowIndex;
        const row = byRow.get(key) || { index: key, covered: new Set(), items: 0 };
        covered.forEach((i) => row.covered.add(i));
        row.items += 1;
        byRow.set(key, row);
      }
      const list = [...byRow.values()].sort((a, b) => a.index - b.index);
      list.forEach((row, i) => {
        const empty = [];
        for (let c = 0; c < cols.length; c += 1) if (!row.covered.has(c)) empty.push(c);
        out.push({
          sel: grid.tagName.toLowerCase() + (grid.id ? "#" + grid.id : "." + String(grid.className || "").trim().split(/\s+/).join(".")),
          child: kids[0].tagName.toLowerCase() + "." + String(kids[0].className || "").trim().split(/\s+/)[0],
          cols: cols.length,
          items: kids.length,
          row: i + 1,
          rows: list.length,
          rowItems: row.items,
          emptyCells: empty.length,
          empty: empty.map((c) => c + 1).join(","),
          last: i === list.length - 1,
        });
      });
    }
    return { out, collapsed };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { base: BASE, startedAt: new Date().toISOString(), failures: [], notes: [], grids: [], collapsed: [], resizePath: [] };

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: vp });
    await page.route("**/api/{news,ascn-news}", (r) => r.fulfill({ status: 503, json: { checkedAt: new Date().toISOString(), articles: [], sources: [] } }));
    await page.addInitScript(() => { try { localStorage.setItem("ascn-lang", "en"); } catch { /* private mode */ } });
    await page.goto(`${BASE}/#overview`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const views = await auditRoutes(page);
    if (!views.length) throw new Error("The grid audit could not read the navigation");
    for (const v of views) {
      await page.goto(`${BASE}/#${v}`, { waitUntil: "domcontentloaded" });
      await waitForAuditRoute(page, v);
      await page.waitForTimeout(350);
      const { out: found, collapsed } = await collectGrids(page);
      for (const f of found) report.grids.push({ view: v, width: vp.width, ...f });
      for (const c of collapsed) report.collapsed.push({ view: v, width: vp.width, path: "fresh load", ...c });
    }
    await page.close();
  }

  // THE RESIZE PATH. The page is built at the desk width and then narrowed —
  // the path a reader takes when they drag a window, and the path no other
  // gate in this repository has ever walked.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route("**/api/{news,ascn-news}", (r) => r.fulfill({ status: 503, json: { checkedAt: new Date().toISOString(), articles: [], sources: [] } }));
    await page.addInitScript(() => { try { localStorage.setItem("ascn-lang", "en"); } catch { /* private mode */ } });
    await page.goto(`${BASE}/#overview`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const views = await auditRoutes(page);
    for (const v of views) {
      // Each view is BUILT at the desk width and then narrowed. The page
      // keeps the width the last measurement left it at, so it is put back
      // first: a view built at two columns and then narrowed to one never
      // held the three-column span that a view built at the desk width
      // holds, and the defect being hunted is the one that span causes.
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${BASE}/#${v}`, { waitUntil: "domcontentloaded" });
      await waitForAuditRoute(page, v);
      await page.waitForTimeout(350);
      for (const target of RESIZE_PATH) {
        await page.setViewportSize(target);
        await page.waitForTimeout(450);
        const { out: found, collapsed } = await collectGrids(page);
        for (const f of found) report.grids.push({ view: v, width: target.width, path: `resized from 1440 to ${target.width}`, ...f });
        for (const c of collapsed) report.collapsed.push({ view: v, width: target.width, path: `resized from 1440 to ${target.width}`, ...c });
        report.resizePath.push({ view: v, width: target.width });
      }
    }
    await page.close();
  }

  await browser.close();

  for (const r of report.grids) {
    const judged = judgeGridRows([r]);
    report.failures.push(...judged.failures);
    report.notes.push(...judged.notes);
  }
  report.failures.push(...judgeCollapsedTracks(report.collapsed));
  report.passed = report.failures.length === 0;
  await writeFile(`${OUT}/grids.json`, JSON.stringify(report, null, 2) + "\n");

  console.log(`Grid law — ${report.grids.length} row(s) measured across ${VIEWPORTS.map((v) => v.width).join(", ")}px, plus the resize path (${report.resizePath.length} route/width pair(s))`);
  console.log(`  holes in the last row: ${report.failures.filter((f) => !f.includes("collapsed")).length}`);
  console.log(`  rows with an empty cell that are not the last row: ${report.notes.length}`);
  console.log(`  collapsed tracks: ${report.collapsed.length}`);
  for (const n of report.notes.slice(0, 10)) console.log("   note", n);
  for (const f of report.failures.slice(0, 30)) console.log("   FAIL", f);
  if (!report.passed) process.exitCode = 1;
}
