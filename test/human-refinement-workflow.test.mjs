import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultBlocking,
  parseDispositionInput,
  parseEvidenceInput,
  parseFindingInput,
  refinementCapabilities
} from '../lib/governance/refinement/human-workspace.js';

const procurement = { id: 'proc', role: 'CORPORATE_GOVERNANCE' };
const superuser = { id: 'admin', role: 'SUPER_USER' };
const businessUnit = { id: 'bu-user', role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-a', businessUnitScopes: [] };
const executive = { id: 'exec', role: 'EXECUTIVE' };

test('Critical and High default to blocking while other severities do not', () => {
  assert.equal(defaultBlocking('CRITICAL'), true);
  assert.equal(defaultBlocking('HIGH'), true);
  assert.equal(defaultBlocking('MEDIUM'), false);
});

test('OTHER finding category requires an explanation', () => {
  assert.throws(() => parseFindingInput({ title: 'x', category: 'OTHER', severity: 'HIGH', observation: 'x' }), { code: 'INVALID_INPUT' });
  assert.equal(parseFindingInput({ title: 'x', category: 'OTHER', categoryExplanation: 'Specific gap', severity: 'HIGH', observation: 'x' }).categoryExplanation, 'Specific gap');
});

test('blocking override requires a reason and preserves the supplied value', () => {
  assert.throws(() => parseFindingInput({ title: 'x', category: 'PROCESS_GAP', severity: 'HIGH', observation: 'x', blocking: false }), { code: 'INVALID_INPUT' });
  const finding = parseFindingInput({ title: 'x', category: 'PROCESS_GAP', severity: 'HIGH', observation: 'x', blocking: false, blockingOverrideReason: 'Risk accepted temporarily' });
  assert.equal(finding.blocking, false);
});

test('evidence and disposition records reject incomplete structured inputs', () => {
  assert.throws(() => parseEvidenceInput({ type: 'UNKNOWN', description: 'x' }), { code: 'INVALID_INPUT' });
  assert.throws(() => parseDispositionInput({ status: 'RESOLVED', resolutionType: 'DOCUMENT_UPDATED' }), { code: 'INVALID_INPUT' });
  assert.throws(() => parseDispositionInput({ status: 'DEFERRED', deferReason: 'x' }), { code: 'INVALID_INPUT' });
  assert.equal(parseDispositionInput({ status: 'DISMISSED', dismissalReason: 'Out of scope' }).status, 'DISMISSED');
});

test('capabilities enforce governance management, scoped BU responses, and executive read-only access', () => {
  assert.equal(refinementCapabilities(procurement, 'bu-a').canManageFindings, true);
  assert.equal(refinementCapabilities(superuser, 'bu-a').canDispositionFinding, true);
  assert.equal(refinementCapabilities(businessUnit, 'bu-a').canRespondClarification, true);
  assert.equal(refinementCapabilities(businessUnit, 'bu-b').canRespondClarification, false);
  assert.equal(refinementCapabilities(businessUnit, 'bu-a').canManageFindings, false);
  assert.equal(refinementCapabilities(executive, 'bu-a').canManageFindings, false);
  assert.equal(refinementCapabilities(executive, 'bu-a').canRespondClarification, false);
});

test('inactive lifecycle disables every mutation capability', () => {
  const capabilities = refinementCapabilities(procurement, 'bu-a', 'VALIDATION');
  assert.equal(capabilities.canManageFindings, false);
  assert.equal(capabilities.canAddEvidence, false);
  assert.equal(capabilities.canDispositionFinding, false);
});

test('mutation routes keep scope and concurrency guards', async () => {
  const fs = await import('node:fs');
  const findingRoute = fs.readFileSync('app/api/governance/refinement/[versionId]/findings/[findingId]/route.js', 'utf8');
  const responseRoute = fs.readFileSync('app/api/governance/refinement/clarifications/[clarificationId]/respond/route.js', 'utf8');
  assert.match(findingRoute, /scopedFinding/);
  assert.match(findingRoute, /expectedUpdatedAt/);
  assert.match(responseRoute, /scopeWhere\(user, 'businessUnit'\)/);
  assert.match(responseRoute, /CONCURRENT_MODIFICATION/);
});
