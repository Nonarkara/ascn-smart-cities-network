// ─────────────────────────────────────────────────────────────────────────────
// Content overflow — the instrument and the gate for the class of defect a
// translation creates.
//
// A fixed-width track holds text, and the width of text is a property of the
// language. When the site was translated, a Thai caption of 99.5px sat in an
// 81px column and pushed the document sideways; the English "no projection"
// ran eight pixels past the table's own edge; the country list under a
// language name ran 196px past its column and under the bar. None of these
// were visible in a source scan. All of them were visible the moment the
// page was measured.
//
// WHAT IS MEASURED, for every routable view, in every language, at every
// viewport the law names:
//
//   overflow  — content that does not fit the box that holds it: the
//               element's own content is wider than its box. This is the
//               measure that finds a label running past the column that
//               was sized for it.
//   clip      — SVG text that falls outside its own viewBox, which the
//               browser silently crops. SVG has no CSS box, so the box
//               measure cannot see it and it is measured separately.
//
// WHAT IS NOT MEASURED, and why:
//
//   - A subtree that is visually hidden is not on screen. The archive table
//     hides its header row on a phone and repeats each label on its own
//     cell; that hidden row is clipped to one pixel by design.
//   - A box whose overflow-x is not visible clips its own content on
//     purpose. The site truncates long country names with an ellipsis
//     rather than letting them run over their neighbours.
//   - An absolutely positioned child is measured against its containing
//     block, not against its parent, because it is placed there
//     deliberately.
//
// THE EXCEPTIONS, and why they are a baseline and not a number in this file:
//
//   One marker on the site deliberately straddles the edge of the box it
//   sits in. An exception that lives in the code is an exception that gets
//   edited when it becomes inconvenient, so the exceptions live in
//   scripts/overflow-baseline.json, each with the reason it is what it is.
//
//   The gate FAILS when an offender is not recorded, when a recorded
//   offender has GROWN, and when a recorded offender no longer happens —
//   an exception that outlives its cause is a licence that was never
//   withdrawn. It also FAILS when an exception has no reason: no reason
//   means the overflow was never explained.
//
// Usage:
//   ASCN_TEST_URL=http://127.0.0.1:4187 node scripts/audit-overflow.mjs
//   ASCN_OVERFLOW_LANG=en,th,zh   ASCN_OVERFLOW_WIDTHS=1440,1024,390
// ---------------------------------------------------------------------------

import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const base = process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const outDir = process.env.ASCN_OVERFLOW_OUT || 'artifacts/overflow';
const baselinePath = process.env.ASCN_OVERFLOW_BASELINE || 'scripts/overflow-baseline.json';
const LANGS = (process.env.ASCN_OVERFLOW_LANG || 'en,th,zh').split(',').filter(Boolean);
const WIDTHS = (process.env.ASCN_OVERFLOW_WIDTHS || '1440,1024,390').split(',').filter(Boolean)
  .map((w) => ({ width: Number(w), height: Number(w) === 390 ? 844 : 900, key: w }));

// A pixel of slack: sub-pixel layout rounding moves a measurement by a
// fraction, and a gate that fails on a fraction is a gate people learn to
// ignore.
const SLACK = 1;

// The fixture the gate measures against, so the sweep never depends on what
// a publisher happened to publish that morning.
const NEWS_FIXTURE = {
  checkedAt: '2026-11-22T09:00:00.000Z',
  mode: 'saved',
  articles: Array.from({ length: 10 }, (_, i) => ({
    title: `Regional urban development report number ${i + 1}`,
    url: `https://example.org/story/${i + 1}`,
    publisher: 'Regional wire',
    publishedAt: '2026-11-20T08:00:00.000Z',
    kind: 'Report', countries: ['Indonesia'], topics: ['Mobility'],
  })),
  sources: [{ id: 'fixture', status: 'ok' }],
};

// The measurement, separated from the judgement so it can be tested without
// running the whole sweep.
export async function measureOverflow(page) {
  return page.evaluate((slack) => {
    const plate = document.querySelector('#plate');
    if (!plate) return { offenders: [], clipped: [], cut: [], bleed: 0 };
    const offenders = [];
    const clipped = [];
    const cut = [];

    // A subtree that is visually hidden is not on screen.
    const isHidden = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.display === 'none' || cs.visibility === 'hidden') return true;
        const b = p.getBoundingClientRect();
        if (b.width <= 1 && b.height <= 1 && cs.overflow !== 'visible') return true;
        if (cs.clip && /rect\(\s*0/.test(cs.clip)) return true;
        if (cs.clipPath && cs.clipPath !== 'none' && b.width <= 1) return true;
      }
      return false;
    };

    for (const el of plate.querySelectorAll('*')) {
      // SVG has no CSS box: its text is measured against the viewBox below.
      if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      if (el.clientWidth <= 0 || el.clientHeight <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible') continue;
      if (isHidden(el)) continue;
      const over = el.scrollWidth - el.clientWidth;
      if (over <= slack) continue;
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 60),
        over,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      });
    }

    // Text cropped by a hidden overflow. The old sweep only looked at boxes
    // whose overflow was VISIBLE — that is, boxes that were spilling out. A
    // box that hides what does not fit is the other half of the same defect:
    // the words are still there, and the reader still cannot see them. The
    // independent review found five of these — a city name, a country name, a
    // focus area and a table head — all cut by `overflow: hidden`.
    for (const el of plate.querySelectorAll('*')) {
      if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      if (el.clientWidth <= 0 || el.clientHeight <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') continue;
      if (isHidden(el)) continue;
      // A map pans its tiles inside a clipped container: the crop belongs to
      // the map, not to the text. Leaflet's own markup is excluded, and only
      // it — the site's own boxes are still measured.
      if (el.closest('[class*="leaflet-"]')) continue;
      const overX = el.scrollWidth - el.clientWidth;
      const overY = el.scrollHeight - el.clientHeight;
      if (overX <= 1 && overY <= 1) continue;
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (!text) continue;
      cut.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 60),
        over: Math.max(overX, overY),
        overX,
        overY,
        text: text.slice(0, 60),
      });
    }

    for (const svg of plate.querySelectorAll('svg')) {
      const vb = svg.viewBox && svg.viewBox.baseVal;
      if (!vb || !vb.width) continue;
      for (const t of svg.querySelectorAll('text')) {
        let b;
        try { b = t.getBBox(); } catch { continue; }
        if (b.width <= 0) continue;
        if (b.x < vb.x - 0.5 || b.x + b.width > vb.x + vb.width + 0.5) {
          clipped.push({
            text: (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            over: Math.round(Math.max(vb.x - b.x, b.x + b.width - (vb.x + vb.width))),
          });
        }
      }
    }

    const main = document.querySelector('#main-content');
    return {
      offenders,
      clipped,
      cut,
      bleed: Math.max(plate.scrollWidth - plate.clientWidth, main ? main.scrollWidth - main.clientWidth : 0),
    };
  }, SLACK);
}

// The judgement, separated from the measurement so that it can be tested
// without running the whole sweep.
export function judge(measured, baseline) {
  const failures = [];
  const stale = [];
  const exceptions = baseline.exceptions || {};
  const seen = new Set();
  const maxOver = new Map();
  for (const row of measured) {
    for (const o of row.offenders) {
      const key = `${row.route}::${o.cls || o.tag}`;
      seen.add(key);
      maxOver.set(key, Math.max(maxOver.get(key) || 0, o.over));
    }
  }
  for (const [key, over] of maxOver) {
    const entry = exceptions[key];
    if (!entry) {
      failures.push(`${key}: content overflows its box by ${over}px and is not recorded in the baseline`);
      continue;
    }
    if (!entry.reason || !String(entry.reason).trim()) {
      failures.push(`${key}: recorded as an exception with no reason — no reason means the overflow was never explained`);
      continue;
    }
    if (over > entry.over + SLACK) {
      failures.push(`${key}: the recorded exception grew — ${over}px now, ${entry.over}px was recorded`);
    }
  }
  for (const row of measured) {
    for (const c of row.cut || []) {
      const key = `${row.route}::${c.cls || c.tag}`;
      const entry = exceptions[key];
      if (!entry) {
        failures.push(`${key}: text is cropped by its own box (${c.overX}px across, ${c.overY}px down) and is not recorded in the baseline`);
        continue;
      }
      if (!entry.reason || !String(entry.reason).trim()) {
        failures.push(`${key}: recorded as an exception with no reason — no reason means the crop was never explained`);
        continue;
      }
      if (c.over > entry.over + SLACK) {
        failures.push(`${key}: the recorded crop grew — ${c.over}px now, ${entry.over}px was recorded`);
      }
    }
  }
  for (const [key, entry] of Object.entries(exceptions)) {
    if (!seen.has(key)) stale.push(`${key}: no longer happens (was ${entry.over}px) — remove it from the baseline`);
  }
  // Text cropped by a hidden overflow: the same rule as a spill, and the
  // same baseline. An exception with no reason is a crop nobody explained.
  for (const row of measured) {
    for (const c of row.cut || []) {
      const key = `${row.route}::${c.cls || c.tag}`;
      seen.add(key);
      maxOver.set(key, Math.max(maxOver.get(key) || 0, c.over));
    }
  }
  const clipped = measured.filter((r) => r.clipped.length);
  for (const row of clipped) {
    for (const c of row.clipped) {
      failures.push(`${row.route} (${row.lang} @${row.width}px): SVG text "${c.text}" falls ${c.over}px outside its viewBox and is cropped`);
    }
  }
  const bleeds = measured.filter((r) => r.bleed > SLACK);
  for (const row of bleeds) {
    failures.push(`${row.route} (${row.lang} @${row.width}px): the view pushes the document ${row.bleed}px sideways`);
  }
  return { failures, stale };
}

async function openRoute(page, route) {
  await page.goto(`${base}/#${route}`, { waitUntil: 'domcontentloaded' });
  const surface = route.split('/')[0];
  await page.waitForFunction((v) => {
    const el = document.getElementById('view-' + v);
    return !!el && !el.hidden;
  }, surface, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const measured = [];
  const routes = [];
  for (const vp of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.route('**/api/news', (route) => route.fulfill({ status: 200, json: NEWS_FIXTURE }));
    await page.route('**/api/ascn-news', (route) => route.fulfill({ status: 200, json: NEWS_FIXTURE }));
    await openRoute(page, 'overview');
    if (!routes.length) {
      const nav = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#tab-nav [data-tab]')].map((a) => a.getAttribute('data-tab'));
        const views = [...document.querySelectorAll('section.view')].map((el) => (el.id || '').replace(/^view-/, '')).filter(Boolean);
        const subs = [...document.querySelectorAll('#view-news [data-news-view]')].map((a) => a.getAttribute('data-news-view')).filter(Boolean).map((p) => `news/${p}`);
        return [...new Set([...tabs, ...views, ...subs])].filter(Boolean);
      });
      if (!nav.length) throw new Error('Content overflow could not read the navigation');
      routes.push(...nav);
    }
    for (const route of routes) {
      for (const lang of LANGS) {
        await openRoute(page, route);
        await page.locator(`[data-lang-set="${lang}"]`).click();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(260);
        const m = await measureOverflow(page);
        measured.push({ route, lang, width: vp.key, ...m });
      }
    }
    await page.close();
  }
  await browser.close();

  let baseline = { exceptions: {} };
  try {
    baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const { failures, stale } = judge(measured, baseline);
  const report = { measuredAt: new Date().toISOString(), viewports: WIDTHS, langs: LANGS, routes, measured, failures, stale };
  await writeFile(`${outDir}/overflow.json`, JSON.stringify(report, null, 2) + '\n');

  const count = measured.reduce((n, r) => n + r.offenders.length, 0);
  const recorded = Object.keys(baseline.exceptions || {}).length;
  console.log(`Content overflow: ${measured.length} measurements across ${routes.length} views, ${LANGS.join('/')} at ${WIDTHS.map((w) => w.key).join('/')}.`);
  console.log(`${count} element(s) whose content does not fit its box, all of them recorded exceptions.`);

  if (stale.length) {
    console.error(`\n${stale.length} recorded exception(s) no longer happen:`);
    for (const line of stale) console.error('  ' + line);
  }
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const line of failures) console.error('  ' + line);
  }
  if (failures.length || stale.length) {
    console.error('\nContent-overflow gate failed.');
    process.exitCode = 1;
  } else {
    console.log(`\nEvery box holds its content. ${recorded} recorded exception(s), each with its reason.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
