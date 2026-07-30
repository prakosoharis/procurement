import { GovernanceError } from '../errors.js';

export const submissionConversionInputFields = Object.freeze([
  'expectedStatus',
  'expectedUpdatedAt'
]);

export function assertSubmissionConversionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new GovernanceError('INVALID_INPUT', 'A JSON object is required.');
  }

  for (const key of Object.keys(input)) {
    if (!submissionConversionInputFields.includes(key)) {
      throw new GovernanceError('INVALID_INPUT', `Field ${key} is not allowed.`);
    }
  }

  return {
    expectedStatus: input.expectedStatus,
    expectedUpdatedAt: input.expectedUpdatedAt
  };
}
