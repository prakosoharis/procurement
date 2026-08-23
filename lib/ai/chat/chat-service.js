import { db as defaultDb } from '../../db.js';
import { aiConfig } from '../config.js';
import { AiServiceError, assertText } from '../errors.js';
import { assertChatRateLimit } from '../rate-limit.js';
import { recordAiEvent } from '../telemetry.js';
import { effectiveBusinessUnitIds } from '../../authorization/scope.js';
import { buildChatContext } from './context-builder.js';
import { classifyChatScope, OUT_OF_SCOPE_ANSWER } from './scope-classifier.js';
import { retrieveForTopics } from './retrievers/index.js';

// Orchestrates one chatbot answer. The order is fixed and must not be
// rearranged: authenticate, rate limit, classify, retrieve under the actor's
// scope, build context, only then call the model.

const MAX_QUESTION_LENGTH = 2_000;
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_CONTENT = 1_000;

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((turn) => turn && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.content === 'string')
    .slice(-MAX_HISTORY_TURNS)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, MAX_HISTORY_CONTENT) }));
}

export async function answerChatQuestion({
  actor,
  question,
  history = [],
  db = defaultDb,
  aiService,
  environment = process.env,
  config = aiConfig(environment),
  telemetry = { recordAiEvent }
} = {}) {
  if (!actor?.id) throw new AiServiceError('AI_INVALID_INPUT', 'An authenticated actor is required.');

  const text = assertText(question, 'question');
  if (text.length > MAX_QUESTION_LENGTH) {
    throw new AiServiceError('AI_INVALID_INPUT', `question must be at most ${MAX_QUESTION_LENGTH} characters.`);
  }

  await assertChatRateLimit({ db, actor, limitPerMinute: config.chatRateLimitPerMinute });

  const businessUnitId = effectiveBusinessUnitIds(actor)[0] || null;
  const classification = classifyChatScope(text);

  // An out-of-scope question is answered deterministically and never reaches
  // the provider, so it costs nothing and cannot be argued past.
  if (!classification.inScope) {
    if (telemetry?.recordAiEvent) {
      await telemetry.recordAiEvent({
        db, userId: actor.id, businessUnitId, feature: 'CHATBOT',
        eventType: 'BLOCKED_SCOPE', reason: classification.reason
      });
    }
    return { answer: OUT_OF_SCOPE_ANSWER, dataAvailable: false, references: [], inScope: false, topics: [] };
  }

  const results = await retrieveForTopics({ actor, db, topics: classification.topics });
  const built = buildChatContext({ results, maxContextTokens: config.maxContextTokens });

  // State the retrieval outcome explicitly. Without it the model cannot tell
  // "no records exist" from "retrieval did not run", and would report a real
  // zero result as missing data.
  const searchSummary = JSON.stringify({
    topicsSearched: classification.topics,
    recordsFound: built.recordCount,
    recordsOmittedForSize: built.droppedCount,
    topicsFailed: built.failedTopics
  });
  const context = [`## ringkasan_pencarian\n${searchSummary}`, built.context].filter(Boolean).join('\n\n');

  const answer = await aiService.chat({
    actor,
    question: text,
    context,
    history: normalizeHistory(history),
    businessUnitId
  });

  return { ...answer, inScope: true, topics: classification.topics, contextRecordCount: built.recordCount };
}
