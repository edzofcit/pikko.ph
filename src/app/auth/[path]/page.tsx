import { notFound, redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";
import { getAuth } from "@/lib/auth/server";

const supportedPaths = new Set(["sign-in", "sign-up"]);

function validCallbackUrl(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string }>;
  searchParams: Promise<{
    audience?: string;
    callbackURL?: string;
  }>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);

  if (!supportedPaths.has(path)) {
    notFound();
  }

  const requestedCallback = validCallbackUrl(query.callbackURL);
  const audience =
    query.audience === "customer" ||
    query.audience === "merchant" ||
    query.audience === "admin"
      ? query.audience
      : requestedCallback?.startsWith("/admin")
        ? "admin"
      : requestedCallback?.startsWith("/customer")
        ? "customer"
        : "merchant";
  const callbackUrl =
    requestedCallback ??
    (audience === "customer"
      ? "/customer"
      : audience === "admin"
        ? "/admin"
        : "/merchant");
  const { data: session } = await getAuth().getSession();

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <AuthForm
          mode={path as "sign-in" | "sign-up"}
          audience={audience}
          callbackUrl={callbackUrl}
        />
        <p className="mt-6 text-center text-xs leading-5 text-[var(--text-muted)]">
          Signing in means you agree to the venue policies and Pikko.ph platform
          terms.
        </p>
      </div>
    </main>
  );
}
