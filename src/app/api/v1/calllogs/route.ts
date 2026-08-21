// =============================================================================
// /api/v1/calllogs — call log (append-only: list + create + delete, NO update)
// =============================================================================
// CallLog is an append-only record (no updatedAt field). It doesn't fit the
// generic CRUD factory (which expects version + updatedAt), so it has a
// custom route. Sync is still supported via SyncEvent recording.
//
// GET    /api/v1/calllogs         — list (paginated, filterable by type/direction/contactId)
// POST   /api/v1/calllogs         — create
// DELETE /api/v1/calllogs?id=xxx  — delete (hard delete — call logs are not soft-deleted)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { recordSyncEvent, serializeForSync } from "@/lib/api/sync";
import {
  apiSuccess,
  apiCreated,
  apiList,
  apiNotFound,
  apiInternalError,
  apiValidationError,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";
import { parsePagination, buildPaginationMeta } from "@/lib/api/pagination";

const CreateSchema = z
  .object({
    contactId: z.string().min(1).max(100).optional().nullable(),
    name: z.string().min(1).max(200),
    phone: z.string().min(1).max(50),
    type: z.enum(["call", "whatsapp", "sms"]).default("call"),
    direction: z.enum(["incoming", "outgoing", "missed"]).default("outgoing"),
    note: z.string().max(2000).optional().nullable(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;
  const { page, pageSize, skip, take } = parsePagination(req);
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") ?? undefined;
  const direction = sp.get("direction") ?? undefined;
  const contactId = sp.get("contactId") ?? undefined;

  const where: Record<string, unknown> = { userId };
  if (type) where.type = type;
  if (direction) where.direction = direction;
  if (contactId) where.contactId = contactId;

  try {
    const [rows, total] = await Promise.all([
      db.callLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { contact: true },
      }),
      db.callLog.count({ where }),
    ]);
    return apiList(rows, buildPaginationMeta(page, pageSize, total));
  } catch (err) {
    console.error("[v1:calllogs] GET error:", err);
    return apiInternalError();
  }
}

export async function POST(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, deviceId } = pr.principal;

  const parsed = await parseBody(req, CreateSchema);
  if (!parsed.ok) return parsed.response as NextResponse;

  try {
    const record = await db.$transaction(async (tx) => {
      const created = await tx.callLog.create({
        data: { ...parsed.data, userId },
      });
      await recordSyncEvent(tx, {
        userId,
        entity: "callLog",
        entityId: created.id,
        operation: "create",
        payload: serializeForSync(created),
        deviceId,
      });
      return created;
    });
    await logActivity("create", "callLog", `سجل مكالمة: ${parsed.data.name}`, userId).catch(() => {});
    return apiCreated(record);
  } catch (err) {
    console.error("[v1:calllogs] POST error:", err);
    return apiInternalError();
  }
}

export async function DELETE(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, deviceId } = pr.principal;
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    return apiValidationError("id query parameter is required");
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.callLog.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) return null;
      await tx.callLog.delete({ where: { id } });
      await recordSyncEvent(tx, {
        userId,
        entity: "callLog",
        entityId: id,
        operation: "delete",
        payload: { id },
        deviceId,
      });
      return existing;
    });
    if (!result) return apiNotFound();
    return apiSuccess({ id, deleted: true });
  } catch (err) {
    console.error("[v1:calllogs] DELETE error:", err);
    return apiInternalError();
  }
}
