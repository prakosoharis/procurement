import { db as defaultDb } from '../db.js';
import { loadDocumentPages } from '../ai/refinement/document-text.js';
import { isAiServiceError } from '../ai/errors.js';

// Extracts and stores per-page SOP text for chatbot full-text search
// (lib/ai/chat/retrievers/sop-content.js). Reuses the same read-and-extract
// chain AI Refinement already uses (loadDocumentPages -> getObject ->
// inspectSearchablePdf) rather than a second implementation.
//
// PDF only for now: a DOCX or a scanned/no-text-layer PDF makes
// loadDocumentPages throw AiServiceError('AI_INVALID_INPUT', ...). That is
// caught here and treated as "nothing to index," not a failure -- the
// document keeps working everywhere else, chat retrieval just has no
// SOP_CONTENT records for it (same as every document today, before this
// feature existed).
//
// Idempotent: existing sections for the version are replaced, so a retry or
// a re-index after fixing a source file is always correct.
export async function indexSopVersion(sopVersionId, { db = defaultDb } = {}) {
  const version = await db.sopVersion.findUnique({
    where: { id: sopVersionId },
    select: { id: true, fileKey: true, fileName: true, contentType: true }
  });
  if (!version?.fileKey) return { indexed: 0, skipped: true, reason: 'NO_FILE' };

  let pages;
  try {
    ({ pages } = await loadDocumentPages({
      fileKey: version.fileKey, fileName: version.fileName || 'document', contentType: version.contentType
    }));
  } catch (error) {
    // Only a KNOWN document-format limitation is a legitimate skip: "not a
    // PDF" and "no usable text layer" are thrown without a cause. A wrapped
    // underlying failure (error.cause present -- Drive auth, module
    // resolution, a corrupt file) is infrastructure breaking, and swallowing
    // it as a skip once made 36 production runs report "Completed" while
    // indexing nothing. Rethrow so the run fails where an operator can see it.
    if (isAiServiceError(error) && !error.cause) {
      return { indexed: 0, skipped: true, reason: error.code, message: error.message };
    }
    throw error;
  }

  await db.$transaction([
    db.sopSection.deleteMany({ where: { sopVersionId } }),
    ...(pages.length ? [db.sopSection.createMany({
      data: pages.map((page) => ({
        sopVersionId, pageNumber: page.pageNumber, text: page.text, characterCount: page.characterCount
      }))
    })] : [])
  ]);

  return { indexed: pages.length, skipped: false };
}
