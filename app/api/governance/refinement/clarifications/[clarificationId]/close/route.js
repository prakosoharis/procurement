import { db } from '../../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../../lib/api/governance';
import { can, Permission } from '../../../../../../../lib/authorization/permissions';
import { scopeWhere } from '../../../../../../../lib/authorization/scope';
import { fail } from '../../../../../../../lib/governance/errors';
import { recordGovernanceEvent } from '../../../../../../../lib/governance/activity/governance-audit-log';
import { requireExpectedUpdatedAt } from '../../../../../../../lib/governance/refinement/human-workspace';
import { clarificationDto } from '../../../../../../../lib/governance/refinement/human-workspace-dto';

const include = {
  requestedBy: { select: { id: true, name: true } },
  requestedBusinessUnit: { select: { id: true, name: true } },
  respondedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } }
};

export async function POST(request, { params }) {
  try {
    const user = await actor();
    if (!can(user, Permission.REFINEMENT_RUN)) {
      fail('FORBIDDEN', 'Tim Procurement authority is required.');
    }
    const payload = await body(request);
    const expectedUpdatedAt = requireExpectedUpdatedAt(payload.expectedUpdatedAt);
    const { clarificationId } = await params;
    const clarification = await db.refinementClarification.findFirst({
      where: {
        id: clarificationId,
        status: 'RESPONDED',
        finding: {
          refinementSession: {
            sopVersion: {
              lifecycleState: 'REFINEMENT',
              sopDocument: { ...scopeWhere(user, 'sopDocument') }
            }
          }
        }
      },
      include: {
        ...include,
        finding: {
          include: {
            refinementSession: { select: { businessUnitId: true } },
            clarifications: { select: { id: true, status: true } }
          }
        }
      }
    });
    if (!clarification) fail('NOT_FOUND', 'Responded clarification was not found.');

    const updated = await db.$transaction(async tx => {
      const result = await tx.refinementClarification.updateMany({
        where: { id: clarification.id, status: 'RESPONDED', updatedAt: expectedUpdatedAt },
        data: { status: 'CLOSED', closedById: user.id, closedAt: new Date() }
      });
      if (result.count !== 1) {
        fail('CONCURRENT_MODIFICATION', 'The clarification changed after it was opened. Reload before closing.');
      }
      const hasOtherOpen = clarification.finding.clarifications.some(item =>
        item.id !== clarification.id && item.status !== 'CLOSED'
      );
      if (!hasOtherOpen && clarification.finding.status === 'WAITING_FOR_CLARIFICATION') {
        await tx.humanRefinementFinding.update({
          where: { id: clarification.finding.id },
          data: { status: 'OPEN' }
        });
      }
      const current = await tx.refinementClarification.findUnique({
        where: { id: clarification.id },
        include
      });
      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId: clarification.finding.refinementSession.businessUnitId,
        entity: 'HumanRefinementFinding',
        entityId: clarification.finding.id,
        action: 'CLARIFICATION_CLOSED',
        previousState: 'RESPONDED',
        resultingState: 'CLOSED',
        metadata: { clarificationId: clarification.id }
      });
      return current;
    });
    return json(serial(clarificationDto(updated)));
  } catch (cause) {
    return error(cause);
  }
}
