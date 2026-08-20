// =============================================================================
// Auth helpers — server-side session resolution + client-side session hook.
// =============================================================================
//
// Server side (API routes, server components):
//   import { getCurrentUser, requireUser } from "@/lib/auth-helpers";
//   const user = await getCurrentUser(); // null if guest
//   const user = await requireUser();    // throws 401 if guest
//
// Client side (React components):
//   import { useCurrentUser } from "@/lib/auth-helpers";
//   const { data: session, status } = useCurrentUser();
//   if (status === "authenticated") session.user.id ...

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Session } from "next-auth";

// ---------------------------------------------------------------------------
// Server-side helpers
// ---------------------------------------------------------------------------

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  provider: string | null;
}

/**
 * Resolve the currently authenticated user from the request session.
 * Returns `null` for guests (not signed in) — callers should treat this as
 * "use local-only storage" mode.
 *
 * NOTE: We do NOT trust any `userId` from the request body or query string.
 * The userId is ALWAYS derived from the signed JWT.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return null;
    // Always re-read from DB so the userId is the source of truth
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, image: true, provider: true },
    });
    return user ?? null;
  } catch (err) {
    console.error("[auth-helpers] getCurrentUser error:", err);
    return null;
  }
}

/**
 * Require an authenticated user. Returns the user, or a 401 NextResponse
 * that API routes can return directly.
 *
 * Usage:
 *   const userOrResponse = await requireUser((await getReq()) as any);
 *   if (userOrResponse instanceof NextResponse) return userOrResponse;
 *   const user = userOrResponse; // now typed as AuthenticatedUser
 */
export async function requireUser(): Promise<
  AuthenticatedUser | NextResponse
> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "غير مصرح — يلزم تسجيل الدخول" },
      { status: 401 }
    );
  }
  return user;
}

/**
 * Returns the userId for use in Prisma queries, or `null` for guests.
 * This is the ONLY sanctioned way to obtain a userId for DB filtering —
 * never trust a userId from the client.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Client-side helper
// ---------------------------------------------------------------------------

export { useSession as useCurrentUser } from "next-auth/react";
export type { Session };
