"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, deleteSession } from "@/lib/session";
import bcrypt from "bcryptjs";



export async function login(previousState: any, formData: FormData): Promise<any> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email) return { error: "Please enter your email.", email };
  if(!password) return { error: "Please enter your password.", email };

  const dbUsers = await db.select().from(users).where(eq(users.email, email));

  const passwordMatch = dbUsers[0] && bcrypt.compareSync(password, dbUsers[0].passwordHash);

  if (!dbUsers[0] || !passwordMatch) {
    return { error: "Invalid email or password.", email };
  }

  await createSession(dbUsers[0].id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
