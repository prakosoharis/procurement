import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { refinementReadiness } from '../lib/governance/refinement/completion-service.js';

const baseSession = overrides => ({
  summary: 'Documented review of control design.',
  references: [{ id: 'reference-1' }],
  humanFindings: [],
  ...overrides
});

test('completion readiness requires summary and an active reference', () => {
  const readiness = refinementReadiness(baseSession({ summary: '', references: [] }));
  assert.equal(readiness.ready, false);
  assert.equal(readiness.checks.find(check => check.key === 'summary').complete, false);
  assert.equal(readiness.checks.find(check => check.key === 'references').complete, false);
});

test('completion readiness rejects unresolved and blocking Human Findings', () => {
  const readiness = refinementReadiness(baseSession({
    humanFindings: [{ id: 'finding-1', status: 'OPEN', blocking: true, clarifications: [] }]
  }));
  assert.equal(readiness.ready, false);
  assert.equal(readiness.unresolvedFindingCount, 1);
  assert.equal(readiness.blockingUnresolvedCount, 1);
});

test('completion readiness requires all clarifications to be reviewed and closed', () => {
  const readiness = refinementReadiness(baseSession({
    humanFindings: [{ id: 'finding-1', status: 'RESOLVED', blocking: false, clarifications: [{ id: 'clarification-1', status: 'RESPONDED' }] }]
  }));
  assert.equal(readiness.ready, false);
  assert.equal(readiness.pendingClarificationCount, 1);
});

test('completion readiness accepts final findings with closed clarifications', () => {
  const readiness = refinementReadiness(baseSession({
    humanFindings: [{ id: 'finding-1', status: 'DEFERRED', blocking: false, clarifications: [{ id: 'clarification-1', status: 'CLOSED' }] }]
  }));
  assert.equal(readiness.ready, true);
});

test('completion service and native UI enforce server authority and concurrency', () => {
  const service = fs.readFileSync('lib/governance/refinement/completion-service.js', 'utf8');
  const route = fs.readFileSync('app/api/governance/versions/[versionId]/refinement/complete-human/route.js', 'utf8');
  const page = fs.readFileSync('app/sop-governance/refinement/[versionId]/page.js', 'utf8');
  assert.match(service, /assertGovernanceActor\(actor\)/);
  assert.match(service, /scopeWhere\(actor, 'sopDocument'\)/);
  assert.match(service, /expectedUpdatedAt/);
  assert.match(service, /REFINEMENT_SESSION_COMPLETED_HUMAN_ONLY/);
  assert.match(route, /completeHumanRefinement/);
  assert.match(page, /capabilities\.canCompleteHumanOnly/);
  assert.doesNotMatch(page, /role\s*===|role\s*!==/);
});
