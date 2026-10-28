import { test, expect } from '@playwright/test';
import { longestHeadingLine } from '../scripts/visual-audit-rules.mjs';

const questionGeometry = () => {
  const section = document.querySelector('.review-section--questions');
  const grid = document.querySelector('#review-followups');
  const cards = [...grid.querySelectorAll('.review-followup')];
  const box = el => el.getBoundingClientRect();
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  return {
    count: cards.length, cols,
    emptyCells: cards.length ? Math.ceil(cards.length / cols) * cols - cards.length : 0,
    trailing: box(section).right - box(grid).right,
    overflow: Math.max(0, grid.scrollWidth - grid.clientWidth),
    cardOverflow: Math.max(0, ...cards.map(el => el.scrollWidth - el.clientWidth)),
    stretched: cards.some(el => getComputedStyle(el).alignSelf === 'stretch'),
    sectionWidth: box(section).width, gridWidth: box(grid).width,
    sectionHeight: box(section).height,
  };
};

test('question filters and incoming counts keep complete rows and content-sized rules', async ({ page }) => {
  test.setTimeout(90000);
  await page.route('**/api/{news,ascn-news}', r => r.fulfill({ status: 503, json: {} }));
  await page.goto('/#news');
  await expect(page.locator('#review-followups')).toHaveAttribute('data-count', '6');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 760, 860, 861, 1024, 1050, 1440, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [city, count] of [['Siem Reap', 1], ['Phnom Penh', 2], ['Jakarta', 3]]) {
      await page.selectOption('#review-city', city);
      await expect(page.locator('#review-followups')).toHaveAttribute('data-count', String(count));
      const geometry = await page.evaluate(questionGeometry);
      expect(geometry.count).toBe(count);
      expect(geometry.emptyCells).toBe(0);
      expect(geometry.trailing).toBeLessThanOrEqual(1);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.cardOverflow).toBeLessThanOrEqual(1);
    }
  }
  await page.selectOption('#review-city', 'all');
  // Local DOM fixtures exercise new archive shapes without publishing records.
  const cards = await page.locator('#review-followups').innerHTML();
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (let count = 0; count <= 6; count++) {
      await page.evaluate(({ cards, count }) => {
        const host = document.querySelector('#review-followups');
        const fixture = document.createElement('div'); fixture.innerHTML = cards;
        host.replaceChildren(...[...fixture.children].slice(0, count));
        if (!count) host.innerHTML = '<p class="review-note">No project-specific or financing follow-up in this selection. Broaden the evidence filters.</p>';
        host.dataset.count = String(count);
      }, { cards, count });
      const geometry = await page.evaluate(questionGeometry);
      expect(geometry.count).toBe(count);
      expect(geometry.emptyCells).toBe(0);
      expect(geometry.trailing).toBeLessThanOrEqual(1);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.cardOverflow).toBeLessThanOrEqual(1);
    }
  }
});

test('question rule budget rejects the old full-width single-question layout', async ({ page }) => {
  await page.goto('/#news');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.selectOption('#review-city', 'Siem Reap');
  await expect(page.locator('#review-followups')).toHaveAttribute('data-count', '1');
  const repaired = await page.evaluate(questionGeometry);
  expect(repaired.trailing).toBeLessThanOrEqual(1);
  await page.addStyleTag({ content: '.review-section--questions { width:100% !important; }' });
  const original = await page.evaluate(questionGeometry);
  expect(original.trailing).toBeGreaterThan(500);
  expect(original.trailing <= 1).toBe(false);
});

test('route information and next action stay together and retain localized visible names', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/#overview');
  for (const width of [390, 480, 481, 600, 601, 860, 861, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const lang of ['en', 'th', 'zh']) {
      await page.locator(`[data-lang-set="${lang}"]`).click();
      for (const view of ['overview', 'insights', 'research', 'news']) {
        await page.goto(`/#${view}`);
        await expect(page.locator(`#view-${view}`)).toBeVisible();
        const next = page.locator('#locatorNext');
        const visible = (await next.innerText()).replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        expect((await next.getAttribute('aria-label')).replace(/\s+/g, ' ').toLocaleLowerCase()).toContain(visible);
        const geometry = await page.evaluate(() => {
          const here = document.querySelector('#locatorHere').getBoundingClientRect();
          const next = document.querySelector('#locatorNext').getBoundingClientRect();
          const kicker = document.querySelector('#barKickerSubject');
          return { gap: next.left - here.right, height: next.height, right: next.right, kickerVisible: !!kicker.getClientRects().length, kickerClip: kicker.parentElement.scrollWidth - kicker.parentElement.clientWidth };
        });
        expect(geometry.gap).toBeLessThanOrEqual(20);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
        expect(geometry.right).toBeLessThanOrEqual(width);
        if (geometry.kickerVisible) expect(geometry.kickerClip).toBeLessThanOrEqual(1);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addStyleTag({ content: '.locator-next { margin-left:auto !important; }' });
  const oldGap = await page.evaluate(() => document.querySelector('#locatorNext').getBoundingClientRect().left - document.querySelector('#locatorHere').getBoundingClientRect().right);
  expect(oldGap).toBeGreaterThan(500);
  expect(oldGap <= 20).toBe(false);
});

const readIntro = () => {
  const head = document.querySelector('.review-head').getBoundingClientRect();
  return { height: head.height, baseline: document.querySelector('#review-baseline').getBoundingClientRect().top };
};
const readInnovation = () => {
  const hero = document.querySelector('.iaas-row-hero').getBoundingClientRect();
  const copy = document.querySelector('.iaas-hero-copy').getBoundingClientRect();
  const method = document.querySelector('.iaas-method').getBoundingClientRect();
  const figure = document.querySelector('.iaas-hero-media').getBoundingClientRect();
  return { height: hero.height, readingSlack: hero.bottom - Math.max(copy.bottom, method.bottom), copyHeight: copy.height, methodHeight: method.height, figureWidth: figure.width, figureHeight: figure.height };
};

test('News introduction gives the first screen to evidence and rejects the old hero', async ({ page }) => {
  await page.goto('/#news');
  await expect(page.locator('#review-baseline h2')).toBeVisible();
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const intro = await page.evaluate(readIntro);
    expect(intro.height).toBeLessThanOrEqual(140);
    if (width > 390) expect(intro.baseline).toBeLessThanOrEqual(740);
  }
  await page.addStyleTag({ content: '.review-head h1 { font-size:var(--t-figure) !important; line-height:.98 !important; }' });
  expect((await page.evaluate(readIntro)).height).toBeGreaterThan(140);
});

test('Innovation method fills its reading region without borrowing video height', async ({ page }) => {
  await page.goto('/#innovation');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1024, 1280, 1440, 1920, 2103]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(readInnovation);
    expect(geometry.readingSlack, JSON.stringify({ width, ...geometry })).toBeLessThanOrEqual(48);
    expect(geometry.figureWidth).toBeGreaterThan(250);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addStyleTag({ content: 'body .view .iaas-row-hero { width:100%;grid-template-columns: minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) !important;grid-template-areas:"copy steps media" !important; }' });
  const original = await page.evaluate(readInnovation);
  expect(original.readingSlack).toBeGreaterThan(100);
  expect(original.readingSlack <= 48).toBe(false);
});

const readForwardAgenda = el => {
  const lead = el.querySelector(':scope > .lede').getBoundingClientRect();
  const title = el.querySelector(':scope > h3').getBoundingClientRect();
  const notes = el.querySelector('.ascap-notes').getBoundingClientRect();
  const overlap = Math.max(0, Math.min(title.right, notes.right)-Math.max(title.left, notes.left)) * Math.max(0, Math.min(title.bottom, notes.bottom)-Math.max(title.top, notes.top));
  return { leadWidth:lead.width, leadHeight:lead.height, overlap, notesAfterLead: notes.top >= lead.bottom - 1 };
};

test('History and Framework forward agendas preserve phone reading order and reject the old grid', async ({ page }) => {
  for (const view of ['history','framework']) {
    await page.setViewportSize({width:390,height:844});
    await page.goto(`/#${view}`);
    const agenda = page.locator(`#view-${view} .ascap-panel`);
    await expect(agenda.locator('.pillars > *')).toHaveCount(8);
    for (const width of [360,390,680,860,861,1024]) {
      await page.setViewportSize({width,height:844});
      const geometry=await agenda.evaluate(readForwardAgenda);
      expect(geometry.leadWidth).toBeGreaterThan(250);
      expect(geometry.overlap).toBe(0);
      if(width<=680)expect(geometry.notesAfterLead).toBe(true);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.addStyleTag({content:'.ascap-panel { grid-template-columns:minmax(0,1fr) minmax(0,26rem) !important;grid-template-areas:"label notes" "title notes" "lede notes" "pillars pillars" !important;gap:.4rem 2.4rem !important; }'});
  const original=await page.locator('#framework-ascap').evaluate(readForwardAgenda);
  expect(original.leadWidth).toBeLessThan(100);
  expect(original.leadWidth > 250 && original.overlap === 0).toBe(false);
});

test('all 26 Essay citations keep readable rendered lines and reject full-width rows', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/#essay');
  const citations=page.locator('.essay-ref-item > div');
  await expect(citations).toHaveCount(26);
  await page.evaluate(()=>document.fonts.ready);
  for(const width of [390,1024,1440,2103]){
    await page.setViewportSize({width,height:900});
    for(const [index,citation] of (await citations.all()).entries()) expect(await citation.evaluate(longestHeadingLine), `citation ${index+1} at ${width}px`).toBeLessThanOrEqual(75);
  }
  await page.setViewportSize({width:1440,height:900});
  await page.addStyleTag({content:'.essay-refs,.essay-ref-grid {width:100% !important;max-width:none !important;}.essay-ref-grid {grid-template-columns:minmax(0,1fr) !important;}'});
  const original=await citations.nth(7).evaluate(longestHeadingLine);
  expect(original).toBeGreaterThan(150);
  expect(original<=75).toBe(false);
});
