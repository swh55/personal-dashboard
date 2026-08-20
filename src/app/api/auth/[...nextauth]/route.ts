// NextAuth v4 route handler.
// Exposes GET and POST for all auth-related URLs under /api/auth/*.
// Examples:
//   GET  /api/auth/providers        — list configured providers
//   GET  /api/auth/signin           — sign-in page
//   POST /api/auth/signin/google    — start Google OAuth flow
//   GET  /api/auth/callback/google  — OAuth callback
//   POST /api/auth/signout          — log out
//   GET  /api/auth/session          — current session JSON

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
