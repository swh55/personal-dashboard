import { describe, it, expect } from "vitest";
import { getPlatform, isNative, isWeb, isElectron } from "@/lib/native/bridge";

describe("Platform Detection", () => {
  it("should detect web platform in test environment", () => {
    const platform = getPlatform();
    expect(platform).toBe("web");
  });

  it("isNative should return false in web environment", () => {
    expect(isNative()).toBe(false);
  });

  it("isElectron should return false in web environment", () => {
    expect(isElectron()).toBe(false);
  });

  it("isWeb should return true in web environment", () => {
    expect(isWeb()).toBe(true);
  });
});
