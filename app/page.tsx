import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Suspense fallback={<p>Loading...</p>}>
        <Welcome />
      </Suspense>
      <Link href="/resources" className="mt-8 inline-block text-link hover:underline">
        Browse resources →
      </Link>
    </main>
  );
}

async function Welcome() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-muted">
          {user.email} · {user.role}
        </p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-background"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
