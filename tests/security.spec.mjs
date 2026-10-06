import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function data(name) {
  return JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url)));
}

test("security headers enforce script and frame protections without blocking video controls", async ({ page }) => {
  const response = await page.goto("/#overview");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["content-security-policy"]).not.toMatch(/script-src[^;]*unsafe-/);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["permissions-policy"]).toContain("fullscreen=(self)");
  await expect(page.locator("#kpi-grid .kpi").first()).toContainText("38");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.__injectedScriptRan = true";
    document.body.append(script);
  });
  expect(await page.evaluate(() => window.__injectedScriptRan)).toBeUndefined();
});

test("data-supplied executable links are neutralized and project exports are spreadsheet-safe", async ({ page }) => {
  const knowledge = await data("ascn-knowledge.json");
  knowledge.perspective.url = "javascript:window.__unsafeLinkRan=true";
  const engine = await data("ascn-v2-data.json");
  engine.projects.find((project) => project.report_year === engine.reports.at(-1).year).project = '=HYPERLINK("https://example.com","test")';
  await page.route("**/data/ascn-knowledge.json*", (route) => route.fulfill({ json: knowledge }));
  await page.route("**/data/ascn-v2-data.json*", (route) => route.fulfill({ json: engine }));
  await page.goto("/#overview");
  await expect(page.locator(".persp-link")).toHaveAttribute("href", "#");
  await page.locator('#tab-nav [data-tab="projects"]').click();
  await expect(page.locator("#project-table")).toContainText("=HYPERLINK");
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-csv").click();
  const file = await downloaded;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString("utf8")).toContain('"\'=HYPERLINK');
});

test("map tooltips render hostile city text as text instead of HTML", async ({ page }) => {
  const cities = await data("ascn-cities.json");
  cities.cities[0].name = '<img src=x onerror="window.__tooltipRan=true">';
  await page.route("**/data/ascn-cities.json*", (route) => route.fulfill({ json: cities }));
  await page.goto("/#cities");
  await expect(page.locator("#sea-map .leaflet-interactive")).toHaveCount(38);
  await page.locator("#sea-map .leaflet-interactive").first().hover({ force: true });
  await expect(page.locator(".leaflet-tooltip")).toContainText("<img src=x");
  await expect(page.locator(".leaflet-tooltip img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__tooltipRan)).toBeUndefined();
});

test("malformed critical datasets fail visibly while the independent video selector still works", async ({ page }) => {
  const engine = await data("ascn-v2-data.json");
  engine.reports[0].year = "<img src=x onerror=alert(1)>";
  await page.route("**/data/ascn-v2-data.json*", (route) => route.fulfill({ json: engine }));
  await page.goto("/#overview");
  await expect(page.locator(".load-error")).toContainText("invalid report.year");
  await page.locator('[data-video="flood-analysis"]').click();
  await expect(page.locator("#showcase-title")).toHaveText("From flood data to decisions");
});

test("all existing routes render with working maps, charts, filters, and no CSP regressions", async ({ page }) => {
  test.setTimeout(60_000);
  const errors = [];
  const policyViolations = [];
  const externalScripts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/content security policy|violates.*directive/i.test(message.text())) policyViolations.push(message.text());
  });
  page.on("request", (request) => {
    if (request.resourceType() === "script" && new URL(request.url()).hostname === "unpkg.com") externalScripts.push(request.url());
  });
  await page.goto("/#overview");
  await expect(page.locator("#kpi-grid .kpi")).toHaveCount(5);
  for (const tab of ["news", "history", "cities", "projects", "framework", "partners", "contacts", "insights", "data", "research", "essay"]) {
    await page.locator(`#tab-nav [data-tab="${tab}"]`).click();
    await expect(page.locator(`#view-${tab}`)).toBeVisible();
    expect(await page.locator(`#view-${tab}`).innerText()).not.toBe("");
  }
  await page.locator('#tab-nav [data-tab="cities"]').click();
  await expect(page.locator("#sea-map .leaflet-interactive")).toHaveCount(38);
  await expect.poll(() => page.locator("#sea-map .leaflet-tile").evaluateAll((images) =>
    images.some((image) => image.complete && image.naturalWidth > 0)), { timeout: 15_000 }).toBe(true);
  await page.locator("#city-search").fill("Bangkok");
  await page.getByRole("button", { name: /Bangkok Thailand Joined/ }).click();
  await expect(page.locator("#city-detail h2")).toHaveText("Bangkok");
  await page.locator('#tab-nav [data-tab="insights"]').click();
  await expect(page.locator("#ig-data-quality .dq-grid")).toBeVisible();
  expect(await page.locator("#view-insights svg").count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  expect(policyViolations).toEqual([]);
  expect(externalScripts).toEqual([]);
});
