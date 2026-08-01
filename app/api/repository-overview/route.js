import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { documentDto } from '../../../lib/documents';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({error:'Authentication required'},{status:401});
  const businessUnitWhere = user.role === 'BUSINESS_UNIT_PIC' ? {id:user.businessUnitId} : {};
  const [businessUnits, documentTypes, documents, groups, industries, reviewers] = await Promise.all([
    db.businessUnit.findMany({where:businessUnitWhere,select:{id:true,name:true,groupName:true,industry:true,organizationGroupId:true,industryId:true},orderBy:{name:'asc'}}),
    db.documentType.findMany({orderBy:{sortOrder:'asc'}}),
    db.sopDocument.findMany({where:{businessUnit:businessUnitWhere},include:{businessUnit:true,documentType:true,owner:{select:{id:true,name:true,email:true,phone:true,jobTitle:true}},versions:{orderBy:{uploadedAt:'desc'},include:{submittedBy:{select:{id:true,name:true,email:true}},reviewer:{select:{id:true,name:true,email:true}},approvedBy:{select:{id:true,name:true,email:true}}}}},orderBy:{updatedAt:'desc'}}),
    db.organizationGroup.findMany({orderBy:{name:'asc'}}),
    db.industry.findMany({orderBy:{name:'asc'}}),
    db.user.findMany({where:{role:{in:['SUPER_USER','CORPORATE_GOVERNANCE']}},select:{id:true,name:true,email:true,role:true,jobTitle:true},orderBy:{name:'asc'}})
  ]);
  return NextResponse.json({viewer:{id:user.id,name:user.name,role:user.role},businessUnits,documentTypes,groups,industries,reviewers,documents:documents.map(documentDto)});
}
