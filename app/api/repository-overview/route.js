import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { documentDto } from '../../../lib/documents';
import { scopeWhere } from '../../../lib/authorization/scope';
import { startApiTiming } from '../../../lib/api-performance';

export async function GET() {
  const timing = startApiTiming('/api/repository-overview');
  const user = await timing.measure('auth', () => currentUser());
  if (!user) return timing.apply(NextResponse.json({error:'Authentication required'},{status:401}));

  const businessUnitWhere = scopeWhere(user, 'businessUnit');
  const versionSelect = {
    id: true, versionNo: true, fileKey: true, fileName: true, fileSize: true,
    contentType: true, changeSummary: true, approvalStatus: true, uploadedAt: true,
    submittedAt: true, approvedAt: true,
    submittedBy: { select: { id: true, name: true, email: true } },
    reviewer: { select: { id: true, name: true, email: true } },
    approvedBy: { select: { id: true, name: true, email: true } }
  };
  const [businessUnits, documentTypes, documents, groups, industries, reviewers] = await timing.measure('db', () => Promise.all([
    db.businessUnit.findMany({where:businessUnitWhere,select:{id:true,name:true,groupName:true,industry:true,organizationGroupId:true,industryId:true},orderBy:{name:'asc'}}),
    db.documentType.findMany({select:{id:true,code:true,name:true,category:true,sortOrder:true},orderBy:{sortOrder:'asc'}}),
    db.sopDocument.findMany({
      where:{businessUnit:businessUnitWhere,status:{not:'ARCHIVED'}},
      select:{
        id:true,title:true,status:true,language:true,currentVersion:true,updatedAt:true,
        businessUnit:{select:{id:true,name:true,groupName:true,industry:true,organizationGroupId:true,industryId:true}},
        documentType:{select:{id:true,code:true,name:true,category:true,sortOrder:true}},
        owner:{select:{id:true,name:true,email:true,phone:true,jobTitle:true}},
        versions:{orderBy:{uploadedAt:'desc'},take:1,select:versionSelect}
      },
      orderBy:{updatedAt:'desc'}
    }),
    db.organizationGroup.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.industry.findMany({select:{id:true,name:true},orderBy:{name:'asc'}}),
    db.user.findMany({where:{role:{in:['SUPER_USER','CORPORATE_GOVERNANCE']}},select:{id:true,name:true,email:true,role:true,jobTitle:true},orderBy:{name:'asc'}})
  ]));
  const payload = await timing.measure('serialize', () => ({
    viewer:{id:user.id,name:user.name,role:user.role},businessUnits,documentTypes,groups,industries,reviewers,
    documents:documents.map((document) => documentDto(document, { includeVersionHistory: false }))
  }));
  return timing.apply(NextResponse.json(payload));
}
