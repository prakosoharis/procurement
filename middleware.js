import { NextResponse } from 'next/server';
export function middleware(request){const token=request.cookies.get('session')?.value;const {pathname}=request.nextUrl;if(pathname.startsWith('/api/')){if(pathname==='/api/auth/login')return NextResponse.next();return token?NextResponse.next():NextResponse.json({error:'Authentication required'},{status:401})}if(pathname==='/login'||token)return NextResponse.next();return NextResponse.redirect(new URL('/login',request.url))}
export const config={matcher:['/((?!_next|favicon.ico|procurement-governance-hub.html).*)']};
