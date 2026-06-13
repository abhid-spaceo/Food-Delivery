// Edge proxy (Next.js 16's replacement for middleware): first authorization
// layer. Uses the edge-safe auth.config (no Prisma) and its `authorized`
// callback to gate /admin and /restaurant by role and require login for
// customer-only routes.
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, static files, and API routes.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
