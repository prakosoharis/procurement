import { scopeWhere } from '../authorization/scope.js';

export function peopleBusinessUnitWhere(user) {
  return scopeWhere(user, 'businessUnit');
}
