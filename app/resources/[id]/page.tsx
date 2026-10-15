import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { reservations, resources, users } from "@/db/schema";
import { formatLongDate, formatTime } from "@/lib/format";
import CancelButton from "@/components/cancel-button";
import { getCurrentUser } from "@/lib/session";
import BookingForm from "./booking-form";

// Bookable hours used to work out free slots.
const OPENING_HOUR = 8;
const CLOSING_HOUR = 18;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function ResourceAvailabilityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/resources" className="text-sm text-muted hover:underline">
        ← All resources
      </Link>
      <Suspense fallback={<p className="mt-4">Loading availability...</p>}>
        <Availability params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Availability({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const { date, start, end, booked } = await searchParams;

  const resourceId = Number(id);
  if (!Number.isInteger(resourceId)) notFound();

  const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId));
  if (!resource || (!resource.isActive && user.role !== "admin")) notFound();

  const dayStart = parseDate(date);
  const dayEnd = addDays(dayStart, 1);

  const bookings = await db
    .select({
      id: reservations.id,
      title: reservations.title,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      bookedBy: users.name,
      userId: reservations.userId,
    })
    .from(reservations)
    .innerJoin(users, eq(reservations.userId, users.id))
    .where(
      and(
        eq(reservations.resourceId, resourceId),
        eq(reservations.status, "confirmed"),
        lt(reservations.startTime, dayEnd),
        gt(reservations.endTime, dayStart),
      ),
    )
    .orderBy(asc(reservations.startTime));

  const openTime = atHour(dayStart, OPENING_HOUR);
  const closeTime = atHour(dayStart, CLOSING_HOUR);
  const now = new Date();
  const freeSlots = findFreeSlots(bookings, openTime, closeTime, now);
  const canBook = resource.isActive && dayEnd > now;

  // Prefill the booking form from a clicked free slot, or suggest the first free hour.
  const dateString = toDateString(dayStart);
  const firstSlot = freeSlots[0];
  const defaultStart = isTime(start)
    ? `${dateString}T${start}`
    : toDateTimeString(firstSlot ? firstSlot.start : atHour(dayStart, 9));
  const defaultEnd = isTime(end)
    ? `${dateString}T${end}`
    : toDateTimeString(firstSlot ? suggestedEnd(firstSlot) : atHour(dayStart, 10));

  return (
    <>
      <h1 className="mt-2 text-2xl font-semibold">{resource.name}</h1>
      <p className="text-sm text-muted">
        {[resource.type, resource.location, resource.capacity && `${resource.capacity} people`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {booked === "1" && (
        <p role="status" className="mt-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success-text">
          Your booking is confirmed.
        </p>
      )}
      {!resource.isActive && (
        <p className="mt-2 text-sm text-danger-text">This resource is inactive and cannot be booked.</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={`/resources/${resourceId}?date=${toDateString(addDays(dayStart, -1))}`}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-background"
        >
          ← Previous day
        </Link>
        <Form action={`/resources/${resourceId}`} className="flex gap-2">
          <input
            type="date"
            name="date"
            defaultValue={toDateString(dayStart)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Check
          </button>
        </Form>
        <Link
          href={`/resources/${resourceId}?date=${toDateString(addDays(dayStart, 1))}`}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-background"
        >
          Next day →
        </Link>
      </div>

      <h2 className="mt-6 font-semibold">
        {formatLongDate(dayStart)}
      </h2>
      <Timeline bookings={bookings} openTime={openTime} closeTime={closeTime} />

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium">
            Free slots ({formatTime(openTime)}–{formatTime(closeTime)})
          </h3>
          {freeSlots.length === 0 ? (
            <p className="text-sm text-muted">No free time left on this day.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {freeSlots.map((slot) => (
                <li
                  key={slot.start.toISOString()}
                  className="flex items-center justify-between rounded-md bg-success-soft px-3 py-2 text-sm text-success-text"
                >
                  {formatTime(slot.start)} – {formatTime(slot.end)}
                  {canBook && (
                    <Link
                      href={`/resources/${resourceId}?date=${dateString}&start=${formatTime(slot.start)}&end=${formatTime(suggestedEnd(slot))}#book`}
                      className="font-medium underline hover:no-underline"
                    >
                      Book
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 font-medium">Bookings</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted">No bookings on this day.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bookings.map((booking) => (
                <li key={booking.id} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  <p className="font-medium">
                    {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                  </p>
                  <p>{booking.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted">Booked by {booking.bookedBy}</p>
                    {/* The person who booked, or an admin, can cancel a booking that has not ended. */}
                    {(booking.userId === user.id || user.role === "admin") && booking.endTime > now && (
                      <CancelButton reservationId={booking.id} title={booking.title} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canBook && (
        <section id="book" className="mt-8 scroll-mt-4">
          <h2 className="mb-3 text-lg font-semibold">Book {resource.name}</h2>
          <BookingForm
            key={`${defaultStart}-${defaultEnd}`}
            resourceId={resourceId}
            defaultStart={defaultStart}
            defaultEnd={defaultEnd}
          />
        </section>
      )}
    </>
  );
}

type Booking = { id: number; startTime: Date; endTime: Date };

// A bar across opening hours with booked periods shaded.
function Timeline({ bookings, openTime, closeTime }: { bookings: Booking[]; openTime: Date; closeTime: Date }) {
  const totalMs = closeTime.getTime() - openTime.getTime();
  const toPercent = (time: Date) =>
    (Math.min(Math.max(time.getTime() - openTime.getTime(), 0), totalMs) / totalMs) * 100;

  const hours = [];
  for (let hour = OPENING_HOUR; hour <= CLOSING_HOUR; hour += 2) hours.push(hour);

  return (
    <div className="mt-3">
      <div className="relative h-8 rounded-md bg-success">
        {bookings.map((booking) => {
          const left = toPercent(booking.startTime);
          const width = toPercent(booking.endTime) - left;
          if (width <= 0) return null;
          return (
            <div
              key={booking.id}
              className="absolute inset-y-0 rounded-md bg-danger"
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
      </div>
      <div className="relative mt-1 h-4 text-xs text-muted">
        {hours.map((hour) => (
          <span
            key={hour}
            className="absolute -translate-x-1/2"
            style={{ left: `${((hour - OPENING_HOUR) / (CLOSING_HOUR - OPENING_HOUR)) * 100}%` }}
          >
            {String(hour).padStart(2, "0")}:00
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-sm bg-success" /> Free
        </span>
        <span className="flex items-center gap-1">
          <span className="size-3 rounded-sm bg-danger" /> Booked
        </span>
      </div>
    </div>
  );
}

// Gaps between bookings within opening hours. Time that has already passed is not free.
function findFreeSlots(bookings: Booking[], openTime: Date, closeTime: Date, now: Date) {
  const freeSlots: { start: Date; end: Date }[] = [];
  let cursor = now > openTime ? roundUpToQuarterHour(now) : openTime;

  for (const booking of bookings) {
    const gapEnd = booking.startTime < closeTime ? booking.startTime : closeTime;
    if (gapEnd > cursor) freeSlots.push({ start: cursor, end: gapEnd });
    if (booking.endTime > cursor) cursor = booking.endTime;
  }
  if (closeTime > cursor) freeSlots.push({ start: cursor, end: closeTime });

  return freeSlots;
}

// Reads "YYYY-MM-DD" as a local date, falling back to today.
function parseDate(value: string | string[] | undefined) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function atHour(date: Date, hour: number) {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function toDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function toDateTimeString(date: Date) {
  return `${toDateString(date)}T${formatTime(date)}`;
}

function isTime(value: string | string[] | undefined): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

// One hour after the slot starts, or the end of the slot if that is sooner.
function suggestedEnd(slot: { start: Date; end: Date }) {
  const oneHourLater = new Date(slot.start.getTime() + 60 * 60 * 1000);
  return oneHourLater < slot.end ? oneHourLater : slot.end;
}

function roundUpToQuarterHour(date: Date) {
  const quarterHour = 15 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / quarterHour) * quarterHour);
}
