import assert from "node:assert/strict";
import test from "node:test";
import { runRefinementPdfSmoke } from "../lib/refinement/pdf/refinement-pdf-smoke.js";
import { inspectSearchablePdf } from "../lib/refinement/pdf/searchable-pdf.js";

function escapePdfText(value) {
  return value.replace(/[\\()]/g, "\\$&");
}

function searchablePdf(text) {
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const crossReferenceOffset = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "binary"));
}

test("pdfjs extracts text from a searchable PDF fixture", async () => {
  const result = await inspectSearchablePdf({
    bytes: searchablePdf("Kebijakan Pengadaan Tender Terbuka"),
    minimumTextCharacters: 20,
  });

  assert.equal(result.pageCount, 1);
  assert.equal(result.isSearchable, true);
  assert.match(result.text, /Kebijakan Pengadaan Tender Terbuka/);
  assert.ok(result.characterCount >= 20);
});

test("PDF inspection marks text below the configured threshold as not searchable", async () => {
  const result = await inspectSearchablePdf({
    bytes: searchablePdf("SOP"),
    minimumTextCharacters: 20,
  });

  assert.equal(result.isSearchable, false);
  assert.equal(result.characterCount, 3);
});

test("PDF inspection accepts a real Node Buffer, not just a pre-converted Uint8Array (the exact shape lib/ai/refinement/document-text.js's toBuffer() and Buffer.concat produce when reading a stored file)", async () => {
  const bytes = Buffer.from(searchablePdf("Kebijakan Pengadaan Tender Terbuka"));
  assert.equal(bytes.constructor, Buffer);
  const result = await inspectSearchablePdf({ bytes, minimumTextCharacters: 20 });
  assert.equal(result.isSearchable, true);
  assert.match(result.text, /Kebijakan Pengadaan Tender Terbuka/);
});

test("PDF inspection rejects empty input before parsing", async () => {
  await assert.rejects(
    inspectSearchablePdf({ bytes: new Uint8Array() }),
    /non-empty PDF byte array/,
  );
});

test("Trigger PDF smoke runner accepts one searchable PDF payload", async () => {
  const result = await runRefinementPdfSmoke({
    pdfBase64: Buffer.from(searchablePdf("SOP Pengadaan dengan teks yang dapat dicari"))
      .toString("base64"),
    minimumTextCharacters: 20,
  });

  assert.equal(result.ok, true);
  assert.equal(result.pageCount, 1);
  assert.ok(result.characterCount >= 20);
  assert.match(result.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
});
