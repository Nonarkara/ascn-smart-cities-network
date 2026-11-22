// ─────────────────────────────────────────────────────────────────────────────
// Composition bands — the instrument and the gate.
//
// The owner's law: a page is badly composed when a large part of the content
// area holds nothing while its neighbour keeps running. A band of air down
// the side of an essay is not a margin; it is a hole, and it makes a reader
// uninterested in the system rather than in the page.
//
// The measure, for every routable view at every viewport:
//
//   1. Take the content area — the view's own box.
//   2. Rasterise what the reader can actually see: every run of text (a
//      paragraph that mixes a bold phrase with plain text has two text nodes
//      and one element, and a leaf-only walk reports the plain half as
//      empty), every graphic, every painted background, and every border
//      edge as the 2px strip it actually is.
//   3. For each 8px row, find the stretches of columns nothing reaches.
//   4. A band is a stretch of columns that is empty in EVERY row of a run of
//      consecutive rows, in rows that hold content somewhere. A margin is
//      empty on both sides of the page; a hole is empty on one side and full
//      on the other.
//
// The earlier measure took the union of every column any leaf ever touched,
// so a band beside content in one section was invisible if some other section
// reached across it. It found the empty right edge of a page. It could not
// find the perspective's dead left band, which is the one the owner sent.
//
// WHAT FAILS, and what does not:
//
//   A band fails when it is at least 12% of the content width, at least
//   250px tall, and either
//     (a) it is INTERIOR — content on both sides of it in the same rows, so
//         the page stops halfway across and then resumes; or
//     (b) a HEAVY RULE (2px or more) crosses it. A rule is a claim about the
//         width of the block beneath it. A 2px ink rule that spans the
//         content area and then has a quarter of the page empty beside it is
//         a broken promise. A hairline divider is not a claim and is not
//         judged.
//
//   A band that fails neither test is a margin: the view is a centred band
//   and the space beside it is the page's own margin. Those are listed in the
//   report with their size so they can be answered with a reason, not
//   silently ignored.
//
// Usage:
//   ASCN_TEST_URL=http://127.0.0.1:4187 node scripts/audit-composition.mjs
// ---------------------------------------------------------------------------

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const base = process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const outDir = process.env.ASCN_COMPOSITION_OUT || 'artifacts/composition';
const strict = process.env.ASCN_COMPOSITION_STRICT === '1';

const VIEWS = [
  'overview', 'innovation', 'record', 'news', 'news/regional', 'news/archive',
  'news/discovery', 'history', 'cities', 'projects', 'framework', 'partners',
  'insights', 'research', 'essay', 'data', 'contacts',
];

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '2103', width: 2103, height: 1065 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];

// A band this wide is a hole; narrower than this it is a gutter.
const WIDTH_FRACTION = 0.12;
// A band this tall runs down the page; shorter than this it is a gap
// between two things, which is what a gutter is.
const HEIGHT_FLOOR = 250;
// A rule at least this thick is a claim about the block beneath it.
const HEAVY_RULE = 2;

const X_STEP = 4;
const Y_STEP = 8;

/**
 * Rasterise one view and find its bands.
 * @param {import('@playwright/test').Page} page
 * @param {string} surface  the view's id suffix, e.g. "news/regional" -> "news"
 */
export async function auditView(page, surface) {
  const measured = await page.evaluate(({ X_STEP, Y_STEP, HEAVY_RULE, surface }) => {
    const view = document.getElementById('view-' + surface);
    if (!view) return null;

    let scroller = view;
    {
      let el = view.parentElement;
      while (el) {
        const oy = getComputedStyle(el).overflowY;
        if (el.scrollHeight > el.clientHeight + 4 && (oy === 'auto' || oy === 'scroll')) { scroller = el; break; }
        el = el.parentElement;
      }
    }
    const selfScroll = scroller === view;
    const viewRect = view.getBoundingClientRect();
    const left = viewRect.left;
    const width = view.offsetWidth || viewRect.width;
    const height = selfScroll ? view.scrollHeight : view.offsetHeight;
    const yBase = selfScroll ? view.scrollTop : 0;

    const rects = [];
    const rules = [];
    const opaque = (c) => {
      if (!c || c === 'transparent' || c === 'none') return false;
      const m = /^rgba?\(([^)]+)\)$/.exec(c);
      if (!m) return true;
      const p = m[1].split(',').map((s) => s.trim());
      if (p.length < 4) return true;
      return parseFloat(p[3]) > 0.01;
    };
    const push = (r, tag, cls, text) => rects.push({
      x1: r.left, x2: r.right,
      y1: r.top - viewRect.top + yBase, y2: r.bottom - viewRect.top + yBase,
      tag, cls, text,
    });

    for (const el of view.querySelectorAll('*')) {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '';
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().slice(0, 60);

      if (tag === 'img' || tag === 'svg' || tag === 'canvas' || tag === 'video' || tag === 'hr') {
        push(r, tag, cls, text);
        continue;
      }
      if (opaque(st.backgroundColor)) { push(r, tag + '>bg', cls, text); continue; }
      // Only the borders themselves are paint — a 2px strip each, not the box.
      const edge = 2;
      const sides = [
        ['Top', r.left, r.right, r.top, r.top + edge],
        ['Bottom', r.left, r.right, r.bottom - edge, r.bottom],
        ['Left', r.left, r.left + edge, r.top, r.bottom],
        ['Right', r.right - edge, r.right, r.top, r.bottom],
      ];
      for (const [side, x1, x2, y1, y2] of sides) {
        const bc = st['border' + side + 'Color'];
        const bw = parseFloat(st['border' + side + 'Width']) || 0;
        if (bw < 0.5 || !opaque(bc)) continue;
        push({ left: x1, right: x2, top: y1, bottom: y2 }, tag + '>' + side, cls, text);
        if (bw >= HEAVY_RULE && side === 'Top') {
          rules.push({ x1, x2, y1, y2, width: bw });
        }
      }
    }

    // Every run of text, wherever it sits.
    const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      const host = n.parentElement;
      if (!host) continue;
      const st = getComputedStyle(host);
      if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) < 0.05) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const rect of rg.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        push(rect, host.tagName.toLowerCase(), String(host.className || ''), n.nodeValue.trim().slice(0, 50));
      }
    }
    return { left, width, height, rects, rules };
  }, { X_STEP, Y_STEP, HEAVY_RULE, surface });

  if (!measured) return null;
  const { left, width, height, rects, rules } = measured;

  const cols = Math.max(1, Math.floor(width / X_STEP));
  const rows = Math.max(1, Math.ceil(height / Y_STEP));
  const grid = new Uint8Array(cols * rows);
  for (const r of rects) {
    const a = Math.max(0, Math.floor((r.x1 - left) / X_STEP));
    const b = Math.min(cols - 1, Math.floor((r.x2 - left) / X_STEP));
    const r0 = Math.max(0, Math.floor(r.y1 / Y_STEP));
    const r1 = Math.min(rows - 1, Math.floor((r.y2 - 1) / Y_STEP));
    for (let row = r0; row <= r1; row++) {
      const base = row * cols;
      for (let c = a; c <= b; c++) grid[base + c] = 1;
    }
  }

  // Per row: the empty stretches, and whether the row has content at all.
  const rowEmpty = [];
  const rowHas = [];
  for (let row = 0; row < rows; row++) {
    const base = row * cols;
    let has = false;
    for (let c = 0; c < cols; c++) if (grid[base + c]) { has = true; break; }
    rowHas.push(has);
    const e = new Uint8Array(cols);
    if (has) for (let c = 0; c < cols; c++) e[c] = grid[base + c] ? 0 : 1;
    rowEmpty.push(e);
  }

  const bands = [];
  let cur = null;
  const close = () => {
    if (!cur) return;
    let best = null;
    let run = 0, start = 0;
    for (let c = 0; c <= cols; c++) {
      if (c < cols && cur.inter[c]) { if (run === 0) start = c; run++; }
      else { if (run > 0 && (!best || run > best.len)) best = { start, len: run }; run = 0; }
    }
    if (best && best.len * X_STEP >= 40 && cur.rowCount >= 3) {
      const x0 = left + best.start * X_STEP;
      const x1 = left + (best.start + best.len) * X_STEP;
      // Interior means content on BOTH sides of the band in the same rows:
      // the page stops halfway across and then resumes. Content on one side
      // only is an edge band, and the rule test below judges that.
      let contentLeft = false;
      let contentRight = false;
      for (let row = cur.rowStart; row <= cur.rowEnd; row++) {
        const base = row * cols;
        for (let c = 0; c < cols; c++) {
          if (!grid[base + c]) continue;
          if (c < best.start) contentLeft = true;
          if (c > best.start + best.len - 1) contentRight = true;
        }
        if (contentLeft && contentRight) break;
      }
      const interior = contentLeft && contentRight;
      // A heavy rule crossing the band makes the band a broken promise: the
      // rule claims a width the block beneath it does not deliver.
      const crossed = rules.some((rule) =>
        rule.y2 > cur.rowStart * Y_STEP && rule.y1 < (cur.rowEnd + 1) * Y_STEP &&
        rule.x1 < x1 && rule.x2 > x0 && (rule.x2 > x1 || rule.x1 < x0));
      bands.push({
        x0: Math.round(x0), x1: Math.round(x1),
        widthPx: best.len * X_STEP,
        widthPct: Math.round((100 * best.len * X_STEP) / width),
        topPx: cur.rowStart * Y_STEP,
        heightPx: (cur.rowEnd - cur.rowStart + 1) * Y_STEP,
        interior, crossed,
      });
    }
    cur = null;
  };

  for (let row = 0; row < rows; row++) {
    if (!rowHas[row]) { close(); continue; }
    if (!cur) { cur = { inter: rowEmpty[row].slice(), rowStart: row, rowEnd: row, rowCount: 1 }; continue; }
    for (let c = 0; c < cols; c++) {
      if (cur.inter[c] && rowEmpty[row][c]) continue;
      cur.inter[c] = 0;
    }
    let nonEmpty = false;
    for (let c = 0; c < cols; c++) if (cur.inter[c]) { nonEmpty = true; break; }
    if (!nonEmpty) {
      close();
      cur = { inter: rowEmpty[row].slice(), rowStart: row, rowEnd: row, rowCount: 1 };
    } else {
      cur.rowEnd = row;
      cur.rowCount++;
    }
  }
  close();

  const failures = [];
  const margins = [];
  for (const band of bands) {
    const big = band.widthPct >= WIDTH_FRACTION * 100 && band.heightPx >= HEIGHT_FLOOR;
    if (!big) continue;
    const record = { ...band, contentWidth: Math.round(width), contentHeight: Math.round(height) };
    if (band.interior || band.crossed) failures.push(record);
    else margins.push(record);
  }
  failures.sort((a, b) => b.widthPx * b.heightPx - a.widthPx * a.heightPx);
  margins.sort((a, b) => b.widthPx * b.heightPx - a.widthPx * a.heightPx);
  return { contentWidth: Math.round(width), contentHeight: Math.round(height), failures, margins };
}

async function show(page, surface) {
  return page.waitForFunction((v) => {
    const el = document.getElementById('view-' + v);
    return !!el && !el.hidden;
  }, surface, { timeout: 20000 });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const report = { base, startedAt: new Date().toISOString(), viewports: VIEWPORTS.map((v) => v.name), views: [], failures: [], margins: [] };

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    for (const route of VIEWS) {
      const surface = route.split('/')[0];
      await page.goto(`${base}/#${route}`, { waitUntil: 'domcontentloaded' });
      try { await show(page, surface); }
      catch {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await show(page, surface);
      }
      await page.waitForTimeout(700);
      const result = await auditView(page, surface);
      if (!result) continue;
      const entry = { route, viewport: vp.name, ...result };
      report.views.push(entry);
      for (const f of result.failures) report.failures.push({ route, viewport: vp.name, ...f });
      for (const m of result.margins) report.margins.push({ route, viewport: vp.name, ...m });
    }
    await page.close();
  }
  await browser.close();

  report.finishedAt = new Date().toISOString();
  await writeFile(`${outDir}/composition.json`, JSON.stringify(report, null, 2) + '\n');

  console.log('\nComposition bands — failures');
  if (!report.failures.length) console.log('  none');
  for (const f of report.failures) {
    console.log(`  ${f.route} @${f.viewport}: ${f.widthPx}px (${f.widthPct}%) x ${f.heightPx}px at x=${f.x0}..${f.x1} — ${f.interior ? 'interior hole' : 'a heavy rule crosses it'}`);
  }
  console.log('\nComposition bands — margins (answered, not failed)');
  if (!report.margins.length) console.log('  none');
  for (const m of report.margins) {
    console.log(`  ${m.route} @${m.viewport}: ${m.widthPx}px (${m.widthPct}%) x ${m.heightPx}px at x=${m.x0}..${m.x1}`);
  }
  console.log(`\n${report.failures.length} failure(s), ${report.margins.length} margin(s).`);

  if (report.failures.length) {
    console.error(`\nComposition gate failed: ${report.failures.length} band(s) of empty content area beside content.`);
    process.exitCode = 1;
  } else if (strict && report.margins.length) {
    console.error('\nComposition gate failed (strict): a margin was found where none was expected.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
