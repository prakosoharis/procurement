import { db as defaultDb } from '../../db'; import { assertScope } from '../authorization'; import { fail } from '../errors'; import { recordGovernanceEvent } from '../activity/governance-audit-log';
export async function createRevisionFromPublished({ sopDocumentId, sourceVersionId, actor, reason, db = defaultDb }) {
  if (!reason?.trim()) fail('MISSING_REQUIRED_METADATA','Revision reason is required.');
  return db.$transaction(async tx => { const source=await tx.sopVersion.findUnique({where:{id:sourceVersionId},include:{sopDocument:true}}); if(!source||source.sopDocumentId!==sopDocumentId) fail('NOT_FOUND','Published source version does not belong to this SOP.'); if(source.lifecycleState!=='PUBLISHED') fail('INVALID_TRANSITION','Revision source must be a published version.'); assertScope(actor,source.sopDocument.businessUnitId);
    const count=await tx.sopVersion.count({where:{sopDocumentId}}); const versionNo=`${source.versionNo}-rev-${count+1}`;
    const revision=await tx.sopVersion.create({data:{sopDocumentId,versionNo,fileKey:source.fileKey,fileName:source.fileName,fileSize:source.fileSize,contentType:source.contentType,changeSummary:`Revision of ${source.versionNo}: ${reason}`,lifecycleState:'DRAFT',approvalStatus:'DRAFT'}});
    await recordGovernanceEvent(tx,{actor,businessUnitId:source.sopDocument.businessUnitId,entity:'SopVersion',entityId:revision.id,action:'REVISION_CREATED',previousState:'PUBLISHED',resultingState:'DRAFT',reason,metadata:{sourceVersionId}}); return revision; });
}
