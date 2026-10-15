"use client";

import { useFormStatus } from "react-dom";
import { cancelReservation } from "@/app/actions/reservations";

export default function CancelButton({ reservationId, title }: { reservationId: number; title: string }) {
  return (
    <form
      action={cancelReservation}
      onSubmit={(event) => {
        if (!confirm(`Cancel "${title}"?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="reservationId" value={reservationId} />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-danger-text hover:bg-danger-soft disabled:opacity-60"
    >
      {pending ? "Cancelling..." : "Cancel"}
    </button>
  );
}
