import { test, expect } from '@playwright/test';

const privatePaths = [
  '/data/ascn-correspondence.json', '/data/ascn-email-evidence.json',
  '/lib/ascn-record.mjs', '/lib/ascn-funding.mjs', '/lib/ascn-scrape.mjs',
  '/media/showcase/metadata.json', '/media/ascn9/ASCN_2026-07-20_IMG_air-dash.png',
];

test('private data and build-time editorial modules are unavailable', async ({ request }) => {
  for (const path of privatePaths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['content-type']).toContain('text/plain');
    expect(await response.text()).toBe('Not found');
  }
});

test('public record uses published sources and never requests correspondence', async ({ page, request }) => {
  const requested = [];
  page.on('request', (req) => { if (/correspondence|email-evidence/.test(req.url())) requested.push(req.url()); });
  await page.goto('/#record');
  await expect(page.locator('#corr-summary')).toContainText('Private correspondence');
  await expect(page.locator('#corr-list')).toHaveCount(0);
  const response = await request.get('/data/ascn-archive.json');
  const archive = await response.json();
  expect(archive.items.length).toBeGreaterThan(0);
  expect(archive.items.every((item) => item.source.startsWith('https://'))).toBe(true);
  expect(archive.withheld).toEqual([]);
  expect(archive.account).toBeNull();
  expect(archive.reconciliation).toEqual({ kept: [], conflicts: [] });
  expect(requested).toEqual([]);
});

for (const width of [390, 1024, 1440]) {
  test(`public review fits at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#record');
    await expect(page.locator('#corr-summary')).toContainText('Private correspondence');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('record.png'), animations: 'disabled' });
    await page.locator('#tab-nav [data-tab="overview"]').click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('overview.png'), animations: 'disabled' });
  });
}
