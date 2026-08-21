"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface Settings {
  loaded: boolean;
  pinEnabled: boolean;
  pinCode: string | null;
  theme: "dark" | "light";
  accent: string;
  username: string;
  // Location
  city: string;
  lat: number;
  lng: number;
  timezone: string;
  // Finance
  exchangeRate: number; // USD to SYP
  // AI
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
}

interface AppSettingsState {
  settings: Settings;
  unlocked: boolean;
  setLoaded: (v: boolean) => void;
  setPinEnabled: (v: boolean) => void;
  setPinCode: (code: string | null) => void;
  unlock: () => void;
  lock: () => void;
  setTheme: (t: "dark" | "light") => void;
  setAccent: (a: string) => void;
  setUsername: (n: string) => void;
  setCity: (v: string) => void;
  setLat: (v: number) => void;
  setLng: (v: number) => void;
  setTimezone: (v: string) => void;
  setExchangeRate: (v: number) => void;
  setAiApiKey: (v: string) => void;
  setAiModel: (v: string) => void;
  setAiBaseUrl: (v: string) => void;
}

const defaultSettings: Settings = {
  loaded: false,
  pinEnabled: false,
  pinCode: null,
  theme: "dark",
  accent: "emerald",
  username: "",  // resolved dynamically from session, never hardcoded
  city: "حلب",
  lat: 36.2021,
  lng: 37.1343,
  timezone: "Asia/Damascus",
  exchangeRate: 12500,
  aiApiKey: "",
  aiModel: "glm-4.5-flash",
  aiBaseUrl: "",
};

export const useAppSettings = create<AppSettingsState>()(
  persist(
    (set) => ({
      settings: { ...defaultSettings, loaded: true },
      unlocked: true,
      setLoaded: (v) =>
        set((s) => ({ settings: { ...s.settings, loaded: v } })),
      setPinEnabled: (v) =>
        set((s) => ({ settings: { ...s.settings, pinEnabled: v } })),
      setPinCode: (code) =>
        set((s) => ({ settings: { ...s.settings, pinCode: code } })),
      unlock: () => set({ unlocked: true }),
      lock: () => set({ unlocked: false }),
      setTheme: (t) => set((s) => ({ settings: { ...s.settings, theme: t } })),
      setAccent: (a) => set((s) => ({ settings: { ...s.settings, accent: a } })),
      setUsername: (n) => set((s) => ({ settings: { ...s.settings, username: n } })),
      setCity: (v) => set((s) => ({ settings: { ...s.settings, city: v } })),
      setLat: (v) => set((s) => ({ settings: { ...s.settings, lat: v } })),
      setLng: (v) => set((s) => ({ settings: { ...s.settings, lng: v } })),
      setTimezone: (v) => set((s) => ({ settings: { ...s.settings, timezone: v } })),
      setExchangeRate: (v) => set((s) => ({ settings: { ...s.settings, exchangeRate: v } })),
      setAiApiKey: (v) => set((s) => ({ settings: { ...s.settings, aiApiKey: v } })),
      setAiModel: (v) => set((s) => ({ settings: { ...s.settings, aiModel: v } })),
      setAiBaseUrl: (v) => set((s) => ({ settings: { ...s.settings, aiBaseUrl: v } })),
    }),
    {
      name: "app-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.settings = { ...state.settings, loaded: true };
          if (!state.settings.pinEnabled || !state.settings.pinCode) {
            state.unlocked = true;
          } else {
            state.unlocked = false;
          }
        }
      },
    }
  )
);
