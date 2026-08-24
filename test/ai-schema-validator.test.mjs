import assert from "node:assert/strict";
import test from "node:test";
import { schemaInstruction, validateAgainstSchema } from "../lib/ai/schema-validator.js";
import { CHAT_RESPONSE_SCHEMA, REFINEMENT_RESPONSE_SCHEMA } from "../lib/ai/schemas.js";

// --- Type checking ------------------------------------------------------------

test("a matching primitive type passes", () => {
  assert.equal(validateAgainstSchema("x", { type: "string" }).valid, true);
  assert.equal(validateAgainstSchema(1, { type: "integer" }).valid, true);
  assert.equal(validateAgainstSchema(1.5, { type: "number" }).valid, true);
  assert.equal(validateAgainstSchema(true, { type: "boolean" }).valid, true);
});

test("a non-integer number fails an integer type", () => {
  const result = validateAgainstSchema(1.5, { type: "integer" });
  assert.equal(result.valid, false);
});

test("null and array are distinguished from object", () => {
  assert.equal(validateAgainstSchema(null, { type: "object" }).valid, false);
  assert.equal(validateAgainstSchema([], { type: "object" }).valid, false);
  assert.equal(validateAgainstSchema({}, { type: "array" }).valid, false);
});

test("a type mismatch is reported once without cascading nested noise", () => {
  const result = validateAgainstSchema("not an object", { type: "object", required: ["x"], properties: { x: { type: "string" } } });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /expected object, received string/);
});

// --- required / additionalProperties -----------------------------------------

test("a missing required property is reported", () => {
  const result = validateAgainstSchema({}, { type: "object", required: ["answer"], properties: { answer: { type: "string" } } });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /missing required "answer"/);
});

test("additionalProperties:false rejects an unexpected key", () => {
  const schema = { type: "object", additionalProperties: false, properties: { a: { type: "string" } } };
  assert.equal(validateAgainstSchema({ a: "x" }, schema).valid, true);
  const result = validateAgainstSchema({ a: "x", b: "y" }, schema);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /unexpected property "b"/);
});

test("additionalProperties is not enforced when the schema does not set it to false", () => {
  const schema = { type: "object", properties: { a: { type: "string" } } };
  assert.equal(validateAgainstSchema({ a: "x", b: "y" }, schema).valid, true);
});

// --- enum / bounds -------------------------------------------------------------

test("enum rejects a value outside the allowed set", () => {
  const result = validateAgainstSchema("PURPLE", { type: "string", enum: ["RED", "GREEN"] });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /is not one of RED, GREEN/);
});

test("numeric minimum and maximum are enforced", () => {
  const schema = { type: "number", minimum: 0, maximum: 1 };
  assert.equal(validateAgainstSchema(0.5, schema).valid, true);
  assert.equal(validateAgainstSchema(-0.1, schema).valid, false);
  assert.equal(validateAgainstSchema(1.1, schema).valid, false);
});

// --- nested objects and arrays --------------------------------------------------

test("nested object properties are validated recursively", () => {
  const schema = { type: "object", properties: { user: { type: "object", required: ["name"], properties: { name: { type: "string" } } } } };
  const result = validateAgainstSchema({ user: {} }, schema);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /\$\.user: missing required "name"/);
});

test("array items are validated element by element with an indexed path", () => {
  const schema = { type: "array", items: { type: "string" } };
  const result = validateAgainstSchema(["a", 2, "c"], schema);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /\$\[1\]: expected string, received number/);
});

// --- Against the actual application schemas --------------------------------

test("a well-formed chat response validates against CHAT_RESPONSE_SCHEMA", () => {
  const result = validateAgainstSchema(
    { answer: "jawaban", dataAvailable: true, references: [{ label: "SOP A", recordType: "SOP_DOCUMENT" }] },
    CHAT_RESPONSE_SCHEMA,
  );
  assert.equal(result.valid, true);
});

test("a chat response missing dataAvailable is rejected", () => {
  const result = validateAgainstSchema({ answer: "x", references: [] }, CHAT_RESPONSE_SCHEMA);
  assert.equal(result.valid, false);
});

test("a well-formed refinement response validates against REFINEMENT_RESPONSE_SCHEMA", () => {
  const result = validateAgainstSchema(
    {
      summary: "ringkasan", findings: [{
        title: "t", category: "PROCESS_GAP", severity: "MEDIUM", gap: "g", recommendation: "r", confidence: 0.4,
        evidence: { sopSection: "a", sourceSection: "b", sourceQuote: "c", justification: "d", impact: "e" },
      }],
    },
    REFINEMENT_RESPONSE_SCHEMA,
  );
  assert.equal(result.valid, true);
});

// --- Instruction rendering ----------------------------------------------------

test("schemaInstruction embeds the schema as JSON and forbids code fences", () => {
  const instruction = schemaInstruction(CHAT_RESPONSE_SCHEMA);
  assert.match(instruction, /Balas HANYA dengan satu objek JSON/);
  assert.match(instruction, /jangan membungkusnya dalam blok kode/);
  assert.ok(instruction.includes(JSON.stringify(CHAT_RESPONSE_SCHEMA)), "instruction should embed the schema verbatim as JSON");
});
