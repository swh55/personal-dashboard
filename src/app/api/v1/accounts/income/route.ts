// =============================================================================
// POST /api/v1/accounts/income — record income (positive cash flow)
// =============================================================================
// Body: { accountId, amount, currency?, category?, description?, date? }
//
// Credits the account with the income amount and records an Expense row with
// a negative amount (the existing app convention — income = negative expense).
// Atomic transaction. Records sync events for both the account update and the
// expense creation.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { recordSyncEvent, serializeForSync } from "@/lib/api/sync";
import {
  apiSuccess,
  apiNotFound,
  apiInternalError,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

const IncomeSchema = z
  .object({
    accountId: z.string().min(1).max(100),
    amount: z.number().finite().positive(),
    currency: z.enum(["syp", "usd"]).default("syp"),
    category: z.string().max(100).default("income"),
    description: z.string().max(2000).optional(),
    date: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, deviceId } = pr.principal;

  const parsed = await parseBody(req, IncomeSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { accountId, amount, currency, category, description, date } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: accountId } });
      if (!account || account.userId !== userId) {
        throw new Error("ACCOUNT_NOT_FOUND");
      }

      // Credit the account
      const updatedAccount = await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: amount }, version: { increment: 1 } },
      });

      // Record an Expense with negative amount (income convention)
      const expense = await tx.expense.create({
        data: {
          userId,
          amount: -amount, // negative = income
          currency,
          category,
          description: description || "دخل",
          date: date ? new Date(date) : new Date(),
          accountId,
          version: 1,
        },
      });

      // Sync events
      await recordSyncEvent(tx, {
        userId,
        entity: "account",
        entityId: accountId,
        operation: "update",
        payload: serializeForSync(updatedAccount),
        deviceId,
      });
      await recordSyncEvent(tx, {
        userId,
        entity: "expense",
        entityId: expense.id,
        operation: "create",
        payload: serializeForSync(expense),
        deviceId,
      });

      return { account: updatedAccount, expense };
    });

    await logActivity(
      "income",
      "account",
      `دخل ${amount} ${currency}`,
      userId
    ).catch(() => {});

    return apiSuccess(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "ACCOUNT_NOT_FOUND") {
      return apiNotFound("Account not found");
    }
    console.error("[v1:accounts/income] error:", err);
    return apiInternalError();
  }
}
