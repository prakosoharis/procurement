import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { ensureSopBusinessUnitFolder } from '../../../lib/google-drive-folders';
import { isGoogleDriveStorage } from '../../../lib/storage';

const masterDataRoles = ['SUPER_USER', 'CORPORATE_GOVERNANCE'];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const [groups, industries, businessUnits, documentTypes] = await Promise.all([
    db.organizationGroup.findMany({ orderBy: { name: 'asc' } }),
    db.industry.findMany({ orderBy: { name: 'asc' } }),
    db.businessUnit.findMany({
      select: { id: true, name: true, groupName: true, industry: true, organizationGroupId: true, industryId: true },
      orderBy: { name: 'asc' }
    }),
    db.documentType.findMany({ orderBy: { sortOrder: 'asc' } })
  ]);
  return NextResponse.json({ groups, industries, businessUnits, documentTypes });
}

export async function POST(request) {
  const user = await currentUser();
  if (!masterDataRoles.includes(user?.role)) {
    return NextResponse.json({ error: 'Corporate Governance access required' }, { status: 403 });
  }

  const { kind, name, code, category, organizationGroupId, industryId } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  try {
    if (kind === 'group') {
      return NextResponse.json(await db.organizationGroup.create({ data: { name: name.trim() } }), { status: 201 });
    }
    if (kind === 'industry') {
      return NextResponse.json(await db.industry.create({ data: { name: name.trim() } }), { status: 201 });
    }
    if (kind === 'businessUnit') {
      if (!organizationGroupId || !industryId) {
        return NextResponse.json({ error: 'Group and industry are required' }, { status: 400 });
      }
      const [group, industry] = await Promise.all([
        db.organizationGroup.findUnique({ where: { id: organizationGroupId } }),
        db.industry.findUnique({ where: { id: industryId } })
      ]);
      if (!group || !industry) return NextResponse.json({ error: 'Invalid group or industry' }, { status: 400 });

      const businessUnit = await db.businessUnit.create({
        data: {
          name: name.trim(),
          country: 'Indonesia',
          groupName: group.name,
          industry: industry.name,
          organizationGroupId: group.id,
          industryId: industry.id
        }
      });

      try {
        const folder = isGoogleDriveStorage()
          ? await ensureSopBusinessUnitFolder({ businessUnit })
          : null;
        if (folder) {
          await db.auditLog.create({
            data: {
              actorId: user.id,
              entity: 'BusinessUnit',
              entityId: businessUnit.id,
              action: 'GOOGLE_DRIVE_FOLDER_PROVISIONED',
              detail: JSON.stringify({ path: folder.path, folderId: folder.folderId })
            }
          });
        }
        return NextResponse.json({
          ...businessUnit,
          googleDriveFolder: folder ? { path: folder.path, ready: true } : null
        }, { status: 201 });
      } catch (storageError) {
        // A BU must not be reported as created if its required Drive folder was
        // not provisioned. It is safe to remove this brand-new, unreferenced row.
        await db.businessUnit.delete({ where: { id: businessUnit.id } }).catch(console.error);
        console.error('Business Unit Google Drive folder provisioning failed', storageError);
        return NextResponse.json({ error: 'Business Unit tidak dapat dibuat karena folder Google Drive belum tersedia.' }, { status: 503 });
      }
    }
    if (kind === 'documentType') {
      const normalizedCode = (code || '').trim().toUpperCase();
      if (!normalizedCode || !['MANDATORY', 'ADDITIONAL'].includes(category)) {
        return NextResponse.json({ error: 'Document code and category are required' }, { status: 400 });
      }
      const last = await db.documentType.aggregate({ _max: { sortOrder: true } });
      return NextResponse.json(await db.documentType.create({
        data: { code: normalizedCode, name: name.trim(), category, sortOrder: (last._max.sortOrder || 0) + 1 }
      }), { status: 201 });
    }
    return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
  } catch (error) {
    console.error('Master data create failed', error);
    return NextResponse.json({ error: 'Master data already exists or could not be created.' }, { status: 409 });
  }
}
