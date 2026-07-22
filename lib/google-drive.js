import crypto from 'node:crypto';
import { google } from 'googleapis';
import { db } from './db';

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

export async function connectGoogleDrive(code) {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google tidak mengirim refresh token. Cabut akses aplikasi di Google Account lalu hubungkan ulang.');
  client.setCredentials({ refresh_token: tokens.refresh_token });
  const drive = google.drive({ version: 'v3', auth: client });
  const folder = await drive.files.create({
    requestBody: { name: 'Procurement Governance Hub', mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  if (!folder.data.id) throw new Error('Folder Google Drive tidak dapat dibuat.');
  await db.storageIntegration.upsert({
    where: { provider },
    update: { folderId: folder.data.id, refreshTokenEncrypted: encrypt(tokens.refresh_token), connectedAt: new Date() },
    create: { provider, folderId: folder.data.id, refreshTokenEncrypted: encrypt(tokens.refresh_token) }
  });
  return { folderId: folder.data.id };
}

export async function googleDriveClient() {
  const integration = await db.storageIntegration.findUnique({ where: { provider } });
  if (!integration) throw new Error('Google Drive belum dihubungkan oleh admin.');
  const client = createGoogleOAuthClient();
  client.setCredentials({ refresh_token: decrypt(integration.refreshTokenEncrypted) });
  return { drive: google.drive({ version: 'v3', auth: client }), folderId: integration.folderId };
}
