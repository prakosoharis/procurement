import { db as defaultDb } from '../db.js';
import { can, Permission } from '../authorization/permissions.js';
import { assertBusinessUnitScope } from '../authorization/scope.js';
import { fail } from '../governance/errors.js';
import { peopleCapabilities } from './capabilities.js';
import { activeAssignmentWhere, boundedOrder, hierarchyHasCycle, normalizedText, parseExpectedUpdatedAt, parseOrder } from './organization-rules.js';

const positionSelect = {
  id: true, structureId: true, businessUnitId: true, parentId: true, title: true,
  code: true, description: true, displayOrder: true, status: true, updatedAt: true
};

function requireStructureManager(actor) {
  if (!can(actor, Permission.PEOPLE_STRUCTURE_MANAGE)) {
    fail('FORBIDDEN', 'People structure management is not available for this role.');
  }
}

function safeDate(value, label) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_INPUT', `${label} must be a valid date.`);
  return date;
}

function detail(value) {
  return JSON.stringify(value);
}

async function audit(tx, actorId, entity, entityId, action, payload) {
  await tx.auditLog.create({ data: { actorId, entity, entityId, action, detail: detail(payload) } });
}

async function scopedStructure(tx, actor, structureId) {
  const structure = await tx.organizationStructure.findUnique({ where: { id: structureId } });
  if (!structure || structure.status !== 'ACTIVE') fail('NOT_FOUND', 'Organization structure not found.');
  assertBusinessUnitScope(actor, structure.businessUnitId);
  return structure;
}

async function scopedPosition(tx, actor, positionId) {
  const position = await tx.organizationPosition.findUnique({ where: { id: positionId }, select: positionSelect });
  if (!position || position.status !== 'ACTIVE') fail('NOT_FOUND', 'Organization position not found.');
  assertBusinessUnitScope(actor, position.businessUnitId);
  return position;
}

async function requireCurrent(tx, position, expectedUpdatedAt) {
  const expected = parseExpectedUpdatedAt(expectedUpdatedAt);
  if (position.updatedAt.getTime() !== expected.getTime()) {
    fail('CONCURRENT_MODIFICATION', 'This position has changed. Reload it before saving.');
  }
}

async function updateCurrentPosition(tx, position, data) {
  const updated = await tx.organizationPosition.updateMany({
    where: { id: position.id, status: 'ACTIVE', updatedAt: position.updatedAt },
    data
  });
  if (updated.count !== 1) {
    fail('CONCURRENT_MODIFICATION', 'This position has changed. Reload it before saving.');
  }
  return tx.organizationPosition.findUnique({ where: { id: position.id } });
}

async function nextSiblingOrder(tx, structureId, parentId) {
  const last = await tx.organizationPosition.findFirst({
    where: { structureId, parentId, status: 'ACTIVE' },
    orderBy: { displayOrder: 'desc' },
    select: { displayOrder: true }
  });
  return last ? last.displayOrder + 1 : 0;
}

async function assertUniqueActiveSiblingTitle(tx, { structureId, parentId, title, excludeId }) {
  const duplicate = await tx.organizationPosition.findFirst({
    where: { structureId, parentId, title, status: 'ACTIVE', ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true }
  });
  if (duplicate) fail('INVALID_INPUT', 'An active sibling position already uses this title.');
}

async function assertUniquePositionCode(tx, { businessUnitId, code, excludeId }) {
  if (!code) return;
  const duplicate = await tx.organizationPosition.findFirst({
    where: { businessUnitId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true }
  });
  if (duplicate) fail('INVALID_INPUT', 'Position code must be unique within this Business Unit.');
}

async function reindexSiblings(tx, structureId, parentId, orderedIds) {
  for (let index = 0; index < orderedIds.length; index += 1) {
    await tx.organizationPosition.update({ where: { id: orderedIds[index] }, data: { displayOrder: index } });
  }
}

export async function getOrganizationStructure(actor, businessUnitId, { db = defaultDb } = {}) {
  if (!peopleCapabilities(actor).canView) fail('FORBIDDEN', 'People access is not available for this role.');
  assertBusinessUnitScope(actor, businessUnitId);
  const [businessUnit, structure] = await Promise.all([
    db.businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true, name: true, groupName: true, industry: true } }),
    db.organizationStructure.findFirst({
      where: { businessUnitId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        positions: {
          where: { status: 'ACTIVE' },
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            assignments: {
              where: activeAssignmentWhere(),
              orderBy: { startDate: 'asc' },
              include: { person: { select: { id: true, fullName: true, status: true } } }
            }
          }
        }
      }
    })
  ]);
  if (!businessUnit) fail('NOT_FOUND', 'Business Unit not found.');
  if (!structure) return { businessUnit, structure: null, nodes: [], capabilities: peopleCapabilities(actor) };

  const nodes = structure.positions.map((position) => ({
    id: position.id,
    parentId: position.parentId,
    title: position.title,
    code: position.code,
    description: position.description,
    displayOrder: position.displayOrder,
    updatedAt: position.updatedAt,
    occupants: position.assignments
      .filter((assignment) => assignment.person.status === 'ACTIVE')
      .map((assignment) => ({ assignmentId: assignment.id, id: assignment.person.id, fullName: assignment.person.fullName, startDate: assignment.startDate, type: assignment.type, updatedAt: assignment.updatedAt })),
    vacancy: !position.assignments.some((assignment) => assignment.person.status === 'ACTIVE')
  }));
  return {
    businessUnit,
    structure: { id: structure.id, name: structure.name, effectiveDate: structure.effectiveDate, updatedAt: structure.updatedAt },
    nodes,
    capabilities: peopleCapabilities(actor)
  };
}

export async function createOrganizationStructure(actor, input, { db = defaultDb } = {}) {
  requireStructureManager(actor);
  const businessUnitId = normalizedText(input.businessUnitId, 'businessUnitId', { required: true, maxLength: 100 });
  const name = normalizedText(input.name, 'Structure name', { required: true, maxLength: 160 });
  const rootTitle = normalizedText(input.rootTitle, 'Root position title', { required: true, maxLength: 160 });
  const rootCode = normalizedText(input.rootCode, 'Root position code', { maxLength: 80 });
  const rootDescription = normalizedText(input.rootDescription, 'Root position description', { maxLength: 1000 });
  const effectiveDate = safeDate(input.effectiveDate, 'effectiveDate');
  assertBusinessUnitScope(actor, businessUnitId);

  return db.$transaction(async (tx) => {
    const businessUnit = await tx.businessUnit.findUnique({ where: { id: businessUnitId }, select: { id: true } });
    if (!businessUnit) fail('NOT_FOUND', 'Business Unit not found.');
    const active = await tx.organizationStructure.findFirst({ where: { businessUnitId, status: 'ACTIVE' }, select: { id: true } });
    if (active) fail('INVALID_TRANSITION', 'This Business Unit already has an active organization structure.');
    await assertUniquePositionCode(tx, { businessUnitId, code: rootCode });
    const structure = await tx.organizationStructure.create({ data: { businessUnitId, name, effectiveDate } });
    const root = await tx.organizationPosition.create({
      data: { structureId: structure.id, businessUnitId, title: rootTitle, code: rootCode, description: rootDescription, displayOrder: 0 }
    });
    await audit(tx, actor.id, 'OrganizationStructure', structure.id, 'CREATE_ORGANIZATION_STRUCTURE', { businessUnitId, rootPositionId: root.id, name });
    return { structure, root };
  });
}

export async function createOrganizationPosition(actor, input, { db = defaultDb } = {}) {
  requireStructureManager(actor);
  const structureId = normalizedText(input.structureId, 'structureId', { required: true, maxLength: 100 });
  const parentId = normalizedText(input.parentId, 'parentId', { maxLength: 100 });
  const title = normalizedText(input.title, 'Position title', { required: true, maxLength: 160 });
  const code = normalizedText(input.code, 'Position code', { maxLength: 80 });
  const description = normalizedText(input.description, 'Position description', { maxLength: 1000 });

  return db.$transaction(async (tx) => {
    const structure = await scopedStructure(tx, actor, structureId);
    if (!parentId) {
      const root = await tx.organizationPosition.findFirst({ where: { structureId, parentId: null, status: 'ACTIVE' }, select: { id: true } });
      if (root) fail('INVALID_TRANSITION', 'An active organization structure can have only one root position.');
    } else {
      const parent = await scopedPosition(tx, actor, parentId);
      if (parent.structureId !== structure.id || parent.businessUnitId !== structure.businessUnitId) {
        fail('OUT_OF_SCOPE', 'Parent position must belong to the same Business Unit and structure.');
      }
    }
    await assertUniqueActiveSiblingTitle(tx, { structureId, parentId, title });
    await assertUniquePositionCode(tx, { businessUnitId: structure.businessUnitId, code });
    const displayOrder = parseOrder(input.displayOrder);
    const position = await tx.organizationPosition.create({
      data: {
        structureId, businessUnitId: structure.businessUnitId, parentId, title, code, description,
        displayOrder: displayOrder ?? await nextSiblingOrder(tx, structureId, parentId)
      }
    });
    await audit(tx, actor.id, 'OrganizationPosition', position.id, 'CREATE_ORGANIZATION_POSITION', { structureId, parentId, title, code });
    return position;
  });
}

export async function updateOrganizationPosition(actor, positionId, input, { db = defaultDb } = {}) {
  requireStructureManager(actor);
  const title = normalizedText(input.title, 'Position title', { required: true, maxLength: 160 });
  const code = normalizedText(input.code, 'Position code', { maxLength: 80 });
  const description = normalizedText(input.description, 'Position description', { maxLength: 1000 });
  return db.$transaction(async (tx) => {
    const position = await scopedPosition(tx, actor, positionId);
    await requireCurrent(tx, position, input.expectedUpdatedAt);
    await assertUniqueActiveSiblingTitle(tx, { structureId: position.structureId, parentId: position.parentId, title, excludeId: position.id });
    await assertUniquePositionCode(tx, { businessUnitId: position.businessUnitId, code, excludeId: position.id });
    const updated = await updateCurrentPosition(tx, position, { title, code, description });
    await audit(tx, actor.id, 'OrganizationPosition', position.id, 'UPDATE_ORGANIZATION_POSITION', { before: { title: position.title, code: position.code, description: position.description }, after: { title, code, description } });
    return updated;
  });
}

export async function moveOrganizationPosition(actor, positionId, input, { db = defaultDb } = {}) {
  requireStructureManager(actor);
  const newParentId = normalizedText(input.newParentId, 'newParentId', { required: true, maxLength: 100 });
  const requestedOrder = parseOrder(input.newOrder);
  return db.$transaction(async (tx) => {
    const position = await scopedPosition(tx, actor, positionId);
    await requireCurrent(tx, position, input.expectedUpdatedAt);
    if (!position.parentId) fail('INVALID_TRANSITION', 'The root position cannot be reparented.');
    const newParent = await scopedPosition(tx, actor, newParentId);
    if (newParent.structureId !== position.structureId || newParent.businessUnitId !== position.businessUnitId) {
      fail('OUT_OF_SCOPE', 'A position can be moved only within its Business Unit and structure.');
    }
    await assertUniqueActiveSiblingTitle(tx, {
      structureId: position.structureId,
      parentId: newParent.id,
      title: position.title,
      excludeId: position.id
    });
    const all = await tx.organizationPosition.findMany({ where: { structureId: position.structureId, status: 'ACTIVE' }, select: { id: true, parentId: true } });
    const parentById = new Map(all.map((item) => [item.id, item.parentId]));
    if (hierarchyHasCycle(position.id, newParent.id, parentById)) fail('INVALID_INPUT', 'A position cannot be moved beneath itself or one of its descendants.');

    const targetSiblings = await tx.organizationPosition.findMany({
      where: { structureId: position.structureId, parentId: newParent.id, status: 'ACTIVE', id: { not: position.id } },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true }
    });
    const targetIds = targetSiblings.map((item) => item.id);
    targetIds.splice(boundedOrder(requestedOrder, targetIds.length), 0, position.id);
    await updateCurrentPosition(tx, position, { parentId: newParent.id });
    await reindexSiblings(tx, position.structureId, newParent.id, targetIds);
    if (position.parentId !== newParent.id) {
      const oldSiblings = await tx.organizationPosition.findMany({
        where: { structureId: position.structureId, parentId: position.parentId, status: 'ACTIVE' },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true }
      });
      await reindexSiblings(tx, position.structureId, position.parentId, oldSiblings.map((item) => item.id));
    }
    const updated = await tx.organizationPosition.findUnique({ where: { id: position.id } });
    await audit(tx, actor.id, 'OrganizationPosition', position.id, 'MOVE_ORGANIZATION_POSITION', { previousParentId: position.parentId, newParentId: newParent.id, newOrder: targetIds.indexOf(position.id) });
    return updated;
  });
}

export async function archiveOrganizationPosition(actor, positionId, input, { db = defaultDb } = {}) {
  requireStructureManager(actor);
  return db.$transaction(async (tx) => {
    const position = await scopedPosition(tx, actor, positionId);
    await requireCurrent(tx, position, input.expectedUpdatedAt);
    const [activeChildren, activeAssignments] = await Promise.all([
      tx.organizationPosition.count({ where: { parentId: position.id, status: 'ACTIVE' } }),
      tx.positionAssignment.count({ where: { positionId: position.id, ...activeAssignmentWhere() } })
    ]);
    if (activeChildren) fail('INVALID_TRANSITION', 'Move or archive active child positions before archiving this position.');
    if (activeAssignments) fail('INVALID_TRANSITION', 'End active assignments before archiving this position.');
    const archived = await updateCurrentPosition(tx, position, { status: 'ARCHIVED' });
    await audit(tx, actor.id, 'OrganizationPosition', position.id, 'ARCHIVE_ORGANIZATION_POSITION', { title: position.title });
    return archived;
  });
}
