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
      for (const el of document.querySelectorAll("h1,h2,h3,h4,h5")) {
        const t = (el.textContent || "").trim();
        if (!t) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        n++;
        if (px < 14) tiny.push(`${el.tagName}.${String(el.className).split(" ")[0]}@${px}px`);
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
