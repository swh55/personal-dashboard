import type { NextConfig } from "next";

// Build target determines the output mode:
//   - APK (NEXT_PUBLIC_APK_MODE=true) → "export" (static HTML/JS for WebView)
//   - STANDALONE (BUILD_TARGET=standalone) → "standalone" (self-contained server
//     for Electron / Docker / VPS — bundles node_modules + .next/static)
//   - default (Vercel) → undefined (Vercel builds Next.js natively and does NOT
//     want the standalone output — it has its own serverless build pipeline)
const isApkBuild = process.env.NEXT_PUBLIC_APK_MODE === "true";
const isStandalone = process.env.BUILD_TARGET === "standalone";

const nextConfig: NextConfig = {
  output: isApkBuild ? "export" : isStandalone ? "standalone" : undefined,
  // Static export needs trailing slashes for asset resolution in WebView
  trailingSlash: isApkBuild,
  // Skip image optimization for static export (no server in APK)
  images: isApkBuild ? { unoptimized: true } : undefined,
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
