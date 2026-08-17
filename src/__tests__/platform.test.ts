import { describe, it, expect } from "vitest";
import { getPlatform } from "@/lib/platform/platform-adapter";

describe("Platform Detection", () => {
  it("should detect web platform in test environment", () => {
    const platform = getPlatform();
    expect(platform).toBe("web");
  });

  it("isNative should return false in web environment", async () => {
    const { isNative } = await import("@/lib/platform/platform-adapter");
    expect(isNative()).toBe(false);
  });

  it("isElectron should return false in web environment", async () => {
    const { isElectron } = await import("@/lib/platform/platform-adapter");
    expect(isElectron()).toBe(false);
  });
});
