import { db } from '../../../../../../lib/db';
import { actor, body, domain, error, json, serial } from '../../../../../../lib/api/governance';
import { recordGovernanceEvent } from '../../../../../../lib/governance/activity/governance-audit-log';
import {
  canPostRequestDiscussion,
  requestDiscussionRecipients,
  requestDiscussionScope
} from '../../../../../../lib/governance/requests/discussion';

export async function POST(request, { params }) {
  try {
    const user = await actor();
    const { requestId } = await params;
    const input = await body(request);
    const messageBody = typeof input.body === 'string' ? input.body.trim() : '';

    if (!messageBody) {
      throw domain('INVALID_INPUT', 'Message body is required.');
    }

    const ticket = await db.sopRequest.findFirst({
      where: requestDiscussionScope(user, requestId),
      select: {
        id: true,
        requesterId: true,
        status: true,
        sopDocument: { select: { businessUnitId: true } }
      }
    });

    if (!ticket) {
      throw domain('NOT_FOUND', 'Request not found.');
    }

    if (!canPostRequestDiscussion(user, ticket.status)) {
      throw domain('INVALID_TRANSITION', 'Closed requests cannot receive new messages.');
    }

    const created = await db.$transaction(async (tx) => {
      const message = await tx.requestMessage.create({
        data: { requestId: ticket.id, senderId: user.id, body: messageBody },
        include: { sender: { select: { id: true, name: true, role: true } } }
      });

      const recipients = await tx.user.findMany({
        where: requestDiscussionRecipients(user, ticket),
        select: { id: true }
      });
      const notifications = recipients
        .filter((recipient) => recipient.id !== user.id)
        .map((recipient) => ({ messageId: message.id, recipientId: recipient.id }));

      if (notifications.length) {
        await tx.ticketNotification.createMany({ data: notifications, skipDuplicates: true });
      }

      await recordGovernanceEvent(tx, {
        actor: user,
        businessUnitId: ticket.sopDocument?.businessUnitId ?? null,
        entity: 'SopRequest',
        entityId: ticket.id,
        action: 'REQUEST_MESSAGE_POSTED',
        metadata: { messageId: message.id }
      });

      return message;
    });

    return json(serial({ message: created }), 201);
  } catch (caught) {
    return error(caught);
  }
}
