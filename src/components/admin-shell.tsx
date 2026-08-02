import Link from "next/link";
import { AccountButton } from "@/components/account-button";
import { Brand } from "@/components/brand";

const groups: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ href: string; label: string; icon: string }>;
}> = [
  { label: "Workspace", items: [{ href: "/admin", label: "Overview", icon: "⌂" }] },
  {
    label: "Platform",
    items: [
      { href: "/admin/merchants", label: "Merchants", icon: "▦" },
      { href: "/admin/customers", label: "Customers", icon: "♙" },
    ],
  },
  { label: "Finance", items: [{ href: "/admin/invoices", label: "Invoices", icon: "₱" }] },
  {
    label: "Management",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "⚙" },
      { href: "/admin/email-test", label: "Email diagnostics", icon: "✉" },
    ],
  },
];

export type AdminMetric = { label: string; value: string; note?: string };

export function AdminShell({
  admin,
  activeHref,
  eyebrow = "Pikko.ph platform administration",
  title,
  description,
  metrics,
  actions,
  children,
}: {
  admin: { fullName: string; email: string };
  activeHref: string;
  eyebrow?: string;
  title: string;
  description: string;
  metrics?: AdminMetric[];
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigation = groups.flatMap((group) => group.items);
  return (
    <main className="min-h-screen bg-[#f7f5ed] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-[var(--line)] bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="px-5 py-4 lg:py-6"><Brand /><p className="mt-5 hidden rounded-xl bg-[var(--forest)] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white lg:block">Platform control</p></div>
        <nav aria-label="Platform administration" className="hidden h-[calc(100vh-8.5rem)] flex-col overflow-y-auto px-3 pb-4 lg:flex">
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.label}>
                <h2 className="px-3 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{group.label}</h2>
                <div className="mt-2 space-y-1">{group.items.map((item) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${item.href === activeHref ? "bg-[#e5f1e5] text-[var(--forest)]" : "hover:bg-[var(--cream)]"}`}><span className="w-4 text-center" aria-hidden="true">{item.icon}</span>{item.label}</Link>)}</div>
              </section>
            ))}
          </div>
          <div className="mt-auto space-y-3 pt-6">
            <Link href="/customer" className="block rounded-xl bg-[var(--cream)] px-4 py-3 text-center text-xs font-black text-[var(--forest)]">Switch to customer mode</Link>
            <div className="rounded-xl border border-[var(--line)] p-3"><p className="truncate text-sm font-black">{admin.fullName}</p><p className="mt-0.5 truncate text-[0.68rem] text-[var(--text-muted)]">Platform admin · {admin.email}</p></div>
          </div>
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[#f7f5ed]/95 px-5 py-3 backdrop-blur lg:hidden">
          <p className="text-sm font-black text-[var(--forest)]">Platform control</p>
          <details className="group relative"><summary className="cursor-pointer list-none rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-black">Menu</summary><div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-xl">{navigation.map((item) => <Link key={item.href} href={item.href} className={`block rounded-lg px-3 py-2.5 text-sm font-bold ${item.href === activeHref ? "bg-[#e5f1e5]" : "hover:bg-[var(--cream)]"}`}>{item.label}</Link>)}<div className="mt-2"><AccountButton /></div></div></details>
        </header>
        <div className="mx-auto max-w-[96rem] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--coral)]">{eyebrow}</p><h1 className="display-type mt-2 text-4xl font-black sm:text-5xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{description}</p></div><div className="flex flex-wrap items-center gap-2">{actions}<AccountButton /></div></header>
          {metrics?.length ? <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-xs font-bold text-[var(--text-muted)]">{metric.label}</p><p className="mt-2 text-2xl font-black text-[var(--forest)]">{metric.value}</p>{metric.note ? <p className="mt-1 text-xs text-[var(--text-muted)]">{metric.note}</p> : null}</div>)}</section> : null}
          {children}
        </div>
      </div>
    </main>
  );
}
