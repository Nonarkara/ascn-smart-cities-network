// Decide whether Check Site runs the Playwright release gate.
//
// A discovery-index refresh only rewrites files under data/. That commit
// cannot move a rule or a column, and the full gate was spending about
// seven minutes to re-measure the same layout and then failing on holes
// that the data did not create. The visual gate still runs whenever any
// path outside data/ changes. An empty diff, a rename that leaves data/,
// or a diff that cannot be read all run the visual gate: skipping it has
// to be a positive claim that every path is data.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ZERO = /^0+$/;

export function isDataPath(file) {
  const path = String(file).replaceAll('\\', '/').replace(/^\.\//, '').replace(/^"|"$/g, '');
  if (!path || path.includes('..') || path.startsWith('/') || path.endsWith('/')) return false;
  return path.startsWith('data/');
}

// `git diff --name-status` lines. A rename lists the old path and the new
// one; both have to be data or the layout may have moved with the rename.
export function parseNameStatus(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = parts[0] || '';
    const paths = parts.slice(1).map((part) => part.trim()).filter(Boolean);
    rows.push({ status, paths });
  }
  return rows;
}

export function visualGateRequired(rows) {
  if (!rows || !rows.length) return true;
  for (const row of rows) {
    if (!row.paths || !row.paths.length) return true;
    for (const path of row.paths) {
      if (!isDataPath(path)) return true;
    }
  }
  return false;
}

function writeOutput(visual) {
  const line = `visual=${visual ? 'true' : 'false'}`;
  console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
}

function range() {
  const event = process.env.GITHUB_EVENT_NAME || '';
  if (event === 'pull_request') return { base: process.env.BASE_SHA, head: process.env.HEAD_SHA };
  if (event === 'push') return { base: process.env.BEFORE_SHA, head: process.env.HEAD_SHA || process.env.GITHUB_SHA };
  return null;
}

function main() {
  const commits = range();
  if (!commits || !commits.base || !commits.head || ZERO.test(commits.base) || ZERO.test(commits.head)) {
    console.log('No comparable range; running the visual gate.');
    writeOutput(true);
    return;
  }
  let text = '';
  try {
    text = execFileSync('git', ['diff', '--name-status', commits.base, commits.head], { encoding: 'utf8' });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.log('Could not diff the range; running the visual gate.');
    writeOutput(true);
    return;
  }
  const visual = visualGateRequired(parseNameStatus(text));
  const listed = text.trim();
  console.log(listed || '(empty diff)');
  console.log(!listed
    ? 'Empty diff; running the full visual gate.'
    : visual
      ? 'A path outside data/ changed; running the full visual gate.'
      : 'Only data/ changed; running the cheap check.');
  writeOutput(visual);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
