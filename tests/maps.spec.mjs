import { test, expect } from "@playwright/test";

async function expectBasemap(page, map) {
  await expect.poll(() => page.locator(`${map} .leaflet-tile`).evaluateAll((tiles) =>
    tiles.some((tile) => tile.complete && tile.naturalWidth === 256 &&
      new URL(tile.src).hostname === "tile.openstreetmap.org")), { timeout: 15_000 }).toBe(true);
  const sources = await page.locator(`${map} .leaflet-tile`).evaluateAll((tiles) => tiles.map((tile) => tile.src));
  expect(sources.every((src) => new URL(src).hostname === "tile.openstreetmap.org")).toBe(true);
  await expect(page.locator(`${map} .leaflet-control-attribution`)).toContainText("OpenStreetMap contributors");
}

test("both maps render geography; night mode and city selection remain working", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#cities");
  await expect(page.locator("#sea-map .leaflet-interactive")).toHaveCount(38);
  await expectBasemap(page, "#sea-map");
  await page.locator('#map-mode [data-mode="night"]').click();
  await expect(page.locator("#sea-map .ascn-night-tiles")).toHaveCount(1);
  await expectBasemap(page, "#sea-map");
  await page.locator("#city-search").fill("Kuching");
  await page.locator('#city-cards [data-city="Kuching"]').click();
  await expect(page.locator("#city-detail h2")).toHaveText("Kuching");
  await page.locator('#map-mode [data-mode="map"]').click();
  await expect(page.locator("#sea-map .ascn-night-tiles")).toHaveCount(0);
  await page.locator('#tab-nav [data-tab="contacts"]').click();
  await expect(page.locator("#contacts-map .leaflet-interactive")).toHaveCount(38);
  await expectBasemap(page, "#contacts-map");
  expect(errors).toEqual([]);
});

for (const width of [375, 768, 1280]) {
  test(`full navigation and city map fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#cities");
    await expect(page.locator("#city-cards .city-card")).toHaveCount(38);
    await expect(page.locator("#tab-nav [data-tab]")).toHaveCount(11);
    await expectBasemap(page, "#sea-map");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("cities.png"), fullPage: true });
  });
}
