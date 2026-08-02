import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin-shell";
import { getDb } from "@/db";
import { merchants, subscriptionInvoices } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { formatPeso } from "@/lib/money";
import { updateInvoiceStatus } from "../actions";

export const metadata: Metadata = { title: "Subscription invoices" };
export const dynamic = "force-dynamic";

const FILTER_STATUSES = new Set(["issued", "paid", "past_due", "void"]);

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: value instanceof Date ? "Asia/Manila" : "UTC",
    dateStyle: "medium",
  }).format(date);
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; success?: string; error?: string }>;
}) {
  const [admin, query] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const selectedStatus = FILTER_STATUSES.has(query.status ?? "") ? query.status! : "";
  const db = getDb();
  const invoices = await db
    .select({
      id: subscriptionInvoices.id,
      invoiceNumber: subscriptionInvoices.invoiceNumber,
      status: subscriptionInvoices.status,
      periodStart: subscriptionInvoices.periodStart,
      periodEnd: subscriptionInvoices.periodEnd,
      courtCount: subscriptionInvoices.courtCount,
      subtotalCents: subscriptionInvoices.subtotalCents,
      taxCents: subscriptionInvoices.taxCents,
      totalCents: subscriptionInvoices.totalCents,
      issuedAt: subscriptionInvoices.issuedAt,
      dueAt: subscriptionInvoices.dueAt,
      paidAt: subscriptionInvoices.paidAt,
      merchantName: merchants.displayName,
    })
    .from(subscriptionInvoices)
    .innerJoin(merchants, eq(merchants.id, subscriptionInvoices.merchantId))
    .where(
      selectedStatus
        ? eq(subscriptionInvoices.status, selectedStatus as "issued" | "paid" | "past_due" | "void")
        : inArray(subscriptionInvoices.status, ["draft", "issued", "paid", "past_due", "void"]),
    )
    .orderBy(desc(subscriptionInvoices.createdAt));

  const paidCents = invoices.filter((invoice) => invoice.status === "paid").reduce((total, invoice) => total + invoice.totalCents, 0);
  const outstandingCents = invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "past_due").reduce((total, invoice) => total + invoice.totalCents, 0);

  return (
    <AdminShell admin={admin} activeHref="/admin/invoices"
      eyebrow="Platform administration"
      title="Subscription invoices"
      description="Invoices are generated after the 14-day trial and at the start of each monthly paid-subscription period."
      metrics={[
        { label: "Invoices", value: String(invoices.length), note: selectedStatus || "All statuses" },
        { label: "Outstanding", value: formatPeso(outstandingCents), note: "Issued and past due" },
        { label: "Collected", value: formatPeso(paidCents), note: "Marked paid" },
        { label: "Billing cycle", value: "Monthly", note: "₱599 default / active court" },
      ]}
    >
      {query.success || query.error ? (
        <p role={query.error ? "alert" : "status"} className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-bold ${query.error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{query.error ?? query.success}</p>
      ) : null}

      <section className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-4">
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-52 text-xs font-black text-[var(--forest)]">Invoice status<select name="status" defaultValue={selectedStatus} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-normal"><option value="">All invoices</option><option value="issued">Issued</option><option value="paid">Paid</option><option value="past_due">Past due</option><option value="void">Void</option></select></label>
          <button className="rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-black text-white">Filter</button>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
        <div className="divide-y divide-[var(--line)]">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="p-5">
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_0.8fr_0.8fr_auto] lg:items-center">
                <div><p className="font-mono text-xs font-black text-[var(--forest)]">{invoice.invoiceNumber}</p><p className="mt-1 font-black">{invoice.merchantName}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDate(invoice.periodStart)}–{formatDate(invoice.periodEnd)}</p></div>
                <div><p className="text-xs text-[var(--text-muted)]">Courts billed</p><p className="mt-1 font-black">{invoice.courtCount}</p></div>
                <div><p className="text-xs text-[var(--text-muted)]">Due</p><p className="mt-1 text-sm font-black">{formatDate(invoice.dueAt)}</p></div>
                <div><p className="text-xs text-[var(--text-muted)]">Total</p><p className="mt-1 font-black">{formatPeso(invoice.totalCents)}</p></div>
                <form action={updateInvoiceStatus} className="flex items-end gap-2">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <label className="text-xs font-black">Status<select name="status" defaultValue={invoice.status === "draft" ? "issued" : invoice.status} className="mt-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-normal"><option value="issued">Issued</option><option value="paid">Paid</option><option value="past_due">Past due</option><option value="void">Void</option></select></label>
                  <button className="rounded-full bg-[var(--forest)] px-4 py-2 text-xs font-black text-white">Save</button>
                </form>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-muted)]"><span>Issued {formatDate(invoice.issuedAt)}</span><span>Subtotal {formatPeso(invoice.subtotalCents)}</span>{invoice.taxCents ? <span>Tax {formatPeso(invoice.taxCents)}</span> : null}{invoice.paidAt ? <span>Paid {formatDate(invoice.paidAt)}</span> : null}</div>
            </article>
          ))}
          {!invoices.length ? <p className="px-6 py-14 text-center text-sm text-[var(--text-muted)]">No invoices match this view. Trial merchants are invoiced when their trial ends or when set to paid.</p> : null}
        </div>
      </section>
    </AdminShell>
  );
}
