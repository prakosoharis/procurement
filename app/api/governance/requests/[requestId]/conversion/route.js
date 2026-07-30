import { actor, body, error, json, serial } from '../../../../../../lib/api/governance';
import { convertApprovedSubmission } from '../../../../../../lib/governance';
import { assertSubmissionConversionInput } from '../../../../../../lib/governance/requests/submission-conversion-contract';

export async function POST(request, { params }) {
  try {
    const user = await actor();
    const input = assertSubmissionConversionInput(await body(request));
    const { requestId } = await params;
    const result = await convertApprovedSubmission({ requestId, actor: user, ...input });
    return json(serial(result), result.idempotent ? 200 : 201);
  } catch (caught) {
    return error(caught);
  }
}
