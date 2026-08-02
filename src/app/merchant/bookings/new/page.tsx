import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireMerchantPermission } from "@/lib/auth/access";
import { getSiteAvailability } from "@/lib/booking/availability";
import { MerchantBookingForm } from "./merchant-booking-form";

export const metadata: Metadata = { title: "Create booking" };
export const dynamic = "force-dynamic";

export default async function NewMerchantBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; date?: string; court?: string; starts?: string }>;
}) {
  const [access, query] = await Promise.all([
    requireMerchantPermission("manage_bookings"),
    searchParams,
  ]);
  const selectedSite =
    access.sites.find((site) => site.id === query.site) ?? access.sites[0];
  const availability = selectedSite
    ? await getSiteAvailability(
        access.membership.merchantSlug,
        selectedSite.slug,
        query.date,
      )
    : null;
  const openSlotCount =
    availability?.courts.reduce(
      (total, court) => total + court.slots.length,
      0,
    ) ?? 0;

  return (
    <DashboardShell
      eyebrow={`Staff booking · ${access.membership.merchantName}`}
      title="Create a booking"
      description="Reserve available court time for a walk-in, phone customer, or complimentary session."
      navigation={[
        { href: "/merchant", label: "Dashboard" },
        { href: "/merchant/schedule", label: "Schedule" },
        ...(access.permissions.includes("manage_courts")
          ? [{ href: "/merchant/sites", label: "Sites & courts" }]
          : []),
      ]}
      metrics={[
        {
          label: "Selected site",
          value: selectedSite?.name ?? "None",
          note: "Assigned venue",
        },
        {
          label: "Playing date",
          value: availability?.date ?? "—",
          note: "Venue-local schedule",
        },
        {
          label: "Open slots",
          value: String(openSlotCount),
          note: "Across active courts",
        },
        {
          label: "Reservation",
          value: "Immediate",
          note: "Court blocks when saved",
        },
      ]}
    >
      {access.sites.length ? (
        <>
          <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-xs font-black text-[var(--forest)]">
                Site
                <select
                  name="site"
                  defaultValue={selectedSite?.id}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal"
                >
                  {access.sites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-black text-[var(--forest)]">
                Playing date
                <input
                  name="date"
                  type="date"
                  required
                  min={availability?.earliestDate}
                  max={availability?.latestDate}
                  defaultValue={availability?.date}
                  className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal"
                />
              </label>
              <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
                Show availability
              </button>
            </form>
          </section>

          {availability ? (
            <MerchantBookingForm
              key={`${availability.site.id}-${availability.date}`}
              courts={availability.courts}
              siteSlug={availability.site.slug}
              date={availability.date}
              initialCourtId={query.court}
              initialStarts={query.starts?.split(",").filter(Boolean)}
            />
          ) : (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-sm font-bold text-red-800">
              This site is not currently available for staff bookings.
            </p>
          )}
        </>
      ) : (
        <section className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center">
          <p className="font-black">No active sites are assigned to your account.</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Add a venue or ask the merchant owner to assign you to a site.
          </p>
          {access.permissions.includes("manage_courts") ? (
            <Link href="/merchant/sites" className="mt-6 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
              Manage sites and courts
            </Link>
          ) : null}
        </section>
      )}
    </DashboardShell>
  );
}
