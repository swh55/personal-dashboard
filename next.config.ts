import type { NextConfig } from "next";

const isApkBuild = process.env.NEXT_PUBLIC_APK_MODE === "true";

const nextConfig: NextConfig = {
  // For APK builds, use static export. Otherwise use standalone for dev server.
  output: isApkBuild ? "export" : "standalone",
  // Static export needs trailing slashes for asset resolution in WebView
  trailingSlash: isApkBuild,
  // Skip image optimization for static export (no server)
  images: isApkBuild ? { unoptimized: true } : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
