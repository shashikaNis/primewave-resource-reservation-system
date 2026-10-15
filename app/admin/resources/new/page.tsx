import { Suspense } from "react";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { createResource } from "@/app/actions/resources";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import ResourceForm from "../resource-form";

export default function NewResourcePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/admin/resources" className="text-sm text-muted hover:underline">
        ← Manage resources
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Add resource</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <NewResourceForm />
      </Suspense>
    </main>
  );
}

async function NewResourceForm() {
  await requireAdmin();
  const typeRows = await db.selectDistinct({ type: resources.type }).from(resources).orderBy(asc(resources.type));

  return (
    <ResourceForm
      action={createResource}
      initialValues={{ name: "", type: "", location: "", capacity: "", description: "" }}
      existingTypes={typeRows.map((row) => row.type)}
      submitLabel="Add resource"
    />
  );
}
