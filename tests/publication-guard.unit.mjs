import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteEntries, isPublishedFile } from '../scripts/site-assets.mjs';
import { assertPublicBuild, verifyLivePublication, privateProbes } from '../scripts/verify-publication.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'ascn-publication-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = new Map(siteEntries.filter(isPublishedFile).map(x => [x, Buffer.from(`public ${x}`)]));
  files.set('data/ascn-archive.json', await readFile(new URL('../data/ascn-archive.json', import.meta.url)));
  for (const [path, bytes] of files) {
    await mkdir(join(directory, path, '..'), { recursive: true });
    await writeFile(join(directory, path), bytes);
  }
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ path: url.pathname, options });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    return files.has(file) ? new Response(files.get(file)) : new Response('Not found', {status:404,headers:{'cache-control':'no-store'}});
  };
  return {directory,files,fetchImpl,calls};
}

test('finished artifact rejects private files inserted after the copy step', async t => {
  const f = await fixture(t);
  await assertPublicBuild(f.directory);
  for (const path of ['data/ascn-correspondence.json', 'data/unreviewed.json', 'lib/ascn-record.mjs', 'media/ascn9/private.png', '.env', 'unknown/private.txt']) {
    await mkdir(join(f.directory, path, '..'), {recursive:true});
    await writeFile(join(f.directory, path), 'synthetic private canary');
    await assert.rejects(assertPublicBuild(f.directory), /Unreviewed publication file|hidden entry/);
    await rm(join(f.directory, path));
  }
});

test('finished artifact refuses symlinks and changed archive content', async t => {
  const f = await fixture(t);
  await symlink(join(f.directory,'app.js'), join(f.directory,'leak.js'));
  await assert.rejects(assertPublicBuild(f.directory), /symbolic link/);
  await rm(join(f.directory,'leak.js'));
  const archive = JSON.parse(f.files.get('data/ascn-archive.json'));
  archive.items[0].note.en = 'Synthetic unreviewed claim';
  await writeFile(join(f.directory,'data/ascn-archive.json'),JSON.stringify(archive));
  await assert.rejects(assertPublicBuild(f.directory), /source-reviewed/);
});

test('live guard checks exact release bytes and GETs every private route without redirects', async t => {
  const f = await fixture(t);
  assert.deepEqual(await verifyLivePublication('https://example.org',{...f}),{publicFiles:4,privateRoutes:privateProbes.length});
  assert.equal(f.calls.length,4+privateProbes.length);
  assert.ok(f.calls.every(x => !x.options.method && x.options.redirect === 'manual'));
});

test('a healthy home page cannot hide a private route returning 200 or a redirect', async t => {
  for (const status of [200,302,404]) {
    const f = await fixture(t);
    await assert.rejects(verifyLivePublication('https://example.org',{
      directory:f.directory,
      fetchImpl:async (url,options) => url.pathname === privateProbes[0]
        ? new Response('synthetic private canary',{status}) : f.fetchImpl(url,options),
    }),/Private route is not a no-store 404/);
  }
});

test('live guard rejects stale public assets and transport errors', async t => {
  const f = await fixture(t);
  await assert.rejects(verifyLivePublication('https://example.org',{
    directory:f.directory,
    fetchImpl:async (url,options) => url.pathname === '/app.js' ? new Response('stale') : f.fetchImpl(url,options),
  }),/Live release differs: app.js/);
  await assert.rejects(verifyLivePublication('https://example.org',{
    directory:f.directory, fetchImpl:async () => {throw new Error('network unavailable');},
  }),/network unavailable/);
});


test('missing security headers cannot pass as a complete build', async t => {
  const f = await fixture(t);
  await rm(join(f.directory, '_headers'));
  await assert.rejects(assertPublicBuild(f.directory), /ENOENT|Missing publication entry/);
});
