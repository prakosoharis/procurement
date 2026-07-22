import { NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db';
import { currentUser } from '../../../../../../lib/current-user';

export async function POST(request,{params}){
  const user=await currentUser();if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
  const {id}=await params;
  await db.ticketNotification.updateMany({where:{id,recipientId:user.id,readAt:null},data:{readAt:new Date()}});
  return NextResponse.json({ok:true});
}
