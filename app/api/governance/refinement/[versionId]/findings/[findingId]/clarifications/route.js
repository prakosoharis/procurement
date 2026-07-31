import { db } from '../../../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../../../lib/api/governance';
import { can, Permission } from '../../../../../../../../lib/authorization/permissions';
import { fail } from '../../../../../../../../lib/governance/errors';
import { recordGovernanceEvent } from '../../../../../../../../lib/governance/activity/governance-audit-log';
import { scopedFinding } from '../../../../../../../../lib/governance/refinement/human-workspace-data';
import { clarificationDto } from '../../../../../../../../lib/governance/refinement/human-workspace-dto';

export async function POST(request, { params }) {
  try {
    const user = await actor();
    if (!can(user, Permission.REFINEMENT_RUN)) {
      fail('FORBIDDEN', 'Tim Procurement authority is required.');
    }
    const payload = await body(request);
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    if (!question || !payload.requestedBusinessUnitId) {
      fail('INVALID_INPUT', 'Question and Business Unit are required.');
    }
    const dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) fail('INVALID_INPUT', 'Due date is invalid.');

    const { versionId, findingId } = await params;
    const { finding, businessUnitId } = await scopedFinding(db, user, versionId, findingId);
    if (!['OPEN', 'WAITING_FOR_CLARIFICATION'].includes(finding.status)) {
      fail('INVALID_TRANSITION', 'Clarification can only be requested for an open finding.');
    }
    if (payload.requestedBusinessUnitId !== businessUnitId) {
      fail('OUT_OF_SCOPE', 'Clarification must be assigned to the SOP Business Unit.');
    }

    const clarification = await db.$transaction(async tx => {
      const created = await tx.refinementClarification.create({
        data: {
          findingId: finding.id,
          requestedById: user.id,
          requestedBusinessUnitId: businessUnitId,
          question,
          dueAt
        },
        include: {
          requestedBy: { select: { id: true, name: true } },
          requestedBusinessUnit: { select: { id: true, name: true } },
          respondedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } }
        }
      });
      await tx.humanRefinementFinding.update({
        where: { id: finding.id },
        data: { status: 'WAITING_FOR_CLARIFICATION' }
      });
      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId,
        entity: 'HumanRefinementFinding',
        entityId: finding.id,
        action: 'CLARIFICATION_REQUESTED',
        previousState: finding.status,
        resultingState: 'WAITING_FOR_CLARIFICATION',
        metadata: { clarificationId: created.id, dueAt }
      });
      return created;
    });

    return json(serial(clarificationDto(clarification)), 201);
  } catch (cause) {
    return error(cause);
  }
}
