import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const archive = JSON.parse(await readFile(new URL("../data/ascn-news-archive.json", import.meta.url)));
const offline = (page) => page.route("**/api/ascn-news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-08", articles: [] } }));

test("review shows bounded evidence counts and keeps official status separate", async ({ page }) => {
  await offline(page);
  await page.goto("/#news");
  await expect(page.locator("#news-panel-review")).toBeVisible();
  await expect(page.locator("#review-status")).toContainText(`${archive.records.length} of ${archive.records.length}`);
  await expect(page.locator("#review-verdict")).toContainText("0 events have a reviewed outcome comparison");
  await expect(page.locator("#review-baseline")).toContainText("134 projects");
  await expect(page.locator("#review-baseline")).toContainText("18 completed");
  await page.locator("#review-city").selectOption("Dili");
  await expect(page.locator("#review-cities tr")).toHaveCount(1);
  await expect(page.locator("#review-cities")).toContainText("No coverage");
  await expect(page.locator("#review-cities")).toContainText("No row");
  await expect(page.locator("#review-baseline")).toContainText("134 projects");
});

test("archive filters, linked project statuses, pagination and city round trip work", async ({ page }) => {
  await offline(page);
  await page.goto("/#news/archive?city=Makassar");
  await expect(page.locator("#review-city")).toHaveValue("Makassar");
  const record = page.locator("#evidence-makassar-service-2025");
  await record.locator("summary").click();
  await expect(record).toContainText("6,973");
  await expect(record).toContainText("ongoing/planning in 2025");
  await expect(record).toContainText("not audited");
  await record.locator('a[href="#cities/makassar"]').click();
  await expect(page.locator("#city-detail h2")).toHaveText("Makassar");
  await page.locator('#city-detail a[href^="#news/archive"]').click();
  await expect(page.locator("#review-city")).toHaveValue("Makassar");
  await page.locator("#review-clear").click();
  await expect(page.locator("#review-archive .review-record")).toHaveCount(10);
  await page.locator('#review-pagination [aria-label="Next page"]').click();
  await expect(page.locator("#review-pagination")).toContainText("Page 2");
  await page.locator("#review-search").fill("not-a-real-claim");
  await expect(page.locator("#review-archive")).toContainText("No evidence matches");
  await page.locator("#review-clear").click();
  await page.locator("#review-filter-panel summary").click();
  await page.locator("#review-year").selectOption("2018");
  await expect(page.locator("#review-archive .review-record")).toHaveCount(archive.records.filter((row) => row.year === 2018).length);
});

test("discovery fallback stays readable and cannot change performance findings", async ({ page }) => {
  await offline(page);
  await page.route("**/data/ascn-news-discovery.json", (route) => route.fulfill({ json: { checkedAt: "2026-10-08", articles: [{ title: '<img src=x onerror="window.reviewAttack=1"> ASCN outcome', publisher: "Test index", url: "https://news.google.com/rss/articles/test", kind: "Unreviewed search match", publishedAt: "2018-01-01" }] } }));
  await page.goto("/#news/discovery");
  await expect(page.locator("#discovery-results")).toContainText("ASCN outcome");
  await expect(page.locator("#discovery-status")).toContainText("live check unavailable");
  await expect(page.locator("#discovery-results img")).toHaveCount(0);
  expect(await page.evaluate(() => window.reviewAttack)).toBeUndefined();
  await page.locator('[data-news-view="review"]').click();
  await expect(page.locator("#review-verdict")).toContainText("0 events");
  await page.locator('[data-news-view="regional"]').click();
  await expect(page.locator("#news-panel-regional")).toBeVisible();
  await page.locator('#tab-nav [data-tab="overview"]').click();
  await page.locator('#tab-nav [data-tab="news"]').click();
  await expect(page.locator("#news-panel-review")).toBeVisible();
});

test("new discovery results merge with saved history instead of replacing it", async ({ page }) => {
  const row = { publisher: "Test index", url: "https://news.google.com/rss/articles/new", kind: "Unreviewed search match", publishedAt: "2026-10-01" };
  await page.route("**/data/ascn-news-discovery.json", (route) => route.fulfill({ json: { checkedAt: "2026-10-08", articles: [{ ...row, title: "Historical ASCN lead", publishedAt: "2018-01-01" }] } }));
  await page.route("**/api/ascn-news", (route) => route.fulfill({ json: { checkedAt: "2026-10-08", sources: [{ status: "ok" }], articles: [{ ...row, title: "New ASCN lead" }] } }));
  await page.goto("/#news/discovery");
  await expect(page.locator("#discovery-results .review-record")).toHaveCount(2);
  await page.locator("#discovery-search").fill("Historical");
  await expect(page.locator("#discovery-results .review-record")).toHaveCount(1);
});

test("archive and discovery survive official report failure", async ({ page }) => {
  await offline(page);
  await page.route("**/data/ascn-v2-data.json*", (route) => route.fulfill({ json: { reports: null } }));
  await page.goto("/#news/archive");
  await expect(page.locator("#review-archive .review-record")).toHaveCount(10);
  await page.locator('[data-news-view="review"]').click();
  await expect(page.locator("#review-baseline")).toContainText("Official project comparison unavailable");
});

test("filtered review export contains source and interpretation separately", async ({ page }) => {
  await offline(page);
  await page.goto("/#news/archive?city=Jakarta");
  await expect(page.locator("#review-city")).toHaveValue("Jakarta");
  const pending = page.waitForEvent("download");
  await page.locator("#review-export").click();
  const download = await pending;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain('"claim","analysis","followUp"');
  expect(csv).toContain("jakpreneur-2025");
  expect(csv).not.toContain("makassar-service-2025");
});

for (const width of [375, 768, 1280]) {
  test(`ASCN review and archive fit ${width}px`, async ({ page }, testInfo) => {
    await offline(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#news");
    await expect(page.locator("#review-verdict h2")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`review-${width}.png`) });
    await page.locator('[data-news-view="archive"]').click();
    await expect(page.locator("#review-archive .review-record")).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.locator("#review-filter-panel summary").click();
    await expect(page.locator("#review-stage")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.locator("#review-filter-panel summary").click();
    await page.screenshot({ path: testInfo.outputPath(`archive-${width}.png`) });
  });
}
