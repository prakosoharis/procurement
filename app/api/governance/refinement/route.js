import { db } from '../../../../lib/db';
import { actor, error, json, serial } from '../../../../lib/api/governance';
import { scopeWhere } from '../../../../lib/authorization/scope';

const PAGE_SIZE = 20;

export async function GET(request) {
  try {
    const user = await actor();
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const search = params.get('search')?.trim();
    const businessUnitId = params.get('businessUnitId') || undefined;
    const blockingOnly = params.get('blockingOnly') === 'true';
    const where = {
      lifecycleState: 'REFINEMENT',
      sopDocument: {
        ...scopeWhere(user, 'sopDocument'),
        ...(businessUnitId ? { businessUnitId } : {}),
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {})
      }
    };
    const [total, versions] = await Promise.all([
      db.sopVersion.count({ where }),
      db.sopVersion.findMany({
        where,
        include: { sopDocument: { include: { businessUnit: true } }, reviewer: true },
        orderBy: { updatedAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE
      })
    ]);
    const items = versions.map(version => {
      return {
        versionId: version.id, sopDocumentId: version.sopDocumentId, sop: version.sopDocument.title,
        businessUnit: { id: version.sopDocument.businessUnit.id, name: version.sopDocument.businessUnit.name },
        version: version.versionNo, lifecycleState: version.lifecycleState,
        blockingFindings: 0, workStatus: 'NEW',
        reviewer: version.reviewer ? { id: version.reviewer.id, name: version.reviewer.name } : null,
        lastActivityAt: version.updatedAt
      };
    }).filter(item => !blockingOnly || item.blockingFindings > 0);
    return json(serial({ items, page, pageSize: PAGE_SIZE, total: blockingOnly ? items.length : total }));
  } catch (cause) {
    return error(cause);
  }
}
