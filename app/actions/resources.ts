"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { isPostgresError, UNIQUE_VIOLATION } from "@/lib/db-errors";
import { requireAdmin } from "@/lib/session";

export type ResourceValues = {
  name: string;
  type: string;
  location: string;
  capacity: string;
  description: string;
};

export type ResourceFormState = {
  error?: string;
  values?: ResourceValues;
};

export async function createResource(
  previousState: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  await requireAdmin();
  const values = readValues(formData);

  const error = validate(values);
  if (error) return { error, values };

  try {
    await db.insert(resources).values(toRow(values));
  } catch (dbError) {
    if (isPostgresError(dbError, UNIQUE_VIOLATION)) {
      return { error: `A resource named "${values.name}" already exists.`, values };
    }
    throw dbError;
  }

  revalidatePath("/", "layout");
  redirect(`/admin/resources?saved=${encodeURIComponent(values.name)}`);
}

// Bound to a resource id in the edit page: updateResource.bind(null, id).
export async function updateResource(
  resourceId: number,
  previousState: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  await requireAdmin();
  const values = readValues(formData);

  const error = validate(values);
  if (error) return { error, values };

  try {
    await db.update(resources).set(toRow(values)).where(eq(resources.id, resourceId));
  } catch (dbError) {
    if (isPostgresError(dbError, UNIQUE_VIOLATION)) {
      return { error: `A resource named "${values.name}" already exists.`, values };
    }
    throw dbError;
  }

  revalidatePath("/", "layout");
  redirect(`/admin/resources?saved=${encodeURIComponent(values.name)}`);
}

// Inactive resources are hidden from members and cannot be booked. Existing bookings are kept.
export async function setResourceActive(formData: FormData) {
  await requireAdmin();
  const resourceId = Number(formData.get("resourceId"));
  const isActive = formData.get("isActive") === "true";

  await db.update(resources).set({ isActive }).where(eq(resources.id, resourceId));
  revalidatePath("/", "layout");
}

function readValues(formData: FormData): ResourceValues {
  const read = (field: string) => String(formData.get(field) ?? "").trim();
  return {
    name: read("name"),
    type: read("type"),
    location: read("location"),
    capacity: read("capacity"),
    description: read("description"),
  };
}

function validate(values: ResourceValues) {
  if (!values.name) return "Please enter a name.";
  if (values.name.length > 100) return "Name must be 100 characters or fewer.";
  if (!values.type) return "Please enter a type, for example Meeting Room.";
  if (values.type.length > 50) return "Type must be 50 characters or fewer.";
  if (values.location.length > 100) return "Location must be 100 characters or fewer.";
  if (values.capacity) {
    const capacity = Number(values.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) return "Capacity must be a whole number of 1 or more.";
  }
  if (values.description.length > 500) return "Description must be 500 characters or fewer.";
  return null;
}

// Empty optional fields are stored as NULL.
function toRow(values: ResourceValues) {
  return {
    name: values.name,
    type: values.type,
    location: values.location || null,
    capacity: values.capacity ? Number(values.capacity) : null,
    description: values.description || null,
  };
}
