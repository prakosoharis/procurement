import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser } from '../../../../../lib/current-user';
import { connectGoogleDrive } from '../../../../../lib/google-drive';

export async function GET(request) {
  const user = await currentUser();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = (await cookies()).get('google_drive_oauth_state')?.value;
  const redirect = new URL('/hub/repository', request.url);
  if (!['SUPER_USER', 'CORPORATE_GOVERNANCE'].includes(user?.role) || !code || !state || state !== expectedState) {
    redirect.searchParams.set('googleDrive', 'failed');
    const response = NextResponse.redirect(redirect);
    response.cookies.delete('google_drive_oauth_state');
    return response;
  }
  try {
    await connectGoogleDrive(code);
    redirect.searchParams.set('googleDrive', 'connected');
  } catch (error) {
    console.error(error);
    redirect.searchParams.set('googleDrive', 'failed');
  }
  const response = NextResponse.redirect(redirect);
  response.cookies.delete('google_drive_oauth_state');
  return response;
}
