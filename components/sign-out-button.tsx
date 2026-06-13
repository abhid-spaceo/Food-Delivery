import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

// Server-action sign-out. Rendered inside server components; the <form> posts
// directly to the action (no client JS needed).
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-foreground">
        Sign out
      </Button>
    </form>
  );
}
