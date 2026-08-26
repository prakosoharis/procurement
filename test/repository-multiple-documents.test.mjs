import test from 'node:test';
import assert from 'node:assert/strict';

test('Repository accepts multiple named documents for one Business Unit and type', async () => {
  const { readFile } = await import('node:fs/promises');
  const [service, legacyRoute, ui] = await Promise.all([
    readFile(new URL('../lib/document-direct-upload-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/documents/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8')
  ]);

  // The uniqueness key is now scope-aware (businessUnitId OR
  // organizationGroupId via scopeKey), but still keyed on the owner plus
  // documentTypeId plus title -- so one owner can hold several differently
  // named documents of the same type.
  assert.match(service, /\.\.\.scopeKey, documentTypeId, title, status: \{ not: 'ARCHIVED' \}/);
  assert.match(service, /\.\.\.scopeKey, documentTypeId, title \}/);
  assert.match(service, /const scopeKey = isGroup \? \{ organizationGroupId \} : \{ businessUnitId \};/);
  assert.match(legacyRoute, /businessUnitId, documentTypeId, title, status: \{ not: 'ARCHIVED' \}/);
  assert.match(ui, /documentByRequirementKey\[key\]\|\|\(documentByRequirementKey\[key\]=\[\]\)\)\.push\(d\)/);
  assert.match(ui, /requirementDocuments\(bu,type,index\)/);
  assert.match(ui, /\+ Tambah dokumen/);
  assert.match(ui, /Setiap file dapat memiliki nama sendiri/);
  assert.match(ui, /type==='additional'\|\|requirementDocuments\(bu,type,index\)\.length/);
});

test('master data permits M6 and keeps new mandatory ordering numeric', async () => {
  const { readFile } = await import('node:fs/promises');
  const route = await readFile(new URL('../app/api/master-data/route.js', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /normalizedCode === 'M6'/);
  assert.match(route, /sortOrder: Number\(normalizedCode\.slice\(1\)\)/);
  assert.match(route, /Additional dikelola sebagai satu kategori Other/);
});
