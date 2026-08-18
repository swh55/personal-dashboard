"use client";

// Electron implementation of PlatformAdapter.
//
// This adapter does NOT import Capacitor or Electron — it talks to the
// main process via the `window.electronAPI` IPC bridge, which the preload
// script (Phase 5) will expose. When `window.electronAPI` isn't ready yet,
// every method falls back gracefully to web-style behavior.
//
// Key differences from the Capacitor adapter:
//  • `writeFile` / `readFile` / `listFiles` / `deleteFile` → IPC to main
//  • `getDeviceInfo` → IPC to main (parses UA as fallback)
//  • `getAppInfo` → IPC to main
//  • `setPref` / `getPref` / `removePref` → IPC to main (localStorage fallback)
//  • `scheduleNotification` → uses Browser Notification API + setTimeout
//  • `haptic*` → no-op (desktop has no haptic motor)
//  • `startAccelerometer` / `stopAccelerometer` → no-op (desktop has no accelerometer)
//  • `makePhoneCall` / `sendSMS` → open `tel:` / `sms:` URI scheme
//  • `takePhoto` → no-op; `pickImage` → native file input dialog

import type { PlatformAdapter } from "./platform-adapter";

/**
 * Shape of the IPC bridge exposed by the Electron preload script.
 * Every field is optional so the renderer can detect what's available.
 */
interface ElectronAPI {
  isElectron: true;
  fs?: {
    writeFile: (filename: string, content: string) => Promise<string | null>;
    readFile: (filename: string) => Promise<string | null>;
    listFiles: () => Promise<string[]>;
    deleteFile: (filename: string) => Promise<boolean>;
    showSaveDialog: (filename: string, content: string) => Promise<string | null>;
  };
  device?: {
    getInfo: () => Promise<{
      model: string;
      platform: string;
      osVersion: string;
      manufacturer: string;
      batteryLevel: number;
      isCharging: boolean;
      languageCode: string;
      appId: string;
      appName: string;
      appVersion: string;
    }>;
  };
  app?: {
    getInfo: () => Promise<{ name: string; version: string; build: string }>;
    onWindowStateChange: (cb: (state: string) => void) => () => void;
  };
  notifications?: {
    requestPermission: () => Promise<boolean>;
    schedule: (title: string, body: string, scheduleAt: number, id?: number) => Promise<number | null>;
    cancel: (id: number) => Promise<void>;
  };
  preferences?: {
    set: (key: string, value: string) => Promise<void>;
    get: (key: string) => Promise<string | null>;
    remove: (key: string) => Promise<void>;
  };
}

function electronAPI(): ElectronAPI | null {
  if (typeof window === "undefined") return null;
  return ((window as any).electronAPI as ElectronAPI | undefined) ?? null;
}

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
};
type PhotoResult = { base64: string | null; path: string | null; webPath: string | null };
type NetworkStatus = { connected: boolean; connectionType: string };
type DeviceInfo = {
  model: string;
  platform: string;
  osVersion: string;
  manufacturer: string;
  batteryLevel: number;
  isCharging: boolean;
  languageCode: string;
  appId: string;
  appName: string;
  appVersion: string;
};
type SensorData = { x: number; y: number; z: number; timestamp: number };
type PermissionStatus = { name: string; label: string; granted: boolean };

export class ElectronAdapter implements PlatformAdapter {
  readonly platform = "electron" as const;

  // ----- Phone / SMS (desktop fallback via URI schemes) --------------------

  async makePhoneCall(phone: string): Promise<boolean> {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return false;
    // Most desktops can't dial, but we still try the URI scheme (e.g.
    // FaceTime on macOS or Skype/Zoom with registered handlers).
    window.location.href = `tel:${cleaned}`;
    return true;
  }

  async sendSMS(phone: string, body: string): Promise<boolean> {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return false;
    // Desktops rarely handle `sms:` but the scheme exists.
    window.location.href = `sms:${cleaned}?body=${encodeURIComponent(body)}`;
    return true;
  }

  async openWhatsApp(phone: string, text?: string): Promise<boolean> {
    const cleaned = phone.replace(/[^\d]/g, "");
    if (!cleaned) return false;
    const url = text
      ? `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${cleaned}`;
    window.open(url, "_blank");
    return true;
  }

  async sendEmail(to: string, subject?: string, body?: string): Promise<boolean> {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    const url = `mailto:${to}${params.toString() ? "?" + params.toString() : ""}`;
    window.location.href = url;
    return true;
  }

  // ----- Location (web geolocation API) ------------------------------------

  async getCurrentLocation(): Promise<LocationData | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  // ----- Camera (desktop has no camera capture; image picker via file dialog) ----

  async takePhoto(): Promise<PhotoResult | null> {
    // Webcam capture is not part of the desktop dashboard UX.
    return null;
  }

  async pickImage(): Promise<PhotoResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve({ base64, path: null, webPath: null });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  // ----- Haptics (no-op on desktop) ----------------------------------------

  async hapticLight(): Promise<void> {}
  async hapticMedium(): Promise<void> {}
  async hapticHeavy(): Promise<void> {}
  async hapticSuccess(): Promise<void> {}
  async hapticWarning(): Promise<void> {}
  async hapticError(): Promise<void> {}

  // ----- Notifications ----------------------------------------------------

  async requestNotificationPermission(): Promise<boolean> {
    const api = electronAPI();
    if (api?.notifications?.requestPermission) {
      try { return await api.notifications.requestPermission(); } catch { return false; }
    }
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }

  async scheduleNotification(
    title: string,
    body: string,
    scheduleAt: Date,
    id?: number
  ): Promise<number | null> {
    const api = electronAPI();
    if (api?.notifications?.schedule) {
      try {
        return await api.notifications.schedule(title, body, scheduleAt.getTime(), id);
      } catch {
        return null;
      }
    }
    // Fallback: Web Notification API + setTimeout
    if (typeof Notification === "undefined") return null;
    const delay = scheduleAt.getTime() - Date.now();
    if (delay <= 0) {
      try { new Notification(title, { body }); } catch {}
      return id ?? Date.now();
    }
    const notifId = id ?? Date.now();
    setTimeout(() => {
      try { new Notification(title, { body }); } catch {}
    }, delay);
    return notifId;
  }

  async cancelNotification(id: number): Promise<void> {
    const api = electronAPI();
    if (api?.notifications?.cancel) {
      try { await api.notifications.cancel(id); } catch {}
    }
    // Web fallback: setTimeout-based notifications can't be cancelled
    // reliably without tracking timers. Best-effort no-op.
  }

  // ----- Network -----------------------------------------------------------

  async getNetworkStatus(): Promise<NetworkStatus> {
    if (typeof navigator === "undefined") return { connected: false, connectionType: "unknown" };
    const connected = navigator.onLine;
    const conn = (navigator as any).connection;
    const connectionType = conn?.effectiveType || (connected ? "wifi" : "none");
    return { connected, connectionType };
  }

  onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
    const handler = () => {
      const connected = navigator.onLine;
      const conn = (navigator as any).connection;
      const connectionType = conn?.effectiveType || (connected ? "wifi" : "none");
      callback({ connected, connectionType });
    };
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }

  // ----- Share (Web Share API if available, else clipboard) ----------------

  async share(title: string, text: string, url?: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch {
        return false;
      }
    }
    try {
      const payload = url ? `${title}\n${text}\n${url}` : `${title}\n${text}`;
      await navigator.clipboard.writeText(payload);
      return true;
    } catch {
      return false;
    }
  }

  // ----- Filesystem (via electronAPI.fs IPC) ------------------------------

  async writeFile(filename: string, content: string): Promise<string | null> {
    const api = electronAPI();
    if (api?.fs?.writeFile) {
      try { return await api.fs.writeFile(filename, content); } catch { return null; }
    }
    return null;
  }

  async readFile(filename: string): Promise<string | null> {
    const api = electronAPI();
    if (api?.fs?.readFile) {
      try { return await api.fs.readFile(filename); } catch { return null; }
    }
    return null;
  }

  async listFiles(): Promise<string[]> {
    const api = electronAPI();
    if (api?.fs?.listFiles) {
      try { return await api.fs.listFiles(); } catch { return []; }
    }
    return [];
  }

  async deleteFile(filename: string): Promise<boolean> {
    const api = electronAPI();
    if (api?.fs?.deleteFile) {
      try { return await api.fs.deleteFile(filename); } catch { return false; }
    }
    return false;
  }

  async exportBackup(data: any, filename?: string): Promise<string | null> {
    const name = filename || `dashboard-backup-${new Date().toISOString().split("T")[0]}.json`;
    const api = electronAPI();
    if (api?.fs?.showSaveDialog) {
      try { return await api.fs.showSaveDialog(name, JSON.stringify(data, null, 2)); } catch { return null; }
    }
    return this.writeFile(name, JSON.stringify(data, null, 2));
  }

  // ----- Device info ------------------------------------------------------

  async getDeviceInfo(): Promise<DeviceInfo> {
    const api = electronAPI();
    if (api?.device?.getInfo) {
      try { return await api.device.getInfo(); } catch {}
    }
    // Web fallback: parse UA for OS hints
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    let platform = "electron";
    let osVersion = "unknown";
    if (/Windows/.test(ua)) {
      platform = "windows";
      osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || "unknown";
    } else if (/Mac/.test(ua)) {
      platform = "macos";
      osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1].replace(/_/g, ".") || "unknown";
    } else if (/Linux/.test(ua)) {
      platform = "linux";
    }
    return {
      model: "Desktop",
      platform,
      osVersion,
      manufacturer: "unknown",
      batteryLevel: -1,
      isCharging: false,
      languageCode: typeof navigator !== "undefined" ? navigator.language || "ar" : "ar",
      appId: "",
      appName: "",
      appVersion: "",
    };
  }

  // ----- Motion sensors (no-op on desktop) --------------------------------

  async startAccelerometer(_callback: (data: SensorData) => void): Promise<void> {}
  async stopAccelerometer(): Promise<void> {}

  // ----- Toast (log to console; UI can render its own toast) --------------

  async showToast(message: string, _duration: "short" | "long" = "short"): Promise<void> {
    console.log("[toast]", message);
  }

  // ----- App lifecycle ----------------------------------------------------

  onAppStateChange(callback: (isActive: boolean) => void): () => void {
    const api = electronAPI();
    if (api?.app?.onWindowStateChange) {
      // Map electron window-state to isActive (false when minimized/hidden)
      return api.app.onWindowStateChange((state: string) => {
        callback(state !== "minimized" && state !== "hidden");
      });
    }
    // Fallback: use document visibility
    const handler = () => callback(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }

  async getAppInfo(): Promise<{ name: string; version: string; build: string } | null> {
    const api = electronAPI();
    if (api?.app?.getInfo) {
      try { return await api.app.getInfo(); } catch { return null; }
    }
    return null;
  }

  // ----- Preferences (via electronAPI.preferences IPC; localStorage fallback) ----

  async setPref(key: string, value: string): Promise<void> {
    const api = electronAPI();
    if (api?.preferences?.set) {
      try { await api.preferences.set(key, value); } catch {}
      return;
    }
    try { localStorage.setItem(key, value); } catch {}
  }

  async getPref(key: string): Promise<string | null> {
    const api = electronAPI();
    if (api?.preferences?.get) {
      try { return await api.preferences.get(key); } catch { return null; }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async removePref(key: string): Promise<void> {
    const api = electronAPI();
    if (api?.preferences?.remove) {
      try { await api.preferences.remove(key); } catch {}
      return;
    }
    try { localStorage.removeItem(key); } catch {}
  }

  // ----- Permissions -----------------------------------------------------

  async requestAllPermissions(): Promise<PermissionStatus[]> {
    // Desktop OS prompts for camera/location/contacts at use time, not at
    // startup. Report what we actually have.
    return [
      { name: "camera", label: "الكاميرا", granted: false },
      { name: "location", label: "الموقع", granted: true },
      { name: "contacts", label: "جهات الاتصال", granted: false },
      { name: "notifications", label: "الإشعارات", granted: await this.requestNotificationPermission() },
    ];
  }

  async checkAllPermissions(): Promise<PermissionStatus[]> {
    return [
      { name: "camera", label: "الكاميرا", granted: false },
      { name: "location", label: "الموقع", granted: true },
      { name: "contacts", label: "جهات الاتصال", granted: false },
      {
        name: "notifications",
        label: "الإشعارات",
        granted:
          typeof Notification !== "undefined" && Notification.permission === "granted",
      },
    ];
  }
}
