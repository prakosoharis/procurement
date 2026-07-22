import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '../../../../../lib/db';
import { currentUser } from '../../../../../lib/current-user';
import { allowedDocumentTypes, canManageBusinessUnit, nextVersion, writeAudit } from '../../../../../lib/documents';
import { assertStorageReady, StorageConfigurationError, uploadObject } from '../../../../../lib/storage';

export async function POST(request,{params}) {
  try {
    const user=await currentUser(); if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
    const {id}=await params, document=await db.sopDocument.findUnique({where:{id},include:{versions:{orderBy:{uploadedAt:'desc'},take:1}}});
    if(!document)return NextResponse.json({error:'Document not found'},{status:404}); if(!canManageBusinessUnit(user,document.businessUnitId))return NextResponse.json({error:'Access denied'},{status:403});
    const data=await request.formData(),file=data.get('file'),changeSummary=data.get('changeSummary')?.toString().trim(); if(!file?.size||!changeSummary)return NextResponse.json({error:'File and change summary are required.'},{status:400}); if(file.size>25*1024*1024||!allowedDocumentTypes.has(file.type))return NextResponse.json({error:'Only PDF/DOCX files up to 25 MB are allowed.'},{status:400});
    await assertStorageReady();
    // A legacy Draft may exist without a file after a previous failed upload.
    // Its first successful upload must remain v1.0, not be treated as a revision.
    const versionNo=document.versions[0] ? nextVersion(document.versions[0].versionNo) : 'v1.0', safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),key=`documents/${document.businessUnitId}/${document.id}/${versionNo}/${randomUUID()}-${safeName}`;
    const stored = await uploadObject({key,body:Buffer.from(await file.arrayBuffer()),contentType:file.type});
    const version=await db.sopVersion.create({data:{sopDocumentId:id,versionNo,fileKey:stored.key,fileName:file.name,fileSize:file.size,contentType:file.type,changeSummary,approvalStatus:'DRAFT'}});
    await db.sopDocument.update({where:{id},data:{status:'DRAFT',currentVersion:versionNo}}); await writeAudit(user.id,'SopDocument',id,'CREATE_DRAFT_VERSION',JSON.stringify({version:versionNo,fileName:file.name}));
    return NextResponse.json({versionId:version.id,version:versionNo,status:'DRAFT'},{status:201});
  }catch(error){
    console.error(error);
    if(error instanceof StorageConfigurationError)return NextResponse.json({error:error.message},{status:503});
    return NextResponse.json({error:'Upload versi ke Google Drive gagal. Buka Vercel Runtime Logs untuk detailnya.'},{status:502});
  }
}
