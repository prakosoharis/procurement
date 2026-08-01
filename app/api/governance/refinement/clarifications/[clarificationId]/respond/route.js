import { db } from '../../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../../lib/api/governance';
import { scopeWhere } from '../../../../../../../lib/authorization/scope';
import { Role } from '../../../../../../../lib/authorization/roles';
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
    if (user.role !== Role.BUSINESS_UNIT) {
      fail('FORBIDDEN', 'Business Unit response authority is required.');
    }
    const payload = await body(request);
    const response = typeof payload.response === 'string' ? payload.response.trim() : '';
    if (!response) fail('INVALID_INPUT', 'Response is required.');
    const expectedUpdatedAt = requireExpectedUpdatedAt(payload.expectedUpdatedAt);
    const { clarificationId } = await params;
    const clarification = await db.refinementClarification.findFirst({
      where: {
        id: clarificationId,
        status: 'OPEN',
        requestedBusinessUnit: { ...scopeWhere(user, 'businessUnit') },
        finding: {
          refinementSession: {
            sopVersion: { lifecycleState: 'REFINEMENT' }
          }
        }
      },
      include: {
        ...include,
        finding: {
          select: {
            id: true,
            refinementSession: { select: { businessUnitId: true } }
          }
        }
      }
    });
    if (!clarification) fail('NOT_FOUND', 'Open clarification was not found.');

    const updated = await db.$transaction(async tx => {
      const result = await tx.refinementClarification.updateMany({
        where: { id: clarification.id, status: 'OPEN', updatedAt: expectedUpdatedAt },
        data: {
          response,
          responseEvidence:
            typeof payload.responseEvidence === 'string' && payload.responseEvidence.trim()
              ? payload.responseEvidence.trim()
              : null,
          status: 'RESPONDED',
          respondedById: user.id,
          respondedAt: new Date()
        }
      });
      if (result.count !== 1) {
        fail('CONCURRENT_MODIFICATION', 'The clarification changed after it was opened. Reload before responding.');
      }
      if (payload.responseEvidence?.trim()) {
        await tx.humanRefinementEvidence.create({
          data: {
            findingId: clarification.finding.id,
            type: 'CLARIFICATION_RESPONSE',
            description: payload.responseEvidence.trim(),
            addedById: user.id
          }
        });
      }
      const current = await tx.refinementClarification.findUnique({
        where: { id: clarification.id },
        include
      });
      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId: clarification.requestedBusinessUnitId,
        entity: 'HumanRefinementFinding',
        entityId: clarification.finding.id,
        action: 'CLARIFICATION_RESPONDED',
        previousState: 'OPEN',
        resultingState: 'RESPONDED',
        metadata: { clarificationId: clarification.id }
      });
      return current;
    });
    return json(serial(clarificationDto(updated)));
  } catch (cause) {
    return error(cause);
  }
}
