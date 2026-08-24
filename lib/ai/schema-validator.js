// Minimal JSON Schema validator for the subset lib/ai/schemas.js uses.
//
// Anthropic enforces a schema server-side, but z.ai offers JSON mode only: the
// response is valid JSON with no guarantee it matches the requested shape. That
// makes client-side validation load-bearing, not belt-and-braces, so it lives
// here and is shared by every provider.
//
// Deliberately not a general validator and not a new dependency: it covers
// object/array/string/number/boolean, properties, required, enum,
// additionalProperties:false, items, and numeric bounds. An unsupported keyword
// is ignored rather than silently treated as a pass of something it never read.

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function matchesType(value, expected) {
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeOf(value) === expected;
}

function validateNode(value, schema, path, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((candidate) => matchesType(value, candidate))) {
      errors.push(`${path}: expected ${expected.join(' or ')}, received ${typeOf(value)}`);
      // Type is wrong, so every nested rule below would report noise.
      return;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) errors.push(`${path}: ${value} is below minimum ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) errors.push(`${path}: ${value} is above maximum ${schema.maximum}`);
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) {
      if (value[key] === undefined) errors.push(`${path}: missing required "${key}"`);
    }
    const properties = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) errors.push(`${path}: unexpected property "${key}"`);
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (value[key] !== undefined) validateNode(value[key], child, `${path}.${key}`, errors);
    }
  }

  if (typeOf(value) === 'array' && schema.items) {
    value.forEach((entry, index) => validateNode(entry, schema.items, `${path}[${index}]`, errors));
  }
}

export function validateAgainstSchema(value, schema) {
  const errors = [];
  validateNode(value, schema, '$', errors);
  return { valid: errors.length === 0, errors };
}

// Renders the schema as an instruction for providers that cannot enforce one.
export function schemaInstruction(schema) {
  return [
    'Balas HANYA dengan satu objek JSON yang valid terhadap JSON Schema berikut.',
    'Jangan menambahkan properti di luar skema, jangan membungkusnya dalam blok kode, dan jangan menulis teks apa pun di luar JSON.',
    '',
    JSON.stringify(schema)
  ].join('\n');
}
