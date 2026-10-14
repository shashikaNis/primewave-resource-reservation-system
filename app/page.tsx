import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/session";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Suspense fallback={<p>Loading...</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  const user = await getCurrentUser();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-zinc-500">
          {user.email} · {user.role}
        </p>
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
