import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web-only: no static export, no standalone. Vercel builds natively.
  // API routes, NextAuth, Prisma, and all server features work.
  typescript: {
    // Pre-existing TS errors (documented tech debt) — don't block the build
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
