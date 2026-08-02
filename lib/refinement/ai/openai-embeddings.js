import OpenAI from "openai";
import { AiProviderError } from "./errors.js";

export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

function normalizeInputs(input) {
  const values = Array.isArray(input) ? input : [input];
  if (values.length === 0 || values.length > 2_048) {
    throw new AiProviderError("INVALID_INPUT", "input must contain between 1 and 2048 text values.");
  }
  return values.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new AiProviderError("INVALID_INPUT", "Each embedding input must be non-empty text.");
    }
    return value.trim();
  });
}

function normalizeDimensions(dimensions) {
  if (dimensions === undefined || dimensions === null || dimensions === "") return undefined;
  const parsed = Number(dimensions);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3_072) {
    throw new AiProviderError("INVALID_INPUT", "embedding dimensions must be an integer between 1 and 3072.");
  }
  return parsed;
}

/**
 * Creates the only OpenAI embedding entry point used by Refinement. Vectors
 * remain provider output until a later source-section workflow persists them.
 */
export function createOpenAiEmbeddingProvider({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL,
  dimensions = process.env.OPENAI_EMBEDDING_DIMENSIONS,
  client,
} = {}) {
  if (!client && (!apiKey || apiKey.trim() === "")) {
    throw new AiProviderError("AI_PROVIDER_NOT_CONFIGURED", "OPENAI_API_KEY is required.");
  }

  const openai = client ?? new OpenAI({ apiKey });

  return {
    provider: "OPENAI",
    model,
    async embed(input) {
      const values = normalizeInputs(input);
      if (typeof model !== "string" || model.trim() === "") {
        throw new AiProviderError("INVALID_INPUT", "OpenAI embedding model is required.");
      }
      const requestedDimensions = normalizeDimensions(dimensions);

      const response = await openai.embeddings.create({
        model: model.trim(),
        input: values,
        encoding_format: "float",
        ...(requestedDimensions ? { dimensions: requestedDimensions } : {}),
      });
      const data = [...(response.data ?? [])].sort((left, right) => left.index - right.index);
      if (data.length !== values.length || data.some((item) => !Array.isArray(item.embedding) || item.embedding.length === 0)) {
        throw new AiProviderError("INVALID_PROVIDER_OUTPUT", "OpenAI returned an invalid embedding response.");
      }

      return {
        vectors: data.map((item) => item.embedding),
        model: response.model ?? model.trim(),
        requestId: response._request_id ?? null,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          totalTokens: response.usage?.total_tokens ?? null,
        },
      };
    },
  };
}
