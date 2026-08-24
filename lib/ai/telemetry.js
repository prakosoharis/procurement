import { db as defaultDb } from '../db.js';

// Every AI call is recorded on AiUsage, and notable conditions on AiEvent, so
// pre-production usage stays measurable under future metered billing. Telemetry
// never blocks or fails a feature: a write error is logged and swallowed.

// USD per 1,000,000 tokens. Update PRICING_VERSION whenever a rate changes so
// historical rows stay interpretable.
export const PRICING_VERSION = '2026-06-24';

const pricing = Object.freeze({
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 }
});

export function estimateCost({ model, inputTokens, outputTokens }) {
  const rate = pricing[model];
  if (!rate) return { estimatedCost: null, pricingInputRate: null, pricingOutputRate: null };
  const input = Number(inputTokens) || 0;
  const output = Number(outputTokens) || 0;
  const cost = (input / 1_000_000) * rate.input + (output / 1_000_000) * rate.output;
  return {
    estimatedCost: cost.toFixed(10),
    pricingInputRate: rate.input.toFixed(10),
    pricingOutputRate: rate.output.toFixed(10)
  };
}

export async function recordAiUsage({
  db = defaultDb,
  userId = null,
  businessUnitId = null,
  feature,
  provider,
  model,
  promptVersion = null,
  requestTimestamp,
  responseTimestamp = new Date(),
  usage = {},
  success,
  errorType = null,
  fallbackUsed = false,
  refinementJobId = null
} = {}) {
  try {
    const inputTokens = usage.inputTokens ?? null;
    const outputTokens = usage.outputTokens ?? null;
    const cost = estimateCost({ model, inputTokens, outputTokens });
    return await db.aiUsage.create({
      data: {
        userId,
        businessUnitId,
        feature,
        provider,
        model,
        promptVersion,
        requestTimestamp,
        responseTimestamp,
        latencyMs: Math.max(0, responseTimestamp.getTime() - requestTimestamp.getTime()),
        inputTokens,
        outputTokens,
        totalTokens: inputTokens !== null || outputTokens !== null ? (inputTokens || 0) + (outputTokens || 0) : null,
        estimatedCost: cost.estimatedCost,
        pricingVersion: cost.estimatedCost ? PRICING_VERSION : null,
        pricingInputRate: cost.pricingInputRate,
        pricingOutputRate: cost.pricingOutputRate,
        success,
        errorType,
        fallbackUsed,
        refinementJobId
      }
    });
  } catch (error) {
    console.error('[ai:telemetry] failed to record AiUsage', error);
    return null;
  }
}

export async function recordAiEvent({
  db = defaultDb,
  aiUsageId = null,
  userId = null,
  businessUnitId = null,
  feature,
  eventType,
  provider = null,
  model = null,
  reason = null,
  metadata = null
} = {}) {
  try {
    return await db.aiEvent.create({
      data: { aiUsageId, userId, businessUnitId, feature, eventType, provider, model, reason, metadataJson: metadata }
    });
  } catch (error) {
    console.error('[ai:telemetry] failed to record AiEvent', error);
    return null;
  }
}
