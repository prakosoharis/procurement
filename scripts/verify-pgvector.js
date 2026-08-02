const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const extensions = await prisma.$queryRawUnsafe(
    "SELECT extname FROM pg_extension WHERE extname = 'vector'",
  );
  if (!extensions.length) {
    throw new Error("pgvector is not enabled. Apply migrations or run the local Docker stack first.");
  }

  const nearest = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      "CREATE TEMP TABLE pgvector_smoke (id text PRIMARY KEY, embedding vector(3) NOT NULL) ON COMMIT DROP",
    );
    await transaction.$executeRawUnsafe(
      "INSERT INTO pgvector_smoke (id, embedding) VALUES ('exact', '[1,0,0]'), ('near', '[0.9,0.1,0]'), ('far', '[0,1,0]')",
    );
    return transaction.$queryRawUnsafe(
      "SELECT id, embedding <-> '[1,0,0]'::vector AS distance FROM pgvector_smoke ORDER BY embedding <-> '[1,0,0]'::vector ASC, id ASC LIMIT 1",
    );
  });

  if (nearest.length !== 1 || nearest[0].id !== "exact" || Number(nearest[0].distance) !== 0) {
    throw new Error("pgvector similarity smoke test returned an unexpected nearest vector.");
  }

  console.log("pgvector smoke test passed: vector insert and similarity query are working.");
}

main()
  .catch((error) => {
    console.error("pgvector smoke test failed.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
