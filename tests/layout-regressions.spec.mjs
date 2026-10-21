import { test, expect } from '@playwright/test';

test('Insights charts do not extend the reading pane', async ({ page }) => {
  await page.goto('/#insights');
  await expect(page.locator('.slope-row').first()).toBeAttached();
  for (const width of [1440, 1024, 390]) {
    await page.goto('/#overview');
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/#insights');
    await expect(page.locator('.slope-row').first()).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.locator('#plate').evaluate((plate) => plate.scrollWidth - plate.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test('research uses readable tablet columns and the essay keeps a phone headline', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 950 });
  await page.goto('/#research');
  await expect(page.locator('.research-theme').first()).toBeAttached();
  const grid = await page.locator('.research-theme-grid').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' '));
  expect(grid).toHaveLength(2);
  expect(Math.min(...grid.map(parseFloat))).toBeGreaterThan(250);
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto('/#essay');
  await expect(page.locator('.essay-title')).toBeVisible();
  expect(await page.locator('.essay-title').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(30);
});

test('city entries retain full click targets and selected-city behavior', async ({ page }) => {
  await page.goto('/#cities');
  await expect(page.locator('.city-cell .city-card')).toHaveCount(38);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 680, 860, 861, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    const defects = await page.locator('.city-cell').evaluateAll((cells) => cells.flatMap((cell) => {
      const button = cell.querySelector('button');
      const box = cell.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      return Math.abs(box.width - target.width) > 1 || target.height < 44 || button.scrollWidth > button.clientWidth + 1
        ? [button.textContent.trim()] : [];
    }));
    expect(defects, `city targets at ${width}px`).toEqual([]);
  }
  await page.locator('[data-city="Kuching"]').click();
  await expect(page.locator('#city-detail h2')).toHaveText('Kuching');
  await expect(page.locator('.city-card.active')).toHaveAttribute('data-city', 'Kuching');
});

test('innovation method and video remain readable across rail and container breakpoints', async ({ page }) => {
  await page.goto('/#innovation');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 680, 860, 861, 901, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    const layout = await page.locator('.iaas-row-hero').evaluate((hero) => {
      const box = hero.getBoundingClientRect();
      const steps = [...hero.querySelectorAll('.iaas-method li')];
      const media = hero.querySelector('video').getBoundingClientRect();
      return {
        overflow: hero.scrollWidth > hero.clientWidth + 1,
        steps: steps.length,
        cramped: steps.some((step) => step.clientWidth < 120 || step.scrollWidth > step.clientWidth + 1),
        mediaInside: media.left >= box.left - 1 && media.right <= box.right + 1,
        videoWidth: media.width,
      };
    });
    expect(layout, `innovation band at ${width}px`).toMatchObject({ overflow: false, steps: 4, cramped: false, mediaInside: true });
    expect(layout.videoWidth).toBeGreaterThan(100);
  }
  await expect(page.locator('[data-i18n="audit.open-video"]')).toHaveAttribute('href', 'media/showcase/iaas-hero.mp4');
});
