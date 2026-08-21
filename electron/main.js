// =============================================================================
// Electron Main Process — spawns Next.js Standalone Server.
// =============================================================================
//
// Architecture (Phase 2 — production-safe with logging):
//
//   Electron Main
//        ↓
//   resolve server.js path (multiple fallbacks)
//        ↓
//   load .env file from server directory (if exists)
//        ↓
//   spawn(node, [server.js], { cwd, env: merged })
//        ↓
//   capture stdout + stderr to log file + console
//        ↓
//   HTTP health check (GET /) with 30s timeout + 250ms retries
//        ↓
//   BrowserWindow.loadURL(http://127.0.0.1:PORT)
//
// Logging: writes to %APPDATA%/Silah/logs/electron-main.log on Windows
// or ~/Library/Application Support/Silah/logs on macOS.

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
const SERVER_STARTUP_TIMEOUT_MS = 30_000; // 30s — NOT increased; root-cause instead
const HEALTH_CHECK_INTERVAL_MS = 250;

let mainWindow = null;
let nextServerProcess = null;
let nextServerPort = null;
let logStream = null;

// ---- Logging ----

function getLogPath() {
  const dir = path.join(app.getPath("userData"), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "electron-main.log");
}

function initLogging() {
  const logPath = getLogPath();
  try {
    logStream = fs.createWriteStream(logPath, { flags: "a" });
    log(`=== Silah Electron Main started at ${new Date().toISOString()} ===`);
    log(`isDev: ${isDev}, app.isPackaged: ${app.isPackaged}`);
    log(`app.getAppPath(): ${app.getAppPath()}`);
    log(`process.resourcesPath: ${process.resourcesPath}`);
    log(`__dirname: ${__dirname}`);
    log(`process.cwd(): ${process.cwd()}`);
    log(`platform: ${process.platform}, arch: ${process.arch}`);
  } catch (err) {
    console.error("[electron] Failed to init logging:", err);
  }
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  if (logStream) {
    try { logStream.write(line + "\n"); } catch {}
  }
}

// ---- Port selection (find first free port) ----

function findFreePort(start, end) {
  return new Promise((resolve, reject) => {
    const net = require("net");
    const tryPort = (port) => {
      if (port > end) {
        reject(new Error(`No free port in range ${start}-${end}`));
        return;
      }
      const tester = net.createServer();
      tester.once("error", (err) => {
        log(`Port ${port} busy (${err.code}), trying ${port + 1}`);
        tryPort(port + 1);
      });
      tester.once("listening", () => {
        tester.close(() => {
          log(`Found free port: ${port}`);
          resolve(port);
        });
      });
      tester.listen(port, HOSTNAME);
    };
    tryPort(start);
  });
}

// ---- Locate server.js ----

function locateServer() {
  const candidates = isDev
    ? [
        path.join(__dirname, "..", ".next", "standalone", "server.js"),
        path.join(process.cwd(), ".next", "standalone", "server.js"),
      ]
    : [
        path.join(process.resourcesPath, "app-next", "server.js"),
        path.join(process.resourcesPath, "app", ".next", "standalone", "server.js"),
        path.join(__dirname, "..", ".next", "standalone", "server.js"),
        path.join(__dirname, ".next", "standalone", "server.js"),
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      log(`✓ Found server.js: ${p}`);
      return p;
    }
    log(`✗ Not found: ${p}`);
  }
  return null;
}

// ---- Load .env from server directory (production-safe) ----

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    log(`No .env file at ${envPath} — relying on process.env only`);
    return {};
  }
  log(`Loading .env from ${envPath}`);
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2];
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  log(`Loaded ${Object.keys(env).length} env vars from .env file`);
  return env;
}

// ---- Start Next.js standalone server ----

function startNextServer(port) {
  return new Promise((resolve, reject) => {
    const serverPath = locateServer();
    if (!serverPath) {
      reject(new Error(
        "Next.js standalone server.js not found.\n" +
        "Searched paths:\n" +
        (isDev
          ? `  ${path.join(__dirname, "..", ".next", "standalone", "server.js")}\n`
          : `  ${path.join(process.resourcesPath, "app-next", "server.js")}\n`) +
        "\nPlease reinstall the application or contact support."
      ));
      return;
    }

    const serverDir = path.dirname(serverPath);

    // Verify required files exist
    const requiredFiles = ["server.js", "package.json"];
    for (const f of requiredFiles) {
      const fp = path.join(serverDir, f);
      if (!fs.existsSync(fp)) {
        reject(new Error(`Required file missing in server directory: ${f} (expected at ${fp})`));
        return;
      }
    }

    // Check if .next/ subdir exists (standalone needs it)
    const nextDir = path.join(serverDir, ".next");
    if (!fs.existsSync(nextDir)) {
      log(`⚠ WARNING: .next directory missing at ${nextDir}`);
    } else {
      log(`✓ .next directory exists at ${nextDir}`);
    }

    // Check node_modules
    const nmDir = path.join(serverDir, "node_modules");
    if (!fs.existsSync(nmDir)) {
      log(`⚠ WARNING: node_modules missing at ${nmDir}`);
    } else {
      log(`✓ node_modules exists at ${nmDir}`);
    }

    // Load .env from server dir (production .env baked by Next.js standalone build)
    const envFilePath = path.join(serverDir, ".env");
    const envFileVars = loadEnvFile(envFilePath);

    // Merge env: process.env (CI secrets) > .env file > defaults
    const serverEnv = {
      ...envFileVars,        // .env from standalone build
      ...process.env,        // CI/runner env (overrides .env)
      PORT: String(port),
      HOSTNAME,
      NODE_ENV: isDev ? "development" : "production",
      ELECTRON_RUN: "1",
    };

    log(`Starting Next.js server:`);
    log(`  cwd: ${serverDir}`);
    log(`  PORT: ${port}`);
    log(`  HOSTNAME: ${HOSTNAME}`);
    log(`  NODE_ENV: ${serverEnv.NODE_ENV}`);
    log(`  DATABASE_URL present: ${Boolean(serverEnv.DATABASE_URL)}`);
    log(`  GOOGLE_CLIENT_ID present: ${Boolean(serverEnv.GOOGLE_CLIENT_ID)}`);
    log(`  AUTH_SECRET present: ${Boolean(serverEnv.AUTH_SECRET)}`);

    nextServerProcess = spawn("node", [serverPath], {
      cwd: serverDir,
      env: serverEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });

    nextServerProcess.stdout.on("data", (data) => {
      const line = data.toString().trim();
      if (line) log(`[next-server:out] ${line}`);
    });

    nextServerProcess.stderr.on("data", (data) => {
      const line = data.toString().trim();
      if (line) log(`[next-server:err] ${line}`);
    });

    nextServerProcess.on("error", (err) => {
      log(`✗ Failed to spawn Next.js server: ${err.message}`);
      log(`  err.code: ${err.code}`);
      reject(err);
    });

    nextServerProcess.on("exit", (code, signal) => {
      log(`Next.js server exited (code=${code}, signal=${signal})`);
      nextServerProcess = null;
    });

    resolve(nextServerProcess);
  });
}

// ---- Wait for server to be ready (HTTP health check) ----

function waitForServerReady(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + SERVER_STARTUP_TIMEOUT_MS;
    let lastErr = null;
    const check = () => {
      if (Date.now() > deadline) {
        reject(new Error(
          `Server did not become ready within ${SERVER_STARTUP_TIMEOUT_MS}ms.\n` +
          `Last error: ${lastErr || "none"}\n` +
          `Server process ${nextServerProcess ? "still running" : "EXITED"}.\n` +
          `Check log file at: ${getLogPath()}`
        ));
        return;
      }
      const req = http.get(
        { hostname: HOSTNAME, port, path: "/", timeout: 2000 },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 500) {
            res.resume();
            log(`✓ Server ready (HTTP ${res.statusCode})`);
            resolve(true);
          } else {
            res.resume();
            setTimeout(check, HEALTH_CHECK_INTERVAL_MS);
          }
        }
      );
      req.on("error", (err) => {
        lastErr = err.message;
        setTimeout(check, HEALTH_CHECK_INTERVAL_MS);
      });
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
    log("Stopping Next.js server...");
    try {
      nextServerProcess.kill("SIGTERM");
      setTimeout(() => {
        if (nextServerProcess && !nextServerProcess.killed) {
          log("Server didn't exit on SIGTERM, sending SIGKILL");
          nextServerProcess.kill("SIGKILL");
        }
      }, 3000);
    } catch (err) {
      log(`Error killing server: ${err.message}`);
    }
    nextServerProcess = null;
  }
}

// ---- Window creation ----

async function createWindow() {
  initLogging();

  try {
    nextServerPort = await findFreePort(PORT_START, PORT_END);
    await startNextServer(nextServerPort);
    await waitForServerReady(nextServerPort);
    log(`✓ Next.js server ready at http://${HOSTNAME}:${nextServerPort}`);
  } catch (err) {
    log(`✗ FATAL: ${err.message}`);
    const logPath = getLogPath();
    dialog.showErrorBox(
      "صلة — Failed to start",
      `تعذر تشغيل المكون المحلي للتطبيق.\n\n${err.message}\n\n` +
      `تم حفظ سجل الخطأ هنا:\n${logPath}`
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
    title: "صلة سكوب",
    backgroundColor: "#0a0e1a",
    show: false,
  });

  const url = `http://${HOSTNAME}:${nextServerPort}/`;
  log(`Loading URL: ${url}`);
  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.once("ready-to-show", () => {
    log("BrowserWindow ready-to-show");
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (e, code, desc, url) => {
    log(`✗ did-fail-load: code=${code} desc=${desc} url=${url}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("✓ did-finish-load");
  });

  // Open external links (http/https) in the default browser — for OAuth.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      log(`Opening external URL: ${url}`);
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---- IPC Handlers (preserved) ----

ipcMain.handle("platform:info", () => ({
  isElectron: true,
  platform: process.platform,
  versions: process.versions,
  appPath: app.getAppPath(),
  userData: app.getPath("userData"),
  nextServerPort,
  logPath: getLogPath(),
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

// Open log file in default editor (for user-facing error reporting)
ipcMain.handle("app:openLog", async () => {
  const logPath = getLogPath();
  log(`User requested to open log: ${logPath}`);
  shell.openPath(logPath);
  return { success: true, path: logPath };
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

// Single instance lock — prevent 2 instances from fighting over the port.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  log("Another instance is already running — quitting");
  app.quit();
} else {
  app.on("second-instance", () => {
    log("Second instance blocked — focusing existing window");
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Security: prevent navigation to untrusted URLs.
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

// Clean up on exit
app.on("before-quit", () => {
  killNextServer();
  if (logStream) {
    try { logStream.end(); } catch {}
  }
});
process.on("exit", killNextServer);
process.on("SIGTERM", killNextServer);
process.on("SIGINT", killNextServer);
