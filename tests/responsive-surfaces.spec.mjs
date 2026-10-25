import { test, expect } from '@playwright/test';
const routes = ['overview', 'innovation', 'record', 'news', 'news/archive', 'news/discovery', 'news/regional', 'ascn9', 'history', 'cities', 'projects', 'framework', 'partners', 'contacts', 'insights', 'data', 'archive', 'research', 'essay'];

for (const width of [390, 1024, 1440]) {
  test(`all public surfaces contain their content after language changes at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.route('**/api/{news,ascn-news}', (route) => route.fulfill({ status: 503, json: {} }));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#overview');
    await expect(page.locator('#kpi-grid .kpi').first()).toBeAttached();
    for (const route of routes) {
      await page.goto(`/#${route}`);
      const view = page.locator(`#view-${route.split('/')[0]}`);
      await expect(view).toBeVisible();
      for (const lang of ['th', 'zh', 'en']) {
        await page.locator(`[data-lang-set="${lang}"]`).click();
        await page.evaluate(() => document.fonts.ready);
        const geometry = await view.evaluate((view) => {
          const plate = document.querySelector('#plate');
          const box = view.getBoundingClientRect();
          return {
            documentBleed: document.documentElement.scrollWidth > innerWidth + 1,
            paneBleed: plate.scrollWidth > plate.clientWidth + 1,
            viewInside: box.left >= -1 && box.right <= innerWidth + 1,
          };
        });
        expect(geometry, `${route}, ${lang}, ${width}px`).toEqual({ documentBleed: false, paneBleed: false, viewInside: true });
        await expect(view.locator('.path-band')).toHaveCount(1);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('the desktop reading pane recomposes at effective 200 percent zoom', async ({ browser }, testInfo) => {
  test.setTimeout(90000);
  // A 1440×900 physical viewport at 200% has a 720×450 CSS viewport.
  const context = await browser.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.route('**/api/{news,ascn-news}', (route) => route.fulfill({ status: 503, json: {} }));
  try {
    for (const route of ['overview', 'projects', 'news']) {
      await page.goto(`${testInfo.project.use.baseURL}/#${route}`);
      await expect(page.locator(`#view-${route} .path-band`)).toHaveCount(1);
      const bleed = await page.evaluate(() => {
        const plate = document.querySelector('#plate');
        return document.documentElement.scrollWidth > innerWidth + 1 || plate.scrollWidth > plate.clientWidth + 1;
      });
      expect(bleed, route).toBe(false);
      await expect(page.locator('#locatorNext')).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`${route}-200-percent.png`) });
    }
  } finally { await context.close(); }
});

test('footer disclosures never share a grid cell or bleed after translation', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/#ascn9');
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const lang of ['th', 'zh', 'en']) {
      await page.locator(`[data-lang-set="${lang}"]`).click();
      await page.evaluate(() => document.fonts.ready);
      const defects = await page.locator('.footer-content').evaluate((footer) => {
        const blocks = [...footer.children].map((el) => ({ text: el.textContent.trim().slice(0, 35), box: el.getBoundingClientRect() }));
        const issues = [];
        for (let i = 0; i < blocks.length; i++) {
          const a = blocks[i].box;
          if (a.left < -1 || a.right > innerWidth + 1) issues.push(`outside pane: ${blocks[i].text}`);
          for (const b of blocks.slice(i + 1)) {
            const overlap = Math.min(a.right, b.box.right) - Math.max(a.left, b.box.left) > 1 && Math.min(a.bottom, b.box.bottom) - Math.max(a.top, b.box.top) > 1;
            if (overlap) issues.push(`${blocks[i].text} overlaps ${b.text}`);
          }
        }
        return issues;
      });
      expect(defects, `${width}px ${lang}`).toEqual([]);
    }
    await page.locator('.site-footer').screenshot({ path: testInfo.outputPath(`footer-${width}.png`) });
  }
});
