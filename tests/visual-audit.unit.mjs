import test from 'node:test';
import assert from 'node:assert/strict';
import { outsidePalette, shorterMeasure, undersizedTarget } from '../scripts/visual-audit-rules.mjs';

test('palette guard catches real hex tokens and ignores explanatory comments', () => {
  assert.deepEqual(outsidePalette('p {color:#0F172A; background:#38bdf8}'), ['#0f172a','#38bdf8']);
  assert.deepEqual(outsidePalette('/* rejected #0f172a */ p {color:var(--ink)}'), []);
  assert.deepEqual(outsidePalette(':root {--deep:#0a0e14;}'), []);
  assert.deepEqual(outsidePalette('p {background:#0a0e14;}'), ['#0a0e14']);
});
test('measure comparison is numeric, never lexicographic', () => {
  assert.equal(shorterMeasure('100ch','55ch'), false);
  assert.equal(shorterMeasure('40ch','55ch'), true);
  assert.equal(shorterMeasure('40px','55ch'), false);
});
test('touch controls need both dimensions, including icon-only and form targets', () => {
  assert.equal(undersizedTarget({width:20,height:44}), true);
  assert.equal(undersizedTarget({width:44,height:20}), true);
  assert.equal(undersizedTarget({width:44,height:44}), false);
  assert.equal(undersizedTarget({width:43.9999,height:44}), false);
});
