import { and, asc, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  merchantMemberships,
  merchants,
  merchantSiteAssignments,
  sites,
  users,
} from "@/db/schema";
import { getAuth } from "./server";
import {
  permissionsForRole,
  roleHasPermission,
  type MerchantPermission,
} from "./permissions";

function configuredAdminEmails() {
  return new Set(
    (process.env.PIKKO_PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function syncCurrentUser() {
  const { data: session } = await getAuth().getSession();

  if (!session?.user) {
    return null;
  }

  const authUser = session.user;
  const email = authUser.email.trim().toLowerCase();
  const db = getDb();
  const [subjectUser] = await db
    .select()
    .from(users)
    .where(eq(users.authSubject, authUser.id))
    .limit(1);
  const [emailUser] = subjectUser
    ? [undefined]
    : await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
  const existingUser = subjectUser ?? emailUser;

  if (
    existingUser?.authSubject &&
    existingUser.authSubject !== authUser.id
  ) {
    throw new Error("This email is already linked to another identity.");
  }

  if (existingUser && !existingUser.authSubject && !authUser.emailVerified) {
    return existingUser;
  }

  const isPlatformAdmin =
    authUser.emailVerified && configuredAdminEmails().has(email);
  const now = new Date();
  const values = {
    authSubject: authUser.id,
    email,
    fullName: authUser.name?.trim() || email.split("@")[0] || "Pikko user",
    status: "active" as const,
    emailVerifiedAt: authUser.emailVerified ? now : null,
    lastSignedInAt: now,
    platformRole: isPlatformAdmin
      ? ("admin" as const)
      : existingUser?.platformRole,
    updatedAt: now,
  };

  if (existingUser) {
    const [updatedUser] = await db
      .update(users)
      .set(values)
      .where(eq(users.id, existingUser.id))
      .returning();

    if (authUser.emailVerified) {
      await db
        .update(merchantMemberships)
        .set({ status: "active", acceptedAt: now, updatedAt: now })
        .where(
          and(
            eq(merchantMemberships.userId, existingUser.id),
            eq(merchantMemberships.status, "invited"),
          ),
        );
    }

    return updatedUser;
  }

  const [createdUser] = await db.insert(users).values(values).returning();
  return createdUser;
}

export async function getMerchantAccess() {
  const user = await syncCurrentUser();

  if (!user) {
    return null;
  }

  const db = getDb();
  const [membership] = await db
    .select({
      id: merchantMemberships.id,
      merchantId: merchantMemberships.merchantId,
      role: merchantMemberships.role,
      merchantName: merchants.displayName,
      merchantSlug: merchants.slug,
    })
    .from(merchantMemberships)
    .innerJoin(merchants, eq(merchantMemberships.merchantId, merchants.id))
    .where(
      and(
        eq(merchantMemberships.userId, user.id),
        eq(merchantMemberships.status, "active"),
        eq(merchants.status, "active"),
      ),
    )
    .orderBy(asc(merchantMemberships.createdAt))
    .limit(1);

  if (!membership) {
    return { user, membership: null, sites: [], permissions: [] };
  }

  const availableSites =
    membership.role === "owner"
      ? await db
          .select({ id: sites.id, name: sites.name, slug: sites.slug })
          .from(sites)
          .where(
            and(
              eq(sites.merchantId, membership.merchantId),
              eq(sites.status, "active"),
            ),
          )
          .orderBy(asc(sites.name))
      : await db
          .select({ id: sites.id, name: sites.name, slug: sites.slug })
          .from(merchantSiteAssignments)
          .innerJoin(sites, eq(merchantSiteAssignments.siteId, sites.id))
          .where(
            and(
              eq(merchantSiteAssignments.membershipId, membership.id),
              eq(merchantSiteAssignments.merchantId, membership.merchantId),
              eq(sites.status, "active"),
            ),
          )
          .orderBy(asc(sites.name));

  return {
    user,
    membership,
    sites: availableSites,
    permissions: permissionsForRole(membership.role),
  };
}

export async function requireMerchantPermission(
  permission: MerchantPermission,
) {
  const access = await getMerchantAccess();

  if (!access?.user) {
    redirect(`/auth/sign-in?callbackURL=${encodeURIComponent("/merchant")}`);
  }

  if (
    !access.membership ||
    !roleHasPermission(access.membership.role, permission)
  ) {
    redirect("/access-denied");
  }

  return access as typeof access & { membership: NonNullable<typeof access.membership> };
}

export async function requirePlatformAdmin() {
  const user = await syncCurrentUser();

  if (!user) {
    redirect(
      `/auth/sign-in?audience=admin&callbackURL=${encodeURIComponent("/admin")}`,
    );
  }

  if (user.platformRole !== "admin") {
    redirect("/access-denied");
  }

  return user;
}
