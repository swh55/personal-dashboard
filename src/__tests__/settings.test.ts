import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/local/db";

describe("Settings Persistence (useAppSettings)", () => {
  beforeEach(() => {
    localStorage.clear();
    db.initDB();
  });

  it("should have default settings", async () => {
    const { useAppSettings } = await import("@/hooks/use-app-settings");
    const state = useAppSettings.getState();
    expect(state.settings.loaded).toBe(true);
    expect(state.settings.theme).toBe("dark");
    // username defaults to empty — resolved dynamically from session, never hardcoded
    expect(state.settings.username).toBe("");
    expect(state.settings.city).toBeTruthy();
    expect(state.settings.exchangeRate).toBeGreaterThan(0);
  });

  it("should persist username change", async () => {
    const { useAppSettings } = await import("@/hooks/use-app-settings");
    const store = useAppSettings.getState();
    store.setUsername("NewUser");
    const state = useAppSettings.getState();
    expect(state.settings.username).toBe("NewUser");
  });

  it("should persist PIN enable/disable", async () => {
    const { useAppSettings } = await import("@/hooks/use-app-settings");
    const store = useAppSettings.getState();
    store.setPinEnabled(true);
    store.setPinCode("1234");
    store.lock();
    const state = useAppSettings.getState();
    expect(state.settings.pinEnabled).toBe(true);
    expect(state.settings.pinCode).toBe("1234");
    expect(state.unlocked).toBe(false);
  });

  it("should persist AI settings", async () => {
    const { useAppSettings } = await import("@/hooks/use-app-settings");
    const store = useAppSettings.getState();
    store.setAiApiKey("test-key");
    store.setAiModel("glm-4");
    const state = useAppSettings.getState();
    expect(state.settings.aiApiKey).toBe("test-key");
    expect(state.settings.aiModel).toBe("glm-4");
  });
});
