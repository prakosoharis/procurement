import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const DEFAULT_MINIMUM_TEXT_CHARACTERS = 20;

function assertPdfBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new TypeError("A non-empty PDF byte array is required.");
  }
}

function assertMinimumTextCharacters(value) {
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new TypeError("minimumTextCharacters must be an integer between 1 and 100000.");
  }
}

function normalizePageText(textContent) {
  return textContent.items
    .map((item) => item.str)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts text from a PDF without relying on a browser worker. This is safe
 * for Trigger.dev's Node runtime and deliberately does not persist the file.
 */
export async function inspectSearchablePdf({
  bytes,
  minimumTextCharacters = DEFAULT_MINIMUM_TEXT_CHARACTERS,
}) {
  assertPdfBytes(bytes);
  assertMinimumTextCharacters(minimumTextCharacters);

  const loadingTask = getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false,
  });

  let document;
  try {
    document = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = normalizePageText(textContent);

      pages.push({
        pageNumber,
        text,
        characterCount: text.replace(/\s/g, "").length,
      });
    }

    const text = pages
      .map((page) => page.text)
      .filter(Boolean)
      .join("\n");
    const characterCount = text.replace(/\s/g, "").length;

    return {
      pageCount: document.numPages,
      pages,
      text,
      characterCount,
      minimumTextCharacters,
      isSearchable: characterCount >= minimumTextCharacters,
    };
  } finally {
    document?.cleanup?.();
    await loadingTask.destroy();
  }
}
