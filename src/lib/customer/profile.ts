import "server-only";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, type users } from "@/db/schema";

type PikkoUser = typeof users.$inferSelect;

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error as { code?: string }).code === "23505",
  );
}

export async function ensureCustomerProfile(
  user: PikkoUser,
  details?: { fullName?: string; mobileNumber?: string },
) {
  const db = getDb();
  const fullName = details?.fullName?.trim() || user.fullName;
  const mobileNumber = details?.mobileNumber?.trim() || user.mobileNumber;
  const [linkedProfile] = await db
    .select()
    .from(customers)
    .where(eq(customers.userId, user.id))
    .limit(1);

  if (linkedProfile) {
    const [updatedProfile] = await db
      .update(customers)
      .set({
        email: user.email,
        fullName,
        mobileNumber: mobileNumber || linkedProfile.mobileNumber,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, linkedProfile.id))
      .returning();
    return updatedProfile;
  }

  if (user.emailVerifiedAt) {
    const [emailProfile] = await db
      .select()
      .from(customers)
      .where(sql`lower(${customers.email}) = ${user.email}`)
      .limit(1);

    if (emailProfile && (!emailProfile.userId || emailProfile.userId === user.id)) {
      const [linkedEmailProfile] = await db
        .update(customers)
        .set({
          userId: user.id,
          fullName,
          mobileNumber: mobileNumber || emailProfile.mobileNumber,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, emailProfile.id))
        .returning();
      return linkedEmailProfile;
    }
  }

  try {
    const [createdProfile] = await db
      .insert(customers)
      .values({
        id: randomUUID(),
        userId: user.id,
        email: user.email,
        fullName,
        mobileNumber: mobileNumber || null,
      })
      .returning();
    return createdProfile;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const [concurrentProfile] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, user.id))
      .limit(1);
    if (concurrentProfile) return concurrentProfile;
    throw error;
  }
}
