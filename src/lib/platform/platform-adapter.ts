"use client";

// Platform abstraction layer.
//
// This file defines the platform-agnostic `PlatformAdapter` interface that
// every runtime (web / Android-Capacitor / Electron) implements, plus a
// `getPlatformAdapter()` factory that dynamically imports the correct adapter
// implementation based on the current runtime.
//
// The dynamic import is critical: the Capacitor adapter imports 11 Capacitor
// plugins which would CRASH in Electron (Capacitor isn't available there).
// By only loading it when `getPlatform() === "android"`, we keep the bundle
// safe on every platform.

export type Platform = "web" | "android" | "electron";

export interface PlatformAdapter {
  readonly platform: Platform;
  // Phone / SMS
  makePhoneCall(phone: string): Promise<boolean>;
  sendSMS(phone: string, body: string): Promise<boolean>;
  openWhatsApp(phone: string, text?: string): Promise<boolean>;
  sendEmail(to: string, subject?: string, body?: string): Promise<boolean>;
  // Location
  getCurrentLocation(): Promise<{ latitude: number; longitude: number; accuracy: number; altitude: number | null; timestamp: number } | null>;
  // Camera
  takePhoto(): Promise<{ base64: string | null; path: string | null; webPath: string | null } | null>;
  pickImage(): Promise<{ base64: string | null; path: string | null; webPath: string | null } | null>;
  // Haptics
  hapticLight(): Promise<void>;
  hapticMedium(): Promise<void>;
  hapticHeavy(): Promise<void>;
  hapticSuccess(): Promise<void>;
  hapticWarning(): Promise<void>;
  hapticError(): Promise<void>;
  // Notifications
  requestNotificationPermission(): Promise<boolean>;
  scheduleNotification(title: string, body: string, scheduleAt: Date, id?: number): Promise<number | null>;
  cancelNotification(id: number): Promise<void>;
  // Network
  getNetworkStatus(): Promise<{ connected: boolean; connectionType: string }>;
  onNetworkChange(callback: (status: { connected: boolean; connectionType: string }) => void): () => void;
  // Share
  share(title: string, text: string, url?: string): Promise<boolean>;
  // Filesystem
  writeFile(filename: string, content: string): Promise<string | null>;
  readFile(filename: string): Promise<string | null>;
  listFiles(): Promise<string[]>;
  deleteFile(filename: string): Promise<boolean>;
  exportBackup(data: any, filename?: string): Promise<string | null>;
  // Device info
  getDeviceInfo(): Promise<{
    model: string; platform: string; osVersion: string; manufacturer: string;
    batteryLevel: number; isCharging: boolean; languageCode: string;
    appId: string; appName: string; appVersion: string;
  }>;
  // Motion sensors
  startAccelerometer(callback: (data: { x: number; y: number; z: number; timestamp: number }) => void): Promise<void>;
  stopAccelerometer(): Promise<void>;
  // Toast
  showToast(message: string, duration?: "short" | "long"): Promise<void>;
  // App lifecycle
  onAppStateChange(callback: (isActive: boolean) => void): () => void;
  getAppInfo(): Promise<{ name: string; version: string; build: string } | null>;
  // Preferences
  setPref(key: string, value: string): Promise<void>;
  getPref(key: string): Promise<string | null>;
  removePref(key: string): Promise<void>;
  // Permissions
  requestAllPermissions(): Promise<Array<{ name: string; label: string; granted: boolean }>>;
  checkAllPermissions(): Promise<Array<{ name: string; label: string; granted: boolean }>>;
}

/**
 * Detect the current runtime platform.
 *
 * Detection order:
 *  1. SSR / no window → "web"
 *  2. `window.electronAPI?.isElectron` → "electron"  (set by Electron preload script)
 *  3. `window.capacitor?.isNative` or `platform === "android"` → "android"
 *  4. fallback → "web"
 */
export function getPlatform(): Platform {
  if (typeof window === "undefined") return "web";
  if ((window as any).electronAPI?.isElectron) return "electron";
  if ((window as any).capacitor?.isNative === true || (window as any).capacitor?.platform === "android") return "android";
  return "web";
}

let cachedAdapter: PlatformAdapter | null = null;

/**
 * Get the singleton `PlatformAdapter` for the current runtime.
 *
 * The adapter implementation is dynamically imported so that Capacitor
 * plugin code (which crashes on Electron) is only ever loaded when running
 * on Android.
 */
export async function getPlatformAdapter(): Promise<PlatformAdapter> {
  if (cachedAdapter) return cachedAdapter;
  const platform = getPlatform();
  if (platform === "android") {
    const { CapacitorAdapter } = await import("./capacitor-adapter");
    cachedAdapter = new CapacitorAdapter();
  } else if (platform === "electron") {
    const { ElectronAdapter } = await import("./electron-adapter");
    cachedAdapter = new ElectronAdapter();
  } else {
    const { WebAdapter } = await import("./web-adapter");
    cachedAdapter = new WebAdapter();
  }
  return cachedAdapter;
}

// Convenience wrappers for the helper functions used elsewhere in the app.
export function isNative(): boolean {
  return getPlatform() === "android";
}

export function isElectron(): boolean {
  return getPlatform() === "electron";
}

export function isWeb(): boolean {
  return getPlatform() === "web";
}
