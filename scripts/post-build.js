#!/usr/bin/env node
/**
 * Cross-platform post-build script.
 * Copies .next/static and public/ into .next/standalone/ after Next.js build.
 * Works on Linux, Windows, and macOS — no `cp` dependency.
 */
const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Warning: source not found: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

const root = path.resolve(__dirname, "..");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(root, ".next", "standalone", ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(root, ".next", "standalone", "public");

console.log("Copying .next/static → .next/standalone/.next/static");
copyDir(staticSrc, staticDest);
console.log("Copying public → .next/standalone/public");
copyDir(publicSrc, publicDest);
console.log("Post-build copy complete.");
