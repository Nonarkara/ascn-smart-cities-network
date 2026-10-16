#!/usr/bin/env node
/**
 * Capture digital-twin thumbnails for the hover previews.
 *
 * The existing media/twins/*.jpg are full-viewport captures of each live
 * dashboard at 1024px, taken after map tiles settle. This reproduces that
 * framing for any twin that is missing a thumbnail, so the hover strip is
 * visually consistent rather than a mix of sizes.
 *
 * Usage: node scripts/capture-twins.mjs [slug ...]
 *   slugs resolve to https://<slug>.nonarkara.org and media/twins/<slug>.jpg
 * With no arguments it captures every slug in TWINS that has no file yet.
 */

import { chromium } from "@playwright/test";
import { mkdir, access, stat, rm } from "node:fs/promises";
import { constants } from "node:fs";

/* 1024 wide. Phuket's map canvas collapses to zero width below its layout
 * breakpoint, so its capture shows a blank map band (upstream defect, not a
 * capture bug). Widening to 1440 sizes the canvas correctly but the page then
 * fails to screenshot at all — WebGL + headless GPU. Verified both ways. */
const WIDTH = 1024;

// Slug -> the live dashboard that shows it. Bangkok is served by the 3D atlas.
const TWINS = [
  { slug: "phuket", url: "https://phuket.nonarkara.org" },
  { slug: "bangkok", url: "https://atlas.nonarkara.org" },
  { slug: "chonburi", url: "https://chonburi.nonarkara.org" },
  { slug: "kuching", url: "https://kuching.nonarkara.org" },
  { slug: "jakarta", url: "https://jakarta.nonarkara.org" },
  { slug: "kl", url: "https://kl.nonarkara.org" },
  { slug: "hcmc", url: "https://hcmc.nonarkara.org" },
  { slug: "cnx", url: "https://cnx.nonarkara.org/cnx" },
];

const exists = async (path) => access(path, constants.F_OK).then(() => true, () => false);
const sizeOf = async (path) => (await stat(path)).size;

/**
 * A dashboard that crashes on load still screenshots to a perfectly valid JPEG
 * of a blank page. Shipping that would put a white rectangle on the site
 * pretending to be a city. Refuse instead: require rendered content first, and
 * require the capture to carry real image detail afterwards.
 */
async function renderedContent(page) {
  return page.evaluate(() => {
    const text = (document.body.innerText || "").trim().length;
    const media = document.querySelectorAll("canvas, img, svg, video").length;
    return { text, media };
  });
}

const MIN_TEXT = 40;
const MIN_BYTES = 25_000;

const wanted = process.argv.slice(2);
const force = wanted.includes("--force");
const slugs = wanted.filter((a) => !a.startsWith("--"));

let targets;
if (slugs.length) {
  targets = TWINS.filter((t) => slugs.includes(t.slug));
} else {
  // Resolve existence first: await is not allowed inside a sync filter.
  const present = new Map();
  for (const t of TWINS) present.set(t.slug, await exists(`media/twins/${t.slug}.jpg`));
  targets = TWINS.filter((t) => force || !present.get(t.slug));
}

if (!targets.length) {
  console.log("nothing to capture: every twin already has a thumbnail");
  process.exit(0);
}

await mkdir("media/twins", { recursive: true });
const browser = await chromium.launch();
let failed = 0;

for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 720 } });
  const out = `media/twins/${t.slug}.jpg`;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0].slice(0, 120)));
  try {
    await page.goto(t.url, { waitUntil: "networkidle", timeout: 45_000 });
  } catch {
    console.log(`  ${t.slug}: navigation timed out, capturing what loaded`);
  }
  // Map tiles stream in after first paint; give them time to settle so the
  // capture is not a grey grid.
  await page.waitForTimeout(6000);

  const content = await renderedContent(page);
  if (content.text < MIN_TEXT && content.media === 0) {
    console.log(`  ${t.slug}: SKIPPED - page rendered nothing (${content.text} chars of text)`);
    if (errors.length) console.log(`          first error: ${errors[0]}`);
    console.log(`          ${t.url} is not producing a usable capture. Fix the site, then re-run.`);
    await page.close();
    failed++;
    continue;
  }

  try {
    // A page with a live map or animation can keep the compositor busy past the
    // default timeout; one dead twin must not abort the whole run.
    await page.screenshot({ path: out, type: "jpeg", quality: 82, timeout: 60_000 });
  } catch (e) {
    console.log(`  ${t.slug}: REJECTED - screenshot failed (${String(e.message).split("\n")[0]})`);
    await rm(out, { force: true }).catch(() => {});
    await page.close();
    failed++;
    continue;
  }
  const bytes = await sizeOf(out);
  if (bytes < MIN_BYTES) {
    console.log(`  ${t.slug}: REJECTED - capture is ${bytes} bytes, almost certainly blank`);
    await rm(out, { force: true });
    await page.close();
    failed++;
    continue;
  }
  console.log(`  ${t.slug}: captured ${t.url} (${Math.round(bytes / 1024)} KB)`);
  await page.close();
}

await browser.close();
if (failed) process.exit(1);
