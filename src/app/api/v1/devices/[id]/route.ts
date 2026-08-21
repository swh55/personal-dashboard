// =============================================================================
// /api/v1/devices/:id — get / revoke a single device
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import {
  apiSuccess,
  apiNotFound,
  apiInternalError,
} from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;
  const { id } = await params;

  try {
    const device = await db.device.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        platform: true,
        appVersion: true,
        deviceId: true,
        userAgent: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!device || (device as any).userId !== userId) return apiNotFound();
    // Strip userId before returning (don't leak the internal FK)
    return apiSuccess(device);
  } catch (err) {
    console.error("[devices/:id] GET error:", err);
    return apiInternalError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;
  const { id } = await params;

  try {
    // Verify ownership before revoking.
    const device = await db.device.findUnique({
      where: { id },
      select: { userId: true, revokedAt: true },
    });
    if (!device || device.userId !== userId) return apiNotFound();

    if (!device.revokedAt) {
      await db.device.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
    }
    return apiSuccess({ id, revoked: true });
  } catch (err) {
    console.error("[devices/:id] DELETE error:", err);
    return apiInternalError();
  }
}
