import { test, expect } from '@playwright/test';
import { longestHeadingLine, renderedTypeSizes } from '../scripts/visual-audit-rules.mjs';

// The twins strip. It used to be one row per twin: a 779px picture with the
// copy beside it, which the owner rejected as "very big on one side and a
// complete fuck-up on the other". It is now five across in one row, small,
// with the click carrying the detail.
//
// This test used to assert THAT layout, so it was rewritten with it. It now
// asserts the new one, and it includes a mutation control: the same
// measurement, run against a deliberately broken grid, must come back
// different — otherwise the assertion proves nothing.
const readStrip = () => {
  const grid = document.querySelector('.twins-grid');
  const gb = grid.getBoundingClientRect();
  const cells = [...document.querySelectorAll('.twin-row')];
  const tops = (sel) => cells.map((c) => Math.round(c.querySelector(sel).getBoundingClientRect().top));
  return {
    cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
    cellTops: cells.map((c) => Math.round(c.getBoundingClientRect().top)),
    nameTops: tops('.twin-city'),
    metaTops: tops('.twin-meta'),
    descTops: tops('.twin-desc'),
    linkTops: tops('.twin-link-label'),
    widths: cells.map((c) => Math.round(c.getBoundingClientRect().width)),
    spill: Math.max(...cells.map((c) => Math.round(c.getBoundingClientRect().right - gb.right))),
  };
};

test('the twin directory is one row of five on a wide plate, and one column below the floor', async ({ page }) => {
  await page.goto('/#overview');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1280, 1440, 1512, 1856, 1920]) {
    await page.setViewportSize({ width, height: 950 });
    await page.waitForTimeout(120);
    const strip = await page.evaluate(readStrip);
    expect(strip.cols).toBe(5);
    expect(new Set(strip.cellTops).size).toBe(1);
    // ONE baseline grid: the five names, the five captions and the five
    // links each start on a single line. "HO CHI MINH CITY" wraps to two
    // lines at the narrow end, so without a shared grid its caption and
    // link would sit lower than the other four.
    expect(new Set(strip.nameTops).size).toBe(1);
    expect(new Set(strip.metaTops).size).toBe(1);
    expect(new Set(strip.descTops).size).toBe(1);
    expect(new Set(strip.linkTops).size).toBe(1);
    expect(strip.spill).toBeLessThanOrEqual(1);
    // Small, but not shrunk to a ribbon: the city name still has to fit.
    expect(Math.min(...strip.widths)).toBeGreaterThanOrEqual(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }

  // Below the floor the strip is one column — five stacked directory rows.
  // Not three-across and two, which leaves a hole, and not two and one,
  // which leaves an orphan.
  await page.setViewportSize({ width: 1024, height: 950 });
  await page.waitForTimeout(120);
  const narrow = await page.evaluate(readStrip);
  expect(narrow.cols).toBe(1);
  expect(new Set(narrow.cellTops).size).toBe(5);
});

test('the shared-baseline assertion catches a broken grid (control)', async ({ page }) => {
  await page.goto('/#overview');
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 1440, height: 950 });
  // Detach the cells from the shared tracks: each cell then sizes its own
  // rows, and the cell whose city name wraps to two lines drops its caption
  // and link below the other four.
  await page.addStyleTag({ content: '.twin-row { grid-template-rows: auto auto auto auto auto !important; }' });
  await page.waitForTimeout(120);
  const broken = await page.evaluate(readStrip);
  expect(new Set(broken.linkTops).size).toBeGreaterThan(1);
});

test('heading audit measures the longest line and retains Thai combining marks as graphemes', async ({ page }) => {
  await page.goto('/#overview');
  await page.evaluate(`window.measureHeading = ${longestHeadingLine.toString()}`);
  const result = await page.evaluate(() => {
    const heading = document.createElement('h2');
    heading.style.cssText = 'font:16px monospace;white-space:pre';
    heading.textContent = 'A'.repeat(70)+'\nShort'; document.body.appendChild(heading);
    const longest = window.measureHeading(heading);
    heading.textContent = 'ก้'.repeat(10);
    const thai = window.measureHeading(heading); heading.remove();
    return {longest,thai};
  });
  expect(result.longest).toBe(70);
  expect(result.thai).toBe(10);
});

test('the 9th annual meeting record keeps its place in the index', async ({ page }) => {
  // The reader is on the Overview and opens the meeting record sheet. The
  // index must still say where they are: one row lit, and the number in the
  // plate's locator must be that row's number. It used to light nothing and
  // wear News's number, so the locator pointed at a different section.
  await page.goto('/#overview');
  await page.locator('a[href="#ascn9"]').first().click();
  await expect(page.locator('#locatorNum')).toHaveText('01');
  const lit = page.locator('#tab-nav a.active');
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAttribute('data-tab', 'overview');
  await expect(lit).toHaveAttribute('data-num', '01');
  await expect(page.locator('#locatorNum')).toHaveText(await lit.getAttribute('data-num'));
});

test('privacy boundaries translate without deleting the record panels or video links', async ({ page }) => {
  await page.goto('/#record');
  for (const [lang,script] of [['th',/[\u0e00-\u0e7f]/],['zh',/[\u4e00-\u9fff]/]]) {
    await page.locator(`[data-lang-set="${lang}"]`).click();
    await expect(page.locator('[data-i18n="audit.local-private"]')).toContainText(script);
    await expect(page.locator('[data-i18n="audit.public-reports"]')).toContainText(script);
    await expect(page.locator('[data-i18n="audit.public-only"]')).toContainText(script);
    await page.locator('#tab-nav [data-tab="innovation"]').click();
    await expect(page.locator('[data-i18n="audit.ground"]')).toContainText(script);
    await expect(page.locator('[data-i18n="audit.open-video"]')).toHaveAttribute('href','media/showcase/iaas-hero.mp4');
    await page.locator('#tab-nav [data-tab="record"]').click();
  }
});

// The index rail.
//
// It was clamp(300px, 32vw, 420px): a rail sized as a SHARE OF THE SCREEN,
// to hold fifteen labels whose longest word is ten characters. That is the
// spatial hallucination the owner named — the grid's answer rather than the
// reader's — and it also meant the rail changed width with the viewport
// while its contents stayed exactly the same size.
//
// The next answer, 242px, was still the grid's answer. Measured on the
// served page, the rail's header row needed 240.5px to hold the wordmark
// (66.5px) and the language switch (136px: three buttons at the 44px touch
// floor), while the INDEX — the thing the rail exists to hold — needed
// 148.7px. The switch is a site-wide preference, exactly like the theme
// toggle, which this house had already moved into the plate's header for
// precisely this reason. It is now beside the theme toggle, and the rail is
// 196px: the width its index needs.
//
// These tests assert the three things the rebuild has to deliver: the rail
// is the width its content needs, the wordmark's box does not change with
// the viewport, and the elements that share an origin share it EXACTLY.
// The last one carries a mutation control, because a check that can only
// pass proves nothing.
const railGeometry = () => {
  const rail = document.querySelector('.index');
  const brand = document.querySelector('.brand.mark').getBoundingClientRect();
  const locale = document.querySelector('.locale').getBoundingClientRect();
  const theme = document.querySelector('.theme-toggle').getBoundingClientRect();
  const item = document.querySelector('.index-scroll .item');
  const itemCS = getComputedStyle(item);
  const itemRect = item.getBoundingClientRect();
  const label = document.querySelector('.group-label');
  const labelCS = getComputedStyle(label);
  const labelRect = label.getBoundingClientRect();
  const itemTextX = itemRect.x + parseFloat(itemCS.paddingLeft) + 20 + 7;
  const labelX = labelRect.x + parseFloat(labelCS.paddingLeft);
  const scroll = document.querySelector('.index-scroll');
  // The masthead's lockup, the search control under it, and the band's label.
  // A rail answers to its content, so the three must end on one pixel.
  const finder = document.querySelector('.finder-open').getBoundingClientRect();
  const tagline = document.querySelector('.brand.mark i');
  const kicker = document.querySelector('.bar-kicker');
  const kickerBox = kicker.getBoundingClientRect();
  const kickerRange = document.createRange();
  kickerRange.selectNodeContents(kicker);
  const kickerInk = Math.max(...[...kickerRange.getClientRects()].map((r) => r.width));
  // The chrome's right edge and the reading column's right edge.
  const bar = document.querySelector('.plate-bar');
  const barKids = [...bar.children].filter(
    (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0,
  );
  const lastControl = barKids[barKids.length - 1].getBoundingClientRect();
  const main = document.querySelector('#main-content');
  const mainCS = getComputedStyle(main);
  const mainRect = main.getBoundingClientRect();
  return {
    railWidth: Math.round(rail.getBoundingClientRect().width),
    brandWidth: Math.round(brand.width * 100) / 100,
    brandRight: Math.round(brand.right * 100) / 100,
    finderRight: Math.round(finder.right * 100) / 100,
    taglineShown: getComputedStyle(tagline).display !== 'none',
    kickerBoxWidth: Math.round(kickerBox.width * 100) / 100,
    kickerInkWidth: Math.round(kickerInk * 100) / 100,
    lastControlRight: Math.round(lastControl.right * 100) / 100,
    contentTextRight:
      Math.round((mainRect.right - parseFloat(mainCS.paddingRight)) * 100) / 100,
    localeTop: locale.top, localeBottom: locale.bottom,
    themeTop: theme.top, themeBottom: theme.bottom,
    labelX: Math.round(labelX * 100) / 100,
    itemTextX: Math.round(itemTextX * 100) / 100,
    overflow: scroll.scrollHeight - scroll.clientHeight,
  };
};

test('the index rail is sized by its content, and its contents share one origin', async ({ page }) => {
  await page.goto('/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const widths = [];
  const brands = [];
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    const g = await page.evaluate(railGeometry);
    widths.push(g.railWidth);
    brands.push(g.brandWidth);
  }
  // The same width at every viewport: the rail answers to its content.
  expect(new Set(widths).size, `rail widths across viewports: ${widths.join(', ')}`).toBe(1);
  // And the wordmark inside it does not change size with the viewport either.
  // Two rules left over from the old page header used to grow it, which made
  // the rail's wordmark box 66.5px above 1100px and 170px below it — a rail
  // that does not move with the viewport cannot have a part of it that does.
  expect(new Set(brands).size, `wordmark widths across viewports: ${brands.join(', ')}`).toBe(1);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);
  const g = await page.evaluate(railGeometry);

  // The language switch and the theme toggle are in the same bar. One pixel
  // apart reads as a failed attempt at alignment.
  expect(Math.abs(g.localeTop - g.themeTop)).toBe(0);
  expect(Math.abs(g.localeBottom - g.themeBottom)).toBe(0);
  // The group heading sits on the axis of the items it heads.
  expect(Math.abs(g.labelX - g.itemTextX)).toBe(0);
  // The whole index fits: the last two sections must not be below the fold.
  expect(g.overflow).toBe(0);

  // The masthead carries the site's name. The tagline used to be dropped
  // by a container query whose reason had died with the language switch,
  // which left a 170px band holding a 66.5px wordmark — the owner's
  // complaint about a big bar for a small piece of information, one scale
  // down. The lockup is back, so the band is full.
  expect(g.taglineShown).toBe(true);
  // The wordmark's lockup and the search control under it end on the same
  // origin inside the rail. The lockup is 176.84px wide — the width the
  // type gives it — and the rail's content box is 177px (203 minus 26), so
  // the lockup ends 0.16px before the button that is flush to the box.
  // That is under a fifth of a pixel, and the house's near-miss band starts
  // at 1px; the rail's width stays an integer so its hairline lands on a
  // whole pixel. The two must not drift apart.
  expect(Math.abs(g.brandRight - g.finderRight)).toBeLessThan(0.5);
  // The header's label is a label, not a spacer. It was an 885.84px flex
  // box for 152.23px of ink (5.82x) and the review measured every variant
  // of the old cap putting the last control on the same pixel — so the
  // spacer bought nothing and the box now fits its text.
  expect(Math.abs(g.kickerBoxWidth - g.kickerInkWidth)).toBeLessThan(1);
});

test('the chrome and the reading column share one right origin, wide and narrow', async ({ page }) => {
  await page.goto('/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  // 2103px is the width the owner photographed: the plate is wider than
  // the 1600px reading column, so the chrome had 137px of its own right
  // edge to end on. Two origins on one screen.
  for (const width of [1440, 2103]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    const g = await page.evaluate(railGeometry);
    expect(
      Math.abs(g.lastControlRight - g.contentTextRight),
      `chrome ${g.lastControlRight} vs column ${g.contentTextRight} at ${width}`,
    ).toBe(0);
  }
});

test('the masthead-origin assertion catches a broken lockup (control)', async ({ page }) => {
  await page.goto('/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const measured = await page.evaluate(() => {
    // A one-pixel shift must still fail after normalizing the control box
    // across font rasterizers. Tagline visibility is checked separately.
    document.querySelector('.brand.mark').style.transform = 'translateX(1px)';
    const brand = document.querySelector('.brand.mark').getBoundingClientRect();
    const finder = document.querySelector('.finder-open').getBoundingClientRect();
    return Math.abs(brand.right - finder.right);
  });
  expect(measured).toBeGreaterThan(0.5);
});

test('the chrome-origin assertion catches a one-pixel chrome shift (control)', async ({ page }) => {
  await page.goto('/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 2103, height: 900 });
  await page.waitForTimeout(250);
  const measured = await page.evaluate(() => {
    document.querySelector('.theme-toggle').style.marginRight = '1px';
    const bar = document.querySelector('.plate-bar');
    const kids = [...bar.children].filter(
      (el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0,
    );
    const last = kids[kids.length - 1].getBoundingClientRect();
    const main = document.querySelector('#main-content');
    const cs = getComputedStyle(main);
    const right = main.getBoundingClientRect().right - parseFloat(cs.paddingRight);
    return Math.abs(last.right - right);
  });
  expect(measured).toBeGreaterThan(0);
  expect(measured).toBeLessThanOrEqual(6);
});

test('the rail-origin assertion catches a one-pixel misalignment (control)', async ({ page }) => {
  await page.goto('/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const measured = await page.evaluate(() => {
    // Push the group heading one pixel off the items' axis, the way a
    // stray padding or a border would.
    const label = document.querySelector('.group-label');
    label.style.paddingLeft = 'calc(var(--pad) + 20px + 7px + 1px)';
    const item = document.querySelector('.index-scroll .item');
    const itemCS = getComputedStyle(item);
    const itemRect = item.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const itemTextX = itemRect.x + parseFloat(itemCS.paddingLeft) + 20 + 7;
    const labelX = labelRect.x + parseFloat(getComputedStyle(label).paddingLeft);
    return Math.abs(labelX - itemTextX);
  });
  expect(measured).toBeGreaterThan(0);
  expect(measured).toBeLessThanOrEqual(6);
});

test('the header-origin assertion catches a one-pixel misalignment (control)', async ({ page }) => {
  await page.goto('/#overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const measured = await page.evaluate(() => {
    // Push the theme toggle one pixel down inside the plate's header, the way
    // a stray margin or a border would.
    const theme = document.querySelector('.theme-toggle');
    theme.style.marginTop = '1px';
    const locale = document.querySelector('.locale').getBoundingClientRect();
    const t = document.querySelector('.theme-toggle').getBoundingClientRect();
    return Math.abs(t.top - locale.top);
  });
  expect(measured).toBeGreaterThan(0);
  expect(measured).toBeLessThanOrEqual(6);
});

test('type audit ignores hidden pages and still detects an extra visible size', async ({ page }) => {
  await page.goto('/#record');
  await expect(page.locator('#rec-stack-chart .rec-col').first()).toBeAttached();
  const before = await page.evaluate(renderedTypeSizes);
  await page.addStyleTag({ content: '#view-ascn9 h1 { font-size: 99px; }' });
  expect(await page.evaluate(renderedTypeSizes)).toEqual(before);
  await page.locator('#view-record').evaluate((view) => {
    const control = document.createElement('p');
    control.textContent = 'Visible type control';
    control.style.fontSize = '99px';
    view.appendChild(control);
  });
  const after = await page.evaluate(renderedTypeSizes);
  expect(after).toContain('99px');
  expect(after.length).toBe(before.length + 1);
});
