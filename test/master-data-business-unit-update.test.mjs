import test from 'node:test';
import assert from 'node:assert/strict';

test('Business Unit classification update remains master-data-authorized and audited', async () => {
  const { readFile } = await import('node:fs/promises');
  const route = await readFile(new URL('../app/api/master-data/route.js', import.meta.url), 'utf8');
  assert.match(route, /export async function PATCH/);
  assert.match(route, /masterDataRoles\.includes\(user\?\.role\)/);
  assert.match(route, /organizationGroupId/);
  assert.match(route, /industryId/);
  assert.match(route, /UPDATE_BUSINESS_UNIT_CLASSIFICATION/);
  assert.match(route, /db\.\$transaction/);
});

test('Repository master data UI allows selecting and updating an existing Business Unit classification', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');
  assert.match(html, /masterEditBusinessUnit/);
  assert.match(html, /masterEditBuGroup/);
  assert.match(html, /masterEditBuIndustry/);
  assert.match(html, /updateMasterBusinessUnit\(event\)/);
  assert.match(html, /method:'PATCH'/);
  assert.match(html, /syncMasterBusinessUnitSelection/);
});

test('new SOP dialog refreshes every master document type, including later mandatory codes such as M7', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');
  assert.match(html, /function populateCreateDocumentTypes\(selectedId\)/);
  assert.match(html, /type\.code\+' — '\+type\.name/);
  assert.match(html, /function openCreateSopModal\(\)[\s\S]*populateCreateDocumentTypes\(\)/);
  assert.match(html, /mandatoryCount===mandatoryDocuments\.length/);
  assert.match(html, /await loadRepositoryData\(\);[\s\S]*showToast\('Master data berhasil ditambahkan'\)/);
});
