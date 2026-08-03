import test from 'node:test';
import assert from 'node:assert/strict';
import { profileDto, profileInput, profileWhere } from '../lib/people/profile-service.js';

test('Business Unit profile scope is pushed into the assignment relation query', () => {
  const scoped = profileWhere({ role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-a', businessUnitScopes: [{ businessUnitId: 'bu-b' }] });
  assert.deepEqual(scoped.assignments.some.position.businessUnitId.in, ['bu-a', 'bu-b']);
  assert.equal(scoped.assignments.some.OR[0].endDate, null);
  assert.ok(scoped.assignments.some.OR[1].endDate.gt instanceof Date);
  assert.deepEqual(profileWhere({ role: 'BUSINESS_UNIT_PIC', businessUnitId: null, businessUnitScopes: [] }), { id: '__no-people-profile-access__' });
  assert.deepEqual(profileWhere({ role: 'SUPER_USER' }), {});
});

test('person detail DTO is explicit and omits raw relation/session data', () => {
  const date = new Date('2026-08-03T00:00:00.000Z');
  const dto = profileDto({
    id: 'person-1', fullName: 'Nadia', employeeIdentifier: 'EMP-1', email: 'nadia@example.test', phone: null, photoUrl: null, status: 'ACTIVE', updatedAt: date,
    educations: [{ id: 'edu-1', institution: 'Universitas', degreeLevel: 'S1', fieldOfStudy: 'Hukum', startYear: 2018, graduationYear: 2022, updatedAt: date, secret: 'omit' }],
    certifications: [{ id: 'cert-1', name: 'CIPS', issuer: 'CIPS', credentialId: null, issueDate: date, expiryDate: null, evidenceUrl: null, updatedAt: date, secret: 'omit' }],
    assignments: [{ id: 'assignment-1', startDate: date, endDate: null, type: 'PERMANENT', position: { id: 'position-1', title: 'Manager', code: 'MGR', businessUnit: { id: 'bu-1', name: 'SMI', internalScope: 'omit' } }, metadata: 'omit' }]
  });
  assert.equal(dto.updatedAt, date.toISOString());
  assert.equal(dto.educations[0].secret, undefined);
  assert.equal(dto.certifications[0].secret, undefined);
  assert.equal(dto.assignments[0].metadata, undefined);
  assert.equal(dto.assignments[0].position.businessUnit.internalScope, undefined);
});

test('Business Unit profile DTO redacts contact and credential evidence while retaining scoped work context', () => {
  const date = new Date('2026-08-03T00:00:00.000Z');
  const person = {
    id: 'person-1', fullName: 'Nadia', employeeIdentifier: 'EMP-1', email: 'nadia@example.test', phone: '+628123', photoUrl: 'https://example.test/photo', status: 'ACTIVE', updatedAt: date,
    educations: [],
    certifications: [{ id: 'cert-1', name: 'CIPS', issuer: 'CIPS', credentialId: 'credential-private', issueDate: date, expiryDate: null, evidenceUrl: 'https://example.test/evidence', updatedAt: date }],
    assignments: [{ id: 'assignment-1', startDate: date, endDate: null, type: 'ACTING', position: { id: 'position-1', title: 'Manager', code: 'MGR', businessUnit: { id: 'bu-1', name: 'SMI' } } }]
  };
  const dto = profileDto(person, { role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-1', businessUnitScopes: [] });
  assert.equal(dto.email, null);
  assert.equal(dto.phone, null);
  assert.equal(dto.photoUrl, null);
  assert.equal(dto.certifications[0].credentialId, null);
  assert.equal(dto.certifications[0].evidenceUrl, null);
  assert.equal(dto.certifications[0].name, 'CIPS');
  assert.equal(dto.assignments[0].position.title, 'Manager');
});

test('profile qualification input accepts repeatable records and rejects invalid date ranges', () => {
  const data = profileInput({
    fullName: 'Nadia', employeeIdentifier: 'EMP-1', email: 'nadia@example.test', phone: '', photoUrl: '',
    educations: [{ institution: 'Universitas', degreeLevel: 'S1', fieldOfStudy: 'Hukum', startYear: '2018', graduationYear: '2022' }],
    certifications: [{ name: 'CIPS', issuer: 'CIPS', credentialId: '', issueDate: '2024-01-01', expiryDate: '', evidenceUrl: '' }]
  });
  assert.equal(data.educations[0].graduationYear, 2022);
  assert.equal(data.certifications[0].expiryDate, null);
  assert.throws(() => profileInput({ fullName: 'Nadia', educations: [], certifications: [{ name: 'CIPS', issuer: 'CIPS', issueDate: '2026-01-01', expiryDate: '2025-01-01' }] }), /cannot precede/);
});

test('profile route surface keeps named mutations and server authority', async () => {
  const { readFile } = await import('node:fs/promises');
  const route = await readFile(new URL('../app/api/people/profiles/[personId]/route.js', import.meta.url), 'utf8');
  const service = await readFile(new URL('../lib/people/profile-service.js', import.meta.url), 'utf8');
  assert.match(route, /input\.operation === 'update'/);
  assert.match(route, /input\.operation === 'archive'/);
  assert.match(service, /Permission\.PEOPLE_PROFILE_MANAGE/);
  assert.match(service, /expectedUpdatedAt/);
  assert.match(service, /ARCHIVE_PERSON_PROFILE/);
  assert.match(service, /End active assignments before archiving this person/);
});
