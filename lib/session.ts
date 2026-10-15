import { randomBytes } from "node:crypto";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";



export async function createSession(userId: number) {
  const sessionId = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ id: sessionId, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set("session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}


// The logged-in user, or null. cache() means the header and the page share one lookup per request.
export const getSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;

  if (!sessionId) return null;

  // Pages that read the current time (here and after this call) must not be prerendered.
  await io();

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));

  return user ?? null;
});

// The logged-in user; sends visitors who are not logged in to the login page.
export async function getCurrentUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

// The logged-in admin; sends everyone else back to the home page.
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
  cookieStore.delete("session");
}
