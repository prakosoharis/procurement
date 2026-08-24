-- Additive: adds AiChatConversation and AiChatMessage. Separate from AiUsage,
-- which is the metered-cost record and never holds question/answer text --
-- these two hold the literal chatbot conversation for UAT-quality review and
-- audit trail. No existing table or row changes.

CREATE TABLE "AiChatConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "dataAvailable" BOOLEAN NOT NULL,
    "inScope" BOOLEAN NOT NULL,
    "topicsJson" JSONB,
    "referencesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiChatConversation_userId_idx" ON "AiChatConversation"("userId");
CREATE INDEX "AiChatConversation_businessUnitId_idx" ON "AiChatConversation"("businessUnitId");
CREATE INDEX "AiChatConversation_lastMessageAt_idx" ON "AiChatConversation"("lastMessageAt");

CREATE INDEX "AiChatMessage_conversationId_idx" ON "AiChatMessage"("conversationId");
CREATE INDEX "AiChatMessage_createdAt_idx" ON "AiChatMessage"("createdAt");

ALTER TABLE "AiChatConversation" ADD CONSTRAINT "AiChatConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatConversation" ADD CONSTRAINT "AiChatConversation_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiChatMessage" ADD CONSTRAINT "AiChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
