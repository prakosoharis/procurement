import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrganizationStructure } from '../lib/people/organization-service.js';
import { createPersonProfile } from '../lib/people/profile-service.js';
import { assignPerson, dateInput, endPositionAssignment } from '../lib/people/assignment-service.js';
import { peopleCapabilities } from '../lib/people/capabilities.js';
import { hierarchyHasCycle } from '../lib/people/organization-rules.js';

const businessUnitActor = {
  role: 'BUSINESS_UNIT_PIC',
  businessUnitId: 'bu-allowed',
  businessUnitScopes: [{ businessUnitId: 'bu-extra' }]
};

test('Business Unit People capability contract is read-only and Executive cannot access People', () => {
  assert.deepEqual(peopleCapabilities(businessUnitActor), {
    canView: true,
    canEditStructure: false,
    canManagePeople: false,
    canManageAssignments: false
  });
  assert.deepEqual(peopleCapabilities({ role: 'EXECUTIVE' }), {
    canView: false,
    canEditStructure: false,
    canManagePeople: false,
    canManageAssignments: false
  });
});

test('Business Unit mutation attempts fail before database work is attempted', async () => {
  const db = new Proxy({}, { get() { throw new Error('database must not be called'); } });
  await assert.rejects(() => createOrganizationStructure(businessUnitActor, {}, { db }), /not available/i);
  await assert.rejects(() => createPersonProfile(businessUnitActor, {}, { db }), /not available/i);
  await assert.rejects(() => assignPerson(businessUnitActor, {}, { db }), /not available/i);
  await assert.rejects(() => endPositionAssignment(businessUnitActor, 'assignment-1', {}, { db }), /not available/i);
});

test('assignment date boundaries and hierarchy checks remain deterministic', () => {
  assert.throws(() => dateInput('not-a-date', 'Start date'), /valid date/);
  const parentById = new Map();
  for (let index = 0; index < 1800; index += 1) parentById.set(`position-${index}`, index ? `position-${index - 1}` : null);
  const startedAt = performance.now();
  assert.equal(hierarchyHasCycle('position-700', 'position-1799', parentById), true);
  assert.equal(hierarchyHasCycle('position-1799', 'position-700', parentById), false);
  assert.ok(performance.now() - startedAt < 250, 'large hierarchy check should remain responsive');
});

test('People UI exposes keyboard navigation, accessible drawer behavior, and server capability gating', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../procurement-governance-hub (1).html', import.meta.url), 'utf8');
  assert.match(html, /role="button" tabindex="0" aria-label=/);
  assert.match(html, /event\.key==='Enter'\|\|event\.key===' '/);
  assert.match(html, /scrollIntoView\(\{behavior:'smooth',block:'center',inline:'center'\}\)/);
  assert.match(html, /className='modal people-drawer'/);
  assert.match(html, /aria-modal','true'/);
  assert.match(html, /event\.key==='Escape'/);
  assert.match(html, /canManageAssignments\?/);
  assert.match(html, /canEditStructure\?/);
  assert.doesNotMatch(html, /peopleState\.data\.role|currentUser\.role/);
});

test('People services retain audit actions and archive/end-date rather than remove governed records', async () => {
  const { readFile } = await import('node:fs/promises');
  const [organization, profiles, assignments] = await Promise.all([
    readFile(new URL('../lib/people/organization-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../lib/people/profile-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../lib/people/assignment-service.js', import.meta.url), 'utf8')
  ]);
  assert.match(organization, /ARCHIVE_ORGANIZATION_POSITION/);
  assert.match(profiles, /ARCHIVE_PERSON_PROFILE/);
  assert.match(assignments, /END_POSITION_ASSIGNMENT/);
  assert.match(assignments, /data: \{ endDate, note:/);
});
