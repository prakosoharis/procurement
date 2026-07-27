import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';

export async function GET(request) {
  const user=await currentUser(); if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
  const businessUnitId=new URL(request.url).searchParams.get('businessUnitId');
  const where={role:'BUSINESS_UNIT_PIC',...(businessUnitId?{businessUnitId}:{})}; if(user.role==='BUSINESS_UNIT_PIC')where.businessUnitId=user.businessUnitId;
  return NextResponse.json(await db.user.findMany({where,select:{id:true,name:true,email:true,phone:true,jobTitle:true,locale:true,businessUnitId:true,businessUnit:{select:{name:true,groupName:true,industry:true}}},orderBy:{name:'asc'}}));
}
export async function POST(request) {
  const user=await currentUser(); if(user?.role!=='SUPER_USER')return NextResponse.json({error:'Super User access required'},{status:403});
  const {name,email,phone,jobTitle,locale,businessUnitId,temporaryPassword}=await request.json();
  if(!name?.trim()||!email?.trim()||!businessUnitId||!temporaryPassword||temporaryPassword.length<8)return NextResponse.json({error:'Name, email, business unit, and a minimum 8-character password are required.'},{status:400});
  const businessUnit=await db.businessUnit.findUnique({where:{id:businessUnitId}});if(!businessUnit)return NextResponse.json({error:'Business unit not found'},{status:404});
  try { const pic=await db.user.create({data:{name:name.trim(),email:email.trim().toLowerCase(),phone:phone?.trim()||null,jobTitle:jobTitle?.trim()||'PIC',locale:locale||'id',businessUnitId,passwordHash:await bcrypt.hash(temporaryPassword,10),role:'BUSINESS_UNIT_PIC'}}); await db.auditLog.create({data:{actorId:user.id,entity:'User',entityId:pic.id,action:'CREATE_PIC',detail:JSON.stringify({businessUnit:businessUnit.name})}}); return NextResponse.json({id:pic.id,name:pic.name},{status:201}); } catch { return NextResponse.json({error:'Email PIC sudah terdaftar atau data tidak valid.'},{status:409}); }
}
