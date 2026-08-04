import { canAccessAcrossBusinessUnits } from '../authorization/permissions.js';
import { assertBusinessUnitScope, effectiveBusinessUnitIds, isBusinessUnitScoped, scopeWhere } from '../authorization/scope.js';
import { fail } from '../governance/errors.js';

export function peopleBusinessUnitWhere(user) {
  return scopeWhere(user, 'businessUnit');
}

export function peopleOrganizationGroupWhere(user) {
  if (!isBusinessUnitScoped(user)) return {};
  const ids = effectiveBusinessUnitIds(user);
  if (!ids.length) return { id: '__no-people-group-access__' };
  return { businessUnits: { some: { id: { in: ids } } } };
}

export function peoplePositionScopeWhere(user) {
  if (!isBusinessUnitScoped(user)) return {};
  const ids = effectiveBusinessUnitIds(user);
  if (!ids.length) return { id: '__no-people-position-access__' };
  return {
    OR: [
      { businessUnitId: { in: ids } },
      { organizationGroup: { businessUnits: { some: { id: { in: ids } } } } }
    ]
  };
}

export async function assertPeopleScope(tx, actor, { businessUnitId, organizationGroupId }) {
  if (canAccessAcrossBusinessUnits(actor)) return true;
  if (!isBusinessUnitScoped(actor)) fail('FORBIDDEN', 'People access is not available for this role.');
  if (businessUnitId) return assertBusinessUnitScope(actor, businessUnitId);
  const ids = effectiveBusinessUnitIds(actor);
  if (!organizationGroupId || !ids.length) fail('OUT_OF_SCOPE', 'You do not have access to this organization scope.');
  const member = await tx.businessUnit.findFirst({
    where: { id: { in: ids }, organizationGroupId },
    select: { id: true }
  });
  if (!member) fail('OUT_OF_SCOPE', 'You do not have access to this organization scope.');
  return true;
}
