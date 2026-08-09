import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/current-user';
import { prepareVersionDirectUpload } from '../../../../../lib/document-direct-upload-service';
import { directUploadErrorResponse } from '../../../../../lib/document-direct-upload-response';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHENTICATED' }, { status: 401 });
    const { id } = await params;
    return NextResponse.json(await prepareVersionDirectUpload(user, id, await request.json()), { status: 201 });
  } catch (error) {
    return directUploadErrorResponse(error);
  }
}
