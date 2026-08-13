import test from 'node:test';
import assert from 'node:assert/strict';

const mandatory = [
  ['M1', 'Procurement Policy'],
  ['M2', 'Procurement SOP'],
  ['M3', 'Supplier Info & Performance Mgmt SOP'],
  ['M4', 'Matrix Level Authorization'],
  ['M5', 'Ethic Policy'],
  ['M6', 'Value Creation']
];

test('Repository taxonomy keeps M1-M6 including Value Creation, with one Additional type', async () => {
  const { readFile } = await import('node:fs/promises');
  const [seed, productionSeed, ui] = await Promise.all([
    readFile(new URL('../prisma/seed.js', import.meta.url), 'utf8'),
    readFile(new URL('../prisma/seed-production.js', import.meta.url), 'utf8'),
    readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8')
  ]);
  for (const [code, name] of mandatory) {
    assert.match(seed, new RegExp(`\\['${code}','${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',\\d+\\]`));
    assert.match(productionSeed, new RegExp(`\\['${code}', '${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}', \\d+\\]`));
  }
  assert.doesNotMatch(seed, /Code of Conduct/);
  assert.doesNotMatch(productionSeed, /Code of Conduct/);
  assert.match(seed, /const additional = \['Additional'\]/);
  assert.match(productionSeed, /const additional = \['Additional'\]/);
  assert.match(ui, /type\.code\+' — '\+type\.name/);
  assert.match(ui, /Additional: '\+additionalCount/);
  assert.doesNotMatch(ui, /var sopData=\[\{id:"SOP-001"/);
});

test('data migration preserves existing document type identities while moving M1-M5', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL('../prisma/migrations/20260803020200_reorder_mandatory_document_types/migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /SET "code" = 'M1', "name" = 'Procurement Policy'[\s\S]*WHERE "code" = '__mandatory_reorder__M2'/);
  assert.match(migration, /SET "code" = 'M2', "name" = 'Procurement SOP'[\s\S]*WHERE "code" = '__mandatory_reorder__M3'/);
  assert.match(migration, /SET "code" = 'M3', "name" = 'Supplier Info & Performance Mgmt SOP'[\s\S]*WHERE "code" = '__mandatory_reorder__M4'/);
  assert.match(migration, /SET "code" = 'M4', "name" = 'Matrix Level Authorization'[\s\S]*WHERE "code" = '__mandatory_reorder__M5'/);
  assert.match(migration, /SET "code" = 'M5', "name" = 'Ethic Policy'[\s\S]*WHERE "code" = '__mandatory_reorder__M1'/);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
});

test('repository migration consolidates legacy additional documents without deleting SOP records', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL('../prisma/migrations/20260813000000_consolidate_repository_document_types/migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /'M7', 'Value Creation', 'MANDATORY', 7/);
  assert.match(migration, /'OTHER', 'Additional', 'ADDITIONAL', 100/);
  assert.match(migration, /UPDATE "SopDocument" AS "document"[\s\S]*"documentTypeId"/);
  assert.match(migration, /UPDATE "GoogleDriveUploadSession" AS "session"[\s\S]*"documentTypeId"/);
  assert.doesNotMatch(migration, /DELETE FROM "SopDocument"/);
  assert.match(migration, /"businessUnitId", "documentTypeId", "title"/);
});

test('Value Creation is moved from the transitional M7 code to M6', async () => {
  const { readFile } = await import('node:fs/promises');
  const migration = await readFile(new URL('../prisma/migrations/20260813010000_move_value_creation_to_m6/migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /SET "code" = 'M6'/);
  assert.match(migration, /WHERE "code" = 'M7'/);
  assert.match(migration, /lower\("name"\) = 'value creation'/);
});
