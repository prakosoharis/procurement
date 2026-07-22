import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { currentUser } from '../../../../../lib/current-user';

export async function POST(request,{params}){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
  const {id}=await params,{body}=await request.json();if(!body?.trim())return NextResponse.json({error:'Pesan tidak boleh kosong.'},{status:400});
  const ticket=await db.sopRequest.findUnique({where:{id}});if(!ticket)return NextResponse.json({error:'Request tidak ditemukan.'},{status:404});
  if(user.role==='BU_PIC'&&ticket.requesterId!==user.id)return NextResponse.json({error:'Akses ditolak.'},{status:403});
  if(['APPROVED','REJECTED'].includes(ticket.status))return NextResponse.json({error:'Ticket sudah closed dan tidak dapat diberi respons.'},{status:409});
  const message=await db.requestMessage.create({data:{requestId:id,senderId:user.id,body:body.trim()}});
  await db.sopRequest.update({where:{id},data:{status:ticket.status==='REVISION_REQUIRED'?'IN_REVIEW':ticket.status}});
  if(user.role==='BU_PIC'){const recipients=await db.user.findMany({where:{role:{in:['COMPLIANCE_ADMIN','CORPORATE_PROCUREMENT']}},select:{id:true}});if(recipients.length)await db.ticketNotification.createMany({data:recipients.map(recipient=>({messageId:message.id,recipientId:recipient.id})),skipDuplicates:true});}
  return NextResponse.json({ok:true},{status:201});
}
