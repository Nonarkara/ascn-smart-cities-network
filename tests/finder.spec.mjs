import {test,expect} from '@playwright/test';

test('reader chooses a question then finds a city with the keyboard', async({page})=>{
  await page.goto('/#overview');
  await expect(page.locator('#kpi-grid .kpi').first()).toContainText('38');
  await expect(page.locator('#observatory-heading')).toHaveText('38 cities. What changed?');
  await expect(page.locator('#view-overview h1')).toHaveCount(1);
  await page.keyboard.press('/');
  await expect(page.locator('#finder')).toBeVisible();
  await expect(page.locator('#finder-query')).toBeFocused();
  await page.locator('#finder-query').fill('Kuching');
  await expect(page.locator('#finder-results')).toContainText('Kuching');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#cities\/kuching/);
  await expect(page.locator('#city-detail h2')).toHaveText('Kuching');
  await expect(page.locator('#finder')).not.toBeVisible();
  await page.keyboard.press('/');
  await page.keyboard.press('Escape');
  await expect(page.locator('#finder-open')).toBeFocused();
});

test('finder reaches projects, handles no matches and keeps markup inert',async({page})=>{
  await page.goto('/#overview');
  await expect(page.locator('#kpi-grid .kpi').first()).toContainText('38');
  await page.locator('#finder-open').click();
  await page.locator('#finder-query').fill('<img src=x onerror=alert(1)>');
  await expect(page.locator('#finder-status')).toContainText('No matches');
  await expect(page.locator('#finder-results img')).toHaveCount(0);
  await page.locator('#finder-query').fill('Bangkok');
  await page.locator('#finder-results a').filter({hasText:'Project'}).first().click();
  await expect(page).toHaveURL(/#projects/);
  await expect(page.locator('#search-filter')).not.toHaveValue('');
  await expect(page.locator('#project-table tr').first()).toBeVisible();
});
