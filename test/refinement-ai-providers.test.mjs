import assert from "node:assert/strict";
import test from "node:test";
import { createAnthropicStructuredProvider } from "../lib/refinement/ai/anthropic-structured.js";
import { validateEnvironment } from "../lib/refinement/ai/environment.js";
import { createOpenAiEmbeddingProvider } from "../lib/refinement/ai/openai-embeddings.js";

test("Anthropic provider sends JSON Schema and returns parsed structured output", async () => {
  let request;
  const provider = createAnthropicStructuredProvider({
    model: "claude-test",
    client: {
      messages: {
        async parse(payload) {
          request = payload;
          return {
            model: "claude-test",
            parsed_output: { status: "ready" },
            usage: { input_tokens: 5, output_tokens: 2 },
            _request_id: "anthropic-request",
          };
        },
      },
    },
  });

  const response = await provider.generateStructured({
    prompt: "Return readiness.",
    schema: { type: "object", properties: { status: { type: "string" } } },
  });

  assert.equal(request.output_config.format.type, "json_schema");
  assert.equal(request.messages[0].content, "Return readiness.");
  assert.deepEqual(response.value, { status: "ready" });
  assert.deepEqual(response.usage, { inputTokens: 5, outputTokens: 2 });
});

test("Anthropic provider rejects an absent parsed output", async () => {
  const provider = createAnthropicStructuredProvider({
    client: { messages: { async parse() { return { parsed_output: null }; } } },
  });

  await assert.rejects(
    provider.generateStructured({ prompt: "x", schema: { type: "object" } }),
    { code: "INVALID_PROVIDER_OUTPUT" },
  );
});

test("OpenAI provider returns vectors in source input order", async () => {
  let request;
  const provider = createOpenAiEmbeddingProvider({
    model: "embedding-test",
    dimensions: 3,
    client: {
      embeddings: {
        async create(payload) {
          request = payload;
          return {
            model: "embedding-test",
            data: [
              { index: 1, embedding: [0, 1, 0] },
              { index: 0, embedding: [1, 0, 0] },
            ],
            usage: { prompt_tokens: 7, total_tokens: 7 },
            _request_id: "openai-request",
          };
        },
      },
    },
  });

  const response = await provider.embed(["satu", "dua"]);

  assert.equal(request.encoding_format, "float");
  assert.equal(request.dimensions, 3);
  assert.deepEqual(response.vectors, [[1, 0, 0], [0, 1, 0]]);
  assert.equal(response.usage.inputTokens, 7);
});

test("environment validation keeps AI optional until an AI task explicitly requires it", () => {
  const base = { DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret" };
  assert.equal(validateEnvironment(base).valid, true);
  const required = validateEnvironment(base, { requireAiProviders: true });
  assert.equal(required.valid, false);
  assert.match(required.errors.join(" "), /ANTHROPIC_API_KEY/);
  assert.match(required.errors.join(" "), /OPENAI_API_KEY/);
});

test("environment validation rejects an invalid embedding dimension", () => {
  const result = validateEnvironment({
    DATABASE_URL: "postgresql://example",
    AUTH_SECRET: "secret",
    OPENAI_EMBEDDING_DIMENSIONS: "zero",
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /OPENAI_EMBEDDING_DIMENSIONS/);
});

test("environment validation rejects a half-configured Trigger worker", () => {
  const result = validateEnvironment({
    DATABASE_URL: "postgresql://example",
    AUTH_SECRET: "secret",
    TRIGGER_PROJECT_ID: "proj_example",
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /TRIGGER_PROJECT_ID and TRIGGER_SECRET_KEY/);
});

test("environment validation accepts AI_PROVIDER=zai and warns without ZAI_API_KEY", () => {
  const base = { DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret", AI_PROVIDER: "zai" };
  const result = validateEnvironment(base);
  assert.equal(result.valid, true);
  assert.match(result.warnings.join(" "), /AI_PROVIDER=zai requires ZAI_API_KEY/);
});

test("environment validation is satisfied once AI_PROVIDER=zai has ZAI_API_KEY", () => {
  const result = validateEnvironment({ DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret", AI_PROVIDER: "zai", ZAI_API_KEY: "key" });
  assert.doesNotMatch(result.warnings.join(" "), /ZAI_API_KEY/);
});

test("environment validation rejects claude-max-agent even when zai is otherwise available", () => {
  const result = validateEnvironment({ DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret", AI_PROVIDER: "claude-max-agent", ZAI_API_KEY: "key" });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /claude-max-agent has no deployable runtime/);
});

test("environment validation accepts AI_PROVIDER=gemini and warns without GEMINI_API_KEY", () => {
  const base = { DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret", AI_PROVIDER: "gemini" };
  const result = validateEnvironment(base);
  assert.equal(result.valid, true);
  assert.match(result.warnings.join(" "), /AI_PROVIDER=gemini requires GEMINI_API_KEY/);
});

test("environment validation is satisfied once AI_PROVIDER=gemini has GEMINI_API_KEY", () => {
  const result = validateEnvironment({ DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret", AI_PROVIDER: "gemini", GEMINI_API_KEY: "key" });
  assert.doesNotMatch(result.warnings.join(" "), /GEMINI_API_KEY/);
});

test("environment validation rejects an unknown AI_PROVIDER value", () => {
  const result = validateEnvironment({ DATABASE_URL: "postgresql://example", AUTH_SECRET: "secret", AI_PROVIDER: "some-other-runtime" });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /AI_PROVIDER "some-other-runtime" is not supported/);
});
