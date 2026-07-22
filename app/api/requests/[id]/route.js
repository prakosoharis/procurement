import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { currentUser, canReview } from '../../../../lib/current-user';

export async function PATCH(request,{params}){
  const user=await currentUser();if(!canReview(user))return NextResponse.json({error:'Corporate Procurement / Compliance reviewer access required'},{status:403});
  const {id}=await params,{status,reviewerComment}=await request.json();
  if(!['IN_REVIEW','REVISION_REQUIRED','APPROVED','REJECTED'].includes(status))return NextResponse.json({error:'Invalid request status'},{status:400});
  const comment=reviewerComment?.trim()||null;if((status==='REVISION_REQUIRED'||status==='REJECTED')&&!comment)return NextResponse.json({error:'Catatan reviewer wajib diisi untuk keputusan ini.'},{status:400});
  const row=await db.sopRequest.update({where:{id},data:{status,reviewerComment:comment,reviewedAt:new Date()}});
  if(comment)await db.requestMessage.create({data:{requestId:id,senderId:user.id,body:comment}});
  await db.auditLog.create({data:{actorId:user.id,entity:'SopRequest',entityId:id,action:'REVIEW_REQUEST',detail:JSON.stringify({status})}});
  return NextResponse.json(row);
}
