import { AiServiceError } from './errors.js';

// Per-user request ceiling. Counting AiUsage rows keeps the limit correct
// across Vercel instances, unlike an in-memory counter. It counts completed
// requests, so a simultaneous burst can slightly overshoot; the purpose is to
// stop runaway usage, not to be an exact gate.
export async function assertChatRateLimit({ db, actor, limitPerMinute, windowMs = 60_000 }) {
  if (!actor?.id || !limitPerMinute) return;
  try {
    const used = await db.aiUsage.count({
      where: { userId: actor.id, feature: 'CHATBOT', createdAt: { gte: new Date(Date.now() - windowMs) } }
    });
    if (used >= limitPerMinute) {
      throw new AiServiceError('AI_RATE_LIMITED', `Chat rate limit of ${limitPerMinute}/min reached for user ${actor.id}.`);
    }
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    // A counting failure must not take the feature down.
    console.error('[ai:rate-limit] failed to count recent usage', error);
  }
}
