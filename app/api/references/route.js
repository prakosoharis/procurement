import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { assertStorageReady, isGoogleDriveStorage, uploadObject } from '../../../lib/storage';
import { canManageReferences, currentUser } from '../../../lib/current-user';
import { ensureReferenceRegulationFolder } from '../../../lib/google-drive-folders';

export async function GET() {
  return NextResponse.json(await db.referenceSource.findMany({ orderBy: { createdAt: 'desc' } }));
}

// The existing reference form does not yet persist regulator metadata. Until
// Sprint 1 adds that model, optional form values are honored and the supported
// `type` field provides the stable folder grouping fallback.
export async function POST(request) {
  try {
    const user = await currentUser();
    if (!canManageReferences(user)) return NextResponse.json({ error: 'Compliance access required' }, { status: 403 });

    const data = await request.formData();
    const title = data.get('title')?.toString().trim();
    const type = data.get('type')?.toString();
    const sourceUrl = data.get('sourceUrl')?.toString() || null;
    const file = data.get('file');
    const publisher = data.get('publisher')?.toString().trim() || data.get('regulator')?.toString().trim() || type;
    const regulationNumber = data.get('regulationNumber')?.toString().trim() || title;
    const internalCategory = data.get('internalCategory')?.toString().trim() || undefined;
    if (!title || !type) return NextResponse.json({ error: 'Judul dan tipe wajib diisi.' }, { status: 400 });

    let fileKey = null;
    if (file?.size) {
      await assertStorageReady();
      const storageKey = `references/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const folder = isGoogleDriveStorage()
        ? await ensureReferenceRegulationFolder({ publisher, regulationNumber, internalCategory })
        : null;
      const stored = await uploadObject({
        key: storageKey,
        body: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || 'application/octet-stream',
        googleDriveParentId: folder?.folderId,
        googleDriveFileName: file.name
      });
      fileKey = stored.key;
    }
    const row = await db.referenceSource.create({ data: { title, type, sourceUrl, fileKey } });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Simpan reference gagal.' }, { status: 500 });
  }
}
