import { expect, test } from '@playwright/test';
import { measureRenderedProse } from '../scripts/visual-audit-rules.mjs';

test('the rendered reading measure splits columns and rejects a long line', async ({ page }) => {
  await page.setContent('<p style="width:900px;columns:2;column-gap:40px;font:16px monospace"></p>');
  const line = 'Readable city evidence. '.repeat(2).trim();
  await page.locator('p').evaluate((p, text) => {
    p.textContent = Array(8).fill(text).join(' ');
  }, line);
  const measure = async () => (await page.evaluate(measureRenderedProse, 'p'))[0].chars;
  expect(await measure()).toBeLessThanOrEqual(75);
  await page.locator('p').evaluate(p => { p.style.columns = '1'; });
  expect(await measure()).toBeGreaterThan(75);
});
