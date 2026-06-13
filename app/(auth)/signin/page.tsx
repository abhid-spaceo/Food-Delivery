import { AuthShell } from "../_components/auth-shell";
import { SignInForm } from "../signin-form";

// Sign-in route ("/signin"). Proxy redirects unauthenticated users here.
export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in"
      description={
        <>
          Seeded accounts (password <code>password123</code>): admin@demo.test,
          owner@demo.test, customer@demo.test
        </>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
