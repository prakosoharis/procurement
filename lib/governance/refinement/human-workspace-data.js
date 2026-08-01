import { scopeWhere } from '../../authorization/scope.js';
import { fail } from '../errors.js';

export const findingInclude = {
  createdBy: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
  evidence: {
    include: { addedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' }
  },
  clarifications: {
    include: {
      requestedBy: { select: { id: true, name: true } },
      requestedBusinessUnit: { select: { id: true, name: true } },
      respondedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } }
    },
    orderBy: { dueAt: 'asc' }
  }
};

export async function scopedRefinementSession(db, actor, versionId, include = {}) {
  const version = await db.sopVersion.findFirst({
    where: {
      id: versionId,
      lifecycleState: 'REFINEMENT',
      sopDocument: { ...scopeWhere(actor, 'sopDocument') }
    },
    include: {
      sopDocument: { select: { id: true, businessUnitId: true } },
      refinementSessions: {
        orderBy: { cycleNo: 'desc' },
        take: 1,
        include
      }
    }
  });
  const session = version?.refinementSessions[0];
  if (!session) fail('NOT_FOUND', 'Refinement session not found.');
  return { version, session, businessUnitId: version.sopDocument.businessUnitId };
}

export async function scopedFinding(db, actor, versionId, findingId, include = findingInclude) {
  const { session, businessUnitId } = await scopedRefinementSession(db, actor, versionId);
  const finding = await db.humanRefinementFinding.findFirst({
    where: { id: findingId, refinementSessionId: session.id },
    include
  });
  if (!finding) fail('NOT_FOUND', 'Finding not found.');
  return { finding, session, businessUnitId };
}

