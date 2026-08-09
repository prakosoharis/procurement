import { Readable } from 'node:stream';
import { googleDriveClient, googleDriveConfigured } from './google-drive.js';

export const isGoogleDriveStorage = () => process.env.STORAGE_PROVIDER === 'google-drive';

export class StorageConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageConfigurationError';
  }
}

// Google Drive is the only supported document store. Check configuration and
// the saved OAuth connection before creating a document database record.
export async function assertStorageReady() {
  if (!isGoogleDriveStorage()) {
    throw new StorageConfigurationError('STORAGE_PROVIDER harus dikonfigurasi sebagai google-drive.');
  }
  if (!googleDriveConfigured()) {
    throw new StorageConfigurationError('Google Drive belum dikonfigurasi di environment ini.');
  }
  try {
    await googleDriveClient();
  } catch (error) {
    throw new StorageConfigurationError(error.message || 'Google Drive belum dihubungkan oleh admin.');
  }
}

export async function uploadObject({ key, body, contentType, googleDriveParentId, googleDriveFileName, googleDriveAppProperties }) {
  await assertStorageReady();
  const { drive, folderId } = await googleDriveClient();
  const result = await drive.files.create({
    requestBody: {
      name: googleDriveFileName || key.split('/').pop() || 'document',
      parents: [googleDriveParentId || folderId],
      ...(googleDriveAppProperties ? { appProperties: googleDriveAppProperties } : {})
    },
    media: {
      mimeType: contentType || 'application/octet-stream',
      body: typeof body?.pipe === 'function' ? body : Readable.from([body])
    },
    fields: 'id'
  });
  if (!result.data.id) throw new Error('Upload ke Google Drive gagal.');
  return { key: `gdrive:${result.data.id}` };
}

export async function getObject(key) {
  if (!key.startsWith('gdrive:')) {
    throw new StorageConfigurationError('File lama tidak menggunakan Google Drive dan tidak dapat diakses oleh konfigurasi saat ini.');
  }
  const { drive } = await googleDriveClient();
  const fileId = key.slice('gdrive:'.length);
  const result = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return {
    Body: result.data,
    ContentType: result.headers['content-type'],
    ContentLength: result.headers['content-length']
  };
}

export async function downloadUrl(key) {
  if (!key.startsWith('gdrive:')) return null;
  return null;
}
