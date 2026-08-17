"use client";

// ---------------------------------------------------------------------------
// Backwards-compatible re-export layer.
//
// All native bridge functions now delegate to the platform abstraction layer
// in `src/lib/platform/`. Existing code that imports from
// `@/lib/native/bridge` continues to work without any changes.
//
// The wrappers below call `getPlatformAdapter()` and forward to the
// appropriate adapter (web / android / electron). The adapter is selected at
// runtime via dynamic import — see `src/lib/platform/platform-adapter.ts`.
//
// The original Capacitor plugin imports have been moved to
// `src/lib/platform/capacitor-adapter.ts` so that Capacitor code is only ever
// loaded when running on Android.
// ---------------------------------------------------------------------------

export {
  getPlatformAdapter,
  getPlatform,
  isNative,
  isWeb,
  isElectron,
  type Platform,
  type PlatformAdapter,
} from "@/lib/platform/platform-adapter";

import { getPlatformAdapter, isNative } from "@/lib/platform/platform-adapter";

// ---------------------------------------------------------------------------
// Type aliases (preserved for backwards compatibility — these match the
// inline types declared on `PlatformAdapter` in `platform-adapter.ts`).
// ---------------------------------------------------------------------------

export interface DeviceContact {
  id: string;
  displayName: string;
  phoneNumbers: string[];
  emails: string[];
}

export type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
};

export type PhotoResult = {
  base64: string | null;
  path: string | null;
  webPath: string | null;
};

export type NetworkStatus = {
  connected: boolean;
  connectionType: string;
};

export type DeviceInfo = {
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

export type SensorData = {
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type PermissionStatus = {
  name: string;
  label: string;
  granted: boolean;
};

// ---------------------------------------------------------------------------
// Helper for Capacitor-only extra methods (contacts / location-permission /
// camera-permission). These are NOT part of the `PlatformAdapter` interface
// — only `CapacitorAdapter` implements them. On web/electron we short-circuit
// to the appropriate default.
// ---------------------------------------------------------------------------

async function callNativeOnly<T>(
  methodName: string,
  fallback: T
): Promise<T> {
  if (!isNative()) return fallback;
  const adapter = (await getPlatformAdapter()) as any;
  if (typeof adapter[methodName] !== "function") return fallback;
  return adapter[methodName]();
}

// ---------------------------------------------------------------------------
// Phone calls & SMS (via URI schemes)
// ---------------------------------------------------------------------------

export async function makePhoneCall(phone: string): Promise<boolean> {
  return (await getPlatformAdapter()).makePhoneCall(phone);
}

export async function sendSMS(phone: string, body: string): Promise<boolean> {
  return (await getPlatformAdapter()).sendSMS(phone, body);
}

export async function openWhatsApp(phone: string, text?: string): Promise<boolean> {
  return (await getPlatformAdapter()).openWhatsApp(phone, text);
}

export async function sendEmail(to: string, subject?: string, body?: string): Promise<boolean> {
  return (await getPlatformAdapter()).sendEmail(to, subject, body);
}

// ---------------------------------------------------------------------------
// Contacts sync (Capacitor-only)
// ---------------------------------------------------------------------------

export async function requestContactsPermission(): Promise<boolean> {
  return callNativeOnly<boolean>("requestContactsPermission", false);
}

export async function checkContactsPermission(): Promise<boolean> {
  return callNativeOnly<boolean>("checkContactsPermission", false);
}

export async function getDeviceContacts(): Promise<DeviceContact[]> {
  return callNativeOnly<DeviceContact[]>("getDeviceContacts", []);
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

export async function requestLocationPermission(): Promise<boolean> {
  return callNativeOnly<boolean>("requestLocationPermission", false);
}

export async function getCurrentLocation(): Promise<LocationData | null> {
  return (await getPlatformAdapter()).getCurrentLocation();
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export async function requestCameraPermission(): Promise<boolean> {
  return callNativeOnly<boolean>("requestCameraPermission", false);
}

export async function takePhoto(): Promise<PhotoResult | null> {
  return (await getPlatformAdapter()).takePhoto();
}

export async function pickImage(): Promise<PhotoResult | null> {
  return (await getPlatformAdapter()).pickImage();
}

// ---------------------------------------------------------------------------
// Haptics
// ---------------------------------------------------------------------------

export async function hapticLight(): Promise<void> {
  return (await getPlatformAdapter()).hapticLight();
}
export async function hapticMedium(): Promise<void> {
  return (await getPlatformAdapter()).hapticMedium();
}
export async function hapticHeavy(): Promise<void> {
  return (await getPlatformAdapter()).hapticHeavy();
}
export async function hapticSuccess(): Promise<void> {
  return (await getPlatformAdapter()).hapticSuccess();
}
export async function hapticWarning(): Promise<void> {
  return (await getPlatformAdapter()).hapticWarning();
}
export async function hapticError(): Promise<void> {
  return (await getPlatformAdapter()).hapticError();
}

// ---------------------------------------------------------------------------
// Local Notifications
// ---------------------------------------------------------------------------

export async function requestNotificationPermission(): Promise<boolean> {
  return (await getPlatformAdapter()).requestNotificationPermission();
}

export async function scheduleNotification(
  title: string,
  body: string,
  scheduleAt: Date,
  id?: number
): Promise<number | null> {
  return (await getPlatformAdapter()).scheduleNotification(title, body, scheduleAt, id);
}

export async function cancelNotification(id: number): Promise<void> {
  return (await getPlatformAdapter()).cancelNotification(id);
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export async function getNetworkStatus(): Promise<NetworkStatus> {
  return (await getPlatformAdapter()).getNetworkStatus();
}

export function onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  getPlatformAdapter().then((adapter) => {
    if (cancelled) return;
    unsub = adapter.onNetworkChange(callback);
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

export async function share(title: string, text: string, url?: string): Promise<boolean> {
  return (await getPlatformAdapter()).share(title, text, url);
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

export async function writeFile(filename: string, content: string): Promise<string | null> {
  return (await getPlatformAdapter()).writeFile(filename, content);
}

export async function readFile(filename: string): Promise<string | null> {
  return (await getPlatformAdapter()).readFile(filename);
}

export async function listFiles(): Promise<string[]> {
  return (await getPlatformAdapter()).listFiles();
}

export async function deleteFile(filename: string): Promise<boolean> {
  return (await getPlatformAdapter()).deleteFile(filename);
}

export async function exportBackup(data: any, filename?: string): Promise<string | null> {
  return (await getPlatformAdapter()).exportBackup(data, filename);
}

// ---------------------------------------------------------------------------
// Device info
// ---------------------------------------------------------------------------

export async function getDeviceInfo(): Promise<DeviceInfo> {
  return (await getPlatformAdapter()).getDeviceInfo();
}

// ---------------------------------------------------------------------------
// Motion sensors
// ---------------------------------------------------------------------------

export async function startAccelerometer(callback: (data: SensorData) => void): Promise<void> {
  return (await getPlatformAdapter()).startAccelerometer(callback);
}

export async function stopAccelerometer(): Promise<void> {
  return (await getPlatformAdapter()).stopAccelerometer();
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export async function showToast(
  message: string,
  duration: "short" | "long" = "short"
): Promise<void> {
  return (await getPlatformAdapter()).showToast(message, duration);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

export function onAppStateChange(callback: (isActive: boolean) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  getPlatformAdapter().then((adapter) => {
    if (cancelled) return;
    unsub = adapter.onAppStateChange(callback);
  });
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export async function getAppInfo(): Promise<{ name: string; version: string; build: string } | null> {
  return (await getPlatformAdapter()).getAppInfo();
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export async function setPref(key: string, value: string): Promise<void> {
  return (await getPlatformAdapter()).setPref(key, value);
}

export async function getPref(key: string): Promise<string | null> {
  return (await getPlatformAdapter()).getPref(key);
}

export async function removePref(key: string): Promise<void> {
  return (await getPlatformAdapter()).removePref(key);
}

// ---------------------------------------------------------------------------
// Permissions manager
// ---------------------------------------------------------------------------

export async function requestAllPermissions(): Promise<PermissionStatus[]> {
  return (await getPlatformAdapter()).requestAllPermissions();
}

export async function checkAllPermissions(): Promise<PermissionStatus[]> {
  return (await getPlatformAdapter()).checkAllPermissions();
}
