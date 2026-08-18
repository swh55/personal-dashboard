import { describe, it, expect, beforeEach } from "vitest";
import { db, genId } from "@/lib/local/db";

describe("Local DB (localStorage-based)", () => {
  beforeEach(() => {
    localStorage.clear();
    db.initDB();
  });

  it("should initialize with seed data", () => {
    const contacts = db.getCollection("contacts");
    expect(Array.isArray(contacts)).toBe(true);
  });

  it("should insert and retrieve a contact", () => {
    const id = genId();
    db.insert("contacts", {
      id,
      name: "Test Contact",
      phone: "+1234567890",
      relation: "friend",
    });
    const contacts = db.getCollection("contacts");
    const found = contacts.find((c: any) => c.id === id);
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Contact");
  });

  it("should update a contact", () => {
    const id = genId();
    db.insert("contacts", { id, name: "Original", phone: "123" });
    db.update("contacts", id, { name: "Updated" });
    const contacts = db.getCollection("contacts");
    const found = contacts.find((c: any) => c.id === id);
    expect(found.name).toBe("Updated");
  });

  it("should soft-delete a contact", () => {
    const id = genId();
    db.insert("contacts", { id, name: "Test", phone: "123" });
    db.softDelete("contacts", id);
    const contacts = db.getCollection("contacts");
    const found = contacts.find((c: any) => c.id === id);
    expect(found.deletedAt).not.toBeNull();
  });

  it("should remove a contact permanently", () => {
    const id = genId();
    db.insert("contacts", { id, name: "Test", phone: "123" });
    db.remove("contacts", id);
    const contacts = db.getCollection("contacts");
    const found = contacts.find((c: any) => c.id === id);
    expect(found).toBeUndefined();
  });

  it("should log activity", () => {
    db.logActivity("create", "contact", "Test log entry");
    const logs = db.getCollection("activityLogs");
    const found = logs.find((l: any) => l.message === "Test log entry");
    expect(found).toBeDefined();
    expect(found.action).toBe("create");
    expect(found.entity).toBe("contact");
  });

  it("should export and import DB", () => {
    db.insert("contacts", { id: genId(), name: "Export Test", phone: "555" });
    const exported = db.exportDB();
    expect(Object.keys(exported).length).toBeGreaterThan(0);

    localStorage.clear();
    db.importDB(exported);
    const contacts = db.getCollection("contacts");
    const found = contacts.find((c: any) => c.name === "Export Test");
    expect(found).toBeDefined();
  });
});
