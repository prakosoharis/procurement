import { scopeWhere } from '../../../authorization/scope.js';
import { sopDocumentScopeWhere } from '../../../sop-scope.js';

// SOP documents and mandatory-type coverage, restricted to the actor's
// effective Business Unit scope before the query is built.
export async function retrieveRepository({ actor, db, limit = 40 }) {
  const businessUnitWhere = scopeWhere(actor, 'businessUnit');

  const [documents, businessUnits, mandatoryTypes] = await Promise.all([
    // Group-issued documents have no businessUnit, so filtering on the
    // relation alone would hide them entirely.
    db.sopDocument.findMany({
      where: sopDocumentScopeWhere(actor),
      select: {
        id: true, title: true, status: true, currentVersion: true, updatedAt: true, scopeType: true,
        businessUnit: { select: { id: true, name: true } },
        organizationGroup: { select: { id: true, name: true } },
        documentType: { select: { code: true, name: true, category: true } },
        versions: {
          orderBy: { uploadedAt: 'desc' }, take: 1,
          select: { versionNo: true, approvalStatus: true, uploadedAt: true, reviewer: { select: { name: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    }),
    db.businessUnit.findMany({ where: businessUnitWhere, select: { id: true, name: true, groupName: true, industry: true }, orderBy: { name: 'asc' } }),
    db.documentType.findMany({ where: { category: 'MANDATORY' }, select: { id: true, code: true, name: true }, orderBy: { sortOrder: 'asc' } })
  ]);

  const records = documents.map((document) => ({
    type: 'SOP_DOCUMENT',
    id: document.id,
    label: document.title,
    issuer: document.businessUnit?.name || document.organizationGroup?.name || null,
    issuerLevel: document.scopeType === 'GROUP' ? 'GROUP' : 'BUSINESS_UNIT',
    documentType: document.documentType ? `${document.documentType.code} ${document.documentType.name}` : null,
    status: document.status,
    currentVersion: document.currentVersion,
    latestVersionStatus: document.versions[0]?.approvalStatus || null,
    assignedReviewer: document.versions[0]?.reviewer?.name || null,
    updatedAt: document.updatedAt
  }));

  // Coverage is derived from the same scoped document set, so it can never
  // describe a Business Unit the actor cannot see.
  const approvedByUnit = new Map();
  for (const document of documents) {
    // A Group document deliberately does NOT close a Business Unit's
    // mandatory requirement, so coverage counts BUSINESS_UNIT-scoped
    // documents only. Keep this explicit: dropping it would silently mark
    // every BU under a Group as compliant.
    if (document.scopeType === 'GROUP') continue;
    if (document.documentType?.category !== 'MANDATORY') continue;
    if (!['APPROVED', 'PUBLISHED'].includes(document.status)) continue;
    const key = document.businessUnit?.id;
    if (!key) continue;
    if (!approvedByUnit.has(key)) approvedByUnit.set(key, new Set());
    approvedByUnit.get(key).add(document.documentType.code);
  }

  const coverage = businessUnits.map((unit) => {
    const covered = approvedByUnit.get(unit.id) || new Set();
    return {
      type: 'REPOSITORY_COVERAGE',
      id: unit.id,
      label: unit.name,
      group: unit.groupName,
      industry: unit.industry,
      approvedMandatoryTypes: mandatoryTypes.filter((mandatory) => covered.has(mandatory.code)).map((mandatory) => mandatory.code),
      missingMandatoryTypes: mandatoryTypes.filter((mandatory) => !covered.has(mandatory.code)).map((mandatory) => `${mandatory.code} ${mandatory.name}`)
    };
  });

  return { topic: 'repository', records: [...coverage, ...records] };
}
