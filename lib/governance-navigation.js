import { Permission, can } from './authorization/permissions';

export const navigationGroups = [
  { label: 'Overview', items: [{ href: '/dashboard', label: 'Dashboard', permission: Permission.DASHBOARD_VIEW }] },
  { label: 'SOP Governance', items: [
    { href: '/sop-governance/repository', label: 'Repository', permission: Permission.SOP_REPOSITORY_VIEW },
    { href: '/sop-governance/requests', label: 'SOP Requests', permission: Permission.SOP_REQUEST_VIEW },
    { href: '/sop-governance/refinement', label: 'Refinement', permission: Permission.REFINEMENT_VIEW },
    { href: '/sop-governance/validation', label: 'Validation', permission: Permission.VALIDATION_VIEW },
    { href: '/sop-governance/publish', label: 'Publish', permission: Permission.PUBLISH_VIEW }
  ] },
  { label: 'Audit & Monitoring', items: [
    { href: '/audit/reviews', label: 'Review Schedule', permission: Permission.AUDIT_VIEW },
    { href: '/audit/findings', label: 'Findings', permission: Permission.FINDINGS_VIEW },
    { href: '/audit/actions', label: 'Action Tracking', permission: Permission.ACTIONS_VIEW }
  ] },
  { label: 'AI', items: [{ href: '/copilot', label: 'AI Copilot', permission: Permission.COPILOT_USE }] },
  { label: 'Governance', items: [
    { href: '/governance/references', label: 'Reference Library', permission: Permission.REFERENCES_VIEW },
    { href: '/governance/business-units', label: 'Business Units', permission: Permission.BUSINESS_UNITS_VIEW },
    { href: '/governance/users', label: 'Users & Roles', permission: Permission.USERS_MANAGE },
    { href: '/governance/activity-log', label: 'Activity Log', permission: Permission.ACTIVITY_LOG_VIEW }
  ] },
  { label: 'System', items: [{ href: '/settings', label: 'Settings', permission: Permission.SETTINGS_MANAGE }] }
];

export function navigationFor(user) {
  return navigationGroups.map((group) => ({ ...group, items: group.items.filter((item) => can(user, item.permission)) })).filter((group) => group.items.length);
}
