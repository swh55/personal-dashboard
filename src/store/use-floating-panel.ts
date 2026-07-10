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
  | "suggestions"
  | "maps"
  | "aiinsights"
  | "budget"
  | "integrations"
  | "automation"
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
  | "notifications";

interface FloatingPanelState {
  activePanel: PanelId;
  sidebarOpen: boolean;
  setPanel: (panel: PanelId) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useFloatingPanelStore = create<FloatingPanelState>((set) => ({
  activePanel: "overview",
  sidebarOpen: false,
  setPanel: (panel) => set({ activePanel: panel, sidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
