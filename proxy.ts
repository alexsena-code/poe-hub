import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });

  if (!token) {
    const baseUrl = process.env.NEXTAUTH_URL || request.url;
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/farm/bots/:path*",
    "/farm/sales/:path*",
    "/farm/prices/:path*",
    "/farm/simulations/:path*",
    "/admin/tasks/:path*",
    "/admin/config/:path*",
  ],
};
