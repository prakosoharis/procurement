import { Role, isRole } from './roles.js';

export const Permission = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  SOP_REPOSITORY_VIEW: 'sop.repository.view',
  SOP_REPOSITORY_MANAGE: 'sop.repository.manage',
  SOP_REQUEST_VIEW: 'sop.request.view',
  SOP_REQUEST_CREATE: 'sop.request.create',
  REFINEMENT_VIEW: 'refinement.view',
  REFINEMENT_RUN: 'refinement.run',
  VALIDATION_VIEW: 'validation.view',
  VALIDATION_DECIDE: 'validation.decide',
  PUBLISH_VIEW: 'publish.view',
  PUBLISH_EXECUTE: 'publish.execute',
  AUDIT_VIEW: 'audit.view',
  AUDIT_MANAGE: 'audit.manage',
  FINDINGS_VIEW: 'findings.view',
  FINDINGS_MANAGE: 'findings.manage',
  ACTIONS_VIEW: 'actions.view',
  ACTIONS_MANAGE: 'actions.manage',
  COPILOT_USE: 'copilot.use',
  REFERENCES_VIEW: 'references.view',
  REFERENCES_MANAGE: 'references.manage',
  BUSINESS_UNITS_VIEW: 'business-units.view',
  USERS_MANAGE: 'users.manage',
  ACTIVITY_LOG_VIEW: 'activity-log.view',
  SETTINGS_MANAGE: 'settings.manage'
});

const allRoles = [Role.SUPERUSER, Role.PROCUREMENT_TEAM, Role.BUSINESS_UNIT, Role.EXECUTIVE];
const governanceRoles = [Role.SUPERUSER, Role.PROCUREMENT_TEAM];
const auditRoles = [Role.SUPERUSER, Role.PROCUREMENT_TEAM, Role.EXECUTIVE];

const policy = Object.freeze({
  [Permission.DASHBOARD_VIEW]: allRoles,
  [Permission.SOP_REPOSITORY_VIEW]: allRoles,
  [Permission.SOP_REPOSITORY_MANAGE]: governanceRoles,
  [Permission.SOP_REQUEST_VIEW]: [Role.SUPERUSER, Role.PROCUREMENT_TEAM, Role.BUSINESS_UNIT],
  [Permission.SOP_REQUEST_CREATE]: [Role.SUPERUSER, Role.PROCUREMENT_TEAM, Role.BUSINESS_UNIT],
  [Permission.REFINEMENT_VIEW]: allRoles,
  [Permission.REFINEMENT_RUN]: governanceRoles,
  [Permission.VALIDATION_VIEW]: auditRoles,
  [Permission.VALIDATION_DECIDE]: governanceRoles,
  [Permission.PUBLISH_VIEW]: auditRoles,
  [Permission.PUBLISH_EXECUTE]: governanceRoles,
  [Permission.AUDIT_VIEW]: allRoles,
  [Permission.AUDIT_MANAGE]: governanceRoles,
  [Permission.FINDINGS_VIEW]: allRoles,
  [Permission.FINDINGS_MANAGE]: governanceRoles,
  [Permission.ACTIONS_VIEW]: allRoles,
  [Permission.ACTIONS_MANAGE]: governanceRoles,
  [Permission.COPILOT_USE]: allRoles,
  [Permission.REFERENCES_VIEW]: allRoles,
  [Permission.REFERENCES_MANAGE]: governanceRoles,
  [Permission.BUSINESS_UNITS_VIEW]: auditRoles,
  [Permission.USERS_MANAGE]: [Role.SUPERUSER],
  [Permission.ACTIVITY_LOG_VIEW]: auditRoles,
  [Permission.SETTINGS_MANAGE]: [Role.SUPERUSER]
});

export function can(user, permission) {
  if (!user?.role) return false;
  const allowedRoles = policy[permission] || [];
  return isRole(user.role, ...allowedRoles);
}

export function canAccessAcrossBusinessUnits(user) {
  return isRole(user?.role, Role.SUPERUSER, Role.PROCUREMENT_TEAM, Role.EXECUTIVE);
}
