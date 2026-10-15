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
    const short = [...document.querySelectorAll("button, .text-button, #tab-nav a, .review-tabs a, .lib-chip, .contact-card a, .cc-inst, .essay-sections button, .essay-sections summary, .essay-continue a, .section-next button, .nav-menu, .showcase-clip, .news-icon-button, .segmented button, .demo-play-btn")].filter((el) => visible(el) && el.getBoundingClientRect().height < 44).map((el) => `${el.className || el.tagName} ${Math.round(el.getBoundingClientRect().height)} ${el.textContent.trim().slice(0, 32)}`);
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
  await page.locator(".essay-sections-phone summary").click();
  await expect(page.locator(".essay-sections-phone ol")).toBeVisible();
  await expect(page.locator(".essay-sections-desk ol")).toBeHidden();
  expect(await page.locator(".essay-sections ol:visible").count()).toBe(1);
});

test("phone menu spaces its links and centres the label", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#overview");
  const menu = page.locator("#nav-menu");
  const centred = await menu.evaluate((el) => {
    const button = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    return Math.abs((text.top + text.height / 2) - (button.top + button.height / 2));
  });
  expect(centred).toBeLessThan(3);
  await menu.click();
  const links = page.locator("#tab-nav .nav-panel a");
  await expect(links.first()).toBeVisible();
  const boxes = await links.evaluateAll((els) => els.map((el) => {
    const box = el.getBoundingClientRect();
    return { top: box.top, height: box.height, width: box.width, text: el.textContent.trim() };
  }));
  for (const box of boxes) {
    expect(box.height, box.text).toBeGreaterThanOrEqual(44);
    expect(box.width, box.text).toBeGreaterThan(80);
  }
  const field = boxes.filter((box) => box.text === "Overview" || box.text === "Innovation");
  expect(field[1].top - (field[0].top + field[0].height)).toBeGreaterThanOrEqual(12);
});

test("named controls clear 44px and the growth chart stays short", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#overview");
  const news = await page.locator(".nav-direct").boundingBox();
  expect(news.width).toBeGreaterThanOrEqual(44);
  expect(news.height).toBeGreaterThanOrEqual(44);

  await page.goto("/#innovation");
  await expect(page.locator(".iaas-card-link").first()).toBeVisible();
  const open = await page.locator(".iaas-card-link").first().boundingBox();
  expect(open.height).toBeGreaterThanOrEqual(44);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const play = await page.locator(".demo-play-btn").first().boundingBox();
    expect(play.height, `play ${width}`).toBeGreaterThanOrEqual(44);
    expect(play.width, `play ${width}`).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/#data");
  await page.locator(".dc-dl").first().waitFor();
  const download = await page.locator(".dc-dl").first().boundingBox();
  expect(download.height).toBeGreaterThanOrEqual(44);

  await page.goto("/#partners");
  const partner = page.locator(".prog-link").first();
  await partner.waitFor();
  const mark = await partner.boundingBox();
  expect(mark.width).toBeGreaterThanOrEqual(44);
  expect(mark.height).toBeGreaterThanOrEqual(44);
  await expect(partner).toHaveAttribute("aria-label", /Open /);

  await page.goto("/#cities");
  const zoom = page.locator(".leaflet-control-zoom-in");
  await zoom.waitFor();
  const zoomBox = await zoom.boundingBox();
  expect(zoomBox.width).toBeGreaterThanOrEqual(44);
  expect(zoomBox.height).toBeGreaterThanOrEqual(44);

  await page.goto("/#insights");
  const chart = page.locator(".ig-mini-line .growth-line");
  await chart.waitFor();
  const chartBox = await chart.boundingBox();
  expect(chartBox.height).toBeLessThanOrEqual(160);
});
