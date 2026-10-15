import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { reservations, resources } from "@/db/schema";
import { formatShortDate, formatTime } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";
import CancelButton from "@/components/cancel-button";

export default function MyReservationsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">My reservations</h1>
      <p className="mb-6 text-sm text-muted">Your upcoming, past and cancelled bookings.</p>

      <Suspense fallback={<p>Loading reservations...</p>}>
        <ReservationList />
      </Suspense>
    </main>
  );
}

type Reservation = {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "cancelled";
  resourceId: number;
  resourceName: string;
};

async function ReservationList() {
  const user = await getCurrentUser();

  const myReservations = await db
    .select({
      id: reservations.id,
      title: reservations.title,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      status: reservations.status,
      resourceId: resources.id,
      resourceName: resources.name,
    })
    .from(reservations)
    .innerJoin(resources, eq(reservations.resourceId, resources.id))
    .where(eq(reservations.userId, user.id))
    .orderBy(asc(reservations.startTime), desc(reservations.id));

  const now = new Date();
  const upcoming = myReservations.filter((booking) => booking.status === "confirmed" && booking.endTime > now);
  const past = myReservations
    .filter((booking) => booking.status === "confirmed" && booking.endTime <= now)
    .reverse();
  const cancelled = myReservations.filter((booking) => booking.status === "cancelled").reverse();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <EmptyState>
            You have no upcoming bookings.{" "}
            <Link href="/resources" className="text-link hover:underline">
              Find a resource to book
            </Link>
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((booking) => (
              <ReservationItem key={booking.id} booking={booking} now={now}>
                <CancelButton reservationId={booking.id} title={booking.title} />
              </ReservationItem>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Past ({past.length})</h2>
        {past.length === 0 ? (
          <EmptyState>No past bookings yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {past.map((booking) => (
              <ReservationItem key={booking.id} booking={booking} now={now} />
            ))}
          </ul>
        )}
      </section>

      {cancelled.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Cancelled ({cancelled.length})</h2>
          <ul className="flex flex-col gap-2">
            {cancelled.map((booking) => (
              <ReservationItem key={booking.id} booking={booking} now={now} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReservationItem({
  booking,
  now,
  children,
}: {
  booking: Reservation;
  now: Date;
  children?: ReactNode;
}) {
  const isCancelled = booking.status === "cancelled";
  const isNow = !isCancelled && booking.startTime <= now && booking.endTime > now;

  return (
    <li
      className={`flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4 ${
        isCancelled || booking.endTime <= now ? "opacity-70" : ""
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-medium ${isCancelled ? "line-through" : ""}`}>{booking.title}</p>
          {isNow && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-text">Happening now</span>
          )}
          {isCancelled && (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger-text">Cancelled</span>
          )}
        </div>
        <p className="text-sm text-muted">
          {formatShortDate(booking.startTime)} · {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
        </p>
        <Link href={`/resources/${booking.resourceId}`} className="text-sm text-link hover:underline">
          {booking.resourceName}
        </Link>
      </div>
      {children}
    </li>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">{children}</p>;
}
