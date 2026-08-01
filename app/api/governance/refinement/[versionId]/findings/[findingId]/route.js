import { db } from '../../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../../lib/api/governance';
import { can, Permission } from '../../../../../../../lib/authorization/permissions';
import { fail } from '../../../../../../../lib/governance/errors';
import { recordGovernanceEvent } from '../../../../../../../lib/governance/activity/governance-audit-log';
import {
  parseFindingInput,
  requireExpectedUpdatedAt
} from '../../../../../../../lib/governance/refinement/human-workspace';
import {
  findingInclude,
  scopedFinding
} from '../../../../../../../lib/governance/refinement/human-workspace-data';
import { findingDto } from '../../../../../../../lib/governance/refinement/human-workspace-dto';

export async function PATCH(request, { params }) {
  try {
    const user = await actor();
    if (!can(user, Permission.REFINEMENT_RUN)) {
      fail('FORBIDDEN', 'Tim Procurement authority is required.');
    }
    const payload = await body(request);
    const expectedUpdatedAt = requireExpectedUpdatedAt(payload.expectedUpdatedAt);
    const { versionId, findingId } = await params;
    const { finding, businessUnitId } = await scopedFinding(db, user, versionId, findingId);
    if (!['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status)) {
      fail('INVALID_TRANSITION', 'Only open findings can be edited.');
    }

    const update = parseFindingInput({
      ...payload,
      currentCategory: finding.category,
      currentSeverity: finding.severity
    }, { partial: true });

    const updated = await db.$transaction(async tx => {
      const result = await tx.humanRefinementFinding.updateMany({
        where: { id: finding.id, updatedAt: expectedUpdatedAt },
        data: update
      });
      if (result.count !== 1) {
        fail('CONCURRENT_MODIFICATION', 'The finding changed after it was opened. Reload before saving.');
      }
      const current = await tx.humanRefinementFinding.findUnique({
        where: { id: finding.id },
        include: findingInclude
      });
      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId,
        entity: 'HumanRefinementFinding',
        entityId: finding.id,
        action: 'FINDING_UPDATED',
        previousState: finding.status,
        resultingState: current.status,
        metadata: {
          severity: current.severity,
          blocking: current.blocking
        }
      });
      return current;
    });
    return json(serial(findingDto(updated)));
  } catch (cause) {
    return error(cause);
  }
}
