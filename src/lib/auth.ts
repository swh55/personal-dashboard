// =============================================================================
// NextAuth v4 configuration — Google OAuth ONLY + JWT session strategy.
// =============================================================================
// We deliberately use the JWT strategy (NOT the Prisma adapter) so that:
//   1. We avoid the NextAuth `Account`/`Session` model name collision with
//      the existing financial `Account` model.
//   2. Sessions are stateless and fast (no DB lookup per request).
//   3. The same code works on serverless / edge (Vercel).
//
// On every successful Google sign-in, we UPSERT a row in our `User` table
// keyed by email so subsequent requests can attach data to that user.
//
// NOTE: The Dev Login (Credentials) provider was REMOVED per user request.
// Google OAuth is the ONLY sign-in method. To log in locally, add the
// redirect URI `http://localhost:3000/api/auth/callback/google` to your
// Google Cloud Console → Authorized redirect URIs.

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      })
    );
  } else {
    // No providers configured — the app will run in guest-only mode.
    // Surface a clear error in the server log so misconfiguration is obvious.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[auth] WARNING: GOOGLE_CLIENT_ID/SECRET not set. " +
          "Google login will not work. Set them in the Vercel dashboard."
      );
    }
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  providers: buildProviders(),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    // On sign-in, upsert the user in our DB so we have a stable userId
    async signIn({ user }) {
      if (!user?.email) return false;
      try {
        const existing = await db.user.findUnique({
          where: { email: user.email },
        });
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
              provider: "google",
            },
          });
        } else if (!existing.provider) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              provider: "google",
              image: user.image ?? existing.image,
            },
          });
        }
      } catch (err) {
        // Don't block login on upsert errors — the JWT still carries the email
        console.error("[auth] signIn upsert failed:", err);
      }
      return true;
    },
    // Embed userId + provider in the JWT
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        try {
          const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true, name: true, image: true, provider: true },
          });
          if (dbUser) {
            token.userId = dbUser.id;
            token.name = dbUser.name ?? user.name ?? undefined;
            token.picture = dbUser.image ?? user.image ?? undefined;
            token.provider = dbUser.provider ?? "google";
          }
        } catch (err) {
          console.error("[auth] jwt lookup failed:", err);
        }
      }
      return token;
    },
    // Expose userId + provider to the client session
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.userId as string | undefined;
        (session.user as SessionUser).provider =
          token.provider as string | undefined;
      }
      return session;
    },
  },
};

// Augment the NextAuth types so `session.user.id` is known to TypeScript
declare module "next-auth" {
  interface Session {
    user?: SessionUser;
  }
  interface User {
    id?: string;
    provider?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    provider?: string;
  }
}

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  provider?: string;
}
