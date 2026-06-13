import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignUpForm } from "../signup-form";

// Sign-up route ("/signup"). Customers and restaurants self-register; admin is
// seeded, not self-registerable.
export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>Sign up as a customer or a restaurant.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </main>
  );
}
