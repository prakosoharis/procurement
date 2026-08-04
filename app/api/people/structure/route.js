import { actor, error, json } from '../../../../lib/api/governance';
import { fail } from '../../../../lib/governance/errors';
import { getOrganizationStructure } from '../../../../lib/people/organization-service';

export async function GET(request) {
  try {
    const user = await actor();
    const url = new URL(request.url);
    const scopeType = url.searchParams.get('scopeType') || 'BUSINESS_UNIT';
    const scopeId = url.searchParams.get('scopeId') || url.searchParams.get('businessUnitId');
    if (!scopeId) fail('INVALID_INPUT', 'scopeId is required.');
    return json(await getOrganizationStructure(user, scopeType === 'GROUP' ? { scopeType: 'GROUP', organizationGroupId: scopeId } : { scopeType: 'BUSINESS_UNIT', businessUnitId: scopeId }));
  } catch (exception) {
    return error(exception);
  }
}
