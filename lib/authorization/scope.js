import { Role } from './roles.js';
import { canAccessAcrossBusinessUnits } from './permissions.js';

export class AuthorizationError extends Error {
  constructor(message = 'Akses ditolak.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function isBusinessUnitScoped(user) {
  return user?.role === Role.BUSINESS_UNIT;
}

export function effectiveBusinessUnitIds(user) {
  return [...new Set([user?.businessUnitId, ...(user?.businessUnitScopes || []).map(scope => scope.businessUnitId)].filter(Boolean))];
}

// Use this before building Prisma queries. CP2 will extend this helper with
// UserBusinessUnitScope while retaining User.businessUnitId compatibility.
export function scopeWhere(user, resource) {
  if (!isBusinessUnitScoped(user)) return {};
  const ids = effectiveBusinessUnitIds(user);
  if (!ids.length) return { id: '__no-business-unit-access__' };
  if (resource === 'businessUnit') return { id: { in: ids } };
  if (resource === 'user') return { businessUnitId: { in: ids } };
  return { businessUnitId: { in: ids } };
}

export function assertBusinessUnitScope(user, businessUnitId) {
  if (!user) throw new AuthorizationError('Authentication required.');
  if (canAccessAcrossBusinessUnits(user)) return true;
  if (effectiveBusinessUnitIds(user).includes(businessUnitId)) return true;
  throw new AuthorizationError('Anda tidak memiliki akses ke Business Unit ini.');
}
