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
    // 15 since Archive joined Library. The count stays as a literal on purpose —
    // it is a tripwire for a tab appearing or vanishing without anyone deciding
    // it — so it is paired with the new tab named explicitly, rather than
    // derived from the DOM it is meant to police.
    await expect(page.locator("#tab-nav [data-tab]")).toHaveCount(15);
    await expect(page.locator('#tab-nav [data-tab="innovation"]')).toHaveAttribute("href", "#innovation");
    await expect(page.locator('#tab-nav [data-tab="news"]')).toHaveAttribute("href", "#news");
    await expect(page.locator('#tab-nav [data-tab="archive"]')).toHaveAttribute("href", "#archive");
    await expectBasemap(page, "#sea-map");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("cities.png"), fullPage: true });
  });
}

test("the first screen is a map and its selection is at the lower edge", async ({ page }) => {
  for (const [width, height] of [[390, 844], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const [route, map, action, result] of [
      ["cities", "#sea-map", "#city-pick", "#city-detail"],
      ["contacts", "#contacts-map", "#contact-city", "#contact-detail"],
    ]) {
      await page.goto(`/#${route}`);
      await expect(page.locator(action).locator("option").last()).toBeAttached();
      await page.evaluate(() => document.fonts.ready);
      const visibleArea = async () => page.locator(map).evaluate(element => {
        const r = element.getBoundingClientRect();
        return (Math.min(r.right, innerWidth) - Math.max(0, r.left)) *
          (Math.min(r.bottom, innerHeight) - Math.max(0, r.top)) / (innerWidth * innerHeight);
      });
      await expect.poll(visibleArea).toBeGreaterThanOrEqual(0.60);
      await expect(page.locator(action)).toBeInViewport({ ratio: 0.95 });
      await expect(page.locator(`${result} .map-selection a`)).toBeInViewport({ ratio: 0.95 });
      await page.locator(action).selectOption("Bandar Seri Begawan");
      await expect(page.locator(`${result} h2`)).toHaveText("Bandar Seri Begawan");
      await expect(page.locator(`${result} .map-selection a`)).toBeInViewport({ ratio: 0.95 });
      const old = await page.addStyleTag({ content: `${map} { height: 22rem !important; }` });
      expect(await visibleArea()).toBeLessThan(0.60);
      await old.evaluate(element => element.remove());
    }
  }
});

test("city pickers retain evidence and officer details without basemap tiles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://tile.openstreetmap.org/**", route => route.abort());
  await page.goto("/#cities");
  await expect(page.locator('#view-cities .map-notice')).toBeVisible();
  await page.locator("#city-search").fill("No matching city");
  await page.locator("#city-pick").selectOption("Kuching");
  await expect(page.locator("#city-detail h2")).toHaveText("Kuching");
  await expect(page.locator("#city-detail a[href^='#news/archive']")).toHaveAttribute("href", "#news/archive?city=Kuching");
  await page.locator("#city-pick").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#map-mode button").first()).toBeFocused();
  await page.goto("/#contacts");
  await expect(page.locator('#view-contacts .map-notice')).toBeVisible();
  await page.locator("#contact-city").selectOption("Kuching");
  await expect(page.locator("#contact-detail h2")).toHaveText("Kuching");
  await expect(page.locator("#contact-detail")).toContainText("National Representative");
  await expect(page.locator("#contact-detail")).toContainText("Chief Smart City Officer");
  await page.locator("#contact-city").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#contact-detail .map-selection a")).toBeFocused();
  await page.locator("#contact-city").selectOption("Bandar Seri Begawan");
  await expect(page.locator("#contact-record")).toContainText("Name unavailable in the source list.");
  await page.locator("#contact-city").selectOption("Kuching");
  await page.locator('[data-lang-set="th"]').click();
  await expect(page.locator("#contact-city")).toHaveValue("Kuching");
  await expect(page.locator("#contacts-map .leaflet-interactive")).toHaveCount(38);
});
