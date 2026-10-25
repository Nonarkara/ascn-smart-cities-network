// ─────────────────────────────────────────────────────────────────────────────
// Massacre Spatial Hallucination — the instrument.
//
// The owner's law (MSH) requires evidence before a pass may be declared, and
// it names five things to record for every tested viewport:
//
//   1. chrome cost     — top/bottom chrome height and its share of the
//                        viewport, including stacked fixed or sticky bands;
//   2. task visibility — whether the primary information and the action
//                        are visible together;
//   3. geometry        — unexplained gaps, orphan elements, inflated boxes,
//                        accidental wraps, overlap, clipping, horizontal
//                        scrolling;
//   4. hierarchy       — the intended first, second and third reading
//                        priorities, and whether the render shows them;
//   5. preservation    — maps, charts, video and usable targets still work.
//
// This script measures all five for every routable view at 390, 1024 and
// 1440 px, writes the screenshots and a JSON record, and prints the
// findings. It is a measuring instrument first and a gate second: a finding
// is a question, and each one has to be answered with a reason or a repair.
//
// The house's own tolerances, measured on this site:
//   ruled rows          1.06 – 1.26x their ink
//   unruled blocks      2.07 – 3.27x their ink
//   a section's content reaches at least 60% of the section's width
//
// Usage:
//   ASCN_TEST_URL=http://127.0.0.1:4187 node scripts/audit-sh.mjs
//   ASCN_SH_LABEL=after ASCN_SH_STRICT=1 node scripts/audit-sh.mjs
// ---------------------------------------------------------------------------

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const label = process.env.ASCN_SH_LABEL || 'audit';
const strict = process.env.ASCN_SH_STRICT === '1';
const outDir = process.env.ASCN_SH_OUT || `artifacts/sh/${label}`;

// The viewports the law names, plus the wide ones the owner's own screen
// uses. 390×844 and 1440×900 are the first-screen checks; 1024 uses 768
// because the plate is the only pane at that width and the fold is what
// decides whether a task is visible. The two wide widths are not
// optional: an independent review of this site found a 93.14px dead
// track in the innovation band that only opens above 1675px — a hole at
// exactly the width the owner photographs, and at 1440 the band was
// clean. An instrument that stops at 1440 cannot see it.
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2103, height: 1065 },
];

const VIEWS = [
  'overview', 'cities', 'record', 'archive', 'projects', 'innovation',
  'news', 'news/archive', 'news/discovery', 'news/regional', 'ascn9',
  'history', 'framework', 'partners', 'contacts', 'insights',
  'data', 'research', 'essay',
];

// Unruled blocks may run 3.27x their ink before the house calls it
// spatially expensive. A box beyond that is an offender unless it is
// carrying something the ink cannot show — a map, a video, a chart.
const INK_CEILING = 3.27;
// Every other top-level section on the site reaches at least 75% of its own
// width. The floor was 60%, and at 60% a section that stranded 25% of
// itself in empty plate passed as clean.
const STRANDED_FLOOR = 0.75;
// A track that stands more than this much wider than the item placed in it
// is a hole, not a margin. Below 1px it is rounding.
const TRACK_SLACK = 6;
// A rule under a row of prose may run at most this much longer than the
// text it divides. The house's own ruled rows keep the rule within
// 1.06-1.26x their ink; a hairline under 197-289px of text in a 567px
// column is an empty table cell, which reads as a failed attempt at a table
// rather than as a list.
const RULE_BAND = 1.26;

async function measure(page, inkCeiling, strandedFloor, trackSlack, ruleBand) {
  return page.evaluate(
    ({ inkCeiling, strandedFloor, trackSlack, ruleBand }) => {
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const r = (e) => {
        const b = e.getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
      };
      // The ink of an element: the union of its text client rects. A box's
      // own width is not its ink, and the difference is the whole question.
      const ink = (el) => {
        if (!el) return null;
        const rg = document.createRange();
        rg.selectNodeContents(el);
        const rs = [...rg.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
        if (!rs.length) return null;
        return {
          l: Math.min(...rs.map((x) => x.left)),
          r: Math.max(...rs.map((x) => x.right)),
          t: Math.min(...rs.map((x) => x.top)),
          b: Math.max(...rs.map((x) => x.bottom)),
        };
      };
      // Elements that carry their own pixels rather than text: a map, a
      // video, a chart, an image. Their box is their content.
      const isCanvas = (el) =>
        !!el.closest('canvas, svg, video, img, .leaflet-container, .chart, [data-chart]');
      const view = q('section.view:not([hidden])');
      const plate = q('#plate');
      const out = { vw: innerWidth, vh: innerHeight };
      const failures = [];
      // Which view is actually on screen. The instrument asks for a view
      // and then measures whatever is not hidden — if the router disagreed
      // with the request, the measurement would be of a different surface
      // and would still report as a pass. A PASS is only evidence if the
      // surface measured is the surface reached.
      out.measuredView = view ? view.id : null;

      // 1. chrome cost
      const bands = qa('.plate-bar, .locator').map((el) => ({ cls: el.className, h: r(el).h }));
      const rail = q('.index');
      const railVisible = rail && getComputedStyle(rail).display !== 'none';
      const railW = railVisible ? r(rail).w : 0;
      out.chrome = {
        topPx: +bands.reduce((s, b) => s + b.h, 0).toFixed(2),
        topPct: +(bands.reduce((s, b) => s + b.h, 0) / innerHeight * 100).toFixed(2),
        railPx: +railW.toFixed(2),
        railPctOfWidth: +(railW / innerWidth * 100).toFixed(2),
        bands: bands.map((b) => b.cls + ':' + b.h),
      };

      // 3. geometry failures
      out.docOverflow = document.documentElement.scrollWidth > innerWidth + 1;
      if (out.docOverflow) failures.push('document scrolls sideways');
      if (plate && plate.scrollWidth > plate.clientWidth + 1) failures.push('the plate scrolls sideways');
      // An element that leaves the viewport is only a failure if nothing is
      // holding it in. A map's tiles and a table inside a sideways scroller
      // are meant to travel; the container owns that.
      const escapes = [];
      for (const el of qa('main *')) {
        const b = r(el);
        if (b.w === 0 || b.h === 0) continue;
        if (b.r <= innerWidth + 1 && b.l >= -1) continue;
        let held = false;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'hidden' || ox === 'auto' || ox === 'scroll') { held = true; break; }
        }
        if (held) continue;
        escapes.push(
          el.tagName + '.' + String(el.className).slice(0, 40) +
            ' [' + Math.round(b.l) + '..' + Math.round(b.r) + ']',
        );
      }
      out.escapes = escapes.slice(0, 6);
      if (escapes.length) failures.push(escapes.length + ' element(s) escape the viewport');

      // Box-to-ink: an inflated box is space nobody asked for. It counts
      // only where the box is a layout claim — a grid or flex item that
      // was stretched to its track. A block in a prose flow is not making a
      // claim; it is simply as wide as the column allows.
      const inflated = [];
      const stranded = [];
      // ── F3: the scope was too narrow to see the bleed. ────────────────────
      // The old scope was the view and its direct children, so a panel one
      // level down — the innovation view's closing callout, a bordered and
      // filled 1546px frame holding 384.5px of words — was never judged,
      // and an independent review counted 160 framed blocks on the news
      // view alone that this instrument could not see.
      //
      // Two scopes, on purpose. The top-level scope judges a box that
      // IS the claim: the view's own sections, and the grid items
      // stretched across a track. That test was calibrated against the
      // house's own lists, where a step is a statement that takes the
      // column it is given, and widening it to every descendant flags
      // every ordinary card cell. The deep scope is for the two new
      // tests below, which look for a FRAME — a visible box around
      // content — and for a rule running past the text it divides.
      const topScope = view ? [view, ...view.querySelectorAll(':scope > *')] : [];
      const deepScope = view ? [view, ...view.querySelectorAll('*')] : [];

      // A DATA CELL is not a stretched box. A column width in a data table
      // is a data decision, and the house's own words say so: "table cells
      // (TH/TD) — a column width in a data table is a data decision, not a
      // stretched box." A matrix built from divs is the same thing, so a
      // cell in a grid of three or more columns counts as data too.
      const isDataCell = (el) => {
        if (el.closest('table')) return true;
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const d = getComputedStyle(p).display;
          if (d.includes('grid')) {
            const tracks = getComputedStyle(p).gridTemplateColumns.split(' ').filter((s) => s && s !== 'none').length;
            if (tracks >= 3) return true;
          }
        }
        return false;
      };
      // A DATA MARK is a box whose width IS the data: a bar's fill, a
      // segment of a stacked bar. Its own box is its content, the way a
      // canvas is its content.
      const isDataMark = (el) => {
        if (el.hasAttribute('style') && /width\s*:\s*[\d.]+%/.test(el.getAttribute('style'))) return true;
        return !!el.querySelector('[style*="width"]');
      };
      // A FRAME closes a box around its content: a fill, or a border on a
      // side that encloses. A lone rule above a heading is a section
      // divider; a rule under a table's row is that table's own rule. A
      // frame is a claim, and a claim is judged.
      const frameSides = (cs) => {
        const w = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(cs['border' + k + 'Width']) || 0);
        const names = ['Top', 'Right', 'Bottom', 'Left'].filter((k, i) => w[i] > 0);
        const fills = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
        if (fills) return 'fill';
        if (names.includes('Left') || names.includes('Right')) return 'side';
        if (names.includes('Top') && names.includes('Bottom')) return 'box';
        return null;
      };

      for (const el of topScope) {
        const b = r(el);
        if (b.w < 60) continue;
        const i = ink(el);
        if (!i) continue;
        const inkW = i.r - i.l;
        const pDisplay = el.parentElement ? getComputedStyle(el.parentElement).display : '';
        const isItem = /grid|flex/.test(pDisplay);
        if (inkW > 40 && !isCanvas(el) && isItem) {
          const ratio = b.w / inkW;
          if (ratio > inkCeiling) {
            inflated.push(
              el.tagName + '.' + String(el.className).slice(0, 40) + ' ' + Math.round(b.w) +
                'px box for ' + Math.round(inkW) + 'px of ink (' + ratio.toFixed(2) + 'x)',
            );
          }
        }
        const reach = (i.r - b.l) / b.w;
        if (el.tagName === 'SECTION' && reach < strandedFloor) {
          stranded.push(
            String(el.className).slice(0, 40) + ' content reaches ' +
              Math.round(reach * 100) + '% of the section',
          );
        }
      }

      out.inflated = inflated.slice(0, 8);
      out.stranded = stranded.slice(0, 8);
      if (inflated.length) failures.push(inflated.length + ' box(es) inflated past ' + inkCeiling + 'x their ink');
      if (stranded.length) failures.push(stranded.length + ' section(s) leave their content stranded');

      // The frame: a visible box around content that holds far less than it
      // claims. This is the class the old scope could not see.
      const frames = [];
      for (const el of deepScope) {
        if (el === view) continue;
        const b = r(el);
        if (b.w < 200) continue;
        if (isCanvas(el) || isDataCell(el) || isDataMark(el)) continue;
        const cs = getComputedStyle(el);
        const kind = frameSides(cs);
        if (!kind) continue;
        const i = ink(el);
        if (!i) continue;
        const inkW = i.r - i.l;
        if (inkW < 40) continue;
        const ratio = b.w / inkW;
        if (ratio > inkCeiling) {
          frames.push(
            el.tagName + '.' + String(el.className).slice(0, 40) + ' ' + Math.round(b.w) +
              'px ' + kind + ' for ' + Math.round(inkW) + 'px of ink (' + ratio.toFixed(2) + 'x)',
          );
        }
      }
      out.frames = frames.slice(0, 8);
      if (frames.length) failures.push(frames.length + ' frame(s) holding less than they claim');

      // The rule under prose: the house's own rejected pattern. A hairline
      // under 197-289px of text in a 567px column is an empty table cell —
      // the rule ran 279-371px past the sentence it headed, and read as a
      // failed attempt at a table rather than as a list. A rule under a
      // DATA row is that table's own rule, and a data decision.
      const proseRules = [];
      for (const el of deepScope) {
        if (el === view) continue;
        const b = r(el);
        if (b.w < 200) continue;
        if (isCanvas(el) || isDataCell(el) || isDataMark(el)) continue;
        const cs = getComputedStyle(el);
        const bottom = parseFloat(cs.borderBottomWidth) || 0;
        if (bottom <= 0) continue;
        const top = parseFloat(cs.borderTopWidth) || 0;
        const right = parseFloat(cs.borderRightWidth) || 0;
        const left = parseFloat(cs.borderLeftWidth) || 0;
        if (top || right || left) continue; // a box, not a rule under a row
        if (cs.display.includes('grid')) continue; // a matrix row is data
        const i = ink(el);
        if (!i) continue;
        const inkW = i.r - i.l;
        if (inkW < 40) continue;
        const ratio = b.w / inkW;
        if (ratio > ruleBand) {
          proseRules.push(
            el.tagName + '.' + String(el.className).slice(0, 40) + ' rule ' + Math.round(b.w) +
              'px under ' + Math.round(inkW) + 'px of text (' + ratio.toFixed(2) + 'x)',
          );
        }
      }
      out.proseRules = proseRules.slice(0, 8);
      if (proseRules.length) failures.push(proseRules.length + ' rule(s) running past the text they divide');

      // The closed band that opens inside itself. A band sized to its own
      // content (`width: fit-content`) has said: this is as wide as what I
      // hold. A child that then stretches past its own words has reopened
      // the band inside it.
      //
      // This is the class the instrument could not see. The path band's
      // kicker was a 334.97px box for 32.94px of ink — 10.17x — and none of
      // the four checks above could reach it: the stretched-item check only
      // fires on grid and flex items, the stranded check only on SECTIONs,
      // the frame check needs a border on two sides, and the prose-rule
      // check skips anything with a top border. A green light that does not
      // cover the element the round introduced is not a green light.
      const closedBands = [];
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of rules) {
          if (!rule.style || !rule.selectorText) continue;
          if (!/fit-content/.test(rule.style.getPropertyValue('width') || '')) continue;
          for (const el of document.querySelectorAll(rule.selectorText)) closedBands.push(el);
        }
      }
      const bandSlack = [];
      const TEXT_BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,figcaption,blockquote,dd,dt';
      for (const band of closedBands) {
        if (!band.isConnected) continue;
        const bb = r(band);
        if (bb.w < 60) continue;
        for (const el of [band, ...band.querySelectorAll(TEXT_BLOCK)]) {
          const b = r(el);
          if (b.w < 40) continue;
          if (isCanvas(el) || isDataCell(el) || isDataMark(el)) continue;
          const i = ink(el);
          if (!i) continue;
          const inkW = i.r - i.l;
          if (inkW < 20) continue;
          const ratio = b.w / inkW;
          if (ratio > inkCeiling) {
            bandSlack.push(
              el.tagName + '.' + String(el.className).slice(0, 40) + ' ' + Math.round(b.w) +
                'px inside a closed band for ' + Math.round(inkW) + 'px of ink (' + ratio.toFixed(2) + 'x)',
            );
          }
        }
      }
      out.bandSlack = bandSlack.slice(0, 8);
      if (bandSlack.length) failures.push(bandSlack.length + ' block(s) stretched inside a closed band');

      // The dead track: a grid track that is wider than the item standing
      // in it, with the item set to the track's END. The leftover sits
      // between two groups, so it reads as a hole in the middle of the
      // band rather than as the page's margin. A track with a stretch or
      // start-aligned item is not judged: its leftover is the item's own
      // margin, and a short heading in a wide column is not a hole.
      //
      // This is the test that was missing. An independent review found a
      // 93.14px dead track in the innovation band at 2103 — a track that
      // opened while the caption inside it was capped, so the grid made
      // room and nothing moved into it — while this instrument reported
      // zero findings, because it never looked inside a row whose own box
      // was full width.
      const deadTracks = [];
      const root = view || document.body;
      for (const c of root.querySelectorAll('*')) {
        const cs = getComputedStyle(c);
        if (!/grid/.test(cs.display)) continue;
        const rows = cs.gridTemplateRows.split(' ').filter((s) => s && s !== 'none');
        if (rows.length !== 1) continue;
        const tracks = cs.gridTemplateColumns.split(' ').map(parseFloat).filter((n) => !Number.isNaN(n));
        if (!tracks.length) continue;
        const items = [...c.children].filter((el) => {
          const b = el.getBoundingClientRect();
          return getComputedStyle(el).display !== 'none' && b.width > 0 && b.height > 0;
        });
        // One item per track, or the mapping is a guess and the instrument
        // says so rather than pretending to know.
        if (items.length !== tracks.length) continue;
        items.forEach((el, i) => {
          const start = getComputedStyle(el).gridColumnStart;
          const idx = /^\d+$/.test(start) ? parseInt(start, 10) - 1 : i;
          if (idx < 0 || idx >= tracks.length) return;
          const align = getComputedStyle(el).justifySelf;
          if (align !== 'end' && align !== 'right' && align !== 'flex-end') return;
          const b = el.getBoundingClientRect();
          const slack = tracks[idx] - b.width;
          if (slack > trackSlack) {
            deadTracks.push(
              String(c.className).slice(0, 34) + ' track ' + Math.round(tracks[idx]) +
                'px holds ' + Math.round(b.width) + 'px of ' +
                String(el.className).slice(0, 28) + ' — ' + Math.round(slack) + 'px empty',
            );
          }
        });
      }
      out.deadTracks = deadTracks.slice(0, 8);
      if (deadTracks.length) failures.push(deadTracks.length + ' grid track(s) left empty by their own item');

      // Law IX: no radius, anywhere. Zero tolerance — the house draws no
      // rounded corners and a single one is a defect, not a preference.
      // The law's own exemption is honoured: a true circle is a shape, not
      // a softened rectangle, so 50% and the 9999px pill are not corners.
      // The vendored map's own controls are not the site's drawing
      // either — Leaflet is pinned, checksummed and shipped as it is.
      const rounded = [];
      for (const el of root.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (el.closest('.leaflet-container')) continue;
        const br = getComputedStyle(el).borderRadius;
        if (!br || br === '0px') continue;
        if (br.includes('%')) continue;
        const px = br.split(' ').map(parseFloat).filter((n) => !Number.isNaN(n));
        if (!px.length) continue;
        if (Math.max(...px) >= 9999) continue;
        if (Math.max(...px) >= Math.min(b.width, b.height) / 2) continue;
        rounded.push(el.tagName + '.' + String(el.className).slice(0, 30) + ' ' + br);
      }
      out.rounded = rounded.slice(0, 6);
      if (rounded.length) failures.push(rounded.length + ' element(s) carry a rounded corner');

      // 2. task visibility
      const heading = view ? view.querySelector('h1, h2') : null;
      const hb = heading ? r(heading) : null;
      out.task = {
        heading: heading ? heading.textContent.trim().slice(0, 48) : null,
        headingTop: hb ? +hb.t.toFixed(1) : null,
        headingVisible: !!hb && hb.t < innerHeight,
        headingInFirstScreen: !!hb && hb.b <= innerHeight,
      };
      if (!out.task.headingVisible) failures.push('the section heading is below the fold');

      // 4. hierarchy
      const sizes = view
        ? [...view.querySelectorAll('h1,h2,h3,h4')].slice(0, 14).map((h) => ({
            tag: h.tagName,
            px: Math.round(parseFloat(getComputedStyle(h).fontSize)),
          }))
        : [];
      out.hierarchy = sizes;
      if (sizes.length) {
        const top = Math.max(...sizes.map((s) => s.px));
        const h1 = sizes.find((s) => s.tag === 'H1');
        if (h1 && h1.px < top) failures.push('the h1 is not the largest type on the page');
      }

      // 5. preservation
      const maps = qa('.leaflet-container').map((m) => {
        const tiles = [...m.querySelectorAll('.leaflet-tile')].filter((img) => {
          const t = img.getBoundingClientRect();
          return t.width > 0 && img.complete && img.naturalWidth > 0;
        });
        return { tiles: tiles.length, markers: m.querySelectorAll('.leaflet-interactive').length };
      });
      const videos = qa('video').map((v) => ({
        src: (v.currentSrc || v.src || '').split('/').pop(),
        w: Math.round(r(v).w),
      }));
      const charts = qa('svg').filter((s) => s.querySelectorAll('path,rect,line,circle').length > 2).length;
      out.preserved = { maps, videos, charts };

      return { ...out, failures };
    },
    { inkCeiling, strandedFloor, trackSlack, ruleBand: RULE_BAND },
  );
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
await mkdir(outDir, { recursive: true });
const report = [];
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    // Geometry is reviewed against the shipped snapshot. Live-feed success
    // and failure have separate browser flow tests.
    await page.route('**/api/{news,ascn-news}', (route) => route.fulfill({ status: 503, json: {} }));
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    for (const view of VIEWS) {
      const surface = view.split('/')[0];
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${base}/#${view}`, { waitUntil: 'domcontentloaded' });
      // The router unhides the requested section. A same-document navigation
      // (the URL differs only by its hash) can be swallowed while the
      // document is still loading, and the wait below then times out on a
      // section that is present but hidden — so reload once and wait again
      // rather than failing the whole run on a race.
      const shown = (v) => {
        const el = document.getElementById('view-' + v);
        return !!el && !el.hidden;
      };
      try {
        await page.waitForFunction(shown, surface, { timeout: 8000 });
      } catch {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(shown, surface, { timeout: 20000 });
      }
      await page.evaluate(() => document.fonts.ready);
      if (view === 'overview') await page.locator('#kpi-grid .kpi').first().waitFor({ state: 'attached' });
      if (surface === 'news') await page.locator(`#news-panel-${view.split('/')[1] || 'review'}`).waitFor();
      // Markers without a basemap are not a verified map. Wait for visible
      // tiles, just as the visual capture does; record a failure on outage.
      let mapFailure = null;
      if (['cities', 'contacts'].includes(view)) {
        const selector = view === 'cities' ? '#sea-map' : '#contacts-map';
        try {
          await page.waitForFunction((sel) => {
            const map = document.querySelector(sel);
            if (!map || map.querySelectorAll('.leaflet-interactive').length === 0) return false;
            const box = map.getBoundingClientRect();
            const tiles = [...map.querySelectorAll('.leaflet-tile')].filter((tile) => {
              const b = tile.getBoundingClientRect();
              return b.right > box.left && b.left < box.right && b.bottom > box.top && b.top < box.bottom;
            });
            return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth === 256);
          }, selector, { timeout: 20000 });
        } catch { mapFailure = `${selector}: geographic tiles or markers not ready`; }
      }
      await page.evaluate(() => {
        const p = document.querySelector('#plate');
        if (p) p.scrollTop = 0;
        scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.waitForTimeout(350);
      const m = await measure(page, INK_CEILING, STRANDED_FLOOR, TRACK_SLACK);
      m.view = view;
      m.width = vp.width;
      m.height = vp.height;
      m.errors = errors.slice();
      if (mapFailure) m.failures.push(mapFailure);
      if (errors.length) m.failures.push(errors.length + ' page error(s)');
      // The surface measured must be the surface requested. A measurement
      // of a different view is not a pass; it is a measurement of the wrong
      // thing, and the record must say so.
      if (m.measuredView !== `view-${surface}`) {
        m.failures.push(`measured ${m.measuredView || 'nothing'}, asked for view-${surface}`);
      }
      await page.screenshot({
        path: `${outDir}/${view.replaceAll('/', '-')}-${vp.width}.png`,
        animations: 'disabled',
      });
      report.push(m);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

await writeFile(`${outDir}/sh.json`, JSON.stringify(report, null, 2) + '\n');

// ── the report ──────────────────────────────────────────────────────────────
let total = 0;
console.log(`\nMSH audit — ${label} — ${report.length} view/width pairs\n`);
console.log(['view', 'w', 'chrome%', 'rail%', 'heading', 'findings'].join('\t'));
for (const m of report) {
  total += m.failures.length;
  console.log(
    [
      m.view,
      m.width,
      m.chrome.topPct,
      m.chrome.railPctOfWidth,
      m.task.headingInFirstScreen ? 'yes' : 'NO',
      m.failures.length ? m.failures.join(' | ') : 'clean',
    ].join('\t'),
  );
}
console.log(`\n${total} finding(s). Record: ${outDir}/sh.json\n`);
if (strict && total > 0) {
  throw new Error(`MSH audit found ${total} issue(s).`);
}
