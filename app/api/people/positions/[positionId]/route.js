import { actor, body, error, json } from '../../../../../lib/api/governance';
import { fail } from '../../../../../lib/governance/errors';
import {
  archiveOrganizationPosition,
  moveOrganizationPosition,
  updateOrganizationPosition
} from '../../../../../lib/people/organization-service';

export async function PATCH(request, { params }) {
  try {
    const user = await actor();
    const { positionId } = await params;
    const input = await body(request);
    let result;
    if (input.operation === 'update') result = await updateOrganizationPosition(user, positionId, input);
    else if (input.operation === 'move') result = await moveOrganizationPosition(user, positionId, input);
    else if (input.operation === 'archive') result = await archiveOrganizationPosition(user, positionId, input);
    else fail('INVALID_INPUT', 'operation must be update, move, or archive.');
    return json(result);
  } catch (exception) {
    return error(exception);
  }
}
