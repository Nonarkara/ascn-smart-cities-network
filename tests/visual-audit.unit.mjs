import test from 'node:test';
import assert from 'node:assert/strict';
import { outsidePalette, shorterMeasure, undersizedTarget, mediaCaptionFits } from '../scripts/visual-audit-rules.mjs';

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

test('media caption rejects overlap, vertical escape, and underneath overhang', () => {
  const box = (left, top, width, height) => ({left,top,width,height,right:left+width,bottom:top+height});
  const video = box(200,0,180,300), figure = box(0,0,380,400), band = box(0,0,800,400);
  const fits = (caption, outer = figure) => mediaCaptionFits({video,caption,figure:outer,band});
  assert.equal(fits(box(0,200,190,100)), true);
  assert.equal(fits(box(200,310,180,80)), true);
  assert.equal(fits(box(220,100,100,100)), false);
  assert.equal(fits(box(0,350,180,100)), false);
  assert.equal(fits(box(190,310,190,80)), false);
  assert.equal(fits(box(0,200,190,100), box(0,0,380,450)), false);
});
