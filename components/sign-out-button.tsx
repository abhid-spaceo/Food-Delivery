import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

// Server-action sign-out. Rendered inside server components; the <form> posts
// directly to the action (no client JS needed).
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button variant="outline" size="sm" type="submit">
        Sign out
      </Button>
    </form>
  );
}
