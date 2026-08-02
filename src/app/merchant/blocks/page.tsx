import { and, asc, eq, gt, isNull, lt } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { MerchantPageShell } from "@/components/merchant-page-shell";
import { getDb } from "@/db";
import { courtBlocks, courts } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { getSiteAvailability } from "@/lib/booking/availability";
import { cancelCourtBlock } from "./actions";
import { CourtBlockForm } from "./court-block-form";
import { formatMerchantRole } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Court blocks" };
export const dynamic = "force-dynamic";

function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayBounds(value: string) {
  return {
    start: new Date(`${value}T00:00:00+08:00`),
    end: new Date(`${addDays(value, 1)}T00:00:00+08:00`),
  };
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function blockTypeLabel(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export default async function MerchantBlocksPage({
  searchParams,
}: {
  searchParams: Promise<{
    site?: string;
    date?: string;
    court?: string;
    starts?: string;
    success?: string;
  }>;
}) {
  const [access, query] = await Promise.all([
    requireMerchantPermission("manage_courts"),
    searchParams,
  ]);
  const selectedSite = access.sites.find((site) => site.id === query.site) ?? access.sites[0];
  const availability = selectedSite
    ? await getSiteAvailability(access.membership.merchantSlug, selectedSite.slug, query.date)
    : null;
  const bounds = availability ? dayBounds(availability.date) : null;
  const db = getDb();
  const activeBlocks = selectedSite && bounds
    ? await db
        .select({
          id: courtBlocks.id,
          type: courtBlocks.type,
          startsAt: courtBlocks.startsAt,
          endsAt: courtBlocks.endsAt,
          reason: courtBlocks.reason,
          courtName: courts.name,
        })
        .from(courtBlocks)
        .innerJoin(
          courts,
          and(
            eq(courts.id, courtBlocks.courtId),
            eq(courts.merchantId, courtBlocks.merchantId),
          ),
        )
        .where(
          and(
            eq(courtBlocks.merchantId, access.membership.merchantId),
            eq(courts.siteId, selectedSite.id),
            isNull(courtBlocks.cancelledAt),
            lt(courtBlocks.startsAt, bounds.end),
            gt(courtBlocks.endsAt, bounds.start),
          ),
        )
        .orderBy(asc(courtBlocks.startsAt))
    : [];

  return (
    <MerchantPageShell
      merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId={selectedSite?.id ?? ""} activeHref="/merchant/blocks"
      eyebrow="Court operations"
      title="Block court time"
      description="Remove court hours from public availability for maintenance, private events, or temporary closures."
      metrics={[
        { label: "Selected site", value: selectedSite?.name ?? "None", note: "Assigned venue" },
        { label: "Date", value: availability?.date ?? "—", note: "Venue-local day" },
        { label: "Active blocks", value: String(activeBlocks.length), note: "On the selected date" },
        { label: "Permission", value: "Court manager", note: "Blocks are audited" },
      ]}
    >
      {query.success ? (
        <p role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900">{query.success}</p>
      ) : null}

      {access.sites.length ? (
        <>
          <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
            <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-xs font-black text-[var(--forest)]">
                Site
                <select name="site" defaultValue={selectedSite?.id} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal">
                  {access.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-black text-[var(--forest)]">
                Date
                <input name="date" type="date" required min={availability?.earliestDate} max={availability?.latestDate} defaultValue={availability?.date} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-normal" />
              </label>
              <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Show open hours</button>
            </form>
          </section>

          {activeBlocks.length ? (
            <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">Active blocks</p>
                  <h2 className="mt-1 text-xl font-black">Unavailable court time</h2>
                </div>
                <Link href={`/merchant/schedule?site=${selectedSite?.id}&date=${availability?.date}`} className="text-xs font-black text-[var(--forest)] underline underline-offset-4">View schedule</Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {activeBlocks.map((block) => (
                  <article key={block.id} className="rounded-2xl border border-rose-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{block.courtName}</p>
                        <p className="mt-1 text-sm font-bold text-rose-800">{formatTime(block.startsAt)}–{formatTime(block.endsAt)}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{blockTypeLabel(block.type)} · Shown as blocked to customers</p>
                        {block.reason ? <p className="mt-2 text-xs leading-5">{block.reason}</p> : null}
                      </div>
                      <form action={cancelCourtBlock}>
                        <input type="hidden" name="blockId" value={block.id} />
                        <input type="hidden" name="siteId" value={selectedSite?.id} />
                        <input type="hidden" name="date" value={availability?.date} />
                        <button className="rounded-full border border-rose-300 px-3 py-2 text-xs font-black text-rose-800 hover:bg-rose-50">Remove</button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {availability ? (
            <CourtBlockForm
              key={`${availability.site.id}-${availability.date}`}
              courts={availability.courts}
              siteSlug={availability.site.slug}
              date={availability.date}
              initialCourtId={query.court}
              initialStarts={query.starts?.split(",").filter(Boolean)}
            />
          ) : (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-sm font-bold text-red-800">This site is not currently available for court operations.</p>
          )}
        </>
      ) : (
        <section className="mt-6 rounded-2xl border border-dashed border-[var(--line)] bg-white px-6 py-14 text-center">
          <p className="font-black">No active sites are assigned to your account.</p>
        </section>
      )}
    </MerchantPageShell>
  );
}
