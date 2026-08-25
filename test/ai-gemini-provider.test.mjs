import assert from "node:assert/strict";
import test from "node:test";
import { createGeminiProvider, GEMINI_DEFAULT_BASE_URL, GEMINI_DEFAULT_MODEL, GEMINI_DEFAULT_REASONING_EFFORT } from "../lib/ai/providers/gemini-provider.js";
import { AiServiceError } from "../lib/ai/errors.js";
import { REFINEMENT_RESPONSE_SCHEMA } from "../lib/ai/schemas.js";

const okFinding = {
  title: "t", category: "PROCESS_GAP", severity: "HIGH", gap: "g", recommendation: "r", confidence: 0.5,
  evidence: { sopSection: "a", sourceSection: "b", sourceQuote: "c", justification: "d", impact: "e" },
};

function stubClient(reply) {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        async create(request) {
          calls.push(request);
          if (typeof reply === "function") return reply(request);
          return reply;
        },
      },
    },
  };
}

function chatResponse(contentValue, overrides = {}) {
  return {
    id: "gemini-req-1",
    model: "gemini-3.7-flash",
    choices: [{ message: { content: typeof contentValue === "string" ? contentValue : JSON.stringify(contentValue) } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    ...overrides,
  };
}

// --- Configuration -----------------------------------------------------------

test("the provider requires a credential when no client is injected", () => {
  assert.throws(() => createGeminiProvider({ apiKey: "" }), { code: "AI_NOT_CONFIGURED" });
});

test("defaults are the OpenAI-compatible endpoint and gemini-3.7-flash", () => {
  const client = stubClient(chatResponse({ status: "ok" }));
  const provider = createGeminiProvider({ client });
  assert.equal(provider.id, "gemini");
  assert.equal(provider.model, GEMINI_DEFAULT_MODEL);
  assert.equal(GEMINI_DEFAULT_BASE_URL, "https://generativelanguage.googleapis.com/v1beta/openai/");
  assert.equal(provider.productionReady, true);
  assert.equal(provider.telemetryProvider, "GEMINI");
});

// --- Thinking budget ---------------------------------------------------------
// Gemini 3 always thinks, and thinking tokens count against max_tokens. Sending
// no reasoning_effort made the real free tier return finish_reason "length" with
// completion_tokens 0 -- the entire budget went to thinking and no answer came
// back. These tests lock in that reasoning_effort is always sent.

test("reasoning_effort is always sent, defaulting to low, so thinking cannot consume the whole token budget and leave an empty answer", async () => {
  const client = stubClient(chatResponse({ summary: "s", findings: [] }));
  const provider = createGeminiProvider({ client });
  await provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA });
  assert.equal(client.calls[0].reasoning_effort, "low");
  assert.equal(GEMINI_DEFAULT_REASONING_EFFORT, "low");
});

test("the reasoning effort is overridable for a paid tier where higher levels are provisioned", async () => {
  const client = stubClient(chatResponse({ summary: "s", findings: [] }));
  const provider = createGeminiProvider({ client, reasoningEffort: "high" });
  await provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA });
  assert.equal(client.calls[0].reasoning_effort, "high");
});

test("an unsupported reasoning effort is rejected at construction rather than failing per-request", () => {
  // 'minimal' appears in Gemini's docs but this model rejects it with HTTP 400.
  assert.throws(() => createGeminiProvider({ apiKey: "k", reasoningEffort: "minimal" }), { code: "AI_NOT_CONFIGURED" });
});

// --- JSON mode: schema is sent as an instruction, not enforced server-side ---

test("the schema is sent as an instruction in the system message, since this uses Gemini's basic JSON mode rather than server-side schema enforcement", async () => {
  const client = stubClient(chatResponse({ summary: "s", findings: [] }));
  const provider = createGeminiProvider({ client });
  await provider.generateStructured({ system: "Ikuti aturan ini.", prompt: "Analisis.", schema: REFINEMENT_RESPONSE_SCHEMA });

  const request = client.calls[0];
  assert.equal(request.response_format.type, "json_object");
  assert.equal(request.messages[0].role, "system");
  assert.match(request.messages[0].content, /Ikuti aturan ini\./);
  assert.match(request.messages[0].content, /Balas HANYA dengan satu objek JSON/);
  assert.match(request.messages[0].content, /"summary"/);
  assert.equal(request.messages[1].content, "Analisis.");
});

test("a valid JSON response matching the schema is returned as the parsed value", async () => {
  const client = stubClient(chatResponse({ summary: "ringkasan", findings: [okFinding] }));
  const provider = createGeminiProvider({ client });
  const result = await provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA });

  assert.deepEqual(result.value, { summary: "ringkasan", findings: [okFinding] });
  assert.equal(result.model, "gemini-3.7-flash");
  assert.equal(result.requestId, "gemini-req-1");
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5 });
});

test("a fenced code block around the JSON is stripped before parsing", async () => {
  const client = stubClient(chatResponse("```json\n" + JSON.stringify({ summary: "s", findings: [] }) + "\n```"));
  const provider = createGeminiProvider({ client });
  const result = await provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA });
  assert.deepEqual(result.value, { summary: "s", findings: [] });
});

// --- Client-side validation is load-bearing, not optional --------------------

test("output that violates the schema is rejected as AI_INVALID_OUTPUT and marked retryable", async () => {
  const client = stubClient(chatResponse({ summary: "s", findings: [{ ...okFinding, category: "NOT_A_REAL_CATEGORY" }] }));
  const provider = createGeminiProvider({ client });
  await assert.rejects(
    provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA }),
    (error) => error instanceof AiServiceError && error.code === "AI_INVALID_OUTPUT" && error.retryable === true && /category/.test(error.message),
  );
});

test("a missing required field is rejected", async () => {
  const client = stubClient(chatResponse({ findings: [] }));
  const provider = createGeminiProvider({ client });
  await assert.rejects(provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA }), { code: "AI_INVALID_OUTPUT" });
});

test("non-JSON content is rejected as AI_INVALID_OUTPUT rather than throwing a raw parse error", async () => {
  const client = stubClient(chatResponse("bukan json sama sekali"));
  const provider = createGeminiProvider({ client });
  await assert.rejects(provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA }), { code: "AI_INVALID_OUTPUT" });
});

test("an empty response body is rejected as AI_INVALID_OUTPUT", async () => {
  const client = stubClient(chatResponse(""));
  const provider = createGeminiProvider({ client });
  await assert.rejects(provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA }), { code: "AI_INVALID_OUTPUT" });
});

// --- Transport error translation, shared with the other providers ------------

const translations = [
  { status: 401, expected: "AI_AUTHENTICATION_FAILED", retryable: false },
  { status: 429, expected: "AI_RATE_LIMITED", retryable: true },
  { status: 400, expected: "AI_INVALID_INPUT", retryable: false },
  { status: 503, expected: "AI_PROVIDER_UNAVAILABLE", retryable: true },
];

for (const { status, expected, retryable } of translations) {
  test(`an HTTP ${status} from Gemini maps to ${expected}`, async () => {
    const client = stubClient(() => { const error = new Error("detail"); error.status = status; throw error; });
    const provider = createGeminiProvider({ client });
    await assert.rejects(
      provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA }),
      (error) => error instanceof AiServiceError && error.code === expected && error.retryable === retryable,
    );
  });
}

test("a provider error message never carries the configured credential", async () => {
  const client = stubClient(() => { const error = new Error("unauthorized for key sk-test-secret"); error.status = 401; throw error; });
  const provider = createGeminiProvider({ apiKey: "sk-test-secret", client });
  const error = await provider.generateStructured({ prompt: "x", schema: REFINEMENT_RESPONSE_SCHEMA }).catch((caught) => caught);
  assert.doesNotMatch(JSON.stringify({ message: error.message, userMessage: error.userMessage }), /sk-test-secret/);
});

// --- Health check --------------------------------------------------------

test("a failing health check reports the error code without throwing", async () => {
  const client = stubClient(() => { const error = new Error("nope"); error.status = 401; throw error; });
  const provider = createGeminiProvider({ client });
  const health = await provider.healthCheck();
  assert.equal(health.ok, false);
  assert.equal(health.provider, "gemini");
  assert.equal(health.error, "AI_AUTHENTICATION_FAILED");
});

test("a passing health check reports ok with latency and model", async () => {
  const client = stubClient(chatResponse({ status: "ok" }));
  const provider = createGeminiProvider({ client });
  const health = await provider.healthCheck();
  assert.equal(health.ok, true);
  assert.equal(health.provider, "gemini");
  assert.equal(typeof health.latencyMs, "number");
});

// --- Input validation --------------------------------------------------------

test("an empty prompt is rejected before any request is sent", async () => {
  const client = stubClient(chatResponse({ summary: "s", findings: [] }));
  const provider = createGeminiProvider({ client });
  await assert.rejects(provider.generateStructured({ prompt: "  ", schema: REFINEMENT_RESPONSE_SCHEMA }), { code: "AI_INVALID_INPUT" });
  assert.equal(client.calls.length, 0);
});

test("a missing schema is rejected before any request is sent", async () => {
  const client = stubClient(chatResponse({ summary: "s", findings: [] }));
  const provider = createGeminiProvider({ client });
  await assert.rejects(provider.generateStructured({ prompt: "x" }), { code: "AI_INVALID_INPUT" });
  assert.equal(client.calls.length, 0);
});
