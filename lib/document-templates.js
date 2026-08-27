import { db as defaultDb } from './db.js';

// Template library. Tim Procurement uploads starting-point files; a Business
// Unit downloads one, edits and gets it approved OUTSIDE the application, then
// uploads the result as a Draft SOP through the existing Repository flow.
//
// industryId / companySizeId of null mean "applies to all", so one generic
// template can serve every combination instead of being duplicated.

export function canManageTemplates(user) {
  return Boolean(user) && ['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(user.role);
}

export const templateSelect = {
  id: true, title: true, description: true, fileKey: true, fileName: true,
  fileSize: true, contentType: true, createdAt: true, updatedAt: true,
  documentType: { select: { id: true, code: true, name: true, category: true, sortOrder: true } },
  industry: { select: { id: true, name: true } },
  companySize: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, name: true } }
};

export function templateDto(template) {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    fileKey: template.fileKey,
    fileName: template.fileName,
    fileSize: template.fileSize,
    contentType: template.contentType,
    documentType: template.documentType,
    // null is rendered as "Semua" by the UI; keeping it null rather than
    // inventing a fake row means the database still holds one clear meaning.
    industry: template.industry,
    companySize: template.companySize,
    uploadedBy: template.uploadedBy,
    updatedAt: template.updatedAt
  };
}

// How specific a template is for a given request. Used to rank matches so the
// most targeted template wins over a generic one, e.g. a "Mining + Besar"
// template beats "applies to all" for a Mining/Besar Business Unit.
export function templateSpecificity(template) {
  return (template.industry ? 2 : 0) + (template.companySize ? 1 : 0);
}

// Templates that apply to a requested industry/size: an exact match, or one
// marked "applies to all" for that dimension. A template bound to a DIFFERENT
// industry or size is not a match at all.
export function matchesRequest(template, { industryId, companySizeId }) {
  if (template.industry && industryId && template.industry.id !== industryId) return false;
  if (template.industry && !industryId) return false;
  if (template.companySize && companySizeId && template.companySize.id !== companySizeId) return false;
  if (template.companySize && !companySizeId) return false;
  return true;
}

// Best template per document type for the requested industry/size. Returning
// one row per type is what makes the tab answer "which template do I use for
// M1?" rather than showing every near-miss and leaving the choice ambiguous.
export function bestTemplatesPerType(templates, request) {
  const byType = new Map();
  for (const template of templates) {
    if (!matchesRequest(template, request)) continue;
    const key = template.documentType.id;
    const current = byType.get(key);
    if (!current || templateSpecificity(template) > templateSpecificity(current)) byType.set(key, template);
  }
  return [...byType.values()].sort((a, b) => (a.documentType.sortOrder || 0) - (b.documentType.sortOrder || 0));
}

export async function listTemplates({ db = defaultDb } = {}) {
  return db.documentTemplate.findMany({
    select: templateSelect,
    orderBy: [{ documentType: { sortOrder: 'asc' } }, { title: 'asc' }]
  });
}
