// The tile-health instrument must be able to tell the branches apart:
//   1. the basemap drew its tiles — a pass;
//   2. the tile server refused, failed in the network, or served something
//      that is not a tile — an upstream outage, and the site must degrade
//      the way it promises;
//   3. the site asked for a tile that does not exist, or its own policy
//      blocked the requests — the site is at fault, and a release must fail.
//
// A gate that cannot tell 2 from 3 fails on somebody else's outage, and its
// readers learn to re-run a red gate until it goes green. So each branch is
// planted here and proved to be taken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeBasemap } from '../scripts/tile-health.mjs';

const url = 'https://tile.openstreetmap.org/5/26/15.png';

test('tiles drawn is a pass', () => {
  const verdict = judgeBasemap({ tilesLoaded: true, seen: [], images: [] });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.siteFault, false);
  assert.equal(verdict.degraded, false);
});

test('a refused or erroring tile server is an upstream outage, not a site fault', () => {
  for (const status of [401, 403, 429, 500, 502, 503, 504]) {
    const verdict = judgeBasemap({
      tilesLoaded: false,
      seen: [{ url, status, outcome: 'answered' }],
      images: [{ src: url, complete: true, naturalWidth: 0 }],
    });
    assert.equal(verdict.ok, true, `status ${status}`);
    assert.equal(verdict.siteFault, false, `status ${status}`);
    assert.equal(verdict.degraded, true, `status ${status}`);
  }
});

test('a request that failed in the network is an upstream outage', () => {
  const verdict = judgeBasemap({
    tilesLoaded: false,
    seen: [{ url, status: null, outcome: 'failed', failure: 'net::ERR_CONNECTION_REFUSED' }],
    images: [{ src: url, complete: false, naturalWidth: 0 }],
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.siteFault, false);
  assert.equal(verdict.degraded, true);
});

test('bytes that are not a tile are an upstream fault, and the site still has to degrade', () => {
  const verdict = judgeBasemap({
    tilesLoaded: false,
    seen: [{ url, status: 200, outcome: 'answered' }],
    images: [{ src: url, complete: true, naturalWidth: 0 }],
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.siteFault, false);
  assert.equal(verdict.degraded, true);
});

test('a tile URL the server does not have is the site’s own mistake', () => {
  for (const status of [404, 410]) {
    const verdict = judgeBasemap({
      tilesLoaded: false,
      seen: [{ url, status, outcome: 'answered' }],
      images: [{ src: url, complete: true, naturalWidth: 0 }],
    });
    assert.equal(verdict.ok, false, `status ${status}`);
    assert.equal(verdict.siteFault, true, `status ${status}`);
    assert.equal(verdict.degraded, false, `status ${status}`);
  }
});

test('a policy that blocks the tile requests is the site’s own fault', () => {
  // The page carries tile images with sources, but no request ever went out.
  const verdict = judgeBasemap({
    tilesLoaded: false,
    seen: [],
    images: [{ src: url, complete: false, naturalWidth: 0 }],
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.siteFault, true);
});

test('nothing observed at all is unverified, not a pass and not a site fault', () => {
  const verdict = judgeBasemap({ tilesLoaded: false, seen: [], images: [] });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.siteFault, false);
});
