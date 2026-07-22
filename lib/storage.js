import { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const config = { region:process.env.S3_REGION || 'us-east-1', endpoint:process.env.S3_ENDPOINT, forcePathStyle:process.env.S3_FORCE_PATH_STYLE === 'true', credentials:{accessKeyId:process.env.S3_ACCESS_KEY || '',secretAccessKey:process.env.S3_SECRET_KEY || ''} };
export const bucket = process.env.S3_BUCKET || 'procurement-documents';
export const s3 = new S3Client(config);
export async function ensureBucket(){ try { await s3.send(new CreateBucketCommand({Bucket:bucket})); } catch (error) { if (error.name !== 'BucketAlreadyOwnedByYou' && error.name !== 'BucketAlreadyExists') throw error; } }
export async function uploadObject({key, body, contentType}) { await ensureBucket(); return s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:contentType})); }
export async function getObject(key){ return s3.send(new GetObjectCommand({Bucket:bucket,Key:key})); }
export async function downloadUrl(key){ return getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:300}); }
