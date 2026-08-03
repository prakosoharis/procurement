import { actor, body, error, json } from '../../../../lib/api/governance';
import { assignPerson } from '../../../../lib/people/assignment-service';

export async function POST(request) {
  try { return json(await assignPerson(await actor(), await body(request)), 201); }
  catch (exception) { return error(exception); }
}
