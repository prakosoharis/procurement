// Purges chatbot conversation transcripts older than a retention window.
//
// AiChatConversation/AiChatMessage are a UAT-quality and audit log, not a
// permanent archive: they hold literal question/answer text, so retention is
// deliberately operational and manual rather than an automatic background job.
//
// Dry-run by default, matching the pattern in organize-google-drive-sops.js:
// report what would be deleted, require --apply to actually delete.
//
//   node --env-file-if-exists=.env scripts/purge-chat-transcripts.js --days 30
//   node --env-file-if-exists=.env scripts/purge-chat-transcripts.js --days 30 --apply

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const days = Number(arg("days", "30"));
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number.");

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const candidates = await prisma.aiChatConversation.findMany({
    where: { lastMessageAt: { lt: cutoff } },
    select: { id: true, userId: true, lastMessageAt: true, _count: { select: { messages: true } } },
  });

  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      cutoff: cutoff.toISOString(),
      conversationsToDelete: candidates.length,
      messagesToDelete: candidates.reduce((total, row) => total + row._count.messages, 0),
      sample: candidates.slice(0, 10),
    }, null, 2));
    console.log("\nRe-run with --apply to delete these conversations and their messages.");
    return;
  }

  // AiChatMessage.conversationId has ON DELETE CASCADE, so deleting the
  // conversation removes its messages in the same operation.
  const result = await prisma.aiChatConversation.deleteMany({ where: { lastMessageAt: { lt: cutoff } } });
  console.log(JSON.stringify({ mode: "apply", cutoff: cutoff.toISOString(), conversationsDeleted: result.count }, null, 2));
}

main()
  .catch((error) => {
    console.error("Chat transcript purge failed.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
