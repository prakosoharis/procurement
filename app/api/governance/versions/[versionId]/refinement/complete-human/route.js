import { actor, body, error, json, serial } from '../../../../../../../lib/api/governance';
import { completeHumanRefinement } from '../../../../../../../lib/governance';

export async function POST(request, { params }) {
  try {
    const user = await actor();
    const payload = await body(request);
    const { versionId } = await params;
    return json(serial(await completeHumanRefinement({
      versionId,
      actor: user,
      expectedState: payload.expectedState,
      expectedUpdatedAt: payload.expectedUpdatedAt,
      reason: payload.reason
    })));
  } catch (cause) {
    return error(cause);
  }
}
