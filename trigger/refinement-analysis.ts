import { task } from '@trigger.dev/sdk';
import { runRefinementAnalysis } from '../lib/ai/refinement/analysis-runner.js';

// Reading two PDFs and analysing them exceeds any HTTP request budget, so the
// work runs here. Concurrency is capped so parallel runs cannot stampede the
// provider rate limit.
export const refinementAnalysis = task({
  id: 'refinement-analysis',
  machine: 'medium-1x',
  queue: { concurrencyLimit: 2 },
  maxDuration: 900,
  run: async ({ jobId }: { jobId: string }) => runRefinementAnalysis(jobId)
});
