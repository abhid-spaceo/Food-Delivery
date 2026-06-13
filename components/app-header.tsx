import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

// Authenticated header: shows the current user + sign-out, or a sign-in link
// when logged out (used on public pages like /browse). Optional `children` are
// rendered in the right-hand cluster before the session block (e.g. a cart button).
export async function AppHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const session = await auth();
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-card/85 px-6 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground">
          {/* Gradient QB mark — matches the brand gradient token */}
          <span
            className="grid size-8 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-[0_4px_10px_rgba(255,46,84,0.35)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            QB
          </span>
          <span className="font-black tracking-tight">QwikBite</span>
        </Link>
        {title && (
          <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:block">
            {title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {session?.user ? (
          <>
            <span className="hidden text-sm text-muted-foreground sm:block">
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
