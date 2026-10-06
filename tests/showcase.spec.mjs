import { test, expect } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

const clips = [
  { id: "flood-field", title: "Flood intelligence in the field", duration: 274 },
  { id: "city-operations", title: "City operations on one screen", duration: 441 },
  { id: "flood-analysis", title: "From flood data to decisions", duration: 444 },
];

test("media preserves complete recordings and stays within the hosting limit", async () => {
  const metadata = JSON.parse(await readFile(new URL("../media/showcase/metadata.json", import.meta.url)));
  expect(metadata).toHaveLength(3);
  for (const clip of clips) {
    const item = metadata.find((record) => record.id === clip.id);
    expect(Math.abs(item.duration - clip.duration)).toBeLessThan(1);
    expect(item.videoCodec).toBe("h264");
    expect(item.audioCodec).toBe("aac");
    const file = await stat(new URL(`../media/showcase/${clip.id}.mp4`, import.meta.url));
    expect(file.size).toBe(item.bytes);
    expect(file.size).toBeLessThan(25 * 1024 * 1024);
  }
});

test("loads no video on arrival; all selections decode, play, and pause on navigation", async ({ page }) => {
  const requests = [];
  const errors = [];
  page.on("request", (request) => { if (request.url().includes(".mp4")) requests.push(request.url()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#overview");
  await expect(page.locator("#kpi-grid .kpi").first()).toContainText("38");
  await expect(page.locator("#showcase-selector")).toBeVisible();
  expect(requests).toEqual([]);
  const player = page.locator("#showcase-player");
  expect(await player.evaluate((video) => ({ paused: video.paused, autoplay: video.autoplay })))
    .toEqual({ paused: true, autoplay: false });

  for (const clip of clips) {
    await page.locator(`[data-video="${clip.id}"]`).click();
    await expect(page.locator("#showcase-title")).toHaveText(clip.title);
    await expect(page.locator(".showcase-clip[aria-pressed='true']")).toHaveCount(1);
    await expect(player).toHaveAttribute("aria-label", clip.title);
    await expect(page.locator("#showcase-open")).toHaveAttribute("href", `media/showcase/${clip.id}.mp4`);
    await player.evaluate(async (video) => { video.muted = true; await video.play(); });
    await expect.poll(() => player.evaluate((video) => video.currentTime)).toBeGreaterThan(0.1);
    // Pages' local simulator streams without range headers; verify seeking on the real host.
    if (process.env.ASCN_TEST_URL && !["127.0.0.1", "localhost"].includes(new URL(process.env.ASCN_TEST_URL).hostname)) {
      await player.evaluate((video) => { video.currentTime = 90; });
      await expect.poll(() => player.evaluate((video) => video.currentTime), { timeout: 15_000 }).toBeGreaterThan(90.1);
    }
    const frame = await player.evaluate((video) => {
      const canvas = document.createElement("canvas");
      canvas.width = 32; canvas.height = 18;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, 32, 18);
      const pixels = context.getImageData(0, 0, 32, 18).data;
      const values = [...pixels].filter((_, index) => index % 4 !== 3);
      return { width: video.videoWidth, range: Math.max(...values) - Math.min(...values), error: video.error };
    });
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.range).toBeGreaterThan(20);
    expect(frame.error).toBeNull();
  }

  await page.locator(".meeting-summary").click();
  await expect(page.locator("#view-ascn9")).toBeVisible();
  await expect(page.locator("#view-ascn9 h1")).toHaveText("What they actually did");
  expect(await page.locator(".record-photo").count()).toBeGreaterThan(3);
  await expect.poll(() => player.evaluate((video) => video.paused)).toBe(true);
  await page.locator(".record-back").click();
  await expect(player).toBeVisible();
  await expect(page.locator("#showcase-title")).toHaveText(clips[2].title);
  await expect(page.locator("#kpi-grid .kpi")).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("unavailable video shows a recovery link and changing selection clears the error", async ({ page }) => {
  await page.route("**/media/showcase/city-operations.mp4", (route) => route.fulfill({ status: 404 }));
  await page.goto("/#overview");
  await page.locator('[data-video="city-operations"]').click();
  await page.locator("#showcase-player").evaluate((video) => { video.muted = true; video.play().catch(() => {}); });
  await expect(page.locator("#showcase-error")).toBeVisible();
  await expect(page.locator("#showcase-open")).toHaveAttribute("href", "media/showcase/city-operations.mp4");
  await page.locator('[data-video="flood-field"]').click();
  await expect(page.locator("#showcase-error")).toBeHidden();
});

for (const width of [1280, 768, 390, 375]) {
  test(`overview fits at ${width}px with visible posters and a working meeting link`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
    await page.goto("/#overview");
    await expect(page.locator("#kpi-grid .kpi").first()).toContainText("38");
    await expect(page.locator(".showcase-clip")).toHaveCount(3);
    await expect.poll(() => page.locator(".showcase-clip img").evaluateAll((images) =>
      images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`viewport-${width}.png`) });
    const layout = await page.evaluate(() => ({
      width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      showcaseBottom: document.querySelector(".innovation-showcase").getBoundingClientRect().bottom,
      meetingTop: document.querySelector(".meeting-summary").getBoundingClientRect().top,
    }));
    expect(layout.scroll).toBe(layout.width);
    expect(layout.meetingTop).toBeGreaterThan(layout.showcaseBottom);
    await page.screenshot({ path: testInfo.outputPath(`overview-${width}.png`), fullPage: true });
    await page.locator(".meeting-summary").click();
    await expect(page.locator("#view-ascn9")).toBeVisible();
  });
}
