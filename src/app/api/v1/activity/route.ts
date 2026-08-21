// =============================================================================
// /api/v1/activity — activity log (read + clear)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import {
  apiSuccess,
  apiList,
  apiInternalError,
} from "@/lib/api/response";
import { parsePagination, buildPaginationMeta } from "@/lib/api/pagination";

export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;
  const { page, pageSize, skip, take } = parsePagination(req);
  const entity = req.nextUrl.searchParams.get("entity") ?? undefined;

  const where: Record<string, unknown> = { userId };
  if (entity) where.entity = entity;

  try {
    const [rows, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      db.activityLog.count({ where }),
    ]);
    return apiList(rows, buildPaginationMeta(page, pageSize, total));
  } catch (err) {
    console.error("[v1:activity] GET error:", err);
    return apiInternalError();
  }
}

export async function DELETE(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const beforeStr = req.nextUrl.searchParams.get("before");
  let before: Date | undefined;
  if (beforeStr) {
    const d = new Date(beforeStr);
    if (!isNaN(d.getTime())) before = d;
  }

  try {
    const where: Record<string, unknown> = { userId };
    if (before) where.createdAt = { lt: before };
    const result = await db.activityLog.deleteMany({ where });
    return apiSuccess({ deleted: result.count });
  } catch (err) {
    console.error("[v1:activity] DELETE error:", err);
    return apiInternalError();
  }
}
