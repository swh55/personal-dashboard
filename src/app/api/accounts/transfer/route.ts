import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { getCurrentUser } from "@/lib/auth-helpers";

/**
 * POST /api/accounts/transfer
 * Body: { fromAccountId, toAccountId, amount, currency, note? }
 *
 * Moves money between two accounts owned by the current user.
 * - Both accounts must belong to the authenticated user.
 * - The from-account is debited, the to-account is credited.
 * - A single Expense record is created with category="transfer" linked to the
 *   from-account, describing the transfer in its `description` field.
 * - The whole operation runs in a transaction so balances + expense record stay
 *   consistent.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "يلزم تسجيل الدخول" },
        { status: 401 }
      );
    }
    const userId = user.id;
    const body = await req.json();
    const { fromAccountId, toAccountId, amount, currency, note } = body ?? {};

    // --- validation ---
    if (!fromAccountId || !toAccountId) {
      return NextResponse.json(
        { success: false, error: "يلزم تحديد الحساب المصدري والوجهة" },
        { status: 400 }
      );
    }
    if (fromAccountId === toAccountId) {
      return NextResponse.json(
        { success: false, error: "لا يمكن التحويل من حساب إلى نفسه" },
        { status: 400 }
      );
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json(
        { success: false, error: "المبلغ يجب أن يكون رقماً موجباً" },
        { status: 400 }
      );
    }

    // Fetch both accounts in one round-trip and verify ownership.
    const accounts = await db.account.findMany({
      where: { id: { in: [fromAccountId, toAccountId] } },
    });
    const fromAccount = accounts.find((a) => a.id === fromAccountId);
    const toAccount = accounts.find((a) => a.id === toAccountId);
    if (!fromAccount || fromAccount.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "الحساب المصدري غير موجود أو غير مصرح" },
        { status: 403 }
      );
    }
    if (!toAccount || toAccount.userId !== userId) {
      return NextResponse.json(
        { success: false, error: "حساب الوجهة غير موجود أو غير مصرح" },
        { status: 403 }
      );
    }

    // Currency mismatch is allowed (cross-currency transfer), but we record
    // the transfer using the from-account's currency for the expense record.
    const effectiveCurrency = currency || fromAccount.currency;

    // Run everything in a transaction.
    const [updatedFrom, updatedTo] = await db.$transaction([
      db.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amt } },
      }),
      db.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amt } },
      }),
      // Record the transfer as an Expense entry linked to the from-account.
      db.expense.create({
        data: {
          userId,
          amount: amt,
          currency: effectiveCurrency,
          category: "transfer",
          description: note
            ? `تحويل إلى ${toAccount.name}: ${note}`
            : `تحويل بين الحسابات (${fromAccount.name} → ${toAccount.name})`,
          date: new Date(),
          accountId: fromAccountId,
        },
      }),
    ]);

    await logActivity(
      "transfer",
      "account",
      `تحويل ${amt} ${effectiveCurrency} من ${fromAccount.name} إلى ${toAccount.name}`,
      userId
    );

    return NextResponse.json({
      success: true,
      data: {
        fromAccount: { id: updatedFrom.id, balance: updatedFrom.balance },
        toAccount: { id: updatedTo.id, balance: updatedTo.balance },
        amount: amt,
        currency: effectiveCurrency,
      },
    });
  } catch (error) {
    console.error("POST transfer error:", error);
    return NextResponse.json(
      { success: false, error: "فشل إجراء التحويل" },
      { status: 500 }
    );
  }
}
