import { eq } from "drizzle-orm";
import Image from "next/image";
import { MerchantMediaUpload } from "@/components/merchant-media-upload";
import { MerchantPageShell } from "@/components/merchant-page-shell";
import { getDb } from "@/db";
import { merchants } from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { updateMerchantBusinessSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function MerchantSettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [access, query] = await Promise.all([requireMerchantPermission("manage_courts"), searchParams]);
  const [merchant] = await getDb().select({
    id: merchants.id,
    displayName: merchants.displayName,
    slug: merchants.slug,
    description: merchants.description,
    businessAddress: merchants.businessAddress,
    contactPhone: merchants.contactPhone,
    contactPhoneSecondary: merchants.contactPhoneSecondary,
    logoUrl: merchants.logoUrl,
    logoPathname: merchants.logoPathname,
    coverUrl: merchants.coverUrl,
    coverPathname: merchants.coverPathname,
  }).from(merchants).where(eq(merchants.id, access.membership.merchantId)).limit(1);
  if (!merchant) return null;
  const isOwner = access.membership.role === "owner";
  const feedback = query.success ?? query.error;

  return (
    <MerchantPageShell
      merchantName={merchant.displayName}
      merchantSlug={merchant.slug}
      userName={access.user.fullName}
      userEmail={access.user.email}
      roleLabel={formatMerchantRole(access.membership.role)}
      permissions={access.permissions}
      sites={access.sites}
      selectedSiteId=""
      activeHref="/merchant/settings"
      eyebrow="Business profile"
      title="Settings"
      description="Keep your business identity and contact information consistent across Pikko.ph."
    >
      {feedback ? <p role="status" className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>{feedback}</p> : null}

      {!isOwner ? <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">Only the merchant Owner can change business settings.</p> : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,0.9fr)]">
          <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
            <div><p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--coral)]">Business information</p><h2 className="mt-2 text-xl font-black">Profile details</h2><p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">These details identify the merchant business. Individual sites keep their own location and contact settings.</p></div>
            <form action={updateMerchantBusinessSettings} className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-bold sm:col-span-2">Business name<input name="displayName" required minLength={2} maxLength={160} defaultValue={merchant.displayName} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
              <label className="block text-sm font-bold sm:col-span-2">Business description<textarea name="description" rows={6} maxLength={1200} defaultValue={merchant.description ?? ""} placeholder="Tell customers what your pickleball business offers." className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] px-4 py-3 font-normal leading-6" /><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Up to 1,200 characters.</span></label>
              <label className="block text-sm font-bold sm:col-span-2">Business address<textarea name="businessAddress" rows={3} maxLength={500} defaultValue={merchant.businessAddress ?? ""} placeholder="Building, street, barangay, city, province, postal code" className="mt-2 w-full resize-y rounded-xl border border-[var(--line)] px-4 py-3 font-normal leading-6" /><span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Use the registered or main office address. Site addresses remain under Sites & courts.</span></label>
              <label className="block text-sm font-bold">Primary contact number<input name="contactPhone" type="tel" maxLength={40} defaultValue={merchant.contactPhone ?? ""} placeholder="09xx xxx xxxx" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
              <label className="block text-sm font-bold">Secondary contact number<input name="contactPhoneSecondary" type="tel" maxLength={40} defaultValue={merchant.contactPhoneSecondary ?? ""} placeholder="Optional" className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /></label>
              <div className="sm:col-span-2"><button className="rounded-full bg-[var(--forest)] px-6 py-3 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-[#0d5b3b]">Save business settings</button></div>
            </form>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
              <div className="flex items-start gap-4"><div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--cream)]">{merchant.logoPathname && merchant.logoUrl ? <Image src={merchant.logoUrl} alt={`${merchant.displayName} logo`} fill sizes="112px" className="object-contain p-2" /> : <div className="grid h-full place-items-center text-4xl font-black text-[var(--forest)]">{merchant.displayName.slice(0, 1).toUpperCase()}</div>}</div><div><p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--coral)]">Business logo</p><h2 className="mt-2 text-lg font-black">Square brand mark</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">JPG, PNG, or WebP up to 8 MB. A square image with clear padding works best.</p></div></div>
              <MerchantMediaUpload merchantId={merchant.id} kind="logo" returnTo="/merchant/settings" />
            </section>
            <section className="rounded-3xl border border-[var(--line)] bg-white p-5 sm:p-6">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--coral)]">Cover photo</p><h2 className="mt-2 text-lg font-black">Merchant hero image</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Use a wide landscape photo. The image is stored permanently and reused on the public merchant page.</p>
              <div className="relative mt-5 aspect-[16/7] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--forest)]">{merchant.coverPathname && merchant.coverUrl ? <Image src={merchant.coverUrl} alt={`${merchant.displayName} cover`} fill sizes="(max-width: 1280px) 100vw, 42vw" className="object-cover" /> : <div className="noise absolute inset-0 bg-[linear-gradient(135deg,#173c2a,#345f42)]" />}</div>
              <MerchantMediaUpload merchantId={merchant.id} kind="cover" returnTo="/merchant/settings" />
            </section>
          </div>
        </div>
      )}
    </MerchantPageShell>
  );
}
