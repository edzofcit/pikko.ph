import Link from "next/link";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import type { MerchantPermission } from "@/lib/auth/permissions";

type Metric = { label: string; value: string; note: string };
type Site = { id: string; name: string; slug: string };

export function MerchantPageShell({ merchantName, merchantSlug, userName, userEmail, roleLabel, permissions, sites, selectedSiteId, activeHref, eyebrow, title, description, metrics, primaryAction, children }: {
  merchantName: string;
  merchantSlug: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  permissions: readonly MerchantPermission[];
  sites: Site[];
  selectedSiteId: string;
  activeHref: string;
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Metric[];
  primaryAction?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <MerchantPreviewShell merchantName={merchantName} merchantSlug={merchantSlug} userName={userName} userEmail={userEmail} roleLabel={roleLabel} permissions={permissions} sites={sites} selectedSiteId={selectedSiteId} activeHref={activeHref} eyebrow={eyebrow} title={title} description={description} actions={primaryAction ? <Link href={primaryAction.href} className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">{primaryAction.label}</Link> : undefined}>
      {metrics?.length ? <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Summary metrics">{metrics.map((metric) => <article key={metric.label} className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5"><p className="text-xs font-semibold text-[var(--text-muted)]">{metric.label}</p><p className="mt-2 text-2xl font-black tracking-[-0.05em] sm:text-3xl">{metric.value}</p><p className="mt-2 text-xs text-[var(--forest)]">{metric.note}</p></article>)}</section> : null}
      {children}
    </MerchantPreviewShell>
  );
}
