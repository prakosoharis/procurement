import { getObject } from '../../storage.js';
import { inspectSearchablePdf } from '../../refinement/pdf/searchable-pdf.js';
import { AiServiceError } from '../errors.js';

// Loads a stored document and returns its page text. MVP scope is a PDF with a
// real text layer; a scanned PDF or a DOCX is rejected with a clear reason
// rather than silently analysed as an empty document.

const PDF_CONTENT_TYPES = new Set(['application/pdf']);
// A page below this is effectively blank and only wastes context.
const MINIMUM_PAGE_CHARACTERS = 40;

async function toBuffer(body) {
  if (!body) throw new AiServiceError('AI_INVALID_INPUT', 'Stored object has no readable body.');
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.arrayBuffer === 'function') return Buffer.from(await body.arrayBuffer());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function loadDocumentPages({
  fileKey,
  fileName = 'document',
  contentType,
  readObject = getObject,
  extract = inspectSearchablePdf
} = {}) {
  if (!fileKey) throw new AiServiceError('AI_INVALID_INPUT', `${fileName} has no stored file.`);
  if (contentType && !PDF_CONTENT_TYPES.has(contentType)) {
    throw new AiServiceError('AI_INVALID_INPUT', `${fileName} is not a PDF. AI Refinement currently supports text-layer PDF only.`);
  }

  let inspection;
  try {
    const object = await readObject(fileKey);
    inspection = await extract({ bytes: await toBuffer(object.Body) });
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    throw new AiServiceError('AI_INVALID_INPUT', `Unable to read ${fileName}: ${error.message}`, { cause: error });
  }

  if (!inspection.isSearchable) {
    throw new AiServiceError('AI_INVALID_INPUT', `${fileName} has no usable text layer. Scanned or image-only PDF is out of scope.`);
  }

  return {
    fileName,
    pageCount: inspection.pageCount,
    characterCount: inspection.characterCount,
    pages: inspection.pages.filter((page) => page.characterCount >= MINIMUM_PAGE_CHARACTERS)
  };
}
