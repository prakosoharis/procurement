const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  const extensions = await prisma.$queryRawUnsafe(
    "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'",
  );

  if (!extensions.length) throw new Error("pgvector extension could not be enabled.");

  console.log(`pgvector is ready (version ${extensions[0].extversion}).`);
}

main()
  .catch((error) => {
    console.error("Failed to enable pgvector.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
