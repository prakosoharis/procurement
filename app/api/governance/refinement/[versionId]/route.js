import { db } from '../../../../../lib/db';
import { actor, error, json, serial } from '../../../../../lib/api/governance';
import { scopeWhere } from '../../../../../lib/authorization/scope';
import { refinementCapabilities } from '../../../../../lib/governance/refinement/human-workspace';
import { fail } from '../../../../../lib/governance/errors';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    const version = await db.sopVersion.findFirst({
      where: {
        id: versionId,
        lifecycleState: 'REFINEMENT',
        sopDocument: { ...scopeWhere(user, 'sopDocument') }
      },
      include: {
        sopDocument: { include: { businessUnit: true } },
        refinementSessions: { orderBy: { cycleNo: 'desc' }, take: 1 }
      }
    });
    if (!version) fail('NOT_FOUND', 'Refinement workspace not found.');

    return json(serial({
      versionId: version.id,
      version: version.versionNo,
      versionUpdatedAt: version.updatedAt,
      sop: { id: version.sopDocumentId, title: version.sopDocument.title },
      businessUnit: version.sopDocument.businessUnit,
      file: {
        name: version.fileName,
        contentType: version.contentType,
        key: version.fileKey
      },
      session: version.refinementSessions[0] || null,
      capabilities: refinementCapabilities(
        user,
        version.sopDocument.businessUnitId,
        version.lifecycleState
      )
    }));
  } catch (cause) {
    return error(cause);
  }
}
