import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const snapshot = JSON.parse(await readFile(new URL("../data/news-snapshot.json", import.meta.url)));
const fixture = { mode: "saved", checkedAt: "2026-10-07", sources: [], articles: [
  { title: "Singapore transport and energy infrastructure", publisher: "Publisher One", url: "https://example.com/singapore", publishedAt: "2026-10-06T10:00:00Z", countries: ["Singapore"], topics: ["Mobility", "Energy"], kind: "Report" },
  { title: "Malaysia digital government programme", publisher: "Publisher Two", url: "https://example.com/malaysia", publishedAt: "2026-10-05T10:00:00Z", countries: ["Malaysia"], topics: ["Digital Government"], kind: "Report" },
  { title: "Indonesia renewable energy for cities", publisher: "Publisher One", url: "https://example.com/indonesia", publishedAt: "2026-10-04T10:00:00Z", countries: ["Indonesia"], topics: ["Energy"], kind: "Report" },
] };

test("news filters and clear action work and failed feeds keep saved headlines visible", async ({ page }) => {
  await page.route("**/data/news-snapshot.json", (route) => route.fulfill({ json: fixture }));
  await page.route("**/api/news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-07", articles: [], sources: [] } }));
  await page.goto("/#news");
  await expect(page.locator("#view-news")).toBeVisible();
  await expect(page.locator("#news-status")).toContainText("Saved reading list");
  await expect(page.locator("#news-results .news-story")).toHaveCount(fixture.articles.length);
  await page.locator("#news-country").selectOption("Malaysia");
  await expect(page.locator("#news-results .news-story")).toHaveCount(1);
  await page.locator("#news-search").fill("does-not-exist");
  await expect(page.locator(".news-empty")).toContainText("No stories match");
  await page.locator("#news-clear").click();
  await expect(page.locator("#news-results .news-story")).toHaveCount(fixture.articles.length);
  await page.locator('[data-topic="Energy"]').click();
  await expect(page.locator("#news-results .news-story")).toHaveCount(2);
  await page.locator('#tab-nav [data-tab="overview"]').click();
  await expect(page.locator("#news-preview-list .news-story")).toHaveCount(3);
  await expect(page.locator("#showcase-player")).toBeVisible();
});

test("successful feed updates replace the reading list with attributed headlines", async ({ page }) => {
  await page.route("**/api/news", (route) => route.fulfill({ json: { ...snapshot, mode: "live", articles: [snapshot.articles[0]] } }));
  await page.goto("/#news");
  await expect(page.locator("#news-status")).toContainText("Publisher feeds");
  await expect(page.locator("#news-results .news-story")).toHaveCount(1);
  await expect(page.locator("#news-results a")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("#news-results time")).toHaveAttribute("datetime", snapshot.articles[0].publishedAt);
});

test("phone filters expand on request and keep the first headline visible initially", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/news-snapshot.json", (route) => route.fulfill({ json: fixture }));
  await page.route("**/api/news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-07", articles: [], sources: [] } }));
  await page.goto("/#news");
  await expect(page.locator("#news-results .news-story")).toHaveCount(3);
  await expect(page.locator("#news-country")).toBeHidden();
  expect((await page.locator("#news-results h2").first().boundingBox()).y).toBeLessThan(650);
  await page.locator("#news-filter-summary").click();
  await page.locator("#news-country").selectOption("Malaysia");
  await page.locator("#news-mobile-topic").selectOption("Digital Government");
  await expect(page.locator("#news-results .news-story")).toHaveCount(1);
  await expect(page.locator("#news-filter-summary")).toContainText("2 active");
});

for (const width of [1280, 768, 390, 375]) {
  test(`news layout fits ${width}px`, async ({ page }, testInfo) => {
    await page.route("**/api/news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-07", articles: [], sources: [] } }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#news");
    await expect(page.locator("#news-results .news-story")).toHaveCount(snapshot.articles.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`news-${width}.png`) });
  });
}
