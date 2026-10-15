import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const ledger = JSON.parse(await readFile(new URL("../data/ascn-correspondence.json", import.meta.url)));

test("ledger loads through validation, exposes all threads and filters cost candidates", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#record");
  await expect(page.locator("#corr-summary")).toContainText(String(ledger.totals.threads));
  await expect(page.locator("#corr-method")).toContainText("Automated candidate");
  await expect(page.locator("#corr-method")).toContainText(ledger.generatedAt.slice(0, 10));
  while (await page.locator("#corr-more").isVisible()) await page.locator("#corr-more").click();
  await expect(page.locator("#corr-list .corr-item")).toHaveCount(ledger.threads.length);
  await page.locator("#corr-kind").selectOption("funded_travel");
  await expect(page.locator("#corr-list .corr-item")).toHaveCount(ledger.totals.fundedTravelThreads);
  await page.locator("#corr-origin-filter").selectOption("ASEAN Secretariat");
  await expect(page.locator("#corr-list .corr-item")).toHaveCount(ledger.totals.fundedTravelByOrigin["ASEAN Secretariat"]);
  await page.locator("#corr-search").fill("no matching subject xyzzy");
  await expect(page.locator("#corr-list")).toContainText("No threads match");
  expect(errors).toEqual([]);
});

test("bad ledger data degrades only correspondence", async ({ page }) => {
  await page.route("**/data/ascn-correspondence.json*", (route) => route.fulfill({ json: { threads: [] } }));
  await page.goto("/#record");
  await expect(page.locator("#corr-summary")).toContainText("not available");
  await page.locator('#tab-nav [data-tab="cities"]').click();
  await expect(page.locator("#sea-map .leaflet-interactive")).toHaveCount(38);
});

for (const width of [375, 768, 1280]) {
  test(`independent review and ledger fit at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#record");
    await expect(page.locator("#corr-list .corr-item")).toHaveCount(60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator("#corr-ledger").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("ledger.png") });
    await page.locator('#tab-nav [data-tab="overview"]').click();
    await expect(page.locator("#kpi-grid .kpi")).toHaveCount(5);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("overview.png"), animations: "disabled" });
  });
}
