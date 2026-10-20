import { test, expect } from '@playwright/test';
import { longestHeadingLine } from '../scripts/visual-audit-rules.mjs';

// The twins strip. It used to be one row per twin: a 779px picture with the
// copy beside it, which the owner rejected as "very big on one side and a
// complete fuck-up on the other". It is now five across in one row, small,
// with the click carrying the detail.
//
// This test used to assert THAT layout, so it was rewritten with it. It now
// asserts the new one, and it includes a mutation control: the same
// measurement, run against a deliberately broken grid, must come back
// different — otherwise the assertion proves nothing.
const readStrip = () => {
  const grid = document.querySelector('.twins-grid');
  const gb = grid.getBoundingClientRect();
  const cells = [...document.querySelectorAll('.twin-row')];
  const tops = (sel) => cells.map((c) => Math.round(c.querySelector(sel).getBoundingClientRect().top));
  return {
    cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    cellTops: cells.map((c) => Math.round(c.getBoundingClientRect().top)),
    nameTops: tops('.twin-city'),
    metaTops: tops('.twin-meta'),
    descTops: tops('.twin-desc'),
    linkTops: tops('.twin-link-label'),
    widths: cells.map((c) => Math.round(c.getBoundingClientRect().width)),
    spill: Math.max(...cells.map((c) => Math.round(c.getBoundingClientRect().right - gb.right))),
  };
};

test('the twin directory is one row of five on a wide plate, and one column below the floor', async ({ page }) => {
  await page.goto('/#overview');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1280, 1440, 1512, 1856, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForTimeout(120);
    const strip = await page.evaluate(readStrip);
    expect(strip.cols).toBe(5);
    expect(new Set(strip.cellTops).size).toBe(1);
    // ONE baseline grid: the five names, the five captions and the five
    // links each start on a single line. "HO CHI MINH CITY" wraps to two
    // lines at the narrow end, so without a shared grid its caption and
    // link would sit lower than the other four.
    expect(new Set(strip.nameTops).size).toBe(1);
    expect(new Set(strip.metaTops).size).toBe(1);
    expect(new Set(strip.descTops).size).toBe(1);
    expect(new Set(strip.linkTops).size).toBe(1);
    expect(strip.spill).toBeLessThanOrEqual(1);
    // Small, but not shrunk to a ribbon: the city name still has to fit.
    expect(Math.min(...strip.widths)).toBeGreaterThanOrEqual(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }

  // Below the floor the strip is one column — five stacked directory rows.
  // Not three-across and two, which leaves a hole, and not two and one,
  // which leaves an orphan.
  await page.setViewportSize({ width: 1024, height: 950 });
  await page.waitForTimeout(120);
  const narrow = await page.evaluate(readStrip);
  expect(narrow.cols).toBe(1);
  expect(new Set(narrow.cellTops).size).toBe(5);
});

test('the shared-baseline assertion catches a broken grid (control)', async ({ page }) => {
  await page.goto('/#overview');
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 1440, height: 950 });
  // Detach the cells from the shared tracks: each cell then sizes its own
  // rows, and the cell whose city name wraps to two lines drops its caption
  // and link below the other four.
  await page.addStyleTag({ content: '.twin-row { grid-template-rows: auto auto auto auto auto !important; }' });
  await page.waitForTimeout(120);
  const broken = await page.evaluate(readStrip);
  expect(new Set(broken.linkTops).size).toBeGreaterThan(1);
});

test('heading audit measures the longest line and retains Thai combining marks as graphemes', async ({ page }) => {
  await page.goto('/#overview');
  await page.evaluate(`window.measureHeading = ${longestHeadingLine.toString()}`);
  const result = await page.evaluate(() => {
    const heading = document.createElement('h2');
    heading.style.cssText = 'font:16px monospace;white-space:pre';
    heading.textContent = 'A'.repeat(70)+'\nShort'; document.body.appendChild(heading);
    const longest = window.measureHeading(heading);
    heading.textContent = 'ก้'.repeat(10);
    const thai = window.measureHeading(heading); heading.remove();
    return {longest,thai};
  });
  expect(result.longest).toBe(70);
  expect(result.thai).toBe(10);
});

test('the 9th annual meeting record keeps its place in the index', async ({ page }) => {
  // The reader is on the Overview and opens the meeting record sheet. The
  // index must still say where they are: one row lit, and the number in the
  // plate's locator must be that row's number. It used to light nothing and
  // wear News's number, so the locator pointed at a different section.
  await page.goto('/#overview');
  await page.locator('a[href="#ascn9"]').first().click();
  await expect(page.locator('#locatorNum')).toHaveText('01');
  const lit = page.locator('#tab-nav a.active');
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAttribute('data-tab', 'overview');
  await expect(lit).toHaveAttribute('data-num', '01');
  await expect(page.locator('#locatorNum')).toHaveText(await lit.getAttribute('data-num'));
});

test('privacy boundaries translate without deleting the record panels or video links', async ({ page }) => {
  await page.goto('/#record');
  for (const [lang,script] of [['th',/[\u0e00-\u0e7f]/],['zh',/[\u4e00-\u9fff]/]]) {
    await page.locator(`[data-lang-set="${lang}"]`).click();
    await expect(page.locator('[data-i18n="audit.local-private"]')).toContainText(script);
    await expect(page.locator('[data-i18n="audit.public-reports"]')).toContainText(script);
    await expect(page.locator('[data-i18n="audit.public-only"]')).toContainText(script);
    await page.locator('#tab-nav [data-tab="innovation"]').click();
    await expect(page.locator('[data-i18n="audit.ground"]')).toContainText(script);
    await expect(page.locator('[data-i18n="audit.open-video"]')).toHaveAttribute('href','media/showcase/iaas-hero.mp4');
    await page.locator('#tab-nav [data-tab="record"]').click();
  }
});
