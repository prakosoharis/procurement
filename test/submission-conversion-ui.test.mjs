import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowSubmissionConversionAction } from '../lib/governance/requests/submission-conversion-ui.js';

test('conversion action requires both approved lifecycle state and server capability', () => {
  assert.equal(shouldShowSubmissionConversionAction({
    status: 'APPROVED', capabilities: { canConvertSubmission: true }
  }), true);
  assert.equal(shouldShowSubmissionConversionAction({
    status: 'SUBMITTED', capabilities: { canConvertSubmission: true }
  }), false);
  assert.equal(shouldShowSubmissionConversionAction({
    status: 'APPROVED', capabilities: { canConvertSubmission: false }
  }), false);
  assert.equal(shouldShowSubmissionConversionAction({ status: 'APPROVED' }), false);
});
