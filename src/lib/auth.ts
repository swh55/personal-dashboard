// =============================================================================
// NextAuth v4 configuration — Google OAuth + JWT session strategy.
// =============================================================================
// We deliberately use the JWT strategy (NOT the Prisma adapter) so that:
//   1. We avoid the NextAuth `Account`/`Session` model name collision with
//      the existing financial `Account` model.
//   2. Sessions are stateless and fast (no DB lookup per request).
//   3. The same code works on serverless / edge.
//
// On every successful Google sign-in, we UPSERT a row in our `User` table
// keyed by email so subsequent requests can attach data to that user.

import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";

// Build the providers list synchronously. Google is included only if creds
// are configured, so the app boots in pure-guest mode without OAuth creds.
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
  }

  // Always-on dev credentials provider so the app is testable even without
  // Google OAuth configured. Disabled in production via NODE_ENV check.
  if (process.env.NODE_ENV !== "production") {
    providers.push(
      Credentials({
        name: "Dev Login",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "you@example.com" },
          name: { label: "Name", type: "text", placeholder: "Your name" },
        },
        async authorize(input) {
          if (!input?.email) return null;
          try {
            const user = await db.user.upsert({
              where: { email: input.email },
              update: { name: input.name || input.email.split("@")[0] },
              create: {
                email: input.email,
                name: input.name || input.email.split("@")[0],
                provider: "dev",
              },
            });
            return {
              id: user.id,
              email: user.email,
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            };
          } catch (err) {
            console.error("[auth] dev authorize failed:", err);
            return null;
          }
        },
      })
    );
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
