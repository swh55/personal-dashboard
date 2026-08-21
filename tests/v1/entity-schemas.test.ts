// =============================================================================
// Tests: src/lib/api/entities.ts — zod schemas for all 24 sync entities
// =============================================================================
// For each entity:
//   - Valid create payload passes
//   - Create payload with `userId` is REJECTED (mass-assignment)
//   - Create payload with `id` is REJECTED
//   - Create payload with `createdAt`/`updatedAt`/`version`/`deletedAt` is REJECTED
//   - Update payload with `baseVersion` is ACCEPTED
//
// Plus in-depth field-level validation for a few representative entities.

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Mock db so entities.ts can import it without a live Prisma connection.
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: () => ({} as any) }),
}));

import {
  // Tasks
  taskCreate,
  taskUpdate,
  // Contacts
  contactCreate,
  contactUpdate,
  // Notes
  noteCreate,
  noteUpdate,
  // Events
  eventCreate,
  eventUpdate,
  // Expenses
  expenseCreate,
  expenseUpdate,
  // Accounts
  accountCreate,
  accountUpdate,
  // Assets
  assetCreate,
  assetUpdate,
  // Debts
  debtCreate,
  debtUpdate,
  // Budgets
  budgetCreate,
  budgetUpdate,
  // Projects
  projectCreate,
  projectUpdate,
  // Meetings
  meetingCreate,
  meetingUpdate,
  // Occasions
  occasionCreate,
  occasionUpdate,
  // Diary
  diaryCreate,
  diaryUpdate,
  // Habits
  habitCreate,
  habitUpdate,
  // Medications
  medicationCreate,
  medicationUpdate,
  // Pantry
  pantryCreate,
  pantryUpdate,
  // Waiting list
  waitingCreate,
  waitingUpdate,
  // Locations
  locationCreate,
  locationUpdate,
  // Reminders
  reminderCreate,
  reminderUpdate,
  // Scheduled messages
  scheduledMessageCreate,
  scheduledMessageUpdate,
  // Automation
  automationCreate,
  automationUpdate,
  // Suggestions
  suggestionCreate,
  suggestionUpdate,
  // Integrations
  integrationCreate,
  integrationUpdate,
  // Happiness
  happinessCreate,
  happinessUpdate,
} from "@/lib/api/entities";

// ---------------------------------------------------------------------------
// Registry of all 24 entity schemas with minimal valid create payloads
// ---------------------------------------------------------------------------
const ENTITIES = [
  {
    name: "task",
    create: taskCreate,
    update: taskUpdate,
    valid: { title: "Test Task" },
  },
  {
    name: "contact",
    create: contactCreate,
    update: contactUpdate,
    valid: { name: "Ahmad", phone: "+963123" },
  },
  {
    name: "note",
    create: noteCreate,
    update: noteUpdate,
    valid: { title: "Note", content: "Content" },
  },
  {
    name: "event",
    create: eventCreate,
    update: eventUpdate,
    valid: { title: "Event", startDate: "2024-01-01T00:00:00Z" },
  },
  {
    name: "expense",
    create: expenseCreate,
    update: expenseUpdate,
    valid: { amount: 50000 },
  },
  {
    name: "account",
    create: accountCreate,
    update: accountUpdate,
    valid: { name: "Bank Account" },
  },
  {
    name: "asset",
    create: assetCreate,
    update: assetUpdate,
    valid: { name: "Cash", amount: 1000 },
  },
  {
    name: "debt",
    create: debtCreate,
    update: debtUpdate,
    valid: { personName: "Khaled", amount: 500 },
  },
  {
    name: "budget",
    create: budgetCreate,
    update: budgetUpdate,
    valid: { category: "food", limit: 50000, month: 1, year: 2024 },
  },
  {
    name: "project",
    create: projectCreate,
    update: projectUpdate,
    valid: { name: "Project Alpha" },
  },
  {
    name: "meeting",
    create: meetingCreate,
    update: meetingUpdate,
    valid: { title: "Standup", startDate: "2024-01-01T09:00:00Z" },
  },
  {
    name: "occasion",
    create: occasionCreate,
    update: occasionUpdate,
    valid: { title: "Birthday", date: "2024-05-15T00:00:00Z" },
  },
  {
    name: "diary",
    create: diaryCreate,
    update: diaryUpdate,
    valid: { content: "Dear diary..." },
  },
  {
    name: "habit",
    create: habitCreate,
    update: habitUpdate,
    valid: { name: "Exercise" },
  },
  {
    name: "medication",
    create: medicationCreate,
    update: medicationUpdate,
    valid: { name: "Aspirin" },
  },
  {
    name: "pantry",
    create: pantryCreate,
    update: pantryUpdate,
    valid: { name: "Rice" },
  },
  {
    name: "waitingItem",
    create: waitingCreate,
    update: waitingUpdate,
    valid: { title: "Read book" },
  },
  {
    name: "location",
    create: locationCreate,
    update: locationUpdate,
    valid: { name: "Home", lat: 35.0, lng: 38.0 },
  },
  {
    name: "reminder",
    create: reminderCreate,
    update: reminderUpdate,
    valid: { contactName: "Ahmad" },
  },
  {
    name: "scheduledMessage",
    create: scheduledMessageCreate,
    update: scheduledMessageUpdate,
    valid: {
      recipient: "+963123",
      message: "Hello",
      scheduledAt: "2024-01-01T10:00:00Z",
    },
  },
  {
    name: "automation",
    create: automationCreate,
    update: automationUpdate,
    valid: { name: "Rule", trigger: "time", action: "notify" },
  },
  {
    name: "suggestion",
    create: suggestionCreate,
    update: suggestionUpdate,
    valid: { title: "Idea", content: "Description" },
  },
  {
    name: "integration",
    create: integrationCreate,
    update: integrationUpdate,
    valid: { service: "google_calendar", name: "Calendar" },
  },
  {
    name: "happiness",
    create: happinessCreate,
    update: happinessUpdate,
    valid: { date: "2024-01-01T00:00:00Z", score: 7 },
  },
] as const;

// Server-managed fields that must NEVER be accepted from the client.
const SERVER_MANAGED_FIELDS = [
  "userId",
  "id",
  "createdAt",
  "updatedAt",
  "version",
  "deletedAt",
];

describe("entity schemas — registry completeness", () => {
  it("covers all 24 entities", () => {
    expect(ENTITIES).toHaveLength(24);
  });
});

// ---------------------------------------------------------------------------
// Generic per-entity tests — applied to all 24 entities
// ---------------------------------------------------------------------------
describe.each(ENTITIES)(
  "$name schema",
  ({ create, update, valid }) => {
    describe("valid create payload", () => {
      it("accepts a minimal valid create payload", () => {
        const result = create.safeParse(valid);
        expect(result.success).toBe(true);
      });
    });

    describe("mass-assignment protection (strict mode)", () => {
      for (const field of SERVER_MANAGED_FIELDS) {
        it(`rejects create payload with server-managed field "${field}"`, () => {
          const malicious = { ...valid, [field]: "evil-value" };
          const result = create.safeParse(malicious);
          expect(result.success).toBe(false);
        });
      }

      it("rejects create payload with multiple server-managed fields", () => {
        const malicious = {
          ...valid,
          userId: "evil",
          id: "evil",
          createdAt: "2024-01-01",
          version: 1,
        };
        const result = create.safeParse(malicious);
        expect(result.success).toBe(false);
      });

      it("rejects an arbitrary unknown field", () => {
        const malicious = { ...valid, hackerField: "pwned" };
        const result = create.safeParse(malicious);
        expect(result.success).toBe(false);
      });
    });

    describe("update schema", () => {
      it("accepts an empty update payload", () => {
        const result = update.safeParse({});
        expect(result.success).toBe(true);
      });

      it("accepts baseVersion for optimistic concurrency", () => {
        const result = update.safeParse({ baseVersion: 1 });
        expect(result.success).toBe(true);
      });

      it("accepts baseVersion = 42", () => {
        const result = update.safeParse({ baseVersion: 42 });
        expect(result.success).toBe(true);
      });

      it("rejects baseVersion = 0", () => {
        const result = update.safeParse({ baseVersion: 0 });
        expect(result.success).toBe(false);
      });

      it("rejects baseVersion = -1", () => {
        const result = update.safeParse({ baseVersion: -1 });
        expect(result.success).toBe(false);
      });

      it("rejects unknown field in update payload", () => {
        const result = update.safeParse({ hackerField: "evil" });
        expect(result.success).toBe(false);
      });
    });
  }
);

// ---------------------------------------------------------------------------
// In-depth field-level validation for representative entities
// ---------------------------------------------------------------------------

describe("task — field-level validation", () => {
  it("rejects empty title", () => {
    expect(taskCreate.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects title longer than 500 chars", () => {
    expect(
      taskCreate.safeParse({ title: "x".repeat(501) }).success
    ).toBe(false);
  });

  it("accepts valid status values: todo, doing, done", () => {
    for (const status of ["todo", "doing", "done"]) {
      expect(
        taskCreate.safeParse({ title: "T", status }).success
      ).toBe(true);
    }
  });

  it("rejects invalid status value", () => {
    expect(
      taskCreate.safeParse({ title: "T", status: "invalid" }).success
    ).toBe(false);
  });

  it("rejects invalid priority value", () => {
    expect(
      taskCreate.safeParse({ title: "T", priority: "urgent" }).success
    ).toBe(false);
  });

  it("accepts valid priority values: low, medium, high", () => {
    for (const priority of ["low", "medium", "high"]) {
      expect(
        taskCreate.safeParse({ title: "T", priority }).success
      ).toBe(true);
    }
  });

  it("applies defaults for status, priority, category", () => {
    const result = taskCreate.safeParse({ title: "T" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("todo");
      expect(result.data.priority).toBe("medium");
      expect(result.data.category).toBe("general");
    }
  });
});

describe("expense — field-level validation", () => {
  it("accepts a positive amount", () => {
    expect(expenseCreate.safeParse({ amount: 50000 }).success).toBe(true);
  });

  it("accepts zero amount", () => {
    expect(expenseCreate.safeParse({ amount: 0 }).success).toBe(true);
  });

  it("accepts a negative amount (refunds)", () => {
    expect(expenseCreate.safeParse({ amount: -100 }).success).toBe(true);
  });

  it("rejects NaN amount", () => {
    expect(expenseCreate.safeParse({ amount: NaN }).success).toBe(false);
  });

  it("rejects Infinity amount", () => {
    expect(expenseCreate.safeParse({ amount: Infinity }).success).toBe(false);
  });

  it("rejects string amount", () => {
    expect(expenseCreate.safeParse({ amount: "50000" }).success).toBe(false);
  });

  it("accepts valid currency values: syp, usd", () => {
    for (const currency of ["syp", "usd"]) {
      expect(
        expenseCreate.safeParse({ amount: 100, currency }).success
      ).toBe(true);
    }
  });

  it("rejects invalid currency", () => {
    expect(
      expenseCreate.safeParse({ amount: 100, currency: "eur" }).success
    ).toBe(false);
  });
});

describe("happiness — field-level validation", () => {
  it("accepts score 1 (minimum)", () => {
    expect(
      happinessCreate.safeParse({ date: "2024-01-01T00:00:00Z", score: 1 })
        .success
    ).toBe(true);
  });

  it("accepts score 10 (maximum)", () => {
    expect(
      happinessCreate.safeParse({ date: "2024-01-01T00:00:00Z", score: 10 })
        .success
    ).toBe(true);
  });

  it("rejects score 0 (below minimum)", () => {
    expect(
      happinessCreate.safeParse({ date: "2024-01-01T00:00:00Z", score: 0 })
        .success
    ).toBe(false);
  });

  it("rejects score 11 (above maximum)", () => {
    expect(
      happinessCreate.safeParse({ date: "2024-01-01T00:00:00Z", score: 11 })
        .success
    ).toBe(false);
  });

  it("rejects non-integer score", () => {
    expect(
      happinessCreate.safeParse({ date: "2024-01-01T00:00:00Z", score: 5.5 })
        .success
    ).toBe(false);
  });

  it("rejects missing date", () => {
    expect(happinessCreate.safeParse({ score: 5 }).success).toBe(false);
  });

  it("rejects missing score", () => {
    expect(
      happinessCreate.safeParse({ date: "2024-01-01T00:00:00Z" }).success
    ).toBe(false);
  });
});

describe("budget — field-level validation", () => {
  it("accepts a valid budget", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: 50000, month: 6, year: 2024 })
        .success
    ).toBe(true);
  });

  it("rejects limit of 0 (must be positive)", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: 0, month: 1, year: 2024 })
        .success
    ).toBe(false);
  });

  it("rejects negative limit", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: -1, month: 1, year: 2024 })
        .success
    ).toBe(false);
  });

  it("rejects month=0", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: 100, month: 0, year: 2024 })
        .success
    ).toBe(false);
  });

  it("rejects month=13", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: 100, month: 13, year: 2024 })
        .success
    ).toBe(false);
  });

  it("rejects year=1999 (below min)", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: 100, month: 1, year: 1999 })
        .success
    ).toBe(false);
  });

  it("rejects year=2101 (above max)", () => {
    expect(
      budgetCreate.safeParse({ category: "food", limit: 100, month: 1, year: 2101 })
        .success
    ).toBe(false);
  });
});

describe("contact — field-level validation", () => {
  it("rejects invalid email format", () => {
    expect(
      contactCreate.safeParse({ name: "A", phone: "+1", email: "not-an-email" })
        .success
    ).toBe(false);
  });

  it("accepts valid email", () => {
    expect(
      contactCreate.safeParse({ name: "A", phone: "+1", email: "a@b.com" })
        .success
    ).toBe(true);
  });

  it("accepts valid relation values", () => {
    for (const relation of ["family", "friend", "work", "business", "other"]) {
      expect(
        contactCreate.safeParse({ name: "A", phone: "+1", relation }).success
      ).toBe(true);
    }
  });

  it("rejects invalid relation", () => {
    expect(
      contactCreate.safeParse({ name: "A", phone: "+1", relation: "enemy" })
        .success
    ).toBe(false);
  });
});

describe("integration — field-level validation", () => {
  it("accepts valid service names", () => {
    const valid = [
      "google_calendar",
      "google_drive",
      "telegram",
      "email",
      "github",
      "google_contacts",
      "cloud_sync",
    ];
    for (const service of valid) {
      expect(
        integrationCreate.safeParse({ service, name: "Test" }).success
      ).toBe(true);
    }
  });

  it("rejects invalid service name", () => {
    expect(
      integrationCreate.safeParse({ service: "slack", name: "Test" }).success
    ).toBe(false);
  });
});

describe("pantry — field-level validation", () => {
  it("rejects negative quantity", () => {
    expect(
      pantryCreate.safeParse({ name: "Rice", quantity: -1 }).success
    ).toBe(false);
  });

  it("accepts quantity=0", () => {
    expect(
      pantryCreate.safeParse({ name: "Rice", quantity: 0 }).success
    ).toBe(true);
  });

  it("rejects non-integer quantity", () => {
    expect(
      pantryCreate.safeParse({ name: "Rice", quantity: 1.5 }).success
    ).toBe(false);
  });

  it("accepts valid units", () => {
    for (const unit of ["piece", "kg", "g", "l", "ml", "pack"]) {
      expect(
        pantryCreate.safeParse({ name: "Rice", unit }).success
      ).toBe(true);
    }
  });

  it("rejects invalid unit", () => {
    expect(
      pantryCreate.safeParse({ name: "Rice", unit: "box" }).success
    ).toBe(false);
  });
});

describe("project — field-level validation", () => {
  it("rejects progress below 0", () => {
    expect(
      projectCreate.safeParse({ name: "P", progress: -1 }).success
    ).toBe(false);
  });

  it("rejects progress above 100", () => {
    expect(
      projectCreate.safeParse({ name: "P", progress: 101 }).success
    ).toBe(false);
  });

  it("accepts progress=0 and progress=100", () => {
    expect(
      projectCreate.safeParse({ name: "P", progress: 0 }).success
    ).toBe(true);
    expect(
      projectCreate.safeParse({ name: "P", progress: 100 }).success
    ).toBe(true);
  });

  it("rejects non-integer progress", () => {
    expect(
      projectCreate.safeParse({ name: "P", progress: 50.5 }).success
    ).toBe(false);
  });
});
