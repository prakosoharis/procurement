import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { ensureSopBusinessUnitFolder } from '../../../lib/google-drive-folders';
import { isGoogleDriveStorage } from '../../../lib/storage';

const masterDataRoles = ['SUPER_USER', 'CORPORATE_GOVERNANCE'];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const [groups, industries, businessUnits, documentTypes, companySizes] = await Promise.all([
    db.organizationGroup.findMany({ orderBy: { name: 'asc' } }),
    db.industry.findMany({ orderBy: { name: 'asc' } }),
    db.businessUnit.findMany({
      select: { id: true, name: true, groupName: true, industry: true, organizationGroupId: true, industryId: true, companySizeId: true },
      orderBy: { name: 'asc' }
    }),
    db.documentType.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.companySize.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  ]);
  return NextResponse.json({ groups, industries, businessUnits, documentTypes, companySizes });
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
    if (kind === 'companySize') {
      // sortOrder keeps Kecil/Menengah/Besar in a meaningful order rather
      // than alphabetical, which would read as Besar/Kecil/Menengah.
      const last = await db.companySize.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
      return NextResponse.json(await db.companySize.create({ data: { name: name.trim(), sortOrder: (last?.sortOrder ?? 0) + 1 } }), { status: 201 });
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
      if (!/^M\d+$/.test(normalizedCode) || category !== 'MANDATORY') {
        return NextResponse.json({ error: 'Jenis dokumen baru harus Mandatory dengan kode M. Additional dikelola sebagai satu kategori Other.' }, { status: 400 });
      }
      return NextResponse.json(await db.documentType.create({
        data: { code: normalizedCode, name: name.trim(), category, sortOrder: Number(normalizedCode.slice(1)) }
      }), { status: 201 });
    }
    return NextResponse.json({ error: 'Invalid master data type' }, { status: 400 });
  } catch (error) {
    console.error('Master data create failed', error);
    return NextResponse.json({ error: 'Master data already exists or could not be created.' }, { status: 409 });
  }
}

export async function PATCH(request) {
  const user = await currentUser();
  if (!masterDataRoles.includes(user?.role)) {
    return NextResponse.json({ error: 'Corporate Governance access required' }, { status: 403 });
  }

  const { kind, businessUnitId, organizationGroupId, industryId, companySizeId } = await request.json();
  if (kind !== 'businessUnit' || !businessUnitId || !organizationGroupId || !industryId) {
    return NextResponse.json({ error: 'Business Unit, group, and industry are required.' }, { status: 400 });
  }

  try {
    const updated = await db.$transaction(async (tx) => {
      // Company size stays optional: the Business Units that existed before
      // this field was introduced must keep saving without one.
      const [businessUnit, group, industry, companySize] = await Promise.all([
        tx.businessUnit.findUnique({ where: { id: businessUnitId } }),
        tx.organizationGroup.findUnique({ where: { id: organizationGroupId } }),
        tx.industry.findUnique({ where: { id: industryId } }),
        companySizeId ? tx.companySize.findUnique({ where: { id: companySizeId } }) : Promise.resolve(null)
      ]);
      if (!businessUnit || !group || !industry) {
        throw new Error('INVALID_MASTER_DATA_REFERENCE');
      }
      if (companySizeId && !companySize) throw new Error('INVALID_MASTER_DATA_REFERENCE');
      const next = await tx.businessUnit.update({
        where: { id: businessUnit.id },
        data: {
          groupName: group.name,
          industry: industry.name,
          organizationGroupId: group.id,
          industryId: industry.id,
          companySizeId: companySize?.id ?? null
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entity: 'BusinessUnit',
          entityId: businessUnit.id,
          action: 'UPDATE_BUSINESS_UNIT_CLASSIFICATION',
          detail: JSON.stringify({
            before: { groupName: businessUnit.groupName, industry: businessUnit.industry },
            after: { groupName: next.groupName, industry: next.industry }
          })
        }
      });
      return next;
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error.message === 'INVALID_MASTER_DATA_REFERENCE') {
      return NextResponse.json({ error: 'Business Unit, group, or industry tidak ditemukan.' }, { status: 404 });
    }
    console.error('Business Unit master data update failed', error);
    return NextResponse.json({ error: 'Business Unit tidak dapat diperbarui.' }, { status: 409 });
  }
}
