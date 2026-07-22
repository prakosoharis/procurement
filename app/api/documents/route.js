import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { allowedDocumentTypes, canManageBusinessUnit, documentDto, writeAudit } from '../../../lib/documents';
import { uploadObject } from '../../../lib/storage';

export async function GET(request) {
  const user = await currentUser(); if (!user) return NextResponse.json({error:'Authentication required'},{status:401});
  const url = new URL(request.url), group = url.searchParams.get('group'), businessUnitId = url.searchParams.get('businessUnitId'), industry = url.searchParams.get('industry');
  const where = { ...(businessUnitId ? {businessUnitId} : {}), businessUnit:{...(group?{groupName:group}:{}),...(industry?{industry}:{})} };
  if (user.role === 'BU_PIC') { where.businessUnitId = user.businessUnitId; }
  const documents = await db.sopDocument.findMany({where,include:{businessUnit:true,documentType:true,owner:{select:{id:true,name:true,email:true,phone:true,jobTitle:true}},versions:{orderBy:{uploadedAt:'desc'},take:1}},orderBy:{updatedAt:'desc'}});
  return NextResponse.json(documents.map(documentDto));
}

export async function POST(request) {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({error:'Authentication required'},{status:401});
    const data = await request.formData(), businessUnitId = data.get('businessUnitId')?.toString(), documentTypeId = data.get('documentTypeId')?.toString(), title = data.get('title')?.toString().trim(), language = data.get('language')?.toString() || 'id', ownerId = data.get('ownerId')?.toString() || user.id, file = data.get('file');
    if (!businessUnitId || !documentTypeId || !title || !file?.size) return NextResponse.json({error:'Business unit, document type, title, and file are required.'},{status:400});
    if (!canManageBusinessUnit(user,businessUnitId)) return NextResponse.json({error:'You do not have access to this business unit.'},{status:403});
    if (file.size > 25 * 1024 * 1024 || !allowedDocumentTypes.has(file.type)) return NextResponse.json({error:'Only PDF/DOCX files up to 25 MB are allowed.'},{status:400});
    const [existing,owner] = await Promise.all([db.sopDocument.findFirst({where:{businessUnitId,documentTypeId,status:{not:'ARCHIVED'}}}),db.user.findFirst({where:{id:ownerId,role:'BU_PIC',businessUnitId}})]);
    if (existing) return NextResponse.json({error:'Document type already exists for this business unit. Use update version instead.'},{status:409});
    if (!owner) return NextResponse.json({error:'Selected PIC must belong to the selected business unit.'},{status:400});
    const document = await db.sopDocument.create({data:{businessUnitId,documentTypeId,title,language,ownerId,status:'DRAFT',currentVersion:'v1.0'}});
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_'), key = `documents/${businessUnitId}/${document.id}/v1.0/${randomUUID()}-${safeName}`;
    await uploadObject({key,body:Buffer.from(await file.arrayBuffer()),contentType:file.type});
    const version = await db.sopVersion.create({data:{sopDocumentId:document.id,versionNo:'v1.0',fileKey:key,fileName:file.name,fileSize:file.size,contentType:file.type,changeSummary:'Initial upload',approvalStatus:'DRAFT'}});
    await writeAudit(user.id,'SopDocument',document.id,'CREATE_DRAFT',JSON.stringify({version:version.versionNo,fileName:file.name}));
    return NextResponse.json({id:document.id,versionId:version.id,status:'DRAFT',version:'v1.0'},{status:201});
  } catch (error) { console.error(error); return NextResponse.json({error:'Document upload failed.'},{status:500}); }
}
