import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getAuth } from "@/lib/auth/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Account security" };
export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const { data: session } = await getAuth().getSession();
  if (!session?.user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/account/security")}`);
  }

  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8"><Brand /><Link href="/merchant" className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black text-[var(--forest)]">Back to dashboard</Link></div>
      </header>
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--coral)]">Account security</p>
        <h1 className="display-type mt-3 text-4xl font-black">Change your password</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-muted)]">Replace temporary credentials after your first sign-in. Changing your password also signs out other active sessions.</p>
        <PasswordForm />
      </section>
    </main>
  );
}
