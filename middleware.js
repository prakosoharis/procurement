import { NextResponse } from 'next/server';

function legacyDestination(pathname) {
  if (pathname === '/dashboard') return '/';
  if (pathname.startsWith('/repository')) return '/hub/repository';
  if (pathname.startsWith('/requests')) return '/hub/requests';
  if (pathname === '/refinement') return '/hub/refinement';
  if (pathname === '/validation' || pathname === '/actions' || pathname === '/references') return '/hub/insights';
  if (pathname.startsWith('/sop-governance/repository')) return '/hub/repository';
  if (pathname.startsWith('/sop-governance/requests')) return '/hub/requests';
  if (pathname.startsWith('/sop-governance/refinement')) return '/hub/refinement';
  if (pathname.startsWith('/sop-governance')) return '/';
  if (pathname.startsWith('/governance/users') || pathname.startsWith('/governance/business-units')) return '/hub/directory';
  if (pathname.startsWith('/governance/references') || pathname.startsWith('/governance/activity-log')) return '/hub/insights';
  if (pathname.startsWith('/audit/reviews')) return '/hub/calendar';
  if (pathname.startsWith('/audit/findings') || pathname.startsWith('/audit/actions')) return '/hub/insights';
  if (pathname === '/copilot' || pathname === '/settings') return '/';
  return null;
}

export function middleware(request){const token=request.cookies.get('session')?.value;const {pathname}=request.nextUrl;if(pathname.startsWith('/api/')){if(pathname==='/api/auth/login')return NextResponse.next();if(token)return NextResponse.next();if(pathname.startsWith('/api/governance/')){const requestId=crypto.randomUUID();return NextResponse.json({ok:false,error:{code:'UNAUTHENTICATED',message:'Authentication is required.',details:null},meta:{requestId}},{status:401})}return NextResponse.json({error:'Authentication required'},{status:401})}if(pathname==='/login')return NextResponse.next();if(!token)return NextResponse.redirect(new URL('/login',request.url));const destination=legacyDestination(pathname);if(destination)return NextResponse.redirect(new URL(destination,request.url));return NextResponse.next()}
export const config={matcher:['/((?!_next|favicon.ico|procurement-governance-hub.html).*)']};
