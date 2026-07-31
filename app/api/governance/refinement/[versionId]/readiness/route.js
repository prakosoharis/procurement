import { actor, error, json, serial } from '../../../../../../lib/api/governance';
import { getRefinementReadiness } from '../../../../../../lib/governance/refinement/completion-service';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    return json(serial(await getRefinementReadiness({ versionId, actor: user })));
  } catch (cause) {
    return error(cause);
  }
}
