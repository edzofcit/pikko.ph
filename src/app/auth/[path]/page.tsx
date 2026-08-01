import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";

const supportedPaths = new Set(["sign-in", "sign-up"]);

function safeCallbackUrl(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/merchant";
}

export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string }>;
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);

  if (!supportedPaths.has(path)) {
    notFound();
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <AuthForm
          mode={path as "sign-in" | "sign-up"}
          callbackUrl={safeCallbackUrl(query.callbackURL)}
        />
        <p className="mt-6 text-center text-xs leading-5 text-[var(--text-muted)]">
          Signing in means you agree to the venue policies and Pikko.ph platform
          terms.
        </p>
      </div>
    </main>
  );
}
