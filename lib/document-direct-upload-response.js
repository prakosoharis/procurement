import { NextResponse } from 'next/server';
import { DirectUploadError } from './document-direct-upload-service.js';
import { StorageConfigurationError } from './storage.js';

export function directUploadErrorResponse(error) {
  if (error instanceof DirectUploadError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof StorageConfigurationError) {
    return NextResponse.json({ error: error.message, code: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  }
  console.error('Direct Google Drive upload failed.', error);
  return NextResponse.json({ error: 'Sesi upload Google Drive gagal diproses. Coba kembali.' }, { status: 502 });
}
