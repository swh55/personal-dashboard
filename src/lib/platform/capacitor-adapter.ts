"use client";

// Capacitor (Android) implementation of PlatformAdapter.
//
// THIS FILE IS ONLY LOADED ON ANDROID — it is dynamically imported by
// `platform-adapter.ts` when `getPlatform() === "android"`. Importing it on
// any other platform would crash because `@capacitor/*` packages expect a
// native bridge that doesn't exist in browsers or Electron.
//
// The logic here is the direct successor of the old `src/lib/native/bridge.ts`
// function bodies. The only change is that everything is wrapped as a class
// implementing `PlatformAdapter`. A handful of Capacitor-only helper methods
// (contacts, location-permission, camera-permission) live alongside the
// interface methods because they have no desktop equivalent; they are reached
// by duck-typing from `bridge.ts`.

import type { PlatformAdapter } from "./platform-adapter";
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

/** Shape returned by `getDeviceContacts()` (kept here for backwards-compat). */
export interface DeviceContact {
  id: string;
  displayName: string;
  phoneNumbers: string[];
  emails: string[];
}

type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
};

type PhotoResult = {
  base64: string | null;
  path: string | null;
  webPath: string | null;
};

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

export class CapacitorAdapter implements PlatformAdapter {
  readonly platform = "android" as const;

  // private state ------------------------------------------------------------
  private motionListener: any = null;

  // ----- Phone / SMS (URI schemes — work on Android without plugins) --------

  async makePhoneCall(phone: string): Promise<boolean> {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned) return false;
    // On Android, `tel:` opens the dialer (doesn't require CALL_PHONE
    // permission unless you want to auto-dial without user confirmation).
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
    window.location.href = url;
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

  // ----- Contacts (Capacitor-only — not part of PlatformAdapter interface) ---

  async requestContactsPermission(): Promise<boolean> {
    try {
      const result = await Contacts.requestPermissions();
      return result.contacts === "granted";
    } catch {
      return false;
    }
  }

  async checkContactsPermission(): Promise<boolean> {
    try {
      const result = await Contacts.checkPermissions();
      return result.contacts === "granted";
    } catch {
      return false;
    }
  }

  async getDeviceContacts(): Promise<DeviceContact[]> {
    try {
      const granted = await this.checkContactsPermission();
      if (!granted) {
        const ok = await this.requestContactsPermission();
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
      console.error("[capacitor] getDeviceContacts error:", err);
      return [];
    }
  }

  // ----- Location ----------------------------------------------------------

  async requestLocationPermission(): Promise<boolean> {
    try {
      const status = await Geolocation.requestPermissions();
      return status.location === "granted";
    } catch {
      return false;
    }
  }

  async getCurrentLocation(): Promise<LocationData | null> {
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
      console.error("[capacitor] getCurrentLocation error:", err);
      return null;
    }
  }

  // ----- Camera ------------------------------------------------------------

  async requestCameraPermission(): Promise<boolean> {
    try {
      const status = await Camera.requestPermissions();
      return status.camera === "granted";
    } catch {
      return false;
    }
  }

  async takePhoto(): Promise<PhotoResult | null> {
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
      console.error("[capacitor] takePhoto error:", err);
      return null;
    }
  }

  async pickImage(): Promise<PhotoResult | null> {
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
      console.error("[capacitor] pickImage error:", err);
      return null;
    }
  }

  // ----- Haptics -----------------------------------------------------------

  async hapticLight(): Promise<void> {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
  }
  async hapticMedium(): Promise<void> {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
  }
  async hapticHeavy(): Promise<void> {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
  }
  async hapticSuccess(): Promise<void> {
    try { await Haptics.notification({ type: NotificationType.Success }); } catch {}
  }
  async hapticWarning(): Promise<void> {
    try { await Haptics.notification({ type: NotificationType.Warning }); } catch {}
  }
  async hapticError(): Promise<void> {
    try { await Haptics.notification({ type: NotificationType.Error }); } catch {}
  }

  // ----- Notifications -----------------------------------------------------

  async requestNotificationPermission(): Promise<boolean> {
    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === "granted";
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
      console.error("[capacitor] scheduleNotification error:", err);
      return null;
    }
  }

  async cancelNotification(id: number): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch {}
  }

  // ----- Network -----------------------------------------------------------

  async getNetworkStatus(): Promise<NetworkStatus> {
    try {
      const status = await Network.getStatus();
      return { connected: status.connected, connectionType: status.connectionType };
    } catch {
      return { connected: false, connectionType: "unknown" };
    }
  }

  onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
    let handle: any;
    Network.addListener("networkStatusChange", (status) => {
      callback({ connected: status.connected, connectionType: status.connectionType });
    }).then((h) => { handle = h; });
    return () => { if (handle) handle.remove(); };
  }

  // ----- Share -------------------------------------------------------------

  async share(title: string, text: string, url?: string): Promise<boolean> {
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

  // ----- Filesystem --------------------------------------------------------

  async writeFile(filename: string, content: string): Promise<string | null> {
    try {
      const result = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return result.uri;
    } catch (err) {
      console.error("[capacitor] writeFile error:", err);
      return null;
    }
  }

  async readFile(filename: string): Promise<string | null> {
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

  async listFiles(): Promise<string[]> {
    try {
      const result = await Filesystem.readdir({ path: "", directory: Directory.Documents });
      return result.files.map((f) => f.name);
    } catch {
      return [];
    }
  }

  async deleteFile(filename: string): Promise<boolean> {
    try {
      await Filesystem.deleteFile({ path: filename, directory: Directory.Documents });
      return true;
    } catch {
      return false;
    }
  }

  async exportBackup(data: any, filename?: string): Promise<string | null> {
    const name = filename || `dashboard-backup-${new Date().toISOString().split("T")[0]}.json`;
    return this.writeFile(name, JSON.stringify(data, null, 2));
  }

  // ----- Device info -------------------------------------------------------

  async getDeviceInfo(): Promise<DeviceInfo> {
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
      console.error("[capacitor] getDeviceInfo error:", err);
      return {
        model: "unknown",
        platform: "android",
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

  // ----- Motion sensors ----------------------------------------------------

  async startAccelerometer(callback: (data: SensorData) => void): Promise<void> {
    try {
      // Android doesn't require explicit motion permission, iOS does.
      this.motionListener = await Motion.addListener("accel", (event) => {
        callback({
          x: event.acceleration.x,
          y: event.acceleration.y,
          z: event.acceleration.z,
          timestamp: Date.now(),
        });
      });
    } catch (err) {
      console.error("[capacitor] startAccelerometer error:", err);
    }
  }

  async stopAccelerometer(): Promise<void> {
    if (this.motionListener) {
      try { await this.motionListener.remove(); } catch {}
      this.motionListener = null;
    }
  }

  // ----- Toast -------------------------------------------------------------

  async showToast(message: string, duration: "short" | "long" = "short"): Promise<void> {
    try {
      await Toast.show({ text: message, duration: duration === "long" ? "long" : "short" });
    } catch {}
  }

  // ----- App lifecycle -----------------------------------------------------

  onAppStateChange(callback: (isActive: boolean) => void): () => void {
    let handle: any;
    App.addListener("appStateChange", ({ isActive }) => callback(isActive)).then((h) => { handle = h; });
    return () => { if (handle) handle.remove(); };
  }

  async getAppInfo(): Promise<{ name: string; version: string; build: string } | null> {
    try {
      const info = await App.getInfo();
      return { name: info.name, version: info.version, build: info.build };
    } catch {
      return null;
    }
  }

  // ----- Preferences (persistent key-value storage) ------------------------

  async setPref(key: string, value: string): Promise<void> {
    try { await Preferences.set({ key, value }); } catch {}
  }

  async getPref(key: string): Promise<string | null> {
    try {
      const result = await Preferences.get({ key });
      return result.value;
    } catch {
      return null;
    }
  }

  async removePref(key: string): Promise<void> {
    try { await Preferences.remove({ key }); } catch {}
  }

  // ----- Permissions -------------------------------------------------------

  async requestAllPermissions(): Promise<PermissionStatus[]> {
    const statuses: PermissionStatus[] = [];

    try {
      const cam = await Camera.requestPermissions();
      statuses.push({ name: "camera", label: "الكاميرا", granted: cam.camera === "granted" });
    } catch {
      statuses.push({ name: "camera", label: "الكاميرا", granted: false });
    }

    try {
      const loc = await Geolocation.requestPermissions();
      statuses.push({ name: "location", label: "الموقع", granted: loc.location === "granted" });
    } catch {
      statuses.push({ name: "location", label: "الموقع", granted: false });
    }

    try {
      const con = await Contacts.requestPermissions();
      statuses.push({ name: "contacts", label: "جهات الاتصال", granted: con.contacts === "granted" });
    } catch {
      statuses.push({ name: "contacts", label: "جهات الاتصال", granted: false });
    }

    try {
      const notif = await LocalNotifications.requestPermissions();
      statuses.push({ name: "notifications", label: "الإشعارات", granted: notif.display === "granted" });
    } catch {
      statuses.push({ name: "notifications", label: "الإشعارات", granted: false });
    }

    return statuses;
  }

  async checkAllPermissions(): Promise<PermissionStatus[]> {
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
}
