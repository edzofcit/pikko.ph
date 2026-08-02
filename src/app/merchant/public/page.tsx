import { and, eq, sql } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { MerchantMediaUpload } from "@/components/merchant-media-upload";
import { MerchantPageShell } from "@/components/merchant-page-shell";
import { getDb } from "@/db";
import { courts, merchants, sites } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { updateMerchantPublicProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function MerchantPublicSettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [access, query] = await Promise.all([requireMerchantPermission("manage_courts"), searchParams]);
  const db = getDb();
  const [[merchant], activeSites] = await Promise.all([
    db.select({ id: merchants.id, displayName: merchants.displayName, slug: merchants.slug, description: merchants.description, logoUrl: merchants.logoUrl, logoPathname: merchants.logoPathname, coverUrl: merchants.coverUrl, coverPathname: merchants.coverPathname }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1),
    db.select({ id: sites.id, slug: sites.slug, courtCount: sql<number>`count(${courts.id})::int` }).from(sites).leftJoin(courts, and(eq(courts.siteId, sites.id), eq(courts.status, "active"))).where(and(eq(sites.merchantId, access.membership.merchantId), eq(sites.status, "active"))).groupBy(sites.id),
  ]);
  if (!merchant) return null;
  const isOwner = access.membership.role === "owner";
  const hasDirectory = activeSites.length >= 2;
  const publicHref = hasDirectory ? `/${merchant.slug}` : activeSites.length === 1 ? `/${merchant.slug}/${activeSites[0].slug}` : `/${merchant.slug}`;
  const feedback = query.success ?? query.error;

  return (
    <MerchantPageShell
      merchantName={merchant.displayName} merchantSlug={merchant.slug} userName={access.user.fullName} userEmail={access.user.email} roleLabel={formatMerchantRole(access.membership.role)} permissions={access.permissions} sites={access.sites} selectedSiteId="" activeHref="/merchant/public"
      eyebrow="Merchant page" title="Shape your public brand." description="Configure the page customers see before they choose a location. Merchants with two or more active sites receive a searchable location directory."
      metrics={[
        { label: "Active sites", value: String(activeSites.length), note: hasDirectory ? "Multi-location page enabled" : `${Math.max(0, 2 - activeSites.length)} more needed for directory` },
        { label: "Active courts", value: String(activeSites.reduce((total, site) => total + site.courtCount, 0)), note: "Across public sites" },
        { label: "Logo", value: merchant.logoPathname ? "Ready" : "Missing", note: "Shown in the page hero" },
        { label: "Cover", value: merchant.coverPathname ? "Ready" : "Missing", note: "Wide landscape image works best" },
      ]}
    >
      {feedback ? <p role="status" className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{feedback}</p> : null}

      <section className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 sm:flex-row sm:items-center">
        <div><p className="text-sm font-black">{hasDirectory ? "Your multi-location page is enabled." : activeSites.length === 1 ? "Customers currently go straight to your only site." : "Activate at least one site to begin."}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">The merchant directory automatically becomes the entry page once two active sites are available.</p></div>
        <Link href={publicHref} className="shrink-0 rounded-full border border-[var(--line)] px-4 py-2.5 text-center text-xs font-black text-[var(--forest)]">Preview public page ↗</Link>
      </section>

      {!isOwner ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">You can preview the merchant page, but only an Owner can update the merchant brand.</p> : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-lg font-black">Page details</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Use a customer-facing name and a concise description of your venues.</p>
            <form action={updateMerchantPublicProfile} className="mt-6 space-y-5">
              <label className="block text-sm font-bold">Merchant name<input name="displayName" required minLength={2} maxLength={160} defaultValue={merchant.displayName} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
              <label className="block text-sm font-bold">Description<textarea name="description" rows={7} maxLength={1200} defaultValue={merchant.description ?? ""} placeholder="Tell players what makes your venues special." className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] px-4 py-3 font-normal leading-6" /><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Up to 1,200 characters.</span></label>
              <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-xs font-black text-white">Save page details</button>
            </form>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-6"><h2 className="text-lg font-black">Merchant logo</h2><p className="mt-2 text-sm text-[var(--text-muted)]">Use a square logo with breathing room around the mark.</p><div className="relative mt-5 h-32 w-32 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--cream)]">{merchant.logoPathname && merchant.logoUrl ? <Image src={merchant.logoUrl} alt={`${merchant.displayName} logo`} fill sizes="128px" className="object-contain p-2" /> : <div className="grid h-full place-items-center text-4xl font-black text-[var(--forest)]">{merchant.displayName.slice(0, 1).toUpperCase()}</div>}</div><MerchantMediaUpload merchantId={merchant.id} kind="logo" /></section>
            <section className="rounded-2xl border border-[var(--line)] bg-white p-6"><h2 className="text-lg font-black">Hero cover photo</h2><p className="mt-2 text-sm text-[var(--text-muted)]">A landscape photo at least 1600 × 900 pixels will look best.</p><div className="relative mt-5 aspect-[16/7] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--forest)]">{merchant.coverPathname && merchant.coverUrl ? <Image src={merchant.coverUrl} alt={`${merchant.displayName} cover`} fill sizes="(max-width: 1280px) 100vw, 55vw" className="object-cover" /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#173c2a,#345f42)]" />}</div><MerchantMediaUpload merchantId={merchant.id} kind="cover" /></section>
          </div>
        </div>
      )}
    </MerchantPageShell>
  );
}
