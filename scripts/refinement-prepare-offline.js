// Prepares an offline Refinement analysis brief.
//
// The deployed application calls a provider itself. This script exists for the
// pre-budget period, where the analysis is produced by the developer through
// Claude Code on their own machine and then imported. It builds exactly the
// same retrieval context the deployed runner would build, so the analysis is
// equivalent and the import stays schema-valid.
//
//   node --env-file-if-exists=.env scripts/refinement-prepare-offline.js \
//     --actor admin@example.com --version <sopVersionId> --sources <id,id>

const { writeFileSync } = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const actorEmail = arg("actor");
  const sopVersionId = arg("version");
  const sourceIds = (arg("sources") || "").split(",").map((id) => id.trim()).filter(Boolean);
  const outDir = arg("out", process.cwd());

  if (!actorEmail || !sopVersionId || !sourceIds.length) {
    throw new Error("Usage: --actor <email> --version <sopVersionId> --sources <sourceId,sourceId>");
  }

  const [{ startRefinementAnalysis }, { loadDocumentPages }, { buildRefinementContext }, { REFINEMENT_SYSTEM_PROMPT }, { REFINEMENT_RESPONSE_SCHEMA }] = await Promise.all([
    import("../lib/ai/refinement/run-service.js"),
    import("../lib/ai/refinement/document-text.js"),
    import("../lib/ai/refinement/context-builder.js"),
    import("../lib/ai/prompts/refinement.v1.js"),
    import("../lib/ai/schemas.js"),
  ]);

  // The same authorization the API applies; a script is not an exemption.
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail.toLowerCase() },
    include: { businessUnitScopes: { select: { businessUnitId: true } } },
  });
  if (!actor) throw new Error(`User not found: ${actorEmail}`);

  // No enqueue callback is passed, so no worker picks this job up and no
  // provider is ever called.
  const { job, reused } = await startRefinementAnalysis(actor, sopVersionId, {
    sourceIds,
    db: prisma,
    environment: { ...process.env, AI_REFINEMENT_ENABLED: "true" },
  });
  if (reused) {
    console.log(`An identical completed analysis already exists: ${job.id}. Nothing to prepare.`);
    return;
  }

  const version = await prisma.sopVersion.findUnique({
    where: { id: sopVersionId },
    select: { fileKey: true, fileName: true, contentType: true, versionNo: true, sopDocument: { select: { title: true } } },
  });
  const sources = await prisma.referenceSource.findMany({
    where: { id: { in: sourceIds }, isApproved: true },
    select: { id: true, title: true, fileKey: true },
  });

  const sopDocument = await loadDocumentPages({ fileKey: version.fileKey, fileName: version.fileName || "SOP", contentType: version.contentType });

  const sections = [];
  for (const source of sources) {
    const sourceDocument = await loadDocumentPages({ fileKey: source.fileKey, fileName: source.title });
    const context = buildRefinementContext({ sopDocument, sourceDocument });
    sections.push([
      `# Sumber: ${source.title}`,
      `sourceId: ${source.id}`,
      "",
      "## Catatan cakupan",
      context.scopeNote,
      "",
      "## SOP",
      context.sopContext,
      "",
      "## Sumber pembanding",
      context.sourceContext,
    ].join("\n"));
  }

  const brief = [
    `# Brief analisis Refinement — job ${job.id}`,
    "",
    `SOP: ${version.sopDocument.title} ${version.versionNo}`,
    `Sumber: ${sources.map((source) => source.title).join(", ")}`,
    "",
    "## Instruksi",
    "",
    REFINEMENT_SYSTEM_PROMPT,
    "",
    "Hasilkan SATU objek JSON yang valid terhadap skema di bawah, mencakup seluruh sumber.",
    "Setiap temuan wajib memuat evidence.sourceTitle yang menyebut sumber asalnya.",
    "Simpan hasilnya sebagai file .json, lalu impor dengan scripts/refinement-import-offline.js.",
    "",
    "## Skema keluaran",
    "",
    "```json",
    JSON.stringify(REFINEMENT_RESPONSE_SCHEMA, null, 2),
    "```",
    "",
    ...sections,
  ].join("\n");

  const briefPath = path.join(outDir, `refinement-brief-${job.id}.md`);
  writeFileSync(briefPath, brief, "utf8");

  console.log(`Job disiapkan  : ${job.id} (status ${job.status}, tidak di-enqueue)`);
  console.log(`Brief ditulis  : ${briefPath}`);
  console.log("");
  console.log("Langkah berikutnya:");
  console.log(`  1. Buka Claude Code, minta analisis berdasarkan ${path.basename(briefPath)}`);
  console.log("  2. Simpan keluaran JSON-nya, misalnya hasil.json");
  console.log(`  3. node --env-file-if-exists=.env scripts/refinement-import-offline.js --job ${job.id} --file hasil.json`);
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
