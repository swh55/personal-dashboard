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
  | "notifications"
  | "device";

interface FloatingPanelState {
  activePanel: PanelId;
  setPanel: (panel: PanelId) => void;
}

export const useFloatingPanelStore = create<FloatingPanelState>((set) => ({
  activePanel: "overview",
  setPanel: (panel) => set({ activePanel: panel }),
}));
