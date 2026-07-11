"use client";

// Native bridge service for Android integration via Capacitor.
// All functions are safe to call in a browser (they no-op or fall back
// gracefully). In the APK, they use real Capacitor plugins.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Device } from "@capacitor/device";
import { Geolocation } from "@capacitor/geolocation";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { Toast } from "@capacitor/toast";
import { Motion } from "@capacitor/motion";
import { Contacts } from "@capacitor-community/contacts";

/** Whether we are running inside a native Android/iOS shell. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Whether we are running in a regular browser. */
export function isWeb(): boolean {
  return Capacitor.getPlatform() === "web";
}

// ---------------------------------------------------------------------------
// Phone calls & SMS (via URI schemes — works on Android without plugins)
// ---------------------------------------------------------------------------

/** Initiate a real phone call via the `tel:` URI scheme. */
export async function makePhoneCall(phone: string): Promise<boolean> {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return false;
  if (isNative()) {
    // On Android, `tel:` opens the dialer (doesn't require CALL_PHONE permission
    // unless you want to auto-dial without user confirmation).
    window.location.href = `tel:${cleaned}`;
    return true;
  }
  // Web fallback — open dialer link
  window.location.href = `tel:${cleaned}`;
  return true;
}

/** Open the SMS app pre-filled with a message. */
export async function sendSMS(phone: string, body: string): Promise<boolean> {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return false;
  const url = `sms:${cleaned}?body=${encodeURIComponent(body)}`;
  window.location.href = url;
  return true;
}

/** Open WhatsApp with a specific number. */
export async function openWhatsApp(phone: string, text?: string): Promise<boolean> {
  const cleaned = phone.replace(/[^\d]/g, "");
  if (!cleaned) return false;
  const url = text
    ? `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${cleaned}`;
  if (isNative()) {
    window.location.href = url;
  } else {
    window.open(url, "_blank");
  }
  return true;
}

/** Send an email via the device's mail app. */
export async function sendEmail(to: string, subject?: string, body?: string): Promise<boolean> {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const url = `mailto:${to}${params.toString() ? "?" + params.toString() : ""}`;
  window.location.href = url;
  return true;
}

// ---------------------------------------------------------------------------
// Contacts sync
// ---------------------------------------------------------------------------

export interface DeviceContact {
  id: string;
  displayName: string;
  phoneNumbers: string[];
  emails: string[];
}

/** Request permission to read contacts. */
export async function requestContactsPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await Contacts.requestPermissions();
    return result.contacts === "granted";
  } catch {
    return false;
  }
}

/** Check if contacts permission is granted. */
export async function checkContactsPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await Contacts.checkPermissions();
    return result.contacts === "granted";
  } catch {
    return false;
  }
}

/** Read all contacts from the device. */
export async function getDeviceContacts(): Promise<DeviceContact[]> {
  if (!isNative()) return [];
  try {
    const granted = await checkContactsPermission();
    if (!granted) {
      const ok = await requestContactsPermission();
      if (!ok) return [];
    }
    const result = await Contacts.getContacts({
      projection: {
        name: true,
        phones: true,
        emails: true,
      },
    });
    return (result.contacts || []).map((c: any) => ({
      id: c.contactId,
      displayName: c.name?.display || c.name?.middle || "بدون اسم",
      phoneNumbers: (c.phones || []).map((p: any) => p.number),
      emails: (c.emails || []).map((e: any) => e.address),
    }));
  } catch (err) {
    console.error("[native] getDeviceContacts error:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

/** Request location permission. */
export async function requestLocationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const status = await Geolocation.requestPermissions();
    return status.location === "granted";
  } catch {
    return false;
  }
}

/** Get current GPS location. */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: pos.coords.altitude,
      timestamp: pos.timestamp,
    };
  } catch (err) {
    console.error("[native] getCurrentLocation error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface PhotoResult {
  base64: string | null;
  path: string | null;
  webPath: string | null;
}

/** Request camera permission. */
export async function requestCameraPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const status = await Camera.requestPermissions();
    return status.camera === "granted";
  } catch {
    return false;
  }
}

/** Take a photo with the device camera. */
export async function takePhoto(): Promise<PhotoResult | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });
    return {
      base64: photo.base64String || null,
      path: photo.path || null,
      webPath: photo.webPath || null,
    };
  } catch (err) {
    console.error("[native] takePhoto error:", err);
    return null;
  }
}

/** Pick an image from the gallery. */
export async function pickImage(): Promise<PhotoResult | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });
    return {
      base64: photo.base64String || null,
      path: photo.path || null,
      webPath: photo.webPath || null,
    };
  } catch (err) {
    console.error("[native] pickImage error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Haptics (vibration)
// ---------------------------------------------------------------------------

/** Vibrate the device with a light impact. */
export async function hapticLight(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

/** Vibrate the device with a medium impact. */
export async function hapticMedium(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

/** Vibrate the device with a heavy impact. */
export async function hapticHeavy(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {}
}

/** Vibrate with a success pattern. */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

/** Vibrate with a warning pattern. */
export async function hapticWarning(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {}
}

/** Vibrate with an error pattern. */
export async function hapticError(): Promise<void> {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

// ---------------------------------------------------------------------------
// Local Notifications
// ---------------------------------------------------------------------------

/** Request notification permission. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

/** Schedule a local notification. */
export async function scheduleNotification(
  title: string,
  body: string,
  scheduleAt: Date,
  id?: number
): Promise<number | null> {
  if (!isNative()) return null;
  try {
    const pending = await LocalNotifications.getPending();
    const notifId = id || pending.notifications.length + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: notifId,
          title,
          body,
          schedule: { at: scheduleAt },
        },
      ],
    });
    return notifId;
  } catch (err) {
    console.error("[native] scheduleNotification error:", err);
    return null;
  }
}

/** Cancel a scheduled notification. */
export async function cancelNotification(id: number): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch {}
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

/** Get current network status. */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  try {
    const status = await Network.getStatus();
    return { connected: status.connected, connectionType: status.connectionType };
  } catch {
    return { connected: false, connectionType: "unknown" };
  }
}

/** Listen for network status changes. */
export function onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
  let handle: any;
  Network.addListener("networkStatusChange", (status) => {
    callback({ connected: status.connected, connectionType: status.connectionType });
  }).then((h) => { handle = h; });
  return () => { if (handle) handle.remove(); };
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

/** Share text/URL via the device's share sheet. */
export async function share(title: string, text: string, url?: string): Promise<boolean> {
  try {
    await Share.share({
      title,
      text,
      url,
      dialogTitle: title,
    });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Filesystem
// ---------------------------------------------------------------------------

/** Write a text file to the device's Documents directory. */
export async function writeFile(filename: string, content: string): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const result = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return result.uri;
  } catch (err) {
    console.error("[native] writeFile error:", err);
    return null;
  }
}

/** Read a text file from the device's Documents directory. */
export async function readFile(filename: string): Promise<string | null> {
  if (!isNative()) return null;
  try {
    const result = await Filesystem.readFile({
      path: filename,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return result.data as string;
  } catch {
    return null;
  }
}

/** List files in the device's Documents directory. */
export async function listFiles(): Promise<string[]> {
  if (!isNative()) return [];
  try {
    const result = await Filesystem.readdir({ path: "", directory: Directory.Documents });
    return result.files.map((f) => f.name);
  } catch {
    return [];
  }
}

/** Delete a file from the device's Documents directory. */
export async function deleteFile(filename: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    await Filesystem.deleteFile({ path: filename, directory: Directory.Documents });
    return true;
  } catch {
    return false;
  }
}

/** Export all app data as a JSON backup file. */
export async function exportBackup(data: any, filename?: string): Promise<string | null> {
  const name = filename || `dashboard-backup-${new Date().toISOString().split("T")[0]}.json`;
  return writeFile(name, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Device info
// ---------------------------------------------------------------------------

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

/** Get comprehensive device information. */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  try {
    const info = await Device.getInfo();
    const battery = await Device.getBatteryInfo();
    const lang = await Device.getLanguageCode();
    return {
      model: info.model,
      platform: info.platform,
      osVersion: info.osVersion,
      manufacturer: info.manufacturer,
      batteryLevel: battery.batteryLevel ?? -1,
      isCharging: battery.isCharging ?? false,
      languageCode: lang.value,
      appId: (info as any).appId || "",
      appName: (info as any).appName || "",
      appVersion: (info as any).appVersion || "",
    };
  } catch (err) {
    console.error("[native] getDeviceInfo error:", err);
    return {
      model: "unknown",
      platform: "web",
      osVersion: "unknown",
      manufacturer: "unknown",
      batteryLevel: -1,
      isCharging: false,
      languageCode: "ar",
      appId: "",
      appName: "",
      appVersion: "",
    };
  }
}

// ---------------------------------------------------------------------------
// Motion sensors (accelerometer, gyroscope)
// ---------------------------------------------------------------------------

export interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

let motionListener: any = null;

/** Start listening to accelerometer data. */
export async function startAccelerometer(callback: (data: SensorData) => void): Promise<void> {
  if (!isNative()) return;
  try {
    // Request permission for motion (iOS) or just start (Android)
    motionListener = await Motion.addListener("accel", (event) => {
      callback({
        x: event.acceleration.x,
        y: event.acceleration.y,
        z: event.acceleration.z,
        timestamp: Date.now(),
      });
    });
  } catch (err) {
    console.error("[native] startAccelerometer error:", err);
  }
}

/** Stop listening to accelerometer data. */
export async function stopAccelerometer(): Promise<void> {
  if (motionListener) {
    try {
      await motionListener.remove();
    } catch {}
    motionListener = null;
  }
}

// ---------------------------------------------------------------------------
// Toast (native)
// ---------------------------------------------------------------------------

/** Show a native Android toast message. */
export async function showToast(message: string, duration: "short" | "long" = "short"): Promise<void> {
  if (!isNative()) return;
  try {
    await Toast.show({ text: message, duration: duration === "long" ? "long" : "short" });
  } catch {}
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

/** Listen for app background/foreground events. */
export function onAppStateChange(callback: (isActive: boolean) => void): () => void {
  let handle: any;
  App.addListener("appStateChange", ({ isActive }) => callback(isActive)).then((h) => { handle = h; });
  return () => { if (handle) handle.remove(); };
}

/** Get app info. */
export async function getAppInfo(): Promise<{ name: string; version: string; build: string } | null> {
  try {
    const info = await App.getInfo();
    return { name: info.name, version: info.version, build: info.build };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Preferences (persistent key-value storage)
// ---------------------------------------------------------------------------

/** Set a persistent preference. */
export async function setPref(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch {}
}

/** Get a persistent preference. */
export async function getPref(key: string): Promise<string | null> {
  try {
    const result = await Preferences.get({ key });
    return result.value;
  } catch {
    return null;
  }
}

/** Remove a persistent preference. */
export async function removePref(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch {}
}

// ---------------------------------------------------------------------------
// Permissions manager
// ---------------------------------------------------------------------------

export interface PermissionStatus {
  name: string;
  label: string;
  granted: boolean;
}

/** Request all necessary permissions at once. */
export async function requestAllPermissions(): Promise<PermissionStatus[]> {
  const statuses: PermissionStatus[] = [];

  // Camera
  try {
    const cam = await Camera.requestPermissions();
    statuses.push({ name: "camera", label: "الكاميرا", granted: cam.camera === "granted" });
  } catch {
    statuses.push({ name: "camera", label: "الكاميرا", granted: false });
  }

  // Location
  try {
    const loc = await Geolocation.requestPermissions();
    statuses.push({ name: "location", label: "الموقع", granted: loc.location === "granted" });
  } catch {
    statuses.push({ name: "location", label: "الموقع", granted: false });
  }

  // Contacts
  try {
    const con = await Contacts.requestPermissions();
    statuses.push({ name: "contacts", label: "جهات الاتصال", granted: con.contacts === "granted" });
  } catch {
    statuses.push({ name: "contacts", label: "جهات الاتصال", granted: false });
  }

  // Notifications
  try {
    const notif = await LocalNotifications.requestPermissions();
    statuses.push({ name: "notifications", label: "الإشعارات", granted: notif.display === "granted" });
  } catch {
    statuses.push({ name: "notifications", label: "الإشعارات", granted: false });
  }

  return statuses;
}

/** Check all permission statuses. */
export async function checkAllPermissions(): Promise<PermissionStatus[]> {
  const statuses: PermissionStatus[] = [];

  try {
    const cam = await Camera.checkPermissions();
    statuses.push({ name: "camera", label: "الكاميرا", granted: cam.camera === "granted" });
  } catch {
    statuses.push({ name: "camera", label: "الكاميرا", granted: false });
  }

  try {
    const loc = await Geolocation.checkPermissions();
    statuses.push({ name: "location", label: "الموقع", granted: loc.location === "granted" });
  } catch {
    statuses.push({ name: "location", label: "الموقع", granted: false });
  }

  try {
    const con = await Contacts.checkPermissions();
    statuses.push({ name: "contacts", label: "جهات الاتصال", granted: con.contacts === "granted" });
  } catch {
    statuses.push({ name: "contacts", label: "جهات الاتصال", granted: false });
  }

  try {
    const notif = await LocalNotifications.checkPermissions();
    statuses.push({ name: "notifications", label: "الإشعارات", granted: notif.display === "granted" });
  } catch {
    statuses.push({ name: "notifications", label: "الإشعارات", granted: false });
  }

  return statuses;
}
