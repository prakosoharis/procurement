import { actor, body, error, json } from '../../../../../lib/api/governance';
import { fail } from '../../../../../lib/governance/errors';
import { archivePersonProfile, getPersonProfile, updatePersonProfile } from '../../../../../lib/people/profile-service';

export async function GET(_request, { params }) {
  try { const { personId } = await params; return json(await getPersonProfile(await actor(), personId)); }
  catch (exception) { return error(exception); }
}

export async function PATCH(request, { params }) {
  try {
    const { personId } = await params;
    const input = await body(request);
    const user = await actor();
    if (input.operation === 'update') return json(await updatePersonProfile(user, personId, input));
    if (input.operation === 'archive') return json(await archivePersonProfile(user, personId, input));
    fail('INVALID_INPUT', 'operation must be update or archive.');
  } catch (exception) { return error(exception); }
}
