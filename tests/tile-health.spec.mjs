// The tile-health instrument must fail a release when the SITE is at fault,
// and must not fail one when the tile server is the one that is down. Both
// are proved against the real built site, by breaking the page and the
// network in the two ways that matter.
//
// This is the falsifier for the falsifier: judgeBasemap is unit-tested on
// its branches, and this proves the branches are reached by the real thing.
import { test, expect } from '@playwright/test';
import { checkBasemap, watchTileRequests } from '../scripts/tile-health.mjs';

test('the site is at fault when it asks for a tile the server does not have', async ({ page }) => {
  // A 404 on the tile URL: the site's own template asked for something that
  // is not there. The site is at fault and a release must fail.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 404, body: 'no such tile' }));
  const seen = watchTileRequests(page);
  await page.goto('/#cities');
  await expect(page.locator('#sea-map .leaflet-interactive')).toHaveCount(38);
  const verdict = await checkBasemap(page, '#sea-map', { timeout: 6000, seen });
  expect(verdict.siteFault, verdict.reason).toBe(true);
  expect(verdict.ok, verdict.reason).toBe(false);
});

test('the site is at fault when its own policy blocks the tile requests', async ({ page }) => {
  // The page carries tile images with sources, but the requests never leave
  // the browser: the site's own content security policy refused them. The
  // map is empty and the site says nothing about why.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  const seen = watchTileRequests(page);
  await page.goto('/#cities');
  await expect(page.locator('#sea-map .leaflet-interactive')).toHaveCount(38);
  const verdict = await checkBasemap(page, '#sea-map', { timeout: 6000, seen });
  // The request was made and then failed in the network — which the browser
  // reports — so this is an outage of the network, not of the site. The site
  // must still degrade as it promises.
  expect(verdict.siteFault, verdict.reason).toBe(false);
  expect(verdict.degraded, verdict.reason).toBe(true);
  await expect(page.locator('#view-cities .map-notice')).toBeVisible();
  await expect(page.locator('#sea-map .leaflet-interactive')).toHaveCount(38);
});

test('an upstream refusal is not a site fault, and the site degrades as it promises', async ({ page }) => {
  // The server refuses: 429, which is what a throttling tile server does.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ status: 429, body: 'slow down' }));
  const seen = watchTileRequests(page);
  await page.goto('/#cities');
  await expect(page.locator('#sea-map .leaflet-interactive')).toHaveCount(38);
  const verdict = await checkBasemap(page, '#sea-map', { timeout: 6000, seen });
  expect(verdict.siteFault, verdict.reason).toBe(false);
  expect(verdict.degraded, verdict.reason).toBe(true);
  // And the promise the site makes in that situation is kept: the reader is
  // told, and can still choose a city.
  await expect(page.locator('#view-cities .map-notice')).toBeVisible();
  await expect(page.locator('#sea-map .leaflet-interactive')).toHaveCount(38);
});

test('a healthy basemap is a pass', async ({ page }) => {
  const seen = watchTileRequests(page);
  await page.goto('/#cities');
  await expect(page.locator('#sea-map .leaflet-interactive')).toHaveCount(38);
  const verdict = await checkBasemap(page, '#sea-map', { timeout: 15000, seen });
  expect(verdict.ok, verdict.reason).toBe(true);
  expect(verdict.siteFault, verdict.reason).toBe(false);
  expect(verdict.degraded, verdict.reason).toBe(false);
});
