import { db as defaultDb } from '../../db.js';
import { assertGovernanceActor, assertScope } from '../authorization.js';
import { fail } from '../errors.js';
import { recordGovernanceEvent } from '../activity/governance-audit-log.js';
import { createRevisionFromPublishedInTransaction } from '../lifecycle/revision-service.js';

const CONVERSION_INCLUDE = {
  sopDocument: { select: { id: true } },
  sopVersion: { select: { id: true } }
};

function conversionResult(conversion, idempotent) {
  return {
    submissionId: conversion.requestId,
    conversionId: conversion.id,
    sopDocumentId: conversion.sopDocumentId,
    sopVersionId: conversion.sopVersionId,
    mode: conversion.mode,
    idempotent
  };
}

function assertExpectedSubmission(input) {
  if (input.expectedStatus !== 'APPROVED' || !input.expectedUpdatedAt) {
    fail('CONCURRENT_MODIFICATION', 'The submission state changed.');
  }
}

function assertExpectedUpdatedAt(submission, expectedUpdatedAt) {
  if (submission.status !== 'APPROVED') {
    fail('INVALID_TRANSITION', 'Only approved submissions can be converted.');
  }

  if (
    typeof expectedUpdatedAt !== 'string' ||
    submission.updatedAt.toISOString() !== expectedUpdatedAt
  ) {
    fail('CONCURRENT_MODIFICATION', 'The submission changed. Refresh and try again.');
  }
}

async function createSopDraft(tx, submission, actor) {
  if (!submission.requestedBusinessUnitId) {
    fail('MISSING_REQUIRED_METADATA', 'A requested Business Unit is required for a new SOP.');
  }

  assertScope(actor, submission.requestedBusinessUnitId);
  const document = await tx.sopDocument.create({
    data: {
      businessUnitId: submission.requestedBusinessUnitId,
      title: submission.title,
      status: 'DRAFT'
    }
  });
  const version = await tx.sopVersion.create({
    data: {
      sopDocumentId: document.id,
      versionNo: '1.0',
      changeSummary: submission.description || submission.proposedText || submission.title,
      lifecycleState: 'DRAFT',
      approvalStatus: 'DRAFT'
    }
  });

  return { document, version, sourceVersionId: null };
}

async function createRevisionDraft(tx, submission, actor) {
  if (!submission.sopDocumentId || !submission.sopDocument) {
    fail('MISSING_REQUIRED_METADATA', 'An existing SOP is required for a revision.');
  }

  const document = submission.sopDocument;
  assertScope(actor, document.businessUnitId);

  if (
    submission.requestedBusinessUnitId &&
    submission.requestedBusinessUnitId !== document.businessUnitId
  ) {
    fail('INVALID_INPUT', 'Requested Business Unit does not match the target SOP.');
  }
  if (!document.publishedVersionId) {
    fail('INVALID_TRANSITION', 'The target SOP has no official published version.');
  }

  const version = await createRevisionFromPublishedInTransaction({
    tx,
    sopDocumentId: document.id,
    sourceVersionId: document.publishedVersionId,
    actor,
    reason: submission.proposedText || submission.description || submission.title
  });

  return { document, version, sourceVersionId: document.publishedVersionId };
}

function isIdempotentRaceError(caught) {
  return (caught?.code === 'P2002' && (
    caught?.meta?.target?.includes?.('requestId') ||
    String(caught?.message || '').includes('SubmissionConversion_requestId_key')
  )) || caught?.code === 'P2034';
}

export async function convertApprovedSubmission({
  requestId,
  actor,
  expectedStatus,
  expectedUpdatedAt,
  db = defaultDb
}) {
  assertGovernanceActor(actor);
  assertExpectedSubmission({ expectedStatus, expectedUpdatedAt });

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.submissionConversion.findUnique({
        where: { requestId },
        include: CONVERSION_INCLUDE
      });
      if (existing) return conversionResult(existing, true);

      const submission = await tx.sopRequest.findUnique({
        where: { id: requestId },
        include: {
          sopDocument: {
            select: { id: true, businessUnitId: true, publishedVersionId: true }
          }
        }
      });
      if (!submission) fail('NOT_FOUND', 'Submission not found.');

      assertExpectedUpdatedAt(submission, expectedUpdatedAt);
      if (!submission.conversionIntent) {
        fail('MISSING_REQUIRED_METADATA', 'Submission conversion intent is required.');
      }

      let outcome;
      if (submission.conversionIntent === 'CREATE_SOP') {
        outcome = await createSopDraft(tx, submission, actor);
      } else if (submission.conversionIntent === 'CREATE_REVISION') {
        outcome = await createRevisionDraft(tx, submission, actor);
      } else {
        fail('INVALID_INPUT', 'Unsupported submission conversion intent.');
      }

      const conversion = await tx.submissionConversion.create({
        data: {
          requestId: submission.id,
          mode: submission.conversionIntent,
          sopDocumentId: outcome.document.id,
          sopVersionId: outcome.version.id,
          sourceVersionId: outcome.sourceVersionId,
          convertedById: actor.id
        },
        include: CONVERSION_INCLUDE
      });

      await recordGovernanceEvent(tx, {
        actor,
        businessUnitId: outcome.document.businessUnitId,
        entity: 'SopRequest',
        entityId: submission.id,
        action: 'SUBMISSION_CONVERTED',
        previousState: 'APPROVED',
        resultingState: 'APPROVED',
        metadata: {
          conversionId: conversion.id,
          mode: conversion.mode,
          sopDocumentId: conversion.sopDocumentId,
          sopVersionId: conversion.sopVersionId,
          sourceVersionId: conversion.sourceVersionId
        }
      });

      return conversionResult(conversion, false);
    }, { isolationLevel: 'Serializable' });
  } catch (caught) {
    if (isIdempotentRaceError(caught)) {
      const existing = await db.submissionConversion.findUnique({
        where: { requestId },
        include: CONVERSION_INCLUDE
      });
      if (existing) return conversionResult(existing, true);
    }
    throw caught;
  }
}
