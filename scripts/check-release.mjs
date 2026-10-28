// One pre-upload path for data and interface changes. Keep the preview alive
// across browser tests and screenshot audits so they examine the same build.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const port = process.env.ASCN_RELEASE_PORT || '4197';
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, ASCN_TEST_URL: base, ASCN_SH_LABEL: 'release', ASCN_SH_STRICT: '1', ASCN_SCREENSHOTS: 'artifacts/release/views' };
const output = 'artifacts/release';
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), base, checks: [], passed: false, independentVisualReview: 'Required for visual changes; inspect local screenshots against DESIGN-ANTI-SLOP.md and DESIGN-MSH.md.' };
let preview;
let active;
function run(command, args) {
  return new Promise((resolve, reject) => {
    active = spawn(command, args, { env, stdio: 'inherit' });
    active.once('error', reject);
    active.once('exit', (code, signal) => { active = null; code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed (${signal || code})`)); });
  });
}
function stop() { active?.kill('SIGTERM'); preview?.kill('SIGTERM'); }
async function check(name, command, args) {
  console.log(`\nRelease check: ${name}`);
  const step = { name, passed: false };
  report.checks.push(step);
  await writeFile(`${output}/checks.json`, JSON.stringify(report, null, 2) + '\n');
  await run(command, args);
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
    ['All-view visual captures', 'npm', ['run', 'audit:visual']],
    ['Complete reading-path captures', 'npm', ['run', 'audit:reading']],
  ]) {
    await check(name, command, args);
  }
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
