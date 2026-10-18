import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("archive sits after Library and keeps good and bad outcomes in one list", async ({ page }) => {
  await page.goto("/#archive");
  const tabs = await page.locator("#tab-nav a").evaluateAll((links) => links.map((link) => link.dataset.tab));
  expect(tabs[tabs.indexOf("data") + 1]).toBe("archive");
  await expect(page.locator("#view-archive")).toBeVisible();
  await expect(page).toHaveURL(/#archive$/);
  await expect(page.locator("#archive-table tbody tr")).toHaveCount(40);
  await expect(page.locator("#archive-funding")).toContainText("10,000,000");
  await expect(page.locator("#archive-funding")).toContainText("21,000,000");
  await expect(page.locator("#archive-funding")).toContainText("13,180,000");
  await expect(page.locator("#archive-funding")).toContainText("— not public");
  await expect(page.locator("#archive-funding summary").filter({ hasText: "Full breakdown" })).toHaveCount(1);
  await expect(page.locator("#archive-funding")).toContainText("Not specific to ASCN.");
  await expect(page.locator("#archive-funding")).not.toContainText("250 billion yen");
  await expect(page.locator("#archive-funding")).not.toContainText("not a grant");
  await expect(page.locator("#archive-money")).toContainText("Where the money went");
  await expect(page.locator("#archive-money")).toContainText("ASCN-specific.");
  await expect(page.locator("#archive-money")).toContainText("General. Not specific to ASCN.");
  await expect(page.locator("#archive-money")).toContainText("attractive market");
  await expect(page.locator("#archive-money")).toContainText("Japanese companies");
  await expect(page.locator("#archive-money")).toContainText("U.S. export");
  await expect(page.locator("#archive-money")).not.toContainText("DEPA never received fund transfers.");
  await expect(page.locator("#archive-money")).not.toContainText("Not a sourced fact.");
  await expect(page.locator("#archive-counts")).toContainText("MOU");
  await expect(page.locator("#archive-counts")).toContainText("Medium confidence");
  await expect(page.locator("#archive-counts")).toContainText("Self-reported");
  await expect(page.locator("#archive-table")).toContainText("Medium confidence");
  await expect(page.locator("#archive-table")).toContainText("Self-reported");
  await expect(page.locator("#archive-table")).toContainText("13%");
  await expect(page.locator("#archive-timeline")).toContainText("2018");
  await expect(page.locator("#archive-timeline")).toContainText("2022");
  await expect(page.locator("#archive-outcomes")).toContainText("Delivered");
  await expect(page.locator("#archive-outcomes")).toContainText("Failed");
  await expect(page.locator("#archive-pending")).toContainText("Pending review");
  await expect(page.locator("#archive-withheld")).not.toContainText("Withheld 3");
  await expect(page.locator("#view-archive")).not.toContainText("LinkedIn");
  await expect(page.locator("#view-archive")).not.toContainText("city of life");
  await expect(page.locator("#view-archive")).not.toContainText("Baguio");
  await expect(page.locator("#view-archive")).not.toContainText("financial-management");
  await expect(page.locator("#view-archive")).not.toContainText("@");
  await page.locator("#archive-type").selectOption("trip");
  await expect(page.locator("#archive-table tbody tr")).toHaveCount(4);
  await expect(page.locator("#archive-outcomes")).toContainText("Failed");
  await page.locator("#archive-search").fill("Nanning");
  await expect(page.locator("#archive-table tbody tr")).toHaveCount(1);
  await expect(page.locator("#archive-table")).toContainText("Nanning");
  await page.locator("#archive-search").fill("");
  await page.locator("#archive-type").selectOption("all");
  await page.locator("#archive-outcome").selectOption("delivered");
  await expect(page.locator("#archive-table tbody tr")).toHaveCount(15);
  await expect(page.locator("#archive-outcomes > ol > li")).toHaveCount(4);
});

test("the archive language switch does not translate the rest of the site", async ({ page }) => {
  await page.goto("/#archive");
  await expect(page.locator("#archive-subtitle")).toHaveText("Published sources");
  await page.locator("[data-archive-lang='th']").click();
  await expect(page.locator("#view-archive")).toHaveAttribute("lang", "th");
  await expect(page.locator("#archive-subtitle")).toHaveText("แหล่งข้อมูลสาธารณะ");
  await expect(page.locator("#archive-money")).toContainText("ไม่ได้เจาะจงที่ ASCN");
  await expect(page.locator("#archive-table")).toContainText("การเดินทาง");
  await expect(page.locator("#tab-nav [data-tab='data']")).toHaveText("Library");
  await expect(page.locator("#tab-nav [data-tab='archive']")).toHaveText("Archive");
  await page.locator("[data-archive-lang='zh']").click();
  await expect(page.locator("#archive-subtitle")).toHaveText("公开来源");
  await expect(page.locator("#archive-outcomes")).toContainText("未实现");
  await expect(page.locator("h2").first()).not.toHaveText("公开来源");
  await page.locator("[data-archive-lang='en']").click();
  await expect(page.locator("#archive-subtitle")).toHaveText("Published sources");
});

test("archive titles from data render as text", async ({ page }) => {
  const payload = {
    schema: 1,
    coverage: { en: "Coverage", th: "ครอบคลุม", zh: "范围" },
    withheld: [],
    items: [{
      id: "hostile",
      type: "grant",
      date: "2021-01-02",
      title: { en: '<img src=x onerror="window.__archiveRan=true">', th: "ชื่อ", zh: "标题" },
      counterpart: null,
      outcome: "failed",
      note: { en: "No result.", th: "ไม่มีผล", zh: "没有结果。" },
      source: "javascript:alert(1)",
      public: true,
    }],
  };
  await page.route("**/data/ascn-archive.json", (route) => route.fulfill({ json: payload }));
  await page.goto("/#archive");
  await expect(page.locator("#archive-table")).toContainText("<img src=x");
  await expect(page.locator("#archive-table img")).toHaveCount(0);
  await expect(page.locator("#archive-table a")).toHaveCount(0);
  expect(await page.evaluate(() => window.__archiveRan)).toBeUndefined();
});

test("archive screenshots at desktop and phone widths in three languages", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir("test-results/archive-shots", { recursive: true });
  await page.goto("/#archive");
  await expect(page.locator("#archive-table tbody tr")).toHaveCount(40);
  for (const lang of ["en", "th", "zh"]) {
    await page.locator(`[data-archive-lang="${lang}"]`).click();
    await expect(page.locator("#view-archive")).toHaveAttribute("lang", lang);
    for (const [width, height] of [[1280, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator("#archive-title")).toBeVisible();
      await page.screenshot({ path: `test-results/archive-shots/archive_${lang}_${width}.png`, fullPage: true });
    }
  }
});
