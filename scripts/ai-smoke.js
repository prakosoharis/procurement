const { createAnthropicStructuredProvider } = require("../lib/refinement/ai/anthropic-structured.js");
const { createOpenAiEmbeddingProvider } = require("../lib/refinement/ai/openai-embeddings.js");
const { validateEnvironment } = require("../lib/refinement/ai/environment.js");

const environment = validateEnvironment(process.env, { requireAiProviders: true });
if (!environment.valid) {
  for (const error of environment.errors) console.error(`Environment error: ${error}`);
  process.exitCode = 1;
} else {
  Promise.all([
    createAnthropicStructuredProvider().generateStructured({
      system: "Return only the requested structured result.",
      prompt: "Confirm that the Refinement provider smoke test is ready.",
      schema: {
        type: "object",
        properties: { status: { type: "string" } },
        required: ["status"],
        additionalProperties: false,
      },
      maxTokens: 128,
    }),
    createOpenAiEmbeddingProvider().embed("Procurement Governance Hub Refinement smoke test"),
  ])
    .then(([structured, embeddings]) => {
      if (typeof structured.value.status !== "string" || embeddings.vectors.length !== 1) {
        throw new Error("AI provider smoke responses did not satisfy the expected contract.");
      }
      console.log("AI provider smoke test passed: structured output and embeddings are available.");
    })
    .catch((error) => {
      console.error("AI provider smoke test failed.", error.message);
      process.exitCode = 1;
    });
}
