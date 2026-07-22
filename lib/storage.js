import { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { googleDriveClient } from './google-drive';

const config = { region:process.env.S3_REGION || 'us-east-1', endpoint:process.env.S3_ENDPOINT, forcePathStyle:process.env.S3_FORCE_PATH_STYLE === 'true', credentials:{accessKeyId:process.env.S3_ACCESS_KEY || '',secretAccessKey:process.env.S3_SECRET_KEY || ''} };
export const bucket = process.env.S3_BUCKET || 'procurement-documents';
export const s3 = new S3Client(config);
const useGoogleDrive = () => process.env.STORAGE_PROVIDER === 'google-drive';

export async function ensureBucket(){ try { await s3.send(new CreateBucketCommand({Bucket:bucket})); } catch (error) { if (error.name !== 'BucketAlreadyOwnedByYou' && error.name !== 'BucketAlreadyExists') throw error; } }

export async function uploadObject({key, body, contentType}) {
  if (useGoogleDrive()) {
    const { drive, folderId } = await googleDriveClient();
    const result = await drive.files.create({
      requestBody: { name: key.split('/').pop() || 'document', parents: [folderId] },
      media: { mimeType: contentType || 'application/octet-stream', body: typeof body?.pipe === 'function' ? body : Readable.from([body]) },
      fields: 'id'
    });
    if (!result.data.id) throw new Error('Upload ke Google Drive gagal.');
    return { key: `gdrive:${result.data.id}` };
  }
  await ensureBucket();
  await s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:contentType}));
  return { key };
}

export async function getObject(key){
  if (key.startsWith('gdrive:')) {
    const { drive } = await googleDriveClient();
    const fileId = key.slice('gdrive:'.length);
    const result = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    return { Body: result.data, ContentType: result.headers['content-type'], ContentLength: result.headers['content-length'] };
  }
  return s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));
}

export async function downloadUrl(key){
  if (key.startsWith('gdrive:')) return null;
  return getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:300});
}
