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

// ── The grid law ─────────────────────────────────────────────────────────
// The falsifier for scripts/audit-grids.mjs: a planted stranded row must
// fail, a complete row must pass, and a short row that is not the last row
// is a composition — reported, not failed.
import { judgeGridRows } from '../scripts/audit-grids.mjs';
import { judgeTargets, CONTROL_MIN, REFERENCE_MIN } from '../scripts/audit-targets.mjs';

test('grid law: a last row with an empty cell fails', () => {
  const judged = judgeGridRows([
    { view: 'data', sel: '#document-grid', row: 3, rows: 3, cols: 3, emptyCells: 1, empty: '3', rowItems: 2, items: 11, last: true },
  ]);
  assert.equal(judged.failures.length, 1);
  assert.match(judged.failures[0], /document-grid/);
  assert.match(judged.failures[0], /cell\(s\) 3 empty/);
});

test('grid law: a complete row passes, and a short middle row is only noted', () => {
  const judged = judgeGridRows([
    { view: 'data', sel: '#document-grid', row: 1, rows: 3, cols: 3, emptyCells: 0, empty: '', rowItems: 3, items: 11, last: false },
    { view: 'data', sel: '#document-grid', row: 2, rows: 3, cols: 3, emptyCells: 2, empty: '2,3', rowItems: 1, items: 11, last: false },
  ]);
  assert.equal(judged.failures.length, 0);
  assert.equal(judged.notes.length, 1);
});

test('grid law: the last row that takes the columns it has left passes', () => {
  const judged = judgeGridRows([
    { view: 'contacts', sel: '.contacts-grid', row: 3, rows: 3, cols: 4, emptyCells: 0, empty: '', rowItems: 3, items: 11, last: true },
  ]);
  assert.equal(judged.failures.length, 0);
});

// ── Touch targets ───────────────────────────────────────────────────────
// The falsifier for scripts/audit-targets.mjs: a planted 30px control must
// fail, and a reference link is held to the AA bar, not the control bar.
test('touch targets: a 30px control fails, a 44px control passes', () => {
  const row = (targets) => [{ view: 'cities', lang: 'en', width: 390, targets }];
  assert.equal(judgeTargets(row([{ sel: 'a.leaflet-control-zoom-in', width: 30, height: 30, reference: false, text: '+' }])).length, 1);
  assert.equal(judgeTargets(row([{ sel: 'a.leaflet-control-zoom-in', width: 44, height: 44, reference: false, text: '+' }])).length, 0);
});

test('touch targets: a reference link is held to 24px, not to 44px', () => {
  const row = (targets) => [{ view: 'contacts', lang: 'en', width: 390, targets }];
  assert.equal(judgeTargets(row([{ sel: 'a.cc-inst', width: 120, height: 24, reference: true, text: 'Ministry of Interior' }])).length, 0);
  assert.equal(judgeTargets(row([{ sel: 'a.cc-inst', width: 120, height: 20, reference: true, text: 'Ministry of Interior' }])).length, 1);
  // A reference link that is a control in all but name still fails at 30px.
  assert.equal(judgeTargets(row([{ sel: 'a.prog-link', width: 30, height: 30, reference: false, text: '↗' }])).length, 1);
  assert.equal(CONTROL_MIN, 44);
  assert.equal(REFERENCE_MIN, 24);
});
