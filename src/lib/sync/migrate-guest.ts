"use client";

// Guest → Cloud migration.
//
// When a guest user signs in for the first time, their localStorage data
// (collected by the offline-first fetch interceptor) is uploaded to the
// cloud DB and associated with their new userId. This is a one-time bulk
// import; subsequent writes go directly to the cloud (the interceptor is
// disabled when a session cookie is present).
//
// Safety properties:
//   - Never deletes local data on failure (only on confirmed success).
//   - Idempotent: re-running migration skips records whose client id
//     already exists in the cloud.
//   - Resumable: each entity is migrated independently; a partial failure
//     can be retried without duplicating already-migrated entities.

import { db as localDb } from "@/lib/local/db";

// Map local-storage collection names → API entity endpoints.
// Keep this in sync with the server-side /api/migrate-guest handler.
const COLLECTION_MAP: Record<string, { entity: string; payloadKey: string }> = {
  contacts: { entity: "contact", payloadKey: "contacts" },
  callLogs: { entity: "callLog", payloadKey: "callLogs" },
  notes: { entity: "note", payloadKey: "notes" },
  events: { entity: "event", payloadKey: "events" },
  tasks: { entity: "task", payloadKey: "tasks" },
  expenses: { entity: "expense", payloadKey: "expenses" },
  budgets: { entity: "budget", payloadKey: "budgets" },
  assets: { entity: "asset", payloadKey: "assets" },
  accounts: { entity: "account", payloadKey: "accounts" },
  debts: { entity: "debt", payloadKey: "debts" },
  projects: { entity: "project", payloadKey: "projects" },
  meetings: { entity: "meeting", payloadKey: "meetings" },
  occasions: { entity: "occasion", payloadKey: "occasions" },
  diaryEntries: { entity: "diaryEntry", payloadKey: "diaryEntries" },
  habits: { entity: "habit", payloadKey: "habits" },
  medications: { entity: "medication", payloadKey: "medications" },
  sleepLogs: { entity: "sleepLog", payloadKey: "sleepLogs" },
  pantryItems: { entity: "pantryItem", payloadKey: "pantryItems" },
  waitingItems: { entity: "waitingItem", payloadKey: "waitingItems" },
  savedLocations: { entity: "savedLocation", payloadKey: "savedLocations" },
  contactReminders: { entity: "contactReminder", payloadKey: "contactReminders" },
  happinessLogs: { entity: "happinessLog", payloadKey: "happinessLogs" },
  quranLogs: { entity: "quranLog", payloadKey: "quranLogs" },
  integrations: { entity: "integration", payloadKey: "integrations" },
  activityLogs: { entity: "activityLog", payloadKey: "activityLogs" },
  scheduledMessages: {
    entity: "scheduledMessage",
    payloadKey: "scheduledMessages",
  },
  automationRules: { entity: "automationRule", payloadKey: "automationRules" },
  suggestions: { entity: "suggestion", payloadKey: "suggestions" },
  appSettings: { entity: "appSetting", payloadKey: "appSettings" },
};

export interface MigrationResult {
  migrated: number;
  skipped: number;
  failed: string[];
}

/**
 * Migrate all guest local data to the cloud for the currently authenticated
 * user. Safe to call multiple times — the server dedupes by id.
 */
export async function migrateGuestData(): Promise<MigrationResult | null> {
  if (typeof window === "undefined") return null;
  // If the interceptor isn't installed, there's no local data to migrate.
  if (!(window as any).__localModeReady) {
    // Might still have leftover data from a prior guest session — check.
  }

  const payload: Record<string, unknown[]> = {};
  for (const [collectionName, { payloadKey }] of Object.entries(COLLECTION_MAP)) {
    const items = localDb.getCollection(collectionName);
    if (items && items.length > 0) {
      payload[payloadKey] = items;
    }
  }

  const totalRecords = Object.values(payload).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  if (totalRecords === 0) {
    return { migrated: 0, skipped: 0, failed: [] };
  }

  try {
    const res = await fetch("/api/migrate-guest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Network error" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const result = await res.json();
    return {
      migrated: result.migrated ?? 0,
      skipped: result.skipped ?? 0,
      failed: result.failed ?? [],
    };
  } catch (err) {
    console.error("[migrate-guest] Migration failed:", err);
    // Don't clear local data — the user can retry by reloading after login.
    return null;
  }
}

/**
 * Clear all guest local data. Only call after a confirmed successful
 * migration. Removes the localStorage DB and the migration marker.
 */
export function clearGuestData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("dashboard-db");
    window.localStorage.removeItem("guest-migrated");
  } catch {
    // ignore
  }
}
