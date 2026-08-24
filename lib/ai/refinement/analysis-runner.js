import { db as defaultDb } from '../../db.js';
import { createAiService } from '../ai-service.js';
import { aiConfig } from '../config.js';
import { AiServiceError } from '../errors.js';
import { buildRefinementContext } from './context-builder.js';
import { loadDocumentPages } from './document-text.js';
import { persistRefinementAnalysis } from './run-service.js';

// Runs one queued analysis. This executes in a Trigger.dev task, not in a
// request, because reading two PDFs and analysing them exceeds any HTTP budget.
// It advances RefinementJob.status so the UI can poll real progress.

async function setStatus(db, jobId, status, extra = {}) {
  await db.refinementJob.update({ where: { id: jobId }, data: { status, ...extra } });
}

export async function runRefinementAnalysis(jobId, {
  db = defaultDb,
  aiService = createAiService(),
  environment = process.env,
  config = aiConfig(environment),
  loadPages = loadDocumentPages
} = {}) {
  const job = await db.refinementJob.findUnique({
    where: { id: jobId },
    select: {
      id: true, status: true, businessUnitId: true, model: true, configurationJson: true,
      sopVersion: { select: { id: true, versionNo: true, fileKey: true, fileName: true, contentType: true } }
    }
  });
  if (!job) throw new AiServiceError('AI_INVALID_INPUT', `Refinement job ${jobId} not found.`);
  if (job.status !== 'QUEUED') return { jobId, skipped: true, status: job.status };

  try {
    await setStatus(db, jobId, 'PREPARING', { startedAt: new Date() });

    const sourceIds = job.configurationJson?.sourceIds || [];
    const sources = await db.referenceSource.findMany({
      where: { id: { in: sourceIds }, isApproved: true },
      select: { id: true, title: true, fileKey: true }
    });
    if (!sources.length) throw new AiServiceError('AI_INVALID_INPUT', 'No approved reference source remains for this analysis.');

    const [sopDocument, ...sourceDocuments] = await Promise.all([
      loadPages({ fileKey: job.sopVersion.fileKey, fileName: job.sopVersion.fileName || 'SOP', contentType: job.sopVersion.contentType }),
      ...sources.map((source) => loadPages({ fileKey: source.fileKey, fileName: source.title }))
    ]);

    await setStatus(db, jobId, 'RETRIEVING');

    // One provider call per source keeps a run atomic per SOP-source pair, so a
    // single bad source cannot invalidate the others' findings.
    const summaries = [];
    const findings = [];
    let usedModel = job.model;

    for (const [index, sourceDocument] of sourceDocuments.entries()) {
      const context = buildRefinementContext({ sopDocument, sourceDocument, maxContextTokens: config.maxContextTokens });
      await setStatus(db, jobId, 'ANALYZING');
      const result = await aiService.analyzeRefinement({
        sopContext: context.sopContext,
        sourceContext: context.sourceContext,
        scopeNote: context.scopeNote,
        businessUnitId: job.businessUnitId,
        refinementJobId: jobId
      });
      usedModel = result.model || usedModel;
      summaries.push(`${sources[index].title}: ${result.summary}`);
      for (const finding of result.findings) {
        findings.push({ ...finding, evidence: { ...(finding.evidence || {}), sourceTitle: sources[index].title, sourceId: sources[index].id } });
      }
    }

    return await persistRefinementAnalysis({
      db, jobId, sopVersionId: job.sopVersion.id,
      summary: summaries.join('\n\n'), findings, model: usedModel
    });
  } catch (error) {
    const code = error instanceof AiServiceError ? error.code : 'AI_PROVIDER_UNAVAILABLE';
    // errorMessage is operator-facing only; the read API never returns it.
    await setStatus(db, jobId, 'FAILED', { completedAt: new Date(), errorType: code, errorMessage: String(error?.message || '').slice(0, 500) }).catch((updateError) => {
      console.error('[ai:refinement] failed to record job failure', updateError);
    });
    throw error;
  }
}
