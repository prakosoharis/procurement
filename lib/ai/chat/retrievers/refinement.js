import { scopeWhere } from '../../../authorization/scope.js';

// Refinement sessions and their human findings, scoped by Business Unit before
// the query is built.
export async function retrieveRefinement({ actor, db, limit = 20 }) {
  const sessions = await db.refinementSession.findMany({
    where: scopeWhere(actor, 'refinementSession'),
    select: {
      id: true, status: true, cycleNo: true, mode: true, summary: true, startedAt: true, completedAt: true,
      businessUnit: { select: { name: true } },
      sopVersion: { select: { versionNo: true, sopDocument: { select: { id: true, title: true } } } },
      humanFindings: {
        select: { id: true, title: true, category: true, severity: true, status: true, blocking: true, recommendation: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    },
    orderBy: { updatedAt: 'desc' },
    take: limit
  });

  const records = [];
  for (const session of sessions) {
    records.push({
      type: 'REFINEMENT_SESSION',
      id: session.id,
      label: `Refinement ${session.sopVersion?.sopDocument?.title || 'SOP'} ${session.sopVersion?.versionNo || ''}`.trim(),
      businessUnit: session.businessUnit?.name || null,
      status: session.status,
      cycleNo: session.cycleNo,
      mode: session.mode,
      summary: session.summary,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      openFindings: session.humanFindings.filter((finding) => finding.status === 'OPEN').length
    });
    for (const finding of session.humanFindings) {
      records.push({
        type: 'REFINEMENT_FINDING',
        id: finding.id,
        label: finding.title,
        relatedSop: session.sopVersion?.sopDocument?.title || null,
        businessUnit: session.businessUnit?.name || null,
        category: finding.category,
        severity: finding.severity,
        status: finding.status,
        blocking: finding.blocking,
        recommendation: finding.recommendation
      });
    }
  }

  return { topic: 'refinement', records };
}
