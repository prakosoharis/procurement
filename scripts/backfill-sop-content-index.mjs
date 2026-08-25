// One-off backfill: indexes every already-approved/published SOP version's
// text for chatbot search, for documents uploaded before this feature
// existed. Going forward, indexing happens automatically on approve/publish
// (see app/api/documents/[id]/approve/route.js and
// lib/governance/publishing/publishing-service.js) -- this script only needs
// to run once per environment (or again after a bulk data import).
//
//   node --env-file-if-exists=.env scripts/backfill-sop-content-index.mjs

import { PrismaClient } from '@prisma/client';
import { indexSopVersion } from '../lib/sop-content/index-service.js';

const db = new PrismaClient();

async function main() {
  const versions = await db.sopVersion.findMany({
    where: { sopDocument: { status: { in: ['APPROVED', 'PUBLISHED'] } } },
    select: { id: true, versionNo: true, fileKey: true, fileName: true, sopDocument: { select: { title: true } } }
  });

  const results = { indexed: [], skipped: [] };
  for (const version of versions) {
    const label = `${version.sopDocument.title} (${version.versionNo})`;
    try {
      const outcome = await indexSopVersion(version.id, { db });
      if (outcome.skipped) results.skipped.push(`${label} — ${outcome.reason}${outcome.message ? `: ${outcome.message}` : ''}`);
      else results.indexed.push(`${label} — ${outcome.indexed} halaman`);
    } catch (error) {
      results.skipped.push(`${label} — unexpected error: ${error.message}`);
    }
  }

  console.log(`\nBerhasil di-index: ${results.indexed.length}`);
  for (const line of results.indexed) console.log(`  ✓ ${line}`);
  console.log(`\nDilewati: ${results.skipped.length}`);
  for (const line of results.skipped) console.log(`  – ${line}`);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(() => db.$disconnect());
