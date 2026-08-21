// POST /api/migrate-guest
//
// One-time bulk import of guest local data into the cloud DB for the
// currently authenticated user. Receives a JSON body keyed by entity name
// (e.g. { contacts: [...], notes: [...], ... }) and upserts each record
// keyed by the client-side id, so re-running migration is safe.
//
// Security: userId is ALWAYS derived from the signed session — never from
// the request body. A guest trying to impersonate another user is rejected
// with 401. Records from user A can never end up under user B.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

// Max records per entity to prevent abuse. A typical guest has < 1k records.
const MAX_PER_ENTITY = 5000;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "يلزم تسجيل الدخول لنقل البيانات" },
      { status: 401 }
    );
  }
  const userId = user.id; // source of truth — never trust client userId

  let body: Record<string, any[]>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "جسم الطلب غير صالح" },
      { status: 400 }
    );
  }

  let migrated = 0;
  let skipped = 0;
  const failed: string[] = [];

  // ---- Contacts -------------------------------------------------------------
  if (Array.isArray(body.contacts)) {
    const arr = body.contacts.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.id || !item.name || !item.phone) {
          skipped++;
          continue;
        }
        const existing = await db.contact.findUnique({ where: { id: item.id } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.contact.create({
          data: {
            id: item.id,
            userId,
            name: item.name,
            phone: item.phone,
            whatsapp: item.whatsapp || null,
            email: item.email || null,
            relation: item.relation || "other",
            category: item.category || null,
            note: item.note || null,
            favorite: item.favorite || false,
            avatar: item.avatar || null,
            deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
          },
        });
        migrated++;
      } catch (e) {
        failed.push(`contact:${item.id}`);
      }
    }
  }

  // ---- CallLogs -------------------------------------------------------------
  if (Array.isArray(body.callLogs)) {
    const arr = body.callLogs.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.id) {
          skipped++;
          continue;
        }
        const existing = await db.callLog.findUnique({ where: { id: item.id } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.callLog.create({
          data: {
            id: item.id,
            userId,
            contactId: item.contactId || null,
            name: item.name || "",
            phone: item.phone || "",
            type: item.type || "call",
            direction: item.direction || "outgoing",
            note: item.note || null,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
          },
        });
        migrated++;
      } catch (e) {
        failed.push(`callLog:${item.id}`);
      }
    }
  }

  // ---- Notes ----------------------------------------------------------------
  if (Array.isArray(body.notes)) {
    const arr = body.notes.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.id) {
          skipped++;
          continue;
        }
        const existing = await db.note.findUnique({ where: { id: item.id } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.note.create({
          data: {
            id: item.id,
            userId,
            title: item.title || "Untitled",
            content: item.content || "",
            color: item.color || "default",
            pinned: item.pinned || false,
            deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
          },
        });
        migrated++;
      } catch (e) {
        failed.push(`note:${item.id}`);
      }
    }
  }

  // ---- Events ---------------------------------------------------------------
  if (Array.isArray(body.events)) {
    const arr = body.events.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.id || !item.startDate) {
          skipped++;
          continue;
        }
        const existing = await db.event.findUnique({ where: { id: item.id } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.event.create({
          data: {
            id: item.id,
            userId,
            title: item.title || "Untitled",
            description: item.description || null,
            startDate: new Date(item.startDate),
            endDate: item.endDate ? new Date(item.endDate) : null,
            allDay: item.allDay || false,
            type: item.type || "personal",
            color: item.color || "emerald",
            location: item.location || null,
            deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
          },
        });
        migrated++;
      } catch (e) {
        failed.push(`event:${item.id}`);
      }
    }
  }

  // ---- Tasks ----------------------------------------------------------------
  if (Array.isArray(body.tasks)) {
    const arr = body.tasks.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.id) {
          skipped++;
          continue;
        }
        const existing = await db.task.findUnique({ where: { id: item.id } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.task.create({
          data: {
            id: item.id,
            userId,
            title: item.title || "Untitled",
            description: item.description || null,
            status: item.status || "todo",
            priority: item.priority || "medium",
            category: item.category || "general",
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            projectId: item.projectId || null,
            deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
          },
        });
        migrated++;
      } catch (e) {
        failed.push(`task:${item.id}`);
      }
    }
  }

  // ---- Expenses -------------------------------------------------------------
  if (Array.isArray(body.expenses)) {
    const arr = body.expenses.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.id) {
          skipped++;
          continue;
        }
        const existing = await db.expense.findUnique({ where: { id: item.id } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.expense.create({
          data: {
            id: item.id,
            userId,
            amount: Number(item.amount) || 0,
            currency: item.currency || "syp",
            category: item.category || "general",
            description: item.description || null,
            date: item.date ? new Date(item.date) : undefined,
            deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
            updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
          },
        });
        migrated++;
      } catch (e) {
        failed.push(`expense:${item.id}`);
      }
    }
  }

  // ---- AppSettings (upsert by userId+key) ----------------------------------
  if (Array.isArray(body.appSettings)) {
    const arr = body.appSettings.slice(0, MAX_PER_ENTITY);
    for (const item of arr) {
      try {
        if (!item.key) {
          skipped++;
          continue;
        }
        await db.appSetting.upsert({
          where: { userId_key: { userId, key: item.key } },
          update: { value: String(item.value ?? "") },
          create: { userId, key: item.key, value: String(item.value ?? "") },
        });
        migrated++;
      } catch (e) {
        failed.push(`appSetting:${item.key}`);
      }
    }
  }

  // For brevity, the remaining entities (budgets, assets, accounts, debts,
  // projects, meetings, occasions, diaryEntries, habits, medications,
  // sleepLogs, pantryItems, waitingItems, savedLocations, contactReminders,
  // happinessLogs, quranLogs, integrations, activityLogs, scheduledMessages,
  // automationRules, suggestions) follow the same pattern. They are handled
  // by a generic upsert loop below to keep this file manageable.

  const GENERIC_ENTITIES = [
    "budgets",
    "assets",
    "accounts",
    "debts",
    "projects",
    "meetings",
    "occasions",
    "diaryEntries",
    "habits",
    "medications",
    "sleepLogs",
    "pantryItems",
    "waitingItems",
    "savedLocations",
    "contactReminders",
    "happinessLogs",
    "quranLogs",
    "integrations",
    "activityLogs",
    "scheduledMessages",
    "automationRules",
    "suggestions",
  ] as const;

  for (const entityName of GENERIC_ENTITIES) {
    const arr = body[entityName];
    if (!Array.isArray(arr)) continue;
    for (const item of arr.slice(0, MAX_PER_ENTITY)) {
      try {
        if (!item.id) {
          skipped++;
          continue;
        }
        // Defensive: strip userId from the item — we always use our own.
        const { userId: _drop, id, ...rest } = item;
        // Use a switch on entityName → prisma delegate. To keep this file
        // short, we use a small lookup table via (db as any).
        const prismaDelegate = (db as any)[entityNameToPrisma(entityName)];
        if (!prismaDelegate) {
          skipped++;
          continue;
        }
        const existing = await prismaDelegate.findUnique({ where: { id } });
        if (existing) {
          skipped++;
          continue;
        }
        await prismaDelegate.create({
          data: { id, userId, ...coerceDates(rest, entityName) },
        });
        migrated++;
      } catch (e) {
        failed.push(`${entityName}:${item.id}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    migrated,
    skipped,
    failed,
    userId,
  });
}

// Map plural payload keys to Prisma delegate names.
function entityNameToPrisma(plural: string): string {
  const map: Record<string, string> = {
    budgets: "budget",
    assets: "asset",
    accounts: "account",
    debts: "debt",
    projects: "project",
    meetings: "meeting",
    occasions: "occasion",
    diaryEntries: "diaryEntry",
    habits: "habit",
    medications: "medication",
    sleepLogs: "sleepLog",
    pantryItems: "pantryItem",
    waitingItems: "waitingItem",
    savedLocations: "savedLocation",
    contactReminders: "contactReminder",
    happinessLogs: "happinessLog",
    quranLogs: "quranLog",
    integrations: "integration",
    activityLogs: "activityLog",
    scheduledMessages: "scheduledMessage",
    automationRules: "automationRule",
    suggestions: "suggestion",
  };
  return map[plural] || plural;
}

// Convert known date fields from strings to Date objects for Prisma.
function coerceDates(rest: Record<string, any>, entity: string): Record<string, any> {
  const DATE_FIELDS: Record<string, string[]> = {
    budget: [],
    asset: [],
    account: [],
    debt: ["dueDate", "settledAt", "deletedAt"],
    project: ["startDate", "endDate", "deletedAt"],
    meeting: ["startDate", "endDate", "deletedAt"],
    occasion: ["date"],
    diaryEntry: ["date", "deletedAt"],
    habit: [],
    medication: ["startDate", "endDate", "deletedAt"],
    sleepLog: ["date", "bedtime", "wakeTime"],
    pantryItem: [],
    waitingItem: [],
    savedLocation: [],
    contactReminder: ["lastContacted", "nextReminder"],
    happinessLog: ["date"],
    quranLog: ["date"],
    integration: ["lastSync"],
    activityLog: [],
    scheduledMessage: ["scheduledAt", "sentAt", "deletedAt"],
    automationRule: [],
    suggestion: [],
  };
  const fields = DATE_FIELDS[entity] || [];
  const out: Record<string, any> = { ...rest };
  for (const f of fields) {
    if (out[f] !== undefined && out[f] !== null) {
      try {
        out[f] = new Date(out[f]);
      } catch {
        // leave as-is
      }
    }
  }
  return out;
}
