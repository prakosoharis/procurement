import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/current-user';
import { googleAuthorizationUrl, googleDriveConfigured } from '../../../../../lib/google-drive';

export async function GET(request) {
  const user = await currentUser();
  if (user?.role !== 'COMPLIANCE_ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  if (!googleDriveConfigured()) return NextResponse.json({ error: 'Google Drive belum dikonfigurasi. Isi environment variable Google Drive terlebih dahulu.' }, { status: 503 });
  const state = crypto.randomBytes(32).toString('base64url');
  const response = NextResponse.redirect(googleAuthorizationUrl(state));
  response.cookies.set('google_drive_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/' });
  return response;
}
