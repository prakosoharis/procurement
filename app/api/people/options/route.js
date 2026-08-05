import { db } from '../../../../lib/db';
import { actor, error, json } from '../../../../lib/api/governance';
import { domain } from '../../../../lib/api/governance';
import { peopleCapabilities } from '../../../../lib/people/capabilities';
import { peopleBusinessUnitWhere, peopleOrganizationGroupWhere } from '../../../../lib/people/scope';

// Bootstrap data for the People shell. More detailed structure and profile
// DTOs are deliberately separate endpoints so the chart never receives an
// unrestricted people directory or biography data by default.
export async function GET() {
  try {
    const user = await actor();
    const capabilities = peopleCapabilities(user);
    if (!capabilities.canView) throw domain('FORBIDDEN', 'People access is not available for this role.');

    const [businessUnits, organizationGroups] = await Promise.all([
      db.businessUnit.findMany({
        where: peopleBusinessUnitWhere(user),
        select: { id: true, name: true, groupName: true, industry: true },
        orderBy: { name: 'asc' }
      }),
      db.organizationGroup.findMany({
        where: peopleOrganizationGroupWhere(user),
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      })
    ]);

    const preferredBusinessUnit = businessUnits.find((unit) => unit.id === user.businessUnitId) || businessUnits[0] || null;
    return json({
      businessUnits,
      organizationGroups,
      defaultBusinessUnitId: preferredBusinessUnit?.id || null,
      defaultScope: preferredBusinessUnit ? { type: 'BUSINESS_UNIT', id: preferredBusinessUnit.id } : null,
      capabilities
    });
  } catch (exception) {
    return error(exception);
  }
}
