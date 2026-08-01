"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  merchantMemberships,
  merchantSiteAssignments,
  sites,
  users,
} from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import type { MerchantRole } from "@/lib/auth/permissions";

const assignableRoles = new Set<MerchantRole>([
  "owner",
  "site_manager",
  "booking_staff",
  "cashier",
  "viewer",
]);

function teamUrl(message: "invalid" | "exists" | "invited") {
  const parameter = message === "invited" ? "success" : "error";
  return `/merchant/team?${parameter}=${message}`;
}

export async function inviteMerchantStaff(formData: FormData) {
  const access = await requireMerchantPermission("manage_staff");
  const merchantId = access.membership.merchantId;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "") as MerchantRole;
  const requestedSiteIds = formData
    .getAll("siteIds")
    .map(String)
    .filter(Boolean);

  if (
    !email.includes("@") ||
    fullName.length < 2 ||
    !assignableRoles.has(role) ||
    (role !== "owner" && requestedSiteIds.length === 0)
  ) {
    redirect(teamUrl("invalid"));
  }

  const db = getDb();
  const validSites = requestedSiteIds.length
    ? await db
        .select({ id: sites.id })
        .from(sites)
        .where(
          and(
            eq(sites.merchantId, merchantId),
            eq(sites.status, "active"),
            inArray(sites.id, requestedSiteIds),
          ),
        )
    : [];

  if (
    role !== "owner" &&
    validSites.length !== new Set(requestedSiteIds).size
  ) {
    redirect(teamUrl("invalid"));
  }

  let [invitedUser] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (invitedUser?.status === "suspended") {
    redirect(teamUrl("invalid"));
  }

  if (!invitedUser) {
    [invitedUser] = await db
      .insert(users)
      .values({ email, fullName, status: "invited" })
      .returning();
  }

  const [existingMembership] = await db
    .select({ id: merchantMemberships.id })
    .from(merchantMemberships)
    .where(
      and(
        eq(merchantMemberships.merchantId, merchantId),
        eq(merchantMemberships.userId, invitedUser.id),
      ),
    )
    .limit(1);

  if (existingMembership) {
    redirect(teamUrl("exists"));
  }

  const membershipId = randomUUID();
  const membershipStatus =
    invitedUser.authSubject && invitedUser.emailVerifiedAt
      ? "active"
      : "invited";
  const queries = [
    db.insert(merchantMemberships).values({
      id: membershipId,
      merchantId,
      userId: invitedUser.id,
      role,
      status: membershipStatus,
      invitedByUserId: access.user.id,
      acceptedAt: membershipStatus === "active" ? new Date() : null,
    }),
  ] as const;

  if (role === "owner") {
    await db.batch(queries);
  } else {
    await db.batch([
      ...queries,
      db.insert(merchantSiteAssignments).values(
        validSites.map((site) => ({
          merchantId,
          membershipId,
          siteId: site.id,
        })),
      ),
    ]);
  }

  revalidatePath("/merchant/team");
  redirect(teamUrl("invited"));
}
