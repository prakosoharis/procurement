import { actor, error, json } from '../../../../lib/api/governance';
import { fail } from '../../../../lib/governance/errors';
import { getOrganizationStructure } from '../../../../lib/people/organization-service';

export async function GET(request) {
  try {
    const user = await actor();
    const businessUnitId = new URL(request.url).searchParams.get('businessUnitId');
    if (!businessUnitId) fail('INVALID_INPUT', 'businessUnitId is required.');
    return json(await getOrganizationStructure(user, businessUnitId));
  } catch (exception) {
    return error(exception);
  }
}
