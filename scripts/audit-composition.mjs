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
//   250px tall, and one of these holds:
//     (a) it is INTERIOR — content on both sides of it in the same rows, so
//         the page stops halfway across and then resumes; or
//     (b) a HEAVY RULE (2px or more) crosses it. A rule is a claim about the
//         width of the block beneath it. A 2px ink rule that spans the
//         content area and then has a quarter of the page empty beside it is
//         a broken promise; or
//     (c) a HAIRLINE crosses it and the content under that hairline does not
//         reach the far end of it. A hairline that divides a 1211px row and
//         leaves 625px of that row empty, on every one of twenty rows, is
//         the same broken promise one weight lighter. A CENTRED measure
//         inside its own frame is not a defect — the margins are the page's
//         margins — so the test is whether the content is centred in the
//         frame, not whether the frame is wider than the text.
//
//   A band that fails none of these is a margin: the view is a centred band
//   and the space beside it is the page's own margin. Those are listed in the
//   report with their size so they can be answered with a reason, not
//   silently ignored.
//
//   Two refinements keep the third class honest, and both were learned from
//   the independent review. A rule has to INTRODUCE the band — sit at its top
//   edge — because the next section's opening rule is not a promise about
//   the band above it. And a band framed by a hairline only fails when it
//   REPEATS down a list: the same empty column in every one of twenty
//   records is a frame keeping a promise it does not keep, while a single gap
//   in one block is reported, answered in the record, and not failed.
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
        // Only a HORIZONTAL rule is a claim about width. A blockquote's 2px
        // left rule marks the quote; it says nothing about how wide the page
        // is, and the air beside a pull quote is the page's margin.
        if (bw >= 1 && (side === 'Top' || side === 'Bottom')) {
          // The rule carries the box it belongs to: a band is framed by the
          // rule of the block it sits inside, not by some rule further up
          // the page.
          rules.push({ x1, x2, y1, y2, width: bw, cls, side,
            blockTop: r.top - viewRect.top + yBase, blockBottom: r.bottom - viewRect.top + yBase });
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
      // A rule crossing the band. A rule is a claim about the width of the
      // block beneath it: a hairline that divides two rows, or a 2px ink
      // rule that opens a section.
      // The rule that INTRODUCES the band: the nearest horizontal rule above
      // it, within reach, and spanning it. A rule that closes the band
      // belongs to the block below it — the next section's opening rule is
      // not a promise about the band above it. The opener can sit a little
      // above the band, because the block it opens has its own padding.
      const bandTop = cur.rowStart * Y_STEP;
      let opener = null;
      for (const rule of rules) {
        // The rule's own block must contain the band: that block is what the
        // rule introduces, and the rule is a claim about its width.
        if (rule.blockTop > bandTop + 4) continue;
        if (rule.blockBottom < bandTop) continue;
        if (rule.x2 <= x0 || rule.x1 >= x1) continue;
        if (!opener || rule.y2 > opener.y2) opener = rule;
      }
      const crossing = opener ? [opener] : [];
      // A heavy rule (2px or more) crossing the band is a broken promise
      // whatever the geometry: the rule claims the width, and a quarter of
      // the page is empty beside it.
      const heavy = !!opener && opener.width >= HEAVY_RULE;
      const heavyCrossed = heavy;
      // A hairline that divides a row whose content stops short on one side
      // is the same broken promise, one weight lighter: the rule runs the
      // whole width and the text under it never reaches the far end. A
      // centred measure inside its own frame is not a defect — the margins
      // are the page's margins — so the test is whether the content is
      // centred in the frame, not whether the frame is wider than the text.
      let framedShort = false;
      let framingRule = '';
      for (const rule of crossing) {
        if (rule.width >= HEAVY_RULE) continue;
        const r0 = Math.max(0, Math.floor((rule.x1 - left) / X_STEP));
        const r1 = Math.min(cols - 1, Math.floor((rule.x2 - left) / X_STEP));
        const ruleW = (r1 - r0) * X_STEP;
        if (ruleW < X_STEP * 20) continue;
        // Row by row: a row is one-sided when the content under the rule is
        // biased to one end of it and leaves a substantial gap at the other.
        // A row whose content spans the whole rule, or a centred measure
        // inside it, is not one-sided — the margins there are the page's.
        let oneSided = 0, rows = 0;
        for (let row = cur.rowStart; row <= cur.rowEnd; row++) {
          const base = row * cols;
          let lo = -1, hi = -1;
          for (let c = r0; c <= r1; c++) {
            if (!grid[base + c]) continue;
            if (lo < 0) lo = c;
            hi = c;
          }
          if (lo < 0) continue;
          rows++;
          const gapLeft = (lo - r0) * X_STEP;
          const gapRight = (r1 - hi) * X_STEP;
          // One-sided means UNBALANCED: the content sits against one end of
          // the rule and leaves the other end empty. A centred measure
          // leaves equal gaps either side, however wide those gaps are.
          const larger = Math.max(gapLeft, gapRight);
          const smaller = Math.min(gapLeft, gapRight);
          if (larger > ruleW * 0.2 && larger > smaller * 2) oneSided++;
        }
        if (rows >= 3 && oneSided >= rows * 0.6) { framedShort = true; framingRule = String(rule.cls || '').slice(0, 28) + '>' + rule.side; break; }
      }
      bands.push({
        x0: Math.round(x0), x1: Math.round(x1),
        widthPx: best.len * X_STEP,
        widthPct: Math.round((100 * best.len * X_STEP) / width),
        topPx: cur.rowStart * Y_STEP,
        heightPx: (cur.rowEnd - cur.rowStart + 1) * Y_STEP,
        interior, crossed: heavy || framedShort, framedShort, heavyCrossed, framingRule,
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
  // A band that repeats down a list — the same empty column in every one of
  // twenty records — is a different animal from a single gap in one block. A
  // one-off gap is reported and answered in the audit record; a repeating one
  // is the frame making a promise it does not keep, and it fails.
  const repeats = new Map();
  for (const band of bands) {
    if (!band.framedShort) continue;
    const key = Math.round(band.x0 / 16) + ':' + Math.round(band.x1 / 16);
    repeats.set(key, (repeats.get(key) || 0) + 1);
  }
  for (const band of bands) {
    const big = band.widthPct >= WIDTH_FRACTION * 100 && band.heightPx >= HEIGHT_FLOOR;
    if (!big) continue;
    const record = { ...band, contentWidth: Math.round(width), contentHeight: Math.round(height) };
    if (band.interior || band.crossed) {
      if (band.framedShort && !band.heavyCrossed) {
        const key = Math.round(band.x0 / 16) + ':' + Math.round(band.x1 / 16);
        if ((repeats.get(key) || 0) < 2) { margins.push(record); continue; }
      }
      failures.push(record);
    }
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
    const why = f.interior ? 'interior hole' : f.framedShort ? `a rule frames a row whose content stops short (${f.framingRule || 'unknown rule'})` : 'a heavy rule crosses it';
    console.log(`  ${f.route} @${f.viewport}: ${f.widthPx}px (${f.widthPct}%) x ${f.heightPx}px at x=${f.x0}..${f.x1} — ${why}`);
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
