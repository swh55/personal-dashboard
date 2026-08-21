"use client";

// First-Run Detection + Demo Data Seeding
//
// When a user opens the app for the first time (no existing data, no
// first-run flag), we seed DEMO_DATA into localStorage so they can
// explore every feature immediately.
//
// Safety properties:
//   - NEVER overwrites existing user data (checks if any collection is non-empty)
//   - Only runs once per browser (first-run-done flag)
//   - Demo data is marked with `isDemo` prefix on IDs ("demo-*")
//   - A "has-demo-data" flag allows "Clear Demo Data" to selectively remove
//     only demo records without touching real user data.

import { DEMO_DATA, DEMO_FLAG_KEY } from "@/lib/demo-data";
import { db as localDb, getCollection } from "@/lib/local/db";

const FIRST_RUN_FLAG = "first-run-done";

/**
 * Check if ANY real (non-demo) data exists in the local DB.
 * If so, we do NOT seed demo data — we don't want to pollute real data.
 */
function hasRealData(): boolean {
  const collections = [
    "contacts",
    "tasks",
    "events",
    "notes",
    "expenses",
    "diaryEntries",
    "habits",
    "projects",
    "accounts",
    "assets",
    "debts",
  ];
  for (const name of collections) {
    const items = getCollection(name);
    // Real data = any item whose id does NOT start with "demo-"
    const hasReal = items.some((item: any) => !String(item.id || "").startsWith("demo-"));
    if (hasReal) return true;
  }
  return false;
}

/**
 * Seed DEMO_DATA into the local DB. Only runs if:
 *   1. first-run-done flag is NOT set (first visit)
 *   2. No real user data exists (don't pollute)
 *   3. Demo data is not already present (don't duplicate)
 */
export function seedDemoDataOnFirstRun(): void {
  if (typeof window === "undefined") return;
  if (typeof localStorage === "undefined") return;

  try {
    // Already done first run?
    if (localStorage.getItem(FIRST_RUN_FLAG) === "1") return;

    // Does real data exist? If yes, don't seed demo.
    if (hasRealData()) {
      localStorage.setItem(FIRST_RUN_FLAG, "1");
      return;
    }

    // Seed each collection from DEMO_DATA
    for (const [collectionName, items] of Object.entries(DEMO_DATA)) {
      if (!Array.isArray(items) || items.length === 0) continue;
      const existing = getCollection(collectionName);
      // Avoid duplicating if demo data is already there
      const hasDemo = existing.some((item: any) =>
        String(item.id || "").startsWith("demo-")
      );
      if (hasDemo) continue;
      // Merge: existing (empty) + demo items
      localDb.setCollection(collectionName, [...existing, ...items]);
    }

    // Set the demo-data flag so "Clear Demo Data" button can find these
    localStorage.setItem(DEMO_FLAG_KEY, "1");
    // Mark first-run as done so we never re-seed
    localStorage.setItem(FIRST_RUN_FLAG, "1");
    console.log(
      "[first-run] Seeded demo data for first-time visitor. Use 'Clear Demo Data' in Settings to remove."
    );
  } catch (err) {
    console.error("[first-run] Failed to seed demo data:", err);
    // Still mark first-run as done so we don't retry on every load
    try {
      localStorage.setItem(FIRST_RUN_FLAG, "1");
    } catch {}
  }
}

/**
 * Clear ONLY demo data from localStorage. Real user data is preserved.
 * Called from the "مسح البيانات التجريبية" button in Settings.
 */
export function clearDemoData(): { cleared: number; remaining: number } {
  if (typeof window === "undefined") return { cleared: 0, remaining: 0 };
  let cleared = 0;
  let remaining = 0;
  try {
    for (const collectionName of Object.keys(DEMO_DATA)) {
      const items = getCollection(collectionName);
      const filtered = items.filter((item: any) => {
        const isDemo = String(item.id || "").startsWith("demo-");
        if (isDemo) cleared++;
        else remaining++;
        return !isDemo;
      });
      localDb.setCollection(collectionName, filtered);
    }
    localStorage.removeItem(DEMO_FLAG_KEY);
    console.log(`[demo] Cleared ${cleared} demo records. ${remaining} real records preserved.`);
  } catch (err) {
    console.error("[demo] Clear failed:", err);
  }
  return { cleared, remaining };
}

/**
 * Whether the local DB currently has demo data.
 */
export function hasDemoData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}
