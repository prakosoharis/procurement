import { Prisma } from '@prisma/client';
import { isBusinessUnitScoped, effectiveBusinessUnitIds } from '../../../authorization/scope.js';

// Full-text search over extracted SOP page text (SopSection, populated by
// lib/sop-content/index-service.js on approve/publish). Only APPROVED or
// PUBLISHED documents are searchable -- a still-editable draft's contents
// must never leak into an answer, same governance rule the repository
// retriever already applies to metadata.
//
// This retriever needs the question text itself, unlike every other
// retriever here -- see retrieveForTopics in ./index.js, which now passes
// `question` through to every retriever (the others simply ignore it).
export async function retrieveSopContent({ actor, db, question, limit = 12 }) {
  if (!question?.trim()) return { topic: 'sop-content', records: [] };

  const scopeClause = isBusinessUnitScoped(actor)
    ? Prisma.sql`AND d."businessUnitId" = ANY(${effectiveBusinessUnitIds(actor)})`
    : Prisma.empty;

  const rows = await db.$queryRaw`
    SELECT s.id, s."pageNumber", s.text, d.title, bu.name AS "businessUnitName"
    FROM "SopSection" s
    JOIN "SopVersion" v ON v.id = s."sopVersionId"
    JOIN "SopDocument" d ON d.id = v."sopDocumentId"
    JOIN "BusinessUnit" bu ON bu.id = d."businessUnitId"
    WHERE d.status IN ('APPROVED', 'PUBLISHED')
      ${scopeClause}
      AND s."searchVector" @@ plainto_tsquery('simple', ${question})
    ORDER BY ts_rank(s."searchVector", plainto_tsquery('simple', ${question})) DESC
    LIMIT ${limit}
  `;

  return {
    topic: 'sop-content',
    records: rows.map((row) => ({
      type: 'SOP_CONTENT',
      id: row.id,
      label: `${row.title} — hal. ${row.pageNumber}`,
      businessUnit: row.businessUnitName,
      // Keeps one record cheap: context-builder.js drops an oversized record
      // whole rather than truncating it, so a long page is capped here
      // instead of risking the whole chunk being silently excluded.
      excerpt: row.text.length > 1200 ? `${row.text.slice(0, 1200)}…` : row.text
    }))
  };
}
