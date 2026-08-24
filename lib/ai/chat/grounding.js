// Verifies a chat answer's citations against the records that were actually
// retrieved and sent to the model, so a fabricated reference cannot slip past
// the schema check (the schema only requires the SHAPE of a reference, not
// that it points at something real).
//
// The output schema and the chat prompt both instruct the model to copy
// `recordId` verbatim from a context record's `id` field. This is the only
// place that claim is checked rather than trusted.

function normalizeLabel(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function checkGrounding({ references = [], dataAvailable } = {}, includedRecords = []) {
  const idsById = new Set();
  const idsByLabel = new Set();
  for (const record of includedRecords) {
    if (record?.id) idsById.add(String(record.id));
    if (record?.label) idsByLabel.add(normalizeLabel(record.label));
  }

  const grounded = [];
  const fabricated = [];

  for (const reference of references) {
    // recordId is the strong signal: the prompt tells the model to copy it
    // verbatim, so an id present in context is unambiguous grounding.
    if (reference?.recordId && idsById.has(String(reference.recordId))) {
      grounded.push(reference);
      continue;
    }
    // No recordId, or one that does not match anything retrieved: fall back to
    // matching the label against a retrieved record's label. Weaker, but a
    // reference matching neither is not traceable to anything the model saw.
    if (!reference?.recordId && reference?.label && idsByLabel.has(normalizeLabel(reference.label))) {
      grounded.push(reference);
      continue;
    }
    fabricated.push(reference);
  }

  return {
    references: grounded,
    fabricatedCount: fabricated.length,
    fabricatedReferences: fabricated,
    // dataAvailable:false is the model's honest "I don't know" and needs no
    // grounding. dataAvailable:true is a claim, and a claim with zero
    // traceable citations -- whether none were given or all were fabricated
    // -- is exactly the shape a hallucinated answer produces.
    ungrounded: dataAvailable === true && grounded.length === 0
  };
}
