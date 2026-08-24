import assert from "node:assert/strict";
import test from "node:test";
import { checkGrounding } from "../lib/ai/chat/grounding.js";

const records = [
  { id: "d1", label: "SOP Pengadaan SMI" },
  { id: "d2", label: "SOP Etika SUN" },
];

// --- dataAvailable:false is never flagged -----------------------------------

test("an honest 'no data' answer is never flagged, regardless of references", () => {
  assert.equal(checkGrounding({ dataAvailable: false, references: [] }, records).ungrounded, false);
  assert.equal(checkGrounding({ dataAvailable: false, references: [] }, []).ungrounded, false);
});

// --- dataAvailable:true requires at least one traceable citation ------------

test("a claim backed by a matching recordId is grounded", () => {
  const result = checkGrounding({ dataAvailable: true, references: [{ label: "SOP Pengadaan SMI", recordType: "SOP_DOCUMENT", recordId: "d1" }] }, records);
  assert.equal(result.ungrounded, false);
  assert.equal(result.references.length, 1);
  assert.equal(result.fabricatedCount, 0);
});

test("a claim whose recordId matches nothing retrieved is fabricated and, being the only reference, ungrounded", () => {
  const result = checkGrounding({ dataAvailable: true, references: [{ label: "SOP Tidak Ada", recordType: "SOP_DOCUMENT", recordId: "d-999" }] }, records);
  assert.equal(result.ungrounded, true);
  assert.equal(result.fabricatedCount, 1);
  assert.equal(result.references.length, 0);
});

test("a claim with zero references despite records being available is ungrounded", () => {
  const result = checkGrounding({ dataAvailable: true, references: [] }, records);
  assert.equal(result.ungrounded, true);
});

test("a claim with zero references and an empty context is ungrounded", () => {
  const result = checkGrounding({ dataAvailable: true, references: [] }, []);
  assert.equal(result.ungrounded, true);
});

test("a label match is accepted when no recordId is given", () => {
  const result = checkGrounding({ dataAvailable: true, references: [{ label: "SOP Etika SUN", recordType: "SOP_DOCUMENT" }] }, records);
  assert.equal(result.ungrounded, false);
  assert.equal(result.references.length, 1);
});

test("a label match is case-insensitive", () => {
  const result = checkGrounding({ dataAvailable: true, references: [{ label: "sop etika sun", recordType: "SOP_DOCUMENT" }] }, records);
  assert.equal(result.ungrounded, false);
});

test("a label that matches nothing retrieved is fabricated", () => {
  const result = checkGrounding({ dataAvailable: true, references: [{ label: "SOP Yang Tidak Pernah Ada", recordType: "SOP_DOCUMENT" }] }, records);
  assert.equal(result.fabricatedCount, 1);
  assert.equal(result.ungrounded, true);
});

test("a mix of one grounded and one fabricated reference keeps only the grounded one and is not ungrounded", () => {
  const result = checkGrounding(
    { dataAvailable: true, references: [
      { label: "SOP Pengadaan SMI", recordType: "SOP_DOCUMENT", recordId: "d1" },
      { label: "SOP Karangan", recordType: "SOP_DOCUMENT", recordId: "d-fake" },
    ] },
    records,
  );
  assert.equal(result.ungrounded, false);
  assert.equal(result.references.length, 1);
  assert.equal(result.references[0].recordId, "d1");
  assert.equal(result.fabricatedCount, 1);
  assert.equal(result.fabricatedReferences[0].recordId, "d-fake");
});

test("a recordId takes priority over a coincidentally matching label", () => {
  // recordId does not match any retrieved id -- fabricated even though the
  // label happens to match a different real record.
  const result = checkGrounding({ dataAvailable: true, references: [{ label: "SOP Pengadaan SMI", recordType: "X", recordId: "d-wrong" }] }, records);
  assert.equal(result.fabricatedCount, 1);
});

test("references and includedRecords default to empty without throwing", () => {
  assert.doesNotThrow(() => checkGrounding({}, undefined));
  assert.doesNotThrow(() => checkGrounding(undefined, records));
});
