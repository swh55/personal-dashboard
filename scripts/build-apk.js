#!/usr/bin/env node
/**
 * Cross-platform build script for APK (static export).
 * Temporarily moves API routes out of the way during build,
 * because Next.js `output: "export"` doesn't allow API routes.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const apiDir = path.join(root, "src", "app", "api");
const backupDir = path.join(root, ".api-backup");

console.log("=== APK Build Script ===");

// Step 1: Move API routes to backup
if (fs.existsSync(apiDir)) {
  console.log("Moving src/app/api → .api-backup");
  if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true });
  fs.renameSync(apiDir, backupDir);
} else {
  console.log("No API routes found, skipping move");
}

try {
  // Step 2: Run Next.js build with APK mode
  console.log("Running: NEXT_PUBLIC_APK_MODE=true next build");
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_APK_MODE: "true" },
  });
  console.log("Build completed successfully");
} catch (err) {
  console.error("Build failed:", err.message);
  process.exitCode = 1;
} finally {
  // Step 3: Restore API routes
  if (fs.existsSync(backupDir)) {
    console.log("Restoring src/app/api");
    fs.renameSync(backupDir, apiDir);
  }
}
