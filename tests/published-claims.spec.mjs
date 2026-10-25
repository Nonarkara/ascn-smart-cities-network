import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url)));
const engine = await read('ascn-v2-data.json');
const { cities } = await read('ascn-cities.json');
const latest = engine.reports.at(-1);

// These assertions bind editorial labels to their datasets. An import cannot
// pass by leaving an old headline beside a new chart; update the dated copy
// and translations in the same reviewed change as a new reporting cycle.
test('published portfolio headlines agree with the current roster and report in every edition', async ({ page }) => {
  await page.goto('/#overview');
  for (const lang of ['en', 'th', 'zh']) {
    await page.locator(`[data-lang-set="${lang}"]`).click();
    const heading = page.locator('[data-i18n="h.how-performing"]');
    const numbers = (await heading.textContent()).match(/\d+/g)?.map(Number);
    expect(numbers).toEqual([cities.length, latest.total_projects]);
    await expect(page.locator('#observatory-heading')).toContainText(String(cities.length));
  }
});

test('each reporting cycle has an accurate readable series row', async ({ page }) => {
  await page.goto('/#record');
  await expect(page.locator('#rec-stack-chart .rec-col')).toHaveCount(engine.reports.length + 1);
  for (const report of engine.reports) {
    const row = page.locator('.rec-table-series tbody tr').filter({ has: page.locator('th', { hasText: new RegExp(`^\\s*${report.year}\\b`) }) });
    await expect(row).toHaveCount(1);
    const cells = await row.locator('td').allTextContents();
    expect(cells.slice(0, 3).map((text) => Number(text.replaceAll(',', '').trim())))
      .toEqual([report.total_projects, report.status.ongoing, report.status.completed]);
    expect(Number.parseFloat(cells[3])).toBeCloseTo(report.status.completed / report.total_projects * 100, 1);
  }
});

test('the footer states independent authorship and the actual translation limit', async ({ page }) => {
  await page.goto('/#projects');
  for (const lang of ['en', 'th', 'zh']) {
    await page.locator(`[data-lang-set="${lang}"]`).click();
    await expect(page.locator('[data-i18n-html="footer.depa"] strong')).toHaveCount(1);
    await expect(page.locator('[data-i18n-html="footer.depa"]')).not.toContainText('developed by the Digital Economy');
  }
  await page.locator('[data-lang-set="en"]').click();
  await expect(page.locator('[data-i18n="note.source.language"]')).toContainText('translations are incomplete');
});
