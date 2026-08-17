import { describe, it, expect, beforeEach } from "vitest";
import { db, genId } from "@/lib/local/db";

describe("CRUD Operations (representative)", () => {
  beforeEach(() => {
    localStorage.clear();
    db.initDB();
  });

  describe("Tasks", () => {
    it("should create, read, update, delete a task", () => {
      const id = genId();
      db.insert("tasks", { id, title: "Test Task", status: "todo", priority: "high" });
      let tasks = db.getCollection("tasks");
      expect(tasks.find((t: any) => t.id === id)?.title).toBe("Test Task");

      db.update("tasks", id, { status: "done" });
      tasks = db.getCollection("tasks");
      expect(tasks.find((t: any) => t.id === id)?.status).toBe("done");

      db.softDelete("tasks", id);
      tasks = db.getCollection("tasks");
      expect(tasks.find((t: any) => t.id === id)?.deletedAt).not.toBeNull();

      db.remove("tasks", id);
      tasks = db.getCollection("tasks");
      expect(tasks.find((t: any) => t.id === id)).toBeUndefined();
    });
  });

  describe("Notes", () => {
    it("should create and pin a note", () => {
      const id = genId();
      db.insert("notes", { id, title: "Test Note", content: "Content", color: "yellow", pinned: false });
      db.update("notes", id, { pinned: true });
      const notes = db.getCollection("notes");
      expect(notes.find((n: any) => n.id === id)?.pinned).toBe(true);
    });
  });

  describe("Contacts", () => {
    it("should create a contact with favorite", () => {
      const id = genId();
      db.insert("contacts", { id, name: "Ahmad", phone: "+963123", favorite: true });
      const contacts = db.getCollection("contacts");
      expect(contacts.find((c: any) => c.id === id)?.favorite).toBe(true);
    });
  });

  describe("Expenses", () => {
    it("should create an expense with currency", () => {
      const id = genId();
      db.insert("expenses", { id, amount: 50000, currency: "syp", category: "food" });
      const expenses = db.getCollection("expenses");
      expect(expenses.find((e: any) => e.id === id)?.amount).toBe(50000);
    });
  });

  describe("Events", () => {
    it("should create an event", () => {
      const id = genId();
      db.insert("events", { id, title: "Meeting", startDate: new Date().toISOString(), type: "work" });
      const events = db.getCollection("events");
      expect(events.find((e: any) => e.id === id)?.title).toBe("Meeting");
    });
  });

  describe("Debts", () => {
    it("should create and settle a debt", () => {
      const id = genId();
      db.insert("debts", { id, personName: "Khaled", amount: 500, currency: "syp", type: "owed" });
      db.update("debts", id, { settled: true, settledAt: new Date().toISOString() });
      const debts = db.getCollection("debts");
      expect(debts.find((d: any) => d.id === id)?.settled).toBe(true);
    });
  });
});
