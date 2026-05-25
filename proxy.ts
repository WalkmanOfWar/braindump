import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from login/register
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect app routes — redirect to login with callbackUrl
  const protectedPaths = ["/dashboard", "/today", "/tasks", "/exams", "/calendar", "/stats", "/braindump", "/review", "/habits", "/goals", "/settings", "/share"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/today/:path*",
    "/tasks/:path*",
    "/exams/:path*",
    "/calendar/:path*",
    "/stats/:path*",
    "/braindump/:path*",
    "/review/:path*",
    "/habits/:path*",
    "/goals/:path*",
    "/settings/:path*",
    "/share",
    "/login",
    "/register",
  ],
};
