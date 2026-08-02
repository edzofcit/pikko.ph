import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import {
  merchantMemberships,
  merchantSiteAssignments,
  sites,
  users,
} from "@/db/schema";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireMerchantPermission } from "@/lib/auth/access";
import { formatMerchantRole } from "@/lib/auth/permissions";
import { inviteMerchantStaff } from "./actions";

export const dynamic = "force-dynamic";

const feedback = {
  invited: "Staff access saved. They can now sign up using the invited email.",
  invalid: "Check the name, email, role, and at least one site assignment.",
  exists: "That email already belongs to this merchant workspace.",
} as const;

export default async function MerchantTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [access, query] = await Promise.all([
    requireMerchantPermission("manage_staff"),
    searchParams,
  ]);
  const db = getDb();
  const [staff, assignments] = await Promise.all([
    db
      .select({
        membershipId: merchantMemberships.id,
        name: users.fullName,
        email: users.email,
        role: merchantMemberships.role,
        status: merchantMemberships.status,
      })
      .from(merchantMemberships)
      .innerJoin(users, eq(merchantMemberships.userId, users.id))
      .where(eq(merchantMemberships.merchantId, access.membership.merchantId))
      .orderBy(asc(users.fullName)),
    db
      .select({
        membershipId: merchantSiteAssignments.membershipId,
        siteName: sites.name,
      })
      .from(merchantSiteAssignments)
      .innerJoin(sites, eq(merchantSiteAssignments.siteId, sites.id))
      .where(
        and(
          eq(
            merchantSiteAssignments.merchantId,
            access.membership.merchantId,
          ),
          eq(sites.status, "active"),
        ),
      )
      .orderBy(asc(sites.name)),
  ]);

  const siteNamesByMembership = new Map<string, string[]>();
  for (const assignment of assignments) {
    const names = siteNamesByMembership.get(assignment.membershipId) ?? [];
    names.push(assignment.siteName);
    siteNamesByMembership.set(assignment.membershipId, names);
  }

  const feedbackKey = (query.success ?? query.error) as keyof typeof feedback;
  const feedbackMessage = feedback[feedbackKey];
  const feedbackIsError = Boolean(query.error);

  return (
    <DashboardShell
      eyebrow={`Team access · ${access.membership.merchantName}`}
      title="Invite staff with the right access."
      description="Roles control permitted actions. Site assignments limit non-owner staff to the venues they operate."
      navigation={[
        { href: "/merchant", label: "Dashboard" },
        ...(access.permissions.includes("manage_bookings")
          ? [{ href: "/merchant/schedule", label: "Schedule" }]
          : []),
        ...(access.permissions.includes("manage_courts")
          ? [{ href: "/merchant/sites", label: "Sites & courts" }]
          : []),
      ]}
      metrics={[
        { label: "Team members", value: String(staff.length), note: "Active and invited" },
        { label: "Owners", value: String(staff.filter((member) => member.role === "owner").length), note: "Full merchant access" },
        { label: "Assigned sites", value: String(access.sites.length), note: "Available to your account" },
        { label: "Your role", value: formatMerchantRole(access.membership.role), note: access.user.email },
      ]}
    >
      {feedbackMessage ? (
        <p
          className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
            feedbackIsError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
          role="status"
        >
          {feedbackMessage}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-[var(--line)] bg-white p-6">
          <h2 className="text-lg font-bold">Invite staff</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The invited person signs up with this exact email address. Email
            delivery will be connected in the notification milestone.
          </p>
          <form action={inviteMerchantStaff} className="mt-6 space-y-5">
            <label className="block text-sm font-bold">
              Full name
              <input
                name="fullName"
                required
                minLength={2}
                autoComplete="name"
                className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold">
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-[var(--line)] px-4 py-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold">
              Role
              <select
                name="role"
                required
                defaultValue="booking_staff"
                className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-normal"
              >
                <option value="owner">Owner — all sites and billing</option>
                <option value="site_manager">Site manager — venue operations</option>
                <option value="booking_staff">Booking staff — reservations</option>
                <option value="cashier">Cashier — payments and reservations</option>
                <option value="viewer">Viewer — read only</option>
              </select>
            </label>
            <fieldset>
              <legend className="text-sm font-bold">Assigned sites</legend>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Required for non-owner roles. Owners automatically access all sites.
              </p>
              <div className="mt-3 space-y-2">
                {access.sites.map((site) => (
                  <label
                    key={site.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                  >
                    <input name="siteIds" type="checkbox" value={site.id} />
                    <span className="font-semibold">{site.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--forest)] px-5 py-3 text-sm font-bold text-white"
            >
              Save staff invitation
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className="border-b border-[var(--line)] px-5 py-4">
            <h2 className="font-bold">Current team</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Access is checked again on every protected server action.
            </p>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {staff.map((member) => {
              const assignedSites = siteNamesByMembership.get(member.membershipId);
              return (
                <article key={member.membershipId} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{member.name}</h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{member.email}</p>
                    </div>
                    <span className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-xs font-bold text-[var(--forest)]">
                      {member.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm">
                    <strong>{formatMerchantRole(member.role)}</strong>
                    <span className="text-[var(--text-muted)]">
                      {member.role === "owner"
                        ? " · All sites"
                        : ` · ${assignedSites?.join(", ") || "No active sites"}`}
                    </span>
                  </p>
                </article>
              );
            })}
            {staff.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                No team members yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        Need to leave team access? <Link href="/merchant">Return to dashboard</Link>.
      </p>
    </DashboardShell>
  );
}
