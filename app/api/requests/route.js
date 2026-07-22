import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';

export async function GET(){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
  const where=user.role==='BU_PIC'?{requesterId:user.id}:{};
  const rows=await db.sopRequest.findMany({
    where,
    include:{
      requester:{select:{id:true,name:true,email:true,businessUnit:{select:{name:true}}}},
      sopDocument:{include:{businessUnit:true}},
      messages:{include:{sender:{select:{id:true,name:true,role:true}}},orderBy:{createdAt:'asc'}}
    },
    orderBy:{updatedAt:'desc'}
  });
  const unreadNotifications=await db.ticketNotification.findMany({where:{recipientId:user.id,readAt:null},include:{message:{include:{request:true,sender:{select:{name:true}}}}},orderBy:{createdAt:'desc'}});
  return NextResponse.json({requests:rows,viewer:{id:user.id,role:user.role},unreadNotifications});
}

export async function POST(request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
  const {title,requestType='REVISION',description,sopDocumentId,changeType,clauseReference,currentText,proposedText,businessImpact,priority='MEDIUM',clientRequestKey}=await request.json();
  if(requestType==='EXCEPTION'&&user.role!=='BU_PIC')return NextResponse.json({error:'Request for Exception hanya dapat diajukan oleh Business Unit.'},{status:403});
  if(!title||!description||!sopDocumentId||!changeType||!clauseReference||!proposedText||!clientRequestKey)return NextResponse.json({error:'Lengkapi SOP, pasal, jenis perubahan, usulan perubahan, dan alasan bisnis.'},{status:400});
  const existing=await db.sopRequest.findUnique({where:{clientRequestKey}});
  if(existing)return NextResponse.json({id:existing.id,duplicate:true},{status:200});
  const sop=await db.sopDocument.findUnique({where:{id:sopDocumentId}});
  if(!sop||sop.status!=='APPROVED')return NextResponse.json({error:'Hanya SOP berstatus Approved yang dapat diajukan untuk revisi.'},{status:400});
  if(user.role==='BU_PIC'&&user.businessUnitId!==sop.businessUnitId)return NextResponse.json({error:'Anda hanya dapat mengajukan revisi untuk SOP Business Unit sendiri.'},{status:403});
  try{
    const row=await db.sopRequest.create({data:{clientRequestKey,title,requestType,description,sopDocumentId,changeType,clauseReference,currentText:currentText||null,proposedText,businessImpact:businessImpact||null,priority,requesterId:user.id}});
    await db.auditLog.create({data:{actorId:user.id,entity:'SopRequest',entityId:row.id,action:'CREATE_REVISION_REQUEST',detail:JSON.stringify({sopDocumentId,changeType,clauseReference})}});
    return NextResponse.json({id:row.id},{status:201});
  }catch(error){
    const duplicate=await db.sopRequest.findUnique({where:{clientRequestKey}});
    if(duplicate)return NextResponse.json({id:duplicate.id,duplicate:true});
    throw error;
  }
}
