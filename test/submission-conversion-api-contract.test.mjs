import assert from 'node:assert/strict';
import test from 'node:test';
import { GovernanceError } from '../lib/governance/errors.js';
import {
  assertSubmissionConversionInput,
  submissionConversionInputFields
} from '../lib/governance/requests/submission-conversion-contract.js';
import { canConvertSubmission } from '../lib/governance/requests/submission-conversion-capabilities.js';

const procurement = { id: 'procurement-1', role: 'CORPORATE_GOVERNANCE' };
const executive = { id: 'executive-1', role: 'EXECUTIVE' };

test('conversion API permits only concurrency preconditions', () => {
  assert.deepEqual(submissionConversionInputFields, ['expectedStatus', 'expectedUpdatedAt']);
  assert.deepEqual(
    assertSubmissionConversionInput({
      expectedStatus: 'APPROVED',
      expectedUpdatedAt: '2026-07-30T00:00:00.000Z'
    }),
    { expectedStatus: 'APPROVED', expectedUpdatedAt: '2026-07-30T00:00:00.000Z' }
  );
  assert.throws(
    () => assertSubmissionConversionInput({ expectedStatus: 'APPROVED', lifecycleState: 'PUBLISHED' }),
    (caught) => caught instanceof GovernanceError && caught.code === 'INVALID_INPUT'
  );
});

test('conversion capability is server-derived from role, state, metadata, and conversion history', () => {
  assert.equal(canConvertSubmission(procurement, {
    status: 'APPROVED', conversionIntent: 'CREATE_SOP', requestedBusinessUnitId: 'bu-1', conversion: null
  }), true);
  assert.equal(canConvertSubmission(procurement, {
    status: 'APPROVED', conversionIntent: 'CREATE_REVISION', sopDocumentId: 'sop-1',
    sopDocument: { publishedVersionId: 'published-1' }, conversion: null
  }), true);
  assert.equal(canConvertSubmission(executive, {
    status: 'APPROVED', conversionIntent: 'CREATE_SOP', requestedBusinessUnitId: 'bu-1', conversion: null
  }), false);
  assert.equal(canConvertSubmission(procurement, {
    status: 'APPROVED', conversionIntent: 'CREATE_SOP', requestedBusinessUnitId: 'bu-1', conversion: { id: 'conversion-1' }
  }), false);
});
