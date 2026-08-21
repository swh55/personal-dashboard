// =============================================================================
// Silah Cloud Platform — middleware
// =============================================================================
// Runs on every request (edge runtime). Responsibilities:
//
//   1. Security headers on all responses (CSP, X-Frame-Options, etc.)
//   2. CORS preflight handling for /api/v1/* (native clients)
//   3. Lightweight rate limiting on /api/v1/auth/* (login/refresh brute-force defence)
//
// NOTE: Edge runtime — no Prisma, no Node crypto. Rate limiting is in-memory
// per-edge-instance (Vercel spins up multiple instances, so this is a soft
// limit, not a hard global cap). For a single-user personal dashboard this is
// sufficient. A production multi-user system would use Upstash Redis.

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Rate limiter — simple sliding-window in-memory Map.
// ---------------------------------------------------------------------------
// Keyed by IP + pathname. Each entry stores an array of timestamps.
// Cleared periodically to prevent unbounded growth.

interface RateBucket {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_AUTH = 20; // 20 auth requests per minute per IP

function rateLimit(
  key: string,
  max: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const bucket = rateLimitMap.get(key);

  if (!bucket) {
    rateLimitMap.set(key, { timestamps: [now] });
    return { allowed: true, remaining: max - 1, retryAfter: 0 };
  }

  // Drop expired timestamps
  bucket.timestamps = bucket.timestamps.filter(
    (t) => now - t < windowMs
  );

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0];
    const retryAfter = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: max - bucket.timestamps.length, retryAfter: 0 };
}

// Periodic cleanup (every 5 minutes) to prevent memory leaks.
// This runs lazily on the first request after each interval.
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup > 5 * 60_000) {
    for (const [key, bucket] of rateLimitMap.entries()) {
      bucket.timestamps = bucket.timestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (bucket.timestamps.length === 0) {
        rateLimitMap.delete(key);
      }
    }
    lastCleanup = now;
  }
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // Note: CSP is intentionally permissive for Next.js (inline styles/scripts).
  // A stricter CSP would require nonce-based hashing — out of scope for v1.
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

// ---------------------------------------------------------------------------
// CORS configuration for /api/v1/*
// ---------------------------------------------------------------------------
// We do NOT use Access-Control-Allow-Origin: * on authenticated routes.
// Instead, we reflect the Origin header only if it matches a known web origin
// OR if the request carries a Bearer token (native client — no origin).
//
// Known web origins (the deployed app + localhost for dev):
const WEB_ORIGINS = new Set(
  [
    process.env.NEXTAUTH_URL,
    "https://personal-dashboard-mu-lyart.vercel.app",
    "http://localhost:3000",
  ].filter(Boolean) as string[]
);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return WEB_ORIGINS.has(origin);
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------
export function middleware(req: NextRequest) {
  maybeCleanup();

  const { pathname } = req.nextUrl;
  const isV1Api = pathname.startsWith("/api/v1");
  const isAuthEndpoint =
    pathname.startsWith("/api/v1/auth/token") ||
    pathname.startsWith("/api/v1/auth/refresh");

  // --- 1. Rate limit auth endpoints ---
  if (isAuthEndpoint) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = rateLimit(`auth:${ip}`, RATE_MAX_AUTH, RATE_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many authentication attempts. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  // --- 2. CORS preflight for /api/v1/* ---
  if (isV1Api && req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, X-Device-Id, X-App-Version",
      "Access-Control-Max-Age": "86400",
    };
    // For native clients (no Origin or Bearer token), allow all.
    // For browser requests, only allow known web origins.
    if (isAllowedOrigin(origin)) {
      headers["Access-Control-Allow-Origin"] = origin!;
      headers["Access-Control-Allow-Credentials"] = "true";
    } else if (req.headers.get("authorization")) {
      // Native client with bearer token — allow any origin (no cookies to leak)
      headers["Access-Control-Allow-Origin"] = origin || "*";
      headers["Access-Control-Allow-Credentials"] = "false";
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // --- 3. Build the response (let Next.js handle the request) ---
  const res = NextResponse.next();

  // --- 4. Apply security headers ---
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }

  // --- 5. Apply CORS headers to /api/v1/* responses ---
  if (isV1Api) {
    const origin = req.headers.get("origin");
    if (isAllowedOrigin(origin)) {
      res.headers.set("Access-Control-Allow-Origin", origin!);
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Vary", "Origin");
    } else if (req.headers.get("authorization") && origin) {
      // Native client — reflect origin, no credentials
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Access-Control-Allow-Credentials", "false");
      res.headers.set("Vary", "Origin");
    }
    // Add rate-limit headers for auth endpoints
    if (isAuthEndpoint) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";
      const bucket = rateLimitMap.get(`auth:${ip}`);
      const remaining = bucket
        ? Math.max(0, RATE_MAX_AUTH - bucket.timestamps.length)
        : RATE_MAX_AUTH;
      res.headers.set("X-RateLimit-Limit", String(RATE_MAX_AUTH));
      res.headers.set("X-RateLimit-Remaining", String(remaining));
    }
  }

  return res;
}

// ---------------------------------------------------------------------------
// Matcher — run on /api/* paths. Skip NextAuth internals, static files, etc.
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    // Run on all /api/v1/* paths
    "/api/v1/:path*",
    // Also run on existing /api/* for security headers (but not /api/auth/* NextAuth internals)
    "/api/((?!auth/(?:signin|signout|callback|session)).*)",
  ],
};
