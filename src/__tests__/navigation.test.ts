import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/local/db";

describe("Floating Panel Store", () => {
  beforeEach(() => {
    localStorage.clear();
    db.initDB();
  });

  it("should start with overview panel", async () => {
    const { useFloatingPanelStore } = await import("@/store/use-floating-panel");
    const state = useFloatingPanelStore.getState();
    expect(state.activePanel).toBe("overview");
  });

  it("should switch panels", async () => {
    const { useFloatingPanelStore } = await import("@/store/use-floating-panel");
    const store = useFloatingPanelStore.getState();
    store.setPanel("tasks");
    const state = useFloatingPanelStore.getState();
    expect(state.activePanel).toBe("tasks");
  });

  it("should support all 37+ panel IDs", async () => {
    const { useFloatingPanelStore } = await import("@/store/use-floating-panel");
    const store = useFloatingPanelStore.getState();
    const panels = [
      "overview", "calendar", "tasks", "contacts", "callpad", "notes",
      "habits", "expenses", "finances", "debts", "projects", "meetings",
      "islamic", "health", "diary", "accounts", "occasions", "activity",
      "recyclebin", "settings", "suggestions", "maps", "aiinsights",
      "budget", "integrations", "automation", "scheduledmsgs", "waitinglist",
      "reminders", "appearance", "home", "gamification", "analytics",
      "smartnotifs", "shopping", "ai", "pomodoro", "notifications", "device",
    ];
    for (const panel of panels) {
      store.setPanel(panel as any);
      const state = useFloatingPanelStore.getState();
      expect(state.activePanel).toBe(panel);
    }
  });
});
