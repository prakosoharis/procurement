import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicStructuredProvider, DEFAULT_ANTHROPIC_MODEL } from '../../refinement/ai/anthropic-structured.js';
import { AiServiceError } from '../errors.js';
import { translateHttpError } from './translate-error.js';

// Production provider. Uses the metered Claude Developer Platform through the
// official SDK, so it is the provider that survives the move out of UAT. It
// wraps the REF-S0 structured-output adapter rather than re-implementing it.

const HEALTH_CHECK_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string' } }
});

// The REF-S0 adapter raises its own error type; everything else is transport
// and is translated identically for every provider.
function translate(error) {
  if (error instanceof AiServiceError) return error;
  if (error?.name === 'AiProviderError') {
    if (error.code === 'INVALID_PROVIDER_OUTPUT') return new AiServiceError('AI_INVALID_OUTPUT', error.message, { cause: error });
    if (error.code === 'AI_PROVIDER_NOT_CONFIGURED') return new AiServiceError('AI_NOT_CONFIGURED', error.message, { cause: error });
    return new AiServiceError('AI_INVALID_INPUT', error.message, { cause: error });
  }
  return translateHttpError(error, 'Anthropic');
}

export function createAnthropicApiProvider({
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
  timeoutMs = 45_000,
  maxRetries = 2,
  client,
  structuredProvider
} = {}) {
  if (!structuredProvider && !client && !apiKey?.trim()) {
    throw new AiServiceError('AI_NOT_CONFIGURED', 'ANTHROPIC_API_KEY is required for the anthropic-api provider.');
  }

  const structured = structuredProvider ?? createAnthropicStructuredProvider({
    model,
    client: client ?? new Anthropic({ apiKey, timeout: timeoutMs, maxRetries })
  });

  return {
    id: 'anthropic-api',
    // Metered Anthropic API; approved for production use.
    productionReady: true,
    telemetryProvider: 'ANTHROPIC',
    model,

    async generateStructured(request) {
      try {
        return await structured.generateStructured(request);
      } catch (error) {
        throw translate(error);
      }
    },

    async healthCheck() {
      const startedAt = Date.now();
      try {
        const result = await structured.generateStructured({
          system: 'Reply with the single word ok as the status value.',
          prompt: 'Health check.',
          schema: HEALTH_CHECK_SCHEMA,
          maxTokens: 64,
          effort: 'low',
          thinking: null
        });
        return { ok: true, provider: 'anthropic-api', model: result.model || model, latencyMs: Date.now() - startedAt, error: null };
      } catch (error) {
        const translated = translate(error);
        return { ok: false, provider: 'anthropic-api', model, latencyMs: Date.now() - startedAt, error: translated.code };
      }
    }
  };
}
