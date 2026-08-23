import { peoplePositionScopeWhere } from '../../../people/scope.js';

// Organisation positions and their current occupants. Chat never receives
// personal contact data, certification credential IDs, or evidence links for
// any role — the assistant has no use for them, so they are excluded outright
// rather than filtered per role.
export async function retrievePeople({ actor, db, limit = 60 }) {
  const positions = await db.organizationPosition.findMany({
    where: { status: 'ACTIVE', ...peoplePositionScopeWhere(actor) },
    select: {
      id: true, title: true, code: true, displayOrder: true,
      businessUnit: { select: { name: true } },
      organizationGroup: { select: { name: true } },
      parent: { select: { title: true } },
      assignments: {
        where: { endDate: null },
        select: { type: true, startDate: true, person: { select: { fullName: true, status: true } } }
      }
    },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    take: limit
  });

  return {
    topic: 'people',
    records: positions.map((position) => ({
      type: 'ORGANIZATION_POSITION',
      id: position.id,
      label: position.title,
      code: position.code,
      scope: position.businessUnit?.name || position.organizationGroup?.name || null,
      reportsTo: position.parent?.title || null,
      vacant: position.assignments.length === 0,
      occupants: position.assignments.map((assignment) => ({
        name: assignment.person?.fullName || null,
        assignmentType: assignment.type,
        since: assignment.startDate
      }))
    }))
  };
}
