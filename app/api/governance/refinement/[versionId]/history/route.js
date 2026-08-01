import { db } from '../../../../../../lib/db';
import { actor, error, json, serial } from '../../../../../../lib/api/governance';
import { scopedRefinementSession } from '../../../../../../lib/governance/refinement/human-workspace-data';
import { historyDto } from '../../../../../../lib/governance/refinement/human-workspace-dto';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    const { session } = await scopedRefinementSession(db, user, versionId, {
      humanFindings: { select: { id: true } }
    });
    const ids = session.humanFindings.map(finding => finding.id);
    const history = ids.length
      ? await db.auditLog.findMany({
          where: { entity: 'HumanRefinementFinding', entityId: { in: ids } },
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        })
      : [];
    return json(serial(history.map(historyDto)));
  } catch (cause) {
    return error(cause);
  }
}
