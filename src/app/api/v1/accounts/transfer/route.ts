// =============================================================================
// POST /api/v1/accounts/transfer — transfer between two accounts
// =============================================================================
// Body: { fromAccountId, toAccountId, amount, currency?, note? }
//
// Atomic transaction: debits `fromAccount` and credits `toAccount` in a single
// Prisma $transaction. Both accounts must belong to the caller. Records an
// Expense row (negative amount for the from-account) for audit trail.
//
// This is a v1 mirror of the existing /api/accounts/transfer route, with zod
// validation + sync event recording.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePrincipal } from "@/lib/api/auth-v1";
import { recordSyncEvent, serializeForSync } from "@/lib/api/sync";
import {
  apiSuccess,
  apiValidationError,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
} from "@/lib/api/response";
import { parseBody } from "@/lib/api/validation";

const TransferSchema = z
  .object({
    fromAccountId: z.string().min(1).max(100),
    toAccountId: z.string().min(1).max(100),
    amount: z.number().finite().positive(),
    currency: z.enum(["syp", "usd"]).default("syp"),
    note: z.string().max(2000).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const pr = await requirePrincipal(req);
  if (!pr.ok) return pr.response;
  const { userId, deviceId } = pr.principal;

  const parsed = await parseBody(req, TransferSchema);
  if (!parsed.ok) return parsed.response as NextResponse;
  const { fromAccountId, toAccountId, amount, currency, note } = parsed.data;

  if (fromAccountId === toAccountId) {
    return apiBadRequest("Source and destination accounts must be different");
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Lock both accounts (verify ownership + currency match)
      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findUnique({ where: { id: fromAccountId } }),
        tx.account.findUnique({ where: { id: toAccountId } }),
      ]);

      if (!fromAccount || fromAccount.userId !== userId) {
        throw new Error("FROM_ACCOUNT_NOT_FOUND");
      }
      if (!toAccount || toAccount.userId !== userId) {
        throw new Error("TO_ACCOUNT_NOT_FOUND");
      }
      if (fromAccount.currency !== toAccount.currency) {
        throw new Error("CURRENCY_MISMATCH");
      }
      if (fromAccount.balance < amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Debit + credit
      const [updatedFrom, updatedTo] = await Promise.all([
        tx.account.update({
          where: { id: fromAccountId },
          data: { balance: { decrement: amount }, version: { increment: 1 } },
        }),
        tx.account.update({
          where: { id: toAccountId },
          data: { balance: { increment: amount }, version: { increment: 1 } },
        }),
      ]);

      // Record an audit Expense (negative amount = transfer out)
      const expense = await tx.expense.create({
        data: {
          userId,
          amount: -amount,
          currency,
          category: "transfer",
          description: note || `تحويل من ${fromAccount.name} إلى ${toAccount.name}`,
          date: new Date(),
          accountId: fromAccountId,
          version: 1,
        },
      });

      // Record sync events for all three mutated entities
      await recordSyncEvent(tx, {
        userId,
        entity: "account",
        entityId: fromAccountId,
        operation: "update",
        payload: serializeForSync(updatedFrom),
        deviceId,
      });
      await recordSyncEvent(tx, {
        userId,
        entity: "account",
        entityId: toAccountId,
        operation: "update",
        payload: serializeForSync(updatedTo),
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

      return { fromAccount: updatedFrom, toAccount: updatedTo, expense };
    });

    await logActivity(
      "transfer",
      "account",
      `تحويل ${amount} ${currency}`,
      userId
    ).catch(() => {});

    return apiSuccess(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "FROM_ACCOUNT_NOT_FOUND" || msg === "TO_ACCOUNT_NOT_FOUND") {
      return apiNotFound("One or both accounts were not found");
    }
    if (msg === "CURRENCY_MISMATCH") {
      return apiBadRequest("Accounts must have the same currency");
    }
    if (msg === "INSUFFICIENT_BALANCE") {
      return apiBadRequest("Insufficient balance in the source account");
    }
    console.error("[v1:accounts/transfer] error:", err);
    return apiInternalError();
  }
}
