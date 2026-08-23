import { actor, body, error, json, serial } from '../../../../../../../lib/api/governance';
import { decideRefinementFinding } from '../../../../../../../lib/governance/validation/finding-decision-service';

// Human validation of an AI candidate finding. This route is a thin entry point
// onto the existing decision service, which already enforces role, Business Unit
// scope, mandatory comments, the ValidationDecision record, and the audit event.
// Do not add a second decision path here.
export const dynamic = 'force-dynamic';

// Product vocabulary from the Refinement blueprint, mapped onto the existing
// ValidationDecisionType enum. Raw enum values stay accepted for callers that
// already use them.
const decisionAliases = Object.freeze({
  VALID: 'ACCEPTED',
  REVISI: 'ACCEPTED_WITH_MODIFICATION',
  ABAIKAN: 'REJECTED'
});

export async function POST(request, { params }) {
  try {
    const user = await actor();
    const { findingId } = await params;
    const payload = await body(request);
    const requested = String(payload?.decision || '').toUpperCase();

    const updated = await decideRefinementFinding({
      findingId,
      decision: decisionAliases[requested] || requested,
      actor: user,
      comment: payload?.comment,
      metadata: payload?.metadata || {}
    });
    return json(serial({ id: updated.id, humanStatus: updated.humanStatus }));
  } catch (caught) {
    return error(caught);
  }
}
