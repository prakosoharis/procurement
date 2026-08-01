import { db as defaultDb } from '../../db.js';
import { assertScope } from '../authorization.js';
import { fail } from '../errors.js';
import { recordGovernanceEvent } from '../activity/governance-audit-log.js';

export async function createRevisionFromPublishedInTransaction({
  tx,
  sopDocumentId,
  sourceVersionId,
  actor,
  reason
}) {
  if (!reason?.trim()) {
    fail('MISSING_REQUIRED_METADATA', 'Revision reason is required.');
  }

  const source = await tx.sopVersion.findUnique({
    where: { id: sourceVersionId },
    include: { sopDocument: true }
  });

  if (!source || source.sopDocumentId !== sopDocumentId) {
    fail('NOT_FOUND', 'Published source version does not belong to this SOP.');
  }
  if (
    source.lifecycleState !== 'PUBLISHED' ||
    source.sopDocument.publishedVersionId !== source.id
  ) {
    fail('INVALID_TRANSITION', 'Revision source must be the current official published version.');
  }

  assertScope(actor, source.sopDocument.businessUnitId);

  const count = await tx.sopVersion.count({ where: { sopDocumentId } });
  const revision = await tx.sopVersion.create({
    data: {
      sopDocumentId,
      versionNo: `${source.versionNo}-rev-${count + 1}`,
      fileKey: source.fileKey,
      fileName: source.fileName,
      fileSize: source.fileSize,
      contentType: source.contentType,
      changeSummary: `Revision of ${source.versionNo}: ${reason}`,
      lifecycleState: 'DRAFT',
      approvalStatus: 'DRAFT'
    }
  });

  await recordGovernanceEvent(tx, {
    actor,
    businessUnitId: source.sopDocument.businessUnitId,
    entity: 'SopVersion',
    entityId: revision.id,
    action: 'REVISION_CREATED',
    previousState: 'PUBLISHED',
    resultingState: 'DRAFT',
    reason,
    metadata: { sourceVersionId }
  });

  return revision;
}

export async function createRevisionFromPublished({
  sopDocumentId,
  sourceVersionId,
  actor,
  reason,
  db = defaultDb
}) {
  return db.$transaction((tx) => createRevisionFromPublishedInTransaction({
    tx,
    sopDocumentId,
    sourceVersionId,
    actor,
    reason
  }));
}
