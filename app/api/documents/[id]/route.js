import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/current-user';
import { canManageBusinessUnit, documentDto, writeAudit } from '../../../../lib/documents';
import { deleteGoogleDriveFile } from '../../../../lib/google-drive';
import { scopeWhere } from '../../../../lib/authorization/scope';
import { startApiTiming } from '../../../../lib/api-performance';

const versionSelect = {
  id: true, versionNo: true, fileKey: true, fileName: true, fileSize: true,
  contentType: true, changeSummary: true, approvalStatus: true, uploadedAt: true,
  submittedAt: true, approvedAt: true,
  submittedBy: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } }
};

export async function GET(_request, { params }) {
  const timing = startApiTiming('/api/documents/:id');
  const user = await timing.measure('auth', () => currentUser());
  if (!user) return timing.apply(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));

  const { id } = await params;
  const document = await timing.measure('db', () => db.sopDocument.findFirst({
    where: { id, businessUnit: scopeWhere(user, 'businessUnit') },
    select: {
      id: true, title: true, status: true, language: true, currentVersion: true, updatedAt: true,
      businessUnit: { select: { id: true, name: true, groupName: true, industry: true, organizationGroupId: true, industryId: true } },
      documentType: { select: { id: true, code: true, name: true, category: true, sortOrder: true } },
      owner: { select: { id: true, name: true, email: true, phone: true, jobTitle: true } },
      versions: { orderBy: { uploadedAt: 'desc' }, select: versionSelect }
    }
  }));
  if (!document) return timing.apply(NextResponse.json({ error: 'Document not found.' }, { status: 404 }));

  return timing.apply(NextResponse.json(await timing.measure('serialize', () => documentDto(document))));
}

// A draft is soft-deleted (status -> ARCHIVED, same convention already used
// to let a title be re-uploaded -- see the duplicate-title check in
// POST /api/documents) rather than the row being removed, so existing
// AuditLog entries referencing this document stay valid and the action
// itself is auditable. The underlying Drive file IS actually removed: at
// DRAFT the document was never submitted or reviewed, so the file has no
// evidentiary value yet and keeping it would only waste storage.
export async function DELETE(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!canManageBusinessUnit(user)) return NextResponse.json({ error: 'You do not have access to delete this document.' }, { status: 403 });

  const { id } = await params;
  const document = await db.sopDocument.findFirst({
    where: { id, businessUnit: scopeWhere(user, 'businessUnit') },
    include: { versions: { orderBy: { uploadedAt: 'desc' } } }
  });
  if (!document) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  if (document.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft documents can be deleted.' }, { status: 409 });

  const version = document.versions[0];
  await db.$transaction([
    ...(version ? [db.sopVersion.update({ where: { id: version.id }, data: { approvalStatus: 'ARCHIVED', lifecycleState: 'ARCHIVED' } })] : []),
    db.sopDocument.update({ where: { id }, data: { status: 'ARCHIVED', isArchived: true, archivedAt: new Date() } })
  ]);
  await writeAudit(user.id, 'SopDocument', id, 'DELETE_DRAFT', JSON.stringify({ title: document.title, versionNo: version?.versionNo || null }));

  if (version?.fileKey?.startsWith('gdrive:')) {
    await deleteGoogleDriveFile(version.fileKey.slice('gdrive:'.length)).catch((error) => console.error('Could not remove deleted draft file from Google Drive.', error));
  }

  return NextResponse.json({ ok: true });
}
