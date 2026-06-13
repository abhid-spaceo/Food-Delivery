import { AuthShell } from "../_components/auth-shell";
import { SignUpForm } from "../signup-form";

// Sign-up route ("/signup"). Customers, restaurants, and drivers self-register;
// admin is seeded, not self-registerable.
export default function SignUpPage() {
  return (
    <AuthShell
      title="Create account"
      description="Sign up as a customer, a restaurant, or a driver."
    >
      <SignUpForm />
    </AuthShell>
  );
}
