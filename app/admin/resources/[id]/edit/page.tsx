import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { updateResource } from "@/app/actions/resources";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import ResourceForm from "../../resource-form";

type Params = Promise<{ id: string }>;

export default function EditResourcePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/admin/resources" className="text-sm text-muted hover:underline">
        ← Manage resources
      </Link>
      <Suspense fallback={<p className="mt-4">Loading...</p>}>
        <EditResourceForm params={params} />
      </Suspense>
    </main>
  );
}

async function EditResourceForm({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;

  const resourceId = Number(id);
  if (!Number.isInteger(resourceId)) notFound();

  const [resource] = await db.select().from(resources).where(eq(resources.id, resourceId));
  if (!resource) notFound();

  const typeRows = await db.selectDistinct({ type: resources.type }).from(resources).orderBy(asc(resources.type));

  return (
    <>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Edit {resource.name}</h1>
      <ResourceForm
        action={updateResource.bind(null, resource.id)}
        initialValues={{
          name: resource.name,
          type: resource.type,
          location: resource.location ?? "",
          capacity: resource.capacity ? String(resource.capacity) : "",
          description: resource.description ?? "",
        }}
        existingTypes={typeRows.map((row) => row.type)}
        submitLabel="Save changes"
      />
    </>
  );
}
