import Link from "next/link";
import { Brand } from "@/components/brand";

type Metric = { label: string; value: string; note: string };

export function DashboardShell({
  eyebrow,
  title,
  description,
  metrics,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f5ef]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <Brand />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--muted)] sm:inline">Prototype dashboard</span>
            <Link href="/" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold hover:bg-[var(--cream)]">
              View marketplace
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--coral)]">{eyebrow}</p>
            <h1 className="display-type mt-3 text-4xl font-black sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">{description}</p>
          </div>
          <button type="button" className="w-fit rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-bold text-white">
            + New action
          </button>
        </div>

        <section className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary metrics">
          {metrics.map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-[var(--line)] bg-white p-5">
              <p className="text-xs font-semibold text-[var(--muted)]">{metric.label}</p>
              <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{metric.value}</p>
              <p className="mt-2 text-xs text-[var(--forest)]">{metric.note}</p>
            </article>
          ))}
        </section>

        {children}
      </div>
    </main>
  );
}
