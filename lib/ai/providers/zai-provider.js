import OpenAI from 'openai';
import { AiServiceError } from '../errors.js';
import { schemaInstruction, validateAgainstSchema } from '../schema-validator.js';
import { translateHttpError } from './translate-error.js';

// z.ai (GLM) through its pay-per-token API, which is OpenAI-compatible.
//
// Unlike Anthropic, z.ai offers JSON mode only — the response is valid JSON with
// no server-side guarantee it matches the requested schema. So the schema is
// sent as an instruction and the parsed result is validated here. A shape
// mismatch is retryable: re-rolling usually resolves JSON-mode drift.

export const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';
export const ZAI_DEFAULT_MODEL = 'glm-4.7';

const HEALTH_CHECK_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string' } }
});

// Models frequently wrap JSON in a fenced block despite being told not to.
function parseJsonPayload(raw) {
  const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!text) throw new AiServiceError('AI_INVALID_OUTPUT', 'z.ai returned an empty response.', { retryable: true });
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AiServiceError('AI_INVALID_OUTPUT', 'z.ai returned a response that is not valid JSON.', { cause: error, retryable: true });
  }
}

function usageDto(usage) {
  return {
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null
  };
}

export function createZaiProvider({
  apiKey = process.env.ZAI_API_KEY,
  model = process.env.ZAI_MODEL?.trim() || ZAI_DEFAULT_MODEL,
  baseUrl = process.env.ZAI_BASE_URL?.trim() || ZAI_DEFAULT_BASE_URL,
  timeoutMs = 45_000,
  maxRetries = 2,
  client
} = {}) {
  if (!client && !apiKey?.trim()) {
    throw new AiServiceError('AI_NOT_CONFIGURED', 'ZAI_API_KEY is required for the zai provider.');
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
        // z.ai does not accept one for server-side enforcement.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: [system, schemaInstruction(schema)].filter(Boolean).join('\n\n') },
          { role: 'user', content: prompt }
        ]
      });
    } catch (error) {
      throw translateHttpError(error, 'z.ai');
    }

    const value = parseJsonPayload(response?.choices?.[0]?.message?.content);
    const { valid, errors } = validateAgainstSchema(value, schema);
    if (!valid) {
      // Schema errors describe our own contract, not provider internals, so
      // they are safe to log and useful when tuning a prompt.
      throw new AiServiceError('AI_INVALID_OUTPUT', `z.ai output did not match the requested schema: ${errors.slice(0, 5).join('; ')}`, { retryable: true });
    }

    return {
      value,
      model: response.model || model,
      requestId: response.id ?? null,
      usage: usageDto(response.usage)
    };
  }

  return {
    id: 'zai',
    // Pay-per-token API: the product intended for application use.
    productionReady: true,
    telemetryProvider: 'ZAI',
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
        return { ok: true, provider: 'zai', model: result.model || model, latencyMs: Date.now() - startedAt, error: null };
      } catch (error) {
        const translated = translateHttpError(error, 'z.ai');
        return { ok: false, provider: 'zai', model, latencyMs: Date.now() - startedAt, error: translated.code };
      }
    }
  };
}
