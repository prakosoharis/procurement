import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../../lib/current-user';
import { markBlobUploadReady } from '../../../../../../lib/document-direct-upload-service';
import { directUploadErrorResponse } from '../../../../../../lib/document-direct-upload-response';
import { sopBlobTransfer } from '../../../../../../trigger/sop-blob-transfer';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
    const { sessionId } = await params;
    const result = await markBlobUploadReady(user, sessionId);
    if (result.shouldTrigger) await sopBlobTransfer.trigger({ sessionId });
    return NextResponse.json({ sessionId, status: result.session.status, message: 'File diterima. Draft SOP sedang dipindahkan ke Google Drive.' }, { status: 202 });
  } catch (error) {
    return directUploadErrorResponse(error);
  }
}
