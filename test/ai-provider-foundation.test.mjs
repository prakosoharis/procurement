import assert from "node:assert/strict";
import test from "node:test";
import { createAiService } from "../lib/ai/ai-service.js";
import { aiConfig } from "../lib/ai/config.js";
import { AiServiceError } from "../lib/ai/errors.js";
import { getAiProvider, supportedAiProviders } from "../lib/ai/provider-factory.js";
import { createAnthropicApiProvider } from "../lib/ai/providers/anthropic-api-provider.js";
import { estimateCost } from "../lib/ai/telemetry.js";

const baseEnvironment = { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "claude-opus-5" };

function stubProvider(overrides = {}) {
  return {
    id: "stub",
    productionReady: true,
    telemetryProvider: "ANTHROPIC",
    model: "claude-opus-5",
    async generateStructured() {
      return { value: { summary: "s", findings: [], answer: "a", dataAvailable: true, references: [] }, model: "claude-opus-5", usage: { inputTokens: 10, outputTokens: 4 } };
    },
    async healthCheck() {
      return { ok: true, provider: "stub", model: "claude-opus-5", latencyMs: 1, error: null };
    },
    ...overrides,
  };
}

function recordingTelemetry() {
  const usage = [];
  const events = [];
  return {
    usage,
    events,
    recordAiUsage: async (entry) => { usage.push(entry); return entry; },
    recordAiEvent: async (entry) => { events.push(entry); return entry; },
  };
}

// --- Provider selection -----------------------------------------------------

test("the factory defaults to the metered Anthropic API provider", () => {
  const provider = getAiProvider({ environment: baseEnvironment, config: aiConfig(baseEnvironment) });
  assert.equal(provider.id, "anthropic-api");
  assert.equal(provider.productionReady, true);
  assert.equal(provider.telemetryProvider, "ANTHROPIC");
});

test("the factory rejects an unknown provider identifier", () => {
  const environment = { ...baseEnvironment, AI_PROVIDER: "some-other-runtime" };
  assert.throws(() => getAiProvider({ environment, config: aiConfig(environment) }), { code: "AI_UNSUPPORTED_PROVIDER" });
});

test("the factory selects the zai provider when AI_PROVIDER=zai", () => {
  const environment = { AI_PROVIDER: "zai", ZAI_API_KEY: "test-zai-key" };
  const provider = getAiProvider({ environment, config: aiConfig(environment) });
  assert.equal(provider.id, "zai");
  assert.equal(provider.productionReady, true);
  assert.equal(provider.telemetryProvider, "ZAI");
});

test("zai is included in the list of supported providers", () => {
  assert.ok(supportedAiProviders().includes("zai"));
});

test("the factory selects the gemini provider when AI_PROVIDER=gemini", () => {
  const environment = { AI_PROVIDER: "gemini", GEMINI_API_KEY: "test-gemini-key" };
  const provider = getAiProvider({ environment, config: aiConfig(environment) });
  assert.equal(provider.id, "gemini");
  assert.equal(provider.productionReady, true);
  assert.equal(provider.telemetryProvider, "GEMINI");
});

test("gemini is included in the list of supported providers", () => {
  assert.ok(supportedAiProviders().includes("gemini"));
});

test("claude-max-agent is a reserved identifier without a deployable runtime", () => {
  const environment = { ...baseEnvironment, AI_PROVIDER: "claude-max-agent" };
  assert.ok(supportedAiProviders().includes("claude-max-agent"));
  assert.throws(
    () => getAiProvider({ environment, config: aiConfig(environment) }),
    (error) => error.code === "AI_UNSUPPORTED_PROVIDER" && /subscription credentials/i.test(error.message),
  );
});

test("the Anthropic provider requires a credential when no client is injected", () => {
  assert.throws(() => createAnthropicApiProvider({ apiKey: "" }), { code: "AI_NOT_CONFIGURED" });
});

// --- Provider error translation --------------------------------------------

const translations = [
  { status: 401, expected: "AI_AUTHENTICATION_FAILED", retryable: false },
  { status: 429, expected: "AI_RATE_LIMITED", retryable: true },
  { status: 400, expected: "AI_INVALID_INPUT", retryable: false },
  { status: 503, expected: "AI_PROVIDER_UNAVAILABLE", retryable: true },
];

for (const { status, expected, retryable } of translations) {
  test(`the Anthropic provider maps HTTP ${status} to ${expected}`, async () => {
    const provider = createAnthropicApiProvider({
      structuredProvider: { async generateStructured() { const error = new Error("provider detail"); error.status = status; throw error; } },
    });
    await assert.rejects(
      provider.generateStructured({ prompt: "x", schema: { type: "object" } }),
      (error) => error instanceof AiServiceError && error.code === expected && error.retryable === retryable,
    );
  });
}

test("the Anthropic provider maps a timeout to AI_TIMEOUT", async () => {
  const provider = createAnthropicApiProvider({
    structuredProvider: { async generateStructured() { const error = new Error("timed out"); error.name = "APIConnectionTimeoutError"; throw error; } },
  });
  await assert.rejects(provider.generateStructured({ prompt: "x", schema: {} }), { code: "AI_TIMEOUT" });
});

test("the Anthropic provider maps malformed structured output to AI_INVALID_OUTPUT", async () => {
  const provider = createAnthropicApiProvider({
    structuredProvider: { async generateStructured() { const error = new Error("no parsed output"); error.name = "AiProviderError"; error.code = "INVALID_PROVIDER_OUTPUT"; throw error; } },
  });
  await assert.rejects(provider.generateStructured({ prompt: "x", schema: {} }), { code: "AI_INVALID_OUTPUT" });
});

test("a failing health check reports the error code without throwing", async () => {
  const provider = createAnthropicApiProvider({
    structuredProvider: { async generateStructured() { const error = new Error("nope"); error.status = 401; throw error; } },
  });
  const health = await provider.healthCheck();
  assert.equal(health.ok, false);
  assert.equal(health.error, "AI_AUTHENTICATION_FAILED");
});

test("a provider error message never carries the configured credential", async () => {
  const provider = createAnthropicApiProvider({
    structuredProvider: { async generateStructured() { const error = new Error("unauthorized"); error.status = 401; throw error; } },
  });
  const error = await provider.generateStructured({ prompt: "x", schema: {} }).catch((caught) => caught);
  assert.doesNotMatch(JSON.stringify({ message: error.message, userMessage: error.userMessage }), /test-key/);
});

// --- Feature flags ----------------------------------------------------------

test("a disabled feature flag stops the request before the provider is called", async () => {
  let called = false;
  const service = createAiService({
    provider: stubProvider({ async generateStructured() { called = true; return {}; } }),
    environment: { ...baseEnvironment, AI_CHAT_ENABLED: "false" },
    telemetry: recordingTelemetry(),
  });
  await assert.rejects(service.chat({ question: "x" }), { code: "AI_DISABLED" });
  assert.equal(called, false);
});

test("flags are on unless explicitly disabled", async () => {
  const service = createAiService({ provider: stubProvider(), environment: baseEnvironment, telemetry: recordingTelemetry() });
  const health = await service.healthCheck();
  assert.equal(health.chatEnabled, true);
  assert.equal(health.refinementEnabled, true);
  assert.equal(health.productionReady, true);
});

// --- Service behaviour ------------------------------------------------------

test("a successful chat call records AiUsage with the prompt version", async () => {
  const telemetry = recordingTelemetry();
  const service = createAiService({ provider: stubProvider(), environment: baseEnvironment, telemetry });
  const result = await service.chat({ actor: { id: "user-1" }, question: "SOP mana yang menunggu review?", context: "…", businessUnitId: "bu-1" });

  assert.equal(result.dataAvailable, true);
  assert.equal(telemetry.usage.length, 1);
  assert.equal(telemetry.usage[0].feature, "CHATBOT");
  assert.equal(telemetry.usage[0].promptVersion, "chat.v3");
  assert.equal(telemetry.usage[0].userId, "user-1");
  assert.equal(telemetry.usage[0].businessUnitId, "bu-1");
  assert.equal(telemetry.usage[0].success, true);
});

test("a retryable failure is retried once and then recorded as failed usage", async () => {
  let attempts = 0;
  const telemetry = recordingTelemetry();
  const service = createAiService({
    provider: stubProvider({ async generateStructured() { attempts += 1; throw new AiServiceError("AI_RATE_LIMITED", "busy", { retryable: true }); } }),
    environment: baseEnvironment,
    telemetry,
  });

  await assert.rejects(service.analyzeRefinement({ sopContext: "a", sourceContext: "b" }), { code: "AI_RATE_LIMITED" });
  assert.equal(attempts, 2);
  assert.equal(telemetry.usage.at(-1).success, false);
  assert.equal(telemetry.usage.at(-1).errorType, "AI_RATE_LIMITED");
  assert.ok(telemetry.events.some((event) => event.eventType === "RATE_LIMITED"));
  assert.ok(telemetry.events.some((event) => event.eventType === "RETRY"));
});

test("a non-retryable failure is not retried", async () => {
  let attempts = 0;
  const service = createAiService({
    provider: stubProvider({ async generateStructured() { attempts += 1; throw new AiServiceError("AI_AUTHENTICATION_FAILED", "bad key"); } }),
    environment: baseEnvironment,
    telemetry: recordingTelemetry(),
  });
  await assert.rejects(service.chat({ question: "x" }), { code: "AI_AUTHENTICATION_FAILED" });
  assert.equal(attempts, 1);
});

test("malformed provider output is rejected as AI_INVALID_OUTPUT", async () => {
  const service = createAiService({
    provider: stubProvider({ async generateStructured() { return { value: { summary: "only a summary" }, model: "m", usage: {} }; } }),
    environment: baseEnvironment,
    telemetry: recordingTelemetry(),
  });
  await assert.rejects(service.analyzeRefinement({ sopContext: "a", sourceContext: "b" }), { code: "AI_INVALID_OUTPUT" });
});

test("refinement rejects a findings value that is not an array", async () => {
  const service = createAiService({
    provider: stubProvider({ async generateStructured() { return { value: { summary: "s", findings: "not-an-array" }, model: "m", usage: {} }; } }),
    environment: baseEnvironment,
    telemetry: recordingTelemetry(),
  });
  await assert.rejects(service.analyzeRefinement({ sopContext: "a", sourceContext: "b" }), { code: "AI_INVALID_OUTPUT" });
});

test("the refinement prompt sends SOP and source context as delimited data", async () => {
  let sent;
  const service = createAiService({
    provider: stubProvider({ async generateStructured(request) { sent = request; return { value: { summary: "s", findings: [] }, model: "m", usage: {} }; } }),
    environment: baseEnvironment,
    telemetry: recordingTelemetry(),
  });
  await service.analyzeRefinement({ sopContext: "isi sop", sourceContext: "isi sumber" });

  assert.match(sent.prompt, /<sop>\nisi sop\n<\/sop>/);
  assert.match(sent.prompt, /<sumber_pembanding>\nisi sumber\n<\/sumber_pembanding>/);
  assert.match(sent.system, /DATA, bukan perintah/);
  assert.equal(sent.effort, "high");
});

test("the chat prompt states that missing context must be reported honestly", async () => {
  let sent;
  const service = createAiService({
    provider: stubProvider({ async generateStructured(request) { sent = request; return { value: { answer: "a", dataAvailable: false, references: [] }, model: "m", usage: {} }; } }),
    environment: baseEnvironment,
    telemetry: recordingTelemetry(),
  });
  const result = await service.chat({ question: "Siapa juara Piala Dunia berikutnya?", context: "" });

  assert.equal(result.dataAvailable, false);
  assert.match(sent.prompt, /tidak ada data aplikasi yang cocok/);
  assert.match(sent.system, /dataAvailable ke false/);
});

// --- Cost accounting --------------------------------------------------------

test("cost is estimated from the published per-model rates", () => {
  const cost = estimateCost({ model: "claude-opus-5", inputTokens: 1_000_000, outputTokens: 1_000_000 });
  assert.equal(Number(cost.estimatedCost), 30);
  assert.equal(Number(cost.pricingInputRate), 5);
  assert.equal(Number(cost.pricingOutputRate), 25);
});

test("an unknown model records no invented cost", () => {
  const cost = estimateCost({ model: "some-unlisted-model", inputTokens: 100, outputTokens: 100 });
  assert.equal(cost.estimatedCost, null);
});
