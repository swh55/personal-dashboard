"use client";

// Web (browser) implementation of PlatformAdapter.
//
// This is the fallback used in plain browsers and during SSR. The adapter
// does NOT import Capacitor or Electron. Most capability methods degrade
// gracefully: URI-scheme actions (`tel:` / `sms:` / `mailto:`) attempt to
// open a system handler, geolocation uses the browser API, notifications use
// the Web Notifications API + setTimeout, filesystem is no-op (browser
// sandbox), preferences fall back to localStorage.

import type { PlatformAdapter } from "./platform-adapter";

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

export class WebAdapter implements PlatformAdapter {
  readonly platform = "web" as const;

  // ----- Phone / SMS (URI schemes — may or may not work on web) -----------

  async makePhoneCall(phone: string): Promise<boolean> {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return false;
    window.location.href = `tel:${cleaned}`;
    return true;
  }

  async sendSMS(phone: string, body: string): Promise<boolean> {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return false;
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

  // ----- Location --------------------------------------------------------

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

  // ----- Camera (file input fallback; no direct camera capture on web) ----

  async takePhoto(): Promise<PhotoResult | null> {
    // On mobile browsers, the `capture` attribute opens the rear camera.
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      (input as any).capture = "environment";
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

  // ----- Haptics (Vibration API if supported) -----------------------------

  private vibrate(pattern: number | number[]): void {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(pattern); } catch {}
    }
  }

  async hapticLight(): Promise<void> { this.vibrate(10); }
  async hapticMedium(): Promise<void> { this.vibrate(20); }
  async hapticHeavy(): Promise<void> { this.vibrate(45); }
  async hapticSuccess(): Promise<void> { this.vibrate([10, 30, 10]); }
  async hapticWarning(): Promise<void> { this.vibrate([30, 30, 30]); }
  async hapticError(): Promise<void> { this.vibrate([60, 30, 60, 30, 60]); }

  // ----- Notifications ---------------------------------------------------

  async requestNotificationPermission(): Promise<boolean> {
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

  async cancelNotification(_id: number): Promise<void> {
    // setTimeout-based notifications can't be cancelled reliably on web.
  }

  // ----- Network ---------------------------------------------------------

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

  // ----- Share -----------------------------------------------------------

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

  // ----- Filesystem (no persistent filesystem on web; backup = download) --

  async writeFile(_filename: string, _content: string): Promise<string | null> {
    return null;
  }

  async readFile(_filename: string): Promise<string | null> {
    return null;
  }

  async listFiles(): Promise<string[]> {
    return [];
  }

  async deleteFile(_filename: string): Promise<boolean> {
    return false;
  }

  async exportBackup(data: any, filename?: string): Promise<string | null> {
    // Trigger a browser download as the only viable "export" on web
    const name = filename || `dashboard-backup-${new Date().toISOString().split("T")[0]}.json`;
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return name;
    } catch {
      return null;
    }
  }

  // ----- Device info ----------------------------------------------------

  async getDeviceInfo(): Promise<DeviceInfo> {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    let platform = "web";
    let osVersion = "unknown";
    let manufacturer = "unknown";
    if (/Windows/.test(ua)) {
      platform = "windows";
      osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || "unknown";
      manufacturer = "Microsoft";
    } else if (/Mac/.test(ua)) {
      platform = "macos";
      osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1].replace(/_/g, ".") || "unknown";
      manufacturer = "Apple";
    } else if (/Android/.test(ua)) {
      platform = "android";
      manufacturer = "Google";
    } else if (/iPhone|iPad/.test(ua)) {
      platform = "ios";
      manufacturer = "Apple";
    } else if (/Linux/.test(ua)) {
      platform = "linux";
    }
    // Best-effort "model": the trailing segment of the UA string in parens
    let model = "Browser";
    const match = ua.match(/\(([^)]+)\)/);
    if (match) model = match[1].split(";")[0] || model;
    return {
      model,
      platform,
      osVersion,
      manufacturer,
      batteryLevel: -1,
      isCharging: false,
      languageCode: typeof navigator !== "undefined" ? navigator.language || "ar" : "ar",
      appId: "",
      appName: "",
      appVersion: "",
    };
  }

  // ----- Motion sensors (DeviceMotion API if available) ------------------

  private motionListener: ((event: DeviceMotionEvent) => void) | null = null;

  async startAccelerometer(callback: (data: SensorData) => void): Promise<void> {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    // iOS 13+ requires explicit permission
    try {
      if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
        const res = await (DeviceMotionEvent as any).requestPermission();
        if (res !== "granted") return;
      }
    } catch {}
    const handler = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity || event.acceleration;
      if (!a || a.x == null) return;
      callback({ x: a.x, y: a.y, z: a.z, timestamp: Date.now() });
    };
    this.motionListener = handler;
    window.addEventListener("devicemotion", handler);
  }

  async stopAccelerometer(): Promise<void> {
    if (this.motionListener) {
      window.removeEventListener("devicemotion", this.motionListener);
      this.motionListener = null;
    }
  }

  // ----- Toast (console log; UI should render its own toast) --------------

  async showToast(message: string, _duration: "short" | "long" = "short"): Promise<void> {
    console.log("[toast]", message);
  }

  // ----- App lifecycle --------------------------------------------------

  onAppStateChange(callback: (isActive: boolean) => void): () => void {
    const handler = () => callback(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }

  async getAppInfo(): Promise<{ name: string; version: string; build: string } | null> {
    return null;
  }

  // ----- Preferences (localStorage fallback) -----------------------------

  async setPref(key: string, value: string): Promise<void> {
    try { localStorage.setItem(key, value); } catch {}
  }

  async getPref(key: string): Promise<string | null> {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async removePref(key: string): Promise<void> {
    try { localStorage.removeItem(key); } catch {}
  }

  // ----- Permissions ----------------------------------------------------

  async requestAllPermissions(): Promise<PermissionStatus[]> {
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
