import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";
import { getDb } from "@/db";
import { platformSettings } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { configureMayaWebhooks, updatePlatformSettings, verifyMayaGateway } from "../actions";

export const metadata: Metadata = { title: "Platform settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [admin, query] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const db = getDb();
  const [savedSettings] = await db.select().from(platformSettings).limit(1);
  const settings = savedSettings ?? { defaultMonthlyCourtPriceCents: 59900, defaultGatewayFeeBasisPoints: 0, mayaEnabled: false, mayaEnvironment: "sandbox", mayaPublicKeyLastFour: null, mayaSecretKeyLastFour: null };
  return <AdminShell admin={admin} activeHref="/admin/settings" title="Platform settings" description="Set the commercial defaults applied to newly onboarded merchants. Merchant-specific rates remain editable from Merchant management.">
    {query.success || query.error ? <p role={query.error ? "alert" : "status"} className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{query.error ?? query.success}</p> : null}
    <form action={updatePlatformSettings} className="mt-6 grid gap-5 rounded-2xl border border-[var(--line)] bg-white p-6 md:grid-cols-2">
      <label className="text-sm font-black">Default monthly rate per court (PHP)<input name="defaultMonthlyCourtPrice" type="number" min="0" max="1000000" step="0.01" required defaultValue={(settings.defaultMonthlyCourtPriceCents / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /><span className="mt-2 block text-xs font-normal text-[var(--text-muted)]">Used when a merchant is first created. Existing merchant overrides are preserved.</span></label>
      <label className="text-sm font-black">Default automated-payment transaction fee (%)<input name="defaultGatewayFeePercentage" type="number" min="0" max="100" step="0.01" required defaultValue={(settings.defaultGatewayFeeBasisPoints / 100).toFixed(2)} className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal" /><span className="mt-2 block text-xs font-normal text-[var(--text-muted)]">Platform fee applied to gateway payments for newly onboarded merchants.</span></label>
      <fieldset className="grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 md:col-span-2 md:grid-cols-2">
        <legend className="px-2 text-sm font-black">Maya QR payment gateway</legend>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white p-4 text-sm font-black md:col-span-2"><input name="mayaEnabled" type="checkbox" defaultChecked={settings.mayaEnabled} className="mt-1" /><span>Enable Maya online payments<span className="mt-1 block text-xs font-normal text-[var(--text-muted)]">Sites must also enable automated gateway payments before customers can select Maya.</span></span></label>
        <label className="text-sm font-black">Environment<select name="mayaEnvironment" defaultValue={settings.mayaEnvironment} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-normal"><option value="sandbox">Sandbox</option><option value="production">Production</option></select></label>
        <div className="rounded-xl bg-white p-4 text-sm"><p className="font-black">Credential status</p><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">Public key: {settings.mayaPublicKeyLastFour ? `configured ····${settings.mayaPublicKeyLastFour}` : "not configured"}<br />Secret key: {settings.mayaSecretKeyLastFour ? `configured ····${settings.mayaSecretKeyLastFour}` : "not configured"}</p></div>
        <label className="text-sm font-black">Public API key<input name="mayaPublicKey" type="password" autoComplete="new-password" placeholder={settings.mayaPublicKeyLastFour ? "Leave blank to keep current key" : "pk-…"} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-mono text-sm font-normal" /><span className="mt-2 block text-xs font-normal text-[var(--text-muted)]">Used server-side to create QR payments and retrieve status.</span></label>
        <label className="text-sm font-black">Secret API key<input name="mayaSecretKey" type="password" autoComplete="new-password" placeholder={settings.mayaSecretKeyLastFour ? "Leave blank to keep current key" : "sk-…"} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-mono text-sm font-normal" /><span className="mt-2 block text-xs font-normal text-[var(--text-muted)]">Encrypted before storage and never returned to the browser.</span></label>
        <div className="rounded-xl border border-[var(--line)] bg-white p-4 text-sm md:col-span-2"><p className="font-black">Webhook endpoint</p><code className="mt-2 block break-all rounded-lg bg-[var(--cream)] p-3 text-xs">{`${process.env.APP_URL?.replace(/\/$/, "") || "https://pikko.ph"}/api/payments/maya/webhook`}</code></div>
      </fieldset>
      <div className="flex flex-wrap gap-3 md:col-span-2"><button className="rounded-full bg-[var(--forest)] px-6 py-3 text-sm font-black text-white">Save platform settings</button></div>
    </form>
    <div className="mt-4 flex flex-wrap gap-3"><form action={verifyMayaGateway}><button className="rounded-full border border-[var(--forest)] bg-white px-5 py-3 text-sm font-black text-[var(--forest)]">Test saved Maya credentials</button></form><form action={configureMayaWebhooks}><button className="rounded-full border border-[var(--forest)] bg-white px-5 py-3 text-sm font-black text-[var(--forest)]">Register Maya webhooks</button></form></div>
  </AdminShell>;
}
