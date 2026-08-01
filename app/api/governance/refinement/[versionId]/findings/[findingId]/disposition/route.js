import { db } from '../../../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../../../lib/api/governance';
import { can, Permission } from '../../../../../../../../lib/authorization/permissions';
import { fail } from '../../../../../../../../lib/governance/errors';
import { recordGovernanceEvent } from '../../../../../../../../lib/governance/activity/governance-audit-log';
import {
  parseDispositionInput,
  requireExpectedUpdatedAt
} from '../../../../../../../../lib/governance/refinement/human-workspace';
import {
  findingInclude,
  scopedFinding
} from '../../../../../../../../lib/governance/refinement/human-workspace-data';
import { findingDto } from '../../../../../../../../lib/governance/refinement/human-workspace-dto';

export async function POST(request, { params }) {
  try {
    const user = await actor();
    if (!can(user, Permission.REFINEMENT_RUN)) {
      fail('FORBIDDEN', 'Tim Procurement authority is required.');
    }
    const payload = await body(request);
    const disposition = parseDispositionInput(payload);
    const expectedUpdatedAt = requireExpectedUpdatedAt(payload.expectedUpdatedAt);
    const { versionId, findingId } = await params;
    const { finding, businessUnitId } = await scopedFinding(db, user, versionId, findingId);
    if (!['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status)) {
      fail('INVALID_TRANSITION', 'Only unresolved findings can receive a disposition.');
    }
    if (finding.clarifications.some(item => item.status !== 'CLOSED')) {
      fail('INVALID_TRANSITION', 'Clarification must be reviewed and closed before disposition.');
    }

    const updated = await db.$transaction(async tx => {
      const data = {
        status: disposition.status,
        resolutionType: null,
        resolutionSummary: null,
        resolvedById: null,
        resolvedAt: null,
        deferReason: null,
        deferOwner: null,
        deferTargetAt: null,
        riskAcknowledgement: null,
        dismissalReason: null
      };
      if (disposition.status === 'RESOLVED') {
        Object.assign(data, {
          resolutionType: disposition.resolutionType,
          resolutionSummary: disposition.resolutionSummary,
          resolvedById: user.id,
          resolvedAt: new Date()
        });
      } else if (disposition.status === 'DEFERRED') {
        Object.assign(data, disposition);
        delete data.status;
        data.status = 'DEFERRED';
      } else {
        data.dismissalReason = disposition.dismissalReason;
      }

      const result = await tx.humanRefinementFinding.updateMany({
        where: { id: finding.id, updatedAt: expectedUpdatedAt },
        data
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
        action: `FINDING_${disposition.status}`,
        previousState: finding.status,
        resultingState: disposition.status,
        reason:
          disposition.resolutionSummary ||
          disposition.deferReason ||
          disposition.dismissalReason
      });
      return current;
    });

    return json(serial(findingDto(updated)));
  } catch (cause) {
    return error(cause);
  }
}
