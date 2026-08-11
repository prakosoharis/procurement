import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/current-user';
import { documentDto } from '../../../../lib/documents';
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
