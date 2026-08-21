// =============================================================================
// /api/v1/devices — device management
// =============================================================================
// GET    /api/v1/devices         — list the caller's devices
// POST   /api/v1/devices         — register/update a device (rarely needed —
//                                  /auth/token does this automatically)
// GET    /api/v1/devices/:id     — get one device
// DELETE /api/v1/devices/:id     — revoke a device (remote logout)
//
// Devices are always scoped to the authenticated user. A user cannot see or
// revoke another user's devices.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
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

// --- GET /api/v1/devices ---
export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;
  const { page, pageSize, skip, take } = parsePagination(req);

  try {
    const [rows, total] = await Promise.all([
      db.device.findMany({
        where: { userId },
        orderBy: { lastSeenAt: "desc" },
        skip,
        take,
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
        },
      }),
      db.device.count({ where: { userId } }),
    ]);
    return apiList(rows, buildPaginationMeta(page, pageSize, total));
  } catch (err) {
    console.error("[devices] GET error:", err);
    return apiInternalError();
  }
}

const CreateDeviceSchema = z
  .object({
    deviceId: z.string().min(1).max(200),
    name: z.string().max(200).optional(),
    platform: z.enum(["android", "windows", "ios", "web", "other"]).optional(),
    appVersion: z.string().max(100).optional(),
  })
  .strict();

// --- POST /api/v1/devices ---
export async function POST(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const parsed = await parseBody(req, CreateDeviceSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { deviceId, name, platform, appVersion } = parsed.data;
  const ua = req.headers.get("user-agent") ?? null;

  try {
    const device = await db.device.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      update: {
        name: name ?? "Unnamed device",
        platform: platform ?? "unknown",
        appVersion: appVersion ?? null,
        userAgent: ua,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
      create: {
        userId,
        deviceId,
        name: name ?? "Unnamed device",
        platform: platform ?? "unknown",
        appVersion: appVersion ?? null,
        userAgent: ua,
      },
      select: {
        id: true,
        name: true,
        platform: true,
        appVersion: true,
        deviceId: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    return apiCreated(device);
  } catch (err) {
    console.error("[devices] POST error:", err);
    return apiInternalError();
  }
}
