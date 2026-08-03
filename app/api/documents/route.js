import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { allowedDocumentTypes, canManageBusinessUnit, documentDto, writeAudit } from '../../../lib/documents';
import { assertStorageReady, isGoogleDriveStorage, StorageConfigurationError, uploadObject } from '../../../lib/storage';
import { ensureSopBusinessUnitFolder, sopDriveFileName } from '../../../lib/google-drive-folders';

export async function GET(request) {
  const user = await currentUser(); if (!user) return NextResponse.json({error:'Authentication required'},{status:401});
  const url = new URL(request.url), group = url.searchParams.get('group'), businessUnitId = url.searchParams.get('businessUnitId'), industry = url.searchParams.get('industry');
  const where = { ...(businessUnitId ? {businessUnitId} : {}), businessUnit:{...(group?{groupName:group}:{}),...(industry?{industry}:{})} };
  if (user.role === 'BUSINESS_UNIT_PIC') { where.businessUnitId = user.businessUnitId; }
  const documents = await db.sopDocument.findMany({where,include:{businessUnit:true,documentType:true,owner:{select:{id:true,name:true,email:true,phone:true,jobTitle:true}},versions:{orderBy:{uploadedAt:'desc'},take:1,include:{submittedBy:{select:{id:true,name:true,email:true}},reviewer:{select:{id:true,name:true,email:true}},approvedBy:{select:{id:true,name:true,email:true}}}}},orderBy:{updatedAt:'desc'}});
  return NextResponse.json(documents.map(documentDto));
}

export async function POST(request) {
  let createdDocumentId;
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({error:'Authentication required'},{status:401});
    const data = await request.formData(), businessUnitId = data.get('businessUnitId')?.toString(), documentTypeId = data.get('documentTypeId')?.toString(), title = data.get('title')?.toString().trim(), language = data.get('language')?.toString() || 'id', ownerId = data.get('ownerId')?.toString() || user.id, reviewerId = data.get('reviewerId')?.toString(), file = data.get('file');
    if (!businessUnitId || !documentTypeId || !title || !reviewerId || !file?.size) return NextResponse.json({error:'Business unit, document type, title, reviewer, and file are required.'},{status:400});
    if (!canManageBusinessUnit(user,businessUnitId)) return NextResponse.json({error:'You do not have access to this business unit.'},{status:403});
    if (file.size > 25 * 1024 * 1024 || !allowedDocumentTypes.has(file.type)) return NextResponse.json({error:'Only PDF/DOCX files up to 25 MB are allowed.'},{status:400});
    const [existing, owner, reviewer, businessUnit] = await Promise.all([
      db.sopDocument.findFirst({ where: { businessUnitId, documentTypeId, status: { not: 'ARCHIVED' } } }),
      db.user.findFirst({ where: { id: ownerId, role: 'BUSINESS_UNIT_PIC', businessUnitId } }),
      db.user.findFirst({ where: { id: reviewerId, role: { in: ['SUPER_USER', 'CORPORATE_GOVERNANCE'] } }, select: { id: true, name: true, email: true } }),
      db.businessUnit.findUnique({ where: { id: businessUnitId } })
    ]);
    if (existing) return NextResponse.json({error:'Document type already exists for this business unit. Use update version instead.'},{status:409});
    if (!owner) return NextResponse.json({error:'Selected PIC must belong to the selected business unit.'},{status:400});
    if (!reviewer) return NextResponse.json({error:'Assigned reviewer must be Super User or Tim Procurement.'},{status:400});
    if (!businessUnit) return NextResponse.json({error:'Business unit not found.'},{status:404});
    await assertStorageReady();
    const document = await db.sopDocument.create({data:{businessUnitId,documentTypeId,title,language,ownerId,status:'DRAFT',currentVersion:'v1.0'}});
    createdDocumentId = document.id;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_'), key = `documents/${businessUnitId}/${document.id}/v1.0/${randomUUID()}-${safeName}`;
    const folder = isGoogleDriveStorage()
      ? await ensureSopBusinessUnitFolder({ businessUnit })
      : null;
    const stored = await uploadObject({
      key,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      googleDriveParentId: folder?.folderId,
      googleDriveFileName: folder ? sopDriveFileName({ title, versionNo: 'v1.0', fileName: file.name }) : undefined
    });
    const version = await db.sopVersion.create({data:{sopDocumentId:document.id,versionNo:'v1.0',fileKey:stored.key,fileName:file.name,fileSize:file.size,contentType:file.type,changeSummary:'Initial upload',approvalStatus:'DRAFT',submittedById:user.id,submittedAt:new Date(),reviewerId}});
    await writeAudit(user.id,'SopDocument',document.id,'CREATE_DRAFT',JSON.stringify({version:version.versionNo,fileName:file.name,submittedById:user.id,reviewerId}));
    return NextResponse.json({id:document.id,versionId:version.id,status:'DRAFT',version:'v1.0',submittedBy:{id:user.id,name:user.name},reviewer},{status:201});
  } catch (error) {
    console.error(error);
    if (createdDocumentId) {
      // Upload can fail after the Draft is created. Remove only an empty Draft;
      // never remove a document that already has a stored version.
      await db.sopDocument.deleteMany({where:{id:createdDocumentId,versions:{none:{}}}}).catch(console.error);
    }
    if (error instanceof StorageConfigurationError) return NextResponse.json({error:error.message},{status:503});
    return NextResponse.json({error:'Upload ke Google Drive gagal. Buka Vercel Runtime Logs untuk detailnya.'},{status:502});
  }
}
