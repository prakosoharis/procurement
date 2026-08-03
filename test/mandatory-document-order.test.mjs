import test from 'node:test';
import assert from 'node:assert/strict';

const mandatory = [
  'Procurement Policy',
  'Procurement SOP',
  'Supplier Info & Performance Mgmt SOP',
  'Matrix Level Authorization',
  'Ethic Policy',
  'Code of Conduct'
];

test('mandatory document wording and order are consistent in seeds and Repository fallback UI', async () => {
  const { readFile } = await import('node:fs/promises');
  const [seed, productionSeed, ui] = await Promise.all([
    readFile(new URL('../prisma/seed.js', import.meta.url), 'utf8'),
    readFile(new URL('../prisma/seed-production.js', import.meta.url), 'utf8'),
    readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8')
  ]);
  const listPattern = mandatory.map((name) => `'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).join('\\s*,\\s*');
  assert.match(seed, new RegExp(`const mandatory\\s*=\\s*\\[${listPattern}\\]`));
  assert.match(productionSeed, new RegExp(`const mandatory\\s*=\\s*\\[${listPattern}\\]`));
  assert.match(ui, new RegExp(`var mandatoryDocuments\\s*=\\s*\\[${listPattern}\\]`));
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
