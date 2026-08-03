import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleCapabilities } from '../lib/people/capabilities.js';
import { peopleBusinessUnitWhere } from '../lib/people/scope.js';

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
