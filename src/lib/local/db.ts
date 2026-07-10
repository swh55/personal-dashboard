"use client";

// Local storage-based database for the offline APK mode.
// Mirrors the Prisma API surface used by the API routes so the rest of
// the app keeps calling db.<model>.findMany / create / update / delete
// without knowing it's running on top of localStorage.

import { SEED_DATA } from "./seed-data";

const DB_KEY = "dashboard-db";

type Collection = Record<string, any[]>;

/** Generate a short unique id (cuid-like). */
export function genId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** Read the raw DB object from localStorage. */
function readRaw(): Collection {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Collection;
  } catch {
    return {};
  }
}

/** Persist the DB object to localStorage. */
function writeRaw(data: Collection): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to persist local DB:", e);
  }
}

/** Deep-clone seed data so callers can mutate freely. */
function cloneSeed(): Collection {
  const out: Collection = {};
  for (const [key, value] of Object.entries(SEED_DATA)) {
    out[key] = JSON.parse(JSON.stringify(value));
  }
  return out;
}

/** Initialise the DB with seed data if empty. Safe to call multiple times. */
export function initDB(): void {
  if (typeof window === "undefined") return;
  const existing = window.localStorage.getItem(DB_KEY);
  if (!existing) {
    writeRaw(cloneSeed());
    return;
  }
  // Defensive: ensure all seed collections exist (e.g. new app versions)
  try {
    const parsed = JSON.parse(existing) as Collection;
    const seed = cloneSeed();
    let changed = false;
    for (const key of Object.keys(seed)) {
      if (!parsed[key]) {
        parsed[key] = seed[key];
        changed = true;
      }
    }
    if (changed) writeRaw(parsed);
  } catch {
    writeRaw(cloneSeed());
  }
}

/** Reset the DB back to seed data (used for "factory reset"). */
export function resetDB(): void {
  writeRaw(cloneSeed());
}

/** Export the entire DB as a plain object (for backups). */
export function exportDB(): Collection {
  return readRaw();
}

/** Replace the DB with a plain object (for restoring backups). */
export function importDB(data: Collection): void {
  writeRaw(data);
}

/** Return all items in a collection (or []). */
export function getCollection<T = any>(name: string): T[] {
  const data = readRaw();
  return (data[name] as T[]) || [];
}

/** Overwrite a collection with the given items. */
export function setCollection(name: string, items: any[]): void {
  const data = readRaw();
  data[name] = items;
  writeRaw(data);
}

/** Insert a new item with a generated id (if missing). */
export function insert<T = any>(name: string, item: T): T & { id: string } {
  const data = readRaw();
  const arr = (data[name] as any[]) || [];
  const id = (item as any)?.id || genId();
  const ts = new Date().toISOString();
  const record = {
    ...item,
    id,
    createdAt: (item as any)?.createdAt || ts,
    updatedAt: ts,
  };
  arr.push(record);
  data[name] = arr;
  writeRaw(data);
  return record;
}

/** Update an item by id with a partial patch. Returns the updated record (or null). */
export function update<T = any>(
  name: string,
  id: string,
  data: Partial<T>
): (T & { id: string; updatedAt: string }) | null {
  const dbData = readRaw();
  const arr = (dbData[name] as any[]) || [];
  const idx = arr.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const patch: Record<string, unknown> = { ...data };
  if ("id" in patch) delete patch.id;
  const updated = {
    ...arr[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  arr[idx] = updated;
  dbData[name] = arr;
  writeRaw(dbData);
  return updated;
}

/** Permanently remove an item by id. Returns true if it was found. */
export function remove(name: string, id: string): boolean {
  const data = readRaw();
  const arr = (data[name] as any[]) || [];
  const next = arr.filter((x) => x.id !== id);
  if (next.length === arr.length) return false;
  data[name] = next;
  writeRaw(data);
  return true;
}

/** Soft-delete an item by setting deletedAt = now. Returns true if found. */
export function softDelete(name: string, id: string): boolean {
  const result = update(name, id, { deletedAt: new Date().toISOString() });
  return result !== null;
}

/** Restore a soft-deleted item (set deletedAt = null). */
export function restore(name: string, id: string): boolean {
  const result = update(name, id, { deletedAt: null });
  return result !== null;
}

/** Find a single item by id. */
export function findById<T = any>(name: string, id: string): T | null {
  const arr = getCollection<T>(name);
  return (arr as any[]).find((x) => x.id === id) || null;
}

/** Find the first item matching a predicate. */
export function findFirst<T = any>(
  name: string,
  predicate: (item: T) => boolean
): T | null {
  const arr = getCollection<T>(name);
  return (arr as any[]).find(predicate) || null;
}

/** Count items matching a predicate (defaults to all). */
export function count(name: string, predicate?: (item: any) => boolean): number {
  const arr = getCollection(name);
  if (!predicate) return arr.length;
  return arr.filter(predicate).length;
}

/** Push a new activity log entry. Mirrors `lib/activity.ts`. */
export function logActivity(
  action: string,
  entity: string,
  message: string
): void {
  insert("activityLogs", { action, entity, message });
}

/** Singleton-style export mirroring the Prisma client surface. */
export const db = {
  initDB,
  resetDB,
  exportDB,
  importDB,
  getCollection,
  setCollection,
  insert,
  update,
  remove,
  softDelete,
  restore,
  findById,
  findFirst,
  count,
  logActivity,
  genId,
};

export type LocalDB = typeof db;
