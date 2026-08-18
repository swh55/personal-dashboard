# Task 4-platform — Platform Abstraction Layer

## Agent
platform-abstracter

## Task
Create a platform abstraction layer (`PlatformAdapter` interface + 3 adapter implementations) so the dashboard can run on Android (Capacitor), Electron (desktop), and the web without crashing. The previous `src/lib/native/bridge.ts` imported 11 Capacitor plugins directly at module-load time — this works on Android but would crash on Electron where Capacitor isn't installed.

## Files Created

All under `/home/z/my-project/src/lib/platform/`:

### 1. `platform-adapter.ts`
- Defines `Platform = "web" | "android" | "electron"`
- Defines the `PlatformAdapter` interface with all 40+ methods (phone/SMS, location, camera, haptics, notifications, network, share, filesystem, device-info, motion, toast, app-lifecycle, preferences, permissions)
- `getPlatform()` detection function (SSR-safe; checks `window.electronAPI.isElectron`, `window.capacitor.isNative`, `window.capacitor.platform`)
- `getPlatformAdapter()` factory using **dynamic `import()`** — the Capacitor adapter is only loaded when `platform === "android"`, so Capacitor plugin code never executes on web/electron
- Singleton cache (`cachedAdapter`)
- Convenience helpers: `isNative()`, `isElectron()`, `isWeb()`

### 2. `capacitor-adapter.ts`
- `CapacitorAdapter implements PlatformAdapter`
- Imports the 11 Capacitor plugins (`@capacitor/filesystem`, `device`, `geolocation`, `camera`, `haptics`, `local-notifications`, `network`, `share`, `app`, `preferences`, `toast`, `motion` + `@capacitor-community/contacts`) — these imports are now isolated to this file and only loaded on Android
- Logic is a direct port of the original `bridge.ts` function bodies, wrapped as class methods
- Adds 5 extra Capacitor-only methods (NOT in the interface) since they have no desktop equivalent: `requestContactsPermission`, `checkContactsPermission`, `getDeviceContacts`, `requestLocationPermission`, `requestCameraPermission` — these are reached by duck-typing from `bridge.ts` when needed

### 3. `electron-adapter.ts`
- `ElectronAdapter implements PlatformAdapter`
- Does NOT import Capacitor or Electron — talks to `window.electronAPI` (IPC bridge exposed by preload script)
- Defines a local `ElectronAPI` interface (`fs.*`, `device.*`, `app.*`, `notifications.*`, `preferences.*`) for type safety
- Falls back to web-style behavior when `window.electronAPI` is unavailable
- Key differences from Capacitor:
  - Filesystem → `window.electronAPI.fs.*` IPC
  - Device info → `window.electronAPI.device.getInfo()` (UA parsing as fallback)
  - Haptics → no-op (desktop has no haptic motor)
  - Accelerometer → no-op (desktop has no accelerometer)
  - `makePhoneCall` → `tel:` URI scheme
  - Notifications → Browser Notification API + setTimeout when no IPC handler
  - Preferences → `window.electronAPI.preferences.*` (localStorage fallback)

### 4. `web-adapter.ts`
- `WebAdapter implements PlatformAdapter`
- Does NOT import Capacitor or Electron — pure browser fallback
- URI schemes for phone/SMS/email, `navigator.geolocation`, file-input for image picker, `navigator.vibrate()` for haptics, Web Notification API + setTimeout for scheduling, `navigator.onLine` for network, Web Share API → clipboard fallback, localStorage for preferences
- `exportBackup` triggers a browser download (the only viable export path on web)

## Files Modified

### 5. `src/lib/native/bridge.ts` — rewritten as a backwards-compat re-export
- Re-exports `getPlatformAdapter`, `getPlatform`, `isNative`, `isWeb`, `isElectron`, `Platform`, `PlatformAdapter` from `@/lib/platform/platform-adapter`
- Preserves ALL named types that consumers currently import: `DeviceContact`, `LocationData`, `PhotoResult`, `NetworkStatus`, `DeviceInfo`, `SensorData`, `PermissionStatus`
- All 41 exported wrapper functions preserved with the SAME names and signatures:
  - Phone/SMS: `makePhoneCall`, `sendSMS`, `openWhatsApp`, `sendEmail`
  - Contacts: `requestContactsPermission`, `checkContactsPermission`, `getDeviceContacts` (use duck-typing helper `callNativeOnly()` so they no-op on web/electron)
  - Location: `requestLocationPermission`, `getCurrentLocation`
  - Camera: `requestCameraPermission`, `takePhoto`, `pickImage`
  - Haptics: `hapticLight`, `hapticMedium`, `hapticHeavy`, `hapticSuccess`, `hapticWarning`, `hapticError`
  - Notifications: `requestNotificationPermission`, `scheduleNotification`, `cancelNotification`
  - Network: `getNetworkStatus`, `onNetworkChange` (synchronous wrapper with cancelled-flag pattern to match old behavior)
  - Share/filesystem/device-info/motion/toast/lifecycle/preferences/permissions — all delegated to `getPlatformAdapter()`
- This means **no consumer file needs to change** — `calendar-section.tsx`, `settings.tsx`, `device.tsx`, `callpad.tsx`, `single-screen-shell.tsx`, `maps.tsx`, `permissions-manager.tsx`, `widgets/pomodoro.tsx`, `contacts.tsx` all keep working as-is

## Critical Rules Followed
- ✅ `"use client"` at top of all 5 files
- ✅ TypeScript strict (no implicit `any` in shared API surface; only duck-typed `any` for `callNativeOnly` helper)
- ✅ Did NOT break existing imports — verified by running `npx eslint src/` (zero errors)
- ✅ Did NOT modify any section/widget files
- ✅ Did NOT add Electron or Capacitor to files that didn't have them — only `capacitor-adapter.ts` imports Capacitor
- ✅ `electron-adapter.ts` does NOT import Capacitor or Electron — uses `window.electronAPI`
- ✅ `web-adapter.ts` does NOT import Capacitor or Electron

## Verification
- `npx eslint src/lib/platform/ src/lib/native/bridge.ts` → zero errors, zero warnings
- `npx eslint src/` → zero errors, zero warnings (all consumers still resolve bridge.ts exports correctly)
- Dev server log shows clean GET / 200 OK responses (~14-18ms render), no compile errors, no module-resolution errors
- Only pre-existing errors remain: `scripts/post-build.js` has 2 `@typescript-eslint/no-require-imports` errors (NOT touched by this task)
- The Open-Meteo 429 weather rate-limit errors and `EADDRINUSE` startup noise in dev.log are pre-existing and unrelated

## Stage Summary
- 4 new files in `src/lib/platform/` (platform-adapter.ts, capacitor-adapter.ts, electron-adapter.ts, web-adapter.ts) implementing the `PlatformAdapter` interface with dynamic-import-based platform routing
- `bridge.ts` rewritten as a backwards-compatible re-export layer — all 41 exported functions and 7 named types preserved, all delegate to `getPlatformAdapter()` at runtime
- Capacitor plugin imports are now isolated to `capacitor-adapter.ts`, which is only dynamically imported when `getPlatform() === "android"` — the bundle is safe on every platform
- Electron runtime now supported via the `window.electronAPI` IPC bridge (the preload script exposing this is Phase 5's scope)
- Zero breakage: every existing consumer of `@/lib/native/bridge` continues to work without changes
