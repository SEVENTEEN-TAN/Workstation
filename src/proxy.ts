import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  if (["/admin/login", "/admin/setup"].includes(request.nextUrl.pathname)) return NextResponse.next();
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/preview"] };
