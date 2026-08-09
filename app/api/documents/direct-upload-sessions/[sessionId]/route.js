import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/current-user';
import { cancelPendingDirectUpload, getDirectUploadStatus } from '../../../../../lib/document-direct-upload-service';
import { directUploadErrorResponse } from '../../../../../lib/document-direct-upload-response';

export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
    const { sessionId } = await params;
    return NextResponse.json(await getDirectUploadStatus(user, sessionId));
  } catch (error) {
    return directUploadErrorResponse(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
    const { sessionId } = await params;
    return NextResponse.json(await cancelPendingDirectUpload(user, sessionId));
  } catch (error) {
    return directUploadErrorResponse(error);
  }
}
