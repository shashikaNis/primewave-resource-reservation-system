import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getSessionUser } from "@/lib/session";
import NavLinks from "./nav-links";

// Shown on every page once someone is logged in; hidden on the login page.
export default async function SiteHeader() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="font-semibold">
            PrimeWave Reservations
          </Link>
          <NavLinks />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm">
            {user.name} <span className="text-muted">· {user.role}</span>
          </p>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
