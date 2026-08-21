// Standalone test: verify the Next.js standalone server starts correctly
// with the env vars that Electron would pass, and responds to HTTP.

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const SERVER_PATH = path.join(__dirname, "..", ".next", "standalone", "server.js");
const PORT = 3310;
const HOSTNAME = "127.0.0.1";

if (!fs.existsSync(SERVER_PATH)) {
  console.error("SKIP: .next/standalone/server.js not found. Run build:standalone first.");
  process.exit(0);
}

function waitForReady(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (Date.now() > deadline) return reject(new Error("timeout"));
      const req = http.get({ hostname: HOSTNAME, port, path: "/", timeout: 2000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          res.resume();
          resolve(true);
        } else {
          res.resume();
          setTimeout(check, 200);
        }
      });
      req.on("error", () => setTimeout(check, 200));
      req.on("timeout", () => { req.destroy(); setTimeout(check, 200); });
    };
    check();
  });
}

async function main() {
  console.log("Starting Next.js standalone server on port", PORT);
  const proc = spawn("node", [SERVER_PATH], {
    cwd: path.dirname(SERVER_PATH),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForReady(PORT);
    console.log("✅ Server ready");

    // Test API route
    const apiRes = await new Promise((resolve) => {
      http.get({ hostname: HOSTNAME, port: PORT, path: "/api/contacts" }, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
    });
    console.log("API /api/contacts →", apiRes.status, apiRes.body.substring(0, 80));

    // Test auth providers
    const authRes = await new Promise((resolve) => {
      http.get({ hostname: HOSTNAME, port: PORT, path: "/api/auth/providers" }, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
    });
    console.log("Auth /api/auth/providers →", authRes.status, authRes.body.substring(0, 100));

    if (apiRes.status === 200 && authRes.status === 200) {
      console.log("✅ ALL CHECKS PASSED — Electron will work with this server");
      process.exit(0);
    } else {
      console.log("❌ Some checks failed");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Test failed:", err.message);
    process.exit(1);
  } finally {
    if (!proc.killed) proc.kill("SIGTERM");
  }
}

main();
