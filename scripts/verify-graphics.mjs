import { chromium, devices } from "@playwright/test";

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const browser = await chromium.launch();
const results = [];
const ok = (label, pass, detail = "") => results.push({ pass, label, detail });

async function newPage(viewport = { width: 1280, height: 900 }, isMobile = false) {
  const page = await browser.newPage(isMobile ? { ...devices["iPhone 13"] } : { viewport });
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message.split("\n")[0]));
  page.on("requestfailed", (r) => failures.push(`REQFAIL ${r.url().slice(0, 90)}`));
  return { page, failures };
}

/* ── Record view: charts ─────────────────────────────────────────────────── */
{
  const { page, failures } = await newPage();
  await page.goto(`${BASE}/#record`, { waitUntil: "networkidle" });
  await page.waitForSelector("#rec-stack-chart .rec-col", { timeout: 15_000 });

  const cols = await page.locator("#rec-stack-chart .rec-col").count();
  ok("stacked series chart renders one column per cycle", cols === 5, `${cols} columns`);

  const segs = await page.locator("#rec-stack-chart .rec-seg").count();
  ok("four cycles split into three status segments", segs === 12, `${segs} segments`);

  const bars = await page.locator("#rec-urban-bars .rec-ubar").count();
  ok("urbanisation bars render for every member state", bars === 11, `${bars} bars`);

  const top = await page.locator("#rec-urban-bars .rec-ubar-top .rec-ubar-name").textContent();
  ok("the most urbanised state is ranked first", top?.trim() === "Singapore", String(top));

  // The graphic must be readable, not merely present.
  const colText = await page.locator("#rec-stack-chart .rec-col").nth(4).innerText();
  ok("the 2025 column states its own total and counts", /134/.test(colText) && /18/.test(colText), colText.replace(/\n/g, " "));

  // Proportion is a correctness property, not taste. These graphics summarise
  // full-width tables; stretching the summary to the page width made the data
  // the smallest thing on screen. A five-column chart read at 5.3:1 with its
  // counts at 11px is not a chart, so both are asserted, not eyeballed.
  const scale = await page.evaluate(() => {
    const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const chart = rect("#rec-stack-chart");
    const urban = rect("#rec-urban-bars");
    const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
    return {
      chartAspect: chart.width / chart.height,
      urbanAspect: urban.width / urban.height,
      segFont: px("#rec-stack-chart .rec-seg b"),
      bodyFont: px("body"),
      nameFont: px("#rec-urban-bars .rec-ubar-name"),
    };
  });
  ok("the series chart is not stretched into a banner",
    scale.chartAspect < 3.5, `${scale.chartAspect.toFixed(2)}:1`);
  ok("the ranked list is not stretched into a banner",
    scale.urbanAspect < 3.5, `${scale.urbanAspect.toFixed(2)}:1`);
  ok("the counts are at least as large as body text",
    scale.segFont >= scale.bodyFont, `${scale.segFont}px vs body ${scale.bodyFont}px`);
  ok("state names are at least as large as body text",
    scale.nameFont >= scale.bodyFont, `${scale.nameFont}px vs body ${scale.bodyFont}px`);

  ok("no page errors on the Record view", failures.length === 0, failures.slice(0, 2).join(" | "));
  await page.close();
}

/* ── Innovation view: twin previews ──────────────────────────────────────── */
{
  const { page, failures } = await newPage();
  await page.goto(`${BASE}/#innovation`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-twin="phuket"]', { timeout: 15_000 });

  // Eight cities are declared in markup; Chonburi drops out at runtime because
  // its dashboard does not render, so seven is the correct marked count. The
  // exclusion itself is asserted separately below.
  const twinned = await page.locator(".iaas-card[data-twin]").count();
  ok("twinned city cards are marked", twinned === 7, `${twinned} cards`);

  // The hover-peek system must not fetch before intent. The Row-03 city cards
  // already carry visible .twin-thumb images that are meant to load on view,
  // so "no twin request at all" is the wrong assertion — it fails on intended
  // behaviour. These two checks target the peeks precisely: the peek-only files
  // (phuket, kl — used nowhere else on the page) and the injected node itself.
  const early = [];
  page.on("request", (r) => { if (/media\/twins\/.+\.(jpg|png)/.test(r.url())) early.push(r.url()); });
  await page.waitForTimeout(1500);

  const peeksBefore = await page.locator(".twin-peek").count();
  ok("no hover preview is attached before intent", peeksBefore === 0, `${peeksBefore} attached`);

  const peekOnlyEarly = early.filter((u) => /phuket|kl\.jpg/.test(u));
  ok("peek-only screenshots are not fetched before intent", peekOnlyEarly.length === 0, peekOnlyEarly.slice(0, 2).join(" | "));

  const card = page.locator('[data-twin="phuket"]');
  await card.hover();
  await page.waitForSelector('[data-twin="phuket"] .twin-peek img', { timeout: 10_000 });
  await page.waitForTimeout(1200);

  const src = await page.locator('[data-twin="phuket"] .twin-peek img').getAttribute("src");
  ok("hover attaches the correct preview", src === "media/twins/phuket.jpg", String(src));

  const loaded = await page.locator('[data-twin="phuket"] .twin-peek img').evaluate(
    (el) => el.complete && el.naturalWidth > 0);
  ok("the preview image actually decodes", loaded === true);

  const box = await page.locator('[data-twin="phuket"] .twin-peek').boundingBox();
  ok("the preview has real dimensions on screen", !!box && box.width > 150 && box.height > 80, JSON.stringify(box));

  // A city whose dashboard is not rendering must not advertise a preview.
  const chonburi = await page.locator('[data-twin="chonburi"]').count();
  ok("a dashboard that does not render is not marked as twinned", chonburi === 0);

  // Every marked city must have a distinct, correct file. Status alone is not
  // proof: this host rewrites unknown paths to index.html with HTTP 200, so a
  // missing JPEG passes a status check while serving HTML. Require the image.
  const marked = await page.locator(".iaas-card[data-twin]").evaluateAll((els) => els.map((e) => e.dataset.twin));
  for (const slug of marked) {
    const res = await page.request.get(`${BASE}/media/twins/${slug}.jpg`);
    const type = res.headers()["content-type"] || "";
    const bytes = (await res.body()).byteLength;
    const isJpeg = type.startsWith("image/jpeg") && bytes > 10_000;
    ok(`preview file is a real JPEG for ${slug}`, res.status() === 200 && isJpeg,
      `status=${res.status()} type=${type} bytes=${bytes}`);
  }

  // Negative control. If the host ever stops rewriting missing paths to HTML,
  // this assertion silently stops testing anything — so assert the sentinel
  // explicitly: a file that cannot exist must NOT read as a valid JPEG.
  const ghost = await page.request.get(`${BASE}/media/twins/__no-such-city__.jpg`);
  const ghostType = ghost.headers()["content-type"] || "";
  const ghostBytes = (await ghost.body()).byteLength;
  ok("the JPEG check rejects a missing file (control)",
    !(ghost.status() === 200 && ghostType.startsWith("image/jpeg") && ghostBytes > 10_000),
    `status=${ghost.status()} type=${ghostType} bytes=${ghostBytes}`);

  // Hover must actually pull the image, or the lazy path is just "never load".
  ok("hover is what triggers the peek fetch", early.some((u) => /phuket/.test(u)), early.join(" | ") || "no twin request seen");
  ok("no page errors on the Innovation view", failures.length === 0, failures.slice(0, 2).join(" | "));
  await page.close();
}

/* ── Type ramp and rules resolve, not collapse ───────────────────────────── */
{
  const { page } = await newPage();
  await page.goto(`${BASE}/#record`, { waitUntil: "networkidle" });
  const sizes = await page.evaluate(() => {
    const seen = new Set();
    for (const el of document.querySelectorAll("#view-record *, #view-innovation *")) {
      const t = getComputedStyle(el).fontSize;
      if (el.textContent?.trim() && t) seen.add(t);
    }
    return [...seen].map(parseFloat).sort((a, b) => a - b);
  });
  ok("the rendered Record view uses a small type ramp", sizes.length <= 12, `${sizes.length} sizes: ${sizes.join(", ")}`);

  const rule = await page.evaluate(() => {
    const el = document.querySelector(".rec-urban-row") || document.querySelector(".corr-item");
    if (!el) return null;
    const c = getComputedStyle(el).borderBottomColor;
    const m = c.match(/\d+/g)?.map(Number);
    if (!m) return null;
    const [r, g, b] = m;
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    const L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    const bg = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
    const fb = bg.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
    const LB = 0.2126 * fb[0] + 0.7152 * fb[1] + 0.0722 * fb[2];
    return (Math.max(L, LB) + 0.05) / (Math.min(L, LB) + 0.05);
  });
  ok("record rules are actually visible against the page", rule !== null && rule >= 3, rule ? `${rule.toFixed(2)}:1` : "no rule found");
  await page.close();
}

/* ── Mobile: previews must not be the only route ─────────────────────────── */
{
  const { page } = await newPage({ width: 390, height: 844 }, true);
  await page.goto(`${BASE}/#innovation`, { waitUntil: "networkidle" });
  const linkVisible = await page.locator('[data-twin="phuket"] .iaas-card-link').isVisible();
  ok("the dashboard link stays usable on a phone", linkVisible === true);
  const peekShown = await page.locator(".twin-peek").first().isVisible().catch(() => false);
  ok("hover previews are suppressed on a phone where they cannot work", peekShown === false);
  await page.close();
}

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) { failed++; console.log(`  FAIL  ${r.label}${r.detail ? `  [${r.detail}]` : ""}`); }
}
console.log(`Graphics and previews: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
