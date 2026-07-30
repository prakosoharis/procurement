import { db } from '../../../../../lib/db';
import { actor, body, domain, error, json, serial } from '../../../../../lib/api/governance';
import { assertGovernanceActor } from '../../../../../lib/governance/authorization';
import { canConvertSubmission } from '../../../../../lib/governance/requests/submission-conversion-capabilities';
import { canPostRequestDiscussion } from '../../../../../lib/governance/requests/discussion';

export async function GET(_, { params }) {
  try {
    const user = await actor();
    const { requestId } = await params;
    const where = user.role === 'BUSINESS_UNIT_PIC'
      ? { id: requestId, requesterId: user.id }
      : { id: requestId };
    const request = await db.sopRequest.findFirst({
      where,
      include: {
        requester: { select: { id: true, name: true } },
        sopDocument: { select: { id: true, title: true, businessUnitId: true, publishedVersionId: true } },
        conversion: { select: { id: true, mode: true, sopDocumentId: true, sopVersionId: true } },
        messages: {
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!request) throw domain('NOT_FOUND', 'Request not found.');

    return json(serial({
      ...request,
      capabilities: {
        canAddDiscussionMessage: canPostRequestDiscussion(user, request.status),
        canConvertSubmission: canConvertSubmission(user, request)
      }
    }));
  } catch (caught) {
    return error(caught);
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await actor();
    assertGovernanceActor(user);
    const { requestId } = await params;
    const input = await body(request);

    if (!['IN_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'REJECTED'].includes(input.status)) {
      throw domain('INVALID_INPUT', 'Invalid request status.');
    }
    if (['REVISION_REQUIRED', 'REJECTED'].includes(input.status) && !input.reviewerComment?.trim()) {
      throw domain('MISSING_REQUIRED_METADATA', 'Reviewer comment is required.');
    }

    const updated = await db.sopRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        reviewerComment: input.reviewerComment || null,
        reviewedAt: new Date()
      }
    });
    if (input.reviewerComment) {
      await db.requestMessage.create({
        data: { requestId, senderId: user.id, body: input.reviewerComment }
      });
    }
    return json(serial(updated));
  } catch (caught) {
    return error(caught);
  }
}
