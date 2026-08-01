import { and, asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { getDb } from "@/db";
import { courts, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { createCourt, createSite } from "./actions";

export const metadata: Metadata = { title: "Sites and courts" };
export const dynamic = "force-dynamic";

const feedback = {
  "merchant-created":
    "Merchant account created. Add your first venue site, then its courts.",
  "site-created": "Site created with daily operating hours.",
  "court-created": "Court created and ready for scheduling.",
  "invalid-site": "Check the site details and operating hours.",
  "invalid-court": "Check the site, court name, and hourly rate.",
} as const;

export default async function MerchantVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [access, query] = await Promise.all([
    requireMerchantPermission("manage_courts"),
    searchParams,
  ]);
  const db = getDb();
  const allowedSiteIds = access.sites.map((site) => site.id);
  const [venueSites, venueCourts] = allowedSiteIds.length
    ? await Promise.all([
        db
          .select({
            id: sites.id,
            name: sites.name,
            slug: sites.slug,
            city: sites.city,
            province: sites.province,
          })
          .from(sites)
          .where(
            and(
              eq(sites.merchantId, access.membership.merchantId),
              eq(sites.status, "active"),
              inArray(sites.id, allowedSiteIds),
            ),
          )
          .orderBy(asc(sites.name)),
        db
          .select({
            id: courts.id,
            siteId: courts.siteId,
            name: courts.name,
            rateCents: courts.baseHourlyRateCents,
            indoor: courts.indoor,
            surfaceType: courts.surfaceType,
          })
          .from(courts)
          .where(
            and(
              eq(courts.merchantId, access.membership.merchantId),
              eq(courts.status, "active"),
              inArray(courts.siteId, allowedSiteIds),
            ),
          )
          .orderBy(asc(courts.name)),
      ])
    : [[], []];
  const isOwner = access.membership.role === "owner";

  const feedbackKey = (query.success ?? query.error) as keyof typeof feedback;
  const feedbackMessage = feedback[feedbackKey];
  const feedbackIsError = Boolean(query.error);

  return (
    <DashboardShell
      eyebrow={`Sites and courts · ${access.membership.merchantName}`}
      title="Set up where customers play."
      description="Create each physical venue as a site, then add its courts and standard hourly rates. Courts inherit the site's operating hours until you add an override."
      navigation={[
        { href: "/merchant", label: "Dashboard" },
        ...(access.permissions.includes("manage_staff")
          ? [{ href: "/merchant/team", label: "Team" }]
          : []),
      ]}
      metrics={[
        { label: "Active sites", value: String(venueSites.length), note: "Physical venue locations" },
        { label: "Active courts", value: String(venueCourts.length), note: "Bookable inventory" },
        { label: "Currency", value: "PHP", note: "Rates shown per hour" },
        { label: "Your role", value: formatMerchantRole(access.membership.role), note: access.user.email },
      ]}
    >
      {feedbackMessage ? (
        <p
          className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            feedbackIsError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
          role={feedbackIsError ? "alert" : "status"}
        >
          {feedbackMessage}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-lg font-bold">Add a site</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The opening and closing times initially apply every day. Per-day
            schedules and exceptions come next.
          </p>
          {isOwner ? (
            <form action={createSite} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-bold sm:col-span-2">
              Site name
              <input name="name" required minLength={2} maxLength={160} placeholder="BGC Club" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
            </label>
            <label className="block text-sm font-bold sm:col-span-2">
              Street address
              <input name="addressLine1" required minLength={4} maxLength={200} autoComplete="street-address" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
            </label>
            <label className="block text-sm font-bold">
              City
              <input name="city" required minLength={2} maxLength={100} autoComplete="address-level2" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
            </label>
            <label className="block text-sm font-bold">
              Province <span className="font-normal">(optional)</span>
              <input name="province" maxLength={100} autoComplete="address-level1" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
            </label>
            <label className="block text-sm font-bold">
              Opens
              <input name="opensAt" type="time" required defaultValue="06:00" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
            </label>
            <label className="block text-sm font-bold">
              Closes
              <input name="closesAt" type="time" required defaultValue="23:00" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
            </label>
            <button type="submit" className="w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-bold text-white sm:col-span-2">
              Add site
            </button>
            </form>
          ) : (
            <p className="mt-6 rounded-xl bg-[var(--cream)] px-4 py-5 text-sm font-semibold text-[var(--forest)]">
              Only an owner can add a new site. You can manage courts for your assigned sites.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-lg font-bold">Add a court</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The standard hourly rate is the fallback before peak-hour or
            special-date pricing rules are added.
          </p>
          {venueSites.length > 0 ? (
            <form action={createCourt} className="mt-6 space-y-5">
              <label className="block text-sm font-bold">
                Site
                <select name="siteId" required defaultValue={venueSites[0]?.id} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-normal">
                  {venueSites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Court name
                <input name="name" required minLength={2} maxLength={120} placeholder="Court 1" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
              </label>
              <label className="block text-sm font-bold">
                Standard hourly rate (PHP)
                <input name="hourlyRate" type="number" required min="0" max="1000000" step="0.01" inputMode="decimal" placeholder="750.00" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
              </label>
              <label className="block text-sm font-bold">
                Surface type <span className="font-normal">(optional)</span>
                <input name="surfaceType" maxLength={100} placeholder="Acrylic" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold">
                <input name="indoor" type="checkbox" />
                Indoor court
              </label>
              <button type="submit" className="w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-bold text-white">
                Add court
              </button>
            </form>
          ) : (
            <p className="mt-6 rounded-xl bg-[var(--cream)] px-4 py-5 text-sm font-semibold text-[var(--forest)]">
              Add your first site before creating a court.
            </p>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <h2 className="font-bold">Current sites and courts</h2>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {venueSites.map((site) => {
            const siteCourts = venueCourts.filter((court) => court.siteId === site.id);
            return (
              <article key={site.id} className="px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{site.name}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {site.city}{site.province ? `, ${site.province}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]">
                    {siteCourts.length} {siteCourts.length === 1 ? "court" : "courts"}
                  </span>
                </div>
                <Link
                  href={`/${access.membership.merchantSlug}/${site.slug}`}
                  className="mt-3 inline-flex text-xs font-black text-[var(--forest)] underline underline-offset-4"
                >
                  View public availability
                </Link>
                {siteCourts.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {siteCourts.map((court) => (
                      <div key={court.id} className="rounded-xl border border-[var(--line)] p-4 text-sm">
                        <p className="font-bold">{court.name}</p>
                        <p className="mt-1 text-[var(--text-muted)]">
                          {court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}
                        </p>
                        <p className="mt-3 font-bold text-[var(--forest)]">
                          ₱{(court.rateCents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}/hour
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--text-muted)]">No courts added yet.</p>
                )}
              </article>
            );
          })}
          {venueSites.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
              No sites yet. Create your first venue above.
            </p>
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}
