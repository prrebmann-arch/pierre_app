import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check for Supabase auth cookie (sb-*-auth-token)
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('-auth-token'))

  const publicPaths = ['/', '/login', '/privacy', '/setup-payment']
  const isPublic = publicPaths.some(p => request.nextUrl.pathname === p) || request.nextUrl.pathname.startsWith('/api/')

  if (!hasAuthCookie && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
