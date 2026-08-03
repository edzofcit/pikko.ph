"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import {
  auditEvents,
  courtAllocations,
  courtBlocks,
  courts,
} from "@/db/schema";
import { requireMerchantPermission } from "@/lib/auth/access";
import { getSiteAvailability } from "@/lib/booking/availability";

export type CourtBlockState = { error: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCK_TYPES = new Set(["maintenance", "private_event", "temporary_closure"]);

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isCourtConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; constraint?: string; message?: string };
  return (
    candidate.code === "23P01" ||
    candidate.constraint === "court_allocations_no_active_overlap" ||
    candidate.message?.includes("court_allocations_no_active_overlap") === true
  );
}

export async function createCourtBlock(
  _previousState: CourtBlockState,
  formData: FormData,
): Promise<CourtBlockState> {
  const access = await requireMerchantPermission("manage_courts");
  const siteSlug = readText(formData, "siteSlug");
  const date = readText(formData, "date");
  const courtId = readText(formData, "courtId");
  const type = readText(formData, "type");
  const reason = readText(formData, "reason");
  const requestedStarts = readText(formData, "starts")
    .split(",")
    .filter(Boolean)
    .slice(0, 24)
    .sort();

  if (
    !siteSlug ||
    !UUID_PATTERN.test(courtId) ||
    !BLOCK_TYPES.has(type) ||
    requestedStarts.length === 0 ||
    reason.length > 500
  ) {
    return { error: "Select a court, adjacent hours, and a valid block type." };
  }

  const availability = await getSiteAvailability(
    access.membership.merchantSlug,
    siteSlug,
    date,
  );
  if (
    !availability ||
    availability.merchant.id !== access.membership.merchantId ||
    !access.sites.some((site) => site.id === availability.site.id)
  ) {
    return { error: "This site is not available to your merchant account." };
  }

  const court = availability.courts.find((item) => item.id === courtId);
  const selectedSlots = court?.slots
    .filter((slot) => requestedStarts.includes(slot.startsAt))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const contiguous = selectedSlots?.every((slot, index) =>
    index === 0
      ? true
      : new Date(slot.startsAt).getTime() -
          new Date(selectedSlots[index - 1].startsAt).getTime() ===
        3_600_000,
  );

  if (
    !court ||
    !selectedSlots ||
    selectedSlots.length !== requestedStarts.length ||
    !contiguous
  ) {
    return { error: "One or more hours are no longer open. Reload and select again." };
  }

  const blockId = randomUUID();
  const now = new Date();
  const startsAt = new Date(selectedSlots[0].startsAt);
  const endsAt = new Date(selectedSlots[selectedSlots.length - 1].endsAt);
  const db = getDb();

  try {
    await db.batch([
      db
        .update(courtAllocations)
        .set({ active: false, releasedAt: now })
        .where(
          and(
            eq(courtAllocations.courtId, court.id),
            eq(courtAllocations.active, true),
            lte(courtAllocations.expiresAt, now),
          ),
        ),
      db.insert(courtBlocks).values({
        id: blockId,
        merchantId: availability.merchant.id,
        courtId: court.id,
        type: type as "maintenance" | "private_event" | "temporary_closure",
        startsAt,
        endsAt,
        reason: reason || null,
        customerVisible: true,
        createdByUserId: access.user.id,
      }),
      db.insert(courtAllocations).values({
        merchantId: availability.merchant.id,
        courtId: court.id,
        kind: "merchant_block",
        courtBlockId: blockId,
        startsAt,
        endsAt,
      }),
      db.insert(auditEvents).values({
        merchantId: availability.merchant.id,
        actorUserId: access.user.id,
        action: "merchant.court_block.created",
        targetType: "court_block",
        targetId: blockId,
        after: { courtId: court.id, type, startsAt, endsAt, reason, customerVisible: true },
      }),
    ]);
  } catch (error) {
    if (isCourtConflict(error)) {
      return { error: "That time was just reserved. Reload and choose another open hour." };
    }
    console.error("Court block creation failed", error);
    return { error: "The court block could not be created. Please try again." };
  }

  revalidatePath(`/${availability.merchant.slug}/${availability.site.slug}`);
  revalidatePath("/merchant/schedule");
  redirect(
    `/merchant/schedule?site=${availability.site.id}&date=${availability.date}&success=${encodeURIComponent("Court time blocked.")}`,
  );
}

export async function cancelCourtBlock(formData: FormData) {
  const access = await requireMerchantPermission("manage_courts");
  const blockId = readText(formData, "blockId");
  const siteId = readText(formData, "siteId");
  const date = readText(formData, "date");
  if (!UUID_PATTERN.test(blockId) || !UUID_PATTERN.test(siteId)) return;

  const db = getDb();
  const [block] = await db
    .select({
      id: courtBlocks.id,
      courtId: courtBlocks.courtId,
      siteId: courts.siteId,
    })
    .from(courtBlocks)
    .innerJoin(
      courts,
      and(
        eq(courts.id, courtBlocks.courtId),
        eq(courts.merchantId, courtBlocks.merchantId),
      ),
    )
    .where(
      and(
        eq(courtBlocks.id, blockId),
        eq(courtBlocks.merchantId, access.membership.merchantId),
        isNull(courtBlocks.cancelledAt),
      ),
    )
    .limit(1);

  if (!block || block.siteId !== siteId || !access.sites.some((site) => site.id === block.siteId)) {
    return;
  }

  const now = new Date();
  await db.batch([
    db.update(courtBlocks).set({ cancelledAt: now, updatedAt: now }).where(eq(courtBlocks.id, block.id)),
    db
      .update(courtAllocations)
      .set({ active: false, releasedAt: now })
      .where(and(eq(courtAllocations.courtBlockId, block.id), eq(courtAllocations.active, true))),
    db.insert(auditEvents).values({
      merchantId: access.membership.merchantId,
      actorUserId: access.user.id,
      action: "merchant.court_block.cancelled",
      targetType: "court_block",
      targetId: block.id,
      before: { courtId: block.courtId, active: true },
      after: { active: false, cancelledAt: now },
    }),
  ]);

  revalidatePath("/merchant/schedule");
  redirect(
    `/merchant/blocks?site=${siteId}&date=${encodeURIComponent(date)}&success=${encodeURIComponent("Court block removed.")}`,
  );
}
