import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteAvailability } from "@/lib/booking/availability";
import { formatPeso } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CheckoutReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ merchantSlug: string; siteSlug: string }>;
  searchParams: Promise<{ date?: string; court?: string; starts?: string }>;
}) {
  const [{ merchantSlug, siteSlug }, query] = await Promise.all([params, searchParams]);
  const availability = await getSiteAvailability(merchantSlug, siteSlug, query.date);
  if (!availability) notFound();

  const requestedStarts = (query.starts ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 12)
    .sort();
  const court = availability.courts.find((item) => item.id === query.court);
  const selectedSlots = court?.slots
    .filter((slot) => requestedStarts.includes(slot.startsAt))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const allSlotsAvailable =
    Boolean(court) &&
    requestedStarts.length > 0 &&
    selectedSlots?.length === requestedStarts.length;
  const contiguous = selectedSlots?.every((slot, index) => {
    if (index === 0) return true;
    return new Date(slot.startsAt).getTime() - new Date(selectedSlots[index - 1].startsAt).getTime() === 3_600_000;
  });
  const valid = allSlotsAvailable && contiguous;
  const backHref = `/${availability.merchant.slug}/${availability.site.slug}?date=${availability.date}`;

  if (!valid || !court || !selectedSlots) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-5 py-16">
        <section className="w-full rounded-3xl border border-red-200 bg-white p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-700">Selection changed</p>
          <h1 className="mt-3 text-3xl font-black">One or more slots are no longer available.</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            Availability and pricing were checked again on the server. Choose from the current court schedule before checkout.
          </p>
          <Link href={backHref} className="mt-7 inline-flex rounded-full bg-[var(--forest)] px-6 py-3 text-sm font-black text-white">
            Return to availability
          </Link>
        </section>
      </main>
    );
  }

  const totalCents = selectedSlots.reduce((total, slot) => total + slot.rateCents, 0);

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href={backHref} className="font-black text-[var(--forest)]">← Change selection</Link>
          <span className="text-sm font-black text-[var(--forest)]">Pikko.ph</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">Server-verified quote</p>
          <h1 className="display-type mt-3 text-5xl font-black">Review your court time.</h1>
          <div className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-6">
            <p className="text-sm font-bold text-[var(--text-muted)]">{availability.merchant.name} · {availability.site.name}</p>
            <h2 className="mt-2 text-2xl font-black">{court.name}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{availability.date} · {selectedSlots.length} {selectedSlots.length === 1 ? "hour" : "consecutive hours"}</p>
            <div className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {selectedSlots.map((slot) => (
                <div key={slot.startsAt} className="flex items-center justify-between gap-4 py-4 text-sm">
                  <span className="font-bold">{slot.label}</span>
                  <span className="font-black text-[var(--forest)]">{formatPeso(slot.rateCents)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="font-black">Court subtotal</span>
              <span className="text-xl font-black">{formatPeso(totalCents)}</span>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-[var(--line)] bg-[var(--forest)] p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/60">Next milestone</p>
          <h2 className="mt-3 text-xl font-black">Guest details and payment</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            No court is held or booked on this review screen. The next implementation connects this verified quote to an atomic hold, guest contact details, and Maya or manual payment.
          </p>
          <Link href={backHref} className="mt-6 inline-flex w-full justify-center rounded-full bg-[var(--lime)] px-5 py-3 text-sm font-black text-[var(--ink)]">
            Keep choosing slots
          </Link>
        </aside>
      </section>
    </main>
  );
}
