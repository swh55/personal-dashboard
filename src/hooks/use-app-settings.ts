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
}

const defaultSettings: Settings = {
  loaded: false,
  pinEnabled: false,
  pinCode: null,
  theme: "dark",
  accent: "emerald",
  username: "عبد الله",
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
