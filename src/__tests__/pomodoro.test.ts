import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/local/db";

describe("Pomodoro Store", () => {
  beforeEach(() => {
    localStorage.clear();
    db.initDB();
  });

  it("should start with focus mode", async () => {
    const { usePomodoroStore } = await import("@/store/use-pomodoro");
    const state = usePomodoroStore.getState();
    expect(state.mode).toBe("focus");
    expect(state.running).toBe(false);
    expect(state.remainingMs).toBe(25 * 60_000); // 25 min
  });

  it("should start the timer", async () => {
    const { usePomodoroStore } = await import("@/store/use-pomodoro");
    const store = usePomodoroStore.getState();
    store.start();
    const state = usePomodoroStore.getState();
    expect(state.running).toBe(true);
    expect(state.endTime).not.toBeNull();
  });

  it("should pause the timer", async () => {
    const { usePomodoroStore } = await import("@/store/use-pomodoro");
    const store = usePomodoroStore.getState();
    store.start();
    store.pause();
    const state = usePomodoroStore.getState();
    expect(state.running).toBe(false);
    expect(state.endTime).toBeNull();
    expect(state.remainingMs).toBeGreaterThan(0);
  });

  it("should reset the timer", async () => {
    const { usePomodoroStore } = await import("@/store/use-pomodoro");
    const store = usePomodoroStore.getState();
    store.start();
    store.reset();
    const state = usePomodoroStore.getState();
    expect(state.running).toBe(false);
    expect(state.remainingMs).toBe(25 * 60_000);
  });

  it("should switch modes", async () => {
    const { usePomodoroStore } = await import("@/store/use-pomodoro");
    const store = usePomodoroStore.getState();
    store.setMode("short");
    const state = usePomodoroStore.getState();
    expect(state.mode).toBe("short");
    expect(state.remainingMs).toBe(5 * 60_000); // 5 min
  });
});
