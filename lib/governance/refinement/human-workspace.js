import { can, Permission } from '../../authorization/permissions.js';
import { effectiveBusinessUnitIds } from '../../authorization/scope.js';
import { Role } from '../../authorization/roles.js';
import { fail } from '../errors.js';

export const findingCategories = Object.freeze([
  'REGULATORY_MISMATCH',
  'INTERNAL_POLICY_CONFLICT',
  'PROCESS_GAP',
  'CONTROL_WEAKNESS',
  'AMBIGUOUS_WORDING',
  'DUPLICATE_OR_INCONSISTENT_RULE',
  'ROLE_AND_RESPONSIBILITY_ISSUE',
  'AUDIT_OR_FRAUD_RISK',
  'DOCUMENT_QUALITY',
  'OTHER'
]);

export const findingSeverities = Object.freeze([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'OBSERVATION'
]);

export const evidenceTypes = Object.freeze([
  'DOCUMENT_EXCERPT',
  'REFERENCE_SOURCE',
  'CLARIFICATION_RESPONSE',
  'SUPPORTING_ATTACHMENT',
  'REVIEWER_NOTE'
]);

export const resolutionTypes = Object.freeze([
  'DOCUMENT_UPDATED',
  'CLARIFICATION_ACCEPTED',
  'CONTROL_CONFIRMED',
  'NO_CHANGE_REQUIRED',
  'OTHER'
]);

const text = value => typeof value === 'string' ? value.trim() : '';
const optionalText = value => text(value) || null;

export function refinementCapabilities(actor, businessUnitId, lifecycleState = 'REFINEMENT') {
  const active = lifecycleState === 'REFINEMENT';
  const canManageFindings = active && can(actor, Permission.REFINEMENT_RUN);
  const canRespondClarification =
    active &&
    actor?.role === Role.BUSINESS_UNIT &&
    effectiveBusinessUnitIds(actor).includes(businessUnitId);

  return {
    canManage: canManageFindings,
    canManageFindings,
    canAddEvidence: canManageFindings || canRespondClarification,
    canRequestClarification: canManageFindings,
    canRespondClarification,
    canCloseClarification: canManageFindings,
    canDispositionFinding: canManageFindings,
    canEditSummary: canManageFindings,
    canCompleteHumanOnly: canManageFindings,
    canViewHistory: true
  };
}

export function parseFindingInput(input, { partial = false } = {}) {
  const data = {};
  const required = ['title', 'category', 'severity', 'observation'];

  for (const key of required) {
    if (!partial || Object.prototype.hasOwnProperty.call(input, key)) {
      const value = text(input[key]);
      if (!value) fail('INVALID_INPUT', `${key} is required.`);
      data[key] = value;
    }
  }

  if (data.category && !findingCategories.includes(data.category)) {
    fail('INVALID_INPUT', 'Finding category is invalid.');
  }
  if (data.severity && !findingSeverities.includes(data.severity)) {
    fail('INVALID_INPUT', 'Finding severity is invalid.');
  }

  const category = data.category || input.currentCategory;
  if (category === 'OTHER') {
    const explanation = text(input.categoryExplanation);
    if (!explanation) fail('INVALID_INPUT', 'Category explanation is required for OTHER.');
    data.categoryExplanation = explanation;
  } else if (data.category || Object.prototype.hasOwnProperty.call(input, 'categoryExplanation')) {
    data.categoryExplanation = null;
  }

  for (const key of ['documentLocation', 'riskImpact', 'recommendation']) {
    if (Object.prototype.hasOwnProperty.call(input, key)) data[key] = optionalText(input[key]);
  }

  if (Object.prototype.hasOwnProperty.call(input, 'ownerId')) data.ownerId = optionalText(input.ownerId);
  if (Object.prototype.hasOwnProperty.call(input, 'followUpRequired')) {
    data.followUpRequired = input.followUpRequired === true;
    data.followUpSuggestedOwner = optionalText(input.followUpSuggestedOwner);
    data.followUpTargetAt = input.followUpTargetAt ? validDate(input.followUpTargetAt, 'follow-up target') : null;
    data.followUpNote = optionalText(input.followUpNote);
  }

  const severity = data.severity || input.currentSeverity;
  const defaultValue = defaultBlocking(severity);
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'blocking') || Object.prototype.hasOwnProperty.call(data, 'severity')) {
    const blocking = typeof input.blocking === 'boolean' ? input.blocking : defaultValue;
    const override = blocking !== defaultValue;
    const reason = optionalText(input.blockingOverrideReason);
    if (override && !reason) fail('INVALID_INPUT', 'A reason is required when overriding the default blocking value.');
    data.blocking = blocking;
    data.blockingOverrideReason = override ? reason : null;
  }

  return data;
}

export function parseEvidenceInput(input) {
  const type = text(input.type);
  const description = text(input.description);
  if (!evidenceTypes.includes(type)) fail('INVALID_INPUT', 'Evidence type is invalid.');
  if (!description) fail('INVALID_INPUT', 'Evidence description is required.');
  return {
    type,
    title: optionalText(input.title),
    description,
    excerpt: optionalText(input.excerpt),
    source: optionalText(input.source),
    documentLocation: optionalText(input.documentLocation),
    attachmentKey: optionalText(input.attachmentKey)
  };
}

export function parseDispositionInput(input) {
  const status = text(input.status);
  if (!['RESOLVED', 'DEFERRED', 'DISMISSED'].includes(status)) {
    fail('INVALID_INPUT', 'Finding disposition is invalid.');
  }

  if (status === 'RESOLVED') {
    const resolutionType = text(input.resolutionType);
    const resolutionSummary = text(input.resolutionSummary);
    if (!resolutionTypes.includes(resolutionType) || !resolutionSummary) {
      fail('INVALID_INPUT', 'Resolution type and summary are required.');
    }
    return { status, resolutionType, resolutionSummary };
  }

  if (status === 'DEFERRED') {
    const deferReason = text(input.deferReason);
    const deferOwner = text(input.deferOwner);
    const riskAcknowledgement = text(input.riskAcknowledgement);
    if (!deferReason || !deferOwner || !input.deferTargetAt || !riskAcknowledgement) {
      fail('INVALID_INPUT', 'Deferred findings require reason, owner, target date, and risk acknowledgement.');
    }
    return {
      status,
      deferReason,
      deferOwner,
      deferTargetAt: validDate(input.deferTargetAt, 'defer target'),
      riskAcknowledgement
    };
  }

  const dismissalReason = text(input.dismissalReason);
  if (!dismissalReason) fail('INVALID_INPUT', 'Dismissal reason is required.');
  return { status, dismissalReason };
}

export function requireExpectedUpdatedAt(value) {
  if (!value) fail('INVALID_INPUT', 'expectedUpdatedAt is required.');
  return validDate(value, 'expectedUpdatedAt');
}

export function defaultBlocking(severity) {
  return severity === 'CRITICAL' || severity === 'HIGH';
}

function validDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_INPUT', `${label} is invalid.`);
  return date;
}
