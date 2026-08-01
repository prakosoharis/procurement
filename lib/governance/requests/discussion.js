import { GovernanceError } from '../errors.js';

const GOVERNANCE_DISCUSSION_ROLES = new Set([
  'SUPER_USER',
  'CORPORATE_GOVERNANCE'
]);
const CLOSED_REQUEST_STATUSES = new Set(['APPROVED', 'REJECTED']);

export function canPostRequestDiscussion(user, status) {
  return !CLOSED_REQUEST_STATUSES.has(status) && (
    user?.role === 'BUSINESS_UNIT_PIC' || GOVERNANCE_DISCUSSION_ROLES.has(user?.role)
  );
}

/**
 * Returns a Prisma scope for a request discussion.  The requester is the
 * resource owner for a Business Unit actor; governance roles can discuss any
 * request.  Executive access is deliberately read-only for this workflow.
 */
export function requestDiscussionScope(user, requestId) {
  if (user.role === 'BUSINESS_UNIT_PIC') {
    return { id: requestId, requesterId: user.id };
  }

  if (GOVERNANCE_DISCUSSION_ROLES.has(user.role)) {
    return { id: requestId };
  }

  throw new GovernanceError('FORBIDDEN', 'You cannot add messages to this request.');
}

export function requestDiscussionRecipients(user, request) {
  if (user.role === 'BUSINESS_UNIT_PIC') {
    return { role: { in: [...GOVERNANCE_DISCUSSION_ROLES] } };
  }

  return { id: request.requesterId };
}
