// The page-cost gate must fail on the defect it was written for.
//
// The owner's standing law: "Measure page cost in SCREENS; cap it, only
// lower it." The cost gate is the first instrument in this repository that
// measures a view's cost at all, so it has to be able to go red on the two
// ways a view can break that law: a view that grows past its cap, and a
// view that gets cheaper without the cap being lowered.
//
// A gate that cannot fail is not evidence. So this test plants the defect,
// proves the gate goes red, and restores.
import { test, expect } from '@playwright/test';
import { measureCost, judge } from '../scripts/audit-cost.mjs';
import baseline from '../scripts/cost-baseline.json' with { type: 'json' };

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page, route) {
  await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((v) => {
    const el = document.getElementById('view-' + v);
    return !!el && !el.hidden;
  }, route, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

test.describe('page cost', () => {
  test('the gate fails when a view grows past its cap', async ({ page }) => {
    await open(page, 'framework');
    const before = await measureCost(page);
    const cap = baseline.views['framework@1440'].ceiling;
    const clean = judge({ 'framework@1440': { screens: before.screens } }, baseline);
    expect(clean.failures, 'the shipped view should be within its cap before the defect is planted').toEqual([]);
    expect(clean.improvements, 'and not cheaper than its cap, or the baseline is stale').toEqual([]);

    // The defect: a view that has been padded with air. Three extra screens
    // of nothing is what a view looks like when a section is given a fixed
    // height it does not need.
    await page.addStyleTag({ content: '#view-framework::after { content: ""; display: block; height: 2700px; }' });
    await page.waitForTimeout(400);
    const after = await measureCost(page);
    expect(after.screens, 'the planted air was not measured').toBeGreaterThan(before.screens + 2);

    const broken = judge({ 'framework@1440': { screens: after.screens } }, baseline);
    expect(broken.failures.length, 'the gate did not go red on a view that grew').toBeGreaterThan(0);
    expect(broken.failures[0]).toContain('framework@1440');
    expect(broken.failures[0]).toContain(String(cap));
  });

  test('the gate refuses a view with no cap at all', async () => {
    const verdicts = judge({ 'brand-new@1440': { screens: 2 } }, baseline);
    expect(verdicts.uncapped).toEqual(['brand-new@1440']);
    expect(verdicts.failures).toEqual([]);
  });

  test('the gate demands that an improvement is banked', async () => {
    // A view that became cheaper still has its old cap. The law says a cap
    // is only ever lowered, so the gate must not let a stale cap stand.
    const verdicts = judge({ 'overview@1440': { screens: 1.0 } }, baseline);
    expect(verdicts.improvements.length, 'an unbanked improvement was not reported').toBeGreaterThan(0);
    expect(verdicts.improvements[0]).toContain('overview@1440');
    expect(verdicts.failures).toEqual([]);
  });

  test('every view the site ships has a cap in the baseline', async () => {
    const routes = await (async () => {
      const { chromium } = await import('@playwright/test');
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto('/#overview', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const list = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('#tab-nav [data-tab]')].map((a) => a.getAttribute('data-tab'));
        const views = [...document.querySelectorAll('section.view')].map((el) => (el.id || '').replace(/^view-/, '')).filter(Boolean);
        const subs = [...document.querySelectorAll('#view-news [data-news-view]')].map((a) => a.getAttribute('data-news-view')).filter(Boolean).map((p) => `news/${p}`);
        return [...new Set([...nav, ...views, ...subs])].filter(Boolean);
      });
      await browser.close();
      return list;
    })();
    const missing = [];
    for (const route of routes) {
      for (const width of ['1440', '390']) {
        if (!baseline.views[`${route}@${width}`]) missing.push(`${route}@${width}`);
      }
    }
    expect(missing, `views with no cap: ${missing.join(', ')}`).toEqual([]);
  });
});
