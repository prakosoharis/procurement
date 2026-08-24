import { db as defaultDb } from '../../db.js';
import { assertGovernanceActor, assertScope } from '../authorization.js';
import { fail } from '../errors.js';
import { recordGovernanceEvent } from '../activity/governance-audit-log.js';
const valid = ['ACCEPTED','ACCEPTED_WITH_MODIFICATION','REJECTED','RETURNED_FOR_REFINEMENT'];
export async function decideRefinementFinding({ findingId, decision, actor, comment, metadata = {}, db = defaultDb }) {
  if (!valid.includes(decision)) fail('MISSING_REQUIRED_METADATA', 'A valid finding decision is required.');
  if (['ACCEPTED_WITH_MODIFICATION','REJECTED','RETURNED_FOR_REFINEMENT'].includes(decision) && !comment?.trim()) fail('MISSING_REQUIRED_METADATA', 'A decision comment is required.');
  if (decision === 'ACCEPTED_WITH_MODIFICATION' && !metadata.modifiedRecommendation) fail('MISSING_REQUIRED_METADATA', 'Modified recommendation metadata is required.');
  assertGovernanceActor(actor);
  return db.$transaction(async tx => {
    const finding = await tx.refinementFinding.findUnique({ where:{id:findingId}, include:{sopVersion:{include:{sopDocument:true}}} });
    if (!finding) fail('NOT_FOUND', 'Refinement finding was not found.'); assertScope(actor, finding.sopVersion.sopDocument.businessUnitId);
    const updated = await tx.refinementFinding.update({ where:{id:finding.id}, data:{humanStatus:decision} });
    await tx.validationDecision.create({ data:{sopVersionId:finding.sopVersionId, refinementFindingId:finding.id, reviewerId:actor.id, decision, comment:comment || null, previousLifecycleState:finding.sopVersion.lifecycleState, resultingLifecycleState:finding.sopVersion.lifecycleState, metadataJson:metadata} });
    await recordGovernanceEvent(tx,{actor,businessUnitId:finding.sopVersion.sopDocument.businessUnitId,entity:'RefinementFinding',entityId:finding.id,action:'VALIDATION_DECISION_RECORDED',previousState:finding.humanStatus,resultingState:decision,reason:comment,metadata});
    return updated;
  });
}
