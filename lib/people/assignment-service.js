import { db as defaultDb } from '../db.js';
import { can, Permission } from '../authorization/permissions.js';
import { assertBusinessUnitScope } from '../authorization/scope.js';
import { fail } from '../governance/errors.js';
import { peopleCapabilities } from './capabilities.js';
import { activeAssignmentWhere, normalizedText, parseExpectedUpdatedAt } from './organization-rules.js';

function requireView(actor) { if (!peopleCapabilities(actor).canView) fail('FORBIDDEN', 'People access is not available for this role.'); }
function requireManager(actor) { if (!can(actor, Permission.PEOPLE_ASSIGNMENT_MANAGE)) fail('FORBIDDEN', 'Position assignment management is not available for this role.'); }
function iso(value) { return value ? new Date(value).toISOString() : null; }
function dateInput(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_INPUT', `${label} is required.`);
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) fail('INVALID_INPUT', `${label} must be a valid date.`);
  return parsed;
}
function audit(tx, actorId, entityId, action, payload) { return tx.auditLog.create({ data: { actorId, entity: 'PositionAssignment', entityId, action, detail: JSON.stringify(payload) } }); }

async function scopedPosition(tx, actor, positionId) {
  const position = await tx.organizationPosition.findUnique({ where: { id: positionId }, select: { id: true, businessUnitId: true, title: true, status: true, updatedAt: true } });
  if (!position || position.status !== 'ACTIVE') fail('NOT_FOUND', 'Organization position not found.');
  assertBusinessUnitScope(actor, position.businessUnitId);
  return position;
}

function assignmentDto(row) {
  return {
    id: row.id, startDate: iso(row.startDate), endDate: iso(row.endDate), type: row.type, note: row.note, updatedAt: iso(row.updatedAt),
    person: { id: row.person.id, fullName: row.person.fullName, employeeIdentifier: row.person.employeeIdentifier },
    position: row.position ? { id: row.position.id, title: row.position.title, code: row.position.code } : undefined
  };
}

export async function assignPerson(actor, input, { db = defaultDb } = {}) {
  requireManager(actor);
  const positionId = normalizedText(input.positionId, 'positionId', { required: true, maxLength: 100 });
  const personId = normalizedText(input.personId, 'personId', { required: true, maxLength: 100 });
  const startDate = dateInput(input.startDate, 'Assignment start date');
  if (startDate > new Date()) fail('INVALID_INPUT', 'Assignment start date cannot be in the future.');
  const type = input.type === 'ACTING' ? 'ACTING' : input.type === 'PERMANENT' ? 'PERMANENT' : fail('INVALID_INPUT', 'Assignment type must be PERMANENT or ACTING.');
  const note = normalizedText(input.note, 'Assignment note', { maxLength: 1000 });
  const expectedPositionUpdatedAt = parseExpectedUpdatedAt(input.expectedPositionUpdatedAt);
  return db.$transaction(async (tx) => {
    const position = await scopedPosition(tx, actor, positionId);
    if (position.updatedAt.getTime() !== expectedPositionUpdatedAt.getTime()) fail('CONCURRENT_MODIFICATION', 'This position has changed. Reload it before assigning a person.');
    const person = await tx.person.findUnique({ where: { id: personId }, select: { id: true, fullName: true, status: true } });
    if (!person || person.status !== 'ACTIVE') fail('INVALID_TRANSITION', 'Only an active person profile can receive an assignment.');
    const duplicate = await tx.positionAssignment.findFirst({ where: { positionId, personId, ...activeAssignmentWhere() }, select: { id: true } });
    if (duplicate) fail('INVALID_TRANSITION', 'This person already has an active assignment to the selected position.');
    const assignment = await tx.positionAssignment.create({ data: { positionId, personId, startDate, type, note }, include: { person: { select: { id: true, fullName: true, employeeIdentifier: true } } } });
    await audit(tx, actor.id, assignment.id, 'CREATE_POSITION_ASSIGNMENT', { positionId, personId, startDate: iso(startDate), type });
    return assignmentDto(assignment);
  });
}

export async function endPositionAssignment(actor, assignmentId, input, { db = defaultDb } = {}) {
  requireManager(actor);
  const endDate = dateInput(input.endDate, 'Assignment end date');
  if (endDate > new Date()) fail('INVALID_INPUT', 'Assignment end date cannot be in the future.');
  const expected = parseExpectedUpdatedAt(input.expectedUpdatedAt);
  const note = normalizedText(input.note, 'Assignment end note', { maxLength: 1000 });
  return db.$transaction(async (tx) => {
    const current = await tx.positionAssignment.findUnique({ where: { id: assignmentId }, include: { position: { select: { id: true, businessUnitId: true, title: true, status: true } }, person: { select: { id: true, fullName: true, employeeIdentifier: true } } } });
    if (!current) fail('NOT_FOUND', 'Position assignment not found.');
    assertBusinessUnitScope(actor, current.position.businessUnitId);
    if (current.position.status !== 'ACTIVE') fail('INVALID_TRANSITION', 'Assignments cannot be changed for an archived position.');
    if (current.endDate) fail('INVALID_TRANSITION', 'This assignment has already ended.');
    if (current.updatedAt.getTime() !== expected.getTime()) fail('CONCURRENT_MODIFICATION', 'This assignment has changed. Reload it before saving.');
    if (endDate < current.startDate) fail('INVALID_INPUT', 'Assignment end date cannot precede start date.');
    const updated = await tx.positionAssignment.updateMany({ where: { id: assignmentId, endDate: null, updatedAt: current.updatedAt }, data: { endDate, note: note || current.note } });
    if (updated.count !== 1) fail('CONCURRENT_MODIFICATION', 'This assignment has changed. Reload it before saving.');
    const assignment = await tx.positionAssignment.findUnique({ where: { id: assignmentId }, include: { person: { select: { id: true, fullName: true, employeeIdentifier: true } }, position: { select: { id: true, title: true, code: true } } } });
    await audit(tx, actor.id, assignmentId, 'END_POSITION_ASSIGNMENT', { positionId: current.position.id, personId: current.person.id, endDate: iso(endDate) });
    return assignmentDto(assignment);
  });
}

export async function getPositionAssignmentHistory(actor, positionId, { db = defaultDb } = {}) {
  requireView(actor);
  const position = await scopedPosition(db, actor, positionId);
  const assignments = await db.positionAssignment.findMany({
    where: { positionId }, orderBy: [{ endDate: 'desc' }, { startDate: 'desc' }],
    include: { person: { select: { id: true, fullName: true, employeeIdentifier: true } }, position: { select: { id: true, title: true, code: true } } }
  });
  return { position: { id: position.id, title: position.title }, assignments: assignments.map(assignmentDto), capabilities: peopleCapabilities(actor) };
}

export { assignmentDto, dateInput };
