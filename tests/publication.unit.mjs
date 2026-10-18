import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertPublicArchive, publicArchive } from '../scripts/publication-policy.mjs';
import { isPrivatePath } from '../lib/private-paths.mjs';
const data = JSON.parse(await readFile(new URL('../data/ascn-archive.json',import.meta.url)));

test('public projection is stable and private provenance cannot re-enter the build', () => {
  assert.deepEqual(publicArchive(data), data);
  const privateRecord = structuredClone(data.items[0]);
  privateRecord.id = 'synthetic-private'; privateRecord.source = 'inbox';
  const altered = structuredClone(data); altered.items.push(privateRecord);
  assert.throws(() => assertPublicArchive(altered), /private provenance|public source/);
  const withheld = structuredClone(data); withheld.withheld.push({ id:'private-example', reason:{en:'Internal',th:'ภายใน',zh:'内部'} });
  assert.throws(() => assertPublicArchive(withheld), /private provenance/);
});
test('private paths include encoded variants and descendant assets', () => {
  for(const path of ['/data/ascn-correspondence.json','/data/ascn%2dcorrespondence.json','/media/ascn9/slide.png','/lib/ascn-record.mjs','/.env']) assert.equal(isPrivatePath(path),true,path);
  for(const path of ['/data/ascn-cities.json','/media/showcase/flood-field.mp4','/lib/security.mjs']) assert.equal(isPrivatePath(path),false,path);
});


test('unreviewed prose and extra private fields cannot bypass a public URL', () => {
  const changed = structuredClone(data); changed.items[0].note.en = 'Unreviewed new claim.';
  assert.throws(() => assertPublicArchive(changed), /source-reviewed/);
  const root = structuredClone(data); root.internalNotes = 'Private material';
  assert.throws(() => assertPublicArchive(root), /private provenance/);
  const nested = structuredClone(data); nested.items[0].title.internalNotes = 'Private material';
  assert.throws(() => assertPublicArchive(nested), /unexpected localized field/);
});
