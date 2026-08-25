import OpenAI from 'openai';
import { AiServiceError } from '../errors.js';
import { schemaInstruction, validateAgainstSchema } from '../schema-validator.js';
import { translateHttpError } from './translate-error.js';

// Google Gemini through its official OpenAI-compatible endpoint
// (https://ai.google.dev/gemini-api/docs/openai). Same shape as the z.ai
// provider: JSON mode only (response is valid JSON with no server-side
// guarantee it matches the requested schema), so the schema is sent as an
// instruction and the parsed result is validated here. A shape mismatch is
// retryable: re-rolling usually resolves JSON-mode drift.
//
// Chosen for a genuinely free tier (Google AI Studio, no billing account
// required to start) rather than lower cost alone -- see docs/TECHNICAL-GUIDE.md
// for the free-tier data-usage tradeoff this implies.

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
export const GEMINI_DEFAULT_MODEL = 'gemini-3.7-flash';

const HEALTH_CHECK_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string' } }
});

// Models frequently wrap JSON in a fenced block despite being told not to.
function parseJsonPayload(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!text) throw new AiServiceError('AI_INVALID_OUTPUT', 'Gemini returned an empty response.', { retryable: true });
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AiServiceError('AI_INVALID_OUTPUT', 'Gemini returned a response that is not valid JSON.', { cause: error, retryable: true });
  }
}

function usageDto(usage) {
  return {
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null
  };
}

export function createGeminiProvider({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL,
  baseUrl = process.env.GEMINI_BASE_URL?.trim() || GEMINI_DEFAULT_BASE_URL,
  timeoutMs = 45_000,
  maxRetries = 2,
  client
} = {}) {
  if (!client && !apiKey?.trim()) {
    throw new AiServiceError('AI_NOT_CONFIGURED', 'GEMINI_API_KEY is required for the gemini provider.');
  }

  const openai = client ?? new OpenAI({ apiKey, baseURL: baseUrl, timeout: timeoutMs, maxRetries });

  async function generateStructured({ system, prompt, schema, maxTokens = 16_000 }) {
    if (typeof prompt !== 'string' || !prompt.trim()) throw new AiServiceError('AI_INVALID_INPUT', 'prompt is required.');
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new AiServiceError('AI_INVALID_INPUT', 'schema must be a JSON Schema object.');
    if (!Number.isInteger(maxTokens) || maxTokens < 1) throw new AiServiceError('AI_INVALID_INPUT', 'maxTokens must be a positive integer.');

    let response;
    try {
      response = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        // JSON mode. The schema itself travels in the system message because
        // Gemini's OpenAI-compatible layer does not accept one for
        // server-side enforcement through this basic response_format.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: [system, schemaInstruction(schema)].filter(Boolean).join('\n\n') },
          { role: 'user', content: prompt }
        ]
      });
    } catch (error) {
      throw translateHttpError(error, 'Gemini');
    }

    const value = parseJsonPayload(response?.choices?.[0]?.message?.content);
    const { valid, errors } = validateAgainstSchema(value, schema);
    if (!valid) {
      // Schema errors describe our own contract, not provider internals, so
      // they are safe to log and useful when tuning a prompt.
      throw new AiServiceError('AI_INVALID_OUTPUT', `Gemini output did not match the requested schema: ${errors.slice(0, 5).join('; ')}`, { retryable: true });
    }

    return {
      value,
      model: response.model || model,
      requestId: response.id ?? null,
      usage: usageDto(response.usage)
    };
  }

  return {
    id: 'gemini',
    // Pay-per-token API with a genuinely free tier: the product intended for
    // application use, per docs.
    productionReady: true,
    telemetryProvider: 'GEMINI',
    model,
    generateStructured,

    async healthCheck() {
      const startedAt = Date.now();
      try {
        const result = await generateStructured({
          system: 'Reply with the single word ok as the status value.',
          prompt: 'Health check.',
          schema: HEALTH_CHECK_SCHEMA,
          maxTokens: 64
        });
        return { ok: true, provider: 'gemini', model: result.model || model, latencyMs: Date.now() - startedAt, error: null };
      } catch (error) {
        const translated = translateHttpError(error, 'Gemini');
        return { ok: false, provider: 'gemini', model, latencyMs: Date.now() - startedAt, error: translated.code };
      }
    }
  };
}
