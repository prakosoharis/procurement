import { task } from '@trigger.dev/sdk';
import { transferBlobUploadToGoogleDrive } from '../lib/document-direct-upload-service.js';

export const sopBlobTransfer = task({
  id: 'sop-blob-transfer',
  queue: { concurrencyLimit: 3 },
  run: async ({ sessionId }: { sessionId: string }) => transferBlobUploadToGoogleDrive(sessionId)
});
