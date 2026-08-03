import Link from "next/link";
import { Brand } from "@/components/brand";

export function LegalDocument({
  eyebrow,
  title,
  summary,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--cream)]">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Brand />
          <Link href="/" className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-black text-[var(--forest)] transition hover:-translate-y-0.5 hover:border-[var(--forest)] motion-reduce:transform-none">
            Back to Pikko.ph
          </Link>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[var(--forest)] text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--lime)]">{eyebrow}</p>
          <h1 className="display-type mt-4 max-w-4xl text-5xl font-black tracking-[-0.05em] sm:text-7xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-white/72 sm:text-lg">{summary}</p>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.12em] text-white/45">Last updated {updated}</p>
        </div>
      </section>

      <article className="legal-copy mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </article>

      <footer className="border-t border-[var(--line)] bg-[var(--cream)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-[var(--text-muted)] sm:px-8">
          <Brand compact />
          <nav aria-label="Legal navigation" className="flex flex-wrap items-center gap-5">
            <Link href="/terms" className="font-black hover:text-[var(--forest)]">Terms & Conditions</Link>
            <Link href="/privacy" className="font-black hover:text-[var(--forest)]">Privacy Policy</Link>
            <span>© 2026 Pikko.ph</span>
          </nav>
        </div>
      </footer>
    </main>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-[var(--line)] py-8 first:pt-0 last:border-0">
      <h2 className="text-2xl font-black tracking-[-0.03em] text-[var(--forest)]">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.96rem] leading-7 text-[var(--text-muted)]">{children}</div>
    </section>
  );
}
