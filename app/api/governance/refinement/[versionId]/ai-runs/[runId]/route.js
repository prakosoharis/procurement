import { actor, error, json, serial } from '../../../../../../../lib/api/governance';
import { asGovernanceError } from '../../../../../../../lib/ai/errors';
import { getRefinementAnalysis } from '../../../../../../../lib/ai/refinement/run-service';

// Status and candidate findings for one analysis. The stored provider error
// message is deliberately not returned; only its classified type is.
export const dynamic = 'force-dynamic';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { runId } = await params;
    return json(serial(await getRefinementAnalysis(user, runId)));
  } catch (caught) {
    return error(asGovernanceError(caught));
  }
}
