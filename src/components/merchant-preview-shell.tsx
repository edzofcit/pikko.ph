import Link from "next/link";
import { AccountButton } from "@/components/account-button";
import { Brand } from "@/components/brand";
import { MerchantSiteScopeSelect } from "@/components/merchant-site-scope-select";
import type { MerchantPermission } from "@/lib/auth/permissions";

type PreviewSite = { id: string; name: string; slug: string };

const groups = [
  {
    label: "Workspace",
    items: [{ href: "/merchant", label: "Overview", icon: "⌂" }],
  },
  {
    label: "Operations",
    items: [
      { href: "/merchant/bookings", label: "Bookings", icon: "▣", permission: "manage_bookings" },
      { href: "/merchant/schedule", label: "Calendar", icon: "□", permission: "manage_bookings" },
      { href: "/merchant/bookings/new", label: "Walk-ins", icon: "+", permission: "manage_bookings" },
      { href: "/merchant/blocks", label: "Blocks & maintenance", icon: "⊘", permission: "manage_courts" },
      { href: "/merchant/sites", label: "Sites & courts", icon: "▦", permission: "manage_courts" },
      { href: "/merchant/customers", label: "Customers", icon: "♙", permission: "manage_bookings", disabled: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/merchant/payments", label: "Payments", icon: "₱", permission: "verify_payments", disabled: true },
      { href: "/merchant/reports", label: "Reports", icon: "↗", disabled: true },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/merchant/team", label: "Team", icon: "♧", permission: "manage_staff" },
      { href: "/merchant/public", label: "Public page", icon: "◎", disabled: true },
      { href: "/merchant/settings", label: "Settings", icon: "⚙", disabled: true },
    ],
  },
] as const;

function scopedHref(href: string, selectedSiteId: string) {
  if (!selectedSiteId || !href.startsWith("/merchant")) return href;
  return `${href}?site=${selectedSiteId}`;
}

export function MerchantPreviewShell({
  merchantName,
  merchantSlug,
  userName,
  userEmail,
  roleLabel,
  permissions,
  sites,
  selectedSiteId,
  activeHref,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  merchantName: string;
  merchantSlug: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  permissions: readonly MerchantPermission[];
  sites: PreviewSite[];
  selectedSiteId: string;
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const selectedSite = sites.find((site) => site.id === selectedSiteId);
  const scopeLabel = selectedSite?.name ?? "All sites";

  return (
    <main className="min-h-screen bg-[#f7f5ed] lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-[var(--line)] bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:px-5 lg:py-6">
          <Brand />
          <div className="w-48 lg:mt-6 lg:w-full">
            <MerchantSiteScopeSelect sites={sites} selectedSiteId={selectedSiteId} />
            <p className="mt-2 hidden text-xs text-[var(--text-muted)] lg:block">
              {sites.length} {sites.length === 1 ? "site" : "sites"} assigned
            </p>
          </div>
        </div>

        <nav aria-label="Merchant workspace" className="hidden h-[calc(100vh-9.5rem)] flex-col overflow-y-auto px-3 pb-4 lg:flex">
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.label} aria-labelledby={`nav-${group.label}`}>
                <h2 id={`nav-${group.label}`} className="px-3 text-[0.65rem] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {group.label}
                </h2>
                <div className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const permitted = !("permission" in item) || permissions.includes(item.permission);
                    if (!permitted) return null;
                    const isDisabled = "disabled" in item && item.disabled;
                    const isActive = item.href === activeHref;
                    return isDisabled ? (
                      <span key={item.href} aria-disabled="true" className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400">
                        <span className="w-4 text-center" aria-hidden="true">{item.icon}</span>
                        {item.label}
                        <span className="ml-auto text-[0.58rem] font-black uppercase tracking-wider">Later</span>
                      </span>
                    ) : (
                      <Link key={item.href} href={scopedHref(item.href, selectedSiteId)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive ? "bg-[#e5f1e5] text-[var(--forest)]" : "text-[var(--ink)] hover:bg-[var(--cream)]"}`}>
                        <span className="w-4 text-center" aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-auto space-y-3 pt-6">
            <Link href="/customer" className="flex items-center justify-center rounded-xl bg-[var(--cream)] px-4 py-3 text-xs font-black text-[var(--forest)]">
              Switch to customer mode
            </Link>
            <div className="rounded-xl border border-[var(--line)] p-3">
              <p className="truncate text-sm font-black">{userName}</p>
              <p className="mt-0.5 truncate text-[0.68rem] text-[var(--text-muted)]">{roleLabel} · {userEmail}</p>
            </div>
          </div>
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[#f7f5ed]/95 px-5 py-3 backdrop-blur sm:px-8 lg:hidden">
          <p className="min-w-0 truncate text-sm font-black text-[var(--forest)]">{merchantName} · {scopeLabel}</p>
          <details className="group relative ml-3 shrink-0">
            <summary className="cursor-pointer list-none rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-black">Menu</summary>
            <div className="absolute right-0 top-12 z-50 max-h-[75vh] w-72 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-3 shadow-xl">
              {groups.map((group) => <section key={group.label} className="mb-4"><h2 className="px-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{group.label}</h2><div className="mt-1">{group.items.map((item) => { const permitted = !("permission" in item) || permissions.includes(item.permission); if (!permitted) return null; const disabled = "disabled" in item && item.disabled; return disabled ? <span key={item.href} className="flex px-2 py-2 text-sm text-slate-400">{item.label}<small className="ml-auto">Later</small></span> : <Link key={item.href} href={scopedHref(item.href, selectedSiteId)} className={`block rounded-lg px-2 py-2 text-sm font-bold ${item.href === activeHref ? "bg-[#e5f1e5] text-[var(--forest)]" : "hover:bg-[var(--cream)]"}`}>{item.label}</Link>; })}</div></section>)}
              <Link href="/customer" className="block rounded-xl bg-[var(--cream)] px-3 py-2.5 text-center text-xs font-black text-[var(--forest)]">Switch to customer mode</Link>
              <div className="mt-2"><AccountButton /></div>
            </div>
          </details>
        </header>
        <div className="mx-auto max-w-[96rem] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
          <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--coral)]">{eyebrow}</p>
              <h1 className="display-type mt-2 text-4xl font-black sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={selectedSite ? `/${merchantSlug}/${selectedSite.slug}` : `/${merchantSlug}`} className="rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-xs font-black text-[var(--forest)]">
                View public page ↗
              </Link>
              {actions}
              <AccountButton />
            </div>
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}
