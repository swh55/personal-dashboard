// =============================================================================
// Electron Main Process — loads the production web app directly.
// =============================================================================
//
// Architecture (Phase 3 — secure production):
//
//   Electron Main
//        ↓
//   BrowserWindow.loadURL(https://personal-dashboard-mu-lyart.vercel.app/)
//        ↓
//   Vercel handles: Next.js + API routes + NextAuth + Prisma + Neon
//
// Why NOT spawn a local server?
//   The repo is PUBLIC. Baking DATABASE_URL, GOOGLE_CLIENT_SECRET, etc. into
//   the EXE would expose them to anyone who downloads it. Instead, the
//   desktop app is a thin wrapper around the production Vercel deployment.
//
// Benefits:
//   - No secrets in the EXE (security)
//   - No Node.js server to crash (reliability)
//   - Always up-to-date with the latest web version
//   - Smaller EXE (~5MB instead of ~290MB)
//
// Offline: not supported in this mode. For offline use, the Android APK
// has a full offline-first local mode via the fetch interceptor.

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

// The production URL — all API routes, auth, database live here.
const PRODUCTION_URL =
  process.env.NEXT_PUBLIC_PRODUCTION_URL ||
  "https://personal-dashboard-mu-lyart.vercel.app";

let mainWindow = null;

// ---- Logging ----

function getLogPath() {
  const dir = path.join(app.getPath("userData"), "logs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "electron-main.log");
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const logPath = getLogPath();
    fs.appendFileSync(logPath, line + "\n", "utf8");
  } catch {}
}

// ---- Window creation ----

function createWindow() {
  log(`=== Silah Electron started at ${new Date().toISOString()} ===`);
  log(`isDev: ${isDev}, platform: ${process.platform}`);
  log(`Production URL: ${PRODUCTION_URL}`);

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

  // Load the production web app directly
  if (isDev) {
    // In dev, try the local dev server first
    log("Dev mode: loading http://localhost:3000");
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    log(`Production mode: loading ${PRODUCTION_URL}`);
    mainWindow.loadURL(PRODUCTION_URL);
  }

  mainWindow.once("ready-to-show", () => {
    log("BrowserWindow ready-to-show");
    mainWindow.show();
  });

  mainWindow.webContents.on("did-fail-load", (e, code, desc, url) => {
    log(`✗ did-fail-load: code=${code} desc=${desc} url=${url}`);
    dialog.showErrorBox(
      "صلة — Connection Error",
      `تعذر الاتصال بالخادم.\n\n${desc}\n\nتحقق من اتصالك بالإنترنت وأعد المحاولة.`
    );
  });

  mainWindow.webContents.on("did-finish-load", () => {
    log("✓ did-finish-load");
  });

  // Open external links (http/https) in the default browser — for OAuth.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      // Don't open the production URL in external browser — keep it in-app
      if (url.startsWith(PRODUCTION_URL)) {
        return { action: "allow" };
      }
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

// ---- IPC Handlers (preserved for filesystem + platform info) ----

ipcMain.handle("platform:info", () => ({
  isElectron: true,
  platform: process.platform,
  versions: process.versions,
  appPath: app.getAppPath(),
  userData: app.getPath("userData"),
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

ipcMain.handle("app:openLog", async () => {
  const logPath = getLogPath();
  log(`User requested to open log: ${logPath}`);
  shell.openPath(logPath);
  return { success: true, path: logPath };
});

// ---- App lifecycle ----

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Single instance lock
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

// Security: allow navigation to the production URL + its subdomains
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    // Allow: production URL + localhost (dev) + file:// (assets)
    if (
      !navigationUrl.startsWith(PRODUCTION_URL) &&
      !navigationUrl.startsWith("http://localhost") &&
      !navigationUrl.startsWith("file://")
    ) {
      event.preventDefault();
    }
  });
});
