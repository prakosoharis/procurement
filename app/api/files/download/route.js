import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/current-user';
import { canAccessBusinessUnit } from '../../../../lib/documents';
import { getObject } from '../../../../lib/storage';

export async function GET(request){
  const user=await currentUser(),url=new URL(request.url),key=url.searchParams.get('key'),inline=url.searchParams.get('mode')==='inline';
  if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
  if(!key)return NextResponse.json({error:'Missing key'},{status:400});
  const version=await db.sopVersion.findFirst({where:{fileKey:key},include:{sopDocument:true}});
  if(!version||!canAccessBusinessUnit(user,version.sopDocument.businessUnitId))return NextResponse.json({error:'File not found or access denied'},{status:404});
  try { const object=await getObject(key),filename=(version.fileName||'document').replace(/[\r\n"]/g,'_'),body=object.Body?.transformToWebStream?.()||Readable.toWeb(object.Body); if(!body)return NextResponse.json({error:'File body unavailable'},{status:500}); return new NextResponse(body,{headers:{'Content-Type':version.contentType||object.ContentType||'application/octet-stream','Content-Length':String(version.fileSize||object.ContentLength||''),'Content-Disposition':(inline?'inline':'attachment')+'; filename="'+filename+'"','Cache-Control':'private, no-store'}}); } catch(error){console.error(error);return NextResponse.json({error:'Unable to retrieve file'},{status:502});}
}
