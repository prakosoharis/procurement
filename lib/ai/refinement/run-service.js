import { createHash } from 'node:crypto';
import { db as defaultDb } from '../../db.js';
import { assertGovernanceActor, assertScope } from '../../governance/authorization.js';
import { fail } from '../../governance/errors.js';
import { AiServiceError } from '../errors.js';
import { AiFeatureFlag, isAiFeatureEnabled } from '../feature-flags.js';
import { REFINEMENT_PROMPT_VERSION } from '../prompts/refinement.v1.js';
import { FINDING_CATEGORIES, RISK_LEVELS } from '../schemas.js';

// One run is: 1 SOP version x 1 set of approved sources x 1 analysis-method
// version. The fingerprint captures exactly that, so an identical request
// reuses the previous result instead of paying for the same analysis twice.

export const ANALYSIS_METHOD_VERSION = 'lexical-retrieval.v1';
const ACTIVE_STATUSES = ['QUEUED', 'PREPARING', 'RETRIEVING', 'ANALYZING'];

export function refinementFingerprint({ sopVersionId, sopFileKey, sources, model, promptVersion = REFINEMENT_PROMPT_VERSION, methodVersion = ANALYSIS_METHOD_VERSION }) {
  const sourceParts = [...sources]
    // Sort so source order in the request cannot produce a different fingerprint.
    .map((source) => `${source.id}:${source.contentHash || source.fileKey || ''}`)
    .sort();
  const payload = JSON.stringify({ sopVersionId, sopFileKey: sopFileKey || '', sourceParts, model: model || '', promptVersion, methodVersion });
  return createHash('sha256').update(payload).digest('hex');
}

// The provider is schema-constrained, but a persisted finding must still be
// valid for the database enums, so normalise defensively.
function normalizeFinding(finding) {
  const category = FINDING_CATEGORIES.includes(finding?.category) ? finding.category : 'OTHER';
  const severity = RISK_LEVELS.includes(finding?.severity) ? finding.severity : 'MEDIUM';
  const confidence = typeof finding?.confidence === 'number' && finding.confidence >= 0 && finding.confidence <= 1 ? finding.confidence : null;
  return {
    category,
    severity,
    currentState: finding?.currentState?.trim() || null,
    gap: finding?.gap?.trim() || finding?.title?.trim() || 'Tidak dijelaskan.',
    recommendation: finding?.recommendation?.trim() || 'Tidak ada rekomendasi.',
    confidence,
    evidenceJson: { title: finding?.title || null, ...(finding?.evidence || {}) }
  };
}

async function loadVersionOrFail(db, sopVersionId) {
  const version = await db.sopVersion.findUnique({
    where: { id: sopVersionId },
    select: {
      id: true, versionNo: true, fileKey: true, fileName: true, contentType: true,
      sopDocument: { select: { id: true, title: true, businessUnitId: true } }
    }
  });
  if (!version?.sopDocument) fail('NOT_FOUND', 'SOP version not found.');
  return version;
}

async function loadApprovedSources(db, sourceIds) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) fail('INVALID_INPUT', 'At least one reference source is required.');
  const sources = await db.referenceSource.findMany({
    where: { id: { in: sourceIds } },
    select: { id: true, title: true, type: true, fileKey: true, contentHash: true, isApproved: true }
  });
  const missing = sourceIds.filter((id) => !sources.some((source) => source.id === id));
  if (missing.length) fail('NOT_FOUND', `Reference source not found: ${missing.join(', ')}.`);
  // Only a validated source may back an official analysis.
  const inactive = sources.filter((source) => !source.isApproved);
  if (inactive.length) fail('INVALID_INPUT', `Reference source is not approved: ${inactive.map((source) => source.title).join(', ')}.`);
  return sources;
}

export async function startRefinementAnalysis(actor, sopVersionId, {
  sourceIds,
  db = defaultDb,
  environment = process.env,
  model = environment.ANTHROPIC_MODEL || null,
  enqueue
} = {}) {
  assertGovernanceActor(actor);
  if (!isAiFeatureEnabled(AiFeatureFlag.REFINEMENT, environment)) {
    throw new AiServiceError('AI_DISABLED', 'AI_REFINEMENT_ENABLED is turned off in this environment.');
  }

  const version = await loadVersionOrFail(db, sopVersionId);
  assertScope(actor, version.sopDocument.businessUnitId);
  const sources = await loadApprovedSources(db, sourceIds);

  const fingerprint = refinementFingerprint({ sopVersionId: version.id, sopFileKey: version.fileKey, sources, model });

  // Reuse a completed identical analysis rather than paying for it again.
  const completed = await db.refinementJob.findFirst({
    where: { fingerprint, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    select: { id: true, status: true, completedAt: true }
  });
  if (completed) return { job: completed, reused: true, queued: false };

  // Duplicate-request prevention: an identical run already in flight is joined.
  const active = await db.refinementJob.findFirst({
    where: { fingerprint, status: { in: ACTIVE_STATUSES } },
    select: { id: true, status: true }
  });
  if (active) return { job: active, reused: false, queued: false };

  const job = await db.refinementJob.create({
    data: {
      sopVersionId: version.id,
      requestedById: actor.id,
      businessUnitId: version.sopDocument.businessUnitId,
      fingerprint,
      status: 'QUEUED',
      promptVersion: REFINEMENT_PROMPT_VERSION,
      model,
      configurationJson: {
        methodVersion: ANALYSIS_METHOD_VERSION,
        sourceIds: sources.map((source) => source.id),
        sopVersionNo: version.versionNo
      }
    },
    select: { id: true, status: true }
  });

  if (enqueue) await enqueue(job.id);
  return { job, reused: false, queued: true };
}

export async function getRefinementAnalysis(actor, jobId, { db = defaultDb } = {}) {
  const job = await db.refinementJob.findUnique({
    where: { id: jobId },
    select: {
      id: true, status: true, businessUnitId: true, fingerprint: true, model: true, promptVersion: true,
      startedAt: true, completedAt: true, errorType: true, configurationJson: true,
      sopVersion: { select: { versionNo: true, sopDocument: { select: { id: true, title: true } } } },
      findings: {
        select: { id: true, category: true, severity: true, currentState: true, gap: true, recommendation: true, confidence: true, evidenceJson: true, humanStatus: true },
        orderBy: { createdAt: 'asc' }
      }
    }
  });
  if (!job) fail('NOT_FOUND', 'Refinement analysis not found.');
  assertScope(actor, job.businessUnitId);
  // errorMessage may carry provider detail, so it is deliberately not selected.
  // generatedOffline is surfaced explicitly so the interface can label a run
  // that the deployed application did not produce itself.
  return { ...job, generatedOffline: Boolean(job.configurationJson?.generatedOffline) };
}

export async function listRefinementAnalyses(actor, sopVersionId, { db = defaultDb, limit = 20 } = {}) {
  const version = await loadVersionOrFail(db, sopVersionId);
  assertScope(actor, version.sopDocument.businessUnitId);
  const jobs = await db.refinementJob.findMany({
    where: { sopVersionId },
    select: {
      id: true, status: true, model: true, promptVersion: true, fingerprint: true,
      startedAt: true, completedAt: true, errorType: true, configurationJson: true,
      _count: { select: { findings: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  return jobs.map(({ configurationJson, ...job }) => ({
    ...job,
    findingCount: job._count?.findings ?? configurationJson?.findingCount ?? 0,
    generatedOffline: Boolean(configurationJson?.generatedOffline)
  }));
}

// Offline provenance. A run produced this way is genuinely Claude-generated,
// but it was produced by the developer through Claude Code rather than by the
// deployed application calling a provider. It is recorded as such so the
// interface can label it honestly and so AiUsage stays an accurate record of
// what the application itself spent.
export const OFFLINE_GENERATOR = 'claude-code';

export function validateOfflinePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AiServiceError('AI_INVALID_OUTPUT', 'Analysis payload must be an object.');
  }
  if (typeof payload.summary !== 'string' || !payload.summary.trim()) {
    throw new AiServiceError('AI_INVALID_OUTPUT', 'Analysis payload requires a non-empty summary.');
  }
  if (!Array.isArray(payload.findings)) {
    throw new AiServiceError('AI_INVALID_OUTPUT', 'Analysis payload requires a findings array.');
  }
  for (const [index, finding] of payload.findings.entries()) {
    if (!finding || typeof finding !== 'object') throw new AiServiceError('AI_INVALID_OUTPUT', `Finding ${index} is not an object.`);
    for (const field of ['gap', 'recommendation']) {
      if (typeof finding[field] !== 'string' || !finding[field].trim()) {
        throw new AiServiceError('AI_INVALID_OUTPUT', `Finding ${index} requires a non-empty "${field}".`);
      }
    }
    const evidence = finding.evidence;
    if (!evidence || typeof evidence !== 'object') throw new AiServiceError('AI_INVALID_OUTPUT', `Finding ${index} requires evidence.`);
    for (const field of ['sopSection', 'sourceSection', 'sourceQuote']) {
      if (typeof evidence[field] !== 'string' || !evidence[field].trim()) {
        throw new AiServiceError('AI_INVALID_OUTPUT', `Finding ${index} requires evidence.${field}.`);
      }
    }
  }
  return payload;
}

export async function importOfflineAnalysis({ db = defaultDb, jobId, payload, model = null, generatedAt = new Date() }) {
  const validated = validateOfflinePayload(payload);
  const job = await db.refinementJob.findUnique({ where: { id: jobId }, select: { id: true, status: true, sopVersionId: true } });
  if (!job) fail('NOT_FOUND', 'Refinement analysis not found.');
  if (job.status === 'COMPLETED') fail('INVALID_TRANSITION', 'This analysis is already completed.');

  return persistRefinementAnalysis({
    db, jobId, sopVersionId: job.sopVersionId,
    summary: validated.summary, findings: validated.findings, model,
    provenance: { generatedOffline: true, generatedWith: OFFLINE_GENERATOR, generatedAt: generatedAt.toISOString() }
  });
}

export async function persistRefinementAnalysis({
  db = defaultDb,
  jobId,
  sopVersionId,
  summary,
  findings = [],
  model,
  promptVersion = REFINEMENT_PROMPT_VERSION,
  provenance = null
}) {
  const rows = findings.map(normalizeFinding);
  return db.$transaction(async (tx) => {
    // Merge rather than replace: the original config records the method version
    // and the source set the fingerprint was built from.
    const existing = await tx.refinementJob.findUnique({ where: { id: jobId }, select: { configurationJson: true } });
    // Re-running a job replaces its own candidate findings only; human findings
    // and validation decisions live in separate tables and are never touched.
    await tx.refinementFinding.deleteMany({ where: { refinementJobId: jobId } });
    if (rows.length) {
      await tx.refinementFinding.createMany({
        data: rows.map((row) => ({ ...row, refinementJobId: jobId, sopVersionId }))
      });
    }
    return tx.refinementJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        model: model || undefined,
        promptVersion,
        errorType: null,
        errorMessage: null,
        configurationJson: { ...(existing?.configurationJson || {}), ...(provenance || {}), summary, findingCount: rows.length }
      },
      select: { id: true, status: true, completedAt: true }
    });
  });
}
