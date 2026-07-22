import { NextResponse } from 'next/server'; import { db } from '../../../lib/db';
export async function GET(){return NextResponse.json(await db.businessUnit.findMany({select:{id:true,name:true,groupName:true,industry:true},orderBy:{name:'asc'}}));}
