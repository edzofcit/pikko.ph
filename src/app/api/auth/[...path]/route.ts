import { getAuth } from "@/lib/auth/server";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

export function GET(request: Request, context: AuthRouteContext) {
  return getAuth().handler().GET(request, context);
}

export function POST(request: Request, context: AuthRouteContext) {
  return getAuth().handler().POST(request, context);
}

export function PUT(request: Request, context: AuthRouteContext) {
  return getAuth().handler().PUT(request, context);
}

export function DELETE(request: Request, context: AuthRouteContext) {
  return getAuth().handler().DELETE(request, context);
}

export function PATCH(request: Request, context: AuthRouteContext) {
  return getAuth().handler().PATCH(request, context);
}
