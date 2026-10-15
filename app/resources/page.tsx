import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import { and, asc, eq, gt, ilike, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { reservations, resources } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Resources</h1>
      <p className="mb-6 text-sm text-muted">Browse rooms, equipment and vehicles you can book.</p>

      <Suspense fallback={<p>Loading resources...</p>}>
        <ResourceList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResourceList({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const { q, type } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const selectedType = typeof type === "string" ? type : "";

  // Members only see active resources; admins also see inactive ones.
  const filters: (SQL | undefined)[] = [];
  if (user.role !== "admin") filters.push(eq(resources.isActive, true));
  if (search) {
    filters.push(or(ilike(resources.name, `%${search}%`), ilike(resources.location, `%${search}%`)));
  }
  if (selectedType) filters.push(eq(resources.type, selectedType));

  const resourceList = await db
    .select()
    .from(resources)
    .where(and(...filters))
    .orderBy(asc(resources.name));

  const typeRows = await db
    .selectDistinct({ type: resources.type })
    .from(resources)
    .orderBy(asc(resources.type));

  // Confirmed reservations happening right now, used to show "In use" status.
  const now = new Date();
  const currentBookings = await db
    .select({ resourceId: reservations.resourceId, endTime: reservations.endTime })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, "confirmed"),
        lte(reservations.startTime, now),
        gt(reservations.endTime, now),
      ),
    );

  return (
    <>
      <Form action="/resources" className="mb-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Search by name or location"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2"
        />
        <select
          name="type"
          defaultValue={selectedType}
          className="rounded-md border border-border bg-surface px-3 py-2"
        >
          <option value="">All types</option>
          {typeRows.map((row) => (
            <option key={row.type} value={row.type}>
              {row.type}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
        >
          Filter
        </button>
        {(search || selectedType) && (
          <Link
            href="/resources"
            className="rounded-md border border-border bg-surface px-4 py-2 hover:bg-background"
          >
            Clear
          </Link>
        )}
      </Form>

      {resourceList.length === 0 ? (
        <p className="text-muted">No resources match your search.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resourceList.map((resource) => {
            const booking = currentBookings.find((row) => row.resourceId === resource.id);
            return (
              <li
                key={resource.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{resource.name}</h2>
                  <StatusBadge isActive={resource.isActive} bookedUntil={booking?.endTime} />
                </div>
                <p className="text-sm text-muted">{resource.type}</p>
                <dl className="text-sm">
                  {resource.location && (
                    <div className="flex gap-1">
                      <dt className="text-muted">Location:</dt>
                      <dd>{resource.location}</dd>
                    </div>
                  )}
                  {resource.capacity && (
                    <div className="flex gap-1">
                      <dt className="text-muted">Capacity:</dt>
                      <dd>{resource.capacity} people</dd>
                    </div>
                  )}
                </dl>
                {resource.description && <p className="text-sm">{resource.description}</p>}
                <Link
                  href={`/resources/${resource.id}`}
                  className="mt-auto text-sm font-medium text-link hover:underline"
                >
                  Check availability →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function StatusBadge({ isActive, bookedUntil }: { isActive: boolean; bookedUntil?: Date }) {
  if (!isActive) {
    return <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">Inactive</span>;
  }
  if (bookedUntil) {
    const time = bookedUntil.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-text">In use until {time}</span>
    );
  }
  return <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-text">Available now</span>;
}
