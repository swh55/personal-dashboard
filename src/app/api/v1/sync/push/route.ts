// =============================================================================
// POST /api/v1/sync/push — push offline changes to the cloud
// =============================================================================
// Body:
//   {
//     changes: [
//       {
//         operationId: "uuid",          // idempotency key (required)
//         entity: "tasks",              // plural entity name
//         entityId: "client-cuid",      // for create, this becomes the new id
//         operation: "create"|"update"|"delete",
//         baseVersion: 4,               // for update — optimistic concurrency
//         payload: { ... }              // the record fields
//       },
//       ...
//     ]
//   }
//
// Response:
//   {
//     success: true,
//     data: {
//       results: [
//         { operationId, status: "applied"|"replayed"|"conflict"|"error", entityId, version?, error? }
//       ]
//     }
//   }
//
// Semantics:
//   - Idempotent: replaying the same operationId returns the original result.
//   - Atomic per-change: each change is its own transaction. A failure in one
//     does not roll back others (the client gets per-change results).
//   - Conflict: if baseVersion doesn't match, status="conflict" with the
//     current server version so the client can merge.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { getSyncEntity, getDelegate, recordSyncEvent, serializeForSync } from "@/lib/api/sync";
import {
  apiSuccess,
  apiValidationError,
  apiInternalError,
  apiBadRequest,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

const MAX_CHANGES = 100;

const ChangeSchema = z.object({
  operationId: z.string().min(1).max(200),
  entity: z.string().min(1),
  entityId: z.string().min(1).max(100),
  operation: z.enum(["create", "update", "delete"]),
  baseVersion: z.number().int().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const PushSchema = z
  .object({
    changes: z.array(ChangeSchema).min(1).max(MAX_CHANGES),
  })
  .strict();

type PushResult = {
  operationId: string;
  status: "applied" | "replayed" | "conflict" | "error" | "skipped";
  entityId?: string;
  version?: number;
  error?: string;
};

export async function POST(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, deviceId } = pr.principal;

  const parsed = await parseBody(req, PushSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { changes } = parsed.data;

  const results: PushResult[] = [];

  for (const change of changes) {
    try {
      const result = await applyChange(change, userId, deviceId);
      results.push(result);
    } catch (err) {
      console.error(`[sync/push] change error (${change.operationId}):`, err);
      results.push({
        operationId: change.operationId,
        status: "error",
        entityId: change.entityId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return apiSuccess({ results });
}

async function applyChange(
  change: z.infer<typeof ChangeSchema>,
  userId: string,
  deviceId: string | undefined
): Promise<PushResult> {
  const { operationId, entity: entityPlural, entityId, operation, baseVersion, payload } = change;

  // Resolve the entity config
  const entityConfig = getSyncEntity(entityPlural);
  if (!entityConfig) {
    return {
      operationId,
      status: "error",
      entityId,
      error: `Unknown entity: ${entityPlural}`,
    };
  }
  const delegate = getDelegate(entityConfig.delegate);
  if (!delegate) {
    return {
      operationId,
      status: "error",
      entityId,
      error: `Entity ${entityPlural} is not sync-enabled`,
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // --- Idempotency check ---
      const existing = await tx.syncEvent.findUnique({
        where: {
          userId_operationId: { userId, operationId },
        },
      });
      if (existing) {
        return {
          status: "replayed" as const,
          entityId: existing.entityId,
          version: undefined,
        };
      }

      // --- Apply the operation ---
      if (operation === "create") {
        // For creates, the client supplies the entityId (cuid). We upsert so
        // that a replayed create (with the same id) doesn't fail.
        const data = { ...(payload ?? {}), id: entityId, userId, version: 1 };
        // Strip server-managed fields
        delete (data as any).createdAt;
        delete (data as any).updatedAt;
        delete (data as any).deletedAt;

        const created = await (tx as any)[entityConfig.delegate].upsert({
          where: { id: entityId },
          update: { ...data, version: { increment: 1 } },
          create: data,
        });
        await recordSyncEvent(tx, {
          userId,
          entity: entityConfig.delegate,
          entityId,
          operation: "create",
          payload: serializeForSync(created),
          operationId,
          deviceId,
        });
        return { status: "applied" as const, entityId, version: created.version };
      }

      if (operation === "update") {
        // Find the existing record + verify ownership
        const existing = await (tx as any)[entityConfig.delegate].findUnique({
          where: { id: entityId },
        });
        if (!existing || existing.userId !== userId) {
          return { status: "error" as const, entityId, error: "Record not found", version: undefined };
        }
        // Conflict detection
        if (
          baseVersion !== undefined &&
          typeof existing.version === "number" &&
          existing.version !== baseVersion
        ) {
          return {
            status: "conflict" as const,
            entityId,
            version: existing.version,
          };
        }
        const updateData = { ...(payload ?? {}) };
        delete (updateData as any).id;
        delete (updateData as any).userId;
        delete (updateData as any).createdAt;
        delete (updateData as any).updatedAt;
        delete (updateData as any).deletedAt;
        delete (updateData as any).baseVersion;

        const updated = await (tx as any)[entityConfig.delegate].update({
          where: { id: entityId },
          data: { ...updateData, version: { increment: 1 } },
        });
        await recordSyncEvent(tx, {
          userId,
          entity: entityConfig.delegate,
          entityId,
          operation: "update",
          payload: serializeForSync(updated),
          operationId,
          deviceId,
        });
        return { status: "applied" as const, entityId, version: updated.version };
      }

      if (operation === "delete") {
        const existing = await (tx as any)[entityConfig.delegate].findUnique({
          where: { id: entityId },
        });
        if (!existing || existing.userId !== userId) {
          return { status: "error" as const, entityId, error: "Record not found", version: undefined };
        }
        if (entityConfig.softDelete) {
          await (tx as any)[entityConfig.delegate].update({
            where: { id: entityId },
            data: { deletedAt: new Date(), version: { increment: 1 } },
          });
        } else {
          await (tx as any)[entityConfig.delegate].delete({
            where: { id: entityId },
          });
        }
        await recordSyncEvent(tx, {
          userId,
          entity: entityConfig.delegate,
          entityId,
          operation: "delete",
          payload: { id: entityId },
          operationId,
          deviceId,
        });
        return { status: "applied" as const, entityId };
      }

      return { status: "error" as const, entityId, error: `Unknown operation: ${operation}`, version: undefined };
    });

    return {
      operationId,
      status: result.status,
      entityId: result.entityId,
      version: result.version,
      error: result.status === "error" ? result.error : undefined,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return {
          operationId,
          status: "error",
          entityId,
          error: "Unique constraint violation",
        };
      }
      if (err.code === "P2025") {
        return {
          operationId,
          status: "error",
          entityId,
          error: "Record not found",
        };
      }
    }
    throw err;
  }
}
