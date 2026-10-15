"use client";

import { useActionState } from "react";
import { createReservation } from "@/app/actions/reservations";

export default function BookingForm({
  resourceId,
  defaultStart,
  defaultEnd,
}: {
  resourceId: number;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [state, formAction, isPending] = useActionState(createReservation, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <input type="hidden" name="resourceId" value={resourceId} />

      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={100}
          placeholder="e.g. Team meeting"
          defaultValue={state.values?.title}
          className="rounded-md border border-border bg-surface px-3 py-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="start" className="text-sm font-medium">
            Start
          </label>
          <input
            id="start"
            name="start"
            type="datetime-local"
            required
            defaultValue={state.values?.start ?? defaultStart}
            className="rounded-md border border-border bg-surface px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="end" className="text-sm font-medium">
            End
          </label>
          <input
            id="end"
            name="end"
            type="datetime-local"
            required
            defaultValue={state.values?.end ?? defaultEnd}
            className="rounded-md border border-border bg-surface px-3 py-2"
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-text">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {isPending ? "Booking..." : "Book"}
      </button>
    </form>
  );
}
