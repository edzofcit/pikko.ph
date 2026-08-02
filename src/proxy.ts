import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

export default function proxy(request: NextRequest) {
  // Server Actions authorize themselves. Sending their POST requests through
  // auth middleware can redirect the action before its request-scoped session
  // is evaluated, leaving the client with an unusable action response.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginUrl = request.nextUrl.pathname.startsWith("/admin")
    ? `/auth/sign-in?audience=admin&callbackURL=${encodeURIComponent(callbackUrl)}`
    : "/auth/sign-in";

  return getAuth().middleware({ loginUrl })(request);
}

export const config = {
  matcher: ["/customer/:path*", "/merchant/:path*", "/admin/:path*", "/account/:path*"],
};
