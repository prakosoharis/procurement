import { aiConfig } from './config.js';
import { AiServiceError } from './errors.js';
import { AiFeatureFlag, isAiFeatureEnabled } from './feature-flags.js';
import { getAiProvider } from './provider-factory.js';
import { CHAT_RESPONSE_SCHEMA, REFINEMENT_RESPONSE_SCHEMA } from './schemas.js';
import { buildChatPrompt, CHAT_PROMPT_VERSION, CHAT_SYSTEM_PROMPT } from './prompts/chat.v3.js';
import { buildRefinementPrompt, REFINEMENT_PROMPT_VERSION, REFINEMENT_SYSTEM_PROMPT } from './prompts/refinement.v1.js';
import { recordAiEvent, recordAiUsage } from './telemetry.js';

// The only surface Chatbot and Refinement are allowed to call. It owns the
// prompts, the output schemas, retry policy, and telemetry; the provider owns
// nothing but transport. Prompts are therefore never duplicated per provider.

const MAX_ATTEMPTS = 2;

function assertShape(value, requiredKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiServiceError('AI_INVALID_OUTPUT', 'Provider returned a non-object payload.');
  }
  for (const key of requiredKeys) {
    if (!(key in value)) throw new AiServiceError('AI_INVALID_OUTPUT', `Provider output is missing "${key}".`);
  }
  return value;
}

export function createAiService({
  provider,
  environment = process.env,
  config = aiConfig(environment),
  db,
  telemetry = { recordAiUsage, recordAiEvent }
} = {}) {
  // Resolved lazily so importing this module never requires credentials.
  let resolved = provider ?? null;
  const activeProvider = () => (resolved ??= getAiProvider({ environment, config }));

  function requireFeature(flag) {
    if (!isAiFeatureEnabled(flag, environment)) {
      throw new AiServiceError('AI_DISABLED', `${flag} is turned off in this environment.`);
    }
  }

  async function run({ feature, flag, promptVersion, system, prompt, schema, effort, maxTokens, actor, businessUnitId, refinementJobId }) {
    requireFeature(flag);
    const instance = activeProvider();
    const requestTimestamp = new Date();
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await instance.generateStructured({ system, prompt, schema, effort, maxTokens });
        await telemetry.recordAiUsage({
          db, userId: actor?.id ?? null, businessUnitId: businessUnitId ?? null, feature,
          provider: instance.telemetryProvider, model: result.model || instance.model,
          promptVersion, requestTimestamp, usage: result.usage || {}, success: true, refinementJobId
        });
        return result;
      } catch (error) {
        lastError = error instanceof AiServiceError ? error : new AiServiceError('AI_PROVIDER_UNAVAILABLE', error?.message || 'Provider failure.', { cause: error });
        if (lastError.eventType) {
          await telemetry.recordAiEvent({
            db, userId: actor?.id ?? null, businessUnitId: businessUnitId ?? null, feature,
            eventType: lastError.eventType, provider: instance.telemetryProvider, model: instance.model,
            reason: lastError.code, metadata: { attempt }
          });
        }
        // Retry only transport-level failures, and only once.
        if (!lastError.retryable || attempt === MAX_ATTEMPTS) break;
        await telemetry.recordAiEvent({
          db, userId: actor?.id ?? null, businessUnitId: businessUnitId ?? null, feature,
          eventType: 'RETRY', provider: instance.telemetryProvider, model: instance.model,
          reason: lastError.code, metadata: { attempt }
        });
      }
    }

    await telemetry.recordAiUsage({
      db, userId: actor?.id ?? null, businessUnitId: businessUnitId ?? null, feature,
      provider: instance.telemetryProvider, model: instance.model, promptVersion,
      requestTimestamp, usage: {}, success: false, errorType: lastError.code, refinementJobId
    });
    throw lastError;
  }

  return {
    get providerId() { return activeProvider().id; },

    async chat({ actor, question, context = '', history = [], businessUnitId = null } = {}) {
      const result = await run({
        feature: 'CHATBOT',
        flag: AiFeatureFlag.CHAT,
        promptVersion: CHAT_PROMPT_VERSION,
        system: CHAT_SYSTEM_PROMPT,
        prompt: buildChatPrompt({ question, context, history }),
        schema: CHAT_RESPONSE_SCHEMA,
        effort: 'medium',
        maxTokens: 4_000,
        actor,
        businessUnitId
      });
      const value = assertShape(result.value, ['answer', 'dataAvailable']);
      return { answer: value.answer, dataAvailable: Boolean(value.dataAvailable), references: Array.isArray(value.references) ? value.references : [] };
    },

    async analyzeRefinement({ actor, sopContext, sourceContext, scopeNote = null, businessUnitId = null, refinementJobId = null } = {}) {
      const result = await run({
        feature: 'REFINEMENT',
        flag: AiFeatureFlag.REFINEMENT,
        promptVersion: REFINEMENT_PROMPT_VERSION,
        system: REFINEMENT_SYSTEM_PROMPT,
        prompt: buildRefinementPrompt({ sopContext, sourceContext, scopeNote }),
        schema: REFINEMENT_RESPONSE_SCHEMA,
        effort: 'high',
        maxTokens: 16_000,
        actor,
        businessUnitId,
        refinementJobId
      });
      const value = assertShape(result.value, ['summary', 'findings']);
      if (!Array.isArray(value.findings)) throw new AiServiceError('AI_INVALID_OUTPUT', 'Provider returned a non-array findings value.');
      return { summary: value.summary, findings: value.findings, model: result.model, usage: result.usage, promptVersion: REFINEMENT_PROMPT_VERSION };
    },

    async healthCheck() {
      const instance = activeProvider();
      const health = await instance.healthCheck();
      return {
        ...health,
        productionReady: instance.productionReady,
        chatEnabled: isAiFeatureEnabled(AiFeatureFlag.CHAT, environment),
        refinementEnabled: isAiFeatureEnabled(AiFeatureFlag.REFINEMENT, environment)
      };
    }
  };
}
