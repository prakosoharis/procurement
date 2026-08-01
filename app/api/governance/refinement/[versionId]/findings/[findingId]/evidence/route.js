import { db } from '../../../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../../../lib/api/governance';
import { can, Permission } from '../../../../../../../../lib/authorization/permissions';
import { fail } from '../../../../../../../../lib/governance/errors';
import { recordGovernanceEvent } from '../../../../../../../../lib/governance/activity/governance-audit-log';
import {
  parseEvidenceInput,
  refinementCapabilities
} from '../../../../../../../../lib/governance/refinement/human-workspace';
import {
  findingInclude,
  scopedFinding
} from '../../../../../../../../lib/governance/refinement/human-workspace-data';
import { evidenceDto } from '../../../../../../../../lib/governance/refinement/human-workspace-dto';

export async function POST(request, { params }) {
  try {
    const user = await actor();
    const payload = parseEvidenceInput(await body(request));
    const { versionId, findingId } = await params;
    const { finding, businessUnitId } = await scopedFinding(db, user, versionId, findingId);
    const capabilities = refinementCapabilities(user, businessUnitId);
    if (!capabilities.canAddEvidence) fail('FORBIDDEN', 'Evidence authority is required.');

    const isGovernance = can(user, Permission.REFINEMENT_RUN);
    if (!isGovernance) {
      const assigned = finding.clarifications.some(item =>
        item.requestedBusinessUnit?.id === businessUnitId &&
        ['OPEN', 'RESPONDED'].includes(item.status)
      );
      if (!assigned || !['CLARIFICATION_RESPONSE', 'SUPPORTING_ATTACHMENT'].includes(payload.type)) {
        fail('FORBIDDEN', 'Business Unit evidence must support an assigned clarification.');
      }
    }

    const evidence = await db.$transaction(async tx => {
      const created = await tx.humanRefinementEvidence.create({
        data: {
          findingId: finding.id,
          ...payload,
          addedById: user.id
        },
        include: { addedBy: { select: { id: true, name: true } } }
      });
      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId,
        entity: 'HumanRefinementFinding',
        entityId: finding.id,
        action: 'FINDING_EVIDENCE_ADDED',
        previousState: finding.status,
        resultingState: finding.status,
        metadata: { evidenceId: created.id, type: created.type }
      });
      return created;
    });

    return json(serial(evidenceDto(evidence)), 201);
  } catch (cause) {
    return error(cause);
  }
}
