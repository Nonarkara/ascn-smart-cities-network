import { test, expect } from "@playwright/test";

const routes = [
  "overview", "innovation", "record", "news", "news/archive", "news/discovery",
  "news/regional", "news/review", "essay", "ascn9", "cities", "contacts", "data",
  "framework", "history", "insights", "partners", "projects", "research",
];

async function measure(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const sizes = new Set();
    document.querySelectorAll("main *").forEach((el) => {
      if (el.closest(".leaflet-container, .view[hidden]")) return;
      if (![...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) return;
      if (!visible(el)) return;
      sizes.add(getComputedStyle(el).fontSize);
    });
    const caps = [...document.querySelectorAll("body *")].filter((el) => visible(el) && getComputedStyle(el).textTransform === "uppercase").map((el) => el.className);
    const short = [...document.querySelectorAll("button, .text-button, #tab-nav a, .review-tabs a, .lib-chip, .contact-card a, .cc-inst, .essay-sections button, .essay-sections summary, .essay-continue a, .section-next button, .nav-menu, .showcase-clip, .news-icon-button, .segmented button")].filter((el) => visible(el) && el.getBoundingClientRect().height < 44).map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().height)} ${el.textContent.trim().slice(0, 32)}`);
    const header = document.querySelector(".site-nav").getBoundingClientRect().height;
    return {
      sizes: [...sizes],
      caps,
      short,
      header,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      notice: document.querySelectorAll(".site-notice").length,
    };
  });
}

for (const width of [390, 1440]) {
  test(`field notebook holds at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`/#${route}`, { waitUntil: "domcontentloaded" });
      await page.locator(".site-nav").waitFor();
      if (route === "insights") await page.locator("#ig-focus-trends .spark, #ig-focus-trends .spark-flat").first().waitFor({ timeout: 20_000 });
      if (route === "essay") await page.locator(".essay-sections").waitFor({ timeout: 20_000 });
      if (route === "contacts") await page.locator("#contacts-content h1").waitFor({ timeout: 20_000 });
      const sample = await measure(page);
      expect(sample.header, route).toBeLessThanOrEqual(56);
      expect(sample.overflow, route).toBeLessThanOrEqual(1);
      expect(sample.notice, route).toBe(0);
      expect(sample.caps, route).toEqual(["kicker"]);
      expect(sample.sizes.length, `${route} ${sample.sizes.join(",")}`).toBeLessThanOrEqual(4);
      expect(sample.short, route).toEqual([]);
    }
  });
}

test("pages lead with their own claim", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#overview");
  await expect(page.locator("#view-overview h1")).toHaveText("134 projects, and nobody published the score.");
  await expect(page.locator("#view-overview h1")).not.toHaveText(/Innovation/);
  const titles = {};
  for (const view of ["review", "archive", "discovery", "regional"]) {
    await page.goto(`/#news/${view}`);
    titles[view] = await page.locator("#news-title").innerText();
    await expect(page).toHaveTitle(new RegExp(titles[view].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  expect(new Set(Object.values(titles)).size).toBe(4);
  await page.goto("/#contacts");
  await expect(page.locator("#contacts-content h1")).toContainText("ministry");
  await expect(page.locator("#contacts-content h1")).not.toContainText(/click/i);
});

test("insights sparklines span the tile and flat series are a sentence", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#insights");
  await page.locator(".spark").first().waitFor();
  const align = await page.locator(".spark").first().evaluate((spark) => {
    const svg = spark.querySelector(".spark-svg").getBoundingClientRect();
    const box = spark.getBoundingClientRect();
    const labels = [...spark.querySelectorAll(".spark-labels span")].map((el) => el.getBoundingClientRect());
    const dots = [...spark.querySelectorAll(".spark-dot")].map((el) => el.getBoundingClientRect());
    const off = dots.map((dot, i) => Math.abs((dot.left + dot.width / 2) - (labels[i].left + labels[i].width / 2)));
    return { svg: svg.width, tile: box.width, off: Math.max(...off) };
  });
  expect(align.svg).toBeGreaterThan(align.tile * 0.9);
  expect(align.off).toBeLessThan(8);
  await expect(page.locator(".spark-flat")).toContainText("6%");
  await expect(page.locator("#view-insights")).not.toContainText("✓");
  await expect(page.locator("#view-insights")).not.toContainText("✗");
  await page.goto("/#research");
  await page.locator(".insider-grid").waitFor();
  await expect(page.locator("#view-research")).not.toContainText("✓");
  await expect(page.locator("#view-research")).not.toContainText("✗");
});

test("essay keeps a section list and a next step", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#essay");
  await page.locator(".essay-sections").waitFor();
  await expect(page.locator(".essay-sections-desk")).toBeVisible();
  expect(await page.locator(".essay-sections").evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
  await expect(page.locator(".essay-continue")).toContainText("Next");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".essay-sections-phone summary")).toBeVisible();
  await expect(page.locator(".essay-sections-desk")).toBeHidden();
});
