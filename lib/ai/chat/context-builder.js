// Turns scoped retrieval results into the bounded text block the model sees.
// Records are emitted as compact JSON lines: unambiguous for the model, cheap
// in tokens, and easy to cite back. Truncation is always stated in the context
// rather than applied silently.

// Deliberately conservative for mixed Indonesian/English text.
const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / CHARS_PER_TOKEN);
}

function serialize(record) {
  const entries = Object.entries(record).filter(([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0));
  const normalized = Object.fromEntries(entries.map(([key, value]) => [key, value instanceof Date ? value.toISOString().slice(0, 10) : value]));
  return JSON.stringify(normalized);
}

export function buildChatContext({ results = [], maxContextTokens = 60_000 } = {}) {
  const lines = [];
  const included = [];
  const droppedByTopic = new Map();
  const failedTopics = results.filter((result) => result.failed).map((result) => result.topic);

  // Reserve headroom for the system prompt, the question, and the response.
  let budget = Math.max(500, Math.floor(maxContextTokens * 0.8));

  for (const result of results) {
    const header = `## ${result.topic}`;
    let headerWritten = false;
    for (const record of result.records || []) {
      const line = serialize(record);
      const cost = estimateTokens(line) + (headerWritten ? 0 : estimateTokens(header));
      if (cost > budget) {
        droppedByTopic.set(result.topic, (droppedByTopic.get(result.topic) || 0) + 1);
        continue;
      }
      if (!headerWritten) {
        lines.push(header);
        headerWritten = true;
      }
      lines.push(line);
      included.push(record);
      budget -= cost;
    }
  }

  const notes = [];
  for (const [topic, count] of droppedByTopic) {
    notes.push(`Catatan: ${count} catatan ${topic} tidak dimuat karena batas ukuran konteks.`);
  }
  for (const topic of failedTopics) {
    notes.push(`Catatan: data ${topic} gagal dimuat untuk permintaan ini.`);
  }

  const context = [...lines, ...(notes.length ? ['', ...notes] : [])].join('\n');
  return {
    context,
    includedRecords: included,
    recordCount: included.length,
    droppedCount: [...droppedByTopic.values()].reduce((total, count) => total + count, 0),
    failedTopics,
    estimatedTokens: estimateTokens(context)
  };
}
