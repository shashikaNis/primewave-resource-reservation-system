"use server";

import { and, asc, eq, gt, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { reservations, resources } from "@/db/schema";
import { EXCLUSION_VIOLATION, isPostgresError } from "@/lib/db-errors";
import { formatShortDate, formatTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export type ReservationFormState = {
  error?: string;
  values?: { title: string; start: string; end: string };
};

export async function createReservation(
  previousState: ReservationFormState,
  formData: FormData,
): Promise<ReservationFormState> {
  const user = await getCurrentUser();

  const resourceId = Number(formData.get("resourceId"));
  const title = String(formData.get("title") ?? "").trim();
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  const values = { title, start, end };

  // "YYYY-MM-DDTHH:MM" from a datetime-local input is read as local time.
  const startTime = new Date(start);
  const endTime = new Date(end);

  if (!title) return { error: "Please enter a title for your booking.", values };
  if (title.length > 100) return { error: "Title must be 100 characters or fewer.", values };
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return { error: "Please enter a valid start and end time.", values };
  }
  if (endTime <= startTime) return { error: "End time must be after the start time.", values };
  if (startTime < new Date()) return { error: "Start time cannot be in the past.", values };

  const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId));
  if (!resource || !resource.isActive) {
    return { error: "This resource is not available for booking.", values };
  }

  try {
    await db.insert(reservations).values({ resourceId, userId: user.id, title, startTime, endTime });
  } catch (error) {
    // The database rejects overlapping bookings (see no_overlapping_reservations constraint).
    if (!isPostgresError(error, EXCLUSION_VIOLATION)) throw error;

    const [clash] = await db
      .select({ startTime: reservations.startTime, endTime: reservations.endTime })
      .from(reservations)
      .where(
        and(
          eq(reservations.resourceId, resourceId),
          eq(reservations.status, "confirmed"),
          lt(reservations.startTime, endTime),
          gt(reservations.endTime, startTime),
        ),
      )
      .orderBy(asc(reservations.startTime))
      .limit(1);

    const clashText = clash
      ? ` (${formatShortDate(clash.startTime)}, ${formatTime(clash.startTime)}–${formatTime(clash.endTime)})`
      : "";
    return {
      error: `${resource.name} is already booked during that time${clashText}. Please choose another time.`,
      values,
    };
  }

  revalidatePath("/", "layout");
  redirect(`/resources/${resourceId}?date=${start.slice(0, 10)}&booked=1`);
}

// Only the person who made the booking, or an admin, can cancel it, and only before it ends.
export async function cancelReservation(formData: FormData) {
  const user = await getCurrentUser();
  const reservationId = Number(formData.get("reservationId"));

  const [reservation] = await db.select().from(reservations).where(eq(reservations.id, reservationId));
  if (!reservation || reservation.status !== "confirmed" || reservation.endTime <= new Date()) return;
  if (reservation.userId !== user.id && user.role !== "admin") return;

  await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, reservationId));
  revalidatePath("/", "layout");
}
