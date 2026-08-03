import Link from "next/link";
import { AccountButton } from "@/components/account-button";
import { Brand } from "@/components/brand";

type Metric = { label: string; value: string; note: string };

export function DashboardShell({
  eyebrow,
  title,
  description,
  metrics,
  navigation = [],
  primaryAction,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  navigation?: { href: string; label: string }[];
  primaryAction?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f5ef]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
          <Brand />
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold hover:bg-[var(--cream)] sm:px-4 sm:text-sm">
              Marketplace
            </Link>
            <AccountButton />
          </div>
        </div>
        {navigation.length ? (
          <nav
            aria-label="Workspace navigation"
            className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-3 sm:px-8 lg:px-10"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full bg-[var(--cream)] px-4 py-2 text-xs font-black text-[var(--forest)] transition hover:bg-[var(--mint)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral)]">{eyebrow}</p>
            <h1 className="display-type mt-3 text-4xl font-black sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--text-muted)]">{description}</p>
          </div>
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="inline-flex w-fit items-center rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgb(23_60_42_/_18%)]"
            >
              {primaryAction.label}
            </Link>
          ) : null}
        </div>

        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary metrics">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
              <p className="text-xs font-semibold text-[var(--text-muted)]">{metric.label}</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.05em] sm:text-3xl">{metric.value}</p>
              <p className="mt-2 text-xs text-[var(--forest)]">{metric.note}</p>
            </article>
          ))}
        </section>

        {children}
      </div>
    </main>
  );
}
