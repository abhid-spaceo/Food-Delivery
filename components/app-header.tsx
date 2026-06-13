import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

// Authenticated header: shows the current user + sign-out, or a sign-in link
// when logged out (used on public pages like /browse).
export async function AppHeader({ title }: { title: string }) {
  const session = await auth();
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href="/" className="font-semibold">
        {title}
      </Link>
      <div className="flex items-center gap-3">
        {session?.user ? (
          <>
            <span className="text-sm text-muted-foreground">
              {session.user.email} · {session.user.role}
            </span>
            <SignOutButton />
          </>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
