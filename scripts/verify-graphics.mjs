import { chromium, devices } from "@playwright/test";
import { createHash } from "node:crypto";

const BASE = process.env.ASCN_TEST_URL || "http://127.0.0.1:4187";
const browser = await chromium.launch();
const results = [];
const ok = (label, pass, detail = "") => results.push({ pass, label, detail });

async function newPage(viewport = { width: 1280, height: 900 }, isMobile = false) {
  const page = await browser.newPage(isMobile ? { ...devices["iPhone 13"] } : { viewport });
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

  const rows = await page.locator(".twin-row").count();
  ok("every operational twin is listed as a row", rows === 5, `${rows} rows`);

  // The regression this guards: five equal-weight cards. Each carried a boxed
  // screenshot over 12px copy in a 209px measure — about 33 characters a line.
  // Assert the measure, because that is what actually failed, and a count of
  // elements would have stayed green through the whole card-wall version.
  const measure = await page.locator(".twin-desc").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const w = el.getBoundingClientRect().width;
    const px = parseFloat(cs.fontSize);
    return { chars: Math.round(w / (px * 0.5)), size: cs.fontSize };
  });
  ok("twin descriptions get a readable measure", measure.chars >= 60,
    `${measure.chars} chars at ${measure.size}`);

  // Five identical boxes have nothing to rank. Five city names sharing one left
  // edge give the eye a column to scan — that IS the anchor.
  const lefts = await page.locator(".twin-city").evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().left)));
  ok("the five city names share one anchor edge", new Set(lefts).size === 1, lefts.join(","));

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

  const linkHover = await page.locator(".twin-row").first().evaluate((el) => {
    const a = el.querySelector(".twin-link-label");
    return a ? getComputedStyle(a).color : "";
  });
  ok("the twin URL keeps the wayfinding colour", linkHover !== "", linkHover);

  ok("no page errors on the Overview twins directory", failures.length === 0, failures.slice(0, 2).join(" | "));
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
        out.push({
          chars: Math.round(r.width / (parseFloat(cs.fontSize) * 0.5)),
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
  ok("headings carry a shorter measure than prose", /^[\d.]+ch$/.test(headToken) && headToken < measureToken,
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
  const views = ["overview", "innovation", "record", "news", "history", "cities",
    "projects", "framework", "partners", "insights", "library", "research", "essay"];
  const long = [];
  let smallHeadings = [];
  let measured = 0;
  for (const v of views) {
    await page.goto(`${BASE}/#${v}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(450);
    const f = await page.evaluate(() => {
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
        const t = (el.textContent || "").trim();
        if (!t) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        n++;
        if (px < bodyPx) tiny.push(`${el.tagName}.${String(el.className).split(" ")[0]}@${px}px (body ${bodyPx}px)`);
        const r = document.createRange();
        r.selectNodeContents(el);
        const rects = [...r.getClientRects()].filter((x) => x.width > 4);
        if (!rects.length) continue;
        // Budget in characters, scaled down as type grows: display steps want a
        // shorter line than body copy.
        const chars = Math.round(Math.max(...rects.map((x) => x.width)) / (px * 0.5));
        if (chars / (px / 16) > 55) over.push(`${v} ${el.tagName}.${String(el.className).split(" ")[0]}=${chars}`);
      }
      return { over, tiny, n };
    });
    measured += f.n;
    long.push(...f.over);
    if (f.tiny.length) smallHeadings = smallHeadings.concat(f.tiny);
  }
  ok("no heading runs a line too long to scan back from", long.length === 0,
    long.length ? long.slice(0, 4).join(" | ") : `${measured} headings swept`);

  // The seven Roman-numeral section headings of the flagship essay were 12px —
  // the only headings on the site on the micro step, and a different size from
  // their own class sibling "Executive Summary".
  ok("no heading is set below the body step", smallHeadings.length === 0,
    smallHeadings.length ? [...new Set(smallHeadings)].slice(0, 4).join(" | ") : "none under 14px");

  // Control for the sweep itself.
  ok("the heading sweep visits real headings (control)", measured > 200, `${measured} headings`);

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
  await page.locator(".site-nav").waitFor({ timeout: 20_000 });
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
    "partners", "insights", "research", "essay", "data", "contacts", "ascn9"];
  const prose = { th: [], zh: [] };
  {
    const { page } = await newPage({ width: 1280, height: 900 });
    for (const route of routesForProse) {
      await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
      await page.locator(".site-nav").waitFor({ timeout: 20_000 });
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
            if (hits >= 3) out.push(`${hits}/${words.length} ${t.slice(0, 50)}`);
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
  for (const name of ["ascn-news.json", "ascn-knowledge.json", "ascn-library.json",
    "ascn-library-full.json", "ascn-correspondence.json", "ascn-projects.json"]) {
    const res = await fetch(`${BASE}/data/${name}`).catch(() => null);
    if (res && res.ok) datasetText.push((await res.text()).replace(/\s+/g, " "));
  }
  const isSourceValue = (t) => {
    const flat = t.replace(/\s+/g, " ").trim();
    return datasetText.some((raw) => raw.includes(flat) || flat.slice(0, 50).length > 40 && raw.includes(flat.slice(0, 50)));
  };

  for (const lang of ["th", "zh"]) {
    const authored = [...new Set(prose[lang])].filter((entry) => {
      const text = entry.replace(/^[^:]*:\s*/, "").replace(/^\d+\/\d+\s*/, "");
      return !isSourceValue(text);
    });
    ok(`no untranslated authored prose when ${lang} is chosen`, authored.length === 0,
      authored.length ? `${authored.length} untranslated: ${authored.slice(0, 3).join(" | ")}`
        : `${routesForProse.length} views; source-language values exempt by decision`);
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
    "partners", "insights", "research", "essay", "data", "contacts"];
  const bad = { targets: [], overflow: [], navRows: [], header: [], mount: [] };
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

  for (const width of [390, 1440]) {
    const { page } = await newPage({ width, height: width === 390 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
      await page.locator(".site-nav").waitFor({ timeout: 20_000 });
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
        const targets = [...document.querySelectorAll("a, button, [role=button], summary")];
        const short = targets.filter((el) => {
          if (!vis(el)) return false;
          if (el.closest(".leaflet-container")) return false;
          if (el.closest(ATTRIBUTION)) return false;
          if ((el.textContent || "").trim().length < 3) return false; // icon-only, still a control
          const min = inlineTextLink(el) ? TEXT_MIN : CONTROL_MIN;
          return el.getBoundingClientRect().height < min - LAYOUT_UNIT;
        }).map((el) => {
          // Print the raw height, unrounded. toFixed(1) collapses a genuine
          // sub-pixel shortfall — 43.96px prints as "44.0" — so the report
          // claims an element cleared the 44px floor while the assertion that
          // flagged it read a number below it. A diagnostic that can disagree
          // with the assertion it explains is worse than no diagnostic. Also
          // record whether the floor is even declared, because a box with no
          // min-height is a different bug from one that has one and misses.
          const h = el.getBoundingClientRect().height;
          const declared = parseFloat(getComputedStyle(el).minHeight) || 0;
          return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}@${h}px (min-height:${declared}px, ${(h - declared).toFixed(3)}px short)${inlineTextLink(el) ? " text" : " action"}`;
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

        const nav = document.querySelector(".site-nav nav");
        const live = [...document.querySelectorAll(".view")]
          .filter((v) => v.getBoundingClientRect().height > 0).map((v) => v.id);
        return {
          short: [...new Set(short)],
          overflow: canPan,
          escaped,
          navH: Math.round(nav.getBoundingClientRect().height),
          headerH: Math.round(document.querySelector(".site-nav").getBoundingClientRect().height),
          live,
        };
      });
      const tag = `${width}/${route}`;
      if (m.short.length) bad.targets.push(`${tag}: ${m.short.join(", ")}`);
      if (m.overflow > 1 || m.escaped > 0) bad.overflow.push(`${tag}: pans ${m.overflow}px, ${m.escaped} escaping`);
      // One row of ~44px links plus a couple of pixels. A wrapped strip is 3-4x.
      if (m.navH > 64) bad.navRows.push(`${tag}: nav ${m.navH}px`);
      if (m.headerH > 120) bad.header.push(`${tag}: header ${m.headerH}px`);
      // A hash that mounts nothing checks nothing, and reports as if it did.
      if (m.live.length !== 1) bad.mount.push(`${tag}: ${m.live.length} views live (${m.live.join(",") || "none"})`);
      for (const v of m.live) covered.add(v);
    }
    await page.close();
  }

  const neverReached = routable.filter((v) => !covered.has(v));
  if (neverReached.length) bad.mount.push(`never reached: ${neverReached.join(", ")}`);

  ok("every control clears its touch-target minimum", bad.targets.length === 0,
    bad.targets.slice(0, 4).join(" | ") || `${routes.length} routes x 2 widths`);
  ok("no route overflows horizontally", bad.overflow.length === 0,
    bad.overflow.slice(0, 4).join(" | ") || "clean at 390 and 1440");
  ok("the tab strip stays on one row", bad.navRows.length === 0,
    bad.navRows.slice(0, 3).join(" | ") || "no wrapping");
  ok("the header stays a two-row band", bad.header.length === 0,
    bad.header.slice(0, 3).join(" | ") || "brand + one scrollable strip");
  ok("every routable view is reached by a real route", bad.mount.length === 0,
    bad.mount.slice(0, 3).join(" | ") || `${routable.length} routable views mounted; ${gated.length} interaction-gated: ${gated.join(", ") || "none"}`);
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
  const outside = [...css.matchAll(/#[0-9a-fA-F]{6}/g)]
    .map((m) => m[0].toLowerCase())
    .filter((h) => ["/0f172a", "/38bdf8", "/0b0f14", "/0a0e14", "/e6edf3", "/f1f5f9"].includes(h));
  ok("no Tailwind default hexes in the stylesheet", outside.length === 0, [...new Set(outside)].join(" "));
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

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) { failed++; console.log(`  FAIL  ${r.label}${r.detail ? `  [${r.detail}]` : ""}`); }
}
console.log(`Graphics and previews: ${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
