import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SiteLocationPicker } from "@/components/site-location-picker";
import { VenuePhotoUpload } from "@/components/venue-photo-upload";
import { getDb } from "@/db";
import {
  courtPhotos,
  courts,
  merchantMemberships,
  merchantSiteAssignments,
  priceRules,
  siteOperatingHours,
  sitePhotos,
  sites,
  users,
} from "@/db/schema";
import { getMerchantAccess } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { formatPeso } from "@/lib/money";
import { MANUAL_PAYMENT_PROVIDERS, normalizeManualPaymentOptions } from "@/lib/manual-payment/options";
import {
  createCourt,
  createRateRule,
  createSite,
  deactivateRateRule,
  deleteVenuePhoto,
  setVenueCoverPhoto,
  updateAmenities,
  updateCourt,
  updateOperatingHours,
  updateSiteBookingSettings,
  updateSiteSettings,
} from "./actions";

export const metadata: Metadata = { title: "Sites and courts" };
export const dynamic = "force-dynamic";

const tabs = ["overview", "courts", "rates", "operating hours", "amenities", "staff", "photos", "settings"];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Query = { site?: string; tab?: string; q?: string; status?: string; mode?: string; success?: string; error?: string };

function PhotoCard({ photo, siteId, courtId }: { photo: { id: string; url: string; altText: string | null; isCover: boolean }; siteId: string; courtId?: string }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div className="relative aspect-[4/3] bg-[var(--cream)]">
        <Image src={photo.url} alt={photo.altText || "Venue photo"} fill sizes="(max-width: 768px) 100vw, 20vw" className="object-cover" />
        {photo.isCover ? <span className="absolute left-2 top-2 rounded-full bg-[var(--forest)] px-2.5 py-1 text-[0.62rem] font-black text-white">Cover</span> : null}
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {!photo.isCover ? <form action={setVenueCoverPhoto}><input type="hidden" name="siteId" value={siteId} /><input type="hidden" name="courtId" value={courtId ?? ""} /><input type="hidden" name="photoId" value={photo.id} /><button className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[0.68rem] font-black">Set cover</button></form> : null}
        <form action={deleteVenuePhoto}><input type="hidden" name="siteId" value={siteId} /><input type="hidden" name="courtId" value={courtId ?? ""} /><input type="hidden" name="photoId" value={photo.id} /><ConfirmSubmitButton message="Delete this photo permanently?" className="rounded-full border border-red-200 px-3 py-1.5 text-[0.68rem] font-black text-red-700">Delete</ConfirmSubmitButton></form>
      </div>
    </article>
  );
}

export default async function MerchantSitesPreview({ searchParams }: { searchParams: Promise<Query> }) {
  const [access, query] = await Promise.all([getMerchantAccess(), searchParams]);
  if (!access?.user) redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/merchant/sites")}`);
  if (!access.membership) redirect("/merchant/onboarding");
  if (!access.permissions.includes("manage_courts")) redirect("/access-denied");
  const db = getDb();
  const assignedIds = access.sites.map((site) => site.id);
  const siteRows = access.membership.role === "owner"
    ? await db.select({ id: sites.id, name: sites.name, slug: sites.slug, status: sites.status, description: sites.description, addressLine1: sites.addressLine1, addressLine2: sites.addressLine2, city: sites.city, province: sites.province, postalCode: sites.postalCode, latitude: sites.latitude, longitude: sites.longitude, timezone: sites.timezone, contactEmail: sites.contactEmail, contactPhone: sites.contactPhone, amenities: sites.amenities, bookingLeadMinutes: sites.bookingLeadMinutes, advanceBookingDays: sites.advanceBookingDays, onlinePaymentEnabled: sites.onlinePaymentEnabled, manualPaymentEnabled: sites.manualPaymentEnabled, manualReservationMode: sites.manualReservationMode, manualPaymentDeadlineMinutes: sites.manualPaymentDeadlineMinutes, manualPaymentInstructions: sites.manualPaymentInstructions, manualPaymentOptions: sites.manualPaymentOptions }).from(sites).where(eq(sites.merchantId, access.membership.merchantId)).orderBy(asc(sites.name))
    : assignedIds.length
      ? await db.select({ id: sites.id, name: sites.name, slug: sites.slug, status: sites.status, description: sites.description, addressLine1: sites.addressLine1, addressLine2: sites.addressLine2, city: sites.city, province: sites.province, postalCode: sites.postalCode, latitude: sites.latitude, longitude: sites.longitude, timezone: sites.timezone, contactEmail: sites.contactEmail, contactPhone: sites.contactPhone, amenities: sites.amenities, bookingLeadMinutes: sites.bookingLeadMinutes, advanceBookingDays: sites.advanceBookingDays, onlinePaymentEnabled: sites.onlinePaymentEnabled, manualPaymentEnabled: sites.manualPaymentEnabled, manualReservationMode: sites.manualReservationMode, manualPaymentDeadlineMinutes: sites.manualPaymentDeadlineMinutes, manualPaymentInstructions: sites.manualPaymentInstructions, manualPaymentOptions: sites.manualPaymentOptions }).from(sites).where(and(eq(sites.merchantId, access.membership.merchantId), inArray(sites.id, assignedIds))).orderBy(asc(sites.name))
      : [];
  const visibleIds = siteRows.map((site) => site.id);
  const [courtRows, allSitePhotos] = visibleIds.length ? await Promise.all([
    db.select({ id: courts.id, siteId: courts.siteId, name: courts.name, description: courts.description, status: courts.status, indoor: courts.indoor, surfaceType: courts.surfaceType, rateCents: courts.baseHourlyRateCents }).from(courts).where(and(eq(courts.merchantId, access.membership.merchantId), inArray(courts.siteId, visibleIds))).orderBy(asc(courts.sortOrder), asc(courts.name)),
    db.select({ id: sitePhotos.id, siteId: sitePhotos.siteId, url: sql<string>`'/api/venue-photos/site/' || ${sitePhotos.id}::text`, altText: sitePhotos.altText, isCover: sitePhotos.isCover }).from(sitePhotos).where(and(eq(sitePhotos.merchantId, access.membership.merchantId), inArray(sitePhotos.siteId, visibleIds))).orderBy(asc(sitePhotos.sortOrder)),
  ]) : [[], []];
  const searchedSites = siteRows.filter((site) => (!query.q || `${site.name} ${site.city} ${site.addressLine1}`.toLowerCase().includes(query.q.toLowerCase())) && (!query.status || site.status === query.status));
  const selectedSiteId = siteRows.some((site) => site.id === query.site) ? query.site! : searchedSites[0]?.id ?? "";
  const selectedSite = siteRows.find((site) => site.id === selectedSiteId);
  const selectedCourts = courtRows.filter((court) => court.siteId === selectedSiteId);
  const activeTab = tabs.includes(query.tab ?? "") ? query.tab! : "overview";
  const selectedCourtIds = selectedCourts.map((court) => court.id);
  const [hours, rules, selectedSitePhotos, selectedCourtPhotos, staff, assignments] = selectedSite ? await Promise.all([
    db.select().from(siteOperatingHours).where(and(eq(siteOperatingHours.siteId, selectedSiteId), eq(siteOperatingHours.merchantId, access.membership.merchantId))).orderBy(asc(siteOperatingHours.dayOfWeek)),
    db.select({ id: priceRules.id, name: priceRules.name, courtId: priceRules.courtId, type: priceRules.type, dayOfWeek: priceRules.dayOfWeek, specialDate: priceRules.specialDate, startsAt: priceRules.startsAt, endsAt: priceRules.endsAt, hourlyRateCents: priceRules.hourlyRateCents, active: priceRules.active }).from(priceRules).where(and(eq(priceRules.siteId, selectedSiteId), eq(priceRules.merchantId, access.membership.merchantId))).orderBy(asc(priceRules.name)),
    db.select({ id: sitePhotos.id, url: sql<string>`'/api/venue-photos/site/' || ${sitePhotos.id}::text`, altText: sitePhotos.altText, isCover: sitePhotos.isCover }).from(sitePhotos).where(eq(sitePhotos.siteId, selectedSiteId)).orderBy(asc(sitePhotos.sortOrder)),
    selectedCourtIds.length ? db.select({ id: courtPhotos.id, courtId: courtPhotos.courtId, url: sql<string>`'/api/venue-photos/court/' || ${courtPhotos.id}::text`, altText: courtPhotos.altText, isCover: courtPhotos.isCover }).from(courtPhotos).where(inArray(courtPhotos.courtId, selectedCourtIds)).orderBy(asc(courtPhotos.sortOrder)) : [],
    db.select({ id: merchantMemberships.id, role: merchantMemberships.role, status: merchantMemberships.status, fullName: users.fullName, email: users.email }).from(merchantMemberships).innerJoin(users, eq(users.id, merchantMemberships.userId)).where(eq(merchantMemberships.merchantId, access.membership.merchantId)).orderBy(asc(users.fullName)),
    db.select({ membershipId: merchantSiteAssignments.membershipId, siteId: merchantSiteAssignments.siteId }).from(merchantSiteAssignments).where(and(eq(merchantSiteAssignments.merchantId, access.membership.merchantId), eq(merchantSiteAssignments.siteId, selectedSiteId))),
  ]) : [[], [], [], [], [], []];
  const assignedMemberships = new Set(assignments.map((assignment) => assignment.membershipId));
  const siteStaff = staff.filter((member) => member.role === "owner" || assignedMemberships.has(member.id));
  const hoursByDay = new Map(hours.map((period) => [period.dayOfWeek, period]));
  const coverBySite = new Map(allSitePhotos.filter((photo) => photo.isCover).map((photo) => [photo.siteId, photo]));
  const courtCover = new Map(selectedCourtPhotos.filter((photo) => photo.isCover).map((photo) => [photo.courtId, photo]));

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={siteRows.map(({ id, name, slug }) => ({ id, name, slug }))} selectedSiteId={selectedSiteId} activeHref="/merchant/sites" eyebrow="Merchant dashboard" title="Sites & courts" description="Manage locations and the courts inside each site without losing operational context." actions={access.membership.role === "owner" ? <Link href="/merchant/sites?mode=new" className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">+ Add site</Link> : undefined}>
      {query.success || query.error ? <p role={query.error ? "alert" : "status"} className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{query.error ?? query.success}</p> : null}
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[["Sites", String(siteRows.length), "Assigned locations"], ["Courts", String(courtRows.length), "Across all sites"], ["Active courts", String(courtRows.filter((court) => court.status === "active").length), "Currently bookable"], ["Standard rate", selectedCourts.length ? formatPeso(Math.min(...selectedCourts.map((court) => court.rateCents))) : "—", "Selected site starting rate"]].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-2 text-xs text-[var(--forest)]">{note}</p></article>)}
      </section>

      {query.mode === "new" && access.membership.role === "owner" ? (
        <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Add a new site</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Create the location now, then continue with courts, pricing, payments, staff, and photos.</p></div><Link href="/merchant/sites" className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black">Close</Link></div>
          <form action={createSite} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black sm:col-span-2">Site name<input name="name" required maxLength={160} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black sm:col-span-2">Description<textarea name="description" rows={3} maxLength={5000} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black sm:col-span-2">Street address<input name="addressLine1" required maxLength={200} autoComplete="street-address" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black sm:col-span-2">Address line 2<input name="addressLine2" maxLength={200} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">City<input name="city" required maxLength={100} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Province<input name="province" maxLength={100} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Postal code<input name="postalCode" maxLength={20} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Timezone<input name="timezone" required defaultValue="Asia/Manila" maxLength={64} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Contact email<input name="contactEmail" type="email" defaultValue={access.user.email} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Contact phone<input name="contactPhone" maxLength={40} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Default opening<input name="opensAt" type="time" required defaultValue="06:00" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Default closing<input name="closesAt" type="time" required defaultValue="23:00" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black sm:col-span-2">Amenities<textarea name="amenities" rows={4} placeholder="Parking&#10;Showers&#10;Equipment rental" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
            <label className="text-xs font-black">Initial status<select name="status" defaultValue="draft" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <SiteLocationPicker tileUrl={process.env.OSM_TILE_URL} />
            <button className="w-fit rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white sm:col-span-2">Create site and continue setup</button>
          </form>
        </section>
      ) : null}

      {!siteRows.length ? <section className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center"><h2 className="font-black">No sites yet.</h2>{access.membership.role === "owner" ? <Link href="/merchant/sites?mode=new" className="mt-4 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Add your first site</Link> : null}</section> : (
        <section className="mt-5 grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <form className="grid grid-cols-[1fr_auto] gap-2"><input name="q" defaultValue={query.q ?? ""} placeholder="Search sites…" className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm" /><select name="status" defaultValue={query.status ?? ""} aria-label="Filter sites by status" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-bold"><option value="">All</option><option value="active">Active</option><option value="draft">Draft</option><option value="inactive">Inactive</option></select></form>
            <div className="mt-4 space-y-3">{searchedSites.map((site) => { const siteCourts = courtRows.filter((court) => court.siteId === site.id); const cover = coverBySite.get(site.id); return <Link key={site.id} href={`?site=${site.id}&tab=${encodeURIComponent(activeTab)}`} className={`block rounded-xl border p-3 transition ${site.id === selectedSiteId ? "border-emerald-400 bg-emerald-50" : "border-[var(--line)] hover:bg-[var(--cream)]"}`}><div className="flex items-start gap-3"><div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--cream)] text-xl font-black text-[var(--forest)]">{cover ? <Image src={cover.url} alt={cover.altText || site.name} fill sizes="64px" className="object-cover" /> : "P"}</div><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-black">{site.name}</h2><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] font-black capitalize text-emerald-800">{site.status}</span></div><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{site.city}{site.province ? `, ${site.province}` : ""}</p><p className="mt-2 text-xs font-bold text-[var(--forest)]">{siteCourts.length} court{siteCourts.length === 1 ? "" : "s"}</p></div></div></Link>; })}</div>
          </aside>

          {selectedSite ? <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <header className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-black">{selectedSite.name}</h2><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black capitalize text-emerald-800">{selectedSite.status}</span></div><p className="mt-2 text-sm text-[var(--text-muted)]">{selectedSite.addressLine1}, {selectedSite.city} · {selectedSite.timezone}</p></div><div className="flex gap-2"><Link href={`/${access.membership.merchantSlug}/${selectedSite.slug}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black">Public page ↗</Link><Link href={`?site=${selectedSite.id}&tab=settings`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black">Edit site</Link></div></div></header>
            <nav className="flex gap-1 overflow-x-auto border-y border-[var(--line)] bg-[var(--cream)] p-2" aria-label="Site settings">{tabs.map((tab) => <Link key={tab} href={`?site=${selectedSite.id}&tab=${encodeURIComponent(tab)}`} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black capitalize ${activeTab === tab ? "bg-white text-[var(--forest)] shadow-sm" : "text-[var(--text-muted)]"}`}>{tab}</Link>)}</nav>

            {activeTab === "overview" ? <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><section className="rounded-xl border border-[var(--line)] p-4"><h3 className="font-black">Site details</h3><p className="mt-3 text-sm">{selectedSite.addressLine1}, {selectedSite.city}</p><p className="mt-2 text-sm text-[var(--text-muted)]">{selectedSite.contactEmail || "No contact email"}{selectedSite.contactPhone ? ` · ${selectedSite.contactPhone}` : ""}</p></section><section className="rounded-xl border border-[var(--line)] p-4"><h3 className="font-black">Operating week</h3><p className="mt-3 text-sm">{hours.length} open day{hours.length === 1 ? "" : "s"} · {selectedCourts.length} court{selectedCourts.length === 1 ? "" : "s"}</p><p className="mt-2 text-sm text-[var(--text-muted)]">{selectedSite.amenities.length ? selectedSite.amenities.join(" · ") : "No amenities configured"}</p></section></div> : null}

            {activeTab === "courts" ? (
              <div className="p-5 sm:p-6">
                <div><h3 className="font-black">Courts ({selectedCourts.length})</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Create and update every court for this site.</p></div>
                <details className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-4">
                  <summary className="cursor-pointer text-sm font-black text-[var(--forest)]">+ Add court</summary>
                  <form action={createCourt} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="siteId" value={selectedSite.id} />
                    <label className="text-xs font-black">Court name<input name="name" required maxLength={120} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                    <label className="text-xs font-black">Hourly rate (PHP)<input name="hourlyRate" type="number" min="0" step="0.01" required className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                    <label className="text-xs font-black">Surface type<input name="surfaceType" maxLength={100} placeholder="Acrylic" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                    <label className="flex items-center gap-2 self-end rounded-lg border border-[var(--line)] px-3 py-2.5 text-xs font-bold"><input name="indoor" type="checkbox" /> Indoor court</label>
                    <label className="text-xs font-black sm:col-span-2">Description<textarea name="description" rows={3} maxLength={5000} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                    <button className="w-fit rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white sm:col-span-2">Create court</button>
                  </form>
                </details>
                <div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                  {selectedCourts.map((court) => { const cover = courtCover.get(court.id); return (
                    <details key={court.id} className="group p-4">
                      <summary className="grid cursor-pointer list-none gap-3 sm:grid-cols-[4rem_1.5fr_0.8fr_0.8fr_auto] sm:items-center">
                        <div className="relative size-14 overflow-hidden rounded-lg bg-[var(--cream)]">{cover ? <Image src={cover.url} alt={cover.altText || court.name} fill sizes="56px" className="object-cover" /> : null}</div>
                        <div><h4 className="font-black">{court.name}</h4><p className="mt-1 text-xs text-[var(--text-muted)]">{court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}</p></div>
                        <span className="text-sm">{formatPeso(court.rateCents)}/hr</span>
                        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black capitalize ${court.status === "active" ? "bg-emerald-100 text-emerald-800" : court.status === "maintenance" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>{court.status}</span>
                        <span className="text-xs font-black text-[var(--forest)]">Edit ↓</span>
                      </summary>
                      <form action={updateCourt} className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
                        <input type="hidden" name="siteId" value={selectedSite.id} /><input type="hidden" name="courtId" value={court.id} />
                        <label className="text-xs font-black">Court name<input name="name" required defaultValue={court.name} maxLength={120} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                        <label className="text-xs font-black">Hourly rate (PHP)<input name="hourlyRate" type="number" min="0" step="0.01" required defaultValue={(court.rateCents / 100).toFixed(2)} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                        <label className="text-xs font-black">Surface type<input name="surfaceType" defaultValue={court.surfaceType ?? ""} maxLength={100} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                        <label className="text-xs font-black">Status<select name="status" defaultValue={court.status} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="maintenance">Maintenance</option><option value="inactive">Inactive</option></select></label>
                        <label className="text-xs font-black sm:col-span-2">Description<textarea name="description" rows={3} defaultValue={court.description ?? ""} maxLength={5000} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                        <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-xs font-bold"><input name="indoor" type="checkbox" defaultChecked={court.indoor} /> Indoor court</label>
                        <div className="flex items-center gap-3"><button className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Save court</button><Link href={`/merchant/schedule?site=${selectedSite.id}`} className="text-xs font-black text-[var(--forest)]">Open schedule →</Link></div>
                      </form>
                    </details>
                  ); })}
                  {!selectedCourts.length ? <p className="p-8 text-center text-sm text-[var(--text-muted)]">No courts in this site yet.</p> : null}
                </div>
              </div>
            ) : null}

            {activeTab === "rates" ? <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.3fr] sm:p-6"><form action={createRateRule} className="space-y-4 rounded-xl border border-[var(--line)] p-4"><input type="hidden" name="siteId" value={selectedSite.id} /><h3 className="font-black">Add rate rule</h3><label className="block text-xs font-black">Name<input name="name" required maxLength={160} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><label className="block text-xs font-black">Court<select name="courtId" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All courts</option>{selectedCourts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-black">Rule type<select name="type" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="recurring">Weekly</option><option value="special_date">Special date</option><option value="seasonal">Seasonal</option></select></label><label className="text-xs font-black">Day<select name="dayOfWeek" defaultValue="1" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal">{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label></div><label className="block text-xs font-black">Special date<input name="specialDate" type="date" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-black">Starts<input name="startsAt" type="time" required defaultValue="17:00" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><label className="text-xs font-black">Ends<input name="endsAt" type="time" required defaultValue="22:00" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label></div><label className="block text-xs font-black">Hourly rate (PHP)<input name="hourlyRate" type="number" min="0" step="0.01" required className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><button className="w-full rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Create rule</button></form><section><h3 className="font-black">Effective rules</h3><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><strong className="block">{rule.name}</strong><small className="mt-1 block capitalize text-[var(--text-muted)]">{rule.type.replaceAll("_", " ")} · {rule.startsAt.slice(0, 5)}–{rule.endsAt.slice(0, 5)} · {formatPeso(rule.hourlyRateCents)}</small></div>{rule.active ? <form action={deactivateRateRule}><input type="hidden" name="siteId" value={selectedSite.id} /><input type="hidden" name="ruleId" value={rule.id} /><button className="rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-700">Deactivate</button></form> : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">Inactive</span>}</div>)}{!rules.length ? <p className="p-8 text-center text-sm text-[var(--text-muted)]">Standard court rates apply.</p> : null}</div></section></div> : null}

            {activeTab === "operating hours" ? <form action={updateOperatingHours} className="p-5 sm:p-6"><input type="hidden" name="siteId" value={selectedSite.id} /><h3 className="font-black">Weekly operating hours</h3><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{days.map((day, index) => { const period = hoursByDay.get(index); return <div key={day} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-center"><strong>{day}</strong><label className="flex items-center gap-2 text-xs font-bold"><input name={`enabled-${index}`} type="checkbox" defaultChecked={Boolean(period)} /> Open</label><input aria-label={`${day} opening time`} name={`opens-${index}`} type="time" defaultValue={period?.opensAt.slice(0, 5) ?? "06:00"} className="rounded-lg border border-[var(--line)] px-3 py-2" /><input aria-label={`${day} closing time`} name={`closes-${index}`} type="time" defaultValue={period?.closesAt.slice(0, 5) ?? "23:00"} className="rounded-lg border border-[var(--line)] px-3 py-2" /></div>; })}</div><button className="mt-5 rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Save operating hours</button></form> : null}

            {activeTab === "amenities" ? <form action={updateAmenities} className="p-5 sm:p-6"><input type="hidden" name="siteId" value={selectedSite.id} /><h3 className="font-black">Site amenities</h3><p className="mt-2 text-sm text-[var(--text-muted)]">Enter one amenity per line or separate them with commas.</p><textarea name="amenities" rows={8} defaultValue={selectedSite.amenities.join("\n")} className="mt-4 w-full rounded-xl border border-[var(--line)] px-4 py-3" placeholder="Parking&#10;Showers&#10;Equipment rental" /><button className="mt-4 rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Save amenities</button></form> : null}

            {activeTab === "staff" ? <div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Assigned staff</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Owners automatically have access to every site.</p></div><Link href="/merchant/team" className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Manage team</Link></div><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{siteStaff.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 p-4"><div><strong className="block">{member.fullName}</strong><small className="text-[var(--text-muted)]">{member.email}</small></div><div className="text-right"><span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black">{formatMerchantRole(member.role)}</span><small className="mt-1 block capitalize text-[var(--text-muted)]">{member.status}</small></div></div>)}</div></div> : null}

            {activeTab === "photos" ? <div className="space-y-7 p-5 sm:p-6"><section><h3 className="font-black">Site photos</h3><VenuePhotoUpload siteId={selectedSite.id} /><p className="mt-2 text-xs text-[var(--text-muted)]">JPG, PNG, or WebP · maximum 8 MB.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedSitePhotos.map((photo) => <PhotoCard key={photo.id} photo={photo} siteId={selectedSite.id} />)}</div></section>{selectedCourts.map((court) => { const photos = selectedCourtPhotos.filter((photo) => photo.courtId === court.id); return <section key={court.id} className="border-t border-[var(--line)] pt-6"><h3 className="font-black">{court.name}</h3><VenuePhotoUpload siteId={selectedSite.id} courtId={court.id} /><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo) => <PhotoCard key={photo.id} photo={photo} siteId={selectedSite.id} courtId={court.id} />)}</div></section>; })}</div> : null}

            {activeTab === "settings" ? (
              <div className="space-y-8 p-5 sm:p-6">
                <form action={updateSiteSettings} className="grid gap-4 sm:grid-cols-2">
                  <input type="hidden" name="siteId" value={selectedSite.id} />
                  <div className="sm:col-span-2"><h3 className="font-black">Identity, address & publication</h3><p className="mt-1 text-xs text-[var(--text-muted)]">These details power the public venue page and booking confirmations.</p></div>
                  <label className="text-xs font-black sm:col-span-2">Site name<input name="name" required defaultValue={selectedSite.name} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black sm:col-span-2">Description<textarea name="description" rows={4} maxLength={5000} defaultValue={selectedSite.description ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black sm:col-span-2">Street address<input name="addressLine1" required defaultValue={selectedSite.addressLine1} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black sm:col-span-2">Address line 2<input name="addressLine2" defaultValue={selectedSite.addressLine2 ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">City<input name="city" required defaultValue={selectedSite.city} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Province<input name="province" defaultValue={selectedSite.province ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Postal code<input name="postalCode" defaultValue={selectedSite.postalCode ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Timezone<input name="timezone" required defaultValue={selectedSite.timezone} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Contact email<input name="contactEmail" type="email" defaultValue={selectedSite.contactEmail ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Contact phone<input name="contactPhone" defaultValue={selectedSite.contactPhone ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Publication status<select name="status" defaultValue={selectedSite.status} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="draft">Draft</option><option value="active">Active and public</option><option value="inactive">Inactive</option></select></label>
                  <SiteLocationPicker initialLatitude={selectedSite.latitude} initialLongitude={selectedSite.longitude} initialSearch={`${selectedSite.name}, ${selectedSite.addressLine1}, ${selectedSite.city}, Philippines`} tileUrl={process.env.OSM_TILE_URL} />
                  <button className="w-fit rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white sm:col-span-2">Save site details</button>
                </form>

                <form action={updateSiteBookingSettings} className="grid gap-4 border-t border-[var(--line)] pt-7 sm:grid-cols-2">
                  <input type="hidden" name="siteId" value={selectedSite.id} />
                  <div className="sm:col-span-2"><h3 className="font-black">Booking & payment settings</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Control advance booking rules and which checkout methods customers can use.</p></div>
                  <label className="text-xs font-black">Minimum lead time (minutes)<input name="bookingLeadMinutes" type="number" min="0" max="10080" defaultValue={selectedSite.bookingLeadMinutes} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black">Advance booking window (days)<input name="advanceBookingDays" type="number" min="1" max="730" defaultValue={selectedSite.advanceBookingDays} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <div className="group relative" tabIndex={access.membership.onlinePaymentsAllowed ? undefined : 0}>
                    <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold ${access.membership.onlinePaymentsAllowed ? "border-[var(--line)]" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`} aria-disabled={!access.membership.onlinePaymentsAllowed}>
                      <input name="onlinePaymentEnabled" type="checkbox" disabled={!access.membership.onlinePaymentsAllowed} defaultChecked={access.membership.onlinePaymentsAllowed && selectedSite.onlinePaymentEnabled} /> Maya online payment
                    </label>
                    {!access.membership.onlinePaymentsAllowed ? <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%_+_0.5rem)] left-1/2 z-20 w-64 -translate-x-1/2 rounded-xl bg-[var(--ink)] px-3 py-2 text-center text-xs font-bold leading-5 text-white opacity-0 shadow-xl transition group-hover:opacity-100 group-focus:opacity-100">Contact Pikko.PH admin to enable online payment.</span> : null}
                  </div>
                  <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-xs font-bold"><input name="manualPaymentEnabled" type="checkbox" defaultChecked={selectedSite.manualPaymentEnabled} /> Manual payment</label>
                  <label className="text-xs font-black">Manual reservation policy<select name="manualReservationMode" defaultValue={selectedSite.manualReservationMode} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="reserve_immediately">Reserve immediately until deadline</option><option value="reserve_after_verification">Reserve after merchant verification</option></select></label>
                  <label className="text-xs font-black">Payment deadline (minutes)<input name="manualPaymentDeadlineMinutes" type="number" min="5" max="1440" defaultValue={selectedSite.manualPaymentDeadlineMinutes} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                  <label className="text-xs font-black sm:col-span-2">Manual payment instructions<textarea name="manualPaymentInstructions" rows={5} maxLength={5000} defaultValue={selectedSite.manualPaymentInstructions ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" placeholder="Tell customers where to pay and what reference to include." /></label>
                  <button className="w-fit rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white sm:col-span-2">Save booking settings</button>
                </form>

                <section className="border-t border-[var(--line)] pt-7">
                  <h3 className="font-black">Manual payment QR options</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Upload a QR image and toggle each channel independently. Only enabled channels appear during checkout.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">{MANUAL_PAYMENT_PROVIDERS.map((provider) => { const option = normalizeManualPaymentOptions(selectedSite.manualPaymentOptions).find((item) => item.provider === provider.id); return <article key={provider.id} className="rounded-xl border border-[var(--line)] p-4"><div className="flex items-center justify-between gap-2"><strong>{provider.label}</strong><span className={`rounded-full px-2 py-1 text-[0.62rem] font-black uppercase ${option?.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{option ? option.enabled ? "Visible" : "Disabled" : "Not set"}</span></div>{option ? <Image src={option.qrImageUrl} alt={`${provider.label} payment QR`} width={500} height={500} className="mt-3 aspect-square w-full rounded-lg border border-[var(--line)] bg-white object-contain" /> : null}{option ? <form action={`/api/merchant/sites/${selectedSite.id}/payment-qr`} method="post" className="mt-3"><input type="hidden" name="provider" value={provider.id} /><input type="hidden" name="operation" value="toggle" /><input type="hidden" name="enabled" value={option.enabled ? "false" : "true"} /><button className="w-full rounded-full border border-[var(--line)] px-3 py-2 text-xs font-black">{option.enabled ? "Hide at checkout" : "Show at checkout"}</button></form> : null}<form action={`/api/merchant/sites/${selectedSite.id}/payment-qr`} method="post" encType="multipart/form-data" className="mt-3 space-y-2"><input type="hidden" name="provider" value={provider.id} /><input type="hidden" name="operation" value="upload" /><input type="file" name="qrImage" accept="image/jpeg,image/png,image/webp" required className="block w-full text-xs" /><button className="w-full rounded-full bg-[var(--forest)] px-3 py-2 text-xs font-black text-white">{option ? "Replace QR image" : "Upload QR image"}</button></form>{option ? <form action={`/api/merchant/sites/${selectedSite.id}/payment-qr`} method="post" className="mt-2"><input type="hidden" name="provider" value={provider.id} /><input type="hidden" name="operation" value="remove" /><button className="w-full rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-700">Remove option</button></form> : null}</article>; })}</div>
                </section>
              </div>
            ) : null}
          </article> : null}
        </section>
      )}
    </MerchantPreviewShell>
  );
}
