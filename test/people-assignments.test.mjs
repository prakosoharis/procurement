import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentDto, dateInput } from '../lib/people/assignment-service.js';

test('assignment date input is required and normalized to a calendar date', () => {
  assert.equal(dateInput('2026-08-03', 'End date').toISOString(), '2026-08-03T00:00:00.000Z');
  assert.throws(() => dateInput('', 'End date'), /required/);
});

test('assignment DTO is explicit and keeps placement history safe', () => {
  const date = new Date('2026-08-03T00:00:00.000Z');
  const dto = assignmentDto({ id: 'assignment-1', startDate: date, endDate: null, type: 'ACTING', note: 'Cover', updatedAt: date, person: { id: 'person-1', fullName: 'Nadia', employeeIdentifier: 'EMP-1', secret: 'omit' }, position: { id: 'position-1', title: 'Manager', code: 'MGR', secret: 'omit' } });
  assert.equal(dto.person.secret, undefined);
  assert.equal(dto.position.secret, undefined);
  assert.equal(dto.updatedAt, date.toISOString());
});

test('assignment APIs keep server-side authority, concurrency, and audit actions', async () => {
  const { readFile } = await import('node:fs/promises');
  const service = await readFile(new URL('../lib/people/assignment-service.js', import.meta.url), 'utf8');
  const createRoute = await readFile(new URL('../app/api/people/assignments/route.js', import.meta.url), 'utf8');
  const endRoute = await readFile(new URL('../app/api/people/assignments/[assignmentId]/end/route.js', import.meta.url), 'utf8');
  assert.match(service, /Permission\.PEOPLE_ASSIGNMENT_MANAGE/);
  assert.match(service, /expectedPositionUpdatedAt/);
  assert.match(service, /END_POSITION_ASSIGNMENT/);
  assert.match(service, /already has an active assignment/);
  assert.match(createRoute, /assignPerson/);
  assert.match(endRoute, /endPositionAssignment/);
});
