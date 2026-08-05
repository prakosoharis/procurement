import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleCapabilities } from '../lib/people/capabilities.js';
import { assertPeopleScope, peopleBusinessUnitWhere, peopleOrganizationGroupWhere, peoplePositionScopeWhere } from '../lib/people/scope.js';

test('People capability flags are server-derived for each supported role', () => {
  assert.deepEqual(peopleCapabilities({ role: 'SUPER_USER' }), {
    canView: true, canEditStructure: true, canManagePeople: true, canManageAssignments: true
  });
  assert.deepEqual(peopleCapabilities({ role: 'CORPORATE_GOVERNANCE' }), {
    canView: true, canEditStructure: true, canManagePeople: true, canManageAssignments: true
  });
  assert.deepEqual(peopleCapabilities({ role: 'BUSINESS_UNIT_PIC' }), {
    canView: true, canEditStructure: false, canManagePeople: false, canManageAssignments: false
  });
  assert.deepEqual(peopleCapabilities({ role: 'EXECUTIVE' }), {
    canView: false, canEditStructure: false, canManagePeople: false, canManageAssignments: false
  });
});

test('People BU queries use the centralized effective Business Unit scope', () => {
  assert.deepEqual(
    peopleBusinessUnitWhere({ role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-primary', businessUnitScopes: [{ businessUnitId: 'bu-extra' }] }),
    { id: { in: ['bu-primary', 'bu-extra'] } }
  );
  assert.deepEqual(
    peopleBusinessUnitWhere({ role: 'BUSINESS_UNIT_PIC', businessUnitId: null, businessUnitScopes: [] }),
    { id: '__no-business-unit-access__' }
  );
  assert.deepEqual(peopleBusinessUnitWhere({ role: 'SUPER_USER' }), {});
});

test('People Group and position queries use the same effective Business Unit scope', () => {
  const user = { role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-primary', businessUnitScopes: [{ businessUnitId: 'bu-extra' }, { businessUnitId: 'bu-primary' }] };
  assert.deepEqual(peopleOrganizationGroupWhere(user), { businessUnits: { some: { id: { in: ['bu-primary', 'bu-extra'] } } } });
  assert.deepEqual(peoplePositionScopeWhere(user), {
    OR: [
      { businessUnitId: { in: ['bu-primary', 'bu-extra'] } },
      { organizationGroup: { businessUnits: { some: { id: { in: ['bu-primary', 'bu-extra'] } } } } }
    ]
  });
  assert.deepEqual(peopleOrganizationGroupWhere({ role: 'BUSINESS_UNIT_PIC', businessUnitId: null, businessUnitScopes: [] }), { id: '__no-people-group-access__' });
});

test('Business Unit users can access a Group structure only when one effective BU belongs to that Group', async () => {
  const actor = { role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-primary', businessUnitScopes: [{ businessUnitId: 'bu-extra' }] };
  const allowed = { businessUnit: { findFirst: async ({ where }) => {
    assert.deepEqual(where, { id: { in: ['bu-primary', 'bu-extra'] }, organizationGroupId: 'group-smm' });
    return { id: 'bu-extra' };
  } } };
  await assert.doesNotReject(() => assertPeopleScope(allowed, actor, { businessUnitId: null, organizationGroupId: 'group-smm' }));

  const denied = { businessUnit: { findFirst: async () => null } };
  await assert.rejects(() => assertPeopleScope(denied, actor, { businessUnitId: null, organizationGroupId: 'group-other' }), /organization scope/i);
});
