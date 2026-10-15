import { randomBytes } from "node:crypto";
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


export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session"
  )?.value;

  if (!sessionId) redirect("/login");

  // Pages that read the current time (here and after this call) must not be prerendered.
  await io();

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));

  if (!user) redirect("/login");
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
