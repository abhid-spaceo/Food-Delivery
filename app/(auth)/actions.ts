"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma/enums";

// Where each role lands after authenticating.
const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  RESTAURANT: "/restaurant",
  CUSTOMER: "/browse",
  DRIVER: "/driver",
};

export type AuthFormState = { error?: string };

const signInSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Email and password are required" };

  try {
    // redirect:false so we can route by role ourselves below.
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password" };
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  redirect(user ? ROLE_HOME[user.role] : "/");
}

const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "RESTAURANT", "DRIVER"]),
});

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists" };

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  // A driver needs a Driver profile (starts PENDING; an admin approves it
  // before the driver can claim orders). Restaurants build their profile on a
  // dedicated onboarding screen, so only DRIVER gets an auto-created row here.
  if (role === "DRIVER") {
    await prisma.driver.create({ data: { userId: user.id, name } });
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Account created — please sign in" };
    throw error;
  }
  redirect(ROLE_HOME[role]);
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
