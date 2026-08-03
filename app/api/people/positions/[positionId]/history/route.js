import { actor, error, json } from '../../../../../../lib/api/governance';
import { getPositionAssignmentHistory } from '../../../../../../lib/people/assignment-service';

export async function GET(_request, { params }) {
  try { const { positionId } = await params; return json(await getPositionAssignmentHistory(await actor(), positionId)); }
  catch (exception) { return error(exception); }
}
