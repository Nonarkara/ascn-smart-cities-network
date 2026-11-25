import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDataPath, parseNameStatus, visualGateRequired } from '../scripts/check-scope.mjs';

test('a discovery-index refresh stays off the visual gate', () => {
  const rows = parseNameStatus('M\tdata/ascn-news-discovery.json\n');
  assert.equal(visualGateRequired(rows), false);
  assert.equal(isDataPath('data/news-snapshot.json'), true);
});

test('any path outside data/ runs the visual gate', () => {
  assert.equal(visualGateRequired(parseNameStatus('M\tdata/ascn-news-discovery.json\nM\tstyles.css\n')), true);
  assert.equal(visualGateRequired(parseNameStatus('M\t.github/workflows/check.yml\n')), true);
  assert.equal(visualGateRequired(parseNameStatus('A\tscripts/check-scope.mjs\n')), true);
});

test('a rename that leaves data/ and an empty diff both run the visual gate', () => {
  assert.equal(visualGateRequired(parseNameStatus('R100\tstyles.css\tdata/moved.css\n')), true);
  assert.equal(visualGateRequired(parseNameStatus('R100\tdata/old.json\tdata/new.json\n')), false);
  assert.equal(visualGateRequired(parseNameStatus('')), true);
  assert.equal(visualGateRequired([]), true);
  assert.equal(visualGateRequired(parseNameStatus('M\n')), true);
});

test('a data path cannot escape the directory', () => {
  assert.equal(isDataPath('data/../styles.css'), false);
  assert.equal(isDataPath('/data/ascn-news-discovery.json'), false);
  assert.equal(isDataPath('data'), false);
  assert.equal(isDataPath('./data/ascn-news-discovery.json'), true);
  assert.equal(visualGateRequired(parseNameStatus('D\tdata/ascn-news-discovery.json\n')), false);
});
