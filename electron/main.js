const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
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
    title: "لوحة التحكم الشخصية",
    backgroundColor: "#0a0e1a",
    show: false,
  });

  // Load the static export
  const staticPath = path.join(__dirname, "..", "out", "index.html");
  if (fs.existsSync(staticPath)) {
    mainWindow.loadFile(staticPath);
  } else if (isDev) {
    // In dev, try loading from the dev server
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    console.error("Static export not found. Run `bun run build:apk` first.");
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in the default browser
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

// ---- IPC Handlers ----

// Expose platform info to renderer
ipcMain.handle("platform:info", () => ({
  isElectron: true,
  platform: process.platform,
  versions: process.versions,
  appPath: app.getAppPath(),
  userData: app.getPath("userData"),
}));

// File operations (secure — renderer can't access fs directly)
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

// Open URL in default browser
ipcMain.handle("shell:openExternal", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Show a native message box
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: prevent navigation to untrusted URLs
app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    // Allow only relative navigation
    if (!navigationUrl.startsWith("file://") && !navigationUrl.startsWith("http://localhost")) {
      event.preventDefault();
    }
  });
});
