import { task } from '@trigger.dev/sdk';
import { indexSopVersion } from '../lib/sop-content/index-service.js';

export const sopContentIndex = task({
  id: 'sop-content-index',
  machine: 'medium-1x',
  queue: { concurrencyLimit: 3 },
  run: async ({ sopVersionId }: { sopVersionId: string }) => indexSopVersion(sopVersionId)
});
