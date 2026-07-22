import { NextResponse } from 'next/server'; import { db } from '../../../lib/db';
export async function GET(){return NextResponse.json(await db.documentType.findMany({orderBy:{sortOrder:'asc'}}));}
