#!/usr/bin/env node
/**
 * Cross-platform build script for Electron (standalone Next.js + post-build copy).
 * Sets BUILD_TARGET=standalone env var and runs `next build`, then post-build.js.
 * Works on Windows (cmd doesn't support `VAR=value command` syntax).
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");

console.log("=== Electron Standalone Build ===");
console.log("Setting BUILD_TARGET=standalone + NEXT_PUBLIC_APK_MODE=false");

try {
  // Step 1: Next.js build with BUILD_TARGET=standalone
  console.log("\n[1/2] Running: next build (standalone output)...");
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      BUILD_TARGET: "standalone",
      NEXT_PUBLIC_APK_MODE: "false",
    },
  });
  console.log("✓ Next.js standalone build complete");

  // Step 2: Post-build copy (.next/static → .next/standalone/.next/static)
  console.log("\n[2/2] Running: post-build.js (copy static assets)...");
  execSync("node scripts/post-build.js", {
    cwd: root,
    stdio: "inherit",
  });
  console.log("✓ Post-build copy complete");
  console.log("\n=== Electron build ready for packaging ===");
} catch (err) {
  console.error("✗ Build failed:", err.message);
  process.exit(1);
}
