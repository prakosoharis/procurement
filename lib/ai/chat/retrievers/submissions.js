import { isBusinessUnitScoped, effectiveBusinessUnitIds } from '../../../authorization/scope.js';

// Submissions are scoped through the requester's Business Unit, matching the
// existing submission read rules.
export async function retrieveSubmissions({ actor, db, limit = 25 }) {
  const where = {};
  if (isBusinessUnitScoped(actor)) {
    const ids = effectiveBusinessUnitIds(actor);
    where.requester = { businessUnitId: ids.length ? { in: ids } : '__no-business-unit-access__' };
  }

  const requests = await db.sopRequest.findMany({
    where,
    select: {
      id: true, title: true, status: true, priority: true, createdAt: true, reviewedAt: true,
      requester: { select: { name: true, businessUnit: { select: { name: true } } } },
      sopDocument: { select: { title: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return {
    topic: 'submissions',
    records: requests.map((request) => ({
      type: 'SUBMISSION',
      id: request.id,
      label: request.title,
      status: request.status,
      priority: request.priority,
      businessUnit: request.requester?.businessUnit?.name || null,
      requestedBy: request.requester?.name || null,
      relatedSop: request.sopDocument?.title || null,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt
    }))
  };
}
