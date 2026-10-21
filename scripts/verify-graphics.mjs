import { chromium, devices } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { outsidePalette, shorterMeasure, longestHeadingLine, mediaCaptionFits } from "./visual-audit-rules.mjs";

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const fetch = (input, options = {}) => globalThis.fetch(input, { ...options, signal: options.signal || AbortSignal.timeout(20000) });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const results = [];
const ok = (label, pass, detail = "", findings = []) => results.push({ pass, label, detail, ...(findings.length ? { findings } : {}) });


// The shell has two screens and only one of them is visible at a time below
// 860px: the index rail on the phone until a section is opened, then the
// plate. Waiting for the nav alone therefore times out on every mobile pass,
// and the old `.site-nav` target it used no longer exists at all after the
// restructure. Wait for whichever screen is actually on.
async function waitForShell(page, timeout = 20_000) {
  await page.waitForFunction(() => {
    const visible = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    };
    return visible("#tab-nav") || visible(".plate-bar");
  }, null, { timeout });
}

async function newPage(viewport = { width: 1280, height: 900 }, isMobile = false) {
  const page = await browser.newPage(isMobile ? { ...devices["iPhone 13"] } : { viewport });
  // Composition does not depend on whether an external publisher is reachable.
  // Exercise the real saved-data fallback; API contracts have separate tests.
  await page.route('**/api/{news,ascn-news}', (route) => route.fulfill({ status: 503, json: { checkedAt: new Date().toISOString(), articles: [], sources: [] } }));
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message.split("\n")[0]));
  page.on("requestfailed", (r) => {
    // /api/ascn-news is an OPTIONAL live-index check. Cloudflare's egress
    // cannot reach Google News, so it always fails there, and the app handles
    // it by design: it falls back to the snapshot that now ships from
    // data/ascn-news-discovery.json and labels the result "saved".
    //
    // Counting it as a page error made four unrelated checks fail for one
    // handled condition, which drowns out the errors a page-error check exists
    // to catch. Its health is asserted directly instead — see the discovery
    // freshness check.
    if (r.url().includes("/api/ascn-news")) return;
    failures.push(`REQFAIL ${r.url().slice(0, 90)}`);
  });
  return { page, failures };
}

let completed = false;
try {
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

/* ── Overview: the twins directory ───────────────────────────────────────── */
{
  const { page, failures } = await newPage();
  await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
  await page.waitForSelector(".twin-row", { timeout: 15_000 });

  // The strip is five across only when the plate is wide enough. The default
  // 1280px page leaves an 870px plate, where the strip is three across in two
  // rows, so the strip's own checks need a wide page of their own.
  const { page: wide } = await newPage({ width: 1920, height: 900 });
  await wide.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
  await wide.waitForSelector(".twin-row", { timeout: 15_000 });

  const rows = await page.locator(".twin-row").count();
  ok("every operational twin is listed as a row", rows === 5, `${rows} rows`);

  // The regression this guards: five equal-weight cards. Each carried a boxed
  // screenshot over 12px copy in a 209px measure — about 33 characters a line.
  //
  // The twins are now a five-across strip, and a five-across strip cannot
  // hold a 60-character column on any normal screen: the cell is ~260px, not
  // ~800px. The measure is therefore no longer the lever that can be pulled
  // to make the cell fit. The lever that must NOT be pulled is the type
  // size: a narrow cell is legitimate, shrunk-to-fit 11px copy inside it is
  // not. The check moved from the measure to the size, and the size is
  // asserted to be at least the body size.
  const caption = await page.locator(".twin-desc").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const w = el.getBoundingClientRect().width;
    const px = parseFloat(cs.fontSize);
    return { chars: Math.round(w / (px * 0.5)), size: px };
  });
  ok("twin captions keep body type size (not shrunk to fit the cell)",
    caption.size >= 13, `${caption.size}px, ~${caption.chars} chars per line`);

  // Five identical boxes have nothing to rank. Five names in a column gave
  // the eye a vertical to scan. In a strip the anchor turns: the five names
  // share one TOP edge and one baseline, so they read as one ranked row.
  const tops = await wide.locator(".twin-city").evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().top)));
  ok("the five city names share one anchor edge", new Set(tops).size === 1, tops.join(","));

  const citySize = await page.locator(".twin-city").first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const bodySize = await page.locator(".twin-desc").first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  ok("the city outranks its own description", citySize >= bodySize * 1.8,
    `${citySize}px vs ${bodySize}px`);

  // "Live" was stamped on all five cards while the heading already said
  // "operational" and the badge already said "Level 2". Redundant ink.
  //
  // Match the stamp, not the word. Matching /\bLive\b/ fires on "BKKX Live
  // Atlas", which is the product's real name — a guard that reports correct
  // content as a defect is worse than no guard, because it trains you to
  // ignore it. The redundancy was specifically the "Live ·" prefix.
  const stamped = await page.locator(".twin-meta").evaluateAll((els) =>
    els.filter((e) => /^\s*Live\b/.test(e.textContent || "")).length);
  ok("liveness is stated once, not stamped per row", stamped === 0,
    `${stamped} meta lines start with "Live"`);

  // Control: the pattern must actually catch the pattern. If the regex is
  // loosened to nothing, this assertion would pass forever and mean nothing.
  ok("the liveness guard catches a stamped row (control)", /^\s*Live\b/.test("Live · Flood edition"),
    "prefix match verified against the markup it replaced");

  // No elevation, and no alarm token borrowed for a hover.
  const twinCss = await page.evaluate(() => {
    const row = document.querySelector(".twin-row");
    const cs = getComputedStyle(row);
    return { shadow: cs.boxShadow, transform: cs.transform, bg: cs.backgroundColor };
  });
  ok("twin rows carry no elevation", twinCss.shadow === "none" && twinCss.transform === "none",
    `shadow=${twinCss.shadow} transform=${twinCss.transform}`);

  await page.locator(".twin-row").first().hover();
  const linkHover = await page.locator(".twin-row").first().evaluate((el) => {
    const a = el.querySelector(".twin-link-label");
    const probe = document.createElement('span'); probe.style.color = 'var(--navy)'; document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color; probe.remove();
    return { actual: a ? getComputedStyle(a).color : '', expected };
  });
  ok("the hovered twin URL keeps the wayfinding colour", linkHover.actual === linkHover.expected, JSON.stringify(linkHover));

  // The landscape composition. The page is a two-screen shell: a 420px index
  // rail and the content plate. Everything inside the plate must agree on its
  // left edge, or the page reads as parts that were never assembled with each
  // other.
  //
  // The edges compared are CONTENT edges. The previous version compared
  // #main-content's border box against the views inside it — but
  // #main-content carries the plate's own 13px padding, so the two were
  // always 13px apart and the check could only ever fail. The claim is that
  // the plate's bands line up with each other, so what is compared is where
  // the text of each band actually starts: the plate bar's kicker, the
  // locator's number, the view's first element and the twins grid.
  const edges = await page.evaluate(() => {
    const l = (s) => {
      const el = document.querySelector(s);
      return el ? Math.round(el.getBoundingClientRect().left) : null;
    };
    const plate = document.querySelector("main.plate");
    return {
      bar: l("#barKicker"),
      locator: l("#locatorNum"),
      view: l(".view"),
      grid: l(".twins-grid"),
      plateLeft: plate ? Math.round(plate.getBoundingClientRect().left) : null,
    };
  });
  ok("the plate's content bands share one left edge",
    edges.bar === edges.locator && edges.locator === edges.view && edges.view === edges.grid
      && edges.view > edges.plateLeft,
    `bar=${edges.bar} locator=${edges.locator} view=${edges.view} grid=${edges.grid} plate=${edges.plateLeft}`);

  // The page header stops being a single column with most of its right side
  // empty at landscape widths. Below 1100 it stacks; at landscape widths it
  // has exactly two grid tracks with content in both.
  const headerCols = await wide.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".twins-header"));
    return cs.gridTemplateColumns.split(" ").length;
  });
  ok("the twins header has two columns when the viewport allows it",
    headerCols === 2, `header has ${headerCols} grid column(s)`);

  // Five across, in one row, when the plate is wide enough. The previous
  // arrangement put each twin in its own row with a 779px image beside the
  // copy: the image became the subject at a scale it cannot carry, and the
  // copy became a caption stranded beside it. The strip puts the five
  // pictures in one row and lets each carry its own identity.
  const strip = await wide.evaluate(() => {
    const cells = [...document.querySelectorAll(".twin-row")];
    const grid = document.querySelector(".twins-grid");
    return {
      cells: cells.length,
      cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      oneRow: new Set(cells.map((c) => Math.round(c.getBoundingClientRect().top))).size === 1,
      cellWidth: Math.round(cells[0].getBoundingClientRect().width),
    };
  });
  ok("the five twins sit in one row", strip.cells === 5 && strip.oneRow && strip.cols === 5,
    `${strip.cells} cells, ${strip.cols} columns, one row=${strip.oneRow}, cell=${strip.cellWidth}px`);

  // ...and the five share one baseline grid. "HO CHI MINH CITY" wraps to two
  // lines and the longest caption is four, so without a shared grid the
  // captions and links of one cell sat lower than the other four and the row
  // lost its rules. The cells SUBGRID the parent's tracks, so this asserts
  // the three bands that can drift — the city names, the captions and the
  // links — all start on one line each.
  const baseline = await wide.evaluate(() => {
    const tops = (sel) => [...document.querySelectorAll(sel)]
      .map((el) => Math.round(el.getBoundingClientRect().top));
    return {
      names: new Set(tops(".twin-city")).size,
      metas: new Set(tops(".twin-meta")).size,
      descs: new Set(tops(".twin-desc")).size,
      links: new Set(tops(".twin-link-label")).size,
    };
  });
  ok("the five twins share one baseline grid",
    baseline.names === 1 && baseline.metas === 1 && baseline.descs === 1 && baseline.links === 1,
    `name tops=${baseline.names} distinct, meta tops=${baseline.metas}, caption tops=${baseline.descs}, link tops=${baseline.links}`);

  // No cell may push its own content past its own column.
  const spill = await wide.evaluate(() => {
    let worst = 0;
    document.querySelectorAll(".twin-row").forEach((cell) => {
      const cb = cell.getBoundingClientRect();
      cell.querySelectorAll(".twin-desc, .twin-link-label, .twin-city, .twin-meta").forEach((e) => {
        const b = e.getBoundingClientRect();
        worst = Math.max(worst, Math.round(b.right - cb.right));
      });
    });
    return worst;
  });
  ok("no twin cell spills past its column", spill <= 1, `${spill}px past the column edge`);

  ok("no page errors on the Overview twins directory", failures.length === 0, failures.slice(0, 2).join(" | "));
  await wide.close();
  await page.close();
}

/* ── Reading measure: no prose may outrun the eye ─────────────────────────── */
{
  // Past roughly 90 characters the return sweep fails and reading degrades
  // into scanning. This site had NO measure token at all: 167 of 278 prose
  // blocks ran past 90 characters and many ran to 208, because every section
  // stretched to the full 1248px column. This sweeps all views so a future
  // section cannot reintroduce it.
  const { page } = await newPage();
  const views = ["overview", "innovation", "record", "news", "history", "cities",
    "projects", "framework", "partners", "insights", "library", "research"];
  let worst = { chars: 0, where: "—" };
  const offenders = [];
  for (const v of views) {
    await page.goto(`${BASE}/#${v}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const found = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("p, li, dd, blockquote, figcaption")) {
        const r = el.getBoundingClientRect();
        if (r.width < 200 || r.height < 8) continue;
        if ((el.textContent || "").trim().length < 120) continue; // labels are not prose
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        // The measure of a prose block is the length of its LONGEST
        // RENDERED LINE, not the width of its box. A paragraph that runs in
        // two columns has a box as wide as the band and a line as wide as
        // the column; asking the box gave 154 characters for a line of 73.
        // The line boxes come from a Range, grouped by their top edge and
        // split again wherever the text jumps to the next column.
        const range = document.createRange();
        range.selectNodeContents(el);
        const byTop = new Map();
        for (const rect of range.getClientRects()) {
          if (rect.width <= 0 || rect.height <= 0) continue;
          const key = Math.round(rect.top);
          const runs = byTop.get(key) || [];
          let placed = false;
          for (const run of runs) {
            if (rect.left >= run.left - 2 && rect.left <= run.right + 2) {
              run.left = Math.min(run.left, rect.left);
              run.right = Math.max(run.right, rect.right);
              placed = true;
              break;
            }
          }
          if (!placed) runs.push({ left: rect.left, right: rect.right });
          byTop.set(key, runs);
        }
        let lineW = 0;
        for (const runs of byTop.values()) for (const run of runs) lineW = Math.max(lineW, run.right - run.left);
        if (!lineW) lineW = r.width;
        out.push({
          chars: Math.round(lineW / (parseFloat(cs.fontSize) * 0.5)),
          sel: el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ")[0],
          px: Math.round(parseFloat(cs.fontSize)),
        });
      }
      return out;
    });
    for (const f of found) {
      if (f.chars > worst.chars) worst = { chars: f.chars, where: `${v} ${f.sel} @${f.px}px` };
      if (f.chars > 90) offenders.push(`${v} ${f.sel}=${f.chars}`);
    }
  }
  ok("no prose block exceeds a readable measure", offenders.length === 0,
    offenders.length ? offenders.slice(0, 5).join(" | ") : `worst: ${worst.chars} chars (${worst.where})`);

  // Control. The assertion above is a number comparison, so if the measurement
  // ever silently returned zero the whole sweep would pass and test nothing.
  ok("the measure sweep measures something (control)", worst.chars > 20 && worst.chars <= 90,
    `worst observed ${worst.chars} chars`);

  // The cap must be in characters, not pixels, so 12px notes do not get a
  // longer line than 16px prose.
  //
  // Assert the TOKEN, not a computed max-width: getComputedStyle resolves
  // `ch` to px, so reading maxWidth here would fail forever while saying
  // nothing about how the cap was written.
  const measureToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--measure").trim());
  ok("the measure cap is expressed in ch, not px", /^[\d.]+ch$/.test(measureToken),
    `--measure: ${measureToken || "not defined"}`);

  const headToken = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--measure-heading").trim());
  ok("headings carry a shorter measure than prose", shorterMeasure(headToken, measureToken),
    `--measure-heading: ${headToken || "not defined"} vs --measure: ${measureToken}`);
  await page.close();
}

/* ── Heading measure and ramp ────────────────────────────────────────────── */
{
  // Measure the ACTUAL longest rendered line, never the container. A heading
  // like "Jakarta" sits in a 1248px column but fills seven characters of it;
  // a container-width metric reports that as a 156-character heading and buries
  // the real offender. Range client rects come back one per line box.
  const { page } = await newPage();
  await page.addInitScript(`window.longestHeadingLine = ${longestHeadingLine.toString()}`);
  const views = ["overview", "innovation", "record", "news", "history", "cities",
    "projects", "framework", "partners", "insights", "library", "research", "essay"];
  const long = [];
  let smallHeadings = [];
  let measured = 0;
  const perView = [];
  for (const v of views) {
    await page.goto(`${BASE}/#${v}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(450);
    const f = await page.evaluate((route) => {
      const over = [], tiny = [];
      let n = 0;
      // The floor is the BODY step, read from the token — not a literal. It
      // was `px < 14`, an absolute number calibrated when the body was 16px,
      // and it outlived the type system it described: on a 13px body it
      // flagged every heading sitting exactly AT the body step, which the
      // ladder explicitly allows ("a sub-heading is a heading at a smaller
      // weight, not a new size"). Deriving the floor from --t-body keeps the
      // rule meaning what it says after the next body-size change.
      const bodyPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--t-body")) || 16;
      for (const el of document.querySelectorAll("h1,h2,h3,h4,h5")) {
        if (!el.checkVisibility()) continue;
        const t = (el.textContent || "").trim();
        if (!t) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        n++;
        if (px < bodyPx) tiny.push(`${el.tagName}.${String(el.className).split(" ")[0]}@${px}px (body ${bodyPx}px)`);
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter((x) => x.width > 4);
        if (!rects.length) continue;
        const lines = new Set(rects.map((x) => Math.round(x.top))).size;
        // Characters on the longest line, counted from the line boxes the
        // browser actually produced. The previous version divided line width
        // by an assumed average glyph advance (px * 0.5), which is a proxy for
        // a measurement — and a proxy loose enough that swapping Helvetica for
        // a wider face moved a page from "passing" to "failing" without any
        // change in how the text actually wrapped.
        const chars = window.longestHeadingLine(el);
        // The budget tightens as the type grows, because a display heading is
        // harder to scan back from than a section heading. Display (32px+)
        // gets 40, section headings get the A4 body ceiling of 55, and
        // body-sized headings get 56.
        //
        // It used to be `chars / (px / 16) > 55`, which divided by the rem size
        // and so penalised SMALL type hardest: a 13px h3 at 52 characters
        // scored 64 and failed, while a 48px h1 could run 150 characters and
        // score 9 — the opposite of what the comment above it says the rule is
        // for. The bands below are absolute, chosen against the A4 rule's own
        // figures (45-75 characters) rather than against whatever the old
        // formula happened to let through.
        const budget = px >= 32 ? 40 : px >= 20 ? 55 : 56;
        if (chars > budget) over.push(`${route} ${el.tagName}.${String(el.className).split(" ")[0]}=${chars}ch over ${lines} line(s), budget ${budget}`);
      }
      return { over, tiny, n };
    }, v);
    measured += f.n;
    perView.push(f.n);
    long.push(...f.over);
    if (f.tiny.length) smallHeadings = smallHeadings.concat(f.tiny);
  }
  ok("no heading runs a line too long to scan back from", long.length === 0,
    long.length ? long.slice(0, 4).join(" | ") : `${measured} headings swept`, long);

  // The seven Roman-numeral section headings of the flagship essay were 12px —
  // the only headings on the site on the micro step, and a different size from
  // their own class sibling "Executive Summary".
  ok("no heading is set below the body step", smallHeadings.length === 0,
    smallHeadings.length ? [...new Set(smallHeadings)].slice(0, 4).join(" | ") : "none under 14px");

  // Control for the sweep itself.
  //
  // The old control was `measured > 200` — a magic number calibrated on an
  // architecture the site no longer has, and it had been failing on the
  // deployed build before this change: the sweep finds 175 headings across
  // the thirteen views, which is a real sweep, not a vacuous one. A control
  // that is red for the right reason teaches nobody anything.
  //
  // What the control has to prove is that the sweep REACHED every view it
  // claims to sweep. A view that fails to mount contributes nothing, and a
  // total alone cannot tell "thirteen views, all visited" from "one view,
  // visited thirteen times". So the control counts per view and requires
  // every one of them to contribute a heading.
  const emptyViews = views.filter((_, i) => perView[i] === 0);
  ok("the heading sweep visits real headings (control)",
    emptyViews.length === 0 && measured >= views.length,
    emptyViews.length
      ? `${views.length - emptyViews.length}/${views.length} views contributed; empty: ${emptyViews.join(", ")}`
      : `${measured} headings swept across ${views.length} views (${perView.join("/")})`);

  // Negative control for the counter above: strip the headings out of the
  // page and the counter must return zero. A counter that returned a
  // constant would make every view "pass" the requirement above while
  // measuring nothing at all.
  const counter = await page.evaluate(() => {
    const count = () => [...document.querySelectorAll("h1,h2,h3,h4,h5")]
      .filter((el) => el.checkVisibility() && (el.textContent || "").trim()).length;
    const before = count();
    const nodes = [...document.querySelectorAll("h1,h2,h3,h4,h5")];
    nodes.forEach((n) => n.remove());
    return { before, after: count() };
  });
  ok("the heading counter falls to zero when the headings are gone (control)",
    counter.before > 0 && counter.after === 0, JSON.stringify(counter));

  // The regression that nearly shipped: the measure rules were written as
  // `main .view :is(...)`, but the SPA mounts several of its 15 view panels
  // directly on <body> — Research among them — so the cap silently skipped
  // them and those card titles still computed `max-width: none`.
  //
  // Assert over every prose element in every stray view, not the first match.
  // Views that render lazily hold no prose at all when this runs, and a view
  // with nothing in it is vacuously capped — sampling one element reported an
  // empty panel as a failure and sent me looking for a defect that was not there.
  const mounted = await page.evaluate(() => {
    const stray = [...document.querySelectorAll("section.view")].filter((s) => !s.closest("main"));
    let uncapped = [];
    let viewsWithProse = 0;
    for (const s of stray) {
      const els = [...s.querySelectorAll("p, li, h1, h2, h3, h4, blockquote, figcaption")]
        .filter((el) => (el.textContent || "").trim().length >= 60);
      if (!els.length) continue;
      viewsWithProse++;
      for (const el of els) {
        if (getComputedStyle(el).maxWidth === "none")
          uncapped.push(`${s.id || "?"} ${el.tagName}.${String(el.className).split(" ")[0]}`);
      }
    }
    return { stray: stray.length, viewsWithProse, uncapped: [...new Set(uncapped)] };
  });
  ok("views mounted outside <main> are still capped", mounted.uncapped.length === 0,
    mounted.uncapped.length
      ? mounted.uncapped.slice(0, 4).join(" | ")
      : `${mounted.viewsWithProse} of ${mounted.stray} stray views hold prose, all capped`);
  await page.close();
}

/* ── Editorial aside: prose must not stand beside a void ─────────────────── */
{
  // The measure fix capped prose at 72ch and left the right half of a 1248px
  // column empty — roughly 900px of void beside the argument. Narrowing the
  // text and stopping there moved the imbalance rather than resolving it.
  const { page, failures } = await newPage();
  await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
  await page.waitForSelector(".persp-aside img", { timeout: 15_000 });

  const figs = await page.locator(".persp-aside figure").count();
  ok("the perspective carries an editorial aside", figs >= 1, `${figs} figures`);

  // Every aside image must declare its intrinsic size. With `height: auto` and
  // loading="lazy" the box collapses to 2px until the fetch lands, which is
  // layout shift — and below the fold it never resolves during the check.
  const intrinsic = await page.locator(".persp-aside img").evaluateAll((els) =>
    els.map((i) => ({ w: i.getAttribute("width"), h: i.getAttribute("height") })));
  ok("aside images reserve their space before they load",
    intrinsic.length > 0 && intrinsic.every((i) => i.w && i.h),
    JSON.stringify(intrinsic));

  const boxes = await page.locator(".persp-aside img").evaluateAll((els) =>
    els.map((i) => Math.round(i.getBoundingClientRect().height)));
  ok("no aside image collapses to nothing", boxes.every((h) => h > 40), boxes.join(" x "));

  // The aside must not be clipped by the text measure. `none` and `100%` are both
  // correct here — `100%` is the global image reset and means "no wider than
  // its container", which is what we want. Only a ch/rem/px measure would be a
  // defect, because that is prose geometry applied to a picture.
  const cap = await page.locator(".persp-aside img").first()
    .evaluate((el) => getComputedStyle(el).maxWidth);
  ok("aside images are not constrained to a text measure",
    cap === "none" || cap.endsWith("%"), cap);

  // ...and must not push the page sideways.
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("the aside introduces no horizontal overflow", !overflow, overflow ? "overflowing" : "clean");

  ok("no page errors on the Overview aside", failures.length === 0, failures.slice(0, 2).join(" | "));
  await page.close();
}

/* ── Discovery index freshness ───────────────────────────────────────────── */
{
  // The live endpoint cannot reach Google News from Cloudflare's egress, and
  // that is not fixable from this side. It is also no longer load-bearing:
  // `predeploy` refreshes the snapshot from a machine that can, and the page
  // falls back to it. So the real risk is not "the fetch fails" — it is "the
  // snapshot silently rots", which is what this asserts.
  const res = await fetch(`${BASE}/data/ascn-news-discovery.json`);
  const snap = await res.json();
  const articles = snap.articles || [];
  const ageDays = (Date.now() - Date.parse(snap.checkedAt)) / 86_400_000;

  ok("the shipped discovery snapshot has leads to show", articles.length > 0,
    `${articles.length} leads`);
  ok("the discovery snapshot is recent enough to be useful", ageDays <= 45,
    `${ageDays.toFixed(1)} days old (checkedAt ${snap.checkedAt})`);

  // And the page must actually render them, whichever path it took.
  const { page, failures } = await newPage();
  await page.goto(`${BASE}/#news`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const shown = await page.locator("#discovery-results article").count();
  ok("the reader sees discovery leads", shown > 0, `${shown} rendered`);
  ok("no unhandled page errors on the News view", failures.length === 0,
    failures.slice(0, 2).join(" | "));
  await page.close();
}

/* ── Cache busting: new markup must never meet an old stylesheet ─────────── */
{
  // The failure this exists to catch, observed in production: `?v=` was a
  // hand-maintained counter that went unbumped across four deploys that all
  // rewrote styles.css and app.js. Assets are served with max-age=14400, so a
  // visitor got the NEW markup against a stylesheet up to four hours old. The
  // twins directory rendered as five unstyled inline <a> elements in a
  // five-column grid, overlapping the KPI row. Nothing in the build failed;
  // the page was simply wrong on someone else's screen.
  //
  // Assert the contract directly: the version in the document must equal the
  // hash of the bytes actually being served.
  const indexRes = await fetch(`${BASE}/`);
  const html = await indexRes.text();
  // EVERY hashed reference, not the first one. Checking only the match at the
  // top of the document meant styles.css was verified and app.js and archive.js
  // were not — so the moment a new script was added with a hand-typed counter,
  // this check would still have reported green.
  const refs = [...html.matchAll(/(?:href|src)="([^"?#:]+\.(?:css|js))(?:\?v=([^"]*))?"/g)]
    .map((m) => ({ file: m[1], declared: m[2] }));
  ok("assets are cache-busted from content, not a manual counter",
    refs.length > 0 && refs.every((r) => /^[a-f0-9]{10}$/.test(r.declared || "")),
    refs.length ? `${refs.length} references: ${refs.map((r) => `${r.file}${/[a-f0-9]{10}$/.test(r.declared || "") ? "" : `?v=${r.declared}`}`).join(", ")}`
      : "no asset references found in the document");

  const mismatched = [];
  for (const { file, declared } of refs) {
    if (!/^[a-f0-9]{10}$/.test(declared || "")) continue;
    // Skip index 0 of the match: doing so silently fetched
    // "styles.css?v=styles.css" and compared the hash of the wrong thing.
    const res = await fetch(`${BASE}/${file}?v=${declared}`);
    const body = Buffer.from(await res.arrayBuffer());
    const actual = createHash("sha256").update(body).digest("hex").slice(0, 10);
    if (actual !== declared) mismatched.push(`${file}: declared ${declared}, bytes hash to ${actual}`);
  }
  ok("every served asset matches the version the document advertises",
    mismatched.length === 0,
    mismatched.slice(0, 3).join(" | ") || `${refs.length} assets, all self-consistent`);

  // And the document itself must never be cacheable, or the asset graph above
  // is stale for the same reason.
  const docCache = indexRes.headers.get("cache-control") || "";
  ok("the document is never served from a long cache",
    /max-age=0|no-cache|no-store/i.test(docCache), docCache || "no cache-control header");

  // Every dataset the code fetches must actually be served. `publishedDatasets`
  // in scripts/site-assets.mjs is an allow-list, and a file missing from it is
  // dropped without a word — the Archive tab was added with its dataset never
  // registered, the build succeeded, every check stayed green, and the page
  // shipped saying "The archive data could not load." Read the references out
  // of the served bytes and ask the server for each one.
  {
    const jsNames = ["app.js", "news.js", "ascn-news.js", "archive.js"];
    const referenced = new Set();
    for (const name of jsNames) {
      const res = await fetch(`${BASE}/${name}`);
      if (!res.ok) continue;
      const src = await res.text();
      for (const m of src.matchAll(/data\/([A-Za-z0-9._-]+\.json)/g)) referenced.add(m[1]);
    }
    for (const m of html.matchAll(/data\/([A-Za-z0-9._-]+\.json)/g)) referenced.add(m[1]);
    const missing = [];
    for (const name of referenced) {
      const res = await fetch(`${BASE}/data/${name}`, { method: "GET" });
      if (!res.ok) missing.push(`data/${name} → ${res.status}`);
    }
    ok("every dataset the page fetches is published", missing.length === 0 && referenced.size > 0,
      missing.slice(0, 4).join(" | ") || `${referenced.size} datasets referenced, all served`);
  }
}

/* ── Language layer ───────────────────────────────────────────────────────── */
{
  // The document was hardcoded `<html lang="en">` for the life of the site, so
  // a screen reader mispronounced every Thai and Chinese passage on it — the
  // one Layer 5 failure a single attribute fixes. These assertions are about
  // that attribute and about the switch actually switching.
  const { page } = await newPage();
  await page.goto(`${BASE}/#overview`, { waitUntil: "domcontentloaded" });
  await waitForShell(page);
  await page.waitForTimeout(300);

  // A dictionary entry whose English arm is not a string renders as literal
  // text in the default language. It happened: six entries were generated with
  // json.dumps applied to the KEY TUPLE instead of the English sentence, so the
  // English arm was ["record", 0] and the Record view showed the words
  // "record,0" where its lede should be. It passed the "no raw key on screen"
  // check, because "record,0" does not look like a key. So the check is on the
  // rendered English directly: every annotated element must show a real
  // sentence, and the rendered text must be longer than the key it came from.
  const english = await page.evaluate(() => [...document.querySelectorAll("[data-i18n]")].map((el) => ({
    key: el.dataset.i18n, text: (el.textContent || "").trim(),
  })));
  // Precisely the failure signature, not "shorter than the key": "Overview" is
  // a perfectly good label that happens to be shorter than "nav.overview". What
  // must never render is empty text, the key itself, or a serialised structure.
  const junk = english.filter((e) => !e.text || e.text === e.key || /^[[{]/.test(e.text));
  ok("every string renders as a real sentence in the source language", junk.length === 0,
    junk.length ? junk.slice(0, 4).map((e) => `${e.key} -> "${e.text.slice(0, 30)}"`).join(" | ")
      : `${english.length} strings render`);

  const keys = await page.evaluate(() => [...document.querySelectorAll("[data-i18n]")].map((el) => el.dataset.i18n));
  ok("every translatable element declares a key", keys.length > 0 && keys.every(Boolean),
    keys.length ? `${keys.length} keys, ${keys.filter(Boolean).length} resolved` : "no [data-i18n] elements found");

  const perLang = {};
  for (const lang of ["th", "zh"]) {
    await page.locator(`[data-lang-set="${lang}"]`).click();
    await page.waitForTimeout(250);
    perLang[lang] = await page.evaluate((l) => ({
      htmlLang: document.documentElement.lang,
      // A key name leaking into the page means a missing translation rendered.
      raw: [...document.querySelectorAll("[data-i18n]")].filter((el) => /^[a-z]+\.[a-z0-9]+$/i.test(el.textContent.trim())).length,
      nav: [...document.querySelectorAll("#tab-nav a")].map((a) => a.textContent.trim()).join("|"),
      wanted: l,
    }), lang);
    ok(`the document declares lang="${lang}" once Thai or Chinese is chosen`, perLang[lang].htmlLang === lang,
      `html lang="${perLang[lang].htmlLang}"`);
    ok(`no translation key is rendered as text (${lang})`, perLang[lang].raw === 0,
      perLang[lang].raw ? `${perLang[lang].raw} raw keys visible` : perLang[lang].nav.slice(0, 60));
  }

  // An HTML entity inside a TEXT-arm entry renders literally. textContent
  // writes the characters "&amp;" — it does not parse them — so a dictionary
  // entry copied out of index.html verbatim showed readers "M&amp;E cycles"
  // on the Insights page, in all three languages. Twenty-two entries were
  // affected. Only the html() arm may carry entities, because only it goes
  // through innerHTML.
  const entityHits = await page.evaluate(() => {
    const m = document.body.innerText.match(/.{0,30}&(?:amp|lt|gt|quot|nbsp|mdash|ndash|hellip|middot);.{0,20}/g);
    return m || [];
  });
  ok("no HTML entity is rendered as literal text", entityHits.length === 0,
    entityHits.length ? `${entityHits.length} found: ${entityHits.slice(0, 3).join(" | ")}` : "no &amp; on the page");

  // Switching language must not delete live content. The Record view's
  // correspondence note had a runtime-filled <span id="corr-method"> inside a
  // paragraph that carried data-i18n; applying a language set textContent on
  // that paragraph, deleted the span, and the next render threw inside
  // renderCorrespondence — taking the entire Record view, its stack chart
  // included, down to a blank page. Every id the app writes into must still
  // exist after a language switch.
  const liveIds = await page.evaluate(async () => {
    const before = [...document.querySelectorAll("[id]")].map((el) => el.id).sort();
    document.querySelector('[data-lang-set="zh"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const after = [...document.querySelectorAll("[id]")].map((el) => el.id).sort();
    const gone = before.filter((id) => !after.includes(id));
    return gone;
  });
  ok("switching language deletes no live content", liveIds.length === 0,
    liveIds.length ? `${liveIds.length} removed: ${liveIds.slice(0, 5).join(", ")}` : "every id survives the switch");

  // The checks above ask whether the language layer WORKS. This asks whether it
  // has been given anything to say. A paragraph with no data-i18n keeps its
  // English forever no matter how healthy the dictionary is, and every check
  // above would still pass: the switcher moves, html lang changes, no key
  // leaks. The failure is invisible to all of them.
  //
  // Measured by SCRIPT, not by dictionary membership. A paragraph is untranslated
  // if the letters that are not Latin outnumber the ones that are — the actual
  // property a reader experiences. Asking "does this element have a key" instead
  // would report 0 forever, because the whole point is the ones that do NOT.
  //
  // English is skipped deliberately: in English, everything is Latin. Proper
  // nouns, acronyms and dataset names stay Latin in Thai and Chinese on purpose,
  // so the threshold is a ratio and the length floor is generous — a short
  // heading like "ASCN" is not an untranslated paragraph.
  // Every route a reader can reach. Not the touch-target sweep's list: this
  // one needs the Archive and the ASCN 9 detail sheet too, because those hold
  // the most prose. The Archive is exempt at the element level — it ships its
  // own language layer — so it is included here and filtered below.
  const routesForProse = ["overview", "innovation", "record", "news", "news/regional",
    "news/archive", "news/discovery", "history", "cities", "projects", "framework",
    "partners", "insights", "research", "essay", "data", "contacts"];
  const prose = { th: [], zh: [] };
  {
    const { page } = await newPage({ width: 1280, height: 900 });
    for (const route of routesForProse) {
      await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
      await waitForShell(page);
      for (const lang of ["th", "zh"]) {
        await page.locator(`[data-lang-set="${lang}"]`).click();
        await page.waitForTimeout(200);
        const found = await page.evaluate(({ v }) => {
          const view = document.querySelector(`#view-${v}`);
          if (!view) return [];
          // "Is this still English" is decided by ENGLISH WORDS, not by script
          // ratios. A first attempt measured the share of Latin characters and
          // flagged "ข้อมูลน้ำท่วมในหน้างาน" — Thai vowel and tone marks are
          // \p{M}, not \p{L}, so stripping non-letters counted the marks as
          // Latin and every Thai sentence came back looking untranslated. The
          // property that actually identifies English is its function words.
          const STOP = new Set(["the", "and", "of", "to", "in", "is", "that", "with",
            "for", "are", "was", "were", "on", "as", "at", "by", "from", "it",
            "its", "this", "which", "not", "but", "has", "have", "been", "or",
            "we", "they", "one", "every", "their", "than", "into", "also"]);
          const out = [];
          for (const el of view.querySelectorAll("p, li, figcaption, .ig-note, .card-sub")) {
            if (el.getBoundingClientRect().height === 0) continue;
            const t = (el.textContent || "").trim();
            // Split on anything that is not a Latin letter, so "the" inside
            // "their" or "breathe" cannot be counted as a hit.
            const words = (t.toLowerCase().match(/[a-z]+/g) || []);
            if (words.length < 8) continue; // headings, labels, proper nouns
            const hits = words.filter((w) => STOP.has(w)).length;
            if (hits >= 3) out.push(`${hits}/${words.length} ${t}`);
          }
          return out;
        }, { v: route.includes("/") ? route.split("/")[0] : route });
        found.forEach((t) => prose[lang].push(`${route}: ${t}`));
      }
    }
    await page.close();
  }
  // Source-language values are exempt, and that is a decision rather than a gap.
  // News headlines, document titles, source-library names and email subject
  // lines exist in exactly one language in their source. Rendering a Thai
  // version of a title no publisher issued would put an unsourced sentence on a
  // platform whose whole argument is that every claim traces to a source — so
  // they stay as issued and the page says so.
  //
  // The exemption is earned, not assumed: a flagged string is only exempt if it
  // is actually present in a published dataset. Anything not traceable to a
  // dataset is authored prose and must be translated.
  const datasetText = [];
  for (const name of ["ascn-news-archive.json", "ascn-news-discovery.json", "news-snapshot.json",
    "ascn-knowledge.json", "ascn-library.json", "ascn-library-full.json", "ascn-v2-data.json"]) {
    const res = await fetch(`${BASE}/data/${name}`).catch(() => null);
    if (!res?.ok) { await res?.body?.cancel(); continue; }
    // Only source-issued names are exempt. An editorial claim or takeaway is
    // still authored prose when it happens to be stored in a JSON dataset.
    const collectTitles = (value) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (['title', 'project'].includes(key) && typeof child === 'string') datasetText.push(child.replace(/\s+/g, ' '));
        else if (typeof child === 'object') collectTitles(child);
      }
    };
    collectTitles(await res.json());
  }
  const isSourceValue = (t) => {
    const flat = t.replace(/\s+/g, " ").trim();
    return datasetText.some((title) => title === flat);
  };

  for (const lang of ["th", "zh"]) {
    const authored = [...new Set(prose[lang])].filter((entry) => {
      const text = entry.replace(/^[^:]*:\s*/, "").replace(/^\d+\/\d+\s*/, "");
      return !isSourceValue(text);
    });
    ok(`no untranslated authored prose when ${lang} is chosen`, authored.length === 0,
      authored.length ? `${authored.length} untranslated: ${authored.slice(0, 3).join(" | ")}`
        : `${routesForProse.length} views; source-issued titles exempt by exact match`, authored);
  }

  // The language has to survive a route change, or choosing it is a one-page
  // gesture that a reader has to repeat on every view they open.
  await page.goto(`${BASE}/#cities`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const survived = await page.evaluate(() => document.documentElement.lang);
  ok("the chosen language survives navigation", survived === "zh", `landed on lang="${survived}"`);
  await page.close();
}

/* ── Paper is the reference ──────────────────────────────────────────────── */
{
  // A reader's eye is calibrated to a printed page. A4 is 210mm, Letter 216mm;
  // a well-set A4 page sets text inside ~25mm margins for a ~160mm (605px at
  // 96dpi) text block. That block is the limit — past it the return sweep at
  // the end of a line fails and reading degrades into scanning.
  const { page } = await newPage();
  await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const paper = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => parseFloat(cs.getPropertyValue(n));
    const lede = document.querySelector(".persp-stance .lede");
    return {
      sheet: v("--page-sheet"),
      text: v("--page-text"),
      measure: v("--measure"),
      resolved: lede ? parseFloat(getComputedStyle(lede).maxWidth) : NaN,
    };
  });
  ok("the page tokens record the A4/Letter standard", paper.sheet === 794 && paper.text === 605,
    `sheet ${paper.sheet}px, text block ${paper.text}px`);
  ok("no prose block is set wider than an A4 text block", paper.resolved <= paper.text,
    `${Math.round(paper.resolved)}px vs ${paper.text}px`);
  await page.close();
}

/* ── Touch targets, header, overflow — swept across every route ──────────── */
{
  // These invariants came from another agent's branch and are worth keeping
  // even though the branch itself is not being merged: its CSS rewrite would
  // have replaced verified work, but the accessibility requirements in it are
  // real and were never checked here.
  //
  // On header height we deliberately do NOT adopt their <=56px ceiling. That
  // number assumes the tabs collapse behind a menu button. This build keeps
  // navigation permanently visible, and the strip is ~47px tall because its
  // links meet the 44px touch floor. Hiding the navigation to save 50px is a
  // bad trade on a platform whose argument is legibility. The invariant that
  // actually matters is that the tab strip occupies exactly ONE row.
  // Route list is the set of hashes that actually mount a view, verified by
  // reading which .view becomes visible rather than by copying the nav. It used
  // to contain "library", which is not a route: it silently fell back to the
  // overview, so the sweep reported "390/library" while re-measuring a page it
  // had already checked and had never opened /data or /contacts at all. A route
  // that resolves to a different route is an unchecked route wearing a label.
  // The three news sub-panels are addressable as #news/<panel> and each holds a
  // different list of headlines, so they are swept as their own surfaces.
  const routes = ["overview", "innovation", "record", "news", "news/regional",
    "news/archive", "news/discovery", "history", "cities", "projects", "framework",
    "partners", "insights", "research", "essay", "data", "contacts", "ascn9"];
  const bad = { targets: [], overflow: [], navRows: [], header: [], mount: [], wayfinding: [] };
  // Which views this sweep actually put on screen, and which views exist. The
  // gap between the two is the set of surfaces no check has ever looked at.
  const covered = new Set();

  // "Exists" has to mean "exists in the served document, open by default" — not
  // "exists after routing". Routing sets hidden on every view except the
  // current one, so asking the live DOM would call all of them unreachable.
  // Reading the markup separates the two populations properly: a view shipped
  // without `hidden` must be mountable by a route, while a view shipped WITH
  // `hidden` is an interaction-gated panel — #view-ascn9 is the 9th-Annual-
  // Meeting detail sheet opened by the "ASCN 9 record" button, and demanding a
  // route for it was my check being wrong about what a route is for.
  const markup = await (await fetch(`${BASE}/index.html`)).text();
  // Read each .view opening tag out of the served markup. There is no DOMParser
  // in Node, and the alternative — asking the live document — cannot answer the
  // question, because routing has already set hidden by the time any script runs.
  // Attribute order inside the tag does not matter: if `hidden` appears anywhere
  // in the tag that opens the view, the view ships closed.
  const viewTags = markup.match(/<[a-zA-Z][^>]*class="[^"]*\bview\b[^"]*"[^>]*>/g) || [];
  if (!viewTags.length) throw new Error("no .view tags found in served index.html");
  const idOf = (tag) => (tag.match(/\bid="([^"]+)"/) || [])[1];
  const isGated = (tag) => /(^|\s)hidden(\s|=|>|$)/.test(tag);
  const routable = viewTags.filter((t) => !isGated(t)).map(idOf).filter(Boolean);
  const gated = viewTags.filter(isGated).map(idOf).filter(Boolean);

  for (const width of [390, 1024, 1440]) {
    const { page } = await newPage({ width, height: width === 390 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
      await waitForShell(page);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const vis = (el) => {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        // Two populations, two standards. WCAG 2.5.8 (AA) sets 24x24 CSS px as
        // the minimum target and explicitly exempts links inline in a sentence.
        // 2.5.5 (AAA) sets 44px. A headline link inside a story card is text
        // with prose around it, not a button — holding it to 44 would have me
        // padding headlines into buttons to satisfy my own number.
        const TEXT_MIN = 24, CONTROL_MIN = 44;
        // Chromium lays out on a 1/64px LayoutUnit grid, so a box declared at
        // exactly 44px is often READ back as 43.99993896484375. That is not a
        // box below the floor — it is the floor, as the engine can represent
        // it. Comparing the raw float against an integer asserted a defect that
        // does not exist: every control in the stylesheet that declares
        // min-height:44px failed whenever the quantisation landed low, and the
        // report printed it as "44.0" because the diagnostic rounded to one
        // decimal, so the message claimed a pass while the assertion beneath it
        // claimed a failure.
        //
        // The tolerance is one LayoutUnit, not a round number: below 1/64px the
        // measurement is not distinguishable from the declared value, and any
        // larger epsilon would start excusing boxes that really are short.
        const LAYOUT_UNIT = 1 / 64;
        // "Inline in a sentence" is about WORDING, not the parent tag. A link
        // whose own text is essentially the whole of its block is a standalone
        // ACTION — "Open video", "Techsauce", "2022" — and gets the control
        // minimum. Only a link embedded among other words gets the inline
        // exception. Tag-based classification called all five of these "text"
        // because they happened to sit inside <p>, <li> or <figcaption>.
        //
        // The tag list alone was also too narrow in the other direction: a
        // publisher name in ".news-source", a source name in ".def-row" and an
        // institution name in a contact card are all reference links sized by
        // the line of text they share with a sibling, yet none of them sit in a
        // <p>, so all three were called controls. Instead of adding their class
        // names, walk up for the nearest container that actually holds more
        // text than the link does — that is the sentence the link is part of.
        const inlineTextLink = (el) => {
          // A link that downloads a file is an action whatever surrounds it.
          if (el.hasAttribute("download")) return false;
          const own = (el.textContent || "").trim().length;
          const roomy = (n) => (n.textContent || "").trim().length > own + 12;
          // Inside a recognised text container the tag has already answered the
          // question, and no sibling test may overrule it: a paragraph holding
          // twenty comma-separated city links is a sentence, and a sibling test
          // would have read it as a control bank and demanded 44px per city.
          const tagged = el.closest("p, li, dd, figcaption, h1, h2, h3, h4, td, th");
          if (tagged) return roomy(tagged);
          // Otherwise walk up for the nearest container that holds more text than
          // the link does — that is the line it shares with a sibling. Guard the
          // walk against control banks: six identical "All 62 sources / Official
          // / Academic" chips share a parent whose text dwarfs each chip, and
          // without this the fallback would read every filter chip as prose.
          for (let n = el.parentElement, i = 0; n && i < 3; n = n.parentElement, i++) {
            if (!roomy(n)) continue;
            const kin = [...n.children].filter((c) => c.tagName === el.tagName && String(c.className) === String(el.className)).length;
            return kin <= 1;
          }
          return false;
        };
        // Legal attribution is sized by its own line height by convention and by
        // licence: OSM and Leaflet credits must stay visible and compact, and no
        // map anywhere makes them 44px. Excluded by name, not by accident.
        const ATTRIBUTION = ".leaflet-control-attribution";
        const targets = [...document.querySelectorAll("a, button, input:not([type=hidden]), select, textarea, [role=button], summary")];
        const short = targets.filter((el) => {
          if (!vis(el)) return false;
          if (el.closest(ATTRIBUTION)) return false;
          const min = inlineTextLink(el) ? TEXT_MIN : CONTROL_MIN;
          const box = el.getBoundingClientRect();
          return box.height < min - LAYOUT_UNIT || (!inlineTextLink(el) && box.width < min - LAYOUT_UNIT);
        }).map((el) => {
          // Print the raw height, unrounded. toFixed(1) collapses a genuine
          // sub-pixel shortfall — 43.96px prints as "44.0" — so the report
          // claims an element cleared the 44px floor while the assertion that
          // flagged it read a number below it. A diagnostic that can disagree
          // with the assertion it explains is worse than no diagnostic. Also
          // record whether the floor is even declared, because a box with no
          // min-height is a different bug from one that has one and misses.
          const { height: h, width: w } = el.getBoundingClientRect();
          const declared = parseFloat(getComputedStyle(el).minHeight) || 0;
          return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${w}x${h}px (min-height:${declared}px)${inlineTextLink(el) ? " text" : " action"}`;
        });

        // Whether the PAGE scrolls sideways, asked by trying to scroll it —
        // not by reading documentElement.scrollWidth. A tall grid can report a
        // scrollWidth a few pixels past the viewport from track rounding while
        // every child sits inside it, and asserting that proxy fails on a page
        // no reader can actually pan. The behaviour is the requirement.
        const docW = document.documentElement.clientWidth;
        const inScroller = (el) => {
          let n = el.parentElement;
          while (n && n !== document.body) {
            const cs = getComputedStyle(n);
            if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) return true;
            n = n.parentElement;
          }
          return false;
        };
        const escaped = [...document.querySelectorAll("body *")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.right > docW + 1 && !inScroller(el);
        }).length;
        window.scrollTo(9999, 0);
        const canPan = Math.round(window.scrollX);
        window.scrollTo(0, 0);

        const nav = document.querySelector("#tab-nav");
        const live = [...document.querySelectorAll(".view")]
          .filter((v) => v.getBoundingClientRect().height > 0).map((v) => v.id);
        // Wayfinding: on every route the index must say where you are. Exactly
        // one row lit, and the locator's number must be that row's number.
        //
        // #ascn9 — the 9th-annual-meeting record, opened from inside The
        // Record — used to light NO row at all, so the index went blank while
        // you were still reading inside it, and it wore "04", which belongs to
        // News. The reader landed on a number that pointed somewhere else.
        const litRows = [...document.querySelectorAll("#tab-nav a.active")];
        const indexNum = litRows.length === 1 ? litRows[0].getAttribute("data-num") : null;
        const locatorNum = (document.querySelector("#locatorNum")?.textContent || "").trim();
        // The old site had a horizontal strip of tabs across the top that could
        // wrap to two, three or four rows and eat the page. The shell replaced
        // it with a vertical index rail, so the question changed shape: the
        // nav must stay ONE COLUMN (every entry on the same left edge) and it
        // must not become a sideways strip. The old "header stays a two-row
        // band" check measured #tab-nav as well — the same element as the nav
        // check, under a different threshold — so it never measured a header
        // at all. What it should have measured is the bar: a bar whose
        // children wrap becomes two rows tall and doubles the chrome.
        const itemLefts = new Set([...nav.querySelectorAll(".item")]
          .map((el) => Math.round(el.getBoundingClientRect().left)));
        const navPan = nav.scrollWidth - nav.clientWidth;
        const railBar = document.querySelector(".index .bar");
        const plateBar = document.querySelector(".plate-bar");
        const barH = (b) => (b ? Math.round(b.getBoundingClientRect().height) : 0);
        return {
          short: [...new Set(short)],
          overflow: canPan,
          escaped,
          navCols: itemLefts.size,
          navPan,
          railBarH: barH(railBar),
          plateBarH: barH(plateBar),
          litRows: litRows.length,
          indexNum,
          locatorNum,
          live,
        };
      });
      const tag = `${width}/${route}`;
      if (m.short.length) bad.targets.push(`${tag}: ${m.short.join(", ")}`);
      if (m.overflow > 1 || m.escaped > 0) bad.overflow.push(`${tag}: pans ${m.overflow}px, ${m.escaped} escaping`);
      // One column of 44px entries, not a wrapped strip.
      if (m.navCols !== 1 || m.navPan > 1) bad.navRows.push(`${tag}: nav ${m.navCols} columns, pans ${m.navPan}px`);
      // One row of chrome, not two.
      if (m.railBarH > 46 || m.plateBarH > 46) bad.header.push(`${tag}: rail bar ${m.railBarH}px, plate bar ${m.plateBarH}px`);
      // A hash that mounts nothing checks nothing, and reports as if it did.
      if (m.live.length !== 1) bad.mount.push(`${tag}: ${m.live.length} views live (${m.live.join(",") || "none"})`);
      // The index must light exactly one row, and the number in the plate's
      // locator must be that row's number — otherwise the number points at a
      // different section than the one you are in.
      if (m.litRows !== 1 || m.indexNum !== m.locatorNum) {
        bad.wayfinding.push(`${tag}: ${m.litRows} rows lit, index ${m.indexNum ?? "none"} vs locator ${m.locatorNum || "none"}`);
      }
      for (const v of m.live) covered.add(v);
    }
    await page.close();
  }

  const neverReached = routable.filter((v) => !covered.has(v));
  if (neverReached.length) bad.mount.push(`never reached: ${neverReached.join(", ")}`);

  ok("every control clears its touch-target minimum", bad.targets.length === 0,
    bad.targets.slice(0, 4).join(" | ") || `${routes.length} routes x 3 widths`, bad.targets);
  ok("no route overflows horizontally", bad.overflow.length === 0,
    bad.overflow.slice(0, 4).join(" | ") || "clean at 390, 1024 and 1440");
  ok("the index nav stays one column", bad.navRows.length === 0,
    bad.navRows.slice(0, 3).join(" | ") || "no wrapping, no sideways strip");
  ok("the chrome bars stay one row", bad.header.length === 0,
    bad.header.slice(0, 3).join(" | ") || "rail bar + plate bar, one row each");
  ok("every route lights up its index row", bad.wayfinding.length === 0,
    bad.wayfinding.slice(0, 4).join(" | ") || `${routes.length} routes, one lit row each, locator number matches`);
  // Two index rows sharing a number make the locator ambiguous before the
  // reader has even clicked: "04" would mean News and the 9th annual meeting
  // at the same time. The numbers come from the served markup, not the DOM,
  // because the DOM is rewritten by routing before anything is measured.
  const indexNums = [...markup.matchAll(/<a[^>]*\bdata-num="(\d+)"/g)].map((m) => m[1]);
  const dupNums = indexNums.filter((n, i) => indexNums.indexOf(n) !== i);
  ok("no two index rows share a number", dupNums.length === 0,
    dupNums.length ? `duplicated: ${[...new Set(dupNums)].join(", ")}` : `${indexNums.length} rows, ${new Set(indexNums).size} numbers`);
  ok("every routable view is reached by a real route", bad.mount.length === 0,
    bad.mount.slice(0, 3).join(" | ") || `${routable.length} routable views mounted; ${gated.length} interaction-gated: ${gated.join(", ") || "none"}`);

  /* ── A chart must fill the space it is given, and its numbers must stand
       on their own data ────────────────────────────────────────────────────
     Two hardcoded sizes were wrong in the Insights view. The momentum line
     was drawn 380px wide inside a 994px section, so 614px of that section
     was empty — a lopsided section (rule 2). The focus sparklines were drawn
     152px wide under label rows that spread across the whole 319px cell, so
     '24 and '25 sat up to 199px from the point they were labelling: a
     number that does not attach to its datum (rules 1 and 2).

     Both are measurable, so both are measured: the plot against the space
     it must fill, and every label against the point it names. A chart that
     is asked to be small can be small — what it may not be is stranded. */

  const chartBad = { void: [], drift: [] };
  for (const width of [390, 1024, 1440, 1920]) {
    const { page } = await newPage({ width, height: width === 390 ? 844 : 900 });
    await page.goto(`${BASE}/#insights`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const line = document.querySelector("#ig-momentum .ig-mini-line");
      const lineSvg = line?.querySelector("svg");
      const sparks = [...document.querySelectorAll("#ig-focus-trends .ig-spark-item")].map((item) => {
        const plot = item.querySelector(".ig-spark-plot svg");
        const poly = plot?.querySelector("polyline");
        if (!plot || !poly) return null;
        const pr = plot.getBoundingClientRect();
        const xs = poly.getAttribute("points").split(" ").map((p) => parseFloat(p.split(",")[0]));
        const labels = [...item.querySelectorAll(".ig-spark-yrs span")].map((s) => {
          const r = s.getBoundingClientRect();
          return r.x + r.width / 2 - pr.x;
        });
        const drift = labels.map((c, i) => (xs[i] === undefined ? 999 : Math.abs(c - xs[i])));
        return { drift: Math.max(...drift), plotW: pr.width, cellW: item.clientWidth };
      }).filter(Boolean);
      return {
        line: lineSvg && line ? { svgW: lineSvg.getBoundingClientRect().width, boxW: line.clientWidth } : null,
        sparks,
      };
    });
    const tag = `${width}/insights`;
    if (!m.line) chartBad.void.push(`${tag}: no momentum chart`);
    else if (m.line.svgW < m.line.boxW - 2) chartBad.void.push(`${tag}: momentum chart ${Math.round(m.line.svgW)}px in a ${Math.round(m.line.boxW)}px section`);
    for (const s of m.sparks) {
      if (s.plotW < s.cellW - 2) chartBad.void.push(`${tag}: sparkline ${Math.round(s.plotW)}px in a ${Math.round(s.cellW)}px cell`);
      if (s.drift > 2) chartBad.drift.push(`${tag}: label ${s.drift.toFixed(1)}px from its point`);
    }
    await page.close();
  }
  ok("no chart is stranded in empty space", chartBad.void.length === 0,
    chartBad.void.slice(0, 4).join(" | ") || "every plot fills the space it is given, at 390/1024/1440/1920", chartBad.void);
  ok("every chart label stands on its own datum", chartBad.drift.length === 0,
    chartBad.drift.slice(0, 4).join(" | ") || "year labels within 2px of their point", chartBad.drift);

  /* ── A ledger that leaves its section empty ───────────────────────────────
     Four archive sections, the framework's ASCAP panel and the site footer
     all held their content in a column a third or a half of the width they
     were given and left the rest as a void: 59% of the money section, 61%
     of the pending section, 63% of the footer, 62% of the ASCAP panel. The
     measure belongs to the COLUMN, so the prose now runs in columns and the
     panels fill the band they are given.

     The check is the one the reviewer measured: how far the text ink
     actually reaches across the section it sits in. Rule 2 forbids an
     empty half, so the floor is 60% — a section may not be more than 40%
     empty. The threshold comes from the rule, not from what the current
     build happens to measure. */
  const LEDGER = [
    { route: "archive", sel: ".archive-money", label: "money" },
    { route: "archive", sel: ".archive-outcomes", label: "outcomes" },
    { route: "archive", sel: ".archive-pending", label: "pending" },
    { route: "archive", sel: ".archive-withheld", label: "withheld" },
    { route: "framework", sel: "#framework-ascap", label: "ascap" },
    { route: "overview", sel: ".footer-content", label: "footer" },
  ];
  const ledgerBad = { ink: [], panel: [], dupes: [], measure: [] };
  for (const width of [1024, 1440]) {
    const { page } = await newPage({ width, height: width === 390 ? 844 : 900 });
    await page.addInitScript(`window.longestHeadingLine = ${longestHeadingLine.toString()}`);
    for (const target of LEDGER) {
      await page.goto(`${BASE}/#${target.route}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction((sel) => {
        const host = document.querySelector(sel);
        return host?.textContent.trim() && host.getBoundingClientRect().width > 0;
      }, target.sel);
      const m = await page.evaluate((sel) => {
        const host = document.querySelector(sel);
        if (!host) return { missing: true };
        const hr = host.getBoundingClientRect();
        // How far does the TEXT ink reach across the section?
        let right = 0;
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) if (r.width > 0) right = Math.max(right, r.right);
        }
        return { w: hr.width, left: hr.left, right: hr.right, inkRight: right };
      }, target.sel);
      if (m.missing) { ledgerBad.ink.push(`${target.label}: missing`); continue; }
      const filled = m.inkRight > 0 ? (m.inkRight - m.left) / m.w : 0;
      if (filled < 0.6) ledgerBad.ink.push(`${width}/${target.label}: ink reaches ${Math.round(filled * 100)}% of the section`);
    }
    // The projects status panel: three bars in a cell as tall as the
    // twelve-row panel beside it. It was 3.5% ink, with 105px of air
    // between one 6px bar and the next.
    await page.goto(`${BASE}/#projects`, { waitUntil: "domcontentloaded" });
    await page.locator('#status-bars .bar-track').first().waitFor({state:'attached'});
    const panel = await page.evaluate(() => {
      const host = document.querySelector("#status-bars");
      if (!host) return null;
      const hb = host.getBoundingClientRect();
      const tracks = [...host.querySelectorAll(".bar-track")].map((t) => t.getBoundingClientRect());
      if (!tracks.length) return null;
      const top = Math.min(...tracks.map((t) => t.top));
      const bottom = Math.max(...tracks.map((t) => t.bottom));
      return { h: hb.height, span: bottom - top };
    });
    if (panel) {
      const share = panel.h ? panel.span / panel.h : 0;
      if (share < 0.5) ledgerBad.panel.push(`${width}/status panel: bars span ${Math.round(share * 100)}% of it`);
    } else ledgerBad.panel.push(`${width}/status panel: no bars`);

    // A heading and a label that repeat each other: "THREE STRATEGIC
    // OUTCOMES" immediately followed by "OUTCOMES", 7.8px apart, in the
    // same column. Three blocks carried six labels.
    await page.goto(`${BASE}/#framework`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const dupes = await page.evaluate(() => {
      const out = [];
      for (const block of document.querySelectorAll(".fw-block")) {
        const h = block.querySelector("h3");
        const l = block.querySelector(".label");
        if (!h || !l) continue;
        const ht = h.textContent.toLowerCase();
        const lt = l.textContent.trim().toLowerCase();
        if (lt && ht.includes(lt)) out.push(`${h.textContent.trim()} / ${l.textContent.trim()}`);
      }
      return out;
    });
    for (const d of dupes) ledgerBad.dupes.push(d);

    // The archive's outcome titles measured 29 characters a line when they
    // shared a row with the label and the count.
    await page.goto(`${BASE}/#archive`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    // The REAL number of characters on the longest rendered line.
    //
    // This used to divide the line's pixel width by the width of a "0" and
    // call the result "characters". That is a proxy for a measurement, and it
    // is typeface-sensitive: a geometric face whose zero is a wide circle
    // reports fewer characters on the same physical line than a grotesque
    // does, so swapping Archivo for Jost made this check fail by two
    // characters without a single word on the page changing how it wrapped.
    // The heading sweep already fixed this class of bug for headings by
    // counting the graphemes the browser actually put on each line; this
    // check now measures the same way.
    //
    // It also takes the LONGEST line of the LONGEST title, not the first
    // rect of the first item — the first title in the list can be a short
    // one that happens to wrap into two tidy lines, and reading only that
    // one told you about the list's luckiest entry, not its worst.
    const chars = await page.evaluate(() => {
      let best = 0;
      for (const li of document.querySelectorAll(".archive-outcome-titles li")) {
        const n = window.longestHeadingLine(li);
        if (n > best) best = n;
      }
      return best || null;
    });
    if (chars && chars < 45) ledgerBad.measure.push(`${width}/outcome title: ${chars} characters a line`);
    await page.close();
  }
  ok("no section leaves its content stranded", ledgerBad.ink.length === 0,
    ledgerBad.ink.slice(0, 4).join(" | ") || "ink reaches at least 60% of every ledger section, at 1024 and 1440", ledgerBad.ink);
  ok("no panel is a hole in the grid", ledgerBad.panel.length === 0,
    ledgerBad.panel.slice(0, 3).join(" | ") || "the status panel's bars span at least half of it", ledgerBad.panel);
  ok("no label repeats its own heading", ledgerBad.dupes.length === 0,
    ledgerBad.dupes.slice(0, 3).join(" | ") || "no framework block labels itself twice", ledgerBad.dupes);
  ok("the archive's titles keep a readable line", ledgerBad.measure.length === 0,
    ledgerBad.measure.slice(0, 3).join(" | ") || "at least 45 characters a line", ledgerBad.measure);

  /* ── Something must win ───────────────────────────────────────────────────
     Rule 6: every page has one obvious first thing, then a clear second. The
     measurable form of that is a type-size gap between the page's H1 and the
     largest H2 on it.

     Two real defects this would have caught, neither of which any other check
     here could see:

     - At 390px the overview H1 was 19px against a 19px H2. A media query set
       it to --t-h2, which is the same value the section headings use. On a
       phone the first thing on the page and the second thing were the same
       size, so there was nothing to look at first.
     - The News view's own title was an <h2> while an inner section carried the
       <h1>, both at 24px, at every width. */

  const flat = [];
  for (const width of [390, 1440]) {
    const { page } = await newPage({ width, height: width === 390 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
      await waitForShell(page);
      await page.waitForTimeout(200);
      const m = await page.evaluate((r) => {
        const v = document.querySelector(`#view-${r.includes("/") ? r.split("/")[0] : r}`);
        if (!v) return null;
        const shown = (e) => e.getBoundingClientRect().height > 0;
        const h1 = [...v.querySelectorAll("h1")].find(shown);
        const h2s = [...v.querySelectorAll("h2")].filter(shown);
        // A view with subheadings but no visible h1 is a FAILURE, not a skip.
        // Returning null here is what let the News view pass while its h1 sat
        // inside a hidden sub-panel: the default panel had headings and no
        // page title at all, and the check simply had nothing to compare.
        if (!h2s.length) return null;
        if (!h1) return { noH1: true };
        return {
          h1: Math.round(parseFloat(getComputedStyle(h1).fontSize)),
          h2: Math.max(...h2s.map((e) => Math.round(parseFloat(getComputedStyle(e).fontSize)))),
        };
      }, route);
      if (m && m.noH1) { flat.push(`${width}/${route}: no visible h1, but it has h2s`); continue; }
      if (m) flat.push(`${width}/${route}: h1 ${m.h1}px vs h2 ${m.h2}px (${(m.h1 / m.h2).toFixed(2)}x)`);
    }
    await page.close();
  }
  const flatHits = flat.filter((f) => {
    const m = f.match(/h1 (\d+)px vs h2 (\d+)px/);
    if (!m) return true;
    return Number(m[1]) / Number(m[2]) < 1.5;
  });
  ok("every page has a heading that outranks its own sections", flatHits.length === 0,
    flatHits.slice(0, 4).join(" | ") || `${flat.length} page/width pairs, all ≥1.5x`);
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

/* ── Design core: the constraints as machine checks ────────────────────────
 * These are not preferences. A drifting heading scale, a gradient scrim or an
 * outside palette each look like a small local decision and read as generated
 * in aggregate. Asserted here so they cannot come back one edit at a time. */
{
  const { page, failures } = await newPage();
  for (const tab of ["record", "innovation", "history", "cities"]) {
    await page.goto(`${BASE}/#${tab}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const style = await page.evaluate(() => {
      const sizes = new Set();
      let gradients = 0, blurred = 0, rounded = 0;
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        // Some elements expose no resolved font-size; "" is not a size.
        if (el.children.length === 0 && (el.textContent || "").trim() && s.fontSize) sizes.add(s.fontSize);
        if (/gradient/.test(s.backgroundImage)) gradients++;
        if (/blur\(/.test(s.backdropFilter)) blurred++;
        // Sharp edges means no rounded *corners*. A border-radius:50% on a
        // square element is a circle (map dots), and Leaflet's zoom control is
        // vendored chrome — neither is a corner this design system owns.
        const r = parseFloat(s.borderTopLeftRadius) || 0;
        const square = el.getBoundingClientRect();
        const isCircle = s.borderTopLeftRadius.includes("50%") && square.width < 40 && square.height < 40;
        if (r > 0 && !isCircle && !el.closest(".leaflet-container")) rounded++;
      }
      return { sizes: sizes.size, gradients, blurred, rounded };
    });
    if (tab === "record") {
      ok("the type ramp stays collapsed (≤6 rendered sizes)", style.sizes <= 6, `${style.sizes} sizes`);
    }
    ok(`no gradients on ${tab}`, style.gradients === 0, `${style.gradients} found`);
    ok(`no backdrop blur on ${tab}`, style.blurred === 0, `${style.blurred} found`);
    ok(`edges stay square on ${tab}`, style.rounded === 0, `${style.rounded} rounded`);
  }
  await page.close();
}

/* ── No outside palette ───────────────────────────────────────────────────
 * Raw Tailwind defaults (slate-900 #0f172a, sky-400 #38bdf8, slate-950
 * #0b0f14) are the fingerprint of an agent's default palette bleeding in. */
{
  const css = await (await fetch(`${BASE}/styles.css`)).text();
  const outside = outsidePalette(css);
  ok("no Tailwind default hexes in the stylesheet", outside.length === 0, [...new Set(outside)].join(" "));
  ok("the palette guard rejects an outside colour (control)", outsidePalette('p { color: #0f172a; background: #38bdf8; }').length === 2);
  const amberLiteral = (css.replace(/--amber:[^;]+;/, "").match(/#f59e0b/gi) || []).length;
  ok("amber is referenced by token, not as a literal", amberLiteral === 0, `${amberLiteral} literals`);
  const clamped = (css.match(/font-size:[^;]*clamp\(/g) || []).length;
  ok("no per-heading clamp() scales", clamped === 0, `${clamped} clamps`);
  ok("the link token is not used as a data fill",
    !/\.(bar-fill|corr-bar-fill)\s*\{[^}]*var\(--navy\)/.test(css));

  // Every custom property must resolve. A token defined as var(--itself), or
  // referenced but never defined, is silently invalid: the declaration drops
  // and the element renders transparent. This shipped once — a bulk rename
  // folded the amber literal into its own definition, and every amber bar
  // vanished with no error and no failing structural check.
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  const selfRef = [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*\1\s*\)/gi)].map((m) => m[1]);
  ok("no token is defined in terms of itself", selfRef.length === 0, selfRef.join(" "));
  const referenced = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]));
  const unresolved = [...referenced].filter((t) => !defined.has(t)
    // Fallbacks are legal: var(--x, value) resolves even if --x is undefined.
    && !new RegExp(`var\\(\\s*${t}\\s*,`).test(css));
  ok("every referenced token is defined", unresolved.length === 0, unresolved.join(" "));
}

/* ── The shell's geometry: one origin, and a rail sized by its content ────── */
{
  // MoMA Law VII: two edges are the SAME (delta 0) or CLEARLY DIFFERENT
  // (delta > 6px). A delta of 1–6px reads as a failed attempt at alignment,
  // and it is the band the eye catches and calls amateur.
  //
  // The shell had three of them and every one was a hairline occupying
  // layout space: the rail's bar carried a 1px border-bottom inside a 44px
  // border-box, so its 43px content box centred a 44px wordmark half a
  // pixel proud of the shell's top edge — and the language switch, whose
  // buttons carried a 2px transparent border-bottom, sat one pixel ABOVE
  // the wordmark's letters in the same bar. One pixel. The exact thing the
  // owner photographed.
  //
  // Every rule that draws a hairline now draws it with a shadow, so it
  // costs no layout space and two elements that share an origin stay on it.
  const NEAR_MISS = 6;
  const isNearMiss = (delta) => delta > 0 && delta <= NEAR_MISS;

  for (const width of [1440, 1024]) {
    const { page } = await newPage({ width, height: 900 });
    await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const pairs = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, x: r.x, width: r.width };
      };
      const item = document.querySelector(".index-scroll .item");
      const itemBox = item ? item.getBoundingClientRect() : null;
      const itemTextX = itemBox
        ? itemBox.x + parseFloat(getComputedStyle(item).paddingLeft) + 20 + 7
        : null;
      const label = document.querySelector(".group-label");
      const labelX = label
        ? label.getBoundingClientRect().x + parseFloat(getComputedStyle(label).paddingLeft)
        : null;
      const kicker = box("#barKicker");
      const first = document.querySelector("#main-content .view .label, #main-content .view h1");
      const firstBox = first ? first.getBoundingClientRect() : null;
      return {
        brand: box(".brand.mark"),
        locale: box(".locale-btn"),
        itemTextX,
        labelX,
        kickerLeft: kicker ? kicker.left : null,
        contentLeft: firstBox ? firstBox.left : null,
      };
    });

    const deltas = [];
    const delta = (labelText, a, b) => {
      if (a == null || b == null) return;
      const d = Math.abs(a - b);
      if (isNearMiss(d)) deltas.push(`${labelText} Δ${Math.round(d * 100) / 100}px`);
    };
    delta("wordmark vs language switch (top)", pairs.brand?.top, pairs.locale?.top);
    delta("wordmark vs language switch (bottom)", pairs.brand?.bottom, pairs.locale?.bottom);
    delta("group heading vs its first item", pairs.labelX, pairs.itemTextX);
    delta("plate kicker vs the plate's first line", pairs.kickerLeft, pairs.contentLeft);
    ok(`the shell's edges share one origin (${width}px)`, deltas.length === 0,
      deltas.slice(0, 4).join(" | ") || "every compared pair is exactly aligned");
    await page.close();
  }

  // Control: the comparison has to be able to fail. A delta of one pixel is
  // the whole point of the rule, so the predicate must reject it.
  ok("the near-miss comparison can fail (control)", isNearMiss(1) && !isNearMiss(0) && !isNearMiss(7));

  /* The rail's width is the width its content needs, not a share of the
     screen. It was clamp(300px, 32vw, 420px) — 32vw is the grid's answer,
     and it meant the rail changed width with the viewport while its
     contents stayed exactly the same size. */
  {
    const widths = [];
    for (const width of [1280, 1440, 1920]) {
      const { page } = await newPage({ width, height: 900 });
      await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const rail = await page.evaluate(() => {
        const el = document.querySelector(".index");
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), viewport: window.innerWidth };
      });
      widths.push(rail);
      await page.close();
    }
    const same = widths.every((w) => w.width === widths[0].width);
    ok("the rail's width does not scale with the viewport", same,
      widths.map((w) => `${w.viewport}px→${w.width}px`).join(" "));
  }

  /* The index has to FIT. Fifteen entries at a 44px touch target, four
     group headings and their separation, have to live in the rail without a
     scroll — otherwise the last two sections of the site sit below the fold
     of the thing that is supposed to be the map of the site. */
  {
    const bad = [];
    for (const height of [900, 1080]) {
      const { page } = await newPage({ width: 1440, height });
      await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => {
        const s = document.querySelector(".index-scroll");
        return s.scrollHeight - s.clientHeight;
      });
      if (overflow > 0) bad.push(`${height}px: ${overflow}px of scroll`);
      await page.close();
    }
    ok("the whole index fits the rail without a scroll", bad.length === 0,
      bad.join(" | ") || "15 entries fit at 900px and 1080px");
  }

  /* The rail's CONTENTS have to fit the rail, sideways as well as down.
     The search row's intrinsic content was 284px inside a 242px rail: the
     Find button was pushed under the plate, the plate's locator took its
     clicks, and the button was dead. A vertical fit check cannot see that. */
  {
    const { page } = await newPage({ width: 1440, height: 900 });
    await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const fit = await page.evaluate(() => {
      const rail = document.querySelector(".index");
      const rr = rail.getBoundingClientRect();
      const strays = [...rail.querySelectorAll("*")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > rr.right + 0.5 || r.left < rr.left - 0.5);
      }).map((el) => `${el.tagName}.${String(el.className).split(" ")[0]}`);
      const btn = document.querySelector("#finder-open");
      const br = btn.getBoundingClientRect();
      const top = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
      return {
        scrollW: rail.scrollWidth, clientW: rail.clientWidth,
        strays: strays.slice(0, 4),
        covered: !(btn === top || btn.contains(top)),
        coveredBy: top ? (top.id || String(top.className).split(" ")[0]) : "nothing",
      };
    });
    ok("the rail's contents fit inside the rail", fit.scrollW <= fit.clientW && fit.strays.length === 0,
      fit.scrollW > fit.clientW ? `scroll ${fit.scrollW} > ${fit.clientW}` : fit.strays.join(" | ") || `fits ${fit.clientW}px`);
    ok("the rail's Find button is the topmost thing where it is drawn", !fit.covered,
      fit.covered ? `covered by ${fit.coveredBy}` : "clickable");
    await page.close();
  }

  /* A caption underneath cannot overhang the video. Beside it, the caption
     must remain within the figure and not overlap the video. */
  {
    const { page } = await newPage({ width: 1440, height: 900 });
    await page.goto(`${BASE}/#innovation`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const hero = await page.evaluate(() => {
      const w = (sel) => {
        const el = document.querySelector(sel);
        return el ? Math.round(el.getBoundingClientRect().width) : null;
      };
      const video = document.querySelector('.iaas-hero-media video').getBoundingClientRect();
      const cap = document.querySelector('.iaas-hero-media figcaption').getBoundingClientRect();
      const figure = document.querySelector('.iaas-hero-media').getBoundingClientRect();
      const band = document.querySelector('.iaas-row-hero').getBoundingClientRect();
      const beside = cap.right <= video.left + 1 || cap.left >= video.right - 1;
      return { ol: w(".iaas-method"), li: w(".iaas-method li"), video: Math.round(video.width), cap: Math.round(cap.width), bounds: {video:video.toJSON(),caption:cap.toJSON(),figure:figure.toJSON(),band:band.toJSON()}, beside };
    });
    ok("the method list's rule is the width of its own items", hero.ol != null && Math.abs(hero.ol - hero.li) <= 1,
      `list ${hero.ol}px vs items ${hero.li}px`);
    ok("the caption stays within its media composition", mediaCaptionFits(hero.bounds),
      `caption ${hero.cap}px vs video ${hero.video}px; ${hero.beside ? 'beside' : 'underneath'}`);
    await page.close();
  }

  /* A rule is a graphic: 3:1 minimum. The light theme's ground is nearly
     white, so its rules have to be far darker to clear the same bar the
     dark theme clears easily — they were at 1.80:1 and 1.39:1, and the
     diagram's own lines were invisible on paper. */
  {
    const { page } = await newPage({ width: 1440, height: 900 });
    await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
    const report = await page.evaluate(() => {
      const lum = (rgb) => {
        const [r, g, b] = String(rgb).match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
        return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
      };
      const out = {};
      for (const theme of ["dark", "light"]) {
        if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
        else document.documentElement.removeAttribute("data-theme");
        const s = getComputedStyle(document.documentElement);
        out[theme] = {
          line: ratio(s.getPropertyValue("--line"), s.getPropertyValue("--paper")),
          soft: ratio(s.getPropertyValue("--line-soft"), s.getPropertyValue("--paper")),
          ocher: ratio(s.getPropertyValue("--ocher"), s.getPropertyValue("--panel")),
        };
      }
      document.documentElement.removeAttribute("data-theme");
      return out;
    });
    const bad = [];
    for (const [theme, v] of Object.entries(report)) {
      if (v.line < 3) bad.push(`${theme} --line ${v.line}:1`);
      if (v.soft < 3) bad.push(`${theme} --line-soft ${v.soft}:1`);
      if (v.ocher < 4.5) bad.push(`${theme} --ocher on panel ${v.ocher}:1`);
    }
    ok("a rule is a graphic: 3:1 in both themes", bad.length === 0,
      bad.join(" | ") || `dark rule ${report.dark.line}:1 / light rule ${report.light.line}:1, ocher on panel ${report.light.ocher}:1`);
    await page.close();
  }

  /* The display register must have weight. Julius Sans One shipped a single
     weight (400): every headline, label and figure on this site was set in
     a face with no weight range at all. */
  {
    const { page } = await newPage({ width: 1440, height: 900 });
    await page.goto(`${BASE}/#overview`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const weight = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      return h1 ? Number(getComputedStyle(h1).fontWeight) : 0;
    });
    ok("the display register carries weight", weight >= 600, `h1 at ${weight}`);
    await page.close();
  }
}

completed = true;
} catch (error) {
  ok('audit completed all sections', false, error.message);
} finally {
  await browser.close();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) { failed++; console.log(`  FAIL  ${r.label}${r.detail ? `  [${r.detail}]` : ""}`); }
}
console.log(`Graphics and previews: ${results.length - failed}/${results.length} checks passed`);
const reportPath = process.env.ASCN_AUDIT_REPORT || '.tmp/graphics-audit.json';
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify({ base: BASE, checkedAt: new Date().toISOString(), completed, newsMode: 'saved-fallback (upstream availability is not a composition check)', passed: results.length - failed, total: results.length, results }, null, 2) + '\n');
console.log(`Full findings: ${reportPath}`);
process.exit(failed ? 1 : 0);
