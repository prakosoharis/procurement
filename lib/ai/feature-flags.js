// Kill switches for the pre-production AI features. A flag is ON unless it is
// explicitly turned off, so an operator can disable a demo quickly by setting
// one variable instead of redeploying application logic.

const offValues = new Set(['false', '0', 'off', 'no']);

function enabled(value) {
  if (value === undefined || value === null || value === '') return true;
  return !offValues.has(String(value).trim().toLowerCase());
}

export const AiFeatureFlag = Object.freeze({
  CHAT: 'AI_CHAT_ENABLED',
  REFINEMENT: 'AI_REFINEMENT_ENABLED'
});

export function isAiFeatureEnabled(flag, environment = process.env) {
  return enabled(environment[flag]);
}
