import { and, asc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MerchantPreviewShell } from "@/components/merchant-preview-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { SiteLocationPicker } from "@/components/site-location-picker";
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
import {
  createRateRule,
  deactivateRateRule,
  deleteVenuePhoto,
  setVenueCoverPhoto,
  updateAmenities,
  updateOperatingHours,
  updateSiteSettings,
  uploadVenuePhoto,
} from "./actions";

export const metadata: Metadata = { title: "Sites and courts preview" };
export const dynamic = "force-dynamic";

const tabs = ["overview", "courts", "rates", "operating hours", "amenities", "staff", "photos", "settings"];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Query = { site?: string; tab?: string; q?: string; success?: string; error?: string };

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
  if (!access?.user) redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/merchant/preview/sites")}`);
  if (!access.membership) redirect("/merchant/onboarding");
  if (!access.permissions.includes("manage_courts")) redirect("/access-denied");
  const db = getDb();
  const assignedIds = access.sites.map((site) => site.id);
  const siteRows = access.membership.role === "owner"
    ? await db.select({ id: sites.id, name: sites.name, slug: sites.slug, status: sites.status, addressLine1: sites.addressLine1, city: sites.city, province: sites.province, latitude: sites.latitude, longitude: sites.longitude, timezone: sites.timezone, contactEmail: sites.contactEmail, contactPhone: sites.contactPhone, amenities: sites.amenities }).from(sites).where(eq(sites.merchantId, access.membership.merchantId)).orderBy(asc(sites.name))
    : assignedIds.length
      ? await db.select({ id: sites.id, name: sites.name, slug: sites.slug, status: sites.status, addressLine1: sites.addressLine1, city: sites.city, province: sites.province, latitude: sites.latitude, longitude: sites.longitude, timezone: sites.timezone, contactEmail: sites.contactEmail, contactPhone: sites.contactPhone, amenities: sites.amenities }).from(sites).where(and(eq(sites.merchantId, access.membership.merchantId), inArray(sites.id, assignedIds))).orderBy(asc(sites.name))
      : [];
  const visibleIds = siteRows.map((site) => site.id);
  const [courtRows, allSitePhotos] = visibleIds.length ? await Promise.all([
    db.select({ id: courts.id, siteId: courts.siteId, name: courts.name, status: courts.status, indoor: courts.indoor, surfaceType: courts.surfaceType, rateCents: courts.baseHourlyRateCents }).from(courts).where(and(eq(courts.merchantId, access.membership.merchantId), inArray(courts.siteId, visibleIds))).orderBy(asc(courts.sortOrder), asc(courts.name)),
    db.select({ id: sitePhotos.id, siteId: sitePhotos.siteId, url: sitePhotos.url, altText: sitePhotos.altText, isCover: sitePhotos.isCover }).from(sitePhotos).where(and(eq(sitePhotos.merchantId, access.membership.merchantId), inArray(sitePhotos.siteId, visibleIds))).orderBy(asc(sitePhotos.sortOrder)),
  ]) : [[], []];
  const searchedSites = siteRows.filter((site) => !query.q || `${site.name} ${site.city} ${site.addressLine1}`.toLowerCase().includes(query.q.toLowerCase()));
  const selectedSiteId = siteRows.some((site) => site.id === query.site) ? query.site! : searchedSites[0]?.id ?? "";
  const selectedSite = siteRows.find((site) => site.id === selectedSiteId);
  const selectedCourts = courtRows.filter((court) => court.siteId === selectedSiteId);
  const activeTab = tabs.includes(query.tab ?? "") ? query.tab! : "courts";
  const selectedCourtIds = selectedCourts.map((court) => court.id);
  const [hours, rules, selectedSitePhotos, selectedCourtPhotos, staff, assignments] = selectedSite ? await Promise.all([
    db.select().from(siteOperatingHours).where(and(eq(siteOperatingHours.siteId, selectedSiteId), eq(siteOperatingHours.merchantId, access.membership.merchantId))).orderBy(asc(siteOperatingHours.dayOfWeek)),
    db.select({ id: priceRules.id, name: priceRules.name, courtId: priceRules.courtId, type: priceRules.type, dayOfWeek: priceRules.dayOfWeek, specialDate: priceRules.specialDate, startsAt: priceRules.startsAt, endsAt: priceRules.endsAt, hourlyRateCents: priceRules.hourlyRateCents, active: priceRules.active }).from(priceRules).where(and(eq(priceRules.siteId, selectedSiteId), eq(priceRules.merchantId, access.membership.merchantId))).orderBy(asc(priceRules.name)),
    db.select({ id: sitePhotos.id, url: sitePhotos.url, altText: sitePhotos.altText, isCover: sitePhotos.isCover }).from(sitePhotos).where(eq(sitePhotos.siteId, selectedSiteId)).orderBy(asc(sitePhotos.sortOrder)),
    selectedCourtIds.length ? db.select({ id: courtPhotos.id, courtId: courtPhotos.courtId, url: courtPhotos.url, altText: courtPhotos.altText, isCover: courtPhotos.isCover }).from(courtPhotos).where(inArray(courtPhotos.courtId, selectedCourtIds)).orderBy(asc(courtPhotos.sortOrder)) : [],
    db.select({ id: merchantMemberships.id, role: merchantMemberships.role, status: merchantMemberships.status, fullName: users.fullName, email: users.email }).from(merchantMemberships).innerJoin(users, eq(users.id, merchantMemberships.userId)).where(eq(merchantMemberships.merchantId, access.membership.merchantId)).orderBy(asc(users.fullName)),
    db.select({ membershipId: merchantSiteAssignments.membershipId, siteId: merchantSiteAssignments.siteId }).from(merchantSiteAssignments).where(and(eq(merchantSiteAssignments.merchantId, access.membership.merchantId), eq(merchantSiteAssignments.siteId, selectedSiteId))),
  ]) : [[], [], [], [], [], []];
  const assignedMemberships = new Set(assignments.map((assignment) => assignment.membershipId));
  const siteStaff = staff.filter((member) => member.role === "owner" || assignedMemberships.has(member.id));
  const hoursByDay = new Map(hours.map((period) => [period.dayOfWeek, period]));
  const coverBySite = new Map(allSitePhotos.filter((photo) => photo.isCover).map((photo) => [photo.siteId, photo]));
  const courtCover = new Map(selectedCourtPhotos.filter((photo) => photo.isCover).map((photo) => [photo.courtId, photo]));

  return (
    <MerchantPreviewShell merchantName={access.membership.merchantName} merchantSlug={access.membership.merchantSlug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={siteRows.map(({ id, name, slug }) => ({ id, name, slug }))} selectedSiteId={selectedSiteId} activeHref="/merchant/preview/sites" eyebrow="Merchant dashboard preview" title="Sites & courts" description="Manage locations and the courts inside each site without losing operational context." actions={<Link href="/merchant/venues" className="rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">+ Add site</Link>}>
      {query.success || query.error ? <p role={query.error ? "alert" : "status"} className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{query.error ?? query.success}</p> : null}
      <section className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[["Sites", String(siteRows.length), "Assigned locations"], ["Courts", String(courtRows.length), "Across all sites"], ["Active courts", String(courtRows.filter((court) => court.status === "active").length), "Currently bookable"], ["Standard rate", selectedCourts.length ? formatPeso(Math.min(...selectedCourts.map((court) => court.rateCents))) : "—", "Selected site starting rate"]].map(([label, value, note]) => <article key={label} className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-3 text-2xl font-black">{value}</p><p className="mt-2 text-xs text-[var(--forest)]">{note}</p></article>)}
      </section>

      {!siteRows.length ? <section className="mt-5 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center"><h2 className="font-black">No sites yet.</h2><Link href="/merchant/venues" className="mt-4 inline-flex rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Add your first site</Link></section> : (
        <section className="mt-5 grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--line)] bg-white p-4">
            <form><input name="q" defaultValue={query.q ?? ""} placeholder="Search sites…" className="w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm" /></form>
            <div className="mt-4 space-y-3">{searchedSites.map((site) => { const siteCourts = courtRows.filter((court) => court.siteId === site.id); const cover = coverBySite.get(site.id); return <Link key={site.id} href={`?site=${site.id}&tab=${encodeURIComponent(activeTab)}`} className={`block rounded-xl border p-3 transition ${site.id === selectedSiteId ? "border-emerald-400 bg-emerald-50" : "border-[var(--line)] hover:bg-[var(--cream)]"}`}><div className="flex items-start gap-3"><div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--cream)] text-xl font-black text-[var(--forest)]">{cover ? <Image src={cover.url} alt={cover.altText || site.name} fill sizes="64px" className="object-cover" /> : "P"}</div><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-black">{site.name}</h2><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.6rem] font-black capitalize text-emerald-800">{site.status}</span></div><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{site.city}{site.province ? `, ${site.province}` : ""}</p><p className="mt-2 text-xs font-bold text-[var(--forest)]">{siteCourts.length} court{siteCourts.length === 1 ? "" : "s"}</p></div></div></Link>; })}</div>
          </aside>

          {selectedSite ? <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <header className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-black">{selectedSite.name}</h2><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black capitalize text-emerald-800">{selectedSite.status}</span></div><p className="mt-2 text-sm text-[var(--text-muted)]">{selectedSite.addressLine1}, {selectedSite.city} · {selectedSite.timezone}</p></div><div className="flex gap-2"><Link href={`/${access.membership.merchantSlug}/${selectedSite.slug}`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black">Public page ↗</Link><Link href={`?site=${selectedSite.id}&tab=settings`} className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-black">Edit site</Link></div></div></header>
            <nav className="flex gap-1 overflow-x-auto border-y border-[var(--line)] bg-[var(--cream)] p-2" aria-label="Site settings">{tabs.map((tab) => <Link key={tab} href={`?site=${selectedSite.id}&tab=${encodeURIComponent(tab)}`} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black capitalize ${activeTab === tab ? "bg-white text-[var(--forest)] shadow-sm" : "text-[var(--text-muted)]"}`}>{tab}</Link>)}</nav>

            {activeTab === "overview" ? <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><section className="rounded-xl border border-[var(--line)] p-4"><h3 className="font-black">Site details</h3><p className="mt-3 text-sm">{selectedSite.addressLine1}, {selectedSite.city}</p><p className="mt-2 text-sm text-[var(--text-muted)]">{selectedSite.contactEmail || "No contact email"}{selectedSite.contactPhone ? ` · ${selectedSite.contactPhone}` : ""}</p></section><section className="rounded-xl border border-[var(--line)] p-4"><h3 className="font-black">Operating week</h3><p className="mt-3 text-sm">{hours.length} open day{hours.length === 1 ? "" : "s"} · {selectedCourts.length} court{selectedCourts.length === 1 ? "" : "s"}</p><p className="mt-2 text-sm text-[var(--text-muted)]">{selectedSite.amenities.length ? selectedSite.amenities.join(" · ") : "No amenities configured"}</p></section></div> : null}

            {activeTab === "courts" ? <div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Courts ({selectedCourts.length})</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Current inventory for this site</p></div><Link href="/merchant/venues" className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">+ Add court</Link></div><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{selectedCourts.map((court) => { const cover = courtCover.get(court.id); return <div key={court.id} className="grid gap-3 p-4 sm:grid-cols-[4rem_1.5fr_0.8fr_0.8fr_auto] sm:items-center"><div className="relative size-14 overflow-hidden rounded-lg bg-[var(--cream)]">{cover ? <Image src={cover.url} alt={cover.altText || court.name} fill sizes="56px" className="object-cover" /> : null}</div><div><h4 className="font-black">{court.name}</h4><p className="mt-1 text-xs text-[var(--text-muted)]">{court.indoor ? "Indoor" : "Outdoor"}{court.surfaceType ? ` · ${court.surfaceType}` : ""}</p></div><span className="text-sm">{formatPeso(court.rateCents)}/hr</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black capitalize ${court.status === "active" ? "bg-emerald-100 text-emerald-800" : court.status === "maintenance" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>{court.status}</span><div className="flex gap-2"><Link href={`/merchant/schedule?site=${selectedSite.id}`} className="text-xs font-black text-[var(--forest)]">Schedule</Link><Link href="/merchant/venues" className="text-xs font-black">Edit</Link></div></div>; })}{!selectedCourts.length ? <p className="p-8 text-center text-sm text-[var(--text-muted)]">No courts in this site yet.</p> : null}</div></div> : null}

            {activeTab === "rates" ? <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.3fr] sm:p-6"><form action={createRateRule} className="space-y-4 rounded-xl border border-[var(--line)] p-4"><input type="hidden" name="siteId" value={selectedSite.id} /><h3 className="font-black">Add rate rule</h3><label className="block text-xs font-black">Name<input name="name" required maxLength={160} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><label className="block text-xs font-black">Court<select name="courtId" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="">All courts</option>{selectedCourts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-black">Rule type<select name="type" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="recurring">Weekly</option><option value="special_date">Special date</option><option value="seasonal">Seasonal</option></select></label><label className="text-xs font-black">Day<select name="dayOfWeek" defaultValue="1" className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal">{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label></div><label className="block text-xs font-black">Special date<input name="specialDate" type="date" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-black">Starts<input name="startsAt" type="time" required defaultValue="17:00" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><label className="text-xs font-black">Ends<input name="endsAt" type="time" required defaultValue="22:00" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label></div><label className="block text-xs font-black">Hourly rate (PHP)<input name="hourlyRate" type="number" min="0" step="0.01" required className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><button className="w-full rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Create rule</button></form><section><h3 className="font-black">Effective rules</h3><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><strong className="block">{rule.name}</strong><small className="mt-1 block capitalize text-[var(--text-muted)]">{rule.type.replaceAll("_", " ")} · {rule.startsAt.slice(0, 5)}–{rule.endsAt.slice(0, 5)} · {formatPeso(rule.hourlyRateCents)}</small></div>{rule.active ? <form action={deactivateRateRule}><input type="hidden" name="siteId" value={selectedSite.id} /><input type="hidden" name="ruleId" value={rule.id} /><button className="rounded-full border border-red-200 px-3 py-2 text-xs font-black text-red-700">Deactivate</button></form> : <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">Inactive</span>}</div>)}{!rules.length ? <p className="p-8 text-center text-sm text-[var(--text-muted)]">Standard court rates apply.</p> : null}</div></section></div> : null}

            {activeTab === "operating hours" ? <form action={updateOperatingHours} className="p-5 sm:p-6"><input type="hidden" name="siteId" value={selectedSite.id} /><h3 className="font-black">Weekly operating hours</h3><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{days.map((day, index) => { const period = hoursByDay.get(index); return <div key={day} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_1fr_1fr] sm:items-center"><strong>{day}</strong><label className="flex items-center gap-2 text-xs font-bold"><input name={`enabled-${index}`} type="checkbox" defaultChecked={Boolean(period)} /> Open</label><input aria-label={`${day} opening time`} name={`opens-${index}`} type="time" defaultValue={period?.opensAt.slice(0, 5) ?? "06:00"} className="rounded-lg border border-[var(--line)] px-3 py-2" /><input aria-label={`${day} closing time`} name={`closes-${index}`} type="time" defaultValue={period?.closesAt.slice(0, 5) ?? "23:00"} className="rounded-lg border border-[var(--line)] px-3 py-2" /></div>; })}</div><button className="mt-5 rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Save operating hours</button></form> : null}

            {activeTab === "amenities" ? <form action={updateAmenities} className="p-5 sm:p-6"><input type="hidden" name="siteId" value={selectedSite.id} /><h3 className="font-black">Site amenities</h3><p className="mt-2 text-sm text-[var(--text-muted)]">Enter one amenity per line or separate them with commas.</p><textarea name="amenities" rows={8} defaultValue={selectedSite.amenities.join("\n")} className="mt-4 w-full rounded-xl border border-[var(--line)] px-4 py-3" placeholder="Parking&#10;Showers&#10;Equipment rental" /><button className="mt-4 rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white">Save amenities</button></form> : null}

            {activeTab === "staff" ? <div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Assigned staff</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Owners automatically have access to every site.</p></div><Link href="/merchant/team" className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Manage team</Link></div><div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">{siteStaff.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 p-4"><div><strong className="block">{member.fullName}</strong><small className="text-[var(--text-muted)]">{member.email}</small></div><div className="text-right"><span className="rounded-full bg-[var(--cream)] px-2.5 py-1 text-xs font-black">{formatMerchantRole(member.role)}</span><small className="mt-1 block capitalize text-[var(--text-muted)]">{member.status}</small></div></div>)}</div></div> : null}

            {activeTab === "photos" ? <div className="space-y-7 p-5 sm:p-6"><section><h3 className="font-black">Site photos</h3><form action={uploadVenuePhoto} className="mt-4 grid gap-3 rounded-xl border border-dashed border-[var(--line)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><input type="hidden" name="siteId" value={selectedSite.id} /><label className="text-xs font-black">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1.5 block w-full text-xs" /></label><label className="text-xs font-black">Alt text<input name="altText" maxLength={200} placeholder="Describe the photo" className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><button className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Upload</button></form><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedSitePhotos.map((photo) => <PhotoCard key={photo.id} photo={photo} siteId={selectedSite.id} />)}</div></section>{selectedCourts.map((court) => { const photos = selectedCourtPhotos.filter((photo) => photo.courtId === court.id); return <section key={court.id} className="border-t border-[var(--line)] pt-6"><h3 className="font-black">{court.name}</h3><form action={uploadVenuePhoto} className="mt-4 grid gap-3 rounded-xl border border-dashed border-[var(--line)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><input type="hidden" name="siteId" value={selectedSite.id} /><input type="hidden" name="courtId" value={court.id} /><label className="text-xs font-black">Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required className="mt-1.5 block w-full text-xs" /></label><label className="text-xs font-black">Alt text<input name="altText" maxLength={200} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label><button className="rounded-full bg-[var(--forest)] px-4 py-2.5 text-xs font-black text-white">Upload</button></form><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo) => <PhotoCard key={photo.id} photo={photo} siteId={selectedSite.id} courtId={court.id} />)}</div></section>; })}</div> : null}

            {activeTab === "settings" ? (
              <form action={updateSiteSettings} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <input type="hidden" name="siteId" value={selectedSite.id} />
                <h3 className="font-black sm:col-span-2">Site settings</h3>
                <label className="text-xs font-black sm:col-span-2">Site name<input name="name" required defaultValue={selectedSite.name} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                <label className="text-xs font-black sm:col-span-2">Street address<input name="addressLine1" required defaultValue={selectedSite.addressLine1} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                <label className="text-xs font-black">City<input name="city" required defaultValue={selectedSite.city} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                <label className="text-xs font-black">Status<select name="status" defaultValue={selectedSite.status} className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2.5 font-normal"><option value="draft">Draft</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="text-xs font-black">Contact email<input name="contactEmail" type="email" defaultValue={selectedSite.contactEmail ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                <label className="text-xs font-black">Contact phone<input name="contactPhone" defaultValue={selectedSite.contactPhone ?? ""} className="mt-1.5 w-full rounded-lg border border-[var(--line)] px-3 py-2.5 font-normal" /></label>
                <SiteLocationPicker
                  initialLatitude={selectedSite.latitude}
                  initialLongitude={selectedSite.longitude}
                  initialSearch={`${selectedSite.name}, ${selectedSite.addressLine1}, ${selectedSite.city}, Philippines`}
                  tileUrl={process.env.OSM_TILE_URL}
                />
                <button className="w-fit rounded-full bg-[var(--forest)] px-5 py-2.5 text-xs font-black text-white sm:col-span-2">Save site settings</button>
              </form>
            ) : null}
          </article> : null}
        </section>
      )}
    </MerchantPreviewShell>
  );
}
