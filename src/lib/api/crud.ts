// =============================================================================
// v1 API — generic CRUD factory
// =============================================================================
// Centralises all the cross-cutting concerns that the existing /api/* routes
// duplicated 45 times:
//
//   - Dual auth (cookie session OR bearer token)
//   - Zod strict validation (mass-assignment protection)
//   - Ownership enforcement (userId from session, never from client)
//   - Pagination + filtering + sorting + search
//   - Soft-delete (deletedAt) with optional ?force=true hard-delete
//   - Optimistic concurrency (version field) with 409 conflict detection
//   - SyncEvent recording (for delta sync) inside the same transaction
//   - Activity logging
//   - Unified response shape ({ success, data } / { success, error })
//
// Each domain route file is a thin declaration that passes its config to the
// factory and re-exports the generated handlers.
//
//   // src/app/api/v1/tasks/route.ts
//   export const { GET, POST } = createCollectionHandlers(tasksConfig);
//
//   // src/app/api/v1/tasks/[id]/route.ts
//   export const { GET, PATCH, DELETE } = createItemHandlers(tasksConfig);

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePrincipal, assertOwnership } from "./auth-v1";
import { recordSyncEvent, serializeForSync } from "./sync";
import {
  parsePagination,
  buildPaginationMeta,
  parseFilters,
  parseSort,
  parseSearch,
  parseDateRange,
  parseIncludeDeleted,
} from "./pagination";
import {
  apiSuccess,
  apiCreated,
  apiNoContent,
  apiList,
  apiValidationError,
  apiNotFound,
  apiConflict,
  apiInternalError,
  apiMethodNotAllowed,
  apiBadRequest,
} from "./response";
import { parseBody } from "./validation";
import type { ZodSchema } from "zod";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------
export interface CrudConfig {
  /** Prisma model delegate (e.g. db.task). */
  model: any;
  /** Plural entity name for the sync protocol + activity log (e.g. "tasks"). */
  entity: string;
  /** Human-readable Arabic name for activity messages (e.g. "مهمة"). */
  entityLabel: string;
  /** Zod schema for create bodies (must be .strict()). */
  createSchema: ZodSchema;
  /** Zod schema for update bodies (must be .strict(), all fields optional). */
  updateSchema: ZodSchema;
  /** Fields allowed in ?field=value filters. */
  filterableFields?: string[];
  /** Fields allowed in ?sort=field (or -field for desc). */
  sortableFields?: string[];
  /** Fields to search across when ?search= is supplied. */
  searchableFields?: string[];
  /** Whether this entity supports soft-delete (has deletedAt). Default true. */
  softDelete?: boolean;
  /** Prisma relations to include in responses (e.g. { project: true }). */
  defaultInclude?: Record<string, boolean>;
  /** Default sort when none is requested. */
  defaultSort?: { field: string; dir: "asc" | "desc" };
  /** Optional hook to transform the create payload before it reaches Prisma. */
  beforeCreate?: (data: any, userId: string) => any;
  /** Optional hook to transform the update payload. */
  beforeUpdate?: (data: any, userId: string) => any;
  /** Optional hook to run after a record is created (outside the txn). */
  afterCreate?: (record: any, userId: string) => Promise<void>;
  /** Whether to record SyncEvents for this entity (default true). */
  syncEnabled?: boolean;
}

// ---------------------------------------------------------------------------
// Collection handlers:  GET (list) + POST (create)
// ---------------------------------------------------------------------------
export function createCollectionHandlers(config: CrudConfig) {
  const {
    model,
    entity,
    entityLabel,
    createSchema,
    filterableFields = [],
    sortableFields = ["createdAt", "updatedAt"],
    searchableFields = [],
    defaultInclude,
    defaultSort = { field: "createdAt", dir: "desc" },
    beforeCreate,
    afterCreate,
    syncEnabled = true,
  } = config;

  const softDelete = config.softDelete ?? true;

  // --- GET /api/v1/{entity} ---
  async function GET(req: NextRequest): Promise<NextResponse> {
    const pr = await requirePrincipal(req);
    if (!pr.ok) return pr.response;
    const { userId } = pr.principal;

    const { page, pageSize, skip, take } = parsePagination(req);
    const filters = parseFilters(req, filterableFields);
    const sort = parseSort(req, sortableFields, defaultSort);
    const search = parseSearch(req);
    const includeDeleted = parseIncludeDeleted(req);

    const where: Record<string, unknown> = { userId };
    if (softDelete && !includeDeleted) where.deletedAt = null;
    for (const [k, v] of Object.entries(filters)) {
      where[k] = v;
    }
    // Date range — applied to `date` field if the entity has one, else `createdAt`.
    const dateRange = parseDateRange(req);
    if (dateRange) {
      where.OR = [
        { date: dateRange },
        { createdAt: dateRange },
      ];
    }
    // Full-text-like search across whitelisted string fields.
    if (search && searchableFields.length > 0) {
      where.AND = (where.AND as unknown[] | undefined) ?? [];
      (where.AND as unknown[]).push({
        OR: searchableFields.map((f) => ({ [f]: { contains: search, mode: "insensitive" } })),
      });
    }

    try {
      const [rows, total] = await Promise.all([
        model.findMany({
          where,
          skip,
          take,
          orderBy: { [sort.field]: sort.dir },
          include: defaultInclude,
        }),
        model.count({ where }),
      ]);
      return apiList(rows, buildPaginationMeta(page, pageSize, total));
    } catch (err) {
      console.error(`[v1:${entity}] GET list error:`, err);
      return apiInternalError();
    }
  }

  // --- POST /api/v1/{entity} ---
  async function POST(req: NextRequest): Promise<NextResponse> {
    const pr = await requirePrincipal(req);
    if (!pr.ok) return pr.response;
    const { userId, deviceId } = pr.principal;

    const parsed = await parseBody(req, createSchema);
    if (!parsed.ok) return parsed.response as NextResponse;
    let data = parsed.data as Record<string, unknown>;

    if (beforeCreate) data = beforeCreate(data, userId);

    try {
      const record = await db.$transaction(async (tx) => {
        const created = await (tx as any)[entity].create({
          data: { ...data, userId, version: 1 },
          include: defaultInclude,
        });
        if (syncEnabled) {
          await recordSyncEvent(tx, {
            userId,
            entity,
            entityId: created.id,
            operation: "create",
            payload: serializeForSync(created),
            deviceId,
          });
        }
        return created;
      });

      // Activity log + afterCreate hook run outside the transaction.
      await logActivity("create", entity, `أضيف ${entityLabel}`, userId).catch(() => {});
      if (afterCreate) {
        await afterCreate(record, userId).catch((e) =>
          console.error(`[v1:${entity}] afterCreate hook error:`, e)
        );
      }
      return apiCreated(record);
    } catch (err) {
      console.error(`[v1:${entity}] POST create error:`, err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          return apiConflict("A record with this unique key already exists");
        }
      }
      return apiInternalError();
    }
  }

  return { GET, POST };
}

// ---------------------------------------------------------------------------
// Item handlers:  GET /:id + PATCH /:id + DELETE /:id
// ---------------------------------------------------------------------------
export function createItemHandlers(config: CrudConfig) {
  const {
    model,
    entity,
    entityLabel,
    updateSchema,
    defaultInclude,
    beforeUpdate,
    syncEnabled = true,
  } = config;

  const softDelete = config.softDelete ?? true;

  // Shared: load a record, verify ownership, return it or a 404.
  async function loadOwned(
    tx: Prisma.TransactionClient | typeof db,
    id: string,
    userId: string,
    includeDeleted = false
  ) {
    const record = await (tx as any)[entity].findUnique({
      where: { id },
      include: defaultInclude,
    });
    if (!record) return null;
    // Ownership check — never trust the client.
    if (record.userId !== userId) return null;
    // Hide soft-deleted records unless explicitly requested.
    if (softDelete && record.deletedAt && !includeDeleted) return null;
    return record;
  }

  // --- GET /api/v1/{entity}/:id ---
  async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> {
    const pr = await requirePrincipal(req);
    if (!pr.ok) return pr.response;
    const { userId } = pr.principal;
    const { id } = await params;
    const includeDeleted = parseIncludeDeleted(req);
    try {
      const record = await loadOwned(db, id, userId, includeDeleted);
      if (!record) return apiNotFound();
      return apiSuccess(record);
    } catch (err) {
      console.error(`[v1:${entity}] GET item error:`, err);
      return apiInternalError();
    }
  }

  // --- PATCH /api/v1/{entity}/:id ---
  async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> {
    const pr = await requirePrincipal(req);
    if (!pr.ok) return pr.response;
    const { userId, deviceId } = pr.principal;
    const { id } = await params;

    const parsed = await parseBody(req, updateSchema);
    if (!parsed.ok) return parsed.response as NextResponse;
    let data = parsed.data as Record<string, unknown>;

    if (beforeUpdate) data = beforeUpdate(data, userId);

    // Pull baseVersion from the body for optimistic concurrency. The field is
    // optional in the schema — if absent, we skip the version check (last-write-wins).
    const baseVersion = typeof data.baseVersion === "number" ? data.baseVersion : undefined;
    delete data.baseVersion;
    delete data.id;
    delete data.userId; // never allow reassignment

    try {
      const result = await db.$transaction(async (tx) => {
        const existing = await loadOwned(tx, id, userId);
        if (!existing) return { kind: "notfound" as const };

        // Conflict detection: if the client sent a baseVersion and it doesn't
        // match the current version, reject with 409.
        if (
          baseVersion !== undefined &&
          typeof existing.version === "number" &&
          existing.version !== baseVersion
        ) {
          return {
            kind: "conflict" as const,
            currentVersion: existing.version,
            baseVersion,
          };
        }

        // Increment version atomically.
        const updateData = {
          ...data,
          version: { increment: 1 },
        };

        const updated = await (tx as any)[entity].update({
          where: { id },
          data: updateData,
          include: defaultInclude,
        });

        if (syncEnabled) {
          await recordSyncEvent(tx, {
            userId,
            entity,
            entityId: id,
            operation: "update",
            payload: serializeForSync(updated),
            deviceId,
          });
        }
        return { kind: "ok" as const, record: updated };
      });

      if (result.kind === "notfound") return apiNotFound();
      if (result.kind === "conflict") {
        return apiConflict(
          "Version conflict — the record was modified by another client",
          {
            baseVersion: result.baseVersion,
            currentVersion: result.currentVersion,
            strategy: "Pull the latest version and retry your change.",
          }
        );
      }
      await logActivity("update", entity, `حدّث ${entityLabel}`, userId).catch(() => {});
      return apiSuccess(result.record);
    } catch (err) {
      console.error(`[v1:${entity}] PATCH update error:`, err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2025") return apiNotFound(); // record not found
        if (err.code === "P2002")
          return apiConflict("A record with this unique key already exists");
      }
      return apiInternalError();
    }
  }

  // --- DELETE /api/v1/{entity}/:id ---
  async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> {
    const pr = await requirePrincipal(req);
    if (!pr.ok) return pr.response;
    const { userId, deviceId } = pr.principal;
    const { id } = await params;
    const force = req.nextUrl.searchParams.get("force") === "true";

    try {
      const result = await db.$transaction(async (tx) => {
        const existing = await loadOwned(tx, id, userId, true);
        if (!existing) return { kind: "notfound" as const };

        if (softDelete && !force) {
          // Soft-delete: stamp deletedAt + bump version.
          const updated = await (tx as any)[entity].update({
            where: { id },
            data: { deletedAt: new Date(), version: { increment: 1 } },
          });
          if (syncEnabled) {
            await recordSyncEvent(tx, {
              userId,
              entity,
              entityId: id,
              operation: "delete",
              payload: { id, deletedAt: updated.deletedAt },
              deviceId,
            });
          }
          return { kind: "ok" as const, soft: true as const };
        } else {
          // Hard delete (force=true) or entity doesn't support soft-delete.
          await (tx as any)[entity].delete({ where: { id } });
          if (syncEnabled) {
            await recordSyncEvent(tx, {
              userId,
              entity,
              entityId: id,
              operation: "delete",
              payload: { id },
              deviceId,
            });
          }
          return { kind: "ok" as const, soft: false as const };
        }
      });

      if (result.kind === "notfound") return apiNotFound();
      await logActivity("delete", entity, `حذف ${entityLabel}`, userId).catch(() => {});
      return apiSuccess({ id, deleted: true, soft: result.soft });
    } catch (err) {
      console.error(`[v1:${entity}] DELETE error:`, err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2025") return apiNotFound();
      }
      return apiInternalError();
    }
  }

  return { GET, PATCH, DELETE };
}

// Re-export for route files that need the raw method-not-allowed response.
export { apiMethodNotAllowed, apiBadRequest };
