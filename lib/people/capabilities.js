import { can, Permission } from '../authorization/permissions.js';

// Keep People UI decisions server-derived. The browser receives only these
// action flags, never raw roles or a Business Unit scope list.
export function peopleCapabilities(user) {
  return {
    canView: can(user, Permission.PEOPLE_VIEW),
    canEditStructure: can(user, Permission.PEOPLE_STRUCTURE_MANAGE),
    canManagePeople: can(user, Permission.PEOPLE_PROFILE_MANAGE),
    canManageAssignments: can(user, Permission.PEOPLE_ASSIGNMENT_MANAGE)
  };
}
