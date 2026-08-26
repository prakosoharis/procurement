import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/current-user';
import { writeAudit } from '../../../../lib/documents';
import { canManageTemplates } from '../../../../lib/document-templates';
import { deleteGoogleDriveFile } from '../../../../lib/google-drive';

export const runtime = 'nodejs';

// A template is a blank starting point with no audit or evidentiary value of
// its own, so unlike a SOP document this is a real delete rather than an
// archive -- keeping stale templates around would only risk somebody
// downloading a withdrawn one. The deletion itself is still audited.
export async function DELETE(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canManageTemplates(user)) return NextResponse.json({ error: 'Hanya Super User atau Tim Procurement yang dapat mengelola template.' }, { status: 403 });

  const { id } = await params;
  const template = await db.documentTemplate.findUnique({
    where: { id },
    select: { id: true, title: true, fileKey: true, documentTypeId: true, industryId: true, companySizeId: true }
  });
  if (!template) return NextResponse.json({ error: 'Template tidak ditemukan.' }, { status: 404 });

  await db.documentTemplate.delete({ where: { id } });
  await writeAudit(user.id, 'DocumentTemplate', id, 'DELETE_TEMPLATE', JSON.stringify({
    title: template.title, documentTypeId: template.documentTypeId,
    industryId: template.industryId, companySizeId: template.companySizeId
  }));

  if (template.fileKey?.startsWith('gdrive:')) {
    await deleteGoogleDriveFile(template.fileKey.slice('gdrive:'.length))
      .catch((error) => console.error('Could not remove deleted template file from Google Drive.', error));
  }

  return NextResponse.json({ ok: true });
}
