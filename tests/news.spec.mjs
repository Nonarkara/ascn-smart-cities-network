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
  await page.goto("/#news/regional");
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
  await page.goto("/#news/regional");
  await expect(page.locator("#news-status")).toContainText("Publisher feeds");
  await expect(page.locator("#news-results .news-story")).toHaveCount(1);
  await expect(page.locator("#news-results a")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("#news-results time")).toHaveAttribute("datetime", snapshot.articles[0].publishedAt);
});

test("phone filters expand on request and keep the first headline visible initially", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/news-snapshot.json", (route) => route.fulfill({ json: fixture }));
  await page.route("**/api/news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-07", articles: [], sources: [] } }));
  await page.goto("/#news/regional");
  await expect(page.locator("#news-results .news-story")).toHaveCount(3);
  await expect(page.locator("#news-country")).toBeHidden();
  expect((await page.locator("#news-results h2").first().boundingBox()).y).toBeLessThan(850);
  await page.locator("#news-filter-summary").click();
  await page.locator("#news-country").selectOption("Malaysia");
  await page.locator("#news-mobile-topic").selectOption("Digital Government");
  await expect(page.locator("#news-results .news-story")).toHaveCount(1);
  await expect(page.locator("#news-filter-summary")).toContainText("2 active");
});

test("news and the meeting record remain usable when report data is unavailable", async ({ page }) => {
  await page.route("**/data/ascn-v2-data.json*", (route) => route.fulfill({ json: { reports: null, projects: [] } }));
  await page.route("**/data/news-snapshot.json", (route) => route.fulfill({ json: fixture }));
  await page.route("**/api/news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-07", articles: [], sources: [] } }));
  await page.goto("/#news/regional");
  await expect(page.locator(".load-error")).toContainText("ASCN report datasets");
  await expect(page.locator("#view-news")).toBeVisible();
  await expect(page.locator("#news-results .news-story")).toHaveCount(3);
  await page.locator("#news-country").selectOption("Malaysia");
  await expect(page.locator("#news-results .news-story")).toHaveCount(1);
  await page.locator('#tab-nav [data-tab="overview"]').click();
  await page.locator(".meeting-summary").click();
  await expect(page.locator("#view-ascn9")).toBeVisible();
});

test("Thai and Chinese News keep filter values, source titles, and fallback meanings across four panels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/data/news-snapshot.json", route => route.fulfill({ json: fixture }));
  await page.route("**/api/{news,ascn-news}", route => route.fulfill({ status: 503, json: {} }));
  await page.goto("/#news");
  await expect(page.locator("#review-baseline h2")).toBeVisible();
  await page.locator("#review-filter-panel summary").click();
  await page.locator("#review-stage").selectOption("Output");
  const reviewStatus = page.locator("#review-status");
  const archiveTitle = await page.locator("#review-archive .review-record h2").first().textContent();
  await page.locator('[data-lang-set="th"]').click();
  await expect(page.locator("#review-stage")).toHaveValue("Output");
  await expect(reviewStatus).toContainText(/รายการ/);
  await page.locator('[data-news-view="archive"]').click();
  await expect(page.locator("#review-archive .review-record h2").first()).toHaveText(archiveTitle);
  await page.locator('[data-news-view="discovery"]').click();
  await expect(page.locator("#discovery-status")).toContainText(/ดัชนีที่บันทึกไว้/);
  await page.locator('[data-lang-set="zh"]').click();
  await expect(page.locator("#discovery-status")).toContainText(/已保存的索引/);
  await page.locator('[data-news-view="regional"]').click();
  await expect(page.locator("#news-status")).toContainText(/已保存的阅读列表/);
  await page.locator("#news-filter-summary").click();
  await page.locator("#news-mobile-topic").selectOption({ label: "数字政务" });
  await expect(page.locator("#news-results h2")).toHaveText("Malaysia digital government programme ↗");
  await page.locator('[data-lang-set="th"]').click();
  await expect(page.locator("#news-mobile-topic")).toHaveValue("Digital Government");
  await expect(page.locator("#news-results h2")).toHaveText("Malaysia digital government programme ↗");
});

test("outages without saved data remain distinct from a filter with no matches", async ({ page }) => {
  await page.route("**/data/{news-snapshot,ascn-news-archive,ascn-news-discovery}.json", route => route.fulfill({ status: 503 }));
  await page.route("**/api/{news,ascn-news}", route => route.fulfill({ status: 503, json: {} }));
  await page.goto("/#news");
  await expect(page.locator("#review-status")).toContainText("archive unavailable");
  await page.locator('[data-lang-set="zh"]').click();
  await expect(page.locator("#review-status")).toContainText(/证据档案暂不可用/);
  await page.locator('[data-news-view="discovery"]').click();
  await expect(page.locator("#discovery-refresh")).toHaveAttribute("aria-disabled", "false");
  await expect(page.locator("#discovery-status")).toContainText(/不可用/);
  await page.locator('[data-news-view="regional"]').click();
  await expect(page.locator("#news-status")).toHaveText("暂无区域新闻标题");
  await expect(page.locator("#news-clear")).toHaveCount(0);
});

test("a published reading list outranks an older browser cache and stale feed response", async ({ page }) => {
  const older = { ...fixture, checkedAt: "2026-09-01", articles: fixture.articles.slice(0, 1) };
  await page.addInitScript(saved => localStorage.setItem("ascn-news-v1", JSON.stringify(saved)), older);
  await page.route("**/data/news-snapshot.json", route => route.fulfill({ json: fixture }));
  await page.route("**/api/news", route => route.fulfill({ json: { ...older, mode: "live", sources: [null] } }));
  await page.goto("/#news/regional");
  await expect(page.locator("#news-status")).toContainText("newer than the feed response");
  await expect(page.locator("#news-results h2")).toHaveCount(fixture.articles.length);
  await page.locator('[data-lang-set="th"]').click();
  await expect(page.locator("#news-status")).toContainText("ใหม่กว่าข้อมูลจากฟีด");
});

for (const width of [1280, 768, 390, 375]) {
  test(`news layout fits ${width}px`, async ({ page }, testInfo) => {
    await page.route("**/api/news", (route) => route.fulfill({ status: 503, json: { checkedAt: "2026-10-07", articles: [], sources: [] } }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#news/regional");
    await expect(page.locator("#news-results .news-story")).toHaveCount(snapshot.articles.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`news-${width}.png`) });
  });
}
