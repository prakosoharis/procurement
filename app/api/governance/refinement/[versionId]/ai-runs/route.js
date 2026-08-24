import { actor, body, error, json, serial } from '../../../../../../lib/api/governance';
import { asGovernanceError } from '../../../../../../lib/ai/errors';
import { listRefinementAnalyses, startRefinementAnalysis } from '../../../../../../lib/ai/refinement/run-service';
import { refinementAnalysis } from '../../../../../../trigger/refinement-analysis';

// AI-assisted analysis for one SOP version. The result is a candidate finding
// set for human validation; it never approves a finding, edits the official
// SOP, or publishes anything.
export const dynamic = 'force-dynamic';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    return json(serial(await listRefinementAnalyses(user, versionId)));
  } catch (caught) {
    return error(asGovernanceError(caught));
  }
}

export async function POST(request, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    const payload = await body(request);
    const result = await startRefinementAnalysis(user, versionId, {
      sourceIds: payload?.sourceIds,
      enqueue: (jobId) => refinementAnalysis.trigger({ jobId })
    });
    // 200 for a reused or already-running analysis, 202 for newly queued work.
    return json(serial(result), result.queued ? 202 : 200);
  } catch (caught) {
    return error(asGovernanceError(caught));
  }
}
