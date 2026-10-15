import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { and, asc, desc, eq, gt, lt, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { reservations, resources, users } from "@/db/schema";
import CancelButton from "@/components/cancel-button";
import { formatShortDate, formatTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

const MAX_ROWS = 200;

const statusOptions = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function AllReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">All reservations</h1>
      <p className="mb-6 text-sm text-muted">Every booking across all resources and people.</p>
      <Suspense fallback={<p>Loading reservations...</p>}>
        <ReservationTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ReservationTable({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const read = (key: string) => (typeof params[key] === "string" ? params[key] : "");

  const status = statusOptions.some((option) => option.value === read("status")) ? read("status") : "upcoming";
  const resourceId = Number(read("resource")) || null;
  const userId = Number(read("user")) || null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(read("date")) ? read("date") : "";

  const now = new Date();
  const filters: (SQL | undefined)[] = [];
  if (status === "upcoming") filters.push(eq(reservations.status, "confirmed"), gt(reservations.endTime, now));
  if (status === "past") filters.push(eq(reservations.status, "confirmed"), lte(reservations.endTime, now));
  if (status === "cancelled") filters.push(eq(reservations.status, "cancelled"));
  if (resourceId) filters.push(eq(reservations.resourceId, resourceId));
  if (userId) filters.push(eq(reservations.userId, userId));
  if (date) {
    // Bookings that overlap the chosen day.
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    filters.push(lt(reservations.startTime, dayEnd), gt(reservations.endTime, dayStart));
  }

  // Upcoming bookings read soonest first; everything else most recent first.
  const order = status === "upcoming" ? asc(reservations.startTime) : desc(reservations.startTime);

  const rows = await db
    .select({
      id: reservations.id,
      title: reservations.title,
      startTime: reservations.startTime,
      endTime: reservations.endTime,
      status: reservations.status,
      resourceId: resources.id,
      resourceName: resources.name,
      bookedBy: users.name,
    })
    .from(reservations)
    .innerJoin(resources, eq(reservations.resourceId, resources.id))
    .innerJoin(users, eq(reservations.userId, users.id))
    .where(and(...filters))
    .orderBy(order)
    .limit(MAX_ROWS);

  const resourceOptions = await db
    .select({ id: resources.id, name: resources.name })
    .from(resources)
    .orderBy(asc(resources.name));
  const userOptions = await db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));

  const selectClass = "rounded-md border border-border bg-surface px-3 py-2 text-sm";

  return (
    <>
      <Form action="/admin/reservations" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" defaultValue={status} className={selectClass}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Resource
          <select name="resource" defaultValue={resourceId ?? ""} className={selectClass}>
            <option value="">All resources</option>
            {resourceOptions.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Booked by
          <select name="user" defaultValue={userId ?? ""} className={selectClass}>
            <option value="">Everyone</option>
            {userOptions.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input type="date" name="date" defaultValue={date} className={selectClass} />
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Filter
        </button>
        <Link href="/admin/reservations" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background">
          Clear
        </Link>
      </Form>

      <p className="mb-2 text-sm text-muted">
        {rows.length === MAX_ROWS
          ? `Showing the first ${MAX_ROWS} bookings.`
          : `${rows.length} ${rows.length === 1 ? "booking" : "bookings"}`}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          No bookings match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Booked by</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const hasEnded = row.endTime <= now;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatShortDate(row.startTime)}
                      <span className="block text-muted">
                        {formatTime(row.startTime)} – {formatTime(row.endTime)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/resources/${row.resourceId}`} className="text-link hover:underline">
                        {row.resourceName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3">{row.bookedBy}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} hasEnded={hasEnded} />
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "confirmed" && !hasEnded && (
                        <div className="flex justify-end">
                          <CancelButton reservationId={row.id} title={row.title} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status, hasEnded }: { status: "confirmed" | "cancelled"; hasEnded: boolean }) {
  if (status === "cancelled") {
    return <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger-text">Cancelled</span>;
  }
  if (hasEnded) {
    return <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">Completed</span>;
  }
  return <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-text">Confirmed</span>;
}
