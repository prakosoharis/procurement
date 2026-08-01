import { Role } from '../authorization/roles.js';
import { fail } from './errors.js';
import { effectiveBusinessUnitIds } from '../authorization/scope.js';
export const isGovernanceActor = actor => [Role.SUPERUSER, Role.PROCUREMENT_TEAM].includes(actor?.role);
export function assertActor(actor) { if (!actor?.id || !actor?.role) fail('UNAUTHORIZED', 'Authentication required.'); }
export function assertScope(actor, businessUnitId) {
  assertActor(actor);
  if (isGovernanceActor(actor)) return;
  if (actor.role !== Role.BUSINESS_UNIT) fail('FORBIDDEN', 'This role is read-only.');
  if (!effectiveBusinessUnitIds(actor).includes(businessUnitId)) fail('OUT_OF_SCOPE', 'Business Unit scope is required.');
}
export function assertGovernanceActor(actor) { assertActor(actor); if (!isGovernanceActor(actor)) fail('FORBIDDEN', 'Tim Procurement authority is required.'); }
export function assertSuperuserOverride(actor, target, { overrideReason, notes } = {}) {
  if (actor.role === Role.SUPERUSER && ['APPROVED','READY_TO_PUBLISH','PUBLISHED'].includes(target) && (!overrideReason || !notes)) fail('ADMIN_OVERRIDE_REASON_REQUIRED', 'Superuser approval, publishing, or official override requires overrideReason and supporting notes.');
}
