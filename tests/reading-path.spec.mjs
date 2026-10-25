import { test, expect } from '@playwright/test';
const circuit = ['overview','innovation','record','news','history','cities','projects','framework','partners','contacts','insights','data','archive','research','essay'];

test('every view exposes its next destinations once, including the meeting drill-down', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/#overview');
  for (const [index,tab] of [...circuit, 'ascn9'].entries()) {
    await page.goto(`/#${tab}`);
    const view = page.locator(`#view-${tab}`);
    await expect(view).toBeVisible();
    const band = view.locator('.path-band');
    await expect(band).toHaveCount(1);
    expect(await band.evaluate(el => el === el.parentElement.lastElementChild)).toBe(true);
    const position = tab === 'ascn9' ? 0 : index;
    const next = circuit[(position+1)%circuit.length];
    await expect(page.locator('#locatorNext')).toHaveAttribute('href',`#${next}`);
    await expect(band.locator('a').first()).toHaveAttribute('href',`#${next}`);
    await expect(band.locator('a').nth(1)).toHaveAttribute('href',`#${circuit[(position+2)%circuit.length]}`);
  }
});

test('language changes retain the onward band on rebuilt views', async ({ page }) => {
  await page.goto('/#cities');
  for (const tab of ['cities','projects','contacts','history']) {
    await page.goto(`/#${tab}`);
    for (const [lang,script] of [['th',/[\u0e00-\u0e7f]/],['zh',/[\u4e00-\u9fff]/],['en',/[A-Za-z]/]]) {
      await page.locator(`[data-lang-set="${lang}"]`).click();
      const band = page.locator(`#view-${tab} .path-band`);
      await expect(band).toHaveCount(1);
      await expect(band.locator('.path-name').first()).toContainText(script);
      expect(await band.evaluate(el=>el===el.parentElement.lastElementChild)).toBe(true);
    }
  }
});

test('the visible route works by keyboard, wraps, and preserves browser back', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#essay');
  const next = page.locator('#locatorNext');
  await expect(next).toBeInViewport();
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#overview$/);
  await expect(page.locator('#view-overview .path-band')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('#view-essay')).toBeVisible();
  await expect(next).toHaveAttribute('href','#overview');
});
