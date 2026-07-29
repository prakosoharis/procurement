import { Role } from './roles';
import { canAccessAcrossBusinessUnits } from './permissions';

export class AuthorizationError extends Error {
  constructor(message = 'Akses ditolak.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function isBusinessUnitScoped(user) {
  return user?.role === Role.BUSINESS_UNIT;
}

// Use this before building Prisma queries. CP2 will extend this helper with
// UserBusinessUnitScope while retaining User.businessUnitId compatibility.
export function scopeWhere(user, resource) {
  if (!isBusinessUnitScoped(user)) return {};
  if (!user.businessUnitId) return { id: '__no-business-unit-access__' };
  if (resource === 'businessUnit') return { id: user.businessUnitId };
  if (resource === 'user') return { businessUnitId: user.businessUnitId };
  return { businessUnitId: user.businessUnitId };
}

export function assertBusinessUnitScope(user, businessUnitId) {
  if (!user) throw new AuthorizationError('Authentication required.');
  if (canAccessAcrossBusinessUnits(user)) return true;
  if (user.businessUnitId && user.businessUnitId === businessUnitId) return true;
  throw new AuthorizationError('Anda tidak memiliki akses ke Business Unit ini.');
}
