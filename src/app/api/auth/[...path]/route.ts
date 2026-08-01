import { getAuth } from "@/lib/auth/server";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

async function reportRejectedAuthResponse(
  request: Request,
  response: Response,
) {
  if (response.ok) {
    return response;
  }

  let errorCode: string | undefined;
  let errorMessage: string | undefined;

  try {
    const body = (await response.clone().json()) as {
      code?: unknown;
      error?: unknown;
      message?: unknown;
    };

    errorCode = typeof body.code === "string" ? body.code : undefined;
    errorMessage =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : undefined;
  } catch {
    // Some upstream failures are not JSON. Status and request ID remain useful.
  }

  console.warn("[auth] Upstream request rejected", {
    method: request.method,
    path: new URL(request.url).pathname,
    status: response.status,
    code: errorCode,
    message: errorMessage?.slice(0, 300),
    requestId: response.headers.get("x-neon-ret-request-id") ?? undefined,
  });

  return response;
}

export async function GET(request: Request, context: AuthRouteContext) {
  const response = await getAuth().handler().GET(request, context);
  return reportRejectedAuthResponse(request, response);
}

export async function POST(request: Request, context: AuthRouteContext) {
  const response = await getAuth().handler().POST(request, context);
  return reportRejectedAuthResponse(request, response);
}

export async function PUT(request: Request, context: AuthRouteContext) {
  const response = await getAuth().handler().PUT(request, context);
  return reportRejectedAuthResponse(request, response);
}

export async function DELETE(request: Request, context: AuthRouteContext) {
  const response = await getAuth().handler().DELETE(request, context);
  return reportRejectedAuthResponse(request, response);
}

export async function PATCH(request: Request, context: AuthRouteContext) {
  const response = await getAuth().handler().PATCH(request, context);
  return reportRejectedAuthResponse(request, response);
}
