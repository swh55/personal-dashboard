"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PomodoroMode = "focus" | "short" | "long";

interface PomodoroState {
  mode: PomodoroMode;
  // endTime is the timestamp (ms) when the timer should reach 0.
  // If running is true, remaining = endTime - Date.now().
  // If paused, endTime is null and remaining is stored in remainingMs.
  running: boolean;
  endTime: number | null;
  remainingMs: number;
  sessionsToday: number;
  lastSessionDate: string; // YYYY-MM-DD
  // Durations (configurable)
  focusMin: number;
  shortMin: number;
  longMin: number;

  setMode: (mode: PomodoroMode) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void; // called every second to check if timer expired
  setDurations: (d: { focusMin?: number; shortMin?: number; longMin?: number }) => void;
  getRemainingMs: () => number;
}

const DEFAULT_DURATIONS = { focusMin: 25, shortMin: 5, longMin: 15 };

function modeDurationMs(mode: PomodoroMode, state: PomodoroState): number {
  switch (mode) {
    case "focus": return state.focusMin * 60_000;
    case "short": return state.shortMin * 60_000;
    case "long": return state.longMin * 60_000;
  }
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      mode: "focus",
      running: false,
      endTime: null,
      remainingMs: DEFAULT_DURATIONS.focusMin * 60_000,
      sessionsToday: 0,
      lastSessionDate: todayStr(),
      ...DEFAULT_DURATIONS,

      setMode: (mode) => {
        const state = get();
        const dur = modeDurationMs(mode, state);
        set({ mode, running: false, endTime: null, remainingMs: dur });
      },

      start: () => {
        const state = get();
        if (state.running) return;
        const remaining = state.remainingMs > 0 ? state.remainingMs : modeDurationMs(state.mode, state);
        set({
          running: true,
          endTime: Date.now() + remaining,
          remainingMs: remaining,
        });
      },

      pause: () => {
        const state = get();
        if (!state.running) return;
        const remaining = state.endTime ? state.endTime - Date.now() : state.remainingMs;
        set({
          running: false,
          endTime: null,
          remainingMs: Math.max(0, remaining),
        });
      },

      reset: () => {
        const state = get();
        set({
          running: false,
          endTime: null,
          remainingMs: modeDurationMs(state.mode, state),
        });
      },

      tick: () => {
        const state = get();
        if (!state.running || !state.endTime) return;
        const remaining = state.endTime - Date.now();
        if (remaining <= 0) {
          // Timer expired
          const today = todayStr();
          const sessionsToday = state.lastSessionDate === today ? state.sessionsToday : 0;
          // After focus, switch to break; after break, switch to focus
          // Every 4th focus session → long break
          const newSessions = state.mode === "focus" ? sessionsToday + 1 : sessionsToday;
          let nextMode: PomodoroMode;
          if (state.mode === "focus") {
            nextMode = newSessions % 4 === 0 ? "long" : "short";
          } else {
            nextMode = "focus";
          }
          set({
            mode: nextMode,
            running: false,
            endTime: null,
            remainingMs: modeDurationMs(nextMode, { ...state, mode: nextMode }),
            sessionsToday: newSessions,
            lastSessionDate: today,
          });
        } else {
          set({ remainingMs: remaining });
        }
      },

      setDurations: (d) => {
        const state = get();
        const newDurations = { ...state, ...d };
        set({
          focusMin: d.focusMin ?? state.focusMin,
          shortMin: d.shortMin ?? state.shortMin,
          longMin: d.longMin ?? state.longMin,
        });
        // If not running, update remainingMs to match new duration
        if (!state.running) {
          set({ remainingMs: modeDurationMs(state.mode, newDurations) });
        }
      },

      getRemainingMs: () => {
        const state = get();
        if (state.running && state.endTime) {
          return Math.max(0, state.endTime - Date.now());
        }
        return state.remainingMs;
      },
    }),
    {
      name: "pomodoro-state",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Global ticker — runs once, independent of component mount/unmount
let globalTicker: ReturnType<typeof setInterval> | null = null;

export function startGlobalPomodoroTicker() {
  if (globalTicker) return;
  globalTicker = setInterval(() => {
    usePomodoroStore.getState().tick();
  }, 1000);
}

export function stopGlobalPomodoroTicker() {
  if (globalTicker) {
    clearInterval(globalTicker);
    globalTicker = null;
  }
}
