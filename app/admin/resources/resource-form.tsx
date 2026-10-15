"use client";

import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import type { ResourceFormState, ResourceValues } from "@/app/actions/resources";

const inputClass = "rounded-md border border-border bg-surface px-3 py-2";

// Used by both the "add" and "edit" pages.
export default function ResourceForm({
  action,
  initialValues,
  existingTypes,
  submitLabel,
}: {
  action: (state: ResourceFormState, formData: FormData) => Promise<ResourceFormState>;
  initialValues: ResourceValues;
  existingTypes: string[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const values = state.values ?? initialValues;

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" required maxLength={100} defaultValue={values.name} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="type" hint="Pick an existing type or enter a new one.">
          <input
            id="type"
            name="type"
            required
            maxLength={50}
            list="resource-types"
            placeholder="e.g. Meeting Room"
            defaultValue={values.type}
            className={inputClass}
          />
          <datalist id="resource-types">
            {existingTypes.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </Field>

        <Field label="Location" htmlFor="location" hint="Optional.">
          <input
            id="location"
            name="location"
            maxLength={100}
            placeholder="e.g. Floor 2"
            defaultValue={values.location}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Capacity" htmlFor="capacity" hint="Optional. Number of people it holds.">
        <input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          step={1}
          defaultValue={values.capacity}
          className={`${inputClass} sm:w-40`}
        />
      </Field>

      <Field label="Description" htmlFor="description" hint="Optional.">
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values.description}
          className={inputClass}
        />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-text">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
        <Link href="/admin/resources" className="rounded-md border border-border px-4 py-2 hover:bg-background">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
