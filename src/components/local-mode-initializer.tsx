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
import { seedDemoDataOnFirstRun } from "@/hooks/use-first-run";
import { isNative } from "@/lib/native/bridge";

// Module-level activation — runs once when this module is first imported.
if (typeof window !== "undefined" && !(window as any).__localModeReady) {
  try {
    db.initDB();
    // Seed demo data on first visit (only if no real data exists)
    seedDemoDataOnFirstRun();
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
 * Android Back Button Handler
 *
 * On native Android, the hardware back button defaults to navigating the
 * WebView history or exiting the app. We override it to:
 *   1. If a Dialog/Sheet/Popover is open → close it (simulate Escape key)
 *   2. Else if not on the main "overview" panel → go back to overview
 *   3. Else → let the default behavior happen (exit app)
 *
 * This is done in a React component (not module-level) because it needs
 * access to the latest floating-panel state.
 */
export function AndroidBackHandler() {
  // Dynamically import Capacitor App only on native
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isNative()) return;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => {
          // 1. Check if any Dialog/Sheet is open → dispatch Escape to close it
          const openDialog = document.querySelector(
            '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-state="open"][vaul-drawer], [role="presentation"][data-state="open"]'
          );
          if (openDialog) {
            const escEvent = new KeyboardEvent("keydown", {
              key: "Escape",
              keyCode: 27,
              which: 27,
              bubbles: true,
            });
            document.body.dispatchEvent(escEvent);
            return;
          }

          // 2. Check if bottom dock is expanded → collapse it
          const expandedDock = document.querySelector(
            'nav[aria-label="التنقل بين الأقسام"] [data-state="open"], nav button[aria-expanded="true"]'
          );
          if (expandedDock) {
            // Click outside the dock or press Escape to collapse
            const escEvent = new KeyboardEvent("keydown", {
              key: "Escape",
              keyCode: 27,
              which: 27,
              bubbles: true,
            });
            document.body.dispatchEvent(escEvent);
            return;
          }

          // 3. If not on overview → go to overview
          const params = new URLSearchParams(window.location.search);
          const currentPanel = params.get("p") || "overview";
          if (currentPanel !== "overview") {
            window.history.back();
            return;
          }

          // 4. On overview → exit app
          App.exitApp();
        });
        cleanup = () => { handle.remove(); };
      } catch (err) {
        console.error("[BackHandler] Failed to register:", err);
      }
    })();

    return () => { if (cleanup) cleanup(); };
  }, []);

  return null;
}

// React import here to avoid pulling it at module level for SSR
import * as React from "react";

/**
 * No-op component — the real work happens at module load time above.
 */
export function LocalModeInitializer() {
  return (
    <>
      <AndroidBackHandler />
    </>
  );
}
