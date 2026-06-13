// Edge-safe auth config (NO Prisma/bcrypt imports) so it can be used by
// middleware on the Edge runtime. The full config (lib/auth.ts) adds the
// Credentials provider that touches the database on the Node runtime.
import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/generated/prisma/enums";

// Route prefixes that require authentication (any logged-in user).
const CUSTOMER_PREFIXES = ["/account", "/cart", "/checkout", "/orders"];

export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [], // real providers are added in lib/auth.ts
  callbacks: {
    // Persist the user's role into the JWT at sign-in.
    jwt({ token, user }) {
      if (user) token.role = user.role;
      return token;
    },
    // Expose id + role on the session for server reads and ownership checks.
    session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (token.role) session.user.role = token.role as Role;
      }
      return session;
    },
    // First authorization layer: gate route groups by role. Ownership is
    // re-checked in every Server Action (see CLAUDE.md).
    authorized({ auth, request }) {
      const role = auth?.user?.role;
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/admin")) return role === "ADMIN";
      if (pathname.startsWith("/restaurant")) return role === "RESTAURANT";
      if (pathname.startsWith("/driver")) return role === "DRIVER";
      if (CUSTOMER_PREFIXES.some((p) => pathname.startsWith(p))) return Boolean(auth);
      return true;
    },
  },
} satisfies NextAuthConfig;
