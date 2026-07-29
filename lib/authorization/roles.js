// Database roles remain backward-compatible during CP1. EXECUTIVE is reserved
// here and will be added to Prisma only in CP2.
export const Role = Object.freeze({
  SUPERUSER: 'SUPER_USER',
  PROCUREMENT_TEAM: 'CORPORATE_GOVERNANCE',
  BUSINESS_UNIT: 'BUSINESS_UNIT_PIC',
  EXECUTIVE: 'EXECUTIVE'
});

const roleDefinitions = Object.freeze({
  [Role.SUPERUSER]: { key: 'SUPERUSER', label: 'Superuser (Admin)', description: 'Administrasi platform dan emergency override' },
  [Role.PROCUREMENT_TEAM]: { key: 'PROCUREMENT_TEAM', label: 'Tim Procurement', description: 'Governance, approval, dan publishing reguler' },
  [Role.BUSINESS_UNIT]: { key: 'BUSINESS_UNIT', label: 'Business Unit', description: 'Business Unit Compliance / PIC' },
  [Role.EXECUTIVE]: { key: 'EXECUTIVE', label: 'Executive', description: 'Director / Executive' }
});

export function roleDefinition(role) {
  return roleDefinitions[role] || { key: 'UNKNOWN', label: 'Unknown role', description: '' };
}

export function roleDisplayName(role) {
  return roleDefinition(role).label;
}

export function isRole(role, ...roles) {
  return Boolean(role) && roles.includes(role);
}
