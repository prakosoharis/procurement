import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';

const managementRoles = new Set(['SUPER_USER', 'CORPORATE_GOVERNANCE']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const scoreLevel = (score) => score >= 80 ? 'TINGGI' : score >= 60 ? 'CUKUP' : 'PERLU_PERHATIAN';

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!managementRoles.has(user.role) && user.role !== 'BUSINESS_UNIT_PIC') return NextResponse.json({ error: 'Role tidak memiliki akses engagement.' }, { status: 403 });

  const requestedDays = Number(new URL(request.url).searchParams.get('days') || 30);
  const requestedBusinessUnitId = new URL(request.url).searchParams.get('businessUnitId');
  const days = clamp(Number.isFinite(requestedDays) ? Math.round(requestedDays) : 30, 7, 90);
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - days);
  const detailBusinessUnitId = user.role === 'BUSINESS_UNIT_PIC' ? user.businessUnitId : requestedBusinessUnitId;
  // Corporate dan Super User tetap menerima daftar seluruh BU untuk selector.
  // Parameter businessUnitId hanya menentukan BU yang detailnya dibuka.
  const businessUnitWhere = user.role === 'BUSINESS_UNIT_PIC' ? { id: user.businessUnitId || '__none__' } : {};

  const businessUnits = await db.businessUnit.findMany({
    where: businessUnitWhere,
    select: { id: true, name: true, groupName: true, industry: true, users: { where: { role: 'BUSINESS_UNIT_PIC' }, select: { id: true, name: true, email: true } } },
    orderBy: { name: 'asc' }
  });
  const unitIds = businessUnits.map((unit) => unit.id);
  const [mandatoryTypes, documents, requests, participations, loginLogs] = await Promise.all([
    db.documentType.findMany({ where: { category: 'MANDATORY' }, select: { id: true, code: true, name: true }, orderBy: { sortOrder: 'asc' } }),
    db.sopDocument.findMany({ where: { businessUnitId: { in: unitIds } }, select: { id: true, businessUnitId: true, documentTypeId: true, title: true, status: true, currentVersion: true, updatedAt: true } }),
    db.sopRequest.findMany({ where: { requester: { businessUnitId: { in: unitIds } }, createdAt: { gte: periodStart } }, select: { id: true, title: true, status: true, createdAt: true, requester: { select: { businessUnitId: true } }, sopDocument: { select: { title: true } }, reviewedAt: true, updatedAt: true } }),
    db.auditEventParticipant.findMany({ where: { user: { businessUnitId: { in: unitIds } }, auditEvent: { status: { not: 'CANCELLED' }, startAt: { gte: periodStart } } }, select: { responseStatus: true, user: { select: { businessUnitId: true } }, auditEvent: { select: { id: true, title: true, startAt: true, endAt: true } } } }),
    db.auditLog.findMany({ where: { action: 'LOGIN', createdAt: { gte: periodStart }, actor: { businessUnitId: { in: unitIds } } }, select: { actorId: true, createdAt: true, actor: { select: { businessUnitId: true } } } })
  ]);

  const mandatoryTypeIds = new Set(mandatoryTypes.map((type) => type.id));
  const now = new Date();
  let units = businessUnits.map((unit) => {
    const approvedMandatory = new Set(documents.filter((document) => document.businessUnitId === unit.id && mandatoryTypeIds.has(document.documentTypeId) && ['APPROVED', 'PUBLISHED'].includes(document.status)).map((document) => document.documentTypeId)).size;
    const documentTotal = mandatoryTypes.length;
    const documentHealth = documentTotal ? Math.round((approvedMandatory / documentTotal) * 100) : 100;

    const unitRequests = requests.filter((item) => item.requester.businessUnitId === unit.id);
    const overdueRevisions = unitRequests.filter((item) => item.status === 'REVISION_REQUIRED' && (now - new Date(item.reviewedAt || item.updatedAt)) > 3 * 24 * 60 * 60 * 1000).length;
    const submissionHealth = unitRequests.length ? Math.round(100 * (1 - overdueRevisions / unitRequests.length)) : 100;

    const unitParticipations = participations.filter((item) => item.user.businessUnitId === unit.id);
    const calendarWeight = unitParticipations.reduce((sum, item) => {
      if (item.responseStatus === 'ATTENDED') return sum + 1;
      if (item.responseStatus === 'CONFIRMED') return sum + 0.8;
      if (item.responseStatus === 'INVITED' && new Date(item.auditEvent.startAt) > now) return sum + 0.5;
      return sum;
    }, 0);
    const calendarHealth = unitParticipations.length ? Math.round(100 * (calendarWeight / unitParticipations.length)) : 100;

    const activePicIds = new Set(loginLogs.filter((item) => item.actor?.businessUnitId === unit.id).map((item) => item.actorId));
    const activityHealth = unit.users.length ? Math.round(100 * (activePicIds.size / unit.users.length)) : 0;
    // Semua indikator memiliki pengaruh yang sama. Angka ini adalah rata-rata
    // kondisi empat indikator, bukan akumulasi bobot yang berbeda.
    const score = Math.round((documentHealth + submissionHealth + calendarHealth + activityHealth) / 4);
    return {
      id: unit.id, name: unit.name, groupName: unit.groupName, industry: unit.industry, score, level: scoreLevel(score),
      components: {
        documents: { health: documentHealth, approved: approvedMandatory, total: documentTotal },
        submissions: { health: submissionHealth, total: unitRequests.length, overdueRevisions },
        calendar: { health: calendarHealth, invited: unitParticipations.length, confirmed: unitParticipations.filter((item) => item.responseStatus === 'CONFIRMED').length, attended: unitParticipations.filter((item) => item.responseStatus === 'ATTENDED').length },
        activity: { health: activityHealth, activePics: activePicIds.size, totalPics: unit.users.length }
      }
    };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  if (detailBusinessUnitId && managementRoles.has(user.role)) {
    units = units.sort((a, b) => (a.id === detailBusinessUnitId ? -1 : 0) - (b.id === detailBusinessUnitId ? -1 : 0));
  }
  const averageScore = units.length ? Math.round(units.reduce((sum, unit) => sum + unit.score, 0) / units.length) : 0;
  const selectedUnit = detailBusinessUnitId ? businessUnits.find((unit) => unit.id === detailBusinessUnitId) : null;
  if (detailBusinessUnitId && !selectedUnit) return NextResponse.json({ error: 'Business Unit tidak ditemukan.' }, { status: 404 });
  const detail = selectedUnit ? {
    businessUnit: { id: selectedUnit.id, name: selectedUnit.name, groupName: selectedUnit.groupName, industry: selectedUnit.industry },
    documents: mandatoryTypes.map((type) => {
      const candidates = documents.filter((document) => document.businessUnitId === selectedUnit.id && document.documentTypeId === type.id);
      const document = candidates.sort((a, b) => {
        const priority = (item) => ['PUBLISHED', 'APPROVED', 'IN_REVIEW', 'DRAFT', 'ARCHIVED'].indexOf(item.status);
        return priority(a) - priority(b) || new Date(b.updatedAt) - new Date(a.updatedAt);
      })[0];
      return { code: type.code, name: type.name, status: document?.status || 'MISSING', title: document?.title || null, version: document?.currentVersion || null, updatedAt: document?.updatedAt || null };
    }),
    submissions: requests.filter((item) => item.requester.businessUnitId === selectedUnit.id).map((item) => ({ id: item.id, title: item.title, documentTitle: item.sopDocument?.title || null, status: item.status, createdAt: item.createdAt, reviewedAt: item.reviewedAt, updatedAt: item.updatedAt })),
    calendar: participations.filter((item) => item.user.businessUnitId === selectedUnit.id).map((item) => ({ responseStatus: item.responseStatus, event: item.auditEvent })),
    picActivity: selectedUnit.users.map((pic) => {
      const logins = loginLogs.filter((item) => item.actorId === pic.id).map((item) => item.createdAt).sort((a, b) => new Date(b) - new Date(a));
      return { id: pic.id, name: pic.name, email: pic.email, active: logins.length > 0, lastLoginAt: logins[0] || null };
    })
  } : null;
  return NextResponse.json({
    period: { days, start: periodStart.toISOString(), end: periodEnd.toISOString() },
    viewer: { role: user.role, businessUnitId: user.businessUnitId || null },
    overview: { averageScore, totalBusinessUnits: units.length, highEngagement: units.filter((unit) => unit.score >= 80).length, needsAttention: units.filter((unit) => unit.score < 60).length },
    units, detail
  });
}
