"use client";

import { create } from "zustand";

export type PanelId =
  | "overview"
  | "calendar"
  | "tasks"
  | "contacts"
  | "callpad"
  | "notes"
  | "habits"
  | "expenses"
  | "finances"
  | "debts"
  | "projects"
  | "meetings"
  | "islamic"
  | "health"
  | "diary"
  | "accounts"
  | "occasions"
  | "activity"
  | "recyclebin"
  | "settings"
  | "maps"
  | "aiinsights"
  | "budget"
  | "scheduledmsgs"
  | "waitinglist"
  | "reminders"
  | "appearance"
  | "home"
  | "gamification"
  | "analytics"
  | "smartnotifs"
  | "shopping"
  | "ai"
  | "pomodoro"
  | "notifications"
  | "device";

interface FloatingPanelState {
  activePanel: PanelId;
  setPanel: (panel: PanelId) => void;
}

// Read the initial panel from the URL search param `?p=<panelId>` so the
// browser back/forward buttons work and each section has its own shareable URL.
function getInitialPanel(): PanelId {
  if (typeof window === "undefined") return "overview";
  const params = new URLSearchParams(window.location.search);
  const p = params.get("p");
  if (p) {
    // Validate it's a known panel
    const known: string[] = [
      "overview", "calendar", "tasks", "contacts", "callpad", "notes",
      "habits", "expenses", "finances", "debts", "projects", "meetings",
      "islamic", "health", "diary", "accounts", "occasions", "activity",
      "recyclebin", "settings", "maps", "aiinsights", "budget",
      "scheduledmsgs", "waitinglist", "reminders",
      "appearance", "home", "gamification", "analytics", "smartnotifs",
      "shopping", "ai", "pomodoro", "notifications", "device",
    ];
    if (known.includes(p)) return p as PanelId;
  }
  return "overview";
}

export const useFloatingPanelStore = create<FloatingPanelState>((set) => ({
  activePanel: getInitialPanel(),
  setPanel: (panel) => {
    set({ activePanel: panel });
    // Update the URL so browser back/forward navigation works and each
    // section has its own shareable URL. We use history.pushState to avoid
    // a full page reload.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (panel === "overview") {
        url.searchParams.delete("p");
      } else {
        url.searchParams.set("p", panel);
      }
      window.history.pushState({}, "", url.toString());
    }
  },
}));

// Listen for browser back/forward navigation and sync the panel.
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("p") || "overview";
    const known: string[] = [
      "overview", "calendar", "tasks", "contacts", "callpad", "notes",
      "habits", "expenses", "finances", "debts", "projects", "meetings",
      "islamic", "health", "diary", "accounts", "occasions", "activity",
      "recyclebin", "settings", "maps", "aiinsights", "budget",
      "scheduledmsgs", "waitinglist", "reminders",
      "appearance", "home", "gamification", "analytics", "smartnotifs",
      "shopping", "ai", "pomodoro", "notifications", "device",
    ];
    if (known.includes(p)) {
      useFloatingPanelStore.setState({ activePanel: p as PanelId });
    }
  });
}
