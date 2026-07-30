export function shouldShowSubmissionConversionAction(submission) {
  return submission?.status === 'APPROVED' &&
    submission?.capabilities?.canConvertSubmission === true;
}
