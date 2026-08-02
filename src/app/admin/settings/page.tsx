import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";
import { getDb } from "@/db";
import { platformSettings } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { updatePlatformSettings } from "../actions";

export const metadata: Metadata = { title: "Platform settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [admin, query] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const db = getDb();
  const [savedSettings] = await db.select().from(platformSettings).limit(1);
  const settings = savedSettings ?? { defaultMonthlyCourtPriceCents: 59900, defaultGatewayFeeBasisPoints: 0 };
  return <AdminShell admin={admin} activeHref="/admin/settings" title="Platform settings" description="Set the commercial defaults applied to newly onboarded merchants. Merchant-specific rates remain editable from Merchant management.">
    {query.success || query.error ? <p role={query.error ? "alert" : "status"} className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{query.error ?? query.success}</p> : null}
    <form action={updatePlatformSettings} className="mt-6 grid gap-5 rounded-2xl border border-[var(--line)] bg-white p-6 md:grid-cols-2">
      <label className="text-sm font-black">Default monthly rate per court (PHP)<input name="defaultMonthlyCourtPrice" type="number" min="0" max="1000000" step="0.01" required defaultValue={(settings.defaultMonthlyCourtPriceCents / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /><span className="mt-2 block text-xs font-normal text-[var(--text-muted)]">Used when a merchant is first created. Existing merchant overrides are preserved.</span></label>
      <label className="text-sm font-black">Default automated-payment transaction fee (%)<input name="defaultGatewayFeePercentage" type="number" min="0" max="100" step="0.01" required defaultValue={(settings.defaultGatewayFeeBasisPoints / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /><span className="mt-2 block text-xs font-normal text-[var(--text-muted)]">Platform fee applied to gateway payments for newly onboarded merchants.</span></label>
      <div className="md:col-span-2"><button className="rounded-full bg-[var(--forest)] px-6 py-3 text-sm font-black text-white">Save platform defaults</button></div>
    </form>
  </AdminShell>;
}
