// Imports an offline Refinement analysis produced with scripts/refinement-prepare-offline.js.
//
// The imported run is recorded as generatedOffline so the interface can label
// it honestly, and AiUsage stays an accurate record of what the deployed
// application itself spent.
//
//   node --env-file-if-exists=.env scripts/refinement-import-offline.js \
//     --job <jobId> --file hasil.json

const { readFileSync } = require("node:fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

async function main() {
  const jobId = arg("job");
  const file = arg("file");
  if (!jobId || !file) throw new Error("Usage: --job <jobId> --file <results.json>");

  let payload;
  try {
    payload = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Tidak dapat membaca JSON dari ${file}: ${error.message}`);
  }

  const { importOfflineAnalysis } = await import("../lib/ai/refinement/run-service.js");
  const result = await importOfflineAnalysis({ db: prisma, jobId, payload, model: arg("model") });

  console.log(`Analisis ${result.id} diimpor: ${payload.findings.length} temuan kandidat, status ${result.status}.`);
  console.log("Temuan menunggu validasi manusia (VALID / REVISI / ABAIKAN). Tidak ada yang disetujui otomatis.");
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
