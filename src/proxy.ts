import { NextResponse, type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth/server";

export default function proxy(request: NextRequest) {
  // Server Actions authorize themselves. Sending their POST requests through
  // auth middleware can redirect the action before its request-scoped session
  // is evaluated, leaving the client with an unusable action response.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
  matcher: ["/merchant/:path*", "/admin/:path*"],
};
