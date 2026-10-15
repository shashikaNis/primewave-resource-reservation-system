import { Suspense } from "react";
import Link from "next/link";
import { and, asc, count, eq, getTableColumns, gt } from "drizzle-orm";
import { db } from "@/db";
import { reservations, resources } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import ActiveToggle from "./active-toggle";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function ManageResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Suspense fallback={<p>Loading resources...</p>}>
        <ResourceTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResourceTable({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const { saved } = await searchParams;

  // Every resource with the number of confirmed bookings that have not ended yet.
  const now = new Date();
  const resourceList = await db
    .select({ ...getTableColumns(resources), upcomingCount: count(reservations.id) })
    .from(resources)
    .leftJoin(
      reservations,
      and(
        eq(reservations.resourceId, resources.id),
        eq(reservations.status, "confirmed"),
        gt(reservations.endTime, now),
      ),
    )
    .groupBy(resources.id)
    .orderBy(asc(resources.name));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Manage resources</h1>
          <p className="text-sm text-muted">Add, edit and deactivate the resources people can book.</p>
        </div>
        <Link
          href="/admin/resources/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Add resource
        </Link>
      </div>

      {typeof saved === "string" && (
        <p role="status" className="mb-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success-text">
          &ldquo;{saved}&rdquo; was saved.
        </p>
      )}

      {resourceList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          No resources yet. Add the first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Capacity</th>
                <th className="px-4 py-3 font-medium">Upcoming bookings</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resourceList.map((resource) => (
                <tr key={resource.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/resources/${resource.id}`} className="text-link hover:underline">
                      {resource.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{resource.type}</td>
                  <td className="px-4 py-3">{resource.location ?? "—"}</td>
                  <td className="px-4 py-3">{resource.capacity ?? "—"}</td>
                  <td className="px-4 py-3">{resource.upcomingCount}</td>
                  <td className="px-4 py-3">
                    {resource.isActive ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-text">Active</span>
                    ) : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/resources/${resource.id}/edit`}
                        className="rounded-md border border-border px-3 py-1.5 hover:bg-background"
                      >
                        Edit
                      </Link>
                      <ActiveToggle resourceId={resource.id} name={resource.name} isActive={resource.isActive} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
