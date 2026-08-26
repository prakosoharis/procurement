import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/current-user';
import { canManageBusinessUnit } from '../../../../lib/documents';
import { sopContentIndex } from '../../../../trigger/sop-content-index';

// Admin-triggered catch-up for SOPs approved before chatbot content search
// existed (scripts/backfill-sop-content-index.mjs does the same thing from a
// CLI, for an environment someone can shell into -- this route exists so a
// manager can trigger it from the Repository UI in a deployment like Vercel
// where nobody can just run a script). Only targets versions with zero
// SopSection rows yet, so clicking it again after some finish is a cheap
// no-op for those, not a wasted re-index.
//
// Responds as soon as every job is QUEUED, not when indexing finishes: each
// version is a separate Trigger.dev background task (same one approve/
// publish already dispatches), so this request never blocks on reading or
// parsing a single PDF, regardless of how many documents or how large they are.
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canManageBusinessUnit(user)) return NextResponse.json({ error: 'You do not have access to run this.' }, { status: 403 });

  // Excludes versions already known to be un-indexable (scanned PDF, DOCX):
  // re-running them can only fail the same way, and re-queueing them made the
  // progress counter look stuck with nothing on screen explaining why. A
  // replacement file arrives as a NEW version, which indexes on approve.
  const versions = await db.sopVersion.findMany({
    where: {
      sopDocument: { status: { in: ['APPROVED', 'PUBLISHED'] } },
      sections: { none: {} },
      contentIndexSkipReason: null
    },
    select: { id: true }
  });

  await Promise.all(versions.map((version) =>
    sopContentIndex.trigger({ sopVersionId: version.id }).catch((error) => console.error('Could not queue SOP content indexing.', error))
  ));

  return NextResponse.json({ queued: versions.length });
}

// Progress for the Repository UI's indexed-counter: how many approved/
// published versions have extracted sections vs. not yet. "Not yet" is not a
// promise of eventual completion -- a DOCX or scanned PDF is skipped by
// design and stays unindexed -- so the UI presents this as a plain X/Y count
// rather than a percentage bar that implies it must reach 100%.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canManageBusinessUnit(user)) return NextResponse.json({ error: 'You do not have access to view this.' }, { status: 403 });

  const approvedWhere = { sopDocument: { status: { in: ['APPROVED', 'PUBLISHED'] } } };
  const [total, indexed, skippedVersions] = await Promise.all([
    db.sopVersion.count({ where: approvedWhere }),
    db.sopVersion.count({ where: { ...approvedWhere, sections: { some: {} } } }),
    db.sopVersion.findMany({
      where: { ...approvedWhere, sections: { none: {} }, contentIndexSkipReason: { not: null } },
      select: {
        fileName: true, contentIndexSkipReason: true,
        sopDocument: { select: { title: true, businessUnit: { select: { name: true } } } }
      }
    })
  ]);

  // "pending" is only what a background job can still turn into a result;
  // a known-un-indexable version is reported separately so the UI never
  // shows a counter that appears stuck with no explanation.
  return NextResponse.json({
    total,
    indexed,
    skipped: skippedVersions.length,
    pending: total - indexed - skippedVersions.length,
    skippedDetail: skippedVersions.map((version) => ({
      businessUnit: version.sopDocument.businessUnit.name,
      title: version.sopDocument.title,
      fileName: version.fileName,
      reason: version.contentIndexSkipReason
    }))
  });
}
