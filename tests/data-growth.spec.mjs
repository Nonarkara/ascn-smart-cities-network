import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const engine = JSON.parse(await readFile(new URL('../data/ascn-v2-data.json', import.meta.url)));

// Test the next import, not only today's 121 searchable rows. This dataset
// exists only in the intercepted response and is never a publication asset.
test('growing project data stays readable, complete and exportable', async ({ page }, testInfo) => {
  const future = structuredClone(engine);
  const cycle = future.reports.at(-1);
  const sample = future.projects.find((p) => p.report_year === cycle.year);
  const longTitle = 'Public service delivery '.repeat(12) + 'X'.repeat(120);
  const additions = Array.from({ length: 220 }, (_, i) => ({ ...sample, number: 1000 + i, project: `${longTitle} ${i}` }));
  future.projects.push(...additions);
  cycle.total_projects += additions.length;
  cycle.status.ongoing += additions.length;
  await page.route('**/data/ascn-v2-data.json*', (route) => route.fulfill({ json: future }));
  await page.goto('/#projects');
  const expected = future.projects.filter((p) => p.report_year === cycle.year).length;
  await expect(page.locator('#project-table tr')).toHaveCount(expected);
  await expect(page.locator('#project-count')).toHaveText(`${expected} rows`);
  await page.locator('#search-filter').fill('X'.repeat(40));
  await expect(page.locator('#project-table tr')).toHaveCount(220);
  for (const width of [360, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    const geometry = await page.locator('.project-evidence-table').evaluate((table) => {
      const wrap = table.parentElement;
      const cells = [...table.querySelectorAll('tbody tr:last-child td')];
      const plate = document.querySelector('#plate');
      return {
        pageBleed: document.documentElement.scrollWidth > innerWidth + 1 || plate.scrollWidth > plate.clientWidth + 1,
        wrapInside: wrap.getBoundingClientRect().right <= innerWidth + 1,
        cellBleed: cells.some((cell) => cell.scrollWidth > cell.clientWidth + 1),
        titleWidth: cells[2].getBoundingClientRect().width,
      };
    });
    expect(geometry, `long incoming titles at ${width}px`).toMatchObject({ pageBleed: false, wrapInside: true, cellBleed: false });
    expect(geometry.titleWidth).toBeGreaterThan(300);
    if ([390, 1440].includes(width)) await page.locator('.project-evidence-table').locator('..').screenshot({ path: testInfo.outputPath(`incoming-projects-${width}.png`) });
  }
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-csv').click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain(additions.at(-1).project);
  expect(csv.trim().split(/\r?\n/)).toHaveLength(221);
});

test('project filters survive repeated language rebuilds without duplicate options or exports', async ({ page }) => {
  await page.goto('/#projects');
  const country = page.locator('#country-filter');
  await expect(country.locator('option')).toHaveCount(12);
  await country.selectOption('Thailand');
  for (const lang of ['th', 'zh', 'en', 'th', 'en']) {
    await page.locator(`[data-lang-set="${lang}"]`).click();
    await expect(country.locator('option')).toHaveCount(12);
    await expect(country).toHaveValue('Thailand');
    await expect(page.locator('#focus-filter option')).toHaveCount(7);
  }
  const downloads = [];
  page.on('download', (download) => downloads.push(download));
  await page.locator('#export-csv').click();
  await expect.poll(() => downloads.length).toBe(1);
  await page.waitForTimeout(300);
  expect(downloads).toHaveLength(1);
});

test('phone portfolio summary compares four values in two rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#projects');
  await expect(page.locator('#project-kpis .kpi')).toHaveCount(4);
  const geometry = await page.locator('#project-kpis').evaluate((grid) => ({
    height: grid.getBoundingClientRect().height,
    rows: new Set([...grid.children].map((el) => Math.round(el.getBoundingClientRect().top))).size,
  }));
  expect(geometry.rows).toBe(2);
  expect(geometry.height).toBeLessThan(170);
  await expect(page.locator('#focus-bars')).toBeInViewport();
});

test('a late official report enriches an opened record without closing it', async ({ page }) => {
  let release;
  const ready = new Promise((resolve) => { release = resolve; });
  await page.route('**/data/ascn-v2-data.json*', async (route) => {
    await ready;
    await route.fulfill({ json: engine });
  });
  await page.route('**/api/ascn-news', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/#news/archive?city=Makassar');
  const record = page.locator('#evidence-makassar-service-2025');
  await record.locator('summary').click();
  await expect(record.locator('details')).toHaveAttribute('open', '');
  await record.locator('summary').focus();
  release();
  await expect(page.locator('#review-baseline')).toContainText('18 completed');
  await expect(record.locator('details')).toHaveAttribute('open', '');
  await expect(record.locator('summary')).toBeFocused();
  await record.locator('a[href="#cities/makassar"]').click();
  await expect(page.locator('#city-detail h2')).toHaveText('Makassar');
});

test('short-height contents stay keyboard scrollable and reach every destination', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/#overview');
  const nav = page.locator('#tab-nav');
  await nav.focus();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-nav [data-tab="essay"]')).toBeInViewport();
  await page.locator('#tab-nav [data-tab="essay"]').click();
  await expect(page.locator('#view-essay')).toBeVisible();
  await page.locator('#tab-nav [data-tab="overview"]').click();
  await expect(page.locator('#view-overview')).toBeVisible();
});
