"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction, type AuthFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = {};

// Role chip data — emoji + label + value kept in one place.
const ROLES = [
  { value: "CUSTOMER", label: "Customer", emoji: "🍽" },
  { value: "RESTAURANT", label: "Restaurant", emoji: "🏪" },
  { value: "DRIVER", label: "Driver", emoji: "🛵" },
] as const;

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>

      {/* Role selector — styled as chips but backed by real radio inputs so
          Playwright getByRole("radio", { name: "Driver" }) still works. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am a</legend>
        <div className="flex gap-2">
          {ROLES.map(({ value, label, emoji }) => (
            <label
              key={value}
              className="group relative flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-border px-3 py-2.5 text-center text-sm font-medium transition-colors
                has-[:checked]:border-primary has-[:checked]:bg-brand-soft has-[:checked]:text-[var(--brand-dark)]
                hover:border-primary/50"
            >
              {/* Visually hidden but accessible radio */}
              <input
                type="radio"
                name="role"
                value={value}
                defaultChecked={value === "CUSTOMER"}
                className="sr-only"
              />
              <span className="text-xl" aria-hidden="true">{emoji}</span>
              <span>{label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Restaurant &amp; Driver accounts require admin approval before going live.
        </p>
      </fieldset>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} variant="gradient" className="w-full" loading={pending}>
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
