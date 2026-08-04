import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrganizationStructure } from '../lib/people/organization-service.js';
import { activeAssignmentWhere, boundedOrder, hierarchyHasCycle, parseExpectedUpdatedAt, parseOrder } from '../lib/people/organization-rules.js';

test('organization hierarchy rejects self and descendant reparenting', () => {
  const parents = new Map([['root', null], ['manager', 'root'], ['specialist', 'manager']]);
  assert.equal(hierarchyHasCycle('manager', 'specialist', parents), true);
  assert.equal(hierarchyHasCycle('manager', 'manager', parents), true);
  assert.equal(hierarchyHasCycle('specialist', 'root', parents), false);
});

test('position ordering and concurrency inputs are validated', () => {
  assert.equal(boundedOrder(8, 3), 3);
  assert.equal(boundedOrder(-3, 3), 0);
  assert.equal(parseOrder('2'), 2);
  assert.throws(() => parseOrder('-1'), /non-negative/);
  assert.equal(parseExpectedUpdatedAt('2026-08-03T10:00:00.000Z').toISOString(), '2026-08-03T10:00:00.000Z');
  assert.throws(() => parseExpectedUpdatedAt('stale'), /valid ISO/);
  assert.deepEqual(activeAssignmentWhere(new Date('2026-08-03T00:00:00.000Z')), { OR: [{ endDate: null }, { endDate: { gt: new Date('2026-08-03T00:00:00.000Z') } }] });
});

test('structure DTO is compact, scoped, and keeps vacancy separate from profiles', async () => {
  const updatedAt = new Date('2026-08-01T00:00:00.000Z');
  const db = {
    businessUnit: { findUnique: async () => ({ id: 'bu-1', name: 'SMI', groupName: 'SMM', industry: 'Mining' }) },
    organizationStructure: { findFirst: async () => ({
      id: 'structure-1', name: 'Struktur SMI', effectiveDate: null, updatedAt,
      positions: [
        { id: 'root', parentId: null, title: 'Head', code: 'H-1', description: null, displayOrder: 0, updatedAt, assignments: [{ startDate: new Date('2026-01-01T00:00:00.000Z'), type: 'PERMANENT', person: { id: 'person-1', fullName: 'Nadia', status: 'ACTIVE' } }] },
        { id: 'vacant', parentId: 'root', title: 'Specialist', code: null, description: null, displayOrder: 0, updatedAt, assignments: [] }
      ]
    }) }
  };
  const actor = { role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-1', businessUnitScopes: [] };
  const result = await getOrganizationStructure(actor, 'bu-1', { db });
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[0].occupants[0].fullName, 'Nadia');
  assert.equal(result.nodes[1].vacancy, true);
  assert.equal('educations' in result.nodes[0], false);
  assert.equal(result.capabilities.canEditStructure, false);
});

test('Group structure is returned only through a member Business Unit scope', async () => {
  const updatedAt = new Date('2026-08-01T00:00:00.000Z');
  const actor = { role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-smi', businessUnitScopes: [] };
  const db = {
    businessUnit: { findFirst: async () => ({ id: 'bu-smi' }) },
    organizationGroup: { findUnique: async () => ({ id: 'group-smma', name: 'SMMA' }) },
    organizationStructure: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { organizationGroupId: 'group-smma', status: 'ACTIVE' });
      return { id: 'structure-group', scopeType: 'GROUP', name: 'Struktur SMMA', effectiveDate: null, updatedAt, positions: [] };
    } }
  };
  const result = await getOrganizationStructure(actor, { scopeType: 'GROUP', organizationGroupId: 'group-smma' }, { db });
  assert.deepEqual(result.scope, { type: 'GROUP', id: 'group-smma', name: 'SMMA' });
  assert.equal(result.businessUnit, null);
  assert.equal(result.structure.scopeType, 'GROUP');
});

test('Business Unit access is enforced before a structure query is built', async () => {
  const actor = { role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-1', businessUnitScopes: [] };
  const db = {
    businessUnit: { findUnique: async () => { throw new Error('query must not run outside scope'); } },
    organizationStructure: { findFirst: async () => { throw new Error('query must not run outside scope'); } }
  };
  await assert.rejects(
    () => getOrganizationStructure(actor, 'bu-2', { db }),
    /akses ke Business Unit/i
  );
});

test('People routes expose named position operations and concurrency fields', async () => {
  const { readFile } = await import('node:fs/promises');
  const route = await readFile(new URL('../app/api/people/positions/[positionId]/route.js', import.meta.url), 'utf8');
  assert.match(route, /input\.operation === 'update'/);
  assert.match(route, /input\.operation === 'move'/);
  assert.match(route, /input\.operation === 'archive'/);
  const service = await readFile(new URL('../lib/people/organization-service.js', import.meta.url), 'utf8');
  assert.match(service, /expectedUpdatedAt/);
  assert.match(service, /updateMany\(\{\n    where: \{ id: position\.id, status: 'ACTIVE', updatedAt: position\.updatedAt \}/);
  assert.match(service, /assertPeopleScope/);
  assert.match(service, /organizationGroupId/);
  assert.match(service, /MOVE_ORGANIZATION_POSITION/);
  assert.match(service, /hierarchyHasCycle/);
  assert.match(service, /assertUniqueActiveSiblingTitle\(tx, \{ structureId: position\.structureId, parentId: newParent\.id/);
  assert.match(service, /CONCURRENT_MODIFICATION/);
});
