import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { allowedDocumentTypes, writeAudit } from '../../../lib/documents';
import { canManageTemplates, listTemplates, templateDto, templateSelect } from '../../../lib/document-templates';
import { assertStorageReady, isGoogleDriveStorage, StorageConfigurationError, uploadObject } from '../../../lib/storage';
import { ensureTemplateFolder } from '../../../lib/google-drive-folders';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Every authenticated role may browse and download templates -- a template is
// a blank starting point, not anyone's governing document, so there is nothing
// Business-Unit-confidential to scope here. Only creating one is restricted.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const [templates, documentTypes, industries, companySizes] = await Promise.all([
    listTemplates({ db }),
    db.documentType.findMany({ select: { id: true, code: true, name: true, category: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } }),
    db.industry.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.companySize.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  ]);

  return NextResponse.json({
    viewer: { id: user.id, role: user.role, canManage: canManageTemplates(user) },
    templates: templates.map(templateDto),
    documentTypes, industries, companySizes
  });
}

export async function POST(request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (!canManageTemplates(user)) return NextResponse.json({ error: 'Hanya Super User atau Tim Procurement yang dapat mengelola template.' }, { status: 403 });

    const data = await request.formData();
    const documentTypeId = data.get('documentTypeId')?.toString();
    const title = data.get('title')?.toString().trim();
    const description = data.get('description')?.toString().trim() || null;
    // An empty string from the form means "applies to all"; store it as null
    // so the database holds one representation of that idea, not two.
    const industryId = data.get('industryId')?.toString() || null;
    const companySizeId = data.get('companySizeId')?.toString() || null;
    const file = data.get('file');

    if (!documentTypeId || !title || !file?.size) {
      return NextResponse.json({ error: 'Jenis dokumen, judul, dan file wajib diisi.' }, { status: 400 });
    }
    if (title.length > 300) return NextResponse.json({ error: 'Judul terlalu panjang.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE || !allowedDocumentTypes.has(file.type)) {
      return NextResponse.json({ error: 'Hanya file PDF/DOCX hingga 25 MB yang dapat diunggah.' }, { status: 400 });
    }

    const documentType = await db.documentType.findUnique({ where: { id: documentTypeId }, select: { id: true, code: true } });
    if (!documentType) return NextResponse.json({ error: 'Jenis dokumen tidak ditemukan.' }, { status: 404 });

    await assertStorageReady();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder = isGoogleDriveStorage() ? await ensureTemplateFolder({ documentTypeCode: documentType.code }) : null;
    const stored = await uploadObject({
      key: `templates/${documentType.code}/${randomUUID()}-${safeName}`,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      googleDriveParentId: folder?.folderId,
      googleDriveFileName: `${documentType.code} — ${title} — ${file.name}`
    });

    const template = await db.documentTemplate.create({
      data: {
        documentTypeId, industryId, companySizeId, title, description,
        fileKey: stored.key, fileName: file.name, fileSize: file.size, contentType: file.type,
        uploadedById: user.id
      },
      select: templateSelect
    }).catch((error) => {
      if (error?.code === 'P2002') {
        throw new TemplateConflict('Sudah ada template untuk kombinasi jenis dokumen, industry, dan ukuran tersebut. Hapus atau ganti template lama terlebih dahulu.');
      }
      throw error;
    });

    await writeAudit(user.id, 'DocumentTemplate', template.id, 'CREATE_TEMPLATE', JSON.stringify({ documentTypeId, industryId, companySizeId, title }));
    return NextResponse.json(templateDto(template), { status: 201 });
  } catch (error) {
    if (error instanceof TemplateConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof StorageConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error('[document-templates:POST]', error);
    return NextResponse.json({ error: 'Template gagal disimpan.' }, { status: 500 });
  }
}

class TemplateConflict extends Error {}
