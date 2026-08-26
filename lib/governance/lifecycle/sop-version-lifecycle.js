import { db as defaultDb } from '../../db';
import { Role } from '../../authorization/roles';
import { recordGovernanceEvent } from '../activity/governance-audit-log';
import { assertActor, assertGovernanceActor, assertScope, assertSuperuserOverride } from '../authorization';
import { fail } from '../errors';
import { LifecycleState, isValidTransition } from './transition-rules';
import { resolveReviewInterval } from '../review-interval';

const include = { sopDocument: { include: { businessUnit: true, category: true } }, refinementJobs: true, refinementFindings: true };
function eventFor(target) { return ({ SUBMITTED:'VERSION_SUBMITTED', REFINEMENT:'REFINEMENT_STARTED', VALIDATION:'VALIDATION_SUBMITTED', APPROVED:'VERSION_APPROVED', READY_TO_PUBLISH:'VERSION_READY_TO_PUBLISH', ARCHIVED:'VERSION_ARCHIVED' })[target] || 'VERSION_TRANSITIONED'; }
function requireReason(reason) { if (!reason?.trim()) fail('MISSING_REQUIRED_METADATA', 'A business reason is required.'); }
function hasFile(v) { return Boolean(v.fileKey || v.fileName); }

export async function transitionSopVersion({ versionId, targetState, actor, reason, metadata = {}, expectedState, db = defaultDb }) {
  assertActor(actor);
  if (targetState === LifecycleState.PUBLISHED) fail('FORBIDDEN', 'Use completePublishing() to publish a version.');
  return db.$transaction(async tx => {
    const version = await tx.sopVersion.findUnique({ where: { id: versionId }, include });
    if (!version) fail('NOT_FOUND', 'SOP version was not found.');
    // Group documents are Repository-only for now. The whole governance
    // lifecycle -- reviewer assignment, clarification routing, refinement
    // scope, publishing evidence -- is anchored on the document's Business
    // Unit, and there is no agreed rule yet for who represents a Group.
    // Refuse with a stated reason instead of letting assertScope receive a
    // null businessUnitId and fail somewhere less obvious.
    if (version.sopDocument.scopeType === 'GROUP') fail('FORBIDDEN', 'Dokumen level Group belum didukung pada alur Refinement dan publikasi.');
    assertScope(actor, version.sopDocument.businessUnitId);
    if (expectedState && version.lifecycleState !== expectedState) fail('CONCURRENT_MODIFICATION', 'The SOP version state changed before this operation.');
    if (!isValidTransition(version.lifecycleState, targetState)) fail('INVALID_TRANSITION', `Cannot transition ${version.lifecycleState} to ${targetState}.`);
    if (targetState === 'SUBMITTED') { if (![Role.BUSINESS_UNIT, Role.PROCUREMENT_TEAM, Role.SUPERUSER].includes(actor.role)) fail('FORBIDDEN', 'Only an authorized submitter can submit.'); if (!hasFile(version)) fail('MISSING_REQUIRED_METADATA', 'A usable document reference is required.'); }
    if (['REFINEMENT','VALIDATION','APPROVED','READY_TO_PUBLISH','ARCHIVED'].includes(targetState)) assertGovernanceActor(actor);
    if (targetState === 'ARCHIVED') requireReason(reason);
    if (targetState === 'VALIDATION') {
      const completed = version.refinementJobs.some(j => j.status === 'COMPLETED');
      const humanOnly = metadata.refinementMode === 'HUMAN_ONLY' && metadata.humanOnlyReason && metadata.preparedBy && metadata.completedAt;
      if (!completed && !humanOnly) fail('REFINEMENT_REQUIRED', 'Completed refinement or documented HUMAN_ONLY refinement is required.');
      if (humanOnly) await tx.refinementJob.create({ data: { sopVersionId: version.id, requestedById: actor.id, businessUnitId: version.sopDocument.businessUnitId, fingerprint: `human-only:${version.id}:${Date.now()}`, status: 'COMPLETED', configurationJson: { refinementMode:'HUMAN_ONLY', reason:metadata.humanOnlyReason, preparedBy:metadata.preparedBy, completedAt:metadata.completedAt } } });
    }
    if (targetState === 'REFINEMENT' && version.lifecycleState === 'VALIDATION') {
      if (metadata.validationDecision !== 'RETURNED_FOR_REFINEMENT' || !reason?.trim()) fail('MISSING_REQUIRED_METADATA', 'Returning for refinement requires RETURNED_FOR_REFINEMENT and a reason.');
      await tx.validationDecision.create({ data: { sopVersionId: version.id, reviewerId: actor.id, decision: 'RETURNED_FOR_REFINEMENT', comment: reason, previousLifecycleState: version.lifecycleState, resultingLifecycleState: targetState, metadataJson: metadata } });
    }
    if (targetState === 'APPROVED') {
      const blocking = version.refinementFindings.filter(f => ['PENDING','RETURNED_FOR_REFINEMENT'].includes(f.humanStatus));
      if (blocking.length) fail('PENDING_FINDINGS', 'All refinement findings require a final human decision.');
      if (!metadata.validationDecision) fail('MISSING_REQUIRED_METADATA', 'A version-level validation decision is required.');
      if (!version.refinementFindings.length && !version.refinementJobs.some(j => j.status === 'COMPLETED' && j.configurationJson?.refinementMode === 'HUMAN_ONLY')) fail('REFINEMENT_REQUIRED', 'Documented human-only refinement is required when no findings exist.');
      assertSuperuserOverride(actor, targetState, metadata);
      await tx.validationDecision.create({ data: { sopVersionId: version.id, reviewerId: actor.id, decision: metadata.validationDecision, comment: metadata.comment || null, previousLifecycleState: version.lifecycleState, resultingLifecycleState: targetState, metadataJson: metadata } });
    }
    let data = { lifecycleState: targetState };
    if (targetState === 'SUBMITTED') data = { ...data, submittedAt:new Date(), submittedById:actor.id };
    if (targetState === 'READY_TO_PUBLISH') {
      assertSuperuserOverride(actor, targetState, metadata);
      if (!version.effectiveAt && !metadata.approvedEffectiveDateException) fail('MISSING_REQUIRED_METADATA', 'Effective date is required before publishing preparation.');
      const review = resolveReviewInterval({ version, category: version.sopDocument.category, businessUnit: version.sopDocument.businessUnit });
      if (!review.nextReviewAt && !metadata.approvedEffectiveDateException) fail('MISSING_REQUIRED_METADATA', 'Next review date cannot be resolved.');
      data = { ...data, ...review };
      const existingRecord = await tx.publishingRecord.findFirst({ where: { sopVersionId: version.id }, orderBy: { createdAt: 'desc' } });
      if (existingRecord) await tx.publishingRecord.update({ where: { id: existingRecord.id }, data: { status: 'READY', notes: metadata.notes || undefined } });
      else await tx.publishingRecord.create({ data: { sopVersionId: version.id, status: 'READY', externalSystem: metadata.externalSystem || 'IMEMO', notes: metadata.notes || null } });
    }
    const updated = await tx.sopVersion.update({ where: { id: version.id }, data });
    if (targetState === 'REFINEMENT' && version.lifecycleState === 'SUBMITTED') {
      const latest = await tx.refinementSession.findFirst({ where:{sopVersionId:version.id}, orderBy:{cycleNo:'desc'} });
      await tx.refinementSession.create({ data:{ sopVersionId:version.id, businessUnitId:version.sopDocument.businessUnitId, startedById:actor.id, cycleNo:(latest?.cycleNo||0)+1, status:'IN_PROGRESS', startedAt:new Date() } });
    }
    await recordGovernanceEvent(tx, { actor, businessUnitId:version.sopDocument.businessUnitId, entity:'SopVersion', entityId:version.id, action:targetState === 'REFINEMENT' && version.lifecycleState === 'VALIDATION' ? 'VERSION_RETURNED_FOR_REFINEMENT' : eventFor(targetState), previousState:version.lifecycleState, resultingState:targetState, reason, metadata });
    if (targetState === 'VALIDATION' && metadata.refinementMode === 'HUMAN_ONLY') await recordGovernanceEvent(tx, { actor, businessUnitId:version.sopDocument.businessUnitId, entity:'SopVersion', entityId:version.id, action:'REFINEMENT_COMPLETED_HUMAN_ONLY', previousState:'REFINEMENT', resultingState:'VALIDATION', reason:metadata.humanOnlyReason, metadata });
    return updated;
  });
}
export const submitVersion = args => transitionSopVersion({ ...args, targetState:'SUBMITTED', expectedState:'DRAFT' });
export const startRefinement = args => transitionSopVersion({ ...args, targetState:'REFINEMENT', expectedState:'SUBMITTED' });
export const submitForValidation = args => transitionSopVersion({ ...args, targetState:'VALIDATION', expectedState:'REFINEMENT' });
export const approveVersion = args => transitionSopVersion({ ...args, targetState:'APPROVED', expectedState:'VALIDATION' });
export const returnForRefinement = args => transitionSopVersion({ ...args, targetState:'REFINEMENT', expectedState:'VALIDATION' });
export const markReadyToPublish = args => transitionSopVersion({ ...args, targetState:'READY_TO_PUBLISH', expectedState:'APPROVED' });
export const archiveVersion = args => transitionSopVersion({ ...args, targetState:'ARCHIVED' });
