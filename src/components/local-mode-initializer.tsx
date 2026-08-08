"use client";

// IMPORTANT: This module activates the local fetch interceptor at
// **module-load time** (synchronously), NOT in a useEffect. This ensures
// the interceptor is installed BEFORE any React component renders and
// before any useApi() hook fires its first fetch.

import { installFetchInterceptor } from "@/lib/local/fetch-interceptor";
import { db } from "@/lib/local/db";
import { startGlobalPomodoroTicker } from "@/store/use-pomodoro";

// Module-level activation — runs once when this module is first imported.
if (typeof window !== "undefined" && !(window as any).__localModeReady) {
  const isApkMode = process.env.NEXT_PUBLIC_APK_MODE === "true";
  const isCapacitorNative =
    (window as any).capacitor?.isNative === true ||
    (window as any).capacitor?.platform === "android";
  let isForced = false;
  try {
    isForced = localStorage.getItem("force-local-mode") === "true";
  } catch {
    // localStorage not available
  }

  if (isApkMode || isCapacitorNative || isForced) {
    try {
      db.initDB();
      installFetchInterceptor();
      (window as any).__localModeReady = true;
      console.log("[LocalMode] Fetch interceptor installed (module-level)");
    } catch (err) {
      console.error("[LocalMode] Failed to install interceptor:", err);
    }
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
