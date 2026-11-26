// One pre-upload path for data and interface changes. Keep the preview alive
// across browser tests and screenshot audits so they examine the same build.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { releaseFiles } from './verify-publication.mjs';

const port = process.env.ASCN_RELEASE_PORT || '4197';
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, ASCN_TEST_URL: base, ASCN_SH_LABEL: 'release', ASCN_SH_STRICT: '1', ASCN_SCREENSHOTS: 'artifacts/release/views' };
const output = 'artifacts/release';
await mkdir(output, { recursive: true });
const report = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), startedAt: new Date().toISOString(), base, checks: [], passed: false, independentVisualReview: 'Required for visual changes; inspect local screenshots against DESIGN-ANTI-SLOP.md and DESIGN-MSH.md.' };
const requireCommittedData = process.argv.includes('--require-committed-data');
const fingerprint = async () => Object.fromEntries(await Promise.all(releaseFiles.map(async file => [
  file, createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex'),
])));
let preview;
let active;
function run(command, args, envPatch) {
  return new Promise((resolve, reject) => {
    active = spawn(command, args, { env: { ...env, ...(envPatch || {}) }, stdio: 'inherit' });
    active.once('error', reject);
    active.once('exit', (code, signal) => { active = null; code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed (${signal || code})`)); });
  });
}
function stop() { active?.kill('SIGTERM'); preview?.kill('SIGTERM'); }
async function check(name, command, args, envPatch) {
  console.log(`\nRelease check: ${name}`);
  const step = { name, passed: false };
  report.checks.push(step);
  await writeFile(`${output}/checks.json`, JSON.stringify(report, null, 2) + '\n');
  await run(command, args, envPatch);
  step.passed = true;
}
process.once('SIGINT', () => { stop(); process.exitCode = 130; });
process.once('SIGTERM', () => { stop(); process.exitCode = 143; });
try {
  // Clear prior evidence before any gate runs, including dependency/data
  // failures. An earlier green report must never describe a failed new run.
  await writeFile(`${output}/checks.json`, JSON.stringify(report, null, 2) + '\n');
  await check('Dependency security', 'npm', ['audit', '--audit-level=high']);
  await check('Design, data, unit and public artifact checks', 'npm', ['run', 'check']);
  report.releaseSha256 = await fingerprint();
  report.indexSha256 = report.releaseSha256['index.html'];
  if (requireCommittedData) {
    for (const file of releaseFiles.filter(path => path.startsWith('data/'))) {
      const reviewed = execFileSync('git', ['show', `${report.revision}:${file}`], { maxBuffer: 25 * 1024 * 1024 });
      if (createHash('sha256').update(reviewed).digest('hex') !== report.releaseSha256[file]) {
        throw new Error(`Commit the reviewed dataset before deploying: ${file}`);
      }
    }
  }
  // Refuse an occupied port: a different or stale preview cannot stand in for
  // the artifact whose upload this gate is authorising.
  const occupied = await fetch(base, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);
  if (occupied) throw new Error(`Release preview port ${port} is already in use; choose ASCN_RELEASE_PORT.`);
  preview = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', port, '--compatibility-date=2026-06-20'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
  let previewError;
  preview.once('error', (error) => { previewError = error; });
  const deadline = Date.now() + 60000;
  while (true) {
    if (previewError) throw previewError;
    if (preview.exitCode !== null) throw new Error('Release preview exited before becoming ready');
    const ready = await fetch(base, { signal: AbortSignal.timeout(2000) }).then((r) => { r.body?.cancel(); return r.ok; }, () => false);
    if (ready) break;
    if (Date.now() > deadline) throw new Error('Release preview did not become ready');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  for (const [name, command, args] of [
    ['Browser flows and incoming-data regressions', 'npx', ['playwright', 'test']],
    ['Spatial geometry and map readiness', 'npm', ['run', 'audit:spatial']],
    ['Composition bands — empty content area beside content', 'npm', ['run', 'audit:composition']],
    // The modes are not the same geometry: Thai has no word spaces and
    // Chinese sets a character per em, so the same content breaks into
    // different lines. A defect that reads as a margin in English can be a
    // hole in Thai, and an English-only sweep will never find it. Each
    // mode that is not swept is a mode nobody has looked at.
    ['Composition bands — Thai', 'npm', ['run', 'audit:composition'], { ASCN_COMPOSITION_LANG: 'th' }],
    ['Composition bands — Chinese', 'npm', ['run', 'audit:composition'], { ASCN_COMPOSITION_LANG: 'zh' }],
    ['Composition bands — light theme', 'npm', ['run', 'audit:composition'], { ASCN_COMPOSITION_THEME: 'light' }],
    ['Graphics and rendered reading measure', 'npm', ['run', 'audit:graphics']],
    // The languages are not the same page. A reader in Thai and a reader in
    // Chinese meet different text, and a defect in one is invisible in the
    // other: the platform's own English, left standing where the reader is
    // not looking. Each language is swept on its own, so a failure says
    // which one.
    ['Translation — no English left standing on the Thai pages', 'node', ['scripts/audit-i18n.mjs'], { ASCN_I18N_LANG: 'th' }],
    ['Translation — no English left standing on the Chinese pages', 'node', ['scripts/audit-i18n.mjs'], { ASCN_I18N_LANG: 'zh' }],
    // The reading measure, in every script. The character ceiling is a Latin
    // calibration: a Chinese paragraph that has lost its measure column reads
    // as 68 characters and passes it while running three measures wide. The
    // em ceiling is the script-neutral form of the same law, and each
    // language is swept on its own — a measure that has only ever been
    // measured in one script has only ever been measured once.
    ['Reading measure — Latin', 'node', ['scripts/audit-measure.mjs'], { ASCN_MEASURE_LANG: 'en' }],
    ['Reading measure — Thai', 'node', ['scripts/audit-measure.mjs'], { ASCN_MEASURE_LANG: 'th' }],
    ['Reading measure — Chinese', 'node', ['scripts/audit-measure.mjs'], { ASCN_MEASURE_LANG: 'zh' }],
    ['Page cost in screens — every view within its cap', 'npm', ['run', 'audit:cost']],
    ['All-view visual captures', 'npm', ['run', 'audit:visual']],
    ['Complete reading-path captures', 'npm', ['run', 'audit:reading']],
  ]) {
    await check(name, command, args);
  }
  const after = await fingerprint();
  const changed = releaseFiles.find(file => after[file] !== report.releaseSha256[file]);
  if (changed) throw new Error(`Release file changed during verification: ${changed}`);
  report.passed = true;
  console.log('Release automation passed. Visual changes still require independent screenshot review.');
} catch (error) {
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stop();
  report.finishedAt = new Date().toISOString();
  await writeFile(`${output}/checks.json`, JSON.stringify(report, null, 2) + '\n');
}
