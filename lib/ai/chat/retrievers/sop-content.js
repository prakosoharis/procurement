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

// Question words that appear in almost any sentence. Dropping them keeps the
// ranking driven by the terms that actually identify a passage; they are not
// removed for correctness (the query ORs terms, so they would not exclude
// anything) but because a page repeating "di" many times would otherwise
// outrank the page that actually contains the clause being asked about.
const NOISE_TERMS = new Set([
  'di', 'ke', 'dari', 'dan', 'atau', 'yang', 'untuk', 'pada', 'dengan', 'itu', 'ini',
  'apa', 'apakah', 'bagaimana', 'siapa', 'kapan', 'kenapa', 'mengapa', 'mana', 'berapa',
  'isinya', 'isi', 'tolong', 'mohon', 'coba', 'saya', 'kami', 'anda', 'adalah', 'ada',
  'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'is', 'are', 'what', 'which', 'how'
]);

// Keeps letters, digits, and the dots/dashes inside a clause reference such as
// "I.5.1" or "M-BCE-003", which are exactly the tokens worth searching for.
// Everything else becomes a separator, so nothing a user types can reach
// to_tsquery as syntax.
export function buildSopContentTsQuery(question) {
  const tokens = String(question || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}.\-]+/u)
    .map((token) => token.replace(/^[.\-]+|[.\-]+$/g, ''))
    .filter(Boolean);

  const meaningful = tokens.filter((token) => {
    if (NOISE_TERMS.has(token)) return false;
    // Short tokens are noise unless they carry a digit ("I.5.1", "M1", "3.2").
    return token.length >= 3 || /\d/.test(token);
  });

  // If the question was nothing but noise words, searching on them beats
  // returning nothing at all.
  const terms = (meaningful.length ? meaningful : tokens).slice(0, 25);
  return terms.join(' | ');
}

export async function retrieveSopContent({ actor, db, question, limit = 12 }) {
  const tsQuery = buildSopContentTsQuery(question);
  if (!tsQuery) return { topic: 'sop-content', records: [] };

  const scopeClause = isBusinessUnitScoped(actor)
    ? Prisma.sql`AND d."businessUnitId" = ANY(${effectiveBusinessUnitIds(actor)})`
    : Prisma.empty;

  // OR, not AND. plainto_tsquery ANDs every word, so a natural-language
  // question like "di policy berau coal pasal I.5.1 isinya apa?" required one
  // page to contain "di" AND "apa" AND "isinya" AND the clause number, and
  // matched nothing while 8 pages actually contained the clause. Terms are
  // ORed and ts_rank decides which pages are most relevant.
  const rows = await db.$queryRaw`
    SELECT s.id, s."pageNumber", s.text, d.title, bu.name AS "businessUnitName"
    FROM "SopSection" s
    JOIN "SopVersion" v ON v.id = s."sopVersionId"
    JOIN "SopDocument" d ON d.id = v."sopDocumentId"
    JOIN "BusinessUnit" bu ON bu.id = d."businessUnitId"
    WHERE d.status IN ('APPROVED', 'PUBLISHED')
      ${scopeClause}
      AND s."searchVector" @@ to_tsquery('simple', ${tsQuery})
    ORDER BY ts_rank(s."searchVector", to_tsquery('simple', ${tsQuery})) DESC
    LIMIT ${limit}
  `;

  return {
    topic: 'sop-content',
    records: rows.map((row) => ({
      type: 'SOP_CONTENT',
      id: row.id,
      label: `${row.title} — hal. ${row.pageNumber}`,
      businessUnit: row.businessUnitName,
      // Capped because context-builder.js drops an oversized record whole
      // rather than truncating it, so a very long page must not risk being
      // excluded silently. 1200 was needlessly tight and cut clause text off
      // mid-definition: 12 records at this size is ~10k tokens against a
      // ~48k budget, so the headroom is better spent on complete clauses.
      excerpt: row.text.length > 3200 ? `${row.text.slice(0, 3200)}…` : row.text
    }))
  };
}
