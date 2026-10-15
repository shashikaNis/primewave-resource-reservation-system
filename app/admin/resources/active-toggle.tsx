"use client";

import { useFormStatus } from "react-dom";
import { setResourceActive } from "@/app/actions/resources";

export default function ActiveToggle({
  resourceId,
  name,
  isActive,
}: {
  resourceId: number;
  name: string;
  isActive: boolean;
}) {
  return (
    <form
      action={setResourceActive}
      onSubmit={(event) => {
        const message = `Deactivate "${name}"? Members will no longer see or book it. Existing bookings are kept.`;
        if (isActive && !confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <SubmitButton isActive={isActive} />
    </form>
  );
}

function SubmitButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-60 ${
        isActive ? "text-danger-text hover:bg-danger-soft" : "text-success-text hover:bg-success-soft"
      }`}
    >
      {pending ? "Saving..." : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
