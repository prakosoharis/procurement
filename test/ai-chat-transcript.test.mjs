import assert from "node:assert/strict";
import test from "node:test";
import { appendChatTranscript, getChatConversation, listChatConversations } from "../lib/ai/chat/transcript-service.js";

const owner = { id: "user-owner", role: "BUSINESS_UNIT_PIC", businessUnitId: "bu-smi", businessUnitScopes: [] };
const otherPic = { id: "user-other", role: "BUSINESS_UNIT_PIC", businessUnitId: "bu-sun", businessUnitScopes: [] };
const superuser = { id: "user-admin", role: "SUPER_USER", businessUnitId: null, businessUnitScopes: [] };
const procurement = { id: "user-cg", role: "CORPORATE_GOVERNANCE", businessUnitId: null, businessUnitScopes: [] };

function fakeDb() {
  const state = { conversations: [], messages: [] };
  return {
    state,
    aiChatConversation: {
      upsert: async ({ where, create, update }) => {
        const existing = state.conversations.find((c) => c.id === where.id);
        if (existing) { Object.assign(existing, update); return existing; }
        const created = { ...create, startedAt: new Date(), lastMessageAt: new Date() };
        state.conversations.push(created);
        return created;
      },
      findMany: async ({ where, orderBy, take }) => {
        let rows = state.conversations.filter((c) => c.userId === where.userId);
        if (orderBy?.lastMessageAt === "desc") rows = [...rows].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        return rows.slice(0, take).map((c) => ({ ...c, user: { id: c.userId, name: "Someone" }, _count: { messages: state.messages.filter((m) => m.conversationId === c.id).length } }));
      },
      findUnique: async ({ where }) => {
        const conversation = state.conversations.find((c) => c.id === where.id);
        if (!conversation) return null;
        return { ...conversation, user: { id: conversation.userId, name: "Someone" }, messages: state.messages.filter((m) => m.conversationId === conversation.id) };
      },
    },
    aiChatMessage: {
      create: async ({ data }) => { const message = { id: `msg-${state.messages.length + 1}`, createdAt: new Date(), ...data }; state.messages.push(message); return message; },
    },
  };
}

// --- Writing -----------------------------------------------------------------

test("a conversation is created lazily on the first message", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, businessUnitId: "bu-smi", question: "q1", answer: "a1", mode: "AI", dataAvailable: true, inScope: true, topics: ["repository"], references: [] });

  assert.equal(db.state.conversations.length, 1);
  assert.equal(db.state.conversations[0].userId, owner.id);
  assert.equal(db.state.messages.length, 1);
  assert.equal(db.state.messages[0].question, "q1");
});

test("a second call with the same id appends without creating a new conversation", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q1", answer: "a1", mode: "AI", dataAvailable: true, inScope: true });
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q2", answer: "a2", mode: "AI", dataAvailable: true, inScope: true });

  assert.equal(db.state.conversations.length, 1);
  assert.equal(db.state.messages.length, 2);
});

test("missing conversationId or actor is a no-op rather than an error", async () => {
  const db = fakeDb();
  assert.equal(await appendChatTranscript({ db, actor: owner, question: "q" }), null);
  assert.equal(await appendChatTranscript({ db, conversationId: "c", question: "q" }), null);
  assert.equal(db.state.conversations.length, 0);
});

test("a write failure is swallowed and returns null rather than throwing", async () => {
  const db = fakeDb();
  db.aiChatConversation.upsert = async () => { throw new Error("db down"); };
  const result = await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q", answer: "a", mode: "AI", dataAvailable: true, inScope: true });
  assert.equal(result, null);
});

// --- Reading: ownership and audit visibility --------------------------------

test("a user can list their own conversations", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q", answer: "a", mode: "AI", dataAvailable: true, inScope: true });
  const rows = await listChatConversations(owner, { db });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "conv-1");
});

test("a Business Unit user cannot list another user's conversations by passing their id", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-owner", actor: owner, question: "q", answer: "a", mode: "AI", dataAvailable: true, inScope: true });
  await appendChatTranscript({ db, conversationId: "conv-other", actor: otherPic, question: "q", answer: "a", mode: "AI", dataAvailable: true, inScope: true });

  // Requesting someone else's userId without audit visibility silently falls
  // back to the caller's own conversations rather than leaking another user's.
  const rows = await listChatConversations(otherPic, { db, userId: owner.id });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "conv-other");
});

test("Superuser can list another user's conversations", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-owner", actor: owner, question: "q", answer: "a", mode: "AI", dataAvailable: true, inScope: true });
  const rows = await listChatConversations(superuser, { db, userId: owner.id });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "conv-owner");
});

test("Tim Procurement can list another user's conversations", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-owner", actor: owner, question: "q", answer: "a", mode: "AI", dataAvailable: true, inScope: true });
  const rows = await listChatConversations(procurement, { db, userId: owner.id });
  assert.equal(rows.length, 1);
});

test("a user can read their own conversation detail with its messages", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q1", answer: "a1", mode: "AI", dataAvailable: true, inScope: true });
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q2", answer: "a2", mode: "AI", dataAvailable: true, inScope: true });

  const conversation = await getChatConversation(owner, "conv-1", { db });
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].question, "q1");
});

test("another Business Unit user cannot read someone else's conversation detail", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q1", answer: "a1", mode: "AI", dataAvailable: true, inScope: true });
  assert.equal(await getChatConversation(otherPic, "conv-1", { db }), null);
});

test("Superuser can read any conversation detail", async () => {
  const db = fakeDb();
  await appendChatTranscript({ db, conversationId: "conv-1", actor: owner, question: "q1", answer: "a1", mode: "AI", dataAvailable: true, inScope: true });
  const conversation = await getChatConversation(superuser, "conv-1", { db });
  assert.equal(conversation.messages.length, 1);
});

test("reading an unknown conversation id returns null", async () => {
  const db = fakeDb();
  assert.equal(await getChatConversation(owner, "does-not-exist", { db }), null);
});
