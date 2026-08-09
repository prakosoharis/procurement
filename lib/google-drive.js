import crypto from 'node:crypto';
import { google } from 'googleapis';
import { db } from './db.js';

const provider = 'GOOGLE_DRIVE';
const scope = 'https://www.googleapis.com/auth/drive.file';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} belum dikonfigurasi.`);
  return value;
}

function encryptionKey() {
  const key = Buffer.from(required('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'), 'base64');
  if (key.length !== 32) throw new Error('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY harus berupa base64 dari 32 byte acak.');
  return key;
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value) {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) throw new Error('Token Google Drive tidak valid. Hubungkan ulang Google Drive.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]).toString('utf8');
}

export function googleDriveConfigured() {
  return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REDIRECT_URI && process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY);
}

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(required('GOOGLE_DRIVE_CLIENT_ID'), required('GOOGLE_DRIVE_CLIENT_SECRET'), required('GOOGLE_DRIVE_REDIRECT_URI'));
}

export function googleAuthorizationUrl(state) {
  return createGoogleOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope,
    state
  });
}

async function usableFolder(drive, folderId) {
  if (!folderId) return null;
  try {
    const result = await drive.files.get({
      fileId: folderId,
      fields: 'id,mimeType,trashed'
    });
    const folder = result.data;
    return folder?.id && folder.mimeType === 'application/vnd.google-apps.folder' && !folder.trashed
      ? folder.id
      : null;
  } catch (error) {
    if ([403, 404].includes(error?.code)) return null;
    throw error;
  }
}

// Reconnecting the same Drive account must preserve the existing root. This is
// important because file and folder IDs in the database rely on that root.
export async function ensureGoogleDriveRootFolder({ drive, existingFolderId }) {
  const reusableFolderId = await usableFolder(drive, existingFolderId);
  if (reusableFolderId) return { folderId: reusableFolderId, reused: true };

  const folder = await drive.files.create({
    requestBody: { name: 'Procurement Governance Hub', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  if (!folder.data.id) throw new Error('Folder Google Drive tidak dapat dibuat.');
  return { folderId: folder.data.id, reused: false };
}

export async function connectGoogleDrive(code) {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google tidak mengirim refresh token. Cabut akses aplikasi di Google Account lalu hubungkan ulang.');
  client.setCredentials({ refresh_token: tokens.refresh_token });
  const drive = google.drive({ version: 'v3', auth: client });
  const existing = await db.storageIntegration.findUnique({ where: { provider } });
  const root = await ensureGoogleDriveRootFolder({ drive, existingFolderId: existing?.folderId });
  await db.storageIntegration.upsert({
    where: { provider },
    update: { folderId: root.folderId, refreshTokenEncrypted: encrypt(tokens.refresh_token), connectedAt: new Date() },
    create: { provider, folderId: root.folderId, refreshTokenEncrypted: encrypt(tokens.refresh_token) }
  });
  return root;
}

export async function googleDriveClient() {
  const integration = await db.storageIntegration.findUnique({ where: { provider } });
  if (!integration) throw new Error('Google Drive belum dihubungkan oleh admin.');
  const client = createGoogleOAuthClient();
  let refreshToken;
  try {
    refreshToken = decrypt(integration.refreshTokenEncrypted);
  } catch (error) {
    console.error('Google Drive refresh token could not be decrypted.', error);
    throw new Error('Kredensial Google Drive tidak dapat dibaca. Gunakan GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY yang sama dengan deployment lalu hubungkan ulang Google Drive bila diperlukan.');
  }
  client.setCredentials({ refresh_token: refreshToken });
  return { drive: google.drive({ version: 'v3', auth: client }), folderId: integration.folderId, auth: client };
}

async function accessToken(client) {
  const token = await client.getAccessToken();
  const value = typeof token === 'string' ? token : token?.token;
  if (!value) throw new Error('Google Drive access token tidak tersedia. Hubungkan ulang Google Drive.');
  return value;
}

// The upload URL is a short-lived, single-file capability. It is created on
// the server using the encrypted refresh token, while the file bytes are sent
// by the browser directly to Google Drive and never pass through Vercel.
export async function createGoogleDriveResumableUpload({ name, parentId, contentType, contentLength, appProperties, getClient = googleDriveClient, fetchImpl = fetch }) {
  const { auth } = await getClient();
  const response = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken(auth)}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': contentType,
      'X-Upload-Content-Length': String(contentLength)
    },
    body: JSON.stringify({ name, parents: [parentId], appProperties })
  });
  if (!response.ok) throw new Error('Google Drive tidak dapat membuat sesi upload.');
  const uploadUrl = response.headers.get('location');
  if (!uploadUrl || !uploadUrl.startsWith('https://www.googleapis.com/')) {
    throw new Error('Google Drive tidak mengembalikan sesi upload yang valid.');
  }
  return { uploadUrl };
}

export async function getGoogleDriveFileMetadata(fileId, { getClient = googleDriveClient } = {}) {
  const { drive } = await getClient();
  const result = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size,parents,appProperties,trashed'
  });
  return result.data;
}
