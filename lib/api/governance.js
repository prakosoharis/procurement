import { NextResponse } from 'next/server'; import { currentUser } from '../current-user'; import { GovernanceError } from '../governance/errors';
import { errorStatus } from './error-contract';
export const requestId=()=>crypto.randomUUID();
export function json(data,status=200,id=requestId()){return NextResponse.json({ok:true,data,meta:{requestId:id}},{status});}
export { errorStatus };
export function domain(code,message){return new GovernanceError(code,message)}
export function error(e,id=requestId()){const code=e instanceof GovernanceError?e.code:(errorStatus[e?.code]?e.code:'INTERNAL_ERROR');if(code==='INTERNAL_ERROR')console.error(`[governance:${id}]`,e);return NextResponse.json({ok:false,error:{code,message:code==='INTERNAL_ERROR'?'Internal server error.':e.message,details:null},meta:{requestId:id}},{status:errorStatus[code]||500});}
export async function actor(){const user=await currentUser();if(!user)throw new GovernanceError('UNAUTHORIZED','Authentication required.');return user;}
export async function body(req){try{return await req.json();}catch{throw new GovernanceError('INVALID_INPUT','Valid JSON body is required.');}}
export function serial(value){if(value instanceof Date)return value.toISOString();if(Array.isArray(value))return value.map(serial);if(value&&typeof value==='object'){if(typeof value.toFixed==='function'&&value.constructor?.name==='Decimal')return value.toString();return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,serial(v)]));}return value;}
