import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { and, asc, count, countDistinct, eq, gt, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { reservations, resources, users } from "@/db/schema";
import { formatLongDate, formatShortDate, formatTime } from "@/lib/format";
import CancelButton from "@/components/cancel-button";
import { getCurrentUser } from "@/lib/session";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Suspense fallback={<p>Loading...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(resources)
    .where(eq(resources.isActive, true));

  const [{ inUseCount }] = await db
    .select({ inUseCount: countDistinct(reservations.resourceId) })
    .from(reservations)
    .innerJoin(resources, eq(reservations.resourceId, resources.id))
    .where(
      and(
        eq(resources.isActive, true),
        eq(reservations.status, "confirmed"),
        lte(reservations.startTime, now),
        gt(reservations.endTime, now),
      ),
    );

  // Every confirmed booking that overlaps today, across all resources.
  const todaysBookings = await db
    .select({
      id: reservations.id,
      title: reservations.title,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      resourceId: resources.id,
      resourceName: resources.name,
      bookedBy: users.name,
    })
    .from(reservations)
    .innerJoin(resources, eq(reservations.resourceId, resources.id))
    .innerJoin(users, eq(reservations.userId, users.id))
    .where(
      and(
        eq(reservations.status, "confirmed"),
        lt(reservations.startTime, tomorrowStart),
        gt(reservations.endTime, todayStart),
      ),
    )
    .orderBy(asc(reservations.startTime));

  // The current user's bookings that have not finished yet (list shows the next 5).
  const myUpcomingFilter = and(
    eq(reservations.userId, user.id),
    eq(reservations.status, "confirmed"),
    gt(reservations.endTime, now),
  );

  const [{ myUpcomingCount }] = await db
    .select({ myUpcomingCount: count() })
    .from(reservations)
    .where(myUpcomingFilter);

  const myUpcoming = await db
    .select({
      id: reservations.id,
      title: reservations.title,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      resourceId: resources.id,
      resourceName: resources.name,
    })
    .from(reservations)
    .innerJoin(resources, eq(reservations.resourceId, resources.id))
    .where(myUpcomingFilter)
    .orderBy(asc(reservations.startTime))
    .limit(5);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatLongDate(now)}</p>
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-muted">
            {user.email} · {user.role}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/resources"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Browse resources
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Available right now" value={`${activeCount - inUseCount} of ${activeCount}`} />
        <StatCard label="Bookings today" value={todaysBookings.length} />
        <StatCard label="Your upcoming bookings" value={myUpcomingCount} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Your upcoming bookings</h2>
            <Link href="/reservations" className="text-sm text-link hover:underline">
              View all →
            </Link>
          </div>
          {myUpcoming.length === 0 ? (
            <EmptyState>
              You have no upcoming bookings.{" "}
              <Link href="/resources" className="text-link hover:underline">
                Find a resource
              </Link>
            </EmptyState>
          ) : (
            <ul className="flex flex-col gap-2">
              {myUpcoming.map((booking) => {
                const isNow = booking.startTime <= now;
                return (
                  <li key={booking.id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{booking.title}</p>
                      {isNow && (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-text">
                          Happening now
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted">
                      {formatShortDate(booking.startTime)} · {formatTime(booking.startTime)} –{" "}
                      {formatTime(booking.endTime)}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/resources/${booking.resourceId}`} className="text-sm text-link hover:underline">
                        {booking.resourceName}
                      </Link>
                      <CancelButton reservationId={booking.id} title={booking.title} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Today&apos;s schedule</h2>
          {todaysBookings.length === 0 ? (
            <EmptyState>Nothing is booked today. Every resource is free.</EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {todaysBookings.map((booking) => {
                const isPast = booking.endTime <= now;
                return (
                  <li key={booking.id} className={`flex gap-4 p-4 ${isPast ? "opacity-60" : ""}`}>
                    <p className="w-28 shrink-0 text-sm font-medium">
                      {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                    </p>
                    <div className="text-sm">
                      <Link href={`/resources/${booking.resourceId}`} className="font-medium text-link hover:underline">
                        {booking.resourceName}
                      </Link>
                      <p>{booking.title}</p>
                      <p className="text-muted">Booked by {booking.bookedBy}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">{children}</p>;
}
