import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/current-user';
import { prepareDocumentDirectUpload } from '../../../../lib/document-direct-upload-service';
import { directUploadErrorResponse } from '../../../../lib/document-direct-upload-response';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
    return NextResponse.json(await prepareDocumentDirectUpload(user, await request.json()), { status: 201 });
  } catch (error) {
    return directUploadErrorResponse(error);
  }
}
