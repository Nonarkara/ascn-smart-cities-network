// ─────────────────────────────────────────────────────────────────────────────
// Page cost — the instrument and the gate.
//
// The owner's standing law: "Measure page cost in SCREENS; cap it, only lower
// it." Nothing in the repository measured it. The composition gate measures
// empty bands beside content; the spatial gate measures box-to-ink, frames,
// dead tracks and chrome at the top. Between them a view can still be badly
// composed in a way none of them can see: a view that costs eight screens
// to say something that fits in two.
//
// WHAT IS MEASURED, for every routable view, at the two widths the law
// names for the phone and the desk:
//
//   cost      — the height of the view's scroll, in screens. On the wide
//               layout the plate is the scroller; on the phone the document
//               is. The cost is the number of screens a reader has to
//               scroll through, which is the number the law names.
//   chrome    — the height of the fixed and sticky bands the reader has to
//               scroll past, and the gap between the chrome and the first
//               heading of the view.
//   headroom  — how much of the first screen is spent before the first
//               heading of the view appears.
//
// THE CAP, and why it is a baseline and not a number in this file:
//
//   A cap that lives in the code is a cap that gets edited when it becomes
//   inconvenient. So the ceilings live in scripts/cost-baseline.json, one
//   per view per width, each with the reason it is what it is. The gate
//   FAILS when a view costs more than its ceiling — a view got longer — and
//   it also FAILS when a view costs less than its ceiling by more than the
//   slack: an improvement that was not banked. That is what "only lower it"
//   means in practice. The ceiling is a promise about the site's future, and
//   a fix that makes a view cheaper has to lower the promise.
//
//   A view with no ceiling is uncapped, and an uncapped view is a failure:
//   the law says cap it, so a new view cannot ship until it has a cap.
//
// WHAT IS NOT MEASURED HERE, and why that is deliberate:
//
//   The cost of a view is not the same as the emptiness of a view. A view
//   that costs twenty screens of dense prose is a long read; a view that
//   costs three screens of mostly air is a defect. This instrument counts
//   screens. It does not judge whether those screens are worth the scroll —
//   the composition gate and the spatial gate judge that, by looking for
//   holes beside content, inflated boxes and dead tracks. The two together
//   answer the owner's question: is the scroll earning the reader's
//   interest.
//
// Usage:
//   ASCN_TEST_URL=http://127.0.0.1:4187 node scripts/audit-cost.mjs
//   ASCN_COST_WRITE=1 node scripts/audit-cost.mjs   (record a new baseline)
// ---------------------------------------------------------------------------

import { chromium } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const base = process.env.ASCN_TEST_URL || 'http://127.0.0.1:4187';
const outDir = process.env.ASCN_COST_OUT || 'artifacts/cost';
const baselinePath = process.env.ASCN_COST_BASELINE || 'scripts/cost-baseline.json';
const writeBaseline = process.env.ASCN_COST_WRITE === '1';
// The mode is part of the cost. Thai has no word spaces and Chinese sets a
// character per em, so the same sentences break into different lines and the
// reader scrolls a different distance. A cap that only ever holds in English
// is a cap about English.
const theme = process.env.ASCN_COST_THEME || 'dark';
// The languages the site ships. The cap belongs to the view, not to one
// script of it: Thai has no word spaces and Chinese sets a character per em,
// so the same sentences break into different lines and the reader scrolls a
// different distance. The cap has to hold in the worst of them.
const LANGS = (process.env.ASCN_COST_LANGS || 'en,th,zh').split(',').filter(Boolean);
const modeTag = theme === 'dark' ? '' : `-${theme}`;
const outFile = `${outDir}/cost${modeTag}.json`;

// The two widths the law names: the desk and the phone. The measure is in
// screens, so the height of the viewport is part of the definition — the
// desk is 900 tall because that is the owner's own screen, and the phone is
// 844 because that is the phone the law is written for.
const VIEWPORTS = [
  { width: 1440, height: 900, key: '1440' },
  { width: 390, height: 844, key: '390' },
];

// A screen's worth of slack. The measurement moves by a few pixels as fonts
// settle and images load; without slack the gate would fail on noise, and a
// gate that fails on noise is a gate people learn to ignore.
const SLACK = 0.25;

// The fixture the gate measures against. The news views fetch their
// headlines, so their length would otherwise depend on how many articles
// the publisher had that morning — a gate that measures a moving target is
// a gate that cannot fail. The fixture is fixed and the same on every run.
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

export async function measureCost(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const view = q('section.view:not([hidden])');
    const plate = q('#plate');
    // The wide layout scrolls the plate; the phone scrolls the document.
    const scroller = plate && plate.scrollHeight > plate.clientHeight + 4 ? plate : null;
    const scrollH = scroller ? scroller.scrollHeight : document.documentElement.scrollHeight;
    const clientH = scroller ? scroller.clientHeight : innerHeight;
    // Chrome: the bands a reader scrolls past, or that stay pinned.
    const chrome = [];
    for (const el of qa('.plate-bar, .locator, .topbar, header, footer, [role="banner"]')) {
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (b.height <= 0 || b.width <= 0) continue;
      if (cs.position === 'fixed' || cs.position === 'sticky' || /plate-bar/.test(String(el.className))) {
        chrome.push({ cls: String(el.className).slice(0, 24), pos: cs.position, h: Math.round(b.height), top: Math.round(b.top) });
      }
    }
    // The chrome's share of the first screen: the pinned bands stacked at
    // the top of the viewport.
    const topBands = chrome.filter((c) => c.top < 140).sort((a, b) => a.top - b.top);
    let chromeTop = 0, cursor = -Infinity;
    for (const band of topBands) { if (band.top > cursor) { chromeTop += band.h; cursor = band.top + band.h; } }
    // The first heading of the view: how far down the first screen the
    // reader has to go before the view says anything.
    const first = view ? view.querySelector('h1, h2, .lede, .label') : null;
    const fb = first ? first.getBoundingClientRect() : null;
    return {
      view: view ? view.id : null,
      screens: +(scrollH / clientH).toFixed(2),
      scrollH, clientH,
      chromeTop,
      chromeShare: +(chromeTop / clientH).toFixed(3),
      firstTop: fb ? Math.round(fb.top) : null,
    };
  });
}

// The route list is taken from the document, never written from memory: a
// route name that is not real falls back to the Overview and silently sweeps
// the wrong view. Three sources, all read from the page: the navigation's
// own tabs, every view element the document ships (the Annual-meeting sheet
// is linked from two views but is not in the nav), and the news view's
// sub-panels, which are addressable as #news/<panel> while the nav carries
// only "News".
export async function navRoutes(page) {
  return page.evaluate(() => {
    const nav = [...document.querySelectorAll('#tab-nav [data-tab]')].map((a) => a.getAttribute('data-tab'));
    const views = [...document.querySelectorAll('section.view')].map((el) => (el.id || '').replace(/^view-/, '')).filter(Boolean);
    const subs = [...document.querySelectorAll('#view-news [data-news-view]')]
      .map((a) => a.getAttribute('data-news-view'))
      .filter(Boolean).map((p) => `news/${p}`);
    return [...new Set([...nav, ...views, ...subs])].filter(Boolean);
  });
}

async function openRoute(page, route) {
  await page.goto(`${base}/#${route}`, { waitUntil: 'domcontentloaded' });
  const surface = route.split('/')[0];
  try {
    await page.waitForFunction((v) => {
      const el = document.getElementById('view-' + v);
      return !!el && !el.hidden;
    }, surface, { timeout: 20000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction((v) => {
      const el = document.getElementById('view-' + v);
      return !!el && !el.hidden;
    }, surface, { timeout: 25000 });
  }
  await page.evaluate(() => document.fonts.ready);
  // THE PAGE IS SETTLED, NOT MEASURED AS IT ARRIVES.
  //
  // A view's cost is the height of the page the reader scrolls. An image
  // that has not arrived yet has no height, so the cost of a page that is
  // still loading is not the cost of the page: the essay measured 25.96
  // screens before its two photographs arrived and 26.61 after, in the same
  // build, decided by a timer. A cap banked from a half-loaded page is a
  // cap for a page nobody sees.
  //
  // So the images are asked for, and waited for, before the page is
  // measured. A reader who scrolls to the end of the view has seen them all.
  await settleImages(page);
  await page.waitForTimeout(400);
}

// Every image in the visible view is made eager and waited for. Lazy images
// below the fold are part of the page the reader scrolls through, so they
// are part of its height.
export async function settleImages(page) {
  await page.evaluate(() => {
    const view = [...document.querySelectorAll('.view')].find((el) => !el.hidden);
    if (!view) return;
    for (const img of view.querySelectorAll('img')) {
      img.loading = 'eager';
      if (img.complete) continue;
      // A lazy image that has not begun is asked for again.
      const src = img.currentSrc || img.src;
      if (src) { img.src = src; }
    }
  });
  await page.waitForFunction(() => {
    const view = [...document.querySelectorAll('.view')].find((el) => !el.hidden);
    if (!view) return true;
    return [...view.querySelectorAll('img')].every((img) => img.complete);
  }, null, { timeout: 15000 }).catch(() => { /* the check below reports it */ });
}

// An image that reserves no space until it loads: the view's height is then
// decided by a timer, and the cost measured for it is not repeatable.
export function judgeUnstableImages(rows) {
  const failures = [];
  const seen = new Set();
  for (const r of rows) {
    for (const img of r.images || []) {
      if (img.reserved || !img.inFlow) continue;
      const key = `${r.view}|${img.sel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      failures.push(`${r.view} (${r.lang} @${r.width}px): ${img.sel} reserves no space until it loads — the view's cost depends on when it is measured`);
    }
  }
  return failures;
}

// The images in the visible view, and whether each reserves its space.
//
// Only an image IN THE FLOW can change the height of the page. A map tile
// is absolutely positioned inside a box of fixed size: it arrives or it does
// not, and the page is the same height either way.
//
// And an image inside a box that has its own height — an aspect-ratio box,
// or a figure with a height in the stylesheet — does not change the page's
// height either, because the box holds the space whether the image is in it
// or not. So the question is whether some ANCESTOR holds the space.
export async function reservedImages(page) {
  return page.evaluate(() => {
    const view = [...document.querySelectorAll('.view')].find((el) => !el.hidden);
    if (!view) return [];
    const definite = (el) => {
      const cs = getComputedStyle(el);
      if (cs.aspectRatio && cs.aspectRatio !== 'auto') return true;
      if (cs.height && cs.height !== 'auto' && !/%$/.test(cs.height) && parseFloat(cs.height) > 0) return true;
      return false;
    };
    return [...view.querySelectorAll('img')].map((img) => {
      const cs = getComputedStyle(img);
      const inFlow = cs.position !== 'absolute' && cs.position !== 'fixed';
      // The image's own box, or some ancestor's, holds the space.
      let held = !!(img.getAttribute('width') && img.getAttribute('height'));
      if (!held) {
        held = definite(img);
        for (let p = img.parentElement; p && p !== view && !held; p = p.parentElement) held = definite(p);
      }
      return {
        sel: img.tagName.toLowerCase() + (img.className ? '.' + String(img.className).trim().split(/\s+/).join('.') : ''),
        inFlow,
        reserved: held,
      };
    });
  });
}

// The judgement, separated from the measurement so that it can be tested
// without running the whole sweep: a view is over its cap, under its cap
// (an improvement that has to be banked), or uncapped.
export function judge(measured, baseline, slack = SLACK) {
  const failures = [];
  const improvements = [];
  const uncapped = [];
  for (const [key, m] of Object.entries(measured)) {
    const entry = baseline.views?.[key];
    if (!entry) { uncapped.push(key); continue; }
    if (m.screens > entry.ceiling + slack) {
      failures.push(`${key}: ${m.screens} screens, over its cap of ${entry.ceiling} (${entry.reason || 'no reason recorded'})`);
    } else if (m.screens < entry.ceiling - slack) {
      improvements.push(`${key}: ${m.screens} screens, under its cap of ${entry.ceiling} — bank the new cap`);
    }
  }
  return { failures, improvements, uncapped };
}

// THE RESIZE PATH.
//
// Every measurement above loads the page fresh at the width it measures. So
// the whole sweep has only ever looked at pages that were BUILT at the width
// they are read at — and a reader who drags a window gets a different page.
// The library is the proof: narrowed from the desk to the phone, a grid's
// own span forced an implicit track, thirty-one of the sixty-two entries
// collapsed to zero width, and the view cost 35.96 screens against a cap of
// 23.38. No gate could see it, because no gate had ever narrowed a page.
//
// So the cap is also checked on the page that was built at the desk width
// and then narrowed. The fresh measurement sets the cap; the resized one
// must not exceed it.
export function judgeResized(resized, baseline, slack = SLACK) {
  const failures = [];
  for (const [key, m] of Object.entries(resized)) {
    const entry = baseline.views?.[key];
    if (!entry) continue; // an uncapped view is the main sweep's business
    if (m.screens > entry.ceiling + slack) {
      failures.push(`${key}: ${m.screens} screens after the window was narrowed, over its cap of ${entry.ceiling} (${entry.reason || 'no reason recorded'})`);
    }
  }
  return { failures };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const measured = {};
  const routes = [];
  const unstableImages = [];
  for (const vp of VIEWPORTS) {
    for (const l of LANGS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      // The mode is set the way a reader sets it: the choice is remembered in
      // the browser, so the page opens in that language and that theme. One
      // page per language — an init script is added per page, so adding
      // three to one page would leave the last one winning.
      await page.addInitScript(({ lang: ll, theme: t }) => {
        try { if (ll) localStorage.setItem('ascn-lang', ll); } catch {}
        try { if (t && t !== 'dark') localStorage.setItem('ascn_theme', t); } catch {}
      }, { lang: l, theme });
      await page.route('**/api/news', (route) => route.fulfill({ status: 200, json: NEWS_FIXTURE }));
      await page.route('**/api/ascn-news', (route) => route.fulfill({ status: 200, json: NEWS_FIXTURE }));
      await openRoute(page, 'overview');
      const nav = await navRoutes(page);
      if (!nav.length) throw new Error('Page cost could not read the navigation');
      if (!routes.length) routes.push(...nav);
      for (const route of nav) {
        await openRoute(page, route);
        const m = await measureCost(page);
        const key = `${route}@${vp.key}`;
        const row = measured[key] || (measured[key] = { route, width: vp.key, screens: 0, byLang: {} });
        row.byLang[l] = { screens: m.screens, chromeTop: m.chromeTop, firstTop: m.firstTop };
        // The cap belongs to the view, not to one script of it. Thai has no
        // word spaces and Chinese sets a character per em, so the same
        // sentences break into different lines and the reader scrolls a
        // different distance; the worst case of the three is what the cap
        // has to hold.
        row.screens = Math.max(row.screens, m.screens);
        if (l === LANGS[0]) Object.assign(row, m);
        unstableImages.push({ view: route, lang: l, width: vp.key, images: await reservedImages(page) });
      }
      await page.close();
    }
  }

  // THE RESIZE PATH. The page is built at the desk width and then narrowed
  // to the phone — the page a reader gets when they drag a window — and the
  // cost is measured again. The cap has to hold there too.
  const resized = {};
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(({ lang: ll, theme: t }) => {
      try { if (ll) localStorage.setItem('ascn-lang', ll); } catch {}
      try { if (t && t !== 'dark') localStorage.setItem('ascn_theme', t); } catch {}
    }, { lang: LANGS[0], theme });
    await page.route('**/api/news', (route) => route.fulfill({ status: 200, json: NEWS_FIXTURE }));
    await page.route('**/api/ascn-news', (route) => route.fulfill({ status: 200, json: NEWS_FIXTURE }));
    await openRoute(page, 'overview');
    const nav = await navRoutes(page);
    for (const route of nav) {
      // The window is put back to the desk width before the view is built,
      // so each view is measured as a page that was BUILT at the desk and
      // then narrowed — the path that broke.
      await page.setViewportSize({ width: 1440, height: 900 });
      await openRoute(page, route);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(700);
      const m = await measureCost(page);
      const key = `${route}@390`;
      const row = resized[key] || (resized[key] = { route, width: '390', screens: 0, path: 'built at 1440, narrowed to 390' });
      row.screens = Math.max(row.screens, m.screens);
    }
    await page.close();
  }
  await browser.close();

  let baseline = { views: {} };
  try {
    baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const { failures, improvements, uncapped } = judge(measured, baseline);
  const resizedVerdict = judgeResized(resized, baseline);
  failures.push(...resizedVerdict.failures);
  const unstable = judgeUnstableImages(unstableImages);
  failures.push(...unstable);
  const rows = Object.entries(measured).map(([key, m]) => ({ key, ...m }));

  const report = { measuredAt: new Date().toISOString(), viewports: VIEWPORTS, langs: LANGS, theme, routes, rows, failures, improvements, uncapped, resized, unstableImages };
  await writeFile(outFile, JSON.stringify(report, null, 2) + '\n');

  console.log('Page cost, in screens');
  console.log('view'.padEnd(22) + 'width'.padEnd(8) + 'screens'.padEnd(10) + 'cap'.padEnd(9) + 'chrome');
  for (const row of rows.sort((a, b) => b.screens - a.screens)) {
    const entry = baseline.views?.[row.key];
    console.log(`${row.key.padEnd(22)}${String(row.width).padEnd(8)}${String(row.screens).padEnd(10)}${String(entry ? entry.ceiling : '—').padEnd(9)}${row.chromeTop}px top`);
  }
  console.log('\nThe same views after the window was narrowed from the desk to the phone:');
  for (const row of Object.values(resized).sort((a, b) => b.screens - a.screens)) {
    const key = `${row.route}@390`;
    const entry = baseline.views?.[key];
    const over = entry && row.screens > entry.ceiling + SLACK;
    console.log(`${key.padEnd(22)}${String(row.width).padEnd(8)}${String(row.screens).padEnd(10)}${String(entry ? entry.ceiling : '—').padEnd(9)}${over ? 'OVER' : ''}`);
  }

  if (uncapped.length) {
    console.error(`\n${uncapped.length} view(s) with no cap: ${uncapped.join(', ')}`);
    console.error('The law says cap it. Record a ceiling and a reason for each in ' + baselinePath + '.');
  }
  if (improvements.length) {
    console.error(`\n${improvements.length} view(s) cheaper than their cap — the cap must be lowered:`);
    for (const line of improvements) console.error('  ' + line);
  }
  if (failures.length) {
    console.error(`\n${failures.length} view(s) over their cap:`);
    for (const line of failures) console.error('  ' + line);
  }

  if (writeBaseline) {
    const views = {};
    for (const [key, m] of Object.entries(measured)) {
      const prior = baseline.views?.[key];
      views[key] = {
        ceiling: m.screens,
        measured: m.screens,
        reason: prior?.reason || (prior ? 'unchanged' : 'recorded on first measurement'),
      };
    }
    await writeFile(baselinePath, JSON.stringify({ note: 'Ceilings on the cost of each view, in screens. Only ever lower them; a raise needs a reason written here.', updatedAt: new Date().toISOString(), views }, null, 2) + '\n');
    console.log(`\nBaseline written to ${baselinePath} (${Object.keys(views).length} caps).`);
    return;
  }

  if (failures.length || uncapped.length || improvements.length) {
    console.error('\nPage-cost gate failed.');
    process.exitCode = 1;
  } else {
    console.log(`\nEvery view is within its cap. ${rows.length} measurements.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
