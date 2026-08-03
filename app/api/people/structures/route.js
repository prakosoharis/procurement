import { actor, body, error, json } from '../../../../lib/api/governance';
import { createOrganizationStructure } from '../../../../lib/people/organization-service';

export async function POST(request) {
  try {
    const user = await actor();
    const created = await createOrganizationStructure(user, await body(request));
    return json(created, 201);
  } catch (exception) {
    return error(exception);
  }
}
