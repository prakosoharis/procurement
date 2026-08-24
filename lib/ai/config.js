// One place that reads AI environment variables. Nothing else in the AI layer
// touches process.env, so switching provider or budget stays a config change.

const DEFAULT_PROVIDER = 'anthropic-api';
const DEFAULT_MAX_CONTEXT_TOKENS = 60_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_CHAT_RATE_LIMIT = 10;
// 'ai' answers through the provider. 'data-summary' answers deterministically
// from retrieved records with no provider call, for environments without a
// funded credential.
const CHAT_MODES = new Set(['ai', 'data-summary']);

function integer(value, fallback, { min, max }) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function aiConfig(environment = process.env) {
  return {
    provider: (environment.AI_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase(),
    chatMode: CHAT_MODES.has((environment.AI_CHAT_MODE || '').trim().toLowerCase()) ? environment.AI_CHAT_MODE.trim().toLowerCase() : 'ai',
    model: environment.ANTHROPIC_MODEL?.trim() || null,
    maxContextTokens: integer(environment.AI_MAX_CONTEXT_TOKENS, DEFAULT_MAX_CONTEXT_TOKENS, { min: 1_000, max: 400_000 }),
    requestTimeoutMs: integer(environment.AI_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS, { min: 5_000, max: 300_000 }),
    chatRateLimitPerMinute: integer(environment.AI_CHAT_RATE_LIMIT_PER_MINUTE, DEFAULT_CHAT_RATE_LIMIT, { min: 1, max: 120 })
  };
}
