import Link from "next/link";
import { Brand } from "@/components/brand";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <Brand />
        </div>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral)]">
          Access restricted
        </p>
        <h1 className="display-type mt-3 text-4xl font-black">
          This workspace isn’t assigned to your account.
        </h1>
        <p className="mt-4 leading-7 text-[var(--text-muted)]">
          Ask a merchant owner or Pikko.ph administrator to grant the appropriate
          role and site access.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-bold"
          >
            Back to marketplace
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-bold text-white"
          >
            Use another account
          </Link>
        </div>
      </section>
    </main>
  );
}
