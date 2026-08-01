import { getDb } from "../src/db";
import {
  cancellationPolicies,
  cancellationPolicyTiers,
  courts,
  merchantMemberships,
  merchants,
  siteOperatingHours,
  sites,
  users,
} from "../src/db/schema";

if (process.env.ALLOW_DATABASE_SEED !== "true") {
  throw new Error("Set ALLOW_DATABASE_SEED=true to seed the Preview database.");
}

if (process.env.VERCEL_ENV === "production") {
  throw new Error("The seed script cannot run against Vercel Production.");
}

const ids = {
  merchant: "10000000-0000-4000-8000-000000000001",
  owner: "10000000-0000-4000-8000-000000000002",
  membership: "10000000-0000-4000-8000-000000000003",
  site: "10000000-0000-4000-8000-000000000004",
  courtOne: "10000000-0000-4000-8000-000000000005",
  courtTwo: "10000000-0000-4000-8000-000000000006",
  policy: "10000000-0000-4000-8000-000000000007",
} as const;

async function seed() {
  const db = getDb();

  await db
    .insert(merchants)
    .values({
      id: ids.merchant,
      displayName: "Pikko Demo Club",
      legalName: "Pikko Demo Club",
      slug: "demo-club",
      status: "active",
      contactEmail: "merchant@example.com",
      monthlyCourtPriceCents: 150000,
      gatewayFeeBasisPoints: 250,
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({
      id: ids.owner,
      email: "owner@example.com",
      fullName: "Demo Owner",
      status: "active",
      emailVerifiedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(merchantMemberships)
    .values({
      id: ids.membership,
      merchantId: ids.merchant,
      userId: ids.owner,
      role: "owner",
      status: "active",
      acceptedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(sites)
    .values({
      id: ids.site,
      merchantId: ids.merchant,
      name: "Pikko Demo Makati",
      slug: "makati",
      status: "active",
      addressLine1: "Makati City",
      city: "Makati",
      province: "Metro Manila",
      contactEmail: "bookings@example.com",
      manualPaymentEnabled: true,
      manualPaymentInstructions:
        "Scan the merchant QR, then upload a clear payment screenshot.",
    })
    .onConflictDoNothing();

  await db
    .insert(courts)
    .values([
      {
        id: ids.courtOne,
        merchantId: ids.merchant,
        siteId: ids.site,
        name: "Court One",
        slug: "court-one",
        baseHourlyRateCents: 50000,
        indoor: true,
      },
      {
        id: ids.courtTwo,
        merchantId: ids.merchant,
        siteId: ids.site,
        name: "Court Two",
        slug: "court-two",
        baseHourlyRateCents: 45000,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(siteOperatingHours)
    .values(
      Array.from({ length: 7 }, (_, dayOfWeek) => ({
        merchantId: ids.merchant,
        siteId: ids.site,
        dayOfWeek,
        opensAt: "06:00:00",
        closesAt: "22:00:00",
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(cancellationPolicies)
    .values({
      id: ids.policy,
      merchantId: ids.merchant,
      siteId: ids.site,
      version: 1,
      selfServiceCutoffMinutes: 360,
      noShowGraceMinutes: 15,
      customerVisibleText:
        "Cancel at least 24 hours before play for a full refund, or at least 6 hours before play for a 50% refund. Later cancellations are non-refundable.",
    })
    .onConflictDoNothing();

  await db
    .insert(cancellationPolicyTiers)
    .values([
      {
        merchantId: ids.merchant,
        policyId: ids.policy,
        minimumMinutesBeforeStart: 1440,
        refundBasisPoints: 10000,
        sortOrder: 0,
      },
      {
        merchantId: ids.merchant,
        policyId: ids.policy,
        minimumMinutesBeforeStart: 360,
        refundBasisPoints: 5000,
        sortOrder: 1,
      },
      {
        merchantId: ids.merchant,
        policyId: ids.policy,
        minimumMinutesBeforeStart: 0,
        refundBasisPoints: 0,
        sortOrder: 2,
      },
    ])
    .onConflictDoNothing();

  console.log("Preview seed complete.");
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
