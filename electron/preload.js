const { contextBridge, ipcRenderer } = require("electron");

// Secure preload — exposes only specific IPC channels to the renderer.
// contextIsolation is enabled, so this runs in an isolated context.
contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  isElectron: true,
  platform: process.platform,

  // Filesystem (delegated to main process)
  fs: {
    writeFile: (filename, content) => ipcRenderer.invoke("fs:writeFile", filename, content),
    readFile: (filename) => ipcRenderer.invoke("fs:readFile", filename),
    listFiles: () => ipcRenderer.invoke("fs:listFiles"),
    deleteFile: (filename) => ipcRenderer.invoke("fs:deleteFile", filename),
    saveDialog: ({ filename, content }) => ipcRenderer.invoke("fs:saveDialog", { filename, content }),
  },

  // Shell (open URLs in browser)
  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  },

  // Dialogs
  dialog: {
    showMessage: ({ title, message }) => ipcRenderer.invoke("dialog:showMessage", { title, message }),
  },

  // Device info (basic — from process)
  device: {
    getPlatform: () => process.platform,
    getVersions: () => process.versions,
    getAppPath: () => process.env.ELECTRON_APP_PATH || "",
  },

  // Notifications (use Electron's Notification API via main process)
  notifications: {
    show: (title, body) => ipcRenderer.invoke("notification:show", { title, body }),
    requestPermission: () => Promise.resolve(true),
  },

  // App lifecycle
  app: {
    getInfo: () => ipcRenderer.invoke("app:getInfo"),
    quit: () => ipcRenderer.invoke("app:quit"),
  },
});
