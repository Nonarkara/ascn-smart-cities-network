// The composition gate must fail on the defect it was written for.
//
// The owner sent a screenshot of the overview's perspective: a large empty
// band down the left of the content area, because the block was a narrow pair
// centred inside a wide column and the 2px rule above it still spanned the
// whole column. The instrument found it; the gate has to keep finding it.
//
// A gate that cannot fail on the defect it was written for is not evidence.
// So this test plants that defect, and a second one, and asserts the
// instrument reports both — then asserts the shipped pages are clean.
import { test, expect } from '@playwright/test';
import { auditView } from '../scripts/audit-composition.mjs';

// 1440 is the viewport the owner's own screen was at when he sent the
// screenshot, and the width at which the defect is a band rather than a
// gutter. A falsifier that only fires at a width where the band is under
// the threshold proves nothing.
test.use({ viewport: { width: 1440, height: 900 } });

async function open(page, route, surface) {
  await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((v) => {
    const el = document.getElementById('view-' + v);
    return !!el && !el.hidden;
  }, surface, { timeout: 20000 });
  await page.waitForTimeout(600);
}

test.describe('composition bands', () => {
  test('the overview ships with no empty band beside its content', async ({ page }) => {
    await open(page, 'overview', 'overview');
    const result = await auditView(page, 'overview');
    expect(result).not.toBeNull();
    expect(result.failures, `composition failures: ${JSON.stringify(result.failures, null, 1)}`).toEqual([]);
  });

  test('the gate fails when the perspective is a narrow pair again', async ({ page }) => {
    await open(page, 'overview', 'overview');
    const before = await auditView(page, 'overview');
    expect(before.failures, 'the shipped page should be clean before the defect is planted').toEqual([]);

    // The defect the owner sent: the tracks sized to their content, the pair
    // centred, and the 2px rule above it still spanning the whole column.
    await page.addStyleTag({
      content: `.perspective { grid-template-columns: minmax(0, 46ch) 440px !important;
        justify-content: center !important; }
        .persp-aside { grid-column: 2 !important; grid-row: 1 / span 2 !important;
          flex-direction: column !important; }
        .persp-aside > * { flex: none !important; }`,
    });
    await page.waitForTimeout(400);
    const after = await auditView(page, 'overview');
    expect(after.failures.length, 'the planted band was not reported').toBeGreaterThan(0);
    const worst = after.failures[0];
    expect(worst.widthPx).toBeGreaterThan(80);
    expect(worst.heightPx).toBeGreaterThan(250);
  });

  test('the gate fails on a hole inside a full-width row', async ({ page }) => {
    await open(page, 'overview', 'overview');
    const before = await auditView(page, 'overview');
    expect(before.failures).toEqual([]);

    // Two narrow columns with a gulf between them inside a full-width
    // section: the page stops halfway across and then resumes.
    await page.addStyleTag({
      content: `.overview-grid { grid-template-columns: 359px 359px !important;
        gap: 420px !important; justify-content: center !important; }`,
    });
    await page.waitForTimeout(400);
    const after = await auditView(page, 'overview');
    expect(after.failures.length, 'the planted interior band was not reported').toBeGreaterThan(0);
    expect(after.failures.some((f) => f.interior)).toBe(true);
  });
});
