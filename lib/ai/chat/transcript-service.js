import { db as defaultDb } from '../../db.js';
import { can, Permission } from '../../authorization/permissions.js';

// A UAT-quality and audit log of chatbot exchanges, separate from AiUsage: the
// usage record is the metered-cost record and never holds question/answer
// text, so this is the only place the literal conversation is persisted.
//
// Writes are best-effort. A transcript failure must never take the chatbot
// down or change what the caller receives, so every write is wrapped and
// swallowed like lib/ai/telemetry.js does for AiUsage/AiEvent.

const MAX_STORED_LENGTH = 4_000;

function truncate(text) {
  return typeof text === 'string' ? text.slice(0, MAX_STORED_LENGTH) : '';
}

export async function appendChatTranscript({
  db = defaultDb,
  conversationId,
  actor,
  businessUnitId = null,
  question,
  answer,
  mode,
  dataAvailable,
  inScope,
  topics = [],
  references = []
} = {}) {
  if (!conversationId || !actor?.id) return null;
  try {
    await db.aiChatConversation.upsert({
      where: { id: conversationId },
      // A conversation belongs to whoever started it; a later turn never
      // reassigns ownership even if the same id were replayed by another actor.
      create: { id: conversationId, userId: actor.id, businessUnitId },
      update: { lastMessageAt: new Date() }
    });
    return await db.aiChatMessage.create({
      data: {
        conversationId,
        question: truncate(question),
        answer: truncate(answer),
        mode: mode || 'AI',
        dataAvailable: Boolean(dataAvailable),
        inScope: Boolean(inScope),
        topicsJson: topics,
        referencesJson: references
      }
    });
  } catch (error) {
    console.error('[ai:transcript] failed to record chat transcript', error);
    return null;
  }
}

function canViewOthers(actor) {
  return can(actor, Permission.ACTIVITY_LOG_VIEW);
}

// Everyone with chatbot access can list their own conversations; only the
// audit-visibility roles can list another user's.
export async function listChatConversations(actor, { db = defaultDb, userId = null, limit = 50 } = {}) {
  const targetUserId = userId && canViewOthers(actor) ? userId : actor.id;
  return db.aiChatConversation.findMany({
    where: { userId: targetUserId },
    select: {
      id: true, startedAt: true, lastMessageAt: true, businessUnitId: true,
      user: { select: { id: true, name: true } },
      _count: { select: { messages: true } }
    },
    orderBy: { lastMessageAt: 'desc' },
    take: limit
  });
}

export async function getChatConversation(actor, conversationId, { db = defaultDb } = {}) {
  const conversation = await db.aiChatConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true, userId: true, businessUnitId: true, startedAt: true, lastMessageAt: true,
      user: { select: { id: true, name: true } },
      messages: {
        select: { id: true, question: true, answer: true, mode: true, dataAvailable: true, inScope: true, topicsJson: true, referencesJson: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  if (!conversation) return null;
  if (conversation.userId !== actor.id && !canViewOthers(actor)) return null;
  return conversation;
}
