// =============================================================================
// Electron Main Process — spawns Next.js Standalone Server.
// =============================================================================
//
// Architecture (Phase 1 fix):
//
//   Electron Main
//        ↓
//   spawn(.next/standalone/server.js, PORT, HOSTNAME=127.0.0.1)
//        ↓
//   wait for "ready" (HTTP GET / returns 200)
//        ↓
//   BrowserWindow.loadURL(http://127.0.0.1:PORT)
//        ↓
//   Next.js API routes + NextAuth + Prisma/Neon all work via localhost
//
// Previously this loaded `out/index.html` (static export) which has no server
// → no API routes, no auth, no database. The standalone server fixes that.
//
// Port strategy: try 3310, 3311, 3312, ... up to 3399 (avoids common dev
// port 3000 and ephemeral ports). First available wins.

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

// ---- Configuration ----

const isDev = !app.isPackaged;
const HOSTNAME = "127.0.0.1"; // loopback only — never expose to network
const PORT_START = 3310;
const PORT_END = 3399;
const SERVER_STARTUP_TIMEOUT_MS = 30_000; // 30s max for Next.js to boot
const HEALTH_CHECK_INTERVAL_MS = 200;

let mainWindow = null;
let nextServerProcess = null;
let nextServerPort = null;

// ---- Port selection (find first free port) ----

function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > end) {
        reject(new Error(`No free port in range ${start}-${end}`));
        return;
      }
      const tester = require("net").createServer();
      tester.once("error", () => tryPort(port + 1));
      tester.once("listening", () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, HOSTNAME);
    };
    tryPort(start);
  });
}

// ---- Start Next.js standalone server ----

function startNextServer(port) {
  return new Promise((resolve, reject) => {
    // Locate server.js — in dev it's in .next/standalone, in packaged app
    // it's in resources/app-next/ (extraResources — avoids Windows path-length issues).
    const possiblePaths = isDev
      ? [
          path.join(__dirname, "..", ".next", "standalone", "server.js"),
          path.join(process.cwd(), ".next", "standalone", "server.js"),
        ]
      : [
          path.join(process.resourcesPath, "app-next", "server.js"),
          path.join(process.resourcesPath, "app", ".next", "standalone", "server.js"),
          path.join(__dirname, "..", ".next", "standalone", "server.js"),
        ];

    const serverPath = possiblePaths.find((p) => fs.existsSync(p));
    if (!serverPath) {
      reject(
        new Error(
          "Next.js standalone server.js not found. Run `bun run build:standalone` first.\n" +
            `Searched: ${possiblePaths.join(", ")}`
        )
      );
      return;
    }

    const serverDir = path.dirname(serverPath);
    console.log(`[electron] Starting Next.js server: ${serverPath}`);

    // Spawn the Next.js standalone server as a child process.
    // We pass PORT + HOSTNAME via env (the standalone server.js reads them).
    // We also forward all relevant server-side env vars so Prisma/NextAuth
    // work correctly (these come from the build-time .env or system env).
    nextServerProcess = spawn("node", [serverPath], {
      cwd: serverDir,
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME,
        NODE_ENV: isDev ? "development" : "production",
        ELECTRON_RUN: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    nextServerProcess.stdout.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[next-server] ${line}`);
    });

    nextServerProcess.stderr.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.error(`[next-server] ${line}`);
    });

    nextServerProcess.on("error", (err) => {
      console.error("[electron] Failed to start Next.js server:", err);
      reject(err);
    });

    nextServerProcess.on("exit", (code, signal) => {
      console.log(`[electron] Next.js server exited (code=${code}, signal=${signal})`);
      nextServerProcess = null;
    });

    resolve(nextServerProcess);
  });
}

// ---- Wait for server to be ready (HTTP health check) ----

function waitForServerReady(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + SERVER_STARTUP_TIMEOUT_MS;
    const check = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Server did not become ready within ${SERVER_STARTUP_TIMEOUT_MS}ms`));
        return;
      }
      const req = http.get(
        { hostname: HOSTNAME, port, path: "/", timeout: 2000 },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) {
            res.resume();
            resolve(true);
          } else {
            res.resume();
            setTimeout(check, HEALTH_CHECK_INTERVAL_MS);
          }
        }
      );
      req.on("error", () => setTimeout(check, HEALTH_CHECK_INTERVAL_MS));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(check, HEALTH_CHECK_INTERVAL_MS);
      });
    };
    check();
  });
}

// ---- Cleanup ----

function killNextServer() {
  if (nextServerProcess && !nextServerProcess.killed) {
    console.log("[electron] Stopping Next.js server...");
    try {
      // Try graceful SIGTERM first, then SIGKILL after 3s
      nextServerProcess.kill("SIGTERM");
      setTimeout(() => {
        if (nextServerProcess && !nextServerProcess.killed) {
          nextServerProcess.kill("SIGKILL");
        }
      }, 3000);
    } catch (err) {
      console.error("[electron] Error killing server:", err);
    }
    nextServerProcess = null;
  }
}

// ---- Window creation ----

async function createWindow() {
  // Find a free port + start the Next.js server
  try {
    nextServerPort = await findFreePort(PORT_START, PORT_END);
    console.log(`[electron] Using port ${nextServerPort}`);
    await startNextServer(nextServerPort);
    await waitForServerReady(nextServerPort);
    console.log(`[electron] Next.js server ready at http://${HOSTNAME}:${nextServerPort}`);
  } catch (err) {
    console.error("[electron] FATAL:", err.message);
    dialog.showErrorBox(
      "Silah — Failed to start",
      `Could not start the application server.\n\n${err.message}\n\nPlease restart the app.`
    );
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 480,
    height: 854,
    minWidth: 360,
    minHeight: 640,
    resizable: true,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, "..", "public", "logo.svg"),
    title: "صلة — لوحة التحكم",
    backgroundColor: "#0a0e1a",
    show: false,
  });

  // Load from the local Next.js server (NOT static file)
  const url = `http://${HOSTNAME}:${nextServerPort}/`;
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links (http/https) in the default browser —
  // important for Google OAuth flow.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---- IPC Handlers (preserved from original) ----

ipcMain.handle("platform:info", () => ({
  isElectron: true,
  platform: process.platform,
  versions: process.versions,
  appPath: app.getAppPath(),
  userData: app.getPath("userData"),
  nextServerPort,
}));

ipcMain.handle("fs:writeFile", async (event, filename, content) => {
  try {
    const dir = app.getPath("userData");
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content, "utf8");
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fs:readFile", async (event, filename) => {
  try {
    const dir = app.getPath("userData");
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) return { success: false, error: "File not found" };
    const content = fs.readFileSync(filePath, "utf8");
    return { success: true, data: content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fs:listFiles", async () => {
  try {
    const dir = app.getPath("userData");
    const files = fs.readdirSync(dir);
    return { success: true, files };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fs:deleteFile", async (event, filename) => {
  try {
    const dir = app.getPath("userData");
    const filePath = path.join(dir, filename);
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("fs:saveDialog", async (event, { filename, content }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "حفظ ملف",
      defaultPath: filename,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled) return { success: false, error: "Cancelled" };
    fs.writeFileSync(result.filePath, content, "utf8");
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("shell:openExternal", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("dialog:showMessage", async (event, { title, message }) => {
  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title,
    message,
    buttons: ["موافق"],
  });
  return { success: true };
});

// ---- App lifecycle ----

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  killNextServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: prevent navigation to untrusted URLs.
// Allow only: our local server (http://127.0.0.1:PORT) + file:// (dev assets).
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const allowedPrefix = `http://${HOSTNAME}:${nextServerPort}`;
    if (
      !navigationUrl.startsWith(allowedPrefix) &&
      !navigationUrl.startsWith("file://") &&
      !navigationUrl.startsWith("http://localhost")
    ) {
      event.preventDefault();
    }
  });
});

// Clean up the child server process when Electron exits.
app.on("before-quit", killNextServer);
process.on("exit", killNextServer);
process.on("SIGTERM", killNextServer);
process.on("SIGINT", killNextServer);
