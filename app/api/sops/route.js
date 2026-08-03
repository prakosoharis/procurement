import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { assertStorageReady, isGoogleDriveStorage, uploadObject } from '../../../lib/storage';
import { currentUser } from '../../../lib/current-user';
import { canManageBusinessUnit } from '../../../lib/documents';
import { ensureSopBusinessUnitFolder, sopDriveFileName } from '../../../lib/google-drive-folders';

// Compatibility endpoint used by the approved existing interface. New uploads
// follow the same BU folder convention as the document API.
export async function POST(request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!canManageBusinessUnit(user)) {
      return NextResponse.json({ error: 'Hanya Admin dan Tim Compliance yang dapat upload atau update SOP.' }, { status: 403 });
    }

    const data = await request.formData();
    const title = data.get('title')?.toString().trim();
    const businessUnitName = data.get('businessUnit')?.toString().trim();
    const version = data.get('version')?.toString().trim();
    const language = data.get('language')?.toString() || 'id';
    const file = data.get('file');
    if (!title || !businessUnitName || !version) {
      return NextResponse.json({ error: 'Judul, Business Unit, dan versi wajib diisi.' }, { status: 400 });
    }

    const businessUnit = await db.businessUnit.upsert({
      where: { name: businessUnitName },
      update: {},
      create: { name: businessUnitName, country: 'Indonesia' }
    });

    let fileKey = null;
    let fileName = null;
    if (file?.size) {
      await assertStorageReady();
      fileName = file.name;
      const storageKey = `sops/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const folder = isGoogleDriveStorage()
        ? await ensureSopBusinessUnitFolder({ businessUnit })
        : null;
      const stored = await uploadObject({
        key: storageKey,
        body: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || 'application/octet-stream',
        googleDriveParentId: folder?.folderId,
        googleDriveFileName: folder ? sopDriveFileName({ title, versionNo: version, fileName }) : undefined
      });
      fileKey = stored.key;
    }

    const document = await db.sopDocument.create({
      data: {
        title,
        businessUnitId: businessUnit.id,
        ownerId: user.id,
        language,
        status: 'DRAFT',
        currentVersion: version,
        versions: { create: { versionNo: version, fileKey, fileName, approvalStatus: 'DRAFT' } }
      }
    });
    await db.auditLog.create({ data: { actorId: user.id, entity: 'SopDocument', entityId: document.id, action: 'CREATE_DRAFT' } });
    return NextResponse.json({ id: document.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Upload SOP gagal. Periksa konfigurasi storage.' }, { status: 500 });
  }
}
