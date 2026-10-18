import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isPublishedFile, siteEntries } from './site-assets.mjs';
import { assertPublicArchive } from './publication-policy.mjs';

const defaultArtifact = new URL('../dist/', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const privateProbes = [
  '/data/ascn-correspondence.json', '/data/ascn-email-evidence.json',
  '/data/ascn%2dcorrespondence.json', '/lib/ascn-record.mjs',
  '/lib/ascn-funding.mjs', '/lib/ascn-round2.mjs', '/lib/ascn-scrape.mjs',
  '/media/ascn9/ASCN_2026-07-20_IMG_korea-proposal.png',
  '/media/showcase/metadata.json', '/sources/ascn-archive/',
  '/scripts/publication-policy.mjs', '/.env', '/.git/config',
];

export async function assertPublicBuild(directory = defaultArtifact) {
  const root = directory instanceof URL ? directory : resolve(directory);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('Publication artifact must be a real directory');
  }
  let count = 0;
  async function walk(folder, relative = '') {
    for (const name of await readdir(folder)) {
      const rel = relative ? `${relative}/${name}` : name;
      const file = join(folder, name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink()) throw new Error(`Publication refuses symbolic link: ${rel}`);
      if (name.startsWith('.')) throw new Error(`Publication refuses hidden entry: ${rel}`);
      if (stat.isDirectory()) { await walk(file, rel); continue; }
      if (!stat.isFile() || !isPublishedFile(rel)) throw new Error(`Unreviewed publication file: ${rel}`);
      if (stat.size >= 25 * 1024 * 1024) throw new Error(`Publication file exceeds size limit: ${rel}`);
      count++;
    }
  }
  // Use filesystem paths for traversal, including when called with a file URL.
  const folder = root instanceof URL ? fileURLToPath(root) : root;
  await walk(folder);
  for (const file of siteEntries.filter(isPublishedFile)) {
    if (!(await lstat(join(folder, file))).isFile()) throw new Error(`Missing publication entry: ${file}`);
  }
  assertPublicArchive(JSON.parse(await readFile(join(folder, 'data/ascn-archive.json'), 'utf8')));
  return { files: count };
}

export async function verifyLivePublication(base, { directory = defaultArtifact, fetchImpl = fetch } = {}) {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Publication probe requires an HTTPS origin (or local preview origin)');
  }
  await assertPublicBuild(directory);
  const folder = directory instanceof URL ? fileURLToPath(directory) : resolve(directory);
  const request = (path) => fetchImpl(new URL(path, url), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  for (const file of ['index.html', 'app.js', 'styles.css', 'data/ascn-archive.json']) {
    const response = await request(file === 'index.html' ? '/' : `/${file}`);
    if (response.status !== 200) { await response.body?.cancel(); throw new Error(`Public release probe failed: ${file} (${response.status})`); }
    const expected = await readFile(join(folder, file));
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > expected.length) { await reader.cancel(); throw new Error(`Live release differs: ${file}`); }
      chunks.push(Buffer.from(value));
    }
    if (digest(Buffer.concat(chunks)) !== digest(expected)) throw new Error(`Live release differs: ${file}`);
  }
  for (const path of privateProbes) {
    const response = await request(path);
    // Never read or print private response bodies, including on failure.
    await response.body?.cancel();
    if (response.status !== 404 || !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') || '')) {
      throw new Error(`Private route is not a no-store 404: ${path} (${response.status})`);
    }
  }
  return { publicFiles: 4, privateRoutes: privateProbes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const live = process.argv.includes('--live');
    const result = live ? await verifyLivePublication(process.env.ASCN_TEST_URL || 'https://ascn.nonarkara.org') : await assertPublicBuild();
    console.log(`Publication ${live ? 'live' : 'artifact'} guard passed: ${JSON.stringify(result)}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
