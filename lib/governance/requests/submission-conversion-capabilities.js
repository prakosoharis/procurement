import { isGovernanceActor } from '../authorization.js';

export function canConvertSubmission(actor, submission) {
  if (!isGovernanceActor(actor) || submission?.status !== 'APPROVED' || submission?.conversion) {
    return false;
  }

  if (submission.conversionIntent === 'CREATE_SOP') {
    return Boolean(submission.requestedBusinessUnitId);
  }

  if (submission.conversionIntent === 'CREATE_REVISION') {
    return Boolean(submission.sopDocumentId && submission.sopDocument?.publishedVersionId);
  }

  return false;
}
