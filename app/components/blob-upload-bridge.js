'use client';

import { useEffect } from 'react';
import { put } from '@vercel/blob/client';

const REQUEST_TYPE = 'PROCUREMENT_BLOB_UPLOAD';
const RESULT_TYPE = 'PROCUREMENT_BLOB_UPLOAD_RESULT';

function messageFor(error) {
  if (error instanceof Error && error.message) return error.message;
  return 'Upload file sementara gagal. Coba kembali.';
}

export default function BlobUploadBridge() {
  useEffect(() => {
    async function handleMessage(event) {
      if (event.origin !== window.location.origin) return;

      const frame = document.querySelector('iframe');
      if (!frame || event.source !== frame.contentWindow) return;

      const request = event.data;
      if (request?.type !== REQUEST_TYPE) return;

      const reply = (payload) => event.source.postMessage({
        type: RESULT_TYPE,
        requestId: request.requestId,
        ...payload
      }, event.origin);

      if (!(request.file instanceof File) || !request.uploadToken || !request.transientBlobPath || !request.contentType) {
        reply({ ok: false, error: 'Permintaan upload file tidak valid.' });
        return;
      }

      try {
        const blob = await put(request.transientBlobPath, request.file, {
          access: 'private',
          token: request.uploadToken,
          contentType: request.contentType
        });
        reply({ ok: true, pathname: blob.pathname });
      } catch (error) {
        console.error('Vercel Blob client upload failed.', error);
        reply({ ok: false, error: messageFor(error) });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return null;
}
