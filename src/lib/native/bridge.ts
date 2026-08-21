// =============================================================================
// Web-only bridge — provides browser fallbacks for all native functions.
// =============================================================================
//
// This file replaces the previous Capacitor/Electron native bridge with
// pure web implementations. When the app runs in a browser:
//   - isNative() returns false → all native-only UI is hidden
//   - makePhoneCall() → opens tel: link
//   - getCurrentLocation() → uses navigator.geolocation
//   - haptics → no-op
//   - Notifications → Web Notification API
//
// This keeps the component code unchanged — native features gracefully
// degrade to web equivalents.

// ---- Types (preserved for compatibility) ----

export interface DeviceContact {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

export interface PhotoResult {
  base64: string | null;
  path: string | null;
  webPath: string | null;
}

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export interface DeviceInfo {
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
}

export interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface PermissionStatus {
  granted: boolean;
}

// ---- Platform detection ----

export type Platform = "web" | "android" | "electron";

export function getPlatform(): Platform {
  return "web";
}

export function isNative(): boolean {
  return false;
}

export function isWeb(): boolean {
  return true;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronAPI;
}

// ---- Phone / SMS ----

export async function makePhoneCall(phone: string): Promise<boolean> {
  if (typeof window !== "undefined") {
    window.open(`tel:${phone}`, "_self");
    return true;
  }
  return false;
}

export async function sendSMS(phone: string, body?: string): Promise<boolean> {
  if (typeof window !== "undefined") {
    const url = body ? `sms:${phone}?body=${encodeURIComponent(body)}` : `sms:${phone}`;
    window.open(url, "_self");
    return true;
  }
  return false;
}

export async function openWhatsApp(phone: string, text?: string): Promise<boolean> {
  if (typeof window !== "undefined") {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const url = text
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${cleanPhone}`;
    window.open(url, "_blank");
    return true;
  }
  return false;
}

export async function sendEmail(to: string, subject?: string, body?: string): Promise<boolean> {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    const qs = params.toString();
    window.open(`mailto:${to}${qs ? "?" + qs : ""}`, "_self");
    return true;
  }
  return false;
}

// ---- Location ----

export async function getCurrentLocation(): Promise<LocationData | null> {
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
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ---- Camera ----

export async function takePhoto(): Promise<PhotoResult | null> {
  return null; // Web uses <input type="file"> in ImageUpload component
}

export async function pickImage(): Promise<PhotoResult | null> {
  return null;
}

// ---- Haptics (no-op on web) ----

export async function hapticLight(): Promise<void> {}
export async function hapticMedium(): Promise<void> {}
export async function hapticHeavy(): Promise<void> {}
export async function hapticSuccess(): Promise<void> {}
export async function hapticWarning(): Promise<void> {}
export async function hapticError(): Promise<void> {}

// ---- Notifications ----

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function scheduleNotification(
  title: string,
  body: string,
  _scheduleAt: Date,
  _id?: number
): Promise<number | null> {
  // Web: use setTimeout as a simple fallback
  if (typeof Notification === "undefined") return null;
  const delay = Math.max(0, _scheduleAt.getTime() - Date.now());
  setTimeout(() => {
    try {
      new Notification(title, { body });
    } catch {}
  }, delay);
  return Date.now();
}

export async function cancelNotification(_id: number): Promise<void> {}

// ---- Network ----

export async function getNetworkStatus(): Promise<NetworkStatus> {
  return {
    connected: typeof navigator !== "undefined" ? navigator.onLine : true,
    connectionType: "wifi",
  };
}

export function onNetworkChange(
  callback: (status: NetworkStatus) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    callback({
      connected: navigator.onLine,
      connectionType: "wifi",
    });
  };
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}

// ---- Share ----

export async function share(title: string, text: string, url?: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }
  // Fallback: copy to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url ? `${title}\n${text}\n${url}` : `${title}\n${text}`);
      return true;
    } catch {}
  }
  return false;
}

// ---- Filesystem (localStorage-based) ----

export async function writeFile(filename: string, content: string): Promise<string | null> {
  try {
    localStorage.setItem(`file:${filename}`, content);
    return filename;
  } catch {
    return null;
  }
}

export async function readFile(filename: string): Promise<string | null> {
  try {
    return localStorage.getItem(`file:${filename}`);
  } catch {
    return null;
  }
}

export async function listFiles(): Promise<string[]> {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith("file:"))
      .map((k) => k.slice(5));
  } catch {
    return [];
  }
}

export async function deleteFile(filename: string): Promise<boolean> {
  try {
    localStorage.removeItem(`file:${filename}`);
    return true;
  } catch {
    return false;
  }
}

export async function exportBackup(data: any, filename?: string): Promise<string | null> {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "backup.json";
    a.click();
    URL.revokeObjectURL(url);
    return filename || "backup.json";
  } catch {
    return null;
  }
}

// ---- Device info ----

export async function getDeviceInfo(): Promise<DeviceInfo> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return {
    model: ua,
    platform: "web",
    osVersion: "unknown",
    manufacturer: "browser",
    batteryLevel: 1,
    isCharging: true,
    languageCode: typeof navigator !== "undefined" ? navigator.language : "en",
    appId: "web",
    appName: "Silah",
    appVersion: "1.0.0",
  };
}

// ---- Motion sensors (no-op on web) ----

export async function startAccelerometer(
  _callback: (data: SensorData) => void
): Promise<void> {}

export async function stopAccelerometer(): Promise<void> {}

// ---- Toast ----

export async function showToast(message: string, duration?: "short" | "long"): Promise<void> {
  console.log(`[toast] ${message}`);
}

// ---- Device contacts (empty on web) ----

export async function getDeviceContacts(): Promise<DeviceContact[]> {
  return [];
}

export async function requestContactsPermission(): Promise<boolean> {
  return false;
}

export async function checkContactsPermission(): Promise<boolean> {
  return false;
}

export async function requestLocationPermission(): Promise<boolean> {
  return true; // Web geolocation API handles its own permission
}

export async function requestCameraPermission(): Promise<boolean> {
  return false;
}

// ---- Permission aggregation (web-only: all return false/not-granted) ----

export async function requestAllPermissions(): Promise<Record<string, PermissionStatus>> {
  return {
    contacts: { granted: false },
    location: { granted: true },
    camera: { granted: false },
    notifications: { granted: false },
  };
}

export async function checkAllPermissions(): Promise<Record<string, PermissionStatus>> {
  return {
    contacts: { granted: false },
    location: { granted: true },
    camera: { granted: false },
    notifications: { granted: false },
  };
}
