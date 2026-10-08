import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // List of routes that require authentication
  const protectedRoutes = [
    '/home',
    '/payments',
    '/student',
    '/result',
    '/setting'
  ]

  // Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute) {
    // For protected routes, we would typically check auth status
    // This is a simplified version - in a real app, you'd verify the session
    console.log('Protected route accessed:', request.nextUrl.pathname)
  }

  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}