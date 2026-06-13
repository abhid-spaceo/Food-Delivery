import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

// Authenticated header: shows the current user + sign-out, or a sign-in link
// when logged out (used on public pages like /browse).
export async function AppHeader({ title }: { title: string }) {
  const session = await auth();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            QB
          </span>
          QwikBite
        </Link>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
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
