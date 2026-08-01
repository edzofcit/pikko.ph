import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteAvailability } from "@/lib/booking/availability";
import { SlotPicker } from "./slot-picker";

export const metadata: Metadata = { title: "Court availability" };
export const dynamic = "force-dynamic";

export default async function PublicSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantSlug: string; siteSlug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const [{ merchantSlug, siteSlug }, query] = await Promise.all([params, searchParams]);
  const availability = await getSiteAvailability(merchantSlug, siteSlug, query.date);
  if (!availability) notFound();

  const address = `${availability.site.addressLine1}, ${availability.site.city}${
    availability.site.province ? `, ${availability.site.province}` : ""
  }`;

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href={`/${availability.merchant.slug}`} className="font-black text-[var(--forest)]">
            ← {availability.merchant.name}
          </Link>
          <Link href="/" className="text-sm font-black text-[var(--forest)]">Pikko.ph</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">Choose your court time</p>
            <h1 className="display-type mt-3 text-5xl font-black sm:text-7xl">{availability.site.name}</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
              {availability.site.description || address}
            </p>
            {availability.site.description ? (
              <p className="mt-2 text-sm font-semibold text-[var(--forest)]">{address}</p>
            ) : null}
          </div>

          <form method="get" className="rounded-3xl border border-[var(--line)] bg-white p-5">
            <label className="block text-sm font-black">
              Playing date
              <input
                name="date"
                type="date"
                required
                min={availability.earliestDate}
                max={availability.latestDate}
                defaultValue={availability.date}
                className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
              />
            </label>
            <button type="submit" className="mt-3 w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">
              Show availability
            </button>
          </form>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold text-[var(--text-muted)]">
          <span className="rounded-full bg-white px-3 py-2">1-hour minimum</span>
          <span className="rounded-full bg-white px-3 py-2">Choose adjacent times for consecutive hours</span>
          <span className="rounded-full bg-white px-3 py-2">Prices shown per slot</span>
        </div>

        <div className="mt-8">
          {availability.courts.length > 0 ? (
            <SlotPicker
              courts={availability.courts}
              date={availability.date}
              checkoutPath={`/${availability.merchant.slug}/${availability.site.slug}/checkout`}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-[var(--line)] bg-white/70 px-6 py-14 text-center">
              <p className="font-bold">No active courts are published for this site yet.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
