// ─────────────────────────────────────────────────────────────────────────────
// The basemap is a third party. OpenStreetMap's tile server is not this
// repository's code, and it goes down, throttles, and times out.
//
// A gate that cannot tell an upstream outage from a broken map fails on the
// outage and — worse — teaches its readers to re-run a red gate until it
// goes green, which is the same as having no gate. So the instrument makes
// the distinction explicit, and proves something real in both branches.
//
// The evidence is what THE PAGE ITSELF received, watched on the browser's
// own request events. That is the only evidence that settles the question:
// a probe from outside the browser cannot tell a server that answered 200
// from a server that answered 429 to the browser and 200 to the probe.
//
//   · some tile decoded and drew → PASS.
//   · the page asked for a tile that does not exist (404, 410) → THE SITE IS
//     AT FAULT: the URL template is wrong. Fail.
//   · the page's requests never left the browser (no request event at all,
//     though the tile images carry a source) → the site's own policy blocked
//     them: a CSP that does not allow the tile host. THE SITE IS AT FAULT.
//   · the page's requests failed at the network, or the server refused
//     (429, 403), or errored (5xx) → AN UPSTREAM OUTAGE. The site must then
//     degrade the way it promises: the notice appears, the markers stay, and
//     the reader can still choose a city. That is what is checked.
//   · the server answered 200 with bytes the browser could not decode → the
//     server served something that is not a tile. Not the site's fault, and
//     not something the site can fix; the degradation is still checked.
//
// The judgement is separated from the measurement so a test can plant each
// case and prove the branch is taken (tests/tile-health.unit.mjs and
// tests/tile-health.spec.mjs).
// ---------------------------------------------------------------------------

export const TILE_HOST = "tile.openstreetmap.org";

// The statuses that mean "the server would not serve this to us".
const REFUSED = new Set([401, 403, 429]);
const SERVER_ERROR = new Set([500, 502, 503, 504]);

// Watch the tile requests the page makes. Attach this BEFORE the map is
// created — a watcher attached afterwards has missed the evidence.
export function watchTileRequests(page) {
  const seen = [];
  page.on("request", (request) => {
    if (!isTileUrl(request.url())) return;
    seen.push({ url: request.url(), status: null, outcome: "requested" });
  });
  page.on("response", (response) => {
    const entry = seen.find((r) => r.url === response.url() && r.status === null);
    if (!entry) return;
    entry.status = response.status();
    entry.outcome = "answered";
  });
  page.on("requestfailed", (request) => {
    const entry = seen.find((r) => r.url === request.url() && r.status === null);
    if (!entry) return;
    entry.status = null;
    entry.outcome = "failed";
    entry.failure = request.failure()?.errorText || "the request failed";
  });
  return seen;
}

export function isTileUrl(url) {
  try { return new URL(url).hostname === TILE_HOST; } catch { return false; }
}

// The verdict for one basemap check.
//   ok        — the release may proceed
//   siteFault — the site is broken; a release must fail
//   degraded  — an upstream outage, and the site handled it as it promises
export function judgeBasemap({ tilesLoaded, seen = [], images = [] }) {
  if (tilesLoaded) {
    return { ok: true, siteFault: false, degraded: false, reason: "the basemap drew its tiles" };
  }

  // The page asked for a tile that is not there. The URL template is the
  // site's own, so this is the site's mistake.
  const missing = seen.find((r) => r.status === 404 || r.status === 410);
  if (missing) {
    return {
      ok: false, siteFault: true, degraded: false,
      reason: `the site asked for ${missing.url} and the server answered ${missing.status} — the tile URL is wrong`,
    };
  }

  // The page carries tile images with sources, but no request ever went out:
  // something in the site's own policy refused to make it. A content
  // security policy that does not allow the tile host is exactly this.
  const asked = seen.length > 0;
  const imagesWithSources = images.filter((image) => image.src);
  if (!asked && imagesWithSources.length > 0) {
    return {
      ok: false, siteFault: true, degraded: false,
      reason: `the page carries ${imagesWithSources.length} tile image(s) but never requested them — the site's own policy blocked the requests`,
    };
  }

  // Refused, throttled, or the server's own error.
  const refused = seen.find((r) => REFUSED.has(r.status) || SERVER_ERROR.has(r.status));
  if (refused) {
    return {
      ok: true, siteFault: false, degraded: true,
      reason: `the tile server answered ${refused.url} with ${refused.status} — an upstream outage, not a site fault`,
    };
  }

  // The request failed in the network: refused the connection, no such host,
  // a timeout.
  const failed = seen.find((r) => r.outcome === "failed");
  if (failed) {
    return {
      ok: true, siteFault: false, degraded: true,
      reason: `the request for ${failed.url} failed in the network (${failed.failure || "no answer"}) — an upstream outage, not a site fault`,
    };
  }

  // The server answered 200, but the bytes were not a tile the browser could
  // draw. Not the site's fault, and not something the site can fix; the
  // degradation is still checked.
  const answered = seen.find((r) => r.status >= 200 && r.status < 300);
  if (answered) {
    return {
      ok: true, siteFault: false, degraded: true,
      reason: `the tile server answered ${answered.url} with ${answered.status} but the bytes were not a tile the browser could draw — an upstream fault`,
    };
  }

  // Nothing was observed at all: no tiles, no requests, no images.
  return {
    ok: false, siteFault: false, degraded: false,
    reason: "the basemap drew no tiles and no tile request was ever observed — the map was never asked for anything",
  };
}

// The tile images the page carries, and whether any of them decoded.
export async function readTiles(page, selector) {
  try {
    return await page.locator(`${selector} .leaflet-tile`).evaluateAll((tiles) => tiles.map((tile) => ({
      src: tile.currentSrc || tile.src || "",
      complete: !!tile.complete,
      naturalWidth: tile.naturalWidth || 0,
    })));
  } catch {
    return [];
  }
}

// Wait for the basemap to draw. Returns the verdict from judgeBasemap.
export async function checkBasemap(page, selector, options = {}) {
  const { timeout = 12_000, seen = [] } = options;
  try {
    await page.waitForFunction((sel) => {
      const map = document.querySelector(sel);
      if (!map) return false;
      const tiles = [...map.querySelectorAll(".leaflet-tile")];
      return tiles.length > 0 && tiles.some((tile) => tile.complete && tile.naturalWidth > 0);
    }, selector, { timeout });
  } catch { /* fall through to the judgement */ }

  const images = await readTiles(page, selector);
  const tilesLoaded = images.some((image) => image.complete && image.naturalWidth > 0);
  const verdict = judgeBasemap({ tilesLoaded, seen, images });

  // The site's own promise, checked when the server is the one that failed:
  // the notice appears, and the markers stay, so the reader can still choose
  // a city on a map with no basemap.
  if (verdict.degraded) {
    const notice = page.locator(`${selector}`).locator("xpath=ancestor-or-self::*[contains(@class,'map-view')]//p[contains(@class,'map-notice')]").first();
    try {
      await notice.waitFor({ state: "visible", timeout: 8000 });
    } catch {
      return {
        ...verdict, ok: false, siteFault: true,
        reason: `${verdict.reason}; and the site did not show its tile notice, so the reader is left with an unexplained empty map`,
      };
    }
    const markers = await page.locator(`${selector} .leaflet-interactive`).count();
    if (markers === 0) {
      return {
        ...verdict, ok: false, siteFault: true,
        reason: `${verdict.reason}; and the map carries no markers, so the reader cannot choose a city`,
      };
    }
  }
  return verdict;
}
