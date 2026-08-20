"use client";

// IMPORTANT: This module activates the local fetch interceptor at
// **module-load time** (synchronously), NOT in a useEffect. This ensures
// the interceptor is installed BEFORE any React component renders and
// before any useApi() hook fires its first fetch.
//
// The interceptor's shouldIntercept() function decides whether to install:
//   - APK build / Capacitor native / forced flag → install (offline shell)
//   - Normal web + session cookie present → DON'T install (use cloud)
//   - Normal web + no session cookie → install (guest local mode)

import { installFetchInterceptor } from "@/lib/local/fetch-interceptor";
import { db } from "@/lib/local/db";
import { startGlobalPomodoroTicker } from "@/store/use-pomodoro";

// Module-level activation — runs once when this module is first imported.
if (typeof window !== "undefined" && !(window as any).__localModeReady) {
  try {
    db.initDB();
    // installFetchInterceptor() internally calls shouldIntercept() and returns
    // early if interception isn't needed (e.g. authenticated web user).
    installFetchInterceptor();
    if ((window as any).__localModeReady) {
      console.log("[LocalMode] Fetch interceptor installed (module-level)");
    }
  } catch (err) {
    console.error("[LocalMode] Failed to install interceptor:", err);
  }

  // Start the global Pomodoro ticker — runs independently of which panel
  // is active, so the timer keeps ticking in the background.
  try {
    startGlobalPomodoroTicker();
  } catch (err) {
    console.error("[LocalMode] Failed to start Pomodoro ticker:", err);
  }
}

/**
 * No-op component — the real work happens at module load time above.
 */
export function LocalModeInitializer() {
  return null;
}
