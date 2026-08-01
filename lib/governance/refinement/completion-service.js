import { db as defaultDb } from '../../db.js';
import { scopeWhere } from '../../authorization/scope.js';
import { assertGovernanceActor } from '../authorization.js';
import { fail } from '../errors.js';
import { recordGovernanceEvent } from '../activity/governance-audit-log.js';

const sessionInclude = {
  references: { where: { active: true }, select: { id: true } },
  humanFindings: {
    select: {
      id: true,
      status: true,
      blocking: true,
      severity: true,
      clarifications: { select: { id: true, status: true } }
    }
  }
};

export function refinementReadiness(session) {
  const findings = session?.humanFindings || [];
  const unresolved = findings.filter(finding => ['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status));
  const pendingClarifications = findings.flatMap(finding => finding.clarifications || []).filter(item => item.status !== 'CLOSED');
  const checks = [
    { key: 'summary', label: 'Refinement summary recorded', complete: Boolean(session?.summary?.trim()) },
    { key: 'references', label: 'At least one active reference', complete: Boolean(session?.references?.length) },
    { key: 'findings', label: 'All findings have a final disposition', complete: unresolved.length === 0 },
    { key: 'clarifications', label: 'All clarifications are reviewed and closed', complete: pendingClarifications.length === 0 }
  ];
  return {
    ready: checks.every(check => check.complete),
    checks,
    unresolvedFindingCount: unresolved.length,
    blockingUnresolvedCount: unresolved.filter(finding => finding.blocking).length,
    pendingClarificationCount: pendingClarifications.length
  };
}

async function loadSession(db, actor, versionId) {
  const version = await db.sopVersion.findFirst({
    where: {
      id: versionId,
      lifecycleState: 'REFINEMENT',
      sopDocument: { ...scopeWhere(actor, 'sopDocument') }
    },
    include: {
      sopDocument: { select: { businessUnitId: true } },
      refinementSessions: { orderBy: { cycleNo: 'desc' }, take: 1, include: sessionInclude }
    }
  });
  const session = version?.refinementSessions[0];
  if (!session) fail('NOT_FOUND', 'Refinement session not found.');
  return { version, session };
}

export async function getRefinementReadiness({ versionId, actor, db = defaultDb }) {
  const { session } = await loadSession(db, actor, versionId);
  return refinementReadiness(session);
}

export async function saveRefinementSummary({ versionId, actor, summary, expectedUpdatedAt, db = defaultDb }) {
  assertGovernanceActor(actor);
  const normalizedSummary = typeof summary === 'string' ? summary.trim() : '';
  if (!normalizedSummary) fail('MISSING_REQUIRED_METADATA', 'A Refinement summary is required.');
  if (!expectedUpdatedAt) fail('INVALID_INPUT', 'expectedUpdatedAt is required.');
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) fail('INVALID_INPUT', 'expectedUpdatedAt is invalid.');

  return db.$transaction(async tx => {
    const { version, session } = await loadSession(tx, actor, versionId);
    const result = await tx.refinementSession.updateMany({
      where: { id: session.id, updatedAt: expected },
      data: { summary: normalizedSummary }
    });
    if (result.count !== 1) {
      fail('CONCURRENT_MODIFICATION', 'The Refinement summary changed after it was opened. Reload before saving.');
    }
    const updated = await tx.refinementSession.findUnique({ where: { id: session.id } });
    await recordGovernanceEvent(tx, {
      actor,
      businessUnitId: version.sopDocument.businessUnitId,
      entity: 'RefinementSession',
      entityId: session.id,
      action: 'REFINEMENT_SUMMARY_SAVED',
      previousState: session.status,
      resultingState: updated.status
    });
    return updated;
  });
}

export async function completeHumanRefinement({ versionId, actor, expectedState, expectedUpdatedAt, reason, db = defaultDb }) {
  assertGovernanceActor(actor);
  if (expectedState !== 'REFINEMENT') fail('CONCURRENT_MODIFICATION', 'The SOP version state changed before completion.');
  if (!expectedUpdatedAt) fail('INVALID_INPUT', 'expectedUpdatedAt is required.');
  if (!reason?.trim()) fail('MISSING_REQUIRED_METADATA', 'A completion reason is required.');
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) fail('INVALID_INPUT', 'expectedUpdatedAt is invalid.');

  return db.$transaction(async tx => {
    const { version, session } = await loadSession(tx, actor, versionId);
    if (version.updatedAt.getTime() !== expected.getTime()) {
      fail('CONCURRENT_MODIFICATION', 'The SOP version changed after it was opened. Reload before completing Refinement.');
    }
    const readiness = refinementReadiness(session);
    if (!readiness.checks.find(check => check.key === 'summary').complete) {
      fail('MISSING_REQUIRED_METADATA', 'A Refinement summary is required before completion.');
    }
    if (!readiness.checks.find(check => check.key === 'references').complete) {
      fail('MISSING_REQUIRED_METADATA', 'At least one active reference is required before completion.');
    }
    if (!readiness.checks.find(check => check.key === 'findings').complete) {
      fail('PENDING_FINDINGS', 'All Human Findings require a final disposition before completion.');
    }
    if (!readiness.checks.find(check => check.key === 'clarifications').complete) {
      fail('PENDING_FINDINGS', 'All clarifications must be reviewed and closed before completion.');
    }

    const versionResult = await tx.sopVersion.updateMany({
      where: { id: version.id, lifecycleState: 'REFINEMENT', updatedAt: expected },
      data: { lifecycleState: 'VALIDATION' }
    });
    if (versionResult.count !== 1) {
      fail('CONCURRENT_MODIFICATION', 'The SOP version changed while completion was being recorded.');
    }
    const completedAt = new Date();
    const updatedSession = await tx.refinementSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED', completedAt }
    });
    await tx.refinementJob.create({
      data: {
        sopVersionId: version.id,
        requestedById: actor.id,
        businessUnitId: version.sopDocument.businessUnitId,
        fingerprint: `human-only:${version.id}:${completedAt.getTime()}`,
        status: 'COMPLETED',
        configurationJson: {
          refinementMode: 'HUMAN_ONLY',
          reason: reason.trim(),
          preparedBy: actor.id,
          completedAt: completedAt.toISOString(),
          sessionId: session.id,
          summary: session.summary
        },
        startedAt: session.startedAt || session.createdAt,
        completedAt
      }
    });
    await recordGovernanceEvent(tx, {
      actor,
      businessUnitId: version.sopDocument.businessUnitId,
      entity: 'RefinementSession',
      entityId: session.id,
      action: 'REFINEMENT_SESSION_COMPLETED_HUMAN_ONLY',
      previousState: session.status,
      resultingState: updatedSession.status,
      reason: reason.trim(),
      metadata: { summary: session.summary, readiness }
    });
    await recordGovernanceEvent(tx, {
      actor,
      businessUnitId: version.sopDocument.businessUnitId,
      entity: 'SopVersion',
      entityId: version.id,
      action: 'REFINEMENT_COMPLETED_HUMAN_ONLY',
      previousState: 'REFINEMENT',
      resultingState: 'VALIDATION',
      reason: reason.trim(),
      metadata: { sessionId: session.id, readiness }
    });
    return { versionId: version.id, lifecycleState: 'VALIDATION', session: updatedSession, readiness };
  });
}
