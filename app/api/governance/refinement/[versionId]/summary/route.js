import { actor, body, error, json, serial } from '../../../../../../lib/api/governance';
import { saveRefinementSummary } from '../../../../../../lib/governance/refinement/completion-service';
import { scopedRefinementSession } from '../../../../../../lib/governance/refinement/human-workspace-data';
import { db } from '../../../../../../lib/db';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    const { session } = await scopedRefinementSession(db, user, versionId);
    return json(serial({ id: session.id, summary: session.summary, updatedAt: session.updatedAt, status: session.status }));
  } catch (cause) {
    return error(cause);
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await actor();
    const payload = await body(request);
    const { versionId } = await params;
    return json(serial(await saveRefinementSummary({
      versionId,
      actor: user,
      summary: payload.summary,
      expectedUpdatedAt: payload.expectedUpdatedAt
    })));
  } catch (cause) {
    return error(cause);
  }
}
