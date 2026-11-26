// The content-overflow gate must fail on the defect it was written for.
//
// The defect is not an old one: it is what a translation does to a layout
// that was sized for English. A Thai caption of 99.5px in an 81px column
// pushed the document sideways; the English "no projection" ran past the
// table's own edge; a country list ran 196px under the bar. Each of those
// was invisible in a source scan and obvious the moment the page was
// measured.
//
// A gate that cannot fail on the defect it was written for is not evidence.
// So this test plants that defect, and an SVG one, and asserts the
// instrument reports both — then asserts the shipped pages are clean.
import { test, expect } from '@playwright/test';
import { measureOverflow, judge } from '../scripts/audit-overflow.mjs';

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page, route, surface) {
  await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((v) => {
    const el = document.getElementById('view-' + v);
    return !!el && !el.hidden;
  }, surface, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

test.describe('content overflow', () => {
  test('the shipped insights view holds its content in every language', async ({ page }) => {
    for (const lang of ['en', 'th', 'zh']) {
      await open(page, 'insights', 'insights');
      await page.locator(`[data-lang-set="${lang}"]`).click();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const result = await measureOverflow(page);
      const unrecorded = result.offenders.filter((o) => o.cls !== 'slope-track');
      expect(unrecorded, `overflow in ${lang}: ${JSON.stringify(unrecorded, null, 1)}`).toEqual([]);
      expect(result.bleed, `the document is pushed sideways in ${lang}`).toBeLessThanOrEqual(1);
      expect(result.clipped, `SVG text cropped in ${lang}`).toEqual([]);
    }
  });

  test('the gate fails when a caption no longer fits its column', async ({ page }) => {
    await open(page, 'insights', 'insights');
    const before = await measureOverflow(page);
    expect(before.offenders.filter((o) => o.cls === 'bar-sub')).toEqual([]);

    // The defect the round actually shipped: a nowrap run of text in a track
    // sized for a shorter one. The Thai caption needs 99.5px and the column
    // gives it 81px.
    await page.addStyleTag({
      content: `.bar-row { grid-template-columns: minmax(7rem, 11rem) 1fr 6.5rem !important; }
        .bar-sub { white-space: nowrap !important; }`,
    });
    await page.locator('[data-lang-set="th"]').click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const after = await measureOverflow(page);
    expect(after.offenders.length, 'the planted caption overflow was not reported').toBeGreaterThan(0);
    expect(after.offenders.some((o) => o.cls === 'bar-sub')).toBe(true);
    expect(after.bleed, 'the planted caption should push the document sideways').toBeGreaterThan(1);
  });

  test('the gate fails when SVG text falls outside its viewBox', async ({ page }) => {
    await open(page, 'essay', 'essay');
    const before = await measureOverflow(page);
    expect(before.clipped, 'the shipped essay SVG should have no cropped text').toEqual([]);

    // SVG has no CSS box, so the box measure cannot see it. A label that
    // runs past the viewBox is silently cropped by the browser.
    await page.addStyleTag({ content: `#view-essay svg text { letter-spacing: 4px; }` });
    await page.waitForTimeout(400);
    const after = await measureOverflow(page);
    expect(after.clipped.length, 'the planted SVG overflow was not reported').toBeGreaterThan(0);
  });
});

test('the judgement fails an unrecorded overflow, an unreasoned exception, a grown one and a stale one', () => {
  const measured = [
    { route: 'insights', lang: 'th', width: '1440', offenders: [{ tag: 'em', cls: 'bar-sub', over: 18, text: 'x' }], clipped: [], bleed: 0 },
  ];

  const unrecorded = judge(measured, { exceptions: {} });
  expect(unrecorded.failures.length, 'an unrecorded overflow must fail').toBe(1);
  expect(unrecorded.failures[0]).toContain('not recorded');

  const unreasoned = judge(measured, { exceptions: { 'insights::bar-sub': { over: 18, reason: '  ' } } });
  expect(unreasoned.failures.length, 'an exception with no reason must fail').toBe(1);
  expect(unreasoned.failures[0]).toContain('no reason');

  const grown = judge(measured, { exceptions: { 'insights::bar-sub': { over: 4, reason: 'a reason' } } });
  expect(grown.failures.length, 'an exception that grew must fail').toBe(1);
  expect(grown.failures[0]).toContain('grew');

  const clean = judge(measured, { exceptions: { 'insights::bar-sub': { over: 18, reason: 'a reason' } } });
  expect(clean.failures).toEqual([]);
  expect(clean.stale).toEqual([]);

  const stale = judge([], { exceptions: { 'insights::bar-sub': { over: 18, reason: 'a reason' } } });
  expect(stale.stale.length, 'an exception that no longer happens must be withdrawn').toBe(1);
});

test('the judgement fails a view that pushes the document sideways', () => {
  const measured = [
    { route: 'insights', lang: 'th', width: '1440', offenders: [], clipped: [], bleed: 3 },
  ];
  const result = judge(measured, { exceptions: {} });
  expect(result.failures.length).toBe(1);
  expect(result.failures[0]).toContain('sideways');
});
