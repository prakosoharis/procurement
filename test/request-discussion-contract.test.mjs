import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPostRequestDiscussion,
  requestDiscussionRecipients,
  requestDiscussionScope
} from '../lib/governance/requests/discussion.js';

test('Business Unit discussion is limited to its own request', () => {
  assert.deepEqual(
    requestDiscussionScope({ id: 'user-a', role: 'BUSINESS_UNIT_PIC' }, 'request-a'),
    { id: 'request-a', requesterId: 'user-a' }
  );
});

test('governance discussion has request-level scope', () => {
  assert.deepEqual(
    requestDiscussionScope({ id: 'user-a', role: 'CORPORATE_GOVERNANCE' }, 'request-a'),
    { id: 'request-a' }
  );
  assert.deepEqual(
    requestDiscussionScope({ id: 'user-a', role: 'SUPER_USER' }, 'request-a'),
    { id: 'request-a' }
  );
});

test('Executive cannot post to a request discussion', () => {
  assert.throws(
    () => requestDiscussionScope({ id: 'user-a', role: 'EXECUTIVE' }, 'request-a'),
    { code: 'FORBIDDEN' }
  );
});

test('discussion mutation capability is server-derived and state-aware', () => {
  assert.equal(canPostRequestDiscussion({ role: 'SUPER_USER' }, 'IN_REVIEW'), true);
  assert.equal(canPostRequestDiscussion({ role: 'BUSINESS_UNIT_PIC' }, 'SUBMITTED'), true);
  assert.equal(canPostRequestDiscussion({ role: 'EXECUTIVE' }, 'IN_REVIEW'), false);
  assert.equal(canPostRequestDiscussion({ role: 'SUPER_USER' }, 'APPROVED'), false);
});

test('discussion notifications target the opposite workflow side', () => {
  assert.deepEqual(
    requestDiscussionRecipients(
      { role: 'BUSINESS_UNIT_PIC' },
      { requesterId: 'requester-a' }
    ),
    { role: { in: ['SUPER_USER', 'CORPORATE_GOVERNANCE'] } }
  );
  assert.deepEqual(
    requestDiscussionRecipients(
      { role: 'SUPER_USER' },
      { requesterId: 'requester-a' }
    ),
    { id: 'requester-a' }
  );
});
