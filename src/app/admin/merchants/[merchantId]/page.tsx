import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDb } from "@/db";
import { courts, merchants, sites } from "@/db/schema";
import { adminNavigation } from "@/lib/admin/navigation";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";

export const metadata: Metadata = { title: "Merchant sites and courts" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminMerchantDetailPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const [, { merchantId }] = await Promise.all([requirePlatformAdmin(), params]);
  if (!UUID_PATTERN.test(merchantId)) notFound();
  const db = getDb();
  const [merchantRows, siteRows, courtRows] = await Promise.all([
    db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1),
    db.select().from(sites).where(eq(sites.merchantId, merchantId)).orderBy(asc(sites.name)),
    db
      .select({
        id: courts.id,
        siteId: courts.siteId,
        name: courts.name,
        slug: courts.slug,
        status: courts.status,
        indoor: courts.indoor,
        surfaceType: courts.surfaceType,
        baseHourlyRateCents: courts.baseHourlyRateCents,
      })
      .from(courts)
      .where(eq(courts.merchantId, merchantId))
      .orderBy(asc(courts.sortOrder), asc(courts.name)),
  ]);
  const merchant = merchantRows[0];
  if (!merchant) notFound();

  const activeCourts = courtRows.filter((court) => court.status === "active").length;
  const estimatedMonthlyCents = activeCourts * merchant.monthlyCourtPriceCents;

  return (
    <DashboardShell
      eyebrow="Platform administration · Merchant detail"
      title={merchant.displayName}
      description="Inspect this tenant’s published sites, courts, operational status, and configured commercial terms."
      navigation={adminNavigation}
      primaryAction={{ href: "/admin/merchants", label: "← All merchants" }}
      metrics={[
        { label: "Sites", value: String(siteRows.length), note: "All venue records" },
        { label: "Active courts", value: String(activeCourts), note: `${courtRows.length} total courts` },
        { label: "Court rate", value: formatPeso(merchant.monthlyCourtPriceCents), note: "Per active court / month" },
        { label: "Estimated billing", value: formatPeso(estimatedMonthlyCents), note: "Current active courts" },
      ]}
    >
      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">Merchant account</p>
            <p className="mt-2 font-black">{merchant.legalName || merchant.displayName}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{merchant.contactEmail ?? "No contact email"}{merchant.contactPhone ? ` · ${merchant.contactPhone}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--cream)] px-3 py-2 text-xs font-black uppercase text-[var(--forest)]">{merchant.status}</span>
            <span className="rounded-full bg-[var(--mint)] px-3 py-2 text-xs font-black uppercase text-[var(--forest)]">{merchant.subscriptionStatus.replaceAll("_", " ")}</span>
            <Link href={`/${merchant.slug}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black text-[var(--forest)]">Public page ↗</Link>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-5">
        {siteRows.map((site) => {
          const siteCourts = courtRows.filter((court) => court.siteId === site.id);
          return (
            <article key={site.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] p-5">
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-xl font-black">{site.name}</h2><span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black uppercase">{site.status}</span></div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">{site.addressLine1}, {site.city}{site.province ? `, ${site.province}` : ""}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{site.timezone} · {site.onlinePaymentEnabled ? "Online payments" : "No online payments"} · {site.manualPaymentEnabled ? "Manual payments" : "No manual payments"}</p>
                </div>
                <Link href={`/${merchant.slug}/${site.slug}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black text-[var(--forest)]">View availability</Link>
              </header>
              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                {siteCourts.map((court) => (
                  <div key={court.id} className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4">
                    <div className="flex items-start justify-between gap-3"><p className="font-black">{court.name}</p><span className="rounded-full bg-white px-2 py-1 text-[0.65rem] font-black uppercase">{court.status}</span></div>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}</p>
                    <p className="mt-3 text-sm font-black text-[var(--forest)]">{formatPeso(court.baseHourlyRateCents)}/hour</p>
                  </div>
                ))}
                {!siteCourts.length ? <p className="text-sm text-[var(--text-muted)]">No courts have been added to this site.</p> : null}
              </div>
            </article>
          );
        })}
        {!siteRows.length ? <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-12 text-center"><p className="font-black">No sites have been created.</p></div> : null}
      </section>
    </DashboardShell>
  );
}
