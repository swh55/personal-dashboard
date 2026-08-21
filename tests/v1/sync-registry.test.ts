// =============================================================================
// Tests: src/lib/api/sync.ts — sync entity registry
// =============================================================================
// Verifies:
//   - SYNC_ENTITIES has 24 entries
//   - getSyncEntity("tasks") returns the config
//   - getSyncEntity("unknown") returns undefined
//   - getDelegate("task") returns the Prisma delegate (mocked db)
//   - All plural names are unique
//   - All delegate names are unique

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the db module so getDelegate can access model delegates without a
// real Prisma connection. We use vi.hoisted so the mock sentinel exists
// before vi.mock's factory runs (vi.mock is hoisted to the top of the file).
const { mockDelegate } = vi.hoisted(() => ({
  mockDelegate: { _isMockDelegate: true },
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get() {
        return mockDelegate;
      },
    }
  ),
}));

import {
  SYNC_ENTITIES,
  getSyncEntity,
  getDelegate,
  serializeForSync,
} from "@/lib/api/sync";

describe("SYNC_ENTITIES registry", () => {
  it("has exactly 24 entries", () => {
    expect(SYNC_ENTITIES).toHaveLength(24);
  });

  it("every entry has delegate, plural, and softDelete fields", () => {
    for (const e of SYNC_ENTITIES) {
      expect(typeof e.delegate).toBe("string");
      expect(e.delegate.length).toBeGreaterThan(0);
      expect(typeof e.plural).toBe("string");
      expect(e.plural.length).toBeGreaterThan(0);
      expect(typeof e.softDelete).toBe("boolean");
    }
  });

  it("every entry has softDelete=true (all sync entities support soft-delete)", () => {
    for (const e of SYNC_ENTITIES) {
      expect(e.softDelete).toBe(true);
    }
  });

  it("all plural names are unique", () => {
    const plurals = SYNC_ENTITIES.map((e) => e.plural);
    expect(new Set(plurals).size).toBe(plurals.length);
  });

  it("all delegate names are unique", () => {
    const delegates = SYNC_ENTITIES.map((e) => e.delegate);
    expect(new Set(delegates).size).toBe(delegates.length);
  });

  it("includes all expected plural names", () => {
    const expected = [
      "contacts",
      "notes",
      "events",
      "tasks",
      "expenses",
      "budgets",
      "assets",
      "accounts",
      "debts",
      "projects",
      "meetings",
      "occasions",
      "diary",
      "habits",
      "medications",
      "pantry",
      "waiting-list",
      "locations",
      "reminders",
      "happiness",
      "scheduled-messages",
      "automation",
      "suggestions",
      "integrations",
    ];
    const plurals = SYNC_ENTITIES.map((e) => e.plural);
    for (const name of expected) {
      expect(plurals).toContain(name);
    }
  });
});

describe("getSyncEntity", () => {
  it("returns the config for 'tasks'", () => {
    const config = getSyncEntity("tasks");
    expect(config).toBeDefined();
    expect(config!.plural).toBe("tasks");
    expect(config!.delegate).toBe("task");
    expect(config!.softDelete).toBe(true);
  });

  it("returns the config for 'contacts'", () => {
    const config = getSyncEntity("contacts");
    expect(config).toBeDefined();
    expect(config!.delegate).toBe("contact");
  });

  it("returns the config for 'waiting-list' (hyphenated plural)", () => {
    const config = getSyncEntity("waiting-list");
    expect(config).toBeDefined();
    expect(config!.delegate).toBe("waitingItem");
  });

  it("returns the config for 'scheduled-messages'", () => {
    const config = getSyncEntity("scheduled-messages");
    expect(config).toBeDefined();
    expect(config!.delegate).toBe("scheduledMessage");
  });

  it("returns the config for 'happiness'", () => {
    const config = getSyncEntity("happiness");
    expect(config).toBeDefined();
    expect(config!.delegate).toBe("happinessLog");
  });

  it("returns undefined for unknown entity name", () => {
    expect(getSyncEntity("unknown")).toBeUndefined();
    expect(getSyncEntity("")).toBeUndefined();
    expect(getSyncEntity("task")).toBeUndefined(); // singular, not plural
    expect(getSyncEntity("Tasks")).toBeUndefined(); // case-sensitive
  });
});

describe("getDelegate", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a delegate for 'task'", async () => {
    const { getDelegate } = await import("@/lib/api/sync");
    const delegate = getDelegate("task");
    expect(delegate).toBeDefined();
    expect(delegate._isMockDelegate).toBe(true);
  });

  it("returns a delegate for every SYNC_ENTITIES delegate name", async () => {
    const { getDelegate, SYNC_ENTITIES } = await import("@/lib/api/sync");
    for (const e of SYNC_ENTITIES) {
      const delegate = getDelegate(e.delegate);
      expect(delegate).toBeDefined();
      expect(delegate._isMockDelegate).toBe(true);
    }
  });

  it("returns undefined for an unknown model name", async () => {
    const { getDelegate } = await import("@/lib/api/sync");
    // getDelegate uses a switch/map — unknown keys are not in the map.
    expect(getDelegate("nonExistentModel")).toBeUndefined();
  });
});

describe("serializeForSync", () => {
  it("returns empty object for null", () => {
    expect(serializeForSync(null)).toEqual({});
  });

  it("returns empty object for non-object input", () => {
    expect(serializeForSync("string")).toEqual({});
    expect(serializeForSync(42)).toEqual({});
  });

  it("passes through primitive fields", () => {
    const result = serializeForSync({ id: "1", title: "Test", count: 5 });
    expect(result).toEqual({ id: "1", title: "Test", count: 5 });
  });

  it("converts Date objects to ISO strings", () => {
    const date = new Date("2024-01-15T10:30:00Z");
    const result = serializeForSync({ createdAt: date });
    expect(result.createdAt).toBe("2024-01-15T10:30:00.000Z");
  });

  it("converts bigint to string", () => {
    const result = serializeForSync({ seq: 42n });
    expect(result.seq).toBe("42");
  });

  it("handles mixed Date, bigint, and primitive fields", () => {
    const date = new Date("2024-06-01T00:00:00Z");
    const result = serializeForSync({
      id: "rec-1",
      seq: 99n,
      createdAt: date,
      title: "Hello",
      active: true,
    });
    expect(result).toEqual({
      id: "rec-1",
      seq: "99",
      createdAt: "2024-06-01T00:00:00.000Z",
      title: "Hello",
      active: true,
    });
  });

  it("handles nested objects (shallow copy)", () => {
    const nested = { inner: "value" };
    const result = serializeForSync({ config: nested });
    expect(result.config).toEqual({ inner: "value" });
  });
});
