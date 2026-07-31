import { db } from '../../../../../../lib/db';
import { actor, body, error, json, serial } from '../../../../../../lib/api/governance';
import { can, Permission } from '../../../../../../lib/authorization/permissions';
import { fail } from '../../../../../../lib/governance/errors';
import { recordGovernanceEvent } from '../../../../../../lib/governance/activity/governance-audit-log';
import {
  parseFindingInput
} from '../../../../../../lib/governance/refinement/human-workspace';
import {
  findingInclude,
  scopedRefinementSession
} from '../../../../../../lib/governance/refinement/human-workspace-data';
import { findingDto } from '../../../../../../lib/governance/refinement/human-workspace-dto';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { versionId } = await params;
    const { session } = await scopedRefinementSession(db, user, versionId);
    const findings = await db.humanRefinementFinding.findMany({
      where: { refinementSessionId: session.id },
      include: findingInclude,
      orderBy: [{ blocking: 'desc' }, { createdAt: 'desc' }]
    });
    return json(serial(findings.map(findingDto)));
  } catch (cause) {
    return error(cause);
  }
}

export async function POST(request, { params }) {
  try {
    const user = await actor();
    if (!can(user, Permission.REFINEMENT_RUN)) {
      fail('FORBIDDEN', 'Tim Procurement authority is required.');
    }
    const input = parseFindingInput(await body(request));
    const { versionId } = await params;
    const { session, businessUnitId } = await scopedRefinementSession(db, user, versionId);

    const finding = await db.$transaction(async tx => {
      const created = await tx.humanRefinementFinding.create({
        data: {
          refinementSessionId: session.id,
          ...input,
          createdById: user.id
        },
        include: findingInclude
      });
      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId,
        entity: 'HumanRefinementFinding',
        entityId: created.id,
        action: 'FINDING_CREATED',
        resultingState: created.status,
        metadata: {
          severity: created.severity,
          blocking: created.blocking,
          category: created.category
        }
      });
      return created;
    });

    return json(serial(findingDto(finding)), 201);
  } catch (cause) {
    return error(cause);
  }
}
