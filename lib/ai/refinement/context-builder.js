import { estimateTokens } from '../chat/context-builder.js';

// Retrieval before inference. The source catalog with parsed sections and
// embeddings is REF-S1..S6 and does not exist yet, so this selects source pages
// by deterministic lexical overlap with the SOP pages actually included. It is a
// narrower but honest stand-in: the model still receives candidate material
// rather than whole documents, and the interface stays the same when the
// catalog replaces the scoring function.

const SOP_BUDGET_SHARE = 0.45;
const SOURCE_BUDGET_SHARE = 0.45;
const MIN_TERM_LENGTH = 4;

const stopwords = new Set([
  'yang', 'dan', 'atau', 'untuk', 'dengan', 'pada', 'dari', 'dalam', 'akan', 'adalah',
  'tidak', 'dapat', 'harus', 'oleh', 'sebagai', 'telah', 'juga', 'agar', 'serta', 'ini',
  'itu', 'tersebut', 'dimaksud', 'ayat', 'pasal', 'huruf', 'angka', 'bagian', 'bab',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'shall', 'must', 'have', 'been',
  'are', 'was', 'were', 'not', 'any', 'all', 'may', 'can', 'will', 'such', 'which'
]);

function terms(text) {
  const found = new Set();
  for (const token of String(text || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (token.length >= MIN_TERM_LENGTH && !stopwords.has(token)) found.add(token);
  }
  return found;
}

function overlapScore(pageTerms, referenceTerms) {
  if (!pageTerms.size) return 0;
  let shared = 0;
  for (const term of pageTerms) if (referenceTerms.has(term)) shared += 1;
  // Normalised so a long page cannot outrank a densely relevant short one.
  return shared / Math.sqrt(pageTerms.size);
}

function label(page) {
  return `[hal. ${page.pageNumber}]\n${page.text}`;
}

function takeInOrder(pages, budget) {
  const included = [];
  let remaining = budget;
  for (const page of pages) {
    const cost = estimateTokens(label(page));
    if (cost > remaining) continue;
    included.push(page);
    remaining -= cost;
  }
  return included;
}

export function buildRefinementContext({
  sopDocument,
  sourceDocument,
  maxContextTokens = 60_000
} = {}) {
  const sopBudget = Math.floor(maxContextTokens * SOP_BUDGET_SHARE);
  const sourceBudget = Math.floor(maxContextTokens * SOURCE_BUDGET_SHARE);

  const sopPages = takeInOrder(sopDocument.pages, sopBudget);
  const sopTerms = terms(sopPages.map((page) => page.text).join(' '));

  // Rank every source page against the SOP text that was actually included,
  // then restore page order so citations stay readable.
  const ranked = [...sourceDocument.pages]
    .map((page) => ({ page, score: overlapScore(terms(page.text), sopTerms) }))
    .sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);

  const selected = [];
  let remaining = sourceBudget;
  for (const { page } of ranked) {
    const cost = estimateTokens(label(page));
    if (cost > remaining) continue;
    selected.push(page);
    remaining -= cost;
  }
  const sourcePages = selected.sort((a, b) => a.pageNumber - b.pageNumber);

  const sopOmitted = sopDocument.pages.length - sopPages.length;
  const sourceOmitted = sourceDocument.pages.length - sourcePages.length;

  // The model must know its view is partial, so it does not present an absence
  // of evidence as evidence of absence.
  const notes = [
    `Dokumen SOP: ${sopDocument.fileName}, ${sopDocument.pageCount} halaman, ${sopPages.length} halaman disertakan.`,
    `Sumber pembanding: ${sourceDocument.fileName}, ${sourceDocument.pageCount} halaman, ${sourcePages.length} halaman disertakan (dipilih berdasarkan kemiripan istilah dengan SOP).`
  ];
  if (sopOmitted > 0) notes.push(`${sopOmitted} halaman SOP tidak disertakan karena batas ukuran konteks. Jangan menyimpulkan bahwa isinya tidak ada.`);
  if (sourceOmitted > 0) notes.push(`${sourceOmitted} halaman sumber tidak disertakan karena batas ukuran konteks. Jangan menyimpulkan bahwa isinya tidak ada.`);

  return {
    sopContext: sopPages.map(label).join('\n\n'),
    sourceContext: sourcePages.map(label).join('\n\n'),
    scopeNote: notes.join('\n'),
    sopPagesIncluded: sopPages.map((page) => page.pageNumber),
    sourcePagesIncluded: sourcePages.map((page) => page.pageNumber),
    omittedPageCount: sopOmitted + sourceOmitted,
    complete: sopOmitted === 0 && sourceOmitted === 0
  };
}
