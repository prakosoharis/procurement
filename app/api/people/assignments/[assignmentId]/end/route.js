import { actor, body, error, json } from '../../../../../../lib/api/governance';
import { endPositionAssignment } from '../../../../../../lib/people/assignment-service';

export async function POST(request, { params }) {
  try { const { assignmentId } = await params; return json(await endPositionAssignment(await actor(), assignmentId, await body(request))); }
  catch (exception) { return error(exception); }
}
