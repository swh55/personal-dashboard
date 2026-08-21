// =============================================================================
// /api/v1/recycle-bin — soft-deleted records (list / restore / permanent delete)
// =============================================================================
// GET    /api/v1/recycle-bin              — list all soft-deleted records grouped by type
// PUT    /api/v1/recycle-bin              — restore a soft-deleted record { type, id }
// DELETE /api/v1/recycle-bin              — permanently delete { type, id }
//
// Supports the 11 entity types that have a `deletedAt` field:
//   contacts, notes, tasks, events, expenses, debts, projects, meetings,
//   diary, medications, scheduled-messages
//
// (Budgets, assets, accounts, occasions, habits, pantry, waiting-list,
//  locations, reminders, automation, suggestions, integrations, happiness
//  also now have deletedAt via the v1 schema update, so they're included too.)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePrincipal } from "@/lib/api/auth-v1";
import {
  apiSuccess,
  apiValidationError,
  apiNotFound,
  apiInternalError,
  apiBadRequest,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

// Maps the recycle-bin `type` name to the Prisma delegate.
const RECYCLE_MAP: Record<string, any> = {
  contacts: db.contact,
  notes: db.note,
  tasks: db.task,
  events: db.event,
  expenses: db.expense,
  debts: db.debt,
  projects: db.project,
  meetings: db.meeting,
  diary: db.diaryEntry,
  medications: db.medication,
  "scheduled-messages": db.scheduledMessage,
  budgets: db.budget,
  assets: db.asset,
  accounts: db.account,
  occasions: db.occasion,
  habits: db.habit,
  pantry: db.pantryItem,
  "waiting-list": db.waitingItem,
  locations: db.savedLocation,
  reminders: db.contactReminder,
  automation: db.automationRule,
  suggestions: db.suggestion,
  integrations: db.integration,
  happiness: db.happinessLog,
};

const RestoreSchema = z
  .object({
    type: z.string().min(1),
    id: z.string().min(1).max(100),
  })
  .strict();

// --- GET: list all soft-deleted records grouped by type ---
export async function GET(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  try {
    const result: Record<string, unknown[]> = {};
    for (const [typeName, delegate] of Object.entries(RECYCLE_MAP)) {
      const rows = await delegate.findMany({
        where: { userId, deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      });
      if (rows.length > 0) result[typeName] = rows;
    }
    return apiSuccess(result);
  } catch (err) {
    console.error("[v1:recycle-bin] GET error:", err);
    return apiInternalError();
  }
}

// --- PUT: restore a soft-deleted record ---
export async function PUT(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const parsed = await parseBody(req, RestoreSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { type, id } = parsed.data;

  const delegate = RECYCLE_MAP[type];
  if (!delegate) {
    return apiBadRequest(`Unknown entity type: ${type}`);
  }

  try {
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return apiNotFound();
    }
    if (!existing.deletedAt) {
      return apiBadRequest("Record is not deleted");
    }
    const restored = await delegate.update({
      where: { id },
      data: { deletedAt: null, version: { increment: 1 } },
    });
    return apiSuccess(restored);
  } catch (err) {
    console.error("[v1:recycle-bin] PUT restore error:", err);
    return apiInternalError();
  }
}

// --- DELETE: permanently delete a soft-deleted record ---
export async function DELETE(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId } = pr.principal;

  const parsed = await parseBody(req, RestoreSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { type, id } = parsed.data;

  const delegate = RECYCLE_MAP[type];
  if (!delegate) {
    return apiBadRequest(`Unknown entity type: ${type}`);
  }

  try {
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return apiNotFound();
    }
    await delegate.delete({ where: { id } });
    return apiSuccess({ id, type, permanentlyDeleted: true });
  } catch (err) {
    console.error("[v1:recycle-bin] DELETE permanent error:", err);
    return apiInternalError();
  }
}
