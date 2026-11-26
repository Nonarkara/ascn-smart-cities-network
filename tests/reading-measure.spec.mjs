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

// The sweep used to group a line's glyphs by their exact `top`, so a line
// carrying a bold phrase was counted in two halves and the longer half was
// reported. That is a blind spot in the one instrument that polices the
// reading measure: it could call a long line legal. The instrument now
// groups by vertical overlap, and this test plants the defect it used to
// miss: one long line with a bold phrase in the middle of it.
test('the measure counts a line that carries a bold phrase as one line', async ({ page }) => {
  await page.setContent('<p style="width:1400px;font:16px monospace"></p>');
  const words = Array(14).fill('evidence').join(' ');
  await page.locator('p').evaluate((p, text) => {
    p.innerHTML = `Before the bold phrase ${text} after the bold phrase continues here.`;
    const strong = document.createElement('strong');
    strong.textContent = 'A BOLD PHRASE IN THE MIDDLE';
    p.insertBefore(strong, p.firstChild);
  }, words);
  const found = await page.evaluate(measureRenderedProse, 'p');
  expect(found.length).toBeGreaterThan(0);
  // The line holds more than the ceiling's worth of characters, and the
  // instrument must say so.
  expect(found[0].chars).toBeGreaterThan(75);
  // And it must report a line whose text matches the number it claims, so
  // the number can be checked by reading it.
  const graphemes = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(found[0].line)].length;
  expect(graphemes).toBe(found[0].chars);
});

// The archive's method note sits in a three-column flow whose columns share
// a baseline. Grouping by height alone welded the three columns into one
// line and the sweep read 129 characters where the reader sees 61. The
// instrument must read the COLUMN, which is what the reader's eye follows.
test('the measure reads a multi-column note by its column, not by the box', async ({ page }) => {
  await page.setContent('<div style="width:1200px;columns:3;column-gap:60px;font:13px monospace"><p></p></div>');
  await page.locator('p').evaluate((p) => {
    p.textContent = Array(6).fill('Counts are not inflated and the outcome says so here.').join(' ');
  });
  const found = await page.evaluate(measureRenderedProse, 'p');
  expect(found.length).toBeGreaterThan(0);
  expect(found[0].chars, 'the columns were welded into one line').toBeLessThanOrEqual(75);
  const graphemes = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(found[0].line)].length;
  expect(graphemes).toBe(found[0].chars);
});
