// =============================================================================
// v1 API — sync event recording + delta sync helpers
// =============================================================================
// Every mutation on a sync-enabled entity writes a SyncEvent row inside the
// same Prisma transaction. SyncEvent is an append-only change log that native
// clients consume via GET /api/v1/sync/pull?cursor=<seq>.
//
// The `seq` field is a per-user monotonic sequence number. It's generated
// atomically by finding the current max seq for the user and adding 1, inside
// a transaction with SERIALIZABLE isolation. On Neon/Postgres this is safe
// because the @@unique([userId, seq]) constraint also backstops any race.

import { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

export type SyncOperation = "create" | "update" | "delete";

export interface RecordSyncEventInput {
  userId: string;
  entity: string;
  entityId: string;
  operation: SyncOperation;
  payload?: unknown;
  operationId?: string;
  deviceId?: string;
}

/**
 * Allocate the next per-user sequence number. Must be called inside a
 * transaction to guarantee monotonicity.
 */
export async function nextSeq(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<bigint> {
  const last = await tx.syncEvent.findFirst({
    where: { userId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  return (last?.seq ?? 0n) + 1n;
}

/**
 * Record a sync event. Call this INSIDE the mutation's Prisma transaction
 * so the event is committed atomically with the data change. If the
 * operationId already exists for this user, the call is a no-op (idempotent
 * replay — the original event is returned instead).
 *
 * Returns the SyncEvent row (or null if it was a duplicate operationId).
 */
export async function recordSyncEvent(
  tx: Prisma.TransactionClient,
  input: RecordSyncEventInput
) {
  // Idempotency: if operationId is supplied and already exists, return the
  // existing event so the caller can return the original response.
  if (input.operationId) {
    const existing = await tx.syncEvent.findUnique({
      where: {
        userId_operationId: {
          userId: input.userId,
          operationId: input.operationId,
        },
      },
    });
    if (existing) return { replayed: true as const, event: existing };
  }

  const seq = await nextSeq(tx, input.userId);
  const event = await tx.syncEvent.create({
    data: {
      userId: input.userId,
      seq,
      entity: input.entity,
      entityId: input.entityId,
      operation: input.operation,
      payload:
        input.payload === undefined
          ? "{}"
          : JSON.stringify(input.payload ?? {}),
      operationId: input.operationId,
      deviceId: input.deviceId,
    },
  });
  return { replayed: false as const, event };
}

/**
 * Serialize a Prisma record for sync payload. Strips internal Prisma fields
 * and converts Date objects to ISO strings for JSON compatibility.
 */
export function serializeForSync(record: unknown): Record<string, unknown> {
  if (record === null || typeof record !== "object") return {};
  const r = record as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (typeof v === "bigint") {
      out[k] = v.toString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sync-enabled entity registry
// ---------------------------------------------------------------------------
// Maps the sync `entity` name to its Prisma delegate + the user-scoped
// identifier field. This is used by the pull endpoint to hydrate payloads
// and by the push endpoint to route operations.

export interface SyncEntityConfig {
  /** Prisma model delegate name (e.g. "task", "contact"). */
  delegate: string;
  /** Plural entity name used in the sync protocol (e.g. "tasks"). */
  plural: string;
  /** Whether this entity supports soft-delete (has deletedAt). */
  softDelete: boolean;
}

/**
 * The full list of sync-enabled entities. Must match the Prisma model names.
 * Append-only models (CallLog, SleepLog, QuranLog, HabitLog, ActivityLog) and
 * key-value stores (AppSetting) are intentionally excluded — they don't
 * support the create/update/delete lifecycle that sync expects.
 */
export const SYNC_ENTITIES: SyncEntityConfig[] = [
  { delegate: "contact", plural: "contacts", softDelete: true },
  { delegate: "note", plural: "notes", softDelete: true },
  { delegate: "event", plural: "events", softDelete: true },
  { delegate: "task", plural: "tasks", softDelete: true },
  { delegate: "expense", plural: "expenses", softDelete: true },
  { delegate: "budget", plural: "budgets", softDelete: true },
  { delegate: "asset", plural: "assets", softDelete: true },
  { delegate: "account", plural: "accounts", softDelete: true },
  { delegate: "debt", plural: "debts", softDelete: true },
  { delegate: "project", plural: "projects", softDelete: true },
  { delegate: "meeting", plural: "meetings", softDelete: true },
  { delegate: "occasion", plural: "occasions", softDelete: true },
  { delegate: "diaryEntry", plural: "diary", softDelete: true },
  { delegate: "habit", plural: "habits", softDelete: true },
  { delegate: "medication", plural: "medications", softDelete: true },
  { delegate: "pantryItem", plural: "pantry", softDelete: true },
  { delegate: "waitingItem", plural: "waiting-list", softDelete: true },
  { delegate: "savedLocation", plural: "locations", softDelete: true },
  { delegate: "contactReminder", plural: "reminders", softDelete: true },
  { delegate: "happinessLog", plural: "happiness", softDelete: true },
  { delegate: "scheduledMessage", plural: "scheduled-messages", softDelete: true },
  { delegate: "automationRule", plural: "automation", softDelete: true },
  { delegate: "suggestion", plural: "suggestions", softDelete: true },
  { delegate: "integration", plural: "integrations", softDelete: true },
];

export function getSyncEntity(plural: string): SyncEntityConfig | undefined {
  return SYNC_ENTITIES.find((e) => e.plural === plural);
}

/**
 * Access a Prisma delegate by model name. We use a typed switch so the
 * compiler catches typos and new models are explicitly wired.
 */
export function getDelegate(model: string): any {
  const map: Record<string, any> = {
    contact: db.contact,
    note: db.note,
    event: db.event,
    task: db.task,
    expense: db.expense,
    budget: db.budget,
    asset: db.asset,
    account: db.account,
    debt: db.debt,
    project: db.project,
    meeting: db.meeting,
    occasion: db.occasion,
    diaryEntry: db.diaryEntry,
    habit: db.habit,
    medication: db.medication,
    pantryItem: db.pantryItem,
    waitingItem: db.waitingItem,
    savedLocation: db.savedLocation,
    contactReminder: db.contactReminder,
    happinessLog: db.happinessLog,
    scheduledMessage: db.scheduledMessage,
    automationRule: db.automationRule,
    suggestion: db.suggestion,
    integration: db.integration,
  };
  return map[model];
}
