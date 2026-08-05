import { db as defaultDb } from '../db.js';
import { can, Permission } from '../authorization/permissions.js';
import { effectiveBusinessUnitIds, isBusinessUnitScoped } from '../authorization/scope.js';
import { fail } from '../governance/errors.js';
import { peopleCapabilities } from './capabilities.js';
import { peoplePositionScopeWhere } from './scope.js';
import { activeAssignmentWhere, normalizedText, parseExpectedUpdatedAt } from './organization-rules.js';

const MAX_ROWS = 30;

function dateValue(value) { return value ? new Date(value).toISOString() : null; }
function requireView(actor) { if (!peopleCapabilities(actor).canView) fail('FORBIDDEN', 'People access is not available for this role.'); }
function requireManager(actor) { if (!can(actor, Permission.PEOPLE_PROFILE_MANAGE)) fail('FORBIDDEN', 'People profile management is not available for this role.'); }
function detail(value) { return JSON.stringify(value); }

function requiredArray(value, label) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_ROWS) fail('INVALID_INPUT', `${label} must contain at most ${MAX_ROWS} entries.`);
  return value;
}

function optionalYear(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 10) fail('INVALID_INPUT', `${label} must be a valid year.`);
  return year;
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail('INVALID_INPUT', `${label} must be a valid date.`);
  return parsed;
}

function firstWorkStartedAt(value) {
  const date = optionalDate(value, 'First work start date');
  if (date && date > new Date()) fail('INVALID_INPUT', 'First work start date cannot be in the future.');
  return date;
}

function totalWorkExperience(firstWorkStartedAt, now = new Date()) {
  if (!firstWorkStartedAt) return null;
  const start = new Date(firstWorkStartedAt);
  const months = Math.max(0, (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + now.getUTCMonth() - start.getUTCMonth() - (now.getUTCDate() < start.getUTCDate() ? 1 : 0));
  return { totalMonths: months, years: Math.floor(months / 12), months: months % 12 };
}

function optionalUrl(value, label) {
  const url = normalizedText(value, label, { maxLength: 1000 });
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
  } catch { fail('INVALID_INPUT', `${label} must be a valid http(s) URL.`); }
  return url;
}

function profileInput(input) {
  const fullName = normalizedText(input.fullName, 'Full name', { required: true, maxLength: 160 });
  const employeeIdentifier = normalizedText(input.employeeIdentifier, 'Employee identifier', { maxLength: 80 });
  const email = normalizedText(input.email, 'Email', { maxLength: 160 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('INVALID_INPUT', 'Email must be valid.');
  return {
    fullName, employeeIdentifier, email,
    phone: normalizedText(input.phone, 'Phone', { maxLength: 50 }),
    photoUrl: optionalUrl(input.photoUrl, 'Photo URL'),
    firstWorkStartedAt: firstWorkStartedAt(input.firstWorkStartedAt),
    educations: educationInput(requiredArray(input.educations, 'Educations')),
    certifications: certificationInput(requiredArray(input.certifications, 'Certifications'))
  };
}

function educationInput(rows) {
  const ids = new Set();
  return rows.map((row) => {
    const id = normalizedText(row?.id, 'Education id', { maxLength: 100 });
    if (id && ids.has(id)) fail('INVALID_INPUT', 'Education entries must not be duplicated.');
    if (id) ids.add(id);
    const startYear = optionalYear(row?.startYear, 'Education start year');
    const graduationYear = optionalYear(row?.graduationYear, 'Education graduation year');
    if (startYear && graduationYear && graduationYear < startYear) fail('INVALID_INPUT', 'Education graduation year cannot precede start year.');
    return {
      id,
      institution: normalizedText(row?.institution, 'Education institution', { required: true, maxLength: 180 }),
      degreeLevel: normalizedText(row?.degreeLevel, 'Education degree level', { required: true, maxLength: 100 }),
      fieldOfStudy: normalizedText(row?.fieldOfStudy, 'Education field of study', { maxLength: 160 }),
      startYear, graduationYear
    };
  });
}

function certificationInput(rows) {
  const ids = new Set();
  return rows.map((row) => {
    const id = normalizedText(row?.id, 'Certification id', { maxLength: 100 });
    if (id && ids.has(id)) fail('INVALID_INPUT', 'Certification entries must not be duplicated.');
    if (id) ids.add(id);
    const issueDate = optionalDate(row?.issueDate, 'Certification issue date');
    const expiryDate = optionalDate(row?.expiryDate, 'Certification expiry date');
    if (issueDate && expiryDate && expiryDate < issueDate) fail('INVALID_INPUT', 'Certification expiry date cannot precede issue date.');
    return {
      id,
      name: normalizedText(row?.name, 'Certification name', { required: true, maxLength: 180 }),
      issuer: normalizedText(row?.issuer, 'Certification issuer', { required: true, maxLength: 180 }),
      credentialId: normalizedText(row?.credentialId, 'Certification credential ID', { maxLength: 160 }),
      issueDate, expiryDate, evidenceUrl: optionalUrl(row?.evidenceUrl, 'Certification evidence URL')
    };
  });
}

function profileWhere(actor) {
  if (!isBusinessUnitScoped(actor)) return {};
  const ids = effectiveBusinessUnitIds(actor);
  if (!ids.length) return { id: '__no-people-profile-access__' };
  return { assignments: { some: { ...activeAssignmentWhere(), position: peoplePositionScopeWhere(actor) } } };
}

function assignmentWhere(actor) {
  return { position: peoplePositionScopeWhere(actor) };
}

const profileInclude = (actor) => ({
  educations: { orderBy: [{ graduationYear: 'desc' }, { createdAt: 'asc' }] },
  certifications: { orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] },
  assignments: {
    where: assignmentWhere(actor),
    orderBy: [{ endDate: 'asc' }, { startDate: 'desc' }],
    include: { position: { select: { id: true, title: true, code: true, businessUnit: { select: { id: true, name: true } }, organizationGroup: { select: { id: true, name: true } } } } }
  }
});

function canViewSensitiveProfileData(actor) {
  return !isBusinessUnitScoped(actor);
}

function profileDto(person, actor) {
  const canViewSensitive = canViewSensitiveProfileData(actor);
  return {
    id: person.id, fullName: person.fullName, employeeIdentifier: person.employeeIdentifier,
    // Contact details and evidence links are available only to People managers.
    // BU viewers retain the operational profile, qualifications, and scoped
    // assignment history without receiving personal contact or credential data.
    email: canViewSensitive ? person.email : null,
    phone: canViewSensitive ? person.phone : null,
    photoUrl: canViewSensitive ? person.photoUrl : null,
    firstWorkStartedAt: dateValue(person.firstWorkStartedAt),
    totalWorkExperience: totalWorkExperience(person.firstWorkStartedAt),
    status: person.status,
    updatedAt: dateValue(person.updatedAt),
    educations: (person.educations || []).map((row) => ({ id: row.id, institution: row.institution, degreeLevel: row.degreeLevel, fieldOfStudy: row.fieldOfStudy, startYear: row.startYear, graduationYear: row.graduationYear, updatedAt: dateValue(row.updatedAt) })),
    certifications: (person.certifications || []).map((row) => ({ id: row.id, name: row.name, issuer: row.issuer, credentialId: canViewSensitive ? row.credentialId : null, issueDate: dateValue(row.issueDate), expiryDate: dateValue(row.expiryDate), evidenceUrl: canViewSensitive ? row.evidenceUrl : null, updatedAt: dateValue(row.updatedAt) })),
    assignments: (person.assignments || []).map((row) => ({ id: row.id, startDate: dateValue(row.startDate), endDate: dateValue(row.endDate), type: row.type, position: { id: row.position.id, title: row.position.title, code: row.position.code, businessUnit: row.position.businessUnit ? { id: row.position.businessUnit.id, name: row.position.businessUnit.name } : null, organizationGroup: row.position.organizationGroup ? { id: row.position.organizationGroup.id, name: row.position.organizationGroup.name } : null, scope: row.position.organizationGroup ? { type: 'GROUP', id: row.position.organizationGroup.id, name: row.position.organizationGroup.name } : { type: 'BUSINESS_UNIT', id: row.position.businessUnit.id, name: row.position.businessUnit.name } } }))
  };
}

function profileListDto(person, actor) {
  const canViewSensitive = canViewSensitiveProfileData(actor);
  return {
    id: person.id,
    fullName: person.fullName,
    employeeIdentifier: person.employeeIdentifier,
    email: canViewSensitive ? person.email : null,
    phone: canViewSensitive ? person.phone : null,
    photoUrl: canViewSensitive ? person.photoUrl : null,
    firstWorkStartedAt: dateValue(person.firstWorkStartedAt),
    totalWorkExperience: totalWorkExperience(person.firstWorkStartedAt),
    status: person.status,
    updatedAt: dateValue(person.updatedAt)
  };
}

async function audit(tx, actorId, entityId, action, payload) { await tx.auditLog.create({ data: { actorId, entity: 'Person', entityId, action, detail: detail(payload) } }); }

async function scopedPerson(tx, actor, personId, { include = false } = {}) {
  const person = await tx.person.findFirst({ where: { id: personId, ...profileWhere(actor) }, ...(include ? { include: profileInclude(actor) } : {}) });
  if (!person) fail('NOT_FOUND', 'Person profile not found.');
  return person;
}

async function assertEmployeeIdentifier(tx, employeeIdentifier, excludeId) {
  if (!employeeIdentifier) return;
  const duplicate = await tx.person.findFirst({ where: { employeeIdentifier, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (duplicate) fail('INVALID_INPUT', 'Employee identifier is already in use.');
}

async function syncRows(tx, personId, model, rows, fields) {
  const existing = await tx[model].findMany({ where: { personId }, select: { id: true } });
  const knownIds = new Set(existing.map((row) => row.id));
  for (const row of rows) if (row.id && !knownIds.has(row.id)) fail('INVALID_INPUT', 'A qualification entry does not belong to this profile.');
  const desiredIds = new Set(rows.map((row) => row.id).filter(Boolean));
  const removed = existing.filter((row) => !desiredIds.has(row.id)).map((row) => row.id);
  if (removed.length) await tx[model].deleteMany({ where: { id: { in: removed } } });
  for (const row of rows) {
    const data = Object.fromEntries(fields.map((field) => [field, row[field]]));
    if (row.id) await tx[model].update({ where: { id: row.id }, data });
    else await tx[model].create({ data: { personId, ...data } });
  }
}

export async function listPeopleProfiles(actor, { query = '' } = {}, { db = defaultDb } = {}) {
  requireView(actor);
  const search = normalizedText(query, 'Search query', { maxLength: 120 });
  const people = await db.person.findMany({
    where: { status: 'ACTIVE', ...profileWhere(actor), ...(search ? { OR: [{ fullName: { contains: search, mode: 'insensitive' } }, { employeeIdentifier: { contains: search, mode: 'insensitive' } }] } : {}) },
    orderBy: { fullName: 'asc' }, take: 100,
    select: { id: true, fullName: true, employeeIdentifier: true, email: true, phone: true, photoUrl: true, firstWorkStartedAt: true, status: true, updatedAt: true }
  });
  return { profiles: people.map((person) => profileListDto(person, actor)), capabilities: peopleCapabilities(actor) };
}

export async function getPersonProfile(actor, personId, { db = defaultDb } = {}) {
  requireView(actor);
  const person = await scopedPerson(db, actor, personId, { include: true });
  return { profile: profileDto(person, actor), capabilities: peopleCapabilities(actor) };
}

export async function createPersonProfile(actor, input, { db = defaultDb } = {}) {
  requireManager(actor);
  const data = profileInput(input);
  return db.$transaction(async (tx) => {
    await assertEmployeeIdentifier(tx, data.employeeIdentifier);
    const person = await tx.person.create({ data: { fullName: data.fullName, employeeIdentifier: data.employeeIdentifier, email: data.email, phone: data.phone, photoUrl: data.photoUrl, firstWorkStartedAt: data.firstWorkStartedAt } });
    await syncRows(tx, person.id, 'personEducation', data.educations, ['institution', 'degreeLevel', 'fieldOfStudy', 'startYear', 'graduationYear']);
    await syncRows(tx, person.id, 'personCertification', data.certifications, ['name', 'issuer', 'credentialId', 'issueDate', 'expiryDate', 'evidenceUrl']);
    const complete = await tx.person.findUnique({ where: { id: person.id }, include: profileInclude(actor) });
    await audit(tx, actor.id, person.id, 'CREATE_PERSON_PROFILE', { firstWorkStartedAt: dateValue(data.firstWorkStartedAt), educationCount: data.educations.length, certificationCount: data.certifications.length });
    return profileDto(complete, actor);
  });
}

export async function updatePersonProfile(actor, personId, input, { db = defaultDb } = {}) {
  requireManager(actor);
  const data = profileInput(input);
  const expected = parseExpectedUpdatedAt(input.expectedUpdatedAt);
  return db.$transaction(async (tx) => {
    const current = await scopedPerson(tx, actor, personId);
    if (current.updatedAt.getTime() !== expected.getTime()) fail('CONCURRENT_MODIFICATION', 'This person profile has changed. Reload it before saving.');
    await assertEmployeeIdentifier(tx, data.employeeIdentifier, personId);
    const updated = await tx.person.updateMany({ where: { id: personId, status: 'ACTIVE', updatedAt: current.updatedAt }, data: { fullName: data.fullName, employeeIdentifier: data.employeeIdentifier, email: data.email, phone: data.phone, photoUrl: data.photoUrl, firstWorkStartedAt: data.firstWorkStartedAt } });
    if (updated.count !== 1) fail('CONCURRENT_MODIFICATION', 'This person profile has changed. Reload it before saving.');
    await syncRows(tx, personId, 'personEducation', data.educations, ['institution', 'degreeLevel', 'fieldOfStudy', 'startYear', 'graduationYear']);
    await syncRows(tx, personId, 'personCertification', data.certifications, ['name', 'issuer', 'credentialId', 'issueDate', 'expiryDate', 'evidenceUrl']);
    const complete = await tx.person.findUnique({ where: { id: personId }, include: profileInclude(actor) });
    await audit(tx, actor.id, personId, 'UPDATE_PERSON_PROFILE', { firstWorkStartedAt: dateValue(data.firstWorkStartedAt), educationCount: data.educations.length, certificationCount: data.certifications.length });
    return profileDto(complete, actor);
  });
}

export async function archivePersonProfile(actor, personId, input, { db = defaultDb } = {}) {
  requireManager(actor);
  const expected = parseExpectedUpdatedAt(input.expectedUpdatedAt);
  return db.$transaction(async (tx) => {
    const person = await scopedPerson(tx, actor, personId);
    if (person.updatedAt.getTime() !== expected.getTime()) fail('CONCURRENT_MODIFICATION', 'This person profile has changed. Reload it before saving.');
    const activeAssignments = await tx.positionAssignment.count({ where: { personId, ...activeAssignmentWhere() } });
    if (activeAssignments) fail('INVALID_TRANSITION', 'End active assignments before archiving this person.');
    const archived = await tx.person.updateMany({ where: { id: personId, status: 'ACTIVE', updatedAt: person.updatedAt }, data: { status: 'ARCHIVED' } });
    if (archived.count !== 1) fail('CONCURRENT_MODIFICATION', 'This person profile has changed. Reload it before saving.');
    await audit(tx, actor.id, personId, 'ARCHIVE_PERSON_PROFILE', { fullName: person.fullName });
    return { id: personId, status: 'ARCHIVED' };
  });
}

export { profileDto, profileInput, profileListDto, profileWhere, totalWorkExperience };
