import test from 'node:test';
import assert from 'node:assert/strict';

test('Repository accepts multiple named documents for one Business Unit and type', async () => {
  const { readFile } = await import('node:fs/promises');
  const [service, legacyRoute, ui] = await Promise.all([
    readFile(new URL('../lib/document-direct-upload-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/documents/route.js', import.meta.url), 'utf8'),
    readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8')
  ]);

  assert.match(service, /businessUnitId, documentTypeId, title, status: \{ not: 'ARCHIVED' \}/);
  assert.match(service, /businessUnitId, documentTypeId, title \}/);
  assert.match(legacyRoute, /businessUnitId, documentTypeId, title, status: \{ not: 'ARCHIVED' \}/);
  assert.match(ui, /documentByRequirementKey\[key\]\|\|\(documentByRequirementKey\[key\]=\[\]\)\)\.push\(d\)/);
  assert.match(ui, /requirementDocuments\(bu,type,index\)/);
  assert.match(ui, /\+ Tambah dokumen/);
  assert.match(ui, /Setiap file dapat memiliki nama sendiri/);
  assert.match(ui, /type==='additional'\|\|requirementDocuments\(bu,type,index\)\.length/);
});

test('master data reserves M6 and keeps new mandatory ordering numeric', async () => {
  const { readFile } = await import('node:fs/promises');
  const route = await readFile(new URL('../app/api/master-data/route.js', import.meta.url), 'utf8');
  assert.match(route, /normalizedCode === 'M6'/);
  assert.match(route, /sortOrder: Number\(normalizedCode\.slice\(1\)\)/);
  assert.match(route, /Additional dikelola sebagai satu kategori Other/);
});
