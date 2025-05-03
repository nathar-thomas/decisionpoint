import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If accessing dashboard without session, redirect to login
  if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
    const redirectUrl = new URL("/login", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // If accessing login with session, redirect to dashboard
  if (session && req.nextUrl.pathname === "/login") {
    const redirectUrl = new URL("/dashboard", req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
}
