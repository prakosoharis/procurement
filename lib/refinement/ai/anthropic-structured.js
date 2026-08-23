import Anthropic from "@anthropic-ai/sdk";
import { AiProviderError, assertNonEmptyText } from "./errors.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";
// Non-streaming ceiling. Larger outputs need a streaming request, which this
// structured-output entry point deliberately does not implement.
export const MAX_STRUCTURED_OUTPUT_TOKENS = 16_000;
const EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

function usageDto(usage) {
  return {
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
  };
}

/**
 * Creates the only Anthropic entry point used by Refinement. Callers provide a
 * JSON schema and receive parsed data; provider response text is never treated
 * as an authoritative finding by this foundation layer.
 */
export function createAnthropicStructuredProvider({
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
  client,
} = {}) {
  if (!client && (!apiKey || apiKey.trim() === "")) {
    throw new AiProviderError("AI_PROVIDER_NOT_CONFIGURED", "ANTHROPIC_API_KEY is required.");
  }

  const anthropic = client ?? new Anthropic({ apiKey });

  return {
    provider: "ANTHROPIC",
    model,
    async generateStructured({ system, prompt, schema, maxTokens = MAX_STRUCTURED_OUTPUT_TOKENS, effort, thinking = { type: "adaptive" } }) {
      const requestModel = assertNonEmptyText(model, "Anthropic model");
      const requestPrompt = assertNonEmptyText(prompt, "prompt");
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        throw new AiProviderError("INVALID_INPUT", "schema must be a JSON Schema object.");
      }
      if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_STRUCTURED_OUTPUT_TOKENS) {
        throw new AiProviderError("INVALID_INPUT", `maxTokens must be an integer between 1 and ${MAX_STRUCTURED_OUTPUT_TOKENS}.`);
      }
      if (effort !== undefined && !EFFORT_LEVELS.has(effort)) {
        throw new AiProviderError("INVALID_INPUT", "effort must be low, medium, high, xhigh, or max.");
      }

      const response = await anthropic.messages.parse({
        model: requestModel,
        max_tokens: maxTokens,
        ...(system ? { system: assertNonEmptyText(system, "system") } : {}),
        messages: [{ role: "user", content: requestPrompt }],
        ...(thinking ? { thinking } : {}),
        output_config: { format: { type: "json_schema", schema }, ...(effort ? { effort } : {}) },
      });

      if (response.parsed_output === null || response.parsed_output === undefined) {
        throw new AiProviderError("INVALID_PROVIDER_OUTPUT", "Anthropic returned no parsed structured output.");
      }

      return {
        value: response.parsed_output,
        model: response.model ?? requestModel,
        requestId: response._request_id ?? null,
        usage: usageDto(response.usage),
      };
    },
  };
}
