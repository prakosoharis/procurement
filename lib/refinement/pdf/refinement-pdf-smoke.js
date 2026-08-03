import { inspectSearchablePdf } from "./searchable-pdf.js";

export async function runRefinementPdfSmoke(payload) {
  if (typeof payload?.pdfBase64 !== "string" || payload.pdfBase64.trim() === "") {
    throw new TypeError("pdfBase64 is required.");
  }

  const bytes = new Uint8Array(Buffer.from(payload.pdfBase64, "base64"));
  const inspection = await inspectSearchablePdf({
    bytes,
    minimumTextCharacters: payload.minimumTextCharacters,
  });

  if (!inspection.isSearchable) {
    throw new Error(
      `PDF is not searchable: found ${inspection.characterCount} text characters; ` +
        `at least ${inspection.minimumTextCharacters} are required.`,
    );
  }

  return {
    ok: true,
    pageCount: inspection.pageCount,
    characterCount: inspection.characterCount,
    checkedAt: new Date().toISOString(),
  };
}
