import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicStructuredProvider, DEFAULT_ANTHROPIC_MODEL } from '../../refinement/ai/anthropic-structured.js';
import { AiServiceError } from '../errors.js';

// Production provider. Uses the metered Claude Developer Platform through the
// official SDK, so it is the provider that survives the move out of UAT. It
// wraps the REF-S0 structured-output adapter rather than re-implementing it.

const HEALTH_CHECK_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string' } }
});

// The SDK exposes a numeric `status` on every API error; branch on that rather
// than on message text, and keep provider detail out of the thrown error.
function translate(error) {
  if (error instanceof AiServiceError) return error;

  if (error?.name === 'AiProviderError') {
    if (error.code === 'INVALID_PROVIDER_OUTPUT') return new AiServiceError('AI_INVALID_OUTPUT', error.message, { cause: error });
    if (error.code === 'AI_PROVIDER_NOT_CONFIGURED') return new AiServiceError('AI_NOT_CONFIGURED', error.message, { cause: error });
    return new AiServiceError('AI_INVALID_INPUT', error.message, { cause: error });
  }

  const status = Number(error?.status);
  if (status === 401 || status === 403) return new AiServiceError('AI_AUTHENTICATION_FAILED', 'Anthropic rejected the configured credentials.', { cause: error });
  if (status === 429) return new AiServiceError('AI_RATE_LIMITED', 'Anthropic rate limit reached.', { cause: error, retryable: true });
  if (status === 400) return new AiServiceError('AI_INVALID_INPUT', error?.message || 'Anthropic rejected the request.', { cause: error });
  if (status >= 500) return new AiServiceError('AI_PROVIDER_UNAVAILABLE', 'Anthropic returned a server error.', { cause: error, retryable: true });

  const name = error?.name || '';
  if (name.includes('Timeout') || error?.code === 'ETIMEDOUT') {
    return new AiServiceError('AI_TIMEOUT', 'Anthropic request timed out.', { cause: error, retryable: true });
  }
  if (name.includes('Connection')) {
    return new AiServiceError('AI_PROVIDER_UNAVAILABLE', 'Anthropic connection failed.', { cause: error, retryable: true });
  }
  return new AiServiceError('AI_PROVIDER_UNAVAILABLE', error?.message || 'Unknown provider failure.', { cause: error });
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
